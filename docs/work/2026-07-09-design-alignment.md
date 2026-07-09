# Design Alignment — menu, puzzle select, in-puzzle chrome

**Date:** 2026-07-09 · **Branch:** `claude/game-puzzle-potential-bu4nri` (continues the megaslice
integration branch) · **Roadmap item:** Design Drop 1a–1e

## Goal

The owner's design drop (`docs/design/mockups/`) becomes the visual system of record; this slice
restyles the five puzzle-facing surfaces to match it exactly: 1a Main menu, 1b Puzzle select,
1c in-puzzle chrome, 1d banner variants, 1e result modal. Everything else from the drop is
roadmapped (see `docs/ROADMAP.md` "Design Drop").

## Approach

One Opus agent implements from the mockup HTML (inline styles are the spec); orchestrator
integrates. Mockup hexes are translated into `--la-*` tokens in `globals.css` (most already match
the locked palette); shared treatments (notched sticker panel, pixel star, chunky menu button)
become small reusable components/classes instead of per-file copies. Behaviour is untouched —
store logic, WS-D's sleep guard / star pop / dusk badge / coins variant all survive the restyle.

## Steps

- [x] Commit design drop to `docs/design/mockups/` + roadmap the un-sliced surfaces
- [x] Restyle MainMenu + PuzzleSelect (1a/1b): title treatment, chunky buttons, total-star chip,
      section headers, card anatomy (icon swatch · objective line · stars · "done in par!" tag ·
      locked state)
- [x] Restyle in-puzzle chrome + banners + result modal (1c/1d/1e) keeping WS-D features
- [x] Gates: lint / type-check / test / build; Playwright screenshots vs mockups
- [x] Integrate, push

## Manual test steps

- [ ] Menu: title + three buttons match 1a (Settings shows "soon" state); Freeplay/Puzzles work
- [ ] Puzzle select: matches 1b — ★ total chip, Tutorials/Challenges headers, star pips per card,
      locked challenge card, par tag on a 3★ card
- [ ] Market Day: dusk banner per 1d; result modal per 1e (stars pop, par line)
- [ ] Edge: reduced-motion → static stars/banners; small viewport (370px) doesn't overflow

## Out of scope for this session

Farm HUD / radial / store restyles, Sunrise Report, fishing & mining overlays, menu live-board
backdrop, landscape reflow — all roadmapped under "Design Drop".

---

<!-- Fill in during/after -->

## What actually happened

One Opus agent implemented both slices from the mockup HTML; orchestrator integrated. ~60 new
`--la-*` surface tokens + shared treatments extracted once (`.la-notch-*`, sticker classes,
`PixelStar`/`PixelStarRow` in `src/components/ui/pixel.tsx`); no raw hex in TSX — per-puzzle card
swatches derive from `CROPS[crop].color`. All WS-D behaviours survived the reskin (sleep guard,
star pop, dusk badge, coins variant). Deliberate deviations, per agent report: puzzle-mode HUD
compacts to coins + energy + Sleep per mockup 1c (freeplay HUD unchanged — regression-checked);
kept the in-voice win/lose titles over the mockup's generic "Puzzle clear!"; kept a quiet ✕ quit
chip on the banner (only puzzle-exit affordance). Playwright screenshots of menu / select /
Market Day banner / result modal / freeplay HUD taken at 370×800. Gates: lint / type-check /
110 tests / build / harness 21.6s — all green.

## Files created / modified

`src/app/globals.css` · `src/components/ui/pixel.tsx` (new) · `MainMenu.tsx` · `PuzzleSelect.tsx`
· `PuzzleOverlays.tsx` · `Hud.tsx` · `docs/design/mockups/` (drop) · `docs/ROADMAP.md`

## Deferred to next session

Everything under ROADMAP "Design Drop" (farm HUD, radial, store + Craft, Sunrise Report, menu
board backdrop, fishing/mining overlays, token completion, landscape). Freeplay Sleep button
clips slightly at 370px (pre-existing — fold into the farm-HUD restyle).

## Status

- [ ] In progress - [x] Complete - [ ] Partial — see deferred
