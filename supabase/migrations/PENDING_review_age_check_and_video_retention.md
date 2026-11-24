Pending (25 Nov): Supabase asked for approval on migration `review_age_check_and_video_retention` and it timed out.
It adds profile_private.age_checked_at / video_deleted_at, app_config.retention (30 days),
admin_apply_review(p_token, p_reason, p_age_confirmed) and admin_videos_due / admin_mark_video_deleted.
After it is applied: deploy `review` and `purge-verification-videos`, push commit 7d76fb9,
enable pg_cron and schedule a daily call to purge-verification-videos.
