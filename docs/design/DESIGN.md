# Little Acre — Design

> Status: **living design doc** · Last pass: 2026-07-07
> This is the north-star vision. It supersedes the prototype-faithful capture in `GDD.md` where
> they differ. Numbers here are **first-pass and tunable** — the source of truth for balance is the
> runnable model at `scripts/little-acre-model.mjs`. Run it: `node scripts/little-acre-model.mjs`.

---

## 1. Pitch & pillars

A **cozy isometric pixel-art farming sim** — a small, warm, unhurried acre you tend a few quiet
minutes at a time. Not an idle game: you drive every action, but the world is forgiving and never
punishes you harshly. Think Stardew's crafting/processing depth on a bite-sized, session-based board.

**Pillars**
1. **Cozy, never punishing.** Worst case you lose a harvest, never your farm. No timers you must
   race, no fail states in Freeplay.
2. **A few quiet minutes.** Session-based, not idle. A day is a small, satisfying optimization.
3. **Tend, craft, process.** Grow → gather → craft better tools → process raw goods into artisan
   goods worth far more. Depth comes from the chain, not from big numbers.
4. **Discovery.** New seeds, saplings, recipes, and critters turn up as you dig deeper. Completion
   is the long game.

---

## 2. The backbone: the night is the universal clock

There is **no real time.** Everything advances when you **Sleep**: crops grow a stage, processing
machines finish, ponds restock, mined nodes respawn, critters wander. One rhythm, fully
session-friendly, trivially save-friendly. Day → (spend energy) → Sleep → Night resolves → Dawn.

**Energy** is the day's action budget (start: 16). Most interactions cost 1 energy. When energy runs
out, you Sleep to advance the world and refill. Energy is *slack early* (you can't yet afford the
tools that would soak it up) and *tight mid-game* (farm + three gather activities + processing all
competing) — that curve is intentional.

The core engine loop:

> **spend today's energy → turn it into capital (crops / fish / ore / wood) → craft tools & machines
> → get more *effective* energy tomorrow (fewer clicks, better yields, higher-value goods).**

---

## 3. Modes (MVP ships both)

- **Freeplay** — the open acre. No prestige, no reset. The pull is **completion**: unlock every
  crop/recipe/tool tier, fill the Guide, build out and beautify the acre. Bloom (a farming yield
  multiplier) is a slow *permanent* build-up (fertilizer, soil quality, milestones) — **never a
  reset mechanic.**
- **Puzzle** — handcrafted "produce X of good G in Y nights" scenarios on a fixed board with a fixed
  starting kit. The fun is finding the optimal chain under the clock. Every puzzle is validated by
  the model for feasibility + par (see §9). MVP: 3–5 puzzles.

---

## 4. The board & tiles

An isometric grid of raised tiles (prototype: 3×3; target: ~expandable). Tile kinds:

| Tile | Interaction |
| --- | --- |
| **Grass** | Empty; clear/expand into soil (needs Axe to clear brush/trees first) |
| **Tilled soil** | Plant a crop; water it; can also host a structure (sprinkler/scarecrow) |
| **Pond** | Fish (Rod-gated); restocks a few fish per night; also yields chests |
| **Rock** | Resolves to a **resource node** (ore/gems) *or* a **critter** (combat); respawns after nights |
| **Tree** | Chop (Axe-gated) for wood; drops **nests → seeds/saplings** |
| **Wildflowers** | Passive pollinator boost to adjacent crops |

---

## 5. Farming (the early engine)

Crops grow over N nights, advancing one stage per **watered** night. An unwatered night wilts them
(Scarecrow prevents wilt; Sprinkler auto-waters). Harvest is free (0 energy). Sell raw, or **process**
for far more. Some crops **re-yield** (harvest several times before replanting); some are
**processing-only** (near-worthless raw).

**The design goal: each crop wins a different axis**, so the right choice depends on whether **tiles**
or **energy** is your bottleneck that day.

### Tier 1 — available at start (buy seeds from Shop)

