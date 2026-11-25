import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Compass, Heart, MessageCircle, Moon, Sun, UserRound, EyeOff, Settings, Waves } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { myCalendar, myStatus, setPrivacy, updateMyLocation, type CalendarEvent, type Privacy, type Status } from '@/lib/api';
import { BRAND, VISIBILITY } from '@/config/app';
import { ToastProvider, Spinner, cx, useToast } from '@/components/ui';
import AuthScreen from '@/screens/AuthScreen';
import SetupWizard from '@/screens/SetupWizard';
import PendingScreen from '@/screens/PendingScreen';
import MatchesTab from '@/screens/MatchesTab';
import RadarTab from '@/screens/RadarTab';
import ChatTab from '@/screens/ChatTab';
import ProfileTab from '@/screens/ProfileTab';
import ReviewPage from '@/screens/ReviewPage';
import { NextDateBanner } from '@/components/UpcomingDates';
import { NotificationBell } from '@/components/NotificationBell';

export type Tab = 'radar' | 'matches' | 'chat' | 'profile' | 'settings';

function useTheme() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    // ?theme=light or ?theme=dark in the link sets the theme (and remembers it)
    const q = new URLSearchParams(window.location.search).get('theme');
    if (q === 'light' || q === 'dark') return q;
    try { return (localStorage.getItem('rdv-theme') as 'dark' | 'light') || 'dark'; } catch { return 'dark'; }
  });
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try { localStorage.setItem('rdv-theme', theme); } catch { /* ignore */ }
  }, [theme]);
  return { theme, toggle: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')) };
}

export default function App() {
  return (
    <ToastProvider>
      <Root />
    </ToastProvider>
  );
}

function Root() {
  if (window.location.pathname.startsWith('/review')) return <ReviewPage />;
  return <Member />;
}

function Member() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [status, setStatus] = useState<Status | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const { theme, toggle } = useTheme();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  // Keep the last good status if a refresh fails (e.g. a brief network drop when the
  // phone returns from the photo picker) so screens aren't torn down mid-action.
  const refresh = useCallback(async () => {
    try { setStatus(await myStatus()); }
    catch { /* keep the previous status */ }
  }, []);

  // Only reload on real sign-in / sign-out, not on background token refreshes
  const userId = session?.user?.id ?? null;
  useEffect(() => {
    if (userId) refresh(); else setStatus(null);
  }, [userId, refresh]);

  // Payment return (?checkout=success) → refresh plan
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('checkout')) {
      window.history.replaceState({}, '', window.location.pathname);
      setTimeout(refresh, 2500);
    }
  }, [refresh]);

  if (session === undefined) return <Spinner label="Opening Rendez-vous…" />;
  if (!session) return <AuthScreen theme={theme} onToggleTheme={toggle} />;
  if (!status) return <Spinner label="Loading your membership…" />;

  if (status.is_suspended) {
    return (
      <PendingScreen status={status} onRefresh={refresh} suspended />
    );
  }
  if (status.verification_status === 'rejected') {
    return <PendingScreen status={status} onRefresh={refresh} rejected />;
  }
  if (editing != null || status.verification_status === 'incomplete' || status.verification_status === 'changes_requested') {
    return <SetupWizard status={status} initialStep={editing ?? undefined} onDone={() => { setEditing(null); refresh(); }} onCancel={status.verification_status === 'approved' || status.verification_status === 'pending' ? () => setEditing(null) : undefined} />;
  }
  if (status.verification_status === 'pending') {
    return <PendingScreen status={status} onRefresh={refresh} onEdit={() => setEditing(0)} />;
  }
  return <Shell status={status} refresh={refresh} theme={theme} toggleTheme={toggle} onEditProfile={(step?: number) => setEditing(step ?? 1)} />;
}

