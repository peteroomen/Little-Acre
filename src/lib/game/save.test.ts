import { describe, expect, it } from 'vitest';

import { parseSave, SAVE_VERSION, type SaveState } from './save';
import { createBoard } from './tiles';

function fullSave(): SaveState {
  return {
    version: SAVE_VERSION,
    coins: 500,
    gems: 9,
    day: 7,
    energy: 3,
    maxEnergy: 16,
    bloom: 2.2,
    board: createBoard(),
    upgrades: { energy: 2, fertilizer: 1 },
    seen: { carrot: 1 },
    savedAt: 1_700_000_000_000,
  };
}

describe('parseSave', () => {
  it('round-trips a well-formed save', () => {
    const s = fullSave();
    expect(parseSave(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });

  it('rejects non-object payloads', () => {
    expect(parseSave(null)).toBeNull();
    expect(parseSave('nope')).toBeNull();
    expect(parseSave(42)).toBeNull();
  });

  it('backfills missing / invalid fields with sensible defaults', () => {
    const parsed = parseSave({ coins: 12 });
    expect(parsed).not.toBeNull();
    expect(parsed!.coins).toBe(12);
    expect(parsed!.gems).toBe(3);
    expect(parsed!.day).toBe(1);
    expect(parsed!.maxEnergy).toBe(16);
    expect(parsed!.bloom).toBe(1.4);
    expect(parsed!.board).toHaveLength(9);
    expect(parsed!.upgrades).toEqual({ energy: 0, fertilizer: 0 });
    expect(parsed!.version).toBe(SAVE_VERSION);
  });

  it('replaces a malformed board with a fresh one', () => {
    const parsed = parseSave({ board: [{ bogus: true }] });
    expect(parsed!.board).toEqual(createBoard());
  });

  it('ignores NaN / non-finite numbers', () => {
    const parsed = parseSave({ coins: NaN, gems: Infinity });
    expect(parsed!.coins).toBe(220);
    expect(parsed!.gems).toBe(3);
  });

  it('normalises tiles: clears crops no longer in CROPS and backfills harvests (v1→v2)', () => {
    const board = createBoard().map((t) => ({ ...t }));
    // an old prototype crop that no longer exists, plus a tile missing the new `harvests` field
    (board[1] as unknown as { crop: string }).crop = 'wheat';
    delete (board[1] as Partial<{ harvests: number }>).harvests;
    const parsed = parseSave({ board });
    expect(parsed!.board[1].crop).toBeNull();
    expect(parsed!.board[1].stage).toBe(0);
    expect(parsed!.board[1].harvests).toBe(0);
    // a valid crop tile keeps its data and gains a defaulted harvests
    expect(parsed!.board[5].crop).toBe('tomato');
    expect(parsed!.board[5].harvests).toBe(0);
  });
});
