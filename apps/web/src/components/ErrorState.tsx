import { CircleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

export function ErrorState({ title = 'Something went wrong', message, hint, actions }: { title?: string; message?: string; hint?: string; actions?: ReactNode }) {
  return (
    <div role="alert" className="mx-auto max-w-lg rounded-3xl border border-line bg-surface p-8 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-danger-soft text-danger">
        <CircleAlert className="size-6" aria-hidden />
      </div>
      <h2 className="mt-4 font-display text-2xl">{title}</h2>
      {message && <p className="mt-2 text-ink/85">{message}</p>}
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
      {actions && <div className="mt-6 flex flex-wrap justify-center gap-3">{actions}</div>}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="container-page space-y-4 py-10" aria-busy="true" aria-label="Loading">
      <div className="skeleton h-10 w-2/3 max-w-md" />
      <div className="skeleton h-5 w-1/2 max-w-sm" />
      <div className="grid gap-4 pt-4 sm:grid-cols-2">
        <div className="skeleton h-64" />
        <div className="skeleton h-64" />
      </div>
    </div>
  );
}
