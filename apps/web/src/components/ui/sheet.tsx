import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

export function Sheet({ open, onOpenChange, title, description, children }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: string; children: ReactNode }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/40 data-[state=open]:animate-[fadeIn_.2s_ease-out]" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[560px] flex-col bg-paper shadow-float outline-none data-[state=open]:animate-[sheetIn_.25s_ease-out]">
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
            <div>
              <Dialog.Title className="font-display text-2xl">{title}</Dialog.Title>
              {description ? <Dialog.Description className="mt-1 text-sm text-muted">{description}</Dialog.Description> : <Dialog.Description className="sr-only">{title}</Dialog.Description>}
            </div>
            <Dialog.Close className="-mr-2 flex size-11 items-center justify-center rounded-xl text-muted hover:bg-ink/5" aria-label="Close">
              <X className="size-5" />
            </Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function Modal({ open, onOpenChange, title, description, children }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: string; children: ReactNode }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/40 data-[state=open]:animate-[fadeIn_.2s_ease-out]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-paper p-6 shadow-float outline-none">
          <Dialog.Title className="font-display text-2xl">{title}</Dialog.Title>
          {description && <Dialog.Description className="mt-2 text-[15px] text-muted">{description}</Dialog.Description>}
          <div className="mt-5">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
