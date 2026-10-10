import { Check, CircleHelp, Pencil, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

export type ChipState = 'high' | 'check' | 'edited' | 'missing';

export function chipFor(confidence: number | undefined, hasValue: boolean, edited: boolean): ChipState {
  if (edited) return 'edited';
  if (!hasValue) return 'missing';
  return (confidence ?? 0) >= 0.8 ? 'high' : 'check';
}

const chipStyle: Record<ChipState, { cls: string; label: string; Icon: typeof Check }> = {
  high: { cls: 'bg-primary-soft text-primary', label: 'Read clearly', Icon: Check },
  check: { cls: 'bg-sun-soft text-warn', label: 'Please check', Icon: TriangleAlert },
  edited: { cls: 'bg-ink/5 text-ink', label: 'You edited', Icon: Pencil },
  missing: { cls: 'bg-warn-soft text-warn', label: 'Not found', Icon: CircleHelp }
};

export function ConfidenceChip({ state }: { state: ChipState }) {
  const s = chipStyle[state];
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold', s.cls)}>
      <s.Icon className="size-3.5" aria-hidden />
      {s.label}
    </span>
  );
}

export function FieldRow({ id, label, value, onChange, chip, helper, suffix, inputMode, error, highlight, onFocus, onBlur, placeholder }: { id: string; label: string; value: string; onChange: (v: string) => void; chip?: ChipState; helper?: ReactNode; suffix?: string; inputMode?: 'text' | 'decimal' | 'numeric'; error?: string; highlight?: boolean; onFocus?: () => void; onBlur?: () => void; placeholder?: string }) {
  const attention = chip === 'check' || chip === 'missing';
  return (
    <div className={cn('border-b border-line py-4 last:border-b-0', highlight && 'bg-primary-soft/50')}>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-[15px] font-semibold">
          {label}
        </label>
        {chip && <ConfidenceChip state={chip} />}
      </div>
      <div className="relative mt-2">
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          inputMode={inputMode}
          placeholder={placeholder}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-err` : helper ? `${id}-help` : undefined}
          className={cn('min-h-12 w-full rounded-xl border bg-surface px-3.5 text-base outline-none transition-colors focus:border-primary focus:ring-4 focus:ring-primary/15', suffix && 'pr-16', error ? 'border-danger' : attention ? 'border-sun' : 'border-line')}
        />
        {suffix && <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-sm text-muted">{suffix}</span>}
      </div>
      {error ? (
        <p id={`${id}-err`} className="mt-1.5 text-sm font-medium text-danger">
          {error}
        </p>
      ) : helper ? (
        <p id={`${id}-help`} className="mt-1.5 text-sm text-muted">
          {helper}
        </p>
      ) : null}
    </div>
  );
}
