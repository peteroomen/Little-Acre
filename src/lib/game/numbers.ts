/** Coin / gem counter formatting. Small numbers read exactly; big ones abbreviate. */
export function fmt(n: number): string {
  if (n < 10_000) return Math.floor(n).toLocaleString();
  if (n < 1_000_000) return `${(n / 1_000).toFixed(1)}k`;
  if (n < 1_000_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  return `${(n / 1_000_000_000).toFixed(1)}B`;
}

/** The Bloom prestige multiplier, shown as "×1.4". */
export function fmtBloom(bloom: number): string {
  return `×${bloom.toFixed(1).replace(/\.0$/, '')}`;
}

/**
 * Coarse "idle since" label for save freshness ("just now" / "3m" / "2h" / "4d").
 * Single-unit and rounded down; clamps clock-skew negatives to "just now".
 */
export function formatIdle(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}
