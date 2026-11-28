import { useEffect, useRef, useState } from 'react';
import maplibregl, { type Map as MLMap, type Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { STYLE_URL, heartPath, paintBrand } from '@/components/RadarMap';

const DUBAI = { lat: 25.2048, lng: 55.2708 };
const isDark = () => document.documentElement.classList.contains('dark');

function heartEl() {
  const el = document.createElement('div');
  el.innerHTML = `<svg width="34" height="44" viewBox="0 0 34 44" aria-hidden="true" style="display:block;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))">
    <path d="${heartPath(34, 31)}" fill="#c9a24a" stroke="#ffffff" stroke-width="1.5"/>
    <rect x="16" y="30" width="2" height="12" rx="1" fill="#121d33"/></svg>`;
  return el;
}

/** A small branded map with one gold heart pin. With onPick, tapping the map moves the pin. */
export default function PinMap({ value, onPick, interactive = true }: {
  value: { lat: number; lng: number } | null; onPick?: (lat: number, lng: number) => void; interactive?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!box.current) return;
    let map: MLMap;
    try {
      const c = value ?? DUBAI;
      map = new maplibregl.Map({
        container: box.current, style: STYLE_URL, center: [c.lng, c.lat], zoom: value ? 14 : 10.5,
        attributionControl: { compact: true }, dragRotate: false, pitchWithRotate: false, interactive,
      });
    } catch { setFailed(true); return; }
    map.touchZoomRotate?.disableRotation();
    mapRef.current = map;
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(box.current);
    map.on('load', () => paintBrand(map, isDark()));
    map.on('click', (e) => { if (pickRef.current) pickRef.current(+e.lngLat.lat.toFixed(6), +e.lngLat.lng.toFixed(6)); });
    return () => { ro.disconnect(); map.remove(); mapRef.current = null; marker.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the pin where the value is
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    if (!value) { marker.current?.remove(); marker.current = null; return; }
    if (!marker.current) marker.current = new maplibregl.Marker({ element: heartEl(), anchor: 'bottom' }).setLngLat([value.lng, value.lat]).addTo(map);
    else marker.current.setLngLat([value.lng, value.lat]);
    map.easeTo({ center: [value.lng, value.lat], zoom: Math.max(map.getZoom(), 14), duration: 500 });
  }, [value?.lat, value?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  if (failed) return <div className="h-full flex items-center justify-center text-xs text-slate-500">The map could not load.</div>;
  // Inline size: the map library sets position: relative on this element
  return <div ref={box} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} />;
}
