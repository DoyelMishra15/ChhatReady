import { FileCheck2, ShieldCheck, UserRound, IndianRupee, ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Callout } from '../components/ui/callout';
import { Uploader } from '../components/Uploader';
import { api, friendlyError, uploadFile } from '../lib/api';
import { fetchSampleFile } from '../lib/demo';
import { FileProblem, prepareUpload } from '../lib/image';
import { lastCase, rememberCase } from '../lib/storage';
import sample from '../../../../demo/fixtures/sample-bill.extract.json';

type Err = { message: string; hint?: string; caseId?: string };

const HILITE: { key: 'unitsMonth' | 'amountMonth' | 'sanctionedLoadKw' | 'consumerNumber'; label: string; side: 'left' | 'right' }[] = [
  { key: 'consumerNumber', label: 'Your connection', side: 'right' },
  { key: 'sanctionedLoadKw', label: 'Sanctioned load', side: 'right' },
  { key: 'unitsMonth', label: 'Units used', side: 'right' },
  { key: 'amountMonth', label: 'Amount you pay', side: 'left' }
];

function BillPreview() {
  const fields = sample.fields as unknown as Record<string, { bbox?: { left: number; top: number; width: number; height: number } }>;
  return (
    <figure className="relative mx-auto w-full max-w-[430px] rotate-[1.2deg]" aria-label="Sample electricity bill with the values we read highlighted">
      <img src="/demo/sample-bill.png" alt="A sample electricity bill" className="w-full rounded-2xl border border-line bg-white shadow-float" width={1240} height={1754} />
      {HILITE.map((h, i) => {
        const b = fields[h.key]?.bbox;
        if (!b) return null;
        return (
          <div key={h.key} className="pointer-events-none absolute animate-[fadeIn_.5s_ease-out_both] rounded-md border-2 border-sun bg-sun/25" style={{ left: `${b.left * 100}%`, top: `${b.top * 100}%`, width: `${b.width * 100}%`, height: `${b.height * 100}%`, animationDelay: `${0.5 + i * 0.35}s` }}>
            <span className={`absolute -top-2.5 whitespace-nowrap rounded-full bg-ink px-2.5 py-0.5 text-[11px] font-semibold text-white ${h.side === 'left' ? 'left-2' : 'right-2'}`}>{h.label}</span>
          </div>
        );
      })}
      <figcaption className="mt-3 text-center text-sm text-muted">A sample bill. We highlight what we read and you confirm it.</figcaption>
    </figure>
  );
}

