/**
 * Exact solver for Little Acre puzzle scenarios — Solver v2 (megaslice Wave 1).
 *
 * Verb rules modelled (post-PR#5 actions.ts/store.ts + WS-A's Wave-1 changes):
 *   till 1e (grass/wilt→soil) · plant 1e+cost · water 1e · feed 1e+8c (+1 stage, can ripen)
 *   harvest free (re-yield drops to grow-regrow, unwatered) · uproot free · clear wilt 1e
 *   fish 1e (pond, stock 4, +18c, stock−1, refills +2/night cap 4)
 *   mine 1e (rock, 3 charges, +13c, gem on the last pull, then 3 nights dormant)
 *   place sprinkler 1e+60c · place scarecrow 1e+45c
 *   night: watered growing +1 stage; a growing crop covered by ANY sprinkler (its own tile or an
 *          orthogonal neighbour) is auto-watered → grows; a growing unwatered crop on a SCARECROW
 *          tile pauses (survives, no growth); any other unwatered growing crop wilts;
 *          ripe/empty unchanged; ponds restock; dormant rocks tick down and recharge.
 *
 * A tile-day is a CHAIN of ops (e.g. till→plant→feed→feed→harvest→plant→water), bounded by the
 * day's energy. BFS over nights on (coins, progress, board) states.
 *
 * Two board modes:
 *   - MULTISET (fast): no structures in play → tiles are an unordered multiset of state strings;
 *     each tile resolves its own night independently (no sprinkler can reach it), so we pre-resolve
 *     the night inside the chain and prune symmetric permutations of identical tiles.
 *   - POSITIONAL (spatial): structures present or allowed → tiles are keyed by (r,c); sprinkler
 *     coverage crosses tile boundaries, so the night is resolved at the BOARD level after choosing
 *     a chain per tile. Multiset's deliberate-wilt prune is dropped here (a "wilting" tile may be
 *     rescued by a neighbouring sprinkler), so positional mode leans on Pareto pruning instead.
 *
 * Objectives:
 *   - harvest: progress = count of harvested crops matching the objective crop ('any' = all).
 *   - coins:   progress = cumulative coins EARNED (harvest sells + fish/mine income). SPENDING
 *     NEVER REDUCES PROGRESS — buying seeds/structures leaves earned untouched; only the coin
 *     BALANCE (used for solvency/affordability) drops. This makes "earn N coins" a monotone goal,
 *     so the BFS can prune on it exactly like a harvest count.
 *
 * Performance (preserve when refactoring): chain enumeration is cached per
 * (state, E, builds, flags, defs); the frontier is Pareto-pruned per board-key on (coins, prog);
 * chains are sorted by energy so the assignment loop breaks early; deliberate wilt is pruned in
 * multiset mode (free uproot dominates).
 */

// ---- content (mirrors src/lib/game/tiles.ts + WS-A Wave-1 retune) --------------
// DEFAULT_CROPS mirrors the POST-Wave-1 src constants (tomato reyield 4 / regrow 1 — WS-A's
// retune, locked by the --sweep-tomato analysis below). OLD_CROPS is the pre-megaslice mirror,
// kept for the regression path (feed off + old tomato ⇒ pars 2/3/6).
// INTEGRATION SYNC: keep in step with CROPS in src/lib/game/tiles.ts.
export const DEFAULT_CROPS = {
  carrot: { cost: 4, sell: 20, grow: 2 },
  potato: { cost: 6, sell: 34, grow: 3 },
  tomato: { cost: 12, sell: 18, grow: 4, reyield: 4, regrow: 1 },
};
export const OLD_CROPS = {
  carrot: { cost: 4, sell: 20, grow: 2 },
  potato: { cost: 6, sell: 34, grow: 3 },
  tomato: { cost: 12, sell: 18, grow: 4, reyield: 3, regrow: 2 },
};

const FEED_COINS = 8; // actions.ts FERTILIZE_COINS
// INTEGRATION SYNC: mirror src/lib/game/tiles.ts — STRUCT costs, FISH_COINS, ORE_COINS,
// POND_MAX/POND_REFILL, ROCK_CHARGES/ROCK_DORMANT_NIGHTS.
const STRUCT_COST = { sprinkler: 60, scarecrow: 45 };
const FISH_COINS = 18;
const MINE_COINS = 13; // src: ORE_COINS
const POND_MAX = 4;
const POND_REFILL = 2;
const ROCK_CHARGES = 3;
const ROCK_DORMANT_NIGHTS = 3;

