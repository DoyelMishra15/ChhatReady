import area from '@turf/area';
import { mergeAssumptions, type RoofInput } from '@chhatready/engine';
import { ArrowLeft, ArrowRight, Eraser, LocateFixed, MapPin, PenLine, Search, Sparkles } from 'lucide-react';
import { lazy, Suspense, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import type { LatLng, RoofMapApi } from '../components/RoofMap';
import { Button } from '../components/ui/button';
import { Callout } from '../components/ui/callout';
import { Slider } from '../components/ui/slider';
import { friendlyError } from '../lib/api';
import { cn } from '../lib/cn';
import { DEMO_CENTER, sampleRoofPolygon } from '../lib/demo';
import { toast } from '../lib/toast';
import { useCase } from '../lib/useCase';

const RoofMap = lazy(() => import('../components/RoofMap'));

const SQFT = 0.09290304;

function polygonAreaM2(ll: LatLng[] | null): number {
  if (!ll || ll.length < 3) return 0;
  const ring = ll.map(([lat, lon]) => [lon, lat]);
  ring.push(ring[0]);
  return area({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } });
}

const centroid = (ll: LatLng[]): LatLng => [ll.reduce((s, p) => s + p[0], 0) / ll.length, ll.reduce((s, p) => s + p[1], 0) / ll.length];

interface Hit {
  label: string;
  lat: number;
  lon: number;
}

