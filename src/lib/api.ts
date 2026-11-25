import { supabase } from './supabase';

// ---------- Types returned by the database functions ----------
export type Gender = 'man' | 'woman';
export type Privacy = 'exact' | 'blur' | 'ghost';
export type Plan = 'free' | 'plan1' | 'plan2';
export type Verification = 'incomplete' | 'pending' | 'approved' | 'rejected' | 'changes_requested';

export interface Prompt { key: string; question: string; answer: string }

export interface MemberCard {
  id: string;
  name: string;
  age: number | null;
  gender: Gender | null;
  nationality: string | null;
  city: string | null;
  district: string | null;
  occupation: string | null;
  company: string | null;
  industry: string | null;
  university: string | null;
  degree: string | null;
  height_cm: number | null;
  political: string | null;
  religion: string | null;
  religion_practice: string | null;
  marriage_timeline: string | null;
  kids: string | null;
  drinking: string | null;
  smoking: string | null;
  relocation: string | null;
  zodiac: {
    sun: string | null; moon: string | null; rising: string | null; element: string | null;
    placements?: { point: string; sign: string | null; degree: number | null; house: number | null; retrograde: boolean }[] | null;
    chart_path?: string | null;
  };
  headline: string | null;
  bio: string | null;
  prompts: Prompt[];
  interests: string[];
  photos: string[];
  voice_intro_path: string | null;
  linkedin_url: string | null;
  verified: boolean;
  // discovery extras
  score?: number;
  band?: string;
  answered?: boolean;
  liked?: boolean | null;
  status?: 'pending' | 'liked' | 'passed';
  privacy?: Privacy;
  distance_km?: number;
  lat?: number;
  lng?: number;
  last_active_min?: number;
}

export interface Batch {
  batch_id: string; source: string; refresh_at: string | null; cap: number; size: number; used: number;
  swipe_credits: number; items: MemberCard[];
}
export interface Drops { week_start: string; cap: number; next_drop_at: string; items: MemberCard[] }
export interface RadarResult { radius_km: number; cap: number | null; items: MemberCard[] }

export interface PlanLimits {
  plan: Plan; label: string; price_aed: number; swipes_per_day: number; drops_per_week: number;
  radar_cap: number | null; consultations_per_month: number;
}

export interface Status {
  user_id: string;
  verification_status: Verification;
  is_suspended: boolean;
  rejection_reason: string | null;
  review_note: string | null;
  plan: Plan;
  limits: PlanLimits;
  trial_ends_at: string | null;
  in_trial: boolean;
  comp: { plan: Plan; until: string; label: string | null } | null;
  subscription: { plan: Plan; status: string; current_period_end: string | null; cancel_at_period_end: boolean } | null;
  swipe_credits: number;
  safe_zones_enabled: boolean;
  referral_code: string | null;
  privacy: Privacy;
  in_safe_zone: boolean;
  consents: { location: string | null; biometric: string | null; terms: string | null };
  drops_this_week: number;
  consultations_this_month: number;
  next_consultation: { id: string; slot_at: string; status: string } | null;
  support: { email: string; verify_inbox: string };
}

export interface MatchSummary {
  match_id: string;
  source: 'swipe' | 'drop' | 'radar';
  created_at: string;
  partner: MemberCard;
  unread: number;
  last_message: { kind: string; body: string | null; at: string; mine: boolean } | null;
  invitations_used: number;
  invitation_cap: number;
}

export interface Message {
  id: string; match_id: string; sender_id: string | null;
  kind: 'text' | 'voice' | 'ping' | 'invitation' | 'system' | 'image';
  body: string | null; voice_path: string | null; voice_seconds: number | null; image_path?: string | null;
  invitation_id: string | null; is_hidden: boolean; created_at: string; read_at: string | null;
}

export interface Invitation {
  id: string; match_id: string; from_id: string; to_id: string; proposed_at: string;
  venue_name: string; venue_lat: number | null; venue_lng: number | null; venue_id?: string | null;
  status: 'pending' | 'accepted' | 'declined' | 'countered' | 'cancelled';
  counter_of: string | null; created_at: string;
}

export interface CalendarEvent {
  id: string; invitation_id: string; starts_at: string; title: string; venue_name: string | null; map_url: string | null;
}

// ---------- Helpers ----------
function friendly(error: { message: string } | null): never | void {
  if (!error) return;
  const msg = error.message.replace(/^.*?ERROR:\s*/, '');
  throw new Error(msg);
}

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args ?? {});
  friendly(error);
  return data as T;
}

// ---------- Sign-up ----------
export const signupOptions = () =>
  rpc<{ manual: boolean; invite: boolean; referral: boolean }>('signup_options');
export const checkInviteCode = (code: string) => rpc<boolean>('check_invite_code', { p_code: code });

// ---------- Account ----------
export const myStatus = () => rpc<Status>('my_status');
export const giveConsent = (kind: 'location' | 'biometric' | 'terms') => rpc<void>('give_consent', { p_kind: kind });

