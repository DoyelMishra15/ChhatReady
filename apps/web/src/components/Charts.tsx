import { formatInr, formatInrCompact, type Plan } from '@chhatready/engine';
import { Area, AreaChart, Bar, CartesianGrid, ComposedChart, Line, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { C } from '../lib/tokens';

const axisTick = { fill: C.muted, fontSize: 12 };

export function PaybackChart({ plan }: { plan: Plan }) {
  const data = [{ year: 0, net: -plan.netCost }, ...plan.years.map((y) => ({ year: y.year, net: Math.round(y.net) }))];
  const min = Math.min(...data.map((d) => d.net));
  const max = Math.max(...data.map((d) => d.net));
  const zeroOffset = max <= 0 ? 0 : min >= 0 ? 1 : max / (max - min);
  const paybackLabel = plan.paybackYears === null ? 'does not pay back within 25 years' : `pays back in ${plan.paybackYears.toFixed(1)} years`;
  return (
    <div role="img" aria-label={`Cumulative cash position over 25 years. The system ${paybackLabel} and ends at ${formatInr(plan.savings25)} ahead.`}>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="splitFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={C.primary} stopOpacity={0.35} />
              <stop offset={zeroOffset} stopColor={C.primary} stopOpacity={0.08} />
              <stop offset={zeroOffset} stopColor={C.sun} stopOpacity={0.12} />
              <stop offset="1" stopColor={C.sun} stopOpacity={0.45} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={C.line} vertical={false} />
          <XAxis dataKey="year" tick={axisTick} tickLine={false} axisLine={{ stroke: C.line }} ticks={[0, 5, 10, 15, 20, 25]} tickFormatter={(v) => `Yr ${v}`} />
          <YAxis tick={axisTick} tickLine={false} axisLine={false} width={64} tickFormatter={(v) => formatInrCompact(v as number)} />
          <Tooltip
            cursor={{ stroke: C.muted, strokeDasharray: '3 3' }}
            contentStyle={{ borderRadius: 12, border: `1px solid ${C.line}`, boxShadow: '0 8px 24px rgba(20,32,26,.12)' }}
            labelFormatter={(y) => `After ${y} year${y === 1 ? '' : 's'}`}
            formatter={(v) => [(v as number) >= 0 ? `${formatInr(v as number)} ahead` : `${formatInr(Math.abs(v as number))} still to recover`, 'Position']}
          />
          <ReferenceLine y={0} stroke={C.ink} strokeOpacity={0.5} />
          <Area type="monotone" dataKey="net" stroke={C.primary} strokeWidth={2.5} fill="url(#splitFill)" isAnimationActive animationDuration={700} />
          {plan.paybackYears !== null && <ReferenceDot x={Math.round(plan.paybackYears)} y={0} r={0} label={{ value: `Break-even ${plan.paybackYears.toFixed(1)} yrs`, position: 'top', fill: C.primary, fontSize: 12, fontWeight: 700 }} />}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MonthlyChart({ plan }: { plan: Plan }) {
  return (
    <div role="img" aria-label={`Monthly solar generation compared with your usage of about ${plan.monthly[0].usage} units a month.`}>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={plan.monthly} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={C.line} vertical={false} />
          <XAxis dataKey="month" tick={axisTick} tickLine={false} axisLine={{ stroke: C.line }} />
          <YAxis tick={axisTick} tickLine={false} axisLine={false} width={44} />
          <Tooltip cursor={{ fill: C.line, fillOpacity: 0.4 }} contentStyle={{ borderRadius: 12, border: `1px solid ${C.line}`, boxShadow: '0 8px 24px rgba(20,32,26,.12)' }} formatter={(v, name) => [`${v} units`, name === 'generation' ? 'Solar generates' : 'You use']} />
          <Bar dataKey="generation" fill={C.primary} radius={[6, 6, 0, 0]} maxBarSize={28} isAnimationActive animationDuration={600} />
          <Line type="monotone" dataKey="usage" stroke={C.sun} strokeWidth={2.5} strokeDasharray="6 4" dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
        <span className="inline-flex items-center gap-2"><span className="inline-block size-3 rounded-sm bg-primary" aria-hidden />Solar generates (units)</span>
        <span className="inline-flex items-center gap-2"><span className="inline-block h-0.5 w-5 bg-sun" aria-hidden />You use, on average</span>
      </div>
    </div>
  );
}
