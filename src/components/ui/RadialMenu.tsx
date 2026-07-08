'use client';

import { RADIAL_RADIUS, ringAngle, type TileAction } from '@/lib/game/actions';
import { useGameStore } from '@/lib/game/store';

/**
 * The press-hold radial. DISPLAY-ONLY (pointer-events:none) — it reads `radial` + `radialHi`
 * from the store and never decides anything; all slice selection is `radialHiFor` in Game.tsx.
 * Blooms at the tapped tile with the primary under the thumb and the ring fanned around it.
 */
export function RadialMenu() {
  const radial = useGameStore((s) => s.radial);
  const hi = useGameStore((s) => s.radialHi);
  if (!radial) return null;

  const { cx, cy, primary, ring } = radial;

  return (
    <div className="pointer-events-none absolute inset-0 z-[20]">
      <Chip x={cx} y={cy} action={primary} active={hi < 0} center />
      {ring.map((a, i) => {
        const ang = ringAngle(i, ring.length);
        return (
          <Chip
            key={i}
            x={cx + Math.cos(ang) * RADIAL_RADIUS}
            y={cy + Math.sin(ang) * RADIAL_RADIUS}
            action={a}
            active={hi === i}
          />
        );
      })}
    </div>
  );
}

function Chip({
  x,
  y,
  action,
  active,
  center = false,
}: {
  x: number;
  y: number;
  action: TileAction | null;
  active: boolean;
  center?: boolean;
}) {
  // A centre with no primary is just a small "cancel" dot (release does nothing).
  if (!action) {
    if (!center) return null;
    return (
      <div className="absolute" style={{ left: x, top: y, transform: 'translate(-50%,-50%)' }}>
        <div
          className={`la-anim la-notch h-6 w-6 bg-[#efe0c2] shadow-[inset_0_0_0_2px_#d9c39c] ${
            active ? 'scale-110 shadow-[inset_0_0_0_2px_#f0bd5e]' : ''
          }`}
          style={{ animation: 'la-pop .09s ease-out' }}
        />
      </div>
    );
  }

  return (
    <div className="absolute" style={{ left: x, top: y, transform: 'translate(-50%,-50%)' }}>
      <div
        className={`la-anim la-notch flex flex-col items-center gap-0.5 bg-[#fdf6e7] px-2 py-1.5 transition-transform ${
          active
            ? 'scale-110 shadow-[inset_0_0_0_3px_#f0bd5e]'
            : 'scale-100 shadow-[inset_0_0_0_3px_#e7cfa5]'
        } ${center ? 'shadow-[inset_0_0_0_3px_#bfe89b]' : ''}`}
        style={{ animation: 'la-pop .09s ease-out' }}
      >
        <span
          className="la-notch h-4 w-4 shadow-[inset_0_-2px_0_rgba(0,0,0,.16)]"
          style={{ background: action.color }}
        />
        <span className="font-pixel text-[11px] leading-none text-[#5a462f]">{action.label}</span>
        {action.coinCost > 0 && (
          <span className="flex items-center gap-0.5 font-pixel text-[10px] leading-none text-[var(--la-coin-text)]">
            <span className="h-2 w-2 bg-[var(--la-coin)] shadow-[inset_0_0_0_1px_#fce9b0]" />
            {action.coinCost}
          </span>
        )}
      </div>
    </div>
  );
}