export default function Landing() {
  const nav = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<Err | null>(null);
  const last = lastCase();

  const run = async (get: () => Promise<File>) => {
    setErr(null);
    let caseId: string | undefined;
    try {
      setBusy('Preparing your file…');
      const file = await get();
      const { blob, contentType } = await prepareUpload(file);
      setBusy('Uploading securely…');
      const c = await api.createCase();
      caseId = c.caseId;
      const key = await uploadFile(c.caseId, 'bill', blob, contentType);
      setBusy('Reading your bill…');
      await api.extractBill(c.caseId, key);
      rememberCase(c.caseId);
      nav(`/c/${c.caseId}/review`);
    } catch (e) {
      setBusy(null);
      if (e instanceof FileProblem) setErr({ message: e.message, hint: e.hint });
      else {
        const f = friendlyError(e);
        setErr({ message: f.message, hint: f.hint, caseId });
      }
    }
  };

  const manual = async () => {
    setErr(null);
    setBusy('Setting things up…');
    try {
      const c = await api.createCase();
      rememberCase(c.caseId);
      nav(`/c/${c.caseId}/review`);
    } catch (e) {
      setBusy(null);
      setErr(friendlyError(e));
    }
  };

  return (
    <>
      <section className="container-page grid gap-10 pb-12 pt-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-14 lg:pt-14">
        <div>
          {last && (
            <Link to={`/c/${last}`} className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-[15px] font-semibold hover:border-ink/40">
              Continue your last plan <ArrowRight className="size-4" aria-hidden />
            </Link>
          )}
          <h1 className="font-display text-[2.5rem] font-semibold leading-[1.08] sm:text-5xl lg:text-[3.4rem]">Your electricity bill already knows if solar will pay off.</h1>
          <p className="mt-4 max-w-xl text-lg text-ink/85">Upload one bill. See your size, subsidy and payback, then leave with an application pack you can use.</p>

          <div className="mt-7 max-w-xl">
            <Uploader
              title="Add your electricity bill"
              hint="A clear photo or a one-page PDF of any recent bill."
              busyText={busy}
              onFile={(f) => void run(async () => f)}
              onSample={() => void run(() => fetchSampleFile('sample-bill.png'))}
              sampleLabel="No bill handy? Try a sample bill"
              error={
                err && (
                  <Callout
                    kind="danger"
                    title={err.message}
                    action={
                      <div className="flex flex-wrap gap-2">
                        {err.caseId && <Button size="sm" onClick={() => nav(`/c/${err.caseId}/review`)}>Type the details instead</Button>}
                        {!err.caseId && <Button size="sm" variant="secondary" onClick={() => void manual()}>Type the details instead</Button>}
                      </div>
                    }
                  >
                    {err.hint}
                  </Callout>
                )
              }
            />
            {!busy && (
              <button type="button" onClick={() => void manual()} className="mt-3 inline-flex min-h-11 items-center rounded-xl px-2 text-[15px] font-semibold text-muted underline-offset-4 hover:text-ink hover:underline">
                Or type the details from your bill
              </button>
            )}
          </div>

          <ul className="mt-6 grid max-w-xl gap-3 text-[15px] sm:grid-cols-3">
            {[
              [ShieldCheck, 'Bill photo deleted automatically within a day or two'],
              [UserRound, 'No sign-up or account'],
              [IndianRupee, 'Free to use']
            ].map(([Icon, text]) => {
              const I = Icon as typeof ShieldCheck;
              return (
                <li key={text as string} className="flex items-start gap-2.5">
                  <I className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                  <span>{text as string}</span>
                </li>
              );
            })}
          </ul>
        </div>
        <BillPreview />
      </section>

      <section id="how" className="border-t border-line bg-surface">
        <div className="container-page grid gap-10 py-14 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <h2 className="font-display text-3xl sm:text-4xl">From bill to application in three steps</h2>
            <p className="mt-3 max-w-md text-ink/85">Most people stall at three questions: what size, will it pay off, and what do I do next. ChhatReady answers all three from your own bill.</p>
          </div>
          <ol className="divide-y divide-line border-y border-line">
            {[
              ['Bill', 'We read your units, amount and sanctioned load. You check every value before anything is calculated.'],
              ['Plan', 'Trace your roof or type its area. You get a size, the PM Surya Ghar subsidy, payback and 25-year savings. Every formula is open and every assumption can be changed.'],
              ['Act', 'Download a pre-filled application pack, email it to yourself, send a quote request to installers you choose, and check any quote you receive against typical prices.']
            ].map(([t, d], i) => (
              <li key={t} className="grid grid-cols-[2.5rem_1fr] gap-4 py-5">
                <span className="font-display text-3xl text-primary">{i + 1}</span>
                <div>
                  <h3 className="text-lg font-semibold">{t}</h3>
                  <p className="mt-1 text-ink/85">{d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="container-page py-12">
        <div className="flex items-start gap-4 rounded-3xl bg-primary-soft p-6 sm:p-8">
          <FileCheck2 className="mt-1 size-7 shrink-0 text-primary" aria-hidden />
          <div>
            <h2 className="font-display text-2xl">Built for independent houses with their own roof</h2>
            <p className="mt-2 max-w-2xl text-ink/85">Flats and rented homes usually need a society or landlord approval first, so the numbers here may not apply. Your DISCOM's feasibility check and the installer's site survey decide the final size and price.</p>
          </div>
        </div>
      </section>
    </>
  );
}
