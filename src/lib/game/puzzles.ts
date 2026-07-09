/**
 * Little Acre — Puzzle mode model (pure; exercised in Vitest).
 *
 * No React, no Canvas, no store imports. A puzzle is a handcrafted scenario on a fixed board +
 * starting kit (see docs/design/DESIGN.md §3 / docs/design/puzzles.md). The first three are
 * TUTORIALS that introduce the loop, watering discipline, and re-yield; the CHALLENGES that
 * follow each teach one strategic idea (deadlines, fruit-holding, bootstrapping, crop choice,
 * sprinkler placement).
 *
 * Star scoring: 1★ = completed within `nightLimit`; 2★ = within `stars.two` nights;
 * 3★ = within `stars.three` nights (par == exact optimal). Every def is validated by the exact
 * solver — see scripts/check-puzzle-pars.mjs (par must equal optimal AND par−1 must be
 * infeasible). Keep the harness SHIPPED mirror in sync when editing defs.
 */

import { POND_MAX, ROCK_CHARGES, type CropId, type Tile, type TileKind } from './tiles';

export type PuzzleStatus = 'playing' | 'won' | 'lost';

/**
 * What completes the puzzle:
 *  - harvest: reap `count` crops matching `crop` ('any' = any crop).
 *  - coins: cumulatively EARN `amount` coins (harvest sells + fish/mine income). Spending never
 *    reduces progress — only earnings count, so the goal is monotone.
 */
export type PuzzleObjective =
  { kind: 'harvest'; crop: CropId | 'any'; count: number } | { kind: 'coins'; amount: number };

export type PuzzleSection = 'tutorial' | 'challenge';

export interface PuzzleDef {
  id: string;
  name: string;
  /** Which shelf the select screen files this under; unlock order is PUZZLES order regardless. */
  section: PuzzleSection;
  /** 1–2 sentence intro, shown on start + on the select card. */
  blurb: string;
  objective: PuzzleObjective;
  /** Exceed this many nights without completing => lose. 0 = "today only" (win before sleeping). */
  nightLimit: number;
  /** Nights-used thresholds: <= three ⇒ 3★, <= two ⇒ 2★ (else 1★, assuming completed). */
  stars: { three: number; two: number };
  startCoins: number;
  /** Starting energy, which is also the puzzle's max energy. */
  startEnergy: number;
  /** Which crops the tap-radial offers in this puzzle (restricted to the taught set). */
  builds: CropId[];
  /**
   * Whether Feed (fertilize) is offered on a growing crop. Defaults to FALSE: the tutorials must
   * not offer Feed (it trivialises their star tunings). Feed-centric puzzles opt in with `true`.
   */
  allowFeed?: boolean;
  /**
   * Whether structures (Sprinkler / Scarecrow) may be placed. Defaults to FALSE — only the
   * spatial puzzles opt in. Freeplay always allows structures (see store ctxFromState).
   */
  allowStructures?: boolean;
  /** Fresh board factory (a 3×3 = 9-tile board; the renderer/save assume 9). */
  makeBoard: () => Tile[];
}

/** Runtime progress for an active puzzle (pure state; the store mirrors it). */
export interface PuzzleState {
  progress: number;
  nightsUsed: number;
  status: PuzzleStatus;
}

/**
 * Build a 3×3 board whose first `tilled` tiles are empty tilled soil and the rest are grass.
 * Puzzle objective tile-counts are realised this way so the board stays a 9-tile grid.
 */
function tilledBoard(tilled: number): Tile[] {
  const tiles: Tile[] = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const i = r * 3 + c;
      tiles.push({
        r,
        c,
        kind: i < tilled ? 'tilled' : 'grass',
        crop: null,
        stage: 0,
        harvests: 0,
        watered: false,
        wilted: false,
        structure: null,
      });
    }
  }
  return tiles;
}

/**
 * Author an arbitrary 3×3 board from row specs (same shape as createBoard's layout). Each cell:
 *  - 'grass' | 'flower' | 'tilled'                    plain tiles
 *  - 'tilled:carrot:2' | 'tilled:tomato:4:1'          pre-grown crop as kind:crop:stage[:harvests]
 *  - 'pond' | 'pond:2'                                pond, optionally part-stocked (default full)
 *  - 'rock' | 'rock:1:2'                              rock as rock[:charges[:dormantNights]]
 * Pre-ripe crops (e.g. a ripe tomato at stage 4) are expressible directly.
 */
