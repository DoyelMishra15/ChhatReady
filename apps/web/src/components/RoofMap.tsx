import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '@geoman-io/leaflet-geoman-free';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import { useEffect, type MutableRefObject } from 'react';
import { LayersControl, MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';

export interface RoofMapApi {
  draw: () => void;
  clear: () => void;
  setPolygon: (ll: [number, number][]) => void;
  flyTo: (lat: number, lon: number, zoom?: number) => void;
}

export type LatLng = [number, number];

function Geoman({ initial, onPolygon, apiRef }: { initial: LatLng[] | null; onPolygon: (ll: LatLng[] | null) => void; apiRef: MutableRefObject<RoofMapApi | null> }) {
  const map = useMap();
  useEffect(() => {
    let current: L.Polygon | null = null;
    const emit = (layer: L.Polygon) => {
      const ring = (layer.getLatLngs()[0] as L.LatLng[]).map((p) => [p.lat, p.lng] as LatLng);
      onPolygon(ring);
    };
    const adopt = (layer: L.Polygon) => {
      if (current && current !== layer) map.removeLayer(current);
      current = layer;
      layer.setStyle({ color: '#F5A524', weight: 3, fillColor: '#F5A524', fillOpacity: 0.25 });
      layer.on('pm:edit', () => emit(layer));
      layer.on('pm:markerdragend', () => emit(layer));
      emit(layer);
    };

    map.pm.addControls({
      position: 'topleft',
      drawMarker: false,
      drawCircleMarker: false,
      drawPolyline: false,
      drawCircle: false,
      drawText: false,
      drawRectangle: true,
      drawPolygon: true,
      editMode: true,
      dragMode: false,
      cutPolygon: false,
      rotateMode: false,
      removalMode: true
    });
    map.pm.setPathOptions({ color: '#F5A524', fillColor: '#F5A524', fillOpacity: 0.25 });

    const onCreate = (e: { layer: L.Layer }) => adopt(e.layer as L.Polygon);
    const onRemove = () => {
      if (current && !map.hasLayer(current)) {
        current = null;
        onPolygon(null);
      }
    };
    map.on('pm:create', onCreate as never);
    map.on('pm:remove', onRemove);

    const setPolygon = (ll: LatLng[]) => {
      if (current) map.removeLayer(current);
      const poly = L.polygon(ll).addTo(map);
      adopt(poly);
      map.fitBounds(poly.getBounds(), { maxZoom: 20, padding: [40, 40] });
    };
    if (initial && initial.length >= 3) {
      const poly = L.polygon(initial).addTo(map);
      current = poly;
      poly.setStyle({ color: '#F5A524', weight: 3, fillColor: '#F5A524', fillOpacity: 0.25 });
      poly.on('pm:edit', () => emit(poly));
      map.fitBounds(poly.getBounds(), { maxZoom: 20, padding: [40, 40] });
    }

    apiRef.current = {
      draw: () => map.pm.enableDraw('Polygon', { snappable: false }),
      clear: () => {
        if (current) map.removeLayer(current);
        current = null;
        onPolygon(null);
      },
      setPolygon,
      flyTo: (lat, lon, zoom = 19) => map.flyTo([lat, lon], zoom, { duration: 0.8 })
    };
    return () => {
      map.off('pm:create', onCreate as never);
      map.off('pm:remove', onRemove);
      map.pm.removeControls();
      apiRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);
  return null;
}

function Center({ onCenter }: { onCenter: (lat: number, lon: number) => void }) {
  const map = useMap();
  useEffect(() => {
    const c = map.getCenter();
    onCenter(c.lat, c.lng);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useMapEvents({
    moveend: () => {
      const c = map.getCenter();
      onCenter(c.lat, c.lng);
    }
  });
  return null;
}

export default function RoofMap({ center, zoom, initialPolygon, onPolygon, onCenter, apiRef }: { center: LatLng; zoom: number; initialPolygon: LatLng[] | null; onPolygon: (ll: LatLng[] | null) => void; onCenter: (lat: number, lon: number) => void; apiRef: MutableRefObject<RoofMapApi | null> }) {
  return (
    <MapContainer center={center} zoom={zoom} maxZoom={20} className="h-full w-full" scrollWheelZoom aria-label="Satellite map. Use the polygon tool to trace your roof.">
      <LayersControl position="topright">
        <LayersControl.BaseLayer checked name="Satellite">
          <TileLayer attribution="Imagery © Esri, Maxar, Earthstar Geographics" url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" maxNativeZoom={19} maxZoom={20} />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Street map">
          <TileLayer attribution="© OpenStreetMap contributors" url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxNativeZoom={19} maxZoom={20} />
        </LayersControl.BaseLayer>
      </LayersControl>
      <Geoman initial={initialPolygon} onPolygon={onPolygon} apiRef={apiRef} />
      <Center onCenter={onCenter} />
    </MapContainer>
  );
}
