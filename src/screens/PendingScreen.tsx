import { Hourglass, ShieldAlert } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Status } from '@/lib/api';
import { BRAND, SUPPORT } from '@/config/app';
import { Button, Card } from '@/components/ui';

export default function PendingScreen({ status, onRefresh, onEdit, suspended, rejected }: {
  status: Status; onRefresh: () => void; onEdit?: () => void; suspended?: boolean; rejected?: boolean;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full text-center space-y-4">
        <img src={BRAND.logo} alt="" className="w-14 h-14 mx-auto" />
        {rejected ? (
          <>
            <ShieldAlert className="w-7 h-7 text-rose-500 mx-auto" />
            <h1 className="text-2xl font-display">Your application wasn't approved</h1>
            {status.rejection_reason && <p className="text-sm rounded-xl bg-slate-50 dark:bg-navy-3 p-3">{status.rejection_reason}</p>}
            <p className="text-sm text-slate-500 dark:text-slate-400">If you believe this is a mistake, contact <a className="text-gold" href={`mailto:${SUPPORT.email}`}>{SUPPORT.email}</a>.</p>
          </>
        ) : suspended ? (
          <>
            <ShieldAlert className="w-7 h-7 text-rose-500 mx-auto" />
            <h1 className="text-2xl font-display">Account on hold</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Your account is paused while our team reviews it. If you think this is a mistake, contact <a className="text-gold" href={`mailto:${SUPPORT.email}`}>{SUPPORT.email}</a>.</p>
          </>
        ) : (
          <>
            <Hourglass className="w-7 h-7 text-gold mx-auto" />
            <h1 className="text-2xl font-display">Your application is being reviewed</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              A founder is reviewing your video ID. Once you're approved, you'll appear in daily batches, curated drops and the radar, and you'll see your matches here.
            </p>
            {status.in_trial && status.trial_ends_at && (
              <p className="text-xs text-slate-500">Your 7-day full-access trial runs until {new Date(status.trial_ends_at).toLocaleDateString()}.</p>
            )}
          </>
        )}
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          <Button variant="outline" onClick={onRefresh}>Check again</Button>
          {onEdit && <Button variant="ghost" onClick={onEdit}>Edit my profile</Button>}
          <Button variant="ghost" onClick={() => supabase.auth.signOut()}>Sign out</Button>
        </div>
      </Card>
    </div>
  );
}
