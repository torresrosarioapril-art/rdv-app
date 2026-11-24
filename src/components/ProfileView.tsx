import { useEffect, useState } from 'react';
import { Briefcase, Flag, GraduationCap, Link2, MapPin, Ruler, ShieldCheck, Sparkles } from 'lucide-react';
import { signedUrl, type MemberCard } from '@/lib/api';
import { HABITS, KIDS, POLITICAL, RELOCATION, TIMELINE, labelOf } from '@/config/app';
import { Badge, Photo, cx } from './ui';

export function ScoreBadge({ score, band }: { score?: number; band?: string }) {
  if (score == null) return null;
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold',
      score >= 90 ? 'bg-gold text-navy' : score >= 75 ? 'bg-gold/20 text-gold border border-gold/40' : 'bg-white/10 text-slate-200 border border-white/15')}>
      <Sparkles className="w-3 h-3" />{score}% · {band}
    </span>
  );
}

/** Full member profile as other members see it. */
export function ProfileView({ m, compact }: { m: MemberCard; compact?: boolean }) {
  const [photo, setPhoto] = useState(0);
  const [voice, setVoice] = useState<string | null>(null);
  useEffect(() => { setPhoto(0); signedUrl('voice', m.voice_intro_path).then(setVoice); }, [m.id, m.voice_intro_path]);
  const answered = (m.prompts ?? []).filter((p) => p.answer?.trim());

  return (
    <div className="grid md:grid-cols-5 gap-5">
      <div className="md:col-span-2 space-y-2">
        <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-navy-3">
          <Photo path={m.photos?.[photo]} alt={m.name} className="w-full h-full" />
          <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/85 to-transparent text-white">
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-display">{m.name}{m.age ? `, ${m.age}` : ''}</h2>
              {m.verified && <ShieldCheck className="w-5 h-5 text-gold" />}
            </div>
            <div className="text-xs text-slate-200 flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3" />{[m.district, m.city].filter(Boolean).join(', ') || 'UAE'}
              {m.distance_km != null && <> · {m.distance_km} km away</>}
            </div>
            <div className="mt-2"><ScoreBadge score={m.score} band={m.band} /></div>
          </div>
        </div>
        {m.photos?.length > 1 && (
          <div className="flex gap-1.5">
            {m.photos.map((p, i) => (
              <button key={p} onClick={() => setPhoto(i)} className={cx('w-12 h-14 rounded-lg overflow-hidden border-2 cursor-pointer', i === photo ? 'border-gold' : 'border-transparent')}>
                <Photo path={p} alt="" className="w-full h-full" />
              </button>
            ))}
          </div>
        )}
        {voice && (
          <div className="rounded-xl border border-slate-200 dark:border-white/10 p-3">
            <div className="text-[11px] uppercase tracking-widest text-gold mb-1.5">Voice intro</div>
            <audio src={voice} controls className="w-full h-9" />
          </div>
        )}
      </div>

      <div className="md:col-span-3 space-y-4">
        {m.headline && <p className="font-display text-lg">{m.headline}</p>}
        <div className="flex flex-wrap gap-1.5 text-xs">
          {m.occupation && <Badge tone="slate"><Briefcase className="w-3 h-3" />{m.occupation}{m.company ? ` · ${m.company}` : ''}</Badge>}
          {(m.university || m.degree) && <Badge tone="slate"><GraduationCap className="w-3 h-3" />{[m.degree, m.university].filter(Boolean).join(', ')}</Badge>}
          {m.nationality && <Badge tone="slate"><Flag className="w-3 h-3" />{m.nationality}</Badge>}
          {m.height_cm && <Badge tone="slate"><Ruler className="w-3 h-3" />{m.height_cm} cm</Badge>}
          {m.linkedin_url && <a href={m.linkedin_url} target="_blank" rel="noreferrer"><Badge><Link2 className="w-3 h-3" />LinkedIn</Badge></a>}
        </div>
        {m.bio && <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300 whitespace-pre-line">{m.bio}</p>}

        <div className="grid grid-cols-2 gap-2 text-sm">
          <Fact k="Faith" v={[m.religion, m.religion_practice].filter(Boolean).join(' · ')} />
          <Fact k="Marriage" v={labelOf(TIMELINE, m.marriage_timeline)} />
          <Fact k="Children" v={labelOf(KIDS, m.kids)} />
          <Fact k="Relocation" v={labelOf(RELOCATION, m.relocation)} />
          <Fact k="Drinking" v={labelOf(HABITS, m.drinking)} />
          <Fact k="Smoking" v={labelOf(HABITS, m.smoking)} />
          {m.political && <Fact k="Outlook" v={labelOf(POLITICAL, m.political)} />}
          {m.zodiac?.sun && <Fact k="Zodiac" v={[m.zodiac.sun, m.zodiac.moon && `${m.zodiac.moon} moon`, m.zodiac.rising && `${m.zodiac.rising} rising`].filter(Boolean).join(' · ')} />}
        </div>

        {!compact && answered.map((p) => (
          <div key={p.key} className="rounded-xl bg-slate-50 dark:bg-navy-3 p-4">
            <div className="text-[11px] uppercase tracking-widest text-gold mb-1">{p.question}</div>
            <p className="text-sm whitespace-pre-line">{p.answer}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-xl bg-slate-50 dark:bg-navy-3 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{k}</div>
      <div className="text-sm">{v || '—'}</div>
    </div>
  );
}