| Crop | cost | grow | sell | Role |
| --- | --- | --- | --- | --- |
| **Carrot** | 4 | 2n | 20 | Bootstrap — cheap + fast; the "I'm broke" crop. Best coins/tile-night. |
| **Potato** | 6 | 3n | 34 | Staple — reliable, balanced. |
| **Tomato** | 12 | 4n | 18 ×3 | Keep-alive — plant once, re-harvest 3× free. Best coins/**energy** (few clicks). |

### Tier 2 — seeds/saplings from fishing chests & tree nests

| Crop | cost | grow | raw | Processed | Role |
| --- | --- | --- | --- | --- | --- |
| **Hops** | 9 | 3n | **3** (negative net raw!) | Beer (Keg) 95 | Proc-only — dead weight unless kegged. |
| **Blueberry** | 22 | 4n | 14 ×6 | Jam (Jar) | Set-and-forget bush; re-yields ~6. |
| **Cauliflower** | 20 | 5n | 90 (fragile) | Pickle (Jar) 185 | Premium/risk — wilts without a Scarecrow. |

---

## 6. Tools, gathering & combat

### Tool gating (bought tier I, crafted tier II+)

- **Farming works turn 1** — you start with a basic Watering Can.
- **Hands do the lowest tier only:** pull weeds → fiber, gather deadfall wood, pick loose stones.
  Keeps the world alive and teaches, but caps at trash-tier mats.
- **Real ore, big trees, and combat critters need the tool** (Pickaxe / Axe / Sword) — impossible or
  painfully slow by hand. First tool purchases *feel* like unlocks.
- **Fishing is hard-gated behind the Rod** — no hand-fishing (thematically right).
- **Tier-I tools are bought** with coins (from farming). **Tier-II+ tools and all machines are
  crafted** (Furnace → bars + gathered mats). This breaks the ore↔pickaxe chicken-and-egg: the first
  pickaxe comes from the Shop; mining pays for the crafted upgrade.
- Better tools = **fewer clicks per action** and access to **better resource classes/depths**.

### Gathering = a timing skill game, not a spam button

Each gather activity is throttled (restock/respawn on the night clock) **and** skill-based:

- **Fishing** — tap the bobber as it dips. Yields fish + **chests** (ore / seeds / saplings).
- **Mining** — hit the crit window on a power bar. Yields ore/gems; may spawn a **critter**.
- **Chopping** — wood + **nests → seeds/saplings** (the seed-discovery engine); clears land.

Skill → yield multiplier (miss ×1.0 / ok ×1.2 / perfect ×1.5). So gathering costs **energy**
(strategic) **and** **attention/timing** (active) — the anti-idle soul of the game. Nobody can
pure-spreadsheet it.

### Combat (cozy-light; deeper mine is a later expansion)

A rock tile may resolve to a **critter** (slime/mole) instead of a node. A critter **takes K hits**
(K set by Sword/Pickaxe tier) and **blocks the tile** until cleared; clearing drops **combat loot**
(slime, bone, rare gem) that crafting needs. **No health you can lose** — the "risk" is energy/time
sunk. **Soft-risk neglect:** a critter left too long can **eat an adjacent crop** (you lose a
harvest, never the farm). A dedicated **descend-the-mine** mode with real combat is deferred to a
post-MVP expansion.

---

## 7. Crafting & processing

- **Furnace** smelts ore → bars — gates all tool/machine crafting.
- **Machines** (Smoker, Keg, Preserves Jar, …) each eat a raw good + (sometimes) fuel + **N nights**
  and return a **2×–2.6× value** artisan good. Throughput = number of machines × fuel/night.
- **Processing is where the money is** mid/late, and **mandatory for a whole crop class** (Hops → Beer
  is ×31 — worthless raw, best money in the game kegged).

| Machine | Flow | Mult | Nights |
| --- | --- | --- | --- |
| Furnace | Copper → Bar | ×2.4 | 1 |
| Smoker | Fish → Smoked Fish | ×2.4 | 1 |
| Preserves Jar | Cauliflower → Pickle | ×2.1 | 2 |
| Keg | Hops → Beer | ×31.7 | 3 |

**Everything is sellable.** Ship goods (overnight shipping bin → coins at dawn fits the night clock,
or instant Shop sell). Some items are crafting inputs, not just cash.

---

## 8. Economy & progression arc

Modeled (`scripts/little-acre-model.mjs`), the **farming-first crossover**:

- **Early:** farming is 48–96 coins/day and the *only* income — the Rod/Pickaxe/Axe (150–300c) are
  unaffordable until farming pays for them. Farming bankrolls the whole transition.
- **Gathering** would earn ~120/day each, but it's tool-gated and throttled — a supplement, not a
  replacement, and the feedstock for crafting.
- **Watering-can tiers are the progression** (Can I→II→III: 1→3→9 tiles/energy) — the same crop's
  coins/energy roughly triples per tier. Crafting a better can is *literally* how the farm becomes
  worth farming at scale.
- **Processing** is the mid/late multiplier and the reason to keep growing feedstock crops.

Greedy pacing (farming income only): Rod ~d3, Axe ~d7, Can II ~d10, Pickaxe ~d14, Smoker ~d18,
Keg ~d22, Jar ~d27 → ~4 weeks to a full toolkit. A cozy ramp, not a forever-grind.

**Currencies & goods:** Coins (soft), Gems (rare, from mining), plus an item economy (crops, fish,
ore/bars, wood, fiber, artisan goods, combat loot, seeds/saplings).

---

## 9. The model as a tool

`scripts/little-acre-model.mjs` reports crop role differentiation, the watering-can crossover,
gathering caps, processing value-add, a greedy pacing timeline, **and a puzzle validator**: given a
board layout, is "produce N of G in D nights" feasible, and what's par? A good puzzle is tuned so
par ≈ the given nights, forcing near-optimal play. This lets us author puzzles safely and keep
balance a living, runnable thing rather than numbers in a doc.

---

## 10. Graphics

- **MVP: procedural Canvas2D** for tiles/crops/ground (parametric, deterministic, versionable, tiny,
  trivial to iterate — the prototype proves it already looks like the cozy-pixel target).
- Small **data-defined or PNG sprites** for "hero" props (critters, chests, tools, UI icons).
- Build the renderer behind a **Sprite interface** so real spritesheets drop in later without
  rearchitecting.
- **Long-term:** an Aseprite → JSON spritesheet pipeline, or a real pixel artist. Placeholder AI
  sprites are serviceable at best — lean on procedural for MVP.

---

## 11. MVP scope

- Freeplay: full core loop — farm (Tier 1 crops), Sleep/night engine, energy, basic gather (Rod +
  Axe + Pickaxe tier I), Furnace + one processor (Smoker or Keg), Shop + crafting, Guide/collection.
- 3–5 authored puzzles, each model-validated for feasibility + par.
- Save/load (already scaffolded), both mobile orientations (nice-to-have).

## 12. Open / deferred

- Combat resolution details (hit counts per tool tier, critter variety, drop tables).
- Full crafting dependency graph beyond tier 2.
- The complete seed/collection tree (what unlocks what, rarity).
- Descend-the-mine expansion; seasons/festivals; weather.
- Bloom build-up sources and cap.
- Overnight shipping bin vs instant sell.
