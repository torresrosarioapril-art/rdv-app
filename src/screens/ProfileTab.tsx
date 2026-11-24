import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  CalendarCheck, Copy, Crown, Lock, LogOut, MapPin, Pencil, Plus, RefreshCw, Shield, ShieldCheck, Trash2, UserX,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  addSafeZone, cancelConsultation, deleteAccount, deleteSafeZone, listSafeZones, myCalendar, requestConsultation, startCheckout,
  type CalendarEvent, type Status,
} from '@/lib/api';
import { ANDROID_IOS_RATING, SIGNUP_COPY, SUPPORT } from '@/config/app';
import { Badge, Button, Card, Field, Input, Modal, Photo, cx, useAction, useToast } from '@/components/ui';
import { SafetyStandardsModal } from '@/components/SafetyStandardsModal';

export default function ProfileTab({ status, refresh, onEditProfile }: {
  status: Status; refresh: () => Promise<void>; onEditProfile: () => void;
}) {
  const [me, setMe] = useState<{ display_name: string; photos: string[] } | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [safety, setSafety] = useState(false);
  useEffect(() => {
    supabase.from('profiles').select('display_name,photos').eq('id', status.user_id).single().then(({ data }) => setMe(data as any));
    myCalendar().then(setEvents).catch(() => {});
  }, [status.user_id]);
  const upcoming = events.filter((e) => new Date(e.starts_at) > new Date());

  return (
    <div className="grid lg:grid-cols-3 gap-5">
      <div className="space-y-5">
        <Card className="text-center">
          <Photo path={me?.photos?.[0]} alt={me?.display_name ?? 'Me'} className="w-24 h-24 rounded-full mx-auto" />
          <h1 className="text-2xl font-display mt-3">{me?.display_name}</h1>
          <div className="mt-2"><Badge tone="green"><ShieldCheck className="w-3 h-3" />Verified member</Badge></div>
          <Button variant="outline" className="mt-4" onClick={onEditProfile}><Pencil className="w-4 h-4" />Edit profile</Button>
        </Card>
        <Referral status={status} />
        <Card>
          <h3 className="font-display text-lg mb-3">Upcoming dates</h3>
          {upcoming.length === 0 ? <p className="text-sm text-slate-500">No confirmed dates yet.</p> : (
            <div className="space-y-2">
              {upcoming.map((e) => (
                <div key={e.id} className="rounded-xl bg-slate-50 dark:bg-navy-3 p-3 text-sm">
                  <div className="font-medium flex items-center gap-1.5"><CalendarCheck className="w-4 h-4 text-gold" />{e.title}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{new Date(e.starts_at).toLocaleString()}</div>
                  {e.map_url && <a className="text-xs text-gold flex items-center gap-1 mt-1" href={e.map_url} target="_blank" rel="noreferrer"><MapPin className="w-3 h-3" />{e.venue_name}</a>}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="lg:col-span-2 space-y-5">
        <PlanCard status={status} />
        {status.plan === 'plan2' && <Consultations status={status} refresh={refresh} />}
        <Card className="space-y-3">
          <h3 className="font-display text-lg">Safety & support</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">Report or block anyone from their profile or chat. Reports go to our review team, and intimate images shared without consent are hidden immediately. Rated {ANDROID_IOS_RATING}.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setSafety(true)}><Shield className="w-4 h-4" />Community standards</Button>
            <a href={`mailto:${status.support?.email ?? SUPPORT.email}`}><Button variant="outline">Contact support · {status.support?.email ?? SUPPORT.email}</Button></a>
          </div>
        </Card>
        <Account />
      </div>
      <SafetyStandardsModal isOpen={safety} onClose={() => setSafety(false)} />
    </div>
  );
}

function PlanCard({ status }: { status: Status }) {
  const [plans, setPlans] = useState<Record<string, any> | null>(null);
  const toast = useToast();
  useEffect(() => { supabase.from('app_config').select('value').eq('key', 'plans').single().then(({ data }) => setPlans(data?.value ?? null)); }, []);
  const sub = status.subscription;
  const paid = sub && sub.plan !== 'free' && ['active', 'trialing', 'past_due'].includes(sub.status);
  const buy = (item: 'plan1' | 'plan2' | 'safe_zones' | 'swipe_refresh') => startCheckout(item).catch((e) => toast(e.message, 'err'));

  const [preferred, setPreferred] = useState<string | null>(null);
  useEffect(() => { supabase.from('profile_private').select('preferred_plan').eq('user_id', status.user_id).single().then(({ data }) => setPreferred(data?.preferred_plan ?? null)); }, [status.user_id]);
  const pending = !paid && (preferred === 'plan1' || preferred === 'plan2') ? preferred : null;
  return (
    <Card className="space-y-4">
      {pending && plans?.[pending] && (
        <div className="rounded-xl border border-gold/50 bg-gold/10 p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">You chose <b>{plans[pending].label}</b> when you applied. Confirm it to keep those limits after your trial.</div>
          <Button onClick={() => buy(pending as 'plan1' | 'plan2')}>Confirm {plans[pending].label} · {plans[pending].price_aed} AED/month</Button>
        </div>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-gold">Your plan</div>
          <h2 className="text-2xl font-display flex items-center gap-2"><Crown className="w-5 h-5 text-gold" />{status.limits.label}</h2>
          <p className="text-sm text-slate-500 mt-1">
            {status.in_trial && !paid && status.trial_ends_at ? `Full-access trial until ${new Date(status.trial_ends_at).toLocaleDateString()}, then the free plan unless you upgrade.`
              : paid && sub?.current_period_end ? `${sub.cancel_at_period_end ? 'Ends' : 'Renews'} on ${new Date(sub.current_period_end).toLocaleDateString()}.`
              : 'Free plan. Upgrade anytime.'}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
        <Stat k="Profiles / day" v={String(status.limits.swipes_per_day)} />
        <Stat k="Drops this week" v={`${status.drops_this_week} / ${status.limits.drops_per_week}`} />
        <Stat k="Radar" v={status.limits.radar_cap == null ? 'Unlimited' : `Up to ${status.limits.radar_cap}`} />
        <Stat k="Refresh credits" v={String(status.swipe_credits)} />
      </div>
      {plans && (
        <div className="grid sm:grid-cols-2 gap-3">
          {(['plan1', 'plan2'] as const).map((k) => {
            const p = plans[k];
            const current = paid && sub?.plan === k;
            return (
              <div key={k} className={cx('rounded-xl border p-4', k === 'plan2' ? 'border-gold/50' : 'border-slate-200 dark:border-white/10')}>
                <div className="font-display text-lg">{p.label}</div>
                <div className="text-xl font-semibold">{p.price_aed} AED<span className="text-xs font-normal text-slate-500"> / month</span></div>
                <ul className="text-xs text-slate-500 mt-2 space-y-1">
                  <li>{p.swipes_per_day} profiles a day</li>
                  <li>{p.drops_per_week} curated 75%+ drops a week</li>
                  <li>Radar: {p.radar_cap == null ? 'everyone compatible in range' : `up to ${p.radar_cap}`}</li>
                  {p.consultations_per_month > 0 && <li>Weekly 1-on-1 consultation with our matchmaker</li>}
                </ul>
                <Button className="w-full mt-3" variant={current ? 'outline' : 'gold'} disabled={current} onClick={() => buy(k)}>{current ? 'Current plan' : `Choose ${p.label}`}</Button>
              </div>
            );
          })}
        </div>
      )}
      <div className="flex flex-wrap gap-2 pt-1">
        {paid && <Button variant="outline" onClick={() => startCheckout('portal').catch((e) => toast(e.message, 'err'))}><Crown className="w-4 h-4" />Manage billing & cancel</Button>}
        <Button variant="outline" onClick={() => buy('swipe_refresh')}><RefreshCw className="w-4 h-4" />Buy an early refresh</Button>
        {!status.safe_zones_enabled && <Button variant="outline" onClick={() => buy('safe_zones')}><Shield className="w-4 h-4" />Unlock Safe Zones</Button>}
      </div>
      <p className="text-[11px] text-slate-500">Payments are in test mode until Rendez-vous's trade license is active.</p>
    </Card>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return <div className="rounded-xl bg-slate-50 dark:bg-navy-3 p-3"><div className="text-[10px] uppercase tracking-wider text-slate-500">{k}</div><div className="font-medium mt-0.5">{v}</div></div>;
}

function Consultations({ status, refresh }: { status: Status; refresh: () => Promise<void> }) {
  const [slot, setSlot] = useState('');
  const { busy, run } = useAction();
  const next = status.next_consultation;
  return (
    <Card className="space-y-3">
      <h3 className="font-display text-lg">1-on-1 matchmaking consultation</h3>
      <p className="text-sm text-slate-500">{status.consultations_this_month} of {status.limits.consultations_per_month} booked this month.</p>
      {next ? (
        <div className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-navy-3 p-3 text-sm">
          <span>{new Date(next.slot_at).toLocaleString()} · <Badge tone={next.status === 'confirmed' ? 'green' : 'slate'}>{next.status}</Badge></span>
          <Button variant="ghost" busy={busy} onClick={async () => { if (await run(() => cancelConsultation(next.id), 'Cancelled')) refresh(); }}>Cancel</Button>
        </div>
      ) : null}
      <div className="flex gap-2 items-end">
        <Field label="Request a slot"><Input type="datetime-local" value={slot} onChange={(e) => setSlot(e.target.value)} /></Field>
        <Button busy={busy} disabled={!slot} onClick={async () => { if (await run(() => requestConsultation(new Date(slot)), 'Requested. Our matchmaker will confirm.')) { setSlot(''); refresh(); } }}>Request</Button>
      </div>
    </Card>
  );
}

export function SafeZones({ status }: { status: Status }) {
  const [zones, setZones] = useState<{ id: string; label: string; radius_m: number }[]>([]);
  const [label, setLabel] = useState('');
  const { busy, run } = useAction();
  const toast = useToast();
  const load = () => listSafeZones().then(setZones as any).catch(() => {});
  useEffect(() => { if (status.safe_zones_enabled) load(); }, [status.safe_zones_enabled]);

  return (
    <Card className="space-y-3">
      <h3 className="font-display text-lg flex items-center gap-2"><Shield className="w-5 h-5 text-gold" />Safe Zones</h3>
      <p className="text-sm text-slate-500">Save places like home or the office. Whenever your location shows you're inside one, you're switched to Ghost automatically, even if you forgot to turn it on. You become visible again once you leave.</p>
      {!status.safe_zones_enabled ? (
        <div className="rounded-xl border border-dashed border-gold/40 p-4 text-center space-y-2">
          <Lock className="w-5 h-5 text-gold mx-auto" />
          <p className="text-sm">Safe Zones is a one-time add-on: automatic Ghost mode at the places you choose.</p>
          <Button onClick={() => startCheckout('safe_zones').catch((e) => toast(e.message, 'err'))}>Unlock Safe Zones</Button>
        </div>
      ) : (
        <>
          {zones.map((z) => (
            <div key={z.id} className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-navy-3 p-3 text-sm">
              <span className="flex items-center gap-2"><MapPin className="w-4 h-4 text-gold" />{z.label} · {z.radius_m} m</span>
              <Button variant="ghost" busy={busy} onClick={async () => { if (await run(() => deleteSafeZone(z.id))) load(); }}><Trash2 className="w-4 h-4" /></Button>
            </div>
          ))}
          <div className="flex gap-2 items-end">
            <Field label="Name this place"><Input value={label} placeholder="Home" onChange={(e) => setLabel(e.target.value)} /></Field>
            <Button busy={busy} disabled={!label.trim()} onClick={() => navigator.geolocation.getCurrentPosition(
              async (p) => { if (await run(() => addSafeZone(label.trim(), p.coords.latitude, p.coords.longitude), 'Safe Zone added')) { setLabel(''); load(); } },
              () => toast('Location is blocked', 'err'),
            )}><Plus className="w-4 h-4" />Add where I am</Button>
          </div>
        </>
      )}
    </Card>
  );
}

function Referral({ status }: { status: Status }) {
  const [qr, setQr] = useState<string | null>(null);
  const toast = useToast();
  const link = status.referral_code ? `${window.location.origin}/?${SIGNUP_COPY.codeParam}=${status.referral_code}` : null;
  useEffect(() => {
    if (link) QRCode.toDataURL(link, { margin: 1, width: 220, color: { dark: '#0a1322', light: '#ffffff' } }).then(setQr).catch(() => {});
  }, [link]);
  if (!link) return null;
  return (
    <Card className="text-center space-y-3">
      <h3 className="font-display text-lg">Invite someone you trust</h3>
      {qr && <img src={qr} alt="Referral QR code" className="w-40 h-40 mx-auto rounded-xl" />}
      <div className="font-mono tracking-widest text-gold">{status.referral_code}</div>
      <div className="flex justify-center gap-2">
        <Button variant="outline" onClick={() => { navigator.clipboard.writeText(link); toast('Invite link copied'); }}><Copy className="w-4 h-4" />Copy link</Button>
        {'share' in navigator && <Button variant="outline" onClick={() => navigator.share({ title: 'Join me on Rendez-vous', url: link }).catch(() => {})}>Share</Button>}
      </div>
    </Card>
  );
}

function Account() {
  const [confirm, setConfirm] = useState(false);
  const [typed, setTyped] = useState('');
  const { busy, run } = useAction();
  return (
    <Card className="flex flex-wrap gap-2 justify-between items-center">
      <Button variant="outline" onClick={() => supabase.auth.signOut()}><LogOut className="w-4 h-4" />Sign out</Button>
      <Button variant="danger" onClick={() => setConfirm(true)}><UserX className="w-4 h-4" />Delete account</Button>
      <Modal open={confirm} onClose={() => setConfirm(false)} title="Delete your account?">
        <p className="text-sm text-slate-500 mb-4">This permanently deletes your profile, photos, voice notes, matches and messages. It can't be undone. Active subscriptions are cancelled.</p>
        <Field label='Type "DELETE" to confirm'><Input value={typed} onChange={(e) => setTyped(e.target.value)} /></Field>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" onClick={() => setConfirm(false)}>Keep my account</Button>
          <Button variant="danger" busy={busy} disabled={typed !== 'DELETE'} onClick={() => run(deleteAccount)}>Delete permanently</Button>
        </div>
      </Modal>
    </Card>
  );
}
