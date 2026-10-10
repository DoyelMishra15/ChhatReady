import { Hono } from 'hono';
import { buildRfq, emailRequestSchema, formatInr, formatYears, rfqRequestSchema } from '@chhatready/engine';
import { ApiError } from '../errors';
import { loadCase, requirePlan, usableRoofArea, ttlSeconds } from '../services/cases';
import { newShort, parseBody } from '../services/util';
import { casePk, type Deps } from '../types';

export function actionRoutes(d: Deps) {
  const r = new Hono();

  r.post('/cases/:id/email', async (c) => {
    const rec = await loadCase(d, c.req.param('id'));
    const { to } = await parseBody(c, emailRequestSchema);
    const plan = requirePlan(rec);
    if (!rec.packKey) throw new ApiError(409, 'NO_PACK', 'Generate your application pack first.');
    const sent = await d.store.query(casePk(rec.caseId), 'EMAIL#');
    if (sent.length >= d.cfg.maxEmailsPerCase)
      throw new ApiError(429, 'EMAIL_LIMIT', 'You have reached the email limit for this plan.', 'Download the pack instead.');
    const bytes = await d.blobs.getBytes(rec.packKey, 4 * 1024 * 1024);
    if (!bytes) throw new ApiError(404, 'NO_PACK', 'Your application pack could not be found.', 'Please generate it again.');

    const link = `${d.cfg.appUrl}/c/${rec.caseId}/act`;
    const text = [
      'Hello,',
      '',
      `Your ChhatReady rooftop solar application pack (ref ${rec.ref}) is attached.`,
      '',
      'SNAPSHOT',
      `- Recommended system: ${plan.kw} kW`,
      `- Central subsidy: ${formatInr(plan.subsidy)}`,
      `- Estimated net cost: ${formatInr(plan.netCost)}`,
      `- Estimated payback: ${formatYears(plan.paybackYears)}`,
      `- CO2 avoided: ${plan.tCo2PerYear.toFixed(1)} tonnes per year`,
      '',
      'These are indicative estimates. Your DISCOM feasibility check and the installer survey decide the final size and price.',
      '',
      `Come back to your plan any time (it is kept for ${d.cfg.caseTtlDays} days): ${link}`,
      '',
      'Next step: register on pmsuryaghar.gov.in using the checklist inside the PDF.'
    ].join('\n');

    const res = await d.mailer.send({
      to,
      subject: `Your solar application pack (${rec.ref})`,
      text,
      attachment: { filename: `ChhatReady-${rec.ref}.pdf`, contentType: 'application/pdf', bytes }
    });
    await d.store.put(casePk(rec.caseId), `EMAIL#${newShort()}`, { sentAt: d.now().toISOString(), messageId: res.id, mode: d.mailer.mode }, ttlSeconds(d));
    d.metrics.count('EmailSent');
    d.log.info('pack emailed', { caseId: rec.caseId, mode: d.mailer.mode });
    return c.json({ status: 'sent', mode: d.mailer.mode, id: res.id });
  });

  r.post('/cases/:id/rfq', async (c) => {
    const rec = await loadCase(d, c.req.param('id'));
    const body = await parseBody(c, rfqRequestSchema);
    const plan = requirePlan(rec);
    const previous = await d.store.query(casePk(rec.caseId), 'RFQ#');
    if (previous.length >= d.cfg.maxRfqPerCase)
      throw new ApiError(429, 'RFQ_LIMIT', 'You have reached the quote-request limit for this plan.', 'Use the copy or mailto options for more installers.');

    const unique = [...new Set(body.recipients)];
    const msg = buildRfq({
      caseRef: rec.ref,
      contactName: body.contactName,
      contactEmail: body.contactEmail,
      contactPhone: body.contactPhone,
      location: body.location,
      note: body.note,
      discom: rec.bill?.discom ?? '',
      sanctionedLoadKw: rec.bill?.sanctionedLoadKw ?? null,
      unitsMonth: rec.bill?.unitsMonth ?? 0,
      roofAreaM2: usableRoofArea(rec),
      plan
    });

    // One message per installer so nobody sees the others' addresses. Replies go to the homeowner.
    const results: { to: string; status: 'sent' | 'failed'; code?: string; hint?: string; id?: string }[] = [];
    for (const to of unique) {
      try {
        const res = await d.mailer.send({ to, subject: msg.subject, text: msg.text, replyTo: body.contactEmail });
        results.push({ to, status: 'sent', id: res.id });
      } catch (e) {
        const err = e instanceof ApiError ? e : new ApiError(502, 'SEND_FAILED', 'Could not send.');
        results.push({ to, status: 'failed', code: err.code, hint: err.hint });
      }
    }
    const sentCount = results.filter((x) => x.status === 'sent').length;
    if (sentCount > 0) {
      await d.store.put(casePk(rec.caseId), `RFQ#${newShort()}`, { sentAt: d.now().toISOString(), results, mode: d.mailer.mode }, ttlSeconds(d));
      for (let i = 0; i < sentCount; i++) d.metrics.count('RfqSent');
    }
    d.log.info('rfq processed', { caseId: rec.caseId, sent: sentCount, failed: results.length - sentCount, mode: d.mailer.mode });
    return c.json({ results, mode: d.mailer.mode, subject: msg.subject, text: msg.text });
  });

  return r;
}
