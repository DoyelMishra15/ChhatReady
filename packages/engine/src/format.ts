const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const num1 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 });

export const formatInr = (n: number): string => `₹${inr.format(Math.round(n))}`;
export const formatNumber = (n: number, digits = 0): string =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n);

/** ₹1,07,000 or compact lakh/crore style (₹6.2 L) for large figures. */
export function formatInrCompact(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e7) return `${sign}₹${num1.format(abs / 1e7)} Cr`;
  if (abs >= 1e5) return `${sign}₹${num1.format(abs / 1e5)} L`;
  return `${sign}₹${inr.format(abs)}`;
}

export const formatYears = (y: number | null): string => (y === null ? 'Over 25 yrs' : `${num1.format(y)} yrs`);
