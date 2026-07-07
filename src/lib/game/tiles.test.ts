import { describe, expect, it } from 'vitest';

import {
  CROPS,
  createBoard,
  harvestValue,
  isRipe,
  needsWater,
  resolveNight,
  type Tile,
} from './tiles';

function tile(over: Partial<Tile> = {}): Tile {
  return {
    r: 0,
    c: 0,
    kind: 'tilled',
    crop: 'carrot',
    stage: 0,
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

  it('seeds the opening layout (a ripe carrot, a pond, a grass plot)', () => {
    const board = createBoard();
    const at = (r: number, c: number) => board[r * 3 + c];
    expect(at(0, 1)).toMatchObject({ kind: 'tilled', crop: 'carrot', stage: 3 });
    expect(at(2, 0).kind).toBe('pond');
    expect(at(2, 1).kind).toBe('grass');
  });
});

describe('harvestValue', () => {
  it('scales the base sell price by Bloom and rounds', () => {
    expect(harvestValue('carrot', 1)).toBe(CROPS.carrot.sell);
    expect(harvestValue('carrot', 1.4)).toBe(Math.round(14 * 1.4)); // 20
    expect(harvestValue('lettuce', 1.4)).toBe(Math.round(38 * 1.4)); // 53
  });
});

describe('isRipe / needsWater', () => {
  it('is ripe only at stage 3 with a live crop', () => {
    expect(isRipe(tile({ stage: 3 }))).toBe(true);
    expect(isRipe(tile({ stage: 2 }))).toBe(false);
    expect(isRipe(tile({ stage: 3, wilted: true }))).toBe(false);
    expect(isRipe(tile({ crop: null, stage: 3 }))).toBe(false);
  });

  it('needs water when growing, unwatered, and unsprinklered', () => {
    expect(needsWater(tile({ stage: 1 }))).toBe(true);
    expect(needsWater(tile({ stage: 1, watered: true }))).toBe(false);
    expect(needsWater(tile({ stage: 1, structure: 'sprinkler' }))).toBe(false);
    expect(needsWater(tile({ stage: 3 }))).toBe(false);
  });
});

describe('resolveNight', () => {
  it('advances a watered crop one stage and clears its watered flag', () => {
    const { tiles, grew, wilted } = resolveNight([tile({ stage: 1, watered: true })]);
    expect(tiles[0].stage).toBe(2);
    expect(tiles[0].watered).toBe(false);
    expect(grew).toBe(1);
    expect(wilted).toBe(0);
  });

  it('wilts an unwatered growing crop', () => {
    const { tiles, grew, wilted } = resolveNight([tile({ stage: 1, watered: false })]);
    expect(tiles[0].wilted).toBe(true);
    expect(tiles[0].stage).toBe(1);
    expect(grew).toBe(0);
    expect(wilted).toBe(1);
  });

  it('auto-waters (grows) a sprinkler tile even when unwatered', () => {
    const { tiles, grew } = resolveNight([tile({ stage: 0, structure: 'sprinkler' })]);
    expect(tiles[0].stage).toBe(1);
    expect(grew).toBe(1);
  });

  it('protects a scarecrow tile: survives but does not grow', () => {
    const { tiles, grew, wilted } = resolveNight([tile({ stage: 1, structure: 'scarecrow' })]);
    expect(tiles[0].wilted).toBe(false);
    expect(tiles[0].stage).toBe(1);
    expect(grew).toBe(0);
    expect(wilted).toBe(0);
  });

  it('does not advance a ripe crop past stage 3', () => {
    const { tiles, grew } = resolveNight([tile({ stage: 3, watered: true })]);
    expect(tiles[0].stage).toBe(3);
    expect(grew).toBe(0);
  });

  it('is pure — the input board is not mutated', () => {
    const input = [tile({ stage: 1, watered: true })];
    resolveNight(input);
    expect(input[0].stage).toBe(1);
    expect(input[0].watered).toBe(true);
  });
});
