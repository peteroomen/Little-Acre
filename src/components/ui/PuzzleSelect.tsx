'use client';

import {
  isPuzzleUnlocked,
  objectiveLabel,
  PUZZLES,
  type PuzzleDef,
  type PuzzleSection,
} from '@/lib/game/puzzles';
import { useGameStore } from '@/lib/game/store';
import { CROPS } from '@/lib/game/tiles';

import { PixelStarRow } from './pixel';

const SHELVES: { section: PuzzleSection; title: string }[] = [
  { section: 'tutorial', title: 'Tutorials' },
  { section: 'challenge', title: 'Challenges' },
];

/** Puzzle picker (mockup 1b): back · star total · Tutorials/Challenges shelves; sequential unlock. */
export function PuzzleSelect() {
  const puzzleStars = useGameStore((s) => s.puzzleStars);
  const startPuzzle = useGameStore((s) => s.startPuzzle);
  const goMenu = useGameStore((s) => s.goMenu);

  // Keep the global PUZZLES index alongside each def so numbering + unlock order are unchanged.
  const indexed = PUZZLES.map((def, index) => ({ def, index }));
  const earned = PUZZLES.reduce((sum, p) => sum + (puzzleStars[p.id] ?? 0), 0);
  const total = PUZZLES.length * 3;

  return (
    <div className="relative flex h-full w-full flex-col items-center overflow-auto p-3.5">
      <div className="flex w-full max-w-[460px] flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <button
            onClick={goMenu}
            className="la-notch-3 la-chip-gold flex h-[38px] w-[38px] flex-none items-center justify-center font-pixel text-lg text-[var(--la-quiet-text)] active:translate-y-0.5"
            aria-label="Back to menu"
          >
            ‹
          </button>
          <span className="font-pixel text-2xl font-semibold text-[var(--la-text)]">Puzzles</span>
          <span
            className="ml-auto font-pixel text-[13px] text-[var(--la-coin-text)]"
            style={{
              background: 'var(--la-coin-soft)',
              boxShadow: 'inset 0 0 0 2px var(--la-gold-line)',
              padding: '4px 10px',
            }}
          >
            ★ {earned} / {total}
          </span>
        </div>

        {SHELVES.map(({ section, title }) => {
          const rows = indexed.filter(({ def }) => def.section === section);
          if (rows.length === 0) return null;
          return (
            <section key={section} className="flex flex-col gap-3">
              <div className="mt-1 font-pixel text-xs uppercase tracking-[1.4px] text-[var(--la-label)]">
                {title}
              </div>
              {rows.map(({ def, index }) => (
                <PuzzleCard
                  key={def.id}
                  def={def}
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

/** Accent swatch colour: the objective crop's palette hue; coins → coin, 'any' → leaf. */
function accentFor(def: PuzzleDef): string {
  const o = def.objective;
  if (o.kind === 'coins') return 'var(--la-coin)';
  if (o.crop === 'any') return 'var(--la-leaf)';
  return CROPS[o.crop].color;
}

/** "Harvest 3 Carrots · 2 nights" — 0-night puzzles read "today". */
function subtitle(def: PuzzleDef): string {
  const when =
    def.nightLimit === 0 ? 'today' : `${def.nightLimit} night${def.nightLimit === 1 ? '' : 's'}`;
  return `${objectiveLabel(def.objective)} · ${when}`;
}

function PuzzleCard({
  def,
  unlocked,
  stars,
  onStart,
}: {
  def: PuzzleDef;
  unlocked: boolean;
  stars: number;
  onStart: () => void;
}) {
  if (!unlocked) return <LockedCard />;

  const today = def.nightLimit === 0;
  return (
    <button
      onClick={onStart}
      className="la-notch la-card-sticker flex items-center gap-2.5 p-3 text-left active:translate-y-0.5"
    >
      <span
        className="la-notch-5 h-[38px] w-[38px] flex-none"
        style={{
          background: accentFor(def),
          boxShadow: 'inset 0 -4px 0 rgba(0,0,0,.14), inset 0 0 0 2px rgba(255,255,255,.35)',
        }}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-[var(--la-ink)]">{def.name}</span>
          {today && (
            <span
              className="font-pixel text-[10px] leading-none text-[var(--la-gem-deep)]"
              style={{ background: 'var(--la-today-bg)', padding: '1px 6px' }}
            >
              Today only
            </span>
          )}
        </div>
        <div className="mt-0.5 truncate text-xs text-[var(--la-muted-2)]">{subtitle(def)}</div>
      </div>
      <div className="flex flex-none flex-col items-end gap-1.5">
        <PixelStarRow value={stars} />
        {stars === 3 && (
          <span className="font-pixel text-[11px] leading-none text-[var(--la-grow-deep)]">
            done in par!
          </span>
        )}
      </div>
    </button>
  );
}

/** Sealed card: "? ? ?" with a tiny padlock; copy nudges toward the previous puzzle. */
function LockedCard() {
  return (
    <div
      className="la-notch flex cursor-not-allowed items-center gap-2.5 p-3 text-left"
      style={{
        background: 'var(--la-locked-bg)',
        opacity: 0.65,
        boxShadow: 'inset 0 0 0 3px var(--la-locked-line)',
      }}
      aria-disabled
    >
      <span
        className="la-notch-5 flex h-[38px] w-[38px] flex-none items-center justify-center"
        style={{ background: 'var(--la-locked-swatch)' }}
      >
        <span
          className="block h-[9px] w-3"
          style={{
            background: 'var(--la-locked-glyph)',
            boxShadow: '0 -4px 0 -1px var(--la-locked-glyph)',
          }}
        />
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-pixel text-sm font-semibold text-[var(--la-locked-ink)]">? ? ?</div>
        <div className="mt-0.5 text-xs text-[var(--la-locked-sub)]">
          Clear the previous puzzle to unlock.
        </div>
      </div>
    </div>
  );
}
