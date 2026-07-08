# Main Menu + Freeplay + Tutorial Puzzles

**Date:** 2026-07-07 · **Branch:** feature/menu-puzzles · **Roadmap item:** M2/M4 — Modes (Freeplay + Puzzle), per DESIGN.md §3

## Goal

Boot into a cozy Main Menu; play the existing farm as **Freeplay** OR run one of **3 tutorial
Puzzles** (goal + night limit + star scoring) alongside it. Puzzles are ephemeral and never
touch the Freeplay save.

## Approach

App-level screen state in the store (`screen: menu | puzzleSelect | game`), not URL routes. A
new `mode: freeplay | puzzle`. Pure puzzle model in `src/lib/game/puzzles.ts` (defs + `starsFor`
+ pure progress/night reducers), Vitest-tested. Objective progress + night counting hook into the
existing harvest branch of `clickTile` and the night-resolve in `sleep`. Best stars persist to a
**separate** localStorage key `little-acre-puzzles`; the Freeplay save (`little-acre-v1`) is
untouched — `store.save()` and `loop.ts` autosave both no-op in puzzle mode.

Key decisions:

- Puzzle boards are still 3×3 (renderer/save assume 9 tiles); the objective tile count is realised
  as N tilled tiles + grass fillers.
- Store button/StoreModal are hidden in puzzle mode (keeps puzzles self-contained — no upgrades/
  rebloom mid-puzzle, matching the feasibility tuning). The objective banner carries the Quit exit.
- Freeplay exit-to-menu lives in the StoreModal header (unobtrusive).
- Star thresholds ship as authored — feasibility verified by hand (all three sit at par = optimal
  nights), so no tuning was needed:
  - first-sprout: carrot 2n → 2 nights optimal → `three:2`.
  - dry-spell: potato 3n → 3 nights optimal → `three:3`.
  - vine-and-again: tomato 4n + regrow 2n → 6 nights optimal (2 tiles × 2 harvests = 4) → `three:6`.

## Steps

- [x] `puzzles.ts` — PuzzleDef, PUZZLES (3 tutorials), starsFor, pure reducers + unlock helper
- [x] `puzzles.test.ts` — starsFor bands/boundaries, PUZZLES integrity, harvest/night transitions
- [x] Store: `screen`/`mode`/`puzzle`/`puzzleStars` + actions; hook harvest + night tracking
- [x] Save: `loadPuzzleStars`/`savePuzzleStars` (separate key); `save()` no-op in puzzle mode
- [x] loop.ts: autosave skips in puzzle mode
- [x] App.tsx: render MainMenu / PuzzleSelect / Game by `screen`; call `init()` once
- [x] MainMenu, PuzzleSelect, ObjectiveBanner, PuzzleIntro, PuzzleResult components
- [x] BuildPicker restricts to `puzzle.builds`; Hotbar hides Store in puzzle mode
- [x] StoreModal: Exit-to-Menu (freeplay)

## Manual test steps

- [ ] Boot → Main Menu. Freeplay → plant carrot → water → Sleep → harvest. Exit to menu, re-enter
      Freeplay → state restored (save round-trips).
- [ ] Puzzles → first-sprout locked-check: only puzzle 1 is clickable. Play it optimally (harvest 3
      carrots by night 2) → 3★ result modal → Puzzles → puzzle 2 now unlocked.
- [ ] Edge: exceed the night limit without finishing → "Out of nights" lose modal → Retry.
- [ ] Edge: start a puzzle, play a few nights, exit → Freeplay save unchanged (no puzzle bleed).

## Out of scope for this session

Puzzles P3–P5 (processing/crafting chains — need machines), settings screen, animated star fill,
puzzle-model validation script wiring.

---

## What actually happened

Implemented as planned. All three tutorial puzzles verified feasible at par by hand — no
threshold tuning required. Store gained `screen`/`mode`/`puzzle`/`puzzleStars`; harvest tracking
lives in `clickTile`'s ripe branch, night tracking in `sleep`'s grow-resolve. `save()` guards on
`mode==='puzzle'` (belt) and `loop.ts` skips too (braces) so the Freeplay save is never touched by
a puzzle. Store button hidden in puzzle mode; ObjectiveBanner hosts Quit; StoreModal hosts Exit to
Menu in freeplay.

## Files created / modified

Created: `src/lib/game/puzzles.ts`, `src/lib/game/puzzles.test.ts`,
`src/components/ui/MainMenu.tsx`, `src/components/ui/PuzzleSelect.tsx`,
`src/components/ui/PuzzleOverlays.tsx` (ObjectiveBanner + PuzzleIntro + PuzzleResult).
Modified: `store.ts`, `save.ts`, `loop.ts`, `App.tsx`, `Game.tsx`, `BuildPicker.tsx`,
`Hotbar.tsx`, `StoreModal.tsx`.

## Deferred to next session

Puzzles P3–P5, settings screen, star-fill animation.

## Status

- [x] Complete
