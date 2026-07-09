'use client';

import { useGameStore } from '@/lib/game/store';

/** The cozy title screen (mockup 1a): kicker · flanked title · sticker buttons · footer. */
export function MainMenu() {
  const startFreeplay = useGameStore((s) => s.startFreeplay);
  const goPuzzleSelect = useGameStore((s) => s.goPuzzleSelect);

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center gap-9 px-6 pb-16">
      <div className="flex flex-col items-center gap-1.5 text-center">
        <div className="text-xs font-semibold uppercase tracking-[3px] text-[var(--la-label)]">
          a cozy little farm
        </div>
        <div className="mt-1 flex items-center justify-center gap-3">
          <span
            className="la-star inline-block h-3.5 w-3.5 flex-none"
            style={{ background: 'var(--la-title-pink)' }}
          />
          <h1 className="font-pixel text-[46px] font-bold leading-none text-[var(--la-text)] [text-shadow:0_4px_0_var(--la-title-shadow)]">
            Little Acre
          </h1>
          <span
            className="la-star inline-block h-3.5 w-3.5 flex-none"
            style={{ background: 'var(--la-title-lilac)' }}
          />
        </div>
      </div>

      <div className="flex w-full max-w-[230px] flex-col items-stretch gap-3.5">
        <button
          onClick={startFreeplay}
          className="la-notch-5 la-btn-green px-4 py-4 font-pixel text-xl font-semibold active:translate-y-0.5"
        >
          Freeplay
        </button>
        <button
          onClick={goPuzzleSelect}
          className="la-notch-5 la-btn-amber px-4 py-4 font-pixel text-xl font-semibold active:translate-y-0.5"
        >
          Puzzles
        </button>
        <button
          disabled
          className="la-notch cursor-default px-4 py-3 font-pixel text-[15px] font-semibold text-[var(--la-settings-text)]"
          style={{
            boxShadow: 'inset 0 0 0 3px var(--la-settings-line)',
            background: 'rgba(253,243,224,.8)',
          }}
        >
          Settings · soon
        </button>
      </div>

      <div className="absolute bottom-3.5 left-0 right-0 text-center text-[11px] text-[var(--la-hint)]">
        day one of many
      </div>
    </div>
  );
}
