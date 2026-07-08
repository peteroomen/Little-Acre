/**
 * Little Acre — Puzzle mode model (pure; exercised in Vitest).
 *
 * No React, no Canvas, no store imports. A puzzle is a handcrafted "produce N of G in D nights"
 * scenario on a fixed board + starting kit (see docs/design/DESIGN.md §3 / docs/design/puzzles.md).
 * The first three are TUTORIALS that introduce the loop, watering discipline, and re-yield.
 *
 * Star scoring: 1★ = completed within `nightLimit`; 2★ = within `stars.two` nights;
 * 3★ = within `stars.three` nights (near-optimal). Thresholds are authored so par ≈ optimal —
 * feasibility is verified by hand in the plan file and mirrors the crop grow times in tiles.ts.
 */

import type { CropId, Tile } from './tiles';

export type PuzzleStatus = 'playing' | 'won' | 'lost';

export interface PuzzleObjective {
  kind: 'harvest';
  /** Which crop counts toward the goal, or 'any' for any harvested crop. */
  crop: CropId | 'any';
  count: number;
}

export interface PuzzleDef {
  id: string;
  name: string;
  /** 1–2 sentence tutorial intro, shown on start + on the select card. */
  blurb: string;
  objective: PuzzleObjective;
  /** Exceed this many nights without completing => lose. */
  nightLimit: number;
  /** Nights-used thresholds: <= three ⇒ 3★, <= two ⇒ 2★ (else 1★, assuming completed). */
  stars: { three: number; two: number };
  startCoins: number;
  /** Starting energy, which is also the puzzle's max energy. */
  startEnergy: number;
  /** Which crops the tap-radial offers in this puzzle (restricted for tutorials). */
  builds: CropId[];
  /**
   * Whether Feed (fertilize) is offered on a growing crop. Defaults to FALSE: the tutorials must
   * not offer Feed (it trivialises their star tunings). Feed-centric puzzles opt in with `true`.
   */
  allowFeed?: boolean;
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

export const PUZZLES: PuzzleDef[] = [
  {
    id: 'first-sprout',
    name: 'First Sprout',
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
    blurb:
      'A Tomato keeps producing. Plant it once and harvest the same vine again and again — no replanting needed.',
    objective: { kind: 'harvest', crop: 'tomato', count: 4 },
    nightLimit: 9,
    stars: { three: 6, two: 7 },
    startCoins: 40,
    startEnergy: 16,
    builds: ['tomato'],
    makeBoard: () => tilledBoard(2),
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

export function initPuzzleState(): PuzzleState {
  return { progress: 0, nightsUsed: 0, status: 'playing' };
}

/** True when a harvested crop counts toward the objective. */
export function objectiveMatches(objective: PuzzleObjective, crop: CropId): boolean {
  return objective.crop === 'any' || objective.crop === crop;
}

/**
 * Stars earned for completing a puzzle in `nightsUsed` nights. Only called on a win, so the
 * floor is 1★ (completed within the night limit).
 */
export function starsFor(def: PuzzleDef, nightsUsed: number): 0 | 1 | 2 | 3 {
  if (nightsUsed <= def.stars.three) return 3;
  if (nightsUsed <= def.stars.two) return 2;
  return 1;
}

/**
 * Pure reducer: apply one harvest to the puzzle state. Increments progress when the crop matches
 * the objective; flips to 'won' once the count is reached. A no-op once not 'playing'.
 */
export function registerHarvest(def: PuzzleDef, state: PuzzleState, crop: CropId): PuzzleState {
  if (state.status !== 'playing') return state;
  if (!objectiveMatches(def.objective, crop)) return state;
  const progress = state.progress + 1;
  const status: PuzzleStatus = progress >= def.objective.count ? 'won' : 'playing';
  return { ...state, progress, status };
}

/**
 * Pure reducer: apply one resolved night. Increments the night count; flips to 'lost' if the
 * night limit is exceeded without a win. A no-op once not 'playing'.
 */
export function registerNight(def: PuzzleDef, state: PuzzleState): PuzzleState {
  if (state.status !== 'playing') return state;
  const nightsUsed = state.nightsUsed + 1;
  const status: PuzzleStatus = nightsUsed > def.nightLimit ? 'lost' : 'playing';
  return { ...state, nightsUsed, status };
}

/**
 * Sequential unlock: puzzle 0 is always open; puzzle N unlocks once puzzle N-1 has ≥1 star.
 */
export function isPuzzleUnlocked(index: number, stars: Record<string, number>): boolean {
  if (index <= 0) return true;
  const prev = PUZZLES[index - 1];
  return !!prev && (stars[prev.id] ?? 0) >= 1;
}
