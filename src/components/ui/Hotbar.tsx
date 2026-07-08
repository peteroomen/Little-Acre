'use client';

import { useGameStore } from '@/lib/game/store';

/**
 * Bottom hotbar. With contextual tap + radial there are no tool modes to toggle, so this is
 * just the Store button — a Freeplay affordance (puzzles are self-contained: no shop/prestige).
 */
export function Hotbar() {
  const mode = useGameStore((s) => s.mode);
  const openStore = useGameStore((s) => s.openStore);

  if (mode !== 'freeplay') return null;

  return (
    <div className="absolute inset-x-0 bottom-0 z-10 flex justify-center p-3">
      <div className="la-notch flex items-stretch gap-2.5 bg-[var(--la-panel)] p-3 shadow-[inset_0_0_0_3px_#fffaf0,inset_0_0_0_6px_#e7cfa5]">
        <button
          onClick={openStore}
          className="la-notch flex w-[86px] flex-col items-center justify-center gap-0.5 bg-[var(--la-leaf)] px-1.5 py-2 font-pixel text-[13px] font-semibold text-[var(--la-leaf-text)] shadow-[inset_0_3px_0_rgba(255,255,255,.45),inset_0_-5px_0_rgba(40,80,20,.28),inset_0_0_0_3px_#bfe89b] active:translate-y-0.5"
        >
          <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
            <rect x="4" y="8" width="14" height="8" fill="#fbf3dc" />
            <rect x="4" y="6" width="14" height="3" fill="#e58a6a" />
            <rect x="6" y="6" width="2" height="3" fill="#fbf3dc" />
            <rect x="10" y="6" width="2" height="3" fill="#fbf3dc" />
            <rect x="14" y="6" width="2" height="3" fill="#fbf3dc" />
          </svg>
          <span>Store</span>
        </button>
      </div>
    </div>
  );
}
