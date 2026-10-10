import { describe, expect, it } from 'vitest';
import { DEFAULT_ASSUMPTIONS } from '../src/assumptions';
import { buildYears, irr, paybackYears } from '../src/cashflow';

const a = { ...DEFAULT_ASSUMPTIONS, tariffEscalationPct: 0, degradationPct: 0, omPerKwPerYear: 0, inverterReplacementPerKw: 0 };

describe('cashflow', () => {
  it('produces a flat cash flow when escalation, degradation and costs are zero', () => {
    const rows = buildYears({ kw: 2, usefulGenYear1: 3000, genYear1: 3000, avoidedRate: 7, netCost: 63000, assumptions: a });
    expect(rows).toHaveLength(25);
    expect(rows[0].savings).toBe(21000);
    expect(rows[24].cumulative).toBe(21000 * 25);
    expect(rows[0].net).toBe(21000 - 63000);
  });

  it('interpolates payback inside the crossing year', () => {
    const rows = buildYears({ kw: 2, usefulGenYear1: 3000, genYear1: 3000, avoidedRate: 7, netCost: 63000, assumptions: a });
    expect(paybackYears(rows, 63000)).toBeCloseTo(3, 6);
    const p = paybackYears(rows, 52500);
    expect(p).toBeCloseTo(2.5, 6);
  });

  it('returns null payback when the horizon is not enough, and 0 for free systems', () => {
    const rows = buildYears({ kw: 2, usefulGenYear1: 3000, genYear1: 3000, avoidedRate: 7, netCost: 1_000_000, assumptions: a });
    expect(paybackYears(rows, 1_000_000)).toBeNull();
    expect(paybackYears(rows, 0)).toBe(0);
  });

  it('applies escalation, degradation, O&M and the year-12 inverter replacement', () => {
    const full = { ...DEFAULT_ASSUMPTIONS };
    const rows = buildYears({ kw: 2, usefulGenYear1: 3000, genYear1: 3000, avoidedRate: 7, netCost: 60000, assumptions: full });
    const y2 = rows[1];
    expect(y2.useful).toBeCloseTo(3000 * 0.995, 6);
    expect(y2.savings).toBeCloseTo(3000 * 0.995 * 7 * 1.03, 4);
    expect(rows[11].inverter).toBe(10000);
    expect(rows[10].inverter).toBe(0);
    expect(rows[0].om).toBe(1000);
  });

  it('shortens payback when the avoided rate rises (monotonic)', () => {
    const p = (rate: number) => {
      const rows = buildYears({ kw: 2, usefulGenYear1: 3000, genYear1: 3000, avoidedRate: rate, netCost: 80000, assumptions: DEFAULT_ASSUMPTIONS });
      return paybackYears(rows, 80000) as number;
    };
    expect(p(6)).toBeGreaterThan(p(8));
    expect(p(8)).toBeGreaterThan(p(10));
  });

  it('computes IRR, and null when the project never recovers its cost', () => {
    const rows = buildYears({ kw: 2, usefulGenYear1: 3000, genYear1: 3000, avoidedRate: 7, netCost: 63000, assumptions: a });
    const r = irr(63000, rows) as number;
    expect(r).toBeGreaterThan(0.3);
    expect(r).toBeLessThan(0.34); // 21000/63000 = 33.3% simple, slightly lower over 25 yrs
    expect(irr(10_000_000, rows)).toBeNull();
    expect(irr(0, rows)).toBeNull();
  });
});