export default function Roof() {
  const { bill, roof, setRoof, saveNow, assumptions, caseId } = useCase();
  const nav = useNavigate();
  const apiRef = useRef<RoofMapApi | null>(null);
  const a = mergeAssumptions(assumptions);

  const [mode, setMode] = useState<'map' | 'manual'>(roof?.mode ?? 'map');
  const [polygon, setPolygon] = useState<LatLng[] | null>(roof?.mode === 'map' && roof.polygon.length >= 3 ? roof.polygon : null);
  const [manualText, setManualText] = useState(roof?.mode === 'manual' ? String(Math.round(roof.areaM2)) : '');
  const [unit, setUnit] = useState<'m2' | 'sqft'>('m2');
  const [obstruction, setObstruction] = useState(roof?.obstructionPct ?? 20);
  const [center, setCenter] = useState<LatLng>(roof ? [roof.lat, roof.lon] : [DEMO_CENTER.lat, DEMO_CENTER.lon]);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);

  const initialPoly = useRef(polygon);
  const startCenter = useRef<LatLng>(center);

  const grossM2 = useMemo(() => {
    if (mode === 'map') return polygonAreaM2(polygon);
    const n = Number(manualText.replace(/,/g, ''));
    return Number.isFinite(n) && n > 0 ? (unit === 'sqft' ? n * SQFT : n) : 0;
  }, [mode, polygon, manualText, unit]);

  const usable = grossM2 * (1 - obstruction / 100);
  const fitsKw = Math.floor((usable / a.areaPerKwM2) * 2) / 2;

  if (!bill) return <Navigate to={`/c/${caseId}/review`} replace />;

  const search = async () => {
    const q = query.trim();
    if (q.length < 3) return;
    setSearching(true);
    setHits(null);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=in&q=${encodeURIComponent(q)}`, { headers: { Accept: 'application/json' } });
      const j = (await res.json()) as { display_name: string; lat: string; lon: string }[];
      setHits(j.map((x) => ({ label: x.display_name, lat: Number(x.lat), lon: Number(x.lon) })));
    } catch {
      setHits([]);
      toast('error', 'Address search is unavailable right now. Pan the map to your home instead.');
    } finally {
      setSearching(false);
    }
  };

  const locate = () => {
    if (!navigator.geolocation) return toast('error', 'Your browser cannot share its location.');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocating(false);
        apiRef.current?.flyTo(p.coords.latitude, p.coords.longitude, 19);
      },
      () => {
        setLocating(false);
        toast('error', 'We could not get your location. Search for your address instead.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const useSample = () => {
    setMode('map');
    // wait a tick so the map is mounted if the user was on the manual tab
    setTimeout(() => apiRef.current?.setPolygon(sampleRoofPolygon()), 0);
  };

  const next = async () => {
    if (grossM2 <= 0) return;
    const loc: LatLng = mode === 'map' && polygon ? centroid(polygon) : center;
    const r: RoofInput = {
      mode,
      polygon: mode === 'map' && polygon ? polygon : [],
      lat: +loc[0].toFixed(6),
      lon: +loc[1].toFixed(6),
      areaM2: Math.round(grossM2 * 10) / 10,
      obstructionPct: obstruction
    };
    setRoof(r);
    setSaving(true);
    try {
      await new Promise((res) => setTimeout(res, 0)); // let state commit so saveNow sees the roof
      await saveNow();
      nav(`/c/${caseId}/plan`);
    } catch (e) {
      toast('error', friendlyError(e).message);
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'map' as const, label: 'Trace on the map', Icon: PenLine },
    { id: 'manual' as const, label: 'Type the area', Icon: MapPin }
  ];

  return (
    <div className="container-page py-8 sm:py-10">
      <h1 className="font-display text-3xl sm:text-4xl">Show us your roof</h1>
      <p className="mt-2 max-w-2xl text-ink/85">We use the open, shade-free area to cap the system size, and your location to look up local sunlight.</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.7fr_1fr]">
        <div>
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              void search();
            }}
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted" aria-hidden />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your address or area" aria-label="Search your address or area" className="min-h-12 w-full rounded-xl border border-line bg-surface pl-11 pr-3 outline-none focus:border-primary focus:ring-4 focus:ring-primary/15" />
            </div>
            <Button type="submit" variant="secondary" size="lg" loading={searching}>Search</Button>
            <Button variant="secondary" size="lg" onClick={locate} loading={locating} aria-label="Use my location">
              <LocateFixed className="size-5" aria-hidden /> <span className="sm:hidden">Use my location</span>
            </Button>
          </form>
          {hits && (
            <ul className="mt-2 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface" aria-label="Search results">
              {hits.length === 0 && <li className="px-4 py-3 text-sm text-muted">No places found. Try a nearby landmark.</li>}
              {hits.map((h) => (
                <li key={`${h.lat},${h.lon}`}>
                  <button type="button" className="w-full px-4 py-3 text-left text-[15px] hover:bg-primary-soft" onClick={() => { apiRef.current?.flyTo(h.lat, h.lon, 19); setHits(null); }}>
                    {h.label}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div role="tablist" aria-label="How to measure" className="mt-4 inline-flex rounded-xl border border-line bg-surface p-1">
            {tabs.map((t) => (
              <button key={t.id} role="tab" aria-selected={mode === t.id} onClick={() => setMode(t.id)} className={cn('inline-flex min-h-10 items-center gap-2 rounded-lg px-4 text-[15px] font-semibold transition-colors', mode === t.id ? 'bg-primary text-white' : 'text-muted hover:text-ink')}>
                <t.Icon className="size-4" aria-hidden /> {t.label}
              </button>
            ))}
          </div>

          <div className="relative mt-3 h-[380px] overflow-hidden rounded-[1.5rem] border border-line bg-primary-soft sm:h-[500px]">
            <Suspense fallback={<div className="skeleton h-full w-full rounded-none" />}>
              <RoofMap center={startCenter.current} zoom={initialPoly.current ? 19 : roof ? 19 : 18} initialPolygon={initialPoly.current} onPolygon={setPolygon} onCenter={(lat, lon) => setCenter([lat, lon])} apiRef={apiRef} />
            </Suspense>
            {mode === 'manual' && (
              <div className="pointer-events-none absolute left-1/2 top-1/2 z-[500] -translate-x-1/2 -translate-y-full" aria-hidden>
                <MapPin className="size-10 fill-sun text-ink drop-shadow" />
              </div>
            )}
            {mode === 'map' && !polygon && (
              <div className="pointer-events-none absolute inset-x-0 bottom-3 z-[500] flex justify-center px-3">
                <span className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white shadow-float">Zoom in on your roof, then press Draw my roof</span>
              </div>
            )}
          </div>
          <p className="mt-2 text-sm text-muted">{mode === 'map' ? 'Click each corner of your roof, then click the first corner to finish. Drag the white dots to adjust.' : 'Move the map so the pin sits on your home. We use the pin for local sunlight.'}</p>
        </div>

        <aside className="h-fit rounded-[1.5rem] border border-line bg-surface p-5 sm:p-6 lg:sticky lg:top-6" aria-label="Roof area">
          {mode === 'map' ? (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => apiRef.current?.draw()}><PenLine className="size-4" aria-hidden /> {polygon ? 'Draw again' : 'Draw my roof'}</Button>
              {polygon && <Button variant="secondary" onClick={() => apiRef.current?.clear()}><Eraser className="size-4" aria-hidden /> Clear</Button>}
              <Button variant="quiet" onClick={useSample}><Sparkles className="size-4" aria-hidden /> Use sample roof</Button>
            </div>
          ) : (
            <div>
              <label htmlFor="manual-area" className="text-[15px] font-semibold">Open roof area</label>
              <div className="mt-2 flex gap-2">
                <input id="manual-area" inputMode="decimal" value={manualText} onChange={(e) => setManualText(e.target.value)} placeholder={unit === 'm2' ? 'For example 50' : 'For example 540'} className="min-h-12 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3.5 text-base outline-none focus:border-primary focus:ring-4 focus:ring-primary/15" />
                <div role="group" aria-label="Unit" className="inline-flex rounded-xl border border-line p-1">
                  {(['m2', 'sqft'] as const).map((u) => (
                    <button key={u} type="button" aria-pressed={unit === u} onClick={() => setUnit(u)} className={cn('min-h-10 rounded-lg px-3 text-sm font-semibold', unit === u ? 'bg-primary text-white' : 'text-muted')}>{u === 'm2' ? 'm²' : 'sq ft'}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <dl className="mt-5 divide-y divide-line border-y border-line text-[15px]">
            <div className="flex justify-between py-2.5"><dt className="text-muted">Roof area</dt><dd className="font-semibold tnum">{grossM2 > 0 ? `${Math.round(grossM2)} m² (${Math.round(grossM2 / SQFT)} sq ft)` : 'Not set'}</dd></div>
            <div className="flex justify-between py-2.5"><dt className="text-muted">Open and usable</dt><dd className="font-semibold tnum">{grossM2 > 0 ? `${Math.round(usable)} m²` : 'Not set'}</dd></div>
            <div className="flex justify-between py-2.5"><dt className="text-muted">Space allows up to</dt><dd className="font-display-num text-xl font-semibold text-primary">{grossM2 > 0 ? `${Math.max(0, fitsKw).toFixed(1)} kW` : 'Not set'}</dd></div>
          </dl>

          <div className="mt-5">
            <label className="flex items-baseline justify-between text-[15px] font-semibold" htmlFor="obstruction">
              <span>Taken up by tanks, stairs and shade</span>
              <span className="tnum text-primary">{obstruction}%</span>
            </label>
            <Slider value={obstruction} onChange={setObstruction} min={0} max={40} step={5} label="Share of roof that is not usable" tone="sun" />
            <p className="text-sm text-muted">Water tanks, the stair cabin, parapet shade and walkways for cleaning. Be honest here: an installer's survey will find them.</p>
          </div>

          {grossM2 > 0 && fitsKw < 1 && <Callout kind="warn" className="mt-4">This is below the usual 1 kW minimum. Check the area, or reduce what is taken up.</Callout>}

          <div className="mt-6 flex flex-col gap-3">
            <Button size="lg" onClick={() => void next()} loading={saving} disabled={grossM2 <= 0}>
              See my solar plan <ArrowRight className="size-5" aria-hidden />
            </Button>
            <Link to={`/c/${caseId}/review`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl font-semibold text-muted hover:text-ink">
              <ArrowLeft className="size-4" aria-hidden /> Back to your bill
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
