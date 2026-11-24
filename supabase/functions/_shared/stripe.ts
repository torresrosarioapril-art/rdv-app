// Small Stripe helper (REST, form-encoded). Sandbox until RDV's trade license is active.
export async function stripe(path: string, params?: Record<string, string>, method = params ? 'POST' : 'GET') {
  const key = Deno.env.get('STRIPE_SECRET_KEY');
  if (!key) throw new Error('Payments are not switched on yet.');
  const url = `https://api.stripe.com/v1/${path}`;
  const r = await fetch(method === 'GET' && params ? `${url}?${new URLSearchParams(params)}` : url, {
    method,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: method === 'GET' ? undefined : new URLSearchParams(params ?? {}),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error?.message ?? `Stripe error ${r.status}`);
  return j;
}

/** Monthly AED price for a plan, created on first use from app_config (lookup key includes the amount,
 *  so a price change in app_config automatically creates a new Stripe price). */
export async function planPrice(plan: 'plan1' | 'plan2', p: { label: string; price_aed: number }) {
  const amount = Math.round(p.price_aed * 100);
  const lookup = `rdv_${plan}_aed_${amount}_monthly`;
  const found = await stripe('prices', { 'lookup_keys[]': lookup, active: 'true', limit: '1' }, 'GET');
  if (found.data?.[0]?.id) return found.data[0].id as string;
  const product = await stripe('products', { name: `Rendez-vous ${p.label}`, 'metadata[plan]': plan });
  const price = await stripe('prices', {
    product: product.id, currency: 'aed', unit_amount: String(amount), 'recurring[interval]': 'month',
    lookup_key: lookup, 'metadata[plan]': plan,
  });
  return price.id as string;
}

/** Copies a Stripe subscription's state into RDV (plan, status, renewal date, cancel flag). */
export async function syncSubscription(db: any, subId: string) {
  const s = await stripe(`subscriptions/${subId}`);
  const uid = s.metadata?.user_id;
  if (!uid) return null;
  const plan = ['plan1', 'plan2'].includes(s.metadata?.plan) ? s.metadata.plan : 'plan1';
  const end = s.current_period_end ?? s.items?.data?.[0]?.current_period_end;
  const { error } = await db.rpc('admin_set_subscription', {
    p_user: uid, p_plan: s.status === 'canceled' ? 'free' : plan, p_status: s.status,
    p_period_end: end ? new Date(end * 1000).toISOString() : null,
    p_cancel: !!s.cancel_at_period_end, p_customer: s.customer, p_sub: s.status === 'canceled' ? null : s.id,
  });
  if (error) throw error;
  return s;
}
