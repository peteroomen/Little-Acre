// Little Acre — puzzle GOAL-TIER validation harness (v3, megaslice 2 / S1).
//
// Usage:
//   node scripts/check-puzzle-pars.mjs                 default: validate every shipped puzzle's
//                                                      goal-tier ladder + the OLD-rules regression
//                                                      (~1.5 min; exits 1 on any failure)
//   node scripts/check-puzzle-pars.mjs --strict        alias, kept for CI compat (default is strict)
//   node scripts/check-puzzle-pars.mjs --sweep-tomato  ALSO run the tomato regrow×reyield tuning
//                                                      sweep (slower; informational, never fails)
//
// Stars are GOAL-TIERED on the objective metric (harvest count / coins earned), not on nights:
// the objective count/amount is the 1★ base, and `stars.two` / `stars.three` are stretch progress
// targets. 3★ is the exact solver-proven MAXIMUM within the night limit. Per shipped puzzle, under
// its own verb rules (defs mirrored from src/lib/game/puzzles.ts — a plain node script can't import
// TS; keep in sync):
//   1. BASE FEASIBLE  — the 1★ base is reachable within nightLimit, with slack (for night puzzles,
//      at least one night to spare; the actual slack is printed). Accessibility guard.
//   2. LADDER         — base < two < three (a real, strictly-increasing ladder).
//   3. TIER2 FEASIBLE — the 2★ target is reachable within nightLimit (implied by TIER3 under the
//      monotone objective, but checked explicitly).
//   4. TIER3 == MAX   — the 3★ target is reachable within nightLimit AND three+1 is INFEASIBLE, so
//      3★ is exactly the optimal ceiling. This is where the optimization/knife-edge now lives.
// Regression path: with the OLD tomato numbers (reyield 3 / regrow 2) injected via the cropDefs
// override and feed off, the three tutorials' maxima are re-pinned (first-sprout 9, dry-spell 6,
// vine-and-again 4 — vs the new-tomato 8, the drop that proves the override path is live).
//
// waterworks NOTE: the solver models sprinkler-only (allowedStructures ['sprinkler']) for the tier
// checks — the game also offers a scarecrow, but a scarecrow only prevents wilt (no watering, no
// growth), so it can never raise a watering-throughput maximum. Modeling it would only slow the
// spatial BFS. The "no sprinkler" lesson check below keeps hand-watering pinned.
//
// --sweep-tomato (WS-A acceptance evidence): sweep tomato regrow ∈ {1,2} × reyield ∈ {3,4,5} on
//   (a) ENERGY-SCARCE — 6 tilled tiles, coins 40, target 12 any-crop, horizon 12 nights, at
//       E ∈ {4, 5, 6, 8}, tomato-only vs carrot-only;
//   (b) SPRINT — same board/coins, target 6, horizon 4 nights.
// Success criterion: some energy-scarce setting where tomato-only strictly beats carrot-only,
// while carrot-only stays strictly better in the sprint. The sweep prints per-config verdicts
// and whether the shipped {reyield 4, regrow 1} achieves the criterion.

import { solve, tiles, OLD_CROPS, DEFAULT_CROPS } from './puzzle-solver.mjs';

