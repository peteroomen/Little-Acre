import { create } from 'zustand';

import { loadGame, saveGame, SAVE_VERSION, type SaveState } from './save';
import {
  CROPS,
  LAND,
  STRUCT,
  createBoard,
  harvestPatch,
  harvestValue,
  isCrop,
  isLand,
  isRipe,
  resolveNight,
  type BuildId,
  type Tile,
  type Tool,
} from './tiles';

export type StoreTab = 'shop' | 'boost' | 'guide';

/** How long the night cinematic holds before growth resolves / the player wakes. */
export const NIGHT_GROW_MS = 1500;
export const NIGHT_WAKE_MS = 3400;
const TOAST_MS = 1900;

export type ToastKind = 'ok' | 'bad';
export interface Toast {
  id: number;
  text: string;
  kind: ToastKind;
}

/**
 * What an action wants the renderer to play, at tile (r,c). The store owns all game
 * logic; Game.tsx maps this onto imperative Canvas fx so React never re-renders per
 * frame (mirrors the imperative-render discipline in CLAUDE.md).
 */
export type FxKind =
  'none' | 'nudge' | 'water' | 'plant' | 'harvest' | 'clear' | 'fish' | 'mine' | 'place' | 'build';

export interface ActionResult {
  fx: FxKind;
  r: number;
  c: number;
  gain?: number;
  gem?: number;
  cost?: number;
  color?: string;
}

const NONE: ActionResult = { fx: 'none', r: -1, c: -1 };

export interface NightInfo {
  title: string;
  sub: string;
}

export interface GameState {
  // ── run state ──
  coins: number;
  gems: number;
  day: number;
  energy: number;
  maxEnergy: number;
  bloom: number;
  board: Tile[];

  // ── ui state ──
  phase: 'day' | 'night';
  night: NightInfo;
  tool: Tool;
  selectedBuild: BuildId;
  storeOpen: boolean;
  storeTab: StoreTab;
  toasts: Toast[];
  /** Bumped when a "sleep to rest" nudge should pulse the Sleep button. */
  sleepPulse: number;
  /** Set of thing-keys the player has discovered (drives the Guide reveal). */
  seen: Record<string, 1>;

  // ── actions ──
  init: () => void;
  setTool: (tool: Tool) => void;
  setSelectedBuild: (id: BuildId) => void;
  useTool: (r: number, c: number) => ActionResult;
  sleep: () => void;
  rebloom: () => void;
  openStore: () => void;
  closeStore: () => void;
  setStoreTab: (tab: StoreTab) => void;
  toast: (text: string, kind: ToastKind) => void;
  save: () => void;
}

let toastId = 0;

function tileIndex(r: number, c: number): number {
  return r * 3 + c;
}

