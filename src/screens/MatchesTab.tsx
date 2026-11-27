import { useCallback, useEffect, useState } from 'react';
import { CalendarHeart, Heart, Hourglass, RefreshCw, Sparkles, X } from 'lucide-react';
import {
  astroSync, getCuratedDrops, getDailyBatch, redeemSwipeCredit, startCheckout, swipe,
  type Batch, type Drops, type MemberCard, type Status,
} from '@/lib/api';
import { Button, Card, Empty, Modal, Spinner, cx, useToast } from '@/components/ui';
import { ProfileView } from '@/components/ProfileView';
import { SafetyMenu } from '@/components/SafetyMenu';

function useCountdown(to: string | null) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  if (!to) return null;
  const ms = new Date(to).getTime() - now;
  if (ms <= 0) return '00:00:00';
  const h = Math.floor(ms / 3.6e6), m = Math.floor((ms % 3.6e6) / 6e4), s = Math.floor((ms % 6e4) / 1000);
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

export default function MatchesTab({ status, onOpenChat }: { status: Status; onOpenChat: (matchId: string) => void }) {
  const [view, setView] = useState<'daily' | 'drops'>('daily');
  const [batch, setBatch] = useState<Batch | null>(null);
  const [drops, setDrops] = useState<Drops | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [matched, setMatched] = useState<{ id: string; name: string } | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [b, d] = await Promise.all([getDailyBatch(), getCuratedDrops()]);
      setBatch(b); setDrops(d);
    } catch (e) { toast(e instanceof Error ? e.message : 'Could not load matches', 'err'); }
    finally { setLoading(false); }
  }, [toast]);
  useEffect(() => { load(); astroSync(); }, [load]);

  const countdown = useCountdown(batch?.refresh_at ?? null);
  useEffect(() => { if (countdown === '00:00:00') load(); }, [countdown, load]);

  const current: MemberCard | undefined = view === 'daily'
    ? batch?.items.find((i) => !i.answered)
    : drops?.items.find((i) => i.status === 'pending');

  const answer = async (liked: boolean) => {
    if (!current) return;
    setBusy(true);
    try {
      const r = await swipe(current.id, liked, view === 'daily' ? 'swipe' : 'drop');
      if (r.matched && r.match_id) setMatched({ id: r.match_id, name: current.name });
      if (view === 'daily') setBatch((b) => b && ({ ...b, used: b.used + 1, items: b.items.map((i) => i.id === current.id ? { ...i, answered: true, liked } : i) }));
      else setDrops((d) => d && ({ ...d, items: d.items.map((i) => i.id === current.id ? { ...i, status: liked ? 'liked' : 'passed' } : i) }));
      if (view === 'daily') {
        const left = (batch?.items.filter((i) => !i.answered).length ?? 1) - 1;
        if (left <= 0) setTimeout(load, 400);
      }
    } catch (e) { toast(e instanceof Error ? e.message : 'Could not save', 'err'); }
    finally { setBusy(false); }
  };

  const refreshNow = async () => {
    setBusy(true);
    try { setBatch(await redeemSwipeCredit()); toast('New batch unlocked'); }
    catch (e) { toast(e instanceof Error ? e.message : 'Could not refresh', 'err'); }
    finally { setBusy(false); }
  };

  const removeCurrent = () => {
    if (!current) return;
    if (view === 'daily') setBatch((b) => b && ({ ...b, items: b.items.filter((i) => i.id !== current.id) }));
    else setDrops((d) => d && ({ ...d, items: d.items.filter((i) => i.id !== current.id) }));
  };

  if (loading && !batch) return <Spinner label="Preparing your matches…" />;

  const remaining = view === 'daily' ? batch?.items.filter((i) => !i.answered).length ?? 0 : drops?.items.filter((i) => i.status === 'pending').length ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display">{view === 'daily' ? <>Your daily <span className="italic text-gold">batch</span></> : <>Curated <span className="italic text-gold">drops</span> this week</>}</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {view === 'daily'
              ? `${batch?.used ?? 0} of ${batch?.size ?? 0} reviewed today · your plan allows ${status.limits.swipes_per_day} daily profile swipes`
              : `Hand-picked 75%+ matches · ${drops?.items.length ?? 0} of ${drops?.cap ?? 0} this week`}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-navy-2 w-full sm:w-72">
          {(['daily', 'drops'] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} className={cx('py-2 rounded-lg text-sm cursor-pointer', view === v ? 'bg-gold text-navy font-semibold' : 'text-slate-600 dark:text-slate-300')}>
              {v === 'daily' ? 'Daily' : 'Curated'}
            </button>
          ))}
        </div>
      </div>

      {current ? (
        <Card className="!p-4 sm:!p-6">
          <div className="flex justify-between items-center mb-3">
            <span className="text-[11px] uppercase tracking-widest text-gold">{remaining} left</span>
            <SafetyMenu memberId={current.id} name={current.name} onDone={removeCurrent} />
          </div>
          <ProfileView m={current} />
          <div className="sticky bottom-20 sm:bottom-4 mt-6 flex gap-3 justify-center">
            <Button variant="outline" className="w-36 !rounded-full bg-white dark:bg-navy-2" busy={busy} onClick={() => answer(false)}><X className="w-4 h-4" />Pass</Button>
            <Button className="w-36 !rounded-full" busy={busy} onClick={() => answer(true)}><Heart className="w-4 h-4" />Interested</Button>
          </div>
        </Card>
      ) : view === 'daily' ? (
        <Card>
          <Empty icon={<Hourglass className="w-6 h-6" />} title={batch?.size ? "You've reviewed today's batch" : 'No new profiles right now'}>
            {countdown ? <p>Your next batch arrives in <span className="font-mono text-gold">{countdown}</span>.</p> : <p>New verified members are joining. Check back soon.</p>}
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {(batch?.swipe_credits ?? 0) > 0
                ? <Button busy={busy} onClick={refreshNow}><RefreshCw className="w-4 h-4" />Use a refresh ({batch?.swipe_credits} left)</Button>
                : <Button variant="outline" onClick={() => startCheckout('swipe_refresh').catch((e) => toast(e.message, 'err'))}><RefreshCw className="w-4 h-4" />Get the next batch now</Button>}
              <Button variant="ghost" onClick={() => setView('drops')}><Sparkles className="w-4 h-4" />See curated drops</Button>
            </div>
          </Empty>
        </Card>
      ) : (
        <Card>
          <Empty icon={<CalendarHeart className="w-6 h-6" />} title={drops?.items.length ? "You've reviewed this week's drops" : 'No 75%+ matches this week yet'}>
            <p>New curated drops arrive {drops?.next_drop_at ? `on ${new Date(drops.next_drop_at).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}` : 'next week'}.</p>
          </Empty>
        </Card>
      )}

      <Modal open={!!matched} onClose={() => setMatched(null)}>
        <div className="text-center py-4">
          <div className="match-burst" aria-hidden="true"><span /><span /><span /><i /></div>
          <h2 className="text-3xl font-display italic shimmer-gold">It's mutual</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">You and {matched?.name} are both interested. Open the chat and start with one of their prompts.</p>
          <div className="mt-6 flex justify-center gap-2">
            <Button variant="ghost" onClick={() => setMatched(null)}>Keep reviewing</Button>
            <Button onClick={() => { const id = matched!.id; setMatched(null); onOpenChat(id); }}>Open chat</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
