import { SYSTEM_LIMITS, type Assumptions } from './assumptions';

export type LimitingFactor = 'demand' | 'roof' | 'load';

export interface SizingInput {
  annualUnits: number;
  yieldPerKw: number;
  roofAreaM2: number | null;
  sanctionedLoadKw: number | null;
  assumptions: Assumptions;
}

export interface SizingResult {
  demandKw: number;
  roofKw: number | null;
  loadKw: number | null;
  recommendedKw: number;
  limiting: LimitingFactor;
  /** True when the best size is below the 1 kW practical minimum. */
  belowMinimum: boolean;
}

const roundHalf = (n: number) => Math.round(n * 2) / 2;
const floorHalf = (n: number) => Math.floor(n * 2 + 1e-9) / 2;

export function sizeSystem(input: SizingInput): SizingResult {
  const { annualUnits, yieldPerKw, roofAreaM2, sanctionedLoadKw, assumptions } = input;
  const demandKw = (annualUnits * assumptions.offsetTarget) / yieldPerKw;
  const roofKw =
    roofAreaM2 !== null && roofAreaM2 > 0 ? roofAreaM2 / assumptions.areaPerKwM2 : roofAreaM2 === 0 ? 0 : null;
  const loadKw = sanctionedLoadKw !== null && sanctionedLoadKw > 0 ? sanctionedLoadKw : null;

  const demandRounded = roundHalf(demandKw);
  const roofRounded = roofKw === null ? Infinity : floorHalf(roofKw);
  const loadRounded = loadKw === null ? Infinity : floorHalf(loadKw);

  let best = demandRounded;
  let limiting: LimitingFactor = 'demand';
  if (roofRounded < best) {
    best = roofRounded;
    limiting = 'roof';
  }
  if (loadRounded < best) {
    best = loadRounded;
    limiting = 'load';
  }

  const hardCap = Math.min(roofRounded, loadRounded);
  let recommendedKw = Math.max(SYSTEM_LIMITS.minKw, best);
  let belowMinimum = false;
  if (recommendedKw > hardCap) {
    // roof or sanctioned load cannot even hold the 1 kW minimum
    recommendedKw = hardCap;
    belowMinimum = true;
  }
  recommendedKw = Math.min(recommendedKw, SYSTEM_LIMITS.maxKw);

  return { demandKw, roofKw, loadKw, recommendedKw, limiting, belowMinimum };
}
