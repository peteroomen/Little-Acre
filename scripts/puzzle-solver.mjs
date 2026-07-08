/**
 * Exact solver for Little Acre puzzle scenarios — post-PR#5 rules (actions.ts/store.ts):
 *   till 1e (grass→soil) · plant 1e+cost · water 1e · feed 1e+8c (+1 stage, can ripen)
 *   harvest free (re-yield drops to grow-regrow, unwatered) · uproot free · clear wilt 1e
 *   night: watered growing +1 stage; unwatered growing wilts; ripe/empty unchanged.
 *
 * A tile-day is a CHAIN of ops (e.g. till→plant→feed→feed→harvest→plant→water), bounded by
 * the day's energy. BFS over nights on (coins, progress, tile-multiset) states.
 */

const CROPS = {
  carrot: { cost: 4, sell: 20, grow: 2 },
  potato: { cost: 6, sell: 34, grow: 3 },
  tomato: { cost: 12, sell: 18, grow: 4, reyield: 3, regrow: 2 },
};
const FEED_COINS = 8;

// tile state: 'G' grass · 'E' tilled empty · 'X' wilted · `${crop}:${stage}:${h}`
const enc = (c, s, h) => `${c}:${s}:${h}`;

// ---- per-tile day chains -----------------------------------------------------
// Returns list of {e, segs, prog, next} where segs = [[invest, payout], ...] in
// chronological order (for cross-tile solvency checking). next = post-night state.
const chainCache = new Map();
function tileChains(state, E, builds, allowFeed, oc) {
  const ck = `${state}|${E}|${builds.join()}|${allowFeed}|${oc}`;
  const hit = chainCache.get(ck);
  if (hit) return hit;

  const out = new Map(); // key -> option (dedupe)
  // during-day tile: {k:'G'|'E'|'X'|'C', crop, s, h, watered}
  const start =
    state === 'G' || state === 'E' || state === 'X'
      ? { k: state }
      : (() => {
          const [c, s, h] = state.split(':');
          return { k: 'C', crop: c, s: +s, h: +h, watered: false };
        })();

  function finish(t, e, segs, prog, curInvest) {
    // deliberate wilt is strictly dominated by free uproot — never end unwatered+growing
    if (t.k === 'C' && t.s < CROPS[t.crop].grow && !t.watered) return;
    // close any open investment segment (no payout follows)
    const fsegs = curInvest > 0 ? [...segs, [curInvest, 0]] : segs;
    // resolve night
    let next;
    if (t.k === 'C') {
      const grow = CROPS[t.crop].grow;
      if (t.s >= grow) next = enc(t.crop, t.s, t.h);
      else next = enc(t.crop, t.s + 1, t.h);
    } else next = t.k;
    const key = `${next}|${e}|${prog}|${fsegs.map((s) => s.join(':')).join(',')}`;
    if (!out.has(key)) out.set(key, { e, segs: fsegs, prog, next });
  }

  function rec(t, e, segs, prog, curInvest, depth) {
    if (depth > 24) return;
    finish(t, e, segs, prog, curInvest);
    if (t.k === 'G' && e + 1 <= E) rec({ k: 'E' }, e + 1, segs, prog, curInvest, depth + 1);
    else if (t.k === 'X' && e + 1 <= E) rec({ k: 'E' }, e + 1, segs, prog, curInvest, depth + 1);
    else if (t.k === 'E') {
      for (const c of builds)
        if (e + 1 <= E)
          rec(
            { k: 'C', crop: c, s: 0, h: 0, watered: false },
            e + 1,
            segs,
            prog,
            curInvest + CROPS[c].cost,
            depth + 1,
          );
    } else if (t.k === 'C') {
      const def = CROPS[t.crop];
      if (t.s >= def.grow) {
        // ripe: harvest (free) or uproot (free)
        const last = t.h + 1 >= (def.reyield ?? 1);
        const nsegs = [...segs, [curInvest, def.sell]];
        const dp = oc === 'any' || t.crop === oc ? 1 : 0;
        if (last) rec({ k: 'E' }, e, nsegs, prog + dp, 0, depth + 1);
        else
          rec(
            { k: 'C', crop: t.crop, s: def.grow - def.regrow, h: t.h + 1, watered: false },
            e,
            nsegs,
            prog + dp,
            0,
            depth + 1,
          );
        rec({ k: 'E' }, e, segs, prog, curInvest, depth + 1); // uproot
      } else {
        // growing: water / feed / uproot
        if (!t.watered && e + 1 <= E)
          rec({ ...t, watered: true }, e + 1, segs, prog, curInvest, depth + 1);
        if (allowFeed && e + 1 <= E)
          rec({ ...t, s: t.s + 1 }, e + 1, segs, prog, curInvest + FEED_COINS, depth + 1);
        rec({ k: 'E' }, e, segs, prog, curInvest, depth + 1); // uproot (loses investment)
      }
    }
  }
  rec(start, 0, [], 0, 0, 0);

  // prune dominated: same next & prog & seg-signature-cost → keep min energy... keep simple:
  // group by (next, prog); drop options strictly dominated on (e, totalInvest, totalPayout).
  const opts = [...out.values()];
  const kept = [];
  for (const a of opts) {
    const aInv = a.segs.reduce((s, [i]) => s + i, 0);
    const aPay = a.segs.reduce((s, [, p]) => s + p, 0);
    let dom = false;
    for (const b of opts) {
      if (b === a) continue;
      const bInv = b.segs.reduce((s, [i]) => s + i, 0);
      const bPay = b.segs.reduce((s, [, p]) => s + p, 0);
      if (
        b.next === a.next &&
        b.prog >= a.prog &&
        b.e <= a.e &&
        bInv <= aInv &&
        bPay >= aPay &&
        (b.prog > a.prog || b.e < a.e || bInv < aInv || bPay > aPay)
      ) {
        dom = true;
        break;
      }
    }
    if (!dom) kept.push(a);
  }
  kept.sort((a, b) => a.e - b.e);
  chainCache.set(ck, kept);
  return kept;
}

