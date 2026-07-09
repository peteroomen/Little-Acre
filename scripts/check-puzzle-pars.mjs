// Little Acre — puzzle par validation harness (v2, megaslice Wave 1).
//
// Usage:
//   node scripts/check-puzzle-pars.mjs                 default: validate every shipped puzzle
//                                                      def + the OLD-rules regression path
//                                                      (< ~2 min; exits 1 on any failure)
//   node scripts/check-puzzle-pars.mjs --strict        same checks (kept for CI compat; the
//                                                      default is already strict)
//   node scripts/check-puzzle-pars.mjs --sweep-tomato  ALSO run the tomato regrow×reyield tuning
//                                                      sweep (slower; informational, never fails)
//
// Default-run checks, per shipped puzzle (defs mirrored from src/lib/game/puzzles.ts — a plain
// node script can't import TS, same convention as little-acre-model.mjs; keep in sync):
//   1. PAR      — under the puzzle's own verb rules (allowFeed from the def; tutorials are OFF
//      post-Wave-1), exact optimal nights must equal the recommended 3★ threshold.
//   2. KNIFE-EDGE — the same scenario capped at 3★−1 nights must be INFEASIBLE. Any puzzle where
//      it is feasible has slack (optimal beats par) and fails.
//   3. SYNC     — when the recommendation differs from what src currently carries (vine-and-again
//      after the tomato retune), print the stars integration must apply.
// Regression path: with the OLD tomato numbers (reyield 3 / regrow 2) injected via the cropDefs
// override and feed off, the three tutorials must still solve to their original pars 2/3/6 —
// this pins the solver itself against ground truth that predates the retune.
//
// --sweep-tomato (WS-A acceptance evidence): sweep tomato regrow ∈ {1,2} × reyield ∈ {3,4,5} on
//   (a) ENERGY-SCARCE — 6 tilled tiles, coins 40, target 12 any-crop, horizon 12 nights, at
//       E ∈ {4, 5, 6, 8}, tomato-only vs carrot-only;
//   (b) SPRINT — same board/coins, target 6, horizon 4 nights.
// Success criterion: some energy-scarce setting where tomato-only strictly beats carrot-only,
// while carrot-only stays strictly better in the sprint. The sweep prints per-config verdicts
// and whether the shipped {reyield 4, regrow 1} achieves the criterion.
//
// Known structural result (why E ∈ {4,5} is in the grid): at E=6/coins 40 NO tomato tuning can
// strictly win — tomato's first fruit lands night 4 (grow 4, feed off) and 40c affords only 3
// vines before the first sale, so 12 harvests can't complete before night 7... which carrot also
// achieves. The tie only breaks when energy drops far enough to throttle carrot's replant loop
// (E ≤ 5): carrot needs 3⚡/harvest sustained, a ripe vine only 1⚡.

import { solve, tiles, OLD_CROPS, DEFAULT_CROPS } from './puzzle-solver.mjs';

