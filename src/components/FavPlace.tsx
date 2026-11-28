import { lazy, Suspense, useState } from 'react';
import { MapPin } from 'lucide-react';
import type { FavPlace } from '@/lib/api';
import { GEOCODER_URL } from '@/config/app';
import { VenueSearch } from '@/components/VenueSearch';
import { Input } from '@/components/ui';

const PinMap = lazy(() => import('@/components/PinMap'));
export const FAV_WHY_MAX = 80;

const loading = <div className="h-full flex items-center justify-center text-xs text-slate-500">Loading the map…</div>;

/** Editor: search or tap the map to drop a pin on your favourite place in Dubai, plus one line about why. */
export function FavPlaceEditor({ value, onChange }: { value: FavPlace | null; onChange: (v: FavPlace | null) => void }) {
  const [naming, setNaming] = useState(false);
  const v: FavPlace = value ?? { name: '', lat: null as unknown as number, lng: null as unknown as number, why: '' };
  const hasPin = value?.lat != null && value?.lng != null;

  // Name a spot tapped on the map (reverse lookup on the same free map service)
  const dropPin = async (lat: number, lng: number) => {
    onChange({ ...v, lat, lng });
    setNaming(true);
    try {
      const r = await fetch(`${GEOCODER_URL.replace(/\/api\/?$/, '/reverse')}?lat=${lat}&lon=${lng}&lang=en`);
      const p = (await r.json()).features?.[0]?.properties ?? {};
      const name = p.name || [p.street, p.district ?? p.locality].filter(Boolean).join(', ');
      if (name) onChange({ ...v, lat, lng, name });
    } catch { /* keep the pin; the member can type a name */ }
    finally { setNaming(false); }
  };

  return (
    <div className="space-y-3">
      <VenueSearch label="Find the place" hint="Search a beach, café, park or any spot, and pick it from the list." placeholder="e.g. Kite Beach"
        value={hasPin ? { name: v.name, lat: v.lat, lng: v.lng, venueId: null } : null}
        onChange={(p) => onChange(p && p.lat != null && p.lng != null ? { ...v, name: p.name, lat: p.lat, lng: p.lng } : null)} />
      <div className="relative h-56 rounded-2xl overflow-hidden border border-gold/40 bg-ivory dark:bg-navy-2">
        <Suspense fallback={loading}>
          <PinMap value={hasPin ? { lat: v.lat, lng: v.lng } : null} onPick={dropPin} />
        </Suspense>
        {!hasPin && <div className="pointer-events-none absolute bottom-2 inset-x-2 text-center rounded-full bg-white/90 dark:bg-navy-2/90 text-[11px] py-1 shadow">Search above, or tap the map to drop your pin</div>}
      </div>
      {hasPin && (
        <Input value={v.name} maxLength={120} placeholder={naming ? 'Finding the name…' : 'Name of the place'}
          onChange={(e) => onChange({ ...v, name: e.target.value })} />
      )}
      <div>
        <Input value={v.why ?? ''} maxLength={FAV_WHY_MAX} placeholder="One line about why you love it"
          onChange={(e) => onChange({ ...v, why: e.target.value.slice(0, FAV_WHY_MAX) })} />
        <div className="flex justify-between text-[11px] text-slate-500 mt-1">
          <span>Pick a public place, never your home or office.</span><span>{(v.why ?? '').length} / {FAV_WHY_MAX}</span>
        </div>
      </div>
    </div>
  );
}

/** How the favourite place shows on a profile. */
export function FavPlaceCard({ place }: { place?: FavPlace | null }) {
  if (!place || place.lat == null || place.lng == null) return null;
  return (
    <div className="rounded-2xl overflow-hidden border border-gold/40 bg-white dark:bg-navy-2 shadow-sm">
      <div className="relative h-40">
        <Suspense fallback={loading}><PinMap value={{ lat: place.lat, lng: place.lng }} interactive={false} /></Suspense>
      </div>
      <div className="px-3 py-2.5">
        <div className="text-[10px] uppercase tracking-wider text-gold-deep dark:text-gold">My favourite place in Dubai</div>
        <div className="text-sm font-medium flex items-center gap-1 mt-0.5"><MapPin className="w-3.5 h-3.5 text-gold shrink-0" />{place.name || 'Dubai'}</div>
        {place.why && <div className="font-display italic text-[15px] leading-snug mt-0.5">{place.why}</div>}
      </div>
    </div>
  );
}