// ---- shipped puzzle defs (mirror of src/lib/game/puzzles.ts PUZZLES) -----------
// `base` is the objective count/amount (1★); `two`/`three` are the goal-tier progress targets.
// Boards mirror the src makeBoard layouts with flower fillers OMITTED — flowers offer no verb, so
// they don't exist to the solver. Grass IS modelled ('G' is tillable).
const SHIPPED = [
  {
    id: 'first-sprout',
    board: tiles({ G: 9 }),
    coins: 30,
    energy: 10,
    builds: ['carrot'],
    objectiveCrop: 'carrot',
    nightLimit: 4,
    allowFeed: false,
    base: 3,
    two: 6,
    three: 9,
  },
  {
    id: 'dry-spell',
    board: tiles({ E: 4, G: 5 }),
    coins: 40,
    energy: 16,
    builds: ['potato'],
    objectiveCrop: 'potato',
    nightLimit: 5,
    allowFeed: false,
    base: 4,
    two: 5,
    three: 6,
  },
  {
    // Two vine beds (flower borders → 2 solver tiles). Tomato re-yields 4 fruits, so 2 vines cap
    // at 8 — the exact 3★. The lesson is re-yield, not expansion; feed off keeps the ladder honest.
    id: 'vine-and-again',
    board: tiles({ E: 2 }),
    coins: 40,
    energy: 16,
    builds: ['tomato'],
    objectiveCrop: 'tomato',
    nightLimit: 7,
    allowFeed: false,
    base: 4,
    two: 6,
    three: 8,
  },
  {
    // 0-night feed-chain speedrun. All scoring on day 1 (End Day settles it). 13⚡ / 20c working
    // capital: base 2 is relaxed (fund one carrot, sell, fund the next); 4 is the same-day max.
    id: 'market-day',
    board: tiles({ G: 3 }),
    coins: 20,
    energy: 13,
    builds: ['carrot'],
    objectiveCrop: 'carrot',
    nightLimit: 0,
    allowFeed: true,
    base: 2,
    two: 3,
    three: 4,
  },
  {
    // Pre-grown triage: ripe vine (3 fruits left) + stage-1 potato at 1⚡/day. Ladder 2 / 3 / 4.
    // 4 (max) demands HOLDING the ripe fruit while the potato is watered nights 1–2; cashing the
    // vine early wilts the potato and caps at 3 (pinned in FEATURES).
    id: 'the-patient-vine',
    board: ['tomato:4:1', 'potato:1:0'],
    coins: 0,
    energy: 1,
    builds: [],
    objectiveCrop: 'any',
    nightLimit: 6,
    allowFeed: false,
    base: 2,
    two: 3,
    three: 4,
  },
  {
    // Bootstrap ladder: 4c = one carrot seed; its 20c sale bankrolls the potatoes. Ladder 3 / 5 / 6
    // potatoes (base 3 lands night 5, 3 nights of slack; 6 needs a second replant cycle). Potato-
    // only is infeasible (FEATURES) — the bootstrap is the lesson.
    id: 'seed-money',
    board: tiles({ E: 3 }),
    coins: 4,
    energy: 6,
    builds: ['carrot', 'potato'],
    objectiveCrop: 'potato',
    nightLimit: 8,
    allowFeed: false,
    base: 3,
    two: 5,
    three: 6,
  },
  {
    // Energy-scarce crop choice: 5⚡ throttles carrot's replant loop while a ripe vine costs 1⚡/
    // fruit — mixing is the lesson (carrot-only/tomato-only reach base 12 slower; FEATURES). Ladder
    // 12 / 17 / 22; base 12 lands night 7 (3 nights of slack), 22 is the exact 10-night max.
    id: 'thirsty-work',
    board: tiles({ E: 6 }),
    coins: 40,
    energy: 5,
    builds: ['carrot', 'tomato'],
    objectiveCrop: 'any',
    nightLimit: 10,
    allowFeed: false,
    base: 12,
    two: 17,
    three: 22,
  },
  {
    // Sprinkler placement: a centre sprinkler waters the whole plus, so the arms ripen hands-free.
    // Ladder 4 / 6 / 9 carrots (base 4 = one hands-free cycle at night 2; 9 = the exact 4-night max
    // cycling replants). Solver models sprinkler-only (see header NOTE).
    id: 'waterworks',
    board: [
      { r: 0, c: 1, base: 'E', struct: '' },
      { r: 1, c: 0, base: 'E', struct: '' },
      { r: 1, c: 1, base: 'E', struct: '' },
      { r: 1, c: 2, base: 'E', struct: '' },
      { r: 2, c: 1, base: 'E', struct: '' },
    ],
    coins: 76,
    energy: 5,
    builds: ['carrot'],
    allowedStructures: ['sprinkler'],
    objectiveCrop: 'carrot',
    nightLimit: 4,
    allowFeed: false,
    base: 4,
    two: 6,
    three: 9,
  },
];

