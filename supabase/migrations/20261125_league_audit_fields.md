# 25 Nov 2026 — League audit additions (applied via Supabase MCP)
Migrations: league_audit_fields_and_filters, compat_score_plain_filters,
work_email_verification_and_match_nudge, my_matches_respect_private_nudges.

- profiles: marital_status (single/divorced/separated/widowed), has_children, children_count.
- profile_private: desired_marital_status text[] ('{}' = any), partner_children_ok (yes/no/any),
  work_email, work_email_domain, work_email_verified_at, work_email_token_hash/expires (guarded), hide_from_coworkers.
- _pair_filters_ok(): plain filters checked inside compat_score (so batches, drops, radar, nearby alerts all apply them);
  not part of the six weighted criteria. Reasons: coworker, marital_status, has_children.
- Work email: Edge Function `work-email` sends a one-time link (Resend, 24 h, personal mailboxes refused via
  app_config.work_email.blocked_domains); app calls confirm_work_email(token). my_work_email(), remove_work_email().
- 30-day nudge: app_config.invitations.nudge_after_days = 30; send_match_nudges() daily via pg_cron 'match-nudges'
  (05:07 UTC = 09:07 Dubai). One-time per person per match (match_nudges), private system message (messages.for_user)
  + notification 'match_nudge'. Never archives.
