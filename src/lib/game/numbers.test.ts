import { describe, expect, it } from 'vitest';

import { fmt, fmtBloom, formatIdle } from './numbers';

describe('fmt', () => {
  it('shows small numbers exactly', () => {
    expect(fmt(0)).toBe('0');
    expect(fmt(220)).toBe('220');
    expect(fmt(9_999)).toBe('9,999');
  });

  it('abbreviates thousands / millions / billions', () => {
    expect(fmt(12_400)).toBe('12.4k');
    expect(fmt(3_500_000)).toBe('3.5M');
    expect(fmt(2_000_000_000)).toBe('2.0B');
  });
});

describe('fmtBloom', () => {
  it('renders a ×multiplier and trims a trailing .0', () => {
    expect(fmtBloom(1.4)).toBe('×1.4');
    expect(fmtBloom(2)).toBe('×2');
    expect(fmtBloom(3.58)).toBe('×3.6');
  });
});

describe('formatIdle', () => {
  it('buckets elapsed time into a single glanceable unit', () => {
    expect(formatIdle(-500)).toBe('just now');
    expect(formatIdle(5_000)).toBe('just now');
    expect(formatIdle(3 * 60_000)).toBe('3m');
    expect(formatIdle(2 * 3_600_000)).toBe('2h');
    expect(formatIdle(4 * 86_400_000)).toBe('4d');
  });
});
