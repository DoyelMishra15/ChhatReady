import { CircleAlert, CircleCheck, Info } from 'lucide-react';
import { useToasts } from '../lib/toast';
import { cn } from '../lib/cn';

export function Toaster() {
  const items = useToasts();
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4">
      {items.map((t) => {
        const Icon = t.kind === 'success' ? CircleCheck : t.kind === 'error' ? CircleAlert : Info;
        return (
          <div key={t.id} className={cn('pointer-events-auto flex max-w-md items-center gap-2.5 rounded-2xl px-4 py-3 text-[15px] font-medium text-white shadow-float animate-[toastIn_.2s_ease-out]', t.kind === 'error' ? 'bg-danger' : 'bg-ink')}>
            <Icon className="size-5 shrink-0" aria-hidden />
            {t.text}
          </div>
        );
      })}
    </div>
  );
}
