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
  tagline: '“Where intention meets the moment.”',
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
  { value: 'socially', label: 'Occasionally' },
  { value: 'regularly', label: 'Regularly' },
] as const;

export const SMOKING_TOLERANCE = [
  { value: 'never_only', label: 'Non-smokers only' },
  { value: 'occasional_ok', label: 'Occasionally is OK' },
  { value: 'any', label: "Doesn't matter" },
] as const;

export const DRINKING_TOLERANCE = [
  { value: 'never_only', label: 'Non-drinkers only' },
  { value: 'occasional_ok', label: 'Occasionally is OK' },
  { value: 'any', label: "Doesn't matter" },
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

/** Location visibility on the radar. Exact sharing is off for safety (server: app_config.radar.allow_exact). */
export const VISIBILITY = [
  { id: 'blur', label: 'Approximate', hint: 'Shown to the nearest 500 m, never your exact spot' },
  { id: 'ghost', label: 'Hidden (Ghost)', hint: 'Invisible to everyone on the radar' },
] as const;

/** City search for place of birth (OpenStreetMap data via Photon; free, no key). */
export const GEOCODER_URL = 'https://photon.komoot.io/api/';

/** ISO 3166 countries: [code, name]. */
export const COUNTRIES: [string, string][] = [
  ['AF','Afghanistan'],['AL','Albania'],['DZ','Algeria'],['AD','Andorra'],['AO','Angola'],['AG','Antigua and Barbuda'],['AR','Argentina'],['AM','Armenia'],['AU','Australia'],['AT','Austria'],['AZ','Azerbaijan'],
  ['BS','Bahamas'],['BH','Bahrain'],['BD','Bangladesh'],['BB','Barbados'],['BY','Belarus'],['BE','Belgium'],['BZ','Belize'],['BJ','Benin'],['BT','Bhutan'],['BO','Bolivia'],['BA','Bosnia and Herzegovina'],['BW','Botswana'],['BR','Brazil'],['BN','Brunei'],['BG','Bulgaria'],['BF','Burkina Faso'],['BI','Burundi'],
  ['KH','Cambodia'],['CM','Cameroon'],['CA','Canada'],['CV','Cape Verde'],['CF','Central African Republic'],['TD','Chad'],['CL','Chile'],['CN','China'],['CO','Colombia'],['KM','Comoros'],['CG','Congo'],['CD','Congo (DRC)'],['CR','Costa Rica'],['CI',"Côte d'Ivoire"],['HR','Croatia'],['CU','Cuba'],['CY','Cyprus'],['CZ','Czechia'],
  ['DK','Denmark'],['DJ','Djibouti'],['DM','Dominica'],['DO','Dominican Republic'],['EC','Ecuador'],['EG','Egypt'],['SV','El Salvador'],['GQ','Equatorial Guinea'],['ER','Eritrea'],['EE','Estonia'],['SZ','Eswatini'],['ET','Ethiopia'],
  ['FJ','Fiji'],['FI','Finland'],['FR','France'],['GA','Gabon'],['GM','Gambia'],['GE','Georgia'],['DE','Germany'],['GH','Ghana'],['GR','Greece'],['GD','Grenada'],['GT','Guatemala'],['GN','Guinea'],['GW','Guinea-Bissau'],['GY','Guyana'],
  ['HT','Haiti'],['HN','Honduras'],['HK','Hong Kong'],['HU','Hungary'],['IS','Iceland'],['IN','India'],['ID','Indonesia'],['IR','Iran'],['IQ','Iraq'],['IE','Ireland'],['IL','Israel'],['IT','Italy'],
  ['JM','Jamaica'],['JP','Japan'],['JO','Jordan'],['KZ','Kazakhstan'],['KE','Kenya'],['KI','Kiribati'],['XK','Kosovo'],['KW','Kuwait'],['KG','Kyrgyzstan'],['LA','Laos'],['LV','Latvia'],['LB','Lebanon'],['LS','Lesotho'],['LR','Liberia'],['LY','Libya'],['LI','Liechtenstein'],['LT','Lithuania'],['LU','Luxembourg'],
  ['MO','Macao'],['MG','Madagascar'],['MW','Malawi'],['MY','Malaysia'],['MV','Maldives'],['ML','Mali'],['MT','Malta'],['MH','Marshall Islands'],['MR','Mauritania'],['MU','Mauritius'],['MX','Mexico'],['FM','Micronesia'],['MD','Moldova'],['MC','Monaco'],['MN','Mongolia'],['ME','Montenegro'],['MA','Morocco'],['MZ','Mozambique'],['MM','Myanmar'],
  ['NA','Namibia'],['NR','Nauru'],['NP','Nepal'],['NL','Netherlands'],['NZ','New Zealand'],['NI','Nicaragua'],['NE','Niger'],['NG','Nigeria'],['KP','North Korea'],['MK','North Macedonia'],['NO','Norway'],['OM','Oman'],
  ['PK','Pakistan'],['PW','Palau'],['PS','Palestine'],['PA','Panama'],['PG','Papua New Guinea'],['PY','Paraguay'],['PE','Peru'],['PH','Philippines'],['PL','Poland'],['PT','Portugal'],['PR','Puerto Rico'],['QA','Qatar'],
  ['RO','Romania'],['RU','Russia'],['RW','Rwanda'],['KN','Saint Kitts and Nevis'],['LC','Saint Lucia'],['VC','Saint Vincent and the Grenadines'],['WS','Samoa'],['SM','San Marino'],['ST','São Tomé and Príncipe'],['SA','Saudi Arabia'],['SN','Senegal'],['RS','Serbia'],['SC','Seychelles'],['SL','Sierra Leone'],['SG','Singapore'],['SK','Slovakia'],['SI','Slovenia'],['SB','Solomon Islands'],['SO','Somalia'],['ZA','South Africa'],['KR','South Korea'],['SS','South Sudan'],['ES','Spain'],['LK','Sri Lanka'],['SD','Sudan'],['SR','Suriname'],['SE','Sweden'],['CH','Switzerland'],['SY','Syria'],
  ['TW','Taiwan'],['TJ','Tajikistan'],['TZ','Tanzania'],['TH','Thailand'],['TL','Timor-Leste'],['TG','Togo'],['TO','Tonga'],['TT','Trinidad and Tobago'],['TN','Tunisia'],['TR','Türkiye'],['TM','Turkmenistan'],['TV','Tuvalu'],
  ['UG','Uganda'],['UA','Ukraine'],['AE','United Arab Emirates'],['GB','United Kingdom'],['US','United States'],['UY','Uruguay'],['UZ','Uzbekistan'],['VU','Vanuatu'],['VA','Vatican City'],['VE','Venezuela'],['VN','Vietnam'],['YE','Yemen'],['ZM','Zambia'],['ZW','Zimbabwe'],
];

/** Dubai areas shown on the radar and used to say roughly where someone is ("near DIFC"). Approximate centres. */
export const DUBAI_AREAS: { name: string; lat: number; lng: number }[] = [
  { name: 'DIFC', lat: 25.2124, lng: 55.2809 },
  { name: 'Downtown Dubai', lat: 25.1972, lng: 55.2744 },
  { name: 'Business Bay', lat: 25.1857, lng: 55.2650 },
  { name: 'City Walk', lat: 25.2070, lng: 55.2620 },
  { name: 'Jumeirah', lat: 25.2100, lng: 55.2500 },
  { name: 'Al Safa', lat: 25.1800, lng: 55.2400 },
  { name: 'Umm Suqeim', lat: 25.1530, lng: 55.2110 },
  { name: 'Al Quoz', lat: 25.1460, lng: 55.2300 },
  { name: 'Al Barsha', lat: 25.1110, lng: 55.1960 },
  { name: 'Dubai Hills', lat: 25.1047, lng: 55.2440 },
  { name: 'Palm Jumeirah', lat: 25.1124, lng: 55.1390 },
  { name: 'Dubai Media City', lat: 25.0930, lng: 55.1550 },
  { name: 'Dubai Marina', lat: 25.0805, lng: 55.1403 },
  { name: 'JBR', lat: 25.0780, lng: 55.1330 },
  { name: 'JLT', lat: 25.0693, lng: 55.1418 },
  { name: 'Bur Dubai', lat: 25.2532, lng: 55.2970 },
  { name: 'Deira', lat: 25.2711, lng: 55.3075 },
  { name: 'Dubai Creek Harbour', lat: 25.2010, lng: 55.3460 },
  { name: 'Al Jaddaf', lat: 25.2180, lng: 55.3330 },
  { name: 'Mirdif', lat: 25.2200, lng: 55.4200 },
  { name: 'Dubai Silicon Oasis', lat: 25.1200, lng: 55.3800 },
];
