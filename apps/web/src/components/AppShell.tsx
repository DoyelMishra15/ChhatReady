import { useEffect, useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { api } from '../lib/api';
import { LogoMark } from './Logo';

function useMode() {
  const [mode, setMode] = useState<'mock' | 'aws' | null>(null);
  useEffect(() => {
    api.health().then((h) => setMode(h.mode)).catch(() => setMode(null));
  }, []);
  return mode;
}

export function AppShell() {
  const mode = useMode();
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2 focus:text-white">
        Skip to content
      </a>
      {mode === 'mock' && (
        <div className="bg-sun-soft px-4 py-2 text-center text-sm font-medium text-ink">
          Local demo mode: files are read from saved samples and emails are saved to a folder, not sent.
        </div>
      )}
      <header className="border-b border-line bg-paper">
        <div className="container-page flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 rounded-lg" aria-label="ChhatReady home">
            <LogoMark />
            <span className="font-display text-2xl leading-none">ChhatReady</span>
          </Link>
          <nav className="flex items-center gap-1 text-[15px] font-semibold" aria-label="Site">
            <Link to="/#how" className="flex min-h-11 items-center rounded-xl px-3 hover:bg-ink/5">How it works</Link>
            <Link to="/privacy" className="flex min-h-11 items-center rounded-xl px-3 hover:bg-ink/5">Privacy</Link>
          </nav>
        </div>
      </header>
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-line bg-paper">
        <div className="container-page py-8 text-sm text-muted">
          <p className="max-w-3xl">
            Indicative estimates only. Subsidy, net-metering rules and prices vary by state, DISCOM and installer. Confirm everything on{' '}
            <a className="font-semibold text-primary underline" href="https://pmsuryaghar.gov.in" target="_blank" rel="noreferrer">pmsuryaghar.gov.in</a> and with your DISCOM before you buy.
          </p>
          <p className="mt-2">Built for the WeMakeDevs Environmental Hacks. Not affiliated with the Government of India.</p>
        </div>
      </footer>
    </div>
  );
}
