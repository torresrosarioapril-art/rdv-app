import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  Bell, Copy, Crown, Eye, ImagePlus, Lock, LogOut, MapPin, Moon, Pencil, Plus, Shield, ShieldCheck, Sun, Trash2, UserX, X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  addSafeZone, astroSync, cancelConsultation, manageSubscription, deleteAccount, deleteSafeZone, listSafeZones, myProfile, requestConsultation,
  saveNotifyPrefs, saveProfile, signedUrl, startCheckout, uploadFile, type MemberCard, type NotifyPrefs, type Status,
} from '@/lib/api';
import { ANDROID_IOS_RATING, SIGNUP_COPY, SUPPORT } from '@/config/app';
import { Badge, Button, Card, Field, Input, Modal, Photo, Spinner, Toggle, cx, useAction, useToast } from '@/components/ui';
import { ProfileView } from '@/components/ProfileView';
import { Recorder } from '@/components/Recorder';
import { SafetyStandardsModal } from '@/components/SafetyStandardsModal';
import { NearbyAlerts, SettingRow } from '@/screens/RadarTab';

export default function ProfileTab({ view = 'profile', status, refresh, onEditProfile, theme, onToggleTheme, onOpenSettings, onBack }: {
  view?: 'profile' | 'settings'; status: Status; refresh: () => Promise<void>; onEditProfile: (step?: number) => void;
  theme: 'dark' | 'light'; onToggleTheme: () => void; onOpenSettings: () => void; onBack: () => void;
}) {
  const [data, setData] = useState<{ profile: Record<string, any>; priv: Record<string, any> } | null>(null);
  const [safety, setSafety] = useState(false);
  const [preview, setPreview] = useState(false);
  const loadMe = () => myProfile().then(setData).catch(() => {});
  useEffect(() => {
    loadMe();
    astroSync();
    const t = setTimeout(loadMe, 8000); // pick up a freshly built birth chart
    return () => clearTimeout(t);
  }, [status.user_id]);
  const card = data ? toCard(data.profile, data.priv) : null;

  if (view === 'settings') {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center gap-2">
          <button onClick={onBack} aria-label="Close settings"
            className="flex items-center gap-1.5 rounded-full bg-slate-200/70 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 pl-2 pr-3 py-1.5 text-sm font-medium cursor-pointer">
            <X className="w-5 h-5" />Close
          </button>
          <h1 className="text-2xl font-display ml-1">Settings</h1>
        </div>
        <div id="plan" className="scroll-mt-20"><PlanCard status={status} refresh={refresh} /></div>
        {status.plan === 'plan2' && <Consultations status={status} refresh={refresh} />}
        <SectionTitle>Visibility & safety on the radar</SectionTitle>
        <Card className="!p-0 divide-y divide-slate-200 dark:divide-white/10 overflow-hidden">
          <SettingRow icon={<Shield className="w-4 h-4" />} title="Safe Zones" summary={status.safe_zones_enabled ? 'Automatic Ghost at your saved places' : 'Locked · one-time add-on'}>
            <SafeZones status={status} bare />
          </SettingRow>
          <NearbyAlerts uid={status.user_id} />
        </Card>
        <p className="text-[11px] text-slate-500 -mt-2">To switch between Visible and Ghost, use the eye button at the top of every screen.</p>
        <SectionTitle>Notifications</SectionTitle>
        {data && <NotificationSettings uid={data.profile.id} initial={data.priv.notify_prefs} />}
        <SectionTitle>Invite friends</SectionTitle>
        <Referral status={status} />
        <SectionTitle>Appearance</SectionTitle>
        <Card className="!p-3.5 flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-sm">{theme === 'dark' ? <Moon className="w-4 h-4 text-gold" /> : <Sun className="w-4 h-4 text-gold" />}Dark mode</span>
          <Toggle checked={theme === 'dark'} onChange={onToggleTheme} label="" />
        </Card>
        <SectionTitle>Safety & support</SectionTitle>
        <Card className="space-y-3">
          <p className="text-sm text-slate-500 dark:text-slate-400">Report or block anyone from their profile or chat. Reports go to our review team, and intimate images shared without consent are hidden immediately. Rated {ANDROID_IOS_RATING}.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setSafety(true)}><Shield className="w-4 h-4" />Community standards</Button>
            <a href={`mailto:${status.support?.email ?? SUPPORT.email}`}><Button variant="outline">Contact support</Button></a>
          </div>
        </Card>
        <SectionTitle>Account</SectionTitle>
        <Account />
        <SafetyStandardsModal isOpen={safety} onClose={() => setSafety(false)} />
      </div>
    );
  }

  const p = data?.profile;
  const checks: [boolean, string, number | string][] = p ? [
    [(p.photos ?? []).length >= 3, 'Add at least 3 photos', 'photos'],
    [!!p.voice_intro_path, 'Record a voice intro', 'voice'],
    [!!p.headline, 'Write a headline', 4],
    [(p.bio ?? '').length >= 40, 'Tell your story', 4],
    [(p.prompts ?? []).filter((x: any) => x.answer?.trim()).length >= 3, 'Answer 3 prompts', 4],
    [(p.interests ?? []).length >= 3, 'Pick a few interests', 4],
  ] : [];
  const done = checks.filter((c) => c[0]).length;
  const pct = checks.length ? Math.round((done / checks.length) * 100) : 0;
  const next = checks.find((c) => !c[0]);

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Summary: who you are, how complete, preview + edit */}
      <Card className="!p-4 space-y-3">
        <div className="flex items-center gap-3">
          <Photo path={p?.photos?.[0]} alt={p?.display_name ?? '?'} className="w-16 h-16 rounded-full shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="text-xl font-display truncate">{p?.display_name ?? 'My profile'}{card?.age ? `, ${card.age}` : ''}</h1>
              <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" aria-label="Verified" />
            </div>
            <div className="text-xs text-slate-500 truncate">{[p?.occupation, p?.district ?? p?.city].filter(Boolean).join(' · ')}</div>
          </div>
        </div>
        {checks.length > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-[11px]"><span className="text-slate-500">Profile {pct}% complete</span>
              {next && <button className="text-gold cursor-pointer" onClick={() => typeof next[2] === 'string' ? document.getElementById(next[2])?.scrollIntoView({ behavior: 'smooth', block: 'center' }) : onEditProfile(next[2])}>{next[1]} →</button>}</div>
            <div className="h-1.5 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden"><div className="h-full bg-gold rounded-full" style={{ width: `${pct}%` }} /></div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => setPreview(true)} disabled={!card}><Eye className="w-4 h-4" />Preview</Button>
          <Button onClick={() => onEditProfile(1)}><Pencil className="w-4 h-4" />Edit profile</Button>
        </div>
      </Card>

      {data && <div id="photos"><PhotoManager uid={data.profile.id} photos={data.profile.photos ?? []} name={data.profile.display_name} onChange={loadMe} /></div>}
      {data && <div id="voice"><VoiceIntro uid={data.profile.id} path={data.profile.voice_intro_path ?? null} onChange={loadMe} /></div>}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-lg">About me</h3>
          <button onClick={() => onEditProfile(4)} className="text-xs text-gold flex items-center gap-1 cursor-pointer"><Pencil className="w-3.5 h-3.5" />Edit</button>
        </div>
        {card ? <ProfileView m={card} self noPhotos /> : <Spinner />}
      </Card>
      {data && <LookingFor priv={data.priv} onEdit={() => onEditProfile(3)} />}

      <Modal open={preview} onClose={() => setPreview(false)} wide>
        <div className="text-[11px] uppercase tracking-widest text-gold mb-3">Preview: how members see your profile</div>
        {card && <ProfileView m={card} preview />}
        <p className="text-[11px] text-slate-500 mt-3">Members also see your compatibility score with them and your zodiac match.</p>
      </Modal>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[11px] uppercase tracking-widest text-gold pt-2">{children}</h2>;
}

