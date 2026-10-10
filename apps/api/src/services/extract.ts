import {
  cleanText,
  parseIndianNumber,
  parseLoadKw,
  type BillFields,
  type FieldValue,
  type QuoteFields
} from '@chhatready/engine';

export interface BBox {
  left: number;
  top: number;
  width: number;
  height: number;
}
export interface RawText {
  text: string;
  /** 0 to 1 */
  confidence: number;
  bbox?: BBox;
}
export interface RawKv {
  key: string;
  value: string;
  confidence: number;
  bbox?: BBox;
}
export interface RawDoc {
  lines: RawText[];
  kv: RawKv[];
  queries: Record<string, RawText | undefined>;
}

export const BILL_QUERIES = [
  { alias: 'consumerNumber', text: 'What is the consumer number or account number?' },
  { alias: 'unitsMonth', text: 'What are the total units consumed in kWh?' },
  { alias: 'amountMonth', text: 'What is the net amount payable?' },
  { alias: 'sanctionedLoadKw', text: 'What is the sanctioned load or contract demand?' },
  { alias: 'billingPeriod', text: 'What is the billing period?' },
  { alias: 'tariffCategory', text: 'What is the tariff category?' },
  { alias: 'discom', text: 'What is the name of the electricity distribution company?' }
] as const;

export const QUOTE_QUERIES = [
  { alias: 'totalPrice', text: 'What is the total price or grand total amount?' },
  { alias: 'systemKw', text: 'What is the solar system capacity in kW?' },
  { alias: 'panels', text: 'What are the solar panel make, wattage and quantity?' },
  { alias: 'inverter', text: 'What is the inverter make and capacity?' },
  { alias: 'warranty', text: 'What is the warranty?' }
] as const;

const EMPTY: FieldValue = { value: null, confidence: 0 };

function fromQuery(raw: RawDoc, alias: string): RawText | null {
  const q = raw.queries[alias];
  return q && q.text.trim() ? q : null;
}

function fromKv(raw: RawDoc, keyRe: RegExp): RawText | null {
  const hits = raw.kv.filter((k) => keyRe.test(k.key) && k.value.trim());
  hits.sort((a, b) => b.confidence - a.confidence);
  const h = hits[0];
  return h ? { text: h.value, confidence: h.confidence, bbox: h.bbox } : null;
}

/** Finds `labelRe` on a line; takes the value on the same line after the label, else on the next line. */
function fromLines(raw: RawDoc, labelRe: RegExp, valueRe: RegExp): RawText | null {
  for (let i = 0; i < raw.lines.length; i++) {
    const line = raw.lines[i];
    const m = line.text.match(labelRe);
    if (!m) continue;
    const rest = line.text.slice((m.index ?? 0) + m[0].length);
    const same = rest.match(valueRe);
    if (same) return { text: same[0], confidence: line.confidence * 0.8, bbox: line.bbox };
    const next = raw.lines[i + 1];
    const nx = next?.text.match(valueRe);
    if (next && nx) return { text: nx[0], confidence: Math.min(line.confidence, next.confidence) * 0.7, bbox: next.bbox };
  }
  return null;
}

function numberField(hit: { text: string; confidence: number; bbox?: BBox } | null, parse: (s: string) => number | null): FieldValue {
  if (!hit) return { ...EMPTY };
  const n = parse(hit.text);
  if (n === null) return { value: null, confidence: 0, bbox: hit.bbox };
  return { value: n, confidence: hit.confidence, bbox: hit.bbox };
}

function textField(hit: { text: string; confidence: number; bbox?: BBox } | null, max = 100): FieldValue {
  if (!hit) return { ...EMPTY };
  const t = cleanText(hit.text, max);
  return t ? { value: t, confidence: hit.confidence, bbox: hit.bbox } : { ...EMPTY };
}

const NUM = /\d[\d,]*(?:\.\d+)?/;
const MONEY = /(?:₹|rs\.?|inr)?\s*\d[\d,]*(?:\.\d+)?/i;

