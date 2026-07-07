// Little Acre — economy & pacing model (first pass; every number is tunable).
// Run: node scripts/little-acre-model.mjs
// Backbone: energy/day is the action budget; the NIGHT is the universal clock (Sleep advances
// crops, processing, pond restock, node respawn). Farming drives the early economy; gathering +
// processing are tool-gated supplements that overtake it mid-game.

const ENERGY_PER_DAY = 16;
const CAN = { I: 1, II: 3, III: 9 }; // tiles watered per 1 energy — the core energy-relief axis

// ---------------------------------------------------------------- CROPS
const CROPS = {
  // Tier 1 — available at start (seeds bought from Shop)
  Carrot: { tier: 1, cost: 4, grow: 2, sell: 20, role: 'BOOTSTRAP  cheap+fast; the "broke" crop' },
  Potato: { tier: 1, cost: 6, grow: 3, sell: 34, role: 'STAPLE     reliable, balanced' },
  Tomato: { tier: 1, cost: 12, grow: 4, sell: 18, reyield: 3, every: 2, role: 'KEEP-ALIVE plant once, harvest 3x free (energy-cheap)' },
  // Tier 2 — seeds/saplings from fishing chests & tree nests; lean on processing
  Hops: { tier: 2, cost: 9, grow: 3, sell: 3, procOnly: 'Beer', role: 'PROC-ONLY worthless raw; Keg -> Beer' },
  Blueberry: { tier: 2, cost: 22, grow: 4, sell: 14, reyield: 6, every: 2, role: 'BUSH       set-and-forget; Jar -> Jam' },
  Cauliflower: { tier: 2, cost: 20, grow: 5, sell: 90, fragile: true, role: 'PREMIUM    high value, wilts w/o scarecrow' },
};

function cropProfile(name, can = 'I', bloom = 1) {
  const c = CROPS[name];
  const harvests = c.reyield || 1;
  const lifetimeNights = c.grow + (harvests - 1) * (c.every || 0);
  const rawUnit = c.procOnly ? 0 : c.sell * bloom; // proc-only crops earn ~nothing raw
  const revenue = harvests * rawUnit;
  const profit = revenue - c.cost;
  const energy = 1 /*plant once*/ + c.grow / CAN[can] /*water to ripe*/;
  return {
    profit: +profit.toFixed(1),
    nights: lifetimeNights,
    energy: +energy.toFixed(2),
    perEnergy: +(profit / energy).toFixed(1),
    perTileNight: +(profit / lifetimeNights).toFixed(1),
  };
}

// ---------------------------------------------------------------- GATHERING
const SKILL = { miss: 1.0, ok: 1.2, perfect: 1.5 }; // timing-minigame yield multiplier; avg engaged player ~ok
const GATHER = {
  Fishing: { tool: 'Rod (buy)', cap: 5, base: 20, extra: 'chests: ore/seeds/saplings' },
  Mining: { tool: 'Pickaxe (buy)', cap: 4, base: 26, extra: 'gems; enemy risk; ore for crafting' },
  Chopping: { tool: 'Axe (buy)', cap: 6, base: 8, extra: 'wood; nests -> seeds; clears land' },
};

// ---------------------------------------------------------------- PROCESSING (value-add)
const PROC = [
  ['Furnace', 'Copper(14) -> Bar(34)', 2.43, 1, 'gates all tool/machine crafting'],
  ['Smoker', 'Fish(20) -> Smoked(48)', 2.4, 1, 'steady fish upgrade'],
  ['Preserves Jar', 'Cauliflower(90) -> Pickle(185)', 2.05, 2, 'premium veg'],
  ['Keg', 'Hops(3) -> Beer(95)', 31.7, 3, 'makes a dead crop the best money in the game'],
];

// ---------------------------------------------------------------- PUZZLE VALIDATOR
// A puzzle = "produce N of good G in D nights" on a fixed board. Feasible? Par?
function checkChainPuzzle({ target, nights, sources, procSlots, fuelPerNight, energyPerDay }) {
  const supplyPerDay = Math.min(sources, energyPerDay);
  const supply = supplyPerDay * nights;
  const procPerNight = Math.min(procSlots, fuelPerNight);
  const capacity = procPerNight * nights;
  const feasible = supply >= target && capacity >= target;
  const bottleneck =
    capacity < target ? `PROCESSOR throughput (max ${capacity})` :
    supply < target ? `INPUT supply (max ${supply})` : 'ok — tune par closer to the clock';
  return { feasible, bottleneck, par: Math.ceil(target / procPerNight), capacity, supply };
}

