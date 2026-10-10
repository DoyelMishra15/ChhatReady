import { mergeAssumptions, type Assumptions, type BillInput, type Plan } from '@chhatready/engine';
import { createElement } from 'react';
import type { PackData } from './ApplicationPack';

export interface PackInput {
  ref: string;
  bill: BillInput;
  roof: { areaM2: number; obstructionPct: number } | null;
  plan: Plan;
  assumptions: Partial<Assumptions>;
}

export function toPackData(i: PackInput): PackData {
  return {
    ref: i.ref,
    bill: i.bill,
    roofUsableM2: i.roof ? Math.max(0, i.roof.areaM2 * (1 - i.roof.obstructionPct / 100)) : null,
    plan: i.plan,
    assumptions: mergeAssumptions(i.assumptions)
  };
}

/** Loaded on demand: the PDF library is large and only needed on the Act screen. */
export async function generatePack(input: PackInput): Promise<Blob> {
  const [{ pdf }, { registerPdfFonts }, { ApplicationPack }] = await Promise.all([import('@react-pdf/renderer'), import('./fonts'), import('./ApplicationPack')]);
  registerPdfFonts('/fonts');
  return pdf(createElement(ApplicationPack, { data: toPackData(input) }) as never).toBlob();
}