// tile base state strings: 'G' grass · 'E' tilled empty · 'X' wilted ·
//   `${crop}:${stage}:${h}` crop · `P:${stock}` pond · `R:${charges}:${dormant}` rock
const enc = (c, s, h) => `${c}:${s}:${h}`;

function parseBase(s) {
  if (s === 'G' || s === 'E' || s === 'X') return { k: s };
  if (s.startsWith('P:')) return { k: 'P', stock: +s.slice(2) };
  if (s.startsWith('R:')) {
    const [, ch, dm] = s.split(':');
    return { k: 'R', charges: +ch, dormant: +dm };
  }
  const [c, st, h] = s.split(':');
  return { k: 'C', crop: c, s: +st, h: +h };
}

// ---- per-tile day chains -------------------------------------------------------
// Enumerate every legal chain of ops on a single tile within the day's energy. Returns raw
// options {e, segs, harv, earned, endBase, endStruct, endWatered, endGrowing} where the night is
// NOT yet resolved. segs = [[invest, payout], ...] chronologically (for cross-tile solvency).
const chainCache = new Map();
function enumerateChains(base, struct, E, ctx) {
  const ck = `${base}@${struct}|${E}|${ctx.builds.join()}|${ctx.allowFeed}|${
    ctx.allowStructures ? ctx.allowedStructs.join('') : ''
  }|${ctx.objCrop}|${ctx.pruneWilt}|${ctx.noWater ?? false}|${ctx.defsKey}`;
  const hit = chainCache.get(ck);
  if (hit) return hit;

  const out = new Map();
  const cd = ctx.cropDefs;
  const start = (() => {
    const p = parseBase(base);
    if (p.k === 'C') return { ...p, watered: false };
    return p;
  })();

  function finish(t, st, e, segs, harv, earned, curInvest) {
    let endBase;
    let endGrowing = false;
    let endWatered = false;
    if (t.k === 'C') {
      const grow = cd[t.crop].grow;
      endBase = enc(t.crop, t.s, t.h);
      if (t.s < grow) {
        endGrowing = true;
        endWatered = t.watered;
      }
    } else if (t.k === 'P') endBase = `P:${t.stock}`;
    else if (t.k === 'R') endBase = `R:${t.charges}:${t.dormant}`;
    else endBase = t.k;

    // Deliberate wilt is strictly dominated by free uproot when nothing can rescue the crop
    // overnight: no sprinkler can cover this tile (pruneWilt is only set then) and it isn't on a
    // scarecrow (which pauses instead of wilting). Positional cells that a sprinkler might cover
    // keep the unwatered option.
    if (ctx.pruneWilt && endGrowing && !endWatered && st !== 'scarecrow') return;

    const fsegs = curInvest > 0 ? [...segs, [curInvest, 0]] : segs;
    const key = `${endBase}@${st}|${e}|${harv}|${earned}|${endWatered ? 'w' : ''}|${fsegs
      .map((s) => s.join(':'))
      .join(',')}`;
    if (!out.has(key))
      out.set(key, {
        e,
        segs: fsegs,
        harv,
        earned,
        endBase,
        endStruct: st,
        endWatered,
        endGrowing,
      });
  }

  function placeStructs(t, st, e, segs, harv, earned, curInvest, depth) {
    if (st !== '' || !ctx.allowStructures) return;
    for (const sId of ctx.allowedStructs)
      if (e + 1 <= E)
        rec(t, sId, e + 1, segs, harv, earned, curInvest + STRUCT_COST[sId], depth + 1);
  }

  function rec(t, st, e, segs, harv, earned, curInvest, depth) {
    if (depth > 26) return;
    finish(t, st, e, segs, harv, earned, curInvest);
    if ((t.k === 'G' || t.k === 'X') && e + 1 <= E)
      rec({ k: 'E' }, st, e + 1, segs, harv, earned, curInvest, depth + 1);
    else if (t.k === 'E') {
      for (const c of ctx.builds)
        if (e + 1 <= E)
          rec(
            { k: 'C', crop: c, s: 0, h: 0, watered: false },
            st,
            e + 1,
            segs,
            harv,
            earned,
            curInvest + cd[c].cost,
            depth + 1,
          );
      placeStructs({ k: 'E' }, st, e, segs, harv, earned, curInvest, depth);
    } else if (t.k === 'C') {
      const def = cd[t.crop];
      if (t.s >= def.grow) {
        // ripe: harvest (free) or uproot (free)
        const last = t.h + 1 >= (def.reyield ?? 1);
        const nsegs = [...segs, [curInvest, def.sell]];
        const dHarv = ctx.objCrop === 'any' || t.crop === ctx.objCrop ? 1 : 0;
        if (last) rec({ k: 'E' }, st, e, nsegs, harv + dHarv, earned + def.sell, 0, depth + 1);
        else
          rec(
            {
              k: 'C',
              crop: t.crop,
              s: def.grow - (def.regrow ?? def.grow),
              h: t.h + 1,
              watered: false,
            },
            st,
            e,
            nsegs,
            harv + dHarv,
            earned + def.sell,
            0,
            depth + 1,
          );
        rec({ k: 'E' }, st, e, segs, harv, earned, curInvest, depth + 1); // uproot
      } else {
        // growing: water / feed / uproot / place structure. noWater: the cell is statically
        // sprinkler-covered, so hand-watering is pure waste — skip the branch entirely.
        if (!ctx.noWater && !t.watered && e + 1 <= E)
          rec({ ...t, watered: true }, st, e + 1, segs, harv, earned, curInvest, depth + 1);
        if (ctx.allowFeed && e + 1 <= E)
          rec(
            { ...t, s: t.s + 1 },
            st,
            e + 1,
            segs,
            harv,
            earned,
            curInvest + FEED_COINS,
            depth + 1,
          );
        rec({ k: 'E' }, st, e, segs, harv, earned, curInvest, depth + 1); // uproot (loses invest)
        placeStructs(t, st, e, segs, harv, earned, curInvest, depth);
      }
    } else if (t.k === 'P') {
      if (t.stock > 0 && e + 1 <= E)
        rec(
          { k: 'P', stock: t.stock - 1 },
          st,
          e + 1,
          [...segs, [0, FISH_COINS]],
          harv,
          earned + FISH_COINS,
          curInvest,
          depth + 1,
        );
    } else if (t.k === 'R') {
      if (t.charges > 0 && t.dormant === 0 && e + 1 <= E) {
        const nch = t.charges - 1;
        // A gem drops on the last pull; gems don't feed coin/harvest objectives, so we don't
        // track them in state — the dormant countdown is the only board-visible consequence.
        rec(
          { k: 'R', charges: nch, dormant: nch === 0 ? ROCK_DORMANT_NIGHTS : 0 },
          st,
          e + 1,
          [...segs, [0, MINE_COINS]],
          harv,
          earned + MINE_COINS,
          curInvest,
          depth + 1,
        );
      }
    }
  }

  rec(start, struct, 0, [], 0, 0, 0, 0);
  const opts = [...out.values()];
  opts.sort((a, b) => a.e - b.e);
  chainCache.set(ck, opts);
  return opts;
}

