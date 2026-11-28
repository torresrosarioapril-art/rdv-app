import { useCallback, useEffect, useState } from 'react';
import { CalendarHeart, Heart, Hourglass, Sparkles, X } from 'lucide-react';
import {
  astroSync, getCuratedDrops, startCheckout, swipe,
  type Drops, type MemberCard, type Status,
} from '@/lib/api';
import { Button, Card, Empty, Modal, Spinner, useToast } from '@/components/ui';
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
  const [drops, setDrops] = useState<Drops | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [matched, setMatched] = useState<{ id: string; name: string } | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try { setDrops(await getCuratedDrops()); }
    catch (e) { toast(e instanceof Error ? e.message : 'Could not load matches', 'err'); }
    finally { setLoading(false); }
  }, [toast]);
  useEffect(() => { load(); astroSync(); }, [load]);

  const countdown = useCountdown(drops?.next_drop_at ?? null);
  useEffect(() => { if (countdown === '00:00:00') load(); }, [countdown, load]);

  const current: MemberCard | undefined = drops?.items.find((i) => i.status === 'pending');

  const answer = async (liked: boolean) => {
    if (!current) return;
    setBusy(true);
    try {
      const r = await swipe(current.id, liked, 'drop');
      if (r.matched && r.match_id) setMatched({ id: r.match_id, name: current.name });
      setDrops((d) => d && ({ ...d, items: d.items.map((i) => i.id === current.id ? { ...i, status: liked ? 'liked' : 'passed' } : i) }));
    } catch (e) { toast(e instanceof Error ? e.message : 'Could not save', 'err'); }
    finally { setBusy(false); }
  };

  const removeCurrent = () => {
    if (!current) return;
    setDrops((d) => d && ({ ...d, items: d.items.filter((i) => i.id !== current.id) }));
  };

  if (loading && !drops) return <Spinner label="Preparing your matches…" />;

  const remaining = drops?.items.filter((i) => i.status === 'pending').length ?? 0;
  const perDay = drops?.per_day ?? status.limits.drops_per_day ?? null;
  const cap = drops?.cap ?? status.limits.drops_per_week;
  const weekFull = (drops?.delivered ?? drops?.items.length ?? 0) >= cap;
  const nextLabel = drops?.next_drop_at
    ? new Date(drops.next_drop_at).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })
    : null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-display">Curated <span className="italic text-gold">drops</span></h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Hand-picked 75%+ matches · {perDay ? `${perDay} a day, ` : ''}{drops?.items.length ?? 0} of {cap} this week
        </p>
      </div>

      {current ? (
        <Card className="!p-4 sm:!p-6">
          <div className="flex justify-between items-center mb-3">
            <span className="text-[11px] uppercase tracking-widest text-gold">{remaining} waiting</span>
            <SafetyMenu memberId={current.id} name={current.name} onDone={removeCurrent} />
          </div>
          <ProfileView m={current} />
          <div className="sticky bottom-20 sm:bottom-4 mt-6 flex gap-3 justify-center">
            <Button variant="outline" className="w-36 !rounded-full bg-white dark:bg-navy-2" busy={busy} onClick={() => answer(false)}><X className="w-4 h-4" />Pass</Button>
            <Button className="w-36 !rounded-full" busy={busy} onClick={() => answer(true)}><Heart className="w-4 h-4" />Interested</Button>
          </div>
        </Card>
      ) : (
        <Card>
          <Empty icon={perDay && !weekFull ? <Hourglass className="w-6 h-6" /> : <CalendarHeart className="w-6 h-6" />}
            title={drops?.items.length ? (perDay && !weekFull ? "You've seen today's drop" : "You've reviewed this week's drops") : 'No 75%+ match for you yet'}>
            {countdown && perDay && !weekFull
              ? <p>Your next curated match arrives in <span className="font-mono text-gold">{countdown}</span>.</p>
              : <p>New curated drops arrive {nextLabel ? `on ${nextLabel}` : 'next week'}.</p>}
            {status.plan === 'free' && (
              <div className="mt-5 flex justify-center">
                <Button variant="outline" onClick={() => startCheckout('plan1').catch((e) => toast(e.message, 'err'))}><Sparkles className="w-4 h-4" />Get a curated match every day</Button>
              </div>
            )}
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
