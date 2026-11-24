import { admin, json } from '../_shared/util.ts';

// Stripe → RDV. Authenticity: every event is re-fetched from Stripe with our secret key, so a forged
// payload can't change anything. (If STRIPE_WEBHOOK_SECRET is added later, signature checks can be layered on.)
const key = () => Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const get = async (path: string) => {
  const r = await fetch(`https://api.stripe.com/v1/${path}`, { headers: { Authorization: `Bearer ${key()}` } });
  if (!r.ok) throw new Error(`stripe ${path} ${r.status}`);
  return r.json();
};

async function syncSubscription(subId: string) {
  const db = admin();
  const s = await get(`subscriptions/${subId}`);
  const uid = s.metadata?.user_id;
  if (!uid) return;
  const plan = ['plan1', 'plan2'].includes(s.metadata?.plan) ? s.metadata.plan : 'plan1';
  const end = s.current_period_end ?? s.items?.data?.[0]?.current_period_end;
  const { error } = await db.rpc('admin_set_subscription', {
    p_user: uid, p_plan: s.status === 'canceled' ? 'free' : plan, p_status: s.status,
    p_period_end: end ? new Date(end * 1000).toISOString() : null,
    p_cancel: !!s.cancel_at_period_end, p_customer: s.customer, p_sub: s.id,
  });
  if (error) throw error;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ ok: true });
  if (!key()) return json({ error: 'not configured' }, 503);
  try {
    const body = await req.json();
    const event = await get(`events/${encodeURIComponent(body.id)}`); // verified copy
    const obj = event.data.object;
    const db = admin();

    switch (event.type) {
      case 'checkout.session.completed': {
        if (obj.mode === 'subscription' && obj.subscription) await syncSubscription(obj.subscription);
        if (obj.mode === 'payment' && obj.payment_status === 'paid') {
          const uid = obj.metadata?.user_id, item = obj.metadata?.item;
          if (uid && (item === 'safe_zones' || item === 'swipe_refresh')) {
            const { error } = await db.rpc('admin_record_purchase', {
              p_user: uid, p_kind: item, p_qty: Number(obj.metadata?.quantity ?? 1),
              p_amount: (obj.amount_total ?? 0) / 100, p_session: obj.id,
            });
            if (error) throw error;
          }
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await syncSubscription(obj.id);
        break;
    }
    return json({ received: true });
  } catch (e) {
    console.error('webhook error', e);
    return json({ error: 'webhook failed' }, 400);
  }
});
