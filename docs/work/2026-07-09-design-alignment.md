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
- [ ] Restyle MainMenu + PuzzleSelect (1a/1b): title treatment, chunky buttons, total-star chip,
      section headers, card anatomy (icon swatch · objective line · stars · "done in par!" tag ·
      locked state)
- [ ] Restyle in-puzzle chrome + banners + result modal (1c/1d/1e) keeping WS-D features
- [ ] Gates: lint / type-check / test / build; Playwright screenshots vs mockups
- [ ] Integrate, push

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

## Files created / modified

## Deferred to next session

## Status

- [x] In progress - [ ] Complete - [ ] Partial — see deferred
