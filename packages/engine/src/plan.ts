import { mergeAssumptions, SYSTEM_LIMITS, type Assumptions } from './assumptions';
import { benchmarkBand } from './benchmarks';
import { buildYears, irr, paybackYears } from './cashflow';
import { sizeSystem } from './sizing';
import { subsidyBreakdown, subsidyCapKw } from './subsidy';
import type { MonthRow, Plan, PlanInputs, PlanResult, PlanWarning, YieldData } from './types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const finitePositive = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;

export function computePlan(
  inputs: PlanInputs,
  yieldData: YieldData,
  assumptionsIn?: Partial<Assumptions> | null
): PlanResult {
  const a = mergeAssumptions(assumptionsIn);
  const { bill, usableRoofAreaM2, selectedKw } = inputs;

  if (!finitePositive(bill.unitsMonth))
    return { ok: false, error: { code: 'INVALID_UNITS', message: 'Monthly units must be a positive number.' } };
  if (!finitePositive(bill.amountMonth))
    return { ok: false, error: { code: 'INVALID_AMOUNT', message: 'Bill amount must be a positive number.' } };
  if (!finitePositive(yieldData.yieldPerKw))
    return { ok: false, error: { code: 'INVALID_YIELD', message: 'Solar yield data is missing or invalid.' } };

  const annualUnits = finitePositive(a.annualUnitsOverride) ? a.annualUnitsOverride : bill.unitsMonth * 12;
  const effectiveRate = bill.amountMonth / bill.unitsMonth;
  const avoidedRate = effectiveRate * a.avoidedRateFactor;

  const sizing = sizeSystem({
    annualUnits,
    yieldPerKw: yieldData.yieldPerKw,
    roofAreaM2: usableRoofAreaM2,
    sanctionedLoadKw: bill.sanctionedLoadKw,
    assumptions: a
  });

  if (sizing.recommendedKw < 0.5) {
    return {
      ok: false,
      error: {
        code: 'ROOF_TOO_SMALL',
        message: 'The usable roof area or sanctioned load is too small for a rooftop system.'
      }
    };
  }

  let kw = selectedKw ?? sizing.recommendedKw;
  if (!finitePositive(kw) || kw < 0.5 || kw > SYSTEM_LIMITS.maxKw) {
    if (selectedKw !== null)
      return {
        ok: false,
        error: { code: 'INVALID_SIZE', message: `System size must be between 0.5 and ${SYSTEM_LIMITS.maxKw} kW.` }
      };
    kw = sizing.recommendedKw;
  }

  const genYear1 = kw * yieldData.yieldPerKw;
  const usefulGenYear1 = Math.min(genYear1, annualUnits);

  const costBand = benchmarkBand(kw);
  const hasQuote = finitePositive(a.grossCostOverride);
  const grossCost = hasQuote ? Math.round(a.grossCostOverride as number) : costBand.mid;
  const sub = subsidyBreakdown(kw);
  const netCost = Math.max(0, grossCost - sub.total);

  const years = buildYears({ kw, usefulGenYear1, genYear1, avoidedRate, netCost, assumptions: a });
  const payback = paybackYears(years, netCost);
  const grossSavings25 = years.reduce((s, r) => s + r.cashflow, 0);
  const savings25 = grossSavings25 - netCost;
  const savingsYear1 = years[0]?.savings ?? 0;

  const monthly: MonthRow[] = MONTHS.map((month, i) => ({
    month,
    generation: Math.round(kw * (yieldData.monthly[i] ?? yieldData.yieldPerKw / 12)),
    usage: Math.round(annualUnits / 12)
  }));

  const ef = a.gridEmissionFactor;
  const tCo2PerYear = (usefulGenYear1 / 1000) * ef;
  const tCo2Lifetime = years.reduce((s, r) => s + (r.useful / 1000) * ef, 0);

  const warnings: PlanWarning[] = [];
  if (sizing.roofKw !== null && kw > Math.floor(sizing.roofKw * 2) / 2 + 1e-9)
    warnings.push({
      code: 'ABOVE_ROOF',
      severity: 'warn',
      message: `Your usable roof fits about ${sizing.roofKw.toFixed(1)} kW. A larger system may not fit.`
    });
  if (sizing.loadKw !== null && kw > sizing.loadKw + 1e-9)
    warnings.push({
      code: 'ABOVE_LOAD',
      severity: 'warn',
      message: `This is above your sanctioned load of ${sizing.loadKw} kW. Your DISCOM may limit the system size.`
    });
  if (kw > subsidyCapKw() + 1e-9)
    warnings.push({
      code: 'ABOVE_SUBSIDY_CAP',
      severity: 'info',
      message: `Subsidy is capped at ₹${sub.capInr.toLocaleString('en-IN')}. Every kW above ${subsidyCapKw()} kW is self-funded.`
    });
  if (genYear1 > annualUnits * 1.05)
    warnings.push({
      code: 'ABOVE_DEMAND',
      severity: 'info',
      message: 'This system generates more than you use in a year. Surplus units are not counted as savings here.'
    });
  if (sizing.belowMinimum)
    warnings.push({
      code: 'BELOW_MINIMUM',
      severity: 'warn',
      message: 'Your roof or sanctioned load only supports a very small system, below the usual 1 kW minimum.'
    });
  if (yieldData.source === 'fallback')
    warnings.push({
      code: 'YIELD_FALLBACK',
      severity: 'info',
      message: `Live solar data was unavailable, so a typical Indian yield of ${Math.round(yieldData.yieldPerKw)} kWh per kW per year is used.`
    });
  if (effectiveRate < 3)
    warnings.push({
      code: 'LOW_RATE',
      severity: 'warn',
      message: 'Your effective rate per unit looks very low. Please recheck the units and amount from your bill.'
    });
  if (effectiveRate > 15)
    warnings.push({
      code: 'HIGH_RATE',
      severity: 'warn',
      message: 'Your effective rate per unit looks very high. Please recheck the units and amount from your bill.'
    });

  const plan: Plan = {
    annualUnits,
    effectiveRate,
    avoidedRate,
    yieldPerKw: yieldData.yieldPerKw,
    yieldSource: yieldData.source,
    demandKw: sizing.demandKw,
    roofKw: sizing.roofKw,
    loadKw: sizing.loadKw,
    recommendedKw: sizing.recommendedKw,
    limiting: sizing.limiting,
    kw,
    genYear1,
    usefulGenYear1,
    coveragePct: annualUnits > 0 ? (usefulGenYear1 / annualUnits) * 100 : 0,
    grossCost,
    costBand,
    costSource: hasQuote ? 'quote' : 'benchmark',
    subsidy: sub.total,
    subsidyLines: sub.lines,
    subsidyCapped: sub.capped,
    selfFundedKw: sub.selfFundedKw,
    netCost,
    savingsYear1,
    monthlySavingsYear1: savingsYear1 / 12,
    paybackYears: payback,
    savings25,
    grossSavings25,
    irr: irr(netCost, years),
    years,
    monthly,
    tCo2PerYear,
    tCo2Lifetime,
    tCo2PerYear1000Homes: tCo2PerYear * 1000,
    warnings
  };
  return { ok: true, plan };
}
