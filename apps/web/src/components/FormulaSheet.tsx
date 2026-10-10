import { BENCHMARK_RULES, EMISSIONS_RULE, SUBSIDY_RULE, formatInr, formatNumber, mergeAssumptions, type Assumptions, type Plan } from '@chhatready/engine';
import { ExternalLink, RotateCcw } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { cn } from '../lib/cn';
import { Button } from './ui/button';
import { Sheet } from './ui/sheet';

interface Field {
  key: keyof Assumptions;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  /** multiply stored value by this to show it (e.g. 0.85 shown as 85) */
  scale?: number;
  help: string;
  optional?: boolean;
}

const FIELDS: Field[] = [
  { key: 'offsetTarget', label: 'Share of your usage to cover', unit: '%', min: 30, max: 120, step: 5, scale: 100, help: 'Most homes size to cover about all of their yearly use.' },
  { key: 'avoidedRateFactor', label: 'Share of your per-unit cost that solar saves', unit: '%', min: 30, max: 100, step: 1, scale: 100, help: 'Fixed charges stay on your bill, so solar saves a bit less than the full rate.' },
  { key: 'areaPerKwM2', label: 'Roof space needed per kW', unit: 'm²', min: 4, max: 20, step: 0.5, help: 'About 8 m² (86 sq ft) per kW with walkways for cleaning.' },
  { key: 'tariffEscalationPct', label: 'Yearly rise in electricity price', unit: '%', min: 0, max: 10, step: 0.5, help: 'Set to 0 for a cautious estimate.' },
  { key: 'degradationPct', label: 'Yearly drop in panel output', unit: '%', min: 0, max: 2, step: 0.1, help: 'Panels slowly lose output. 0.5% a year is typical.' },
  { key: 'omPerKwPerYear', label: 'Yearly cleaning and upkeep per kW', unit: '₹', min: 0, max: 5000, step: 50, help: 'Cleaning, inspection and small repairs.' },
  { key: 'inverterReplacementPerKw', label: 'Inverter replacement per kW', unit: '₹', min: 0, max: 30000, step: 500, help: 'Charged once, in year 12.' },
  { key: 'gridEmissionFactor', label: 'Grid CO₂ per unit of electricity', unit: 't/MWh', min: 0.2, max: 1.5, step: 0.01, help: `Source: ${EMISSIONS_RULE.source}` },
  { key: 'yieldFallbackPerKw', label: 'Backup yield if live sun data is missing', unit: 'kWh/kW', min: 800, max: 2200, step: 10, help: 'Only used when we cannot fetch sunlight data for your location.' },
  { key: 'annualUnitsOverride', label: 'Your yearly usage, if different from bill × 12', unit: 'kWh', min: 100, max: 200000, step: 50, help: 'Use this if your bill month was unusually high or low.', optional: true },
  { key: 'grossCostOverride', label: 'Price from a real quote', unit: '₹', min: 10000, max: 5000000, step: 1000, help: 'Replaces the typical market price. You can also set it from Check a quote.', optional: true }
];