export function boardFrom(layout: string[][]): Tile[] {
  const tiles: Tile[] = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const parts = layout[r][c].split(':');
      const kind = parts[0] as TileKind;
      const tile: Tile = {
        r,
        c,
        kind,
        crop: null,
        stage: 0,
        harvests: 0,
        watered: false,
        wilted: false,
        structure: null,
      };
      if (kind === 'tilled' && parts[1]) {
        tile.crop = parts[1] as CropId;
        tile.stage = parts[2] ? parseInt(parts[2], 10) : 0;
        tile.harvests = parts[3] ? parseInt(parts[3], 10) : 0;
      } else if (kind === 'pond') {
        tile.pondStock = parts[1] ? parseInt(parts[1], 10) : POND_MAX;
      } else if (kind === 'rock') {
        tile.rockCharges = parts[1] ? parseInt(parts[1], 10) : ROCK_CHARGES;
        tile.rockDormant = parts[2] ? parseInt(parts[2], 10) : 0;
      }
      tiles.push(tile);
    }
  }
  return tiles;
}

export const PUZZLES: PuzzleDef[] = [
  // ── tutorials ──────────────────────────────────────────────────────────────
  {
    id: 'first-sprout',
    name: 'First Sprout',
    section: 'tutorial',
    blurb:
      'This land is wild — Till it into soil first, then plant a seed, water it, and Sleep. Water again, and harvest when it ripens.',
    objective: { kind: 'harvest', crop: 'carrot', count: 3 },
    nightLimit: 4,
    stars: { three: 2, two: 3 },
    startCoins: 30,
    startEnergy: 16,
    builds: ['carrot'],
    // Starts on wild grass so the player learns Till → Plant → Water → Harvest.
    makeBoard: () => tilledBoard(0),
  },
  {
    id: 'dry-spell',
    name: 'Dry Spell',
    section: 'tutorial',
    blurb:
      'A crop only grows on nights you watered it. Skip a night and it wilts. Keep every plant watered until harvest.',
    objective: { kind: 'harvest', crop: 'potato', count: 4 },
    nightLimit: 5,
    stars: { three: 3, two: 4 },
    startCoins: 40,
    startEnergy: 16,
    builds: ['potato'],
    makeBoard: () => tilledBoard(4),
  },
  {
    id: 'vine-and-again',
    name: 'Vine & Again',
    section: 'tutorial',
    blurb:
      'A Tomato keeps producing. Plant it once and harvest the same vine again and again — no replanting needed.',
    objective: { kind: 'harvest', crop: 'tomato', count: 4 },
    nightLimit: 9,
    // Retuned tomato (reyield 4 / regrow 1) shortens the optimal line: 40c affords 3 vines, so
    // par = 4 watered nights to first ripe + 1 regrow night for the 4th fruit = 5 (solver-locked;
    // see scripts/check-puzzle-pars.mjs).
    stars: { three: 5, two: 6 },
    startCoins: 40,
    startEnergy: 16,
    builds: ['tomato'],
    makeBoard: () => tilledBoard(2),
  },
  // ── challenges (each par is solver-locked; see check-puzzle-pars.mjs) ──────
  {
    id: 'market-day',
    name: 'Market Day',
    section: 'challenge',
    blurb:
      'The market cart leaves at dusk — no time to sleep on this one! Feed a growing crop to hurry it along, and send three carrots off before the day ends.',
    objective: { kind: 'harvest', crop: 'carrot', count: 3 },
    // "Today only": win before sleeping once. Par 0 nights is knife-edge — 9⚡ or 19c is
    // infeasible (pinned as harness feature checks, since a 0-night par has no night to shave).
    nightLimit: 0,
    stars: { three: 0, two: 0 },
    startCoins: 20,
    startEnergy: 10,
    builds: ['carrot'],
    allowFeed: true,
    makeBoard: () =>
      boardFrom([
        ['flower', 'flower', 'flower'],
        ['grass', 'grass', 'grass'],
        ['flower', 'flower', 'flower'],
      ]),
  },
  {
    id: 'the-patient-vine',
    name: 'The Patient Vine',
    section: 'challenge',
    blurb:
      'One splash of water a day, and two hungry plants. A ripe fruit is happy to wait on the vine — sometimes the kindest thing is to let it hang.',
    objective: { kind: 'harvest', crop: 'any', count: 4 },
    // 3 fruits left on the ripe vine + 1 potato = exactly 4: with 1⚡/day the potato must be
    // watered first (nights 1–2) while the ripe tomato HOLDS — harvesting it early forces its
    // regrowth watering, the potato wilts, and the board caps at 3 (pinned in the harness).
    nightLimit: 6,
    stars: { three: 4, two: 5 },
    startCoins: 0,
    startEnergy: 1,
    builds: [],
    makeBoard: () =>
      boardFrom([
        ['flower', 'tilled:tomato:4:1', 'flower'],
        ['flower', 'flower', 'flower'],
        ['flower', 'tilled:potato:1', 'flower'],
      ]),
  },
  {
    id: 'seed-money',
    name: 'Seed Money',
    section: 'challenge',
    blurb:
      "Four coins won't buy a potato seed — but they will buy a carrot. Grow your purse first, and the potatoes will follow.",
    objective: { kind: 'harvest', crop: 'potato', count: 3 },
    // 4c affords one carrot seed only; its 20c sale (night 2) funds all three potato seeds, which
    // ripen 3 nights later ⇒ par 5. Potato-only from 4c is infeasible (pinned in the harness).
    nightLimit: 7,
    stars: { three: 5, two: 6 },
    startCoins: 4,
    startEnergy: 6,
    builds: ['carrot', 'potato'],
    makeBoard: () =>
      boardFrom([
        ['flower', 'flower', 'flower'],
        ['tilled', 'tilled', 'tilled'],
        ['flower', 'flower', 'flower'],
      ]),
  },
  {
    id: 'thirsty-work',
    name: 'Thirsty Work',
    section: 'challenge',
    blurb:
      'The well is running low — five splashes a day, no more. Pick the crops that make every drop count.',
    objective: { kind: 'harvest', crop: 'any', count: 12 },
    // Energy 5 throttles carrot's replant loop (3⚡/harvest sustained) while a ripe vine costs
    // 1⚡/fruit: tomato-led play finishes in 7 nights; carrot-only takes 9 and tomato-only 8
    // (all solver-pinned) — mixing the two is the lesson.
    nightLimit: 10,
    stars: { three: 7, two: 8 },
    startCoins: 40,
    startEnergy: 5,
    builds: ['carrot', 'tomato'],
    makeBoard: () =>
      boardFrom([
        ['tilled', 'tilled', 'tilled'],
        ['tilled', 'tilled', 'tilled'],
        ['flower', 'flower', 'flower'],
      ]),
  },
  {
    id: 'waterworks',
    name: 'Waterworks',
    section: 'challenge',
    blurb:
      'A Sprinkler waters its own tile and its four neighbours every night, all by itself. Set it down where it matters most, and let the farm do the tending.',
    objective: { kind: 'harvest', crop: 'carrot', count: 4 },
    // 76c = one Sprinkler (60c) + four carrot seeds (16c) exactly; 5⚡ = place + plant 4. On the
    // centre the plus-shape covers every arm ⇒ par 2. Hand-watering at 5⚡ takes 4 nights, and
    // 75c or 4⚡ can't make par (all pinned in the harness).
    nightLimit: 4,
    stars: { three: 2, two: 3 },
    startCoins: 76,
    startEnergy: 5,
    builds: ['carrot'],
    allowStructures: true,
    makeBoard: () =>
      boardFrom([
        ['flower', 'tilled', 'flower'],
        ['tilled', 'tilled', 'tilled'],
        ['flower', 'tilled', 'flower'],
      ]),
  },
];