// Resolve one night for a single cell given whether a sprinkler covers it.
function resolveCellNight(endBase, endStruct, endWatered, externallyWatered, cropDefs) {
  const t = parseBase(endBase);
  if (t.k === 'C') {
    const grow = cropDefs[t.crop].grow;
    if (t.s < grow) {
      if (endWatered || externallyWatered) return enc(t.crop, t.s + 1, t.h);
      if (endStruct === 'scarecrow') return enc(t.crop, t.s, t.h); // paused: survives, no growth
      return 'X'; // wilts
    }
    return enc(t.crop, t.s, t.h); // ripe unchanged
  }
  if (t.k === 'P') return `P:${Math.min(POND_MAX, t.stock + POND_REFILL)}`;
  if (t.k === 'R') {
    let { charges, dormant } = t;
    if (dormant > 0) {
      dormant -= 1;
      if (dormant === 0) charges = ROCK_CHARGES;
    }
    return `R:${charges}:${dormant}`;
  }
  return t.k; // G/E/X
}

// ---- multiset chains: pre-resolve night + dominance-prune ----------------------
const multisetCache = new Map();
function multisetChains(base, E, ctx) {
  const ck = `${base}|${E}|${ctx.builds.join()}|${ctx.allowFeed}|${ctx.objCrop}|${ctx.defsKey}`;
  const hit = multisetCache.get(ck);
  if (hit) return hit;

  const raw = enumerateChains(base, '', E, {
    ...ctx,
    pruneWilt: true,
    allowStructures: false,
    allowedStructs: [],
  });
  const opts = raw.map((o) => ({
    e: o.e,
    segs: o.segs,
    harv: o.harv,
    earned: o.earned,
    next: resolveCellNight(o.endBase, '', o.endWatered, false, ctx.cropDefs),
  }));
  const kept = dominancePrune(opts, (o) => o.next);
  kept.sort((a, b) => a.e - b.e);
  multisetCache.set(ck, kept);
  return kept;
}

