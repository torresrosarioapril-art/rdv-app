import { admin, cors, json, userId } from '../_shared/util.ts';

// In-app account deletion (Apple Guideline 5.1.1(v)). Removes stored files, then the auth user;
// database rows cascade from auth.users.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const uid = await userId(req);
  if (!uid) return json({ error: 'Please sign in' }, 401);
  const db = admin();

  for (const bucket of ['photos', 'voice', 'verification']) {
    const { data } = await db.storage.from(bucket).list(uid, { limit: 1000 });
    if (data?.length) await db.storage.from(bucket).remove(data.map((f) => `${uid}/${f.name}`));
  }

  const { data: sub } = await db.from('subscriptions').select('stripe_subscription_id').eq('user_id', uid).maybeSingle();
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  if (sub?.stripe_subscription_id && stripeKey) {
    await fetch(`https://api.stripe.com/v1/subscriptions/${sub.stripe_subscription_id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${stripeKey}` },
    }).catch(() => {});
  }

  const { error } = await db.auth.admin.deleteUser(uid);
  if (error) return json({ error: error.message }, 400);
  return json({ ok: true });
});
