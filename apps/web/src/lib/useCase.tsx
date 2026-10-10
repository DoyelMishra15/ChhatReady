import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  FALLBACK_MONTHLY_SHAPE,
  computePlan,
  mergeAssumptions,
  type Assumptions,
  type BillFields,
  type BillInput,
  type ExtractionSource,
  type Plan,
  type PlanError,
  type RoofInput,
  type YieldData
} from '@chhatready/engine';
import { api, friendlyError, type CaseResponse, type InputsResponse, type QuoteRecord } from './api';
import { rememberCase } from './storage';

interface CaseCtx {
  caseId: string;
  ref: string;
  shareId: string;
  loading: boolean;
  error: { message: string; hint?: string; code: string } | null;
  reload: () => Promise<void>;
  mode: 'mock' | 'aws';
  mailMode: 'ses' | 'file';
  limits: { maxRfq: number; maxEmails: number };
  rfqCount: number;
  emailCount: number;
  bumpRfq: (n: number) => void;
  bumpEmail: () => void;

  billFields: BillFields | null;
  billImageUrl: string | null;
  extractionSource: ExtractionSource | null;
  bill: BillInput | null;
  roof: RoofInput | null;
  selectedKw: number | null;
  assumptions: Partial<Assumptions>;
  yieldData: YieldData | null;
  plan: Plan | null;
  planError: PlanError | null;
  quotes: QuoteRecord[];

  setBill: (b: BillInput) => void;
  setRoof: (r: RoofInput | null) => void;
  setSelectedKw: (kw: number | null) => void;
  setAssumptions: (a: Partial<Assumptions>) => void;
  setQuotes: (q: QuoteRecord[]) => void;
  /** Saves immediately and returns the server's answer. Throws on failure. */
  saveNow: () => Promise<InputsResponse | null>;
  saving: boolean;
  saveFailed: boolean;
}

const Ctx = createContext<CaseCtx | null>(null);

export const useCase = (): CaseCtx => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useCase must be used inside CaseProvider');
  return c;
};

function fallbackYield(perKw: number): YieldData {
  return { yieldPerKw: perKw, monthly: FALLBACK_MONTHLY_SHAPE.map((s) => Math.round(s * perKw * 10) / 10), source: 'fallback' };
}

export function CaseProvider({ caseId, children }: { caseId: string; children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<CaseCtx['error']>(null);
  const [meta, setMeta] = useState({ ref: '', shareId: '', mode: 'aws' as 'mock' | 'aws', mailMode: 'ses' as 'ses' | 'file', limits: { maxRfq: 5, maxEmails: 10 }, rfqCount: 0, emailCount: 0 });
  const [billFields, setBillFields] = useState<BillFields | null>(null);
  const [billImageUrl, setBillImageUrl] = useState<string | null>(null);
  const [extractionSource, setExtractionSource] = useState<ExtractionSource | null>(null);
  const [bill, setBillState] = useState<BillInput | null>(null);
  const [roof, setRoofState] = useState<RoofInput | null>(null);
  const [selectedKw, setSelectedKwState] = useState<number | null>(null);
  const [assumptions, setAssumptionsState] = useState<Partial<Assumptions>>({});
  const [yieldData, setYieldData] = useState<YieldData | null>(null);
  const [quotes, setQuotes] = useState<QuoteRecord[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  const loaded = useRef(false);
  const skipNext = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef({ bill, roof, selectedKw, assumptions });
  latest.current = { bill, roof, selectedKw, assumptions };

  const apply = useCallback((r: CaseResponse) => {
    skipNext.current = true;
    setMeta({ ref: r.case.ref, shareId: r.case.shareId, mode: r.mode, mailMode: r.mailMode, limits: r.limits, rfqCount: r.rfqCount, emailCount: r.emailCount });
    setBillFields(r.billExtraction?.fields ?? null);
    setExtractionSource(r.billExtraction?.source ?? null);
    setBillImageUrl(r.billImageUrl);
    setBillState(r.case.bill);
    setRoofState(r.case.roof);
    setSelectedKwState(r.case.selectedKw);
    setAssumptionsState(r.case.assumptions ?? {});
    setYieldData(r.yield);
    setQuotes(r.quotes);
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.getCase(caseId);
      apply(r);
      rememberCase(caseId);
      loaded.current = true;
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }, [caseId, apply]);

  useEffect(() => {
    loaded.current = false;
    void reload();
    return () => clearTimeout(timer.current);
  }, [reload]);

  const saveNow = useCallback(async () => {
    clearTimeout(timer.current);
    const p = latest.current;
    if (!p.bill) return null;
    setSaving(true);
    try {
      const res = await api.putInputs(caseId, { bill: p.bill, roof: p.roof, selectedKw: p.selectedKw, assumptions: p.assumptions });
      if (res.yield) setYieldData(res.yield);
      setSaveFailed(false);
      return res;
    } catch (e) {
      setSaveFailed(true);
      throw e;
    } finally {
      setSaving(false);
    }
  }, [caseId]);

  // Autosave shortly after any change. The plan on screen is computed locally and instantly.
  useEffect(() => {
    if (!loaded.current) return;
    if (skipNext.current) {
      skipNext.current = false;
      return;
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      saveNow().catch(() => undefined);
    }, 700);
  }, [bill, roof, selectedKw, assumptions, saveNow]);

  const merged = useMemo(() => mergeAssumptions(assumptions), [assumptions]);
  const effectiveYield = useMemo<YieldData>(() => {
    if (yieldData && yieldData.source !== 'fallback') return yieldData;
    return fallbackYield(merged.yieldFallbackPerKw);
  }, [yieldData, merged.yieldFallbackPerKw]);

  const { plan, planError } = useMemo(() => {
    if (!bill) return { plan: null as Plan | null, planError: null as PlanError | null };
    const usable = roof ? Math.max(0, roof.areaM2 * (1 - roof.obstructionPct / 100)) : null;
    const res = computePlan(
      { bill: { unitsMonth: bill.unitsMonth, amountMonth: bill.amountMonth, sanctionedLoadKw: bill.sanctionedLoadKw }, usableRoofAreaM2: usable, selectedKw },
      effectiveYield,
      assumptions
    );
    return res.ok ? { plan: res.plan, planError: null } : { plan: null, planError: res.error };
  }, [bill, roof, selectedKw, assumptions, effectiveYield]);

  const value: CaseCtx = {
    caseId,
    ...meta,
    loading,
    error,
    reload,
    bumpRfq: (n) => setMeta((m) => ({ ...m, rfqCount: m.rfqCount + n })),
    bumpEmail: () => setMeta((m) => ({ ...m, emailCount: m.emailCount + 1 })),
    billFields,
    billImageUrl,
    extractionSource,
    bill,
    roof,
    selectedKw,
    assumptions,
    yieldData: effectiveYield,
    plan,
    planError,
    quotes,
    setBill: setBillState,
    setRoof: setRoofState,
    setSelectedKw: setSelectedKwState,
    setAssumptions: setAssumptionsState,
    setQuotes,
    saveNow,
    saving,
    saveFailed
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
