'use client';

/**
 * Shared pixel-art bits for the puzzle surfaces (mockup 1b/1e/1h).
 * Colours come from the `--la-*` tokens in globals.css — no raw hex here.
 */

/**
 * A notched pixel star (really a plus-badge; `.la-star` clips it). Filled stars
 * carry the coin fill + inner ring; hollow stars use the muted empty fill.
 * `big` adds the result-modal's heavier ring + corner shade.
 */
export function PixelStar({
  size,
  filled,
  big = false,
}: {
  size: number;
  filled: boolean;
  big?: boolean;
}) {
  const boxShadow = filled
    ? big
      ? 'inset 0 0 0 3px var(--la-coin-ring), inset -5px -5px 0 rgba(200,140,10,.35)'
      : 'inset 0 0 0 2px var(--la-coin-ring)'
    : undefined;
  return (
    <span
      className="la-star inline-block flex-none"
      aria-hidden
      style={{
        width: size,
        height: size,
        background: filled ? 'var(--la-coin)' : 'var(--la-star-empty)',
        boxShadow,
      }}
    />
  );
}

/** A row of three small pixel stars, filled up to `value` (puzzle-select cards). */
export function PixelStarRow({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="flex gap-[3px]" aria-label={`${value} of 3 stars`}>
      {[0, 1, 2].map((i) => (
        <PixelStar key={i} size={size} filled={i < value} />
      ))}
    </span>
  );
}
