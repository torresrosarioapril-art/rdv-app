Applied 25 Nov 2026: review_age_check_and_video_retention + schedule_video_purge_daily.
- Approve needs p_age_confirmed (reviewer confirms ID birth date, 18+); logged in compliance_events.
- app_config.retention.verification_video_days (30). Daily 00:15 UTC pg_cron → purge-verification-videos.
- duplicate_account_guards: _normalize_email; trigger aa_block_email_aliases on auth.users (switch app_config.signup.block_email_aliases, false while testing);
  _review_summary.possible_duplicates (same inbox, or same legal name + birth date) shown in review email and page.
- nearby_match_alerts: profile_private.nearby_alert {enabled, radius_m, min_score}; app_config.nearby_alerts; nearby_alerts_sent (cooldown);
  _nearby_check(uid) runs from update_my_location both ways; only visible members (not Ghost / Safe Zone); notification type nearby_match.
- compliance_events_more_kinds: kind check now allows verification_changes_requested, verification_rejected, verification_video_deleted (fixes Request changes / Reject error).
- daily_batch_retry_empty: an empty daily batch is rebuilt on the next open instead of waiting an hour.
- habit_tolerance_levels: profile_private.smoking_tolerance / drinking_tolerance (never_only | occasional_ok | any), migrated from no_*_partner;
  _habit_ok(); compat_score habits filter uses them both ways; closeness still scored (15%).
- live_scores_and_batch_lock: batch and drop cards show the live compat score; one batch/drop build at a time per member; duplicate batches tidied.