function AssumptionInput({ field, value, onCommit }: { field: Field; value: number | null; onCommit: (v: number | null) => void }) {
  const shown = value === null ? '' : String(+(value * (field.scale ?? 1)).toFixed(3));
  const [text, setText] = useState(shown);
  useEffect(() => setText(shown), [shown]);
  const n = text.trim() === '' ? null : Number(text);
  const invalid = text.trim() !== '' && (!Number.isFinite(n) || (n as number) < field.min || (n as number) > field.max);
  const id = `as-${field.key}`;
  return (
    <div className="border-b border-line py-3.5 last:border-b-0">
      <label htmlFor={id} className="text-[15px] font-semibold">{field.label}</label>
      <div className="relative mt-1.5">
        <input
          id={id}
          inputMode="decimal"
          value={text}
          placeholder={field.optional ? 'Not set' : undefined}
          onChange={(e) => {
            setText(e.target.value);
            const t = e.target.value.trim();
            if (t === '' && field.optional) return onCommit(null);
            const v = Number(t);
            if (t !== '' && Number.isFinite(v) && v >= field.min && v <= field.max) onCommit(v / (field.scale ?? 1));
          }}
          aria-invalid={invalid}
          className={cn('min-h-11 w-full rounded-xl border bg-surface px-3.5 pr-20 text-base outline-none focus:border-primary focus:ring-4 focus:ring-primary/15', invalid ? 'border-danger' : 'border-line')}
        />
        <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-sm text-muted">{field.unit}</span>
      </div>
      <p className={cn('mt-1 text-sm', invalid ? 'font-medium text-danger' : 'text-muted')}>{invalid ? `Enter a value between ${field.min} and ${field.max}.` : field.help}</p>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="grid grid-cols-[2rem_1fr] gap-3 border-b border-line py-4 last:border-b-0">
      <span className="flex size-7 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary">{n}</span>
      <div>
        <h3 className="font-semibold">{title}</h3>
        <div className="mt-1 space-y-1 text-[15px] text-ink/85">{children}</div>
      </div>
    </li>
  );
}

const Eq = ({ children }: { children: ReactNode }) => <p className="rounded-lg bg-ink/[0.04] px-3 py-1.5 font-mono text-[13px] leading-relaxed tnum">{children}</p>;

