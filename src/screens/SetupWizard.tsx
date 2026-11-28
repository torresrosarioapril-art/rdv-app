import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, ImagePlus, Link2, Play, ShieldCheck, Trash2, Upload } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { astroSync, dropsLine, radarLine, giveConsent, myProfile, saveProfile, signedUrl, submitForReview, uploadFile, type Status } from '@/lib/api';
import {
  BRAND, GENDERS, HABITS, KIDS, NATIONALITIES, POLITICAL, PROMPTS, RELIGIONS, RELOCATION, TIMELINE, UAE_CITIES, labelOf, DRINKING_TOLERANCE, SMOKING_TOLERANCE, MARITAL_STATUS, PARTNER_CHILDREN, DESIRED_MARITAL, desiredMaritalChoice, desiredMaritalValue } from '@/config/app';
import { Badge, Button, Card, Field, Input, Photo, Select, Spinner, Textarea, Toggle, cx, useToast } from '@/components/ui';
import { Recorder } from '@/components/Recorder';
import { CityPicker } from '@/components/CityPicker';
import { WorkEmailCard } from '@/components/WorkEmail';
import { SafetyStandardsModal } from '@/components/SafetyStandardsModal';
import { COUNTRIES } from '@/config/app';
import { BrandLogo } from '@/components/BrandLogo';

const STEPS = ['Identity & verification', 'Basic info', 'Marriage & lifestyle', 'Desired partner', 'Your story', 'Plan', 'Review'];

type Form = Record<string, any>;

const PROFILE_KEYS = ['display_name', 'gender', 'nationality', 'country_residence', 'city', 'district', 'occupation', 'company',
  'industry', 'university', 'degree', 'height_cm', 'political', 'religion', 'religion_practice', 'marriage_timeline', 'kids',
  'drinking', 'smoking', 'relocation', 'headline', 'bio', 'prompts', 'photos', 'voice_intro_path', 'linkedin_url',
  'marital_status', 'has_children', 'children_count'];
const PRIVATE_KEYS = ['legal_name', 'birth_date', 'birth_time', 'birth_city', 'birth_country', 'religion_flexible', 'kids_flexible',
  'drinking_tolerance', 'smoking_tolerance', 'desired_age_min', 'desired_age_max', 'desired_nationalities', 'desired_religion',
  'verification_video_path', 'birth_lat', 'birth_lng', 'preferred_plan', 'desired_marital_status', 'partner_children_ok'];

const clean = (v: unknown) => (v === '' || v === undefined ? null : v);

function ageFrom(d?: string) {
  if (!d) return null;
  const b = new Date(d); const n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
  return a;
}

