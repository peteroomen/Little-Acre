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
export type CropId = 'carrot' | 'lettuce' | 'wheat' | 'tomato';
export type LandId = 'plot' | 'flower' | 'pond' | 'rock';
export type StructId = 'sprinkler' | 'scarecrow';
export type BuildId = CropId | LandId | StructId;

/** A crop is ripe (harvestable) at this stage. Crops grow 0 → 1 → 2 → 3. */
export const RIPE_STAGE = 3;
export const MAX_STAGE = 3;

export interface CropDef {
  name: string;
  /** Coin cost to plant a seed. */
  cost: number;
  /** Base coin payout at harvest, before the Bloom multiplier. */
  sell: number;
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

export const CROPS: Record<CropId, CropDef> = {
  carrot: { name: 'Carrot', cost: 4, sell: 14, color: '#f0894a', leaf: '#83c250' },
  lettuce: { name: 'Lettuce', cost: 10, sell: 38, color: '#8fce5e', leaf: '#b6e388' },
  wheat: { name: 'Wheat', cost: 7, sell: 26, color: '#eecf5f', leaf: '#d1ad5c' },
  tomato: { name: 'Tomato', cost: 8, sell: 30, color: '#ef6a4e', leaf: '#6cb04a' },
};

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
  /** 0..3; 3 is ripe. */
  stage: number;
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
    ['rock:', 'tilled:carrot:3', 'tilled:lettuce:2'],
    ['tilled:wheat:3', 'tilled::0', 'tilled:tomato:1'],
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
  return t.kind === 'tilled' && !!t.crop && t.stage >= RIPE_STAGE && !t.wilted;
}

/** True when a growing crop still needs watering tonight (not ripe, not wilted, no sprinkler). */
export function needsWater(t: Tile): boolean {
  return (
    t.kind === 'tilled' &&
    !!t.crop &&
    !t.wilted &&
    t.stage < RIPE_STAGE &&
    t.structure !== 'sprinkler' &&
    !t.watered
  );
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
    if (nt.kind === 'tilled' && nt.crop && !nt.wilted && nt.stage < RIPE_STAGE) {
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
