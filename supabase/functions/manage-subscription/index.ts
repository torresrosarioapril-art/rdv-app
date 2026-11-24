import { admin, cors, json, userId } from '../_shared/util.ts';
import { planPrice, stripe, syncSubscription } from '../_shared/stripe.ts';

// In-app subscription management:
//   change {plan}  → switch Regular ↔ Premium now (prorated)
//   cancel         → stop auto-renewal; access continues until the end of the paid period
//   resume         → undo a cancellation before the period ends
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const uid = await userId(req);
  if (!uid) return json({ error: 'Please sign in' }, 401);
  try {
    const { action, plan } = await req.json();
    const db = admin();
    const { data: sub } = await db.from('subscriptions').select('stripe_subscription_id, status, plan').eq('user_id', uid).single();
    if (!sub?.stripe_subscription_id || !['active', 'trialing', 'past_due'].includes(sub.status)) {
      return json({ error: 'You have no active subscription.' }, 400);
    }
    const id = sub.stripe_subscription_id;

    if (action === 'cancel') {
      await stripe(`subscriptions/${id}`, { cancel_at_period_end: 'true' });
    } else if (action === 'resume') {
      await stripe(`subscriptions/${id}`, { cancel_at_period_end: 'false' });
    } else if (action === 'change') {
      if (plan !== 'plan1' && plan !== 'plan2') return json({ error: 'Unknown plan' }, 400);
      if (plan === sub.plan) return json({ error: 'You are already on this plan.' }, 400);
      const { data: cfg } = await db.from('app_config').select('value').eq('key', 'plans').single();
      const price = await planPrice(plan, cfg!.value[plan]);
      const s = await stripe(`subscriptions/${id}`);
      await stripe(`subscriptions/${id}`, {
        'items[0][id]': s.items.data[0].id,
        'items[0][price]': price,
        proration_behavior: 'create_prorations',
        cancel_at_period_end: 'false',
        'metadata[plan]': plan,
        'metadata[user_id]': uid,
      });
    } else {
      return json({ error: 'Unknown action' }, 400);
    }

    const s = await syncSubscription(db, id);
    return json({ ok: true, status: s?.status, cancel_at_period_end: s?.cancel_at_period_end });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Could not update the subscription' }, 400);
  }
});
