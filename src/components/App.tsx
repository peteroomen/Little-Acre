'use client';

import { Game } from './Game';

/**
 * Top-level shell. Minimal for M0 — the game boots straight into the single farm
 * screen. A menu / multiple farms can slot in here later (see ROADMAP M4/M5).
 */
export function App() {
  return <Game />;
}
