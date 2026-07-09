# Megaslice: Puzzle-Vision Alignment

**Date:** 2026-07-08 · **Branch:** `claude/game-puzzle-potential-bu4nri` · **Roadmap item:** M2+ — puzzle mode becomes the strategic heart

## Goal

Fix the three balance breaks the exact solver found (feed trivialises the tutorials, tomato is
strictly dominated, "Thirsty Work" premise fails), then widen the puzzle space along the axes the
analysis proved out: verb gating, new objective kinds, pre-grown boards, spatial sprinklers, and
five new solver-validated puzzles — integrated on one branch for owner playtesting.

## Background (solver findings, this session)

- `scripts/puzzle-solver.mjs` searches every legal line of play (same-day feed chains,
  fruit-holding, uproot) and reproduces all three authored pars exactly with feed off.
- **Break 1:** feed is available in puzzle mode → First Sprout & Dry Spell win in 0 nights,
  Vine & Again in 2 (3★ threshold 6). `node scripts/check-puzzle-pars.mjs` shows this live.
- **Break 2:** carrot and tomato both amortise to exactly 3 energy/harvest, but carrot has 2×
  the per-tile throughput and a cheaper seed → tomato is strictly dominated for count objectives.
- **Break 3:** docs P2 "Thirsty Work" (energy scarcity ⇒ tomato wins) fails at E=8 *and* E=6 —
  carrot-only matches optimal play.
- **Proven depth:** "hold the ripe fruit" is optimal in triage boards (4 vs 3 harvests);
  zero-night feed-chain puzzles have knife-edge feasibility (10⚡/20c solvable, 9⚡ or 19c not).

## Approach — 4 workstreams, 2 waves, single integration branch

Claude (this session) plans, reviews, and integrates; 4 Opus agents implement in parallel
worktrees. Wave 1 lands rules + tooling; Wave 2 builds puzzles + UI on top of them.
Every wave ends with `pnpm lint && pnpm type-check && pnpm test` clean plus
`node scripts/check-puzzle-pars.mjs --strict` green.

### Wave 1

**WS-A — Core rules & balance** (`src/lib/game/tiles.ts`, `actions.ts`, `store.ts`, save v5)

- Tomato retune so the keep-alive niche is real: direction `regrow 2→1, reyield 3→4`
  (steady-state 1 fruit/night/tile at 1⚡ once ripe); exact numbers locked by WS-C's solver —
  acceptance: an energy-tight scenario exists where tomato beats carrot, and carrot stays best
  for short sprints.
- **Sprinkler waters its own tile + orthogonal neighbours** (one ruleset, freeplay included) —
  the game's first spatial mechanic. `resolveNight` gains neighbour lookup via tile r/c.
- **Deterministic gathering:** fish/mine payouts become fixed values (keep the *stock/charge*
  rhythm; gem cadence deterministic e.g. every 3rd pull) so gathering is puzzle-safe and the
  board stays reproducible.
- `ActionCtx` gains verb gating (`allowFeed`, `allowStructures` already exists) so puzzle defs
  can turn feed off; store threads it through.

**WS-C — Solver v2 + validation** (`scripts/puzzle-solver.mjs`, `check-puzzle-pars.mjs`)

- Extend the solver: structures (sprinkler adjacency, scarecrow pause), coin objectives,
  per-puzzle verb gating, deterministic gather income.
- `check-puzzle-pars.mjs` grows to validate EVERY shipped PuzzleDef: 3★ threshold == optimal
  nights, and the knife-edge guarantee (one fewer night / one fewer key resource ⇒ infeasible).
- Lock WS-A's tomato numbers via solver sweeps.

### Wave 2 (rebased on Wave 1)

**WS-B — Puzzle engine v2 + new puzzles** (`src/lib/game/puzzles.ts`, `store.ts` hooks)

- `PuzzleDef` gains: `allowFeed` (default **off** for the 3 tutorials → original star tunings
  hold again), structure builds, pre-grown board authoring (crop/stage/harvests per tile),
  objective kinds `harvest` (existing) + `coins` (earn N).
- Five new solver-validated puzzles:
  1. **Market Day** — 0-night feed-chain speedrun (10⚡/20c knife edge).
  2. **The Patient Vine** — pre-grown triage; par requires holding ripe fruit (teaches banking).
  3. **Seed Money** — bootstrap ladder (4c start; carrots fund the potato objective).
  4. **Thirsty Work (fixed)** — energy-scarce crop choice, premise verified against retuned tomato.
  5. **Waterworks** — sprinkler placement/coverage under a coin budget (first spatial puzzle).

**WS-D — UI/UX** (`components/ui/*`, renderer hint)

