import { describe, expect, it } from 'vitest';

import {
  cropPlural,
  getPuzzle,
  initPuzzleState,
  isPuzzleUnlocked,
  objectiveMatches,
  PUZZLES,
  registerHarvest,
  registerNight,
  starsFor,
  type PuzzleDef,
  type PuzzleState,
} from './puzzles';

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

describe('PUZZLES integrity', () => {
  it('has unique ids', () => {
    const ids = PUZZLES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('orders star thresholds three <= two <= nightLimit and needs positive counts', () => {
    for (const p of PUZZLES) {
      expect(p.stars.three).toBeLessThanOrEqual(p.stars.two);
      expect(p.stars.two).toBeLessThanOrEqual(p.nightLimit);
      expect(p.objective.count).toBeGreaterThan(0);
      expect(p.startEnergy).toBeGreaterThan(0);
      expect(p.builds.length).toBeGreaterThan(0);
    }
  });

  it('each objective crop is among the offered builds (or any)', () => {
    for (const p of PUZZLES) {
      if (p.objective.crop !== 'any') {
        expect(p.builds).toContain(p.objective.crop);
      }
    }
  });

  it('makeBoard yields a fresh, empty 9-tile board with the right tilled count', () => {
    const counts: Record<string, number> = {
      'first-sprout': 3,
      'dry-spell': 4,
      'vine-and-again': 2,
    };
    for (const p of PUZZLES) {
      const a = p.makeBoard();
      const b = p.makeBoard();
      expect(a).toHaveLength(9);
      expect(a).not.toBe(b); // fresh instance each call
      expect(a.every((t) => t.crop === null && t.stage === 0 && t.harvests === 0)).toBe(true);
      const tilled = a.filter((t) => t.kind === 'tilled').length;
      expect(tilled).toBe(counts[p.id]);
    }
  });

  it('getPuzzle resolves known ids and rejects unknown', () => {
    expect(getPuzzle('first-sprout')?.name).toBe('First Sprout');
    expect(getPuzzle('nope')).toBeUndefined();
  });
});

const DEF: PuzzleDef = {
  id: 'test',
  name: 'Test',
  blurb: '',
  objective: { kind: 'harvest', crop: 'carrot', count: 3 },
  nightLimit: 4,
  stars: { three: 2, two: 3 },
  startCoins: 30,
  startEnergy: 16,
  builds: ['carrot'],
  makeBoard: () => [],
};

describe('starsFor', () => {
  it('3★ at or under the three-star threshold', () => {
    expect(starsFor(DEF, 0)).toBe(3);
    expect(starsFor(DEF, 2)).toBe(3); // boundary
  });
  it('2★ between three and two thresholds', () => {
    expect(starsFor(DEF, 3)).toBe(2); // boundary
  });
  it('1★ past the two threshold (completed within the limit)', () => {
    expect(starsFor(DEF, 4)).toBe(1);
    expect(starsFor(DEF, 99)).toBe(1);
  });
});

describe('objectiveMatches', () => {
  it('matches the named crop and always matches "any"', () => {
    expect(objectiveMatches({ kind: 'harvest', crop: 'carrot', count: 1 }, 'carrot')).toBe(true);
    expect(objectiveMatches({ kind: 'harvest', crop: 'carrot', count: 1 }, 'potato')).toBe(false);
    expect(objectiveMatches({ kind: 'harvest', crop: 'any', count: 1 }, 'tomato')).toBe(true);
  });
});

describe('registerHarvest', () => {
  it('increments progress on a matching crop and wins at the count', () => {
    let s = initPuzzleState();
    s = registerHarvest(DEF, s, 'carrot');
    expect(s).toMatchObject({ progress: 1, status: 'playing' });
    s = registerHarvest(DEF, s, 'carrot');
    expect(s).toMatchObject({ progress: 2, status: 'playing' });
    s = registerHarvest(DEF, s, 'carrot');
    expect(s).toMatchObject({ progress: 3, status: 'won' });
  });

  it('ignores non-matching crops', () => {
    const s = registerHarvest(DEF, initPuzzleState(), 'potato');
    expect(s).toMatchObject({ progress: 0, status: 'playing' });
  });

  it('is a no-op once the puzzle is over', () => {
    const won = { progress: 3, nightsUsed: 2, status: 'won' as const };
    expect(registerHarvest(DEF, won, 'carrot')).toBe(won);
  });

  it('is pure — does not mutate the input state', () => {
    const s = initPuzzleState();
    registerHarvest(DEF, s, 'carrot');
    expect(s.progress).toBe(0);
  });
});

describe('registerNight', () => {
  it('counts nights and stays playing within the limit', () => {
    let s = initPuzzleState();
    s = registerNight(DEF, s);
    expect(s).toMatchObject({ nightsUsed: 1, status: 'playing' });
    s = registerNight(DEF, s);
    s = registerNight(DEF, s);
    s = registerNight(DEF, s);
    expect(s).toMatchObject({ nightsUsed: 4, status: 'playing' }); // == nightLimit, still ok
  });

  it('loses when the night count exceeds the limit', () => {
    let s: PuzzleState = { progress: 1, nightsUsed: 4, status: 'playing' };
    s = registerNight(DEF, s);
    expect(s).toMatchObject({ nightsUsed: 5, status: 'lost' });
  });

  it('does not overwrite a win reached on the final day', () => {
    const won = { progress: 3, nightsUsed: 2, status: 'won' as const };
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
});

/**
 * Feasibility guard: the tutorial timelines must reach 3★ at exactly the optimal night count
 * (par = optimal), so a threshold typo can't silently make a puzzle trivial or impossible.
 */
describe('tutorial 3★ pars match optimal-play nights', () => {
  it('first-sprout: carrot 2 nights', () => {
    expect(getPuzzle('first-sprout')!.stars.three).toBe(2);
  });
  it('dry-spell: potato 3 nights', () => {
    expect(getPuzzle('dry-spell')!.stars.three).toBe(3);
  });
  it('vine-and-again: tomato 4 + regrow 2 = 6 nights', () => {
    expect(getPuzzle('vine-and-again')!.stars.three).toBe(6);
  });
});
