import { formatInr, parseIndianNumber, parseLoadKw, type BillFieldName, type BillFields, type BillInput } from '@chhatready/engine';
import { ArrowRight, ImageOff } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { chipFor, FieldRow } from '../components/FieldRow';
import { Button } from '../components/ui/button';
import { Callout } from '../components/ui/callout';
import { resolveUrl } from '../lib/api';
import { useCase } from '../lib/useCase';

const ORDER: { key: BillFieldName; label: string; suffix?: string; inputMode?: 'text' | 'decimal' | 'numeric'; helper: string }[] = [
  { key: 'unitsMonth', label: 'Units used this month', suffix: 'kWh', inputMode: 'decimal', helper: 'Also called units consumed. This sets your system size.' },
  { key: 'amountMonth', label: 'Amount payable', suffix: '₹', inputMode: 'decimal', helper: 'The total you pay for the month, including all charges.' },
  { key: 'sanctionedLoadKw', label: 'Sanctioned load', suffix: 'kW', inputMode: 'decimal', helper: 'Leave blank if your bill does not show it. Your DISCOM may cap your system at this size.' },
  { key: 'discom', label: 'Electricity company (DISCOM)', helper: 'Used in your application pack.' },
  { key: 'consumerNumber', label: 'Consumer number', inputMode: 'text', helper: 'Needed to prefill your application pack. Never sent to installers.' },
  { key: 'billingPeriod', label: 'Billing period', helper: 'Optional.' },
  { key: 'tariffCategory', label: 'Tariff category', helper: 'Optional. For example LT Domestic.' }
];

type Draft = Record<BillFieldName, string>;

const fieldText = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

function initialDraft(fields: BillFields | null, bill: BillInput | null): Draft {
  const pick = (k: BillFieldName) => (bill ? fieldText(bill[k as keyof BillInput]) : fieldText(fields?.[k]?.value));
  return Object.fromEntries(ORDER.map((o) => [o.key, pick(o.key)])) as Draft;
}

