import { admin, cors, json } from '../_shared/util.ts';

// Daily job: deletes ID videos of approved members once the retention period
// (app_config.retention.verification_video_days, 15) has passed, for approved and rejected applications, and logs each deletion.
// Returns only a count, so calling it without a key reveals nothing.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const db = admin();
  const { data: due, error } = await db.rpc('admin_videos_due');
  if (error) return json({ ok: false, error: error.message }, 500);
  let deleted = 0;
  for (const row of (due ?? []) as { user_id: string; path: string }[]) {
    const { error: e } = await db.storage.from('verification').remove([row.path]);
    if (e) { console.error('remove failed', row.user_id, e.message); continue; }
    await db.rpc('admin_mark_video_deleted', { p_user: row.user_id });
    deleted++;
  }
  return json({ ok: true, deleted });
});
