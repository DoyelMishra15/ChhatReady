import { EMISSIONS_RULE } from './rules';

/**
 * Every constant the engine uses lives here. The UI shows them all and lets
 * the user edit the ones marked editable. Nothing is hidden in the maths.
 */
export interface Assumptions {
  /** Fraction of annual consumption the system is sized to offset. */
  offsetTarget: number;
  /** Share of the effective ₹/kWh that solar actually avoids (fixed charges remain). */
  avoidedRateFactor: number;
  /** Usable roof area needed per kW. */
  areaPerKwM2: number;
  /** Yearly electricity tariff escalation, percent. */
  tariffEscalationPct: number;
  /** Yearly module degradation, percent. */
  degradationPct: number;
  /** Annual O&M per kW, ₹. */
  omPerKwPerYear: number;
  /** Inverter replacement cost per kW, ₹. */
  inverterReplacementPerKw: number;
  inverterReplacementYear: number;
  /** tCO2 avoided per MWh generated. */
  gridEmissionFactor: number;
  horizonYears: number;
  /** Yield used when PVGIS is unavailable, kWh per kWp per year. */
  yieldFallbackPerKw: number;
  /** Optional override for annual consumption (seasonal correction). */
  annualUnitsOverride: number | null;
  /** Optional real quote total (₹) replacing the benchmark gross cost. */
  grossCostOverride: number | null;
}

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  offsetTarget: 1.0,
  avoidedRateFactor: 0.85,
  areaPerKwM2: 8,
  tariffEscalationPct: 3,
  degradationPct: 0.5,
  omPerKwPerYear: 500,
  inverterReplacementPerKw: 5000,
  inverterReplacementYear: 12,
  gridEmissionFactor: EMISSIONS_RULE.gridEmissionFactorTCo2PerMwh,
  horizonYears: 25,
  yieldFallbackPerKw: 1400,
  annualUnitsOverride: null,
  grossCostOverride: null
};

export const SYSTEM_LIMITS = { minKw: 1, maxKw: 10, stepKw: 0.5 } as const;

export function mergeAssumptions(partial?: Partial<Assumptions> | null): Assumptions {
  const out: Assumptions = { ...DEFAULT_ASSUMPTIONS };
  if (!partial) return out;
  for (const key of Object.keys(partial) as (keyof Assumptions)[]) {
    const v = partial[key];
    if (v === undefined) continue;
    (out as unknown as Record<string, unknown>)[key] = v;
  }
  return out;
}

/** Shown in the UI as "typical Indian monthly shape" when PVGIS is unavailable. */
export const FALLBACK_MONTHLY_SHAPE = [
  0.082, 0.085, 0.095, 0.096, 0.093, 0.08, 0.07, 0.071, 0.076, 0.087, 0.084, 0.081
];