- Radial hides gated verbs in puzzle mode; objective banner variants (coin progress, "today
  only" for 0-night); PuzzleSelect sections (Tutorials / Challenges); sprinkler coverage
  preview (highlight the plus-shape while placing); result-screen copy for the new puzzles.

## Steps

- [x] Confirm plan with owner (this doc)
- [x] Wave 1: launch WS-A + WS-C agents (worktrees, Opus), review diffs, integrate, gates green
- [x] Wave 2: launch WS-B + WS-D agents on the integrated base, review, integrate
- [x] Full gate: lint / type-check / test / `check-puzzle-pars.mjs` / build
- [x] Playwright smoke (menu → puzzle select shelves → Market Day today-only banner; screenshots)
- [x] Push branch for owner testing; PR after owner feel-pass

## Manual test steps

- [ ] Tutorials: First Sprout offers no Feed in the radial; 3★ still lands at 2 nights
- [ ] Market Day: win without sleeping once; verify 9⚡ loadout variant is impossible
- [ ] Patient Vine: harvest tomato immediately → best 3/4 (lose); hold it → 4/4 win
- [ ] Waterworks: sprinkler waters plus-shape; moving it one tile breaks par
- [ ] Freeplay: sprinkler adjacency works; tomato steady-state feels strong on few tiles;
      fish/mine payouts repeat deterministically; old save (v4) migrates
- [ ] Edge: reload mid-puzzle → freeplay save untouched; puzzle stars persist

## Out of scope for this session

Processing chains (docs P3/P5 — Smokers/Kegs), tool tiers, board expansion, Tier-2 crops,
settings screen, Supabase. Star-fill animation. Freeplay economy rebalance beyond tomato.

---

<!-- Fill in during/after -->

## What actually happened

Ran as planned: 4 Opus agents in isolated worktrees (2 waves), orchestrator integrated each onto
this branch. Two agents were interrupted by session token limits and resumed cleanly.

- **WS-A (rules):** tomato → reyield 4 / regrow 1 (2⚡/harvest amortized — the keep-alive niche is
  real); sprinklers water a plus-shape via pure `isAutoWatered`; `needsWater(t, tiles)` is
  board-aware; gathering deterministic (`FISH_COINS 18`, `ORE_COINS 13`, gem on a rock cycle's
  last pull); `ActionCtx.allowFeed` + `PuzzleDef.allowFeed` (tutorials off — kills the 0-night
  feed cheese). No save bump needed.
- **WS-C (solver v2):** structures + positional/spatial mode (symmetry-pruned), scarecrow pause,
  coins-earned objectives, deterministic gather income, injectable crop defs; harness validates
  par == optimal AND par−1 infeasible per puzzle + old-rules regression (2/3/6) + pinned feature
  checks. Sweep proved the retune creates tomato's niche only at E≤5 → Thirsty Work authored at 5⚡.
- **Integration retune:** vine-and-again stars {three: 5, two: 6} (solver-locked; retuned vine).
- **WS-B (puzzles):** objective union (harvest | coins-earned), `section` shelves, `boardFrom`
  rich boards, nightLimit-0 flow, `allowStructures`; five knife-edge challenges — market-day
  (0 nights, feed chains), the-patient-vine (hold-the-ripe-fruit, par 4), seed-money (bootstrap,
  par 5), thirsty-work (5⚡ crop mix, par 7 — mixing beats both mono-crops), waterworks (sprinkler
  placement, par 2). Corrections found: thirsty-work par 7 not 8 (mixed line); patient-vine's
  vine starts harvests=1 or the retuned tomato dissolves the triage.
- **WS-D (UI):** tutorial/challenge shelves; banner variants (coins tint, today-only dusk badge);
  Sleep guard in 0-night puzzles (2-tap confirm); result modal staggered star-pop + par line;
  `BoardRenderer.setCoverageHint()` sprinkler plus-glow wired from Game's radial subscription.
  Playwright smoke passed (select shelves, Market Day banner).

Final gates: lint / type-check / **110 tests** (77 → 110) / build / harness 22s all green.

## Files created / modified

- `src/lib/game/`: tiles.ts, actions.ts, store.ts, puzzles.ts (+ tests: tiles, actions, puzzles)
- `src/lib/renderer/`: palette.ts, board-renderer.ts
- `src/components/`: Game.tsx, ui/Hud.tsx, ui/PuzzleSelect.tsx, ui/PuzzleOverlays.tsx
- `src/app/globals.css`
- `scripts/`: puzzle-solver.mjs (new, exact-play solver), check-puzzle-pars.mjs (new, harness)
- `docs/design/claude-design-prompt.md` (refreshed), this plan file

## Deferred to next session

- Owner feel-pass on live build, then PR. Coverage preview + star-fill not Playwright-driven
  (need canvas drag / a completed run) — verify manually.
- No shipped puzzle uses a `coins` objective yet (engine/solver/UI all support it).
- docs/design/puzzles.md still describes the old P1–P5 (processing chains P3–P5 remain future);
  update alongside the processing slice.
- Freeplay-economy knock-ons of the tomato retune + deterministic gathering (owner balance pass).

## Status

- [ ] In progress - [x] Complete - [ ] Partial — see deferred
