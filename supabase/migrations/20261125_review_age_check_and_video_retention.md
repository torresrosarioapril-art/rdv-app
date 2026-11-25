Applied 25 Nov 2026: review_age_check_and_video_retention + schedule_video_purge_daily.
- Approve needs p_age_confirmed (reviewer confirms ID birth date, 18+); logged in compliance_events.
- app_config.retention.verification_video_days (30). Daily 00:15 UTC pg_cron → purge-verification-videos.
