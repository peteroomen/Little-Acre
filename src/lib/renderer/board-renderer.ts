/**
 * Little Acre — isometric board renderer (Canvas2D only; no React, no store imports).
 *
 * Ported from the `Farm Idle.dc.html` prototype's draw()/drawTile()/drawPlant()/… into a
 * typed imperative module. Game.tsx owns a single instance: it feeds a board snapshot each
 * time state changes and calls the fx methods on action results, so React never re-renders
 * per frame. The renderer owns tile geometry (positions + hit-testing) and all particle fx.
 */

import {
  CROP,
  FLOWER,
  FURROW,
  FX,
  HOVER_OUTLINE,
  POLLEN,
  POND,
  ROCK,
  SCARECROW,
  SPRINKLER,
  SUN_GLOW,
  TILE_SIDE,
  TILE_TOP,
} from './palette';
import type { CropId, StructId, Tile } from '../game/tiles';

export interface BoardSnapshot {
  board: Tile[];
  phase: 'day' | 'night';
  hoverKey: string | null;
}

interface Particle {
  type: 'p' | 'coin' | 'text';
  x: number;
  y: number;
  vx: number;
  vy: number;
  grav: number;
  color: string;
  size: number;
  life: number;
  age: number;
  text?: string;
  style?: string;
}

interface TileAnim {
  popT: number | null;
  nudgeT: number | null;
  placeT: number | null;
  placeDone: boolean;
}

interface Geom {
  cx: number;
  cy: number;
  spk: [number, number, number][];
  spots: [number, number, number][];
}

const rr16 = (n: number): number => Math.round(n);

