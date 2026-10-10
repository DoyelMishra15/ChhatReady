import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../src/app';
import { loadConfig } from '../src/config';
import { LocalBlobs } from '../src/services/blobs';
import { silentLog, noMetrics } from '../src/services/logger';
import { FileMailer } from '../src/services/mailer';
import { MemoryStore } from '../src/services/store';
import { MockExtractor } from '../src/services/textract';
import { createYieldService } from '../src/services/yields';
import type { Deps } from '../src/types';

export function makeDeps(overrides: Partial<Deps> = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chhatready-test-'));
  const cfg = loadConfig({ MOCK_AWS: '1', DATA_DIR: dir, APP_URL: 'https://app.example' });
  const store = new MemoryStore();
  const deps: Deps = {
    cfg,
    store,
    blobs: new LocalBlobs(path.join(dir, 'blobs')),
    extractor: new MockExtractor(),
    mailer: new FileMailer(path.join(dir, 'outbox')),
    yields: createYieldService({ store, pvgisBase: cfg.pvgisBase, mock: true }),
    log: silentLog,
    metrics: noMetrics,
    now: () => new Date(1_800_000_000_000),
    ...overrides
  };
  return { deps, dir, app: createApp(deps) };
}

export const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4, 5, 6, 7, 8]);
export const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 10, 1, 2, 3, 4]);

export const BILL = {
  discom: 'Sample Power Distribution Co. Ltd.',
  consumerNumber: '4821093755',
  billingPeriod: 'Monthly',
  tariffCategory: 'LT Domestic',
  unitsMonth: 285,
  amountMonth: 2412.6,
  sanctionedLoadKw: 4
};
export const ROOF = {
  mode: 'manual' as const,
  polygon: [] as [number, number][],
  lat: 26.91,
  lon: 75.79,
  areaM2: 48,
  obstructionPct: 20
};

type App = ReturnType<typeof makeDeps>['app'];
/** Response whose json() is loosely typed, so tests can read fields without casting. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type R = { json(): Promise<any> } & Response;
export const json = (app: App, method: string, url: string, body?: unknown) =>
  app.request(url, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }) as Promise<R>;
export const get = (app: App, url: string) => app.request(url) as Promise<R>;

export async function uploadVia(app: App, caseId: string, kind: 'bill' | 'quote', bytes: Uint8Array, contentType = 'image/png') {
  const pre = await (await json(app, 'POST', '/uploads/presign', { caseId, kind, contentType })).json();
  const put = await app.request(pre.uploadUrl, { method: 'PUT', headers: pre.headers, body: bytes as never });
  if (put.status !== 200) throw new Error(`upload failed ${put.status}`);
  return pre.key as string;
}
