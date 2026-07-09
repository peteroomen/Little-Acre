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

- [ ] Wave 1: S1 + S2 (Opus, worktrees) → review, integrate, full gates + harness
- [ ] Wave 2: S3 + S4 on integrated base → review, integrate
- [ ] Full gate: lint / type-check / test / build / check-puzzle-pars
- [ ] Playwright smoke + screenshots; push (PR #6 updates)

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

## Files created / modified

## Deferred to next session

## Status

- [x] In progress - [ ] Complete - [ ] Partial — see deferred
