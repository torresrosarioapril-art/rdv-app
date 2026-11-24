import { admin, cors, json } from '../_shared/util.ts';

// Review-inbox API used by the app's /review page (Supabase won't render HTML pages from functions).
// GET ?token=…  → what the link does (no change)
// POST {token, reason} → applies the decision
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const db = admin();

  if (req.method === 'POST') {
    const { token, reason } = await req.json().catch(() => ({}));
    const { data, error } = await db.rpc('admin_apply_review', { p_token: String(token ?? ''), p_reason: reason?.trim() || null });
    if (error) return json({ ok: false, message: error.message }, 400);
    return json(data);
  }

  const token = new URL(req.url).searchParams.get('token') ?? '';
  const { data: t } = await db.from('review_tokens').select('subject_type,subject_id,action,used_at,expires_at').eq('token', token).maybeSingle();
  if (!t || t.used_at || new Date(t.expires_at) < new Date()) return json({ valid: false });

  if (t.subject_type === 'verification') {
    const { data: s } = await db.rpc('_review_summary', { p_user: t.subject_id });
    const { data: p } = await db.from('profiles').select('verification_status').eq('id', t.subject_id).single();
    let video: string | null = null;
    if (s?.video_path) video = (await db.storage.from('verification').createSignedUrl(s.video_path, 3600)).data?.signedUrl ?? null;
    let photo: string | null = null;
    if (s?.photos?.[0]) photo = (await db.storage.from('photos').createSignedUrl(s.photos[0], 3600)).data?.signedUrl ?? null;
    return json({ valid: true, type: 'verification', action: t.action, status: p?.verification_status, video, photo,
      member: { name: s?.name, legal_name: s?.legal_name, birth_date: s?.birth_date, age: s?.age, gender: s?.gender,
        nationality: s?.nationality, city: s?.city, occupation: s?.occupation, linkedin_url: s?.linkedin_url,
        signup_method: s?.signup_method, invited_by_code: s?.invited_by_code } });
  }
  const { data: r } = await db.from('reports').select('reason,details,target_type,status,priority,created_at').eq('id', t.subject_id).single();
  return json({ valid: true, type: 'report', action: t.action, report: r });
});
