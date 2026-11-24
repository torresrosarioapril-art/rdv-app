# Rendez-vous (RDV)

Invite-led, verified, marriage-minded dating for UAE professionals. Web app first (React + Vite + Tailwind), backend on Supabase, hosted on Vercel. Spec: the "Rendez-vous (RDV) — App Feature & Requirements Brief" Google Doc.

## Where things live

| What | Where |
|---|---|
| Screens | `src/screens/` — Auth, SetupWizard (7 steps), Pending, Matches (daily batch + curated drops), Radar, Chat, Profile/Plan |
| App copy, option lists, labels | `src/config/app.ts` |
| Calls to the backend | `src/lib/api.ts` |
| Server functions (Deno) | `supabase/functions/` — submit-verification, review, notify-report, create-checkout, stripe-webhook, astro-sync, delete-account |
| Business numbers & switches | Supabase table `app_config` (no code change needed) |

### Changing numbers without code (`app_config`)
`plans` (prices, swipes/day, drops/week, radar cap, consultations), `trial`, `weights`, `scoring`, `bands`, `thresholds`,
`invitations` (cap per match, counter rounds, `require_ping_first`), `swipe`, `radar`, `addons`, `signup`
(`manual` / `invite` / `referral` on/off), `referrals`, `support`.

Example: turn off open sign-up
```sql
update app_config set value = jsonb_set(value, '{manual}', 'false') where key = 'signup';
```

## Server function secrets (Supabase → Edge Functions → Secrets)
- `RESEND_API_KEY`, `EMAIL_FROM` — review-inbox emails (verification + reports)
- `REVIEW_INBOX` — overrides `app_config.support.verify_inbox` (comma-separated for several people)
- `STRIPE_SECRET_KEY` — payments (sandbox secret key, sk_test_…)
- `ASTROLOGER_API_KEY` — RapidAPI key for natal charts + synastry
- `APP_URL` — public app address for links in emails (default https://rdv-app-lac.vercel.app)

Stripe webhook endpoint: `https://ttpqzuviqyfuoyzchfly.supabase.co/functions/v1/stripe-webhook` (events: checkout.session.completed, customer.subscription.created/updated/deleted). Events are re-fetched from Stripe, so no webhook secret is required.

## Local development
```bash
npm install
npm run dev
```
Environment: see `.env.example` (public values only).
