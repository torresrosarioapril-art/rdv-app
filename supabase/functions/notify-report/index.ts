import { admin, cors, esc, json, sendEmail, userId } from '../_shared/util.ts';

// Emails a new report to the shared review inbox with one-tap Suspend / Dismiss links.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const uid = await userId(req);
  if (!uid) return json({ error: 'Please sign in' }, 401);
  const { report_id } = await req.json().catch(() => ({}));
  const db = admin();
  const { data: r } = await db.from('reports').select('id, reporter_id, reported_id, reason, details, target_type, priority').eq('id', report_id).single();
  if (!r || r.reporter_id !== uid) return json({ error: 'Not found' }, 404);

  const { data: t, error } = await db.rpc('admin_report_tokens', { p_report: r.id });
  if (error) return json({ error: error.message }, 400);
  const { data: who } = await db.from('profiles').select('display_name').eq('id', r.reported_id).single();
  const { data: cfg } = await db.from('app_config').select('value').eq('key', 'support').single();
  const inbox = Deno.env.get('REVIEW_INBOX') ?? cfg?.value?.verify_inbox;
  const base = `${Deno.env.get('APP_URL') ?? 'https://rdv-app-lac.vercel.app'}/review`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px">
    <h2 style="color:${r.priority === 'urgent' ? '#c33' : '#0a1322'}">${r.priority === 'urgent' ? 'URGENT ' : ''}Report: ${esc(r.reason)}</h2>
    <p>Member reported: <b>${esc(who?.display_name)}</b> · about a ${esc(r.target_type)}</p>
    ${r.details ? `<p style="background:#f4f4f4;padding:10px;border-radius:8px">${esc(r.details)}</p>` : ''}
    ${r.reason === 'nonconsensual_imagery' ? '<p><b>The reported content was hidden automatically.</b> Dismissing restores it.</p>' : ''}
    <p style="margin-top:20px"><a href="${base}?token=${t.action_token}" style="background:#c33;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Suspend member</a>
    &nbsp;&nbsp;<a href="${base}?token=${t.dismiss_token}" style="border:1px solid #888;color:#333;padding:10px 18px;border-radius:8px;text-decoration:none">Dismiss</a></p></div>`;
  if (inbox) await sendEmail(inbox, `${r.priority === 'urgent' ? '[URGENT] ' : ''}RDV report: ${r.reason}`, html);
  return json({ ok: true });
});
