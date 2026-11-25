import { admin, cors, json, userId } from '../_shared/util.ts';
import { planPrice, stripe } from '../_shared/stripe.ts';

// Starts a Stripe Checkout (sandbox until RDV's trade license is active) or opens the billing portal.
// Prices come from app_config (plans / addons), so partners can change them without code.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const uid = await userId(req);
  if (!uid) return json({ error: 'Please sign in' }, 401);
  try {
    const { item, return_url } = await req.json();
    const db = admin();
    const origin = String(return_url || Deno.env.get('APP_URL') || 'https://rdv-app-lac.vercel.app');

    const { data: prof } = await db.from('profiles').select('verification_status, display_name').eq('id', uid).single();
    if (prof?.verification_status !== 'approved') return json({ error: 'You can upgrade once your profile is verified.' }, 400);

    // Stripe customer (one per member)
    const { data: sub } = await db.from('subscriptions').select('stripe_customer_id, stripe_subscription_id, plan, status').eq('user_id', uid).single();
    let customer = sub?.stripe_customer_id as string | null;
    if (!customer) {
      const { data: u } = await db.auth.admin.getUserById(uid);
      const c = await stripe('customers', { email: u.user?.email ?? '', name: prof?.display_name ?? '', 'metadata[user_id]': uid });
      customer = c.id;
      await db.from('subscriptions').update({ stripe_customer_id: customer }).eq('user_id', uid);
    }

    if (item === 'portal') {
      const s = await stripe('billing_portal/sessions', { customer: customer!, return_url: origin });
      return json({ url: s.url });
    }

    const { data: cfg } = await db.from('app_config').select('key, value').in('key', ['plans', 'addons']);
    const plans = cfg?.find((c) => c.key === 'plans')?.value ?? {};
    const addons = cfg?.find((c) => c.key === 'addons')?.value ?? {};
    const base: Record<string, string> = {
      customer: customer!,
      success_url: `${origin}/?checkout=success`,
      cancel_url: `${origin}/?checkout=cancelled`,
      'metadata[user_id]': uid,
      'metadata[item]': item,
      'line_items[0][quantity]': '1',
      'line_items[0][price_data][currency]': 'aed',
    };

    if (item === 'plan1' || item === 'plan2') {
      const p = plans[item];
      if (!p?.price_aed) return json({ error: 'This plan has no price set.' }, 400);
      const active = sub?.stripe_subscription_id && ['active', 'trialing', 'past_due'].includes(sub?.status ?? '');
      if (active) return json({ error: 'You already have a subscription. Use "Switch plan" instead.' }, 400);
      const { 'line_items[0][price_data][currency]': _c, ...rest } = base;
      const s = await stripe('checkout/sessions', {
        ...rest, mode: 'subscription',
        'line_items[0][price]': await planPrice(item, p),
        'subscription_data[metadata][user_id]': uid,
        'subscription_data[metadata][plan]': item,
      });
      return json({ url: s.url });
    }

    if (item === 'safe_zones' || item === 'swipe_refresh' || item === 'radar_unlock') {
      const a = addons[item];
      if (!a?.price_aed) return json({ error: 'This add-on has no price set yet.' }, 400);
      const s = await stripe('checkout/sessions', {
        ...base, mode: 'payment',
        'line_items[0][price_data][unit_amount]': String(Math.round(a.price_aed * 100)),
        'line_items[0][price_data][product_data][name]': item === 'safe_zones' ? 'Rendez-vous Safe Zones' : item === 'radar_unlock' ? `Rendez-vous: see everyone nearby (${a.hours ?? 24} h)` : 'Rendez-vous early refresh',
        'metadata[quantity]': String(a.quantity ?? 1),
      });
      return json({ url: s.url });
    }
    return json({ error: 'Unknown item' }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Checkout failed' }, 400);
  }
});