// Drop options strictly dominated on (e, invest, payout, harv, earned) within the same
// night-outcome group (groupOf must capture everything that affects the post-night state).
function dominancePrune(opts, groupOf) {
  const kept = [];
  for (const a of opts) {
    const aG = groupOf(a);
    const aInv = a.segs.reduce((s, [i]) => s + i, 0);
    const aPay = a.segs.reduce((s, [, p]) => s + p, 0);
    let dom = false;
    for (const b of opts) {
      if (b === a) continue;
      if (groupOf(b) !== aG) continue;
      const bInv = b.segs.reduce((s, [i]) => s + i, 0);
      const bPay = b.segs.reduce((s, [, p]) => s + p, 0);
      if (
        b.harv >= a.harv &&
        b.earned >= a.earned &&
        b.e <= a.e &&
        bInv <= aInv &&
        bPay >= aPay &&
        (b.harv > a.harv || b.earned > a.earned || b.e < a.e || bInv < aInv || bPay > aPay)
      ) {
        dom = true;
        break;
      }
    }
    if (!dom) kept.push(a);
  }
  return kept;
}

// ---- positional chains: coverage-aware pruning + dominance-prune ----------------
// coverMode per cell:
//   'covered'   — statically under a sprinkler (sprinkler not placeable): skip hand-watering,
//                 keep unwatered-growing ends (they grow anyway).
//   'uncovered' — no sprinkler can ever cover this cell: prune deliberate wilt (scarecrow ends
//                 excepted — they pause).
//   'dynamic'   — sprinkler placement allowed: keep everything; coverage resolves at board level.
const positionalCache = new Map();
function positionalChains(base, struct, E, ctx, coverMode) {
  const ck = `${base}@${struct}|${E}|${ctx.builds.join()}|${ctx.allowFeed}|${
    ctx.allowStructures ? ctx.allowedStructs.join('') : ''
  }|${ctx.objCrop}|${coverMode}|${ctx.defsKey}`;
  const hit = positionalCache.get(ck);
  if (hit) return hit;

  const raw = enumerateChains(base, struct, E, {
    ...ctx,
    pruneWilt: coverMode === 'uncovered',
    noWater: coverMode === 'covered',
  });
  // Group key must capture everything the board-level night resolution reads from this cell:
  // post-day base, structure, and hand-watered flag.
  const kept = dominancePrune(raw, (o) => `${o.endBase}@${o.endStruct}|${o.endWatered ? 'w' : ''}`);
  kept.sort((a, b) => a.e - b.e);
  positionalCache.set(ck, kept);
  return kept;
}

// ---- cross-tile coin solvency --------------------------------------------------
// segments: [invest, payout][] per tile in order; can we interleave to stay >= 0? Returns final
// balance or false. (Unchanged from v1.)
function solvent(coins, tileSegs) {
  const queues = tileSegs.map((s) => [...s]).filter((q) => q.length);
  let bal = coins;
  let moved = true;
  while (queues.some((q) => q.length)) {
    if (!moved) return false;
    moved = false;
    let bi = -1;
    let bestInv = Infinity;
    for (let i = 0; i < queues.length; i++) {
      const q = queues[i];
      if (!q.length) continue;
      const [inv, pay] = q[0];
      if (pay >= inv && inv <= bal && inv < bestInv) {
        bestInv = inv;
        bi = i;
      }
    }
    if (bi >= 0) {
      const [inv, pay] = queues[bi].shift();
      bal += pay - inv;
      moved = true;
      continue;
    }
    let bp = -1;
    let bestPay = -1;
    for (let i = 0; i < queues.length; i++) {
      const q = queues[i];
      if (!q.length) continue;
      const [inv, pay] = q[0];
      if (inv <= bal && pay > bestPay) {
        bestPay = pay;
        bp = i;
      }
    }
    if (bp >= 0) {
      const [inv, pay] = queues[bp].shift();
      bal += pay - inv;
      moved = true;
    }
  }
  return bal;
}

