import { describe, expect, it } from 'vitest';

import {
  BASE_MAX_ENERGY,
  harvestMultFor,
  isMaxed,
  maxEnergyFor,
  normalizeUpgrades,
  UPGRADE_DEFS,
  upgradeCost,
  ZERO_UPGRADES,
} from './upgrades';

describe('upgradeCost', () => {
  it('starts at baseCost and grows geometrically per owned level', () => {
    expect(upgradeCost('energy', 0)).toBe(UPGRADE_DEFS.energy.baseCost);
    expect(upgradeCost('energy', 1)).toBe(Math.round(60 * 1.7));
    expect(upgradeCost('energy', 2)).toBe(Math.round(60 * 1.7 * 1.7));
    expect(upgradeCost('fertilizer', 0)).toBe(80);
  });
});

describe('isMaxed', () => {
  it('is true only at or above the definition max', () => {
    expect(isMaxed('energy', UPGRADE_DEFS.energy.maxLevel - 1)).toBe(false);
    expect(isMaxed('energy', UPGRADE_DEFS.energy.maxLevel)).toBe(true);
  });
});

describe('derived effects', () => {
  it('maxEnergyFor adds +2 per Extra Energy level', () => {
    expect(maxEnergyFor(ZERO_UPGRADES)).toBe(BASE_MAX_ENERGY);
    expect(maxEnergyFor({ energy: 3, fertilizer: 0 })).toBe(BASE_MAX_ENERGY + 6);
  });

  it('harvestMultFor adds +8% per Rich Fertilizer level', () => {
    expect(harvestMultFor(ZERO_UPGRADES)).toBe(1);
    expect(harvestMultFor({ energy: 0, fertilizer: 2 })).toBeCloseTo(1.16);
  });
});

describe('normalizeUpgrades', () => {
  it('defaults missing / bad payloads to zero', () => {
    expect(normalizeUpgrades(undefined)).toEqual(ZERO_UPGRADES);
    expect(normalizeUpgrades('nope')).toEqual(ZERO_UPGRADES);
    expect(normalizeUpgrades({ energy: NaN })).toEqual(ZERO_UPGRADES);
  });

  it('clamps to [0, maxLevel], floors, and drops unknown keys', () => {
    expect(normalizeUpgrades({ energy: 3.9, fertilizer: -2, bogus: 5 })).toEqual({
      energy: 3,
      fertilizer: 0,
    });
    expect(normalizeUpgrades({ energy: 999 })).toEqual({
      energy: UPGRADE_DEFS.energy.maxLevel,
      fertilizer: 0,
    });
  });
});