export default function SetupWizard({ status, onDone, onCancel, initialStep }: { status: Status; onDone: () => void; onCancel?: () => void; initialStep?: number }) {
  const toast = useToast();
  const [step, setStep] = useState(initialStep ?? 0);
  const [f, setF] = useState<Form | null>(null);
  const [saved, setSaved] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [plans, setPlans] = useState<Record<string, any> | null>(null);
  const approved = status.verification_status === 'approved';
  // Anyone past the first application can jump straight to any section.
  const freeNav = status.verification_status !== 'incomplete';
  const sections = approved ? STEPS.slice(0, 5) : STEPS;

  useEffect(() => {
    myProfile().then(({ profile, priv }) => {
      const merged: Form = { ...profile, ...priv };
      if (!Array.isArray(merged.prompts) || merged.prompts.length === 0) {
        merged.prompts = PROMPTS.map((p) => ({ key: p.key, question: p.question, answer: '' }));
      }
      merged.terms = !!priv.accepted_terms_at;
      merged.biometric = !!priv.consent_biometric_at;
      setF(merged); setSaved(merged);
    }).catch((e) => toast(e.message, 'err'));
    supabase.from('app_config').select('value').eq('key', 'plans').single().then(({ data }) => setPlans(data?.value ?? null));
  }, [toast]);

  const set = (k: string, v: unknown) => setF((s) => ({ ...(s as Form), [k]: v }));

  const missing = useMemo(() => {
    if (!f) return [] as string[];
    const req: Record<number, [string, string][]> = {
      0: [['legal_name', 'Full legal name'], ['verification_video_path', 'Video ID'], ['terms', 'Terms'], ['biometric', 'ID video consent']],
      1: [['display_name', 'First name'], ['birth_date', 'Birth date'], ['gender', 'Gender'], ['nationality', 'Nationality'], ['city', 'City'], ['occupation', 'Occupation'], ['marital_status', 'Marital status']],
      2: [['religion', 'Religion'], ['marriage_timeline', 'Marriage timeline'], ['kids', 'Kids'], ['drinking', 'Drinking'], ['smoking', 'Smoking'], ['relocation', 'Relocation']],
      3: [],
      4: [],
    };
    const out = (req[step] ?? []).filter(([k]) => !f[k]).map(([, l]) => l);
    if (step === 1 && f.birth_date && (ageFrom(f.birth_date) ?? 0) < 18) out.push('You must be 18 or older');
    if (step === 3 && Number(f.desired_age_min) > Number(f.desired_age_max)) out.push('Age range');
    if (step === 4 && (!f.photos || f.photos.length === 0)) out.push('At least one photo');
    return out;
  }, [f, step]);

  const persist = async () => {
    if (!f || !saved) return;
    const p: Form = {}; const x: Form = {};
    for (const k of PROFILE_KEYS) if (JSON.stringify(f[k]) !== JSON.stringify(saved[k])) p[k] = clean(f[k]);
    for (const k of PRIVATE_KEYS) if (JSON.stringify(f[k]) !== JSON.stringify(saved[k])) x[k] = clean(f[k]);
    if (p.height_cm != null) p.height_cm = Number(p.height_cm);
    if (x.desired_age_min != null) x.desired_age_min = Number(x.desired_age_min);
    if (x.desired_age_max != null) x.desired_age_max = Number(x.desired_age_max);
    await saveProfile(p, x);
    if (f.terms && !saved.terms) await giveConsent('terms');
    if (f.biometric && !saved.biometric) await giveConsent('biometric');
    setSaved({ ...f });
  };

  const next = async () => {
    if (missing.length) { toast('Please complete: ' + missing.join(', '), 'err'); return; }
    setBusy(true);
    try { await persist(); setStep((s) => Math.min(s + 1, STEPS.length - 1)); window.scrollTo(0, 0); }
    catch (e) { toast(e instanceof Error ? e.message : 'Could not save', 'err'); }
    finally { setBusy(false); }
  };

  const saveOnly = async () => {
    if (missing.length) { toast('Please complete: ' + missing.join(', '), 'err'); return; }
    setBusy(true);
    try { await persist(); astroSync(); toast('Saved'); onDone(); }
    catch (e) { toast(e instanceof Error ? e.message : 'Could not save', 'err'); }
    finally { setBusy(false); }
  };

  const submit = async () => {
    setBusy(true);
    try {
      await persist();
      astroSync();
      if (approved) { toast('Profile updated'); onDone(); return; }
      const r = await submitForReview();
      if (r.ok || r.status === 'pending') { toast(status.verification_status === 'changes_requested' ? 'Thanks! Your updated application was sent for review' : 'Application sent for review'); onDone(); }
      else if (r.missing?.length) toast('Still missing: ' + r.missing.join(', ').replaceAll('_', ' '), 'err');
      else onDone();
    } catch (e) { toast(e instanceof Error ? e.message : 'Could not submit', 'err'); }
    finally { setBusy(false); }
  };

  if (!f) return <Spinner label="Loading your application…" />;

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-30 bg-ivory/90 dark:bg-navy/90 backdrop-blur border-b border-slate-200 dark:border-white/10">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <BrandLogo className="w-7 h-7" />
              <span className="text-xs uppercase tracking-widest text-gold">{approved ? 'Edit profile' : `Step ${step + 1} of ${STEPS.length}`}</span>
            </div>
            <div className="flex gap-2">
              {onCancel && <Button variant="ghost" className="!py-1.5 text-xs" onClick={onCancel}>Close</Button>}
              <Button variant="ghost" className="!py-1.5 text-xs" onClick={() => supabase.auth.signOut()}>Sign out</Button>
            </div>
          </div>
          {freeNav ? (
            <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1">
              {sections.map((s, i) => (
                <button key={s} onClick={() => { setStep(i); window.scrollTo(0, 0); }}
                  className={cx('shrink-0 rounded-full px-3 py-1.5 text-xs border cursor-pointer whitespace-nowrap',
                    i === step ? 'bg-gold text-navy border-gold font-semibold' : 'border-slate-300 dark:border-white/15 text-slate-600 dark:text-slate-300 hover:border-gold/60')}>
                  {s}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex gap-1">
              {STEPS.map((s, i) => (
                <button key={s} title={s} onClick={() => i < step && setStep(i)} className={cx('h-1.5 flex-1 rounded-full', i <= step ? 'bg-gold' : 'bg-slate-300 dark:bg-white/10', i < step && 'cursor-pointer')} />
              ))}
            </div>
          )}
          <h1 className="text-xl font-display mt-3">{STEPS[step]}</h1>
          {status.verification_status === 'changes_requested' && (
            <div className="mt-2 rounded-xl border border-gold/50 bg-gold/10 p-3 text-sm">
              <div className="text-[10px] uppercase tracking-widest text-gold mb-0.5">Our team asked you to update your application</div>
              <p className="whitespace-pre-line">{status.review_note}</p>
              <p className="text-xs text-slate-500 mt-1">Make the change, then go to the last step and submit again.</p>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        {step === 0 && <StepIdentity f={f} set={set} approved={approved} />}
        {step === 1 && <StepBasics f={f} set={set} approved={approved} />}
        {step === 2 && <StepLifestyle f={f} set={set} />}
        {step === 3 && <StepPartner f={f} set={set} />}
        {step === 4 && <StepStory f={f} set={set} />}
        {step === 5 && <StepPlan plans={plans} status={status} f={f} set={set} />}
        {step === 6 && <StepReview f={f} goTo={setStep} />}

        {approved ? (
          <div className="flex items-center justify-end gap-2 pt-2">
            {onCancel && <Button variant="ghost" onClick={onCancel}>Cancel</Button>}
            <Button onClick={saveOnly} busy={busy}><Check className="w-4 h-4" />Save changes</Button>
          </div>
        ) : (
        <div className="flex items-center justify-between pt-2">
          <Button variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}><ChevronLeft className="w-4 h-4" />Back</Button>
          {step < STEPS.length - 1
            ? <Button onClick={next} busy={busy}>Save & continue<ChevronRight className="w-4 h-4" /></Button>
            : <Button onClick={submit} busy={busy}><ShieldCheck className="w-4 h-4" />{approved ? 'Save profile' : 'Submit for verification'}</Button>}
        </div>
        )}
      </div>
    </div>
  );
}

type StepProps = { f: Form; set: (k: string, v: unknown) => void };

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>;
}

function StepIdentity({ f, set, approved }: StepProps & { approved: boolean }) {
  const toast = useToast();
  const [charterOpen, setCharterOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  useEffect(() => { signedUrl('verification', f.verification_video_path).then(setVideoUrl); }, [f.verification_video_path]);

  const save = async (blob: Blob, ext: string) => {
    setUploading(true);
    try { set('verification_video_path', await uploadFile('verification', blob, ext)); toast('Video saved'); }
    catch (e) { toast(e instanceof Error ? e.message : 'Upload failed', 'err'); }
    finally { setUploading(false); }
  };

  const removeVideo = async () => {
    const path = f.verification_video_path;
    set('verification_video_path', null);
    setVideoUrl(null);
    if (path) await supabase.storage.from('verification').remove([path]).catch(() => {});
    toast('Video deleted. Record or upload a new one.');
  };

  return (
    <>
      <Card>
        <Field label="Full legal name" hint="As on your Emirates ID or passport. Never shown to other members.">
          <Input value={f.legal_name ?? ''} onChange={(e) => set('legal_name', e.target.value)} disabled={approved} />
        </Field>
      </Card>
      <Card className="space-y-3">
        <div>
          <h3 className="font-display text-lg">Video ID check</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Record a short video (about 20 seconds): hold your Emirates ID or passport next to your face, then bring it close to the camera for 2–3 seconds so your <b>date of birth</b> can be read
            (on older Emirates IDs the date of birth is on the back, so show both sides). Then say your first name and today's date, and turn your head slowly left and right.
            A founder reviews it by hand and checks your date of birth matches what you entered. It's never shown to other members.
          </p>
        </div>
        {f.verification_video_path ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Badge tone="green"><Check className="w-3 h-3" />Video received</Badge>
              {!approved && (
                <button type="button" onClick={removeVideo} aria-label="Delete this video"
                  className="flex items-center gap-1 rounded-full border border-rose-300 dark:border-rose-400/40 text-rose-600 dark:text-rose-300 px-2.5 py-1 text-xs cursor-pointer hover:bg-rose-500/10">
                  <Trash2 className="w-3.5 h-3.5" />Delete
                </button>
              )}
            </div>
            {videoUrl && <video src={videoUrl} controls playsInline className="w-full max-h-64 rounded-xl bg-black" />}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2 items-start">
          <Recorder kind="video" maxSeconds={30} label={f.verification_video_path ? 'Record again' : 'Record video'} onDone={(b, _s, ext) => save(b, ext)} />
          <label className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm border border-slate-300 dark:border-white/15 cursor-pointer hover:border-gold">
            <Upload className="w-4 h-4" />{uploading ? 'Uploading…' : 'Upload a video'}
            <input type="file" accept="video/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) save(file, file.name.split('.').pop() || 'mp4'); }} />
          </label>
        </div>
      </Card>
      <WorkEmailCard />
      <Card>
        <Field label="LinkedIn profile" optional hint="Shown on your profile as a trust signal.">
          <div className="relative"><Link2 className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
            <Input className="pl-9" placeholder="https://linkedin.com/in/…" value={f.linkedin_url ?? ''} onChange={(e) => set('linkedin_url', e.target.value)} /></div>
        </Field>
      </Card>
      <Card className="space-y-3 text-sm">
        <label className="flex items-start gap-2">
          <input type="checkbox" className="mt-1 accent-[#c9a24a]" checked={!!f.biometric} disabled={approved} onChange={(e) => set('biometric', e.target.checked)} />
          <span>I consent to Rendez-vous processing my ID video to verify my identity and age (UAE PDPL). It's stored privately and only seen by the review team.</span>
        </label>
        <SafetyStandardsModal isOpen={charterOpen} onClose={() => setCharterOpen(false)} onAccept={approved ? undefined : () => set('terms', true)} />
        <label className="flex items-start gap-2">
          <input type="checkbox" className="mt-1 accent-[#c9a24a]" checked={!!f.terms} disabled={approved} onChange={(e) => set('terms', e.target.checked)} />
          <span>I accept the Terms and the <button type="button" onClick={() => setCharterOpen(true)} className="text-gold underline cursor-pointer">Community Charter</button>, including zero tolerance for abusive content or behaviour. Rendez-vous is rated 17+ and open to adults 18 and over only.</span>
        </label>
      </Card>
    </>
  );
}

function StepBasics({ f, set, approved }: StepProps & { approved: boolean }) {
  const age = ageFrom(f.birth_date);
  return (
    <Card>
      <Grid>
        <Field label="First name (shown on your profile)"><Input value={f.display_name ?? ''} onChange={(e) => set('display_name', e.target.value)} /></Field>
        <Field label="Birth date" hint={age != null ? `Age ${age}${f.zodiac_sun ? ` · ${f.zodiac_sun}` : ''}. Locked after verification (it was checked against your ID). Time and place of birth can be added anytime under Marriage & lifestyle.` : 'Used for your age and zodiac.'}>
          <Input type="date" value={f.birth_date ?? ''} max={new Date().toISOString().slice(0, 10)} onChange={(e) => set('birth_date', e.target.value)} disabled={approved} />
        </Field>
        <Field label="Gender"><Select options={GENDERS} value={f.gender ?? ''} onChange={(e) => set('gender', e.target.value)} /></Field>
        <Field label="Nationality"><Select options={NATIONALITIES} value={f.nationality ?? ''} onChange={(e) => set('nationality', e.target.value)} /></Field>
        <Field label="Country of residence"><Input value={f.country_residence ?? 'United Arab Emirates'} onChange={(e) => set('country_residence', e.target.value)} /></Field>
        <Field label="City / emirate"><Select options={UAE_CITIES} value={f.city ?? ''} onChange={(e) => set('city', e.target.value)} /></Field>
        <Field label="District" optional><Input placeholder="e.g. DIFC, Dubai Marina" value={f.district ?? ''} onChange={(e) => set('district', e.target.value)} /></Field>
        <Field label="Occupation"><Input value={f.occupation ?? ''} onChange={(e) => set('occupation', e.target.value)} /></Field>
        <Field label="Company" optional><Input value={f.company ?? ''} onChange={(e) => set('company', e.target.value)} /></Field>
        <Field label="Industry" optional><Input value={f.industry ?? ''} onChange={(e) => set('industry', e.target.value)} /></Field>
        <Field label="University" optional><Input value={f.university ?? ''} onChange={(e) => set('university', e.target.value)} /></Field>
        <Field label="Degree" optional><Input value={f.degree ?? ''} onChange={(e) => set('degree', e.target.value)} /></Field>
        <Field label="Height (cm)" optional><Input type="number" min={120} max={230} value={f.height_cm ?? ''} onChange={(e) => set('height_cm', e.target.value)} /></Field>
        <Field label="Marital status"><Select options={MARITAL_STATUS} value={f.marital_status ?? ''} onChange={(e) => set('marital_status', e.target.value || null)} /></Field>
        <Field label="Do you have children already?" optional>
          <div className="flex gap-2">
            <Select options={[{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }]} placeholder="Choose"
              value={f.has_children == null ? '' : f.has_children ? 'yes' : 'no'}
              onChange={(e) => { const v = e.target.value; set('has_children', v === '' ? null : v === 'yes'); if (v !== 'yes') set('children_count', null); }} />
            {f.has_children === true && (
              <Input type="number" min={1} max={20} placeholder="How many?" className="!w-28" value={f.children_count ?? ''}
                onChange={(e) => set('children_count', e.target.value === '' ? null : Number(e.target.value))} />
            )}
          </div>
        </Field>
      </Grid>
    </Card>
  );
}

function StepLifestyle({ f, set }: StepProps) {
  return (
    <>
      <Card className="space-y-4">
        <Grid>
          <Field label="Religion / faith"><Select options={RELIGIONS} value={f.religion ?? ''} onChange={(e) => set('religion', e.target.value)} /></Field>
          <Field label="Observance" optional><Input placeholder="e.g. Practising, cultural" value={f.religion_practice ?? ''} onChange={(e) => set('religion_practice', e.target.value)} /></Field>
        </Grid>
        <Toggle checked={!!f.religion_flexible} onChange={(v) => set('religion_flexible', v)} label="I'm flexible on faith (open to a different faith if they are too)" />
      </Card>
      <Card className="space-y-4">
        <Grid>
          <Field label="Marriage timeline"><Select options={TIMELINE} value={f.marriage_timeline ?? ''} onChange={(e) => set('marriage_timeline', e.target.value)} /></Field>
          <Field label="Children in the future" hint="Whether you want (more) children. Children you already have go in Basic info."><Select options={KIDS} value={f.kids ?? ''} onChange={(e) => set('kids', e.target.value)} /></Field>
        </Grid>
        <Toggle checked={!!f.kids_flexible} onChange={(v) => set('kids_flexible', v)} label="I'm flexible on children" />
      </Card>
      <Card className="space-y-4">
        <Grid>
          <Field label="Drinking"><Select options={HABITS} value={f.drinking ?? ''} onChange={(e) => set('drinking', e.target.value)} /></Field>
          <Field label="Smoking"><Select options={HABITS} value={f.smoking ?? ''} onChange={(e) => set('smoking', e.target.value)} /></Field>
        </Grid>
        <Grid>
          <Field label="A partner who drinks" hint="Filters who you see (and who sees you)">
            <Select options={DRINKING_TOLERANCE} placeholder="Choose" value={f.drinking_tolerance ?? 'any'} onChange={(e) => set('drinking_tolerance', e.target.value || 'any')} /></Field>
          <Field label="A partner who smokes" hint="Occasionally is OK still favours non-smokers in your match %">
            <Select options={SMOKING_TOLERANCE} placeholder="Choose" value={f.smoking_tolerance ?? 'any'} onChange={(e) => set('smoking_tolerance', e.target.value || 'any')} /></Field>
        </Grid>
      </Card>
      <Card>
        <Grid>
          <Field label="Relocation plans"><Select options={RELOCATION} value={f.relocation ?? ''} onChange={(e) => set('relocation', e.target.value)} /></Field>
          <Field label="Social / political outlook" optional><Select options={POLITICAL} value={f.political ?? ''} onChange={(e) => set('political', e.target.value)} /></Field>
        </Grid>
      </Card>
      <Card className="space-y-3">
        <p className="text-sm text-slate-500 dark:text-slate-400">Adding your time and place of birth gives the most accurate match compatibility reading (full natal chart). Without them we use your sun sign.</p>
        <Grid>
          <Field label="Time of birth" optional><Input type="time" value={f.birth_time?.slice(0, 5) ?? ''} onChange={(e) => set('birth_time', e.target.value)} /></Field>
        </Grid>
        <CityPicker
          value={f.birth_city && f.birth_lat != null ? {
            city: f.birth_city, country: f.birth_country ?? '', lat: f.birth_lat, lng: f.birth_lng,
            countryCode: COUNTRIES.find(([, n]) => n === f.birth_country)?.[0] ?? '',
          } : null}
          onChange={(pl) => { set('birth_city', pl?.city ?? null); set('birth_country', pl?.country ?? null); set('birth_lat', pl?.lat ?? null); set('birth_lng', pl?.lng ?? null); }}
        />
      </Card>
    </>
  );
}

function StepPartner({ f, set }: StepProps) {
  const chosen: string[] = f.desired_nationalities ?? [];
  const [pick, setPick] = useState('');
  return (
    <Card className="space-y-5">
      <Grid>
        <Field label="Youngest age"><Input type="number" min={18} max={80} value={f.desired_age_min ?? 25} onChange={(e) => set('desired_age_min', e.target.value)} /></Field>
        <Field label="Oldest age"><Input type="number" min={18} max={90} value={f.desired_age_max ?? 45} onChange={(e) => set('desired_age_max', e.target.value)} /></Field>
      </Grid>
      <Field label="Nationalities" hint="Leave empty for any nationality.">
        <div className="flex gap-2">
          <Select options={NATIONALITIES.filter((n) => !chosen.includes(n))} value={pick} onChange={(e) => setPick(e.target.value)} placeholder="Any nationality" />
          <Button type="button" variant="outline" onClick={() => { if (pick) { set('desired_nationalities', [...chosen, pick]); setPick(''); } }}>Add</Button>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {chosen.map((n) => (
            <button key={n} type="button" onClick={() => set('desired_nationalities', chosen.filter((c) => c !== n))} className="cursor-pointer"><Badge>{n} ×</Badge></button>
          ))}
        </div>
      </Field>
      <Field label="Religion" hint="If you pick a specific religion, only members of that religion will be shown to you.">
        <Select options={RELIGIONS} placeholder="Any religion" value={f.desired_religion ?? ''} onChange={(e) => set('desired_religion', e.target.value)} />
      </Field>
      <Field label="Marital status">
        <Select options={DESIRED_MARITAL} value={desiredMaritalChoice(f.desired_marital_status)}
          onChange={(e) => set('desired_marital_status', desiredMaritalValue(e.target.value || 'any'))} />
      </Field>
      <Field label="Comfortable with a partner who already has children?">
        <Select options={PARTNER_CHILDREN} value={f.partner_children_ok ?? 'any'} onChange={(e) => set('partner_children_ok', e.target.value || 'any')} />
      </Field>
    </Card>
  );
}

function StepStory({ f, set }: StepProps) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [voiceUrl, setVoiceUrl] = useState<string | null>(null);
  useEffect(() => { signedUrl('voice', f.voice_intro_path).then(setVoiceUrl); }, [f.voice_intro_path]);
  const photos: string[] = f.photos ?? [];

  const addPhoto = async (file: File) => {
    if (photos.length >= 6) return toast('Up to 6 photos', 'err');
    setBusy(true);
    try { set('photos', [...photos, await uploadFile('photos', file, (file.name.split('.').pop() || 'jpg').toLowerCase())]); }
    catch (e) { toast(e instanceof Error ? e.message : 'Upload failed', 'err'); }
    finally { setBusy(false); }
  };

  return (
    <>
      <Card className="space-y-3">
        <h3 className="font-display text-lg">Photos</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">Clear, recent photos of you. The first one is your main photo.</p>
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p, i) => (
            <div key={p} className="relative aspect-[3/4] rounded-xl overflow-hidden">
              <Photo path={p} alt={f.display_name || 'Photo'} className="w-full h-full" />
              {i === 0 && <span className="absolute left-1.5 top-1.5"><Badge>Main</Badge></span>}
              <button type="button" onClick={() => set('photos', photos.filter((x) => x !== p))} className="absolute right-1.5 top-1.5 p-1 rounded-lg bg-black/60 text-white cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
          {photos.length < 6 && (
            <label className="aspect-[3/4] rounded-xl border-2 border-dashed border-slate-300 dark:border-white/15 flex flex-col items-center justify-center gap-1 text-xs text-slate-500 cursor-pointer hover:border-gold">
              <ImagePlus className="w-5 h-5" />{busy ? 'Uploading…' : 'Add photo'}
              <input type="file" accept="image/jpeg,image/png,image/webp,image/heic" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) addPhoto(file); e.target.value = ''; }} />
            </label>
          )}
        </div>
      </Card>
      <Card className="space-y-4">
        <Field label="Headline" optional><Input maxLength={90} placeholder="One line about you" value={f.headline ?? ''} onChange={(e) => set('headline', e.target.value)} /></Field>
        <Field label="About me" optional><Textarea maxLength={1200} value={f.bio ?? ''} onChange={(e) => set('bio', e.target.value)} /></Field>
      </Card>
      {(f.prompts as any[]).map((p, i) => (
        <Card key={p.key}>
          <Field label={p.question} optional hint="Shown on your profile, and used as conversation openers.">
            <Textarea maxLength={600} value={p.answer ?? ''} onChange={(e) => {
              const next = [...f.prompts]; next[i] = { ...p, answer: e.target.value }; set('prompts', next);
            }} />
          </Field>
        </Card>
      ))}
      <Card className="space-y-3">
        <h3 className="font-display text-lg">Voice intro</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">Up to 45 seconds in your own voice. Optional, and it makes a real difference.</p>
        {voiceUrl && <audio src={voiceUrl} controls className="w-full" />}
        <div className="flex gap-2 items-start">
          <Recorder kind="audio" maxSeconds={45} label={f.voice_intro_path ? 'Re-record' : 'Record voice intro'} onDone={async (b, _s, ext) => {
            try { set('voice_intro_path', await uploadFile('voice', b, ext)); toast('Voice intro saved'); } catch (e) { toast(e instanceof Error ? e.message : 'Upload failed', 'err'); }
          }} />
          {f.voice_intro_path && <Button type="button" variant="ghost" onClick={() => set('voice_intro_path', null)}><Trash2 className="w-4 h-4" />Remove</Button>}
        </div>
      </Card>
    </>
  );
}

