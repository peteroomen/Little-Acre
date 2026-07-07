# Little Acre — MVP Puzzles

> 5 authored "produce X in Y nights" scenarios for Puzzle mode. Each teaches/showcases a system and
> is tuned so **par ≈ the given nights** (near-optimal play required). Chain puzzles (P3/P5) are
> validated by `scripts/little-acre-model.mjs`'s `checkChainPuzzle`. Farming puzzles (P1/P2/P4)
> state their intent + approximate par; **final par is locked against the real game sim** once the
> core loop exists (the first-pass model doesn't yet account for replant-energy, which is the whole
> point of the crop-choice puzzles).

Each puzzle defines: **board** (tiles + starting kit), **energy/day**, **objective**, **par**, and
the **lesson**. Freeplay bank/tools do NOT carry in — puzzles are self-contained.

---

## P1 — "Breaking Ground" *(tutorial)*

- **Board:** 6 tilled soil · basic Watering Can · 40 coins · 16 energy/day.
- **Objective:** Harvest **10 Carrots** in **5 nights**.
- **Par:** ~5 (Carrot grows in 2 nights → two batches of 6 = 12 max; 10 leaves a little slack).
- **Lesson:** the core loop — plant → water → Sleep → harvest → replant. Deliberately gentle.

## P2 — "Thirsty Work" *(crop choice under scarcity)*

- **Board:** 6 tilled soil · basic Watering Can · Carrot **and** Tomato seeds · **8 energy/day** (tight).
- **Objective:** Harvest **12 crops** in **6 nights**.
- **Par:** only reachable by leaning on **Tomato** (plant once, re-yields 3× — pure watering cost).
  Carrots *look* faster but replanting 6 tiles every 2 nights blows the 8-energy budget, so a
  carrot-only board stalls. **Final target/par tuned against the sim.**
- **Lesson:** when **energy** (not land) is the bottleneck, energy-cheap re-yield crops win.

## P3 — "Smoke Signals" *(processing chain)* ✅ model-validated

- **Board:** 1 pond · Fishing Rod · **2 Smokers** · coal supply · 16 energy/day.
- **Objective:** Ship **12 Smoked Fish** in **6 nights**.
- **Par:** exactly **6** — 2 smokers × 6 nights = 12 capacity, so **both smokers must run every
  night** with zero waste (fish supply is ample at ≤5/night from the pond). Model: `cap 12, par 6`.
- **Lesson:** raw → artisan value-add; throughput is machine-bound, not input-bound.

## P4 — "Cold Iron" *(crafting gate)*

- **Board:** 3 rock tiles · **Pickaxe I** · **Furnace** · basic Watering Can · a few soil tiles · 16 energy/day.
- **Objective:** Craft a **Watering Can II** in **7 nights** (needs 5 Copper Bars → 5 copper smelted).
- **Par:** ~7 — mining copper (crit-timing) + smelting 1 bar/night in the Furnace is the bottleneck;
  you farm on the side to not starve. **Final par tuned against the sim.**
- **Lesson:** the bought-tool → mine → smelt → craft-upgrade spine; machines gate progress.

## P5 — "Last Call" *(proc-only showcase)*

- **Board:** hops-ready soil · **4 Kegs** · 16 energy/day.
- **Objective:** Produce **12 Beer** in **9 nights**.
- **Par:** **9** — a Keg takes 3 nights/beer, so in 9 nights each keg yields 3; 4 kegs × 3 = 12
  capacity. Every keg must run back-to-back the whole time. (Hops sells 3 raw — useless unhopped.)
- **Lesson:** some crops only pay off processed; slow machines reward continuous scheduling.

---

## Authoring rule of thumb

A good puzzle sits at **par ≈ nights** — feasible, but only with near-optimal play; one wasted
machine-night or misallocated energy misses it. Use the model's `checkChainPuzzle` for any
processing/chain target; validate farming targets against the sim once it lands. Escalate: P1 teaches
the loop, P2 the energy trade-off, P3 processing, P4 crafting, P5 scheduling.