// ---- shipped puzzle defs (mirror of src/lib/game/puzzles.ts PUZZLES) -----------
// `stars` is the recommendation this harness validates; `srcStars` is what the src def carries
// today. They differ only while a retune is pending integration.
const SHIPPED = [
  {
    id: 'first-sprout',
    board: tiles({ G: 9 }),
    coins: 30,
    energy: 16,
    builds: ['carrot'],
    objective: { kind: 'harvest', crop: 'carrot', count: 3 },
    nightLimit: 4,
    allowFeed: false,
    srcStars: { three: 2, two: 3 },
    stars: { three: 2, two: 3 },
  },
  {
    id: 'dry-spell',
    board: tiles({ E: 4, G: 5 }),
    coins: 40,
    energy: 16,
    builds: ['potato'],
    objective: { kind: 'harvest', crop: 'potato', count: 4 },
    nightLimit: 5,
    allowFeed: false,
    srcStars: { three: 3, two: 4 },
    stars: { three: 3, two: 4 },
  },
  {
    id: 'vine-and-again',
    board: tiles({ E: 2, G: 7 }),
    coins: 40,
    energy: 16,
    builds: ['tomato'],
    objective: { kind: 'harvest', crop: 'tomato', count: 4 },
    nightLimit: 9,
    allowFeed: false,
    // Tomato retune (reyield 4 / regrow 1) shortens the optimal line: coins 40 afford only 3
    // vines (3×12c), so par is 4 watered nights to first ripe + 1 regrow night for the 4th
    // fruit = 5. Applied to src/lib/game/puzzles.ts at Wave-1 integration.
    srcStars: { three: 5, two: 6 },
    stars: { three: 5, two: 6 },
  },
  // ── challenge puzzles (megaslice Wave 2 / WS-B). Boards mirror the src makeBoard layouts with
  // flower fillers OMITTED — flowers offer no verb, so they don't exist to the solver. Grass IS
  // modelled ('G' is tillable). allowedStructures mirrors the def's allowStructures flag, which
  // in-game gates BOTH sprinkler and scarecrow. ─────────────────────────────────
  {
    // 0-night feed-chain speedrun: till→plant→feed×2→harvest→(plant→feed×2→harvest)×2 on one
    // tile = 10⚡ / 20c working capital. The 0-night knife-edge has no night to shave, so the
    // resource knife (9⚡ / 19c infeasible) is pinned in FEATURES below.
    id: 'market-day',
    board: tiles({ G: 3 }),
    coins: 20,
    energy: 10,
    builds: ['carrot'],
    objective: { kind: 'harvest', crop: 'carrot', count: 3 },
    nightLimit: 0,
    allowFeed: true,
    srcStars: { three: 0, two: 0 },
    stars: { three: 0, two: 0 },
  },
  {
    // Pre-grown triage: ripe vine (3 fruits left) + stage-1 potato at 1⚡/day. The potato must
    // be watered nights 1–2 while the ripe fruit HOLDS; par 4. Harvesting the vine immediately
    // caps the board at 3 (pinned in FEATURES: the vine alone can't reach 4).
    id: 'the-patient-vine',
    board: ['tomato:4:1', 'potato:1:0'],
    coins: 0,
    energy: 1,
    builds: [],
    objective: { kind: 'harvest', crop: 'any', count: 4 },
    nightLimit: 6,
    allowFeed: false,
    srcStars: { three: 4, two: 5 },
    stars: { three: 4, two: 5 },
  },
  {
    // Bootstrap ladder: 4c = one carrot seed; its 20c sale (night 2) funds all 3 potato seeds,
    // which ripen 3 nights later ⇒ par 5. Potato-only is infeasible (FEATURES) — the lesson.
    id: 'seed-money',
    board: tiles({ E: 3 }),
    coins: 4,
    energy: 6,
    builds: ['carrot', 'potato'],
    objective: { kind: 'harvest', crop: 'potato', count: 3 },
    nightLimit: 7,
    allowFeed: false,
    srcStars: { three: 5, two: 6 },
    stars: { three: 5, two: 6 },
  },
  {
    // Energy-scarce crop choice: 5⚡ throttles carrot's replant loop (3⚡/harvest sustained) while
    // a ripe vine costs 1⚡/fruit. Mixed carrot+tomato par 7; carrot-only 9 and tomato-only 8 are
    // pinned in FEATURES. (The Wave-1 sweep's "optimal 8" was tomato-ONLY — mixing beats it.)
    id: 'thirsty-work',
    board: tiles({ E: 6 }),
    coins: 40,
    energy: 5,
    builds: ['carrot', 'tomato'],
    objective: { kind: 'harvest', crop: 'any', count: 12 },
    nightLimit: 10,
    allowFeed: false,
    srcStars: { three: 7, two: 8 },
    stars: { three: 7, two: 8 },
  },
  {
    // Sprinkler placement: 76c = one sprinkler (60c) + 4 carrot seeds exactly; 5⚡ = place + plant
    // 4. Centre placement covers the whole plus ⇒ par 2. Hand-watering (no sprinkler), 75c, and
    // 4⚡ are all pinned in FEATURES. Scarecrow is placeable too (allowStructures gates both) —
    // it can't beat the sprinkler line, and the par run proves it.
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
    allowedStructures: ['sprinkler', 'scarecrow'],
    objective: { kind: 'harvest', crop: 'carrot', count: 4 },
    nightLimit: 4,
    allowFeed: false,
    srcStars: { three: 2, two: 3 },
    stars: { three: 2, two: 3 },
  },
];

