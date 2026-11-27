import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Compass, Heart, MessageCircle, Moon, Sun, UserRound, EyeOff, Settings } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { confirmWorkEmail, myCalendar, myStatus, setPrivacy, updateMyLocation, type CalendarEvent, type Privacy, type Status } from '@/lib/api';
import { BRAND } from '@/config/app';
import { ToastProvider, Spinner, cx, useToast, RadarRings } from '@/components/ui';
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
import { BrandLogo } from '@/components/BrandLogo';

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
  const toast = useToast();
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const t = q.get('verify_work_email');
    if (!t) return;
    q.delete('verify_work_email');
    window.history.replaceState(null, '', window.location.pathname + (q.toString() ? `?${q}` : ''));
    confirmWorkEmail(t).then((r) => toast(r?.ok ? 'Work email confirmed. You can now turn on Hide from coworkers in Settings.' : r?.error ?? 'This link is not valid.', r?.ok ? undefined : 'err'))
      .catch(() => toast('Could not confirm the link. Please try again.', 'err'));
  }, [toast]);
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
  const [prevTab, setPrevTab] = useState<Tab>('matches');
  const openSettings = () => { if (tab !== 'settings') setPrevTab(tab); setTab('settings'); };
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
        .is('read_at', null).in('type', ['message', 'ping', 'invitation', 'invitation_accepted', 'invitation_declined', 'invitation_countered', 'new_match', 'radar_connect', 'match_nudge', 'date_change']);
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
          try { if (document.hidden && 'Notification' in window && Notification.permission === 'granted') new Notification('Rendez-vous', { body: text, icon: BRAND.icon }); } catch { /* ignore */ }
        }
      })
      .subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, [status.user_id, loadEvents, toast]);

  useBackgroundLocation(status, refresh);

  const openChat = (matchId: string) => { setOpenMatch(matchId); setTab('chat'); };
  const openPlan = () => { openSettings(); setTimeout(() => document.getElementById('plan')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150); };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'radar', label: 'Radar', icon: <Compass className="w-5 h-5" /> },
    { id: 'matches', label: 'Matches', icon: <Heart className="w-5 h-5" /> },
    { id: 'chat', label: 'Chat', icon: <MessageCircle className="w-5 h-5" /> },
    { id: 'profile', label: 'Profile', icon: <UserRound className="w-5 h-5" /> },
  ];

  return (
    <div className="min-h-screen pb-20 sm:pb-0">
      <header className="sticky top-0 z-40 backdrop-blur bg-ivory/85 dark:bg-navy/85 border-b border-gold/30 dark:border-white/10">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between gap-2 sm:gap-3">
          <button onClick={() => setTab('matches')} className="flex items-center gap-2 cursor-pointer min-w-0 text-left">
            <BrandLogo className="w-9 h-9 shrink-0" />
            <span className="min-w-0 overflow-hidden leading-tight">
              <span className="block font-display text-lg sm:text-xl whitespace-nowrap">{BRAND.name}</span>
              <span className="block font-display text-[11px] sm:text-xs text-gold italic truncate">{BRAND.tagline}</span>
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
          <div className="flex items-center gap-0.5 shrink-0 pl-2">
            <VisibilityShortcut status={status} refresh={refresh} />
            <button title="Theme" aria-label="Switch light or dark" onClick={toggleTheme} className={HEADER_ICON}>
              {theme === 'dark' ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
            </button>
            <NotificationBell uid={status.user_id} onOpenChat={openChat} onOpenRadar={() => setTab('radar')} />
            <button title="Settings" aria-label="Settings" onClick={openSettings}
              className={HEADER_ICON}>
              <Settings className="w-[18px] h-[18px]" />
            </button>
          </div>
        </div>
      </header>
      <NextDateBanner events={events} onOpen={() => { setOpenMatch(null); setTab('chat'); setTimeout(() => document.getElementById('your-dates')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200); }} />

      <main className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {tab === 'matches' && <MatchesTab status={status} onOpenChat={openChat} />}
        {tab === 'radar' && <RadarTab status={status} refreshStatus={refresh} onOpenChat={openChat} onOpenPlan={openPlan} />}
        {tab === 'chat' && <ChatTab status={status} openMatch={openMatch} setOpenMatch={setOpenMatch} onRead={() => setUnread(0)} events={events} onDatesChanged={loadEvents} />}
        {(tab === 'profile' || tab === 'settings') && <ProfileTab view={tab} status={status} refresh={refresh} onEditProfile={onEditProfile}
          theme={theme} onToggleTheme={toggleTheme} onOpenSettings={openSettings} onBack={() => setTab(prevTab)} />}
      </main>

      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-navy-2/95 backdrop-blur border-t border-gold/30 dark:border-white/10 grid grid-cols-4 pb-[env(safe-area-inset-bottom)]">
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

export const HEADER_ICON = 'p-1.5 rounded-lg text-gold dark:text-white hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer';

/** Header shortcut: how others see you on the radar (approximate or hidden). */
function VisibilityShortcut({ status, refresh }: { status: Status; refresh: () => Promise<void> }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const current: Privacy = status.privacy === 'ghost' ? 'ghost' : 'blur';
  const zoneHidden = current !== 'ghost' && status.in_safe_zone;
  const hidden = current === 'ghost' || zoneHidden;
  // One tap switches, like the theme button
  const flip = async () => {
    if (busy) return;
    const next: Privacy = current === 'ghost' ? 'blur' : 'ghost';
    setBusy(true);
    try {
      await setPrivacy(next); await refresh();
      toast(next === 'ghost' ? "Ghost on: you're hidden from the radar"
        : status.in_safe_zone ? "Ghost off. You're still hidden while you're in a Safe Zone" : 'Visible: you show up approximately (500 m)');
    } catch (e) { toast(e instanceof Error ? e.message : 'Could not change', 'err'); }
    finally { setBusy(false); }
  };
  return (
    <button title={hidden ? (zoneHidden ? 'Hidden by a Safe Zone · tap for Ghost' : 'Ghost · tap to be visible') : 'Visible (approximate) · tap for Ghost'}
      aria-label={hidden ? 'Ghost on, tap to be visible' : 'Visible, tap to go Ghost'} onClick={flip}
      className={cx(HEADER_ICON, !hidden && '!text-emerald-500 dark:!text-emerald-300', busy && 'opacity-50')}>
      {hidden ? <EyeOff className="w-[18px] h-[18px]" /> : <RadarRings className="w-[18px] h-[18px]" />}
    </button>
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
