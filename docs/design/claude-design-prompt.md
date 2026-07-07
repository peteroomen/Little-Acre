# Claude Design Brief — Little Acre (MVP: cozy farm UI)

> Paste this into Claude design. It establishes the UI style and the surfaces for **Little Acre**, a
> cozy isometric pixel farming sim. Output = high-fidelity UI mockups + a reusable visual system, not
> production code. The original `docs/design/prototype/Farm Idle.dc.html` is the visual baseline — this
> brief extends it to cover the systems added since (tools, gathering, crafting, processing, puzzles).

---

## Design decisions already locked (treat as constraints)

- **Stack:** Next.js (React 19) + Tailwind v4. The isometric board renders on a **Canvas2D**
  `<canvas>` (procedural pixel art) — you are designing the **surrounding chrome + overlays**, not
  the board tiles themselves.
- **Orientation:** **mobile-first, both portrait and landscape.** Touch-primary, one-thumb; primary
  actions reachable near the bottom. Design portrait as the hero, landscape as a reflow.
- **Aesthetic:** **cozy, warm, tactile pixel-toy** — the opposite of a slick dashboard. Chunky
  notched "sticker" panels (pixel-corner `clip-path`), soft drop-shadows, rounded warm cream cards,
  gentle bounce/pop motion. Nothing punishing, nothing tense.
- **Fonts:** **Fredoka** (UI text/labels) + **Pixelify Sans** (all numbers, titles, IDs — the pixel
  voice). Already loaded via Google Fonts.

---

## What the game is (context for tone)

You tend a small **acre**: grow crops, chop trees, fish ponds, mine rocks (which sometimes hide a
critter to shoo), then **craft tools and machines** and **process** raw goods into artisan goods
worth far more (smoked fish, pickles, beer). Time advances only when you **Sleep** — one night =
crops grow, machines finish, ponds restock. **Energy** is your daily action budget. Two modes:
**Freeplay** (open, completion-driven, no prestige) and **Puzzle** ("produce X in Y nights").

The fantasy: a calm, satisfying few minutes tending a little world that visibly grows richer. Warm,
gently witty, never stressful. **Voice reference:** Stardew Valley's coziness at a bite-sized scale.

---

## The hero: the isometric pixel board (do not redesign — design AROUND)

Raised isometric tiles (grass, tilled soil, pond, rock, trees, wildflowers) with chunky pixel crops
that grow through 4 stages, particle bursts on harvest, coin fountains, screen-shake juice. It's a
warm pixel toy. The chrome should feel **of the same world** — same pastel palette, same pixel
corners — a cozy frame around a cozy toy, not a contrast to it.

---

## Palette (from the prototype — reuse, don't reinvent)

- **Sky/background gradient:** `#d8edf2` → `#e7f2e4` → `#fbeecb` (day); night `#201b45`/`#35306a`.
- **UI cream/cards:** `#fdf3e0`, `#fff7ea`, `#fffaf0`; **borders** `#e7cfa5`, `#f3d698`, `#f0e0c4`.
- **Coins (gold):** `#f7c948` / text `#c08a1e`. **Gems (violet):** `#a98bf0` / text `#8a63e0`.
- **Green (grow/confirm):** `#aadd85` / `#7cae4f`. **Soil** `#c69c6d`. **Pond** `#8fd3e0`.
  **Rock** `#b7ad93`. **Alert/bad** `#e07a5f`.
- Define semantic tokens (bg, card, border, ink, muted, coin, gem, grow, alert) so all surfaces share
  one system.

---

## Surfaces to design

### 1. Main game screen (portrait hero + landscape reflow) — primary
- **Board stage:** the iso board centered/dominant; floating `+N` coin pops rise from taps.
- **Top HUD:** **Coins** + **Gems** chips (left); **Day · Bloom ×mult**, an **Energy bar**
  (`n/max` + lightning glyph), and a **Sleep** button (right). All chunky notched sticker chips.
