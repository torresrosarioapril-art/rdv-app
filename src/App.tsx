import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Compass, Heart, MessageCircle, Moon, SlidersHorizontal, Sun, UserRound, Crown } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { myStatus, type Status } from '@/lib/api';
import { BRAND } from '@/config/app';
import { ToastProvider, Spinner, cx } from '@/components/ui';
import AuthScreen from '@/screens/AuthScreen';
import SetupWizard from '@/screens/SetupWizard';
import PendingScreen from '@/screens/PendingScreen';
import MatchesTab from '@/screens/MatchesTab';
import RadarTab from '@/screens/RadarTab';
import ChatTab from '@/screens/ChatTab';
import ProfileTab from '@/screens/ProfileTab';

export type Tab = 'radar' | 'matches' | 'chat' | 'profile';

function useTheme() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
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
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [status, setStatus] = useState<Status | null>(null);
  const [editing, setEditing] = useState(false);
  const { theme, toggle } = useTheme();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const refresh = useCallback(async () => {
    try { setStatus(await myStatus()); } catch { setStatus(null); }
  }, []);

  useEffect(() => {
    if (session) refresh(); else setStatus(null);
  }, [session, refresh]);

  // Payment return (?checkout=success) → refresh plan
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('checkout')) {
      window.history.replaceState({}, '', window.location.pathname);
      setTimeout(refresh, 2500);
    }
  }, [refresh]);

  if (session === undefined) return <Spinner label="Opening Rendez-vous…" />;
  if (!session) return <AuthScreen />;
  if (!status) return <Spinner label="Loading your membership…" />;

  if (status.is_suspended) {
    return (
      <PendingScreen status={status} onRefresh={refresh} suspended />
    );
  }
  if (editing || status.verification_status === 'incomplete' || status.verification_status === 'rejected') {
    return <SetupWizard status={status} onDone={() => { setEditing(false); refresh(); }} onCancel={status.verification_status === 'approved' || status.verification_status === 'pending' ? () => setEditing(false) : undefined} />;
  }
  if (status.verification_status === 'pending') {
    return <PendingScreen status={status} onRefresh={refresh} onEdit={() => setEditing(true)} />;
  }
  return <Shell status={status} refresh={refresh} theme={theme} toggleTheme={toggle} onEditProfile={() => setEditing(true)} />;
}

function Shell({ status, refresh, theme, toggleTheme, onEditProfile }: {
  status: Status; refresh: () => Promise<void>; theme: 'dark' | 'light'; toggleTheme: () => void; onEditProfile: () => void;
}) {
  const [tab, setTab] = useState<Tab>('matches');
  const [openMatch, setOpenMatch] = useState<string | null>(null);
  const [radarFilters, setRadarFilters] = useState(false);
  const [unread, setUnread] = useState(0);

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
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${status.user_id}` }, load)
      .subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, [status.user_id]);

  const openChat = (matchId: string) => { setOpenMatch(matchId); setTab('chat'); };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'radar', label: 'Radar', icon: <Compass className="w-5 h-5" /> },
    { id: 'matches', label: 'Matches', icon: <Heart className="w-5 h-5" /> },
    { id: 'chat', label: 'Chat', icon: <MessageCircle className="w-5 h-5" /> },
    { id: 'profile', label: 'Profile', icon: <UserRound className="w-5 h-5" /> },
  ];

  return (
    <div className="min-h-screen pb-20 sm:pb-0">
      <header className="sticky top-0 z-40 backdrop-blur bg-ivory/85 dark:bg-navy/85 border-b border-slate-200 dark:border-white/10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <button onClick={() => setTab('matches')} className="flex items-center gap-2 cursor-pointer">
            <img src={BRAND.logo} alt="" className="w-8 h-8 rounded-full" />
            <span className="font-display text-lg tracking-wide">{BRAND.name}</span>
          </button>
          <nav className="hidden sm:flex items-center gap-1">
            {tabs.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} className={cx('relative flex items-center gap-2 px-3 py-2 rounded-xl text-sm cursor-pointer',
                tab === t.id ? 'bg-gold/15 text-gold' : 'text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5')}>
                {t.icon}{t.label}
                {t.id === 'chat' && unread > 0 && <span className="ml-1 rounded-full bg-gold text-navy text-[10px] px-1.5">{unread}</span>}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-1">
            <button title="Radar filters" onClick={() => { setTab('radar'); setRadarFilters(true); }} className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"><SlidersHorizontal className="w-4.5 h-4.5" /></button>
            <button title="Theme" onClick={toggleTheme} className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer">
              {theme === 'dark' ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
            </button>
            <button title="Plan" onClick={() => setTab('profile')} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gold/40 text-gold text-xs cursor-pointer">
              <Crown className="w-3.5 h-3.5" />{status.limits.label}{status.in_trial ? ' · trial' : ''}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {tab === 'matches' && <MatchesTab status={status} onOpenChat={openChat} />}
        {tab === 'radar' && <RadarTab status={status} refreshStatus={refresh} onOpenChat={openChat} filtersOpen={radarFilters} setFiltersOpen={setRadarFilters} />}
        {tab === 'chat' && <ChatTab status={status} openMatch={openMatch} setOpenMatch={setOpenMatch} onRead={() => setUnread(0)} />}
        {tab === 'profile' && <ProfileTab status={status} refresh={refresh} onEditProfile={onEditProfile} />}
      </main>

      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-navy-2/95 backdrop-blur border-t border-slate-200 dark:border-white/10 grid grid-cols-4 pb-[env(safe-area-inset-bottom)]">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={cx('relative flex flex-col items-center gap-0.5 py-2.5 text-[11px] cursor-pointer', tab === t.id ? 'text-gold' : 'text-slate-500')}>
            {t.icon}{t.label}
            {t.id === 'chat' && unread > 0 && <span className="absolute top-1.5 right-[30%] w-2 h-2 rounded-full bg-gold" />}
          </button>
        ))}
      </nav>
    </div>
  );
}
