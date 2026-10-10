import { buildRfq, formatInr } from '@chhatready/engine';
import { Check, Copy, Download, FileCheck2, Link2, Mail, MessageCircle, Send, ShieldCheck, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Button, LinkButton } from '../components/ui/button';
import { Callout } from '../components/ui/callout';
import { Modal } from '../components/ui/sheet';
import { api, friendlyError, uploadPack, type RfqResponse } from '../lib/api';
import { forgetCase } from '../lib/storage';
import { toast } from '../lib/toast';
import { useCase } from '../lib/useCase';
import type { PackInput } from '../pdf/generate';

const inputCls = 'min-h-12 w-full rounded-xl border border-line bg-surface px-3.5 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/25';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      size="sm"
      variant="secondary"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1600);
        } catch {
          toast('error', 'Could not copy. Select the text and copy it by hand.');
        }
      }}
    >
      {done ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />} {done ? 'Copied' : label}
    </Button>
  );
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[15px] font-semibold">{label}</label>
      {children}
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
    </div>
  );
}

export default function Act() {
  const c = useCase();
  const { bill, roof, plan, caseId, ref, shareId, assumptions } = c;
  const nav = useNavigate();

  const [pack, setPack] = useState<{ blob: Blob; url: string } | null>(null);
  const [packState, setPackState] = useState<'idle' | 'working' | 'error'>('idle');
  const [packError, setPackError] = useState<string | null>(null);
  const started = useRef(false);

  const [to, setTo] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailDone, setEmailDone] = useState<string | null>(null);

  const [form, setForm] = useState({ name: '', email: '', phone: '', location: '', note: '', r1: '', r2: '', r3: '', consent: false });
  const [showPreview, setShowPreview] = useState(false);
  const [rfqBusy, setRfqBusy] = useState(false);
  const [rfqRes, setRfqRes] = useState<RfqResponse | null>(null);
  const [rfqErr, setRfqErr] = useState<string | null>(null);

  const [delOpen, setDelOpen] = useState(false);
  const [delBusy, setDelBusy] = useState(false);

  const makePack = async () => {
    if (!bill || !plan) return;
    setPackState('working');
    setPackError(null);
    try {
      await c.saveNow();
      const { generatePack } = await import('../pdf/generate');
      const input: PackInput = { ref, bill, roof, plan, assumptions };
      const blob = await generatePack(input);
      await uploadPack(caseId, blob);
      setPack((old) => {
        if (old) URL.revokeObjectURL(old.url);
        return { blob, url: URL.createObjectURL(blob) };
      });
      setPackState('idle');
    } catch (e) {
      setPackError(friendlyError(e).message === 'Something went wrong.' ? 'We could not build your PDF.' : friendlyError(e).message);
      setPackState('error');
    }
  };

  useEffect(() => {
    if (started.current || !bill || !plan) return;
    started.current = true;
    void makePack();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bill, plan]);

  useEffect(() => () => { if (pack) URL.revokeObjectURL(pack.url); }, [pack]);

  const recipients = useMemo(() => [form.r1, form.r2, form.r3].map((r) => r.trim().toLowerCase()).filter(Boolean), [form.r1, form.r2, form.r3]);

  const rfqPreview = useMemo(() => {
    if (!bill || !plan) return null;
    return buildRfq({
      caseRef: ref,
      contactName: form.name || 'Your name',
      contactEmail: form.email || 'you@example.com',
      contactPhone: form.phone || undefined,
      location: form.location || undefined,
      note: form.note || undefined,
      discom: bill.discom,
      sanctionedLoadKw: bill.sanctionedLoadKw,
      unitsMonth: bill.unitsMonth,
      roofAreaM2: roof ? roof.areaM2 * (1 - roof.obstructionPct / 100) : null,
      plan
    });
  }, [bill, plan, roof, ref, form.name, form.email, form.phone, form.location, form.note]);

  if (!bill || !plan) return <Navigate to={`/c/${caseId}/${bill ? 'roof' : 'review'}`} replace />;

  const appUrl = `${window.location.origin}/c/${caseId}/act`;
  const shareUrl = `${window.location.origin}/s/${shareId}`;
  const emailsLeft = c.limits.maxEmails - c.emailCount;
  const rfqLeft = c.limits.maxRfq - c.rfqCount;

  const sendEmail = async (e: FormEvent) => {
    e.preventDefault();
    if (!EMAIL_RE.test(to.trim())) return toast('error', 'Enter a valid email address.');
    setEmailBusy(true);
    try {
      const r = await api.email(caseId, to.trim());
      c.bumpEmail();
      setEmailDone(r.mode === 'file' ? 'Saved as a test email on this computer (demo mode, nothing left your machine).' : `Sent to ${to.trim()}. Check spam if you do not see it.`);
    } catch (err) {
      const f = friendlyError(err);
      toast('error', f.hint ? `${f.message} ${f.hint}` : f.message);
    } finally {
      setEmailBusy(false);
    }
  };

  const formOk = form.name.trim() && EMAIL_RE.test(form.email.trim()) && recipients.length > 0 && recipients.every((r) => EMAIL_RE.test(r)) && form.consent && recipients.length <= rfqLeft;

  const sendRfq = async (e: FormEvent) => {
    e.preventDefault();
    if (!formOk) return;
    setRfqBusy(true);
    setRfqErr(null);
    try {
      const res = await api.rfq(caseId, {
        recipients,
        contactName: form.name.trim(),
        contactEmail: form.email.trim(),
        contactPhone: form.phone.trim() || undefined,
        location: form.location.trim() || undefined,
        note: form.note.trim() || undefined,
        consent: true
      });
      c.bumpRfq(res.results.filter((r) => r.status === 'sent').length);
      setRfqRes(res);
    } catch (err) {
      const f = friendlyError(err);
      setRfqErr(f.hint ? `${f.message} ${f.hint}` : f.message);
    } finally {
      setRfqBusy(false);
    }
  };

  const mailto = rfqPreview ? `mailto:${recipients.join(',')}?subject=${encodeURIComponent(rfqPreview.subject)}&body=${encodeURIComponent(rfqPreview.text)}` : '#';
  const whatsapp = rfqPreview ? `https://wa.me/?text=${encodeURIComponent(rfqPreview.text)}` : '#';

  const steps: { title: string; body: string; copy?: { label: string; value: string }[] }[] = [
    { title: 'Register on pmsuryaghar.gov.in', body: 'Choose your state and electricity company, then enter your consumer number, mobile and email.', copy: [{ label: 'Consumer number', value: bill.consumerNumber }, { label: 'Electricity company', value: bill.discom }].filter((x) => x.value) },
    { title: 'Apply for rooftop solar', body: `Request ${plan.kw} kW.${bill.sanctionedLoadKw ? ` Your sanctioned load is ${bill.sanctionedLoadKw} kW.` : ''} Wait for feasibility approval.`, copy: [{ label: 'System size', value: `${plan.kw} kW` }] },
    { title: 'Compare two or three installers', body: 'Send the quote request below, then check each reply with Check a quote.' },
    { title: 'Install', body: 'Keep the invoice, bill of materials and warranties. Confirm the net meter is in the installer\'s scope.' },
    { title: 'Net meter and inspection', body: 'Submit installation details on the portal. Your electricity company fits the meter and inspects.' },
    { title: 'Claim your subsidy', body: `About ${formatInr(plan.subsidy)} arrives in your bank account after inspection. Have a cancelled cheque ready.` }
  ];

  const doDelete = async () => {
    setDelBusy(true);
    try {
      await api.deleteCase(caseId);
      forgetCase();
      toast('success', 'Your data has been deleted.');
      nav('/', { replace: true });
    } catch (err) {
      toast('error', friendlyError(err).message);
      setDelBusy(false);
    }
  };

  return (
    <div className="container-page space-y-10 py-8 sm:py-10">
      <header>
        <h1 className="font-display text-[2.2rem] font-semibold leading-[1.1] sm:text-5xl">Your application pack</h1>
        <p className="mt-3 max-w-xl text-lg text-ink/85">Everything you need to apply for the subsidy and get quotes, filled in from your bill.</p>
      </header>

      {/* PDF */}
      <section aria-labelledby="pack-h" className="rounded-3xl bg-ink p-6 text-white sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <FileCheck2 className="mt-1 size-9 shrink-0 text-sun" aria-hidden />
            <div>
              <h2 id="pack-h" className="font-display text-2xl">Application pack (PDF, 4 pages)</h2>
              <p className="mt-1 max-w-md text-white/80">Your plan, a six-step checklist with your details filled in, documents to keep ready, and a spec sheet to hand to installers.</p>
            </div>
          </div>
          {pack ? (
            <a href={pack.url} download={`ChhatReady-${ref}.pdf`} className="inline-flex min-h-[52px] shrink-0 items-center justify-center gap-2 rounded-xl bg-sun px-6 font-semibold text-ink hover:bg-sun-strong hover:text-white">
              <Download className="size-5" aria-hidden /> Download PDF
            </a>
          ) : (
            <Button variant="sun" size="lg" loading={packState === 'working'} onClick={() => void makePack()}>
              {packState === 'error' ? 'Try again' : 'Preparing your pack'}
            </Button>
          )}
        </div>
        {packState === 'error' && packError && <p role="alert" className="mt-4 rounded-xl bg-white/10 p-3 text-[15px]">{packError} Your plan is safe, so you can try again.</p>}
      </section>

      {/* Steps */}
      <section aria-labelledby="steps-h">
        <h2 id="steps-h" className="font-display text-2xl">Your next six steps</h2>
        <ol className="mt-4 divide-y divide-line rounded-2xl border border-line bg-surface">
          {steps.map((s, i) => (
            <li key={s.title} className="flex gap-4 p-4 sm:p-5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft font-bold text-primary">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{s.title}</p>
                <p className="text-[15px] text-muted">{s.body}</p>
                {s.copy && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {s.copy.map((x) => (
                      <span key={x.label} className="inline-flex items-center gap-2 rounded-xl bg-paper px-3 py-1 text-sm">
                        <span className="text-muted">{x.label}:</span> <b className="tnum">{x.value}</b> <CopyButton text={x.value} />
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-2 text-sm text-muted">Typical steps. Portal screens can change, so confirm on pmsuryaghar.gov.in.</p>
      </section>

      {/* Email me */}
      <section aria-labelledby="mail-h" className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <h2 id="mail-h" className="flex items-center gap-2 font-display text-2xl"><Mail className="size-6 text-primary" aria-hidden /> Email the pack to me</h2>
        {emailDone ? (
          <Callout kind="ok" title="Done" className="mt-3">{emailDone}</Callout>
        ) : (
          <form onSubmit={sendEmail} className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Field id="to" label="Your email address" hint={emailsLeft <= 3 ? `${Math.max(emailsLeft, 0)} emails left for this plan.` : 'Sent from ChhatReady with the PDF attached and a link back here.'}>
                <input id="to" type="email" inputMode="email" autoComplete="email" className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} disabled={!pack} />
              </Field>
            </div>
            <Button type="submit" size="lg" loading={emailBusy} disabled={!pack || emailsLeft <= 0}>Send</Button>
          </form>
        )}
        {c.mailMode === 'file' && <p className="mt-3 text-sm text-muted">Demo mode: emails are saved to a local folder instead of being sent.</p>}
      </section>

      {/* RFQ */}
      <section aria-labelledby="rfq-h" className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <h2 id="rfq-h" className="flex items-center gap-2 font-display text-2xl"><Send className="size-6 text-primary" aria-hidden /> Ask installers for a quote</h2>
        <p className="mt-1 max-w-xl text-muted">Enter the email addresses of installers you have found, up to three. We send each one a separate message with your requirement. Their replies come straight to you.</p>
        {rfqRes ? (
          <div className="mt-4 space-y-3">
            <ul className="divide-y divide-line rounded-xl border border-line">
              {rfqRes.results.map((r) => (
                <li key={r.to} className="flex items-start justify-between gap-3 p-3 text-[15px]">
                  <span className="break-all">{r.to}</span>
                  <span className={r.status === 'sent' ? 'font-semibold text-ok' : 'font-semibold text-danger'}>
                    {r.status === 'sent' ? (rfqRes.mode === 'file' ? 'Saved (demo)' : 'Sent') : `Not sent${r.hint ? `. ${r.hint}` : ''}`}
                  </span>
                </li>
              ))}
            </ul>
            {rfqRes.results.some((r) => r.status === 'failed') && (
              <Callout kind="warn" title="Some emails did not go out">
                You can send the same request from your own email app.
                <div className="mt-2 flex flex-wrap gap-2">
                  <a className="inline-flex min-h-10 items-center rounded-xl border border-line bg-surface px-3.5 text-sm font-semibold" href={mailto}>Open in my email app</a>
                  <CopyButton text={rfqRes.text} label="Copy message" />
                </div>
              </Callout>
            )}
            <Callout kind="info" title="What happens next">Replies arrive in your inbox ({form.email}). When quotes come in, check each one.</Callout>
            <LinkButton to={`/c/${caseId}/quote`}>Check a quote <span aria-hidden>→</span></LinkButton>
          </div>
        ) : (
          <form onSubmit={sendRfq} className="mt-4 space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="rn" label="Your name"><input id="rn" className={inputCls} autoComplete="name" maxLength={60} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
              <Field id="re" label="Your email" hint="Installers reply here."><input id="re" type="email" className={inputCls} autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
              <Field id="rp" label="Phone (optional)"><input id="rp" type="tel" className={inputCls} autoComplete="tel" maxLength={20} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
              <Field id="rl" label="Area or city (optional)" hint="Helps installers tell if they serve you."><input id="rl" className={inputCls} maxLength={100} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Field>
            </div>
            <fieldset className="space-y-3">
              <legend className="mb-1 text-[15px] font-semibold">Installer emails (1 to 3)</legend>
              {(['r1', 'r2', 'r3'] as const).map((k, i) => (
                <input key={k} type="email" aria-label={`Installer email ${i + 1}`} placeholder={i === 0 ? 'quotes@installer.example' : 'Optional'} className={inputCls} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
              ))}
              {recipients.length > rfqLeft && <p className="text-sm text-danger">You can send {Math.max(rfqLeft, 0)} more requests for this plan.</p>}
            </fieldset>
            <Field id="rnote" label="Anything to add (optional)"><textarea id="rnote" rows={2} maxLength={400} className={`${inputCls} py-3`} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>

            <button type="button" className="min-h-11 font-semibold text-primary underline-offset-4 hover:underline" onClick={() => setShowPreview((v) => !v)} aria-expanded={showPreview}>
              {showPreview ? 'Hide the message' : 'Preview the message that will be sent'}
            </button>
            {showPreview && rfqPreview && (
              <div className="rounded-xl border border-line bg-paper p-4">
                <p className="text-sm text-muted">Subject</p>
                <p className="font-semibold">{rfqPreview.subject}</p>
                <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap font-sans text-sm">{rfqPreview.text}</pre>
                <p className="mt-2 text-xs text-muted">Your consumer number is never included.</p>
              </div>
            )}

            <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-primary-soft p-3.5 text-[15px]">
              <input type="checkbox" className="mt-1 size-5 shrink-0 accent-[#0B6B4F]" checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} />
              <span>I want ChhatReady to email this request to the addresses above, and I understand my name, email and the system details will be shared with them.</span>
            </label>
            {rfqErr && <Callout kind="danger" title="We could not send that">{rfqErr}</Callout>}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button type="submit" size="lg" loading={rfqBusy} disabled={!formOk}>Send quote requests</Button>
              <span className="text-sm text-muted">or send it yourself:</span>
              <div className="flex gap-2">
                <a href={mailto} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-surface px-3.5 text-sm font-semibold"><Mail className="size-4" aria-hidden /> Email app</a>
                <a href={whatsapp} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-surface px-3.5 text-sm font-semibold"><MessageCircle className="size-4" aria-hidden /> WhatsApp</a>
                {rfqPreview && <CopyButton text={rfqPreview.text} label="Copy" />}
              </div>
            </div>
            {c.mailMode === 'file' && <p className="text-sm text-muted">Demo mode: nothing is actually emailed. Messages are saved in the local <code>apps/api/.data/outbox</code> folder.</p>}
          </form>
        )}
      </section>

      {/* Quote + share + privacy */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 [&>*]:min-w-0">
        <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
          <h2 className="font-display text-2xl">Got a quote?</h2>
          <p className="mt-1 text-muted">Upload it to see if the price is fair and what to ask before you sign.</p>
          <LinkButton to={`/c/${caseId}/quote`} className="mt-4">Check a quote</LinkButton>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
          <h2 className="flex items-center gap-2 font-display text-2xl"><Link2 className="size-5 text-primary" aria-hidden /> Share your plan</h2>
          <p className="mt-1 text-muted">A read-only link to your plan. It hides your consumer number and exact location.</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-xl bg-paper px-3 py-2.5 text-sm">{shareUrl}</code>
            <CopyButton text={shareUrl} label="Copy link" />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6" aria-labelledby="priv-h">
        <h2 id="priv-h" className="flex items-center gap-2 font-display text-2xl"><ShieldCheck className="size-6 text-primary" aria-hidden /> Your data</h2>
        <p className="mt-1 max-w-2xl text-muted">Your bill photo is removed within one to two days. Your plan is kept for about 30 days, then deleted. You can delete everything now. <Link to="/privacy" className="font-semibold text-primary underline">Read the privacy details</Link>.</p>
        <Button variant="danger" className="mt-4" onClick={() => setDelOpen(true)}><Trash2 className="size-4" aria-hidden /> Delete my data</Button>
        <span className="sr-only">{appUrl}</span>
      </section>

      <Modal open={delOpen} onOpenChange={setDelOpen} title="Delete everything?" description="This removes your bill photo, plan, quotes and application pack. The share link stops working. It cannot be undone.">
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => setDelOpen(false)}>Keep my data</Button>
          <Button variant="danger" loading={delBusy} onClick={() => void doDelete()}>Yes, delete it</Button>
        </div>
      </Modal>
    </div>
  );
}

