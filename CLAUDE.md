# Little Acre — Claude Code Instructions

Read automatically at the start of every session. **Don't start writing application
code before completing the Pre-Session Checklist below and getting the plan confirmed.**

---

## What This Project Is

A cozy, mobile-first, browser-based **isometric pixel farming game**. You tend a
small raised-tile farm: till soil, plant crops, **water** them, **Sleep** to pass
the night (watered crops grow a stage, unwatered ones wilt), then **harvest** at
dawn for **Coins**. Mine rocks for rare **Gems**, fish ponds, place land and
structures (Sprinkler, Scarecrow), and eventually **Rebloom** (prestige) for a
permanent harvest multiplier. Warm pastel palette, Fredoka + Pixelify Sans type.
State survives reload.

The authoritative gameplay reference is the single-file Canvas2D prototype at
`docs/design/prototype/Farm Idle.dc.html` — port from it, don't reinvent it. The
economy/balance and the **idle-vs-active** tension are **still being designed** (see
`docs/design/GDD.md` "Open questions"); do a faithful first-pass port, don't invent a
deep balance model.

**Stack:** Next.js 16 (App Router, Turbopack) · React 19 · TypeScript (strict) ·
**Canvas2D** (plain 2D context — the board is flat pixel iso tiles; **no PixiJS**) ·
Zustand (game state) · Tailwind CSS v4 · Vitest (logic tests) · pnpm · Supabase
planned for cloud saves (M5).

Mobile feel (touch-primary, one-thumb, juice) is a first-class, regression-checked
concern. **Ship small slices: one roadmap item = one plan = one branch = one PR.**

---

## Commands

```bash
pnpm dev          # next dev --turbopack on PORT (default 3001)
pnpm build        # next build
pnpm start        # next start (after build)
pnpm lint         # eslint src   (note: `next lint` is gone in Next 16 — use this)
pnpm type-check   # tsc --noEmit
pnpm test         # vitest run   (tests are src/**/*.test.{ts,tsx})
```

Before declaring work done, run **`pnpm lint && pnpm type-check && pnpm test`** clean.

---

## Pre-Session Checklist

Complete in order. Do not write application code until the plan file exists and is confirmed.

1. **Orient**
   - Read `docs/ROADMAP.md` — identify the current milestone and the specific slice today.
   - Read the most recent file in `docs/work/` — what was done last session, what was deferred.
   - Read the relevant parts of `docs/design/GDD.md` if touching mechanics, economy, crops,
     land, structures, or prestige. When in doubt, open the prototype in
     `docs/design/prototype/`.
2. **Clarify** — if the task is ambiguous, ask **one** focused question before proceeding.
3. **Plan**
   - Write a plan file to `docs/work/YYYY-MM-DD-{slug}.md` (format below), including a
     **Manual test steps** section (happy path + at least one edge/failure case).
   - Present the plan as a summary and get **explicit confirmation** before writing code.
4. **Branch** — `git checkout -b feature/{name}` (slices go on a branch, never straight to `main`).

---

## Architecture

App boots client-only (`src/app/page.tsx` lazy-loads `App` with `ssr: false`
because the Canvas board is browser-only). One screen; everything hangs off a
Zustand store, with the board drawn imperatively on a `<canvas>`.

```
src/
  lib/
    game/                 ← Pure game logic. No React, no Canvas imports.
      store.ts            ← Zustand store: single source of truth + all actions
      loop.ts             ← Fixed-interval engine + autosave (day/night is action-driven for now)
      save.ts             ← Versioned localStorage save (SAVE_VERSION) + offline stub
      tiles.ts            ← Board model + CROPS/LAND/STRUCT defs + pure resolvers (resolveNight, harvestValue…)
      numbers.ts          ← Coin/number formatting
    renderer/             ← Canvas2D only. No React, no store imports.
      palette.ts          ← Locked pastel palette (hex pulled from the prototype)
      board-renderer.ts   ← Iso tile+crop+fx drawing, imperative handle (BoardRenderer)
  components/             ← React shell. Reads the Zustand store via selectors.
    App.tsx               ← Top-level shell (minimal — boots into Game)
    Game.tsx              ← Orchestrates the screen, mounts the loop, hosts the canvas, wires input
    ui/                   ← Hud (coins/gems, Day/Bloom/Energy, Sleep) · Hotbar (Click/Build/Store)
                            · BuildPicker · StoreModal (Shop/Boost/Guide + Rebloom) · Toasts · NightOverlay
  app/                    ← Next App Router (page/layout/globals)
```

