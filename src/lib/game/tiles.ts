/**
 * Little Acre — board model + content definitions + pure resolvers.
 *
 * No React, no Canvas, no store imports. Everything here is exercised in Vitest.
 * Ported from the `Farm Idle.dc.html` prototype (docs/design/prototype/): the
 * CROPS / LAND / STRUCT tables and the night-growth / harvest rules are the
 * authoritative gameplay reference. Economy NUMBERS here are a faithful first-pass
 * port and are still being modelled — see docs/design/GDD.md "Open questions".
 */

export type TileKind = 'grass' | 'tilled' | 'pond' | 'rock' | 'flower';
export type CropId = 'carrot' | 'potato' | 'tomato';
export type LandId = 'plot' | 'flower' | 'pond' | 'rock';
export type StructId = 'sprinkler' | 'scarecrow';
export type BuildId = CropId | LandId | StructId;

/**
 * `stage` counts watered nights of growth (0..grow); a crop is ripe when `stage >= grow`.
 * `grow` is per-crop (see CROPS), so crops ripen at different speeds. The renderer maps
 * `stage/grow` onto its four sprite stages via `visualStage`.
 */
export const VISUAL_STAGES = 4;

export interface CropDef {
  name: string;
  /** Coin cost to plant a seed. */
  cost: number;
  /** Base coin payout at harvest, before the Bloom multiplier. */
  sell: number;
  /** Watered nights to ripen from a fresh planting. */
  grow: number;
  /** Total harvests before the tile clears. Omitted / 1 = single-harvest. */
  reyield?: number;
  /** Nights to re-ripen after a re-yield harvest (drops back to `grow - regrow`). */
  regrow?: number;
  color: string;
  leaf: string;
}

export interface LandDef {
  name: string;
  cost: number;
  kind: TileKind;
  color: string;
}

export interface StructDef {
  name: string;
  cost: number;
  color: string;
}

/**
 * Tier-1 crops. Each wins a different axis so crop choice is a real decision under the
 * energy budget (see docs/design/DESIGN.md §5). Numbers are first-pass, mirrored from
 * scripts/little-acre-model.mjs — tune there.
 *  - Carrot: bootstrap — cheap + fast (2 nights). Best coins/tile-night.
 *  - Potato: staple — reliable, balanced (3 nights).
 *  - Tomato: keep-alive — plant once, harvest the same vine 4× (re-ripens in 1 night). Best coins/energy.
 */
export const CROPS: Record<CropId, CropDef> = {
  carrot: { name: 'Carrot', cost: 4, sell: 20, grow: 2, color: '#f0894a', leaf: '#83c250' },
  potato: { name: 'Potato', cost: 6, sell: 34, grow: 3, color: '#c49a5c', leaf: '#6fae52' },
  // reyield 4 / regrow 1: once ripe the vine yields one fruit per watered night at 1⚡, so the
  // amortized energy-per-harvest drops from 3 (which tied carrot, leaving tomato strictly
  // dominated) to 2 — this is what gives the keep-alive niche real teeth. A solver sweep locks
  // the final numbers at integration, so keep them as plain literals here.
  tomato: {
    name: 'Tomato',
    cost: 12,
    sell: 18,
    grow: 4,
    reyield: 4,
    regrow: 1,
    color: '#ef6a4e',
    leaf: '#6cb04a',
  },
};

/** Watered nights for a crop to (re)ripen from a fresh planting. */
export function cropGrow(crop: CropId): number {
  return CROPS[crop].grow;
}

export const LAND: Record<LandId, LandDef> = {
  plot: { name: 'Plot', cost: 15, kind: 'tilled', color: '#c69c6d' },
  flower: { name: 'Flowers', cost: 30, kind: 'flower', color: '#c9a6ff' },
  pond: { name: 'Pond', cost: 90, kind: 'pond', color: '#8fd3e0' },
  rock: { name: 'Rock', cost: 140, kind: 'rock', color: '#b7ad93' },
};

