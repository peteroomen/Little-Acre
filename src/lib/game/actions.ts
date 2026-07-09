/**
 * Little Acre — contextual tile actions + radial geometry (pure; exercised in Vitest).
 *
 * No React, no Canvas, no store imports. This module decides *what a tap on a tile can do*:
 * a `primary` action (the radial centre / quick-tap default) plus a `ring` of secondary
 * actions. The store executes the chosen action; the RadialMenu only renders what's here.
 * All selection logic (which slice is under the thumb) is `radialHiFor` — the menu is
 * display-only, so this stays testable.
 */

import {
  CROPS,
  LAND,
  STRUCT,
  cropGrow,
  isRipe,
  needsWater,
  type BuildId,
  type CropId,
  type LandId,
  type StructId,
  type Tile,
} from './tiles';

export type ActionKind =
  | 'till'
  | 'plant'
  | 'water'
  | 'fertilize'
  | 'harvest'
  | 'uproot'
  | 'clear'
  | 'fish'
  | 'mine'
  | 'structure'
  | 'land';

export interface TileAction {
  kind: ActionKind;
  label: string;
  /** The crop / structure / land id this action places (for plant/structure/land). */
  build?: BuildId;
  coinCost: number;
  energyCost: number;
  /** Swatch colour shown in the radial (from the def, or a per-verb accent). */
  color: string;
}

export interface TileActions {
  /** The radial centre / quick-tap default (null = no default; a bare tap does nothing). */
  primary: TileAction | null;
  /** Secondary actions laid out around the ring. Empty ⇒ tap runs `primary` directly. */
  ring: TileAction[];
}

export interface ActionCtx {
  /** Crops the player may plant here (all in Freeplay; restricted to a puzzle's taught set). */
  crops: CropId[];
  allowStructures: boolean;
  allowLand: boolean;
  /** Whether Feed (fertilize) is offered on a growing crop (Freeplay: on; puzzle: per-def, default off). */
  allowFeed: boolean;
  /** The full board — needed for the sprinkler-adjacency check behind the Water default. */
  tiles: Tile[];
}

/** Coin cost to fertilize (feed) a growing crop one stage. */
export const FERTILIZE_COINS = 8;

// Per-verb accent colours (defs carry their own; these are for the choice-less verbs).
const COLOR_WATER = '#6cc3de';
const COLOR_FERTILIZE = '#7cae4f';
const COLOR_FISH = '#8fd3e0';
const COLOR_MINE = '#b7ad93';
const COLOR_TILL = '#c69c6d';
const COLOR_UPROOT = '#a08a63';
const COLOR_CLEAR = '#a08a63';

const tillAction: TileAction = {
  kind: 'till',
  label: 'Till',
  coinCost: 0,
  energyCost: 1,
  color: COLOR_TILL,
};
const waterAction: TileAction = {
  kind: 'water',
  label: 'Water',
  coinCost: 0,
  energyCost: 1,
  color: COLOR_WATER,
};
const fertilizeAction: TileAction = {
  kind: 'fertilize',
  label: 'Feed',
  coinCost: FERTILIZE_COINS,
  energyCost: 1,
  color: COLOR_FERTILIZE,
};
const uprootAction: TileAction = {
  kind: 'uproot',
  label: 'Uproot',
  coinCost: 0,
  energyCost: 0,
  color: COLOR_UPROOT,
};
const clearAction: TileAction = {
  kind: 'clear',
  label: 'Clear',
  coinCost: 0,
  energyCost: 1,
  color: COLOR_CLEAR,
};
const fishAction: TileAction = {
  kind: 'fish',
  label: 'Fish',
  coinCost: 0,
  energyCost: 1,
  color: COLOR_FISH,
};
const mineAction: TileAction = {
  kind: 'mine',
  label: 'Mine',
  coinCost: 0,
  energyCost: 1,
  color: COLOR_MINE,
};

function plantAction(crop: CropId): TileAction {
  const cd = CROPS[crop];
  return {
    kind: 'plant',
    label: cd.name,
    build: crop,
    coinCost: cd.cost,
    energyCost: 1,
    color: cd.color,
  };
}
function structAction(id: StructId): TileAction {
  const sd = STRUCT[id];
  return {
    kind: 'structure',
    label: sd.name,
    build: id,
    coinCost: sd.cost,
    energyCost: 1,
    color: sd.color,
  };
}
function landAction(id: LandId): TileAction {
  const ld = LAND[id];
  return {
    kind: 'land',
    label: ld.name,
    build: id,
    coinCost: ld.cost,
    energyCost: 1,
    color: ld.color,
  };
}
function harvestAction(crop: CropId): TileAction {
  return {
    kind: 'harvest',
    label: 'Harvest',
    coinCost: 0,
    energyCost: 0,
    color: CROPS[crop].color,
  };
}