**Data flow:** `store.ts` holds `coins`, `gems`, `day`, `energy`, `bloom`, `board`,
`phase`, `toasts`, and all actions (`useTool`, `sleep`, `setTool`, `setSelectedBuild`,
`rebloom`, `openStore`, `save`, `init`). `Game.tsx` creates one `BoardRenderer`,
subscribes to the store to push board/phase snapshots, translates pointer taps into
`useTool(r,c)` calls, and maps each action's returned `ActionResult` onto imperative
renderer fx. `loop.ts` autosaves every 10s + on tab-hide/unload. `save.ts` persists to
`little-acre-v1` with `SAVE_VERSION`.

**Performance pattern (keep it):** the board (crop sway, particles, water shimmer,
shake) is drawn on its own `requestAnimationFrame` inside `BoardRenderer`. The React
tree does **not** re-render per frame — the store pushes a snapshot on state change,
and fx are fired imperatively. HUD components use narrow Zustand selectors. Don't
replace this with reactive props that re-render per frame.

---

## Coding Conventions

- **TypeScript strict** — no `any`, no `@ts-ignore` without a comment explaining why.
- **Store is the single source of truth** — run state (`coins`/`board`/`bloom`/…) lives
  in `store.ts`, never duplicated into component state.
- **Keep pure logic pure** — `src/lib/game/*` and `src/lib/renderer/*` import nothing
  from React or the DOM beyond the canvas the renderer is handed. Anything that decides
  a game outcome (night growth, harvest value, energy spend) lives as a pure function in
  `tiles.ts` and is exercised in a Vitest test. If a piece of logic can't be tested in
  Vitest, reconsider where it lives.
- **The board is deterministic where it should be** — `createBoard()` and the renderer's
  seeded speckle/spot layout reproduce the same farm every load. Keep it that way.
- **Never re-render React per frame** — the renderer owns the rAF loop; visuals that
  change every tick are driven imperatively (see the pattern above).
- **Touch is primary, mouse secondary** — pointer events, not mouse-specific ones. Mobile
  is a launch requirement, not a port. Both orientations are a nice-to-have, not required.
- **`const` by default**, `let` only when mutation is needed.
- **No `console.log` in committed code** — `console.error` for genuine errors only.
- **Comments only when the WHY is non-obvious** (tuning constants, save-migration edges).
- **Prettier:** semis, single quotes, `printWidth: 100`, trailing commas (`all`).
  `docs/` is in `.prettierignore` on purpose — **don't reformat hand-written docs or the
  prototype.**
- **Path alias:** `@/*` → `src/*` (tsconfig + vitest both configured).
- **Renderer palette is locked** — recolor through `palette.ts`, don't hardcode hex in the
  renderer or components; use the `--la-*` CSS tokens in `globals.css` for HUD chrome.
- **`next lint` is removed in Next 16** — lint with `eslint src` / `pnpm lint`.

---

## Key Docs

| Doc         | Path                        | Purpose                                   |
| ----------- | --------------------------- | ----------------------------------------- |
| Roadmap     | `docs/ROADMAP.md`           | Milestones M0–M5, build order, near-term  |
| Game Design | `docs/design/GDD.md`        | Full GDD — loop, content, open questions  |
| Prototype   | `docs/design/prototype/`    | The authoritative Canvas2D gameplay ref   |
| Work logs   | `docs/work/YYYY-MM-DD-*.md` | Per-session notes — read the latest first |
| Decisions   | `docs/decisions/`           | ADRs (add when a real one lands)          |

---

## Git Conventions

- Never commit directly to `main`. Feature branches: `feature/`, `fix/`, `chore/`, `docs/`.
- Conventional commit messages: `feat:`, `fix:`, `chore:`, `docs:`.
- One roadmap slice = one branch = one PR. Keep PRs small and reviewable.
- Don't bypass Husky hooks (`--no-verify`). Pre-commit runs `eslint --fix` + `prettier`
  on staged files; keep commits lint-clean so the hook doesn't churn.

---

## Plan File Format

Filename: `docs/work/YYYY-MM-DD-{short-slug}.md`