const sweepMode = process.argv.includes('--sweep-tomato');
let failed = false;
const t0 = Date.now();

// ---- 1..3: validate every shipped def under its own verb rules -----------------
console.log('=== SHIPPED PUZZLES (current rules, per-def verb gating) ===');
for (const p of SHIPPED) {
  const base = {
    tiles: p.board,
    coins: p.coins,
    energy: p.energy,
    builds: p.builds,
    objective: p.objective,
    allowFeed: p.allowFeed,
    allowedStructures: p.allowedStructures ?? [],
  };
  const par = solve({ ...base, maxNights: p.nightLimit }).minNights;
  const parOk = par === p.stars.three;
  // Knife-edge: one fewer night than the 3★ threshold must be impossible. Feasibility here
  // means the puzzle has slack — optimal play beats the authored par.
  const knife =
    p.stars.three === 0 ? null : solve({ ...base, maxNights: p.stars.three - 1 }).minNights;
  const knifeOk = knife === null;
  if (!parOk || !knifeOk) failed = true;

  const knifeMsg =
    p.stars.three === 0
      ? 'skipped (0-night par — resource knives pinned in FEATURES)'
      : `knife-edge(${p.stars.three - 1}n)=${knifeOk ? 'infeasible OK' : `FEASIBLE (slack!) FAIL`}`;
  console.log(
    `${p.id.padEnd(16)} optimal=${par ?? 'infeasible'} vs 3★=${p.stars.three}  ${parOk ? 'OK' : 'FAIL'}   ${knifeMsg}`,
  );
  if (p.stars.three !== p.srcStars.three || p.stars.two !== p.srcStars.two) {
    console.log(
      `${''.padEnd(16)} SYNC: src carries {three:${p.srcStars.three}, two:${p.srcStars.two}} — ` +
        `update to {three:${p.stars.three}, two:${p.stars.two}} at integration.`,
    );
  }
}

// ---- regression path: OLD tomato numbers must reproduce the original pars ------
console.log('\n=== REGRESSION (old tomato reyield 3 / regrow 2, feed off) ===');
// Only the three tutorials predate the retune — the Wave-2 challenges have no old-rules par.
const OLD_PARS = { 'first-sprout': 2, 'dry-spell': 3, 'vine-and-again': 6 };
for (const p of SHIPPED) {
  if (!(p.id in OLD_PARS)) continue;
  const par = solve({
    tiles: p.board,
    coins: p.coins,
    energy: p.energy,
    builds: p.builds,
    objective: p.objective,
    allowFeed: false,
    maxNights: p.nightLimit,
    cropDefs: OLD_CROPS,
  }).minNights;
  const ok = par === OLD_PARS[p.id];
  if (!ok) failed = true;
  console.log(
    `${p.id.padEnd(16)} old-rules optimal=${par ?? 'infeasible'} vs ${OLD_PARS[p.id]}  ${ok ? 'OK' : 'FAIL'}`,
  );
}

