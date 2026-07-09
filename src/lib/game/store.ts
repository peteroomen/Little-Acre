import { create } from 'zustand';

import {
  loadGame,
  loadPuzzleStars,
  saveGame,
  savePuzzleStars,
  SAVE_VERSION,
  type SaveState,
} from './save';
import {
  getPuzzle,
  registerEarned,
  registerHarvest,
  registerNight,
  starsFor,
  type PuzzleDef,
  type PuzzleState,
} from './puzzles';
import { actionsFor, uprootNeedsConfirm, type ActionCtx, type TileAction } from './actions';
import {
  CROPS,
  LAND,
  STRUCT,
  FISH_COINS,
  ORE_COINS,
  ROCK_DORMANT_NIGHTS,
  BOARD_TIERS,
  createFreeplayBoard,
  expandBoard,
  cropGrow,
  harvestPatch,
  harvestValue,
  isCrop,
  resolveNight,
  type CropId,
  type LandId,
  type StructId,
  type Tile,
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
/** How long a mournable-uproot confirm stays armed after the first tap. */
const UPROOT_ARM_MS = 3000;

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
  | 'none'
  | 'nudge'
  | 'water'
  | 'plant'
  | 'harvest'
  | 'clear'
  | 'fish'
  | 'mine'
  | 'place'
  | 'build'
  | 'till'
  | 'fertilize'
  | 'uproot';

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
  /** Owned Freeplay board size, an index into BOARD_TIERS (0 = 1×1 · 1 = 3×3 · 2 = 5×5). */
  boardTier: number;
  board: Tile[];
  upgrades: UpgradeLevels;

  // ── ui state ──
  phase: 'day' | 'night';
  night: NightInfo;
  /** Open press-hold radial (null = none). Anchored at tile (r,c), centred at canvas (cx,cy). */
  radial: {
    r: number;
    c: number;
    cx: number;
    cy: number;
    primary: TileAction | null;
    ring: TileAction[];
  } | null;
  /** Highlighted ring slice (-1 = centre / primary). */
  radialHi: number;
  /** Tile with a mournable-uproot confirm armed (tap Uproot again to commit); null = none. */
  uprootArm: { r: number; c: number } | null;
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
  /** Begin a tap on tile (r,c), centred at canvas (cx,cy): runs a lone action or opens the radial. */
  beginTap: (r: number, c: number, cx: number, cy: number) => ActionResult;
  setRadialHi: (i: number) => void;
  commitRadial: () => ActionResult;
  closeRadial: () => void;
  sleep: () => void;
  buyUpgrade: (id: UpgradeId) => void;
  buyExpansion: () => void;
  rebloom: () => void;
  openStore: () => void;
  closeStore: () => void;
  setStoreTab: (tab: StoreTab) => void;
  toast: (text: string, kind: ToastKind) => void;
  save: () => void;
}

let toastId = 0;

