import { Hono } from 'hono';
import {
  extractRequestSchema,
  inputsUpdateSchema,
  presignRequestSchema,
  type BillFields
} from '@chhatready/engine';
import { ApiError, notFound } from '../errors';
import { detectFileType } from '../services/blobs';
import { loadCase, maskConsumer, recompute, saveCase, ttlSeconds } from '../services/cases';
import { newId, newShort, parseBody, sha256 } from '../services/util';
import { casePk, type BillExtractRecord, type CaseRecord, type Deps, type QuoteRecord } from '../types';

const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'application/pdf': 'pdf' } as const;
const strip = <T extends object>(o: T): Omit<T, 'pk' | 'sk' | 'ttl'> => {
  const { pk: _pk, sk: _sk, ttl: _ttl, ...rest } = o as T & { pk?: unknown; sk?: unknown; ttl?: unknown };
  return rest as Omit<T, 'pk' | 'sk' | 'ttl'>;
};

export function caseRoutes(d: Deps) {
  const r = new Hono();

  r.post('/cases', async (c) => {
    const now = d.now().toISOString();
    const caseId = newId();
    const rec: CaseRecord = {
      caseId,
      shareId: newId(),
      ref: `CR-${caseId.slice(0, 6).toUpperCase()}`,
      createdAt: now,
      updatedAt: now,
      status: 'draft',
      bill: null,
      roof: null,
      selectedKw: null,
      assumptions: {},
      plan: null,
      packKey: null,
      packAt: null
    };
    await saveCase(d, rec);
    return c.json({ caseId: rec.caseId, shareId: rec.shareId, ref: rec.ref }, 201);
  });

  r.post('/uploads/presign', async (c) => {
    const body = await parseBody(c, presignRequestSchema);
    if (body.fileSize && body.fileSize > d.cfg.maxUploadBytes)
      throw new ApiError(413, 'FILE_TOO_LARGE', 'That file is larger than 8 MB.', 'Upload a smaller photo or a one-page PDF.');
    await loadCase(d, body.caseId);
    const key = `uploads/${body.caseId}/${body.kind}-${newShort()}.${EXT[body.contentType]}`;
    const put = await d.blobs.presignPut(key, body.contentType);
    return c.json({ key, uploadUrl: put.url, headers: put.headers, method: 'PUT', maxBytes: d.cfg.maxUploadBytes });
  });

  r.post('/cases/:id/extract-bill', async (c) => {
    const rec = await loadCase(d, c.req.param('id'));
    const { key } = await parseBody(c, extractRequestSchema);
    if (!key.startsWith(`uploads/${rec.caseId}/bill-`)) throw new ApiError(400, 'BAD_KEY', 'That file does not belong to this case.');
    const bytes = await d.blobs.getBytes(key, d.cfg.maxUploadBytes);
    if (!bytes) throw new ApiError(404, 'UPLOAD_NOT_FOUND', 'We could not find your upload.', 'Please upload the file again.');
    if (!detectFileType(bytes))
      throw new ApiError(422, 'UNSUPPORTED_FILE', 'That does not look like a photo or PDF.', 'Use a JPG or PNG photo, or a one-page PDF.');

    const hash = sha256(bytes);
    const cached = await d.store.get<{ fields: BillFields; source: BillExtractRecord['source'] }>(`CACHE#TEXTRACT#${hash}`, 'bill');
    let fields: BillFields;
    let source: BillExtractRecord['source'];
    if (cached) {
      fields = cached.fields;
      source = cached.source;
    } else {
      const ex = await d.extractor.extractBill(bytes, hash);
      fields = ex.fields;
      source = ex.source;
      if (source === 'textract' || source === 'textract-lines')
        await d.store.put(`CACHE#TEXTRACT#${hash}`, 'bill', { fields, source }, 30 * 86400);
      d.metrics.count(source === 'textract' || source === 'textract-lines' ? 'ExtractionSuccess' : 'ExtractionFallback');
    }
    const record: BillExtractRecord = { key, fields, source, sha256: hash, createdAt: d.now().toISOString() };
    await d.store.put(casePk(rec.caseId), 'EXTRACT#bill', record, ttlSeconds(d));
    d.log.info('bill extracted', { caseId: rec.caseId, source });
    return c.json({ fields, source, imageUrl: await d.blobs.presignGet(key) });
  });

  r.put('/cases/:id/inputs', async (c) => {
    const rec = await loadCase(d, c.req.param('id'));
    const body = await parseBody(c, inputsUpdateSchema);
    if (body.bill !== undefined) rec.bill = body.bill;
    if (body.roof !== undefined) rec.roof = body.roof;
    if (body.selectedKw !== undefined) rec.selectedKw = body.selectedKw;
    if (body.assumptions !== undefined) rec.assumptions = body.assumptions;
    const { plan, planError, yieldData } = await recompute(d, rec);
    await saveCase(d, rec);
    return c.json({ case: rec, plan, planError, yield: yieldData });
  });

  r.get('/cases/:id', async (c) => {
    const rec = await loadCase(d, c.req.param('id'));
    const items = await d.store.query(casePk(rec.caseId));
    const extract = items.find((i) => i.sk === 'EXTRACT#bill') as (BillExtractRecord & { sk: string }) | undefined;
    const quotes = items.filter((i) => i.sk.startsWith('QUOTE#')).map((i) => strip(i as unknown as QuoteRecord));
    const rfqs = items.filter((i) => i.sk.startsWith('RFQ#')).map((i) => ({ sk: i.sk, at: (i as { sentAt?: string }).sentAt, count: ((i as { results?: unknown[] }).results ?? []).length }));
    const emails = items.filter((i) => i.sk.startsWith('EMAIL#')).length;
    const yieldData = rec.roof ? await d.yields.get(rec.roof.lat, rec.roof.lon) : null;
    return c.json({
      case: rec,
      yield: yieldData,
      billExtraction: extract ? { fields: extract.fields, source: extract.source } : null,
      billImageUrl: extract ? await d.blobs.presignGet(extract.key) : null,
      quotes,
      rfqCount: rfqs.length,
      emailCount: emails,
      limits: { maxRfq: d.cfg.maxRfqPerCase, maxEmails: d.cfg.maxEmailsPerCase },
      mode: d.cfg.mock ? 'mock' : 'aws',
      mailMode: d.mailer.mode
    });
  });

  // Read-only share view. Hides the consumer number, exact location and the application pack.
  r.get('/share/:shareId', async (c) => {
    const ptr = await d.store.get<{ caseId: string }>(`SHARE#${c.req.param('shareId')}`, 'META');
    if (!ptr) throw notFound('Shared plan');
    const rec = await loadCase(d, ptr.caseId);
    if (!rec.plan || !rec.bill) throw notFound('Shared plan');
    return c.json({
      ref: rec.ref,
      createdAt: rec.createdAt,
      bill: {
        discom: rec.bill.discom,
        tariffCategory: rec.bill.tariffCategory,
        consumerNumber: maskConsumer(rec.bill.consumerNumber),
        unitsMonth: rec.bill.unitsMonth,
        amountMonth: rec.bill.amountMonth,
        sanctionedLoadKw: rec.bill.sanctionedLoadKw
      },
      roofAreaM2: rec.roof ? Math.round(rec.roof.areaM2 * (1 - rec.roof.obstructionPct / 100)) : null,
      plan: rec.plan
    });
  });

  r.post('/cases/:id/pack/presign', async (c) => {
    const rec = await loadCase(d, c.req.param('id'));
    const key = `packs/${rec.caseId}/chhatready-pack.pdf`;
    const put = await d.blobs.presignPut(key, 'application/pdf');
    return c.json({ key, uploadUrl: put.url, headers: put.headers, method: 'PUT' });
  });

  r.post('/cases/:id/pack/complete', async (c) => {
    const rec = await loadCase(d, c.req.param('id'));
    const key = `packs/${rec.caseId}/chhatready-pack.pdf`;
    const bytes = await d.blobs.getBytes(key, 4 * 1024 * 1024);
    if (!bytes || detectFileType(bytes) !== 'pdf')
      throw new ApiError(422, 'PACK_INVALID', 'The application pack was not saved correctly.', 'Please generate it again.');
    rec.packKey = key;
    rec.packAt = d.now().toISOString();
    rec.status = 'packed';
    await saveCase(d, rec);
    return c.json({ ok: true, packAt: rec.packAt });
  });

  r.get('/cases/:id/pack', async (c) => {
    const rec = await loadCase(d, c.req.param('id'));
    if (!rec.packKey) throw new ApiError(404, 'NO_PACK', 'No application pack yet.');
    return c.json({ url: await d.blobs.presignGet(rec.packKey, { downloadName: `ChhatReady-${rec.ref}.pdf` }) });
  });

  r.delete('/cases/:id', async (c) => {
    const rec = await loadCase(d, c.req.param('id'));
    await d.blobs.deletePrefix(`uploads/${rec.caseId}/`);
    await d.blobs.deletePrefix(`packs/${rec.caseId}/`);
    await d.store.deleteAll(casePk(rec.caseId));
    await d.store.deleteAll(`SHARE#${rec.shareId}`);
    d.log.info('case deleted', { caseId: rec.caseId });
    return c.json({ ok: true });
  });

  return r;
}
