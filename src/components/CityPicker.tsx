import { useEffect, useRef, useState } from 'react';
import { Check, MapPin } from 'lucide-react';
import { COUNTRIES, GEOCODER_URL } from '@/config/app';
import { Field, Input, Select } from './ui';

export interface Place { city: string; country: string; countryCode: string; lat: number; lng: number }

/** Country dropdown + city search that only accepts real places (with coordinates for the natal chart). */
export function CityPicker({ value, onChange }: { value: Place | null; onChange: (p: Place | null) => void }) {
  const [code, setCode] = useState(value?.countryCode ?? '');
  const [q, setQ] = useState(value?.city ?? '');
  const [results, setResults] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!open || q.trim().length < 2 || !code) { setResults([]); return; }
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      setLoading(true);
      try {
        const country = COUNTRIES.find(([c]) => c === code)?.[1] ?? '';
        const url = `${GEOCODER_URL}?q=${encodeURIComponent(`${q} ${country}`)}&limit=10&lang=en&layer=city&layer=locality&layer=district`;
        const r = await fetch(url);
        const j = await r.json();
        const seen = new Set<string>();
        const list: Place[] = (j.features ?? [])
          .filter((f: any) => (f.properties?.countrycode ?? '').toUpperCase() === code)
          .map((f: any) => ({
            city: f.properties.name, country, countryCode: code,
            lat: +f.geometry.coordinates[1].toFixed(4), lng: +f.geometry.coordinates[0].toFixed(4),
            _label: [f.properties.name, f.properties.state].filter(Boolean).join(', '),
          }))
          .filter((p: any) => { if (seen.has(p._label)) return false; seen.add(p._label); return true; })
          .slice(0, 6);
        setResults(list);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 350);
  }, [q, code, open]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Field label="Country of birth" optional>
        <Select value={code} placeholder="Select country…" options={COUNTRIES.map(([c, n]) => ({ value: c, label: n }))}
          onChange={(e) => { setCode(e.target.value); setQ(''); onChange(null); }} />
      </Field>
      <Field label="City of birth" optional hint={value ? undefined : code ? 'Start typing, then pick your city from the list.' : 'Choose the country first.'}>
        <div className="relative">
          <Input value={q} disabled={!code} placeholder={code ? 'e.g. Manila' : ''}
            onChange={(e) => { setQ(e.target.value); setOpen(true); if (value) onChange(null); }}
            onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 200)} />
          {value && <Check className="absolute right-3 top-3 w-4 h-4 text-emerald-500" />}
          {open && (results.length > 0 || loading) && (
            <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-navy-3 shadow-lg overflow-hidden">
              {loading && <div className="px-3 py-2 text-xs text-slate-500">Searching…</div>}
              {results.map((p: any) => (
                <button type="button" key={p._label + p.lat} onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { const { _label, ...place } = p; onChange(place); setQ(place.city); setOpen(false); }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gold/10 flex items-center gap-2 cursor-pointer">
                  <MapPin className="w-3.5 h-3.5 text-gold" />{p._label}
                </button>
              ))}
            </div>
          )}
        </div>
      </Field>
    </div>
  );
}
