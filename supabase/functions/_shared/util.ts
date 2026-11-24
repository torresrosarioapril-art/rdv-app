import { createClient } from 'npm:@supabase/supabase-js@2';

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

export const admin = () =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

/** Returns the signed-in member's id from the request's bearer token, or null. */
export async function userId(req: Request): Promise<string | null> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data } = await admin().auth.getUser(token);
  return data.user?.id ?? null;
}

/** Sends an email through Resend when RESEND_API_KEY is set; otherwise logs and returns false. */
export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const key = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('EMAIL_FROM') ?? 'Rendez-vous <onboarding@resend.dev>';
  if (!key) { console.log('[email skipped: no RESEND_API_KEY]', to, subject); return false; }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: to.split(',').map((s) => s.trim()), subject, html }),
  });
  if (!r.ok) console.error('email failed', r.status, await r.text());
  return r.ok;
}

export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
