import { admin, cors, esc, json, sendEmail, userId } from '../_shared/util.ts';

// Optional work email verification: emails a one-time link (via Resend). Clicking it marks the work email
// verified, which unlocks "Hide from coworkers". Personal mailboxes (gmail, outlook…) are refused.
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const uid = await userId(req);
  if (!uid) return json({ error: 'Please sign in' }, 401);
  try {
    const { email, return_url } = await req.json();
    const addr = String(email ?? '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(addr) || addr.length > 200) return json({ error: 'Enter a valid work email address.' }, 400);
    const domain = addr.split('@')[1];
    const db = admin();
    const { data: cfg } = await db.from('app_config').select('value').eq('key', 'work_email').single();
    const blocked: string[] = cfg?.value?.blocked_domains ?? [];
    if (blocked.includes(domain)) return json({ error: 'Please use your work address, not a personal mailbox like Gmail or Outlook.' }, 400);
    const hours = Number(cfg?.value?.link_hours ?? 24);

    const raw = new Uint8Array(32); crypto.getRandomValues(raw);
    const token = hex(raw.buffer);
    const hash = hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)));
    const { error } = await db.rpc('admin_set_work_email_token', {
      p_user: uid, p_email: addr, p_domain: domain, p_hash: hash,
      p_expires: new Date(Date.now() + hours * 3600_000).toISOString(),
    });
    if (error) throw error;

    const origin = String(return_url || Deno.env.get('APP_URL') || 'https://rdv-app-lac.vercel.app').replace(/\/$/, '');
    const link = `${origin}/?verify_work_email=${token}`;
    const ok = await sendEmail(addr, 'Confirm your work email for Rendez-vous', `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#0f172a">
        <h2 style="font-family:Georgia,serif">Confirm your work email</h2>
        <p>Tap the button to confirm <b>${esc(addr)}</b> on Rendez-vous. Once confirmed you can turn on <i>Hide from coworkers</i>.</p>
        <p><a href="${link}" style="display:inline-block;background:#c9a24a;color:#0a1322;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:bold">Confirm work email</a></p>
        <p style="font-size:12px;color:#64748b">The link works once and expires in ${hours} hours. Your work email is never shown to other members. If you didn't ask for this, ignore this email.</p>
      </div>`);
    if (!ok) return json({ error: "We couldn't send the confirmation email right now. Work email confirmation opens once RDV's email address is set up, so you can skip this for now." }, 503);
    return json({ ok: true, sent: ok });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Could not send the link' }, 400);
  }
});
