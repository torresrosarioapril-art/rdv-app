import { CalendarHeart, ChevronRight, MapPin } from 'lucide-react';
import type { CalendarEvent } from '@/lib/api';
import { Card } from './ui';

export function whenLabel(iso: string) {
  const d = new Date(iso);
  const days = Math.round((new Date(d.toDateString()).getTime() - new Date(new Date().toDateString()).getTime()) / 86400000);
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  if (days === 0) return `Today · ${time}`;
  if (days === 1) return `Tomorrow · ${time}`;
  if (days < 7) return `${d.toLocaleDateString(undefined, { weekday: 'long' })} · ${time}`;
  return `${d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })} · ${time}`;
}

/** A date stays listed until 2 hours after it starts (it may be under way), then drops off. */
const DATE_LENGTH_MS = 2 * 3600 * 1000;
export const activeDates = (events: CalendarEvent[]) => events.filter((e) => new Date(e.starts_at).getTime() + DATE_LENGTH_MS > Date.now());

/** Slim banner under the header on every tab, only for a date in the next 24 hours. Tap it for Your dates. */
export function NextDateBanner({ events, onOpen }: { events: CalendarEvent[]; onOpen: () => void }) {
  const soon = activeDates(events).filter((e) => new Date(e.starts_at).getTime() - Date.now() <= 24 * 3600 * 1000);
  const next = soon[0];
  if (!next) return null;
  const started = new Date(next.starts_at).getTime() <= Date.now();
  return (
    <button onClick={onOpen} className="block w-full text-left bg-ink text-ivory-2 hover:bg-ink-2 dark:bg-gold/15 dark:text-inherit dark:hover:bg-gold/20 border-b border-gold/40 dark:border-gold/30 cursor-pointer">
      <div className="max-w-6xl mx-auto px-4 py-2 flex items-center gap-3 text-sm">
        <CalendarHeart className="w-4 h-4 text-gold shrink-0" />
        <span className="flex-1 min-w-0 truncate">
          <span className="font-medium">{next.title}</span>
          <span className="text-slate-300"> · {started ? 'Now' : whenLabel(next.starts_at)}</span>
          {next.venue_name && <span className="text-slate-400"> · {next.venue_name}</span>}
          {soon.length > 1 && <span className="text-slate-400"> · +{soon.length - 1} more</span>}
        </span>
        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
      </div>
    </button>
  );
}

/** "Your dates" at the top of the Chat tab. Tap a date to open it in its chat (change it, add to calendar). */
export function DatesList({ events, onOpenDate }: { events: CalendarEvent[]; onOpenDate: (e: CalendarEvent) => void }) {
  const upcoming = activeDates(events);
  if (upcoming.length === 0) return null;
  return (
    <div id="your-dates" className="scroll-mt-20">
    <Card className="!p-3 !border-gold/40">
      <div className="text-[11px] uppercase tracking-widest text-gold mb-2 flex items-center gap-1.5"><CalendarHeart className="w-3.5 h-3.5" />Your dates</div>
      <div className="space-y-2">
        {upcoming.map((e) => (
          <div key={e.id} role="button" tabIndex={0} onClick={() => onOpenDate(e)} onKeyDown={(k) => k.key === 'Enter' && onOpenDate(e)}
            className="rounded-xl bg-gold/10 hover:bg-gold/15 p-3 flex items-center gap-2 cursor-pointer">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{e.title}</div>
              <div className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">{whenLabel(e.starts_at)}</div>
              {e.map_url && <a onClick={(ev) => ev.stopPropagation()} className="text-xs text-gold inline-flex items-center gap-1 mt-1" href={e.map_url} target="_blank" rel="noreferrer"><MapPin className="w-3 h-3" />{e.venue_name}</a>}
            </div>
            <span className="text-[11px] text-slate-500 shrink-0 flex items-center">Details & change<ChevronRight className="w-4 h-4" /></span>
          </div>
        ))}
      </div>
    </Card>
    </div>
  );
}
