import { SYSTEM_LIMITS, formatInr, subsidyCapKw, type Plan } from '@chhatready/engine';
import { RotateCcw } from 'lucide-react';
import { CountUp } from './CountUp';
import { Slider } from './ui/slider';

const pct = (kw: number) => `${((kw - SYSTEM_LIMITS.minKw) / (SYSTEM_LIMITS.maxKw - SYSTEM_LIMITS.minKw)) * 100}%`;

export function SystemSizer({ plan, onChange, isCustom }: { plan: Plan; onChange: (kw: number | null) => void; isCustom: boolean }) {
  const ticks: { kw: number; label: string; cls: string }[] = [
    { kw: Math.min(Math.max(plan.demandKw, SYSTEM_LIMITS.minKw), SYSTEM_LIMITS.maxKw), label: `Your usage needs ${plan.demandKw.toFixed(1)} kW`, cls: 'bg-primary' },
    { kw: subsidyCapKw(), label: `Subsidy tops out at ${subsidyCapKw()} kW`, cls: 'bg-sun-strong' }
  ];
  if (plan.roofKw !== null) ticks.push({ kw: Math.min(plan.roofKw, SYSTEM_LIMITS.maxKw), label: `Your roof fits about ${plan.roofKw.toFixed(1)} kW`, cls: 'bg-ink' });
  if (plan.loadKw !== null) ticks.push({ kw: Math.min(plan.loadKw, SYSTEM_LIMITS.maxKw), label: `Sanctioned load is ${plan.loadKw} kW`, cls: 'bg-muted' });
  const limitText = { demand: 'your usage', roof: 'your roof space', load: 'your sanctioned load' }[plan.limiting];

  return (
    <section aria-labelledby="size-heading" className="rounded-[1.5rem] bg-surface p-5 shadow-float sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="size-heading" className="text-[15px] font-semibold text-muted">System size</h2>
          <p className="font-display-num text-5xl font-semibold">
            <CountUp value={plan.kw} format={(n) => n.toFixed(1)} /> <span className="text-2xl text-muted">kW</span>
          </p>
        </div>
        {isCustom ? (
          <button type="button" onClick={() => onChange(null)} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-line px-3 text-sm font-semibold hover:border-ink/40">
            <RotateCcw className="size-4" aria-hidden /> Use {plan.recommendedKw} kW
          </button>
        ) : (
          <span className="rounded-full bg-primary-soft px-3 py-1 text-sm font-semibold text-primary">Recommended</span>
        )}
      </div>

      <div className="mt-3">
        <Slider value={plan.kw} onChange={onChange} min={SYSTEM_LIMITS.minKw} max={SYSTEM_LIMITS.maxKw} step={SYSTEM_LIMITS.stepKw} label="System size in kilowatts">
          {ticks.map((t) => (
            <span key={t.label} title={t.label} className={`pointer-events-none absolute top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full ${t.cls}`} style={{ left: pct(t.kw) }} aria-hidden />
          ))}
        </Slider>
        <div className="mt-1 flex justify-between text-xs text-muted tnum">
          <span>{SYSTEM_LIMITS.minKw} kW</span>
          <span>{SYSTEM_LIMITS.maxKw} kW</span>
        </div>
      </div>

      <ul className="mt-4 space-y-1.5 text-sm">
        {ticks.map((t) => (
          <li key={t.label} className="flex items-center gap-2 text-ink/85">
            <span className={`inline-block h-4 w-1 rounded-full ${t.cls}`} aria-hidden />
            {t.label}
          </li>
        ))}
      </ul>
      {!isCustom && <p className="mt-4 border-t border-line pt-3 text-sm text-muted">Sized by {limitText}. Drag to see how cost, subsidy and payback change.</p>}
      {isCustom && <p className="mt-4 border-t border-line pt-3 text-sm text-muted">Subsidy at {plan.kw} kW: {formatInr(plan.subsidy)}.</p>}
    </section>
  );
}
