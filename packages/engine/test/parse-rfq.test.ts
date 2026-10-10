import { describe, expect, it } from 'vitest';
import { formatInr, formatInrCompact, formatYears } from '../src/format';
import { parseIndianNumber, parseLoadKw } from '../src/parse';
import { buildRfq } from '../src/rfq';
import { emailRequestSchema, inputsUpdateSchema, rfqRequestSchema } from '../src/schemas';

describe('parseIndianNumber', () => {
  it.each([
    ['₹ 2,684.30', 2684.3],
    ['Rs. 1,23,456', 123456],
    ['312 kWh', 312],
    ['  5.0 KW', 5],
    [42, 42]
  ])('%s', (input, expected) => expect(parseIndianNumber(input)).toBe(expected));
  it('returns null for junk', () => {
    expect(parseIndianNumber('abc')).toBeNull();
    expect(parseIndianNumber(undefined)).toBeNull();
    expect(parseIndianNumber(Number.NaN)).toBeNull();
  });
  it('converts HP to kW for loads', () => {
    expect(parseLoadKw('5 HP')).toBeCloseTo(3.73, 2);
    expect(parseLoadKw('5 kW')).toBe(5);
    expect(parseLoadKw('0')).toBeNull();
  });
});

describe('format', () => {
  it('uses Indian digit grouping', () => {
    expect(formatInr(107000)).toBe('₹1,07,000');
    expect(formatInrCompact(620000)).toBe('₹6.2 L');
    expect(formatInrCompact(25000000)).toBe('₹2.5 Cr');
    expect(formatYears(null)).toBe('Over 25 yrs');
    expect(formatYears(3.84)).toBe('3.8 yrs');
  });
});

describe('RFQ builder', () => {
  const ctx = {
    caseRef: 'CR-ABC123',
    contactName: 'Asha\nVerma',
    contactEmail: 'asha@example.com',
    discom: 'Sample Power Distribution Co. Ltd.',
    sanctionedLoadKw: 5,
    unitsMonth: 280,
    roofAreaM2: 38.4,
    plan: { kw: 2.5, genYear1: 3500, subsidy: 69000 }
  };
  it('never leaks the consumer number and keeps the subject templated', () => {
    const m = buildRfq({ ...ctx, location: 'Sector 5' });
    expect(m.subject).toBe('Quote request: 2.5 kW rooftop solar (PM Surya Ghar), ref CR-ABC123');
    expect(m.text).not.toMatch(/consumer/i);
    expect(m.text).toContain('2.5 kW');
    expect(m.text).toContain('DCR/ALMM');
    expect(m.text).toContain('Asha Verma');
    expect(m.text).toContain('asha@example.com');
  });
});

describe('request schemas', () => {
  it('requires consent and 1 to 3 recipients for RFQs', () => {
    const base = { recipients: ['a@b.in'], contactName: 'A', contactEmail: 'me@x.in' };
    expect(rfqRequestSchema.safeParse({ ...base, consent: true }).success).toBe(true);
    expect(rfqRequestSchema.safeParse({ ...base, consent: false }).success).toBe(false);
    expect(rfqRequestSchema.safeParse({ ...base, recipients: [], consent: true }).success).toBe(false);
    expect(rfqRequestSchema.safeParse({ ...base, recipients: ['a@b.in', 'c@d.in', 'e@f.in', 'g@h.in'], consent: true }).success).toBe(false);
  });
  it('rejects bad emails and out-of-range bill values', () => {
    expect(emailRequestSchema.safeParse({ to: 'nope' }).success).toBe(false);
    expect(inputsUpdateSchema.safeParse({ bill: { discom: '', consumerNumber: '', billingPeriod: '', tariffCategory: '', unitsMonth: -5, amountMonth: 100, sanctionedLoadKw: null } }).success).toBe(false);
  });
});
