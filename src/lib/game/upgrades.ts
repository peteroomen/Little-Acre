/**
 * Little Acre — purchasable upgrade economy (pure; exercised in Vitest).
 *
 * Data-driven so adding an upgrade is one entry here + (if it needs a new derived value) a
 * small getter. Levels live in the store as `UpgradeLevels`; nothing here imports React/DOM.
 * Costs/effects are first-pass — tune alongside scripts/little-acre-model.mjs.
 */

export type UpgradeId = 'energy' | 'fertilizer';

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  /** Static one-liner (the "why"). */
  desc: string;
  color: string;
  baseCost: number;
  /** Geometric cost growth per level already owned. */
  costMult: number;
  maxLevel: number;
  /** Human effect at a given owned level (0 = none yet). */
  effect: (level: number) => string;
}

export const UPGRADE_DEFS: Record<UpgradeId, UpgradeDef> = {
  energy: {
    id: 'energy',
    name: 'Extra Energy',
    desc: 'More actions before you need to sleep.',
    color: '#f5a623',
    baseCost: 60,
    costMult: 1.7,
    maxLevel: 8,
    effect: (l) => `+${l * ENERGY_PER_LEVEL} max energy`,
  },
  fertilizer: {
    id: 'fertilizer',
    name: 'Rich Fertilizer',
    desc: 'Richer soil, bigger harvests.',
    color: '#c49a5c',
    baseCost: 80,
    costMult: 1.8,
    maxLevel: 8,
    effect: (l) => `+${Math.round(l * FERTILIZER_PER_LEVEL * 100)}% harvest value`,
  },
};

export const UPGRADE_IDS = Object.keys(UPGRADE_DEFS) as UpgradeId[];

export type UpgradeLevels = Record<UpgradeId, number>;

export const ZERO_UPGRADES: UpgradeLevels = { energy: 0, fertilizer: 0 };

export const BASE_MAX_ENERGY = 16;
export const ENERGY_PER_LEVEL = 2;
export const FERTILIZER_PER_LEVEL = 0.08;

/** Coin cost of the NEXT level (i.e. buying while you own `level`). */
export function upgradeCost(id: UpgradeId, level: number): number {
  const d = UPGRADE_DEFS[id];
  return Math.round(d.baseCost * Math.pow(d.costMult, level));
}

export function isMaxed(id: UpgradeId, level: number): boolean {
  return level >= UPGRADE_DEFS[id].maxLevel;
}

/** Max daily energy given the owned Extra Energy levels. */
export function maxEnergyFor(levels: UpgradeLevels): number {
  return BASE_MAX_ENERGY + levels.energy * ENERGY_PER_LEVEL;
}

/** Multiplier applied to a harvest's coin value from Rich Fertilizer. */
export function harvestMultFor(levels: UpgradeLevels): number {
  return 1 + levels.fertilizer * FERTILIZER_PER_LEVEL;
}

/** Coerce an arbitrary blob into valid, non-negative, capped upgrade levels. */
export function normalizeUpgrades(raw: unknown): UpgradeLevels {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<UpgradeId, unknown>>;
  const out: UpgradeLevels = { ...ZERO_UPGRADES };
  for (const id of UPGRADE_IDS) {
    const v = src[id];
    if (typeof v === 'number' && Number.isFinite(v)) {
      out[id] = Math.max(0, Math.min(UPGRADE_DEFS[id].maxLevel, Math.floor(v)));
    }
  }
  return out;
}
