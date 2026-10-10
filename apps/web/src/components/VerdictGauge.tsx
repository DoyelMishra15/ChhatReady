import { formatInr, type QuoteVerdict } from '@chhatready/engine';
import { cn } from '../lib/cn';

const label = { below: 'Below the typical range', in: 'In the typical range', above: 'Above the typical range', unknown: 'Needs a price and size' } as const;
const tone = { below: 'text-warn', in: 'text-ok', above: 'text-danger', unknown: 'text-muted' } as const;

export function VerdictGauge({ verdict }: { verdict: QuoteVerdict }) {
  const { expectedLow: lo, expectedHigh: hi, quotedPrice: price } = verdict;
  if (lo === null || hi === null || price === null) {
    return <p className="rounded-2xl border border-line bg-surface p-5 text-muted">Type the total price and system size below and we will compare them with typical market prices.</p>;
  }
  const min = Math.min(lo * 0.6, price * 0.9);
  const max = Math.max(hi * 1.4, price * 1.1);
  const pos = (v: number) => `${((v - min) / (max - min)) * 100}%`;
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <p className={cn('font-display text-2xl', tone[verdict.band])}>{label[verdict.band]}</p>
      <p className="mt-1 text-[15px] text-muted">
        {verdict.band === 'above' && verdict.deltaInr !== null && `${formatInr(verdict.deltaInr)} more than the top of the range for ${verdict.quotedKw} kW.`}
        {verdict.band === 'below' && verdict.deltaInr !== null && `${formatInr(verdict.deltaInr)} less than the bottom of the range for ${verdict.quotedKw} kW.`}
        {verdict.band === 'in' && `Within the typical ${formatInr(lo)} to ${formatInr(hi)} for ${verdict.quotedKw} kW.`}
      </p>
      <div className="relative mt-8 h-3 rounded-full bg-ink/10" role="img" aria-label={`Quoted ${formatInr(price)}. Typical range ${formatInr(lo)} to ${formatInr(hi)}.`}>
        <div className="absolute inset-y-0 rounded-full bg-primary/30" style={{ left: pos(lo), width: `calc(${pos(hi)} - ${pos(lo)})` }} />
        <div className="absolute -top-7 -translate-x-1/2 text-center" style={{ left: pos(price) }}>
          <span className="block whitespace-nowrap text-xs font-bold">{formatInr(price)}</span>
          <span className={cn('mx-auto block h-2 w-0.5', verdict.band === 'in' ? 'bg-ok' : verdict.band === 'above' ? 'bg-danger' : 'bg-warn')} />
        </div>
        <div className={cn('absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white shadow-float', verdict.band === 'in' ? 'bg-ok' : verdict.band === 'above' ? 'bg-danger' : 'bg-warn')} style={{ left: pos(price) }} />
      </div>
      <div className="mt-3 flex justify-between text-xs text-muted tnum">
        <span>Typical low {formatInr(lo)}</span>
        <span>Typical high {formatInr(hi)}</span>
      </div>
      {verdict.pricePerKw !== null && <p className="mt-3 text-sm text-muted">That is {formatInr(verdict.pricePerKw)} per kW. Typical complete systems run {formatInr(lo / (verdict.quotedKw ?? 1))} to {formatInr(hi / (verdict.quotedKw ?? 1))} per kW.</p>}
    </div>
  );
}
