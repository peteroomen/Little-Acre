# Playtest fixes — water gate + visual polish

**Date:** 2026-07-08 · **Branch:** fix/playtest-fixes · **Roadmap item:** M1 feel / bug triage (from live playtest)

## Goal

Four items from the owner's playtest of the Vercel build:

1. **Bug — can't water a tomato on its later day.** The store's water action still gated on the old
   fixed `stage < 3` (missed when Tier-1 added per-crop grow). A Tomato (grow 4) at stage 3 couldn't
   be watered, so it could never ripen — blocking puzzle 3 (Vine & Again) and tomatoes in Freeplay.
2. **Objective banner overlapped the HUD** in puzzle mode.
3. **Horizontal seam lines on the tile sides.**
4. **Dark diagonal streak across the dirt tiles.**

## What actually happened

- **Water gate:** `store.ts` water branch now uses `t.stage < cropGrow(t.crop)` (imported `cropGrow`).
  Verified via Playwright: a Tomato waters at stage 3 (energy ticks down) and ripens to harvest.
- **Banner:** `ObjectiveBanner` moved from `top-[72px]` → `top-[104px]`, clearing the two-row HUD
  (measured banner top = 104px, below the energy row).
- **Tile sides:** replaced the per-tile cube sides (which seamed on a contiguous slab) with a single
  `drawSkirt()` — two faces dropping from the board's front-bottom silhouette, drawn once before the
  tile-top loop. Removed the per-tile side + `edge` highlight line. No more interior seams.
- **Furrows:** softened `FURROW` (`rgba(120,85,45,.16)`) + stroke width 2 → 1.5, so plough rows read
  as faint texture instead of a dark streak.

## Files created / modified

- `src/lib/game/store.ts` — water gate uses `cropGrow`.
- `src/components/ui/PuzzleOverlays.tsx` — banner position.
- `src/lib/renderer/board-renderer.ts` — `drawSkirt()`, drop per-tile sides, thinner furrows.
- `src/lib/renderer/palette.ts` — softer `FURROW`.

## Manual test steps

- [x] Freeplay: water the starting Tomato (r1,c2) through stage 3 → it ripens → harvest pays out.
- [x] Puzzle: objective banner sits below coins/energy/Sleep, no overlap.
- [x] Board: tile sides are a clean slab; dirt has no dark streak.

## Status

- [ ] In progress - [x] Complete - [ ] Partial

## Deferred

The bigger **controls overhaul** (contextual tap + radial) and the **till action / grass-start
tutorial** stay as the next slice — the tutorial starting on unhoed land needs the new Till action.
