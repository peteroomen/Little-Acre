/**
 * Little Acre — board model + content definitions + pure resolvers.
 *
 * No React, no Canvas, no store imports. Everything here is exercised in Vitest.
 * Ported from the `Farm Idle.dc.html` prototype (docs/design/prototype/): the
 * CROPS / LAND / STRUCT tables and the night-growth / harvest rules are the
 * authoritative gameplay reference. Economy NUMBERS here are a faithful first-pass
 * port and are still being modelled — see docs/design/GDD.md "Open questions".
 */

export type Tool = 'click' | 'build';

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
 *  - Tomato: keep-alive — plant once, re-harvest 3× (regrows every 2 nights). Best coins/energy.
 */
export const CROPS: Record<CropId, CropDef> = {
  carrot: { name: 'Carrot', cost: 4, sell: 20, grow: 2, color: '#f0894a', leaf: '#83c250' },
  potato: { name: 'Potato', cost: 6, sell: 34, grow: 3, color: '#c49a5c', leaf: '#6fae52' },
  tomato: {
    name: 'Tomato',
    cost: 12,
    sell: 18,
    grow: 4,
    reyield: 3,
    regrow: 2,
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
}

export const BOARD_ROWS = 3;
export const BOARD_COLS = 3;

/**
 * The deterministic starting board (mirrors the prototype's `setupTiles` layout).
 * A pure factory so a fresh farm always reproduces the same opening plots and the
 * night/harvest tests have a fixed fixture.
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
      tiles.push({
        r,
        c,
        kind,
        crop,
        stage,
        harvests: 0,
        watered: false,
        wilted: false,
        structure: null,
      });
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

/** True when a growing crop still needs watering tonight (not ripe, not wilted, no sprinkler). */
export function needsWater(t: Tile): boolean {
  return (
    t.kind === 'tilled' &&
    !!t.crop &&
    !t.wilted &&
    t.stage < cropGrow(t.crop) &&
    t.structure !== 'sprinkler' &&
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
 *  - a growing crop that is watered (or on a Sprinkler tile) advances one stage;
 *  - an unwatered growing crop on a Scarecrow tile survives but does not grow;
 *  - any other unwatered growing crop wilts;
 *  - `watered` resets to false on every tile at dawn.
 */
export function resolveNight(tiles: Tile[]): NightResult {
  let grew = 0;
  let wilted = 0;
  const next = tiles.map((t) => {
    const nt: Tile = { ...t };
    if (nt.kind === 'tilled' && nt.crop && !nt.wilted && nt.stage < cropGrow(nt.crop)) {
      const auto = nt.structure === 'sprinkler';
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
    return nt;
  });
  return { tiles: next, grew, wilted };
}
