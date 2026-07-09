'use client';

import {
  getPuzzle,
  isPuzzleUnlocked,
  nextTier,
  objectiveNoun,
  starsFor,
  tierTargets,
  type PuzzleDef,
  PUZZLES,
} from '@/lib/game/puzzles';
import { useGameStore } from '@/lib/game/store';
import { CROPS } from '@/lib/game/tiles';

import { PixelStar } from './pixel';

/** Swatch fill for the objective icon: crop hue, coin for coins, two-tone for today-only. */
function objectiveAccent(def: PuzzleDef): string {
  if (def.nightLimit === 0) return 'linear-gradient(var(--la-coin) 40%, var(--la-sleep) 40%)';
  const o = def.objective;
  if (o.kind === 'coins') return 'var(--la-coin)';
  if (o.crop === 'any') return 'var(--la-leaf)';
  return CROPS[o.crop].color;
}

/** Live objective banner (mockup 1c/1d): icon · goal + progress meter · night chip · quit. */
export function ObjectiveBanner() {
  const mode = useGameStore((s) => s.mode);
  const puzzle = useGameStore((s) => s.puzzle);
  const goPuzzleSelect = useGameStore((s) => s.goPuzzleSelect);

  if (mode !== 'puzzle' || !puzzle) return null;
  const def = getPuzzle(puzzle.id);
  if (!def) return null;

  const isCoins = def.objective.kind === 'coins';
  const isToday = def.nightLimit === 0;
  const nightsShown = Math.min(puzzle.nightsUsed, def.nightLimit);
  const lastNight = !isToday && nightsShown >= def.nightLimit;
  // Meter + count track the NEXT unearned goal tier; the star pips show which tier that is.
  const tier = nextTier(def, puzzle.progress);
  const earned = starsFor(def, puzzle.progress);
  const pct =
    tier.target > 0 ? Math.min(100, Math.round((puzzle.progress / tier.target) * 100)) : 100;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-[104px] z-[12] flex justify-center px-3">
      <div className="la-notch la-card-sticker pointer-events-auto flex max-w-full items-center gap-2 px-3 py-2.5">
        <span
          className="la-notch h-5 w-5 flex-none"
          style={{
            background: objectiveAccent(def),
            boxShadow: 'inset 0 -3px 0 rgba(0,0,0,.16), inset 0 0 0 2px rgba(255,255,255,.35)',
          }}
        />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 whitespace-nowrap text-[13px] font-semibold leading-tight text-[var(--la-ink)]">
            <span>{objectiveNoun(def.objective)}</span>
            {/* Goal-tier pips: filled up to the tier being chased (or all three once 3★ is in). */}
            <span className="flex gap-[2px]">
              {[1, 2, 3].map((i) => (
                <PixelStar key={i} size={10} filled={i <= Math.max(earned, tier.stars)} />
              ))}
            </span>
          </div>
          <div className="mt-[3px] flex items-center gap-1.5">
            <div
              className="h-2 w-[92px] max-w-[92px] flex-none overflow-hidden"
              style={{
                background: 'var(--la-meter-track)',
                boxShadow: 'inset 0 0 0 2px var(--la-meter-line)',
              }}
            >
              <div
                className="h-full transition-[width] duration-200"
                style={{
                  width: `${pct}%`,
                  background: isCoins ? 'var(--la-coin)' : 'var(--la-leaf)',
                }}
              />
            </div>
            <span
              className="font-pixel text-[12px] leading-none"
              style={{ color: isCoins ? 'var(--la-coin-text)' : 'var(--la-grow-deep)' }}
            >
              {puzzle.progress}/{tier.target}
            </span>
          </div>
        </div>

        <span className="h-[26px] w-0.5 flex-none bg-[var(--la-card-line)]" />

        {isToday ? (
          <div className="flex-none text-center" aria-label="Today only — the cart leaves at dusk">
            <div className="text-[9px] font-semibold uppercase tracking-wide text-[var(--la-dusk-label)]">
              Dusk in
            </div>
            <div className="mt-[3px] flex gap-[3px]">
              {[0, 1, 2, 3, 4].map((i) => (
                <span key={i} className="h-2 w-2" style={{ background: 'var(--la-energy)' }} />
              ))}
            </div>
          </div>
        ) : (
          <div
            className="flex-none text-center"
            style={
              lastNight
                ? {
                    background: 'var(--la-night-danger-bg)',
                    boxShadow: 'inset 0 0 0 2px var(--la-night-danger-line)',
                    padding: '3px 7px',
                  }
                : undefined
            }
          >
            <div
              className="text-[9px] font-semibold uppercase tracking-wide"
              style={{ color: lastNight ? 'var(--la-night-danger-label)' : 'var(--la-label)' }}
            >
              Night
            </div>
            <div
              className="font-pixel text-[15px] font-semibold leading-none"
              style={{ color: lastNight ? 'var(--la-danger)' : 'var(--la-orange)' }}
            >
              {nightsShown}/{def.nightLimit}
            </div>
          </div>
        )}

        <button
          onClick={goPuzzleSelect}
          className="la-notch-3 la-btn-quiet ml-0.5 h-6 w-6 flex-none text-sm leading-none active:translate-y-0.5"
          aria-label="Quit puzzle"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

/** One-time blurb card shown on puzzle start (mockup 1d intro); tap to dismiss. */
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
        className="la-anim la-notch la-card-sticker w-full max-w-[360px] p-4"
        style={{ animation: 'la-pop .16s ease-out' }}
      >
        <div className="font-pixel text-base font-semibold text-[var(--la-text)]">{def.name}</div>
        <p className="mt-1 text-[13px] leading-relaxed text-[var(--la-body)]">{def.blurb}</p>
        <button
          onClick={dismiss}
          className="la-notch-3 la-btn-green mt-3 w-full py-2.5 font-pixel text-sm font-semibold active:translate-y-0.5"
        >
          Let&apos;s grow
        </button>
      </div>
    </div>
  );
}

