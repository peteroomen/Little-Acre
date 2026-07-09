# Megaslice 2: Playtest Response + Expansion + Design Wave

**Date:** 2026-07-09 · **Branch:** `claude/game-puzzle-potential-bu4nri` (PR #6 updates in place) ·
**Roadmap items:** playtest fixes · M2 board expansion · Design Drop (store, farm HUD, sunrise)

## Goal

Act on the owner's garden playtest: make puzzle wins accessible with stars as the stretch
(goal-tier star system), guard destructive uproots, start Freeplay at 1 tile with bought
expansion (1×1 → 3×3 → 5×5), then two design-driven slices from the mockup drop.

## Owner playtest findings

1. Market Day unwinnable in practice — the bare win is the knife-edge (zero wasted energy +
   single-tile reuse insight). Solver-feasible, human-hostile.
2. Uproot destroys growing crops with no warning.
3. Freeplay should start at 1 tile; expansion is bought (tiers 1×1 / 3×3 / 5×5).
4. Night-threshold stars feel pointless — owner asks for goal-based tiers or optimisation-based.
   **Decision: goal tiers** (1★ base objective with slack · 2★ stretch · 3★ = solver-proven max
   within the night limit). Optimization stays the soul of 3★; entry becomes fun.

## Approach — 4 workstreams, 2 waves, Opus agents, same integration branch

### Wave 1

**S1 — Star tiers + playtest fixes** (`puzzles.ts`, `store.ts`, puzzle UI, harness)

- `stars` becomes goal tiers on the objective metric: `{ two, three }` progress targets
  (objective count/amount = the 1★ base). Win flow: reach 3★ tier → instant win; night limit
  reached → evaluate progress (≥ base = win with earned tier, else lose). 0-night puzzles get an
  **"End Day"** affordance (Sleep button repurposed; no more accidental-loss guard needed on top).
- Retier all 8 puzzles with the solver: 3★ == exact max progress within nightLimit; base gets
  real slack. Market Day: more energy (e.g. 13⚡), tiers ~2/3/4 carrots. Patient Vine: 2/3/4
  (instant-harvest = 2★, hold-the-fruit = 3★ — no longer a loss).
- Harness v3: validates every tier (base comfortably feasible, 3★ == solver max, 2★ strictly
  between); drops night-par checks.
- **Uproot confirm**: radial commit on uproot over a live crop arms a confirm (same pattern as
  the sleep guard) instead of instantly pulling it.

**S2 — Freeplay board expansion** (`tiles.ts`, `save.ts` v5, `store.ts`, renderer, Game)

- Board size becomes state: tiers **1×1 → 3×3 → 5×5**, bought with coins (Store; costs in one
  tunable table — owner balance pass pending). New Freeplay starts 1×1 wild grass.
- Renderer/Game handle N×N (scale/center per size); puzzles stay pinned 3×3.
- Save v5: persist tier + variable board; v4 saves migrate to the 3×3 tier with their board.

### Wave 2 (on integrated Wave 1)

**S3 — Store restyle + Expand tab** *(design-driven — interactive mockup Store surface)*
Store modal to mockup: tabs, real Boost cards restyle, presentational Craft recipe cards
(locked-recipe state), and the new **Expand** purchases (tier cards: size preview, cost,
owned state) wired to S2.

**S4 — Farm HUD + radial restyle + Sunrise Report** *(design-driven — interactive mockup Farm /
Radial / Sunrise Report surfaces)*
Farm-screen HUD chips/energy/Sleep per mockup (fixes the 370px Sleep clipping), radial slice
anatomy per mockup, and the new **Sunrise Report** card (grew / wilted / restocked / recovered)
on wake.

## Steps

- [x] Wave 1: S1 + S2 (Opus, worktrees) → review, integrate, full gates + harness
- [x] Wave 2: S3 + S4 on integrated base → review, integrate
- [x] Full gate: lint / type-check / test / build / check-puzzle-pars
- [x] Playwright smoke + screenshots; push (PR #6 updates)

## Manual test steps

- [ ] Market Day: winnable at a relaxed pace (1★), 3★ still demands the perfect line
- [ ] Any tutorial: stars show goal ladder; reaching top goal ends with 3★ pop
- [ ] Uproot a growing crop → confirm required; wilted/empty actions unaffected
- [ ] New freeplay: starts 1 grass tile → buy 3×3 → board grows, save survives reload; old save
      loads as 3×3 unharmed; buy 5×5 → renderer scales
- [ ] Store: Expand tab per mockup; Sunrise Report appears after Sleep with correct tallies
- [ ] Edge: puzzle mode still always 3×3; reduced-motion on new surfaces

## Out of scope

Processing/Craft mechanics (Craft stays presentational), minigame overlays, landscape reflow,
economy numbers beyond placeholder expansion costs.

---

<!-- Fill in during/after -->

## What actually happened

4 Opus agents in 2 waves, orchestrator-integrated; PR #6 updated in place.

- **S1 — goal-tier stars:** `stars: {two, three}` are progress targets on the objective metric;
  base = 1★ with slack, 3★ = solver-proven exact max (3★+1 infeasible), instant win at 3★,
  deadline scoring otherwise. All 8 puzzles retiered (first-sprout 3/6/9 @10⚡ · dry-spell 4/5/6 ·
  vine-and-again 4/6/8 nl7 · market-day 2/3/4 @13⚡ — the playtest unwinnability fix ·
  patient-vine 2/3/4 (early-cash = 2★) · seed-money 3/5/6 nl8 · thirsty-work 12/17/22 ·
  waterworks 4/6/9). 0-night Sleep → **End Day**. **Uproot confirm** (`uprootNeedsConfirm`,
  arm-then-confirm like the sleep guard). Harness v3 validates ladder/base-slack/tier3==max.
- **S2 — board expansion:** `BOARD_TIERS` 1×1(0c)/3×3(150c)/5×5(600c placeholder costs),
  `createFreeplayBoard`/`expandBoard` (re-centres old square, state preserved, pure+tested),
  `boardTier` + `buyExpansion`, save **v5** (v4 → 3×3 tier verbatim), renderer N×N with per-size
  scale + deterministic geometry, new freeplay starts 1 wild grass tile; puzzles pinned 3×3.
- **S3 — Store restyle (design):** mockup shell/tabs; Expand tier cards (Current/next/locked)
  wired to buyExpansion; Boost cards restyled; presentational Craft tab (ingredient chips,
  locked "Needs Furnace" silhouettes, nothing pretend-interactive); Almanac restyle; Rebloom
  demoted to a quiet row.
- **S4 — HUD/radial/Sunrise (design):** HUD chips per mockup, **370px Sleep clip fixed**
  (stacked currency chips); radial petals with swatch/label/cost chips + unaffordable dim +
  amber highlight (geometry untouched); **Sunrise Report** card on freeplay wake — additive
  `NightResult.restocked/recovered` tallies in resolveNight (+3 tests), `report` flag in store;
  puzzles keep the compact toast.

Two Wave-1 agents strayed into the shared checkout (branch switches + a staged inversion of
S2's work); restored from committed state, no loss; Wave-2 agents got explicit git discipline
and stayed clean. Final gates: lint / type-check / **135 tests** (110 → 135) / build / harness
92s — all green.

## Files created / modified

`src/lib/game/`: tiles.ts, save.ts (v5), store.ts, puzzles.ts, actions.ts (+ tests) ·
`src/lib/renderer/board-renderer.ts` · `src/components/`: Game.tsx, ui/Hud.tsx, ui/RadialMenu.tsx,
ui/SunriseReport.tsx (new), ui/StoreModal.tsx, ui/PuzzleOverlays.tsx, ui/PuzzleSelect.tsx ·
`src/app/globals.css` · `scripts/check-puzzle-pars.mjs` (v3)

## Deferred to next session

Expansion costs + Market Day/coin economy = owner balance pass (placeholders flagged in
BOARD_TIERS). Remaining Design-Drop roadmap items (menu board backdrop, minigame overlays,
landscape, token completion). docs/design/puzzles.md still describes old P1–P5. Radial radius
kept at 64 (mockup shows 98/112 — revisit with a feel pass since it lives in actions.ts).

## Status

- [ ] In progress - [x] Complete - [ ] Partial — see deferred