export function getPuzzle(id: string): PuzzleDef | undefined {
  return PUZZLES.find((p) => p.id === id);
}

/** Capitalised crop noun for UI ('any' → 'Crop'). */
export function cropNoun(crop: CropId | 'any'): string {
  return crop === 'any' ? 'Crop' : crop.charAt(0).toUpperCase() + crop.slice(1);
}

/** Crop noun pluralised for a count — "Carrots", "Potatoes", "Tomatoes" (not "Potatos"). */
export function cropPlural(crop: CropId | 'any', count: number): string {
  const n = cropNoun(crop);
  if (count === 1) return n;
  return n.endsWith('o') ? `${n}es` : `${n}s`;
}

/** The number `progress` counts toward: harvest count or coin amount. */
export function objectiveTarget(objective: PuzzleObjective): number {
  return objective.kind === 'harvest' ? objective.count : objective.amount;
}

/** Short goal text for UI: "Harvest 3 Carrots" / "Earn 120 Coins". */
export function objectiveLabel(objective: PuzzleObjective): string {
  if (objective.kind === 'coins') return `Earn ${objective.amount} Coins`;
  return `Harvest ${objective.count} ${cropPlural(objective.crop, objective.count)}`;
}

export function initPuzzleState(): PuzzleState {
  return { progress: 0, nightsUsed: 0, status: 'playing' };
}

