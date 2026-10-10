import { Hono } from 'hono';
import { checkQuote, quoteCheckRequestSchema, quoteEditSchema, type QuoteFields } from '@chhatready/engine';
import { ApiError, notFound } from '../errors';
import { detectFileType } from '../services/blobs';
import { loadCase, ttlSeconds } from '../services/cases';
import { newShort, parseBody, sha256 } from '../services/util';
import { casePk, type Deps, type QuoteRecord } from '../types';

const strip = (q: QuoteRecord & { pk?: string; sk?: string; ttl?: number }) => {
  const { pk: _pk, sk: _sk, ttl: _ttl, ...rest } = q;
  return rest;
};

export function quoteRoutes(d: Deps) {
  const r = new Hono();

  r.post('/cases/:id/quotes/check', async (c) => {
    const rec = await loadCase(d, c.req.param('id'));
    const { key } = await parseBody(c, quoteCheckRequestSchema);
    if (!key.startsWith(`uploads/${rec.caseId}/quote-`)) throw new ApiError(400, 'BAD_KEY', 'That file does not belong to this case.');
    const bytes = await d.blobs.getBytes(key, d.cfg.maxUploadBytes);
    if (!bytes) throw new ApiError(404, 'UPLOAD_NOT_FOUND', 'We could not find your upload.', 'Please upload the file again.');
    if (!detectFileType(bytes))
      throw new ApiError(422, 'UNSUPPORTED_FILE', 'That does not look like a photo or PDF.', 'Use a JPG or PNG photo, or a one-page PDF.');

    const hash = sha256(bytes);
    const cached = await d.store.get<{ fields: QuoteFields; rawText: string; source: QuoteRecord['source'] }>(`CACHE#TEXTRACT#${hash}`, 'quote');
    let ex: { fields: QuoteFields; rawText: string; source: QuoteRecord['source'] };
    if (cached) ex = cached;
    else {
      ex = await d.extractor.extractQuote(bytes, hash);
      if (ex.source === 'textract' || ex.source === 'textract-lines') await d.store.put(`CACHE#TEXTRACT#${hash}`, 'quote', ex, 30 * 86400);
    }

    const totalPrice = typeof ex.fields.totalPrice.value === 'number' ? ex.fields.totalPrice.value : null;
    const systemKw = typeof ex.fields.systemKw.value === 'number' ? ex.fields.systemKw.value : null;
    const result = checkQuote({ totalPrice, systemKw, rawText: ex.rawText, plannedKw: rec.plan?.kw ?? null });
    const qid = newShort();
    const record: QuoteRecord = {
      qid,
      key,
      fields: ex.fields,
      source: ex.source,
      rawText: ex.rawText,
      totalPrice,
      systemKw,
      verdict: result.verdict,
      flags: result.flags,
      questions: result.questions,
      createdAt: d.now().toISOString()
    };
    await d.store.put(casePk(rec.caseId), `QUOTE#${qid}`, record, ttlSeconds(d));
    d.metrics.count('QuoteChecked');
    return c.json({ ...record, imageUrl: await d.blobs.presignGet(key) });
  });

  // The user corrects what OCR got wrong, and the verdict is recomputed deterministically.
  r.put('/cases/:id/quotes/:qid', async (c) => {
    const rec = await loadCase(d, c.req.param('id'));
    const body = await parseBody(c, quoteEditSchema);
    const existing = await d.store.get<QuoteRecord>(casePk(rec.caseId), `QUOTE#${c.req.param('qid')}`);
    if (!existing) throw notFound('Quote');
    const result = checkQuote({ totalPrice: body.totalPrice, systemKw: body.systemKw, rawText: existing.rawText, plannedKw: rec.plan?.kw ?? null });
    const record: QuoteRecord = { ...strip(existing), totalPrice: body.totalPrice, systemKw: body.systemKw, verdict: result.verdict, flags: result.flags, questions: result.questions };
    await d.store.put(casePk(rec.caseId), `QUOTE#${record.qid}`, record, ttlSeconds(d));
    return c.json({ ...record, imageUrl: await d.blobs.presignGet(record.key) });
  });

  return r;
}
