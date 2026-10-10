import { BENCHMARK_RULES, type BenchmarkRules } from './rules';

export interface CostBand {
  low: number;
  high: number;
  mid: number;
}

const round100 = (n: number) => Math.round(n / 100) * 100;

/** Typical complete-system price band for a given size (linear interpolation). */
export function benchmarkBand(kw: number, rules: BenchmarkRules = BENCHMARK_RULES): CostBand {
  if (!Number.isFinite(kw) || kw <= 0) return { low: 0, high: 0, mid: 0 };
  const pts = [...rules.points].sort((a, b) => a.kw - b.kw);
  const first = pts[0];
  const last = pts[pts.length - 1];
  let low: number;
  let high: number;
  if (kw <= first.kw) {
    low = (first.low / first.kw) * kw;
    high = (first.high / first.kw) * kw;
  } else if (kw >= last.kw) {
    low = last.low + (kw - last.kw) * rules.perExtraKw.low;
    high = last.high + (kw - last.kw) * rules.perExtraKw.high;
  } else {
    let i = 0;
    while (i < pts.length - 2 && kw > pts[i + 1].kw) i++;
    const a = pts[i];
    const b = pts[i + 1];
    const t = (kw - a.kw) / (b.kw - a.kw);
    low = a.low + t * (b.low - a.low);
    high = a.high + t * (b.high - a.high);
  }
  const l = round100(low);
  const h = round100(high);
  return { low: l, high: h, mid: round100((l + h) / 2) };
}
