'use client';

import { useEffect, useRef, useState } from 'react';

import { fmt, fmtBloom } from '@/lib/game/numbers';
import { getPuzzle } from '@/lib/game/puzzles';
import { useGameStore } from '@/lib/game/store';

/** Top HUD: coin/gem counters (left) and Day · Bloom · Energy + Sleep (right). */
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

  const energyPct = Math.round((energy / maxEnergy) * 100);

  // "Today only" (nightLimit 0) puzzles: sleeping instantly loses, so the Sleep button is
  // subdued and asks for a confirming second tap within a few seconds. Guard is component-level
  // state only — store.sleep is untouched, so deliberately sleeping (losing) stays possible.
  const guardDef = mode === 'puzzle' && puzzle ? getPuzzle(puzzle.id) : undefined;
  const guardSleep = !!guardDef && guardDef.nightLimit === 0;
  const [armed, setArmed] = useState(false);
  const disarmRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (disarmRef.current) window.clearTimeout(disarmRef.current);
    };
  }, []);

  const onSleep = () => {
    if (phase !== 'day') return;
    if (guardSleep && !armed) {
      toast(`Sleeping ends ${guardDef?.name ?? 'the day'}!`, 'bad');
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
    : guardSleep
      ? { opacity: 0.6, filter: 'saturate(.7)' }
      : sleepPulse
        ? { animation: 'la-pulse .5s 2' }
        : undefined;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4">
      {/* Currencies */}
      <div className="pointer-events-auto flex flex-wrap gap-2.5">
        <Chip
          bg="var(--la-panel-soft)"
          line="#f3d698"
          glyph={<span className="inline-block h-[18px] w-[18px] la-notch bg-[var(--la-coin)]" />}
          value={fmt(coins)}
          valueColor="var(--la-coin-text)"
        />
        <Chip
          bg="#f5eeff"
          line="#d3bff2"
          glyph={
            <span className="inline-block h-4 w-4 rotate-45 bg-[var(--la-gem)] shadow-[inset_0_0_0_2px_#efe3ff]" />
          }
          value={fmt(gems)}
          valueColor="var(--la-gem-text)"
        />
      </div>

      {/* Day / Bloom / Energy + Sleep */}
      <div className="pointer-events-auto flex items-start gap-2.5">
        <div className="flex flex-col items-end gap-1.5">
          <div className="la-notch flex items-center gap-2 bg-[#fff2e4] px-3.5 py-2 shadow-[inset_0_0_0_3px_#f4cfa6]">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[#cf8f5c]">
              Day
            </span>
            <span className="font-pixel text-lg leading-none text-[#c46d38]">{day}</span>
            <span className="h-3.5 w-0.5 bg-[#f0cfa8]" />
            <span className="text-[10px] font-semibold uppercase tracking-wide text-[#c99a6e]">
              Bloom
            </span>
            <span className="font-pixel text-sm text-[#c46d38]">{fmtBloom(bloom)}</span>
          </div>
          <div className="la-notch flex items-center gap-2 bg-[var(--la-panel-soft)] px-3 py-1.5 shadow-[inset_0_0_0_3px_#f3d698]">
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
              <path d="M8 1 L3 8 L7 8 L6 13 L11 6 L7 6 Z" fill="var(--la-energy)" />
            </svg>
            <div className="la-notch h-2.5 w-[120px] overflow-hidden bg-[#f6e2c6] shadow-[inset_0_0_0_2px_#edcb9e]">
              <div
                className="h-full bg-[var(--la-energy)] transition-[width] duration-200"
                style={{ width: `${energyPct}%` }}
              />
            </div>
            <span className="font-pixel text-sm font-semibold leading-none text-[var(--la-coin-text)]">
              {energy}/{maxEnergy}
            </span>
          </div>
        </div>
        <button
          key={sleepPulse}
          onClick={onSleep}
          disabled={phase !== 'day'}
          aria-label={armed ? 'Confirm sleep — this ends the puzzle' : 'Sleep'}
          className="la-notch la-anim flex w-[66px] flex-col items-center justify-center gap-0.5 bg-[var(--la-sleep)] px-1.5 py-2.5 font-pixel text-[13px] font-semibold text-[#fff0b8] shadow-[inset_0_3px_0_rgba(255,255,255,.3),inset_0_-6px_0_rgba(30,20,60,.42),inset_0_0_0_3px_#8574c0] active:translate-y-0.5 disabled:opacity-70"
          style={sleepStyle}
        >
          <svg width="24" height="24" viewBox="0 0 26 26" aria-hidden>
            <path d="M18 15 A7 7 0 1 1 11 6 A5.5 5.5 0 0 0 18 15 Z" fill="#fff0b8" />
          </svg>
          <span>{armed ? 'Sure?' : 'Sleep'}</span>
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
}: {
  bg: string;
  line: string;
  glyph: React.ReactNode;
  value: string;
  valueColor: string;
}) {
  return (
    <div
      className="la-notch flex items-center gap-2 py-2 pl-2.5 pr-4"
      style={{ background: bg, boxShadow: `inset 0 0 0 3px ${line}` }}
    >
      {glyph}
      <span
        className="font-pixel text-xl font-semibold leading-none"
        style={{ color: valueColor, minWidth: 44 }}
      >
        {value}
      </span>
    </div>
  );
}
