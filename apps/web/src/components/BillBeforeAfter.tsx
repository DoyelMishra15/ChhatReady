import { formatInr } from '@chhatready/engine';
import { CountUp } from './CountUp';

/** The one memorable moment on the Plan screen: your own bill, before and after solar. */
export function BillBeforeAfter({ before, saved }: { before: number; saved: number }) {
  const savedClamped = Math.min(Math.max(saved, 0), before);
  const after = before - savedClamped;
  const pctSaved = before > 0 ? (savedClamped / before) * 100 : 0;
  return (
    <section aria-labelledby="bill-heading" className="rounded-[1.5rem] border border-line bg-surface p-5 sm:p-7">
      <h2 id="bill-heading" className="text-[15px] font-semibold text-muted">
        Your monthly bill, with and without solar
      </h2>
      <div className="mt-4 grid items-end gap-5 sm:grid-cols-[1fr_auto_1fr]">
        <div>
          <p className="text-sm text-muted">Today</p>
          <p className="font-display-num text-4xl font-semibold line-through decoration-ink/30 decoration-2 sm:text-5xl">{formatInr(before)}</p>
        </div>
        <div className="hidden pb-3 text-2xl text-muted sm:block" aria-hidden>
          →
        </div>
        <div>
          <p className="text-sm text-muted">After solar, on average</p>
          <p className="font-display-num text-4xl font-semibold text-primary sm:text-5xl">
            <CountUp value={after} format={(n) => formatInr(n)} />
          </p>
        </div>
      </div>
      <div className="mt-6" role="img" aria-label={`You keep paying ${formatInr(after)} a month and save ${formatInr(savedClamped)}, about ${Math.round(pctSaved)} percent`}>
        <div className="flex h-5 overflow-hidden rounded-full bg-ink/10">
          <div className="h-full bg-ink/80 transition-[width] duration-500" style={{ width: `${100 - pctSaved}%` }} />
          <div className="h-full origin-left bg-sun transition-[width] duration-500" style={{ width: `${pctSaved}%` }} />
        </div>
        <div className="mt-2 flex justify-between gap-4 text-sm">
          <span className="text-muted">You still pay {formatInr(after)}: fixed charges, duty and the units solar cannot cover</span>
          <span className="shrink-0 font-semibold text-sun-strong">
            You save <CountUp value={savedClamped} format={(n) => formatInr(n)} /> a month
          </span>
        </div>
      </div>
    </section>
  );
}
