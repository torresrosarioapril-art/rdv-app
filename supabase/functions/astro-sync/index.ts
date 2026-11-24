import tzlookup from 'npm:tz-lookup@6.1.25';
import { admin, cors, json, userId } from '../_shared/util.ts';

// Birth chart + chart-to-chart compatibility via the Astrologer API (Kerykeion, RapidAPI).
// For the signed-in member: builds their natal chart when birth time and place are known (placements +
// chart wheel image for the profile), then scores synastry against compatible members who also have one.
// Members without time/place keep the sun-sign fallback in the database scoring.
const SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
const POINTS: [string, string][] = [['sun', 'Sun'], ['moon', 'Moon'], ['ascendant', 'Rising'], ['mercury', 'Mercury'], ['venus', 'Venus'], ['mars', 'Mars'], ['jupiter', 'Jupiter'], ['saturn', 'Saturn']];
const BASE = 'https://astrologer.p.rapidapi.com/api';
const PAIRS_PER_RUN = 15;

async function post(path: string, body: unknown) {
  const r = await fetch(`${BASE}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-RapidAPI-Key': Deno.env.get('ASTROLOGER_API_KEY')!, 'X-RapidAPI-Host': 'astrologer.p.rapidapi.com' },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, ok: r.ok, j };
}

// Endpoint names differ between API versions; try the known spellings in order.
async function call(paths: string[], body: unknown) {
  let last = '';
  for (const path of paths) {
    const { status, ok, j } = await post(path, body);
    if (ok) return j;
    last = `astrologer ${path} ${status} ${JSON.stringify(j).slice(0, 200)}`;
    if (status !== 404) break;
  }
  throw new Error(last);
}
// RapidAPI listing is v6 (Nov 2026); older spellings kept as fallbacks.
const SUBJECT = ['v6/subject', 'v5/data/subject', 'v5/subject'];
const COMPAT = ['v6/compatibility-score', 'v5/compatibility-score'];
const CHART = ['v6/chart/birth-chart', 'v5/chart/birth-chart'];

// Discepolo score -> 0-100 for the 10% zodiac weight
function normalise(score: number, desc?: string) {
  const d = (desc ?? '').toLowerCase();
  if (d.includes('rare')) return 100;
  if (d.includes('exceptional')) return 90;
  if (d.includes('very important')) return 78;
  if (d.includes('important')) return 65;
  if (d.includes('medium')) return 50;
  if (d.includes('minimal')) return 30;
  return Math.max(0, Math.min(100, Math.round((score / 30) * 100)));
}

const ordinal = (h: unknown) => {
  const m = String(h ?? '').match(/^(First|Second|Third|Fourth|Fifth|Sixth|Seventh|Eighth|Ninth|Tenth|Eleventh|Twelfth)/);
  return m ? ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth', 'Eleventh', 'Twelfth'].indexOf(m[1]) + 1 : null;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const uid = await userId(req);
  if (!uid) return json({ error: 'Please sign in' }, 401);
  if (!Deno.env.get('ASTROLOGER_API_KEY')) return json({ ok: false, reason: 'not configured' });
  const db = admin();

  try {
    const { data: b } = await db.rpc('admin_birth_data', { p_user: uid });
    let chartBuilt = false;
    if (b && !b.has_chart && b.birth_date && b.birth_time && b.lat != null && b.lng != null) {
      const [y, m, d] = String(b.birth_date).split('-').map(Number);
      const [hh, mm] = String(b.birth_time).split(':').map(Number);
      const subject = {
        name: b.name || 'Member', year: y, month: m, day: d, hour: hh, minute: mm,
        city: b.city ?? '', longitude: b.lng, latitude: b.lat, timezone: tzlookup(b.lat, b.lng),
        zodiac_type: 'Tropical', houses_system_identifier: 'P',
      };
      const res = await call(SUBJECT, { subject });
      const s = res.subject ?? res.data?.subject ?? res.chart_data?.subject ?? res;
      if (!s?.sun) throw new Error('unexpected subject response: ' + JSON.stringify(Object.keys(res)));
      const sign = (p: any) => (p?.sign_num != null ? SIGNS[p.sign_num] : null);
      const placements = POINTS.filter(([k]) => s[k]).map(([k, label]) => ({
        point: label, sign: sign(s[k]), degree: s[k].position != null ? Math.floor(s[k].position) : null,
        house: k === 'ascendant' ? 1 : ordinal(s[k].house), retrograde: !!s[k].retrograde,
      }));

      // Chart wheel image for the profile (best effort)
      let chartPath: string | null = null;
      try {
        const c = await call(CHART, { subject, theme: 'dark', split_chart: true, transparent_background: true, language: 'EN' });
        const svg: string | undefined = c.chart_wheel ?? c.chart;
        if (svg && svg.startsWith('<')) {
          chartPath = `${uid}/natal-${Date.now()}.svg`;
          const up = await db.storage.from('charts').upload(chartPath, new Blob([svg], { type: 'image/svg+xml' }), { contentType: 'image/svg+xml', upsert: true });
          if (up.error) { console.error('chart upload', up.error); chartPath = null; }
        }
      } catch (e) { console.error('chart image', e); }

      const { error } = await db.rpc('admin_set_natal', {
        p_user: uid, p_sun: sign(s.sun), p_moon: sign(s.moon), p_rising: sign(s.ascendant),
        p_chart: { subject }, p_placements: placements, p_chart_path: chartPath,
      });
      if (error) throw error;
      chartBuilt = true;
    }

    const { data: pairs } = await db.rpc('admin_pending_synastry_for', { p_user: uid, p_limit: PAIRS_PER_RUN });
    let scored = 0;
    for (const p of pairs ?? []) {
      const r = await call(COMPAT, { first_subject: p.chart_me.subject, second_subject: p.chart_other.subject });
      const desc = r.score_description ?? r.description ?? r.relationship_score_description;
      const raw = Number(r.score ?? r.score_value ?? 0);
      await db.rpc('admin_set_zodiac_compat', { a: uid, b: p.other, p_score: normalise(raw, desc), p_band: desc ?? null });
      scored++;
    }
    return json({ ok: true, chartBuilt, scored });
  } catch (e) {
    console.error(e);
    return json({ ok: false, error: e instanceof Error ? e.message : 'astro error' }, 200);
  }
});
