/** The demo roof used by "Use sample roof": a 8 m x 7 m terrace near Jaipur (matches the seeded sunlight data). */
export const DEMO_CENTER = { lat: 26.91, lon: 75.79 };

export function sampleRoofPolygon(): [number, number][] {
  const mPerDegLat = 111_320;
  const mPerDegLon = 111_320 * Math.cos((DEMO_CENTER.lat * Math.PI) / 180);
  const halfW = 4 / mPerDegLon; // 8 m wide
  const halfH = 3.5 / mPerDegLat; // 7 m deep
  const { lat, lon } = DEMO_CENTER;
  return [
    [lat - halfH, lon - halfW],
    [lat - halfH, lon + halfW],
    [lat + halfH, lon + halfW],
    [lat + halfH, lon - halfW]
  ];
}

export async function fetchSampleFile(name: 'sample-bill.png' | 'sample-quote.png'): Promise<File> {
  const res = await fetch(`/demo/${name}`);
  if (!res.ok) throw new Error('Sample file is missing.');
  return new File([await res.blob()], name, { type: 'image/png' });
}
