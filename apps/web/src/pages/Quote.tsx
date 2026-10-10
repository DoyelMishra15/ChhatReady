import { formatInr, type QuoteFlag } from '@chhatready/engine';
import { CircleAlert, Info, Sparkles, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Uploader } from '../components/Uploader';
import { VerdictGauge } from '../components/VerdictGauge';
import { Button, LinkButton } from '../components/ui/button';
import { Callout } from '../components/ui/callout';
import { api, friendlyError, uploadFile, type QuoteRecord } from '../lib/api';
import { fetchSampleFile } from '../lib/demo';
import { FileProblem, prepareUpload } from '../lib/image';
import { toast } from '../lib/toast';
import { useCase } from '../lib/useCase';
import { CopyBtn } from './quoteCopy';

const sev = {
  high: { Icon: CircleAlert, cls: 'border-danger/30 bg-danger-soft', tag: 'Important', tagCls: 'text-danger' },
  warn: { Icon: TriangleAlert, cls: 'border-warn/30 bg-warn-soft', tag: 'Worth checking', tagCls: 'text-warn' },
  info: { Icon: Info, cls: 'border-line bg-surface', tag: 'Good to know', tagCls: 'text-muted' }
} as const;

function Flag({ f }: { f: QuoteFlag }) {
  const s = sev[f.severity];
  return (
    <li className={`flex gap-3 rounded-2xl border p-4 ${s.cls}`}>
      <s.Icon className={`mt-0.5 size-5 shrink-0 ${s.tagCls}`} aria-hidden />
      <div>
        <p className={`text-xs font-bold uppercase tracking-wide ${s.tagCls}`}>{s.tag}</p>
        <p className="font-semibold">{f.title}</p>
        <p className="text-[15px] text-ink/85">{f.detail}</p>
      </div>
    </li>
  );
}

const inputCls = 'min-h-12 w-full rounded-xl border border-line bg-surface px-3.5 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/25 tnum';