function ageOf(d?: string | null) {
  if (!d) return null;
  const b = new Date(d), n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
  return a;
}

const ELEMENT: Record<string, string> = { Aries: 'Fire', Leo: 'Fire', Sagittarius: 'Fire', Taurus: 'Earth', Virgo: 'Earth', Capricorn: 'Earth', Gemini: 'Air', Libra: 'Air', Aquarius: 'Air', Cancer: 'Water', Scorpio: 'Water', Pisces: 'Water' };

function toCard(p: Record<string, any>, x: Record<string, any>): MemberCard {
  return {
    id: p.id, name: p.display_name, age: ageOf(x.birth_date), gender: p.gender, nationality: p.nationality, city: p.city,
    district: p.district, occupation: p.occupation, company: p.company, industry: p.industry, university: p.university,
    degree: p.degree, height_cm: p.height_cm, political: p.political, religion: p.religion, religion_practice: p.religion_practice,
    marriage_timeline: p.marriage_timeline, kids: p.kids, drinking: p.drinking, smoking: p.smoking, relocation: p.relocation,
    zodiac: { sun: p.zodiac_sun, moon: p.zodiac_moon, rising: p.zodiac_rising, element: ELEMENT[p.zodiac_sun] ?? null,
      placements: p.natal_placements, chart_path: p.natal_chart_path },
    headline: p.headline, bio: p.bio, prompts: p.prompts ?? [], interests: p.interests ?? [], photos: p.photos ?? [],
    voice_intro_path: p.voice_intro_path, linkedin_url: p.linkedin_url, verified: p.verification_status === 'approved',
  };
}