- **Bottom hotbar:** **tool selector** — Watering Can / Axe / Pickaxe / Rod / Sword — each a tactile
  pixel button with a **tier badge** (I/II/III) and clear selected/locked states; plus **Build** and
  **Store** buttons. When Build is active, a **build picker** row floats above (crops, structures,
  land — icon + name + coin cost).
- **Hover/tap tile tooltip:** a small notched label (tile name + one-line hint).

### 2. Store modal — Shop · **Craft** · Boost · Guide (tabbed)
A cozy full-screen-ish notched panel. Tabs:
- **Shop:** buy tier-I tools + common seeds (icon, name, tag, one-line desc, coin price button).
- **Craft (NEW):** recipe cards — output icon, **ingredient chips** (e.g. `5 × Copper Bar`), a
  craft button that's disabled/dimmed when short. Covers tier-II+ tools + machines (Furnace, Smoker,
  Keg, Preserves Jar). Show a locked recipe state (silhouette + "needs Furnace").
- **Boost:** repeatable upgrades (Extra Energy, better sprinklers, etc.) with a level pill.
- **Guide:** the **collection/encyclopedia** — discovered crops/items/critters as filled cards,
  undiscovered as `? ? ?` silhouettes. This is the completion surface — make "gotta fill it" appealing.

### 3. Gathering timing minigames (overlays) — key new deliverable
Small, cozy skill overlays that appear on the board when you gather:
- **Fishing:** a **bobber** that dips under the water; tap when it's down. Show a tension/timing cue.
- **Mining:** a **power/crit bar** with a moving marker and a highlighted **crit window**; tap in the
  window for bonus ore. Design the bar, the marker, the crit zone, and a hit/perfect flash.
Keep them light and celebratory (a "Perfect!" pop), never a fail-state — a miss just yields less.

### 4. Puzzle mode framing
- A **mode select** entry (Freeplay vs a list of puzzle cards — title, objective, best result / stars).
- In-puzzle: an **objective banner** ("Ship 12 Smoked Fish") with **nights remaining** and a **progress
  meter** (12 → target), plus a restart. Cozy but with a gentle clock presence.

### 5. Night → dawn transition + Sunrise Report
The prototype's night overlay (stars, moon, "Night N / Sunrise") — polish it. Add a small **Sunrise
Report** card: what grew, what finished processing, what wilted (gentle, never scolding).

---

## Visual system to deliver

- **Color tokens** (above), **type scale** (Fredoka for text, Pixelify Sans for all numerals/titles),
  and the pixel-corner **notched-card** treatment standardized.
- **Components:** resource chip, energy/progress bar, tool button (with tier badge + 4 states:
  selected / available / locked / cooldown), build-picker chip, recipe card (with ingredient chips +
  can/can't-afford), objective banner, minigame overlay (bobber + crit-bar), Guide collection card
  (discovered / `???`), Store tab bar, Sunrise Report card, night overlay.
- **Motion:** soft bounce on place/pop, coin-fountain, gentle sticker press, snappy but never
  blocking. Reduced-motion → calm static.

---

## Copy & tone guidance (in-character)

Warm, plain, gently pleased with you. A few anchors:
- Crops "ripe!", tiles "watered · grows tonight", wilt "dried out · clear it".
- Sleep → "Rest for the night". Craft → "Forge / Brew / Preserve". Guide → "Almanac".
- Encourage, never scold. A wilted crop is "aw, it dried out," not a penalty screen.

---

## Deliverables

1. **Main game screen** (portrait + a landscape reflow).
2. **Store modal** — all four tabs, with the **Craft** recipe cards + a locked recipe.
3. **Gathering minigame overlays** — fishing bobber + mining crit-bar.
4. **Puzzle framing** — mode select + in-puzzle objective/progress.
5. **Sunrise Report + night overlay.**
6. A compact **visual system** (tokens, type scale, the reusable components above), cohesive enough
   to implement with Tailwind v4.

Optimize for: board-as-hero, cozy tactile warmth, mobile one-thumb ergonomics, and a Guide/collection
that makes completion feel inviting.
