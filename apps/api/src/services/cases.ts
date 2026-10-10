import {
  mergeAssumptions,
  computePlan,
  type Plan,
  type PlanError,
  type YieldData
} from '@chhatready/engine';
import { ApiError, notFound } from '../errors';
import { casePk, type CaseRecord, type Deps } from '../types';
import { fallbackYield } from './yields';
import { ID_RE } from './util';

export const ttlSeconds = (d: Deps) => d.cfg.caseTtlDays * 86400;

export async function loadCase(d: Deps, id: string): Promise<CaseRecord> {
  if (!ID_RE.test(id)) throw notFound();
  const rec = await d.store.get<CaseRecord>(casePk(id), 'META');
  if (!rec) throw notFound();
  return rec;
}

export async function saveCase(d: Deps, rec: CaseRecord): Promise<void> {
  rec.updatedAt = d.now().toISOString();
  const { pk: _pk, sk: _sk, ...data } = rec as CaseRecord & { pk?: string; sk?: string };
  await d.store.put(casePk(rec.caseId), 'META', data, ttlSeconds(d));
  await d.store.put(`SHARE#${rec.shareId}`, 'META', { caseId: rec.caseId }, ttlSeconds(d));
}

export function usableRoofArea(rec: CaseRecord): number | null {
  if (!rec.roof) return null;
  return Math.max(0, rec.roof.areaM2 * (1 - rec.roof.obstructionPct / 100));
}

export interface Recomputed {
  plan: Plan | null;
  planError: PlanError | null;
  yieldData: YieldData | null;
}

/** The server is the source of truth: it recomputes the plan with the same shared engine the browser uses. */
export async function recompute(d: Deps, rec: CaseRecord): Promise<Recomputed> {
  if (!rec.bill) return { plan: null, planError: null, yieldData: null };
  const a = mergeAssumptions(rec.assumptions);
  let yieldData: YieldData;
  if (rec.roof) {
    yieldData = await d.yields.get(rec.roof.lat, rec.roof.lon);
    if (yieldData.source === 'fallback') yieldData = fallbackYield(a.yieldFallbackPerKw);
  } else {
    yieldData = fallbackYield(a.yieldFallbackPerKw);
  }
  const res = computePlan(
    {
      bill: { unitsMonth: rec.bill.unitsMonth, amountMonth: rec.bill.amountMonth, sanctionedLoadKw: rec.bill.sanctionedLoadKw },
      usableRoofAreaM2: usableRoofArea(rec),
      selectedKw: rec.selectedKw
    },
    yieldData,
    rec.assumptions
  );
  if (!res.ok) {
    rec.plan = null;
    return { plan: null, planError: res.error, yieldData };
  }
  rec.plan = res.plan;
  if (rec.status === 'draft') rec.status = 'planned';
  return { plan: res.plan, planError: null, yieldData };
}

export function requirePlan(rec: CaseRecord): Plan {
  if (!rec.plan || !rec.bill)
    throw new ApiError(409, 'NO_PLAN', 'Finish your plan first.', 'Confirm your bill details and roof area, then try again.');
  return rec.plan;
}

export const maskConsumer = (n: string) => (n.length <= 4 ? n : `${'•'.repeat(Math.max(0, n.length - 4))}${n.slice(-4)}`);
