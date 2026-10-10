import type { Plan } from './types';

export interface RfqContext {
  caseRef: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  location?: string;
  note?: string;
  discom: string;
  sanctionedLoadKw: number | null;
  unitsMonth: number;
  roofAreaM2: number | null;
  plan: Pick<Plan, 'kw' | 'genYear1' | 'subsidy'>;
}

export interface RfqMessage {
  subject: string;
  text: string;
}

/** What every quote should confirm. Used in the RFQ email and on the installer page of the PDF pack. */
export const RFQ_CONFIRMATIONS = [
  'Module make, model, wattage, and that they qualify for the PM Surya Ghar central subsidy (DCR/ALMM compliance).',
  'Inverter make, model and warranty.',
  'Mounting structure material and wind-load rating.',
  'Whether the DISCOM application, net meter and inspection are included, and who files them.',
  'Module performance warranty, inverter warranty and workmanship warranty (years).',
  'Total price including GST, with a bill of materials, and your payment schedule.',
  'Estimated installation timeline and after-sales support.'
] as const;

const clean = (s: string | undefined, max: number) =>
  (s ?? '').replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, max);

export function rfqSubject(kw: number, caseRef: string): string {
  return `Quote request: ${kw} kW rooftop solar (PM Surya Ghar), ref ${caseRef}`;
}

/** Plain-text RFQ. Never includes the consumer number. Same function powers the preview, the email and mailto. */
export function buildRfq(ctx: RfqContext): RfqMessage {
  const name = clean(ctx.contactName, 60) || 'A homeowner';
  const lines: string[] = [
    'Hello,',
    '',
    `I am planning a grid-connected rooftop solar system for my home and would like a written quote.`,
    '',
    'MY REQUIREMENT',
    `- System size: ${ctx.plan.kw} kW (open to your suggestion if you recommend a different size)`,
    `- Expected generation: about ${Math.round(ctx.plan.genYear1).toLocaleString('en-IN')} kWh per year`,
    `- Monthly consumption: about ${Math.round(ctx.unitsMonth)} units`,
    ctx.sanctionedLoadKw ? `- Sanctioned load: ${ctx.sanctionedLoadKw} kW` : '',
    ctx.discom ? `- DISCOM: ${clean(ctx.discom, 80)}` : '',
    ctx.roofAreaM2 ? `- Usable roof area (my estimate): about ${Math.round(ctx.roofAreaM2)} m²` : '',
    ctx.location ? `- Location: ${clean(ctx.location, 100)}` : '',
    '',
    'PLEASE CONFIRM IN YOUR QUOTE',
    ...RFQ_CONFIRMATIONS.map((c, i) => `${i + 1}. ${c}`),
    '',
    'Please reply to this email with your quote.',
    '',
    'Thank you,',
    name,
    ctx.contactPhone ? `Phone: ${clean(ctx.contactPhone, 20)}` : '',
    `Email: ${clean(ctx.contactEmail, 120)}`,
    ctx.note ? '' : '',
    ctx.note ? `Note: ${clean(ctx.note, 400)}` : '',
    '',
    `Reference: ${ctx.caseRef}`
  ].filter((l, i, arr) => !(l === '' && arr[i - 1] === ''));
  return { subject: rfqSubject(ctx.plan.kw, ctx.caseRef), text: lines.join('\n') };
}
