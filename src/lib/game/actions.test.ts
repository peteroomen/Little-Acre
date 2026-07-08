import { describe, expect, it } from 'vitest';

import {
  RADIAL_DEADZONE,
  RADIAL_RADIUS,
  actionsFor,
  radialHiFor,
  ringAngle,
  type ActionCtx,
} from './actions';
import { type CropId, type Tile } from './tiles';

function tile(over: Partial<Tile> = {}): Tile {
  return {
    r: 0,
    c: 0,
    kind: 'tilled',
    crop: null,
    stage: 0,
    harvests: 0,
    watered: false,
    wilted: false,
    structure: null,
    ...over,
  };
}

const FREE: ActionCtx = {
  crops: ['carrot', 'potato', 'tomato'] as CropId[],
  allowStructures: true,
  allowLand: true,
  allowFeed: true,
  tiles: [],
};
const PUZZLE: ActionCtx = {
  crops: ['carrot'] as CropId[],
  allowStructures: false,
  allowLand: false,
  allowFeed: false,
  tiles: [],
};

const kinds = (as: { kind: string }[]) => as.map((a) => a.kind);
const builds = (as: { build?: string }[]) => as.map((a) => a.build);

describe('actionsFor — gathering tiles', () => {
  it('pond offers fish only when stocked', () => {
    expect(actionsFor(tile({ kind: 'pond', pondStock: 4 }), FREE)).toMatchObject({
      primary: { kind: 'fish' },
      ring: [],
    });
    expect(actionsFor(tile({ kind: 'pond', pondStock: 0 }), FREE).primary).toBeNull();
  });

  it('rock offers mine only while it has charges', () => {
    expect(actionsFor(tile({ kind: 'rock', rockCharges: 3 }), FREE)).toMatchObject({
      primary: { kind: 'mine' },
      ring: [],
    });
    expect(actionsFor(tile({ kind: 'rock', rockCharges: 0 }), FREE).primary).toBeNull();
  });

  it('flower is inert', () => {
    expect(actionsFor(tile({ kind: 'flower' }), FREE)).toEqual({ primary: null, ring: [] });
  });
});

describe('actionsFor — grass (till + shape land)', () => {
  it('primary is Till; Freeplay ring shapes land (pond/rock/flowers, no plot)', () => {
    const a = actionsFor(tile({ kind: 'grass' }), FREE);
    expect(a.primary?.kind).toBe('till');
    expect(kinds(a.ring)).toEqual(['land', 'land', 'land']);
    expect(builds(a.ring)).toEqual(['pond', 'rock', 'flower']);
    expect(builds(a.ring)).not.toContain('plot');
  });

  it('puzzle grass has no land ring — a bare tap tills', () => {
    const a = actionsFor(tile({ kind: 'grass' }), PUZZLE);
    expect(a.primary?.kind).toBe('till');
    expect(a.ring).toEqual([]);
  });
});

describe('actionsFor — empty soil (plant + structures)', () => {
  it('Freeplay: ring is every crop plus the two structures', () => {
    const a = actionsFor(tile({ kind: 'tilled', crop: null }), FREE);
    expect(a.primary).toBeNull();
    expect(builds(a.ring)).toEqual(['carrot', 'potato', 'tomato', 'sprinkler', 'scarecrow']);
  });

  it('puzzle: a single taught crop promotes to a quick-tap plant (no 1-item radial)', () => {
    const a = actionsFor(tile({ kind: 'tilled', crop: null }), PUZZLE);
    expect(a.primary).toMatchObject({ kind: 'plant', build: 'carrot' });
    expect(a.ring).toEqual([]);
  });
});

