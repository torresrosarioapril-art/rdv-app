import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, MapPin, MessageCircle, Radar as RadarIcon, ShieldCheck } from 'lucide-react';
import {
  giveConsent, radar, startCheckout, radarConnect, setPrivacy, updateMyLocation, type MemberCard, type Privacy, type Status,
} from '@/lib/api';
import { DUBAI_AREAS, RADAR, VISIBILITY } from '@/config/app';
import { Badge, Button, Card, Empty, Modal, Photo, Select, Toggle, cx, useToast, RadarRings } from '@/components/ui';
import { getNearbyAlert, saveNearbyAlert, type NearbyAlert } from '@/lib/api';
import { BellRing, ChevronDown } from 'lucide-react';
import { SafeZones } from '@/screens/ProfileTab';
import { ProfileView, ScoreBadge } from '@/components/ProfileView';
import { SafetyMenu } from '@/components/SafetyMenu';

const RadarMap = lazy(() => import('@/components/RadarMap'));

type Pos = { lat: number; lng: number };

function bearingKm(from: Pos, to: Pos) {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(to.lat - from.lat), dLng = toRad(to.lng - from.lng);
  const y = Math.sin(dLng) * Math.cos(toRad(to.lat));
  const x = Math.cos(toRad(from.lat)) * Math.sin(toRad(to.lat)) - Math.sin(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.cos(dLng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2;
  return { bearing: Math.atan2(y, x), km: 2 * R * Math.asin(Math.sqrt(a)) };
}

/** The nearest named area to an (already approximate) position, if one is within 3 km. */
function nearestArea(p: Pos): string | null {
  let best: { name: string; km: number } | null = null;
  for (const a of DUBAI_AREAS) {
    const { km } = bearingKm(p, a);
    if (!best || km < best.km) best = { name: a.name, km };
  }
  return best && best.km <= 3 ? best.name : null;
}

function activeAgo(min?: number) {
  if (min == null) return null;
  if (min < 2) return 'active now';
  if (min < 60) return `active ${min} min ago`;
  return `active ${Math.floor(min / 60)} h ago`;
}

export default function RadarTab({ status, refreshStatus, onOpenChat, onOpenPlan }: {
  status: Status; refreshStatus: () => Promise<void>; onOpenChat: (id: string) => void; onOpenPlan?: () => void;
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
  const [hidden, setHidden] = useState({ total: 0, strong: 0, min: 75 });
  const [unlockUntil, setUnlockUntil] = useState<string | null>(null);
  const [unlockPrice, setUnlockPrice] = useState<number | null>(null);
  const [unlockHours, setUnlockHours] = useState(24);
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
    try { const r = await radar(radius, minScore); setItems(r.items); setCap(r.cap); setHidden({ total: r.hidden ?? 0, strong: r.hidden_strong ?? 0, min: r.strong_min ?? 75 }); setUnlockUntil(r.unlock_until ?? null); setUnlockPrice(r.unlock_price_aed ?? null); setUnlockHours(r.unlock_hours ?? 24); }
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
    try { await setPrivacy(p); toast(p === 'ghost' ? "You're hidden from the radar" : 'You show up approximately (300 m)'); refreshStatus(); }
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
          <p>The radar shows verified, compatible members who are near you right now. We use your location only while the app is open. For your safety nobody ever sees your exact spot: you appear to the nearest 300 m on the map, or not at all (Ghost).</p>
          <Button className="mt-5" onClick={async () => { try { await giveConsent('location'); setConsented(true); } catch (e) { toast(e instanceof Error ? e.message : 'Error', 'err'); } }}>
            <MapPin className="w-4 h-4" />Turn on the radar
          </Button>
        </Empty>
      </Card>
    );
  }

  const zoneHidden = inZone && privacy !== 'ghost';
  const visibilitySummary = privacy === 'ghost' ? 'Hidden (Ghost)' : zoneHidden ? 'Hidden by a Safe Zone' : 'Visible, to the nearest 300 m';
  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
      <div className="lg:col-span-3 space-y-3">
        <Card className="!p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-2xl font-display">Live <span className="italic text-gold">radar</span></h1>
            <button onClick={() => changePrivacy(privacy === 'ghost' ? 'blur' : 'ghost')}
              className={cx('flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium cursor-pointer bg-ink text-gold-soft dark:bg-transparent dark:border',
                privacy === 'ghost' || zoneHidden ? 'dark:border-gold/40 dark:text-gold' : 'dark:border-emerald-400/40 dark:text-emerald-300')}>
              {privacy === 'ghost' || zoneHidden ? <EyeOff className="w-3.5 h-3.5" /> : <RadarRings className="w-3.5 h-3.5 text-emerald-300" />}
              {privacy === 'ghost' ? 'Ghost' : zoneHidden ? 'Safe Zone' : 'Visible'}
            </button>
          </div>
          {/* Distance filter; the match % filter sits under the map next to the count */}
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {RADAR.radiusOptionsKm.map((k) => (
              <button key={k} onClick={() => setRadius(k)} className={cx('px-2.5 py-1 rounded-full text-xs border cursor-pointer', radius === k ? 'bg-gold text-navy border-gold font-semibold' : 'border-slate-300 dark:border-white/15')}>{k} km</button>
            ))}
          </div>
          <div className="relative -mx-4 h-[58vh] min-h-[340px] max-h-[620px] overflow-hidden border-y border-gold/30 bg-ivory dark:bg-navy-2">
            {pos ? (
              <Suspense fallback={<div className="h-full flex items-center justify-center text-sm text-slate-500">Loading the map…</div>}>
                <RadarMap pos={pos} items={items} radiusKm={radius} onSelect={setSelected}
                  youLabel={nearestArea(pos) ? `You · ${nearestArea(pos)}` : 'You'} />
              </Suspense>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-slate-500 px-6 text-center">{geoErr || 'Finding your location…'}</div>
            )}
          </div>
          <div className="flex flex-wrap justify-center items-center gap-2 text-xs">
            {/* Small pill; the real dropdown sits invisibly on top at 16px so phones don't zoom */}
            <label className="relative inline-flex items-center gap-1 rounded-full border border-gold/50 bg-gold/10 text-gold font-medium px-2.5 py-0.5 text-xs cursor-pointer">
              {minScore ? `${minScore}%+ match` : 'All compatible'}<ChevronDown className="w-3 h-3" />
              <select value={String(minScore)} onChange={(e) => setMinScore(Number(e.target.value))} aria-label="Minimum match"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer text-xs">
                <option value="0">All compatible</option>
                {RADAR.minScoreOptions.filter((x) => x > 0).map((x) => <option key={x} value={String(x)}>{x}%+ match</option>)}
              </select>
            </label>
            <Badge tone="slate">{items.length}{cap ? ` of ${cap}` : ''} nearby</Badge>
            {unlockUntil && <Badge>Everyone nearby until {new Date(unlockUntil).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}</Badge>}
          </div>
          {geoErr && <p className="text-sm text-rose-500 text-center">{geoErr}</p>}
          {zoneHidden && <p className="text-sm text-gold text-center flex items-center justify-center gap-1.5"><ShieldCheck className="w-4 h-4" />You're in one of your Safe Zones, so you're hidden automatically.</p>}
          {hidden.total > 0 && (
            <div className="rounded-xl border border-gold/40 bg-gold/10 dark:bg-navy-3 p-3 text-sm space-y-2">
              <p>
                {hidden.strong > 0
                  ? <><b>{hidden.strong} more strong match{hidden.strong === 1 ? '' : 'es'}</b> ({hidden.min}%+) {hidden.strong === 1 ? 'is' : 'are'} nearby right now.</>
                  : <><b>{hidden.total} more compatible member{hidden.total === 1 ? '' : 's'}</b> {hidden.total === 1 ? 'is' : 'are'} nearby right now.</>}
                {' '}Your plan shows up to {cap} on the radar.
              </p>
              <div className="flex flex-wrap gap-2">
                {unlockPrice != null && (
                  <Button className="!py-1.5 text-xs" onClick={() => startCheckout('radar_unlock').catch((e) => toast(e.message, 'err'))}>
                    See everyone nearby · {unlockHours} h for {unlockPrice} AED
                  </Button>
                )}
                {onOpenPlan && <Button variant="outline" className="!py-1.5 text-xs" onClick={onOpenPlan}>Compare plans</Button>}
              </div>
            </div>
          )}
        </Card>
      </div>

      <div className="lg:col-span-2 space-y-3">
        <h2 className="font-display text-lg">Nearby now</h2>
        {items.length === 0 ? (
          <Card className="!p-3.5"><Empty compact icon={<RadarRings className="w-4 h-4" />} title="No one in range just yet">Try a wider radius, or check back later.</Empty></Card>
        ) : items.map((m) => (
          <button key={m.id} onClick={() => setSelected(m)} className="w-full text-left cursor-pointer">
            <Card className="!p-3 flex items-center gap-3 hover:border-gold/50">
              <Photo path={m.photos?.[0]} alt={m.name} className="w-14 h-14 rounded-full ring-2 ring-gold/60 ring-offset-2 ring-offset-white dark:ring-offset-navy-2" />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{m.name}{m.age ? `, ${m.age}` : ''}</div>
                <div className="text-xs text-slate-500 truncate">{m.occupation}</div>
                <div className="text-[11px] text-slate-500 leading-snug">
                  {[m.lat != null && m.lng != null ? nearestArea({ lat: m.lat, lng: m.lng }) && `Near ${nearestArea({ lat: m.lat, lng: m.lng })}` : null,
                    `~${m.distance_km} km`].filter(Boolean).join(' · ')}
                </div>
                {activeAgo(m.last_active_min) && (
                  <div className="text-[11px] text-emerald-600 dark:text-emerald-400 leading-snug flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />{activeAgo(m.last_active_min)}
                  </div>
                )}
              </div>
              <ScoreBadge score={m.score} compact />
            </Card>
          </button>
        ))}

        <h2 className="font-display text-lg pt-3">Radar settings</h2>
        <Card className="!p-0 divide-y divide-gold/20 dark:divide-white/10 overflow-hidden">
          <SettingRow icon={privacy === 'ghost' ? <EyeOff className="w-4 h-4" /> : <RadarRings className="w-4 h-4" />} title="How others see you" summary={visibilitySummary}>
            <div className="grid grid-cols-2 gap-2">
              {VISIBILITY.map((p) => (
                <button key={p.id} onClick={() => changePrivacy(p.id as Privacy)} className={cx('rounded-xl border p-3 text-left cursor-pointer', privacy === p.id ? 'border-gold bg-gold/10' : 'border-slate-200 bg-white dark:bg-transparent dark:border-white/10')}>
                  <div className="flex items-center gap-1.5 text-[13px] font-semibold">{p.id === 'ghost' ? <EyeOff className="w-4 h-4 text-gold" /> : <RadarRings className="w-4 h-4 text-gold" />}{p.label}</div>
                  <div className="text-[10.5px] leading-snug text-slate-500 dark:text-slate-400 mt-1">{p.hint}</div>
                </button>
              ))}
            </div>
          </SettingRow>
          <NearbyAlerts uid={status.user_id} />
          <SettingRow icon={<ShieldCheck className="w-4 h-4" />} title="Safe Zones" summary={status.safe_zones_enabled ? 'Automatic Ghost at your saved places' : 'Locked · one-time add-on'}>
            <SafeZones status={status} bare />
          </SettingRow>
        </Card>
      </div>

      <Modal open={!!selected} onClose={() => setSelected(null)} wide
        actions={selected && <SafetyMenu memberId={selected.id} name={selected.name} onDone={() => { setSelected(null); scan(); }} />}>
        {selected && (
          <>
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

/** Nearby match alerts: get told when a visible match comes within your chosen distance. */
export function NearbyAlerts({ uid }: { uid: string }) {
  const toast = useToast();
  const [pref, setPref] = useState<NearbyAlert | null>(null);
  useEffect(() => { getNearbyAlert(uid).then(setPref).catch(() => setPref({ enabled: false, radius_m: 500, min_score: 75 })); }, [uid]);
  if (!pref) return null;
  const save = async (next: NearbyAlert) => {
    const prev = pref; setPref(next);
    try {
      await saveNearbyAlert(uid, next);
      if (next.enabled && !prev.enabled) {
        if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission().catch(() => {});
        toast(`You'll be alerted when a ${next.min_score}%+ match is within ${next.radius_m >= 1000 ? next.radius_m / 1000 + ' km' : next.radius_m + ' m'}`);
      }
    } catch (e) { setPref(prev); toast(e instanceof Error ? e.message : 'Could not save', 'err'); }
  };
  const label = (m: number) => (m >= 1000 ? `${m / 1000} km` : `${m} m`);
  return (
    <SettingRow icon={<BellRing className="w-4 h-4" />} title="Nearby match alerts"
      summary={pref.enabled ? `On · ${pref.min_score}%+ within ${label(pref.radius_m)}` : 'Off'}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm">Alert me</span>
        <Toggle checked={pref.enabled} onChange={(v) => save({ ...pref, enabled: v })} label="" />
      </div>
      <p className="text-[11px] text-slate-500">A notification when a match comes within range, so you don't have to keep checking. Only while you're visible, never their exact spot, at most once every 12 hours per person.</p>
      {pref.enabled && (
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs space-y-1"><span className="text-slate-500">Within</span>
            <Select value={String(pref.radius_m)} onChange={(e) => save({ ...pref, radius_m: Number(e.target.value) })} placeholder="Distance"
              options={[{ value: '500', label: '500 m' }, { value: '1000', label: '1 km' }, { value: '2000', label: '2 km' }]} />
          </label>
          <label className="text-xs space-y-1"><span className="text-slate-500">Match of at least</span>
            <Select value={String(pref.min_score)} onChange={(e) => save({ ...pref, min_score: Number(e.target.value) })} placeholder="Match %"
              options={[{ value: '60', label: '60%' }, { value: '75', label: '75%' }, { value: '90', label: '90%' }]} />
          </label>
        </div>
      )}
    </SettingRow>
  );
}

/** One collapsible row of the Radar settings list: same look for every setting. */
export function SettingRow({ icon, title, summary, children }: { icon: React.ReactNode; title: string; summary: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-3 p-3.5 text-left cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
        <span className="w-8 h-8 rounded-full icon-disc flex items-center justify-center shrink-0">{icon}</span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-medium">{title}</span>
          <span className="block text-[11px] text-slate-500 truncate">{summary}</span>
        </span>
        <ChevronDown className={cx('w-4 h-4 text-slate-400 transition', open && 'rotate-180')} />
      </button>
      {open && <div className="px-3.5 pb-3.5 space-y-3">{children}</div>}
    </div>
  );
}
