import { useEffect, useRef, useState } from 'react';
import maplibregl, { type GeoJSONSource, type Map as MLMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { LocateFixed, Minus, Plus } from 'lucide-react';
import type { MemberCard } from '@/lib/api';
import { Photo, cx } from '@/components/ui';

type Pos = { lat: number; lng: number };

/** Free vector map tiles (OpenFreeMap, OpenStreetMap data): no API key, no monthly bill. */
const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';

const PALETTE = {
  light: { bg: '#f7f4ee', water: '#dde4ec', green: '#ebe5d4', build: '#ebe4d6', road: '#ffffff', major: '#eedcb4', text: '#646d7e', halo: '#f7f4ee' },
  dark: { bg: '#0f1b2f', water: '#0a1322', green: '#13233a', build: '#17263f', road: '#22334f', major: '#4a4130', text: '#9aa3b5', halo: '#0f1b2f' },
};

/** Recolour the base map so it looks like RDV: ivory and gold in light mode, navy in dark mode. */
function paintBrand(map: MLMap, dark: boolean) {
  const c = dark ? PALETTE.dark : PALETTE.light;
  for (const l of map.getStyle().layers ?? []) {
    const id = l.id.toLowerCase();
    const set = (prop: string, v: unknown) => { try { map.setPaintProperty(l.id, prop, v); } catch { /* layer without that property */ } };
    if (l.type === 'background') set('background-color', c.bg);
    else if (l.type === 'fill') {
      if (id.includes('water')) set('fill-color', c.water);
      else if (/park|wood|grass|landcover|green|forest/.test(id)) set('fill-color', c.green);
      else if (id.includes('building')) set('fill-color', c.build);
      else if (/landuse|residential|aeroway/.test(id)) set('fill-color', c.bg);
    } else if (l.type === 'line') {
      if (id.includes('water')) set('line-color', c.water);
      else if (/motorway|trunk|primary/.test(id)) set('line-color', c.major);
      else if (/road|highway|street|minor|secondary|tertiary|service|path|bridge|tunnel|rail/.test(id)) set('line-color', c.road);
    } else if (l.type === 'symbol') {
      set('text-color', c.text);
      set('text-halo-color', c.halo);
    }
  }
}

function rangeCircle(c: Pos, km: number, n = 96): GeoJSON.Feature<GeoJSON.Polygon> {
  const pts: [number, number][] = [];
  const dLat = km / 110.574;
  const dLng = km / (111.32 * Math.cos((c.lat * Math.PI) / 180));
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * 2 * Math.PI;
    pts.push([c.lng + dLng * Math.cos(a), c.lat + dLat * Math.sin(a)]);
  }
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [pts] } };
}

function heatPoints(items: MemberCard[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: items.filter((m) => m.lat != null && m.lng != null).map((m) => ({
      type: 'Feature', properties: { w: Math.max(0.3, (m.score ?? 60) / 100) },
      geometry: { type: 'Point', coordinates: [m.lng as number, m.lat as number] },
    })),
  };
}

/** A heart outline sized w x h, point at the bottom centre (for the member pins). */
function heartPath(w: number, h: number) {
  const x = (v: number) => ((v / 48) * w).toFixed(2), y = (v: number) => ((v / 44) * h).toFixed(2);
  return `M${x(24)} ${y(43)} C${x(24)} ${y(43)} ${x(1)} ${y(29)} ${x(1)} ${y(14)} C${x(1)} ${y(6)} ${x(7.5)} ${y(0.5)} ${x(14.5)} ${y(0.5)} `
    + `C${x(19)} ${y(0.5)} ${x(22.5)} ${y(3)} ${x(24)} ${y(6.5)} C${x(25.5)} ${y(3)} ${x(29)} ${y(0.5)} ${x(33.5)} ${y(0.5)} `
    + `C${x(40.5)} ${y(0.5)} ${x(47)} ${y(6)} ${x(47)} ${y(14)} C${x(47)} ${y(29)} ${x(24)} ${y(43)} ${x(24)} ${y(43)} Z`;
}