```markdown
# {Feature / Task Name}

**Date:** YYYY-MM-DD · **Branch:** feature/{name} · **Roadmap item:** Mn — {slice}

## Goal

One sentence: what does "done" look like this session?

## Approach

How it'll be built; key decisions; anything non-obvious or where options were weighed.

## Steps

- [ ] Specific step 1
- [ ] Specific step 2

## Manual test steps

How to verify end-to-end in the browser (default localhost:3001). Happy path + an edge/failure case.

- [ ] e.g. Build tool → plant a carrot on soil → water it → Sleep → it grows a stage
- [ ] Edge case: reload mid-run → save restores coins + board

## Out of scope for this session

Explicitly list related-but-not-today work.

---

<!-- Fill in during/after -->

## What actually happened

## Files created / modified

## Deferred to next session

## Status

- [ ] In progress - [ ] Complete - [ ] Partial — see deferred
```

---

## Post-Session Checklist

- [ ] Fill in "What actually happened" / "Files changed" / "Deferred" in the plan file.
- [ ] Update the **Current State** section of this file.
- [ ] Add an ADR to `docs/decisions/` if a significant architectural decision was made.
- [ ] `pnpm lint` clean · `pnpm type-check` clean · `pnpm test` green.
- [ ] Commit (conventional message) and push the branch.
- [ ] Open a PR — even small slices go through review.
- [ ] If handing off, write `docs/work/YYYY-MM-DD-handoff-{next-slice}.md` (assume a cold start).

---

## ADR Format

Create at `docs/decisions/NNN-{title}.md`:

```markdown
# ADR NNN: {Title}

Date: YYYY-MM-DD · Status: Accepted

## Context

Why did this decision need to be made?

## Decision

What was decided?

## Consequences

Trade-offs — what this makes easier or harder.
```

---

## Things Not To Do

- Don't write application code before the plan file exists and is confirmed.
- Don't add a library without writing an ADR. **Don't add PixiJS — the renderer is
  plain Canvas2D by design.**
- Don't build features outside the current milestone — check `docs/ROADMAP.md`.
- Don't add Supabase before M5 — localStorage saves until then.
- Don't skip the PR step, no matter how small the slice.
- Don't bypass Husky (`--no-verify`).
- Don't re-render React inside the render loop — imperative updates for per-frame visuals.
- Don't duplicate run state into component state — the store owns it.
- Don't hardcode palette hex outside `palette.ts` / the `--la-*` tokens, and don't
  reformat `docs/` (including the prototype).
- Don't invent a finished economy — crop costs/sells, energy budget, and the idle-vs-active
  question are open and pending the human's modelling pass.

---

## Current State

> **Update this section at the end of every session** — what shipped, what's next.

- **Phase:** M0 scaffold shipped; M2 economy underway (crops + upgrades landed); **Modes shipped** —
  Main Menu + Freeplay + **8 Puzzles** (3 tutorials + 5 solver-locked challenges); contextual
  controls shipped; **puzzle megaslice shipped** (this session).
