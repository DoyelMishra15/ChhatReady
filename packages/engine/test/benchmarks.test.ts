import { describe, expect, it } from 'vitest';
import { benchmarkBand } from '../src/benchmarks';

describe('benchmarkBand', () => {
  it('returns the published points exactly', () => {
    expect(benchmarkBand(1)).toMatchObject({ low: 60000, high: 75000 });
    expect(benchmarkBand(2)).toMatchObject({ low: 120000, high: 140000 });
    expect(benchmarkBand(3)).toMatchObject({ low: 160000, high: 210000 });
  });
  it('interpolates between points', () => {
    const b = benchmarkBand(2.5);
    expect(b.low).toBe(140000);
    expect(b.high).toBe(175000);
    expect(b.mid).toBe(157500);
  });
  it('extrapolates above 3 kW at the per-kW rate', () => {
    const b = benchmarkBand(5);
    expect(b.low).toBe(160000 + 2 * 55000);
    expect(b.high).toBe(210000 + 2 * 65000);
  });
  it('scales proportionally below 1 kW and returns zeros for invalid input', () => {
    expect(benchmarkBand(0.5).low).toBe(30000);
    expect(benchmarkBand(0)).toEqual({ low: 0, high: 0, mid: 0 });
    expect(benchmarkBand(Number.NaN)).toEqual({ low: 0, high: 0, mid: 0 });
  });
});