export function FormulaSheet({ open, onOpenChange, plan, unitsMonth, amountMonth, usableRoofM2, assumptions, onChange }: { open: boolean; onOpenChange: (o: boolean) => void; plan: Plan; unitsMonth: number; amountMonth: number; usableRoofM2: number | null; assumptions: Partial<Assumptions>; onChange: (a: Partial<Assumptions>) => void }) {
  const a = mergeAssumptions(assumptions);
  const f1 = (n: number) => formatNumber(n, 1);
  const set = (key: keyof Assumptions, v: number | null) => {
    const next = { ...assumptions } as Record<string, unknown>;
    if (v === null) delete next[key];
    else next[key] = v;
    onChange(next as Partial<Assumptions>);
  };
  const yieldSrc = { pvgis: 'PVGIS (EU Joint Research Centre)', cache: 'PVGIS (saved earlier)', seed: 'saved regional estimate', fallback: 'typical Indian average' }[plan.yieldSource];

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="How we calculated this" description="Every number is plain arithmetic on your own bill. No AI is used for these calculations.">
      <h3 className="font-display text-xl">The steps</h3>
      <ol className="mt-2">
        <Step n={1} title="Your yearly use">
          <Eq>{formatNumber(unitsMonth)} units × 12 = {formatNumber(plan.annualUnits)} kWh a year</Eq>
        </Step>
        <Step n={2} title="What a unit really costs you">
          <Eq>{formatInr(amountMonth)} ÷ {formatNumber(unitsMonth)} units = ₹{plan.effectiveRate.toFixed(2)} per unit</Eq>
          <Eq>₹{plan.effectiveRate.toFixed(2)} × {Math.round(a.avoidedRateFactor * 100)}% = ₹{plan.avoidedRate.toFixed(2)} saved per unit</Eq>
        </Step>
        <Step n={3} title="Sunlight at your location">
          <Eq>{formatNumber(plan.yieldPerKw)} kWh per kW per year, from {yieldSrc}</Eq>
        </Step>
        <Step n={4} title="System size: the smallest of three limits">
          <Eq>Usage: {formatNumber(plan.annualUnits)} × {Math.round(a.offsetTarget * 100)}% ÷ {formatNumber(plan.yieldPerKw)} = {f1(plan.demandKw)} kW</Eq>
          <Eq>Roof: {usableRoofM2 === null ? 'not set' : `${f1(usableRoofM2)} m² ÷ ${a.areaPerKwM2} = ${f1(usableRoofM2 / a.areaPerKwM2)} kW`}</Eq>
          <Eq>Sanctioned load: {plan.loadKw === null ? 'not on your bill' : `${plan.loadKw} kW`}</Eq>
          <p>Recommended: <strong>{plan.recommendedKw} kW</strong>, rounded to the nearest 0.5 kW (never below 1 kW). You are viewing <strong>{plan.kw} kW</strong>.</p>
        </Step>
        <Step n={5} title="Electricity made in year 1">
          <Eq>{plan.kw} kW × {formatNumber(plan.yieldPerKw)} = {formatNumber(plan.genYear1)} kWh</Eq>
          <p>Only units you actually use are counted as savings: {formatNumber(plan.usefulGenYear1)} kWh.</p>
        </Step>
        <Step n={6} title="Cost and subsidy">
          <Eq>Typical market price for {plan.kw} kW: {formatInr(plan.costBand.low)} to {formatInr(plan.costBand.high)}</Eq>
          <Eq>{plan.costSource === 'quote' ? 'Using your quote' : 'Midpoint used'}: {formatInr(plan.grossCost)}</Eq>
          {plan.subsidyLines.map((l) => (
            <Eq key={l.label}>{l.label}: {l.kw} kW × {formatInr(l.perKw)} = {formatInr(l.amount)}</Eq>
          ))}
          <Eq>{formatInr(plan.grossCost)} − {formatInr(plan.subsidy)} subsidy = {formatInr(plan.netCost)} you pay</Eq>
        </Step>
        <Step n={7} title="Savings, payback and 25 years">
          <Eq>Each year: units made × saving per unit × price rise − upkeep − inverter replacement (year {a.inverterReplacementYear})</Eq>
          <Eq>Year 1 saving: {formatInr(plan.savingsYear1)} ({formatInr(plan.monthlySavingsYear1)} a month)</Eq>
          <Eq>Payback: {plan.paybackYears === null ? 'longer than 25 years' : `${plan.paybackYears.toFixed(1)} years`}. 25-year gain after cost: {formatInr(plan.savings25)}{plan.irr !== null ? `. Return: ${(plan.irr * 100).toFixed(0)}% a year.` : ''}</Eq>
        </Step>
        <Step n={8} title="Carbon avoided">
          <Eq>{formatNumber(plan.usefulGenYear1)} kWh ÷ 1000 × {a.gridEmissionFactor} = {plan.tCo2PerYear.toFixed(2)} tonnes CO₂ a year</Eq>
        </Step>
      </ol>

      <div className="mt-6 flex items-center justify-between gap-3">
        <h3 className="font-display text-xl">Change an assumption</h3>
        <Button size="sm" variant="secondary" onClick={() => onChange({})}>
          <RotateCcw className="size-4" aria-hidden /> Reset all
        </Button>
      </div>
      <div className="mt-1">
        {FIELDS.map((f) => (
          <AssumptionInput key={f.key} field={f} value={(assumptions[f.key] ?? (f.optional ? null : a[f.key])) as number | null} onCommit={(v) => set(f.key, v)} />
        ))}
      </div>

      <h3 className="mt-6 font-display text-xl">Where the rules come from</h3>
      <ul className="mt-2 space-y-2 text-[15px] text-ink/85">
        <li>
          <strong>Subsidy:</strong> {SUBSIDY_RULE.scheme}. {formatInr(SUBSIDY_RULE.tiers[0].perKw)} per kW for the first {SUBSIDY_RULE.tiers[0].uptoKw} kW, {formatInr(SUBSIDY_RULE.tiers[1].perKw)} for the next, capped at {formatInr(SUBSIDY_RULE.capInr)}.{' '}
          <a className="inline-flex items-center gap-1 font-semibold text-primary underline" href={SUBSIDY_RULE.source} target="_blank" rel="noreferrer">
            Official site <ExternalLink className="size-3.5" aria-hidden />
          </a>
        </li>
        <li><strong>Typical prices:</strong> {BENCHMARK_RULES.note}</li>
        <li><strong>CO₂ factor:</strong> {EMISSIONS_RULE.source}</li>
        <li>State top-ups, net-metering rules and your DISCOM's feasibility check can change the final numbers.</li>
      </ul>
    </Sheet>
  );
}
