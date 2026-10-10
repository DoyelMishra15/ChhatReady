import {
  AnalyzeDocumentCommand,
  DetectDocumentTextCommand,
  type Block,
  type TextractClient
} from '@aws-sdk/client-textract';
import type { BillFields, ExtractionSource, QuoteFields } from '@chhatready/engine';
import { ApiError } from '../errors';
import {
  BILL_QUERIES,
  QUOTE_QUERIES,
  billFromRaw,
  quoteFromRaw,
  rawFromFixture,
  type BBox,
  type RawDoc
} from './extract';
import billFixture from '../../../../demo/fixtures/sample-bill.extract.json';
import quoteFixture from '../../../../demo/fixtures/sample-quote.extract.json';
import sampleHashes from '../../../../demo/fixtures/sample-hashes.json';

export interface BillExtraction {
  fields: BillFields;
  source: ExtractionSource;
}
export interface QuoteExtraction {
  fields: QuoteFields;
  rawText: string;
  source: ExtractionSource;
}

export interface Extractor {
  extractBill(bytes: Uint8Array, sha256: string): Promise<BillExtraction>;
  extractQuote(bytes: Uint8Array, sha256: string): Promise<QuoteExtraction>;
}

const isSampleBill = (sha: string) => sha === sampleHashes.bill;
const isSampleQuote = (sha: string) => sha === sampleHashes.quote;

const billFx = () => billFixture as unknown as Parameters<typeof rawFromFixture>[0];
const quoteFx = () => quoteFixture as unknown as Parameters<typeof rawFromFixture>[0];

/** Mock mode: always returns the saved sample extraction. The UI labels this clearly. */
export class MockExtractor implements Extractor {
  async extractBill(): Promise<BillExtraction> {
    return { fields: billFromRaw(rawFromFixture(billFx())), source: 'mock' };
  }
  async extractQuote(): Promise<QuoteExtraction> {
    return { ...quoteFromRaw(rawFromFixture(quoteFx())), source: 'mock' };
  }
}

const box = (b?: Block['Geometry']): BBox | undefined => {
  const bb = b?.BoundingBox;
  return bb && bb.Left !== undefined ? { left: bb.Left, top: bb.Top ?? 0, width: bb.Width ?? 0, height: bb.Height ?? 0 } : undefined;
};

export function blocksToRaw(blocks: Block[]): RawDoc {
  const byId = new Map(blocks.map((b) => [b.Id!, b]));
  const wordsOf = (b: Block | undefined): string => {
    if (!b) return '';
    const parts: string[] = [];
    for (const rel of b.Relationships ?? []) {
      if (rel.Type !== 'CHILD') continue;
      for (const id of rel.Ids ?? []) {
        const c = byId.get(id);
        if (c?.BlockType === 'WORD' && c.Text) parts.push(c.Text);
      }
    }
    return parts.join(' ');
  };

  const lines = blocks
    .filter((b) => b.BlockType === 'LINE' && b.Text)
    .map((b) => ({ text: b.Text!, confidence: (b.Confidence ?? 0) / 100, bbox: box(b.Geometry) }));

  const kv = blocks
    .filter((b) => b.BlockType === 'KEY_VALUE_SET' && b.EntityTypes?.includes('KEY'))
    .map((k) => {
      const valueId = k.Relationships?.find((r) => r.Type === 'VALUE')?.Ids?.[0];
      const v = valueId ? byId.get(valueId) : undefined;
      return {
        key: wordsOf(k),
        value: wordsOf(v),
        confidence: Math.min(k.Confidence ?? 0, v?.Confidence ?? 0) / 100,
        bbox: box(v?.Geometry)
      };
    })
    .filter((x) => x.key && x.value);

  const queries: RawDoc['queries'] = {};
  for (const q of blocks.filter((b) => b.BlockType === 'QUERY')) {
    const alias = q.Query?.Alias;
    const ansIds = q.Relationships?.find((r) => r.Type === 'ANSWER')?.Ids ?? [];
    const answers = ansIds
      .map((id) => byId.get(id))
      .filter((a): a is Block => !!a && a.BlockType === 'QUERY_RESULT' && !!a.Text)
      .sort((a, b) => (b.Confidence ?? 0) - (a.Confidence ?? 0));
    if (alias && answers[0]) {
      queries[alias] = { text: answers[0].Text!, confidence: (answers[0].Confidence ?? 0) / 100, bbox: box(answers[0].Geometry) };
    }
  }
  return { lines, kv, queries };
}