describe('actionsFor — planted soil', () => {
  it('wilted crop offers Clear only', () => {
    const a = actionsFor(tile({ crop: 'carrot', wilted: true }), FREE);
    expect(a.primary?.kind).toBe('clear');
    expect(a.ring).toEqual([]);
  });

  it('ripe crop offers Harvest with an Uproot in the ring', () => {
    const a = actionsFor(tile({ crop: 'carrot', stage: 2 }), FREE);
    expect(a.primary?.kind).toBe('harvest');
    expect(kinds(a.ring)).toEqual(['uproot']);
  });

  it('growing crop defaults to Water (when dry); ring feeds/uproots + structures', () => {
    const a = actionsFor(tile({ crop: 'carrot', stage: 1 }), FREE);
    expect(a.primary?.kind).toBe('water');
    expect(kinds(a.ring)).toEqual(['fertilize', 'uproot', 'structure', 'structure']);
  });

  it('an already-watered crop has no default (ring still feeds/uproots)', () => {
    const a = actionsFor(tile({ crop: 'carrot', stage: 1, watered: true }), FREE);
    expect(a.primary).toBeNull();
    expect(kinds(a.ring)).toContain('fertilize');
  });

  it('sprinkler tile: no water default, no structure re-offer', () => {
    const a = actionsFor(tile({ crop: 'carrot', stage: 1, structure: 'sprinkler' }), FREE);
    expect(a.primary).toBeNull();
    expect(kinds(a.ring)).toEqual(['fertilize', 'uproot']);
  });

  it('puzzle growing crop: water default, ring has no feed or structures (allowFeed off)', () => {
    const a = actionsFor(tile({ crop: 'carrot', stage: 1 }), PUZZLE);
    expect(a.primary?.kind).toBe('water');
    expect(kinds(a.ring)).toEqual(['uproot']);
  });

  it('allowFeed gates Feed on a growing crop', () => {
    const dry = tile({ crop: 'carrot', stage: 1 });
    expect(kinds(actionsFor(dry, { ...FREE, allowFeed: false }).ring)).not.toContain('fertilize');
    expect(kinds(actionsFor(dry, { ...FREE, allowFeed: true }).ring)).toContain('fertilize');
  });

  it('water default is suppressed by a sprinkler on an orthogonal neighbour', () => {
    // growing carrot at (0,1); a sprinkler at (0,0) auto-waters it → no Water default.
    const crop = tile({ r: 0, c: 1, crop: 'carrot', stage: 1 });
    const sprinkler = tile({ r: 0, c: 0, crop: null, structure: 'sprinkler' });
    const a = actionsFor(crop, { ...FREE, tiles: [sprinkler, crop] });
    expect(a.primary).toBeNull();
  });
});

describe('ringAngle', () => {
  it('starts at the top and steps clockwise', () => {
    expect(ringAngle(0, 4)).toBeCloseTo(-Math.PI / 2);
    expect(ringAngle(1, 4)).toBeCloseTo(0);
    expect(ringAngle(2, 4)).toBeCloseTo(Math.PI / 2);
    expect(ringAngle(3, 4)).toBeCloseTo(Math.PI);
  });
});

describe('radialHiFor', () => {
  it('returns -1 inside the deadzone', () => {
    expect(radialHiFor(4, 0, 0)).toBe(-1);
    expect(radialHiFor(4, RADIAL_DEADZONE - 1, 0)).toBe(-1);
  });

  it('returns -1 when there are no ring slices', () => {
    expect(radialHiFor(0, 0, -RADIAL_RADIUS)).toBe(-1);
  });

  it('maps a drag to the nearest slice (top/right/bottom/left of a 4-ring)', () => {
    expect(radialHiFor(4, 0, -RADIAL_RADIUS)).toBe(0); // up → top
    expect(radialHiFor(4, RADIAL_RADIUS, 0)).toBe(1); // right
    expect(radialHiFor(4, 0, RADIAL_RADIUS)).toBe(2); // down
    expect(radialHiFor(4, -RADIAL_RADIUS, 0)).toBe(3); // left
  });

  it('handles wrap-around near the top for odd counts', () => {
    // 5 slices: index 0 sits at the top; a small left-of-up drag still snaps to it.
    expect(radialHiFor(5, -6, -RADIAL_RADIUS)).toBe(0);
  });
});