export default function Review() {
  const { billFields, billImageUrl, extractionSource, bill, setBill, caseId, mode } = useCase();
  const nav = useNavigate();
  const [draft, setDraft] = useState<Draft>(() => initialDraft(billFields, bill));
  const [edited, setEdited] = useState<Set<BillFieldName>>(new Set());
  const [focus, setFocus] = useState<BillFieldName | null>(null);
  const [img, setImg] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const imgWrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    if (billImageUrl) void resolveUrl(billImageUrl).then((u) => alive && setImg(u));
    return () => {
      alive = false;
    };
  }, [billImageUrl]);

  const units = parseIndianNumber(draft.unitsMonth);
  const amount = parseIndianNumber(draft.amountMonth);
  const load = draft.sanctionedLoadKw.trim() === '' ? null : parseLoadKw(draft.sanctionedLoadKw);

  const errors = useMemo(() => {
    const e: Partial<Record<BillFieldName, string>> = {};
    if (units === null || units < 1 || units > 20000) e.unitsMonth = 'Enter the units used, for example 285.';
    if (amount === null || amount < 1 || amount > 10_000_000) e.amountMonth = 'Enter the amount payable, for example 2412.60.';
    if (draft.sanctionedLoadKw.trim() !== '' && (load === null || load < 0.1 || load > 500)) e.sanctionedLoadKw = 'Enter the load in kW, for example 4. Leave it blank if unknown.';
    return e;
  }, [units, amount, load, draft.sanctionedLoadKw]);

  const rate = units && amount ? amount / units : null;
  const valid = Object.keys(errors).length === 0;

  const set = (k: BillFieldName, v: string) => {
    setDraft((d) => ({ ...d, [k]: v }));
    setEdited((s) => new Set(s).add(k));
  };

  const next = () => {
    setTouched(true);
    if (!valid || units === null || amount === null) return;
    setBill({
      discom: draft.discom.trim(),
      consumerNumber: draft.consumerNumber.trim(),
      billingPeriod: draft.billingPeriod.trim(),
      tariffCategory: draft.tariffCategory.trim(),
      unitsMonth: units,
      amountMonth: amount,
      sanctionedLoadKw: load
    });
    nav(`/c/${caseId}/roof`);
  };

  const boxFor = (k: BillFieldName) => billFields?.[k]?.bbox;
  const source = extractionSource;

  return (
    <div className="container-page py-8 sm:py-10">
      <h1 className="font-display text-3xl sm:text-4xl">Check what we read from your bill</h1>
      <p className="mt-2 max-w-2xl text-ink/85">Fix anything that looks wrong. Nothing is calculated until you confirm.</p>

      <div className="mt-4 space-y-3">
        {source === 'mock' && <Callout kind="sun" title="Local demo mode">These are saved sample values, not read from your file.</Callout>}
        {source === 'fixture' && <Callout kind="sun" title="Showing saved sample values">The reading service was unavailable, so we used the saved result for the sample bill.</Callout>}
        {source === 'textract-lines' && <Callout kind="info" title="Please check every value">We could read the text but could not match the labels with confidence.</Callout>}
        {!source && <Callout kind="info" title="Typing the details yourself">Find these on your bill, or upload a photo from the start page for us to read it.</Callout>}
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          {img ? (
            <div ref={imgWrap} className="relative overflow-hidden rounded-2xl border border-line bg-white lg:sticky lg:top-6">
              <img src={img} alt="Your uploaded bill" className="block w-full" />
              {ORDER.map((o) => {
                const b = boxFor(o.key);
                if (!b) return null;
                const on = focus === o.key;
                return <div key={o.key} className={`pointer-events-none absolute rounded border-2 transition-all ${on ? 'border-primary bg-primary/20' : 'border-sun/70 bg-sun/10'}`} style={{ left: `${b.left * 100}%`, top: `${b.top * 100}%`, width: `${b.width * 100}%`, height: `${b.height * 100}%` }} />;
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-line bg-surface p-6 lg:sticky lg:top-6">
              <ImageOff className="size-8 text-muted" aria-hidden />
              <h2 className="mt-3 font-display text-2xl">Where to look on your bill</h2>
              <ul className="mt-3 space-y-2 text-[15px] text-ink/85">
                <li>Units used: shown as units consumed or kWh for the month.</li>
                <li>Amount payable: the total at the bottom, with all charges.</li>
                <li>Sanctioned load: near your consumer details, in kW, kVA or HP.</li>
              </ul>
              <Link to="/" className="mt-4 inline-flex min-h-11 items-center font-semibold text-primary underline">Upload a bill photo instead</Link>
            </div>
          )}
        </div>

        <div>
          <div className="rounded-2xl border border-line bg-surface px-5">
            {ORDER.map((o) => {
              const has = draft[o.key].trim() !== '';
              const ch = chipFor(billFields?.[o.key]?.confidence, has, edited.has(o.key));
              return (
                <FieldRow
                  key={o.key}
                  id={`f-${o.key}`}
                  label={o.label}
                  value={draft[o.key]}
                  onChange={(v) => set(o.key, v)}
                  chip={billFields || edited.has(o.key) ? ch : undefined}
                  suffix={o.suffix}
                  inputMode={o.inputMode}
                  helper={o.helper}
                  error={touched ? errors[o.key] : undefined}
                  highlight={focus === o.key}
                  onFocus={() => setFocus(o.key)}
                  onBlur={() => setFocus((f) => (f === o.key ? null : f))}
                />
              );
            })}
          </div>

          {rate !== null && (
            <div className="mt-4">
              <Callout kind={rate < 3 || rate > 15 ? 'warn' : 'info'} title={`You pay about ₹${rate.toFixed(2)} for every unit`}>
                {rate < 3 || rate > 15 ? 'That looks unusual. Please recheck the units and the amount.' : `That is ${formatInr(amount ?? 0)} for ${units} units, including fixed charges. We use this to value the electricity solar will make.`}
              </Callout>
            </div>
          )}

          {mode === 'mock' && null}
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Link to="/" className="inline-flex min-h-11 items-center justify-center rounded-xl px-3 font-semibold text-muted hover:text-ink">Use a different bill</Link>
            <Button size="lg" onClick={next}>
              Looks right, continue <ArrowRight className="size-5" aria-hidden />
            </Button>
          </div>
          {touched && !valid && <p role="alert" className="mt-3 text-sm font-medium text-danger">Fix the highlighted fields to continue.</p>}
        </div>
      </div>
    </div>
  );
}
