import { admin, json } from '../_shared/util.ts';
import { stripe, syncSubscription } from '../_shared/stripe.ts';

// Stripe → RDV. Authenticity: every event is re-fetched from Stripe with our secret key, so a forged
// payload can't change anything. (If STRIPE_WEBHOOK_SECRET is added later, signature checks can be layered on.)
const key = () => Deno.env.get('STRIPE_SECRET_KEY') ?? '';
Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ ok: true });
  if (!key()) return json({ error: 'not configured' }, 503);
  try {
    const body = await req.json();
    const event = await stripe(`events/${encodeURIComponent(body.id)}`); // verified copy
    const obj = event.data.object;
    const db = admin();

    switch (event.type) {
      case 'checkout.session.completed': {
        if (obj.mode === 'subscription' && obj.subscription) await syncSubscription(db, obj.subscription);
        if (obj.mode === 'payment' && obj.payment_status === 'paid') {
          const uid = obj.metadata?.user_id, item = obj.metadata?.item;
          if (uid && (item === 'safe_zones' || item === 'swipe_refresh' || item === 'radar_unlock')) {
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
        await syncSubscription(db, obj.id);
        break;
    }
    return json({ received: true });
  } catch (e) {
    console.error('webhook error', e);
    return json({ error: 'webhook failed' }, 400);
  }
});
