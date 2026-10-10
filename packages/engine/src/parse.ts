/** Parse numbers as printed on Indian bills: "₹ 2,684.30", "1,23,456", "312 kWh", "5.0 KW". */
export function parseIndianNumber(input: unknown): number | null {
  if (typeof input === 'number') return Number.isFinite(input) ? input : null;
  if (typeof input !== 'string') return null;
  const cleaned = input
    .replace(/[₹]|rs\.?|inr/gi, '')
    .replace(/,/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const m = cleaned.match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

/** Sanctioned load as kW. Converts kVA (≈ kW) and HP (×0.746). */
export function parseLoadKw(input: unknown): number | null {
  if (typeof input === 'number') return Number.isFinite(input) && input > 0 ? input : null;
  if (typeof input !== 'string') return null;
  const n = parseIndianNumber(input);
  if (n === null || n <= 0) return null;
  if (/\bhp\b/i.test(input)) return Math.round(n * 0.746 * 100) / 100;
  return n;
}

export function cleanText(input: unknown, max = 120): string {
  if (typeof input !== 'string') return '';
  return input.replace(/\s+/g, ' ').trim().slice(0, max);
}
