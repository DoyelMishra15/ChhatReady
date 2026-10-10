// Fetches real PVGIS yearly yield for a few cities and writes demo/fixtures/pvgis.json.
// The API reads that file for the demo roof so the demo works offline. Needs internet.
// Usage: npm run seed:pvgis
import { readFileSync, writeFileSync } from 'node:fs';
import { fetchPvgis } from '../apps/api/src/services/yields';

const places: Record<string, [number, number]> = { jaipur: [26.91, 75.79], delhi: [28.61, 77.21], mumbai: [19.08, 72.88], bengaluru: [12.97, 77.59], chennai: [13.08, 80.27], kolkata: [22.57, 88.36] };
const base = process.env.PVGIS_BASE || 'https://re.jrc.ec.europa.eu/api/v5_2';
const entries: Record<string, { yieldPerKw: number; monthly: number[] }> = {};
for (const [name, [lat, lon]] of Object.entries(places)) {
  const y = await fetchPvgis(base, lat, lon);
  console.log(name, y ? `${Math.round(y.yieldPerKw)} kWh/kW/yr` : 'unavailable');
  if (y) entries[`${lat.toFixed(2)},${lon.toFixed(2)}`] = { yieldPerKw: y.yieldPerKw, monthly: y.monthly };
}
if (Object.keys(entries).length) {
  const file = 'demo/fixtures/pvgis.json';
  const old = JSON.parse(readFileSync(file, 'utf8'));
  const next = { illustrative: false, note: 'Real PVGIS output.', entries, regionalDefault: old.regionalDefault };
  writeFileSync(file, JSON.stringify(next, null, 2) + '\n');
  console.log('Wrote demo/fixtures/pvgis.json');
} else console.error('No data fetched. Existing file left unchanged.');
