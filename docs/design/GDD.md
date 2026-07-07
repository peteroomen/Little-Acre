# Little Acre — Game Design Document

**Status:** Draft (v0.1) · **Last updated:** 2026-07-07

A faithful capture of the mechanics in the source prototype
([`prototype/Farm Idle.dc.html`](./prototype/Farm%20Idle.dc.html)), which is the
authoritative gameplay reference. Numbers below are the prototype's **first-pass**
values — the economy and the idle-vs-active identity are **still being designed**
(see [§8 Open questions](#8-open-questions--to-be-modelled)). Do not treat the
numbers here as final balance.

---

## 1. Fantasy & tone

A cozy, low-stakes pixel farm. Warm pastel palette (sky-blue → meadow-green → sand
gradient backdrop), chunky rounded-notch UI, **Fredoka** for UI text and **Pixelify
Sans** for numerals and labels. No fail state, no timers pressuring the player — the
loop is "tend a little, sleep, wake to a slightly nicer farm." Target look is the
project thumbnail in `prototype/thumbnail.webp`.

---

## 2. The core loop

An isometric grid of raised tiles. A **Day → Sleep → Night → dawn** cycle:

1. During the **Day**, spend **Energy** (1 per action) to water/plant/build/fish/mine.
2. **Sleep** advances the night. Watered crops grow one stage; unwatered crops wilt.
3. At **dawn**, Energy refills to max and the **Day** counter increments.
4. Harvest ripe crops for **Coins**; spend Coins on seeds, land, and structures; repeat.

Harvesting is **free** (no Energy) — it's the payoff. Everything else costs Energy,
so a day is a budget of ~16 meaningful actions.

---

## 3. Currencies & resources

| Resource   | Role                                                                 |
| ---------- | ------------------------------------------------------------------- |
| **Coins**  | Soft currency. From harvests, fishing, mining. Buys seeds/land/tools. |
| **Gems**   | Rare currency. ~22% drop when mining a rock. Premium/meta spend.      |
| **Energy** | Per-day action budget (start 16/16). 1 per action; refills at dawn.  |
| **Bloom**  | A harvest **×multiplier** (starts ×1.4). Raised by Rebloom prestige.  |
| Fish / Ore | Flavor resources surfaced in the Guide; currently pay out as Coins.  |

Starting state (prototype): **220 coins**, **3 gems**, **Day 1**, **16/16 energy**,
**Bloom ×1.4**.

---

## 4. The board & tiles

Starting board is a fixed **3×3** iso grid. Tile kinds:

| Kind        | Behavior                                                                 |
| ----------- | ----------------------------------------------------------------------- |
| **grass**   | Empty land. Use Build → a land type to develop it.                       |
| **tilled**  | Soil. Plant a crop, water it, harvest it. Can hold one structure.        |
| **pond**    | Click to **fish** for coins (12–31).                                     |
| **rock**    | Click to **mine** ore for coins (8–19) + a ~22% chance of **+1 gem**.    |
| **flower**  | **Wildflowers** — decorative; designed to give a pollinator boost (TBD). |

---

## 5. Crops

Crops grow over **4 stages** (0 → 3); stage 3 is **ripe** and harvestable. A crop
advances one stage per night **only if watered** (or on a Sprinkler tile). Harvest
payout = `round(sell × Bloom)`.

| Crop     | Plant cost | Base sell | Notes                    |
| -------- | ---------- | --------- | ------------------------ |
| Carrot   | 4          | 14        | Fast & cheap starter.    |
| Wheat    | 7          | 26        | Steady staple.           |
| Tomato   | 8          | 30        | Juicy vine crop.         |
| Lettuce  | 10         | 38        | Premium greens.          |

At current values every crop takes the same 3 waterings to ripen, so sell price is
the only differentiator — **this is a balance gap flagged in §8.**

---

## 6. Land & structures

**Land** (Build tool, placed on empty grass — costs coins + 1 energy):

| Land     | Cost | Becomes  |
| -------- | ---- | -------- |
| Plot     | 15   | tilled   |
| Flowers  | 30   | flower   |
| Pond     | 90   | pond     |
| Rock     | 140  | rock     |

**Structures** (Build tool, placed on tilled soil — one per tile):

| Structure | Cost | Effect                                                       |
| --------- | ---- | ----------------------------------------------------------- |
| Sprinkler | 60   | Auto-waters its tile overnight (crop grows without watering). |
| Scarecrow | 45   | Crop survives an unwatered night (no wilt) but doesn't grow.  |

---

## 7. Store, Bloom & Rebloom

The **Store** modal has three tabs:

- **Shop** — buy seeds, tools, and land. *(Presentational in M0 — no purchase economy
  wired yet; items and prices are placeholders.)*
- **Boost** — leveled upgrades (Auto-Harvester, Sprinkler System, Rich Fertilizer,
  Extra Energy) + the **Rebloom** prestige button. *(Upgrades presentational in M0;
  Rebloom is wired.)*
- **Guide** — an encyclopedia of crops/land/structures/resources that reveals entries
  as you discover them (`seen` ledger).

**Rebloom (prestige):** resets the farm and grants a permanent **×1.6 Bloom** and
**+8 gems**. In M0 this is a simple reset (coins → 220, board → fresh, Bloom compounds);
the real prestige math (what carries, the multiplier curve, gem meta-spend) is **open**.

---

## 8. Open questions / to be modelled

These are **not decided** and are pending the human's balance/design pass. Do not
fabricate finished values.

1. **Economy balance.** Crop costs vs. sells vs. grow-time. Right now all crops ripen
   in the same time, so price is the only lever — crops need distinct grow durations
   and/or yields so the choice matters. Fishing/mining payouts, land/structure costs,
   and Shop/Boost prices all need a coherent curve.
2. **Energy budget & day length.** Is 16 actions/day right? Should max energy scale?
   Should some actions cost more? How long should a "day" of play feel?
3. **Idle vs. active.** The prototype is **fully active** — the night only advances on
   an explicit Sleep, nothing accrues in real time. Should Little Acre stay active, or
   grow an idle spine (offline growth, auto-harvester, sprinklers-over-time, a
   welcome-back summary)? This is the biggest open identity question and shapes M2/M3.
4. **Prestige (Rebloom) math.** The multiplier curve, what persists across Reblooms,
   gem-bought meta-upgrades, and whether prestige is where the game leans idle.
5. **Pollinator boost.** Wildflowers are specced to boost nearby crops but the effect
   is undefined.
6. **Tools & gating.** Fishing Rod / Iron Pickaxe appear in the Shop as if they gate
   pond/rock use — decide whether fishing/mining are gated behind tools or free from
   the start (currently free).

---

## 9. Implementation notes (M0)

- Pure game logic lives in `src/lib/game/tiles.ts` (`CROPS`/`LAND`/`STRUCT`, `createBoard`,
  `resolveNight`, `harvestValue`, `isRipe`, `needsWater`) and is Vitest-covered.
- The board is drawn imperatively by `src/lib/renderer/board-renderer.ts` (Canvas2D) —
  ported 1:1 from the prototype's `draw`/`drawTile`/`drawPlant`/etc. Palette is locked in
  `src/lib/renderer/palette.ts`.
- The Zustand store (`src/lib/game/store.ts`) is the single source of truth; actions
  return an `ActionResult` that `Game.tsx` maps onto renderer fx so React never
  re-renders per frame.
