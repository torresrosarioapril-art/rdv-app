/**
 * RDV app settings — the one place to change copy, options and connection details in the screens.
 *
 * Business numbers (prices, swipe caps, radar caps, scoring weights, invitation cap) and the
 * sign-up switches (manual / invite / referral) live in the Supabase table `app_config`,
 * so they can change without a code release. This file mirrors how those switches are shown.
 */

export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? 'https://ttpqzuviqyfuoyzchfly.supabase.co';
// Publishable key: safe to ship in the browser (row-level security protects the data).
export const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_q6AXhtzRGYohwIV-Pyz2mQ_2e9GhDs0';

export const BRAND = {
  name: 'Rendez-vous',
  short: 'RDV',
  tagline: 'Where intention meets the moment',
  pitch: "We were right next to each other and had no idea.",
  logo: '/assets/brand/rdv_logo.png',
  icon: '/assets/brand/rdv_app_icon.png',
};

/** Sign-up screen behaviour. The server (`app_config.signup`) decides which routes are open;
 *  these are the labels shown for each route. */
export const SIGNUP_COPY = {
  manual: { title: 'Apply to join', hint: 'No code? Apply directly. Every member is verified by video ID before appearing to anyone.' },
  invite: { title: 'I have an invite code', hint: 'From a founder or a Rendez-vous QR invitation.' },
  referral: { title: 'I was referred by a member', hint: "Use the member's personal referral code." },
  codeParam: 'code', // ?code=XXXX in the link (used by QR invitations) pre-fills the code
};

export const SUPPORT = {
  email: 'support@rendezvous.ae', // replace with the real address before launch (Apple 1.2)
};

export const ANDROID_IOS_RATING = '17+';

export const GENDERS = [
  { value: 'woman', label: 'Woman' },
  { value: 'man', label: 'Man' },
] as const;

export const RELIGIONS = [
  'Islam', 'Christianity', 'Hinduism', 'Judaism', 'Buddhism', 'Sikhism', 'Spiritual', 'None', 'Other',
];

export const NATIONALITIES = [
  'Emirati', 'Saudi', 'Kuwaiti', 'Qatari', 'Bahraini', 'Omani', 'Egyptian', 'Jordanian', 'Lebanese',
  'Syrian', 'Palestinian', 'Moroccan', 'Tunisian', 'Algerian', 'Iraqi', 'Iranian', 'Turkish', 'Indian',
  'Pakistani', 'Bangladeshi', 'Sri Lankan', 'Filipino', 'Indonesian', 'Malaysian', 'Chinese', 'Japanese',
  'Korean', 'British', 'Irish', 'French', 'German', 'Italian', 'Spanish', 'Portuguese', 'Dutch', 'Belgian',
  'Swiss', 'Swedish', 'Norwegian', 'Danish', 'Polish', 'Russian', 'Ukrainian', 'Greek', 'American',
  'Canadian', 'Mexican', 'Brazilian', 'Argentinian', 'Colombian', 'Australian', 'New Zealander',
  'South African', 'Nigerian', 'Kenyan', 'Ethiopian', 'Other',
];

export const UAE_CITIES = ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Fujairah', 'Umm Al Quwain'];

export const TIMELINE = [
  { value: 'within_1y', label: 'Within 1 year' },
  { value: '1_2y', label: '1–2 years' },
  { value: '2plus', label: '2+ years' },
  { value: 'not_sure', label: 'Not sure' },
] as const;

export const RELOCATION = [
  { value: 'staying', label: 'Staying where I am' },
  { value: 'within_1y', label: 'Open to relocating within 1 year' },
  { value: '1_2y', label: 'Open to relocating in 1–2 years' },
  { value: '2plus', label: 'Maybe in 2+ years' },
  { value: 'not_sure', label: 'Not sure' },
] as const;

export const KIDS = [
  { value: 'want', label: 'Want children' },
  { value: 'dont_want', label: "Don't want children" },
  { value: 'open', label: 'Open' },
] as const;

export const HABITS = [
  { value: 'never', label: 'Never' },
  { value: 'socially', label: 'Socially' },
  { value: 'regularly', label: 'Regularly' },
] as const;

export const POLITICAL = [
  { value: 'liberal', label: 'Liberal' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'conservative', label: 'Conservative' },
] as const;

/** Profile prompts (brief: Profile & Verification → Profile prompts). */
export const PROMPTS = [
  { key: 'manifesto', question: 'Personal manifesto' },
  { key: 'non_negotiables', question: 'My non-negotiable(s) / vision for marriage' },
  { key: 'why_rdv', question: 'Why I chose Rendez-vous' },
  { key: 'ideal_first', question: 'My ideal first rendez-vous' },
  { key: 'expectations', question: 'What are your expectations from a lifelong partner?' },
] as const;

export const REPORT_REASONS = [
  { value: 'fake_profile', label: 'Fake or misleading profile' },
  { value: 'harassment', label: 'Harassment or abuse' },
  { value: 'inappropriate_content', label: 'Inappropriate content' },
  { value: 'nonconsensual_imagery', label: 'Intimate image shared without consent' },
  { value: 'underage', label: 'May be under 18' },
  { value: 'scam', label: 'Scam or money request' },
  { value: 'safety_concern', label: 'Safety concern' },
  { value: 'other', label: 'Other' },
] as const;

export const RADAR = {
  radiusOptionsKm: [2, 5, 10, 20, 50],
  defaultRadiusKm: 10,
  minScoreOptions: [0, 40, 60, 75, 90],
  refreshSeconds: 60,
};

export const labelOf = <T extends { value: string; label: string }>(list: readonly T[], v?: string | null) =>
  list.find((o) => o.value === v)?.label ?? '—';
