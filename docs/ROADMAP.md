# Little Acre — Roadmap

**Status:** Draft (v0.1) · **Last updated:** 2026-07-07

Milestone sequence from the current scaffold toward a v1. Each milestone has a
**goal**, a **deliverable** (the one thing that proves it's done), and a rough
scope. Order is intentional but not rigid — pull work forward if it de-risks
something later. Companion to [`design/GDD.md`](./design/GDD.md), whose "Open
questions" section gates a lot of M2/M3 balance work.

**Legend:** ✅ done · 🟡 in progress · ⬜ not started

---

## M0 — Vertical Slice ✅ *(shipped — this scaffold)*

**Goal:** Prove the core cozy loop is playable in one self-contained build.

**Deliverable:** An isometric farm that renders and reacts; you can plant, water,
Sleep to grow, and harvest for coins, with state surviving reload.

- ✅ Project scaffold (Next 16 · React 19 · TS strict · Tailwind v4 · Zustand · Vitest · Canvas2D)
- ✅ Iso board renderer ported from the prototype (tiles, crops, ponds, rocks, flowers, structures)
- ✅ Day → Sleep → Night → dawn loop with Energy spend/refill
- ✅ Click tool: water · harvest · clear wilted · fish · mine (coins + gem chance)
- ✅ Build tool: plant crops · place land · build structures
- ✅ HUD, hotbar, build picker, Store modal, toasts, night overlay
- ✅ Versioned localStorage save + autosave; pure-logic Vitest coverage

---

## M1 — Feel & Juice 🟡

**Goal:** Make the moment-to-moment feel cozy and satisfying before adding systems.

**Deliverable:** A first-time player enjoys tapping the farm without explanation;
sleep → sunrise lands as a warm little beat.

- ⬜ Onboarding / first-30-seconds tuning (what the player sees & does first)
- ⬜ Tap & harvest juice tuning (particle counts, hit-stop, screen shake weights)
- ⬜ Sleep/sunrise transition polish (day-tint shift, birdsong-style beat)
- ⬜ Basic audio hooks (plant/water/harvest/mine chirps, night sting) + a mute setting
- ⬜ Reduced-motion pass (respect `prefers-reduced-motion` across fx)
- ⬜ Hover/press affordances tightened for touch (bigger tap targets, feedback on miss)
- ⬜ Both-orientation layout reflow (portrait dock for the HUD/hotbar)

---

## M2 — Economy & Content ⬜

**Goal:** Turn the presentational Store into a real progression spine.

**Deliverable:** Coins meaningfully buy things that change how you play; an early
player has a clear "next goal" at all times.

> **Blocked on the balance pass** — crop costs/sells, energy budget & day length,
> and the idle-vs-active question are open (see GDD). Build the systems; keep the
> numbers in one tunable table.

- ⬜ Real Shop purchases (seed unlocks, tools that gate fishing/mining, extra land tiles)
- ⬜ Boost/upgrade tree with levels + geometric costs (Auto-Harvester, Sprinkler System,
     Rich Fertilizer, Extra Energy — currently display-only)
- ⬜ Energy economy tuning (max energy, per-action cost, refill rules)
- ⬜ Full crop set with grow-time / value curves; pollinator (Flowers) boost made real
- ⬜ Guide auto-reveal wired to a proper discovery ledger
- ⬜ Board expansion (buy/unlock new tiles beyond the starting 3×3)

---

## M3 — Rebloom (Prestige) ⬜

**Goal:** A satisfying reset loop that gives long-term spine.

**Deliverable:** Rebloom feels like a reward, not a punishment — a visible
permanent multiplier and a reason to go again.

- ⬜ Prestige math modelled (Bloom multiplier curve, gem dividend, what carries over)
- ⬜ Rebloom ceremony (montage/summary of the farm you're leaving behind)
- ⬜ Meta-upgrades bought with gems that persist across Reblooms
- ⬜ Decide idle-vs-active identity here — does prestige lean the game idle?

---

## M4 — Content & Expansion ⬜

**Goal:** More farm to love.

**Deliverable:** Enough variety (crops, seasons, events, structures) that a long
session stays fresh.

- ⬜ Seasons / weather affecting growth and wilt
- ⬜ More structures (greenhouse, beehive, coop) and land features
- ⬜ Seasonal events / limited crops
- ⬜ Collections / achievements
- ⬜ Optional larger or multiple farms

---

## M5 — Cloud Saves & Polish ⬜

**Goal:** Persistence beyond one device + launch readiness.

**Deliverable:** A player can pick up their farm on another device; the game is
stable and shippable.

- ⬜ Supabase cloud saves (migrate off localStorage-only)
- ⬜ Save-version migration hardening
- ⬜ Performance pass on low-end mobile
- ⬜ Accessibility + settings polish

---

> This roadmap is a starting point drawn from the M0 scaffold and the prototype.
> Expect it to move once the economy/idle-vs-active design lands.
