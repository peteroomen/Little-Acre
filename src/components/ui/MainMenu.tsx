'use client';

import { useGameStore } from '@/lib/game/store';

/** The cozy title screen: Little Acre + Freeplay / Puzzles (Settings reserved for later). */
export function MainMenu() {
  const startFreeplay = useGameStore((s) => s.startFreeplay);
  const goPuzzleSelect = useGameStore((s) => s.goPuzzleSelect);

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center gap-8 p-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex items-center gap-3">
          <span className="la-notch inline-block h-9 w-9 bg-[var(--la-leaf)] shadow-[inset_0_-4px_0_rgba(0,0,0,.14)]" />
          <h1 className="font-pixel text-5xl font-semibold tracking-wide text-[#5a462f] drop-shadow-[0_2px_0_rgba(255,255,255,.6)]">
            Little Acre
          </h1>
          <span className="la-notch inline-block h-9 w-9 bg-[var(--la-coin)] shadow-[inset_0_-4px_0_rgba(0,0,0,.14)]" />
        </div>
        <p className="text-sm text-[var(--la-muted)]">
          A cozy little farm, a few quiet minutes at a time.
        </p>
      </div>

      <div className="la-notch flex w-full max-w-[340px] flex-col gap-3 bg-[var(--la-panel)] p-5 shadow-[inset_0_0_0_3px_#fffaf0,inset_0_0_0_6px_#e7cfa5]">
        <MenuButton
          label="Freeplay"
          sub="Tend your open acre"
          bg="var(--la-leaf)"
          text="var(--la-leaf-text)"
          line="#bfe89b"
          onClick={startFreeplay}
        />
        <MenuButton
          label="Puzzles"
          sub="Beat the clock with a goal"
          bg="#a98bf5"
          text="#fff"
          line="#c3aef8"
          onClick={goPuzzleSelect}
        />
        <button
          disabled
          className="la-notch flex items-center justify-between px-4 py-3 font-pixel text-[15px] font-semibold text-[#b0996f] opacity-50 bg-[#f3e6cc] shadow-[inset_0_0_0_3px_#e7d6b4]"
        >
          <span>Settings</span>
          <span className="text-[11px] font-normal">soon</span>
        </button>
      </div>
    </div>
  );
}

function MenuButton({
  label,
  sub,
  bg,
  text,
  line,
  onClick,
}: {
  label: string;
  sub: string;
  bg: string;
  text: string;
  line: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="la-notch flex items-center justify-between px-4 py-3.5 text-left active:translate-y-0.5"
      style={{
        background: bg,
        color: text,
        boxShadow: `inset 0 3px 0 rgba(255,255,255,.35), inset 0 -5px 0 rgba(0,0,0,.18), inset 0 0 0 3px ${line}`,
      }}
    >
      <span className="font-pixel text-xl font-semibold">{label}</span>
      <span className="text-[11px] opacity-90">{sub}</span>
    </button>
  );
}