export class BoardRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private snapshot: BoardSnapshot = { board: [], phase: 'day', hoverKey: null };

  private cssW = 0;
  private cssH = 0;
  private sc = 1;
  private tileW = 158;
  private tileH = 80;
  private D = 26;
  private HW = 79;
  private QH = 40;
  private stepX = 79;
  private stepY = 20;
  private originX = 0;
  private originY = 0;

  private geom = new Map<string, Geom>();
  private anims = new Map<string, TileAnim>();
  private amb: { x: number; y: number; sp: number; ph: number }[] = [];
  private fx: Particle[] = [];
  private shake = 0;
  private lt = 0;
  private raf = 0;
  private ro: ResizeObserver | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas context unavailable');
    this.ctx = ctx;
    for (let i = 0; i < 16; i++) {
      this.amb.push({
        x: Math.random(),
        y: Math.random(),
        sp: 0.02 + Math.random() * 0.04,
        ph: Math.random() * 6.28,
      });
    }
    this.buildGeometry();
    this.resize();
    this.ro = new ResizeObserver(() => this.resize());
    if (canvas.parentElement) this.ro.observe(canvas.parentElement);
  }

  setSnapshot(s: BoardSnapshot): void {
    this.snapshot = s;
  }

  start(): void {
    const loop = (ms: number) => {
      const time = ms / 1000;
      if (this.lt === 0) this.lt = time;
      const dt = Math.min(0.05, time - this.lt);
      this.lt = time;
      this.draw(time, dt);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
  }

  // ── geometry + hit testing ──

  private key(r: number, c: number): string {
    return `${r}-${c}`;
  }

  /** Deterministic per-tile speckle + crop-spot layout (seeded, prototype-faithful). */
  private buildGeometry(): void {
    let s = 1337;
    const rnd = () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const spk: [number, number, number][] = [];
        for (let i = 0; i < 22; i++) spk.push([rnd(), rnd(), rnd()]);
        const spots: [number, number, number][] = [];
        for (const a of [0.32, 0.6]) for (const b of [0.32, 0.6]) spots.push([a, b, rnd() * 6.28]);
        this.geom.set(this.key(r, c), { cx: 0, cy: 0, spk, spots });
        this.anims.set(this.key(r, c), { popT: null, nudgeT: null, placeT: null, placeDone: true });
      }
    }
  }

  private resize(): void {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    this.cssW = rect.width;
    this.cssH = rect.height;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(this.cssW * dpr);
    this.canvas.height = Math.round(this.cssH * dpr);
    this.canvas.style.width = `${this.cssW}px`;
    this.canvas.style.height = `${this.cssH}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = false;

    const sc = Math.max(0.6, Math.min(1.1, this.cssW / 900));
    this.sc = sc;
    this.tileW = 158 * sc;
    this.tileH = 80 * sc;
    this.D = 26 * sc;
    this.HW = this.tileW / 2;
    this.QH = this.tileH / 2;
    this.stepX = this.HW;
    this.stepY = this.QH;
    this.originX = this.cssW / 2;
    this.originY = this.cssH * 0.5 - 2 * this.stepY;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const g = this.geom.get(this.key(r, c))!;
        g.cx = this.originX + (c - r) * this.stepX;
        g.cy = this.originY + (c + r) * this.stepY;
      }
    }
  }

  /** Hit-test canvas-local (px,py) to a tile, front-to-back. */
  tileAt(px: number, py: number): { r: number; c: number } | null {
    const order: { r: number; c: number; g: Geom }[] = [];
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 3; c++) order.push({ r, c, g: this.geom.get(this.key(r, c))! });
    order.sort((a, b) => b.r + b.c - (a.r + a.c));
    for (const { r, c, g } of order) {
      const dcx = px - g.cx;
      const dcy = py - (g.cy + this.QH);
      if (Math.abs(dcx) / this.HW + Math.abs(dcy) / this.QH <= 1) return { r, c };
    }
    return null;
  }

  /** Screen-space fx origin for a tile (its visual center). */
  tileCenter(r: number, c: number): { x: number; y: number } {
    const g = this.geom.get(this.key(r, c))!;
    return { x: g.cx, y: g.cy + this.QH };
  }

  // ── fx api ──

  pop(r: number, c: number): void {
    const a = this.anims.get(this.key(r, c));
    if (a) a.popT = this.lt;
  }
  nudge(r: number, c: number): void {
    const a = this.anims.get(this.key(r, c));
    if (a) a.nudgeT = this.lt;
  }
  placeAnim(r: number, c: number): void {
    const a = this.anims.get(this.key(r, c));
    if (a) {
      a.placeT = this.lt;
      a.placeDone = false;
    }
  }
  addShake(m: number): void {
    this.shake = Math.max(this.shake, m);
  }

  floatText(x: number, y: number, text: string, style: string): void {
    this.fx.push({
      type: 'text',
      x,
      y,
      vx: 0,
      vy: -34,
      grav: 0,
      color: '',
      size: 0,
      text,
      style,
      life: 1.1,
      age: 0,
    });
  }
  burst(x: number, y: number, color: string, n: number, spd = 60): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.28;
      const v = spd * (0.4 + Math.random() * 0.7);
      this.fx.push({
        type: 'p',
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 30,
        grav: 240,
        color,
        size: 2 + Math.random() * 3 * this.sc,
        life: 0.5 + Math.random() * 0.4,
        age: 0,
      });
    }
  }
  splash(x: number, y: number): void {
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.4;
      const v = 50 + Math.random() * 50;
      this.fx.push({
        type: 'p',
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        grav: 300,
        color: Math.random() > 0.5 ? CROP.droplet : FX.splashLight,
        size: 2 + Math.random() * 2 * this.sc,
        life: 0.5 + Math.random() * 0.3,
        age: 0,
      });
    }
  }
  coinBurst(x: number, y: number): void {
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.8;
      const v = 60 + Math.random() * 70;
      this.fx.push({
        type: 'coin',
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        grav: 320,
        color: FX.coin,
        size: 4 * this.sc,
        life: 0.7 + Math.random() * 0.3,
        age: 0,
      });
    }
  }

  // ── drawing ──

  private rect(x: number, y: number, w: number, h: number, col: string): void {
    const c = this.ctx;
    c.fillStyle = col;
    c.fillRect(rr16(x), rr16(y), Math.max(1, rr16(w)), Math.max(1, rr16(h)));
  }

  private bounce(p: number): number {
    if (p < 1 / 2.75) return 7.5625 * p * p;
    if (p < 2 / 2.75) {
      p -= 1.5 / 2.75;
      return 7.5625 * p * p + 0.75;
    }
    if (p < 2.5 / 2.75) {
      p -= 2.25 / 2.75;
      return 7.5625 * p * p + 0.9375;
    }
    p -= 2.625 / 2.75;
    return 7.5625 * p * p + 0.984375;
  }

  private draw(time: number, dt: number): void {
    const c = this.ctx;
    if (!this.cssW) return;
    c.clearRect(0, 0, this.cssW, this.cssH);
    const g = c.createRadialGradient(
      this.cssW * 0.82,
      this.cssH * 0.1,
      10,
      this.cssW * 0.82,
      this.cssH * 0.1,
      this.cssW * 0.5,
    );
    g.addColorStop(0, SUN_GLOW);
    g.addColorStop(1, 'rgba(255,248,215,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, this.cssW, this.cssH);

    c.save();
    if (this.shake > 0.1) {
      c.translate((Math.random() * 2 - 1) * this.shake, (Math.random() * 2 - 1) * this.shake);
      this.shake = Math.max(0, this.shake - dt * 34);
    }

    for (const p of this.amb) {
      const px = p.x * this.cssW;
      const py = this.cssH - ((p.y + time * p.sp) % 1) * this.cssH;
      const a = 0.18 + 0.2 * Math.sin(time * 2 + p.ph);
      c.fillStyle = `rgba(${POLLEN},${a.toFixed(2)})`;
      c.fillRect(rr16(px), rr16(py), 3, 3);
    }

    const order = [...this.snapshot.board].sort((a, b) => a.r + a.c - (b.r + b.c));
    for (const t of order) this.drawTile(t, time);

    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i];
      f.age += dt;
      if (f.age >= f.life) {
        this.fx.splice(i, 1);
        continue;
      }
      const k = 1 - f.age / f.life;
      if (f.type === 'text') {
        f.y += f.vy * dt;
        c.globalAlpha = Math.min(1, k * 1.6);
        c.font = `${(f.style === 'coinBig' ? 22 : 15) * this.sc}px 'Pixelify Sans', monospace`;
        c.textAlign = 'center';
        c.fillStyle =
          f.style === 'bad'
            ? FX.badText
            : f.style && f.style.indexOf('coin') === 0
              ? FX.coinText
              : FX.gainText;
        c.lineWidth = 3;
        c.strokeStyle = FX.textStroke;
        c.strokeText(f.text!, f.x, f.y);
        c.fillText(f.text!, f.x, f.y);
        c.globalAlpha = 1;
        c.textAlign = 'left';
      } else if (f.type === 'coin') {
        f.vy += f.grav * dt;
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        c.globalAlpha = k;
        c.fillStyle = FX.coin;
        c.fillRect(rr16(f.x), rr16(f.y), rr16(f.size), rr16(f.size));
        c.fillStyle = FX.coinShine;
        c.fillRect(rr16(f.x), rr16(f.y), rr16(f.size), 1);
        c.globalAlpha = 1;
      } else {
        f.vy += f.grav * dt;
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        c.globalAlpha = k;
        c.fillStyle = f.color;
        c.fillRect(rr16(f.x), rr16(f.y), rr16(f.size), rr16(f.size));
        c.globalAlpha = 1;
      }
    }
    c.restore();
  }

  private drawTile(t: Tile, time: number): void {
    const c = this.ctx;
    const { HW, QH, D } = this;
    const g = this.geom.get(this.key(t.r, t.c))!;
    const anim = this.anims.get(this.key(t.r, t.c))!;
    const cx = g.cx;
    let oy = g.cy;
    const hovered = this.snapshot.hoverKey === this.key(t.r, t.c) && this.snapshot.phase === 'day';
    if (hovered) oy -= 5;

    let scale = 1;
    if (anim.nudgeT != null) {
      const p = (this.lt - anim.nudgeT) / 0.22;
      if (p < 1) scale *= 1 - Math.sin(p * Math.PI) * 0.05;
      else anim.nudgeT = null;
    }
    if (anim.popT != null) {
      const p = (this.lt - anim.popT) / 0.28;
      if (p < 1) scale *= 1 + Math.sin(p * Math.PI) * 0.13;
      else anim.popT = null;
    }
    if (anim.placeT != null) {
      const p = (time - anim.placeT) / 0.6;
      if (p < 1) {
        const b = this.bounce(p);
        oy -= (1 - b) * 120 * this.sc;
        scale *= 0.7 + 0.3 * b;
      } else if (!anim.placeDone) {
        anim.placeDone = true;
        anim.placeT = null;
        this.burst(cx, g.cy + QH, '#c9a56f', 16, 80);
        this.addShake(3);
      }
    }

    c.save();
    const pivx = cx;
    const pivy = oy + QH * 2;
    c.translate(pivx, pivy);
    c.scale(scale, scale);
    c.translate(-pivx, -pivy);

    const top: [number, number] = [cx, oy];
    const right: [number, number] = [cx + HW, oy + QH];
    const bot: [number, number] = [cx, oy + QH * 2];
    const left: [number, number] = [cx - HW, oy + QH];

    // cube sides
    c.fillStyle = TILE_SIDE.right;
    c.beginPath();
    c.moveTo(bot[0], bot[1]);
    c.lineTo(right[0], right[1]);
    c.lineTo(right[0], right[1] + D);
    c.lineTo(bot[0], bot[1] + D);
    c.closePath();
    c.fill();
    c.fillStyle = TILE_SIDE.left;
    c.beginPath();
    c.moveTo(bot[0], bot[1]);
    c.lineTo(left[0], left[1]);
    c.lineTo(left[0], left[1] + D);
    c.lineTo(bot[0], bot[1] + D);
    c.closePath();
    c.fill();
    c.fillStyle = TILE_SIDE.edge;
    c.fillRect(rr16(left[0]), rr16(left[1] + D - 1), rr16(HW * 2), 2);

    const watered = t.kind === 'tilled' && !!t.crop && t.watered && !t.wilted;
    let ramp: readonly [string, string, string] = TILE_TOP.grass;
    if (t.kind === 'tilled') ramp = watered ? TILE_TOP.tilledWet : TILE_TOP.tilledDry;
    else if (t.kind === 'pond') ramp = TILE_TOP.pond;
    else if (t.kind === 'rock') ramp = TILE_TOP.rock;
    const [base, dk, lt] = ramp;

    c.fillStyle = base;
    c.beginPath();
    c.moveTo(top[0], top[1]);
    c.lineTo(right[0], right[1]);
    c.lineTo(bot[0], bot[1]);
    c.lineTo(left[0], left[1]);
    c.closePath();
    c.fill();
    c.save();
    c.clip();
    for (const [a, b, k] of g.spk) {
      const sx = cx + (a - b) * HW;
      const sy = oy + (a + b) * QH;
      c.fillStyle = k > 0.5 ? lt : dk;
      const sz = t.kind === 'tilled' ? 3 : 2 + Math.round(k * 3);
      c.fillRect(rr16(sx), rr16(sy), sz, Math.max(2, rr16(sz * 0.6)));
    }
    if (t.kind === 'tilled') {
      c.strokeStyle = FURROW;
      c.lineWidth = 2;
      for (let i = 1; i < 4; i++) {
        const f = i / 4;
        c.beginPath();
        c.moveTo(cx - HW + f * HW, oy + f * QH);
        c.lineTo(cx + f * HW, oy + QH + f * QH);
        c.stroke();
      }
    }
    c.restore();

    if (t.kind === 'pond') this.drawPond(cx, oy, time);
    else if (t.kind === 'rock') this.drawRock(cx, oy);
    else if (t.kind === 'flower')
      for (const [a, b] of [
        [0.35, 0.4],
        [0.62, 0.66],
        [0.5, 0.28],
      ])
        this.drawFlower(cx + (a - b) * HW, oy + (a + b) * QH);
    else if (t.kind === 'tilled' && t.crop) {
      for (const [a, b, ph] of g.spots)
        this.drawPlant(cx + (a - b) * HW, oy + (a + b) * QH, t.crop, t.stage, t.wilted, time, ph);
      if (t.stage >= 3 && !t.wilted) {
        const bob = Math.sin(time * 3) * 2;
        this.drawSparkle(cx, oy - 6 + bob, time);
      }
      if (watered) {
        const dy = Math.sin(time * 4) * 1;
        this.rect(cx + HW * 0.5, oy + QH * 0.5 + dy, 3, 4, CROP.droplet);
      }
    }
    if (t.structure) this.drawStructure(cx, oy, t.structure, time);

    if (hovered) {
      c.strokeStyle = HOVER_OUTLINE;
      c.lineWidth = 2 + Math.sin(time * 6) * 0.6;
      c.beginPath();
      c.moveTo(top[0], top[1]);
      c.lineTo(right[0], right[1]);
      c.lineTo(bot[0], bot[1]);
      c.lineTo(left[0], left[1]);
      c.closePath();
      c.stroke();
    }
    c.restore();
  }

  private drawPlant(
    px: number,
    py: number,
    crop: CropId,
    stage: number,
    wilted: boolean,
    time: number,
    ph: number,
  ): void {
    const c = this.ctx;
    const M = this.sc * 1.6;
    c.save();
    c.translate(px, py);
    c.scale(M, M);
    const rr = (x: number, y: number, w: number, h: number, col: string) =>
      this.rect(x, y, w, h, col);
    const cd = CROP_COLORS[crop];
    if (wilted) {
      rr(0.5, -5, 1.5, 5, CROP.wiltStem);
      rr(-3, -2, 6, 2, CROP.wiltLeaf);
      rr(1.5, -6, 3, 2, CROP.wiltStem);
      c.restore();
      return;
    }
    if (stage === 0) {
      rr(-1, -3, 2, 3, CROP.sprout);
      rr(-2.5, -4, 5, 2, cd.leaf);
      c.restore();
      return;
    }
    const H = stage === 1 ? 6 : stage === 2 ? 10 : 13;
    const sway = Math.sin(time * 2 + ph) * 1.2;
    rr(-1 + sway, -H, 2, H, CROP.stem);
    rr(-3.5 + sway, -H - 2, 7, 3, cd.leaf);
    rr(-2.5 + sway, -H + 3, 5, 3, cd.leaf);
    if (stage >= 3) {
      if (crop === 'carrot') {
        rr(-1.5, -1, 3, 3, cd.color);
        rr(-1, 2, 2, 2, '#e87b34');
      } else if (crop === 'wheat') {
        rr(-2 + sway, -H - 4, 4, 4, cd.color);
      } else {
        rr(-4 + sway, -H, 3, 3, cd.color);
        rr(1.5 + sway, -H + 2, 3, 3, cd.color);
      }
    }
    c.restore();
  }

  private drawSparkle(cx: number, cy: number, time: number): void {
    const s = this.sc;
    const a = 0.5 + 0.5 * Math.sin(time * 5);
    this.ctx.globalAlpha = a;
    this.rect(cx - 1, cy - 4, 2, 8 * s, CROP.sparkle);
    this.rect(cx - 4, cy - 1, 8 * s, 2, CROP.sparkle);
    this.ctx.globalAlpha = 1;
  }

  private drawFlower(px: number, py: number): void {
    const c = this.ctx;
    const M = this.sc * 1.5;
    c.save();
    c.translate(px, py);
    c.scale(M, M);
    const rr = (x: number, y: number, w: number, h: number, col: string) =>
      this.rect(x, y, w, h, col);
    rr(-2, -2, 2, 2, FLOWER.petal);
    rr(1, -2, 2, 2, FLOWER.petal);
    rr(-2, 1, 2, 2, FLOWER.petal);
    rr(1, 1, 2, 2, FLOWER.petal);
    rr(-0.5, -0.5, 2, 2, FLOWER.center);
    c.restore();
  }

  private drawPond(cx: number, oy: number, time: number): void {
    const s = this.sc;
    const yb = oy + this.QH;
    const rr = (x: number, y: number, w: number, h: number, col: string) =>
      this.rect(x, y, w * s, h * s, col);
    for (const [dx, dy, ph] of [
      [-14, -4, 0],
      [10, 2, 2],
      [-4, 8, 4],
    ]) {
      const w = 5 + 2 * Math.sin(time * 2 + ph);
      rr(cx + dx, yb + dy, w, 1.6, POND.ripple);
    }
    const fx = cx + Math.sin(time * 0.6) * 8 * s;
    const fy = yb;
    rr(fx - 4, fy - 2, 7, 4, POND.fish);
    rr(fx + 3, fy - 3, 3, 2, POND.fish);
    rr(fx + 3, fy + 1, 3, 2, POND.fish);
    rr(fx - 3, fy - 1, 1.5, 1.5, POND.fishEye);
  }

  private drawRock(cx: number, oy: number): void {
    const s = this.sc;
    const yb = oy + this.QH;
    const rr = (x: number, y: number, w: number, h: number, col: string) =>
      this.rect(x, y, w * s, h * s, col);
    rr(cx - 12, yb - 3, 12, 9, ROCK.a);
    rr(cx - 12, yb - 5, 12, 3, ROCK.aTop);
    rr(cx - 12, yb + 5, 12, 2, ROCK.aBase);
    rr(cx + 2, yb, 10, 7, ROCK.b);
    rr(cx + 2, yb - 2, 10, 3, ROCK.bTop);
    rr(cx - 7, yb - 2, 2, 2, ROCK.oreBlue);
    rr(cx + 6, yb + 1, 2, 2, ROCK.oreGem);
  }

  private drawStructure(cx: number, oy: number, kind: StructId, time: number): void {
    const c = this.ctx;
    const M = this.sc * 1.7;
    const yb = oy + this.QH;
    c.save();
    c.translate(cx, yb);
    c.scale(M, M);
    const rr = (x: number, y: number, w: number, h: number, col: string) =>
      this.rect(x, y, w, h, col);
    if (kind === 'sprinkler') {
      rr(-1, -11, 2, 11, SPRINKLER.post);
      rr(-2, -1, 4, 2, SPRINKLER.postBase);
      rr(-4, -13, 8, 3, SPRINKLER.head);
      rr(-4, -13, 8, 1, SPRINKLER.headTop);
      const t2 = (time * 2.4) % 1;
      rr(-7, -11 + t2 * 5, 1.6, 1.6, SPRINKLER.drop);
      rr(6, -11 + ((t2 + 0.5) % 1) * 5, 1.6, 1.6, SPRINKLER.drop);
    } else {
      rr(-0.7, -15, 1.6, 15, SCARECROW.post);
      rr(-6, -11, 12, 1.8, SCARECROW.post);
      rr(-3, -17, 6, 5, SCARECROW.head);
      rr(-3, -17, 6, 1.5, SCARECROW.headTop);
      rr(-2, -15, 1.4, 1.4, SCARECROW.eye);
      rr(1, -15, 1.4, 1.4, SCARECROW.eye);
      rr(-3.5, -11, 7, 5, SCARECROW.body);
      rr(-3.5, -11, 7, 1.5, SCARECROW.bodyTop);
      rr(-4.5, -18, 9, 2, SCARECROW.hat);
    }
    c.restore();
  }
}

/** Crop body/leaf accents, kept beside the renderer (drawing detail, not game logic). */
const CROP_COLORS: Record<CropId, { color: string; leaf: string }> = {
  carrot: { color: '#f0894a', leaf: '#83c250' },
  lettuce: { color: '#8fce5e', leaf: '#b6e388' },
  wheat: { color: '#eecf5f', leaf: '#d1ad5c' },
  tomato: { color: '#ef6a4e', leaf: '#6cb04a' },
};
