// Little Acre — puzzle par validation harness.
// Run: node scripts/check-puzzle-pars.mjs [--strict]
//
// Locks each shipped puzzle's star tuning against EXACT optimal play (scripts/puzzle-solver.mjs
// searches every legal line, including same-day feed chains and fruit-holding). Two checks:
//   1. AUTHORED  — with fertilize disabled (the pre-feed design intent), optimal nights must
//      equal the 3★ threshold (par ≈ optimal: reachable, but only just). Hard failure.
//   2. AS-PLAYABLE — with fertilize available (the game as built today), reports how far
//      optimal play beats the 3★ threshold. WARN by default; failure with --strict.
//
// Puzzle defs are mirrored from src/lib/game/puzzles.ts (plain-node script can't import TS —
// same convention as little-acre-model.mjs). Keep in sync when editing PUZZLES.

import { solve, tiles } from './puzzle-solver.mjs';

const SHIPPED = [
  {
    id: 'first-sprout',
    board: tiles({ G: 9 }),
    coins: 30,
    energy: 16,
    builds: ['carrot'],
    target: 3,
    nightLimit: 4,
    stars: { three: 2, two: 3 },
  },
  {
    id: 'dry-spell',
    board: tiles({ E: 4, G: 5 }),
    coins: 40,
    energy: 16,
    builds: ['potato'],
    target: 4,
    nightLimit: 5,
    stars: { three: 3, two: 4 },
  },
  {
    id: 'vine-and-again',
    board: tiles({ E: 2, G: 7 }),
    coins: 40,
    energy: 16,
    builds: ['tomato'],
    target: 4,
    nightLimit: 9,
    stars: { three: 6, two: 7 },
  },
];

const strict = process.argv.includes('--strict');
let failed = false;

for (const p of SHIPPED) {
  const base = {
    tiles: p.board,
    coins: p.coins,
    energy: p.energy,
    builds: p.builds,
    target: p.target,
    maxNights: p.nightLimit,
  };
  const authored = solve({ ...base, allowFeed: false });
  const playable = solve({ ...base, allowFeed: true });

  const authoredOk = authored.minNights === p.stars.three;
  const playableOk = playable.minNights !== null && playable.minNights >= p.stars.three;

  if (!authoredOk) failed = true;
  if (!playableOk && strict) failed = true;

  console.log(
    `${p.id.padEnd(16)} authored(no-feed) optimal=${authored.minNights ?? 'infeasible'} ` +
      `vs 3★=${p.stars.three}  ${authoredOk ? 'OK' : 'FAIL'}`,
  );
  if (!playableOk) {
    console.log(
      `${''.padEnd(16)} as-playable(feed) optimal=${playable.minNights ?? 'infeasible'} ` +
        `— beats the 3★ threshold (${p.stars.three}). ${strict ? 'FAIL' : 'WARN: gate feed or retune stars.'}`,
    );
  }
}

process.exit(failed ? 1 : 0);
