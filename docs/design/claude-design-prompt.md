# Claude Design Brief — Little Acre (cozy farm UI)

> Paste this into Claude design. It establishes the UI style and surfaces for **Little Acre**, a
> cozy isometric pixel farming sim. Output = high-fidelity UI mockups + a reusable visual system,
> not production code. `docs/design/prototype/Farm Idle.dc.html` is the visual baseline; this brief
> reflects the game as built (contextual radial controls, puzzle mode, living gathering nodes) plus
> the next slice (coin objectives, sprinkler coverage, crafting/processing).

---

## Design decisions already locked (treat as constraints)

- **Stack:** Next.js (React 19) + Tailwind v4. The isometric board renders on a **Canvas2D**
  `<canvas>` (procedural pixel art) — you are designing the **surrounding chrome + overlays**, not
  the board tiles themselves.
- **Controls (shipped — this replaced the old tool hotbar & build picker; design for THIS):**
  - **Quick tap** on a tile runs its contextual primary verb (water a thirsty crop, harvest a ripe
    one, till grass, fish, mine). No mode switching, no tool selection.
  - **Press-hold** opens a **radial menu** on the tile: primary verb in the deadzone centre,
    secondary verbs around the ring (plant choices, Feed, Uproot, structures, land). Thumb-drag
    highlights a slice; release commits. ~90ms bloom-in, `vibrate(8)` haptic tick,
    reduced-motion → instant/static.
  - There is **no persistent toolbar** — the bottom edge holds only a **Store** button; **Sleep**
    lives in the HUD.
- **Orientation:** mobile-first, portrait hero, landscape as reflow. Touch-primary, one-thumb;
  primary actions reachable near the bottom.
- **Aesthetic:** cozy, warm, tactile **pixel-toy** — the opposite of a slick dashboard. Chunky
  notched "sticker" panels (pixel-corner `clip-path`), soft drop-shadows, rounded warm cream cards,
  gentle bounce/pop motion. Nothing punishing, nothing tense.
- **Fonts:** **Fredoka** (UI text/labels) + **Pixelify Sans** (all numbers, titles — the pixel
  voice). Already loaded via Google Fonts.
- **Freeplay has no prestige/reset.** (A legacy "Rebloom" button exists in the build — do not
  feature it; Bloom is a slow permanent yield multiplier, never a reset.)

---

## What the game is (context for tone)

You tend a small **acre**: till wild grass, plant, **water**, and **Sleep** — one night = crops
grow (unwatered ones wilt), ponds restock, spent rocks recover, machines (future) finish. Energy is
the daily action budget; **Feed** (fertilizer, costs coins) can push a crop a whole stage without
waiting for night. Fish ponds and mine rocks for coins/gems; later, craft tools & machines and
process raw goods into artisan goods (smoked fish, beer). Two modes: **Freeplay** (open,
completion-driven) and **Puzzle** (handcrafted "produce X in Y nights" scenarios, star-scored,
knife-edge tuned — solver-validated so par requires genuinely clever play).

The fantasy: a calm, satisfying few minutes tending a little world that visibly grows richer.
**Voice reference:** Stardew Valley's coziness at a bite-sized scale.

---

## The hero: the isometric pixel board (do not redesign — design AROUND)

Raised isometric tiles (grass, tilled soil, pond, rock, wildflowers) with chunky pixel crops that
grow through 4 stages, particle bursts on harvest, coin fountains, screen-shake juice. The chrome
must feel **of the same world** — same pastel palette, same pixel corners — a cozy frame around a
cozy toy, not a contrast to it.

---

## Palette (from the prototype — reuse, don't reinvent)

- **Sky/background gradient:** `#d8edf2` → `#e7f2e4` → `#fbeecb` (day); night `#201b45`/`#35306a`.
- **UI cream/cards:** `#fdf3e0`, `#fff7ea`, `#fffaf0`; **borders** `#e7cfa5`, `#f3d698`, `#f0e0c4`.
- **Coins (gold):** `#f7c948` / text `#c08a1e`. **Gems (violet):** `#a98bf0` / text `#8a63e0`.
- **Green (grow/confirm):** `#aadd85` / `#7cae4f`. **Soil** `#c69c6d`. **Pond** `#8fd3e0`.
  **Rock** `#b7ad93`. **Alert/bad** `#e07a5f`. **Water/sprinkler** `#6cc3de`.
- Define semantic tokens (bg, card, border, ink, muted, coin, gem, grow, water, alert) so all
  surfaces share one system.

---

## Surfaces to design

### 1. Main game screen (portrait hero + landscape reflow) — primary
- **Board stage:** iso board centered/dominant; floating `+N` coin pops rise from taps.
- **Top HUD:** **Coins** + **Gems** chips (left); **Day · Bloom ×mult**, an **Energy bar**
  (`n/max` + lightning glyph), and a **Sleep** button (right). Chunky notched sticker chips.
- **The radial menu — key deliverable.** Design the full anatomy: deadzone centre (primary verb),
  4–7 ring slices, per-verb swatch + icon + label, **coin-cost chip** on paid verbs (seed prices,
  `Feed 8c`), disabled/unaffordable state, the highlighted-slice state under the thumb, and the
  bloom-in. It must stay legible over a busy pixel board (scrim? card slices?) and fit a thumb arc.
