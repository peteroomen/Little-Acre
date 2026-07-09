/**
 * Little Acre — Puzzle mode model (pure; exercised in Vitest).
 *
 * No React, no Canvas, no store imports. A puzzle is a handcrafted scenario on a fixed board +
 * starting kit (see docs/design/DESIGN.md §3 / docs/design/puzzles.md). The first three are
 * TUTORIALS that introduce the loop, watering discipline, and re-yield; the CHALLENGES that
 * follow each teach one strategic idea (deadlines, fruit-holding, bootstrapping, crop choice,
 * sprinkler placement).
 *
 * Star scoring is GOAL-TIERED on the objective's own metric (harvest count / coins earned), not
 * on nights: the objective count/amount is the 1★ base (real slack), `stars.two` / `stars.three`
 * are stretch progress targets. Reaching the 3★ target ends the run instantly; otherwise the run
 * is scored when the night limit is exhausted (≥two ⇒ 2★, ≥base ⇒ 1★, else lost). 3★ is the
 * exact solver-proven maximum progress within `nightLimit` — the optimization challenge lives
 * there. Every def is validated by the exact solver — see scripts/check-puzzle-pars.mjs (base
 * comfortably feasible, 3★ == solver max, 3★+1 infeasible). Keep the harness SHIPPED mirror in
 * sync when editing defs.
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
  /**
   * Goal-tier PROGRESS targets on the objective metric (harvest count / coins earned). The
   * objective's own count/amount is the 1★ base; `two` and `three` are stretch tiers. Invariant:
   * base < two < three, with `three` the exact solver-proven maximum within `nightLimit`.
   */
  stars: { two: number; three: number };
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
    // Goal ladder 3 / 6 / 9 carrots. 9 grass at 10⚡ caps at 9 (till+plant+water each tile costs
    // 3⚡, so the day's replant/expand budget is the throttle) — solver-locked exact max.
    stars: { two: 6, three: 9 },
    startCoins: 30,
    startEnergy: 10,
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
    // Goal ladder 4 / 5 / 6 potatoes: 4 = the pre-tilled beds; 5–6 = till and plant the spare
    // grass too. 16⚡/day only affords planting+watering ~6 tiles day-1, so 6 is the exact max.
    stars: { two: 5, three: 6 },
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
    nightLimit: 7,
    // Two vine beds (flower borders, no spare soil). Each tomato re-yields 4 fruits, so the two
    // vines cap at 8 total — the 3★ exact max. Goal ladder 4 / 6 / 8: 4 = one vine milked plus the
    // other's first fruits; 8 = both vines fully spent. base 4 lands night 5 (2 nights of slack).
    stars: { two: 6, three: 8 },
    startCoins: 40,
    startEnergy: 16,
    builds: ['tomato'],
    // Two plantable beds framed by flowers — the lesson is re-yield, not expansion.
    makeBoard: () =>
      boardFrom([
        ['tilled', 'tilled', 'flower'],
        ['flower', 'flower', 'flower'],
        ['flower', 'flower', 'flower'],
      ]),
  },
  // ── challenges (each par is solver-locked; see check-puzzle-pars.mjs) ──────
  {
    id: 'market-day',
    name: 'Market Day',
    section: 'challenge',
    blurb:
      'The market cart leaves at dusk — no time to sleep! Feed a growing crop to hurry it along, and send off as many carrots as you can before the day ends. Two makes the sale; four is a banner day.',
    objective: { kind: 'harvest', crop: 'carrot', count: 2 },
    // "Today only": all scoring happens on day 1 (tap End Day to settle). Goal ladder 2 / 3 / 4
    // carrots on 13⚡ / 20c working capital. 2 is a relaxed base (fund one carrot, sell, fund the
    // next); 4 is the exact same-day max (till→plant→feed×2→harvest chains, sequential coin reuse)
    // — the knife-edge lives at 3★, not the base.
    nightLimit: 0,
    stars: { two: 3, three: 4 },
    startCoins: 20,
    startEnergy: 13,
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
      'One splash of water a day, and two hungry plants. A ripe fruit is happy to wait on the vine — sometimes the kindest thing is to let it hang. Cash two the easy way, or hold your nerve for all four.',
    objective: { kind: 'harvest', crop: 'any', count: 2 },
    // Ripe vine (3 fruits left) + a stage-1 potato, 1⚡/day. Goal ladder 2 / 3 / 4. 2 is trivial;
    // 3 = the vine's fruits cashed greedily; 4 (the exact max) demands HOLDING the ripe fruit
    // while the potato is watered nights 1–2 — cash the vine early and the potato wilts, capping
    // the board at 3 (pinned in the harness). The optimization insight is the 3★.
    nightLimit: 6,
    stars: { two: 3, three: 4 },
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
    // 4c affords one carrot seed only; its 20c sale (night 2) bankrolls the potato seeds. Goal
    // ladder 3 / 5 / 6 potatoes: 3 (one bed of potatoes) lands night 5; 6 (the exact max) needs a
    // second replant cycle across the 3 beds. base 3 keeps 3 nights of slack. Potato-only from 4c
    // is infeasible (pinned in the harness) — the bootstrap is the lesson.
    nightLimit: 8,
    stars: { two: 5, three: 6 },
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
    // 1⚡/fruit — mixing carrot + tomato is the lesson. Goal ladder 12 / 17 / 22 crops: base 12
    // lands night 7 (3 nights of slack); 22 is the exact 10-night max, squeezed by near-perfect
    // crop-mix play. The optimization ceiling is the 3★.
    nightLimit: 10,
    stars: { two: 17, three: 22 },
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
    // 76c = one Sprinkler (60c) + four carrot seeds (16c); 5⚡ = place + plant 4. A centre sprinkler
    // waters the whole plus every night, so the arms ripen hands-free. Goal ladder 4 / 6 / 9
    // carrots: base 4 is one hands-free cycle (night 2, 2 nights of slack); 9 is the exact 4-night
    // max, cycling replants on the watered arms. Sprinkler placement is the lesson; the ceiling
    // (9) is the 3★.
    nightLimit: 4,
    stars: { two: 6, three: 9 },
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

/** The bare metric noun for the goal ladder UI: "Carrots" / "Crops" / "Coins". */
export function objectiveNoun(objective: PuzzleObjective): string {
  return objective.kind === 'coins' ? 'Coins' : cropPlural(objective.crop, 2);
}

/** The three goal-tier PROGRESS thresholds in ascending order: [1★ base, 2★, 3★]. */
export function tierTargets(def: PuzzleDef): [number, number, number] {
  return [objectiveTarget(def.objective), def.stars.two, def.stars.three];
}

/**
 * The tier the player is climbing toward at `progress`: its star value (1|2|3) and progress
 * threshold. Once 3★ is earned it pins to the 3★ tier (nothing higher to chase). Drives the
 * objective banner's "N / threshold ★★" readout.
 */
export function nextTier(def: PuzzleDef, progress: number): { stars: 1 | 2 | 3; target: number } {
  const earned = starsFor(def, progress);
  if (earned <= 0) return { stars: 1, target: objectiveTarget(def.objective) };
  if (earned === 1) return { stars: 2, target: def.stars.two };
  return { stars: 3, target: def.stars.three };
}

export function initPuzzleState(): PuzzleState {
  return { progress: 0, nightsUsed: 0, status: 'playing' };
}

/** True when a harvested crop counts toward the objective (harvest objectives only). */
export function objectiveMatches(objective: PuzzleObjective, crop: CropId): boolean {
  return objective.kind === 'harvest' && (objective.crop === 'any' || objective.crop === crop);
}

/**
 * Goal-tier stars for a given `progress` (harvest count / coins earned). 0 = below the 1★ base
 * (a loss when the deadline hits); 1/2/3 as progress clears base / `two` / `three`. Pure: usable
 * both on a mid-run instant 3★ win and when scoring a run at the night-limit deadline.
 */
export function starsFor(def: PuzzleDef, progress: number): 0 | 1 | 2 | 3 {
  if (progress >= def.stars.three) return 3;
  if (progress >= def.stars.two) return 2;
  if (progress >= objectiveTarget(def.objective)) return 1;
  return 0;
}

/**
 * Pure reducer: apply one harvest to the puzzle state. Increments progress when the crop matches
 * a harvest objective; flips to 'won' the moment the 3★ target is cleared (an instant top-tier
 * win). Lower tiers are only scored at the night-limit deadline (see registerNight). A no-op once
 * not 'playing' and for coin objectives (those advance via registerEarned).
 */
export function registerHarvest(def: PuzzleDef, state: PuzzleState, crop: CropId): PuzzleState {
  if (state.status !== 'playing') return state;
  if (!objectiveMatches(def.objective, crop)) return state;
  const progress = state.progress + 1;
  const status: PuzzleStatus = progress >= def.stars.three ? 'won' : 'playing';
  return { ...state, progress, status };
}

/**
 * Pure reducer: apply coins EARNED to a coin objective (harvest sells + fish/mine income).
 * Spending never reduces progress — earnings only accumulate, so the goal is monotone. Flips to
 * 'won' on clearing the 3★ target. A no-op for harvest objectives and once not 'playing'.
 */
export function registerEarned(def: PuzzleDef, state: PuzzleState, amount: number): PuzzleState {
  if (state.status !== 'playing') return state;
  if (def.objective.kind !== 'coins' || amount <= 0) return state;
  const progress = state.progress + amount;
  const status: PuzzleStatus = progress >= def.stars.three ? 'won' : 'playing';
  return { ...state, progress, status };
}

/**
 * Pure reducer: apply one resolved night. Increments the night count. When the night limit is
 * exhausted (nightsUsed > nightLimit), the run is SCORED on progress: ≥ base ⇒ 'won' (with the
 * earned tier), else 'lost'. Before the deadline the run stays 'playing'. With nightLimit 0 the
 * first sleep ("End Day") scores immediately. A no-op once not 'playing'.
 */
export function registerNight(def: PuzzleDef, state: PuzzleState): PuzzleState {
  if (state.status !== 'playing') return state;
  const nightsUsed = state.nightsUsed + 1;
  if (nightsUsed > def.nightLimit) {
    const status: PuzzleStatus = starsFor(def, state.progress) >= 1 ? 'won' : 'lost';
    return { ...state, nightsUsed, status };
  }
  return { ...state, nightsUsed, status: 'playing' };
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