function Shell({ status, refresh, theme, toggleTheme, onEditProfile }: {
  status: Status; refresh: () => Promise<void>; theme: 'dark' | 'light'; toggleTheme: () => void; onEditProfile: (step?: number) => void;
}) {
  const [tab, setTab] = useState<Tab>('matches');
  const [openMatch, setOpenMatch] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  const toast = useToast();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const loadEvents = useCallback(() => { myCalendar().then(setEvents).catch(() => {}); }, []);
  useEffect(() => { loadEvents(); }, [loadEvents]);

  // Unread badge: count new message notifications live
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { count } = await supabase.from('notifications').select('id', { count: 'exact', head: true })
        .is('read_at', null).in('type', ['message', 'ping', 'invitation', 'invitation_accepted', 'invitation_declined', 'invitation_countered', 'new_match', 'radar_connect']);
      if (alive) setUnread(count ?? 0);
    };
    load();
    const ch = supabase.channel('notif-' + status.user_id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${status.user_id}` }, (ev: any) => {
        load(); loadEvents();
        const n = ev?.new;
        if (n?.type === 'nearby_match') {
          const d = n.payload ?? {};
          const where = d.within_m >= 1000 ? `${d.within_m / 1000} km` : `${d.within_m} m`;
          const text = `${d.name ?? 'A match'} (${d.score}% match) is within ${where} of you right now`;
          toast(`${text}. Open Radar to see.`);
          try { if (document.hidden && 'Notification' in window && Notification.permission === 'granted') new Notification('Rendez-vous', { body: text, icon: BRAND.logo }); } catch { /* ignore */ }
        }
      })
      .subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, [status.user_id, loadEvents, toast]);

  useBackgroundLocation(status, refresh);

  const openChat = (matchId: string) => { setOpenMatch(matchId); setTab('chat'); };
  const openPlan = () => { setTab('settings'); setTimeout(() => document.getElementById('plan')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150); };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'radar', label: 'Radar', icon: <Compass className="w-5 h-5" /> },
    { id: 'matches', label: 'Matches', icon: <Heart className="w-5 h-5" /> },
    { id: 'chat', label: 'Chat', icon: <MessageCircle className="w-5 h-5" /> },
    { id: 'profile', label: 'Profile', icon: <UserRound className="w-5 h-5" /> },
  ];

  return (
    <div className="min-h-screen pb-20 sm:pb-0">
      <header className="sticky top-0 z-40 backdrop-blur bg-ivory/85 dark:bg-navy/85 border-b border-slate-200 dark:border-white/10">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between gap-2 sm:gap-3">
          <button onClick={() => setTab('matches')} className="flex items-center gap-2 cursor-pointer min-w-0 text-left">
            <img src={BRAND.logo} alt="" className="w-8 h-8 rounded-full shrink-0" />
            <span className="min-w-0 overflow-hidden leading-tight">
              <span className="block font-display text-[15px] sm:text-base whitespace-nowrap">{BRAND.name}</span>
              <span className="block text-[9px] sm:text-[10px] text-gold italic truncate">{BRAND.tagline}</span>
            </span>
          </button>
          <nav className="hidden sm:flex items-center gap-1">
            {tabs.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} className={cx('relative flex items-center gap-2 px-3 py-2 rounded-xl text-sm cursor-pointer',
                (tab === t.id || (t.id === 'profile' && tab === 'settings')) ? 'bg-gold/15 text-gold' : 'text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5')}>
                {t.icon}{t.label}
                {t.id === 'chat' && unread > 0 && <span className="ml-1 rounded-full bg-gold text-navy text-[10px] px-1.5">{unread}</span>}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-1 shrink-0">
            <VisibilityShortcut status={status} refresh={refresh} />
            <button title="Theme" aria-label="Switch light or dark" onClick={toggleTheme} className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer">
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <NotificationBell uid={status.user_id} onOpenChat={openChat} onOpenRadar={() => setTab('radar')} />
            <button title="Settings" aria-label="Settings" onClick={() => setTab('settings')}
              className={cx('p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer', tab === 'settings' && 'text-gold')}>
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>
      <NextDateBanner events={events} onOpen={() => setTab('chat')} />

      <main className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {tab === 'matches' && <MatchesTab status={status} onOpenChat={openChat} />}
        {tab === 'radar' && <RadarTab status={status} refreshStatus={refresh} onOpenChat={openChat} onOpenPlan={openPlan} />}
        {tab === 'chat' && <ChatTab status={status} openMatch={openMatch} setOpenMatch={setOpenMatch} onRead={() => setUnread(0)} events={events} onDatesChanged={loadEvents} />}
        {(tab === 'profile' || tab === 'settings') && <ProfileTab view={tab} status={status} refresh={refresh} onEditProfile={onEditProfile}
          theme={theme} onToggleTheme={toggleTheme} onOpenSettings={() => setTab('settings')} onBack={() => setTab('profile')} />}
      </main>

      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-navy-2/95 backdrop-blur border-t border-slate-200 dark:border-white/10 grid grid-cols-4 pb-[env(safe-area-inset-bottom)]">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={cx('relative flex flex-col items-center gap-0.5 py-2.5 text-[11px] cursor-pointer', (tab === t.id || (t.id === 'profile' && tab === 'settings')) ? 'text-gold' : 'text-slate-500')}>
            {t.icon}{t.label}
            {t.id === 'chat' && unread > 0 && <span className="absolute top-1.5 right-[30%] w-2 h-2 rounded-full bg-gold" />}
          </button>
        ))}
      </nav>
    </div>
  );
}

/** Header shortcut: how others see you on the radar (approximate or hidden). */
function VisibilityShortcut({ status, refresh }: { status: Status; refresh: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const toast = useToast();
  const current: Privacy = status.privacy === 'ghost' ? 'ghost' : 'blur';
  const zoneHidden = current !== 'ghost' && status.in_safe_zone;
  const choose = async (p: Privacy) => {
    setOpen(false);
    try { await setPrivacy(p); await refresh(); toast(p === 'ghost' ? "You're hidden from the radar" : 'You show up approximately (500 m)'); }
    catch (e) { toast(e instanceof Error ? e.message : 'Could not change', 'err'); }
  };
  return (
    <div className="relative">
      <button title="How others see you" onClick={() => setOpen((o) => !o)}
        className={cx('flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs cursor-pointer border',
          current === 'ghost' || zoneHidden ? 'border-slate-400/40 text-slate-500' : 'border-emerald-400/40 text-emerald-600 dark:text-emerald-300')}>
        {current === 'ghost' || zoneHidden ? <EyeOff className="w-4 h-4" /> : <Waves className="w-4 h-4" />}
        <span className="hidden md:inline">{current === 'ghost' ? 'Hidden' : zoneHidden ? 'Hidden · Safe Zone' : 'Visible'}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 z-50 w-64 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-2 shadow-xl p-1.5">
            <div className="px-2.5 pt-1.5 pb-1 text-[10px] uppercase tracking-widest text-gold">How others see you</div>
            {zoneHidden && <div className="mx-2.5 mb-1.5 rounded-lg bg-gold/10 px-2.5 py-2 text-[11px]">You're inside one of your Safe Zones, so Ghost is on automatically until you leave.</div>}
            {VISIBILITY.map((v) => (
              <button key={v.id} onClick={() => choose(v.id as Privacy)} className={cx('w-full text-left rounded-lg px-2.5 py-2 cursor-pointer', current === v.id ? 'bg-gold/15' : 'hover:bg-black/5 dark:hover:bg-white/5')}>
                <div className="text-sm font-medium flex items-center gap-1.5">{v.id === 'ghost' ? <EyeOff className="w-4 h-4" /> : <Waves className="w-4 h-4" />}{v.label}</div>
                <div className="text-[11px] text-slate-500">{v.hint}</div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Keeps the member's location fresh across the whole app (once they've consented), so Safe Zones
 *  switch them to Ghost automatically even when the Radar tab isn't open. */
function useBackgroundLocation(status: Status, refresh: () => Promise<void>) {
  const last = useRef(0);
  const zone = useRef(status.in_safe_zone);
  useEffect(() => { zone.current = status.in_safe_zone; }, [status.in_safe_zone]);
  useEffect(() => {
    if (!status.consents.location || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(async (p) => {
      if (Date.now() - last.current < 60_000) return;
      last.current = Date.now();
      try {
        const r = await updateMyLocation(p.coords.latitude, p.coords.longitude);
        if (r.in_safe_zone !== zone.current) { zone.current = r.in_safe_zone; refresh(); }
      } catch { /* ignore */ }
    }, () => {}, { enableHighAccuracy: false, maximumAge: 60_000, timeout: 30_000 });
    return () => navigator.geolocation.clearWatch(id);
  }, [status.consents.location, refresh]);
}
