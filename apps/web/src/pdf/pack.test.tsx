import { computePlan, FALLBACK_MONTHLY_SHAPE } from '@chhatready/engine';
import { renderToBuffer } from '@react-pdf/renderer';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ApplicationPack } from './ApplicationPack';
import { registerPdfFonts } from './fonts';
import { toPackData } from './generate';

describe('Application pack PDF', () => {
  it('renders a 4-page PDF with the figures from the plan', async () => {
    const yieldData = { yieldPerKw: 1500, monthly: FALLBACK_MONTHLY_SHAPE.map((s) => s * 1500), source: 'pvgis' as const };
    const bill = { discom: 'Test DISCOM', tariffCategory: 'Domestic', consumerNumber: '1234567890', billingPeriod: '', unitsMonth: 285, amountMonth: 2412.6, sanctionedLoadKw: 4 };
    const res = computePlan({ bill, usableRoofAreaM2: 50, selectedKw: null }, yieldData, {});
    if (!res.ok) throw new Error('plan failed');
    registerPdfFonts(resolve(__dirname, '../../public/fonts'));
    const data = toPackData({ ref: 'CR-TEST', bill, roof: { areaM2: 60, obstructionPct: 15 } as never, plan: res.plan, assumptions: {} });
    const buf = await renderToBuffer(<ApplicationPack data={data} />);
    expect(buf.subarray(0, 4).toString()).toBe('%PDF');
    expect((buf.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length).toBe(4);
    expect(buf.length).toBeGreaterThan(20_000);
    if (process.env.PACK_OUT) (await import('node:fs')).writeFileSync(process.env.PACK_OUT, buf);
  }, 30_000);
});
