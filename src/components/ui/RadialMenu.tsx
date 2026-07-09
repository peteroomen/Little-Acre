'use client';

import { RADIAL_RADIUS, ringAngle, type TileAction } from '@/lib/game/actions';
import { useGameStore } from '@/lib/game/store';

/**
 * The press-hold radial (mockup "Radial Menu"). DISPLAY-ONLY (pointer-events:none) — it
 * reads `radial` + `radialHi` from the store and never decides anything; all slice
 * selection is `radialHiFor` in Game.tsx. Blooms at the tapped tile with the primary
 * under the thumb and the verb petals fanned around it. Affordability is read here purely
 * to dim unaffordable petals (the store still owns the actual "not enough coins" toast).
 */
export function RadialMenu() {
  const radial = useGameStore((s) => s.radial);
  const hi = useGameStore((s) => s.radialHi);
  const coins = useGameStore((s) => s.coins);
  if (!radial) return null;

  const { cx, cy, primary, ring } = radial;

  return (
    <div className="pointer-events-none absolute inset-0 z-[20]">
      {/* Dusk scrim centred on the radial so the petals read against the board. */}
      <div
        className="la-anim absolute inset-0"
        style={{
          background: `radial-gradient(circle at ${Math.round(cx)}px ${Math.round(cy)}px, rgba(32,27,69,.5), rgba(32,27,69,.24) 44%, rgba(32,27,69,.08) 75%)`,
          animation: 'la-bloom .09s ease-out',
        }}
      />
      <Petal x={cx} y={cy} action={primary} active={hi < 0} coins={coins} center />
      {ring.map((a, i) => {
        const ang = ringAngle(i, ring.length);
        return (
          <Petal
            key={i}
            x={cx + Math.cos(ang) * RADIAL_RADIUS}
            y={cy + Math.sin(ang) * RADIAL_RADIUS}
            action={a}
            active={hi === i}
            coins={coins}
          />
        );
      })}
    </div>
  );
}

function Petal({
  x,
  y,
  action,
  active,
  coins,
  center = false,
}: {
  x: number;
  y: number;
  action: TileAction | null;
  active: boolean;
  coins: number;
  center?: boolean;
}) {
  // A centre with no primary is just a small "cancel" dot (release does nothing).
  if (!action) {
    if (!center) return null;
    return (
      <div className="absolute" style={{ left: x, top: y, transform: 'translate(-50%,-50%)' }}>
        <div
          className={`la-anim la-notch h-6 w-6 bg-[var(--la-radial-center-dim)] shadow-[inset_0_0_0_2px_var(--la-radial-center-dim-line)] ${
            active ? 'scale-110 shadow-[inset_0_0_0_2px_var(--la-radial-hi-line)]' : ''
          }`}
          style={{ animation: 'la-bloom .09s ease-out' }}
        />
      </div>
    );
  }

  const unaffordable = action.coinCost > 0 && coins < action.coinCost;

  // Sticker treatment: highlighted (amber) wins; then unaffordable dim; else the base
  // sticker — a green centre / gold petal.
  const sticker = active
    ? 'la-sticker-hi'
    : unaffordable
      ? ''
      : center
        ? 'la-btn-green'
        : 'la-chip-gold';

  const dimStyle = unaffordable
    ? {
        background: 'var(--la-radial-dim)',
        color: 'var(--la-radial-dim-text)',
        boxShadow: 'inset 0 0 0 3px var(--la-radial-dim-line)',
        opacity: 0.66,
      }
    : undefined;

  return (
    <div className="absolute" style={{ left: x, top: y, transform: 'translate(-50%,-50%)' }}>
      <div
        className={`la-anim la-notch-5 flex flex-col items-center justify-center gap-0.5 transition-transform ${sticker} ${
          center ? 'w-[58px] px-1.5 py-2' : 'w-[54px] px-1 py-1.5'
        } ${active ? 'scale-[1.14]' : 'scale-100'}`}
        style={{ ...dimStyle, animation: 'la-bloom .09s ease-out' }}
      >
        {/* Centre shows a bold label; petals carry the per-verb swatch + label. */}
        {!center && (
          <span
            className="la-notch-3 h-[18px] w-[18px] shadow-[inset_0_-3px_0_rgba(0,0,0,.16),inset_0_0_0_2px_rgba(255,255,255,.35)]"
            style={{ background: action.color, filter: unaffordable ? 'grayscale(.5)' : undefined }}
          />
        )}
        <span
          className={`text-center leading-[1.05] ${
            center ? 'font-pixel text-[13px] font-semibold' : 'text-[11px] font-semibold'
          }`}
        >
          {action.label}
        </span>
        {action.coinCost > 0 && (
          <span
            className="la-notch-3 flex items-center gap-0.5 px-[5px] py-px font-pixel text-[10px] leading-none"
            style={
              unaffordable
                ? { color: 'var(--la-cost-bad-text)', background: 'var(--la-cost-bad-bg)' }
                : { color: 'var(--la-coin-text)', background: 'var(--la-coin-soft)' }
            }
          >
            {action.coinCost}
          </span>
        )}
      </div>
    </div>
  );
}
