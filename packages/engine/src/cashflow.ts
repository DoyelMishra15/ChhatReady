import type { Assumptions } from './assumptions';

export interface YearRow {
  year: number;
  generation: number;
  useful: number;
  savings: number;
  om: number;
  inverter: number;
  cashflow: number;
  cumulative: number;
  /** cumulative minus net cost: negative until breakeven */
  net: number;
}

export interface CashflowInput {
  kw: number;
  usefulGenYear1: number;
  genYear1: number;
  avoidedRate: number;
  netCost: number;
  assumptions: Assumptions;
}

export function buildYears(input: CashflowInput): YearRow[] {
  const { kw, usefulGenYear1, genYear1, avoidedRate, netCost, assumptions: a } = input;
  const rows: YearRow[] = [];
  let cumulative = 0;
  for (let y = 1; y <= a.horizonYears; y++) {
    const degr = Math.pow(1 - a.degradationPct / 100, y - 1);
    const rate = avoidedRate * Math.pow(1 + a.tariffEscalationPct / 100, y - 1);
    const generation = genYear1 * degr;
    const useful = usefulGenYear1 * degr;
    const savings = useful * rate;
    const om = a.omPerKwPerYear * kw;
    const inverter = y === a.inverterReplacementYear ? a.inverterReplacementPerKw * kw : 0;
    const cashflow = savings - om - inverter;
    cumulative += cashflow;
    rows.push({ year: y, generation, useful, savings, om, inverter, cashflow, cumulative, net: cumulative - netCost });
  }
  return rows;
}

/** Years until cumulative cash flow covers the net cost, linearly interpolated. */
export function paybackYears(rows: YearRow[], netCost: number): number | null {
  if (netCost <= 0) return 0;
  let prevCum = 0;
  for (const r of rows) {
    if (r.cumulative >= netCost) {
      const needed = netCost - prevCum;
      return r.year - 1 + (r.cashflow > 0 ? needed / r.cashflow : 1);
    }
    prevCum = r.cumulative;
  }
  return null;
}

/** IRR by bisection on [-0.9, 1.0]; null when the project never recovers its cost (or is free). */
export function irr(netCost: number, rows: YearRow[]): number | null {
  if (netCost <= 0) return null;
  const total = rows.reduce((s, r) => s + r.cashflow, 0);
  if (total < netCost) return null;
  const npv = (r: number) => {
    let s = -netCost;
    for (const row of rows) s += row.cashflow / Math.pow(1 + r, row.year);
    return s;
  };
  let lo = -0.9;
  let hi = 1.0;
  const fLo = npv(lo);
  const fHi = npv(hi);
  if (!Number.isFinite(fLo) || !Number.isFinite(fHi) || fLo * fHi > 0) return null;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    const f = npv(mid);
    if (Math.abs(f) < 1e-6) return mid;
    if (f * fLo > 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
