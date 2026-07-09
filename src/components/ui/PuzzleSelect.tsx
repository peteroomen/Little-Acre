'use client';

import {
  isPuzzleUnlocked,
  objectiveLabel,
  PUZZLES,
  type PuzzleDef,
  type PuzzleObjective,
  type PuzzleSection,
} from '@/lib/game/puzzles';
import { useGameStore } from '@/lib/game/store';

const SHELVES: { section: PuzzleSection; title: string }[] = [
  { section: 'tutorial', title: 'Tutorials' },
  { section: 'challenge', title: 'Challenges' },
];

/** Puzzle picker: cards filed under Tutorials / Challenges shelves; sequential unlock. */
export function PuzzleSelect() {
  const puzzleStars = useGameStore((s) => s.puzzleStars);
  const startPuzzle = useGameStore((s) => s.startPuzzle);
  const goMenu = useGameStore((s) => s.goMenu);

  // Keep the global PUZZLES index alongside each def so numbering + unlock order are unchanged.
  const indexed = PUZZLES.map((def, index) => ({ def, index }));

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

      <div className="flex w-full max-w-[560px] flex-col gap-5 pb-8">
        {SHELVES.map(({ section, title }) => {
          const rows = indexed.filter(({ def }) => def.section === section);
          if (rows.length === 0) return null;
          return (
            <section key={section} className="flex flex-col gap-3">
              <ShelfHeader title={title} />
              {rows.map(({ def, index }) => (
                <PuzzleCard
                  key={def.id}
                  def={def}
                  index={index}
                  unlocked={isPuzzleUnlocked(index, puzzleStars)}
                  stars={puzzleStars[def.id] ?? 0}
                  onStart={() => startPuzzle(def.id)}
                />
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}

/** Cozy-but-quiet shelf label: a small pixel caption trailed by a hairline rule. */
function ShelfHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2.5 px-1">
      <span className="font-pixel text-[13px] font-semibold uppercase tracking-[0.2em] text-[#b89a6f]">
        {title}
      </span>
      <span className="h-px flex-1 bg-[#e7d3ad]" />
    </div>
  );
}

function PuzzleCard({
  def,
  index,
  unlocked,
  stars,
  onStart,
}: {
  def: PuzzleDef;
  index: number;
  unlocked: boolean;
  stars: number;
  onStart: () => void;
}) {
  return (
    <button
      disabled={!unlocked}
      onClick={() => unlocked && onStart()}
      className="la-notch flex items-center gap-3.5 bg-[#fffaf0] px-4 py-3.5 text-left shadow-[inset_0_0_0_3px_#f0e0c4] active:translate-y-0.5 disabled:cursor-not-allowed"
      style={{ opacity: unlocked ? 1 : 0.5 }}
    >
      <span className="la-notch flex h-11 w-11 flex-none items-center justify-center bg-[#efe4ff] font-pixel text-lg font-semibold text-[#6a4bb0] shadow-[inset_0_0_0_3px_#d3bff2]">
        {unlocked ? index + 1 : '🔒'}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-pixel text-[15px] font-semibold text-[#5a462f]">
            {unlocked ? def.name : 'Locked'}
          </span>
          <Stars value={unlocked ? stars : 0} />
        </div>
        <div className="mt-0.5 text-xs leading-snug text-[#7a6547]">
          {unlocked
            ? goalLine(def.objective, def.nightLimit)
            : 'Earn a star on the previous puzzle to unlock.'}
        </div>
      </div>
    </button>
  );
}

function goalLine(objective: PuzzleObjective, nights: number): string {
  const when = nights === 0 ? 'today' : `in ${nights} night${nights === 1 ? '' : 's'}`;
  return `${objectiveLabel(objective)} ${when}`;
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