const sweepMode = process.argv.includes('--sweep-tomato');
let failed = false;
const t0 = Date.now();

// Solve `p` for a given progress target within its night limit → minNights (null = infeasible).
function solveTarget(p, target) {
  return solve({
    tiles: p.board,
    coins: p.coins,
    energy: p.energy,
    builds: p.builds,
    objective: { kind: 'harvest', crop: p.objectiveCrop, count: target },
    allowFeed: p.allowFeed,
    allowedStructures: p.allowedStructures ?? [],
    maxNights: p.nightLimit,
  }).minNights;
}

// ---- goal-tier validation: base feasible+slack · ladder · tier2 feasible · tier3 == max --------
console.log('=== SHIPPED PUZZLES (goal-tier ladders, per-def verb gating) ===');
for (const p of SHIPPED) {
  const baseN = solveTarget(p, p.base);
  const twoN = solveTarget(p, p.two);
  const threeN = solveTarget(p, p.three);
  const overN = solveTarget(p, p.three + 1);

  const ladderOk = p.base < p.two && p.two < p.three;
  const baseFeasible = baseN !== null;
  // Slack: night puzzles want ≥1 night to spare; 0-night puzzles lean on energy/coin slack instead.
  const slack = baseFeasible && p.nightLimit > 0 ? p.nightLimit - baseN : null;
  const slackOk = p.nightLimit === 0 ? baseFeasible : baseFeasible && slack >= 1;
  const twoFeasible = twoN !== null;
  const threeIsMax = threeN !== null && overN === null;

  const ok = ladderOk && baseFeasible && slackOk && twoFeasible && threeIsMax;
  if (!ok) failed = true;

  const slackMsg =
    p.nightLimit === 0
      ? 'base@day1 (energy slack)'
      : baseFeasible
        ? `base@${baseN}n (slack ${slack})`
        : 'base INFEASIBLE';
  console.log(
    `${p.id.padEnd(16)} ${p.base}/${p.two}/${p.three}  ${slackMsg}  ` +
      `2★@${twoN ?? 'inf'}n  3★@${threeN ?? 'inf'}n max(${p.three + 1}=${overN ?? 'inf'})  ` +
      `${ok ? 'OK' : 'FAIL'}`,
  );
  if (!ladderOk) console.log(`${''.padEnd(16)} FAIL: ladder not strictly base<two<three`);
  if (!slackOk) console.log(`${''.padEnd(16)} FAIL: base lacks slack`);
  if (!twoFeasible) console.log(`${''.padEnd(16)} FAIL: 2★ target infeasible`);
  if (!threeIsMax)
    console.log(`${''.padEnd(16)} FAIL: 3★ is not the exact max (3★ ${threeN}, 3★+1 ${overN})`);
}

// ---- regression path: OLD tomato numbers re-pin the tutorial maxima -------------
// Exercises the cropDefs override path. Under old tomato (reyield 3 / regrow 2) the vine tutorial's
// max DROPS from 8 to 4 — the carrot/potato tutorials are unaffected (9 / 6), proving the override
// only bites the tomato math.
console.log('\n=== REGRESSION (old tomato reyield 3 / regrow 2, feed off) ===');
const OLD_MAX = { 'first-sprout': 9, 'dry-spell': 6, 'vine-and-again': 4 };
for (const p of SHIPPED) {
  if (!(p.id in OLD_MAX)) continue;
  const m = OLD_MAX[p.id];
  const at = solve({
    tiles: p.board,
    coins: p.coins,
    energy: p.energy,
    builds: p.builds,
    objective: { kind: 'harvest', crop: p.objectiveCrop, count: m },
    allowFeed: false,
    maxNights: p.nightLimit,
    cropDefs: OLD_CROPS,
  }).minNights;
  const over = solve({
    tiles: p.board,
    coins: p.coins,
    energy: p.energy,
    builds: p.builds,
    objective: { kind: 'harvest', crop: p.objectiveCrop, count: m + 1 },
    allowFeed: false,
    maxNights: p.nightLimit,
    cropDefs: OLD_CROPS,
  }).minNights;
  const ok = at !== null && over === null;
  if (!ok) failed = true;
  console.log(
    `${p.id.padEnd(16)} old-rules max=${m}: ${m}@${at ?? 'inf'}n, ${m + 1}=${over ?? 'inf'}  ${ok ? 'OK' : 'FAIL'}`,
  );
}

