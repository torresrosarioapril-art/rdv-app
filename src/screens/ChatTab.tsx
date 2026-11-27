import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, CalendarCheck, CalendarPlus, Check, Clock, Hand, ImagePlus, MapPin, MessageCircle, Mic, Send, Trash2, X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  deleteMyMessage, suggestDateChange, getMyMatches, loadThread, markRead, respondInvitation, sendImage, sendInvitation, sendMessage, sendPing, sendVoice, signedUrl, uploadFile,
  type CalendarEvent, type Invitation, type MatchSummary, type Message, type Status,
} from '@/lib/api';
import { DatesList } from '@/components/UpcomingDates';
import { Button, Card, Empty, Field, Input, Modal, Photo, Spinner, cx, useToast } from '@/components/ui';
import { ProfileView } from '@/components/ProfileView';
import { SafetyMenu } from '@/components/SafetyMenu';
import { ScoreBadge } from '@/components/ProfileView';
import { Recorder } from '@/components/Recorder';
import { VenueSearch, type PickedPlace } from '@/components/VenueSearch';

const fmt = (d: string) => new Date(d).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
// Opens Google Maps on the place by name (e.g. "Eden House DIFC"), kept to the UAE
const mapUrl = (i: Invitation) => {
  const name = (i.venue_name ?? '').trim();
  const q = name ? (/(dubai|abu dhabi|sharjah|ajman|ras al|fujairah|umm al|uae|emirates)/i.test(name) ? name : `${name}, UAE`)
    : i.venue_lat != null && i.venue_lng != null ? `${i.venue_lat},${i.venue_lng}` : 'Dubai';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
};

