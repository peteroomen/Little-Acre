'use client';

import { useEffect, useRef, useState } from 'react';

import { fmt, fmtBloom } from '@/lib/game/numbers';
import { getPuzzle, objectiveTarget } from '@/lib/game/puzzles';
import { useGameStore } from '@/lib/game/store';

/**
 * Top HUD (mockup "Farm"): coins/gems chips stacked at top-left, Day · Bloom + Energy
 * stacked at top-right with the Sleep sticker beside them. The currencies are stacked
 * VERTICALLY (not side-by-side) so the right cluster + Sleep never overflow a 370px
 * portrait — the old row layout clipped the Sleep button off the right edge.
 */
export function Hud() {
  const coins = useGameStore((s) => s.coins);
  const gems = useGameStore((s) => s.gems);
  const day = useGameStore((s) => s.day);
  const bloom = useGameStore((s) => s.bloom);
  const energy = useGameStore((s) => s.energy);
  const maxEnergy = useGameStore((s) => s.maxEnergy);
  const phase = useGameStore((s) => s.phase);
  const sleepPulse = useGameStore((s) => s.sleepPulse);
  const sleep = useGameStore((s) => s.sleep);
  const mode = useGameStore((s) => s.mode);
  const puzzle = useGameStore((s) => s.puzzle);
  const toast = useGameStore((s) => s.toast);

  const isPuzzle = mode === 'puzzle';
  const energyPct = Math.round((energy / maxEnergy) * 100);

  // "Today only" (nightLimit 0) puzzles have no night to sleep through — the Sleep button becomes
  // "End Day", which scores the run there and then. If the player hasn't reached the 1★ base yet,
  // ending concedes with no stars, so it asks for a confirming second tap first (mirrors the old
  // guard). Once the base is met, End Day is a plain winning tap. Guard is component-level state
  // only — store.sleep is untouched.
  const guardDef = isPuzzle && puzzle ? getPuzzle(puzzle.id) : undefined;
  const isEndDay = !!guardDef && guardDef.nightLimit === 0;
  const base = guardDef ? objectiveTarget(guardDef.objective) : 0;
  const wouldConcede = isEndDay && (puzzle?.progress ?? 0) < base;
  const [armed, setArmed] = useState(false);
  const disarmRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (disarmRef.current) window.clearTimeout(disarmRef.current);
    };
  }, []);

  const onSleep = () => {
    if (phase !== 'day') return;
    if (wouldConcede && !armed) {
      toast('Ending now scores no stars — tap again', 'bad');
      setArmed(true);
      if (disarmRef.current) window.clearTimeout(disarmRef.current);
      disarmRef.current = window.setTimeout(() => setArmed(false), 3000);
      return;
    }
    if (disarmRef.current) window.clearTimeout(disarmRef.current);
    setArmed(false);
    sleep();
  };

  const sleepStyle = armed
    ? { animation: 'la-pulse .5s 3' }
    : wouldConcede
      ? { opacity: 0.6, filter: 'saturate(.7)' }
      : sleepPulse
        ? { animation: 'la-pulse .5s 2' }
        : undefined;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
      {/* Currencies — stacked (mockup): coins over gems. */}
      <div className="pointer-events-auto flex flex-col items-start gap-1.5">
        <Chip
          bg="var(--la-panel-soft)"
          line="var(--la-gold-line)"
          bottomShade="rgba(150,110,30,.16)"
          dropShadow="var(--la-gold-shadow)"
          glyph={
            <span
              className="inline-block h-[17px] w-[17px] la-notch bg-[var(--la-coin)]"
              style={{
                boxShadow:
                  'inset 0 0 0 2px var(--la-coin-ring), inset -3px -3px 0 rgba(200,140,10,.4)',
              }}
            />
          }
          value={fmt(coins)}
          valueColor="var(--la-coin-text)"
        />
        {/* Gems are freeplay chrome; puzzle mode shows only coins (mockup 1c). */}
        {!isPuzzle && (
          <Chip
            bg="var(--la-gem-soft-bg)"
            line="var(--la-gem-soft-line)"
            bottomShade="rgba(90,60,150,.14)"
            dropShadow="var(--la-gem-soft-shadow)"
            glyph={
              <span
                className="inline-block h-[13px] w-[13px] rotate-45 bg-[var(--la-gem)]"
                style={{
                  boxShadow:
                    'inset 0 0 0 2px var(--la-gem-ring), inset -3px -3px 0 rgba(80,50,150,.35)',
                }}
              />
            }
            value={fmt(gems)}
            valueColor="var(--la-gem-text)"
            valueSize="text-[17px]"
          />
        )}
      </div>

      {/* Day / Bloom / Energy + Sleep */}
      <div className="pointer-events-auto flex items-stretch gap-2">
        <div className="flex flex-col items-end gap-1.5">
          {!isPuzzle && (
            <div
              className="la-notch flex items-center gap-2 bg-[var(--la-day-bg)] px-3 py-1.5"
              style={{
                boxShadow:
                  'inset 0 3px 0 rgba(255,255,255,.7), inset 0 -5px 0 rgba(160,100,50,.14), inset 0 0 0 3px var(--la-day-line)',
                filter: 'drop-shadow(0 4px 0 var(--la-day-shadow))',
              }}
            >
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--la-day-label)]">
                Day
              </span>
              <span className="font-pixel text-[17px] font-semibold leading-none text-[var(--la-orange)]">
                {day}
              </span>
              <span className="h-[13px] w-0.5 bg-[var(--la-day-sep)]" />
              <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--la-label)]">
                Bloom
              </span>
              <span className="font-pixel text-[13px] leading-none text-[var(--la-orange)]">
                {fmtBloom(bloom)}
              </span>
            </div>
          )}
          <div className="la-notch la-chip-gold flex items-center gap-2 px-3 py-1.5">
            <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden>
              <path d="M8 1 L3 8 L7 8 L6 13 L11 6 L7 6 Z" fill="var(--la-energy-icon)" />
            </svg>
            {/* Freeplay track is responsive (clamp) so coins+energy+Sleep fit ≤370px;
                the puzzle chrome uses a compact fixed track. */}
            <div
              className="h-2.5 overflow-hidden bg-[var(--la-energy-track)] la-notch-3"
              style={{
                width: isPuzzle ? 76 : 'clamp(64px, 16vw, 110px)',
                boxShadow: 'inset 0 0 0 2px var(--la-energy-track-line)',
              }}
            >
              <div
                className="h-full bg-[var(--la-energy)] transition-[width] duration-200"
                style={{ width: `${energyPct}%`, boxShadow: 'inset 0 2px 0 rgba(255,255,255,.4)' }}
              />
            </div>
            <span className="font-pixel text-[13px] font-semibold leading-none text-[var(--la-coin-text)]">
              {energy}/{maxEnergy}
            </span>
          </div>
        </div>
        <button
          key={sleepPulse}
          onClick={onSleep}
          disabled={phase !== 'day'}
          aria-label={
            armed ? 'Confirm — end the day and score now' : isEndDay ? 'End the day' : 'Sleep'
          }
          className="la-notch la-btn-sleep la-anim flex w-16 flex-col items-center justify-center gap-0.5 px-1.5 font-pixel text-[13px] font-semibold active:translate-y-0.5 disabled:opacity-70"
          style={sleepStyle}
        >
          <svg width="24" height="24" viewBox="0 0 26 26" aria-hidden>
            <path d="M18 15 A7 7 0 1 1 11 6 A5.5 5.5 0 0 0 18 15 Z" fill="var(--la-sleep-text)" />
          </svg>
          <span>{armed ? 'Sure?' : isEndDay ? 'End Day' : 'Sleep'}</span>
        </button>
      </div>
    </div>
  );
}

function Chip({
  bg,
  line,
  glyph,
  value,
  valueColor,
  dropShadow,
  bottomShade,
  valueSize = 'text-xl',
}: {
  bg: string;
  line: string;
  glyph: React.ReactNode;
  value: string;
  valueColor: string;
  /** Hard drop-shadow one shade darker (the sticker's raised edge). */
  dropShadow: string;
  /** Inner bottom-shade rgba (bevel under the top light). */
  bottomShade: string;
  valueSize?: string;
}) {
  return (
    <div
      className="la-notch flex items-center gap-1.5 py-1.5 pl-2 pr-3"
      style={{
        background: bg,
        boxShadow: `inset 0 3px 0 rgba(255,255,255,.7), inset 0 -5px 0 ${bottomShade}, inset 0 0 0 3px ${line}`,
        filter: `drop-shadow(0 4px 0 ${dropShadow})`,
      }}
    >
      {glyph}
      <span
        className={`font-pixel ${valueSize} font-semibold leading-none`}
        style={{ color: valueColor, minWidth: 40 }}
      >
        {value}
      </span>
    </div>
  );
}