function isDark() { return document.documentElement.classList.contains('dark'); }

/**
 * Snap Map style radar: a real, draggable map of the area with each nearby compatible member
 * as a photo pin. Pin positions arrive already rounded (about 300 m) and shifted by the server,
 * so the map never knows anyone's exact spot.
 */
export default function RadarMap({ pos, items, radiusKm, onSelect, youLabel }: {
  pos: Pos; items: MemberCard[]; radiusKm: number; onSelect: (m: MemberCard) => void; youLabel?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [, setTick] = useState(0);
  const [dark, setDark] = useState(isDark);

  useEffect(() => {
    const o = new MutationObserver(() => setDark(isDark()));
    o.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => o.disconnect();
  }, []);

  // Create the map once
  useEffect(() => {
    if (!box.current) return;
    let map: MLMap;
    try {
      map = new maplibregl.Map({
        container: box.current, style: STYLE_URL, center: [pos.lng, pos.lat], zoom: 13,
        attributionControl: { compact: true }, dragRotate: false, pitchWithRotate: false, maxZoom: 16, minZoom: 9,
      });
    } catch { setFailed(true); return; }
    map.touchZoomRotate.disableRotation();
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(box.current);
    mapRef.current = map;
    const bump = () => setTick((t) => t + 1);
    map.on('move', bump);
    map.on('resize', bump);
    map.on('error', (e) => { if (!map.isStyleLoaded() && String(e.error?.message ?? '').toLowerCase().includes('style')) setFailed(true); });
    map.on('load', () => {
      map.addSource('range', { type: 'geojson', data: rangeCircle(pos, radiusKm) });
      map.addLayer({ id: 'range-fill', type: 'fill', source: 'range', paint: { 'fill-color': '#c9a24a', 'fill-opacity': 0.05 } });
      map.addLayer({ id: 'range-line', type: 'line', source: 'range', paint: { 'line-color': '#c9a24a', 'line-opacity': 0.7, 'line-width': 1.5, 'line-dasharray': [2, 2] } });
      map.addSource('heat', { type: 'geojson', data: heatPoints(items) });
      map.addLayer({
        id: 'heat', type: 'heatmap', source: 'heat',
        paint: {
          'heatmap-weight': ['get', 'w'],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 10, 25, 15, 70],
          'heatmap-intensity': 0.9,
          'heatmap-opacity': 0.75,
          'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'],
            0, 'rgba(201,162,74,0)', 0.3, 'rgba(226,201,146,0.25)', 0.6, 'rgba(201,162,74,0.4)', 1, 'rgba(201,162,74,0.6)'],
        },
      });
      paintBrand(map, isDark());
      setReady(true);
      bump();
    });
    return () => { ro.disconnect(); map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Theme switch
  useEffect(() => { const m = mapRef.current; if (m && ready) paintBrand(m, dark); }, [dark, ready]);

  // Range circle follows you and the chosen distance; zoom to fit it when the distance changes
  useEffect(() => {
    const m = mapRef.current; if (!m || !ready) return;
    (m.getSource('range') as GeoJSONSource | undefined)?.setData(rangeCircle(pos, radiusKm));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos.lat, pos.lng, radiusKm, ready]);
  useEffect(() => {
    const m = mapRef.current; if (!m || !ready) return;
    const ring = rangeCircle(pos, radiusKm).geometry.coordinates[0];
    const lngs = ring.map((p) => p[0]), lats = ring.map((p) => p[1]);
    m.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 28, duration: 700, maxZoom: 15 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radiusKm, ready]);

  // Busy-area glow from the members currently shown
  useEffect(() => {
    const m = mapRef.current; if (!m || !ready) return;
    (m.getSource('heat') as GeoJSONSource | undefined)?.setData(heatPoints(items));
  }, [items, ready]);

  const map = mapRef.current;
  const w = box.current?.clientWidth ?? 0, h = box.current?.clientHeight ?? 0;
  const proj = (p: Pos) => (map ? map.project([p.lng, p.lat]) : null);
  const me = ready ? proj(pos) : null;

  if (failed) {
    return (
      <div className="h-full w-full flex items-center justify-center text-center text-sm text-slate-500 p-6">
        The map could not load. Check your connection; the list of members nearby still works.
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      {/* Inline size: the map library sets position: relative on this element, which would collapse an inset-0 box */}
      <div ref={box} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} />
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {ready && items.map((m) => {
          if (m.lat == null || m.lng == null) return null;
          const p = proj({ lat: m.lat, lng: m.lng });
          if (!p || p.x < -30 || p.y < -30 || p.x > w + 30 || p.y > h + 30) return null;
          const strong = (m.score ?? 0) >= 75;
          return (
            <button key={m.id} onClick={() => onSelect(m)} aria-label={`${m.name}, ${m.score ?? ''}% match`}
              style={{ left: p.x, top: p.y }}
              className="pointer-events-auto absolute -translate-x-1/2 -translate-y-full flex flex-col items-center cursor-pointer group">
              <span className="relative block w-[54px] h-[50px] drop-shadow-md group-active:scale-95 transition">
                <svg aria-hidden="true" viewBox="0 0 54 50" className="absolute inset-0 w-full h-full">
                  <path d={heartPath(54, 50)} fill={strong ? '#c9a24a' : '#e2c992'} />
                </svg>
                <span className="absolute left-[4px] top-[4px] w-[46px] h-[42px] overflow-hidden bg-white dark:bg-navy-2"
                  style={{ clipPath: `path('${heartPath(46, 42)}')` }}>
                  <Photo path={m.photos?.[0]} alt="" className="w-full h-full" />
                </span>
                <span className="absolute -top-1.5 -right-3 rounded-full bg-ink text-gold-soft text-[10px] font-semibold px-1.5 py-px shadow">{m.score ?? ''}%</span>
              </span>
              <span className="w-[2px] h-4 -mt-[3px] rounded-full bg-ink dark:bg-gold-soft" />
              <span className="w-1.5 h-1.5 -mt-px rounded-full bg-ink dark:bg-gold-soft" />
            </button>
          );
        })}
        {me && (
          <div className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center" style={{ left: me.x, top: me.y }}>
            <span className="relative flex w-4 h-4">
              <span className="absolute inset-0 rounded-full bg-gold/50 animate-ping" />
              <span className="relative w-4 h-4 rounded-full bg-gold border-2 border-white dark:border-navy shadow" />
            </span>
            <span className="mt-1 rounded-full bg-white/90 dark:bg-navy-2/90 text-[10px] font-semibold text-gold-deep dark:text-gold px-1.5 py-px shadow-sm whitespace-nowrap">{youLabel ?? 'You'}</span>
          </div>
        )}
      </div>
      {ready && (
        <div className="absolute right-2.5 top-2.5 flex flex-col rounded-2xl overflow-hidden bg-white dark:bg-navy-2 border border-gold/40 shadow">
          <button onClick={() => map?.zoomIn({ duration: 300 })} aria-label="Zoom in"
            className="w-10 h-10 flex items-center justify-center text-gold-deep dark:text-gold cursor-pointer border-b border-gold/30"><Plus className="w-5 h-5" /></button>
          <button onClick={() => map?.zoomOut({ duration: 300 })} aria-label="Zoom out"
            className="w-10 h-10 flex items-center justify-center text-gold-deep dark:text-gold cursor-pointer"><Minus className="w-5 h-5" /></button>
        </div>
      )}
      {ready && (
        <button onClick={() => map?.flyTo({ center: [pos.lng, pos.lat], zoom: Math.max(map.getZoom(), 13), duration: 600 })}
          aria-label="Back to my location"
          className="absolute right-2.5 bottom-8 w-10 h-10 rounded-full bg-white dark:bg-navy-2 border border-gold/40 shadow flex items-center justify-center text-gold-deep dark:text-gold cursor-pointer">
          <LocateFixed className="w-5 h-5" />
        </button>
      )}
      {!ready && <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-500">Loading the map…</div>}
    </div>
  );
}