// ---- objective normalisation ---------------------------------------------------
function normObjective(config) {
  if (config.objective) {
    const o = config.objective;
    if (o.kind === 'coins') return { kind: 'coins', crop: 'any', amount: o.amount };
    return { kind: 'harvest', crop: o.crop ?? 'any', amount: o.count };
  }
  return { kind: 'harvest', crop: config.objectiveCrop ?? 'any', amount: config.target };
}

// ================================================================================
// MULTISET BFS (no structures) — the fast path.
// ================================================================================
function solveMultiset(config, obj) {
  const { coins, energy, builds, maxNights, allowFeed = true } = config;
  const cropDefs = config.cropDefs ?? DEFAULT_CROPS;
  const ctx = {
    builds,
    allowFeed,
    objCrop: obj.crop,
    cropDefs,
    defsKey: JSON.stringify(cropDefs),
  };
  const target = obj.amount;
  const coinCap = Math.max(300, obj.kind === 'coins' ? target + 200 : 300);
  const startTiles = config.tiles.map((t) => (typeof t === 'object' ? t.base : t));

  const key = (c, p, ts) => `${c}|${p}|${[...ts].sort().join(',')}`;
  let frontier = new Map();
  frontier.set(key(coins, 0, startTiles), { coins, prog: 0, tiles: startTiles });

  let best = null;
  const maxProgByNight = [];
  for (let night = 0; night <= maxNights; night++) {
    const next = new Map();
    let maxProg = 0;
    for (const st of frontier.values()) {
      maxProg = Math.max(maxProg, st.prog);
      const sorted = [...st.tiles].sort();
      const perTile = sorted.map((t) => multisetChains(t, energy, ctx));
      const n = sorted.length;
      const choice = new Array(n);
      const chosenIdx = new Array(n);
      const rec = (i, eUsed) => {
        if (i === n) {
          const bal = solvent(
            st.coins,
            choice.map((o) => o.segs),
          );
          if (bal === false) return;
          const gained = choice.reduce((s, o) => s + (obj.kind === 'coins' ? o.earned : o.harv), 0);
          const prog = st.prog + gained;
          if (prog >= target) {
            if (best === null || night < best) best = night;
            return;
          }
          if (night === maxNights) return;
          const c = Math.min(coinCap, bal);
          const ts = choice.map((o) => o.next);
          const k = key(c, prog, ts);
          if (!next.has(k)) next.set(k, { coins: c, prog, tiles: ts });
          return;
        }
        const min = i > 0 && sorted[i] === sorted[i - 1] ? chosenIdx[i - 1] : 0;
        for (let oi = min; oi < perTile[i].length; oi++) {
          const o = perTile[i][oi];
          if (eUsed + o.e > energy) break;
          choice[i] = o;
          chosenIdx[i] = oi;
          rec(i + 1, eUsed + o.e);
          if (best !== null && best <= night) return;
        }
      };
      rec(0, 0);
      if (best !== null && best <= night) break;
    }
    maxProgByNight.push(maxProg);
    if (config.verbose) console.log(`  night ${night}: states=${frontier.size} maxProg=${maxProg}`);
    if (best !== null && best <= night) break;
    frontier = paretoPrune(next, (st) => [...st.tiles].sort().join(','));
    if (frontier.size === 0) break;
  }
  return { minNights: best, maxProgByNight };
}

// Pareto prune: within each board-key, drop states dominated on (coins, prog).
function paretoPrune(next, boardKeyOf) {
  const byBoard = new Map();
  for (const st of next.values()) {
    const bk = boardKeyOf(st);
    let arr = byBoard.get(bk);
    if (!arr) byBoard.set(bk, (arr = []));
    arr.push(st);
  }
  const frontier = new Map();
  let fi = 0;
  for (const arr of byBoard.values()) {
    arr.sort((a, b) => b.coins - a.coins || b.prog - a.prog);
    let maxP = -1;
    for (const st of arr) {
      if (st.prog > maxP) {
        maxP = st.prog;
        frontier.set(fi++, st);
      }
    }
  }
  return frontier;
}

