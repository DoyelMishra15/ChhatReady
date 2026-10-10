import { benchmarkBand } from './benchmarks';
import type { QuoteCheckResult, QuoteFlag, QuoteVerdict } from './types';

export interface QuoteCheckInput {
  totalPrice: number | null;
  systemKw: number | null;
  /** all text read from the quote, used for keyword checks */
  rawText: string;
  plannedKw: number | null;
}

const has = (text: string, re: RegExp) => re.test(text);

export function checkQuote(input: QuoteCheckInput): QuoteCheckResult {
  const { totalPrice, systemKw, rawText, plannedKw } = input;
  const flags: QuoteFlag[] = [];

  const verdict: QuoteVerdict = {
    band: 'unknown',
    quotedPrice: totalPrice,
    quotedKw: systemKw,
    pricePerKw: null,
    expectedLow: null,
    expectedHigh: null,
    expectedPerKwMid: null,
    pctVsMid: null,
    deltaInr: null
  };

  if (totalPrice === null || totalPrice <= 0)
    flags.push({
      code: 'MISSING_PRICE',
      severity: 'warn',
      title: 'Total price not found',
      detail: 'We could not read the total price. Type it in so we can compare it.'
    });
  if (systemKw === null || systemKw <= 0)
    flags.push({
      code: 'MISSING_KW',
      severity: 'warn',
      title: 'System size not found',
      detail: 'We could not read the system capacity in kW. Type it in so we can compare it.'
    });

  if (totalPrice && totalPrice > 0 && systemKw && systemKw > 0) {
    const band = benchmarkBand(systemKw);
    verdict.pricePerKw = totalPrice / systemKw;
    verdict.expectedLow = band.low;
    verdict.expectedHigh = band.high;
    verdict.expectedPerKwMid = band.mid / systemKw;
    verdict.pctVsMid = ((totalPrice - band.mid) / band.mid) * 100;
    if (totalPrice > band.high) {
      verdict.band = 'above';
      verdict.deltaInr = totalPrice - band.high;
      const pctOver = ((totalPrice - band.high) / band.high) * 100;
      flags.push({
        code: 'PRICE_ABOVE_BAND',
        severity: pctOver > 10 ? 'high' : 'warn',
        title: `Priced ${pctOver.toFixed(0)}% above the typical range`,
        detail: `For ${systemKw} kW, typical complete systems cost about ₹${band.low.toLocaleString('en-IN')} to ₹${band.high.toLocaleString('en-IN')}. Ask what justifies the difference (premium modules, longer warranty, extras).`
      });
    } else if (totalPrice < band.low) {
      verdict.band = 'below';
      verdict.deltaInr = band.low - totalPrice;
      flags.push({
        code: 'PRICE_BELOW_BAND',
        severity: 'warn',
        title: 'Priced below the typical range',
        detail:
          'A much lower price can mean non-compliant modules, missing paperwork, or exclusions. Check the specification line by line before accepting.'
      });
    } else {
      verdict.band = 'in';
    }
  }

  if (!has(rawText, /\bDCR\b|domestic\s*content/i))
    flags.push({
      code: 'DCR_NOT_MENTIONED',
      severity: 'high',
      title: 'No mention of DCR (domestic content) modules',
      detail:
        'Subsidy-eligible installations are generally expected to use compliant modules. Ask the installer to confirm in writing that the modules qualify for the central subsidy.'
    });
  if (!has(rawText, /\bALMM\b/i))
    flags.push({
      code: 'ALMM_NOT_MENTIONED',
      severity: 'warn',
      title: 'No mention of ALMM-listed modules',
      detail: 'Ask for the module make and model and confirm it is on the current approved list.'
    });
  if (!has(rawText, /net[\s-]*meter/i))
    flags.push({
      code: 'NET_METER_NOT_MENTIONED',
      severity: 'warn',
      title: 'Net-metering is not mentioned',
      detail:
        'Confirm who handles the DISCOM application, the net meter and the inspection, and whether it is included in the price.'
    });
  if (!has(rawText, /warrant/i))
    flags.push({
      code: 'WARRANTY_NOT_MENTIONED',
      severity: 'warn',
      title: 'No warranty terms found',
      detail: 'Ask for module performance warranty, inverter warranty and workmanship warranty in writing.'
    });
  if (!has(rawText, /\bGST\b/i))
    flags.push({
      code: 'GST_NOT_MENTIONED',
      severity: 'info',
      title: 'GST treatment is unclear',
      detail: 'Confirm whether the price includes GST so you compare like with like.'
    });
  if (plannedKw && systemKw && Math.abs(plannedKw - systemKw) > 0.25)
    flags.push({
      code: 'KW_DIFFERS_FROM_PLAN',
      severity: 'info',
      title: `Quote is for ${systemKw} kW, your plan is ${plannedKw} kW`,
      detail: 'A different size changes the subsidy and payback. Ask why the installer chose this size.'
    });

  const questions: string[] = [
    'Which exact module make, model and wattage are included, and are they eligible for the central subsidy?',
    'Is the DISCOM application, net meter and inspection included in this price? Who files them?',
    'What warranties apply to modules (performance), inverter and workmanship, and for how many years?',
    'What happens if the subsidy is delayed or rejected after installation?',
    'Is GST included, and can I get a detailed invoice with a bill of materials?'
  ];
  if (flags.some((f) => f.code === 'PRICE_ABOVE_BAND'))
    questions.unshift('Can you break the price down into modules, inverter, structure, labour and paperwork?');

  const order = { high: 0, warn: 1, info: 2 } as const;
  flags.sort((x, y) => order[x.severity] - order[y.severity]);

  return { verdict, flags, questions };
}
