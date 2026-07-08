import { describe, expect, it } from 'vitest';

import {
  CROPS,
  createBoard,
  cropGrow,
  harvestPatch,
  harvestValue,
  isRipe,
  needsWater,
  resolveNight,
  visualStage,
  type Tile,
} from './tiles';

function tile(over: Partial<Tile> = {}): Tile {
  return {
    r: 0,
    c: 0,
    kind: 'tilled',
    crop: 'carrot',
    stage: 0,
    harvests: 0,
    watered: false,
    wilted: false,
    structure: null,
    ...over,
  };
}

describe('createBoard', () => {
  it('produces a deterministic 3×3 board', () => {
    const a = createBoard();
    const b = createBoard();
    expect(a).toHaveLength(9);
    expect(a).toEqual(b);
  });

  it('seeds a ready-to-harvest carrot (ripe at grow=2), a pond, a grass plot', () => {
    const board = createBoard();
    const at = (r: number, c: number) => board[r * 3 + c];
    expect(at(0, 1)).toMatchObject({ kind: 'tilled', crop: 'carrot', stage: 2, harvests: 0 });
    expect(isRipe(at(0, 1))).toBe(true);
    expect(at(2, 0).kind).toBe('pond');
    expect(at(2, 1).kind).toBe('grass');
  });
});

describe('harvestValue', () => {
  it('scales the base sell price by Bloom and rounds', () => {
    expect(harvestValue('carrot', 1)).toBe(CROPS.carrot.sell);
    expect(harvestValue('carrot', 1.4)).toBe(Math.round(20 * 1.4)); // 28
    expect(harvestValue('potato', 1.4)).toBe(Math.round(34 * 1.4)); // 48
    expect(harvestValue('tomato', 1)).toBe(18);
  });
});

describe('per-crop grow times', () => {
  it('each Tier-1 crop ripens on its own schedule', () => {
    expect(cropGrow('carrot')).toBe(2);
    expect(cropGrow('potato')).toBe(3);
    expect(cropGrow('tomato')).toBe(4);
  });

  it('isRipe checks the crop-specific grow threshold', () => {
    expect(isRipe(tile({ crop: 'carrot', stage: 2 }))).toBe(true);
    expect(isRipe(tile({ crop: 'carrot', stage: 1 }))).toBe(false);
    expect(isRipe(tile({ crop: 'potato', stage: 2 }))).toBe(false);
    expect(isRipe(tile({ crop: 'potato', stage: 3 }))).toBe(true);
    expect(isRipe(tile({ crop: 'tomato', stage: 4 }))).toBe(true);
    expect(isRipe(tile({ crop: 'carrot', stage: 2, wilted: true }))).toBe(false);
    expect(isRipe(tile({ crop: null, stage: 5 }))).toBe(false);
  });

  it('needs water while below its grow threshold, unwatered, unsprinklered', () => {
    expect(needsWater(tile({ crop: 'carrot', stage: 1 }))).toBe(true);
    expect(needsWater(tile({ crop: 'carrot', stage: 2 }))).toBe(false); // ripe
    expect(needsWater(tile({ crop: 'tomato', stage: 3 }))).toBe(true);
    expect(needsWater(tile({ crop: 'carrot', stage: 1, watered: true }))).toBe(false);
    expect(needsWater(tile({ crop: 'carrot', stage: 1, structure: 'sprinkler' }))).toBe(false);
  });
});

describe('visualStage', () => {
  it('maps growth onto the 4 sprite stages (0 sprout .. 3 ripe)', () => {
    expect(visualStage(tile({ crop: 'carrot', stage: 0 }))).toBe(0);
    expect(visualStage(tile({ crop: 'carrot', stage: 2 }))).toBe(3); // ripe
    expect(visualStage(tile({ crop: 'potato', stage: 1 }))).toBe(1);
    expect(visualStage(tile({ crop: 'potato', stage: 2 }))).toBe(2);
    expect(visualStage(tile({ crop: 'potato', stage: 3 }))).toBe(3);
    expect(visualStage(tile({ crop: null }))).toBe(0);
  });
});

