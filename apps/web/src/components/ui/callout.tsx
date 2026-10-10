import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

const styles = {
  info: { box: 'border-primary/20 bg-primary-soft', icon: 'text-primary', Icon: Info },
  warn: { box: 'border-warn/25 bg-warn-soft', icon: 'text-warn', Icon: TriangleAlert },
  danger: { box: 'border-danger/25 bg-danger-soft', icon: 'text-danger', Icon: CircleAlert },
  ok: { box: 'border-ok/25 bg-primary-soft', icon: 'text-ok', Icon: CircleCheck },
  sun: { box: 'border-sun/40 bg-sun-soft', icon: 'text-sun-strong', Icon: Info }
} as const;

export function Callout({ kind = 'info', title, children, className, action }: { kind?: keyof typeof styles; title?: string; children?: ReactNode; className?: string; action?: ReactNode }) {
  const s = styles[kind];
  return (
    <div role={kind === 'danger' || kind === 'warn' ? 'alert' : 'status'} className={cn('flex gap-3 rounded-2xl border p-4 text-[15px]', s.box, className)}>
      <s.Icon className={cn('mt-0.5 size-5 shrink-0', s.icon)} aria-hidden />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn('text-ink/85', title && 'mt-0.5')}>{children}</div>}
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  );
}