/** Opens the .ics in a new tab, so after "Add to Calendar" the member just closes that tab and is back in the chat. */
function openIcs(ics: string) {
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
  const w = window.open(url, '_blank');
  if (!w) { const a = document.createElement('a'); a.href = url; a.download = 'rendez-vous.ics'; a.target = '_blank'; document.body.appendChild(a); a.click(); a.remove(); }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function calendarLinks(i: Invitation, partner: string) {
  const start = new Date(i.proposed_at);
  const end = new Date(start.getTime() + 2 * 3600 * 1000);
  const z = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const title = `Rendez-vous with ${partner}`;
  const google = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${z(start)}/${z(end)}&location=${encodeURIComponent(i.venue_name)}&details=${encodeURIComponent(mapUrl(i))}`;
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Rendez-vous//EN', 'BEGIN:VEVENT', `UID:${i.id}@rendezvous`, `DTSTAMP:${z(new Date())}`,
    `DTSTART:${z(start)}`, `DTEND:${z(end)}`, `SUMMARY:${title}`, `LOCATION:${i.venue_name}`, `DESCRIPTION:${mapUrl(i)}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  return { google, ics };
}

export default function ChatTab({ status, openMatch, setOpenMatch, onRead, events, onDatesChanged }: {
  status: Status; openMatch: string | null; setOpenMatch: (id: string | null) => void; onRead: () => void;
  events: CalendarEvent[]; onDatesChanged: () => void;
}) {
  const [matches, setMatches] = useState<MatchSummary[] | null>(null);
  const [focusInv, setFocusInv] = useState<string | null>(null);
  const [profileOf, setProfileOf] = useState<MatchSummary | null>(null);
  const [gender, setGender] = useState<string | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    try { setMatches(await getMyMatches()); } catch (e) { toast(e instanceof Error ? e.message : 'Could not load chats', 'err'); }
  }, [toast]);

  useEffect(() => {
    load();
    supabase.from('profiles').select('gender').eq('id', status.user_id).single().then(({ data }) => setGender(data?.gender ?? null));
    supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null)
      .in('type', ['message', 'ping', 'invitation', 'invitation_accepted', 'invitation_declined', 'invitation_countered', 'new_match', 'radar_connect', 'match_nudge', 'date_change']).then(() => onRead());
    const ch = supabase.channel('matches-' + status.user_id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${status.user_id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load, status.user_id, onRead]);

  if (!matches) return <Spinner label="Loading conversations…" />;
  const active = matches.find((m) => m.match_id === openMatch) ?? null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:h-[calc(100vh-8rem)]">
      <div className={cx('md:col-span-1 space-y-2 overflow-y-auto', active && 'hidden md:block')}>
        <h1 className="text-2xl font-display mb-2">Your <span className="italic text-gold">conversations</span></h1>
        <DatesList events={events} onOpenDate={(e) => { if (e.match_id) { setFocusInv(e.invitation_id); setOpenMatch(e.match_id); } }} />
        {matches.length === 0 && (
          <Card><Empty icon={<MessageCircle className="w-5 h-5" />} title="No conversations yet">When you and someone are both interested, or you connect from the radar, your chat appears here.</Empty></Card>
        )}
        {matches.map((m) => (
          <button key={m.match_id} onClick={() => setOpenMatch(m.match_id)} className="w-full text-left cursor-pointer">
            <Card className={cx('!p-3 flex items-center gap-3', m.match_id === openMatch && '!border-gold/60')}>
              {/* Tap the photo for their profile; the rest of the row opens the chat */}
              <span role="button" tabIndex={0} aria-label={`View ${m.partner.name}'s profile`}
                onClick={(e) => { e.stopPropagation(); setProfileOf(m); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); setProfileOf(m); } }}
                className="shrink-0 rounded-full ring-2 ring-gold/60 hover:ring-gold cursor-pointer">
                <Photo path={m.partner.photos?.[0]} alt={m.partner.name} className="w-12 h-12 rounded-full" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between gap-2">
                  <span className="font-medium truncate">{m.partner.name}{m.score != null && <span className="ml-1.5 text-[11px] text-gold-deep dark:text-gold font-semibold">{m.score}% match</span>}</span>
                  {m.last_message && <span className="text-[10px] text-slate-500 shrink-0">{new Date(m.last_message.at).toLocaleDateString()}</span>}
                </div>
                <div className="text-xs text-slate-500 truncate">
                  {m.last_message ? preview(m.last_message) : m.source === 'radar' ? 'Connected on the radar' : 'New match. Say hello.'}
                </div>
              </div>
              {m.unread > 0 && <span className="rounded-full bg-gold text-navy text-[10px] px-1.5 py-0.5">{m.unread}</span>}
            </Card>
          </button>
        ))}
      </div>
      <div className={cx('md:col-span-2', !active && 'hidden md:block')}>
        {active ? <Thread key={active.match_id} focusInv={focusInv} onFocused={() => setFocusInv(null)} m={active} me={status.user_id} gender={gender} onBack={() => setOpenMatch(null)} onChanged={() => { load(); onDatesChanged(); }} />
          : <Card className="h-full flex items-center justify-center"><Empty icon={<MessageCircle className="w-5 h-5" />} title="Choose a conversation" /></Card>}
      </div>
      <Modal open={!!profileOf} onClose={() => setProfileOf(null)} wide>
        {profileOf && (
          <>
            <ProfileView m={{ ...profileOf.partner, score: profileOf.score ?? undefined, band: profileOf.band ?? undefined }} />
            <div className="sticky bottom-0 pt-3 mt-3 bg-white dark:bg-navy-2">
              <Button className="w-full" onClick={() => { const id = profileOf.match_id; setProfileOf(null); setOpenMatch(id); }}><MessageCircle className="w-4 h-4" />Open chat</Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}

function preview(l: NonNullable<MatchSummary['last_message']>) {
  const who = l.mine ? 'You: ' : '';
  if ((l as any).deleted) return who + 'Message deleted';
  if (l.kind === 'voice') return who + 'Voice note';
  if (l.kind === 'image') return who + 'Photo';
  if (l.kind === 'ping') return who + 'Sent a Ping';
  if (l.kind === 'invitation') return who + 'Sent an invitation';
  return who + (l.body ?? '');
}

function Thread({ m, me, gender, onBack, onChanged, focusInv, onFocused }: {
  m: MatchSummary; me: string; gender: string | null; onBack: () => void; onChanged: () => void;
  focusInv?: string | null; onFocused?: () => void;
}) {
  const toast = useToast();
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [invs, setInvs] = useState<Invitation[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const bottom = useRef<HTMLDivElement | null>(null);
  const partner = m.partner;

  const reload = useCallback(async () => {
    const t = await loadThread(m.match_id);
    setMsgs(t.messages); setInvs(t.invitations);
    markRead(m.match_id).catch(() => {});
  }, [m.match_id]);

  useEffect(() => {
    reload();
    const ch = supabase.channel('thread-' + m.match_id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `match_id=eq.${m.match_id}` }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invitations', filter: `match_id=eq.${m.match_id}` }, reload)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [m.match_id, reload]);

  useEffect(() => {
    // Opened from Your dates: jump to that date's card (or its latest change) instead of the bottom
    if (focusInv && invs.length) {
      const target = [...invs].reverse().find((i) => i.change_of === focusInv && i.status === 'accepted')?.id ?? focusInv;
      const el = document.getElementById(`inv-${target}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-gold');
        setTimeout(() => el.classList.remove('ring-2', 'ring-gold'), 2500);
        onFocused?.();
        return;
      }
    }
    bottom.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs.length, invs, focusInv]); // eslint-disable-line react-hooks/exhaustive-deps

  const invById = useMemo(() => new Map(invs.map((i) => [i.id, i])), [invs]);
  const hasPending = invs.some((i) => i.status === 'pending');
  const used = invs.filter((i) => i.from_id === me && !i.counter_of && !i.change_of).length;
  const talked = msgs.some((x) => x.sender_id && (x.kind === 'text' || x.kind === 'voice' || x.kind === 'image'));
  const inputRef = useRef<HTMLInputElement>(null);
  const pickPrompt = (q: string) => {
    const v = `About your "${q}": `;
    setText(v);
    requestAnimationFrame(() => { const el = inputRef.current; if (el) { el.focus(); el.setSelectionRange(v.length, v.length); } });
  };
  const prompts = (partner.prompts ?? []).filter((p) => p.answer?.trim());

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    try { await sendMessage(m.match_id, text.trim()); setText(''); await reload(); onChanged(); }
    catch (err) { toast(err instanceof Error ? err.message : 'Not sent', 'err'); }
    finally { setSending(false); }
  };

  const act = async (fn: () => Promise<unknown>, ok?: string) => {
    try { await fn(); if (ok) toast(ok); await reload(); onChanged(); }
    catch (err) { toast(err instanceof Error ? err.message : 'Something went wrong', 'err'); }
  };

  return (
    <Card className="!p-0 flex flex-col overflow-hidden fixed inset-x-0 top-14 bottom-[calc(3.6rem+env(safe-area-inset-bottom))] z-30 rounded-none border-x-0 md:static md:inset-auto md:z-auto md:h-full md:rounded-2xl md:border-x">
      <div className="flex items-center gap-2 sm:gap-3 px-2.5 py-2 sm:p-3 border-b border-slate-200 dark:border-white/10">
        <button onClick={onBack} className="md:hidden p-1 shrink-0 cursor-pointer"><ArrowLeft className="w-5 h-5" /></button>
        <button onClick={() => setProfileOpen(true)} className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 text-left cursor-pointer">
          <Photo path={partner.photos?.[0]} alt={partner.name} className="w-9 h-9 sm:w-10 sm:h-10 rounded-full shrink-0 ring-2 ring-gold/60" />
          <div className="min-w-0 flex-1">
            <div className="font-medium truncate">{partner.name}{partner.age ? `, ${partner.age}` : ''}</div>
            <div className="text-[11px] text-slate-500 truncate">{partner.occupation} · tap for profile</div>
          </div>
          {m.score != null && <>
            <span className="sm:hidden shrink-0"><ScoreBadge score={m.score} compact /></span>
            <span className="hidden sm:inline-flex shrink-0"><ScoreBadge score={m.score} band={m.band ?? undefined} /></span>
          </>}
        </button>
        <SafetyMenu memberId={partner.id} name={partner.name} onDone={() => { onBack(); onChanged(); }} />
      </div>

      <div className="flex-1 overflow-y-auto p-2.5 sm:p-4 space-y-2 sm:space-y-3">
        {!talked && prompts.length > 0 && (
          <div className="rounded-xl border border-gold/30 bg-gold/5 p-2.5">
            <div className="text-[10px] uppercase tracking-widest text-gold mb-1.5">Start with one of {partner.name}'s prompts</div>
            <div className="space-y-1.5">
              {prompts.slice(0, 3).map((p) => (
                <button key={p.key} onClick={() => pickPrompt(p.question)}
                  className="block w-full text-left rounded-lg bg-white/80 dark:bg-navy-3 px-2.5 py-2 cursor-pointer hover:ring-1 hover:ring-gold/50">
                  <span className="block text-[10px] text-slate-500 truncate">{p.question}</span>
                  <span className="block text-xs leading-snug line-clamp-2">{p.answer}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((x) => (
          <Bubble key={x.id} x={x} mine={x.sender_id === me} inv={x.invitation_id ? invById.get(x.invitation_id) : undefined} invs={invs}
            me={me} partnerName={partner.name} partnerId={partner.id} act={act} />
        ))}
        <div ref={bottom} />
      </div>

      <div className="border-t border-slate-200 dark:border-white/10 p-2 sm:p-3 space-y-2">
        <div className="flex flex-wrap gap-1.5 empty:hidden">
          {gender === 'woman' && m.source !== 'radar' && (
            <Button variant="outline" className="!py-1.5 text-xs" onClick={() => act(() => sendPing(m.match_id), 'Ping sent')}><Hand className="w-3.5 h-3.5" />Ping: I'd like to meet</Button>
          )}
          {gender === 'man' && (
            <Button variant="outline" className="!py-1.5 text-xs" disabled={hasPending || used >= m.invitation_cap} onClick={() => setInviteOpen(true)}>
              <CalendarPlus className="w-3.5 h-3.5" />Invite to a date ({used}/{m.invitation_cap})
            </Button>
          )}
        </div>
        <form onSubmit={send} className="flex items-end gap-1.5 sm:gap-2">
          <Input ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} placeholder="Message…" maxLength={4000} className="flex-1 min-w-0 !py-2" />
          <PhotoButton matchId={m.match_id} me={me} onSent={async () => { await reload(); onChanged(); }} />
          <VoiceButton matchId={m.match_id} onSent={async () => { await reload(); onChanged(); }} />
          <Button type="submit" busy={sending} className="!px-2.5 sm:!px-3"><Send className="w-4 h-4" /></Button>
        </form>
      </div>

      <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} onSend={async (at, venue, lat, lng, venueId) => {
        await act(() => sendInvitation(m.match_id, at, venue, lat, lng, venueId), 'Invitation sent');
        setInviteOpen(false);
      }} />
      <Modal open={profileOpen} onClose={() => setProfileOpen(false)} wide><ProfileView m={{ ...partner, score: m.score ?? undefined, band: m.band ?? undefined }} /></Modal>
    </Card>
  );
}

function VoiceButton({ matchId, onSent }: { matchId: string; onSent: () => void }) {
  const [open, setOpen] = useState(false);
  const toast = useToast();
  return (
    <>
      <Button type="button" variant="outline" className="!px-2.5 sm:!px-3" onClick={() => setOpen(true)} title="Voice note"><Mic className="w-4 h-4" /></Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Voice note">
        <p className="text-sm text-slate-500 mb-3">Up to 2 minutes. It sends when you stop recording.</p>
        <Recorder kind="audio" maxSeconds={120} label="Start recording" onDone={async (blob, secs, ext) => {
          try { const path = await uploadFile('voice', blob, ext); await sendVoice(matchId, path, secs); setOpen(false); onSent(); }
          catch (e) { toast(e instanceof Error ? e.message : 'Not sent', 'err'); }
        }} />
      </Modal>
    </>
  );
}

function PhotoButton({ matchId, me, onSent }: { matchId: string; me: string; onSent: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.currentTarget.files ?? []).slice(0, 4);
    e.currentTarget.value = '';
    if (!files.length) return;
    setBusy(true);
    toast(files.length > 1 ? `Sending ${files.length} photos…` : 'Sending photo…');
    try {
      for (const f of files) {
        if (f.size > 10 * 1024 * 1024) { toast('A photo is over 10 MB and was skipped', 'err'); continue; }
        await sendImage(matchId, me, f);
      }
      onSent();
    } catch (err) { toast(err instanceof Error ? err.message : 'Photo not sent', 'err'); }
    finally { setBusy(false); }
  };
  return (
    // A label wraps the hidden file input, so only this button opens the photo picker (on iPhone the
    // invisible input used to spill over the voice button next to it)
    <label title="Send a photo" aria-label="Send a photo"
      className={cx('shrink-0 inline-flex items-center justify-center rounded-xl border border-slate-300 dark:border-white/15 px-2.5 sm:px-3 py-2.5 cursor-pointer hover:border-gold', busy && 'opacity-50 pointer-events-none')}>
      <ImagePlus className="w-4 h-4" />
      <input type="file" accept="image/*" multiple disabled={busy} onChange={pick} className="sr-only" />
    </label>
  );
}

function ChatImage({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => { signedUrl('chat', path).then(setUrl); }, [path]);
  if (!url) return <div className="w-48 h-48 rounded-xl bg-black/10 animate-pulse" />;
  return (
    <>
      <button onClick={() => setOpen(true)} className="block cursor-pointer"><img src={url} alt="Photo" className="max-w-[180px] sm:max-w-[220px] max-h-60 sm:max-h-72 rounded-xl object-cover" /></button>
      {open && (
        <div className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <img src={url} alt="Photo" className="max-w-full max-h-full rounded-xl" />
        </div>
      )}
    </>
  );
}

function VoiceNote({ path, seconds }: { path: string; seconds: number | null }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { signedUrl('voice', path).then(setUrl); }, [path]);
  return url ? <audio src={url} controls className="h-9 max-w-[200px] sm:max-w-[240px]" /> : <span className="text-xs">Voice note {seconds ? `· ${seconds}s` : ''}</span>;
}

function Bubble({ x, mine, inv, invs, me, partnerName, partnerId, act }: {
  x: Message; mine: boolean; inv?: Invitation; invs: Invitation[]; me: string; partnerName: string; partnerId: string;
  act: (fn: () => Promise<unknown>, ok?: string) => Promise<void>;
}) {
  if (x.kind === 'system') {
    return <div className="text-center text-[11px] text-slate-500 py-1">{x.body} · {fmt(x.created_at)}</div>;
  }
  if (x.kind === 'ping') {
    return (
      <div className={cx('flex', mine ? 'justify-end' : 'justify-start')}>
        <div className="rounded-2xl border border-ink bg-ink text-ivory-2 dark:border-ivory-2 dark:bg-ivory-2 dark:text-navy px-3 py-2 sm:px-4 sm:py-2.5 text-[13px] sm:text-sm flex items-center gap-2">
          <Hand className="w-4 h-4 text-gold" />{mine ? 'You sent a Ping: you would like to meet' : `${partnerName} would like to meet`}
        </div>
      </div>
    );
  }
  if (x.kind === 'invitation' && inv) return <InvitationCard inv={inv} invs={invs} me={me} partnerName={partnerName} act={act} />;
  return <TextBubble x={x} mine={mine} partnerName={partnerName} partnerId={partnerId} act={act} />;
}

/** Text, photo or voice note. Tap your own message to delete it (both people then see "Message deleted"). */
function TextBubble({ x, mine, partnerName, partnerId, act }: {
  x: Message; mine: boolean; partnerName: string; partnerId: string;
  act: (fn: () => Promise<unknown>, ok?: string) => Promise<void>;
}) {
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const deleted = !!x.deleted_at;
  const canDelete = mine && !deleted && !x.is_hidden;
  const what = x.kind === 'voice' ? 'voice note' : x.kind === 'image' ? 'photo' : 'message';
  return (
    <div className={cx('flex flex-col', mine ? 'items-end' : 'items-start')}>
    <div className={cx('flex group w-full', mine ? 'justify-end' : 'justify-start')}>
      <div onClick={() => canDelete && setMenu((v) => !v)}
        className={cx('max-w-[82%] sm:max-w-[78%] rounded-2xl px-3 py-2 sm:px-4 sm:py-2.5 text-[13px] sm:text-sm', canDelete && 'cursor-pointer',
          deleted ? 'border border-dashed border-slate-300 dark:border-white/15 text-slate-500' : mine ? 'bg-gold text-navy rounded-br-md shadow-sm' : 'bg-white border border-gold/50 dark:bg-navy-2 dark:border-gold/40 rounded-bl-md')}>
        {deleted ? <i>{mine ? 'You deleted this message' : 'Message deleted'}</i>
          : x.is_hidden ? <i className="opacity-70">Hidden pending review</i>
          : x.kind === 'image' && x.image_path ? <><ChatImage path={x.image_path} />{x.body && <span className="block mt-1 whitespace-pre-wrap">{x.body}</span>}</>
          : x.kind === 'voice' && x.voice_path ? <VoiceNote path={x.voice_path} seconds={x.voice_seconds} /> : <span className="whitespace-pre-wrap">{x.body}</span>}
        <div className={cx('text-[10px] mt-1', mine && !deleted ? 'text-navy/60' : 'text-slate-500')}>{new Date(x.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}{mine && x.read_at ? ' · Read' : ''}</div>
      </div>
      {!mine && !x.is_hidden && !deleted && (
        <div className="self-center ml-0.5 opacity-60 sm:opacity-0 sm:group-hover:opacity-100 transition">
          <SafetyMenu compact memberId={partnerId} name={partnerName} target={x.kind === 'voice' ? 'voice' : x.kind === 'image' ? 'image' : 'message'} refId={x.id} />
        </div>
      )}
    </div>
      {menu && canDelete && (
        <button onClick={() => { setMenu(false); setConfirm(true); }}
          className="mt-1 flex items-center gap-1 rounded-full border border-rose-300/60 text-rose-500 px-2.5 py-1 text-[11px] cursor-pointer hover:bg-rose-500/10">
          <Trash2 className="w-3.5 h-3.5" />Delete {what}
        </button>
      )}
      <Modal open={confirm} onClose={() => setConfirm(false)} title={`Delete this ${what}?`}>
        <p className="text-sm text-slate-500 mb-4">It's removed for both of you. {partnerName} will see "Message deleted". This can't be undone.</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirm(false)}>Keep</Button>
          <Button variant="danger" onClick={async () => { setConfirm(false); await act(() => deleteMyMessage(x.id), 'Deleted'); }}><Trash2 className="w-4 h-4" />Delete</Button>
        </div>
      </Modal>
    </div>
  );
}

function InvitationCard({ inv, invs, me, partnerName, act }: {
  inv: Invitation; invs: Invitation[]; me: string; partnerName: string; act: (fn: () => Promise<unknown>, ok?: string) => Promise<void>;
}) {
  const mine = inv.from_id === me;
  const isChange = !!inv.change_of;
  const replaced = inv.status === 'cancelled' && invs.some((i) => i.change_of === inv.id && i.status === 'accepted');
  const changePending = invs.some((i) => i.change_of === inv.id && i.status === 'pending');
  const upcoming = new Date(inv.proposed_at).getTime() > Date.now();
  const [changeOpen, setChangeOpen] = useState(false);
  const [counterOpen, setCounterOpen] = useState(false);
  const [counterAt, setCounterAt] = useState(toLocalInput(new Date(inv.proposed_at)));
  const [counterPlace, setCounterPlace] = useState<PickedPlace | null>(null);
  const cal = calendarLinks(inv, partnerName);
  const statusText: Record<Invitation['status'], string> = {
    pending: mine ? 'Waiting for an answer' : 'Waiting for your answer',
    accepted: 'Confirmed', declined: 'Declined', countered: 'New time suggested', cancelled: replaced ? 'Changed (see below)' : 'Cancelled',
  };

  return (
    <div className={cx('flex', mine ? 'justify-end' : 'justify-start')}>
      <div id={`inv-${inv.id}`} className={cx('w-full max-w-sm rounded-2xl border p-3 sm:p-4 space-y-2 transition', inv.status === 'accepted' ? 'border-emerald-400/50 bg-emerald-500/5' : 'border-gold/40 bg-gold/5')}>
        <div className="flex items-center justify-between text-[11px] uppercase tracking-widest">
          <span className="text-gold">{isChange ? 'Suggested change' : inv.counter_of ? 'Suggested time' : 'Invitation'}{mine ? ' (sent)' : ''}</span>
          <span className={inv.status === 'accepted' ? 'text-emerald-500' : 'text-slate-500'}>{statusText[inv.status]}</span>
        </div>
        <div className="flex items-center gap-2 text-sm font-medium"><Clock className="w-4 h-4 text-gold" />{fmt(inv.proposed_at)}</div>
        <a href={mapUrl(inv)} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm hover:text-gold"><MapPin className="w-4 h-4 text-gold" />{inv.venue_name}</a>

        {!mine && inv.status === 'pending' && (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button className="!py-1.5 text-xs" onClick={() => act(() => respondInvitation(inv.id, 'accept'), 'Date confirmed')}><Check className="w-3.5 h-3.5" />Accept</Button>
            <Button variant="outline" className="!py-1.5 text-xs" onClick={() => act(() => respondInvitation(inv.id, 'decline'))}><X className="w-3.5 h-3.5" />Decline</Button>
            {!inv.counter_of && !isChange && <Button variant="ghost" className="!py-1.5 text-xs" onClick={() => setCounterOpen(true)}>Suggest another time or place</Button>}
          </div>
        )}
        {inv.status === 'accepted' && (
          <div className="flex flex-wrap gap-2 pt-1">
            <a href={cal.google} target="_blank" rel="noreferrer"><Button variant="outline" className="!py-1.5 text-xs"><CalendarCheck className="w-3.5 h-3.5" />Google Calendar</Button></a>
            <Button variant="outline" className="!py-1.5 text-xs" onClick={() => openIcs(cal.ics)}><CalendarPlus className="w-3.5 h-3.5" />Apple / Outlook</Button>
            {upcoming && !changePending && <Button variant="ghost" className="!py-1.5 text-xs" onClick={() => setChangeOpen(true)}>Suggest a change</Button>}
          </div>
        )}
        {inv.status === 'accepted' && changePending && <p className="text-[11px] text-slate-500">A change is waiting for an answer below.</p>}
        <ChangeModal open={changeOpen} onClose={() => setChangeOpen(false)} inv={inv} partnerName={partnerName}
          onSend={(at, place) => act(() => suggestDateChange(inv.id, at, place), 'Change suggested')} />

        <Modal open={counterOpen} onClose={() => setCounterOpen(false)} title="Suggest another time or place">
          <div className="space-y-4">
            <p className="text-sm text-slate-500">You can suggest one change: a new time, a new place, or both. {partnerName} then accepts or declines.</p>
            <Field label="Date & time"><Input type="datetime-local" value={counterAt} min={toLocalInput(new Date(Date.now() + 3600000))} onChange={(e) => setCounterAt(e.target.value)} /></Field>
            <VenueSearch value={counterPlace} onChange={setCounterPlace} />
            <p className="text-[11px] text-slate-500 -mt-2">Leave the place empty to keep {inv.venue_name}.</p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setCounterOpen(false)}>Cancel</Button>
              <Button onClick={async () => {
                const timeChanged = new Date(counterAt).getTime() !== new Date(inv.proposed_at).getTime();
                const place = counterPlace?.name?.trim() ? { name: counterPlace.name.trim(), lat: counterPlace.lat ?? null, lng: counterPlace.lng ?? null, venueId: counterPlace.venueId ?? null } : null;
                await act(() => respondInvitation(inv.id, 'counter', timeChanged ? new Date(counterAt) : null, place), place && timeChanged ? 'New time and place suggested' : place ? 'New place suggested' : 'New time suggested');
                setCounterOpen(false);
              }}>Suggest</Button>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
}

function ChangeModal({ open, onClose, inv, partnerName, onSend }: {
  open: boolean; onClose: () => void; inv: Invitation; partnerName: string;
  onSend: (at: Date | null, place: { name: string; lat: number | null; lng: number | null; venueId: string | null } | null) => Promise<void>;
}) {
  const [at, setAt] = useState(toLocalInput(new Date(inv.proposed_at)));
  const [place, setPlace] = useState<PickedPlace | null>(null);
  return (
    <Modal open={open} onClose={onClose} title="Suggest a change">
      <div className="space-y-4">
        <p className="text-sm text-slate-500">Change the time, the place, or both. Your date stays as it is until {partnerName} accepts; your calendars update when they do.</p>
        <Field label="Date & time"><Input type="datetime-local" value={at} min={toLocalInput(new Date(Date.now() + 3600000))} onChange={(e) => setAt(e.target.value)} /></Field>
        <VenueSearch value={place} onChange={setPlace} />
        <p className="text-[11px] text-slate-500 -mt-2">Leave the place empty to keep {inv.venue_name}.</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={async () => {
            const changed = new Date(at).getTime() !== new Date(inv.proposed_at).getTime();
            const p = place?.name?.trim() ? { name: place.name.trim(), lat: place.lat ?? null, lng: place.lng ?? null, venueId: place.venueId ?? null } : null;
            await onSend(changed ? new Date(at) : null, p);
            onClose();
          }}>Send suggestion</Button>
        </div>
      </div>
    </Modal>
  );
}

function InviteModal({ open, onClose, onSend }: {
  open: boolean; onClose: () => void;
  onSend: (at: Date, venue: string, lat?: number | null, lng?: number | null, venueId?: string | null) => Promise<void>;
}) {
  const [at, setAt] = useState(toLocalInput(new Date(Date.now() + 2 * 86400000)));
  const [place, setPlace] = useState<PickedPlace | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <Modal open={open} onClose={onClose} title="Invite to a date">
      <div className="space-y-4">
        <Field label="Date & time"><Input type="datetime-local" value={at} min={toLocalInput(new Date(Date.now() + 3600000))} onChange={(e) => setAt(e.target.value)} /></Field>
        <VenueSearch value={place} onChange={setPlace} />
        <p className="text-xs text-slate-500">Once she accepts, you both get the date in your RDV calendar with options to add it to Google, Apple or Outlook.</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button busy={busy} disabled={!place?.name.trim()} onClick={async () => {
            if (!place) return;
            setBusy(true); await onSend(new Date(at), place.name.trim(), place.lat, place.lng, place.venueId); setBusy(false);
          }}>
            <CalendarPlus className="w-4 h-4" />Send invitation
          </Button>
        </div>
      </div>
    </Modal>
  );
}


