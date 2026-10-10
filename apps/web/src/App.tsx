import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { PageSkeleton } from './components/ErrorState';
import { Toaster } from './components/Toaster';
import { CaseIndex, CaseLayout } from './pages/CaseLayout';
import Landing from './pages/Landing';
import NotFound from './pages/NotFound';
import Privacy from './pages/Privacy';
import Review from './pages/Review';

const Roof = lazy(() => import('./pages/Roof'));
const Plan = lazy(() => import('./pages/Plan'));
const Act = lazy(() => import('./pages/Act'));
const Quote = lazy(() => import('./pages/Quote'));
const Share = lazy(() => import('./pages/Share'));

export default function App() {
  return (
    <>
      <Suspense fallback={<PageSkeleton />}>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<Landing />} />
            <Route path="privacy" element={<Privacy />} />
            <Route path="s/:shareId" element={<Share />} />
            <Route path="c/:id" element={<CaseLayout />}>
              <Route index element={<CaseIndex />} />
              <Route path="review" element={<Review />} />
              <Route path="roof" element={<Roof />} />
              <Route path="plan" element={<Plan />} />
              <Route path="act" element={<Act />} />
              <Route path="quote" element={<Quote />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
      <Toaster />
    </>
  );
}
