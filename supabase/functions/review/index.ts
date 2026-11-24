import { admin, esc } from '../_shared/util.ts';

// One-tap review links from the shared inbox. GET shows a confirmation page (so email link
// scanners can't approve anything by themselves); POST applies the decision.
const page = (title: string, body: string) => new Response(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><style>body{font-family:Arial,sans-serif;background:#0a1322;color:#e8ecf3;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
.c{background:#0f1b2f;border:1px solid #26344f;border-radius:16px;padding:28px;max-width:440px;width:90%}h1{font-size:22px;color:#c9a24a;margin-top:0}
button{background:#c9a24a;color:#0a1322;border:0;border-radius:10px;padding:12px 20px;font-weight:bold;font-size:15px;cursor:pointer}
button.r{background:transparent;color:#f08080;border:1px solid #f08080}textarea{width:100%;box-sizing:border-box;border-radius:8px;padding:8px;margin:8px 0 14px;background:#16243c;color:#fff;border:1px solid #26344f}</style></head>
<body><div class="c">${body}</div></body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const db = admin();

  if (req.method === 'POST') {
    const form = await req.formData();
    const token = String(form.get('token') ?? '');
    const reason = String(form.get('reason') ?? '').trim() || null;
    const { data, error } = await db.rpc('admin_apply_review', { p_token: token, p_reason: reason });
    if (error) return page('Error', `<h1>Something went wrong</h1><p>${esc(error.message)}</p>`);
    return page('Done', `<h1>${data?.ok ? 'Done' : 'Not applied'}</h1><p>${esc(data?.message)}</p>`);
  }

  const token = url.searchParams.get('token') ?? '';
  const { data: t } = await db.from('review_tokens').select('subject_type,subject_id,action,used_at,expires_at').eq('token', token).maybeSingle();
  if (!t || t.used_at || new Date(t.expires_at) < new Date()) {
    return page('Link expired', '<h1>Link expired</h1><p>This link has already been used, or it expired.</p>');
  }
  let who = '';
  if (t.subject_type === 'verification') {
    const { data: p } = await db.from('profiles').select('display_name,verification_status').eq('id', t.subject_id).single();
    who = `${esc(p?.display_name)} (currently ${esc(p?.verification_status)})`;
  } else {
    const { data: r } = await db.from('reports').select('reason,details,target_type,status').eq('id', t.subject_id).single();
    who = `Report: ${esc(r?.reason)} on a ${esc(r?.target_type)} (${esc(r?.status)})<br><small>${esc(r?.details)}</small>`;
  }
  const label = ({ approve: 'Approve member', reject: 'Reject application', action: 'Suspend reported member', dismiss: 'Dismiss report' } as Record<string, string>)[t.action as string] ?? t.action;
  const danger = t.action === 'reject' || t.action === 'action';
  return page(label, `<h1>${esc(label)}</h1><p>${who}</p>
    <form method="post"><input type="hidden" name="token" value="${esc(token)}">
    ${t.action !== 'approve' ? `<label>${t.action === 'reject' ? 'Reason shown to the member (optional)' : 'Note (optional)'}<textarea name="reason" rows="3"></textarea></label>` : ''}
    <button class="${danger ? 'r' : ''}" type="submit">Confirm: ${esc(label)}</button></form>`);
});