export async function myProfile() {
  const uid = (await supabase.auth.getUser()).data.user?.id;
  if (!uid) throw new Error('Not signed in');
  const [p, x] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', uid).single(),
    supabase.from('profile_private').select('*').eq('user_id', uid).single(),
  ]);
  friendly(p.error); friendly(x.error);
  return { profile: p.data as Record<string, any>, priv: x.data as Record<string, any> };
}

export type NearbyAlert = { enabled: boolean; radius_m: number; min_score: number };
export async function getNearbyAlert(uid: string): Promise<NearbyAlert> {
  const { data } = await supabase.from('profile_private').select('nearby_alert').eq('user_id', uid).single();
  return (data?.nearby_alert as NearbyAlert) ?? { enabled: false, radius_m: 500, min_score: 75 };
}
export async function saveNearbyAlert(uid: string, pref: NearbyAlert) {
  friendly((await supabase.from('profile_private').update({ nearby_alert: pref }).eq('user_id', uid)).error);
}

export type NotifyPrefs = { messages: boolean; matches: boolean; drops: boolean; invitations: boolean; radar: boolean };
export async function saveNotifyPrefs(uid: string, prefs: NotifyPrefs) {
  friendly((await supabase.from('profile_private').update({ notify_prefs: prefs }).eq('user_id', uid)).error);
}

export async function saveProfile(profile: Record<string, unknown>, priv: Record<string, unknown>) {
  const uid = (await supabase.auth.getUser()).data.user?.id;
  if (!uid) throw new Error('Not signed in');
  if (Object.keys(profile).length) friendly((await supabase.from('profiles').update(profile).eq('id', uid)).error);
  if (Object.keys(priv).length) friendly((await supabase.from('profile_private').update(priv).eq('user_id', uid)).error);
}

export async function submitForReview(): Promise<{ ok: boolean; missing?: string[]; status?: string }> {
  const { data, error } = await supabase.functions.invoke('submit-verification', { body: {} });
  if (error) {
    const ctx = (error as any).context;
    if (ctx?.json) { try { const j = await ctx.json(); throw new Error(j.error ?? error.message); } catch (e) { throw e; } }
    throw new Error(error.message);
  }
  return data;
}

export async function deleteAccount() {
  const { error } = await supabase.functions.invoke('delete-account', { body: { confirm: true } });
  if (error) throw new Error(error.message);
  await supabase.auth.signOut();
}

// ---------- Discovery ----------
export const getDailyBatch = () => rpc<Batch>('get_daily_batch');
export const redeemSwipeCredit = () => rpc<Batch>('use_swipe_credit');
export const getCuratedDrops = () => rpc<Drops>('get_curated_drops');
export const swipe = (target: string, liked: boolean, source: 'swipe' | 'drop') =>
  rpc<{ matched: boolean; match_id: string | null }>('swipe', { p_target: target, p_liked: liked, p_source: source });

// ---------- Radar ----------
export const updateMyLocation = (lat: number, lng: number) =>
  rpc<{ in_safe_zone: boolean }>('update_my_location', { p_lat: lat, p_lng: lng });
export const setPrivacy = (mode: Privacy) => rpc<void>('set_privacy', { p_mode: mode });
export const radar = (radiusKm: number, minScore: number) =>
  rpc<RadarResult>('radar', { p_radius_km: radiusKm, p_min_score: minScore });
export const radarConnect = (target: string) => rpc<string>('radar_connect', { p_target: target });
export const addSafeZone = (label: string, lat: number, lng: number, radius?: number) =>
  rpc<string>('add_safe_zone', { p_label: label, p_lat: lat, p_lng: lng, p_radius_m: radius ?? null });
export async function listSafeZones() {
  const { data, error } = await supabase.from('safe_zones').select('id,label,radius_m,created_at').order('created_at');
  friendly(error);
  return data ?? [];
}
export async function deleteSafeZone(id: string) {
  friendly((await supabase.from('safe_zones').delete().eq('id', id)).error);
}

// ---------- Chat & scheduling ----------
export const getMyMatches = () => rpc<MatchSummary[]>('get_my_matches');
export const sendMessage = (match: string, body: string) => rpc<string>('send_message', { p_match: match, p_body: body });
export const sendVoice = (match: string, path: string, seconds: number) =>
  rpc<string>('send_message', { p_match: match, p_body: null, p_voice_path: path, p_voice_seconds: seconds });
