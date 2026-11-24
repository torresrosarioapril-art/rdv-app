import { useCallback, useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, LocateFixed, MapPin, MessageCircle, Radar as RadarIcon, ShieldCheck, Waves } from 'lucide-react';
import {
  giveConsent, radar, radarConnect, setPrivacy, updateMyLocation, type MemberCard, type Privacy, type Status,
} from '@/lib/api';
import { RADAR } from '@/config/app';
import { Badge, Button, Card, Empty, Field, Modal, Photo, Select, cx, useToast } from '@/components/ui';
import { ProfileView, ScoreBadge } from '@/components/ProfileView';
import { SafetyMenu } from '@/components/SafetyMenu';

type Pos = { lat: number; lng: number };

function bearingKm(from: Pos, to: Pos) {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(to.lat - from.lat), dLng = toRad(to.lng - from.lng);
  const y = Math.sin(dLng) * Math.cos(toRad(to.lat));
  const x = Math.cos(toRad(from.lat)) * Math.sin(toRad(to.lat)) - Math.sin(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.cos(dLng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2;
  return { bearing: Math.atan2(y, x), km: 2 * R * Math.asin(Math.sqrt(a)) };
}

const PRIVACY: { id: Privacy; label: string; hint: string; icon: React.ReactNode }[] = [
  { id: 'exact', label: 'Exact', hint: 'Matches see your real distance', icon: <LocateFixed className="w-4 h-4" /> },
  { id: 'blur', label: '500m blur', hint: 'Shown to the nearest 500 m only', icon: <Waves className="w-4 h-4" /> },
  { id: 'ghost', label: 'Ghost', hint: 'Invisible to everyone on the radar', icon: <EyeOff className="w-4 h-4" /> },
];

export default function RadarTab({ status, refreshStatus, onOpenChat, filtersOpen, setFiltersOpen }: {
  status: Status; refreshStatus: () => Promise<void>; onOpenChat: (id: string) => void;
  filtersOpen: boolean; setFiltersOpen: (v: boolean) => void;
}) {
  const toast = useToast();
  const [consented, setConsented] = useState(!!status.consents.location);
  const [pos, setPos] = useState<Pos | null>(null);
  const [geoErr, setGeoErr] = useState('');
  const [privacy, setPriv] = useState<Privacy>(status.privacy ?? 'exact');
  const [inZone, setInZone] = useState(false);
  const [radius, setRadius] = useState(RADAR.defaultRadiusKm);
  const [minScore, setMinScore] = useState(0);
  const [items, setItems] = useState<MemberCard[]>([]);
  const [cap, setCap] = useState<number | null>(null);
  const [selected, setSelected] = useState<MemberCard | null>(null);
  const [busy, setBusy] = useState(false);
  const lastSent = useRef(0);

  // Track location while the tab is open
  useEffect(() => {
    if (!consented || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      async (p) => {
        const next = { lat: p.coords.latitude, lng: p.coords.longitude };
        setPos(next); setGeoErr('');
        if (Date.now() - lastSent.current > 30_000) {
          lastSent.current = Date.now();
          try { setInZone((await updateMyLocation(next.lat, next.lng)).in_safe_zone); } catch (e) { toast(e instanceof Error ? e.message : 'Location error', 'err'); }
        }
      },
      () => setGeoErr('Location is blocked. Allow location access for Rendez-vous in your browser settings to use the radar.'),
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [consented, toast]);

  const scan = useCallback(async () => {
    if (!pos) return;
    try { const r = await radar(radius, minScore); setItems(r.items); setCap(r.cap); }
    catch (e) { toast(e instanceof Error ? e.message : 'Radar unavailable', 'err'); }
  }, [pos, radius, minScore, toast]);

  useEffect(() => {
    if (!pos) return;
    const t = setTimeout(scan, 600);
    const i = setInterval(scan, RADAR.refreshSeconds * 1000);
    return () => { clearTimeout(t); clearInterval(i); };
  }, [scan, pos]);

  const changePrivacy = async (p: Privacy) => {
    setPriv(p);
    try { await setPrivacy(p); toast(p === 'ghost' ? "You're invisible on the radar" : p === 'blur' ? 'Your location is blurred to 500 m' : 'Exact distance on'); refreshStatus(); }
    catch (e) { toast(e instanceof Error ? e.message : 'Could not change', 'err'); }
  };

  const connect = async (m: MemberCard) => {
    setBusy(true);
    try { const id = await radarConnect(m.id); setSelected(null); onOpenChat(id); }
    catch (e) { toast(e instanceof Error ? e.message : 'Could not connect', 'err'); }
    finally { setBusy(false); }
  };

  if (!consented) {
    return (
      <Card className="max-w-xl mx-auto">
        <Empty icon={<RadarIcon className="w-6 h-6" />} title="You've probably already crossed paths">
          <p>The radar shows verified, compatible members who are near you right now. We use your location only while the app is open. You choose how precisely others see you: exact, blurred to 500 m, or invisible (Ghost).</p>
          <Button className="mt-5" onClick={async () => { try { await giveConsent('location'); setConsented(true); } catch (e) { toast(e instanceof Error ? e.message : 'Error', 'err'); } }}>
            <MapPin className="w-4 h-4" />Turn on the radar
          </Button>
        </Empty>
      </Card>
    );
  }

  const R = 140;
  return (
    <div className="grid lg:grid-cols-5 gap-5">
      <div className="lg:col-span-3 space-y-4">
        <Card className="!p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h1 className="text-xl font-display">Live radar</h1>
            <div className="flex items-center gap-2 text-xs">
              <Badge tone="slate">{radius} km</Badge>
              {minScore > 0 && <Badge>{minScore}%+</Badge>}
              <Badge tone="slate">{items.length}{cap ? ` / ${cap}` : ''} nearby</Badge>
            </div>
          </div>
          <div className="relative mx-auto aspect-square max-w-[420px]">
            <svg viewBox={`-${R + 10} -${R + 10} ${2 * R + 20} ${2 * R + 20}`} className="w-full h-full">
              {[1, 0.66, 0.33].map((f) => <circle key={f} r={R * f} fill="none" stroke="#c9a24a" strokeOpacity={0.25} />)}
              <line x1={-R} x2={R} y1={0} y2={0} stroke="#c9a24a" strokeOpacity={0.12} />
              <line y1={-R} y2={R} x1={0} x2={0} stroke="#c9a24a" strokeOpacity={0.12} />
              <g className="radar-sweep"><path d={`M0 0 L${R} 0 A${R} ${R} 0 0 0 ${R * Math.cos(-0.6)} ${R * Math.sin(-0.6)} Z`} fill="#c9a24a" fillOpacity={0.12} /></g>
              <circle r={6} fill="#c9a24a" />
            </svg>
            {pos && items.map((m) => {
              if (m.lat == null || m.lng == null) return null;
              const { bearing, km } = bearingKm(pos, { lat: m.lat, lng: m.lng });
              const r = Math.min(1, km / radius) * 0.46;
              const x = 50 + Math.sin(bearing) * r * 100, y = 50 - Math.cos(bearing) * r * 100;
              return (
                <button key={m.id} onClick={() => setSelected(m)} style={{ left: `${x}%`, top: `${y}%` }}
                  className={cx('absolute -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full overflow-hidden border-2 cursor-pointer shadow-lg', (m.score ?? 0) >= 75 ? 'border-gold' : 'border-white/60')}>
                  <Photo path={m.photos?.[0]} alt={m.name} className="w-full h-full" />
                </button>
              );
            })}
          </div>
          {geoErr && <p className="text-sm text-rose-500 text-center mt-2">{geoErr}</p>}
          {!pos && !geoErr && <p className="text-sm text-slate-500 text-center mt-2">Finding your location…</p>}
          {inZone && <p className="text-sm text-gold text-center mt-2 flex items-center justify-center gap-1.5"><ShieldCheck className="w-4 h-4" />You're in a Safe Zone, so you're hidden here.</p>}
        </Card>

        <Card className="!p-4">
          <div className="text-[11px] uppercase tracking-widest text-gold mb-2">How others see you</div>
          <div className="grid grid-cols-3 gap-2">
            {PRIVACY.map((p) => (
              <button key={p.id} onClick={() => changePrivacy(p.id)} className={cx('rounded-xl border p-3 text-left cursor-pointer', privacy === p.id ? 'border-gold bg-gold/10' : 'border-slate-200 dark:border-white/10')}>
                <div className="flex items-center gap-1.5 text-sm font-medium">{p.icon}{p.label}</div>
                <div className="text-[11px] text-slate-500 mt-1">{p.hint}</div>
              </button>
            ))}
          </div>
        </Card>
      </div>

      <div className="lg:col-span-2 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg">Nearby now</h2>
          <Button variant="ghost" className="!py-1.5 text-xs" onClick={() => setFiltersOpen(true)}>Filters</Button>
        </div>
        {items.length === 0 ? (
          <Card><Empty icon={<Eye className="w-5 h-5" />} title="No compatible members in range">Try a wider radius, or check back later. People appear when they open the app nearby.</Empty></Card>
        ) : items.map((m) => (
          <button key={m.id} onClick={() => setSelected(m)} className="w-full text-left cursor-pointer">
            <Card className="!p-3 flex items-center gap-3 hover:border-gold/50">
              <Photo path={m.photos?.[0]} alt={m.name} className="w-14 h-14 rounded-xl" />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{m.name}{m.age ? `, ${m.age}` : ''}</div>
                <div className="text-xs text-slate-500 truncate">{m.occupation} · {m.distance_km} km{m.privacy === 'blur' ? ' (approx.)' : ''}</div>
              </div>
              <ScoreBadge score={m.score} band={undefined} />
            </Card>
          </button>
        ))}
        {cap != null && items.length >= cap && (
          <p className="text-xs text-slate-500 text-center">Your plan shows up to {cap} matches on the radar. Upgrade to Premium to see everyone in range.</p>
        )}
      </div>

      <Modal open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Radar filters">
        <div className="space-y-4">
          <Field label="Distance"><Select value={String(radius)} onChange={(e) => setRadius(Number(e.target.value))} options={RADAR.radiusOptionsKm.map((k) => ({ value: String(k), label: `Within ${k} km` }))} placeholder="Distance" /></Field>
          <Field label="Compatibility" hint="Based on your full compatibility score: faith, children, timeline, habits, relocation and zodiac.">
            <Select value={String(minScore)} onChange={(e) => setMinScore(Number(e.target.value))} options={RADAR.minScoreOptions.map((s) => ({ value: String(s), label: s === 0 ? 'All compatible' : `${s}% and above` }))} placeholder="Compatibility" />
          </Field>
          <div className="flex justify-end"><Button onClick={() => { setFiltersOpen(false); scan(); }}>Apply</Button></div>
        </div>
      </Modal>

      <Modal open={!!selected} onClose={() => setSelected(null)} wide>
        {selected && (
          <>
            <div className="flex justify-end mb-2 pr-8"><SafetyMenu memberId={selected.id} name={selected.name} onDone={() => { setSelected(null); scan(); }} /></div>
            <ProfileView m={selected} />
            <div className="mt-5 flex justify-end">
              <Button busy={busy} onClick={() => connect(selected)}><MessageCircle className="w-4 h-4" />Message & meet</Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