// ---- solver feature checks (pinned ground truth for the v2 capabilities) -------
console.log('\n=== SOLVER FEATURE CHECKS (spatial / pause / gathering / coin-earned) ===');
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
const FEATURES = [
  {
    // E=4 only plants 4 carrots on day 0 — they ripen hands-free because the centre sprinkler
    // waters the whole plus every night.
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
    // 3 near-ripe potatoes but only 2⚡: the scarecrow tile PAUSES its unwatered crop (no wilt),
    // so it ripens a night late instead of dying.
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
  // ── Wave-2 challenge knife-edges + lessons (WS-B). The 0-night market-day par can't shave a
  // night, so its knife-edge is pinned on resources instead; the others pin each puzzle's lesson.
  {
    // Market Day resource knife 1: one fewer energy breaks the 10⚡ feed-chain line.
    name: 'market-day: 9 energy infeasible',
    expect: null,
    cfg: {
      tiles: tiles({ G: 3 }),
      coins: 20,
      energy: 9,
      builds: ['carrot'],
      objective: { kind: 'harvest', crop: 'carrot', count: 3 },
      maxNights: 0,
      allowFeed: true,
    },
  },
  {
    // Market Day resource knife 2: one fewer coin breaks the 20c working-capital loop.
    name: 'market-day: 19 coins infeasible',
    expect: null,
    cfg: {
      tiles: tiles({ G: 3 }),
      coins: 19,
      energy: 10,
      builds: ['carrot'],
      objective: { kind: 'harvest', crop: 'carrot', count: 3 },
      maxNights: 0,
      allowFeed: true,
    },
  },
  {
    // Patient Vine lesson: the vine alone caps at its 3 remaining fruits — cashing it early
    // (potato wilts) can never reach 4. Holding the ripe fruit while the potato ripens is forced.
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
    // Thirsty Work lesson (a): carrot-only is 2 nights slower than the mixed par of 7.
    name: 'thirsty-work: carrot-only takes 9',
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
    // Thirsty Work lesson (b): tomato-only takes 8 — mixing the two is what makes par.
    name: 'thirsty-work: tomato-only takes 8',
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
    // Waterworks lesson: no sprinkler ⇒ hand-watering at 5⚡ doubles the nights (4 vs par 2).
    name: 'waterworks: no sprinkler takes 4',
    expect: 4,
    cfg: {
      tiles: [
        { r: 0, c: 1, base: 'E', struct: '' },
        { r: 1, c: 0, base: 'E', struct: '' },
        { r: 1, c: 1, base: 'E', struct: '' },
        { r: 1, c: 2, base: 'E', struct: '' },
        { r: 2, c: 1, base: 'E', struct: '' },
      ],
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
  {
    // Waterworks resource knife 1: 75c can't afford sprinkler + all four seeds within par.
    name: 'waterworks: 75 coins misses par',
    expect: null,
    cfg: {
      tiles: [
        { r: 0, c: 1, base: 'E', struct: '' },
        { r: 1, c: 0, base: 'E', struct: '' },
        { r: 1, c: 1, base: 'E', struct: '' },
        { r: 1, c: 2, base: 'E', struct: '' },
        { r: 2, c: 1, base: 'E', struct: '' },
      ],
      coins: 75,
      energy: 5,
      builds: ['carrot'],
      allowedStructures: ['sprinkler', 'scarecrow'],
      objective: { kind: 'harvest', crop: 'carrot', count: 4 },
      maxNights: 2,
      allowFeed: false,
    },
  },
  {
    // Waterworks resource knife 2: 4⚡ can't place the sprinkler AND plant all four on day 0.
    name: 'waterworks: 4 energy misses par',
    expect: null,
    cfg: {
      tiles: [
        { r: 0, c: 1, base: 'E', struct: '' },
        { r: 1, c: 0, base: 'E', struct: '' },
        { r: 1, c: 1, base: 'E', struct: '' },
        { r: 1, c: 2, base: 'E', struct: '' },
        { r: 2, c: 1, base: 'E', struct: '' },
      ],
      coins: 76,
      energy: 4,
      builds: ['carrot'],
      allowedStructures: ['sprinkler', 'scarecrow'],
      objective: { kind: 'harvest', crop: 'carrot', count: 4 },
      maxNights: 2,
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
  // strictly better = fewer nights, or feasible vs infeasible, or (both infeasible) more progress.
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
  if (!shipped.ok) {
    const alt = verdicts.find((v) => v.ok);
    console.log(
      alt
        ? `smallest working change: regrow=${alt.regrow} reyield=${alt.reyield}`
        : 'no swept config achieves the criterion — widen the sweep or adjust the scenario.',
    );
  }
}

console.log(
  `\n${failed ? 'FAILED' : 'all checks passed'} in ${((Date.now() - t0) / 1000).toFixed(1)}s`,
);
process.exit(failed ? 1 : 0);
