import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { BILL, PDF, PNG, ROOF, get, json, makeDeps, uploadVia } from './helpers';

async function newCase(app: ReturnType<typeof makeDeps>['app']) {
  const r = await json(app, 'POST', '/cases');
  expect(r.status).toBe(201);
  return (await r.json()) as { caseId: string; shareId: string; ref: string };
}

describe('API happy path (mock mode, in-memory)', () => {
  it('health reports mock mode', async () => {
    const { app } = makeDeps();
    const j = await (await get(app, '/health')).json();
    expect(j).toMatchObject({ ok: true, mode: 'mock', mail: 'file' });
  });

  it('runs the whole journey: upload, extract, plan, pack, email, RFQ, quote, share, delete', async () => {
    const { app, dir } = makeDeps();
    const { caseId, shareId, ref } = await newCase(app);
    expect(ref).toMatch(/^CR-[A-Z0-9]{6}$/);

    // upload + extract
    const billKey = await uploadVia(app, caseId, 'bill', PNG);
    const ex = await (await json(app, 'POST', `/cases/${caseId}/extract-bill`, { key: billKey })).json();
    expect(ex.source).toBe('mock');
    expect(ex.fields.unitsMonth.value).toBe(285);
    expect(ex.imageUrl).toContain('/mock/blob/');

    // inputs -> server recompute with the shared engine
    const put = await (await json(app, 'PUT', `/cases/${caseId}/inputs`, { bill: BILL, roof: ROOF })).json();
    expect(put.planError).toBeNull();
    expect(put.plan.kw).toBeGreaterThanOrEqual(2);
    expect(put.plan.subsidy).toBeGreaterThan(0);
    expect(put.yield.source).toBe('seed');
    const kw = put.plan.kw;

    // override size
    const big = await (await json(app, 'PUT', `/cases/${caseId}/inputs`, { selectedKw: 5 })).json();
    expect(big.plan.kw).toBe(5);
    expect(big.plan.subsidy).toBe(78000);
    await json(app, 'PUT', `/cases/${caseId}/inputs`, { selectedKw: null });

    // email before pack is refused
    const early = await json(app, 'POST', `/cases/${caseId}/email`, { to: 'me@example.com' });
    expect(early.status).toBe(409);

    // pack
    const pre = await (await json(app, 'POST', `/cases/${caseId}/pack/presign`)).json();
    expect((await app.request(pre.uploadUrl, { method: 'PUT', headers: pre.headers, body: PDF as never })).status).toBe(200);
    expect((await json(app, 'POST', `/cases/${caseId}/pack/complete`)).status).toBe(200);
    const packUrl = (await (await get(app, `/cases/${caseId}/pack`)).json()).url as string;
    expect(packUrl).toContain('/mock/blob/packs/');

    // email me
    const em = await (await json(app, 'POST', `/cases/${caseId}/email`, { to: 'Me@Example.com' })).json();
    expect(em.status).toBe('sent');
    const outbox = fs.readdirSync(path.join(dir, 'outbox'));
    expect(outbox).toHaveLength(1);
    const eml = fs.readFileSync(path.join(dir, 'outbox', outbox[0]), 'utf8');
    expect(eml).toContain('To: me@example.com');
    expect(eml).toContain('multipart/mixed');
    expect(eml).toContain('filename="ChhatReady-' + ref + '.pdf"');

    // RFQ to two installers, reply-to is the homeowner
    const rfqBody = { recipients: ['a@installer.in', 'B@installer.in', 'a@installer.in'], contactName: 'Asha Verma', contactEmail: 'asha@example.com', consent: true, note: 'Prefer weekend visit' };
    const rfq = await (await json(app, 'POST', `/cases/${caseId}/rfq`, rfqBody)).json();
    expect(rfq.results.map((x: { to: string; status: string }) => [x.to, x.status])).toEqual([['a@installer.in', 'sent'], ['b@installer.in', 'sent']]);
    expect(rfq.subject).toBe(`Quote request: ${kw} kW rooftop solar (PM Surya Ghar), ref ${ref}`);
    expect(rfq.text).not.toContain(BILL.consumerNumber);
    const all = fs.readdirSync(path.join(dir, 'outbox'));
    expect(all).toHaveLength(3);
    const rfqEml = fs.readFileSync(path.join(dir, 'outbox', all[2]), 'utf8');
    expect(rfqEml).toContain('Reply-To: asha@example.com');
    expect(rfqEml).not.toContain('b@installer.in\r\nTo: a@installer.in');

    // quote check
    const qKey = await uploadVia(app, caseId, 'quote', PNG);
    const q = await (await json(app, 'POST', `/cases/${caseId}/quotes/check`, { key: qKey })).json();
    expect(q.totalPrice).toBe(225000);
    expect(q.systemKw).toBe(3);
    expect(q.verdict.band).toBe('above');
    expect(q.flags.some((f: { code: string }) => f.code === 'DCR_NOT_MENTIONED')).toBe(true);
    const edited = await (await json(app, 'PUT', `/cases/${caseId}/quotes/${q.qid}`, { totalPrice: 185000, systemKw: 3 })).json();
    expect(edited.verdict.band).toBe('in');

    // resume
    const got = await (await get(app, `/cases/${caseId}`)).json();
    expect(got.case.status).toBe('packed');
    expect(got.billExtraction.fields.consumerNumber.value).toBe('4821093755');
    expect(got.quotes).toHaveLength(1);
    expect(got.rfqCount).toBe(1);
    expect(got.emailCount).toBe(1);

    // share view hides sensitive data
    const sh = await (await get(app, `/share/${shareId}`)).json();
    expect(sh.bill.consumerNumber).toBe('••••••3755');
    expect(JSON.stringify(sh)).not.toContain('4821093755');
    expect(JSON.stringify(sh)).not.toContain('26.91');
    expect(sh.plan.kw).toBe(kw);

    // delete wipes everything
    expect((await app.request(`/cases/${caseId}`, { method: 'DELETE' })).status).toBe(200);
    expect((await app.request(`/cases/${caseId}`)).status).toBe(404);
    expect((await app.request(`/share/${shareId}`)).status).toBe(404);
    expect((await app.request(packUrl)).status).toBe(404);
  });
});