export const useGameStore = create<GameState>((set, get) => {
  /** Replace a single tile immutably and return the fresh board. */
  const patchTile = (r: number, c: number, patch: Partial<Tile>): Tile[] => {
    const board = get().board.map((t) => (t.r === r && t.c === c ? { ...t, ...patch } : t));
    set({ board });
    return board;
  };

  /** Spend energy; on empty, toast + pulse the Sleep button and return false. */
  const spend = (n: number): boolean => {
    if (get().energy < n) {
      get().toast('Out of energy — Sleep to rest', 'bad');
      set((s) => ({ sleepPulse: s.sleepPulse + 1 }));
      return false;
    }
    set((s) => ({ energy: s.energy - n }));
    return true;
  };

  const markSeen = (key: string) => {
    if (get().seen[key]) return;
    set((s) => ({ seen: { ...s.seen, [key]: 1 } }));
  };

  const clickTile = (t: Tile): ActionResult => {
    const { r, c } = t;
    // Harvest a ripe crop — free (no energy), the payoff moment. Re-yield crops re-ripen
    // instead of clearing (see harvestPatch).
    if (isRipe(t)) {
      const crop = t.crop!;
      const gain = harvestValue(crop, get().bloom);
      set((s) => ({ coins: s.coins + gain }));
      patchTile(r, c, harvestPatch(t));
      return { fx: 'harvest', r, c, gain, color: CROPS[crop].color };
    }
    // Clear a wilted crop (costs energy).
    if (t.kind === 'tilled' && t.crop && t.wilted) {
      if (!spend(1)) return NONE;
      patchTile(r, c, { crop: null, wilted: false, stage: 0 });
      get().toast('Cleared', 'ok');
      return { fx: 'clear', r, c, color: '#a08a63' };
    }
    // Water a growing crop.
    if (t.kind === 'tilled' && t.crop && !t.wilted && t.stage < 3) {
      if (t.structure === 'sprinkler') {
        get().toast('Sprinkler waters this', 'bad');
        return { fx: 'nudge', r, c };
      }
      if (t.watered) return { fx: 'nudge', r, c };
      if (!spend(1)) return NONE;
      patchTile(r, c, { watered: true });
      get().toast('Watered', 'ok');
      return { fx: 'water', r, c };
    }
    // Fish a pond.
    if (t.kind === 'pond') {
      if (!spend(1)) return NONE;
      const gain = 12 + Math.floor(Math.random() * 20);
      set((s) => ({ coins: s.coins + gain }));
      markSeen('fish');
      get().toast('Caught a fish!', 'ok');
      return { fx: 'fish', r, c, gain };
    }
    // Mine a rock — coins plus a chance at a gem.
    if (t.kind === 'rock') {
      if (!spend(1)) return NONE;
      const gain = 8 + Math.floor(Math.random() * 12);
      const gem = Math.random() < 0.22 ? 1 : 0;
      set((s) => ({ coins: s.coins + gain, gems: s.gems + gem }));
      markSeen('ore');
      if (gem) markSeen('gem');
      get().toast(gem ? 'Struck a gem! +1' : 'Mined ore', 'ok');
      return { fx: 'mine', r, c, gain, gem, color: '#cfc6ac' };
    }
    // Nothing to do here.
    if (t.kind === 'grass') get().toast('Use Build to expand here', 'bad');
    else if (t.kind === 'tilled' && !t.crop) get().toast('Use Build to plant', 'bad');
    return { fx: 'nudge', r, c };
  };

  const placeLand = (t: Tile): ActionResult => {
    const { r, c } = t;
    if (t.kind !== 'grass') {
      get().toast('Place land on empty grass', 'bad');
      return { fx: 'nudge', r, c };
    }
    const sel = get().selectedBuild;
    const ld = LAND[sel as keyof typeof LAND];
    if (get().coins < ld.cost) {
      get().toast('Not enough coins', 'bad');
      return { fx: 'nudge', r, c };
    }
    if (!spend(1)) return NONE;
    set((s) => ({ coins: s.coins - ld.cost }));
    patchTile(r, c, {
      kind: ld.kind,
      crop: null,
      stage: 0,
      harvests: 0,
      watered: false,
      wilted: false,
      structure: null,
    });
    markSeen(sel);
    get().toast(`Placed ${ld.name}`, 'ok');
    return { fx: 'place', r, c, cost: ld.cost, color: ld.color };
  };

  const buildOn = (t: Tile): ActionResult => {
    const { r, c } = t;
    const sel = get().selectedBuild;
    if (isCrop(sel)) {
      if (t.kind !== 'tilled') {
        get().toast('Plant crops on soil', 'bad');
        return { fx: 'nudge', r, c };
      }
      if (t.crop) {
        get().toast('Already planted', 'bad');
        return { fx: 'nudge', r, c };
      }
      const cd = CROPS[sel];
      if (get().coins < cd.cost) {
        get().toast('Not enough coins', 'bad');
        return { fx: 'nudge', r, c };
      }
      if (!spend(1)) return NONE;
      set((s) => ({ coins: s.coins - cd.cost }));
      patchTile(r, c, { crop: sel, stage: 0, harvests: 0, watered: false, wilted: false });
      markSeen(sel);
      get().toast(`Planted ${cd.name}`, 'ok');
      return { fx: 'plant', r, c, cost: cd.cost, color: cd.leaf };
    }
    // structure
    const stc = STRUCT[sel as keyof typeof STRUCT];
    if (t.kind !== 'tilled') {
      get().toast(`${stc.name} goes on soil`, 'bad');
      return { fx: 'nudge', r, c };
    }
    if (t.structure) {
      get().toast(`Already has ${STRUCT[t.structure].name}`, 'bad');
      return { fx: 'nudge', r, c };
    }
    if (get().coins < stc.cost) {
      get().toast('Not enough coins', 'bad');
      return { fx: 'nudge', r, c };
    }
    if (!spend(1)) return NONE;
    set((s) => ({ coins: s.coins - stc.cost }));
    patchTile(r, c, { structure: sel as keyof typeof STRUCT });
    markSeen(sel);
    get().toast(`Built ${stc.name}`, 'ok');
    return { fx: 'build', r, c, cost: stc.cost, color: stc.color };
  };

  return {
    coins: 220,
    gems: 3,
    day: 1,
    energy: 16,
    maxEnergy: 16,
    bloom: 1.4,
    board: createBoard(),

    phase: 'day',
    night: { title: '', sub: '' },
    tool: 'click',
    selectedBuild: 'carrot',
    storeOpen: false,
    storeTab: 'shop',
    toasts: [],
    sleepPulse: 0,
    seen: {
      carrot: 1,
      potato: 1,
      tomato: 1,
      plot: 1,
      flower: 1,
      pond: 1,
      rock: 1,
      coin: 1,
    },

    init: () => {
      const loaded = loadGame();
      if (loaded) applySave(set, loaded);
    },

    setTool: (tool) => set({ tool }),
    setSelectedBuild: (id) => set({ selectedBuild: id }),

    useTool: (r, c) => {
      if (get().phase !== 'day') return NONE;
      const t = get().board[tileIndex(r, c)];
      if (!t) return NONE;
      const result =
        get().tool === 'click' ? clickTile(t) : dispatchBuild(get, t, placeLand, buildOn);
      get().save();
      return result;
    },

    sleep: () => {
      if (get().phase !== 'day') return;
      const day = get().day;
      set({
        phase: 'night',
        night: { title: `Night ${day}`, sub: 'Watered crops are growing…' },
      });
      window.setTimeout(() => {
        const { tiles, grew, wilted } = resolveNight(get().board);
        const parts: string[] = [];
        if (grew) parts.push(`${grew} grew`);
        if (wilted) parts.push(`${wilted} wilted`);
        set((s) => ({
          board: tiles,
          day: s.day + 1,
          energy: s.maxEnergy,
          night: {
            title: 'Sunrise',
            sub: parts.length ? parts.join(' · ') : 'A quiet night on the farm',
          },
        }));
        get().save();
      }, NIGHT_GROW_MS);
      window.setTimeout(() => {
        set({ phase: 'day' });
        const { night } = get();
        // Surface the sunrise summary as a toast too (it's already computed in `night.sub`).
        if (night.sub.includes('wilted')) get().toast(night.sub, 'bad');
        else if (night.sub.includes('grew')) get().toast(night.sub, 'ok');
      }, NIGHT_WAKE_MS);
    },

    rebloom: () => {
      // First-pass prestige: reset the farm, keep a compounding Bloom + a gem dividend.
      // Economy still being modelled — see docs/design/GDD.md.
      set((s) => ({
        coins: 220,
        gems: s.gems + 8,
        day: 1,
        energy: s.maxEnergy,
        bloom: Math.round(s.bloom * 1.6 * 10) / 10,
        board: createBoard(),
        storeOpen: false,
      }));
      get().toast('Rebloomed! Harvest multiplier up', 'ok');
      get().save();
    },

    openStore: () => set({ storeOpen: true }),
    closeStore: () => set({ storeOpen: false }),
    setStoreTab: (tab) => set({ storeTab: tab }),

    toast: (text, kind) => {
      const id = ++toastId;
      set((s) => ({ toasts: [...s.toasts.slice(-3), { id, text, kind }] }));
      window.setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
      }, TOAST_MS);
    },

    save: () => {
      const s = get();
      saveGame({
        version: SAVE_VERSION,
        coins: s.coins,
        gems: s.gems,
        day: s.day,
        energy: s.energy,
        maxEnergy: s.maxEnergy,
        bloom: s.bloom,
        board: s.board,
        seen: s.seen,
        savedAt: Date.now(),
      });
    },
  };
});

function dispatchBuild(
  get: () => GameState,
  t: Tile,
  placeLand: (t: Tile) => ActionResult,
  buildOn: (t: Tile) => ActionResult,
): ActionResult {
  return isLand(get().selectedBuild) ? placeLand(t) : buildOn(t);
}

function applySave(set: (partial: Partial<GameState>) => void, save: SaveState): void {
  set({
    coins: save.coins,
    gems: save.gems,
    day: save.day,
    energy: save.energy,
    maxEnergy: save.maxEnergy,
    bloom: save.bloom,
    board: save.board,
    seen: save.seen,
  });
}
