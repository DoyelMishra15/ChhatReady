import subsidyJson from '../../../rules/subsidy.json';
import benchmarksJson from '../../../rules/benchmarks.json';
import emissionsJson from '../../../rules/emissions.json';

export interface SubsidyRule {
  scheme: string;
  source: string;
  tiers: { uptoKw: number; perKw: number }[];
  capInr: number;
  notes: string;
}

export interface BenchmarkRules {
  note: string;
  points: { kw: number; low: number; high: number }[];
  perExtraKw: { low: number; high: number };
}

export interface EmissionsRule {
  gridEmissionFactorTCo2PerMwh: number;
  source: string;
  note: string;
}

export const SUBSIDY_RULE: SubsidyRule = subsidyJson as SubsidyRule;
export const BENCHMARK_RULES: BenchmarkRules = benchmarksJson as BenchmarkRules;
export const EMISSIONS_RULE: EmissionsRule = emissionsJson as EmissionsRule;
