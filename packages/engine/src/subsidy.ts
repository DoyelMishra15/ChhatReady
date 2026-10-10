import { SUBSIDY_RULE, type SubsidyRule } from './rules';

export interface SubsidyLine {
  label: string;
  kw: number;
  perKw: number;
  amount: number;
}

export interface SubsidyResult {
  total: number;
  lines: SubsidyLine[];
  capped: boolean;
  capInr: number;
  /** kW beyond the last subsidised tier; self-funded. */
  selfFundedKw: number;
}

export function subsidyBreakdown(kw: number, rule: SubsidyRule = SUBSIDY_RULE): SubsidyResult {
  const lines: SubsidyLine[] = [];
  if (!Number.isFinite(kw) || kw <= 0) {
    return { total: 0, lines, capped: false, capInr: rule.capInr, selfFundedKw: 0 };
  }
  let prev = 0;
  let sum = 0;
  for (const tier of rule.tiers) {
    const slabKw = Math.max(0, Math.min(kw, tier.uptoKw) - prev);
    if (slabKw > 0) {
      const amount = Math.round(slabKw * tier.perKw);
      lines.push({
        label: prev === 0 ? `First ${tier.uptoKw} kW` : `kW ${prev} to ${tier.uptoKw}`,
        kw: slabKw,
        perKw: tier.perKw,
        amount
      });
      sum += amount;
    }
    prev = tier.uptoKw;
  }
  const total = Math.min(Math.round(sum), rule.capInr);
  return {
    total,
    lines,
    capped: sum >= rule.capInr,
    capInr: rule.capInr,
    selfFundedKw: Math.max(0, kw - prev)
  };
}

export function centralSubsidy(kw: number, rule: SubsidyRule = SUBSIDY_RULE): number {
  return subsidyBreakdown(kw, rule).total;
}

/** Largest kW that still earns additional subsidy. */
export function subsidyCapKw(rule: SubsidyRule = SUBSIDY_RULE): number {
  return rule.tiers.reduce((m, t) => Math.max(m, t.uptoKw), 0);
}