const UNSUPPORTED = new Set(['UnsupportedDocumentException', 'BadDocumentException', 'DocumentTooLargeException', 'InvalidParameterException']);

export class TextractExtractor implements Extractor {
  constructor(private tx: TextractClient) {}

  private async analyze(bytes: Uint8Array, queries: readonly { alias: string; text: string }[]): Promise<{ raw: RawDoc; source: ExtractionSource }> {
    const signal = () => AbortSignal.timeout(20_000);
    try {
      const r = await this.tx.send(
        new AnalyzeDocumentCommand({
          Document: { Bytes: bytes },
          FeatureTypes: ['QUERIES', 'FORMS'],
          QueriesConfig: { Queries: queries.map((q) => ({ Text: q.text, Alias: q.alias })) }
        }),
        { abortSignal: signal() }
      );
      return { raw: blocksToRaw(r.Blocks ?? []), source: 'textract' };
    } catch (first) {
      // Queries may be unavailable or rejected. Fall back to plain line detection.
      try {
        const r = await this.tx.send(new DetectDocumentTextCommand({ Document: { Bytes: bytes } }), { abortSignal: signal() });
        return { raw: blocksToRaw(r.Blocks ?? []), source: 'textract-lines' };
      } catch (second) {
        const name = (second as { name?: string }).name ?? '';
        const firstName = (first as { name?: string }).name ?? '';
        if (UNSUPPORTED.has(name) && UNSUPPORTED.has(firstName))
          throw new ApiError(
            422,
            'UNSUPPORTED_FILE',
            'We could not read that file.',
            'Use a clear photo (JPG or PNG) or a one-page PDF. Multi-page PDFs are not supported yet.'
          );
        throw new ApiError(502, 'EXTRACTION_UNAVAILABLE', 'Automatic reading is unavailable right now.', 'You can enter the details manually.');
      }
    }
  }

  async extractBill(bytes: Uint8Array): Promise<BillExtraction> {
    const { raw, source } = await this.analyze(bytes, BILL_QUERIES);
    return { fields: billFromRaw(raw), source };
  }

  async extractQuote(bytes: Uint8Array): Promise<QuoteExtraction> {
    const { raw, source } = await this.analyze(bytes, QUOTE_QUERIES);
    return { ...quoteFromRaw(raw), source };
  }
}

/** If Textract is down, the bundled SAMPLE files still work using their saved extraction, clearly labelled. */
export class SampleFallbackExtractor implements Extractor {
  constructor(private inner: Extractor) {}

  async extractBill(bytes: Uint8Array, sha: string): Promise<BillExtraction> {
    try {
      return await this.inner.extractBill(bytes, sha);
    } catch (e) {
      if (e instanceof ApiError && e.status >= 500 && isSampleBill(sha))
        return { fields: billFromRaw(rawFromFixture(billFx())), source: 'fixture' };
      throw e;
    }
  }

  async extractQuote(bytes: Uint8Array, sha: string): Promise<QuoteExtraction> {
    try {
      return await this.inner.extractQuote(bytes, sha);
    } catch (e) {
      if (e instanceof ApiError && e.status >= 500 && isSampleQuote(sha))
        return { ...quoteFromRaw(rawFromFixture(quoteFx())), source: 'fixture' };
      throw e;
    }
  }
}