// ================================================================================
// POSITIONAL BFS (structures in play) — tiles keyed by (r,c); night resolved board-wide.
// Engages when the board carries a structure or config.allowedStructures is non-empty (see solve).
// ================================================================================
function solvePositional(config, obj) {
  const { coins, energy, builds, maxNights, allowFeed = true } = config;
  const cropDefs = config.cropDefs ?? DEFAULT_CROPS;
  const allowedStructs = config.allowedStructures ?? [];
  const ctx = {
    builds,
    allowFeed,
    allowStructures: allowedStructs.length > 0,
    allowedStructs,
    objCrop: obj.crop,
    cropDefs,
    defsKey: JSON.stringify(cropDefs),
  };
  const target = obj.amount;
  const coinCap = Math.max(300, obj.kind === 'coins' ? target + 200 : 300);

  const cells = config.tiles.map((t, i) => normalizeCell(t, i));
  // orthogonal-neighbour index for sprinkler coverage (derived from r/c, not array index).
  const posIndex = new Map(cells.map((c, i) => [`${c.r},${c.c}`, i]));
  const neigh = cells.map((c) =>
    [
      [c.r - 1, c.c],
      [c.r + 1, c.c],
      [c.r, c.c - 1],
      [c.r, c.c + 1],
    ]
      .map(([r, cc]) => posIndex.get(`${r},${cc}`))
      .filter((x) => x !== undefined),
  );

  // Coverage mode per cell, computed per state (canonicalisation may permute sprinklers between
  // coordinate slots). Structures are never removed, so when the sprinkler is NOT placeable each
  // state's covered set is fixed for the day; otherwise coverage is dynamic.
  const sprinklerPlaceable = allowedStructs.includes('sprinkler');
  const coverModeOf = (stCells) =>
    stCells.map((c, i) => {
      if (sprinklerPlaceable) return 'dynamic';
      const covered =
        c.struct === 'sprinkler' || neigh[i].some((j) => stCells[j].struct === 'sprinkler');
      return covered ? 'covered' : 'uncovered';
    });

  // Board symmetry: the solver's rules are position-agnostic except sprinkler adjacency, so any
  // geometric isometry of the tile layout is a valid state symmetry. Canonicalise each board to the
  // lexicographically smallest orientation under the layout's dihedral automorphisms — this merges
  // rotated/reflected duplicates in the frontier (up to 8× on a symmetric plus/square). Cheap:
  // computed once, ≤8 candidate transforms.
  const autos = boardAutomorphisms(cells);
  const canon = (arr) => {
    let best = null;
    for (const p of autos) {
      const permuted = new Array(arr.length);
      for (let i = 0; i < arr.length; i++) {
        const j = p[i];
        permuted[j] = { r: cells[j].r, c: cells[j].c, base: arr[i].base, struct: arr[i].struct };
      }
      const k = permuted.map((cc) => `${cc.base}@${cc.struct}`).join('|');
      if (best === null || k < best.key) best = { key: k, cells: permuted };
    }
    return best;
  };
  const serial = (arr) => arr.map((cc) => `${cc.base}@${cc.struct}`).join('|');
  const key = (c, p, ser) => `${c}|${p}|${ser}`;
  let frontier = new Map();
  {
    const cn = canon(cells);
    frontier.set(key(coins, 0, cn.key), { coins, prog: 0, cells: cn.cells });
  }

  let best = null;
  const maxProgByNight = [];
  for (let night = 0; night <= maxNights; night++) {
    const nextStates = new Map();
    let maxProg = 0;
    for (const st of frontier.values()) {
      maxProg = Math.max(maxProg, st.prog);
      const n = st.cells.length;
      const modes = coverModeOf(st.cells);
      const perCell = st.cells.map((cc, i) =>
        positionalChains(cc.base, cc.struct, energy, ctx, modes[i]),
      );
      const choice = new Array(n);
      const rec = (i, eUsed) => {
        if (i === n) {
          const bal = solvent(
            st.coins,
            choice.map((o) => o.segs),
          );
          if (bal === false) return;
          // sprinkler coverage: each sprinkler waters its own cell + orthogonal neighbours.
          const covered = new Array(n).fill(false);
          for (let j = 0; j < n; j++) {
            if (choice[j].endStruct === 'sprinkler') {
              covered[j] = true;
              for (const nb of neigh[j]) covered[nb] = true;
            }
          }
          const gained = choice.reduce((s, o) => s + (obj.kind === 'coins' ? o.earned : o.harv), 0);
          const prog = st.prog + gained;
          if (prog >= target) {
            if (best === null || night < best) best = night;
            return;
          }
          if (night === maxNights) return;
          const outCells = choice.map((o, j) => ({
            r: st.cells[j].r,
            c: st.cells[j].c,
            base: resolveCellNight(o.endBase, o.endStruct, o.endWatered, covered[j], cropDefs),
            struct: o.endStruct,
          }));
          const cc = Math.min(coinCap, bal);
          const cn = canon(outCells);
          const k = key(cc, prog, cn.key);
          if (!nextStates.has(k)) nextStates.set(k, { coins: cc, prog, cells: cn.cells });
          return;
        }
        const opts = perCell[i];
        for (let oi = 0; oi < opts.length; oi++) {
          const o = opts[oi];
          if (eUsed + o.e > energy) break;
          choice[i] = o;
          rec(i + 1, eUsed + o.e);
          if (best !== null && best <= night) return;
        }
      };
      rec(0, 0);
      if (best !== null && best <= night) break;
    }
    maxProgByNight.push(maxProg);
    if (config.verbose)
      console.log(`  night ${night}: states=${frontier.size} maxProg=${maxProg} (spatial)`);
    if (best !== null && best <= night) break;
    frontier = paretoPrune(nextStates, (st) => serial(st.cells));
    if (frontier.size === 0) break;
  }
  return { minNights: best, maxProgByNight };
}

