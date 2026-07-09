/* <farm-board> — static isometric pixel board painter for Little Acre mockups.
   Attributes: preset="farm|menu|tomato", cy="0.5" (vertical center 0..1), tilescale="1" */
(function () {
  if (customElements.get('farm-board')) return;

  const CROPS = {
    carrot: { color: '#f0894a', leaf: '#83c250' },
    wheat: { color: '#eecf5f', leaf: '#d1ad5c' },
    lettuce: { color: '#8fce5e', leaf: '#b6e388' },
    tomato: { color: '#ef6a4e', leaf: '#6cb04a' },
  };

  class FarmBoard extends HTMLElement {
    connectedCallback() {
      if (this._init) { this.paint(); return; }
      this._init = true;
      this.style.display = this.style.display || 'block';
      if (!this.style.height) this.style.height = '100%';
      if (!this.style.width) this.style.width = '100%';
      this.canvas = document.createElement('canvas');
      this.canvas.style.cssText = 'display:block;width:100%;height:100%;image-rendering:pixelated;';
      this.appendChild(this.canvas);
      this._ro = new ResizeObserver(() => this.paint());
      this._ro.observe(this);
      requestAnimationFrame(() => this.paint());
    }
    disconnectedCallback() { if (this._ro) this._ro.disconnect(); }

    layout() {
      const preset = this.getAttribute('preset') || 'farm';
      if (preset === 'menu') return [
        ['grass:', 'flower:', 'grass:'],
        ['grass:', 'pond:', 'tilled:carrot:3:0'],
        ['flower:', 'grass:', 'grass:'],
      ];
      if (preset === 'tomato') return [
        ['grass:', 'tilled:tomato:3:0', 'tilled:tomato:2:1'],
        ['tilled:tomato:1:1', 'tilled:tomato:2:0', 'tilled::0:0'],
        ['pond:', 'grass:', 'grass:'],
      ];
      return [
        ['rock:', 'tilled:carrot:3:0', 'grass:'],
        ['tilled:wheat:2:1', 'tilled::0:0', 'flower:'],
        ['pond:', 'grass:', 'tilled:lettuce:1:0'],
      ];
    }

    paint() {
      const c = this.canvas; if (!c) return;
      const rect = this.getBoundingClientRect();
      if (rect.width < 10 || rect.height < 10) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      c.width = Math.round(rect.width * dpr); c.height = Math.round(rect.height * dpr);
      const x = c.getContext('2d');
      x.setTransform(dpr, 0, 0, dpr, 0, 0);
      x.imageSmoothingEnabled = false;
      x.clearRect(0, 0, rect.width, rect.height);

      let seed = 4242; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
      const T = 0.8; // frozen time for sway variety
      const tscale = parseFloat(this.getAttribute('tilescale') || '1');
      const sc = Math.max(0.4, Math.min(1.2, Math.min((rect.width - 20) / 500, (rect.height - 40) / 300))) * tscale;
      const tileW = 158 * sc, tileH = 80 * sc, D = 26 * sc;
      const HW = tileW / 2, QH = tileH / 2;
      const cyf = parseFloat(this.getAttribute('cy') || '0.5');
      const originX = rect.width / 2;
      const originY = rect.height * cyf - (3 * tileH + D) / 2;

      const r = (px, py, w, h, col) => { x.fillStyle = col; x.fillRect(Math.round(px), Math.round(py), Math.max(1, Math.round(w)), Math.max(1, Math.round(h))); };
      const grassTone = (k) => k < 0.2 ? '#649a41' : k < 0.45 ? '#7cae4f' : k < 0.72 ? '#8fbf63' : k < 0.9 ? '#aadd85' : '#c2e39a';

      const rows = this.layout();
      const tiles = [];
      for (let ri = 0; ri < rows.length; ri++) for (let ci = 0; ci < rows[ri].length; ci++) {
        const parts = rows[ri][ci].split(':');
        tiles.push({ r: ri, c: ci, kind: parts[0], crop: parts[1] || null, stage: parts[2] ? parseInt(parts[2]) : 0, watered: parts[3] === '1' });
      }
      tiles.sort((a, b) => (a.r + a.c) - (b.r + b.c));

      for (const t of tiles) {
        const cx = originX + (t.c - t.r) * HW;
        const oy = originY + (t.c + t.r) * QH;
        const top = [cx, oy], right = [cx + HW, oy + QH], bot = [cx, oy + QH * 2], left = [cx - HW, oy + QH];

        // sides
        x.fillStyle = '#8a5566';
        x.beginPath(); x.moveTo(bot[0], bot[1]); x.lineTo(right[0], right[1]); x.lineTo(right[0], right[1] + D); x.lineTo(bot[0], bot[1] + D); x.closePath(); x.fill();
        x.fillStyle = '#a87786';
        x.beginPath(); x.moveTo(bot[0], bot[1]); x.lineTo(left[0], left[1]); x.lineTo(left[0], left[1] + D); x.lineTo(bot[0], bot[1] + D); x.closePath(); x.fill();
        x.fillStyle = 'rgba(60,30,45,.18)';
        for (let i = 0; i < 5; i++) { const u = rnd(), v = rnd(), side = rnd() > 0.5; const fx = side ? bot[0] + u * HW : left[0] + u * HW; const fy = (side ? bot[1] - u * QH : left[1] + u * QH) + D * (0.35 + v * 0.45); x.fillRect(Math.round(fx), Math.round(fy), 3, 2); }
        x.fillStyle = '#6e3f4f'; x.fillRect(Math.round(left[0]), Math.round(left[1] + D - 2), Math.round(HW * 2), 3);

        // top
        const grassTop = (t.kind === 'grass' || t.kind === 'flower' || t.kind === 'rock');
        const watered = t.kind === 'tilled' && t.crop && t.watered;
        let base = '#9ccb6e';
        if (t.kind === 'tilled') base = watered ? '#9c7146' : '#c69c6d';
        else if (t.kind === 'pond') base = '#e6d3a3';
        x.fillStyle = base;
        x.beginPath(); x.moveTo(top[0], top[1]); x.lineTo(right[0], right[1]); x.lineTo(bot[0], bot[1]); x.lineTo(left[0], left[1]); x.closePath(); x.fill();
        x.save(); x.clip();
        if (grassTop) {
          const s3 = Math.max(2, Math.round(3 * sc));
          for (let i = 0; i < 30; i++) {
            const a = 0.06 + rnd() * 0.88, b = 0.06 + rnd() * 0.88, k = rnd();
            const sx = cx + (a - b) * HW, sy = oy + (a + b) * QH;
            x.fillStyle = grassTone(k);
            x.fillRect(Math.round(sx), Math.round(sy), s3, Math.max(2, Math.round(s3 * 0.7)));
            if (k > 0.35 && k < 0.7) { x.fillStyle = '#649a41'; x.fillRect(Math.round(sx + s3 * 0.3), Math.round(sy - 2), Math.max(1, Math.round(1.5 * sc)), 2); }
          }
        } else if (t.kind === 'tilled') {
          const dk = watered ? '#79593a' : '#a67c50', lt = watered ? '#b8905e' : '#dcbc90';
          for (let i = 0; i < 22; i++) {
            const a = 0.06 + rnd() * 0.88, b = 0.06 + rnd() * 0.88, k = rnd();
            x.fillStyle = k > 0.5 ? lt : dk;
            x.fillRect(Math.round(cx + (a - b) * HW), Math.round(oy + (a + b) * QH), 3, 2);
          }
          x.strokeStyle = 'rgba(90,60,30,.32)'; x.lineWidth = 2;
          for (let i = 1; i < 4; i++) { const f = i / 4; x.beginPath(); x.moveTo(cx - HW + f * HW, oy + f * QH); x.lineTo(cx + f * HW, oy + QH + f * QH); x.stroke(); }
        } else if (t.kind === 'pond') {
          for (let i = 0; i < 16; i++) {
            const a = 0.06 + rnd() * 0.88, b = 0.06 + rnd() * 0.88, k = rnd();
            x.fillStyle = k > 0.5 ? '#f0e2bb' : '#d4bf8c';
            x.fillRect(Math.round(cx + (a - b) * HW), Math.round(oy + (a + b) * QH), 3, 2);
          }
        }
        x.strokeStyle = 'rgba(255,255,255,.16)'; x.lineWidth = 4;
        x.beginPath(); x.moveTo(left[0], left[1]); x.lineTo(top[0], top[1]); x.lineTo(right[0], right[1]); x.stroke();
        x.strokeStyle = 'rgba(50,30,20,.10)'; x.lineWidth = 5;
        x.beginPath(); x.moveTo(left[0], left[1]); x.lineTo(bot[0], bot[1]); x.lineTo(right[0], right[1]); x.stroke();
        x.restore();

        // pond water
        if (t.kind === 'pond') {
          const k = 0.72, cym = oy + QH;
          x.fillStyle = '#8fd3e0';
          x.beginPath(); x.moveTo(cx, cym - QH * k); x.lineTo(cx + HW * k, cym); x.lineTo(cx, cym + QH * k); x.lineTo(cx - HW * k, cym); x.closePath(); x.fill();
          x.save(); x.clip();
          x.fillStyle = '#68bad0';
          for (let i = 0; i < 5; i++) x.fillRect(Math.round(cx + (rnd() - rnd()) * HW * 0.5), Math.round(cym + (rnd() - 0.5) * QH), 6 * sc, 3 * sc);
          x.strokeStyle = 'rgba(193,235,243,.9)'; x.lineWidth = 3;
          x.beginPath(); x.moveTo(cx - HW * k, cym); x.lineTo(cx, cym - QH * k); x.lineTo(cx + HW * k, cym); x.stroke();
          for (const [dx, dy] of [[-14, -3], [10, 2], [-4, 7]]) r(cx + dx * sc, cym + dy * sc, 6 * sc, 1.6 * sc, 'rgba(255,255,255,.55)');
          const fxp = cx - 4 * sc, fyp = cym;
          r(fxp - 3 * sc, fyp - 1.5 * sc, 6 * sc, 3 * sc, '#f0894a'); r(fxp + 3 * sc, fyp - 2.5 * sc, 2.5 * sc, 2 * sc, '#f0894a'); r(fxp + 3 * sc, fyp + 0.5 * sc, 2.5 * sc, 2 * sc, '#f0894a');
          x.restore();
        }

        // fringe
        if (grassTop || t.kind === 'tilled') {
          for (let i = 0; i < 16; i++) {
            const u = 0.05 + rnd() * 0.9, len = 2 + rnd() * 4, side = i % 2, k = rnd();
            let fx, fy;
            if (side === 0) { fx = left[0] + u * HW; fy = left[1] + u * QH; }
            else { fx = bot[0] + u * HW; fy = bot[1] - u * QH; }
            x.fillStyle = grassTop ? (k > 0.5 ? '#649a41' : '#7cae4f') : (k > 0.5 ? '#a67c50' : '#8f6a44');
            x.fillRect(Math.round(fx), Math.round(fy), Math.max(2, Math.round(2.5 * sc)), Math.round((len + 2) * sc));
          }
        }

        // decor
        const yb = oy + QH;
        if (t.kind === 'rock') {
          const rr = (px, py, w, h, col) => r(cx + px * sc, yb + py * sc, w * sc, h * sc, col);
          rr(-13, -6, 14, 11, '#9a9078'); rr(-13, -8, 14, 3, '#c1b89e'); rr(-13, 3, 14, 2, '#7d745e');
          rr(2, -2, 11, 8, '#8f8670'); rr(2, -4, 11, 3, '#b3ab92');
          rr(-8, -4, 2.5, 2.5, '#7fd3ff'); rr(6, -1, 2.5, 2.5, '#c9a6ff');
        } else if (t.kind === 'flower') {
          const pts = [[0.3, 0.38], [0.62, 0.66], [0.5, 0.24], [0.72, 0.4], [0.34, 0.68]];
          for (let i = 0; i < pts.length; i++) {
            const px = cx + (pts[i][0] - pts[i][1]) * HW, py = oy + (pts[i][0] + pts[i][1]) * QH;
            const M = sc * 1.5;
            const petals = i % 3 === 0 ? '#fffdf5' : (i % 3 === 1 ? '#f2a9c4' : '#c9a6ff');
            const rr = (a, b, w, h, col) => r(px + a * M, py + b * M, w * M, h * M, col);
            rr(-0.7, 0.5, 1.4, 2.5, '#5f9a3e');
            rr(-2, -2, 2, 2, petals); rr(1, -2, 2, 2, petals); rr(-2, 1, 2, 2, petals); rr(1, 1, 2, 2, petals);
            rr(-0.5, -0.5, 2, 2, '#f7c948');
          }
        } else if (t.kind === 'tilled' && t.crop) {
          const cd = CROPS[t.crop];
          const spots = [[0.3, 0.3], [0.3, 0.62], [0.62, 0.3], [0.62, 0.62]];
          for (let si = 0; si < spots.length; si++) {
            const px = cx + (spots[si][0] - spots[si][1]) * HW, py = oy + (spots[si][0] + spots[si][1]) * QH;
            const M = sc * 2.0;
            const rr = (a, b, w, h, col) => r(px + a * M, py + b * M, w * M, h * M, col);
            if (t.stage === 0) { rr(-2, -1, 4, 2, '#8f6a44'); rr(-1, -3, 2, 3, '#6cb04a'); rr(-2.5, -4, 5, 2, cd.leaf); continue; }
            const H = t.stage === 1 ? 6 : t.stage === 2 ? 10 : 13;
            const sway = Math.sin(T * 2 + si * 1.7) * 1.2;
            rr(-1 + sway, -H, 2.5, H, '#5f9a3e');
            rr(-4 + sway, -H - 2, 8, 3, cd.leaf);
            rr(-3 + sway, -H + 3, 6, 3, cd.leaf);
            if (t.stage >= 2) rr(-2 + sway, -H + 6, 4, 2, cd.leaf);
            if (t.stage >= 3) {
              if (t.crop === 'carrot') { rr(-2, -1.5, 4, 4, cd.color); rr(-1.2, 2.5, 2.5, 2, '#e87b34'); }
              else if (t.crop === 'wheat') { rr(-2.5 + sway, -H - 5, 5, 5, cd.color); }
              else { rr(-4.5 + sway, -H + 0.5, 4, 4, cd.color); rr(1.5 + sway, -H + 2.5, 4, 4, cd.color); rr(-3.8 + sway, -H + 1.2, 1.5, 1.5, 'rgba(255,255,255,.55)'); }
            }
          }
        }
      }
    }
  }
  customElements.define('farm-board', FarmBoard);
})();
