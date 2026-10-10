/** localStorage is optional. It can throw in private windows, so every access is guarded. */
const KEY = 'chhatready:lastCase';

export function rememberCase(id: string): void {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* ignore */
  }
}

export function lastCase(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function forgetCase(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
