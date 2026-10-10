import { formatNumber, mergeAssumptions } from '@chhatready/engine';
import { ArrowRight, Calculator } from 'lucide-react';
import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { BillBeforeAfter } from '../components/BillBeforeAfter';
import { MonthlyChart, PaybackChart } from '../components/Charts';
import { ErrorState } from '../components/ErrorState';
import { FormulaSheet } from '../components/FormulaSheet';
import { planHeadline, PlanStats, PlanWarnings, SubsidyLedger } from '../components/PlanParts';
import { SystemSizer } from '../components/SystemSizer';
import { Button, LinkButton } from '../components/ui/button';
import { Callout } from '../components/ui/callout';
import { friendlyError } from '../lib/api';
import { toast } from '../lib/toast';
import { useCase } from '../lib/useCase';

export default function Plan() {
  const { bill, roof, plan, planError, selectedKw, setSelectedKw, assumptions, setAssumptions, caseId, saveFailed, saveNow } = useCase();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!bill) return <Navigate to={`/c/${caseId}/review`} replace />;
  if (!roof) return <Navigate to={`/c/${caseId}/roof`} replace />;
  if (planError || !plan) {
    return (
      <div className="container-page py-12">
        <ErrorState
          title={planError?.code === 'ROOF_TOO_SMALL' ? 'Your roof is too small for a rooftop system' : 'We could not work out your plan'}
          message={planError?.message}
          hint="Check the roof area and the figures from your bill. You can change both."
          actions={
            <>
              <LinkButton to={`/c/${caseId}/roof`}>Change roof</LinkButton>
              <LinkButton to={`/c/${caseId}/review`} variant="secondary">Check bill details</LinkButton>
            </>
          }
        />
      </div>
    );
  }

  const custom = selectedKw !== null && selectedKw !== plan.recommendedKw;
  const usable = Math.max(0, roof.areaM2 * (1 - roof.obstructionPct / 100));
  const a = mergeAssumptions(assumptions);

  const go = async () => {
    setBusy(true);
    try {
      await saveNow();
      nav(`/c/${caseId}/act`);
    } catch (e) {
      toast('error', friendlyError(e).message);
      setBusy(false);
    }
  };

  return (
    <div className="container-page pb-28 pt-8 sm:pb-12 sm:pt-10">
      <div className="grid gap-8 lg:grid-cols-[1.25fr_1fr] lg:items-start">
        <div className="space-y-6">
          <div>
            <h1 className="font-display text-[2.2rem] font-semibold leading-[1.1] sm:text-5xl">{planHeadline(plan, custom)}</h1>
            <p className="mt-3 max-w-xl text-lg text-ink/85">
              Sized from your {Math.round(bill.unitsMonth)} units a month, {Math.round(usable)} m² of open roof and {formatNumber(Math.round(plan.yieldPerKw))} units of sunshine per kW a year at your location.
            </p>
          </div>
          <BillBeforeAfter before={bill.amountMonth} saved={plan.monthlySavingsYear1} />
        </div>
        <div className="lg:sticky lg:top-6">
          <SystemSizer plan={plan} onChange={setSelectedKw} isCustom={custom} />
        </div>
      </div>

      <div className="mt-8 space-y-8">
        <PlanStats plan={plan} />
        <PlanWarnings plan={plan} />
        {saveFailed && (
          <Callout kind="warn" title="We could not save your latest change" action={<Button size="sm" variant="secondary" onClick={() => void saveNow().catch(() => toast('error', 'Still could not save. Check your connection.'))}>Try saving again</Button>}>
            The numbers on screen are still correct.
          </Callout>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <section aria-labelledby="pay-h" className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
            <h2 id="pay-h" className="font-display text-2xl">When it pays for itself</h2>
            <p className="mb-3 mt-1 text-sm text-muted">Your cash position over 25 years, after the system and its upkeep.</p>
            <PaybackChart plan={plan} />
          </section>
          <section aria-labelledby="mon-h" className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
            <h2 id="mon-h" className="font-display text-2xl">Solar against your usage</h2>
            <p className="mb-3 mt-1 text-sm text-muted">Units per month. Summer months make the most, the monsoon the least.</p>
            <MonthlyChart plan={plan} />
          </section>
        </div>

        <SubsidyLedger plan={plan} />

        <section className="flex flex-col gap-3 rounded-2xl bg-ink p-5 text-white sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <h2 className="font-display text-2xl">Do not take our word for it</h2>
            <p className="mt-1 max-w-xl text-white/80">Every step is plain arithmetic on your bill. Open it, change any assumption, and watch the numbers move.</p>
          </div>
          <Button variant="sun" size="lg" onClick={() => setOpen(true)}>
            <Calculator className="size-5" aria-hidden /> How we calculated this
          </Button>
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 p-3 backdrop-blur sm:static sm:z-auto sm:mt-8 sm:border-0 sm:bg-transparent sm:p-0">
        <div className="container-page flex flex-col gap-2 px-0 sm:flex-row sm:items-center sm:justify-between sm:px-0">
          <Link to={`/c/${caseId}/roof`} className="hidden min-h-11 items-center font-semibold text-muted hover:text-ink sm:inline-flex">Change roof</Link>
          <Button size="lg" onClick={() => void go()} loading={busy} className="w-full sm:w-auto">
            Continue to your application pack <ArrowRight className="size-5" aria-hidden />
          </Button>
        </div>
      </div>

      <FormulaSheet open={open} onOpenChange={setOpen} plan={plan} unitsMonth={bill.unitsMonth} amountMonth={bill.amountMonth} usableRoofM2={usable} assumptions={assumptions} onChange={setAssumptions} />
      <span className="sr-only">Area per kW {a.areaPerKwM2}</span>
    </div>
  );
}