describe('API safety and errors', () => {
  it('rejects unknown cases and malformed ids', async () => {
    const { app } = makeDeps();
    expect((await app.request('/cases/zzzzzzzzzzzzzzzz')).status).toBe(404);
    expect((await app.request('/cases/short')).status).toBe(404);
  });

  it('uses a consistent error shape', async () => {
    const { app } = makeDeps();
    const r = await json(app, 'POST', '/uploads/presign', { caseId: 'x', kind: 'bill', contentType: 'image/gif' });
    expect(r.status).toBe(400);
    const j = await r.json();
    expect(j.error.code).toBe('VALIDATION');
    expect(typeof j.error.message).toBe('string');
  });

  it('refuses oversize presign requests and files that are not images or PDFs', async () => {
    const { app } = makeDeps();
    const { caseId } = await newCase(app);
    const big = await json(app, 'POST', '/uploads/presign', { caseId, kind: 'bill', contentType: 'image/png', fileSize: 9 * 1024 * 1024 });
    expect(big.status).toBe(413);
    const key = await uploadVia(app, caseId, 'bill', new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]));
    const r = await json(app, 'POST', `/cases/${caseId}/extract-bill`, { key });
    expect(r.status).toBe(422);
    expect((await r.json()).error.code).toBe('UNSUPPORTED_FILE');
  });

  it('will not extract a file that belongs to a different case or a different kind', async () => {
    const { app } = makeDeps();
    const a = await newCase(app);
    const b = await newCase(app);
    const key = await uploadVia(app, a.caseId, 'bill', PNG);
    expect((await json(app, 'POST', `/cases/${b.caseId}/extract-bill`, { key })).status).toBe(400);
    expect((await json(app, 'POST', `/cases/${a.caseId}/quotes/check`, { key })).status).toBe(400);
  });

  it('blocks path traversal in the mock blob route', async () => {
    const { app } = makeDeps();
    const r = await app.request('/mock/blob/uploads/../../etc/passwd');
    expect([400, 404]).toContain(r.status);
  });

  it('returns a typed plan error instead of crashing on bad numbers', async () => {
    const { app } = makeDeps();
    const { caseId } = await newCase(app);
    const tiny = await (await json(app, 'PUT', `/cases/${caseId}/inputs`, { bill: BILL, roof: { ...ROOF, areaM2: 3 } })).json();
    expect(tiny.plan).toBeNull();
    expect(tiny.planError.code).toBe('ROOF_TOO_SMALL');
    const bad = await json(app, 'PUT', `/cases/${caseId}/inputs`, { bill: { ...BILL, unitsMonth: -4 } });
    expect(bad.status).toBe(400);
  });

  it('needs a plan before emailing or sending RFQs, and requires consent', async () => {
    const { app } = makeDeps();
    const { caseId } = await newCase(app);
    const base = { recipients: ['a@b.in'], contactName: 'A', contactEmail: 'me@x.in' };
    expect((await json(app, 'POST', `/cases/${caseId}/rfq`, { ...base, consent: false })).status).toBe(400);
    expect((await json(app, 'POST', `/cases/${caseId}/rfq`, { ...base, consent: true })).status).toBe(409);
  });

  it('caps RFQ sends per case', async () => {
    const { app } = makeDeps();
    const { caseId } = await newCase(app);
    await json(app, 'PUT', `/cases/${caseId}/inputs`, { bill: BILL, roof: ROOF });
    const body = { recipients: ['a@b.in'], contactName: 'A', contactEmail: 'me@x.in', consent: true };
    for (let i = 0; i < 5; i++) expect((await json(app, 'POST', `/cases/${caseId}/rfq`, body)).status).toBe(200);
    const over = await json(app, 'POST', `/cases/${caseId}/rfq`, body);
    expect(over.status).toBe(429);
    expect((await over.json()).error.code).toBe('RFQ_LIMIT');
  });

  it('reports failed recipients with a fallback hint when the mail provider is not ready', async () => {
    const { app, deps } = makeDeps();
    const { ApiError } = await import('../src/errors');
    deps.mailer = {
      mode: 'ses',
      async send(m) {
        if (m.to.startsWith('bad')) throw new ApiError(502, 'SES_NOT_READY', 'rejected', 'sandbox');
        return { id: 'ok' };
      }
    };
    const { createApp } = await import('../src/app');
    const app2 = createApp(deps);
    const { caseId } = await newCase(app2);
    await json(app2, 'PUT', `/cases/${caseId}/inputs`, { bill: BILL, roof: ROOF });
    const r = await (await json(app2, 'POST', `/cases/${caseId}/rfq`, { recipients: ['good@x.in', 'bad@x.in'], contactName: 'A', contactEmail: 'me@x.in', consent: true })).json();
    expect(r.results[0].status).toBe('sent');
    expect(r.results[1]).toMatchObject({ status: 'failed', code: 'SES_NOT_READY', hint: 'sandbox' });
    void app;
  });

  it('irradiance endpoint validates input and returns seed data in mock mode', async () => {
    const { app } = makeDeps();
    expect((await app.request('/irradiance?lat=abc&lon=1')).status).toBe(400);
    const j = await (await get(app, '/irradiance?lat=26.91&lon=75.79')).json();
    expect(j.source).toBe('seed');
    expect(j.monthly).toHaveLength(12);
  });
});
