import { useCallback, useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, MapPin, MessageCircle, Radar as RadarIcon, ShieldCheck, Waves } from 'lucide-react';
import {
  giveConsent, radar, radarConnect, setPrivacy, updateMyLocation, type MemberCard, type Privacy, type Status,
} from '@/lib/api';
import { RADAR, VISIBILITY } from '@/config/app';
import { Badge, Button, Card, Empty, Modal, Photo, Select, cx, useToast } from '@/components/ui';
import { SafeZones } from '@/screens/ProfileTab';
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


export default function RadarTab({ status, refreshStatus, onOpenChat }: {
  status: Status; refreshStatus: () => Promise<void>; onOpenChat: (id: string) => void;
}) {
  const toast = useToast();
  const [consented, setConsented] = useState(!!status.consents.location);
  const [pos, setPos] = useState<Pos | null>(null);
  const [geoErr, setGeoErr] = useState('');
  const [privacy, setPriv] = useState<Privacy>(status.privacy === 'ghost' ? 'ghost' : 'blur');
  useEffect(() => { setPriv(status.privacy === 'ghost' ? 'ghost' : 'blur'); }, [status.privacy]);
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
    try { await setPrivacy(p); toast(p === 'ghost' ? "You're hidden from the radar" : 'You show up approximately (500 m)'); refreshStatus(); }
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
          <p>The radar shows verified, compatible members who are near you right now. We use your location only while the app is open. For your safety nobody ever sees your exact spot: you appear to the nearest 500 m, or not at all (Ghost).</p>
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
          {inZone && <p className="text-sm text-gold text-center mt-2 flex items-center justify-center gap-1.5"><ShieldCheck className="w-4 h-4" />You're in one of your Safe Zones, so Ghost mode is on automatically.</p>}
        </Card>

        <Card className="!p-4">
          <div className="text-[11px] uppercase tracking-widest text-gold mb-2">How others see you</div>
          <div className="grid grid-cols-2 gap-2">
            {VISIBILITY.map((p) => (
              <button key={p.id} onClick={() => changePrivacy(p.id as Privacy)} className={cx('rounded-xl border p-3 text-left cursor-pointer', privacy === p.id ? 'border-gold bg-gold/10' : 'border-slate-200 dark:border-white/10')}>
                <div className="flex items-center gap-1.5 text-sm font-medium">{p.id === 'ghost' ? <EyeOff className="w-4 h-4" /> : <Waves className="w-4 h-4" />}{p.label}</div>
                <div className="text-[11px] text-slate-500 mt-1">{p.hint}</div>
              </button>
            ))}
          </div>
        </Card>
        <SafeZones status={status} />
      </div>

      <div className="lg:col-span-2 space-y-3">
        <Card className="!p-4 space-y-3">
          <div className="text-[11px] uppercase tracking-widest text-gold">Filters</div>
          <div>
            <div className="text-xs text-slate-500 mb-1.5">Distance</div>
            <div className="flex flex-wrap gap-1.5">
              {RADAR.radiusOptionsKm.map((k) => (
                <button key={k} onClick={() => setRadius(k)} className={cx('px-3 py-1.5 rounded-full text-xs border cursor-pointer', radius === k ? 'bg-gold text-navy border-gold font-semibold' : 'border-slate-300 dark:border-white/15')}>{k} km</button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1.5">Compatibility</div>
            <Select value={String(minScore)} onChange={(e) => setMinScore(Number(e.target.value))} placeholder="All compatible"
              options={RADAR.minScoreOptions.filter((x) => x > 0).map((x) => ({ value: String(x), label: `${x}% and above` }))} />
          </div>
        </Card>
        <h2 className="font-display text-lg pt-1">Nearby now</h2>
        {items.length === 0 ? (
          <Card><Empty icon={<Eye className="w-5 h-5" />} title="No compatible members in range">Try a wider radius, or check back later. People appear when they open the app nearby.</Empty></Card>
        ) : items.map((m) => (
          <button key={m.id} onClick={() => setSelected(m)} className="w-full text-left cursor-pointer">
            <Card className="!p-3 flex items-center gap-3 hover:border-gold/50">
              <Photo path={m.photos?.[0]} alt={m.name} className="w-14 h-14 rounded-xl" />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{m.name}{m.age ? `, ${m.age}` : ''}</div>
                <div className="text-xs text-slate-500 truncate">{m.occupation} · {m.distance_km} km (approx.)</div>
              </div>
              <ScoreBadge score={m.score} band={undefined} />
            </Card>
          </button>
        ))}
        {cap != null && items.length >= cap && (
          <p className="text-xs text-slate-500 text-center">Your plan shows up to {cap} matches on the radar. Upgrade to Premium to see everyone in range.</p>
        )}
      </div>


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
