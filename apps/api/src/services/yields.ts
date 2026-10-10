import { FALLBACK_MONTHLY_SHAPE, type YieldData } from '@chhatready/engine';
import type { Store } from './store';
import seed from '../../../../demo/fixtures/pvgis.json';

export interface YieldService {
  get(lat: number, lon: number): Promise<YieldData>;
}

export const yieldKey = (lat: number, lon: number) => `${lat.toFixed(2)},${lon.toFixed(2)}`;

export function fallbackYield(perKw: number): YieldData {
  return { yieldPerKw: perKw, monthly: FALLBACK_MONTHLY_SHAPE.map((s) => Math.round(s * perKw * 10) / 10), source: 'fallback' };
}

type SeedEntry = { yieldPerKw: number; monthly: number[] };
const seedEntries = (seed as unknown as { entries: Record<string, SeedEntry>; regionalDefault: SeedEntry });

function fromSeed(lat: number, lon: number, allowDefault: boolean): YieldData | null {
  const e = seedEntries.entries[yieldKey(lat, lon)] ?? (allowDefault ? seedEntries.regionalDefault : undefined);
  return e ? { yieldPerKw: e.yieldPerKw, monthly: e.monthly, source: 'seed' } : null;
}

interface PvgisResponse {
  outputs?: { totals?: { fixed?: { E_y?: number } }; monthly?: { fixed?: { E_m?: number }[] } };
}

export async function fetchPvgis(base: string, lat: number, lon: number, fetchImpl: typeof fetch = fetch): Promise<YieldData | null> {
  const url = `${base}/PVcalc?lat=${lat}&lon=${lon}&peakpower=1&loss=14&optimalangles=1&outputformat=json`;
  try {
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const j = (await res.json()) as PvgisResponse;
    const ey = j.outputs?.totals?.fixed?.E_y;
    const em = j.outputs?.monthly?.fixed?.map((m) => m.E_m ?? 0);
    if (!ey || ey < 500 || ey > 2500 || !em || em.length !== 12) return null;
    return { yieldPerKw: Math.round(ey), monthly: em.map((v) => Math.round(v * 10) / 10), source: 'pvgis' };
  } catch {
    return null;
  }
}

export function createYieldService(opts: {
  store: Store;
  pvgisBase: string;
  mock: boolean;
  fallbackPerKw?: number;
  fetchImpl?: typeof fetch;
}): YieldService {
  const { store, pvgisBase, mock } = opts;
  return {
    async get(lat, lon) {
      const key = yieldKey(lat, lon);
      if (mock) return fromSeed(lat, lon, true) ?? fallbackYield(opts.fallbackPerKw ?? 1400);

      const cached = await store.get<YieldData>(`CACHE#PVGIS#${key}`, 'V1');
      if (cached) return { yieldPerKw: cached.yieldPerKw, monthly: cached.monthly, source: 'cache' };

      // The demo roof location always resolves to the same value, so the demo is repeatable.
      const exact = seedEntries.entries[key];
      if (exact) return { yieldPerKw: exact.yieldPerKw, monthly: exact.monthly, source: 'seed' };

      const live = await fetchPvgis(pvgisBase, lat, lon, opts.fetchImpl);
      if (live) {
        await store.put(`CACHE#PVGIS#${key}`, 'V1', { yieldPerKw: live.yieldPerKw, monthly: live.monthly, fetchedAt: new Date().toISOString() }, 180 * 86400);
        return live;
      }
      return fallbackYield(opts.fallbackPerKw ?? 1400);
    }
  };
}
