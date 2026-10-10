import { useSyncExternalStore } from 'react';

export interface ToastItem {
  id: number;
  kind: 'success' | 'error' | 'info';
  text: string;
}

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function toast(kind: ToastItem['kind'], text: string, ms = 4200) {
  const id = nextId++;
  items = [...items, { id, kind, text }].slice(-3);
  emit();
  setTimeout(() => dismissToast(id), ms);
}

export function dismissToast(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

export function useToasts(): ToastItem[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => items
  );
}