export const STRUCT: Record<StructId, StructDef> = {
  sprinkler: { name: 'Sprinkler', cost: 60, color: '#6cc3de' },
  scarecrow: { name: 'Scarecrow', cost: 45, color: '#c79a5a' },
};

export function isCrop(id: BuildId): id is CropId {
  return id in CROPS;
}
export function isLand(id: BuildId): id is LandId {
  return id in LAND;
}
export function isStruct(id: BuildId): id is StructId {
  return id in STRUCT;
}

export interface Tile {
  r: number;
  c: number;
  kind: TileKind;
  crop: CropId | null;
  /** Watered nights of growth, 0..grow; ripe when `stage >= cropGrow(crop)`. */
  stage: number;
  /** Times this planting has been reaped (for re-yield crops). */
  harvests: number;
  watered: boolean;
  wilted: boolean;
  structure: StructId | null;
  /** Pond only: fish left to catch. Refills +2/night up to 4; an empty pond can't be fished. */
  pondStock?: number;
  /** Rock only: mining pulls left before it goes dormant (starts at 3). */
  rockCharges?: number;
  /** Rock only: nights until a spent rock re-charges (0 = ready). */
  rockDormant?: number;
}

/** Fish a full pond holds (also its per-night refill ceiling). */
export const POND_MAX = 4;
export const POND_REFILL = 2;
/** Mining pulls a fresh rock holds before it goes dormant. */
export const ROCK_CHARGES = 3;
/** Nights a spent rock stays dormant before re-charging. */
export const ROCK_DORMANT_NIGHTS = 3;

/**
 * Deterministic gathering payouts (no RNG — puzzle-safe + reproducible; the solver mirrors these):
 *  - FISH_COINS: coins per catch (≈ the old random mean).
 *  - ORE_COINS: coins per mining pull. A gem is awarded on the *last* pull of a rock cycle
 *    (when its charges reach 0 and it goes dormant) — see the mine action in store.ts.
 */
export const FISH_COINS = 18;
export const ORE_COINS = 13;

/**
 * Puzzle boards are a fixed 3×3 grid (see puzzles.ts / the solver). Freeplay is now
 * variable-size (see BOARD_TIERS) and derives its dimensions from the actual tiles via
 * `boardSize`, so these constants exist only for the puzzle path + the legacy `createBoard`.
 */
export const BOARD_ROWS = 3;
export const BOARD_COLS = 3;

export interface BoardTier {
  /** Side length of the N×N square at this tier. */
  size: number;
  /** Coin cost to expand INTO this tier from the previous one (tier 0 is free — the start). */
  cost: number;
}

/**
 * Freeplay board-size ladder: a new farm starts at tier 0 (1×1 wild grass) and grows by
 * spending coins in the Store. Expansion keeps every existing tile and re-centres the old
 * square in the new one (see `expandBoard`).
 *
 * NOTE: the costs are PLACEHOLDERS pending the owner balance pass — sized to be reachable
 * after a few carrot harvests (3×3) and a solid early run (5×5), not tuned.
 */
export const BOARD_TIERS: BoardTier[] = [
  { size: 1, cost: 0 },
  { size: 3, cost: 150 },
  { size: 5, cost: 600 },
];

/** The tier index whose board is 3×3 — the shape every pre-v5 (9-tile) save migrates to. */
export const LEGACY_BOARD_TIER = BOARD_TIERS.findIndex((t) => t.size === 3);

/** Side length N of a square board, derived from its tiles (max r/c + 1). 0 for an empty board. */
export function boardSize(tiles: Tile[]): number {
  let max = -1;
  for (const t of tiles) {
    if (t.r > max) max = t.r;
    if (t.c > max) max = t.c;
  }
  return max + 1;
}

/** A fresh, empty wild-grass tile at (r,c). */
function grassTile(r: number, c: number): Tile {
  return {
    r,
    c,
    kind: 'grass',
    crop: null,
    stage: 0,
    harvests: 0,
    watered: false,
    wilted: false,
    structure: null,
  };
}