export async function sendImage(match: string, uid: string, file: File, caption?: string) {
  const ext = ((file.name.includes('.') ? file.name.split('.').pop() : file.type.split('/')[1]) || 'jpg').toLowerCase();
  const path = `${match}/${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from('chat').upload(path, file, { contentType: file.type || undefined, upsert: false });
  friendly(error);
  return rpc<string>('send_message', { p_match: match, p_body: caption ?? null, p_image_path: path });
}
export const markRead = (match: string) => rpc<void>('mark_read', { p_match: match });
export const sendPing = (match: string) => rpc<string>('send_ping', { p_match: match });
export const sendInvitation = (match: string, at: Date, venue: string, lat?: number | null, lng?: number | null, venueId?: string | null) =>
  rpc<string>('send_invitation', { p_match: match, p_at: at.toISOString(), p_venue: venue, p_lat: lat ?? null, p_lng: lng ?? null, p_venue_id: venueId ?? null });

/** Phase 2: RDV partner venues (restaurants with a member perk). Empty until partners are added. */
export interface Venue { id: string; name: string; area: string | null; address: string | null; lat: number | null; lng: number | null; is_partner: boolean; perk: string | null }
export async function listVenues(): Promise<Venue[]> {
  const { data } = await supabase.from('venues').select('id,name,area,address,lat,lng,is_partner,perk').eq('active', true).order('sort_order').order('name');
  return (data ?? []) as Venue[];
}
export const respondInvitation = (id: string, action: 'accept' | 'decline' | 'counter', counterAt?: Date) =>
  rpc<string>('respond_invitation', { p_invitation: id, p_action: action, p_counter_at: counterAt?.toISOString() ?? null });

export async function loadThread(match: string) {
  const [m, i] = await Promise.all([
    supabase.from('messages').select('*').eq('match_id', match).order('created_at').limit(500),
    supabase.from('invitations').select('*').eq('match_id', match).order('created_at'),
  ]);
  friendly(m.error); friendly(i.error);
  return { messages: (m.data ?? []) as Message[], invitations: (i.data ?? []) as Invitation[] };
}

export async function myCalendar() {
  const { data, error } = await supabase.from('calendar_events').select('*').order('starts_at');
  friendly(error);
  return (data ?? []) as CalendarEvent[];
}

// ---------- Safety ----------
export const blockMember = (target: string) => rpc<void>('block_member', { p_target: target });
export async function reportMember(target: string, type: 'profile' | 'photo' | 'message' | 'voice' | 'image', reason: string,
  ref?: string | null, details?: string, block = true) {
  const id = await rpc<string>('report_member', { p_target: target, p_type: type, p_reason: reason, p_ref: ref ?? null,
    p_details: details ?? null, p_block: block });
  supabase.functions.invoke('notify-report', { body: { report_id: id } }).catch(() => {});
  return id;
}

// ---------- Premium ----------
export const requestConsultation = (slot: Date, notes?: string) =>
  rpc<string>('request_consultation', { p_slot: slot.toISOString(), p_notes: notes ?? null });
export const cancelConsultation = (id: string) => rpc<void>('cancel_consultation', { p_id: id });

// ---------- Billing (Stripe sandbox via edge function) ----------
export async function startCheckout(item: 'plan1' | 'plan2' | 'safe_zones' | 'swipe_refresh' | 'portal') {
  const { data, error } = await supabase.functions.invoke('create-checkout', {
    body: { item, return_url: window.location.origin },
  });
  if (error) {
    let msg = 'Payments are not switched on yet. Please try again later.';
    try { const j = await (error as any).context?.json(); if (j?.error) msg = j.error; } catch { /* keep default */ }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  if (data?.url) window.location.href = data.url;
}

export async function manageSubscription(action: 'change' | 'cancel' | 'resume', plan?: 'plan1' | 'plan2') {
  const { data, error } = await supabase.functions.invoke('manage-subscription', { body: { action, plan } });
  if (error) {
    let msg = 'Could not update your subscription. Please try again.';
    try { const j = await (error as any).context?.json(); if (j?.error) msg = j.error; } catch { /* keep default */ }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

/** Builds the natal chart and zodiac synastry scores in the background (no-op if nothing to do). */
let astroInFlight: Promise<unknown> | null = null;
let astroLast = 0;
export function astroSync() {
  // One call at a time, at most once a minute (RapidAPI rate limits)
  if (astroInFlight || Date.now() - astroLast < 60_000) return;
  astroLast = Date.now();
  astroInFlight = supabase.functions.invoke('astro-sync', { body: {} }).catch(() => {}).finally(() => { astroInFlight = null; });
}

// ---------- Storage ----------
const urlCache = new Map<string, { url: string; exp: number }>();

export async function signedUrl(bucket: 'photos' | 'voice' | 'verification' | 'charts' | 'chat', path: string | null | undefined) {
  if (!path) return null;
  const key = `${bucket}/${path}`;
  const hit = urlCache.get(key);
  if (hit && hit.exp > Date.now()) return hit.url;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
  if (error || !data) return null;
  urlCache.set(key, { url: data.signedUrl, exp: Date.now() + 50 * 60 * 1000 });
  return data.signedUrl;
}

export async function uploadFile(bucket: 'photos' | 'voice' | 'verification', file: Blob, ext: string, knownUid?: string) {
  // Pass the member id when known: avoids an auth round-trip that can stall on iOS right after the photo picker closes.
  const uid = knownUid ?? (await supabase.auth.getUser()).data.user?.id;
  if (!uid) throw new Error('Not signed in');
  const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type || undefined, upsert: false,
  });
  friendly(error);
  return path;
}
