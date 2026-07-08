import { create } from 'zustand';

import {
  loadGame,
  loadPuzzleStars,
  saveGame,
  savePuzzleStars,
  SAVE_VERSION,
  type SaveState,
} from './save';
import { getPuzzle, registerHarvest, registerNight, starsFor, type PuzzleState } from './puzzles';
import {
  CROPS,
  LAND,
  STRUCT,
  createBoard,
  cropGrow,
  harvestPatch,
  harvestValue,
  isCrop,
  isLand,
  isRipe,
  resolveNight,
  type BuildId,
  type CropId,
  type Tile,
  type Tool,
} from './tiles';
import {
  ENERGY_PER_LEVEL,
  harvestMultFor,
  isMaxed,
  maxEnergyFor,
  upgradeCost,
  UPGRADE_DEFS,
  ZERO_UPGRADES,
  type UpgradeId,
  type UpgradeLevels,
} from './upgrades';

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

export type Screen = 'menu' | 'puzzleSelect' | 'game';
export type GameMode = 'freeplay' | 'puzzle';

/** Active-puzzle run state: the pure PuzzleState plus store-only UI bits. */
export interface PuzzleRun extends PuzzleState {
  id: string;
  /** Stars earned on win (0 while playing/lost). */
  stars: number;
  /** Whether the intro blurb card is still showing. */
  intro: boolean;
}

export interface GameState {
  // ── app state ──
  screen: Screen;
  mode: GameMode;
  puzzle: PuzzleRun | null;
  puzzleStars: Record<string, number>;

