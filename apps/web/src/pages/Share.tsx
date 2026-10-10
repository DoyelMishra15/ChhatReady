import { formatInr } from '@chhatready/engine';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { MonthlyChart, PaybackChart } from '../components/Charts';
import { ErrorState, PageSkeleton } from '../components/ErrorState';
import { planHeadline, PlanStats, PlanWarnings, SubsidyLedger } from '../components/PlanParts';
import { LinkButton } from '../components/ui/button';
import { Callout } from '../components/ui/callout';
import { api, friendlyError, type ShareResponse } from '../lib/api';

export default function Share() {
  const { shareId = '' } = useParams();
  const [data, setData] = useState<ShareResponse | null>(null);
  const [err, setErr] = useState<ReturnType<typeof friendlyError> | null>(null);

  useEffect(() => {
    let live = true;
    api.getShare(shareId).then((d) => live && setData(d)).catch((e) => live && setErr(friendlyError(e)));
    return () => { live = false; };
  }, [shareId]);

  if (err) {
    return (
      <div className="container-page py-12">
        <ErrorState title={err.code === 'NOT_FOUND' ? 'This plan is not available' : 'We could not open this plan'} message={err.code === 'NOT_FOUND' ? 'The link may have expired, or the owner deleted it.' : err.message} hint={err.hint} actions={<LinkButton to="/">Make your own plan</LinkButton>} />
      </div>
    );
  }
  if (!data) return <PageSkeleton />;
  const { plan, bill } = data;
  return (
    <div className="container-page space-y-8 py-8 sm:py-10">
      <Callout kind="info" title="Shared plan, read only">Details such as the consumer number and exact location are hidden. Reference {data.ref}.</Callout>
      <header>
        <h1 className="font-display text-[2.2rem] font-semibold leading-[1.1] sm:text-5xl">{planHeadline(plan, false)}</h1>
        <p className="mt-3 max-w-xl text-lg text-ink/85">
          For a home using about {Math.round(bill.unitsMonth)} units a month ({formatInr(bill.amountMonth)}){bill.discom ? ` with ${bill.discom}` : ''}{data.roofAreaM2 ? `, with about ${Math.round(data.roofAreaM2)} m² of roof` : ''}.
        </p>
      </header>
      <PlanStats plan={plan} />
      <PlanWarnings plan={plan} />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
          <h2 className="font-display text-2xl">When it pays for itself</h2>
          <PaybackChart plan={plan} />
        </section>
        <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
          <h2 className="font-display text-2xl">Solar against usage</h2>
          <MonthlyChart plan={plan} />
        </section>
      </div>
      <SubsidyLedger plan={plan} />
      <div className="rounded-2xl bg-ink p-6 text-white">
        <h2 className="font-display text-2xl">Want this for your own home?</h2>
        <p className="mt-1 text-white/80">Upload your electricity bill and get your own plan in about two minutes.</p>
        <LinkButton to="/" variant="sun" size="lg" className="mt-4">Start with my bill</LinkButton>
      </div>
    </div>
  );
}