/** True when a harvested crop counts toward the objective (harvest objectives only). */
export function objectiveMatches(objective: PuzzleObjective, crop: CropId): boolean {
  return objective.kind === 'harvest' && (objective.crop === 'any' || objective.crop === crop);
}

/**
 * Stars earned for completing a puzzle in `nightsUsed` nights. Only called on a win, so the
 * floor is 1★ (completed within the night limit). A 0-night puzzle with stars {three:0, two:0}
 * scores 3★ on its same-day win.
 */
export function starsFor(def: PuzzleDef, nightsUsed: number): 0 | 1 | 2 | 3 {
  if (nightsUsed <= def.stars.three) return 3;
  if (nightsUsed <= def.stars.two) return 2;
  return 1;
}

/**
 * Pure reducer: apply one harvest to the puzzle state. Increments progress when the crop matches
 * a harvest objective; flips to 'won' once the count is reached. A no-op once not 'playing' and
 * for coin objectives (those advance via registerEarned).
 */
export function registerHarvest(def: PuzzleDef, state: PuzzleState, crop: CropId): PuzzleState {
  if (state.status !== 'playing') return state;
  if (!objectiveMatches(def.objective, crop)) return state;
  const progress = state.progress + 1;
  const status: PuzzleStatus = progress >= objectiveTarget(def.objective) ? 'won' : 'playing';
  return { ...state, progress, status };
}

/**
 * Pure reducer: apply coins EARNED to a coin objective (harvest sells + fish/mine income).
 * Spending never reduces progress — earnings only accumulate, so the goal is monotone. A no-op
 * for harvest objectives and once not 'playing'.
 */
export function registerEarned(def: PuzzleDef, state: PuzzleState, amount: number): PuzzleState {
  if (state.status !== 'playing') return state;
  if (def.objective.kind !== 'coins' || amount <= 0) return state;
  const progress = state.progress + amount;
  const status: PuzzleStatus = progress >= def.objective.amount ? 'won' : 'playing';
  return { ...state, progress, status };
}

/**
 * Pure reducer: apply one resolved night. Increments the night count; flips to 'lost' if the
 * night limit is exceeded without a win. A no-op once not 'playing'. With nightLimit 0 the first
 * sleep loses — "today only" puzzles must be won at harvest/earn time during day 1.
 */
export function registerNight(def: PuzzleDef, state: PuzzleState): PuzzleState {
  if (state.status !== 'playing') return state;
  const nightsUsed = state.nightsUsed + 1;
  const status: PuzzleStatus = nightsUsed > def.nightLimit ? 'lost' : 'playing';
  return { ...state, nightsUsed, status };
}

/**
 * Sequential unlock: puzzle 0 is always open; puzzle N unlocks once puzzle N-1 has ≥1 star.
 * Challenges continue the same chain after the tutorials, in PUZZLES order.
 */
export function isPuzzleUnlocked(index: number, stars: Record<string, number>): boolean {
  if (index <= 0) return true;
  const prev = PUZZLES[index - 1];
  return !!prev && (stars[prev.id] ?? 0) >= 1;
}