// ---------------------------------------------------------------- GREEDY PACING (farming income)
function pacing() {
  const SHOP = [
    ['Rod I — unlock fishing', 150], ['Axe I — chopping + land', 180],
    ['Watering Can II (1->3/e)', 260], ['Pickaxe I — unlock mining', 300],
    ['Smoker', 320], ['Keg', 360], ['Preserves Jar', 420],
  ].map(([name, cost]) => ({ name, cost, day: null }));
  let coins = 40, day = 0, soil = 6, can = 'I';
  const income = () => cropProfile(can === 'II' ? 'Cauliflower' : 'Carrot', can).perTileNight * soil / (can === 'II' ? 1.5 : 1);
  let inc = income(), bought = 0;
  while (bought < SHOP.length && day < 80) {
    day++; coins += inc;
    for (const s of SHOP) {
      if (!s.day && coins >= s.cost) {
        coins -= s.cost; s.day = day; bought++;
        if (s.name.startsWith('Watering Can')) can = 'II';
        if (s.name.startsWith('Axe')) soil += 3;
        inc = income();
        break;
      }
    }
  }
  return { SHOP, inc: Math.round(inc) };
}

// ---------------------------------------------------------------- REPORT
function money(n) { return String(n).padStart(6); }
console.log('=== CROP PROFILES (Watering Can I) — each wins a different axis ===');
console.log('crop'.padEnd(12), 'profit'.padStart(7), 'nights'.padStart(7), 'energy'.padStart(7), 'c/energy'.padStart(9), 'c/tile-night'.padStart(13), '  role');
for (const n of Object.keys(CROPS)) {
  const p = cropProfile(n);
  console.log(n.padEnd(12), money(p.profit), String(p.nights).padStart(7), String(p.energy).padStart(7),
    String(p.perEnergy).padStart(9), String(p.perTileNight).padStart(13), '  T' + CROPS[n].tier + ' ' + CROPS[n].role);
}

console.log('\n=== EARLY vs LATE watering can (why crafting the can matters) ===');
for (const n of ['Carrot', 'Cauliflower']) {
  console.log(n.padEnd(12), 'CanI', String(cropProfile(n, 'I').perEnergy).padStart(6),
    ' CanII', String(cropProfile(n, 'II').perEnergy).padStart(6), ' CanIII', String(cropProfile(n, 'III').perEnergy).padStart(6), ' (coins/energy)');
}

console.log('\n=== GATHERING (tool-gated, throttled, timing-skill x' + SKILL.ok + ' avg) ===');
for (const [g, d] of Object.entries(GATHER)) {
  console.log(g.padEnd(9), `~${Math.round(d.cap * d.base * SKILL.ok)}/day max`.padStart(12),
    ` cap ${d.cap} @ ${d.base}`, ` needs ${d.tool}`.padEnd(20), '  ' + d.extra);
}

console.log('\n=== PROCESSING (the mid/late multiplier) ===');
for (const [m, flow, mult, nights, note] of PROC) {
  console.log(m.padEnd(14), flow.padEnd(34), `x${mult}`.padStart(7), `${nights}n`.padStart(4), '  ' + note);
}

console.log('\n=== GREEDY PACING (farming income only; carrots -> cauliflower after Can II) ===');
const pc = pacing();
for (const s of pc.SHOP) console.log(`  day ${String(s.day || '--').padStart(2)}  ${s.name}  (${s.cost}c)`);
console.log(`  income/day at end (pre gathering+processing): ${pc.inc}c`);

console.log('\n=== PUZZLE CHECK: "Ship 30 Beer in 8 nights" ===');
console.log('  2 kegs, 2 hops/night:', JSON.stringify(checkChainPuzzle(
  { target: 30, nights: 8, sources: 8, procSlots: 2, fuelPerNight: 8, energyPerDay: 16 })));
console.log('  4 kegs, 4 hops/night:', JSON.stringify(checkChainPuzzle(
  { target: 30, nights: 8, sources: 8, procSlots: 4, fuelPerNight: 8, energyPerDay: 16 })));
console.log('  => the puzzle IS the keg/hops/board layout; tune procSlots so par ~= the given nights.');
