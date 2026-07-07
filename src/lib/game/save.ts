import { createBoard, type Tile } from './tiles';

/**
 * Versioned localStorage save. Bump SAVE_VERSION when the shape changes and add a
 * migration branch in `parseSave`. Offline handling is a stub for M0 (Little Acre's
 * day/night advances only on an explicit Sleep, so there's no passive accrual to bank
 * yet) — see docs/ROADMAP.md M2/M3 for the idle question.
 */
export const SAVE_VERSION = 1;
const SAVE_KEY = 'little-acre-v1';

export interface SaveState {
  version: number;
  coins: number;
  gems: number;
  day: number;
  energy: number;
  maxEnergy: number;
  bloom: number;
  board: Tile[];
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

/**
 * Normalise a parsed blob into a current SaveState, tolerating older/partial shapes.
 * Returns null if the payload is unusable so the caller falls back to a fresh farm.
 */
export function parseSave(data: unknown): SaveState | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Partial<SaveState>;
  const board =
    Array.isArray(d.board) && d.board.length === 9 ? (d.board as Tile[]) : createBoard();
  return {
    version: SAVE_VERSION,
    coins: numOr(d.coins, 220),
    gems: numOr(d.gems, 3),
    day: numOr(d.day, 1),
    energy: numOr(d.energy, 16),
    maxEnergy: numOr(d.maxEnergy, 16),
    bloom: numOr(d.bloom, 1.4),
    board,
    seen: d.seen && typeof d.seen === 'object' ? d.seen : {},
    savedAt: numOr(d.savedAt, Date.now()),
  };
}

function numOr(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}