/** Win/lose result modal for a finished puzzle (mockup 1e). */
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
  const noun = objectiveNoun(def.objective).toLowerCase();

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center p-5"
      style={{ background: 'rgba(70,55,35,.38)', backdropFilter: 'blur(2px)' }}
    >
      <div
        className="la-anim la-notch-6 w-full max-w-[320px] px-5 pb-4 pt-6 text-center"
        style={{
          animation: 'la-pop .18s ease-out',
          background: 'var(--la-modal)',
          boxShadow: 'inset 0 4px 0 rgba(255,255,255,.8), inset 0 0 0 4px var(--la-panel-line)',
          filter:
            'drop-shadow(0 7px 0 var(--la-panel-shadow)) drop-shadow(0 14px 24px rgba(60,45,20,.35))',
        }}
      >
        <div className="font-pixel text-[26px] font-bold text-[var(--la-text)]">
          {won ? 'Harvest Home!' : def.nightLimit === 0 ? 'Cart Has Left' : 'Out of Nights'}
        </div>

        {won ? (
          <>
            <div className="mb-2 mt-4 flex items-center justify-center gap-2.5">
              <ResultStar index={0} filled={puzzle.stars > 0} size={38} />
              <ResultStar index={1} filled={puzzle.stars > 1} size={46} lifted />
              <ResultStar index={2} filled={puzzle.stars > 2} size={38} />
            </div>
            <GoalLadder def={def} earned={puzzle.stars} noun={noun} />
          </>
        ) : (
          <p className="mt-3 text-sm leading-relaxed text-[var(--la-body)]">
            {puzzle.progress > 0
              ? `Only ${puzzle.progress} ${noun} — the first goal wants ${tierTargets(def)[0]}. Try a different order.`
              : 'Give it another go — try a different order.'}
          </p>
        )}

        <div className="mt-5 flex gap-2">
          {won && nextUnlocked ? (
            <>
              <ResultButton onClick={retryPuzzle} tone="quiet" grow={1}>
                Retry
              </ResultButton>
              <ResultButton onClick={goPuzzleSelect} tone="quiet" grow={1}>
                Puzzles
              </ResultButton>
              <ResultButton onClick={() => startPuzzle(next.id)} tone="green" grow={1.4}>
                Next ›
              </ResultButton>
            </>
          ) : (
            <>
              <ResultButton onClick={retryPuzzle} tone="green" grow={1}>
                Retry
              </ResultButton>
              <ResultButton onClick={goPuzzleSelect} tone="quiet" grow={1}>
                Puzzles
              </ResultButton>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Result-modal goal ladder: the three tier targets (1★ base / 2★ / 3★) with the ones the player
 * cleared lit. Shows what was hit and what's still on the table for a replay.
 */
function GoalLadder({ def, earned, noun }: { def: PuzzleDef; earned: number; noun: string }) {
  const targets = tierTargets(def);
  return (
    <div className="mt-1 flex items-stretch justify-center gap-1.5">
      {targets.map((target, i) => {
        const hit = earned >= i + 1;
        return (
          <div
            key={i}
            className="la-notch-3 flex min-w-[54px] flex-col items-center gap-0.5 px-2 py-1.5"
            style={{
              background: hit ? 'var(--la-coin-soft)' : 'var(--la-meter-track)',
              boxShadow: `inset 0 0 0 2px ${hit ? 'var(--la-gold-line)' : 'var(--la-meter-line)'}`,
              opacity: hit ? 1 : 0.6,
            }}
          >
            <PixelStar size={13} filled={hit} />
            <span
              className="font-pixel text-[13px] leading-none"
              style={{ color: hit ? 'var(--la-coin-text)' : 'var(--la-muted-2)' }}
            >
              {target}
            </span>
          </div>
        );
      })}
      <span className="sr-only">{noun} goals</span>
    </div>
  );
}

/**
 * One result-modal star. Earned stars bounce in with a staggered delay; `la-anim`
 * lets the reduced-motion rule in globals.css freeze them to a static filled state.
 */
function ResultStar({
  index,
  filled,
  size,
  lifted = false,
}: {
  index: number;
  filled: boolean;
  size: number;
  lifted?: boolean;
}) {
  return (
    <span
      className="la-anim inline-block"
      style={{
        marginTop: lifted ? -6 : 0,
        animation: filled
          ? `la-star-bounce .4s ${0.15 + index * 0.23}s cubic-bezier(.34,1.56,.64,1) both`
          : undefined,
      }}
    >
      <PixelStar size={size} filled={filled} big />
    </span>
  );
}

function ResultButton({
  onClick,
  tone,
  grow,
  children,
}: {
  onClick: () => void;
  tone: 'green' | 'quiet';
  grow: number;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`la-notch-3 ${
        tone === 'green' ? 'la-btn-green' : 'la-btn-quiet'
      } py-2.5 font-pixel text-[13px] font-semibold active:translate-y-0.5`}
      style={{ flex: grow }}
    >
      {children}
    </button>
  );
}