  // ── run state ──
  coins: number;
  gems: number;
  day: number;
  energy: number;
  maxEnergy: number;
  bloom: number;
  board: Tile[];
  upgrades: UpgradeLevels;

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
  startFreeplay: () => void;
  startPuzzle: (id: string) => void;
  goMenu: () => void;
  goPuzzleSelect: () => void;
  retryPuzzle: () => void;
  dismissPuzzleIntro: () => void;
  setTool: (tool: Tool) => void;
  setSelectedBuild: (id: BuildId) => void;
  useTool: (r: number, c: number) => ActionResult;
  sleep: () => void;
  buyUpgrade: (id: UpgradeId) => void;
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

/** Default Freeplay run state (used for the initial store + a first-time Freeplay start). */
function freshFreeplay() {
  return {
    coins: 220,
    gems: 3,
    day: 1,
    energy: 16,
    maxEnergy: 16,
    bloom: 1.4,
    board: createBoard(),
    upgrades: { ...ZERO_UPGRADES },
  };
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

  /** Record a harvest against the active puzzle objective; persist best stars on a win. */
  const trackPuzzleHarvest = (crop: CropId) => {
    const run = get().puzzle;
    if (get().mode !== 'puzzle' || !run) return;
    const def = getPuzzle(run.id);
    if (!def) return;
    const next = registerHarvest(def, run, crop);
    const patch: PuzzleRun = { ...run, ...next };
    if (next.status === 'won') {
      const stars = starsFor(def, next.nightsUsed);
      patch.stars = stars;
      const prev = get().puzzleStars[run.id] ?? 0;
      if (stars > prev) {
        const puzzleStars = { ...get().puzzleStars, [run.id]: stars };
        set({ puzzleStars });
        savePuzzleStars(puzzleStars);
      }
    }
    set({ puzzle: patch });
  };

  const clickTile = (t: Tile): ActionResult => {
    const { r, c } = t;
    // Harvest a ripe crop — free (no energy), the payoff moment. Re-yield crops re-ripen
    // instead of clearing (see harvestPatch).
    if (isRipe(t)) {
      const crop = t.crop!;
      const gain = harvestValue(crop, get().bloom * harvestMultFor(get().upgrades));
      set((s) => ({ coins: s.coins + gain }));
      patchTile(r, c, harvestPatch(t));
      trackPuzzleHarvest(crop);
      return { fx: 'harvest', r, c, gain, color: CROPS[crop].color };
    }
    // Clear a wilted crop (costs energy).
    if (t.kind === 'tilled' && t.crop && t.wilted) {
      if (!spend(1)) return NONE;
      patchTile(r, c, { crop: null, wilted: false, stage: 0 });
      get().toast('Cleared', 'ok');
      return { fx: 'clear', r, c, color: '#a08a63' };
    }
    // Water a growing crop (below its ripen threshold — not the old fixed stage 3).
    if (t.kind === 'tilled' && t.crop && !t.wilted && t.stage < cropGrow(t.crop)) {
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
    screen: 'menu',
    mode: 'freeplay',
    puzzle: null,
    puzzleStars: {},
    ...freshFreeplay(),

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
      // Load persisted state but land on the menu — the player picks Freeplay or a Puzzle.
      const loaded = loadGame();
      if (loaded) applySave(set, loaded);
      set({ puzzleStars: loadPuzzleStars(), screen: 'menu' });
    },

    startFreeplay: () => {
      const loaded = loadGame();
      if (loaded) applySave(set, loaded);
      else set(freshFreeplay());
      set({
        mode: 'freeplay',
        screen: 'game',
        puzzle: null,
        phase: 'day',
        night: { title: '', sub: '' },
        tool: 'click',
        selectedBuild: 'carrot',
        storeOpen: false,
      });
    },

    startPuzzle: (id) => {
      const def = getPuzzle(id);
      if (!def) return;
      set({
        mode: 'puzzle',
        screen: 'game',
        puzzle: { id, progress: 0, nightsUsed: 0, status: 'playing', stars: 0, intro: true },
        coins: def.startCoins,
        gems: 0,
        day: 1,
        energy: def.startEnergy,
        maxEnergy: def.startEnergy,
        bloom: 1,
        board: def.makeBoard(),
        upgrades: { ...ZERO_UPGRADES },
        phase: 'day',
        night: { title: '', sub: '' },
        tool: 'build',
        selectedBuild: def.builds[0],
        storeOpen: false,
      });
    },

    goMenu: () => {
      if (get().mode === 'freeplay') get().save();
      set({ screen: 'menu', storeOpen: false });
    },

    goPuzzleSelect: () => set({ screen: 'puzzleSelect', storeOpen: false }),

    retryPuzzle: () => {
      const run = get().puzzle;
      if (run) get().startPuzzle(run.id);
    },

    dismissPuzzleIntro: () => {
      const run = get().puzzle;
      if (run) set({ puzzle: { ...run, intro: false } });
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
        // Puzzle mode: count the night and resolve a loss if the limit is exceeded.
        const run = get().puzzle;
        if (get().mode === 'puzzle' && run) {
          const def = getPuzzle(run.id);
          if (def) set({ puzzle: { ...run, ...registerNight(def, run) } });
        }
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

    buyUpgrade: (id) => {
      const { coins, upgrades } = get();
      const level = upgrades[id];
      if (isMaxed(id, level)) return;
      const cost = upgradeCost(id, level);
      if (coins < cost) {
        get().toast('Not enough coins', 'bad');
        return;
      }
      const nextLevels: UpgradeLevels = { ...upgrades, [id]: level + 1 };
      set((s) => {
        const patch: Partial<GameState> = {
          coins: s.coins - cost,
          upgrades: nextLevels,
        };
        // Extra Energy raises the ceiling and tops up the current day so it's felt now.
        if (id === 'energy') {
          patch.maxEnergy = maxEnergyFor(nextLevels);
          patch.energy = Math.min(patch.maxEnergy, s.energy + ENERGY_PER_LEVEL);
        }
        return patch;
      });
      get().toast(`${UPGRADE_DEFS[id].name} upgraded`, 'ok');
      get().save();
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
      // Puzzles are ephemeral — never persist a puzzle board to the Freeplay save.
      if (s.mode === 'puzzle') return;
      saveGame({
        version: SAVE_VERSION,
        coins: s.coins,
        gems: s.gems,
        day: s.day,
        energy: s.energy,
        maxEnergy: s.maxEnergy,
        bloom: s.bloom,
        board: s.board,
        upgrades: s.upgrades,
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
  // Recompute maxEnergy from upgrade levels so a stale saved ceiling can't desync.
  const maxEnergy = maxEnergyFor(save.upgrades);
  set({
    coins: save.coins,
    gems: save.gems,
    day: save.day,
    energy: Math.min(save.energy, maxEnergy),
    maxEnergy,
    bloom: save.bloom,
    board: save.board,
    upgrades: save.upgrades,
    seen: save.seen,
  });
}