// ---- cross-tile coin solvency ------------------------------------------------
// segments: [invest, payout][] per tile in order; can we interleave to stay >= 0?
function solvent(coins, tileSegs) {
  const queues = tileSegs.map((s) => [...s]).filter((q) => q.length);
  let bal = coins;
  let moved = true;
  while (queues.some((q) => q.length)) {
    if (!moved) return false;
    moved = false;
    // 1) any affordable profitable segment (payout >= invest): min invest first
    let bi = -1,
      bestInv = Infinity;
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
    // 2) else affordable unprofitable: max payout first
    let bp = -1,
      bestPay = -1;
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

// ---- BFS over nights -----------------------------------------------------------
const COIN_CAP = 300;

export function solve({
  tiles,
  coins,
  energy,
  builds,
  target,
  maxNights,
  allowFeed = true,
  objectiveCrop = 'any',
  verbose = false,
}) {
  let frontier = new Map();
  const key = (c, p, ts) => `${c}|${p}|${[...ts].sort().join(',')}`;
  frontier.set(key(coins, 0, tiles), { coins, prog: 0, tiles });

  let best = null;
  const maxProgByNight = [];
  for (let night = 0; night <= maxNights; night++) {
    const next = new Map();
    let maxProg = 0;
    for (const st of frontier.values()) {
      maxProg = Math.max(maxProg, st.prog);
      // enumerate: choose one chain per tile, respecting energy + solvency.
      // Sort tiles so identical states are adjacent; force non-decreasing option
      // indices across identical tiles to skip symmetric permutations.
      const sorted = [...st.tiles].sort();
      const perTile = sorted.map((t) => tileChains(t, energy, builds, allowFeed, objectiveCrop));
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
          const prog = st.prog + choice.reduce((s, o) => s + o.prog, 0);
          if (prog >= target) {
            if (best === null || night < best) best = night;
            return;
          }
          if (night === maxNights) return;
          const c = Math.min(COIN_CAP, bal);
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
    if (verbose) console.log(`  night ${night}: states=${frontier.size} maxProgSoFar=${maxProg}`);
    if (best !== null && best <= night) break;
    // Pareto prune: within the same board multiset, drop states dominated on (coins, prog)
    const byBoard = new Map();
    for (const st of next.values()) {
      const bk = [...st.tiles].sort().join(',');
      let arr = byBoard.get(bk);
      if (!arr) byBoard.set(bk, (arr = []));
      arr.push(st);
    }
    frontier = new Map();
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
    if (frontier.size === 0) break;
  }
  return { minNights: best, maxProgByNight };
}

export function clearCache() {
  chainCache.clear();
}
export const tiles = (spec) => {
  // spec like { G: 9 } or array of states
  if (Array.isArray(spec)) return spec;
  const out = [];
  for (const [k, n] of Object.entries(spec)) for (let i = 0; i < n; i++) out.push(k);
  return out;
};
export { CROPS, enc };