// ---- solver feature checks (pinned ground truth + per-puzzle lessons) -----------
console.log('\n=== SOLVER FEATURE CHECKS (spatial / pause / gathering / coin-earned / lessons) ===');
const plus = (struct) => [
  { r: 1, c: 1, base: 'E', struct },
  { r: 0, c: 1, base: 'E', struct: '' },
  { r: 2, c: 1, base: 'E', struct: '' },
  { r: 1, c: 0, base: 'E', struct: '' },
  { r: 1, c: 2, base: 'E', struct: '' },
];
const trio = (struct) => [
  { r: 0, c: 0, base: 'potato:2:0', struct: '' },
  { r: 0, c: 1, base: 'potato:2:0', struct: '' },
  { r: 0, c: 2, base: 'potato:2:0', struct },
];
const waterCells = [
  { r: 0, c: 1, base: 'E', struct: '' },
  { r: 1, c: 0, base: 'E', struct: '' },
  { r: 1, c: 1, base: 'E', struct: '' },
  { r: 1, c: 2, base: 'E', struct: '' },
  { r: 2, c: 1, base: 'E', struct: '' },
];
const FEATURES = [
  {
    // Centre sprinkler waters the whole plus every night → 4 carrots ripen hands-free by night 2.
    name: 'sprinkler plus-coverage (pre-placed)',
    expect: 2,
    cfg: {
      tiles: plus('sprinkler'),
      coins: 100,
      energy: 4,
      builds: ['carrot'],
      objective: { kind: 'harvest', crop: 'carrot', count: 4 },
      maxNights: 4,
      allowFeed: false,
    },
  },
  {
    // Same board without the sprinkler: watering by hand halves throughput — position matters.
    name: 'sprinkler removed → slower',
    expect: 4,
    cfg: {
      tiles: plus(''),
      coins: 100,
      energy: 4,
      builds: ['carrot'],
      objective: { kind: 'harvest', crop: 'carrot', count: 4 },
      maxNights: 4,
      allowFeed: false,
      spatial: true,
    },
  },
  {
    // 3 near-ripe potatoes but only 2⚡: the scarecrow tile PAUSES its unwatered crop (no wilt).
    name: 'scarecrow pause banks the 3rd potato',
    expect: 2,
    cfg: {
      tiles: trio('scarecrow'),
      coins: 0,
      energy: 2,
      builds: ['potato'],
      objective: { kind: 'harvest', crop: 'potato', count: 3 },
      maxNights: 3,
      allowFeed: false,
    },
  },
  {
    // Without the scarecrow the 3rd potato wilts and the objective is unreachable.
    name: 'no scarecrow → infeasible',
    expect: null,
    cfg: {
      tiles: trio(''),
      coins: 0,
      energy: 2,
      builds: ['potato'],
      objective: { kind: 'harvest', crop: 'potato', count: 3 },
      maxNights: 3,
      allowFeed: false,
      spatial: true,
    },
  },
  {
    // Deterministic gathering: 4 fish (72c) + 3 ore (39c) = 111c on day 0...
    name: 'pond+rock day-0 income 111c',
    expect: 0,
    cfg: {
      tiles: ['P:4', 'R:3:0'],
      coins: 0,
      energy: 16,
      builds: [],
      objective: { kind: 'coins', amount: 111 },
      maxNights: 3,
      allowFeed: false,
    },
  },
  {
    // ...and one coin more forces a night (pond refills +2; the rock is dormant).
    name: 'pond+rock 112c needs a night',
    expect: 1,
    cfg: {
      tiles: ['P:4', 'R:3:0'],
      coins: 0,
      energy: 16,
      builds: [],
      objective: { kind: 'coins', amount: 112 },
      maxNights: 3,
      allowFeed: false,
    },
  },
  {
    // Coin objectives track cumulative EARNED: spending the whole 4c bank on the seed doesn't
    // reduce progress; the 20c carrot sale completes it.
    name: 'coin progress = earned, not balance',
    expect: 2,
    cfg: {
      tiles: ['E'],
      coins: 4,
      energy: 16,
      builds: ['carrot'],
      objective: { kind: 'coins', amount: 20 },
      maxNights: 3,
      allowFeed: false,
    },
  },
  // ── per-puzzle lesson pins ───────────────────────────────────────────────────
  {
    // Patient Vine lesson: the vine alone caps at its 3 remaining fruits — reaching 4 (the 3★)
    // REQUIRES holding the ripe fruit while the potato ripens.
    name: 'patient-vine: vine alone caps at 3',
    expect: null,
    cfg: {
      tiles: ['tomato:4:1'],
      coins: 0,
      energy: 1,
      builds: [],
      objective: { kind: 'harvest', crop: 'any', count: 4 },
      maxNights: 8,
      allowFeed: false,
    },
  },
  {
    // Seed Money lesson: without the carrot ladder, 4c can't even buy a potato seed.
    name: 'seed-money: potato-only infeasible',
    expect: null,
    cfg: {
      tiles: tiles({ E: 3 }),
      coins: 4,
      energy: 6,
      builds: ['potato'],
      objective: { kind: 'harvest', crop: 'potato', count: 3 },
      maxNights: 8,
      allowFeed: false,
    },
  },
  {
    // Thirsty Work lesson (a): carrot-only reaches the base 12 two nights slower than the mixed 7.
    name: 'thirsty-work: carrot-only 12 takes 9',
    expect: 9,
    cfg: {
      tiles: tiles({ E: 6 }),
      coins: 40,
      energy: 5,
      builds: ['carrot'],
      objective: { kind: 'harvest', crop: 'any', count: 12 },
      maxNights: 10,
      allowFeed: false,
    },
  },
  {
    // Thirsty Work lesson (b): tomato-only reaches 12 in 8 — mixing (7) beats both mono-crops.
    name: 'thirsty-work: tomato-only 12 takes 8',
    expect: 8,
    cfg: {
      tiles: tiles({ E: 6 }),
      coins: 40,
      energy: 5,
      builds: ['tomato'],
      objective: { kind: 'harvest', crop: 'any', count: 12 },
      maxNights: 10,
      allowFeed: false,
    },
  },
  {
    // Waterworks lesson: no sprinkler ⇒ hand-watering at 5⚡ takes 4 nights to reach the base 4
    // (vs the hands-free 2) — the sprinkler is what makes the base accessible.
    name: 'waterworks: base 4 no-sprinkler takes 4',
    expect: 4,
    cfg: {
      tiles: waterCells,
      coins: 76,
      energy: 5,
      builds: ['carrot'],
      allowedStructures: [],
      spatial: true,
      objective: { kind: 'harvest', crop: 'carrot', count: 4 },
      maxNights: 4,
      allowFeed: false,
    },
  },
];
for (const f of FEATURES) {
  const got = solve(f.cfg).minNights;
  const ok = got === f.expect;
  if (!ok) failed = true;
  console.log(
    `${f.name.padEnd(40)} optimal=${got ?? 'infeasible'} expect=${f.expect ?? 'infeasible'}  ${ok ? 'OK' : 'FAIL'}`,
  );
}

