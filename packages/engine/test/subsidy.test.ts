import { describe, expect, it } from 'vitest';
import { centralSubsidy, subsidyBreakdown, subsidyCapKw } from '../src/subsidy';

describe('PM Surya Ghar central subsidy (golden values)', () => {
  it.each([
    [1, 30000],
    [1.5, 45000],
    [2, 60000],
    [2.5, 69000],
    [3, 78000],
    [4, 78000],
    [5, 78000],
    [10, 78000],
    [0, 0],
    [-1, 0],
    [Number.NaN, 0]
  ])('%s kW gives ₹%s', (kw, expected) => {
    expect(centralSubsidy(kw)).toBe(expected);
  });

  it('breaks the subsidy into slab lines that add up to the total', () => {
    const r = subsidyBreakdown(2.5);
    expect(r.lines.map((l) => l.amount)).toEqual([60000, 9000]);
    expect(r.lines.reduce((s, l) => s + l.amount, 0)).toBe(r.total);
    expect(r.capped).toBe(false);
    expect(r.selfFundedKw).toBe(0);
  });

  it('flags the cap and self-funded kW above 3 kW', () => {
    const r = subsidyBreakdown(5);
    expect(r.capped).toBe(true);
    expect(r.selfFundedKw).toBe(2);
    expect(r.total).toBe(78000);
  });

  it('knows the last subsidised kW', () => {
    expect(subsidyCapKw()).toBe(3);
  });
});