function LookingFor({ priv, onEdit }: { priv: Record<string, any>; onEdit: () => void }) {
  const rows: [string, string][] = [
    ['Age', `${priv.desired_age_min}–${priv.desired_age_max}`],
    ['Nationality', (priv.desired_nationalities ?? []).length ? priv.desired_nationalities.join(', ') : 'Any'],
    ['Religion', priv.desired_religion || 'Any'],
    ['Faith', priv.religion_flexible ? 'Flexible: open to a different faith' : 'Same faith only'],
    ['Children', priv.kids_flexible ? 'Flexible' : 'Must match my answer'],
    ['Drinking', ({ never_only: 'Non-drinkers only', occasional_ok: 'Occasionally is OK', any: "Doesn't matter" } as Record<string, string>)[priv.drinking_tolerance ?? 'any']],
    ['Smoking', ({ never_only: 'Non-smokers only', occasional_ok: 'Occasionally is OK', any: "Doesn't matter" } as Record<string, string>)[priv.smoking_tolerance ?? 'any']],
  ];
  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-lg">What I'm looking for</h3>
        <Button variant="ghost" className="!py-1.5 text-xs" onClick={onEdit}><Pencil className="w-3.5 h-3.5" />Edit</Button>
      </div>
      <p className="text-xs text-slate-500 mb-3">Only you see this. It decides who appears in your batch, drops and radar.</p>
      <div className="grid sm:grid-cols-2 gap-2">
        {rows.map(([k, v]) => (
          <div key={k} className="rounded-xl bg-slate-50 dark:bg-navy-3 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-slate-500">{k}</div>
            <div className="text-sm">{v}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function VoiceIntro({ uid, path, onChange }: { uid: string; path: string | null; onChange: () => void }) {
  const toast = useToast();
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { signedUrl('voice', path).then(setUrl); }, [path]);
  const save = async (next: string | null, ok: string) => {
    setBusy(true);
    try { await saveProfile({ voice_intro_path: next }, {}); toast(ok); onChange(); }
    catch (e) { toast(e instanceof Error ? e.message : 'Could not save', 'err'); }
    finally { setBusy(false); }
  };
  return (
    <Card className="space-y-3">
      <h3 className="font-display text-lg">Voice intro</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400">Up to 45 seconds in your own voice, shown on your profile. Record a new one anytime.</p>
      {path && url ? <audio src={url} controls className="w-full" /> : <p className="text-sm text-slate-500">No voice intro yet.</p>}
      <div className="flex flex-wrap gap-2 items-start">
        <Recorder kind="audio" maxSeconds={45} label={path ? 'Re-record' : 'Record voice intro'} onDone={async (b, _s, ext) => {
          setBusy(true);
          try { const np = await uploadFile('voice', b, ext, uid); await save(np, path ? 'Voice intro updated' : 'Voice intro added'); }
          catch (e) { toast(e instanceof Error ? e.message : 'Upload failed', 'err'); setBusy(false); }
        }} />
        {path && <Button type="button" variant="ghost" busy={busy} onClick={() => save(null, 'Voice intro removed')}><Trash2 className="w-4 h-4" />Remove</Button>}
      </div>
    </Card>
  );
}

function PhotoManager({ uid, photos, name, onChange }: { uid: string; photos: string[]; name: string; onChange: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [list, setList] = useState<string[]>(photos);
  useEffect(() => { setList(photos); }, [photos]);

  const persist = async (next: string[], ok?: string) => {
    const prev = list;
    setList(next);
    setBusy(true);
    try { await saveProfile({ photos: next }, {}); if (ok) toast(ok); onChange(); }
    catch (e) { setList(prev); toast(e instanceof Error ? e.message : 'Could not save', 'err'); }
    finally { setBusy(false); }
  };

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    const picked = Array.from(el.files ?? []).slice(0, 6 - list.length);
    el.value = '';
    if (!picked.length) return;
    toast(picked.length > 1 ? `Uploading ${picked.length} photos…` : 'Uploading photo…');
    setBusy(true);
    try {
      const paths: string[] = [];
      for (const file of picked) {
        if (file.size > 10 * 1024 * 1024) { toast('A photo is over 10 MB and was skipped', 'err'); continue; }
        const ext = ((file.name.includes('.') ? file.name.split('.').pop() : file.type.split('/')[1]) || 'jpg').toLowerCase();
        paths.push(await uploadFile('photos', file, ext, uid));
      }
      if (paths.length) await persist([...list, ...paths], paths.length > 1 ? `${paths.length} photos added` : 'Photo added');
    } catch (err) {
      toast(err instanceof Error ? `Upload failed: ${err.message}` : 'Upload failed', 'err');
    } finally {
      setBusy(false);
    }
  };

  // The file input sits directly on top of the tap target (transparent), which is the most reliable way to
  // open the picker and receive the chosen photo on iPhone.
  // A plain element (not an inner component) so it is never re-created while the picker is open.
  const pickerOverlay = (
    <input type="file" accept="image/*" multiple disabled={busy} onChange={onPick}
      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" aria-label="Add photos" />
  );

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-lg">My photos <span className="text-sm text-slate-500 font-sans">{list.length} / 6</span></h3>
        {list.length < 6 && (
          <div className="relative">
            <Button variant="outline" className="!py-1.5 text-xs pointer-events-none" busy={busy}><ImagePlus className="w-4 h-4" />Add photos</Button>
            {pickerOverlay}
          </div>
        )}
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {list.map((p, i) => (
          <div key={p} className="relative aspect-[3/4] rounded-xl overflow-hidden">
            <Photo path={p} alt={name} className="w-full h-full" />
            {i === 0 ? <span className="absolute left-1 top-1"><Badge>Main</Badge></span>
              : <button disabled={busy} onClick={() => persist([p, ...list.filter((x) => x !== p)], 'Main photo updated')} className="absolute left-1 bottom-1 rounded-md bg-black/60 text-white text-[10px] px-1.5 py-0.5 cursor-pointer">Make main</button>}
            {list.length > 1 && (
              <button disabled={busy} onClick={() => persist(list.filter((x) => x !== p), 'Photo removed')} className="absolute right-1 top-1 p-1 rounded-md bg-black/60 text-white cursor-pointer" aria-label="Remove photo"><Trash2 className="w-3 h-3" /></button>
            )}
          </div>
        ))}
        {list.length < 6 && (
          <div className="relative aspect-[3/4] rounded-xl border-2 border-dashed border-slate-300 dark:border-white/15 flex flex-col items-center justify-center gap-1 text-[11px] text-slate-500 hover:border-gold">
            <ImagePlus className="w-5 h-5" />{busy ? 'Uploading…' : 'Add'}
            {pickerOverlay}
          </div>
        )}
      </div>
      <p className="text-xs text-slate-500 mt-2">Add up to 6 clear, recent photos (you can pick several at once). The first one is shown on your card and the radar.</p>
    </Card>
  );
}

function PlanCard({ status, refresh }: { status: Status; refresh: () => Promise<void> }) {
  const [plans, setPlans] = useState<Record<string, any> | null>(null);
  const toast = useToast();
  useEffect(() => { supabase.from('app_config').select('value').eq('key', 'plans').single().then(({ data }) => setPlans(data?.value ?? null)); }, []);
  const sub = status.subscription;
  const paid = sub && sub.plan !== 'free' && ['active', 'trialing', 'past_due'].includes(sub.status);
  const buy = (item: 'plan1' | 'plan2' | 'safe_zones') => startCheckout(item).catch((e) => toast(e.message, 'err'));
  const [confirm, setConfirm] = useState<null | { kind: 'switch'; plan: 'plan1' | 'plan2' } | { kind: 'cancel' }>(null);
  const { busy, run } = useAction();
  const until = sub?.current_period_end ? new Date(sub.current_period_end).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const cancelling = !!(paid && sub?.cancel_at_period_end);

  const [preferred, setPreferred] = useState<string | null>(null);
  useEffect(() => { supabase.from('profile_private').select('preferred_plan').eq('user_id', status.user_id).single().then(({ data }) => setPreferred(data?.preferred_plan ?? null)); }, [status.user_id]);
  const pending = !paid && (preferred === 'plan1' || preferred === 'plan2') && !(status.comp && (status.comp.plan === preferred || status.comp.plan === 'plan2')) ? preferred : null;
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
            {status.comp && !paid ? `${status.comp.label ?? 'Complimentary'}: ${plans?.[status.comp.plan]?.label ?? 'Regular'} free until ${new Date(status.comp.until).toLocaleDateString()}. Thank you for helping us test.`
              : status.in_trial && !paid && status.trial_ends_at ? `Full-access trial until ${new Date(status.trial_ends_at).toLocaleDateString()}, then the free plan unless you upgrade.`
              : paid && until ? (cancelling ? `Cancelled. You keep ${status.limits.label} until ${until}, then move to Free.` : `Auto-renews monthly on ${until}.`)
              : 'Free plan. Upgrade anytime.'}
          </p>
        </div>
      </div>
      {paid && (
        <div className={cx('rounded-xl border p-3 text-sm flex flex-wrap items-center justify-between gap-2', cancelling ? 'border-amber-400/50 bg-amber-500/10' : 'border-emerald-400/40 bg-emerald-500/10')}>
          <span>{cancelling ? `Auto-renewal is off. Access continues until ${until}.` : `Auto-renewal is on. Next payment ${until}.`}</span>
          {cancelling
            ? <Button className="!py-1.5 text-xs" busy={busy} onClick={async () => { if (await run(() => manageSubscription('resume'), 'Subscription resumed: auto-renewal is back on')) refresh(); }}>Resume subscription</Button>
            : <Button variant="ghost" className="!py-1.5 text-xs" onClick={() => setConfirm({ kind: 'cancel' })}>Cancel subscription</Button>}
        </div>
      )}
      <div className="grid grid-cols-3 gap-2 text-sm">
        <Stat k="Daily profile swipes" v={String(status.limits.swipes_per_day)} />
        <Stat k="Drops this week" v={`${status.drops_this_week} / ${status.limits.drops_per_week}`} />
        <Stat k="Radar" v={status.limits.radar_cap == null ? 'Unlimited' : `Up to ${status.limits.radar_cap}`} />
      </div>
      {plans && (
        <div className="grid gap-3">
          {(['free', 'plan1', 'plan2'] as const).map((k) => {
            const p = plans[k];
            if (!p) return null;
            const current = k === 'free' ? status.plan === 'free' : paid ? sub?.plan === k : status.comp?.plan === k;
            if (k === 'free') {
              return (
                <div key={k} className={cx('rounded-xl border p-4', current ? 'border-gold' : 'border-slate-200 dark:border-white/10')}>
                  <div className="flex items-baseline justify-between"><div className="font-display text-lg">{p.label}</div><div className="text-xl font-semibold">0 AED</div></div>
                  <ul className="text-xs text-slate-500 mt-2 space-y-1">
                    <li>{p.swipes_per_day} daily profile swipes</li>
                    <li>{p.drops_per_week} curated 75%+ drops a week</li>
                    <li>Radar: up to {p.radar_cap}</li>
                  </ul>
                  <div className="text-xs mt-3 text-slate-500">{current ? 'Your current plan' : cancelling ? `You move to Free on ${until}` : paid ? 'Cancel your subscription to move to Free at the end of the paid month' : (status.in_trial || status.comp) ? 'You move to this afterwards unless you upgrade' : 'Always available, no payment'}</div>
                </div>
              );
            }
            return (
              <div key={k} className={cx('rounded-xl border p-4', k === 'plan2' ? 'border-gold/50' : 'border-slate-200 dark:border-white/10')}>
                <div className="flex items-baseline justify-between"><div className="font-display text-lg">{p.label}</div><div className="text-xl font-semibold">{p.price_aed} AED<span className="text-xs font-normal text-slate-500"> / month</span></div></div>
                <ul className="text-xs text-slate-500 mt-2 space-y-1">
                  <li>{p.swipes_per_day} daily profile swipes</li>
                  <li>{p.drops_per_week} curated 75%+ drops a week</li>
                  <li>Radar: {p.radar_cap == null ? 'everyone compatible in range' : `up to ${p.radar_cap}`}</li>
                  {p.consultations_per_month > 0 && <li>Weekly 1-on-1 consultation with our matchmaker</li>}
                </ul>
                {paid
                  ? <Button className="w-full mt-3" variant={current ? 'outline' : 'gold'} disabled={current} onClick={() => setConfirm({ kind: 'switch', plan: k })}>{current ? 'Current plan' : `Switch to ${p.label}`}</Button>
                  : <Button className="w-full mt-3" variant={current ? 'outline' : 'gold'} disabled={current && !status.comp} onClick={() => buy(k)}>{current && !status.comp ? 'Current plan' : current ? `Subscribe to keep ${p.label}` : `Choose ${p.label}`}</Button>}
              </div>
            );
          })}
        </div>
      )}
      <div className="flex flex-wrap gap-2 pt-1">
        {paid && <Button variant="outline" onClick={() => startCheckout('portal').catch((e) => toast(e.message, 'err'))}><Crown className="w-4 h-4" />Billing & invoices</Button>}
        {!status.safe_zones_enabled && <Button variant="outline" onClick={() => buy('safe_zones')}><Shield className="w-4 h-4" />Unlock Safe Zones</Button>}
      </div>
      <p className="text-[11px] text-slate-500">Plans renew automatically each month until cancelled. Payments are in test mode until Rendez-vous's trade license is active.</p>

      <Modal open={confirm?.kind === 'switch'} onClose={() => setConfirm(null)} title={confirm?.kind === 'switch' && plans ? `Switch to ${plans[confirm.plan].label}?` : ''}>
        {confirm?.kind === 'switch' && plans && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              Your plan changes straight away to {plans[confirm.plan].label} ({plans[confirm.plan].price_aed} AED/month). The difference for the rest of this month is
              {plans[confirm.plan].price_aed > (plans[sub!.plan]?.price_aed ?? 0) ? ' added to your next invoice' : ' credited to your next invoice'}, and it keeps renewing monthly.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirm(null)}>Keep my plan</Button>
              <Button busy={busy} onClick={async () => { const k = confirm.plan; if (await run(() => manageSubscription('change', k), `You're now on ${plans[k].label}`)) { setConfirm(null); refresh(); } }}>Switch plan</Button>
            </div>
          </div>
        )}
      </Modal>
      <Modal open={confirm?.kind === 'cancel'} onClose={() => setConfirm(null)} title="Cancel your subscription?">
        <div className="space-y-4">
          <p className="text-sm text-slate-500">Auto-renewal stops, but you keep {status.limits.label} and everything in it until <b>{until}</b>. After that you move to the Free plan. You can resume any time before then.</p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirm(null)}>Keep subscription</Button>
            <Button variant="danger" busy={busy} onClick={async () => { if (await run(() => manageSubscription('cancel'), `Cancelled. You keep your plan until ${until}`)) { setConfirm(null); refresh(); } }}>Cancel at end of period</Button>
          </div>
        </div>
      </Modal>
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