function StepPlan({ plans, status, f, set }: { plans: Record<string, any> | null; status: Status } & StepProps) {
  const order: [string, string][] = [['free', 'After the trial'], ['plan1', 'Plan 1'], ['plan2', 'Plan 2']];
  const chosen = f.preferred_plan ?? 'free';
  return (
    <>
      <Card>
        <p className="text-sm">
          Every member starts with a <b>7-day full-access trial</b> at Regular level{status.trial_ends_at ? `, until ${new Date(status.trial_ends_at).toLocaleDateString()}` : ''}.
          Choose the plan you'd like. Nothing is charged now. Once you're verified, you'll be asked to confirm payment. Free members keep access with lower limits.
        </p>
      </Card>
      <div className="grid sm:grid-cols-3 gap-3">
        {plans && order.map(([k, kicker]) => {
          const p = plans[k];
          if (!p) return null;
          const on = chosen === k;
          return (
            <button type="button" key={k} onClick={() => set('preferred_plan', k)} className="text-left cursor-pointer">
              <Card className={cx('h-full transition', on ? '!border-gold ring-2 ring-gold/40' : 'hover:!border-gold/50')}>
                <div className="flex items-center justify-between">
                  <div className="text-[10px] uppercase tracking-widest text-gold">{kicker}</div>
                  <span className={cx('w-5 h-5 rounded-full border-2 flex items-center justify-center', on ? 'border-gold bg-gold' : 'border-slate-300 dark:border-white/20')}>
                    {on && <Check className="w-3 h-3 text-navy" />}
                  </span>
                </div>
                <div className="font-display text-lg mt-1">{p.label}</div>
                <div className="text-2xl font-semibold mt-1">{p.price_aed ? `${p.price_aed} AED` : 'Free'}<span className="text-xs font-normal text-slate-500">{p.price_aed ? ' / month' : ''}</span></div>
                <ul className="mt-3 space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
                  <li>{dropsLine(p)}</li>
                  <li>{radarLine(p)}</li>
                  {p.consultations_per_month > 0 && <li>Weekly 1-on-1 matchmaking consultation</li>}
                </ul>
              </Card>
            </button>
          );
        })}
      </div>
    </>
  );
}

