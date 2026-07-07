# Tier-1 Crop Roles — grow times + re-yield

**Date:** 2026-07-07 · **Branch:** feature/tier1-crop-roles · **Roadmap item:** M2 — full crop set with grow-time / value curves

## Goal

Replace the prototype's four look-alike crops (all ripen in a fixed 3 nights) with the designed
**Tier-1 set** — Carrot / Potato / Tomato — each with a distinct **grow time**, and give **Tomato a
re-yield** (harvest several times before replanting). This makes crop choice a real decision (see
`docs/design/DESIGN.md` §5 + the model) and is the foundation the rest of the economy sits on.

## Approach

- `stage` becomes **watered-nights of growth, 0..grow**; a crop is ripe when `stage >= grow` (was a
  fixed `stage >= 3`). `grow` lives on `CropDef`.
- `CropDef` gains `grow`, optional `reyield` (total harvests) + `regrow` (nights to re-ripen). Tile
  gains `harvests` (count so far).
- Re-yield harvest: if more harvests remain, drop the tile back to `grow - regrow` stages (re-ripens
  in `regrow` nights) instead of clearing it.
- Renderer stays dumb about rules: it draws from a pure `visualStage(t)` (maps `stage/grow` → the 4
  sprite stages) and `isRipe(t)` (sparkle) imported from `tiles.ts` — single source of truth for
  "ripe". `CROP_COLORS` (`Record<CropId, …>`) narrowing forces every crop-keyed spot to update.
- Numbers from the committed model (`scripts/little-acre-model.mjs`): Carrot 4/2n/20 · Potato 6/3n/34
  · Tomato 12/4n/18 ×3 (regrow 2). Tunable — first pass.
- Save: bump `SAVE_VERSION` → 2; normalise board tiles (default `harvests: 0`; null out any crop id
  no longer in `CROPS`, e.g. old wheat/lettuce saves).

## Steps

- [ ] `tiles.ts`: narrow `CropId` to carrot/potato/tomato; add `grow`/`reyield`/`regrow` to `CropDef`
      + the Tier-1 table; add `harvests` to `Tile` + `createBoard`; rewrite `isRipe`/`needsWater`/
      `resolveNight` off per-crop `grow`; add `cropGrow` + `visualStage` pure helpers.
- [ ] `store.ts`: re-yield harvest branch; update `seen` defaults; plant sets `harvests: 0`.
- [ ] `save.ts`: `SAVE_VERSION` 2 + tile normaliser (harvests default, drop unknown crops).
- [ ] `board-renderer.ts`: import `isRipe`/`visualStage`; draw via them; update `CROP_COLORS`
      (potato) + the ripe-body branch (carrot/potato = root, tomato = fruit).
- [ ] `StoreModal.tsx`: update the Guide crop list to carrot/potato/tomato.
- [ ] Tests: grow-time per crop, re-yield loop (harvest → regrow → re-ripe → clear after N),
      wilt still works, harvest payout ×Bloom, save normalises an unknown crop.

## Manual test steps

- [ ] New farm: the starting carrot is ripe → tap to harvest for coins + a burst.
- [ ] Plant a Tomato, water 4 nights → ripe; harvest → it stays and re-ripens in 2 nights; repeat
      until it finally clears after 3 harvests.
- [ ] Plant a Carrot vs a Potato; Carrot ripens in 2 sleeps, Potato in 3.
- [ ] Edge: leave a growing crop unwatered over a Sleep → it wilts (unless Scarecrow).
- [ ] Edge: reload mid-run → board (incl. tomato `harvests` count) restores.

## Out of scope for this session

Tier-2 crops (Hops/Blueberry/Cauliflower), seed unlocks, gathering throttle, tool tiers, real Shop
purchases. Just the Tier-1 crop model.

---

<!-- Fill in during/after -->

## What actually happened

Built as planned. `stage` is now watered-nights of growth (`0..grow`), ripe at `stage >= grow`.
Added `cropGrow`, `visualStage`, and `harvestPatch` as pure helpers so the store and renderer share
one definition of ripeness / growth. Tomato re-yields 3× (regrows to stage 2 each reap, re-ripens in
2 nights) then clears. Renderer imports `isRipe`/`visualStage` (pure model, no store/React/DOM — keeps
crop rules single-sourced). Save bumped to v2 with `normalizeTile` (backfills `harvests`, nulls any
unknown crop id). All four gates clean; 25 tests (+5).

## Files created / modified

- `src/lib/game/tiles.ts` — CropId narrowed; `grow`/`reyield`/`regrow` on CropDef; Tier-1 table;
  `harvests` on Tile; `cropGrow`/`visualStage`/`harvestPatch`; grow-aware isRipe/needsWater/resolveNight.
- `src/lib/game/store.ts` — harvest via `harvestPatch`; `harvests: 0` on plant/place; seen defaults.
- `src/lib/game/save.ts` — SAVE_VERSION 2 + `normalizeTile`.
- `src/lib/renderer/board-renderer.ts` — draw via `visualStage`/`isRipe`; CROP_COLORS potato; ripe body.
- `src/components/ui/StoreModal.tsx` — Guide crop list (carrot/potato/tomato).
- `src/lib/game/tiles.test.ts`, `src/lib/game/save.test.ts` — coverage for the above.

## Deferred to next session

Visual/Playwright pass on the prod build (potato palette + tomato re-yield beat on-screen). Tier-2
crops, seed unlocks, gathering throttle, tool tiers, real Shop purchases.

## Status

- [ ] In progress - [x] Complete - [ ] Partial — see deferred