export default function Quote() {
  const c = useCase();
  const { caseId, plan, assumptions, setAssumptions } = c;
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<{ message: string; hint?: string } | null>(null);
  const [q, setQ] = useState<QuoteRecord | null>(c.quotes[0] ?? null);
  const [price, setPrice] = useState(q?.totalPrice ? String(q.totalPrice) : '');
  const [kw, setKw] = useState(q?.systemKw ? String(q.systemKw) : '');
  const [recheck, setRecheck] = useState(false);

  if (!c.bill) return <Navigate to={`/c/${caseId}/review`} replace />;

  const adopt = (r: QuoteRecord) => {
    setQ(r);
    setPrice(r.totalPrice ? String(r.totalPrice) : '');
    setKw(r.systemKw ? String(r.systemKw) : '');
    c.setQuotes([r, ...c.quotes.filter((x) => x.qid !== r.qid)]);
  };

  const run = async (file: File) => {
    setProblem(null);
    try {
      setBusy('Reading your quote');
      const { blob, contentType } = await prepareUpload(file);
      const key = await uploadFile(caseId, 'quote', blob, contentType);
      adopt(await api.checkQuote(caseId, key));
    } catch (e) {
      if (e instanceof FileProblem) setProblem({ message: e.message, hint: e.hint });
      else {
        const f = friendlyError(e);
        setProblem({ message: f.message, hint: f.hint });
      }
    } finally {
      setBusy(null);
    }
  };

  const num = (s: string) => {
    const n = Number(s.replace(/[,\s₹]/g, ''));
    return s.trim() && Number.isFinite(n) && n > 0 ? n : null;
  };

  const dirty = q && (num(price) !== q.totalPrice || num(kw) !== q.systemKw);
  const applyEdit = async () => {
    if (!q) return;
    setRecheck(true);
    try {
      adopt(await api.editQuote(caseId, q.qid, { totalPrice: num(price), systemKw: num(kw) }));
    } catch (e) {
      toast('error', friendlyError(e).message);
    } finally {
      setRecheck(false);
    }
  };

  const useInPlan = () => {
    if (!q?.totalPrice) return;
    setAssumptions({ ...assumptions, grossCostOverride: q.totalPrice });
    toast('success', `Your plan now uses ${formatInr(q.totalPrice)}.`);
  };

  const questionsText = q ? q.questions.map((x, i) => `${i + 1}. ${x}`).join('\n') : '';

  return (
    <div className="container-page space-y-8 py-8 sm:py-10">
      <header>
        <h1 className="font-display text-[2.2rem] font-semibold leading-[1.1] sm:text-5xl">Check a quote</h1>
        <p className="mt-3 max-w-xl text-lg text-ink/85">Upload an installer's quote. We compare the price with typical market prices and point out what to ask before you sign.</p>
      </header>

      {!q && (
        <Uploader
          title="Upload the quote"
          hint="A photo or a one-page PDF. We read the price, system size and warranty."
          busyText={busy}
          onFile={(f) => void run(f)}
          sampleLabel="Use a sample quote"
          onSample={() => void fetchSampleFile('sample-quote.png').then(run).catch(() => setProblem({ message: 'The sample quote could not be loaded.' }))}
          error={problem && <Callout kind="danger" title={problem.message}>{problem.hint}</Callout>}
        />
      )}
      {!q && problem && <Callout kind="danger" title={problem.message}>{problem.hint}</Callout>}

      {q && (
        <>
          <section aria-labelledby="chk-h" className="grid gap-4 rounded-2xl border border-line bg-surface p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end sm:p-6">
            <h2 id="chk-h" className="font-display text-2xl sm:col-span-3">What we read from your quote</h2>
            <div>
              <label htmlFor="qp" className="mb-1 block text-[15px] font-semibold">Total price including GST (₹)</label>
              <input id="qp" inputMode="numeric" className={inputCls} value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div>
              <label htmlFor="qk" className="mb-1 block text-[15px] font-semibold">System size (kW)</label>
              <input id="qk" inputMode="decimal" className={inputCls} value={kw} onChange={(e) => setKw(e.target.value)} />
            </div>
            <Button variant={dirty ? 'primary' : 'secondary'} size="lg" disabled={!dirty} loading={recheck} onClick={() => void applyEdit()}>Update</Button>
            <p className="text-sm text-muted sm:col-span-3">Automatic reading can miss things. Fix the numbers if they look wrong.</p>
          </section>

          <VerdictGauge verdict={q.verdict} />

          {q.flags.length > 0 && (
            <section aria-labelledby="fl-h">
              <h2 id="fl-h" className="mb-3 font-display text-2xl">Things to know</h2>
              <ul className="space-y-3">{[...q.flags].sort((a, b) => ['high', 'warn', 'info'].indexOf(a.severity) - ['high', 'warn', 'info'].indexOf(b.severity)).map((f) => <Flag key={f.code} f={f} />)}</ul>
            </section>
          )}

          {q.questions.length > 0 && (
            <section aria-labelledby="qs-h" className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 id="qs-h" className="font-display text-2xl">Ask the installer</h2>
                <CopyBtn text={questionsText} />
              </div>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-[15px]">{q.questions.map((x) => <li key={x}>{x}</li>)}</ol>
            </section>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            {q.totalPrice && plan && (
              <Button size="lg" onClick={useInPlan} disabled={assumptions.grossCostOverride === q.totalPrice}>
                <Sparkles className="size-5" aria-hidden /> {assumptions.grossCostOverride === q.totalPrice ? 'Your plan uses this price' : 'Use this price in my plan'}
              </Button>
            )}
            <Button size="lg" variant="secondary" onClick={() => { setQ(null); setProblem(null); }}>Check another quote</Button>
            <LinkButton to={`/c/${caseId}/plan`} size="lg" variant="quiet">Back to my plan</LinkButton>
          </div>
          <p className="text-sm text-muted">This is a guide, not a verdict on the installer. A fair price does not replace checking their registration and reviews.</p>
        </>
      )}
    </div>
  );
}
