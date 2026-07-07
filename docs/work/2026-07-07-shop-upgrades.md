# Real Store Purchases — buyable upgrades

**Date:** 2026-07-07 · **Branch:** feature/shop-upgrades · **Roadmap item:** M2 — turn the presentational Store into a real progression spine

## Goal

Make the Store's **Boost** tab a real economy: coins buy **repeatable, levelled upgrades** with
geometric costs that actually change how you play. First two, wired into existing systems (no new
mechanics needed):

- **Extra Energy** — +2 max energy / level (a bigger daily action budget).
- **Rich Fertilizer** — +8% harvest value / level (bigger coin payouts).

## Approach

- New pure `src/lib/game/upgrades.ts`: data-driven `UPGRADE_DEFS` (id, name, cost curve, maxLevel,
  effect copy) + pure `upgradeCost`, `maxEnergyFor`, `harvestMultFor`. Fully Vitest-tested.
- Store: `upgrades: UpgradeLevels` + `buyUpgrade(id)` (spend coins, level up, recompute `maxEnergy`,
  top up current energy on an Energy buy so it's felt immediately). Harvest payout now
  `harvestValue(crop, bloom × harvestMultFor(upgrades))`.
- Save **v3**: persist `upgrades`; `parseSave` backfills `ZERO_UPGRADES`; on load, `maxEnergy` is
  recomputed from levels so it can't desync.
- `StoreModal` Boost tab: replace the static list with real cards driven by the store — level pill
  (`Lv n / max`), the next-level effect line, a cost button that disables when unaffordable or maxed.
- Rebloom keeps purchased upgrades (they're meta power; prestige is being de-emphasised anyway).

Shop-tab **tools/seeds** stay presentational — they're gated on the tool system + Tier-2 unlocks
(later slices). This slice is the upgrade economy.

## Steps

- [ ] `upgrades.ts` + `upgrades.test.ts` (cost curve, derived max-energy / harvest-mult, maxed).
- [ ] Store: state + `buyUpgrade`, harvest uses `harvestMultFor`, init/save/applySave.
- [ ] `save.ts`: v3 + `upgrades` normalise.
- [ ] `StoreModal`: real Boost cards.

## Manual test steps

- [ ] Open Store → Boost. Buy Extra Energy → max energy rises, current energy bumps, cost goes up.
- [ ] Buy Rich Fertilizer → next carrot harvest pays more than before.
- [ ] Spend down coins → an unaffordable upgrade's buy button disables.
- [ ] Buy to max → button shows MAX, no further spend.
- [ ] Edge: reload → upgrade levels + raised max energy persist.

## Out of scope

Shop-tab tool/seed purchases (need tool-gating + Tier-2), Auto-Harvester / Sprinkler-System
automation (need the loop), gathering throttle.

---

<!-- Fill in during/after -->

## What actually happened

Built as planned. New pure `upgrades.ts` (data-driven defs + cost curve + derived getters +
`normalizeUpgrades`). Store gained `upgrades` + `buyUpgrade` (spends coins, levels up, recomputes
maxEnergy and tops up current energy on an Energy buy); harvest payout now folds in
`harvestMultFor`. Save v3 persists/normalises levels; `applySave` recomputes maxEnergy from levels so
it can't desync. Boost tab is now real store-driven cards (level pill, current + next effect line,
cost button that disables when unaffordable/maxed, MAX state). Rebloom left keeping upgrades.

## Files created / modified

- `src/lib/game/upgrades.ts` (new) + `src/lib/game/upgrades.test.ts` (new, 6 tests).
- `src/lib/game/store.ts` — upgrades state, `buyUpgrade`, fertilizer into harvest, save/applySave.
- `src/lib/game/save.ts` — SAVE_VERSION 3, `upgrades` field + normalise.
- `src/lib/game/save.test.ts` — upgrades in the fixture + default-backfill assertion.
- `src/components/ui/StoreModal.tsx` — real Boost cards; `PriceButton` gains onClick/disabled/hideCoin.

## Deferred to next session

Playwright visual pass (covering this + the Tier-1 slice). Shop-tab tool/seed purchases (gated on
the tool system + Tier-2). Automation upgrades (Auto-Harvester / Sprinkler System) once the loop
supports them.

## Status

- [ ] In progress - [x] Complete - [ ] Partial — see deferred