- **Tile-state legibility:** subtle hints for *needs water* / *ripe* / *wilted* / *pond stock
  low* / *rock dormant* — propose canvas-adjacent cues (outline, pip, bubble) + a small notched
  tap-tooltip (tile name + one-line hint).
- **Bottom edge:** just the **Store** button — anchor it for one-thumb reach.

### 2. Puzzle mode (mode select is SHIPPED — polish it; extend for new objective types)
- **Main Menu:** cozy title screen — Freeplay / Puzzles (/ Settings reserved).
- **Puzzle select:** card list in two sections — **Tutorials** and **Challenges** — each card:
  title, objective line, night limit, **best-stars** (0–3), locked state (sequential unlock).
- **In-puzzle chrome:** objective banner under the HUD ("Harvest 4 Tomatoes · Night 2/9" +
  progress meter); **variants needed:** coin objectives ("Earn 120c") and **"Today only"**
  zero-night puzzles (dusk deadline instead of nights). Intro blurb card on start; win/lose
  **result modal** with animated star fill, par context ("done in 2 nights — par 2!"), and
  Retry / Puzzles / Next.
- Some puzzles gate verbs (e.g. no Feed in tutorials) — gated verbs simply don't appear in the
  radial; no locked-state needed there.

### 3. Sprinkler coverage preview — new
Sprinklers water their own tile + orthogonal neighbours (a plus-shape). While placing (and on
tap-inspect), show the coverage footprint over the board — cozy, not tactical-grid: soft water-blue
glow/droplets on covered tiles. This is the game's first spatial mechanic; make placement feel
delightful and readable.

### 4. Store modal — Shop · **Craft** · Boost · Guide (tabbed)
A cozy full-screen-ish notched panel. Tabs:
- **Shop:** seeds + tier-I tools (icon, name, tag, one-line desc, coin price button).
- **Craft (future — design it now):** recipe cards — output icon, **ingredient chips**
  (`5 × Copper Bar`), craft button disabled/dimmed when short, locked recipe state (silhouette +
  "needs Furnace"). Covers tier-II+ tools + machines (Furnace, Smoker, Keg, Preserves Jar).
- **Boost:** levelled upgrades (Extra Energy, Rich Fertilizer) — level pill `Lv n/max`, current +
  next effect, cost button with unaffordable/maxed states. (Shipped — polish.)
- **Guide:** the **collection/almanac** — discovered crops/items as filled cards, undiscovered as
  `? ? ?` silhouettes. The completion surface — make "gotta fill it" appealing.

### 5. Gathering timing minigames (future — overlay concepts)
Light, celebratory skill overlays, never a fail-state (a miss just yields less):
- **Fishing:** bobber that dips; tap when it's down; tension/timing cue; show the pond's
  **stock pips** (fish left today).
- **Mining:** power/crit bar with moving marker + highlighted crit window; hit/perfect flash;
  show **charges left** and the dormant ("resting rock") state.

### 6. Night → dawn transition + Sunrise Report
The prototype's night overlay (stars, moon, "Night N / Sunrise") — polish it. Add a **Sunrise
Report** card: what grew, what wilted, pond restocked / rock recovered (gentle, never scolding).

---

## Visual system to deliver

- **Color tokens** (above), **type scale** (Fredoka text, Pixelify Sans numerals/titles), and the
  pixel-corner **notched-card** treatment standardized.
- **Components:** resource chip · energy/progress bar · **radial menu (centre, slice, cost chip,
  disabled + highlighted states)** · objective banner (harvest / coins / today-only variants) ·
  puzzle card (stars, locked) · result modal star fill · recipe card + ingredient chip ·
  upgrade card + level pill · Guide collection card (discovered / `???`) · Store tab bar ·
  Sunrise Report card · night overlay · tile tooltip · sprinkler coverage glow.
- **Motion:** soft bounce on place/pop, coin fountain, sticker press, ~90ms radial bloom — snappy,
  never blocking. Reduced-motion → calm static equivalents for everything.

---

## Copy & tone guidance (in-character)

Warm, plain, gently pleased with you. A few anchors:
- Crops "ripe!", tiles "watered · grows tonight", wilt "aw, it dried out — clear it".
- Verbs: Till / Plant / Water / **Feed** / Harvest / Uproot. Sleep → "Rest for the night".
- Pond "restocks overnight"; a spent rock is "resting". Craft → "Forge / Brew / Preserve".
  Guide → "Almanac".
- Puzzles encourage: lose = "the dawn came too soon — try a different order?" Never scold.

---

## Deliverables

1. **Main game screen** (portrait + landscape reflow) **including the radial menu anatomy** and
   tile-state hint system.
2. **Puzzle framing** — main menu, puzzle select (tutorials/challenges, stars, locks), objective
   banner variants (harvest / coins / today-only), intro card, result modal with star fill.
3. **Sprinkler coverage preview.**
4. **Store modal** — all four tabs, incl. Craft recipe cards + a locked recipe.
5. **Gathering minigame overlays** (future concepts) with stock/charge/dormant states.
6. **Sunrise Report + night overlay.**
7. A compact **visual system** (tokens, type scale, reusable components) cohesive enough to
   implement with Tailwind v4.

Optimize for: board-as-hero, cozy tactile warmth, one-thumb ergonomics, radial legibility over a
busy pixel board, and an Almanac that makes completion feel inviting.