- **This session (2026-07-09, later): "Megaslice 2" — playtest response + expansion + design wave**
  (same branch, PR #6 open). 4 Opus agents, 2 waves. **Goal-tier stars** replace night-thresholds:
  `stars {two, three}` = progress targets, objective = 1★ base with slack, 3★ = solver-locked
  exact max (instant win on reach; deadline scoring otherwise; 0-night Sleep → "End Day"); all 8
  puzzles retiered (market-day 2/3/4 @13⚡ fixes the owner's unwinnable run; patient-vine early-cash
  = 2★ not a loss); harness v3 checks ladder + base-slack + tier3==max (~90s). **Uproot confirm**
  (arm-then-confirm on live crops). **Freeplay board expansion:** starts 1×1 wild grass;
  `BOARD_TIERS` 1×1/3×3(150c)/5×5(600c placeholders — owner balance pass pending), `expandBoard`
  re-centres with state preserved, save **v5** (v4 → 3×3 verbatim), renderer N×N; puzzles pinned
  3×3. **Design wave (mockups):** Store restyled (tabs/Expand tier cards/Boost/presentational
  Craft with locked recipes/quiet Rebloom); farm HUD per mockup (370px Sleep clip fixed); radial
  petals restyled (cost chips, unaffordable dim; geometry untouched); **Sunrise Report** card
  (additive `NightResult.restocked/recovered`; puzzle mode keeps the toast). lint/type-check/build
  clean, **135 tests** (+25); harness green. See `docs/work/2026-07-09-megaslice-2-playtest.md`.
  **Next:** owner feel-pass on PR #6; balance pass (expansion costs, economy); coins-objective
  puzzle; processing chains; remaining Design-Drop roadmap.
- **Prior session (2026-07-09): "Puzzle-Vision Alignment" megaslice** (branch
  `claude/game-puzzle-potential-bu4nri`, pushed for owner feel-pass — PR after). Orchestrated 4
  Opus agents (2 waves) + orchestrator integration. **New tooling:** `scripts/puzzle-solver.mjs`
  (exact optimal-play search over the real rules — same-day feed chains, fruit-holding, uproot,
  structures/spatial, coins-earned objectives, injectable crop defs) +
  `scripts/check-puzzle-pars.mjs` (locks every PuzzleDef: par == optimal AND par−1 infeasible;
  old-rules regression; pinned feature checks; `--sweep-tomato`; ~22s). **Rules:** tomato retuned
  `reyield 4 / regrow 1` (2⚡/harvest amortized — was strictly dominated by carrot); **sprinklers
  water a plus-shape** (own + 4 orthogonal; pure `isAutoWatered`, `needsWater(t, tiles)` is now
  board-aware); **gathering deterministic** (`FISH_COINS 18` / `ORE_COINS 13`, gem on a rock
  cycle's last pull — no RNG left); `ActionCtx.allowFeed`/`allowStructures` + same flags on
  `PuzzleDef` (tutorials: feed OFF — fixes the 0-night feed cheese the solver found; vine-and-again
  stars retuned to {5,6}). **Puzzle engine v2:** objective union `harvest | coins` (coins =
  cumulative EARNED), `section: 'tutorial' | 'challenge'`, `boardFrom()` rich boards (pre-grown
  crops/stock/charges), `nightLimit: 0` = "today only". **Five challenges** (all knife-edge):
  market-day (0 nights, feed chains, 10⚡/20c), the-patient-vine (hold-the-ripe-fruit, par 4),
  seed-money (bootstrap ladder, par 5), thirsty-work (5⚡ crop mix, par 7 — mixing beats both
  mono-crops), waterworks (sprinkler placement, par 2). **UI:** select shelves
  (Tutorials/Challenges), coins + today-only banner variants, Sleep guard in 0-night puzzles
  (2-tap), result modal staggered star-pop + par line, `BoardRenderer.setCoverageHint()` sprinkler
  coverage glow (Game wires it from radial state). lint/type-check/build clean, **110 tests**
  (+33); harness green; Playwright smoke (select + Market Day banner). See
  `docs/work/2026-07-08-megaslice-puzzle-vision.md`. **Next:** owner feel-pass → PR; coins-objective
  puzzle; processing chains (P3/P5); update docs/design/puzzles.md; freeplay balance knock-ons.
- **Prior session (2026-07-08): "Hands on the Farm" super-slice** (branch `feature/hands-on-farm`,
  PR open — do not merge, owner reviews). Replaced Click/Build tool modes with **contextual tap +
  press-hold radial** and wired the full farming verb set. New pure **`src/lib/game/actions.ts`**
  (`actionsFor(tile, ctx) → {primary, ring}` + radial geometry `ringAngle` / `radialHiFor` /
  `RADIAL_RADIUS` / `RADIAL_DEADZONE`; `FERTILIZE_COINS`); the RadialMenu is display-only, all
  selection is `radialHiFor`. Store dropped `tool`/`selectedBuild`/`useTool`/`dispatchBuild` + the
  `Tool` type, gained `radial`+`radialHi` state and `beginTap`/`setRadialHi`/`commitRadial`/
  `closeRadial`; `clickTile`/`placeLand`/`buildOn` collapsed into one **`execAction(tile, action)`**
  switch. **Verbs:** Till (grass→soil) · Plant · Water · **Fertilize** (feed: 8c → +1 stage) ·
  Harvest · **Uproot** · Clear · Fish · Mine · Structure · Land (excludes plot — till replaces it).
  **Living board (SAVE v4):** `Tile` gained `pondStock`/`rockCharges`/`rockDormant`; ponds hold 4
  fish (refill +2/night), rocks hold 3 pulls then go dormant 3 nights; `resolveNight` regenerates
  both, `normalizeTile` backfills (older saves start stocked). **First Sprout** now starts on wild
  grass → teaches Till → Plant → Water → Harvest (par re-verified: 9e day-1, 3★ at 2 nights).
  **Juice:** per-verb fx (till dust / fertilize sparkle+coin / uproot puff), ~90ms radial bloom
  (reduced-motion-safe), `navigator.vibrate(8)` on single-tap + radial commit. Gesture: pointerdown
  `beginTap` (fires lone action, else opens radial + `setPointerCapture`), pointermove steers
  `radialHi` via `radialHiFor`, pointerup `commitRadial` + release capture. Deleted `BuildPicker`,
  slimmed `Hotbar` to the Store button. lint/type-check/build clean, **77 tests green** (+23); dev
  server boots clean. See `docs/work/2026-07-08-superslice-controls.md`. **Next:** owner Playwright
  feel pass; then a renderer tile-state hint (needs water / ready / depleted), Tier-2 crops + tool
  tiers, board expansion.
- **Prior session (2026-07-08): playtest fixes** (branch `fix/playtest-fixes`). Four items off the
  owner's live-build playtest: (1) **bug** — the store's water action still gated on the old fixed
  `stage < 3`, so a Tomato (grow 4) at stage 3 couldn't be watered and never ripened (broke puzzle 3
  - Freeplay tomatoes); now `t.stage < cropGrow(t.crop)`. (2) puzzle **objective banner**
    `top-[72px]`→`top-[104px]` to clear the HUD. (3) tile-side **seams** fixed by drawing the board
    depth as one `drawSkirt()` slab instead of per-tile cube sides. (4) **furrows** softened so dirt
    has no dark streak. lint/type-check/build clean, 54 tests green; Playwright-verified (tomato waters
    at stage 3 → ripens → harvests; banner clears HUD; clean slab). See
    `docs/work/2026-07-08-playtest-fixes.md`. **Next:** controls overhaul (contextual tap + radial) +
    Till action + grass-start tutorial.
- **Prior session (2026-07-07): Main Menu + Freeplay + tutorial Puzzles** (branch
  `feature/menu-puzzles`, PR after #2). The app now boots to a cozy **Main Menu** (Freeplay /
  Puzzles, Settings reserved) via new store app-state `screen: 'menu' | 'puzzleSelect' | 'game'` +
  `mode: 'freeplay' | 'puzzle'`; `App.tsx` renders MainMenu / PuzzleSelect / Game by `screen` and
  calls `init()` once (loads save + puzzle stars, lands on menu — no longer forces into the game).
  New pure **`src/lib/game/puzzles.ts`** (Vitest-tested): `PuzzleDef` + `PUZZLES` (3 tutorials —
  first-sprout / dry-spell / vine-and-again teaching the loop / watering discipline / re-yield),
  `starsFor`, and pure reducers `registerHarvest` / `registerNight` (+ `isPuzzleUnlocked`). Puzzles
  are **ephemeral**: `startPuzzle(id)` sets up a fresh board/coins/energy from the def; harvest
  tracking hooks the ripe branch of `clickTile` (`trackPuzzleHarvest` → win + best-stars persist),
  night tracking hooks `sleep`'s grow-resolve (`registerNight` → loss past `nightLimit`). **Freeplay
  save is never touched by a puzzle** — `store.save()` no-ops when `mode==='puzzle'` and `loop.ts`
  autosave skips too; best stars live in a **separate** key `little-acre-puzzles`
  (`loadPuzzleStars`/`savePuzzleStars`). Sequential unlock (puzzle N needs ≥1★ on N-1). New UI:
  `MainMenu`, `PuzzleSelect` (cards + best-stars + lock), `PuzzleOverlays` (ObjectiveBanner /
  PuzzleIntro blurb card / PuzzleResult win-lose modal with Retry/Puzzles/Next). BuildPicker
  restricts to `puzzle.builds` in puzzle mode; Store button hidden in puzzle mode (puzzles are
  self-contained); Freeplay gets an **Exit to Menu** in the StoreModal header. Star thresholds ship
  as authored — all three verified feasible at par = optimal nights (no tuning needed). No
  SAVE_VERSION bump (freeplay schema unchanged; puzzle stars are a new separate key).
  lint/type-check/build clean, **52 tests** green (+21). See `docs/work/2026-07-07-menu-puzzles.md`.
  **Next:** puzzles P3–P5 (need processing/crafting), settings screen, animated star fill.
- **Prior session (2026-07-07): real Store purchases — buyable upgrades** (branch
  `feature/shop-upgrades`, PR after #1). The Store's **Boost** tab is now a real economy: new pure
  `src/lib/game/upgrades.ts` (data-driven `UPGRADE_DEFS` + geometric `upgradeCost` + derived
  `maxEnergyFor`/`harvestMultFor` + `normalizeUpgrades`) drives two levelled upgrades — **Extra
  Energy** (+2 max energy/level) and **Rich Fertilizer** (+8% harvest value/level). Store gained
  `upgrades` + `buyUpgrade` (spend coins → level up → recompute maxEnergy + top up the current day on
  an Energy buy); harvest payout now `harvestValue(crop, bloom × harvestMultFor(upgrades))`. Save
  **v3** persists levels; `applySave` recomputes maxEnergy from them so it can't desync. Boost tab
  renders real cards (level pill `Lv n / max`, current + next effect, cost button that disables when
  unaffordable/maxed). Shop-tab tools/seeds stay presentational (gated on the tool system + Tier-2).
  lint/type-check/build clean, **31 tests** green (+6). See `docs/work/2026-07-07-shop-upgrades.md`.
  **Next:** gathering throttle (pond stock / rock respawn), then the tool system (bought tier-I → the
  Shop tab goes real) + Tier-2 crops. A Playwright visual pass over both economy slices is pending.
- **Prior session (2026-07-07): Tier-1 crop roles — grow times + re-yield** (branch
  `feature/tier1-crop-roles`). Replaced the prototype's four look-alike crops (all fixed 3-night
  grow) with the designed **Tier-1 set**: **Carrot** (4c, 2 nights, sell 20 — bootstrap),
  **Potato** (6c, 3 nights, 34 — staple), **Tomato** (12c, 4 nights, 18 — _re-yields 3× on the
  vine_, regrows every 2 nights). `stage` now counts watered nights `0..grow` (ripe at
  `stage >= cropGrow(crop)`), not a fixed 3; `CropDef` gained `grow`/`reyield`/`regrow`, `Tile`
  gained `harvests`. New pure helpers `cropGrow`, `visualStage` (maps growth → the 4 sprite
  stages so the renderer stays free of crop rules), and `harvestPatch` (re-yield: re-ripens until
  `reyield` harvests are spent, then clears). Renderer draws via `visualStage`/`isRipe`; ripe body
  differentiates root veg (carrot/potato) vs vine fruit (tomato). Save **v2** — `normalizeTile`
  backfills `harvests` and clears any crop id no longer in `CROPS` (old wheat/lettuce). Numbers
  mirror `scripts/little-acre-model.mjs` (tunable). lint/type-check/build clean, **25 tests** green
  (+5: per-crop grow, re-yield loop, visualStage, save normalisation). See
  `docs/work/2026-07-07-tier1-crop-roles.md`. **Next:** real Shop purchases (seeds/tools),
  gathering throttle (pond stock/rock respawn), then Tier-2 crops + tool tiers.
- **Prior session (2026-07-07): project scaffold — M0 board + day loop.** Created the
  Next 16 / React 19 / TS-strict / Tailwind v4 / Zustand / Vitest project, mirroring the
  Disaster Co. tooling but with a **Canvas2D** renderer (no Pixi). Ported the
  `Farm Idle.dc.html` prototype into a clean, typed slice: the iso board renders (grass /
  tilled / pond / rock / flower tiles, crops in 4 grow stages, structures), and the full
  **Day → Sleep → Night** loop works — Click tool waters / harvests / clears / fishes /
  mines; Build tool plants crops, places land, and builds structures; Sleep runs the
  night (watered crops grow, unwatered wilt, sprinkler auto-waters, scarecrow protects),
  refills Energy, and increments Day. HUD (coins/gems/day/bloom/energy + Sleep),
  BuildPicker, Store modal (Shop/Boost/Guide + Rebloom prestige), toasts, and night
  overlay are all wired. Versioned localStorage save + 10s autosave. Pure logic is
  Vitest-covered (**20 tests**: night growth/wilt/sprinkler/scarecrow, harvest×Bloom,
  ripe/needs-water, number formatting, save round-trip/migration). lint + type-check +
  test + build all clean. **Store shape is faithful to the prototype but economy numbers
  are first-pass** — see GDD open questions.
  - **Ported:** iso board renderer + all tile/crop/structure art, day/night/energy loop,
    all Click + Build interactions, HUD/hotbar/build-picker/store/toasts/night overlay,
    save/load.
  - **Stubbed / presentational:** Store **Shop** and **Boost** tabs are display-only (no
    real purchase economy yet); **Rebloom** does a simple ×1.6 Bloom + 8-gem reset;
    fishing/mining are the prototype's simple RNG payouts; no hover tooltip DOM box (the
    canvas hover outline stands in); offline progress is a stub (day/night only advances
    on explicit Sleep).
  - **Next:** M1 juice/feel polish, then M2 real economy (buyable seeds/tools/upgrades,
    energy budget) once the human's balance pass lands. See `docs/ROADMAP.md`.