/** Locate a tile by its (r,c) — board is variable-size in Freeplay, so we can't index by r*3+c. */
function findTile(board: Tile[], r: number, c: number): Tile | undefined {
  return board.find((t) => t.r === r && t.c === c);
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
    // New farms start at tier 0 — a single wild-grass tile. Land/structures are bought from there.
    boardTier: 0,
    board: createFreeplayBoard(0),
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

  /** Commit a reduced puzzle state to the active run; persist best stars on a win. */
  const commitPuzzle = (def: PuzzleDef, run: PuzzleRun, next: PuzzleState) => {
    const patch: PuzzleRun = { ...run, ...next };
    if (next.status === 'won') {
      // Goal-tier stars read the PROGRESS reached, not nights: an instant 3★ (cleared the top
      // target mid-run) and a deadline win (scored at the night limit) both funnel through here.
      const stars = starsFor(def, next.progress);
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

  /** Record a harvest against the active puzzle objective (no-op for coin objectives). */
  const trackPuzzleHarvest = (crop: CropId) => {
    const run = get().puzzle;
    if (get().mode !== 'puzzle' || !run) return;
    const def = getPuzzle(run.id);
    if (!def) return;
    commitPuzzle(def, run, registerHarvest(def, run, crop));
  };

  /**
   * Record coins EARNED (harvest sells + fish/mine income) against a coin objective. Spending
   * never reduces progress — registerEarned only accumulates (no-op for harvest objectives).
   */
  const trackPuzzleEarned = (amount: number) => {
    const run = get().puzzle;
    if (get().mode !== 'puzzle' || !run) return;
    const def = getPuzzle(run.id);
    if (!def) return;
    commitPuzzle(def, run, registerEarned(def, run, amount));
  };

  /** The action context for the active run: which crops/structures/land a tile may offer. */
  const ctxFromState = (): ActionCtx => {
    const s = get();
    const def = s.mode === 'puzzle' && s.puzzle ? getPuzzle(s.puzzle.id) : undefined;
    const crops = def ? (def.builds ?? []).filter(isCrop) : (Object.keys(CROPS) as CropId[]);
    // Feed is on in Freeplay; in a puzzle it follows the def (default off, so tutorials hide it).
    const allowFeed = s.mode === 'freeplay' ? true : (def?.allowFeed ?? false);
    // Structures follow the def in a puzzle (default off — only spatial puzzles opt in).
    const allowStructures = s.mode === 'freeplay' ? true : (def?.allowStructures ?? false);
    return {
      crops,
      allowStructures,
      allowLand: s.mode === 'freeplay',
      allowFeed,
      tiles: s.board,
    };
  };

  /** Can the player afford `n` coins? Toasts on a shortfall. */
  const affordCoins = (n: number): boolean => {
    if (n <= 0) return true;
    if (get().coins < n) {
      get().toast('Not enough coins', 'bad');
      return false;
    }
    return true;
  };

  /**
   * Uproot confirm guard (mirrors the Sleep guard): the FIRST attempt to uproot a mournable crop
   * (see uprootNeedsConfirm) arms a tap-again window and toasts instead of pulling it; a second
   * uproot on the same tile within the window commits. Any other executed action disarms it, and
   * the arm auto-clears after UPROOT_ARM_MS. State lives here (store UI), never inside execAction.
   */
  let uprootTimer: number | null = null;
  const armUproot = (r: number, c: number) => {
    set({ uprootArm: { r, c } });
    if (uprootTimer) window.clearTimeout(uprootTimer);
    uprootTimer = window.setTimeout(() => {
      if (get().uprootArm) set({ uprootArm: null });
    }, UPROOT_ARM_MS);
  };
  const disarmUproot = () => {
    if (uprootTimer) {
      window.clearTimeout(uprootTimer);
      uprootTimer = null;
    }
    if (get().uprootArm) set({ uprootArm: null });
  };

  /**
   * Run a chosen action, intercepting a mournable uproot with the tap-again confirm. Returns a
   * nudge (no execution) while the confirm is armed; otherwise disarms and executes. The single
   * gate behind both a bare tap and a radial commit.
   */
  const guardOrExec = (t: Tile, a: TileAction): ActionResult => {
    if (a.kind === 'uproot' && uprootNeedsConfirm(t)) {
      const arm = get().uprootArm;
      if (!arm || arm.r !== t.r || arm.c !== t.c) {
        armUproot(t.r, t.c);
        get().toast(`Really pull the ${CROPS[t.crop!].name}? Tap again`, 'bad');
        return { fx: 'nudge', r: t.r, c: t.c };
      }
    }
    disarmUproot();
    return execAction(t, a);
  };

  /**
   * Execute a chosen tile action. One switch over ActionKind that folds in every verb's
   * coin+energy check, tile patch, toast, and fx result — the single executor behind both a
   * bare tap and a radial commit. Callers persist via save() afterwards.
   */
  const execAction = (t: Tile, a: TileAction): ActionResult => {
    const { r, c } = t;
    switch (a.kind) {
      case 'till': {
        if (!spend(a.energyCost)) return NONE;
        patchTile(r, c, {
          kind: 'tilled',
          crop: null,
          stage: 0,
          harvests: 0,
          watered: false,
          wilted: false,
          structure: null,
        });
        get().toast('Tilled soil', 'ok');
        return { fx: 'till', r, c, color: a.color };
      }
      case 'plant': {
        const crop = a.build as CropId;
        const cd = CROPS[crop];
        if (!affordCoins(a.coinCost)) return { fx: 'nudge', r, c };
        if (!spend(a.energyCost)) return NONE;
        set((s) => ({ coins: s.coins - a.coinCost }));
        patchTile(r, c, { crop, stage: 0, harvests: 0, watered: false, wilted: false });
        markSeen(crop);
        get().toast(`Planted ${cd.name}`, 'ok');
        return { fx: 'plant', r, c, cost: a.coinCost, color: cd.leaf };
      }
      case 'water': {
        if (!spend(a.energyCost)) return NONE;
        patchTile(r, c, { watered: true });
        get().toast('Watered', 'ok');
        return { fx: 'water', r, c };
      }
      case 'fertilize': {
        if (!affordCoins(a.coinCost)) return { fx: 'nudge', r, c };
        if (!spend(a.energyCost)) return NONE;
        set((s) => ({ coins: s.coins - a.coinCost }));
        const crop = t.crop!;
        // Feeding advances one growth stage (can ripen it) — the fertilize verb's first real home.
        patchTile(r, c, { stage: Math.min(cropGrow(crop), t.stage + 1) });
        markSeen('fertilize');
        get().toast('Fed the crop', 'ok');
        return { fx: 'fertilize', r, c, cost: a.coinCost, color: a.color };
      }
      case 'harvest': {
        const crop = t.crop!;
        const gain = harvestValue(crop, get().bloom * harvestMultFor(get().upgrades));
        set((s) => ({ coins: s.coins + gain }));
        patchTile(r, c, harvestPatch(t));
        trackPuzzleHarvest(crop);
        trackPuzzleEarned(gain);
        return { fx: 'harvest', r, c, gain, color: CROPS[crop].color };
      }
      case 'uproot': {
        // Pull a growing/ripe crop with no refund (energyCost 0 — it's a cleanup, not a chore).
        if (a.energyCost > 0 && !spend(a.energyCost)) return NONE;
        patchTile(r, c, { crop: null, stage: 0, harvests: 0, watered: false, wilted: false });
        get().toast('Uprooted', 'ok');
        return { fx: 'uproot', r, c, color: a.color };
      }
      case 'clear': {
        if (!spend(a.energyCost)) return NONE;
        patchTile(r, c, { crop: null, wilted: false, stage: 0, harvests: 0 });
        get().toast('Cleared', 'ok');
        return { fx: 'clear', r, c, color: a.color };
      }
      case 'fish': {
        if ((t.pondStock ?? 0) <= 0) {
          get().toast('The pond needs to restock', 'bad');
          return { fx: 'nudge', r, c };
        }
        if (!spend(a.energyCost)) return NONE;
        // Deterministic payout — no RNG, so gathering is puzzle-safe and reproducible.
        const gain = FISH_COINS;
        set((s) => ({ coins: s.coins + gain }));
        patchTile(r, c, { pondStock: (t.pondStock ?? 0) - 1 });
        trackPuzzleEarned(gain);
        markSeen('fish');
        get().toast('Caught a fish!', 'ok');
        return { fx: 'fish', r, c, gain };
      }
      case 'mine': {
        if ((t.rockCharges ?? 0) <= 0) {
          get().toast('This rock is spent — it will recover', 'bad');
          return { fx: 'nudge', r, c };
        }
        if (!spend(a.energyCost)) return NONE;
        const charges = (t.rockCharges ?? 0) - 1;
        // Deterministic: fixed coins per pull, and a gem on the LAST pull of the cycle (charges
        // hit 0 → the rock goes dormant). Derived from the charge counter — no new Tile fields.
        const gain = ORE_COINS;
        const gem = charges <= 0 ? 1 : 0;
        set((s) => ({ coins: s.coins + gain, gems: s.gems + gem }));
        patchTile(r, c, {
          rockCharges: charges,
          rockDormant: charges <= 0 ? ROCK_DORMANT_NIGHTS : (t.rockDormant ?? 0),
        });
        // Coin income counts toward a coin objective; the gem bonus does not.
        trackPuzzleEarned(gain);
        markSeen('ore');
        if (gem) markSeen('gem');
        get().toast(gem ? 'Struck a gem! +1' : 'Mined ore', 'ok');
        return { fx: 'mine', r, c, gain, gem, color: '#cfc6ac' };
      }
      case 'structure': {
        const id = a.build as StructId;
        const stc = STRUCT[id];
        if (!affordCoins(a.coinCost)) return { fx: 'nudge', r, c };
        if (!spend(a.energyCost)) return NONE;
        set((s) => ({ coins: s.coins - a.coinCost }));
        patchTile(r, c, { structure: id });
        markSeen(id);
        get().toast(`Built ${stc.name}`, 'ok');
        return { fx: 'build', r, c, cost: a.coinCost, color: stc.color };
      }
      case 'land': {
        const id = a.build as LandId;
        const ld = LAND[id];
        if (!affordCoins(a.coinCost)) return { fx: 'nudge', r, c };
        if (!spend(a.energyCost)) return NONE;
        set((s) => ({ coins: s.coins - a.coinCost }));
        patchTile(r, c, {
          kind: ld.kind,
          crop: null,
          stage: 0,
          harvests: 0,
          watered: false,
          wilted: false,
          structure: null,
          pondStock: ld.kind === 'pond' ? 4 : undefined,
          rockCharges: ld.kind === 'rock' ? 3 : undefined,
          rockDormant: ld.kind === 'rock' ? 0 : undefined,
        });
        markSeen(id);
        get().toast(`Placed ${ld.name}`, 'ok');
        return { fx: 'place', r, c, cost: a.coinCost, color: ld.color };
      }
      default:
        return NONE;
    }
  };

  return {
    screen: 'menu',
    mode: 'freeplay',
    puzzle: null,
    puzzleStars: {},
    ...freshFreeplay(),

    phase: 'day',
    night: { title: '', sub: '' },
    radial: null,
    radialHi: -1,
    uprootArm: null,
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
        radial: null,
        radialHi: -1,
        uprootArm: null,
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
        radial: null,
        radialHi: -1,
        uprootArm: null,
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

    beginTap: (r, c, cx, cy) => {
      if (get().phase !== 'day') return NONE;
      const t = findTile(get().board, r, c);
      if (!t) return NONE;
      const acts = actionsFor(t, ctxFromState());
      // No secondary choices ⇒ run the lone default straight away; else open the radial.
      if (acts.ring.length === 0) {
        if (!acts.primary) {
          // Nothing to do here — give a nudge (and a hint on a resting pond/rock) so the tap
          // registers instead of feeling dead.
          if (t.kind === 'pond') get().toast('The pond is restocking', 'bad');
          else if (t.kind === 'rock') get().toast('This rock is spent — it will recover', 'bad');
          return { fx: 'nudge', r, c };
        }
        const res = guardOrExec(t, acts.primary);
        get().save();
        return res;
      }
      set({ radial: { r, c, cx, cy, primary: acts.primary, ring: acts.ring }, radialHi: -1 });
      return NONE;
    },

    setRadialHi: (i) => set({ radialHi: i }),

    commitRadial: () => {
      const radial = get().radial;
      if (!radial) return NONE;
      const hi = get().radialHi;
      const a = hi < 0 ? radial.primary : radial.ring[hi];
      set({ radial: null, radialHi: -1 });
      if (!a) return NONE;
      const t = findTile(get().board, radial.r, radial.c);
      if (!t) return NONE;
      const res = guardOrExec(t, a);
      get().save();
      return res;
    },

    closeRadial: () => set({ radial: null, radialHi: -1 }),

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
        // Puzzle mode: count the night and, at the deadline, score the run on progress (a 1★/2★
        // deadline win must persist its stars, so route through commitPuzzle, not a bare set).
        const run = get().puzzle;
        if (get().mode === 'puzzle' && run) {
          const def = getPuzzle(run.id);
          if (def) commitPuzzle(def, run, registerNight(def, run));
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

    buyExpansion: () => {
      const { boardTier, coins, board } = get();
      const nextTier = boardTier + 1;
      const tier = BOARD_TIERS[nextTier];
      if (!tier) {
        get().toast('The farm is already at full size', 'bad');
        return;
      }
      if (coins < tier.cost) {
        get().toast('Not enough coins', 'bad');
        return;
      }
      // Grow the board, re-centring the existing farm — every planted/built tile is preserved.
      const nextBoard = expandBoard(board, tier.size);
      set((s) => ({ coins: s.coins - tier.cost, boardTier: nextTier, board: nextBoard }));
      get().toast(`Farm expanded to ${tier.size}×${tier.size}!`, 'ok');
      get().save();
    },

    rebloom: () => {
      // First-pass prestige: reset the farm, keep a compounding Bloom + a gem dividend.
      // Economy still being modelled — see docs/design/GDD.md. The owned board tier is kept
      // (a fresh grass board at the current size), not reset to 1×1.
      set((s) => ({
        coins: 220,
        gems: s.gems + 8,
        day: 1,
        energy: s.maxEnergy,
        bloom: Math.round(s.bloom * 1.6 * 10) / 10,
        board: createFreeplayBoard(s.boardTier),
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
        boardTier: s.boardTier,
        board: s.board,
        upgrades: s.upgrades,
        seen: s.seen,
        savedAt: Date.now(),
      });
    },
  };
});

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
    boardTier: save.boardTier,
    board: save.board,
    upgrades: save.upgrades,
    seen: save.seen,
  });
}
