import { describe, expect, it } from 'vitest';

import {
  boardFrom,
  cropPlural,
  getPuzzle,
  initPuzzleState,
  isPuzzleUnlocked,
  nextTier,
  objectiveLabel,
  objectiveMatches,
  objectiveNoun,
  objectiveTarget,
  PUZZLES,
  registerEarned,
  registerHarvest,
  registerNight,
  starsFor,
  tierTargets,
  type PuzzleDef,
  type PuzzleState,
} from './puzzles';
import { isRipe } from './tiles';

describe('cropPlural', () => {
  it('pluralises crop nouns correctly (o → es)', () => {
    expect(cropPlural('carrot', 3)).toBe('Carrots');
    expect(cropPlural('potato', 4)).toBe('Potatoes');
    expect(cropPlural('tomato', 2)).toBe('Tomatoes');
    expect(cropPlural('any', 5)).toBe('Crops');
  });
  it('stays singular at a count of 1', () => {
    expect(cropPlural('potato', 1)).toBe('Potato');
    expect(cropPlural('carrot', 1)).toBe('Carrot');
  });
});

describe('objective helpers', () => {
  it('objectiveTarget reads count for harvest and amount for coins', () => {
    expect(objectiveTarget({ kind: 'harvest', crop: 'carrot', count: 3 })).toBe(3);
    expect(objectiveTarget({ kind: 'coins', amount: 120 })).toBe(120);
  });
  it('objectiveLabel renders both kinds', () => {
    expect(objectiveLabel({ kind: 'harvest', crop: 'carrot', count: 3 })).toBe('Harvest 3 Carrots');
    expect(objectiveLabel({ kind: 'harvest', crop: 'any', count: 4 })).toBe('Harvest 4 Crops');
    expect(objectiveLabel({ kind: 'coins', amount: 120 })).toBe('Earn 120 Coins');
  });
});

