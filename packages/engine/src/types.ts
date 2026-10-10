export interface BillInput {
  discom: string;
  consumerNumber: string;
  billingPeriod: string;
  tariffCategory: string;
  unitsMonth: number;
  amountMonth: number;
  sanctionedLoadKw: number | null;
}

export interface RoofInput {
  mode: 'map' | 'manual';
  /** [lat, lon] pairs, only in map mode */
  polygon: [number, number][];
  lat: number;
  lon: number;
  /** gross drawn or typed area in m² */
  areaM2: number;
  /** percent of area lost to tanks, stairs, shade, walkways (0 to 40) */
  obstructionPct: number;
}

export interface YieldData {
  /** kWh generated per kWp per year */
  yieldPerKw: number;
  /** kWh per kWp for each month, January first */
  monthly: number[];
  source: 'pvgis' | 'cache' | 'seed' | 'fallback';
}

export interface FieldValue<T = string | number | null> {
  value: T;
  /** 0 to 1 */
  confidence: number;
  /** normalised bounding box on the source image, 0 to 1 */
  bbox?: { left: number; top: number; width: number; height: number };
}

export type BillFieldName =
  | 'discom'
  | 'consumerNumber'
  | 'billingPeriod'
  | 'tariffCategory'
  | 'unitsMonth'
  | 'amountMonth'
  | 'sanctionedLoadKw';

export type BillFields = Record<BillFieldName, FieldValue>;

export type QuoteFieldName = 'totalPrice' | 'systemKw' | 'panels' | 'inverter' | 'warranty';
export type QuoteFields = Record<QuoteFieldName, FieldValue>;

export type ExtractionSource = 'textract' | 'textract-lines' | 'fixture' | 'mock' | 'manual';

export interface PlanInputs {
  bill: Pick<BillInput, 'unitsMonth' | 'amountMonth' | 'sanctionedLoadKw'>;
  /** usable roof area in m² after obstruction; null when unknown */
  usableRoofAreaM2: number | null;
  /** user-chosen size; null means use the recommendation */
  selectedKw: number | null;
}

export type PlanWarningCode =
  | 'ABOVE_ROOF'
  | 'ABOVE_LOAD'
  | 'ABOVE_SUBSIDY_CAP'
  | 'ABOVE_DEMAND'
  | 'BELOW_MINIMUM'
  | 'YIELD_FALLBACK'
  | 'LOW_RATE'
  | 'HIGH_RATE';

export interface PlanWarning {
  code: PlanWarningCode;
  severity: 'info' | 'warn';
  message: string;
}

export interface MonthRow {
  month: string;
  generation: number;
  usage: number;
}

export interface Plan {
  // derived inputs
  annualUnits: number;
  effectiveRate: number;
  avoidedRate: number;
  yieldPerKw: number;
  yieldSource: YieldData['source'];
  // sizing
  demandKw: number;
  roofKw: number | null;
  loadKw: number | null;
  recommendedKw: number;
  limiting: 'demand' | 'roof' | 'load';
  kw: number;
  // generation
  genYear1: number;
  usefulGenYear1: number;
  coveragePct: number;
  // money
  grossCost: number;
  costBand: { low: number; high: number; mid: number };
  costSource: 'benchmark' | 'quote';
  subsidy: number;
  subsidyLines: { label: string; kw: number; perKw: number; amount: number }[];
  subsidyCapped: boolean;
  selfFundedKw: number;
  netCost: number;
  savingsYear1: number;
  monthlySavingsYear1: number;
  paybackYears: number | null;
  savings25: number;
  grossSavings25: number;
  irr: number | null;
  years: {
    year: number;
    generation: number;
    useful: number;
    savings: number;
    om: number;
    inverter: number;
    cashflow: number;
    cumulative: number;
    net: number;
  }[];
  monthly: MonthRow[];
  // impact
  tCo2PerYear: number;
  tCo2Lifetime: number;
  tCo2PerYear1000Homes: number;
  warnings: PlanWarning[];
}

export type PlanErrorCode =
  | 'INVALID_UNITS'
  | 'INVALID_AMOUNT'
  | 'INVALID_YIELD'
  | 'ROOF_TOO_SMALL'
  | 'INVALID_SIZE';

export interface PlanError {
  code: PlanErrorCode;
  message: string;
}

export type PlanResult = { ok: true; plan: Plan } | { ok: false; error: PlanError };

export interface QuoteVerdict {
  band: 'below' | 'in' | 'above' | 'unknown';
  quotedPrice: number | null;
  quotedKw: number | null;
  pricePerKw: number | null;
  expectedLow: number | null;
  expectedHigh: number | null;
  expectedPerKwMid: number | null;
  /** quoted price versus the band midpoint, percent (positive = more expensive) */
  pctVsMid: number | null;
  /** how far above the band top or below the band bottom, in rupees */
  deltaInr: number | null;
}

export type QuoteFlagCode =
  | 'DCR_NOT_MENTIONED'
  | 'ALMM_NOT_MENTIONED'
  | 'NET_METER_NOT_MENTIONED'
  | 'WARRANTY_NOT_MENTIONED'
  | 'GST_NOT_MENTIONED'
  | 'PRICE_ABOVE_BAND'
  | 'PRICE_BELOW_BAND'
  | 'KW_DIFFERS_FROM_PLAN'
  | 'MISSING_PRICE'
  | 'MISSING_KW';

export interface QuoteFlag {
  code: QuoteFlagCode;
  severity: 'info' | 'warn' | 'high';
  title: string;
  detail: string;
}

export interface QuoteCheckResult {
  verdict: QuoteVerdict;
  flags: QuoteFlag[];
  questions: string[];
}
