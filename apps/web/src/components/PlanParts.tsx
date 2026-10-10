import { SUBSIDY_RULE, formatNumber, formatInr, formatInrCompact, formatYears, type Plan } from '@chhatready/engine';
import { ExternalLink } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';
import { Callout } from './ui/callout';
import { CountUp } from './CountUp';

export function StatCard({ label, children, sub, emphasis }: { label: string; children: ReactNode; sub?: ReactNode; emphasis?: boolean }) {
  return (
    <div className={cn('rounded-2xl p-5', emphasis ? 'bg-primary text-white' : 'border border-line bg-surface')}>
      <p className={cn('text-[15px] font-semibold', emphasis ? 'text-white/85' : 'text-muted')}>{label}</p>
      <p className="font-display-num mt-1 text-[2.4rem] font-semibold leading-tight">{children}</p>
      {sub && <p className={cn('mt-1 text-sm', emphasis ? 'text-white/85' : 'text-muted')}>{sub}</p>}
    </div>
  );
}

export function PlanStats({ plan }: { plan: Plan }) {
  return (
    <section aria-label="Key numbers" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="You pay" sub={`after ${formatInr(plan.subsidy)} subsidy`}>
        <CountUp value={plan.netCost} format={formatInr} />
      </StatCard>
      <StatCard label="Pays for itself in" emphasis sub={`about ${formatInr(plan.monthlySavingsYear1)} saved each month`}>
        {plan.paybackYears === null ? 'Over 25 yrs' : <CountUp value={plan.paybackYears} format={(n) => formatYears(n)} />}
      </StatCard>
      <StatCard label="Ahead after 25 years" sub="after paying for the system and upkeep">
        <CountUp value={plan.savings25} format={formatInrCompact} />
      </StatCard>
      <StatCard label="CO₂ avoided" sub={`${plan.tCo2Lifetime.toFixed(0)} t over 25 years. Projection: 1,000 homes like this avoid ${Math.round(plan.tCo2PerYear1000Homes)} t a year`}>
        <CountUp value={plan.tCo2PerYear} format={(n) => `${n.toFixed(1)} t`} /> <span className="text-lg font-semibold text-muted">a year</span>
      </StatCard>
    </section>
  );
}

export function SubsidyLedger({ plan }: { plan: Plan }) {
  const row = 'flex items-baseline justify-between gap-4 border-b border-line py-3';
  return (
    <section aria-labelledby="ledger-h" className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <h2 id="ledger-h" className="font-display text-2xl">Where the money goes</h2>
      <dl className="mt-2">
        <div className={row}>
          <dt>
            {plan.costSource === 'quote' ? 'Price from your quote' : `Typical price for ${plan.kw} kW, midpoint`}
            {plan.costSource === 'benchmark' && <span className="block text-sm text-muted">Market range {formatInr(plan.costBand.low)} to {formatInr(plan.costBand.high)}</span>}
          </dt>
          <dd className="font-semibold tnum">{formatInr(plan.grossCost)}</dd>
        </div>
        {plan.subsidyLines.map((l) => (
          <div key={l.label} className={row}>
            <dt className="text-muted">
              {l.label}: {l.kw} kW × {formatInr(l.perKw)}
            </dt>
            <dd className="tnum text-primary">− {formatInr(l.amount)}</dd>
          </div>
        ))}
        <div className={cn(row, 'border-b-0')}>
          <dt className="font-semibold">You pay</dt>
          <dd className="font-display-num text-2xl font-semibold">{formatInr(plan.netCost)}</dd>
        </div>
      </dl>
      <p className="mt-2 text-sm text-muted">
        The subsidy reaches your bank account after the DISCOM inspects the installation, so you pay the full price first.{' '}
        <a href={SUBSIDY_RULE.source} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-primary underline">
          pmsuryaghar.gov.in <ExternalLink className="size-3.5" aria-hidden />
        </a>
      </p>
    </section>
  );
}

export function PlanWarnings({ plan }: { plan: Plan }) {
  if (!plan.warnings.length) return null;
  return (
    <div className="space-y-3" aria-label="Things to know">
      {plan.warnings.map((w) => (
        <Callout key={w.code} kind={w.code === 'ABOVE_SUBSIDY_CAP' ? 'sun' : w.severity === 'warn' ? 'warn' : 'info'}>
          {w.message}
        </Callout>
      ))}
    </div>
  );
}

export function planHeadline(plan: Plan, custom: boolean): string {
  if (custom) return `Here is what a ${plan.kw} kW system would do.`;
  if (plan.limiting === 'roof') return `Your roof fits a ${plan.kw} kW system.`;
  if (plan.limiting === 'load') return `Your sanctioned load limits this to ${plan.kw} kW.`;
  return `A ${plan.kw} kW system fits your roof and your bill.`;
}