export function SafeZones({ status, bare }: { status: Status; bare?: boolean }) {
  const [zones, setZones] = useState<{ id: string; label: string; radius_m: number }[]>([]);
  const [label, setLabel] = useState('');
  const { busy, run } = useAction();
  const toast = useToast();
  const load = () => listSafeZones().then(setZones as any).catch(() => {});
  useEffect(() => { if (status.safe_zones_enabled) load(); }, [status.safe_zones_enabled]);

  const body = (
    <>
      {!bare && <h3 className="font-display text-lg flex items-center gap-2"><Shield className="w-5 h-5 text-gold" />Safe Zones</h3>}
      <p className={bare ? 'text-[11px] text-slate-500' : 'text-sm text-slate-500'}>Save places like home or the office. Whenever your location shows you're inside one, you're switched to Ghost automatically, even if you forgot to turn it on. You become visible again once you leave.</p>
      {!status.safe_zones_enabled ? (
        <div className={cx("rounded-xl border border-dashed border-gold/40 text-center space-y-2", bare ? "p-3" : "p-4")}>
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
    </>
  );
  return bare ? <div className="space-y-3">{body}</div> : <Card className="space-y-3">{body}</Card>;
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

const NOTIFY_ROWS: [keyof NotifyPrefs, string, string][] = [
  ['messages', 'New messages', 'Texts, voice notes and photos from your matches'],
  ['matches', 'New matches', 'When someone you liked likes you back'],
  ['invitations', 'Pings & invitations', 'Date invitations, answers and new times'],
  ['drops', 'Curated drops', 'When your weekly 75%+ matches arrive'],
  ['radar', 'Radar connections', 'When someone nearby connects with you'],
];

function NotificationSettings({ uid, initial }: { uid: string; initial?: NotifyPrefs | null }) {
  const toast = useToast();
  const [prefs, setPrefs] = useState<NotifyPrefs>(initial ?? { messages: true, matches: true, drops: true, invitations: true, radar: true });
  const toggle = async (k: keyof NotifyPrefs, v: boolean) => {
    const next = { ...prefs, [k]: v };
    setPrefs(next);
    try { await saveNotifyPrefs(uid, next); } catch (e) { setPrefs(prefs); toast(e instanceof Error ? e.message : 'Could not save', 'err'); }
  };
  return (
    <Card className="space-y-3">
      <h3 className="font-display text-lg flex items-center gap-2"><Bell className="w-5 h-5 text-gold" />Notifications</h3>
      {NOTIFY_ROWS.map(([k, label, hint]) => (
        <div key={k} className="flex items-center justify-between gap-3">
          <div><div className="text-sm">{label}</div><div className="text-[11px] text-slate-500">{hint}</div></div>
          <Toggle checked={!!prefs[k]} onChange={(v) => toggle(k, v)} label="" />
        </div>
      ))}
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
