# Super-slice — "Hands on the Farm"

**Date:** 2026-07-08 · **Branch:** feature/hands-on-farm · **Roadmap:** M1 feel + M2 economy (interaction layer)

## Goal — one build genuinely worth testing

Replace the clunky Click/Build tool modes with a real **contextual-tap + radial** interaction, wire
up the **full set of farming verbs** (so the radial has real content), make **gathering worth doing**,
and **retune the tutorials** to teach through the new controls. After this, Freeplay + the puzzles
should feel like a coherent cozy game to sit with — not a pile of wired mechanics.

Testable on the branch's **Vercel preview URL** before we merge to production.

## The interaction model (decided)

- No Click/Build modes, no BuildPicker. **Tap a tile → it acts.**
- 0 choices → nothing. 1 action → do it on tap. >1 actions → **press-hold radial**: the radial blooms
  anchored at the tile with the **default under your thumb**; a quick tap-release does the default,
  drag-to-a-slice + release picks another. (Option 2 — discoverable, still one motion.)
- Tools become passive: owning a better tool upgrades the action later (no tool-swapping).

## Scope — 5 phases

### A. Interaction core
- Pure **`src/lib/game/actions.ts`**: `actionsFor(tile, ctx) → { primary, ring }` + radial geometry
  helpers (`radialHiFor`, slice angles). Fully Vitest-tested.
- Store: drop `tool`/`selectedBuild`/`useTool`; add `radial` state + `beginTap` / `setRadialHi` /
  `commitRadial` / `closeRadial`, and per-action executors. Radial gesture wired in `Game.tsx`
  (pointerdown/move/up). New **`RadialMenu.tsx`** (DOM, at tile center, default centered).
- Delete `BuildPicker`; slim `Hotbar` to just Store + menu.

### B. The full verb set (radial content)
Till (grass→soil) · Plant (per crop) · Water · **Fertilize** (feed: pay coins to advance a stage —
its first real home) · Harvest · Uproot · Clear (wilted) · Fish · Mine · Place structure
(Sprinkler/Scarecrow) · Shape land (Pond/Rock/Flowers). Each gets an executor + fx + cost.

### C. Living board (gathering worth doing)
- **Pond** holds a fish **stock** (start 4) that refills +2/night; an empty pond reads "restocking".
- **Rock** node **depletes** per mine (3 pulls) then goes dormant, respawning after 3 nights.
- New Tile fields (`pondStock`, `rockCharges`/`dormant`) → **SAVE_VERSION 4** + normaliser.
- Makes fishing/mining tended side-plots, not infinite ATMs (DESIGN.md §6).

### D. Tutorials retuned (teach via the new controls)
- **First Sprout starts on grass** → teaches **Till → Plant → Water → Harvest** (carrots).
- Dry Spell (watering discipline / wilt, potato) · Vine & Again (re-yield, tomato) unchanged in
  spirit; re-verify star pars (P1 gains a till day). Restrict each puzzle's radial to its taught verbs.

### E. Feel / juice
- Per-verb fx (till dust, fertilize sparkle, splash, coin fountain), a quick radial bloom animation,
  **haptics** (`navigator.vibrate`) on commit, and a subtle "needs water / ready / depleted" tile hint.
- Respect `prefers-reduced-motion`.

## Explicitly deferred
Board expansion beyond 3×3 · Tier-2 crops/seed unlocks · crafting & tool tiers · combat/critters ·
audio. (These are their own later slices.)

## Build approach
Build A+B first (the model + gesture — I'll do this carefully by hand). Once the action model exists,
C (gathering throttle) and D (tutorial retune) can go in parallel; E is woven through. Lands as one
branch → PR (with a Playwright pass) for review; the preview deploy is testable throughout.

## Manual test steps
- [ ] Freeplay: tap empty soil → radial of crops → plant; tap growing crop → waters (default);
      press-hold a growing crop → radial with Fertilize/Uproot; tap grass → Till (or land radial);
      tap ripe → harvest.
- [ ] Fish a pond 4×; it empties; Sleep → it restocks. Mine a rock to dormant; Sleep ×3 → it returns.
- [ ] Puzzle 1 on grass: Till → Plant → Water → Sleep → Harvest → win with stars.
- [ ] Edge: quick-tap vs hold on the same tile; reduced-motion; reload restores pond stock / rock state.

---

## What actually happened

Shipped the full super-slice in one branch. Click/Build tool modes and the BuildPicker are gone;
a tap on a tile is now contextual (a lone action fires immediately, >1 opens a press-hold radial
with the default under the thumb).

- **A. Interaction core** — new pure `src/lib/game/actions.ts` (`actionsFor(tile, ctx) → {primary,
  ring}` + `ringAngle` / `radialHiFor` / `RADIAL_RADIUS` / `RADIAL_DEADZONE` / `FERTILIZE_COINS`),
  fully Vitest-tested (18 cases). Store dropped `tool` / `selectedBuild` / `setTool` /
  `setSelectedBuild` / `useTool` / `dispatchBuild` and the `Tool` type; added `radial` + `radialHi`
  state and `beginTap` / `setRadialHi` / `commitRadial` / `closeRadial`. `clickTile` / `placeLand` /
  `buildOn` collapsed into one `execAction(tile, action)` switch over `ActionKind`.
- **B. Verb set** — Till (grass→soil) · Plant (per crop) · Water · Fertilize (feed: 8c → +1 stage) ·
  Harvest · Uproot · Clear · Fish · Mine · Structure (Sprinkler/Scarecrow) · Land (Pond/Rock/Flowers,
  no plot). New `till` / `fertilize` / `uproot` FxKinds + Game.tsx dispatch cases.
- **C. Living board** — `Tile` gained `pondStock` / `rockCharges` / `rockDormant`; `createBoard`
  stocks pond 4 / rock 3; fishing drains the pond, mining drains the rock (→ 3-night dormancy);
  `resolveNight` restocks pond +2 (cap 4) and counts a dormant rock down to a re-charge. SAVE_VERSION
  bumped to 4 with a `normalizeTile` backfill (+ tests).
- **D. Tutorials** — First Sprout now starts on all-grass and teaches Till → Plant → Water → Harvest;
  blurb + par re-verified (till 3 + plant 3 + water 3 = 9e ≤ 16 on day 1; carrots ripen in 2 nights →
  3★ at 2). Dry Spell / Vine & Again left as tilled soil.
- **E. Feel** — per-verb fx (till dust, fertilize sparkle + coin, uproot puff), a ~90ms radial bloom
  (`la-pop`, reduced-motion-safe via `.la-anim`), and `navigator.vibrate(8)` haptics on both a
  single-tap action and a radial commit (skipped under reduced-motion).

lint + type-check + test (77 green, +23) + prod build all clean; dev server boots clean.

## Files created / modified

- **new:** `src/lib/game/actions.ts`, `src/lib/game/actions.test.ts`, `src/components/ui/RadialMenu.tsx`
- **modified:** `src/lib/game/store.ts`, `src/lib/game/tiles.ts`, `src/lib/game/save.ts`,
  `src/lib/game/puzzles.ts`, `src/components/Game.tsx`, `src/components/ui/Hotbar.tsx`,
  `src/lib/game/{tiles,save,puzzles}.test.ts`
- **deleted:** `src/components/ui/BuildPicker.tsx`

## Deferred to next session

Board expansion beyond 3×3 · Tier-2 crops/tool tiers · a "needs water / ready / depleted" tile hint
in the renderer (only radial/fx juice landed this slice) · owner Playwright feel pass on the preview.

## Status
- [x] In progress - [x] Complete - [ ] Partial
