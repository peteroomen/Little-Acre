import { CROPS, createBoard, POND_MAX, ROCK_CHARGES, type CropId, type Tile } from './tiles';
import { normalizeUpgrades, type UpgradeLevels } from './upgrades';

/**
 * Versioned localStorage save. Bump SAVE_VERSION when the shape changes and add a
 * migration branch in `parseSave`. Offline handling is a stub for M0 (Little Acre's
 * day/night advances only on an explicit Sleep, so there's no passive accrual to bank
 * yet) — see docs/ROADMAP.md M2/M3 for the idle question.
 *
 * v2: tiles gained `harvests` (re-yield); the Tier-1 crop set replaced the prototype's
 * crops, so any unknown crop id from an older save is cleared by `normalizeTile`.
 * v3: added `upgrades` (purchasable levels); backfilled to zero for older saves.
 * v4: gathering nodes gained `pondStock` / `rockCharges` / `rockDormant`; `normalizeTile`
 *     backfills them (pond 4, rock 3 charges, 0 dormant) so older saves start stocked.
 */
export const SAVE_VERSION = 4;
const SAVE_KEY = 'little-acre-v1';
/** Puzzle best-stars live in their OWN key so an ephemeral puzzle never touches the farm save. */
const PUZZLE_KEY = 'little-acre-puzzles';

export interface SaveState {
  version: number;
  coins: number;
  gems: number;
  day: number;
  energy: number;
  maxEnergy: number;
  bloom: number;
  board: Tile[];
  upgrades: UpgradeLevels;
  seen: Record<string, 1>;
  savedAt: number;
}

export function saveGame(state: SaveState): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or unavailable (private mode) — a lost autosave is non-fatal.
  }
}

export function loadGame(): SaveState | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;
  try {
    return parseSave(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function clearSave(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(SAVE_KEY);
}

/** Best stars earned per puzzle id. Persisted separately from the Freeplay farm save. */
export function loadPuzzleStars(): Record<string, number> {
  if (typeof localStorage === 'undefined') return {};
  const raw = localStorage.getItem(PUZZLE_KEY);
  if (!raw) return {};
  try {
    const data = JSON.parse(raw) as { puzzleStars?: unknown };
    const src = data && typeof data.puzzleStars === 'object' ? data.puzzleStars : null;
    if (!src) return {};
    const out: Record<string, number> = {};
    for (const [id, v] of Object.entries(src as Record<string, unknown>)) {
      if (typeof v === 'number' && Number.isFinite(v))
        out[id] = Math.max(0, Math.min(3, Math.floor(v)));
    }
    return out;
  } catch {
    return {};
  }
}

export function savePuzzleStars(puzzleStars: Record<string, number>): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(PUZZLE_KEY, JSON.stringify({ puzzleStars }));
  } catch {
    // Non-fatal — best stars are a nicety, not run state.
  }
}

/**
 * Normalise a parsed blob into a current SaveState, tolerating older/partial shapes.
 * Returns null if the payload is unusable so the caller falls back to a fresh farm.
 */
export function parseSave(data: unknown): SaveState | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Partial<SaveState>;
  const board =
    Array.isArray(d.board) && d.board.length === 9
      ? (d.board as Partial<Tile>[]).map(normalizeTile)
      : createBoard();
  return {
    version: SAVE_VERSION,
    coins: numOr(d.coins, 220),
    gems: numOr(d.gems, 3),
    day: numOr(d.day, 1),
    energy: numOr(d.energy, 16),
    maxEnergy: numOr(d.maxEnergy, 16),
    bloom: numOr(d.bloom, 1.4),
    board,
    upgrades: normalizeUpgrades(d.upgrades),
    seen: d.seen && typeof d.seen === 'object' ? d.seen : {},
    savedAt: numOr(d.savedAt, Date.now()),
  };
}

function numOr(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

/**
 * Coerce a persisted tile into the current shape: default `harvests`, and clear any crop id
 * that no longer exists in CROPS (e.g. the prototype's wheat/lettuce) so it doesn't render or
 * harvest as a ghost.
 */
function normalizeTile(raw: Partial<Tile>): Tile {
  const cropValid = typeof raw.crop === 'string' && raw.crop in CROPS;
  const crop = cropValid ? (raw.crop as CropId) : null;
  const kind = raw.kind ?? 'grass';
  return {
    r: numOr(raw.r, 0),
    c: numOr(raw.c, 0),
    kind,
    crop,
    stage: crop ? numOr(raw.stage, 0) : 0,
    harvests: crop ? numOr(raw.harvests, 0) : 0,
    watered: !!raw.watered,
    wilted: crop ? !!raw.wilted : false,
    structure: raw.structure ?? null,
    // v4: gathering-node stock backfills so older saves (and non-node tiles) round-trip.
    pondStock: kind === 'pond' ? numOr(raw.pondStock, POND_MAX) : undefined,
    rockCharges: kind === 'rock' ? numOr(raw.rockCharges, ROCK_CHARGES) : undefined,
    rockDormant: kind === 'rock' ? numOr(raw.rockDormant, 0) : undefined,
  };
}
