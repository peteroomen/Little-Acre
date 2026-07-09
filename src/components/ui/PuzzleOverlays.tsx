'use client';

import {
  getPuzzle,
  isPuzzleUnlocked,
  objectiveLabel,
  objectiveTarget,
  PUZZLES,
} from '@/lib/game/puzzles';
import { useGameStore } from '@/lib/game/store';

/** Live objective banner (goal · progress · nights) with a Quit-to-select affordance. */
export function ObjectiveBanner() {
  const mode = useGameStore((s) => s.mode);
  const puzzle = useGameStore((s) => s.puzzle);
  const goPuzzleSelect = useGameStore((s) => s.goPuzzleSelect);

  if (mode !== 'puzzle' || !puzzle) return null;
  const def = getPuzzle(puzzle.id);
  if (!def) return null;

  // Objective union (harvest | coins): label + target come from the helpers, not the fields.
  const target = objectiveTarget(def.objective);
  const isCoins = def.objective.kind === 'coins';
  const isToday = def.nightLimit === 0;
  const nightsShown = Math.min(puzzle.nightsUsed, def.nightLimit);

  return (
    <div className="pointer-events-none absolute inset-x-0 top-[104px] z-[12] flex justify-center px-3">
      <div className="la-notch pointer-events-auto flex items-center gap-3 bg-[#fff7ea] px-3.5 py-2 shadow-[inset_0_0_0_3px_#e7cfa5]">
        <div className="flex flex-col leading-tight">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-[#c99a6e]">
            Objective
          </span>
          <span className="font-pixel text-[13px] text-[#5a462f]">
            {objectiveLabel(def.objective)}
          </span>
        </div>
        <span className="h-7 w-0.5 bg-[#f0cfa8]" />
        <div className="flex flex-col items-center leading-tight">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-[#c99a6e]">
            {isCoins ? 'Earned' : 'Got'}
          </span>
          <span
            className={`flex items-center gap-1 font-pixel text-[15px] font-semibold ${
              isCoins ? 'text-[var(--la-coin-text)]' : 'text-[#c46d38]'
            }`}
          >
            {isCoins && (
              <span className="h-3 w-3 bg-[var(--la-coin)] shadow-[inset_0_0_0_1.5px_#fce9b0]" />
            )}
            {puzzle.progress} / {target}
          </span>
        </div>
        <span className="h-7 w-0.5 bg-[#f0cfa8]" />
        {isToday ? (
          <div
            className="flex items-center gap-1.5"
            aria-label="Today only — the cart leaves at dusk"
          >
            <DuskGlyph />
            <div className="flex flex-col leading-tight">
              <span className="font-pixel text-[12px] font-semibold text-[var(--la-danger)]">
                Today only
              </span>
              <span className="text-[9px] uppercase tracking-wide text-[#c99a6e]">
                Cart leaves at dusk
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center leading-tight">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-[#c99a6e]">
              Night
            </span>
            <span className="font-pixel text-[15px] font-semibold text-[#6a4bb0]">
              {nightsShown} / {def.nightLimit}
            </span>
          </div>
        )}
        <button
          onClick={goPuzzleSelect}
          className="la-notch ml-1 h-7 w-7 flex-none bg-[#fff1dd] text-sm text-[#a0895f] shadow-[inset_0_0_0_2px_#e7cfa5] active:translate-y-0.5"
          aria-label="Quit puzzle"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

/** Tiny dusk sun dipping past the horizon — the "cart leaves at dusk" deadline cue. */
function DuskGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
      <circle cx="10" cy="12" r="5" fill="var(--la-energy)" />
      <rect x="2" y="13" width="16" height="2" fill="var(--la-panel-line)" />
      <path
        d="M10 2 v2 M4 4 l1.4 1.4 M16 4 l-1.4 1.4 M2 9 h2 M16 9 h2"
        stroke="var(--la-coin)"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** One-time blurb card shown on puzzle start; tap to dismiss. */
export function PuzzleIntro() {
  const mode = useGameStore((s) => s.mode);
  const puzzle = useGameStore((s) => s.puzzle);
  const dismiss = useGameStore((s) => s.dismissPuzzleIntro);

  if (mode !== 'puzzle' || !puzzle || !puzzle.intro) return null;
  const def = getPuzzle(puzzle.id);
  if (!def) return null;

  return (
    <div
      onClick={dismiss}
      className="absolute inset-0 z-[35] flex items-center justify-center p-5"
      style={{ background: 'rgba(80,60,35,.34)', backdropFilter: 'blur(2px)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="la-anim la-notch w-full max-w-[380px] bg-[#fdf6e7] p-5 text-center shadow-[inset_0_0_0_4px_#e7cfa5]"
        style={{ animation: 'la-pop .16s ease-out' }}
      >
        <div className="font-pixel text-2xl font-semibold text-[#5a462f]">{def.name}</div>
        <p className="mt-2.5 text-sm leading-relaxed text-[#7a6547]">{def.blurb}</p>
        <div className="la-notch mx-auto mt-3.5 inline-flex items-center gap-2 bg-[#fff2e4] px-3 py-1.5 shadow-[inset_0_0_0_3px_#f4cfa6]">
          <span className="font-pixel text-[13px] text-[#c46d38]">
            {objectiveLabel(def.objective)}
          </span>
          <span className="h-4 w-0.5 bg-[#f0cfa8]" />
          <span className="font-pixel text-[13px] text-[#6a4bb0]">{def.nightLimit} nights</span>
        </div>
        <button
          onClick={dismiss}
          className="la-notch mt-4 w-full bg-[var(--la-leaf)] py-2.5 font-pixel text-[15px] font-semibold text-[var(--la-leaf-text)] shadow-[inset_0_3px_0_rgba(255,255,255,.45),inset_0_-5px_0_rgba(40,80,20,.28),inset_0_0_0_3px_#bfe89b] active:translate-y-0.5"
        >
          Let&apos;s grow
        </button>
      </div>
    </div>
  );
}

/** Win/lose result modal for a finished puzzle. */
export function PuzzleResult() {
  const mode = useGameStore((s) => s.mode);
  const puzzle = useGameStore((s) => s.puzzle);
  const phase = useGameStore((s) => s.phase);
  const puzzleStars = useGameStore((s) => s.puzzleStars);
  const retryPuzzle = useGameStore((s) => s.retryPuzzle);
  const startPuzzle = useGameStore((s) => s.startPuzzle);
  const goPuzzleSelect = useGameStore((s) => s.goPuzzleSelect);

  // Hold the result until the sunrise beat finishes so it doesn't clash with the night overlay.
  if (mode !== 'puzzle' || !puzzle || puzzle.status === 'playing' || phase !== 'day') return null;
  const def = getPuzzle(puzzle.id);
  if (!def) return null;

  const won = puzzle.status === 'won';
  const index = PUZZLES.findIndex((p) => p.id === puzzle.id);
  const next = PUZZLES[index + 1];
  const nextUnlocked = !!next && isPuzzleUnlocked(index + 1, puzzleStars);

  // Par context line: 0-night puzzles race the dusk; the rest compare nights to the solver par.
  const n = puzzle.nightsUsed;
  const parLine =
    def.nightLimit === 0
      ? 'Done before dusk!'
      : `Done in ${n} night${n === 1 ? '' : 's'} — par is ${def.stars.three}${
          n <= def.stars.three ? '!' : '.'
        }`;

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center p-5"
      style={{ background: 'rgba(60,45,90,.45)', backdropFilter: 'blur(3px)' }}
    >
      <div
        className="la-anim la-notch w-full max-w-[380px] bg-[#fdf6e7] p-6 text-center shadow-[inset_0_0_0_4px_#e7cfa5]"
        style={{ animation: 'la-pop .18s ease-out' }}
      >
        <div className="font-pixel text-3xl font-semibold text-[#5a462f]">
          {won ? 'Harvest Home!' : 'Out of Nights'}
        </div>

        {won ? (
          <>
            <div className="mt-4 flex justify-center">
              <BigStars value={puzzle.stars} />
            </div>
            <p className="mt-3 text-sm text-[#7a6547]">{parLine}</p>
          </>
        ) : (
          <p className="mt-3 text-sm leading-relaxed text-[#7a6547]">
            The season slipped away before the harvest was in. Give it another go — you&apos;ve got
            this.
          </p>
        )}

        <div className="mt-5 flex flex-col gap-2.5">
          {won && nextUnlocked && (
            <button
              onClick={() => startPuzzle(next.id)}
              className="la-notch w-full bg-[#a98bf5] py-2.5 font-pixel text-[15px] font-semibold text-white shadow-[inset_0_3px_0_rgba(255,255,255,.35),inset_0_-5px_0_rgba(60,40,120,.35),inset_0_0_0_3px_#c3aef8] active:translate-y-0.5"
            >
              Next: {next.name}
            </button>
          )}
          <div className="flex gap-2.5">
            <button
              onClick={retryPuzzle}
              className="la-notch flex-1 bg-[var(--la-leaf)] py-2.5 font-pixel text-[15px] font-semibold text-[var(--la-leaf-text)] shadow-[inset_0_3px_0_rgba(255,255,255,.45),inset_0_-5px_0_rgba(40,80,20,.28),inset_0_0_0_3px_#bfe89b] active:translate-y-0.5"
            >
              Retry
            </button>
            <button
              onClick={goPuzzleSelect}
              className="la-notch flex-1 bg-[#fff1dd] py-2.5 font-pixel text-[15px] font-semibold text-[#a0895f] shadow-[inset_0_0_0_3px_#e7cfa5] active:translate-y-0.5"
            >
              Puzzles
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Large three-star row for the result modal. Earned stars pop in 0→N with a staggered delay;
 * `la-anim` lets the reduced-motion rule in globals.css freeze them to a static filled state.
 */
function BigStars({ value }: { value: number }) {
  return (
    <span className="flex gap-1.5" aria-label={`${value} of 3 stars`}>
      {[0, 1, 2].map((i) => {
        const filled = i < value;
        return (
          <span
            key={i}
            className={`la-anim text-4xl leading-none ${
              filled
                ? 'text-[#f5b23c] drop-shadow-[0_2px_0_rgba(200,130,20,.35)]'
                : 'text-[#dcccae]'
            }`}
            style={
              filled
                ? { animation: `la-star-pop .34s ${i * 0.12}s cubic-bezier(.34,1.56,.64,1) both` }
                : undefined
            }
          >
            ★
          </span>
        );
      })}
    </span>
  );
}
