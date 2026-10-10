import { describe, expect, it } from 'vitest';
import { checkQuote } from '../src/quoteFlags';

const fullText = 'Supply of 3 kW system with DCR ALMM modules, net metering support, 25 year warranty, price incl GST';

describe('checkQuote', () => {
  it('rates a price inside the band as in range with no price flag', () => {
    const r = checkQuote({ totalPrice: 185000, systemKw: 3, rawText: fullText, plannedKw: 3 });
    expect(r.verdict.band).toBe('in');
    expect(r.flags.find((f) => f.code === 'PRICE_ABOVE_BAND')).toBeUndefined();
    expect(r.flags).toHaveLength(0);
    expect(r.verdict.pricePerKw).toBeCloseTo(185000 / 3, 4);
  });

  it('flags a price above the band, with a high severity beyond 10 percent', () => {
    const r = checkQuote({ totalPrice: 260000, systemKw: 3, rawText: fullText, plannedKw: 3 });
    expect(r.verdict.band).toBe('above');
    expect(r.verdict.deltaInr).toBe(50000);
    const f = r.flags.find((x) => x.code === 'PRICE_ABOVE_BAND');
    expect(f?.severity).toBe('high');
    expect(r.questions[0]).toMatch(/break the price down/i);
  });

  it('flags a suspiciously low price', () => {
    const r = checkQuote({ totalPrice: 120000, systemKw: 3, rawText: fullText, plannedKw: 3 });
    expect(r.verdict.band).toBe('below');
    expect(r.flags.some((f) => f.code === 'PRICE_BELOW_BAND')).toBe(true);
  });

  it('flags missing DCR, ALMM, net metering, warranty and GST from the text', () => {
    const r = checkQuote({ totalPrice: 185000, systemKw: 3, rawText: 'Solar system supply and installation', plannedKw: 3 });
    const codes = r.flags.map((f) => f.code);
    expect(codes).toEqual(expect.arrayContaining(['DCR_NOT_MENTIONED', 'ALMM_NOT_MENTIONED', 'NET_METER_NOT_MENTIONED', 'WARRANTY_NOT_MENTIONED', 'GST_NOT_MENTIONED']));
    expect(r.flags[0].severity).toBe('high');
  });

  it('flags a different size than planned', () => {
    const r = checkQuote({ totalPrice: 185000, systemKw: 3, rawText: fullText, plannedKw: 2 });
    expect(r.flags.some((f) => f.code === 'KW_DIFFERS_FROM_PLAN')).toBe(true);
  });

  it('asks for missing values instead of guessing', () => {
    const r = checkQuote({ totalPrice: null, systemKw: null, rawText: '', plannedKw: null });
    expect(r.verdict.band).toBe('unknown');
    expect(r.flags.map((f) => f.code)).toEqual(expect.arrayContaining(['MISSING_PRICE', 'MISSING_KW']));
  });
});