/**
 * A fresh Freeplay board for `tier`: an N×N square of wild grass (N = BOARD_TIERS[tier].size).
 * Tier 0 is a single wild tile — the player tills, plants, and buys land/structures from there
 * (the old fixed 3×3 opening layout with a pond/rock is gone for new games; see createBoard).
 */
export function createFreeplayBoard(tier: number): Tile[] {
  const size = BOARD_TIERS[tier]?.size ?? BOARD_TIERS[0].size;
  const tiles: Tile[] = [];
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) tiles.push(grassTile(r, c));
  return tiles;
}

/**
 * Grow a board to `newSize`, preserving every existing tile's state and CENTRING the old square
 * in the new one — a 1×1 tile becomes the centre of 3×3, and a 3×3 becomes the centre of 5×5.
 * New perimeter tiles are wild grass. Pure (returns a fresh board). Idempotence guard: a request
 * that isn't strictly larger returns the input unchanged, so a double-buy can't shrink or reflow.
 */
export function expandBoard(tiles: Tile[], newSize: number): Tile[] {
  const oldSize = boardSize(tiles);
  if (newSize <= oldSize) return tiles;
  // Odd tier sizes (1,3,5) keep the offset integral so the old square lands dead-centre.
  const offset = Math.floor((newSize - oldSize) / 2);
  const kept = new Map<string, Tile>();
  for (const t of tiles) {
    const nr = t.r + offset;
    const nc = t.c + offset;
    kept.set(`${nr}-${nc}`, { ...t, r: nr, c: nc });
  }
  const out: Tile[] = [];
  for (let r = 0; r < newSize; r++)
    for (let c = 0; c < newSize; c++) out.push(kept.get(`${r}-${c}`) ?? grassTile(r, c));
  return out;
}

/**
 * The deterministic legacy 3×3 board (mirrors the prototype's `setupTiles` layout). New Freeplay
 * games no longer use it — it's retained as the migration/fallback shape for pre-v5 saves and as a
 * rich fixture (pond/rock/pre-grown crops) for the save + tile tests.
 */
export function createBoard(): Tile[] {
  const layout: string[][] = [
    ['rock:', 'tilled:carrot:2', 'tilled:potato:2'],
    ['tilled:potato:3', 'tilled::0', 'tilled:tomato:1'],
    ['pond:', 'grass:', 'flower:'],
  ];
  const tiles: Tile[] = [];
  for (let r = 0; r < BOARD_ROWS; r++) {
    for (let c = 0; c < BOARD_COLS; c++) {
      const parts = layout[r][c].split(':');
      const kind = parts[0] as TileKind;
      const crop = (parts[1] || null) as CropId | null;
      const stage = parts[2] ? parseInt(parts[2], 10) : 0;
      const tile: Tile = {
        r,
        c,
        kind,
        crop,
        stage,
        harvests: 0,
        watered: false,
        wilted: false,
        structure: null,
      };
      // Gathering nodes start stocked (see resolveNight for the per-night regen).
      if (kind === 'pond') tile.pondStock = POND_MAX;
      if (kind === 'rock') {
        tile.rockCharges = ROCK_CHARGES;
        tile.rockDormant = 0;
      }
      tiles.push(tile);
    }
  }
  return tiles;
}

/** Coin payout for harvesting a ripe crop, scaled by the current Bloom multiplier. */
export function harvestValue(crop: CropId, bloom: number): number {
  return Math.round(CROPS[crop].sell * bloom);
}

/** True when a tile holds a crop that can be reaped right now. */
export function isRipe(t: Tile): boolean {
  return t.kind === 'tilled' && !!t.crop && t.stage >= cropGrow(t.crop) && !t.wilted;
}

/**
 * True when a growing crop on tile `t` is auto-watered tonight: either it sits on a Sprinkler,
 * or an orthogonally-adjacent tile does. Adjacency is derived from r/c (|Δr| + |Δc| === 1), not
 * array index, so odd-sized boards keep working. The game's first spatial mechanic — a Sprinkler
 * waters its own plus-shape (own tile + the 4 orthogonal neighbours).
 */