describe('harvestPatch (re-yield)', () => {
  it('clears a single-harvest crop', () => {
    expect(harvestPatch(tile({ crop: 'carrot', stage: 2 }))).toMatchObject({
      crop: null,
      stage: 0,
      harvests: 0,
    });
  });

  it('re-ripens a tomato until its 3 harvests are spent, then clears', () => {
    // 1st reap → regrows to grow(4) - regrow(2) = stage 2, re-ripens in 2 nights
    const first = harvestPatch(tile({ crop: 'tomato', stage: 4, harvests: 0 }));
    expect(first).toMatchObject({ stage: 2, harvests: 1 });
    expect(first.crop).toBeUndefined(); // stays planted (no crop:null in the patch)

    // 2nd reap → still has one left
    const second = harvestPatch(tile({ crop: 'tomato', stage: 4, harvests: 1 }));
    expect(second).toMatchObject({ stage: 2, harvests: 2 });

    // 3rd reap → spent, tile clears
    const third = harvestPatch(tile({ crop: 'tomato', stage: 4, harvests: 2 }));
    expect(third).toMatchObject({ crop: null, stage: 0, harvests: 0 });
  });
});

describe('resolveNight', () => {
  it('advances a watered crop one stage and clears its watered flag', () => {
    const { tiles, grew, wilted } = resolveNight([
      tile({ crop: 'potato', stage: 1, watered: true }),
    ]);
    expect(tiles[0].stage).toBe(2);
    expect(tiles[0].watered).toBe(false);
    expect(grew).toBe(1);
    expect(wilted).toBe(0);
  });

  it('wilts an unwatered growing crop', () => {
    const { tiles, grew, wilted } = resolveNight([tile({ crop: 'potato', stage: 1 })]);
    expect(tiles[0].wilted).toBe(true);
    expect(tiles[0].stage).toBe(1);
    expect(grew).toBe(0);
    expect(wilted).toBe(1);
  });

  it('auto-waters (grows) a sprinkler tile even when unwatered', () => {
    const { tiles, grew } = resolveNight([
      tile({ crop: 'potato', stage: 0, structure: 'sprinkler' }),
    ]);
    expect(tiles[0].stage).toBe(1);
    expect(grew).toBe(1);
  });

  it('protects a scarecrow tile: survives but does not grow', () => {
    const { tiles, grew, wilted } = resolveNight([
      tile({ crop: 'potato', stage: 1, structure: 'scarecrow' }),
    ]);
    expect(tiles[0].wilted).toBe(false);
    expect(tiles[0].stage).toBe(1);
    expect(grew).toBe(0);
    expect(wilted).toBe(0);
  });

  it('does not advance a ripe crop past its grow threshold', () => {
    const { tiles, grew } = resolveNight([tile({ crop: 'carrot', stage: 2, watered: true })]);
    expect(tiles[0].stage).toBe(2);
    expect(grew).toBe(0);
  });

  it('is pure — the input board is not mutated', () => {
    const input = [tile({ crop: 'potato', stage: 1, watered: true })];
    resolveNight(input);
    expect(input[0].stage).toBe(1);
    expect(input[0].watered).toBe(true);
  });

  it('restocks a pond +2 fish, capped at 4', () => {
    expect(
      resolveNight([tile({ kind: 'pond', crop: null, pondStock: 0 })]).tiles[0].pondStock,
    ).toBe(2);
    expect(
      resolveNight([tile({ kind: 'pond', crop: null, pondStock: 3 })]).tiles[0].pondStock,
    ).toBe(4);
    expect(
      resolveNight([tile({ kind: 'pond', crop: null, pondStock: 4 })]).tiles[0].pondStock,
    ).toBe(4);
  });

  it('counts a dormant rock down and re-charges it at 0', () => {
    const step = (t: Tile) => resolveNight([t]).tiles[0];
    const t1 = step(tile({ kind: 'rock', crop: null, rockCharges: 0, rockDormant: 3 }));
    expect(t1).toMatchObject({ rockDormant: 2, rockCharges: 0 });
    const t2 = step(t1);
    expect(t2.rockDormant).toBe(1);
    const t3 = step(t2);
    expect(t3).toMatchObject({ rockDormant: 0, rockCharges: 3 });
    // A ready rock (dormant 0, charged) is untouched.
    expect(step(tile({ kind: 'rock', crop: null, rockCharges: 3, rockDormant: 0 }))).toMatchObject({
      rockCharges: 3,
      rockDormant: 0,
    });
  });
});

describe('createBoard gathering stock', () => {
  it('stocks the pond (4 fish) and the rock (3 charges, ready)', () => {
    const board = createBoard();
    const at = (r: number, c: number) => board[r * 3 + c];
    expect(at(2, 0)).toMatchObject({ kind: 'pond', pondStock: 4 });
    expect(at(0, 0)).toMatchObject({ kind: 'rock', rockCharges: 3, rockDormant: 0 });
  });
});
