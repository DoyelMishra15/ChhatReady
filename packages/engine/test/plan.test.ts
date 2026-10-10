import { describe, expect, it } from 'vitest';
import { computePlan } from '../src/plan';
import type { PlanInputs, YieldData } from '../src/types';

const yieldData: YieldData = {
  yieldPerKw: 1400,
  monthly: [100, 110, 130, 135, 135, 110, 100, 105, 110, 120, 105, 100].map((v) => v * (1400 / 1360)),
  source: 'pvgis'
};

const inputs: PlanInputs = {
  bill: { unitsMonth: 280, amountMonth: 2350, sanctionedLoadKw: 5 },
  usableRoofAreaM2: 40,
  selectedKw: null
};

describe('computePlan', () => {
  it('recommends 2.5 kW for 280 units/month and computes the headline numbers', () => {
    const r = computePlan(inputs, yieldData);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const p = r.plan;
    expect(p.kw).toBe(2.5);
    expect(p.annualUnits).toBe(3360);
    expect(p.effectiveRate).toBeCloseTo(2350 / 280, 6);
    expect(p.avoidedRate).toBeCloseTo((2350 / 280) * 0.85, 6);
    expect(p.genYear1).toBe(3500);
    expect(p.usefulGenYear1).toBe(3360); // surplus not monetised
    expect(p.subsidy).toBe(69000);
    expect(p.grossCost).toBe(157500);
    expect(p.netCost).toBe(157500 - 69000);
    expect(p.costSource).toBe('benchmark');
    expect(p.years).toHaveLength(25);
    expect(p.paybackYears).not.toBeNull();
    expect(p.paybackYears as number).toBeGreaterThan(3);
    expect(p.paybackYears as number).toBeLessThan(10);
    expect(p.savings25).toBeCloseTo(p.grossSavings25 - p.netCost, 6);
    expect(p.tCo2PerYear).toBeCloseTo((3360 / 1000) * 0.71, 6);
    expect(p.tCo2PerYear1000Homes).toBeCloseTo(p.tCo2PerYear * 1000, 6);
    expect(p.monthly).toHaveLength(12);
  });

  it('is fully deterministic', () => {
    const a = computePlan(inputs, yieldData);
    const b = computePlan(inputs, yieldData);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('warns above the subsidy cap and above the roof, but still computes', () => {
    const r = computePlan({ ...inputs, selectedKw: 6 }, yieldData);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const codes = r.plan.warnings.map((w) => w.code);
    expect(codes).toContain('ABOVE_SUBSIDY_CAP');
    expect(codes).toContain('ABOVE_ROOF');
    expect(codes).toContain('ABOVE_LOAD');
    expect(codes).toContain('ABOVE_DEMAND');
    expect(r.plan.subsidy).toBe(78000);
    expect(r.plan.selfFundedKw).toBe(3);
  });

  it('uses a real quote as gross cost when provided', () => {
    const r = computePlan(inputs, yieldData, { grossCostOverride: 140000 });
    expect(r.ok && r.plan.grossCost).toBe(140000);
    expect(r.ok && r.plan.costSource).toBe('quote');
  });

  it('applies a seasonal annual-units override', () => {
    const r = computePlan(inputs, yieldData, { annualUnitsOverride: 4800 });
    expect(r.ok && r.plan.annualUnits).toBe(4800);
    expect(r.ok && r.plan.kw).toBe(3.5);
  });

  it('flags a fallback yield', () => {
    const r = computePlan(inputs, { ...yieldData, source: 'fallback' });
    expect(r.ok && r.plan.warnings.some((w) => w.code === 'YIELD_FALLBACK')).toBe(true);
  });

  it('returns typed errors instead of NaN', () => {
    const bad = (i: PlanInputs, y = yieldData) => computePlan(i, y);
    expect(bad({ ...inputs, bill: { ...inputs.bill, unitsMonth: 0 } })).toMatchObject({ ok: false, error: { code: 'INVALID_UNITS' } });
    expect(bad({ ...inputs, bill: { ...inputs.bill, amountMonth: Number.NaN } })).toMatchObject({ ok: false, error: { code: 'INVALID_AMOUNT' } });
    expect(bad(inputs, { ...yieldData, yieldPerKw: 0 })).toMatchObject({ ok: false, error: { code: 'INVALID_YIELD' } });
    expect(bad({ ...inputs, usableRoofAreaM2: 0 })).toMatchObject({ ok: false, error: { code: 'ROOF_TOO_SMALL' } });
    expect(bad({ ...inputs, selectedKw: 25 })).toMatchObject({ ok: false, error: { code: 'INVALID_SIZE' } });
  });

  it('never produces NaN or Infinity anywhere in a valid plan', () => {
    const r = computePlan(inputs, yieldData);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const walk = (v: unknown): void => {
      if (typeof v === 'number') expect(Number.isFinite(v)).toBe(true);
      else if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') Object.values(v).forEach(walk);
    };
    walk(r.plan);
  });

  it('shorter payback with a higher bill for the same size', () => {
    const lo = computePlan({ ...inputs, bill: { ...inputs.bill, amountMonth: 1800 }, selectedKw: 2.5 }, yieldData);
    const hi = computePlan({ ...inputs, bill: { ...inputs.bill, amountMonth: 3000 }, selectedKw: 2.5 }, yieldData);
    expect(lo.ok && hi.ok).toBe(true);
    if (lo.ok && hi.ok) expect(hi.plan.paybackYears as number).toBeLessThan(lo.plan.paybackYears as number);
  });
});
