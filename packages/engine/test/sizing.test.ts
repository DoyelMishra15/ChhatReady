import { describe, expect, it } from 'vitest';
import { DEFAULT_ASSUMPTIONS } from '../src/assumptions';
import { sizeSystem } from '../src/sizing';

const base = {
  annualUnits: 3360,
  yieldPerKw: 1400,
  roofAreaM2: 40,
  sanctionedLoadKw: 5,
  assumptions: DEFAULT_ASSUMPTIONS
};

describe('sizeSystem', () => {
  it('is demand-limited when roof and load are generous', () => {
    const r = sizeSystem(base);
    expect(r.demandKw).toBeCloseTo(2.4, 5);
    expect(r.recommendedKw).toBe(2.5);
    expect(r.limiting).toBe('demand');
  });

  it('respects the roof cap and floors it to half kW', () => {
    const r = sizeSystem({ ...base, roofAreaM2: 17 }); // 2.125 kW fits
    expect(r.roofKw).toBeCloseTo(2.125, 5);
    expect(r.recommendedKw).toBe(2);
    expect(r.limiting).toBe('roof');
  });

  it('respects the sanctioned load cap', () => {
    const r = sizeSystem({ ...base, annualUnits: 9000, sanctionedLoadKw: 3 });
    expect(r.recommendedKw).toBe(3);
    expect(r.limiting).toBe('load');
  });

  it('never goes below 1 kW unless the roof cannot hold it', () => {
    expect(sizeSystem({ ...base, annualUnits: 600 }).recommendedKw).toBe(1);
    const tiny = sizeSystem({ ...base, roofAreaM2: 5 });
    expect(tiny.recommendedKw).toBe(0.5);
    expect(tiny.belowMinimum).toBe(true);
  });

  it('caps the recommendation at 10 kW', () => {
    expect(sizeSystem({ ...base, annualUnits: 60000, roofAreaM2: 400, sanctionedLoadKw: null }).recommendedKw).toBe(10);
  });

  it('treats unknown roof and load as unconstrained', () => {
    const r = sizeSystem({ ...base, roofAreaM2: null, sanctionedLoadKw: null });
    expect(r.roofKw).toBeNull();
    expect(r.loadKw).toBeNull();
    expect(r.recommendedKw).toBe(2.5);
  });

  it('honours the offset target', () => {
    const r = sizeSystem({ ...base, assumptions: { ...DEFAULT_ASSUMPTIONS, offsetTarget: 0.5 } });
    expect(r.demandKw).toBeCloseTo(1.2, 5);
    expect(r.recommendedKw).toBe(1);
  });
});
