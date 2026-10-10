import { Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../lib/cn';

export const STEPS = [
  { key: 'review', label: 'Bill' },
  { key: 'roof', label: 'Roof' },
  { key: 'plan', label: 'Plan' },
  { key: 'act', label: 'Act' }
] as const;

export function StepBar({ caseId, current, maxReachable }: { caseId: string; current: number; maxReachable: number }) {
  return (
    <nav aria-label="Progress" className="border-b border-line bg-paper/90">
      <div className="container-page py-3">
        {/* Phone: one line of text and a thin progress track */}
        <div className="sm:hidden">
          <p className="text-sm font-semibold">
            Step {current + 1} of {STEPS.length}: {STEPS[current].label}
          </p>
          <div className="mt-2 h-1.5 rounded-full bg-line">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${((current + 1) / STEPS.length) * 100}%` }} />
          </div>
        </div>
        <ol className="hidden items-center sm:flex">
          {STEPS.map((s, i) => {
            const done = i < current;
            const reachable = i <= maxReachable && i !== current;
            const inner = (
              <span className="flex items-center gap-2.5">
                <span className={cn('flex size-7 items-center justify-center rounded-full text-sm font-bold', i === current ? 'bg-sun text-ink' : done ? 'bg-primary text-white' : 'border border-line bg-surface text-muted')}>
                  {done ? <Check className="size-4" aria-hidden /> : i + 1}
                </span>
                <span className={cn('text-[15px] font-semibold', i === current ? 'text-ink' : 'text-muted')}>{s.label}</span>
              </span>
            );
            return (
              <li key={s.key} className="flex flex-1 items-center last:flex-none" aria-current={i === current ? 'step' : undefined}>
                {reachable ? (
                  <Link to={`/c/${caseId}/${s.key}`} className="rounded-lg py-1 hover:opacity-80">
                    {inner}
                  </Link>
                ) : (
                  inner
                )}
                {i < STEPS.length - 1 && <span className={cn('mx-4 h-px flex-1', i < current ? 'bg-primary' : 'bg-line')} aria-hidden />}
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
