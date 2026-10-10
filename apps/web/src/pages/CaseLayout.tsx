import { useEffect } from 'react';
import { Navigate, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ErrorState, PageSkeleton } from '../components/ErrorState';
import { StepBar, STEPS } from '../components/StepBar';
import { Button, LinkButton } from '../components/ui/button';
import { CaseProvider, useCase } from '../lib/useCase';
import { forgetCase } from '../lib/storage';

function Inner() {
  const { caseId, loading, error, bill, roof, plan, reload } = useCase();
  const loc = useLocation();
  const nav = useNavigate();
  const seg = loc.pathname.split('/')[3] ?? '';
  const stepIndex = Math.max(0, STEPS.findIndex((s) => s.key === seg || (seg === 'quote' && s.key === 'act')));
  const maxReachable = !bill ? 0 : !roof ? 1 : !plan ? 2 : 3;

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [seg]);

  if (loading) return <PageSkeleton />;
  if (error) {
    const gone = error.code === 'NOT_FOUND';
    return (
      <div className="container-page py-12">
        <ErrorState
          title={gone ? 'We could not find this plan' : 'We could not load your plan'}
          message={error.message}
          hint={gone ? 'Plans are kept for 30 days and can be deleted at any time. Start again with a new bill.' : error.hint}
          actions={
            <>
              {!gone && <Button onClick={() => void reload()}>Try again</Button>}
              <LinkButton to="/" variant={gone ? 'primary' : 'secondary'} onClick={() => forgetCase()}>Start a new plan</LinkButton>
            </>
          }
        />
      </div>
    );
  }
  void nav;
  return (
    <>
      <StepBar caseId={caseId} current={stepIndex} maxReachable={maxReachable} />
      <Outlet />
    </>
  );
}

export function CaseLayout() {
  const { id = '' } = useParams();
  return (
    <CaseProvider caseId={id} key={id}>
      <Inner />
    </CaseProvider>
  );
}

/** /c/:id goes to the furthest sensible step. */
export function CaseIndex() {
  const { id = '' } = useParams();
  return <Navigate to={`/c/${id}/plan`} replace />;
}