function StepReview({ f, goTo }: { f: Form; goTo: (n: number) => void }) {
  const rows: [string, string, number][] = [
    ['Name', f.display_name, 1], ['Age', String(ageFrom(f.birth_date) ?? '—'), 1], ['Gender', labelOf(GENDERS, f.gender), 1],
    ['Nationality', f.nationality, 1], ['City', [f.city, f.district].filter(Boolean).join(', '), 1], ['Occupation', f.occupation, 1], ['Marital status', labelOf(MARITAL_STATUS, f.marital_status), 1], ['Children now', f.has_children == null ? '' : f.has_children ? `Yes${f.children_count ? ` (${f.children_count})` : ''}` : 'No', 1],
    ['Religion', `${f.religion ?? '—'}${f.religion_flexible ? ' (flexible)' : ''}`, 2],
    ['Marriage timeline', labelOf(TIMELINE, f.marriage_timeline), 2], ['Children', `${labelOf(KIDS, f.kids)}${f.kids_flexible ? ' (flexible)' : ''}`, 2],
    ['Drinking / smoking', `${labelOf(HABITS, f.drinking)} / ${labelOf(HABITS, f.smoking)}`, 2], ['Relocation', labelOf(RELOCATION, f.relocation), 2],
    ['Looking for', `${f.desired_age_min}–${f.desired_age_max}, ${(f.desired_nationalities ?? []).join(', ') || 'any nationality'}, ${f.desired_religion || 'any religion'}`, 3], ['Partner filters', `${labelOf(DESIRED_MARITAL, desiredMaritalChoice(f.desired_marital_status))}; partner with children: ${labelOf(PARTNER_CHILDREN, f.partner_children_ok ?? 'any')}`, 3],
    ['Photos', String((f.photos ?? []).length), 4], ['Voice intro', f.voice_intro_path ? 'Yes' : 'No', 4],
    ['Video ID', f.verification_video_path ? 'Received' : 'Missing', 0],
    ['Place of birth', [f.birth_city, f.birth_country].filter(Boolean).join(', '), 2],
    ['Chosen plan', f.preferred_plan === 'plan2' ? 'Premium' : f.preferred_plan === 'plan1' ? 'Regular' : 'Free after trial', 5],
  ];
  return (
    <Card>
      <dl className="divide-y divide-slate-200 dark:divide-white/10">
        {rows.map(([k, v, s]) => (
          <div key={k} className="flex items-center justify-between py-2.5 text-sm gap-4">
            <dt className="text-slate-500">{k}</dt>
            <dd className="flex items-center gap-3 text-right">{v || '—'}<button onClick={() => goTo(s)} className="text-xs text-gold cursor-pointer">Edit</button></dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-xs text-slate-500 flex items-center gap-1.5"><Play className="w-3 h-3" />After you submit, a founder reviews your video. You'll appear to other members once approved.</p>
    </Card>
  );
}
