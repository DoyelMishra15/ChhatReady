import type {
  Assumptions,
  BillFields,
  BillInput,
  ExtractionSource,
  Plan,
  QuoteFields,
  QuoteFlag,
  QuoteVerdict,
  RoofInput
} from '@chhatready/engine';
import type { Config } from './config';
import type { Blobs } from './services/blobs';
import type { Extractor } from './services/textract';
import type { Log, MetricsLike } from './services/logger';
import type { Mailer } from './services/mailer';
import type { Store } from './services/store';
import type { YieldService } from './services/yields';

export interface Deps {
  cfg: Config;
  store: Store;
  blobs: Blobs;
  extractor: Extractor;
  mailer: Mailer;
  yields: YieldService;
  log: Log;
  metrics: MetricsLike;
  now: () => Date;
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

export interface BillExtractRecord {
  key: string;
  fields: BillFields;
  source: ExtractionSource;
  sha256: string;
  createdAt: string;
}

export interface QuoteRecord {
  qid: string;
  key: string;
  fields: QuoteFields;
  source: ExtractionSource;
  rawText: string;
  totalPrice: number | null;
  systemKw: number | null;
  verdict: QuoteVerdict;
  flags: QuoteFlag[];
  questions: string[];
  createdAt: string;
}

export const casePk = (id: string) => `CASE#${id}`;