export function billFromRaw(raw: RawDoc): BillFields {
  const consumerNumber = (() => {
    const q = fromQuery(raw, 'consumerNumber');
    if (q) {
      const id = q.text.match(/(?=[A-Za-z0-9\-/]*\d)[A-Za-z0-9][A-Za-z0-9\-/]{5,}/);
      if (id) return { value: id[0], confidence: q.confidence, bbox: q.bbox } as FieldValue;
    }
    const kv = fromKv(raw, /consumer|account|k\.?\s*no|\bca\b|connection/i);
    if (kv) {
      const id = kv.text.match(/(?=[A-Za-z0-9\-/]*\d)[A-Za-z0-9][A-Za-z0-9\-/]{5,}/);
      if (id) return { value: id[0], confidence: kv.confidence, bbox: kv.bbox } as FieldValue;
    }
    const l = fromLines(raw, /(consumer|account|connection|k\.?)\s*(no\.?|number|id)\b\s*[:\-]?/i, /(?=[A-Za-z0-9\-/]*\d)[A-Za-z0-9][A-Za-z0-9\-/]{5,}/);
    return l ? ({ value: l.text, confidence: l.confidence, bbox: l.bbox } as FieldValue) : { ...EMPTY };
  })();

  const unitsMonth = numberField(
    fromQuery(raw, 'unitsMonth') ??
      fromKv(raw, /units?\s*consumed|consumption|total\s*units|energy\s*consumed|kwh/i) ??
      fromLines(raw, /(units?\s*consumed|total\s*units|energy\s*consumed|consumption)\s*[:\-]?/i, NUM),
    parseIndianNumber
  );

  const amountMonth = numberField(
    fromQuery(raw, 'amountMonth') ??
      fromKv(raw, /net\s*(amount\s*)?payable|amount\s*payable|total\s*(bill\s*)?amount|amount\s*due|payable/i) ??
      fromLines(raw, /(net\s*amount\s*payable|total\s*amount\s*payable|amount\s*payable|net\s*payable|total\s*bill\s*amount|amount\s*due)\s*[:\-]?/i, MONEY),
    parseIndianNumber
  );

  const sanctionedLoadKw = numberField(
    fromQuery(raw, 'sanctionedLoadKw') ??
      fromKv(raw, /sanction|contract\s*(demand|load)|connected\s*load/i) ??
      fromLines(raw, /(sanctioned\s*load|contract\s*(demand|load)|connected\s*load)\s*[:\-]?/i, /\d+(?:\.\d+)?\s*(kw|kva|hp)?/i),
    parseLoadKw
  );

  const billingPeriod = textField(
    fromQuery(raw, 'billingPeriod') ??
      fromKv(raw, /billing\s*period|bill\s*period|period/i) ??
      fromLines(raw, /(billing|bill)\s*period\s*[:\-]?/i, /.+/),
    60
  );

  const tariffCategory = textField(
    fromQuery(raw, 'tariffCategory') ??
      fromKv(raw, /tariff|category/i) ??
      fromLines(raw, /(tariff(\s*category)?|category)\s*[:\-]?/i, /.+/),
    60
  );

  const discom = (() => {
    const q = fromQuery(raw, 'discom');
    if (q) return textField(q, 100);
    const l = raw.lines.slice(0, 12).find((x) => /(power|electricity|vidyut|bijli|distribution|nigam|discom|board|company)/i.test(x.text));
    return l ? textField({ text: l.text, confidence: l.confidence * 0.7, bbox: l.bbox }, 100) : { ...EMPTY };
  })();

  return validateBill({ discom, consumerNumber, billingPeriod, tariffCategory, unitsMonth, amountMonth, sanctionedLoadKw });
}

