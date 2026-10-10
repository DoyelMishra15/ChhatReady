import { describe, expect, it } from 'vitest';
import { billFromRaw, quoteFromRaw, validateBill, type RawDoc } from '../src/services/extract';
import { blocksToRaw } from '../src/services/textract';
import { buildMime } from '../src/services/mime';
import { fetchPvgis } from '../src/services/yields';

const line = (text: string, confidence = 0.96) => ({ text, confidence });

describe('billFromRaw: query answers', () => {
  it('normalises Indian number formats and carries confidence', () => {
    const raw: RawDoc = {
      lines: [],
      kv: [],
      queries: {
        consumerNumber: { text: 'Consumer No: 4821093755', confidence: 0.99 },
        unitsMonth: { text: '285 kWh', confidence: 0.98 },
        amountMonth: { text: '₹ 2,412.60', confidence: 0.97 },
        sanctionedLoadKw: { text: '4.0 kW', confidence: 0.7 },
        billingPeriod: { text: 'Monthly', confidence: 0.9 },
        tariffCategory: { text: 'LT Domestic', confidence: 0.9 },
        discom: { text: 'Sample Power Distribution Co. Ltd.', confidence: 0.95 }
      }
    };
    const f = billFromRaw(raw);
    expect(f.unitsMonth.value).toBe(285);
    expect(f.amountMonth.value).toBe(2412.6);
    expect(f.sanctionedLoadKw).toMatchObject({ value: 4, confidence: 0.7 });
    expect(f.consumerNumber.value).toBe('4821093755');
  });
});

describe('billFromRaw: line fallback (no queries)', () => {
  it('finds values on the same line and on the next line', () => {
    const raw: RawDoc = {
      queries: {},
      kv: [],
      lines: [
        line('Sample Power Distribution Co. Ltd.'),
        line('Consumer Number'),
        line('4821093755'),
        line('Sanctioned Load 5 HP'),
        line('Units Consumed 312 kWh'),
        line('Net Amount Payable ₹ 2,684.30')
      ]
    };
    const f = billFromRaw(raw);
    expect(f.consumerNumber.value).toBe('4821093755');
    expect(f.sanctionedLoadKw.value).toBeCloseTo(3.73, 2);
    expect(f.unitsMonth.value).toBe(312);
    expect(f.amountMonth.value).toBe(2684.3);
    expect(f.discom.value).toBe('Sample Power Distribution Co. Ltd.');
    expect(f.unitsMonth.confidence).toBeLessThan(0.9); // fallback is less certain than a query answer
  });

  it('returns empty fields rather than guessing', () => {
    const f = billFromRaw({ queries: {}, kv: [], lines: [line('hello world')] });
    expect(f.unitsMonth.value).toBeNull();
    expect(f.amountMonth.value).toBeNull();
  });
});

describe('validateBill', () => {
  it('lowers confidence when the implied rate is implausible', () => {
    const base = billFromRaw({ queries: { unitsMonth: { text: '10767', confidence: 0.98 }, amountMonth: { text: '2412.60', confidence: 0.97 } }, kv: [], lines: [] });
    expect(base.unitsMonth.confidence).toBeLessThanOrEqual(0.5);
    expect(base.amountMonth.confidence).toBeLessThanOrEqual(0.5);
  });
  it('keeps confidence for plausible values', () => {
    const f = validateBill(billFromRaw({ queries: { unitsMonth: { text: '285', confidence: 0.98 }, amountMonth: { text: '2412.60', confidence: 0.97 } }, kv: [], lines: [] }));
    expect(f.unitsMonth.confidence).toBe(0.98);
  });
});

describe('quoteFromRaw', () => {
  it('reads price, kW and keeps all text for keyword checks', () => {
    const raw: RawDoc = {
      queries: {},
      kv: [],
      lines: [line('3 kW On-grid Rooftop Solar System'), line('Solar panels: 540 Wp Mono PERC x 6 nos.'), line('Warranty: Panels 25 years'), line('Total price (inclusive of GST) ₹ 2,25,000')]
    };
    const { fields, rawText } = quoteFromRaw(raw);
    expect(fields.systemKw.value).toBe(3);
    expect(fields.totalPrice.value).toBe(225000);
    expect(fields.warranty.value).toMatch(/25 years/);
    expect(rawText).toContain('inclusive of GST');
  });
  it('converts Wp to kW when only Wp is given', () => {
    const { fields } = quoteFromRaw({ queries: { systemKw: { text: '3240 Wp', confidence: 0.9 } }, kv: [], lines: [] });
    expect(fields.systemKw.value).toBeCloseTo(3.24, 5);
  });
});