/**
 * True when uprooting `t` destroys something the player would mourn — a growing crop past its
 * first sprout (stage > 0) or a re-yield vine that has already borne fruit (harvests > 0). The
 * store arms a tap-again confirm for these (mirrors the Sleep guard). A fresh stage-0 planting
 * (nothing invested overnight yet) and a wilted clear stay instant. Pure — tested in Vitest.
 */
export function uprootNeedsConfirm(t: Tile): boolean {
  return t.kind === 'tilled' && !!t.crop && !t.wilted && (t.stage > 0 || (t.harvests ?? 0) > 0);
}

/**
 * The actions a tap on `t` offers, given the run context. `primary` is the fast default
 * (radial centre / quick-tap); `ring` holds the secondary choices. When `ring` is empty the
 * store runs `primary` on a bare tap; otherwise it opens the press-hold radial.
 *
 * A lone option (no default + exactly one ring choice — e.g. a tutorial's single taught crop) is
 * promoted to the primary so a quick tap runs it, rather than forcing a drag into a 1-item radial.
 */
export function actionsFor(t: Tile, ctx: ActionCtx): TileActions {
  const a = rawActionsFor(t, ctx);
  if (a.primary === null && a.ring.length === 1) return { primary: a.ring[0], ring: [] };
  return a;
}

function rawActionsFor(t: Tile, ctx: ActionCtx): TileActions {
  switch (t.kind) {
    case 'pond':
      return { primary: (t.pondStock ?? 0) > 0 ? fishAction : null, ring: [] };
    case 'rock':
      return { primary: (t.rockCharges ?? 0) > 0 ? mineAction : null, ring: [] };
    case 'flower':
      return { primary: null, ring: [] };
    case 'grass':
      return {
        primary: tillAction,
        // Till replaces the old "Plot" land, so land options exclude plot.
        ring: ctx.allowLand ? [landAction('pond'), landAction('rock'), landAction('flower')] : [],
      };
    case 'tilled': {
      if (!t.crop) {
        const ring: TileAction[] = ctx.crops.map(plantAction);
        if (ctx.allowStructures) ring.push(structAction('sprinkler'), structAction('scarecrow'));
        return { primary: null, ring };
      }
      if (t.wilted) return { primary: clearAction, ring: [] };
      if (isRipe(t)) return { primary: harvestAction(t.crop), ring: [uprootAction] };
      // Growing crop: quick-tap waters it (when it needs it); the ring feeds / uproots it.
      const ring: TileAction[] = [];
      if (ctx.allowFeed && t.stage < cropGrow(t.crop)) ring.push(fertilizeAction);
      ring.push(uprootAction);
      if (ctx.allowStructures && !t.structure) {
        ring.push(structAction('sprinkler'), structAction('scarecrow'));
      }
      return { primary: needsWater(t, ctx.tiles) ? waterAction : null, ring };
    }
    default:
      return { primary: null, ring: [] };
  }
}

// ── radial geometry ──

export const RADIAL_RADIUS = 64;
export const RADIAL_DEADZONE = 26;

/** Angle (radians) of ring slice `i` of `n`, starting at the top and going clockwise. */
export function ringAngle(i: number, n: number): number {
  return -Math.PI / 2 + (i * 2 * Math.PI) / n;
}

/**
 * Which slice the thumb is over, from the drag offset (dx,dy) relative to the radial centre.
 * Returns -1 for the deadzone (⇒ centre / primary) or when there are no ring slices.
 */
export function radialHiFor(ringCount: number, dx: number, dy: number): number {
  if (ringCount <= 0) return -1;
  if (Math.hypot(dx, dy) < RADIAL_DEADZONE) return -1;
  const ang = Math.atan2(dy, dx);
  let best = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < ringCount; i++) {
    let d = Math.abs(ang - ringAngle(i, ringCount));
    d = Math.min(d, Math.abs(d - 2 * Math.PI), Math.abs(d + 2 * Math.PI));
    if (d < bestDiff) {
      bestDiff = d;
      best = i;
    }
  }
  return best;
}