/** Cross-checks extracted values and lowers confidence where they look wrong. The user still reviews everything. */
export function validateBill(f: BillFields): BillFields {
  const out = { ...f };
  const units = typeof f.unitsMonth.value === 'number' ? f.unitsMonth.value : null;
  const amount = typeof f.amountMonth.value === 'number' ? f.amountMonth.value : null;
  const cap = (fv: FieldValue, max: number): FieldValue => ({ ...fv, confidence: Math.min(fv.confidence, max) });

  if (units !== null && (units < 20 || units > 3000)) out.unitsMonth = cap(f.unitsMonth, 0.5);
  if (amount !== null && amount <= 0) out.amountMonth = { ...f.amountMonth, value: null, confidence: 0 };
  if (units !== null && amount !== null && amount > 0) {
    const rate = amount / units;
    if (rate < 2 || rate > 20) {
      out.unitsMonth = cap(out.unitsMonth, 0.5);
      out.amountMonth = cap(out.amountMonth, 0.5);
    }
  }
  const load = typeof f.sanctionedLoadKw.value === 'number' ? f.sanctionedLoadKw.value : null;
  if (load !== null && (load < 0.5 || load > 100)) out.sanctionedLoadKw = cap(f.sanctionedLoadKw, 0.5);
  return out;
}

export function quoteFromRaw(raw: RawDoc): { fields: QuoteFields; rawText: string } {
  const rawText = [...raw.lines.map((l) => l.text), ...raw.kv.map((k) => `${k.key} ${k.value}`)].join('\n').slice(0, 8000);

  const price = (() => {
    const hit =
      fromQuery(raw, 'totalPrice') ??
      fromKv(raw, /(grand\s*)?total|net\s*(price|amount)|price/i) ??
      fromLines(raw, /(total\s*price|grand\s*total|total\s*cost|total\s*amount|net\s*price|total)[^\d₹]*[:\-]?\s*/i, MONEY);
    return numberField(hit, parseIndianNumber);
  })();

  const kw = (() => {
    const q = fromQuery(raw, 'systemKw');
    const text = q?.text ?? raw.lines.find((l) => /\d+(\.\d+)?\s*k\s*w\s*p?\b/i.test(l.text))?.text ?? '';
    const bbox = q?.bbox ?? raw.lines.find((l) => l.text === text)?.bbox;
    const conf = q?.confidence ?? 0.6;
    const kwM = text.match(/(\d+(?:\.\d+)?)\s*k\s*w\s*p?\b/i);
    if (kwM) return { value: Number(kwM[1]), confidence: conf, bbox } as FieldValue;
    const wpM = text.match(/(\d{3,6})\s*wp\b/i);
    if (wpM) return { value: Number(wpM[1]) / 1000, confidence: conf * 0.8, bbox } as FieldValue;
    const n = parseIndianNumber(text);
    return n !== null && n > 0 && n <= 50 ? ({ value: n, confidence: conf * 0.6, bbox } as FieldValue) : { ...EMPTY };
  })();

  const panels = textField(
    fromQuery(raw, 'panels') ?? (() => {
      const l = raw.lines.find((x) => /panel|module|\bwp\b/i.test(x.text));
      return l ? { text: l.text.replace(/^[^:]*:\s*/, ''), confidence: l.confidence * 0.7, bbox: l.bbox } : null;
    })()
  );
  const inverter = textField(
    fromQuery(raw, 'inverter') ?? (() => {
      const l = raw.lines.find((x) => /inverter/i.test(x.text));
      return l ? { text: l.text.replace(/^[^:]*:\s*/, ''), confidence: l.confidence * 0.7, bbox: l.bbox } : null;
    })()
  );
  const warranty = textField(
    fromQuery(raw, 'warranty') ?? (() => {
      const l = raw.lines.find((x) => /warrant/i.test(x.text));
      return l ? { text: l.text.replace(/^[^:]*:\s*/, ''), confidence: l.confidence * 0.7, bbox: l.bbox } : null;
    })(),
    160
  );

  return { fields: { totalPrice: price, systemKw: kw, panels, inverter, warranty }, rawText };
}

/** Builds a RawDoc from a saved fixture. Used by mock mode and the sample-file fallback. */
export function rawFromFixture(fx: { fields: Record<string, { value: unknown; confidence: number; bbox?: BBox }>; lines: string[] }): RawDoc {
  return {
    lines: fx.lines.map((t) => ({ text: t, confidence: 0.98 })),
    kv: [],
    queries: Object.fromEntries(
      Object.entries(fx.fields).map(([k, v]) => [k, v.value === null ? undefined : { text: String(v.value), confidence: v.confidence, bbox: v.bbox }])
    )
  };
}