describe('blocksToRaw (Textract response shape)', () => {
  it('maps queries, key-values and lines with normalised boxes', () => {
    const raw = blocksToRaw([
      { Id: 'l1', BlockType: 'LINE', Text: 'Units Consumed 285', Confidence: 99, Geometry: { BoundingBox: { Left: 0.1, Top: 0.2, Width: 0.3, Height: 0.05 } } },
      { Id: 'w1', BlockType: 'WORD', Text: 'Units' },
      { Id: 'w2', BlockType: 'WORD', Text: '285' },
      { Id: 'k1', BlockType: 'KEY_VALUE_SET', EntityTypes: ['KEY'], Confidence: 90, Relationships: [{ Type: 'CHILD', Ids: ['w1'] }, { Type: 'VALUE', Ids: ['v1'] }] },
      { Id: 'v1', BlockType: 'KEY_VALUE_SET', EntityTypes: ['VALUE'], Confidence: 80, Relationships: [{ Type: 'CHILD', Ids: ['w2'] }] },
      { Id: 'q1', BlockType: 'QUERY', Query: { Text: 'q', Alias: 'unitsMonth' }, Relationships: [{ Type: 'ANSWER', Ids: ['a1', 'a2'] }] },
      { Id: 'a1', BlockType: 'QUERY_RESULT', Text: '284', Confidence: 60 },
      { Id: 'a2', BlockType: 'QUERY_RESULT', Text: '285', Confidence: 97.5, Geometry: { BoundingBox: { Left: 0.5, Top: 0.5, Width: 0.1, Height: 0.02 } } }
    ] as never);
    expect(raw.lines[0]).toMatchObject({ text: 'Units Consumed 285', confidence: 0.99 });
    expect(raw.kv[0]).toMatchObject({ key: 'Units', value: '285', confidence: 0.8 });
    expect(raw.queries.unitsMonth).toMatchObject({ text: '285', confidence: 0.975 });
    expect(raw.queries.unitsMonth?.bbox?.left).toBe(0.5);
  });
});

describe('buildMime', () => {
  it('strips CR/LF from headers so values cannot inject headers', () => {
    const m = buildMime({ from: 'a@b.in', to: 'x@y.in\r\nBcc: evil@z.in', subject: 'Hi\r\nBcc: evil@z.in', text: 'hello ₹' });
    expect(m).not.toMatch(/^Bcc:/m);
    expect(m.split('\r\n').filter((l) => /^to:/i.test(l))).toHaveLength(1);
  });
  it('encodes non-ASCII subjects and bodies and attaches files', () => {
    const m = buildMime({ from: 'a@b.in', to: 'x@y.in', subject: 'Plan ₹', text: 'नमस्ते', attachment: { filename: '../bad name.pdf', contentType: 'application/pdf', bytes: new Uint8Array([37, 80, 68, 70]) } });
    expect(m).toContain('Subject: =?UTF-8?B?');
    expect(m).toContain('filename=".._bad_name.pdf"');
    expect(m).toContain('JVBERg=='); // base64 of %PDF
  });
});

describe('fetchPvgis', () => {
  const ok = (body: unknown) => (async () => ({ ok: true, json: async () => body })) as unknown as typeof fetch;
  it('parses a PVGIS PVcalc response', async () => {
    const y = await fetchPvgis('http://x', 26.9, 75.8, ok({ outputs: { totals: { fixed: { E_y: 1612.4 } }, monthly: { fixed: Array.from({ length: 12 }, (_, i) => ({ E_m: 100 + i })) } } }));
    expect(y).toMatchObject({ yieldPerKw: 1612, source: 'pvgis' });
    expect(y?.monthly).toHaveLength(12);
  });
  it('returns null for bad data, HTTP errors and network failures', async () => {
    expect(await fetchPvgis('http://x', 1, 1, ok({ outputs: {} }))).toBeNull();
    expect(await fetchPvgis('http://x', 1, 1, (async () => ({ ok: false })) as unknown as typeof fetch)).toBeNull();
    expect(await fetchPvgis('http://x', 1, 1, (async () => { throw new Error('net'); }) as unknown as typeof fetch)).toBeNull();
  });
});
