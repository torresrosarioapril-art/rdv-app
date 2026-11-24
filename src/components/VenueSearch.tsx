import { useEffect, useRef, useState } from 'react';
import { Check, MapPin, Search, Sparkles } from 'lucide-react';
import { GEOCODER_URL } from '@/config/app';
import { listVenues, type Venue } from '@/lib/api';
import { Field, Input, cx } from './ui';

/** A place for a date: a listed RDV venue (venueId set) or any place found on the map. */
export interface PickedPlace { name: string; lat: number | null; lng: number | null; venueId: string | null; detail?: string }

// Searches lean towards Dubai unless the phone shares a location.
const DEFAULT_BIAS = { lat: 25.2048, lng: 55.2708 };

/**
 * Venue finder for invitations.
 * Phase 1: search restaurants, cafés and other places on the map (OpenStreetMap via Photon), or type a name.
 * Phase 2: RDV partner venues (table `venues`, active = true) appear first with their perk; nothing else changes.
 */
export function VenueSearch({ value, onChange }: { value: PickedPlace | null; onChange: (p: PickedPlace | null) => void }) {
  const [q, setQ] = useState(value?.name ?? '');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [found, setFound] = useState<PickedPlace[]>([]);
  const [partners, setPartners] = useState<Venue[]>([]);
  const [bias, setBias] = useState(DEFAULT_BIAS);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    listVenues().then(setPartners).catch(() => {});
    navigator.geolocation?.getCurrentPosition((p) => setBias({ lat: p.coords.latitude, lng: p.coords.longitude }), () => {}, { maximumAge: 600000, timeout: 5000 });
  }, []);

  useEffect(() => {
    if (!open || q.trim().length < 2) { setFound([]); return; }
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(`${GEOCODER_URL}?q=${encodeURIComponent(q)}&limit=8&lang=en&lat=${bias.lat}&lon=${bias.lng}`);
        const j = await r.json();
        setFound((j.features ?? []).map((f: any) => {
          const p = f.properties ?? {};
          const detail = [p.street, p.district ?? p.locality, p.city].filter(Boolean).join(', ');
          return { name: p.name ?? detail, detail, lat: +f.geometry.coordinates[1].toFixed(6), lng: +f.geometry.coordinates[0].toFixed(6), venueId: null };
        }).filter((x: PickedPlace) => x.name));
      } catch { setFound([]); }
      finally { setLoading(false); }
    }, 350);
  }, [q, open, bias]);

  const term = q.trim().toLowerCase();
  const partnerHits = partners.filter((v) => !term || v.name.toLowerCase().includes(term) || (v.area ?? '').toLowerCase().includes(term));
  const pick = (p: PickedPlace) => { onChange(p); setQ(p.name); setOpen(false); };

  return (
    <Field label="Where" hint={value?.lat != null ? undefined : 'Search a restaurant or café and pick it from the list, or just type the name.'}>
      <div className="relative">
        <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
        <Input className="!pl-9" value={q} placeholder="e.g. Zuma DIFC"
          onChange={(e) => { setQ(e.target.value); setOpen(true); onChange(e.target.value.trim() ? { name: e.target.value, lat: null, lng: null, venueId: null } : null); }}
          onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 200)} />
        {value?.lat != null && <Check className="absolute right-3 top-3 w-4 h-4 text-emerald-500" />}
        {open && (partnerHits.length > 0 || found.length > 0 || loading) && (
          <div className="absolute z-20 mt-1 w-full max-h-72 overflow-auto rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-navy-3 shadow-lg">
            {partnerHits.slice(0, 5).map((v) => (
              <Row key={v.id} onPick={() => pick({ name: v.name, lat: v.lat, lng: v.lng, venueId: v.id, detail: v.area ?? v.address ?? undefined })}
                title={v.name} detail={[v.area, v.perk].filter(Boolean).join(' · ')} partner={v.is_partner} />
            ))}
            {loading && <div className="px-3 py-2 text-xs text-slate-500">Searching…</div>}
            {found.map((p) => <Row key={`${p.name}${p.lat}`} onPick={() => pick(p)} title={p.name} detail={p.detail} />)}
          </div>
        )}
      </div>
      {value?.detail && <div className="text-xs text-slate-500 mt-1.5 flex items-center gap-1"><MapPin className="w-3 h-3 text-gold" />{value.detail}</div>}
    </Field>
  );
}

function Row({ title, detail, partner, onPick }: { title: string; detail?: string; partner?: boolean; onPick: () => void }) {
  return (
    <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={onPick}
      className={cx('w-full text-left px-3 py-2 text-sm hover:bg-gold/10 flex items-start gap-2 cursor-pointer', partner && 'bg-gold/5')}>
      {partner ? <Sparkles className="w-3.5 h-3.5 text-gold mt-0.5" /> : <MapPin className="w-3.5 h-3.5 text-gold mt-0.5" />}
      <span>
        <span className="block">{title}{partner && <span className="ml-1.5 text-[10px] uppercase tracking-widest text-gold">RDV partner</span>}</span>
        {detail && <span className="block text-xs text-slate-500">{detail}</span>}
      </span>
    </button>
  );
}
