'use client';

import { cropPlural, isPuzzleUnlocked, PUZZLES } from '@/lib/game/puzzles';
import type { CropId } from '@/lib/game/tiles';
import { useGameStore } from '@/lib/game/store';

/** Puzzle picker: a card per puzzle with its goal + best stars; sequential unlock. */
export function PuzzleSelect() {
  const puzzleStars = useGameStore((s) => s.puzzleStars);
  const startPuzzle = useGameStore((s) => s.startPuzzle);
  const goMenu = useGameStore((s) => s.goMenu);

  return (
    <div className="relative flex h-full w-full flex-col items-center overflow-auto p-5">
      <div className="flex w-full max-w-[560px] items-center justify-between pb-4 pt-2">
        <button
          onClick={goMenu}
          className="la-notch flex items-center gap-1.5 bg-[#fff1dd] px-3.5 py-2 font-pixel text-sm font-semibold text-[#a0895f] shadow-[inset_0_0_0_3px_#e7cfa5] active:translate-y-0.5"
        >
          ‹ Menu
        </button>
        <h1 className="font-pixel text-2xl font-semibold text-[#5a462f]">Puzzles</h1>
        <span className="w-[76px]" />
      </div>

      <div className="flex w-full max-w-[560px] flex-col gap-3 pb-8">
        {PUZZLES.map((p, i) => {
          const unlocked = isPuzzleUnlocked(i, puzzleStars);
          const stars = puzzleStars[p.id] ?? 0;
          return (
            <button
              key={p.id}
              disabled={!unlocked}
              onClick={() => unlocked && startPuzzle(p.id)}
              className="la-notch flex items-center gap-3.5 bg-[#fffaf0] px-4 py-3.5 text-left shadow-[inset_0_0_0_3px_#f0e0c4] active:translate-y-0.5 disabled:cursor-not-allowed"
              style={{ opacity: unlocked ? 1 : 0.5 }}
            >
              <span className="la-notch flex h-11 w-11 flex-none items-center justify-center bg-[#efe4ff] font-pixel text-lg font-semibold text-[#6a4bb0] shadow-[inset_0_0_0_3px_#d3bff2]">
                {unlocked ? i + 1 : '🔒'}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-pixel text-[15px] font-semibold text-[#5a462f]">
                    {unlocked ? p.name : 'Locked'}
                  </span>
                  <Stars value={unlocked ? stars : 0} />
                </div>
                <div className="mt-0.5 text-xs leading-snug text-[#7a6547]">
                  {unlocked
                    ? goalLine(p.objective.count, p.objective.crop, p.nightLimit)
                    : 'Earn a star on the previous puzzle to unlock.'}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function goalLine(count: number, crop: CropId | 'any', nights: number): string {
  return `Harvest ${count} ${cropPlural(crop, count)} in ${nights} nights`;
}

/** Three star slots, filled up to `value`. */
export function Stars({ value }: { value: number }) {
  return (
    <span className="flex gap-0.5" aria-label={`${value} of 3 stars`}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`text-sm leading-none ${i < value ? 'text-[#f5b23c]' : 'text-[#dcccae]'}`}
        >
          ★
        </span>
      ))}
    </span>
  );
}
