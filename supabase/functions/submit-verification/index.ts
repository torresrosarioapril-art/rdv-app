import { admin, cors, esc, json, sendEmail, userId } from '../_shared/util.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const uid = await userId(req);
  if (!uid) return json({ error: 'Please sign in' }, 401);

  const db = admin();
  const { data, error } = await db.rpc('admin_submit_for_review', { p_user: uid });
  if (error) return json({ error: error.message }, 400);
  if (!data?.ok) return json(data);

  const { data: s } = await db.rpc('_review_summary', { p_user: uid });
  const { data: cfg } = await db.from('app_config').select('value').eq('key', 'support').single();
  const inbox = Deno.env.get('REVIEW_INBOX') ?? cfg?.value?.verify_inbox;
  const base = `${Deno.env.get('APP_URL') ?? 'https://rdv-app-lac.vercel.app'}/review`;
  let video = '';
  if (s?.video_path) {
    const v = await db.storage.from('verification').createSignedUrl(s.video_path, 60 * 60 * 24 * 7);
    video = v.data?.signedUrl ?? '';
  }
  const rows = [
    ['Status', data.resubmission ? 'Resubmitted after changes' : 'New application'],
    ['Name (profile)', s?.name], ['Legal name', s?.legal_name], ['Birth date', s?.birth_date], ['Age', s?.age],
    ['Gender', s?.gender], ['Nationality', s?.nationality], ['City', s?.city], ['Occupation', s?.occupation],
    ['LinkedIn', s?.linkedin_url], ['Joined via', `${s?.signup_method ?? ''}${s?.invited_by_code ? ` (${s.invited_by_code})` : ''}`],
  ].map(([k, v]) => `<tr><td style="color:#666;padding:4px 12px 4px 0">${esc(k)}</td><td>${esc(v)}</td></tr>`).join('');

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px">
      <h2 style="color:#0a1322">${data.resubmission ? 'Resubmitted application' : 'New member to verify'}</h2>
      ${data.resubmission && data.previous_note ? `<p style="background:#fff7e0;padding:10px;border-radius:8px"><b>You asked for:</b> ${esc(data.previous_note)}</p>` : ''}
      ${(s?.possible_duplicates ?? []).length ? `<p style="background:#fde8e8;color:#8a1c1c;padding:10px;border-radius:8px"><b>Possible duplicate account:</b> ${(s.possible_duplicates as { name: string; status: string; why: string }[]).map((d) => `${esc(d.name)} (${esc(d.status)}, ${esc(d.why)})`).join('; ')}. Check before approving.</p>` : ''}
      <table>${rows}</table>
      ${video ? `<p><a href="${video}">▶ Watch the ID video</a> (link valid 7 days)</p>` : '<p><b>No video found.</b></p>'}
      <p style="margin-top:24px">
        <a href="${base}?token=${data.approve_token}" style="background:#c9a24a;color:#0a1322;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Approve</a>
        &nbsp;&nbsp;
        <a href="${base}?token=${data.changes_token}" style="border:1px solid #c9a24a;color:#8a6d1f;padding:10px 18px;border-radius:8px;text-decoration:none">Request changes</a>
        &nbsp;&nbsp;
        <a href="${base}?token=${data.reject_token}" style="border:1px solid #c33;color:#c33;padding:10px 18px;border-radius:8px;text-decoration:none">Reject</a>
      </p>
      <p style="color:#888;font-size:12px">Each link opens a confirmation page in the RDV app (with the ID video). Request changes sends the application back with your note; Reject is final. The first reviewer to act decides.</p>
    </div>`;

  if (inbox) await sendEmail(inbox, `RDV verification${data.resubmission ? ' (resubmitted)' : ''}: ${s?.name ?? 'new member'}`, html);
  return json({ ok: true });
});