export function isAutoWatered(t: Tile, tiles: Tile[]): boolean {
  if (t.structure === 'sprinkler') return true;
  return tiles.some(
    (o) => o.structure === 'sprinkler' && Math.abs(o.r - t.r) + Math.abs(o.c - t.c) === 1,
  );
}

/**
 * True when a growing crop still needs watering tonight (not ripe, not wilted, not auto-watered
 * by a sprinkler on this tile or an orthogonal neighbour). Needs the board for the adjacency check.
 */
export function needsWater(t: Tile, tiles: Tile[]): boolean {
  return (
    t.kind === 'tilled' &&
    !!t.crop &&
    !t.wilted &&
    t.stage < cropGrow(t.crop) &&
    !isAutoWatered(t, tiles) &&
    !t.watered
  );
}

/**
 * Map a tile's growth onto the renderer's four sprite stages (0 sprout · 1 small · 2 medium ·
 * 3 ripe). Keeps the renderer free of crop-growth rules — single source of truth lives here.
 */
export function visualStage(t: Tile): number {
  if (!t.crop) return 0;
  const grow = cropGrow(t.crop);
  if (t.stage >= grow) return 3;
  if (t.stage <= 0) return 0;
  return t.stage / grow < 0.5 ? 1 : 2;
}

/**
 * Resolve harvesting a ripe crop. Re-yield crops drop back to `grow - regrow` stages (they
 * re-ripen in `regrow` nights) until their `reyield` harvests are spent, then the tile clears.
 * Returns the tile patch to apply (does not mutate).
 */
export function harvestPatch(t: Tile): Partial<Tile> {
  const crop = t.crop;
  if (!crop) return {};
  const def = CROPS[crop];
  const harvests = t.harvests + 1;
  const total = def.reyield ?? 1;
  if (harvests < total) {
    const regrow = def.regrow ?? def.grow;
    return { stage: Math.max(0, def.grow - regrow), harvests, watered: false };
  }
  return { crop: null, stage: 0, harvests: 0, watered: false };
}

export interface NightResult {
  tiles: Tile[];
  grew: number;
  wilted: number;
}

/**
 * Resolve one night of growth. Pure — returns a fresh board plus the growth/wilt
 * tallies for the sunrise summary. Rules (from the prototype):
 *  - a growing crop that is watered (or auto-watered by a Sprinkler on its own tile or an
 *    orthogonal neighbour — see `isAutoWatered`) advances one stage;
 *  - an unwatered growing crop on a Scarecrow tile survives but does not grow;
 *  - any other unwatered growing crop wilts;
 *  - `watered` resets to false on every tile at dawn;
 *  - ponds restock +2 fish (cap 4); a dormant rock counts down and re-charges at 0.
 */
export function resolveNight(tiles: Tile[]): NightResult {
  let grew = 0;
  let wilted = 0;
  const next = tiles.map((t) => {
    const nt: Tile = { ...t };
    if (nt.kind === 'tilled' && nt.crop && !nt.wilted && nt.stage < cropGrow(nt.crop)) {
      // Structures don't change overnight, so adjacency is read from the original board.
      const auto = isAutoWatered(t, tiles);
      if (nt.watered || auto) {
        nt.stage += 1;
        grew += 1;
      } else if (nt.structure === 'scarecrow') {
        // protected: survives, no growth
      } else {
        nt.wilted = true;
        wilted += 1;
      }
    }
    nt.watered = false;
    // Gathering nodes recover overnight so fishing/mining stay tended, not infinite.
    if (nt.kind === 'pond')
      nt.pondStock = Math.min(POND_MAX, (nt.pondStock ?? POND_MAX) + POND_REFILL);
    if (nt.kind === 'rock' && (nt.rockDormant ?? 0) > 0) {
      nt.rockDormant = (nt.rockDormant ?? 0) - 1;
      if (nt.rockDormant === 0) nt.rockCharges = ROCK_CHARGES;
    }
    return nt;
  });
  return { tiles: next, grew, wilted };
}