describe('PUZZLES integrity', () => {
  it('has unique ids', () => {
    const ids = PUZZLES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('ships 3 tutorials followed by 5 challenges', () => {
    expect(PUZZLES).toHaveLength(8);
    expect(PUZZLES.slice(0, 3).every((p) => p.section === 'tutorial')).toBe(true);
    expect(PUZZLES.slice(3).every((p) => p.section === 'challenge')).toBe(true);
  });

  it('orders goal tiers strictly base < two < three with positive targets/energy', () => {
    for (const p of PUZZLES) {
      const base = objectiveTarget(p.objective);
      expect(base).toBeGreaterThan(0);
      expect(base).toBeLessThan(p.stars.two);
      expect(p.stars.two).toBeLessThan(p.stars.three);
      expect(p.startEnergy).toBeGreaterThan(0);
    }
  });

  it('offers each harvest objective a source: the crop is in builds or pre-grown on the board', () => {
    for (const p of PUZZLES) {
      if (p.objective.kind !== 'harvest') continue;
      const board = p.makeBoard();
      const grown = (crop: string) => board.some((t) => t.crop === crop);
      if (p.objective.crop === 'any') {
        expect(p.builds.length > 0 || board.some((t) => t.crop !== null)).toBe(true);
      } else {
        expect(p.builds.includes(p.objective.crop) || grown(p.objective.crop)).toBe(true);
      }
    }
  });

  it('makeBoard yields a fresh 9-tile board each call', () => {
    for (const p of PUZZLES) {
      const a = p.makeBoard();
      const b = p.makeBoard();
      expect(a).toHaveLength(9);
      expect(a).not.toBe(b); // fresh instance each call
    }
  });

  it('tutorial boards start empty with the authored tilled counts', () => {
    const counts: Record<string, number> = {
      'first-sprout': 0,
      'dry-spell': 4,
      'vine-and-again': 2,
    };
    for (const p of PUZZLES.filter((q) => q.section === 'tutorial')) {
      const board = p.makeBoard();
      expect(board.every((t) => t.crop === null && t.stage === 0 && t.harvests === 0)).toBe(true);
      expect(board.filter((t) => t.kind === 'tilled').length).toBe(counts[p.id]);
    }
  });

  it('First Sprout is all wild grass (Till comes first)', () => {
    const board = getPuzzle('first-sprout')!.makeBoard();
    expect(board.every((t) => t.kind === 'grass')).toBe(true);
  });

  it('getPuzzle resolves known ids and rejects unknown', () => {
    expect(getPuzzle('first-sprout')?.name).toBe('First Sprout');
    expect(getPuzzle('nope')).toBeUndefined();
  });
});

describe('boardFrom (rich board authoring)', () => {
  it('parses pre-grown crops with stage + harvests (ripe tomato expressible)', () => {
    const board = boardFrom([
      ['flower', 'tilled:tomato:4:1', 'flower'],
      ['flower', 'flower', 'flower'],
      ['flower', 'tilled:potato:1', 'flower'],
    ]);
    expect(board).toHaveLength(9);
    const vine = board[1];
    expect(vine).toMatchObject({ kind: 'tilled', crop: 'tomato', stage: 4, harvests: 1 });
    expect(isRipe(vine)).toBe(true);
    expect(board[7]).toMatchObject({ kind: 'tilled', crop: 'potato', stage: 1, harvests: 0 });
    expect(board.filter((t) => t.kind === 'flower')).toHaveLength(7);
  });

  it('parses pond stock and rock charges/dormancy, with stocked defaults', () => {
    const board = boardFrom([
      ['pond', 'pond:2', 'rock'],
      ['rock:1:2', 'grass', 'tilled'],
      ['flower', 'flower', 'flower'],
    ]);
    expect(board[0]).toMatchObject({ kind: 'pond', pondStock: 4 });
    expect(board[1]).toMatchObject({ kind: 'pond', pondStock: 2 });
    expect(board[2]).toMatchObject({ kind: 'rock', rockCharges: 3, rockDormant: 0 });
    expect(board[3]).toMatchObject({ kind: 'rock', rockCharges: 1, rockDormant: 2 });
    expect(board[4]).toMatchObject({ kind: 'grass', crop: null });
    expect(board[5]).toMatchObject({ kind: 'tilled', crop: null, stage: 0 });
  });

  it('assigns row/col coordinates in board order', () => {
    const board = boardFrom([
      ['grass', 'grass', 'grass'],
      ['grass', 'grass', 'grass'],
      ['grass', 'grass', 'grass'],
    ]);
    expect(board[0]).toMatchObject({ r: 0, c: 0 });
    expect(board[5]).toMatchObject({ r: 1, c: 2 });
    expect(board[8]).toMatchObject({ r: 2, c: 2 });
  });

  it('the-patient-vine board carries a ripe vine with one harvest spent', () => {
    const board = getPuzzle('the-patient-vine')!.makeBoard();
    const vine = board.find((t) => t.crop === 'tomato')!;
    expect(vine.stage).toBe(4);
    expect(vine.harvests).toBe(1);
    expect(isRipe(vine)).toBe(true);
  });
});

// base = 3 (objective count); goal tiers two:5, three:8.
const DEF: PuzzleDef = {
  id: 'test',
  name: 'Test',
  section: 'tutorial',
  blurb: '',
  objective: { kind: 'harvest', crop: 'carrot', count: 3 },
  nightLimit: 4,
  stars: { two: 5, three: 8 },
  startCoins: 30,
  startEnergy: 16,
  builds: ['carrot'],
  makeBoard: () => [],
};

// base = 50 (objective amount); goal tiers two:70, three:100.
const COIN_DEF: PuzzleDef = {
  ...DEF,
  id: 'test-coins',
  objective: { kind: 'coins', amount: 50 },
  stars: { two: 70, three: 100 },
};

describe('starsFor (goal-tier progress)', () => {
  it('0 below the 1★ base', () => {
    expect(starsFor(DEF, 0)).toBe(0);
    expect(starsFor(DEF, 2)).toBe(0);
  });
  it('1★ from base up to the 2★ target', () => {
    expect(starsFor(DEF, 3)).toBe(1); // base boundary
    expect(starsFor(DEF, 4)).toBe(1);
  });
  it('2★ from the 2★ target up to the 3★ target', () => {
    expect(starsFor(DEF, 5)).toBe(2); // two boundary
    expect(starsFor(DEF, 7)).toBe(2);
  });
  it('3★ at or beyond the 3★ target', () => {
    expect(starsFor(DEF, 8)).toBe(3); // three boundary
    expect(starsFor(DEF, 99)).toBe(3);
  });
  it('reads coin progress on the same tiers', () => {
    expect(starsFor(COIN_DEF, 49)).toBe(0);
    expect(starsFor(COIN_DEF, 50)).toBe(1);
    expect(starsFor(COIN_DEF, 70)).toBe(2);
    expect(starsFor(COIN_DEF, 100)).toBe(3);
  });
});

describe('tier helpers', () => {
  it('objectiveNoun gives the bare metric noun', () => {
    expect(objectiveNoun(DEF.objective)).toBe('Carrots');
    expect(objectiveNoun({ kind: 'harvest', crop: 'any', count: 4 })).toBe('Crops');
    expect(objectiveNoun({ kind: 'coins', amount: 50 })).toBe('Coins');
  });
  it('tierTargets lists [base, two, three] ascending', () => {
    expect(tierTargets(DEF)).toEqual([3, 5, 8]);
    expect(tierTargets(COIN_DEF)).toEqual([50, 70, 100]);
  });
  it('nextTier climbs from base → two → three, then pins at three', () => {
    expect(nextTier(DEF, 0)).toEqual({ stars: 1, target: 3 });
    expect(nextTier(DEF, 3)).toEqual({ stars: 2, target: 5 });
    expect(nextTier(DEF, 5)).toEqual({ stars: 3, target: 8 });
    expect(nextTier(DEF, 8)).toEqual({ stars: 3, target: 8 });
  });
});

describe('objectiveMatches', () => {
  it('matches the named crop and always matches "any"', () => {
    expect(objectiveMatches({ kind: 'harvest', crop: 'carrot', count: 1 }, 'carrot')).toBe(true);
    expect(objectiveMatches({ kind: 'harvest', crop: 'carrot', count: 1 }, 'potato')).toBe(false);
    expect(objectiveMatches({ kind: 'harvest', crop: 'any', count: 1 }, 'tomato')).toBe(true);
  });
  it('never matches a coin objective (coins advance via registerEarned)', () => {
    expect(objectiveMatches({ kind: 'coins', amount: 50 }, 'carrot')).toBe(false);
  });
});

describe('registerHarvest', () => {
  it('increments progress on a matching crop and stays playing below the 3★ target', () => {
    let s = initPuzzleState();
    s = registerHarvest(DEF, s, 'carrot');
    expect(s).toMatchObject({ progress: 1, status: 'playing' });
    s = registerHarvest(DEF, s, 'carrot');
    s = registerHarvest(DEF, s, 'carrot'); // progress 3 = base (1★) but NOT a win yet
    expect(s).toMatchObject({ progress: 3, status: 'playing' });
  });

  it('wins instantly the moment the 3★ target is cleared', () => {
    const s = registerHarvest(DEF, { progress: 7, nightsUsed: 1, status: 'playing' }, 'carrot');
    expect(s).toMatchObject({ progress: 8, status: 'won' });
  });

  it('ignores non-matching crops', () => {
    const s = registerHarvest(DEF, initPuzzleState(), 'potato');
    expect(s).toMatchObject({ progress: 0, status: 'playing' });
  });

  it('is a no-op for a coin objective', () => {
    const s = initPuzzleState();
    expect(registerHarvest(COIN_DEF, s, 'carrot')).toBe(s);
  });

  it('is a no-op once the puzzle is over', () => {
    const won = { progress: 8, nightsUsed: 2, status: 'won' as const };
    expect(registerHarvest(DEF, won, 'carrot')).toBe(won);
  });

  it('is pure — does not mutate the input state', () => {
    const s = initPuzzleState();
    registerHarvest(DEF, s, 'carrot');
    expect(s.progress).toBe(0);
  });
});

describe('registerEarned', () => {
  it('accumulates earned coins and stays playing below the 3★ target', () => {
    let s = initPuzzleState();
    s = registerEarned(COIN_DEF, s, 20);
    expect(s).toMatchObject({ progress: 20, status: 'playing' });
    s = registerEarned(COIN_DEF, s, 55); // progress 75 (past 2★ 70, below 3★ 100)
    expect(s).toMatchObject({ progress: 75, status: 'playing' });
  });

  it('wins the moment the 3★ target is cleared', () => {
    const s = registerEarned(COIN_DEF, { progress: 90, nightsUsed: 1, status: 'playing' }, 20);
    expect(s).toMatchObject({ progress: 110, status: 'won' });
  });

  it('only ever adds — spending cannot reduce progress (non-positive amounts are no-ops)', () => {
    const s: PuzzleState = { progress: 30, nightsUsed: 0, status: 'playing' };
    expect(registerEarned(COIN_DEF, s, 0)).toBe(s);
    expect(registerEarned(COIN_DEF, s, -12)).toBe(s);
  });

  it('is a no-op for a harvest objective', () => {
    const s = initPuzzleState();
    expect(registerEarned(DEF, s, 20)).toBe(s);
  });

  it('is a no-op once the puzzle is over', () => {
    const lost = { progress: 10, nightsUsed: 5, status: 'lost' as const };
    expect(registerEarned(COIN_DEF, lost, 20)).toBe(lost);
  });

  it('is pure — does not mutate the input state', () => {
    const s = initPuzzleState();
    registerEarned(COIN_DEF, s, 20);
    expect(s.progress).toBe(0);
  });
});

describe('registerNight (deadline scoring)', () => {
  it('counts nights and stays playing before the deadline', () => {
    let s = initPuzzleState();
    s = registerNight(DEF, s);
    expect(s).toMatchObject({ nightsUsed: 1, status: 'playing' });
    s = registerNight(DEF, s);
    s = registerNight(DEF, s);
    s = registerNight(DEF, s);
    expect(s).toMatchObject({ nightsUsed: 4, status: 'playing' }); // == nightLimit, still ok
  });

  it('at the deadline, scores a win when progress cleared the base', () => {
    // progress 4 = 1★ tier; the deadline (nightsUsed 5 > limit 4) settles it as a win.
    const s = registerNight(DEF, { progress: 4, nightsUsed: 4, status: 'playing' });
    expect(s).toMatchObject({ nightsUsed: 5, status: 'won' });
  });

  it('at the deadline, scores a win at whatever tier progress reached (2★ here)', () => {
    const s = registerNight(DEF, { progress: 6, nightsUsed: 4, status: 'playing' });
    expect(s).toMatchObject({ nightsUsed: 5, status: 'won' });
    expect(starsFor(DEF, s.progress)).toBe(2);
  });

  it('loses at the deadline when progress is below the base', () => {
    const s = registerNight(DEF, { progress: 2, nightsUsed: 4, status: 'playing' });
    expect(s).toMatchObject({ nightsUsed: 5, status: 'lost' });
  });

  it('nightLimit 0 ("End Day"): scores immediately — base met ⇒ win', () => {
    const zeroDay: PuzzleDef = { ...DEF, nightLimit: 0 };
    const win = registerNight(zeroDay, { progress: 3, nightsUsed: 0, status: 'playing' });
    expect(win).toMatchObject({ nightsUsed: 1, status: 'won' });
    const loss = registerNight(zeroDay, initPuzzleState());
    expect(loss).toMatchObject({ nightsUsed: 1, status: 'lost' });
  });

  it('does not overwrite an instant 3★ win reached during the day', () => {
    const won = { progress: 8, nightsUsed: 2, status: 'won' as const };
    expect(registerNight(DEF, won)).toBe(won);
  });
});

describe('isPuzzleUnlocked', () => {
  it('always unlocks the first puzzle', () => {
    expect(isPuzzleUnlocked(0, {})).toBe(true);
  });

  it('unlocks puzzle N only once N-1 has at least one star', () => {
    expect(isPuzzleUnlocked(1, {})).toBe(false);
    expect(isPuzzleUnlocked(1, { [PUZZLES[0].id]: 0 })).toBe(false);
    expect(isPuzzleUnlocked(1, { [PUZZLES[0].id]: 1 })).toBe(true);
    expect(isPuzzleUnlocked(2, { [PUZZLES[0].id]: 3 })).toBe(false);
    expect(isPuzzleUnlocked(2, { [PUZZLES[1].id]: 2 })).toBe(true);
  });

  it('chains sequentially across all 8 puzzles (challenges continue after tutorials)', () => {
    const stars: Record<string, number> = {};
    for (let i = 1; i < PUZZLES.length; i++) {
      expect(isPuzzleUnlocked(i, stars)).toBe(false);
      stars[PUZZLES[i - 1].id] = 1;
      expect(isPuzzleUnlocked(i, stars)).toBe(true);
    }
  });
});

/**
 * Goal-tier guard: pin every puzzle's [base, 2★, 3★] progress ladder. 3★ is the exact
 * solver-proven maximum within the night limit — the authoritative check is
 * scripts/check-puzzle-pars.mjs (run it after any def change); these pins mirror its results so a
 * threshold typo can't silently make a tier trivial, impossible, or out of order.
 */
describe('goal-tier ladders match the solver-verified maxima', () => {
  const LADDERS: Record<string, [number, number, number]> = {
    'first-sprout': [3, 6, 9],
    'dry-spell': [4, 5, 6],
    'vine-and-again': [4, 6, 8],
    'market-day': [2, 3, 4],
    'the-patient-vine': [2, 3, 4],
    'seed-money': [3, 5, 6],
    'thirsty-work': [12, 17, 22],
    waterworks: [4, 6, 9],
  };
  for (const [id, [base, two, three]] of Object.entries(LADDERS)) {
    it(`${id}: ${base} / ${two} / ${three}`, () => {
      const def = getPuzzle(id)!;
      expect(objectiveTarget(def.objective)).toBe(base);
      expect(def.stars.two).toBe(two);
      expect(def.stars.three).toBe(three);
    });
  }
});