// ---- optional: tomato tuning sweep ---------------------------------------------
if (sweepMode) {
  console.log('\n=== TOMATO SWEEP (regrow × reyield; 6 tilled tiles, coins 40, feed off) ===');
  const scarce = { count: 12, horizon: 12 };
  const sprint = { count: 6, horizon: 4 };
  const ENERGIES = [4, 5, 6, 8];

  const run = (builds, cropDefs, energy, scenario) =>
    solve({
      tiles: tiles({ E: 6 }),
      coins: 40,
      energy,
      builds,
      objective: { kind: 'harvest', crop: 'any', count: scenario.count },
      maxNights: scenario.horizon,
      allowFeed: false,
      cropDefs,
    });

  const fmt = (r) =>
    r.minNights !== null
      ? `${r.minNights}n`
      : `inf(best ${r.maxProgByNight[r.maxProgByNight.length - 1]})`;
  const beats = (a, b) => {
    if (a.minNights !== null && b.minNights !== null) return a.minNights < b.minNights;
    if (a.minNights !== null) return true;
    if (b.minNights !== null) return false;
    return (
      a.maxProgByNight[a.maxProgByNight.length - 1] > b.maxProgByNight[b.maxProgByNight.length - 1]
    );
  };

  const carrot = {};
  for (const E of ENERGIES) {
    carrot[E] = {
      scarce: run(['carrot'], DEFAULT_CROPS, E, scarce),
      sprint: run(['carrot'], DEFAULT_CROPS, E, sprint),
    };
    console.log(
      `carrot-only  E=${E}  scarce(12 in 12n): ${fmt(carrot[E].scarce)}   sprint(6 in 4n): ${fmt(carrot[E].sprint)}`,
    );
  }

  const verdicts = [];
  for (const regrow of [1, 2]) {
    for (const reyield of [3, 4, 5]) {
      const defs = { ...DEFAULT_CROPS, tomato: { ...DEFAULT_CROPS.tomato, regrow, reyield } };
      let scarceWin = null;
      let sprintCarrot = true;
      const parts = [];
      for (const E of ENERGIES) {
        const s = run(['tomato'], defs, E, scarce);
        const sp = run(['tomato'], defs, E, sprint);
        const winsScarce = beats(s, carrot[E].scarce);
        const carrotWinsSprint = beats(carrot[E].sprint, sp);
        if (winsScarce && scarceWin === null) scarceWin = E;
        if (!carrotWinsSprint) sprintCarrot = false;
        parts.push(
          `E=${E} scarce ${fmt(s)}${winsScarce ? '<' : '≥'}carrot ${fmt(carrot[E].scarce)}, ` +
            `sprint ${fmt(sp)} vs carrot ${fmt(carrot[E].sprint)}${carrotWinsSprint ? ' (carrot wins)' : ' (carrot NOT better)'}`,
        );
      }
      const ok = scarceWin !== null && sprintCarrot;
      verdicts.push({ regrow, reyield, ok, scarceWin });
      console.log(
        `tomato regrow=${regrow} reyield=${reyield}  ${ok ? `NICHE OK (scarce win at E=${scarceWin})` : 'no niche'}\n    ${parts.join('\n    ')}`,
      );
    }
  }
  const shipped = verdicts.find((v) => v.regrow === 1 && v.reyield === 4);
  console.log(
    `\nshipped {regrow 1, reyield 4}: ${
      shipped.ok
        ? `ACHIEVES the niche criterion (first strict scarce win at E=${shipped.scarceWin}; ` +
          `E=6/8 are structurally tied — see header)`
        : 'does NOT achieve the criterion'
    }`,
  );
}

console.log(
  `\n${failed ? 'FAILED' : 'all checks passed'} in ${((Date.now() - t0) / 1000).toFixed(1)}s`,
);
process.exit(failed ? 1 : 0);