// Dihedral automorphisms of the tile layout: the ≤8 geometric isometries (rotations/reflections)
// that map the set of cell coordinates onto itself. Returns permutations p where p[i] = the index
// the cell at position i maps to. Orthogonal adjacency (sprinkler coverage) is preserved by every
// isometry, so each is a valid state symmetry.
function boardAutomorphisms(cells) {
  const maxR = Math.max(...cells.map((c) => c.r));
  const maxC = Math.max(...cells.map((c) => c.c));
  const idx = new Map(cells.map((c, i) => [`${c.r},${c.c}`, i]));
  const transforms = [
    (r, c) => [r, c],
    (r, c) => [maxR - r, c],
    (r, c) => [r, maxC - c],
    (r, c) => [maxR - r, maxC - c],
    (r, c) => [c, r],
    (r, c) => [maxC - c, maxR - r],
    (r, c) => [c, maxR - r],
    (r, c) => [maxC - c, r],
  ];
  const seen = new Set();
  const autos = [];
  for (const f of transforms) {
    const p = new Array(cells.length);
    let ok = true;
    for (let i = 0; i < cells.length; i++) {
      const [nr, nc] = f(cells[i].r, cells[i].c);
      const j = idx.get(`${nr},${nc}`);
      if (j === undefined) {
        ok = false;
        break;
      }
      p[i] = j;
    }
    if (!ok || new Set(p).size !== p.length) continue; // must be a bijection onto existing cells
    const k = p.join(',');
    if (!seen.has(k)) {
      seen.add(k);
      autos.push(p);
    }
  }
  return autos;
}

function normalizeCell(t, i) {
  if (typeof t === 'string') {
    const [b, s] = t.split('@');
    return { r: Math.floor(i / 3), c: i % 3, base: b, struct: s ?? '' };
  }
  return { r: t.r, c: t.c, base: t.base, struct: t.struct ?? '' };
}

// ================================================================================
export function solve(config) {
  const obj = normObjective(config);
  const allowedStructs = config.allowedStructures ?? [];
  const positioned = config.tiles.some((t) => typeof t === 'object' && t.struct);
  const spatial = config.spatial ?? (positioned || allowedStructs.length > 0);
  return spatial ? solvePositional(config, obj) : solveMultiset(config, obj);
}

export function clearCache() {
  chainCache.clear();
  multisetCache.clear();
  positionalCache.clear();
}

// Multiset board helper: { G: 9 } → nine 'G' tiles, or pass an array of state strings.
export const tiles = (spec) => {
  if (Array.isArray(spec)) return spec;
  const out = [];
  for (const [k, n] of Object.entries(spec)) for (let i = 0; i < n; i++) out.push(k);
  return out;
};

// Positional board helper: rows of `base` or `base@struct` strings → positioned cells.
export const board = (rows) => {
  const out = [];
  rows.forEach((row, r) =>
    row.forEach((spec, c) => {
      const [b, s] = String(spec).split('@');
      out.push({ r, c, base: b, struct: s ?? '' });
    }),
  );
  return out;
};

export { DEFAULT_CROPS as CROPS, enc };
