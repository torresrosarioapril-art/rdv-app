import { useCallback, useEffect, useState } from 'react';
import { Bell, CalendarCheck, CalendarPlus, Hand, Heart, MapPin, MessageCircle, ShieldCheck, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cx } from './ui';

type Notif = { id: string; type: string; payload: Record<string, any> | null; read_at: string | null; created_at: string };

/** What each notification says, which icon it gets, and where tapping it goes. */
function describe(n: Notif): { text: string; icon: React.ReactNode; to?: { chat?: string; radar?: boolean } } {
  const d = n.payload ?? {};
  const chat = d.match_id as string | undefined;
  switch (n.type) {
    case 'nearby_match': {
      const where = d.within_m >= 1000 ? `${d.within_m / 1000} km` : `${d.within_m} m`;
      return { text: `${d.name ?? 'A match'} (${d.score}% match) was within ${where} of you`, icon: <MapPin className="w-4 h-4" />, to: { radar: true } };
    }
    case 'message': return { text: 'New message', icon: <MessageCircle className="w-4 h-4" />, to: { chat } };
    case 'new_match': return { text: "It's a match. Say hello", icon: <Heart className="w-4 h-4" />, to: { chat } };
    case 'radar_connect': return { text: 'Someone nearby messaged you from the radar', icon: <MapPin className="w-4 h-4" />, to: { chat } };
    case 'ping': return { text: 'You got a Ping: they would like to meet', icon: <Hand className="w-4 h-4" />, to: { chat } };
    case 'invitation': return { text: 'You have a date invitation', icon: <CalendarPlus className="w-4 h-4" />, to: { chat } };
    case 'invitation_accepted': return { text: 'Your date is confirmed', icon: <CalendarCheck className="w-4 h-4" />, to: { chat } };
    case 'invitation_declined': return { text: 'Your invitation was declined', icon: <CalendarPlus className="w-4 h-4" />, to: { chat } };
    case 'invitation_countered': return { text: 'A new time was suggested for your date', icon: <CalendarPlus className="w-4 h-4" />, to: { chat } };
    case 'verification_approved': return { text: "You're verified. Welcome to Rendez-vous", icon: <ShieldCheck className="w-4 h-4" /> };
    case 'purchase': return { text: d.kind === 'safe_zones' ? 'Safe Zones unlocked' : d.kind === 'radar_unlock' ? 'Everyone nearby unlocked for 24 h' : 'Purchase confirmed', icon: <Sparkles className="w-4 h-4" /> };
    default: return { text: 'Update from Rendez-vous', icon: <Bell className="w-4 h-4" /> };
  }
}

const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m} min`;
  if (m < 1440) return `${Math.floor(m / 60)} h`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

export function NotificationBell({ uid, onOpenChat, onOpenRadar }: { uid: string; onOpenChat: (matchId: string) => void; onOpenRadar: () => void }) {
  const [items, setItems] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);
  const load = useCallback(async () => {
    const { data } = await supabase.from('notifications').select('id,type,payload,read_at,created_at')
      .order('created_at', { ascending: false }).limit(30);
    setItems((data ?? []) as Notif[]);
  }, []);
  useEffect(() => {
    load();
    const ch = supabase.channel('bell-' + uid)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [uid, load]);

  const unread = items.filter((n) => !n.read_at).length;
  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && unread) {
      await supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null);
      setTimeout(load, 300);
    }
  };

  return (
    <div className="relative">
      <button title="Notifications" aria-label="Notifications" onClick={toggle}
        className="relative p-1.5 rounded-lg text-gold dark:text-white hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer">
        <Bell className="w-[18px] h-[18px]" />
        {unread > 0 && <span className="absolute top-0 right-0 min-w-4 h-4 px-1 rounded-full bg-gold text-navy text-[10px] font-semibold leading-4 text-center">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="fixed sm:absolute left-2 right-2 sm:left-auto sm:right-0 top-14 sm:top-auto sm:mt-2 z-50 sm:w-80 max-h-[70dvh] overflow-y-auto rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-2 shadow-xl p-1.5">
            <div className="px-2.5 pt-1.5 pb-1 text-[10px] uppercase tracking-widest text-gold">Notifications</div>
            {items.length === 0 && <p className="px-2.5 py-4 text-sm text-slate-500">Nothing yet. Matches, messages, Pings, date invitations and nearby match alerts show up here.</p>}
            {items.map((n) => {
              const x = describe(n);
              const go = () => {
                setOpen(false);
                if (x.to?.chat) onOpenChat(x.to.chat);
                else if (x.to?.radar) onOpenRadar();
              };
              return (
                <button key={n.id} onClick={go} className={cx('w-full flex items-start gap-2.5 text-left rounded-lg px-2.5 py-2 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5', !n.read_at && 'bg-gold/10')}>
                  <span className="mt-0.5 w-7 h-7 shrink-0 rounded-full bg-gold/15 text-gold flex items-center justify-center">{x.icon}</span>
                  <span className="flex-1 min-w-0 text-sm leading-snug">{x.text}</span>
                  <span className="shrink-0 text-[10px] text-slate-500 mt-0.5">{ago(n.created_at)}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
