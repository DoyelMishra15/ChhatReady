import { RFQ_CONFIRMATIONS, SUBSIDY_RULE, formatInr, formatInrCompact, formatNumber, formatYears, type Assumptions, type BillInput, type Plan } from '@chhatready/engine';
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

export interface PackData {
  ref: string;
  bill: BillInput;
  roofUsableM2: number | null;
  plan: Plan;
  assumptions: Assumptions;
}

const C = { ink: '#14201A', muted: '#5B685F', line: '#E7E2D6', primary: '#0B6B4F', soft: '#E3F2EB', sun: '#F5A524', sunSoft: '#FFF3DC', paper: '#FAF8F3' };

const s = StyleSheet.create({
  page: { fontFamily: 'Jakarta', fontSize: 10, color: C.ink, paddingTop: 36, paddingBottom: 56, paddingHorizontal: 40, lineHeight: 1.45, backgroundColor: '#FFFFFF' },
  band: { backgroundColor: C.primary, borderRadius: 10, padding: 18, marginBottom: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  brand: { color: '#FFFFFF', fontFamily: 'Fraunces', fontWeight: 600, fontSize: 22, lineHeight: 1.2 },
  bandSub: { color: '#D7EFE5', fontSize: 10, marginTop: 4 },
  bandRight: { color: '#D7EFE5', fontSize: 9, textAlign: 'right' },
  h1: { fontFamily: 'Fraunces', fontWeight: 600, fontSize: 20, lineHeight: 1.25, marginBottom: 6 },
  h2: { fontFamily: 'Fraunces', fontWeight: 600, fontSize: 13.5, lineHeight: 1.25, marginTop: 10, marginBottom: 4 },
  lead: { color: C.muted, marginBottom: 10 },
  kpis: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  kpi: { flex: 1, borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 10 },
  kpiHot: { flex: 1, backgroundColor: C.primary, borderRadius: 8, padding: 10 },
  kpiLabel: { fontSize: 8.5, color: C.muted },
  kpiLabelHot: { fontSize: 8.5, color: '#D7EFE5' },
  kpiValue: { fontFamily: 'Fraunces', fontWeight: 600, fontSize: 17, marginTop: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3.5, borderBottomWidth: 0.75, borderBottomColor: C.line },
  rowLabel: { color: C.muted, flex: 1, paddingRight: 10 },
  rowValue: { fontWeight: 600, textAlign: 'right', maxWidth: 260 },
  note: { fontSize: 8.5, color: C.muted, marginTop: 8 },
  callout: { backgroundColor: C.sunSoft, borderRadius: 8, padding: 10, marginTop: 10, fontSize: 9.5 },
  step: { flexDirection: 'row', gap: 10, paddingVertical: 9, borderBottomWidth: 0.75, borderBottomColor: C.line },
  stepNum: { width: 22, height: 22, borderRadius: 11, backgroundColor: C.soft, color: C.primary, textAlign: 'center', fontWeight: 700, paddingTop: 4, fontSize: 10 },
  stepTitle: { fontWeight: 700, fontSize: 11 },
  stepBody: { color: '#2b3a32', marginTop: 2 },
  have: { backgroundColor: C.paper, borderWidth: 0.75, borderColor: C.line, borderRadius: 6, padding: 6, marginTop: 5, fontSize: 9 },
  check: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  box: { width: 11, height: 11, borderWidth: 1, borderColor: C.ink, borderRadius: 2, marginTop: 1.5 },
  th: { flexDirection: 'row', backgroundColor: C.soft, borderRadius: 4, paddingVertical: 5, paddingHorizontal: 6, fontWeight: 700 },
  td: { flexDirection: 'row', borderBottomWidth: 0.75, borderBottomColor: C.line, paddingVertical: 12, paddingHorizontal: 6 },
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', fontSize: 8, color: C.muted, borderTopWidth: 0.75, borderTopColor: C.line, paddingTop: 6 }
});

const Row = ({ label, value }: { label: string; value: string }) => (
  <View style={s.row} wrap={false}>
    <Text style={s.rowLabel}>{label}</Text>
    <Text style={s.rowValue}>{value}</Text>
  </View>
);

const Footer = ({ refId }: { refId: string }) => (
  <View style={s.footer} fixed>
    <Text>ChhatReady, reference {refId}. Indicative estimates only. Confirm everything on pmsuryaghar.gov.in and with your DISCOM.</Text>
    <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
  </View>
);

const Header = ({ title, d }: { title: string; d: PackData }) => (
  <View style={s.band}>
    <View>
      <Text style={s.brand}>ChhatReady</Text>
      <Text style={s.bandSub}>{title}</Text>
    </View>
    <View>
      <Text style={s.bandRight}>Reference {d.ref}</Text>
    </View>
  </View>
);

const Kpi = ({ label, value, hot }: { label: string; value: string; hot?: boolean }) => (
  <View style={hot ? s.kpiHot : s.kpi}>
    <Text style={hot ? s.kpiLabelHot : s.kpiLabel}>{label}</Text>
    <Text style={[s.kpiValue, hot ? { color: '#FFFFFF' } : {}]}>{value}</Text>
  </View>
);

const Check = ({ children }: { children: string }) => (
  <View style={s.check} wrap={false}>
    <View style={s.box} />
    <Text style={{ flex: 1 }}>{children}</Text>
  </View>
);

const STEPS: { title: string; body: (d: PackData) => string; have?: (d: PackData) => string[] }[] = [
  {
    title: 'Register on the national portal',
    body: () => 'Go to pmsuryaghar.gov.in. Choose your state and electricity company, then enter your consumer number, mobile number and email to register.',
    have: (d) => [`Consumer number: ${d.bill.consumerNumber || 'from your bill'}`, `Electricity company: ${d.bill.discom || 'from your bill'}`]
  },
  {
    title: 'Apply for a rooftop solar connection',
    body: (d) => `Apply on the portal and wait for your electricity company to approve feasibility. Our recommendation is ${d.plan.kw} kW.${d.bill.sanctionedLoadKw ? ` Your sanctioned load is ${d.bill.sanctionedLoadKw} kW, which may limit the size they approve.` : ''}`,
    have: (d) => [`System size to request: ${d.plan.kw} kW`, `Sanctioned load: ${d.bill.sanctionedLoadKw ? `${d.bill.sanctionedLoadKw} kW` : 'not on your bill'}`]
  },
  {
    title: 'Choose an installer and compare quotes',
    body: () => 'Pick an installer registered with the scheme. Send the quote request on page 4 to two or three of them and compare the replies with the checklist on page 3. Ask for written confirmation that the modules qualify for the subsidy.'
  },
  {
    title: 'Get it installed',
    body: () => 'Keep the invoice, the bill of materials and all warranty papers. Make sure the net meter application is part of the installer\'s scope.'
  },
  {
    title: 'Net meter and inspection',
    body: () => 'Submit the installation details on the portal. Your electricity company installs the net meter, inspects the system and issues a commissioning certificate.'
  },
  {
    title: 'Claim your subsidy',
    body: (d) => `Add your bank account details and a cancelled cheque on the portal. The central subsidy of about ${formatInr(d.plan.subsidy)} is paid by direct bank transfer after inspection, usually within about 30 days. You pay the installer in full first.`
  }
];

export function ApplicationPack({ data: d }: { data: PackData }) {
  const { plan, bill } = d;
  const a = d.assumptions;
  return (
    <Document title={`ChhatReady application pack ${d.ref}`} author="ChhatReady" subject="Rooftop solar plan and PM Surya Ghar application pack">
      {/* Page 1: the plan */}
      <Page size="A4" style={s.page}>
        <Header title="Rooftop solar plan and application pack" d={d} />
        <Text style={s.h1}>A {plan.kw} kW system for your home</Text>
        <Text style={s.lead}>Sized from {formatNumber(bill.unitsMonth)} units a month, local sunlight and your roof space.</Text>
        <View style={s.kpis}>
          <Kpi label="You pay" value={formatInr(plan.netCost)} />
          <Kpi label="Pays for itself in" value={formatYears(plan.paybackYears)} hot />
          <Kpi label="Ahead after 25 years" value={formatInrCompact(plan.savings25)} />
          <Kpi label="CO2 avoided a year" value={`${plan.tCo2PerYear.toFixed(1)} t`} />
        </View>

        <Text style={s.h2}>Your home</Text>
        <Row label="Electricity company" value={bill.discom || 'Not given'} />
        <Row label="Monthly units and bill" value={`${formatNumber(bill.unitsMonth)} units, ${formatInr(bill.amountMonth)}`} />
        <Row label="What you pay per unit, all charges included" value={`Rs ${plan.effectiveRate.toFixed(2)}`} />
        <Row label="Sanctioned load" value={bill.sanctionedLoadKw ? `${bill.sanctionedLoadKw} kW` : 'Not on your bill'} />
        <Row label="Open, usable roof area" value={d.roofUsableM2 === null ? 'Not set' : `${Math.round(d.roofUsableM2)} m²`} />

        <Text style={s.h2}>The system</Text>
        <Row label="Recommended size" value={`${plan.recommendedKw} kW${plan.kw !== plan.recommendedKw ? ` (this plan uses ${plan.kw} kW)` : ''}`} />
        <Row label="Sunlight at your location" value={`${formatNumber(plan.yieldPerKw)} units per kW a year`} />
        <Row label="Electricity made in year 1" value={`${formatNumber(plan.genYear1)} units (${formatNumber(plan.usefulGenYear1)} used by you)`} />
        <Row label="Saved in year 1" value={`${formatInr(plan.savingsYear1)} (${formatInr(plan.monthlySavingsYear1)} a month)`} />

        <Text style={s.h2}>Cost and subsidy</Text>
        <Row label={plan.costSource === 'quote' ? 'Price from your quote' : `Typical market price (${formatInr(plan.costBand.low)} to ${formatInr(plan.costBand.high)})`} value={formatInr(plan.grossCost)} />
        {plan.subsidyLines.map((l) => (
          <Row key={l.label} label={`Central subsidy, ${l.label}: ${l.kw} kW x ${formatInr(l.perKw)}`} value={`- ${formatInr(l.amount)}`} />
        ))}
        <Row label="You pay" value={formatInr(plan.netCost)} />

        <View style={s.callout}>
          <Text>
            Assumptions: you cover {Math.round(a.offsetTarget * 100)}% of your use, solar saves {Math.round(a.avoidedRateFactor * 100)}% of your per-unit cost, electricity prices rise {a.tariffEscalationPct}% a year, panels lose {a.degradationPct}% output a year, upkeep is {formatInr(a.omPerKwPerYear)} per kW a year, and the inverter is replaced in year {a.inverterReplacementYear}. Grid CO2 factor {a.gridEmissionFactor} t per MWh.
          </Text>
        </View>
        <Text style={s.note}>Subsidy rule: {SUBSIDY_RULE.scheme}. State top-ups are not included. Final size and price depend on your electricity company's feasibility check and the installer's site survey.</Text>
        <Footer refId={d.ref} />
      </Page>

      {/* Page 2: steps */}
      <Page size="A4" style={s.page}>
        <Header title="Your next six steps" d={d} />
        <Text style={s.lead}>These are the typical steps. Portal screens and requirements can change, so confirm each one on pmsuryaghar.gov.in.</Text>
        {STEPS.map((st, i) => (
          <View key={st.title} style={s.step} wrap={false}>
            <Text style={s.stepNum}>{i + 1}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.stepTitle}>{st.title}</Text>
              <Text style={s.stepBody}>{st.body(d)}</Text>
              {st.have && (
                <View style={s.have}>
                  <Text style={{ fontWeight: 700, marginBottom: 2 }}>Have ready</Text>
                  {st.have(d).map((h) => (
                    <Text key={h}>{h}</Text>
                  ))}
                </View>
              )}
            </View>
          </View>
        ))}
        <Footer refId={d.ref} />
      </Page>

      {/* Page 3: documents and checks */}
      <Page size="A4" style={s.page}>
        <Header title="Documents and checks" d={d} />
        <Text style={s.h2}>Documents to keep ready</Text>
        <Text style={s.lead}>Commonly asked for. Your electricity company may ask for more.</Text>
        {['A recent electricity bill', 'Mobile number and email address linked to your electricity connection', 'Proof that you own the house or roof', 'Bank account details and a cancelled cheque, for the subsidy', 'Photo ID, as the portal or your electricity company asks', 'Installer invoice, bill of materials and warranty papers, once installed', 'Commissioning certificate from your electricity company, after inspection'].map((t) => (
          <Check key={t}>{t}</Check>
        ))}
        <Text style={s.h2}>Before you sign with an installer</Text>
        {['The quote names the exact module make and model, and confirms in writing that they qualify for the central subsidy (DCR and ALMM-listed).', 'The DISCOM application, net meter and inspection are included, and the installer says who files them.', 'You have the warranty terms in writing: module performance, inverter and workmanship.', 'The price says whether GST is included, and you have a bill of materials.', `The price is close to the typical ${formatInr(plan.costBand.low)} to ${formatInr(plan.costBand.high)} for ${plan.kw} kW. Ask why if it is far above or far below.`, 'You know what happens if the subsidy is delayed or rejected.', 'Payment is staged, not all upfront.'].map((t) => (
          <Check key={t}>{t}</Check>
        ))}
        <View style={s.callout}>
          <Text>Tip: a much lower price can mean non-compliant modules or missing paperwork. Use Check a quote in ChhatReady to compare any quote you receive.</Text>
        </View>
        <Footer refId={d.ref} />
      </Page>

      {/* Page 4: installer spec */}
      <Page size="A4" style={s.page}>
        <Header title="Quote request for installers" d={d} />
        <Text style={s.lead}>Share this page with up to three installers and compare their replies side by side.</Text>
        <Text style={s.h2}>My requirement</Text>
        <Row label="System size" value={`${plan.kw} kW grid-connected rooftop solar (open to your suggestion)`} />
        <Row label="Expected generation" value={`About ${formatNumber(plan.genYear1)} units a year`} />
        <Row label="Monthly consumption" value={`About ${formatNumber(bill.unitsMonth)} units`} />
        <Row label="Sanctioned load" value={bill.sanctionedLoadKw ? `${bill.sanctionedLoadKw} kW` : 'Not shown on bill'} />
        <Row label="Electricity company" value={bill.discom || 'Not given'} />
        <Row label="Usable roof area (my estimate)" value={d.roofUsableM2 === null ? 'Not set' : `About ${Math.round(d.roofUsableM2)} m²`} />
        <Text style={s.h2}>Please confirm in your quote</Text>
        {RFQ_CONFIRMATIONS.map((t, i) => (
          <View key={t} style={s.check} wrap={false}>
            <Text style={{ width: 14, fontWeight: 700 }}>{i + 1}.</Text>
            <Text style={{ flex: 1 }}>{t}</Text>
          </View>
        ))}
        <Text style={s.h2}>Compare the replies</Text>
        <View style={s.th}>
          {['Installer', 'Total price', 'Module make', 'Warranty', 'Net meter included'].map((h) => (
            <Text key={h} style={{ flex: 1, fontSize: 9 }}>{h}</Text>
          ))}
        </View>
        {[0, 1, 2].map((i) => (
          <View key={i} style={s.td}>
            {[0, 1, 2, 3, 4].map((j) => (
              <Text key={j} style={{ flex: 1 }}> </Text>
            ))}
          </View>
        ))}
        <Footer refId={d.ref} />
      </Page>
    </Document>
  );
}
