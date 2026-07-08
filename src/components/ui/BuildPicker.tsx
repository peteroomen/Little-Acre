'use client';

import { getPuzzle } from '@/lib/game/puzzles';
import { CROPS, LAND, STRUCT, type BuildId } from '@/lib/game/tiles';
import { useGameStore } from '@/lib/game/store';

interface Option {
  id: BuildId;
  name: string;
  cost: number;
  color: string;
}

const OPTIONS: Option[] = [
  ...(Object.keys(CROPS) as (keyof typeof CROPS)[]).map((id) => ({
    id,
    name: CROPS[id].name,
    cost: CROPS[id].cost,
    color: CROPS[id].color,
  })),
  ...(Object.keys(STRUCT) as (keyof typeof STRUCT)[]).map((id) => ({
    id,
    name: STRUCT[id].name,
    cost: STRUCT[id].cost,
    color: STRUCT[id].color,
  })),
  ...(Object.keys(LAND) as (keyof typeof LAND)[]).map((id) => ({
    id,
    name: LAND[id].name,
    cost: LAND[id].cost,
    color: LAND[id].color,
  })),
];

/** The crop / structure / land palette shown while the Build tool is active. */
export function BuildPicker() {
  const tool = useGameStore((s) => s.tool);
  const mode = useGameStore((s) => s.mode);
  const puzzle = useGameStore((s) => s.puzzle);
  const selected = useGameStore((s) => s.selectedBuild);
  const setSelectedBuild = useGameStore((s) => s.setSelectedBuild);

  if (tool !== 'build') return null;

  // In puzzle mode, only offer the puzzle's allowed builds (restricted for tutorials).
  const allowed = mode === 'puzzle' && puzzle ? getPuzzle(puzzle.id)?.builds : undefined;
  const options = allowed ? OPTIONS.filter((o) => allowed.includes(o.id as never)) : OPTIONS;

  return (
    <div className="absolute inset-x-0 bottom-[104px] z-[11] flex justify-center px-2.5">
      <div className="la-notch flex max-w-[680px] flex-wrap justify-center gap-1.5 bg-[var(--la-panel)] p-2 shadow-[inset_0_0_0_3px_#e7cfa5]">
        {options.map((o) => {
          const on = selected === o.id;
          return (
            <button
              key={o.id}
              onClick={() => setSelectedBuild(o.id)}
              className={`la-notch flex items-center gap-1.5 px-2.5 py-1.5 font-semibold text-[var(--la-text)] active:translate-y-0.5 ${
                on
                  ? 'bg-[#ffe1a0] shadow-[inset_0_0_0_3px_#f0bd5e]'
                  : 'bg-[#efe0c2] shadow-[inset_0_0_0_3px_#e0cca2]'
              }`}
            >
              <span
                className="la-notch inline-block h-5 w-5 shadow-[inset_0_-3px_0_rgba(0,0,0,.16)]"
                style={{ background: o.color }}
              />
              <span className="font-pixel text-xs">{o.name}</span>
              <span className="flex items-center gap-1 font-pixel text-xs text-[var(--la-coin-text)]">
                <span className="h-2.5 w-2.5 bg-[var(--la-coin)] shadow-[inset_0_0_0_1px_#fce9b0]" />
                {o.cost}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
