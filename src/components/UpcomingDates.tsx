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

/** Slim banner under the header: the next confirmed date, on every tab. */
export function NextDateBanner({ events, onOpen }: { events: CalendarEvent[]; onOpen: () => void }) {
  const next = events.find((e) => new Date(e.starts_at) > new Date());
  if (!next) return null;
  const more = events.filter((e) => new Date(e.starts_at) > new Date()).length - 1;
  return (
    <div className="bg-gold/15 border-b border-gold/30">
      <div className="max-w-6xl mx-auto px-4 py-2 flex items-center gap-3 text-sm">
        <CalendarHeart className="w-4 h-4 text-gold shrink-0" />
        <button onClick={onOpen} className="flex-1 min-w-0 text-left truncate cursor-pointer">
          <span className="font-medium">{next.title}</span>
          <span className="text-slate-600 dark:text-slate-300"> · {whenLabel(next.starts_at)}</span>
          {more > 0 && <span className="text-slate-500"> · +{more} more</span>}
        </button>
        {next.map_url && (
          <a href={next.map_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-gold text-xs shrink-0">
            <MapPin className="w-3.5 h-3.5" /><span className="hidden sm:inline max-w-40 truncate">{next.venue_name}</span>
          </a>
        )}
        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
      </div>
    </div>
  );
}

/** "Your dates" list shown at the top of the Chat tab. */
export function DatesList({ events }: { events: CalendarEvent[] }) {
  const upcoming = events.filter((e) => new Date(e.starts_at) > new Date());
  if (upcoming.length === 0) return null;
  return (
    <Card className="!p-3 !border-gold/40">
      <div className="text-[11px] uppercase tracking-widest text-gold mb-2 flex items-center gap-1.5"><CalendarHeart className="w-3.5 h-3.5" />Your dates</div>
      <div className="space-y-2">
        {upcoming.map((e) => (
          <div key={e.id} className="rounded-xl bg-gold/10 p-3">
            <div className="text-sm font-medium">{e.title}</div>
            <div className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">{whenLabel(e.starts_at)}</div>
            {e.map_url && <a className="text-xs text-gold flex items-center gap-1 mt-1" href={e.map_url} target="_blank" rel="noreferrer"><MapPin className="w-3 h-3" />{e.venue_name}</a>}
          </div>
        ))}
      </div>
    </Card>
  );
}
