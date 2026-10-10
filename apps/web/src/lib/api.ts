import type {
  Assumptions,
  BillFields,
  BillInput,
  ExtractionSource,
  Plan,
  PlanError,
  QuoteFields,
  QuoteFlag,
  QuoteVerdict,
  RoofInput,
  YieldData
} from '@chhatready/engine';

export class ApiClientError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public hint?: string
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

let basePromise: Promise<string> | null = null;

/** Deployed: /config.json written by CDK. Dev: Vite proxies /api to the local API. */
export function getApiBase(): Promise<string> {
  basePromise ??= (async () => {
    try {
      const res = await fetch('/config.json', { cache: 'no-store' });
      const type = res.headers.get('content-type') ?? '';
      if (res.ok && type.includes('json')) {
        const j = (await res.json()) as { apiUrl?: string };
        if (j.apiUrl) return j.apiUrl.replace(/\/$/, '');
      }
    } catch {
      /* fall through */
    }
    return ((import.meta.env.VITE_API_URL as string | undefined) || '/api').replace(/\/$/, '');
  })();
  return basePromise;
}

export async function resolveUrl(u: string): Promise<string> {
  return u.startsWith('/') ? `${await getApiBase()}${u}` : u;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const base = await getApiBase();
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch {
    throw new ApiClientError(0, 'NETWORK', "We can't reach the server.", 'Check your internet connection and try again.');
  }
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) {
    const e = (json as { error?: { code?: string; message?: string; hint?: string } } | null)?.error;
    throw new ApiClientError(res.status, e?.code ?? 'ERROR', e?.message ?? 'Something went wrong.', e?.hint);
  }
  return json as T;
}

export interface CaseRecord {
  caseId: string;
  shareId: string;
  ref: string;
  createdAt: string;
  updatedAt: string;
  status: 'draft' | 'planned' | 'packed';
  bill: BillInput | null;
  roof: RoofInput | null;
  selectedKw: number | null;
  assumptions: Partial<Assumptions>;
  plan: Plan | null;
  packKey: string | null;
  packAt: string | null;
}

export interface QuoteRecord {
  qid: string;
  key: string;
  fields: QuoteFields;
  source: ExtractionSource;
  totalPrice: number | null;
  systemKw: number | null;
  verdict: QuoteVerdict;
  flags: QuoteFlag[];
  questions: string[];
  createdAt: string;
  imageUrl?: string;
}

export interface CaseResponse {
  case: CaseRecord;
  yield: YieldData | null;
  billExtraction: { fields: BillFields; source: ExtractionSource } | null;
  billImageUrl: string | null;
  quotes: QuoteRecord[];
  rfqCount: number;
  emailCount: number;
  limits: { maxRfq: number; maxEmails: number };
  mode: 'mock' | 'aws';
  mailMode: 'ses' | 'file';
}

export interface InputsResponse {
  case: CaseRecord;
  plan: Plan | null;
  planError: PlanError | null;
  yield: YieldData | null;
}

export interface RfqResponse {
  results: { to: string; status: 'sent' | 'failed'; code?: string; hint?: string; id?: string }[];
  mode: 'ses' | 'file';
  subject: string;
  text: string;
}

export interface ShareResponse {
  ref: string;
  createdAt: string;
  bill: { discom: string; tariffCategory: string; consumerNumber: string; unitsMonth: number; amountMonth: number; sanctionedLoadKw: number | null };
  roofAreaM2: number | null;
  plan: Plan;
}

export const api = {
  health: () => request<{ ok: boolean; mode: 'mock' | 'aws'; mail: 'ses' | 'file' }>('GET', '/health'),
  createCase: () => request<{ caseId: string; shareId: string; ref: string }>('POST', '/cases'),
  getCase: (id: string) => request<CaseResponse>('GET', `/cases/${id}`),
  getShare: (shareId: string) => request<ShareResponse>('GET', `/share/${shareId}`),
  putInputs: (id: string, body: { bill?: BillInput; roof?: RoofInput | null; selectedKw?: number | null; assumptions?: Partial<Assumptions> }) =>
    request<InputsResponse>('PUT', `/cases/${id}/inputs`, body),
  presign: (caseId: string, kind: 'bill' | 'quote', contentType: string, fileSize: number) =>
    request<{ key: string; uploadUrl: string; headers: Record<string, string> }>('POST', '/uploads/presign', { caseId, kind, contentType, fileSize }),
  extractBill: (id: string, key: string) =>
    request<{ fields: BillFields; source: ExtractionSource; imageUrl: string }>('POST', `/cases/${id}/extract-bill`, { key }),
  checkQuote: (id: string, key: string) => request<QuoteRecord>('POST', `/cases/${id}/quotes/check`, { key }),
  editQuote: (id: string, qid: string, body: { totalPrice: number | null; systemKw: number | null }) =>
    request<QuoteRecord>('PUT', `/cases/${id}/quotes/${qid}`, body),
  packPresign: (id: string) => request<{ uploadUrl: string; headers: Record<string, string> }>('POST', `/cases/${id}/pack/presign`),
  packComplete: (id: string) => request<{ ok: boolean; packAt: string }>('POST', `/cases/${id}/pack/complete`),
  email: (id: string, to: string) => request<{ status: string; mode: 'ses' | 'file' }>('POST', `/cases/${id}/email`, { to }),
  rfq: (
    id: string,
    body: { recipients: string[]; contactName: string; contactEmail: string; contactPhone?: string; location?: string; note?: string; consent: true }
  ) => request<RfqResponse>('POST', `/cases/${id}/rfq`, body),
  deleteCase: (id: string) => request<{ ok: boolean }>('DELETE', `/cases/${id}`)
};

/** Uploads a file through a presigned URL (S3 in the cloud, the local API in mock mode). Returns the object key. */
export async function uploadFile(caseId: string, kind: 'bill' | 'quote', blob: Blob, contentType: string): Promise<string> {
  const pre = await api.presign(caseId, kind, contentType, blob.size);
  const url = await resolveUrl(pre.uploadUrl);
  let res: Response;
  try {
    res = await fetch(url, { method: 'PUT', headers: pre.headers, body: blob });
  } catch {
    throw new ApiClientError(0, 'NETWORK', 'The upload did not finish.', 'Check your internet connection and try again.');
  }
  if (!res.ok) throw new ApiClientError(res.status, 'UPLOAD_FAILED', 'The upload did not finish.', 'Please try again.');
  return pre.key;
}

export async function uploadPack(caseId: string, pdf: Blob): Promise<void> {
  const pre = await api.packPresign(caseId);
  const res = await fetch(await resolveUrl(pre.uploadUrl), { method: 'PUT', headers: pre.headers, body: pdf });
  if (!res.ok) throw new ApiClientError(res.status, 'UPLOAD_FAILED', 'The application pack could not be saved.', 'Please try again.');
  await api.packComplete(caseId);
}

export const friendlyError = (e: unknown): { message: string; hint?: string; code: string } =>
  e instanceof ApiClientError
    ? { message: e.message, hint: e.hint, code: e.code }
    : { message: 'Something went wrong.', hint: 'Please try again.', code: 'UNKNOWN' };
