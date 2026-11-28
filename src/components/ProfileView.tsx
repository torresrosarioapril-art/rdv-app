import { useEffect, useRef, useState } from 'react';
import { Briefcase, ChevronLeft, ChevronRight, Flag, GraduationCap, Heart, Link2, MapPin, Ruler, ShieldCheck, Star } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { signedUrl, type MemberCard } from '@/lib/api';
import { HABITS, KIDS, MARITAL_STATUS, POLITICAL, RELOCATION, TIMELINE, labelOf } from '@/config/app';
import { Badge, Photo, cx } from './ui';

export function ScoreBadge({ score, band, compact, onDark }: { score?: number; band?: string; compact?: boolean; onDark?: boolean }) {
  if (score == null) return null;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border border-gold/60 bg-gold/10 ${onDark ? 'text-gold bg-navy/40 backdrop-blur-sm' : 'text-gold-deep dark:text-gold'} px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap`}>
      {score}% match{!compact && band ? <span className="font-normal opacity-80"> · {band}</span> : null}
    </span>
  );
}

/** Full member profile as other members see it. */
export function ProfileView({ m, compact, self, preview, noPhotos }: { m: MemberCard; compact?: boolean; self?: boolean; preview?: boolean; noPhotos?: boolean }) {
  const [photo, setPhoto] = useState(0);
  const [voice, setVoice] = useState<string | null>(null);
  useEffect(() => { setPhoto(0); signedUrl('voice', m.voice_intro_path).then(setVoice); }, [m.id, m.voice_intro_path]);
  const answered = (m.prompts ?? []).filter((p) => p.answer?.trim());
  const count = m.photos?.length ?? 0;
  const swipeX = useRef<number | null>(null);
  const go = (d: number) => count > 1 && setPhoto((i) => (i + d + count) % count);

  return (
    <div className={cx('grid grid-cols-1 gap-5', !noPhotos && 'md:grid-cols-5')}>
      {!noPhotos && <div className="md:col-span-2 space-y-2">
        <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-navy-3 select-none touch-pan-y"
          onTouchStart={(e) => { swipeX.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => {
            if (swipeX.current == null) return;
            const dx = e.changedTouches[0].clientX - swipeX.current; swipeX.current = null;
            if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
          }}>
          <Photo path={m.photos?.[photo]} alt={m.name} className="w-full h-full" />
          {count > 1 && (
            <>
              {/* tap the left or right side to move between photos */}
              <button aria-label="Previous photo" onClick={() => go(-1)} className="absolute inset-y-0 left-0 w-1/3 flex items-center justify-start pl-2 cursor-pointer group/prev">
                <span className="w-8 h-8 rounded-full bg-black/35 text-white flex items-center justify-center opacity-70 group-hover/prev:opacity-100"><ChevronLeft className="w-5 h-5" /></span>
              </button>
              <button aria-label="Next photo" onClick={() => go(1)} className="absolute inset-y-0 right-0 w-1/3 flex items-center justify-end pr-2 cursor-pointer group/next">
                <span className="w-8 h-8 rounded-full bg-black/35 text-white flex items-center justify-center opacity-70 group-hover/next:opacity-100"><ChevronRight className="w-5 h-5" /></span>
              </button>
              <div className="absolute top-2 inset-x-3 flex gap-1">
                {m.photos.map((p, i) => <span key={p} className={cx('h-1 flex-1 rounded-full', i === photo ? 'bg-white' : 'bg-white/40')} />)}
              </div>
            </>
          )}
          <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/85 to-transparent text-white">
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-display">{m.name}{m.age ? `, ${m.age}` : ''}</h2>
              {m.verified && <ShieldCheck className="w-5 h-5 text-gold" />}
            </div>
            <div className="text-xs text-slate-200 flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3" />{[m.district, m.city].filter(Boolean).join(', ') || 'UAE'}
              {m.distance_km != null && <> · {m.distance_km} km away</>}
            </div>
            <div className="mt-2"><ScoreBadge score={m.score} band={m.band} onDark /></div>
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
      </div>}

      <div className={cx('space-y-4', !noPhotos && 'md:col-span-3')}>
        {m.headline && <p className="font-display italic text-lg">{m.headline}</p>}
        <div className="flex flex-wrap gap-1.5 text-xs">
          {m.occupation && <Badge tone="slate"><Briefcase className="w-3 h-3" />{m.occupation}{m.company ? ` · ${m.company}` : ''}</Badge>}
          {(m.university || m.degree) && <Badge tone="slate"><GraduationCap className="w-3 h-3" />{[m.degree, m.university].filter(Boolean).join(', ')}</Badge>}
          {m.nationality && <Badge tone="slate"><Flag className="w-3 h-3" />{m.nationality}</Badge>}
          {m.height_cm && <Badge tone="slate"><Ruler className="w-3 h-3" />{m.height_cm} cm</Badge>}
          {m.work_verified && <Badge tone="green"><ShieldCheck className="w-3 h-3" />Work email verified</Badge>}
          {m.linkedin_url && <a href={m.linkedin_url} target="_blank" rel="noreferrer"><Badge><Link2 className="w-3 h-3" />LinkedIn</Badge></a>}
        </div>
        {m.bio && <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300 whitespace-pre-line">{m.bio}</p>}

        <div className="grid grid-cols-2 gap-2 text-sm">
          <Fact k="Faith" v={[m.religion, m.religion_branch, m.religion_practice].filter(Boolean).join(' · ')} />
          <Fact k="Marriage" v={labelOf(TIMELINE, m.marriage_timeline)} />
          {m.marital_status && <Fact k="Marital status" v={labelOf(MARITAL_STATUS, m.marital_status)} />}
          {m.has_children != null && <Fact k="Has children" v={m.has_children ? `Yes${m.children_count ? ` (${m.children_count})` : ''}` : 'No'} />}
          <Fact k="Children in future" v={labelOf(KIDS, m.kids)} />
          <Fact k="Relocation" v={labelOf(RELOCATION, m.relocation)} />
          <Fact k="Drinking" v={labelOf(HABITS, m.drinking)} />
          <Fact k="Smoking" v={labelOf(HABITS, m.smoking)} />
          {m.political && <Fact k="Outlook" v={labelOf(POLITICAL, m.political)} />}
        </div>

        <BirthChart z={m.zodiac} self={self} preview={preview} targetId={m.id} />

        {!compact && answered.length > 0 && (
          <div className="space-y-2">
            {answered.map((p) => (
              <div key={p.key} className="rounded-xl bg-slate-50 dark:bg-navy-3 px-3 py-2">
                <div className="text-[10px] uppercase tracking-wider text-gold-deep dark:text-gold">{p.question}</div>
                <p className="text-sm whitespace-pre-line">{p.answer}</p>
              </div>
            ))}
          </div>
        )}
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

const GLYPH: Record<string, string> = {
  Aries: '♈', Taurus: '♉', Gemini: '♊', Cancer: '♋', Leo: '♌', Virgo: '♍', Libra: '♎', Scorpio: '♏',
  Sagittarius: '♐', Capricorn: '♑', Aquarius: '♒', Pisces: '♓',
};

/** How someone loves (Venus sign). */
const VENUS: Record<string, string> = {
  Aries: 'Loves boldly and makes the first move; wants passion and honesty.',
  Taurus: 'Loyal and sensual; shows love through time, touch and steady care.',
  Gemini: 'Falls for the mind first; needs conversation, wit and variety.',
  Cancer: 'Nurturing and devoted; love means home, family and emotional safety.',
  Leo: 'Warm and generous; loves big and wants to feel adored in return.',
  Virgo: 'Shows love through thoughtful acts; values reliability and care in the details.',
  Libra: 'Romantic and fair-minded; seeks harmony, beauty and true partnership.',
  Scorpio: 'Intense and all-in; craves deep trust and emotional closeness.',
  Sagittarius: 'Free-spirited and honest; wants a partner who is also a best friend and adventure-mate.',
  Capricorn: 'Committed for the long run; love is built patiently and proven over time.',
  Aquarius: 'Loves through friendship and freedom; needs space, ideas and authenticity.',
  Pisces: 'Tender and romantic; loves with empathy, devotion and imagination.',
};

/** What attracts someone and how they pursue (Mars sign). */
const MARS: Record<string, string> = {
  Aries: 'Drawn to confidence; pursues directly.',
  Taurus: 'Drawn to calm, grounded people; pursues slowly and surely.',
  Gemini: 'Drawn to a quick mind; flirts with words.',
  Cancer: 'Drawn to kindness and warmth; protects the people they love.',
  Leo: 'Drawn to self-assured charisma; pursues with grand gestures.',
  Virgo: 'Drawn to competence and integrity; shows interest through helpfulness.',
  Libra: 'Drawn to elegance and good manners; pursues with charm.',
  Scorpio: 'Drawn to depth and mystery; pursues with focus and intensity.',
  Sagittarius: 'Drawn to optimism and curiosity; pursues through shared adventures.',
  Capricorn: 'Drawn to ambition and maturity; pursues with clear intentions.',
  Aquarius: 'Drawn to originality; pursues through friendship first.',
  Pisces: 'Drawn to gentleness and creativity; pursues through romance and intuition.',
};

const SIGN_EL: Record<string, string> = { Aries: 'Fire', Leo: 'Fire', Sagittarius: 'Fire', Taurus: 'Earth', Virgo: 'Earth', Capricorn: 'Earth', Gemini: 'Air', Libra: 'Air', Aquarius: 'Air', Cancer: 'Water', Scorpio: 'Water', Pisces: 'Water' };
const elRel = (a?: string | null, b?: string | null) => {
  const x = a ? SIGN_EL[a] : null, y = b ? SIGN_EL[b] : null;
  if (!x || !y) return null;
  if (x === y) return 'same';
  return ['Fire|Air', 'Air|Fire', 'Earth|Water', 'Water|Earth'].includes(`${x}|${y}`) ? 'complementary' : 'contrasting';
};
const BAND_READING: Record<string, string> = {
  Rare: 'A rare fit: the two charts support each other almost everywhere.',
  Exceptional: 'An unusually natural fit: the charts support each other in most areas.',
  'Very important': 'Strong chemistry: plenty of natural ease, with a few areas to talk through.',
  Important: 'A solid base: real chemistry in places, and some differences to navigate.',
  Medium: 'A mixed picture: easy in some areas, effort needed in others.',
  Minimal: 'The charts pull in different directions, so this pairing would run more on shared values and effort than on instant chemistry.',
};
/** A short written reading built from the score band, Suns, Moons and Venus/Mars. */
function zodiacReading(m: any): string[] {
  const out: string[] = [];
  if (m.band && BAND_READING[m.band]) out.push(BAND_READING[m.band]);
  if (m.my_sun && m.their_sun && m.element_match) {
    const t = { same: 'same element, so you tend to get each other quickly', complementary: 'complementary elements that balance and energise each other', contrasting: 'contrasting elements: different rhythms that can teach each other a lot' }[m.element_match as string];
    out.push(`Suns ${m.my_sun} × ${m.their_sun}: ${t}.`);
  }
  const moon = elRel(m.my_moon, m.their_moon);
  if (moon) {
    const t = { same: 'you process feelings in a similar way', complementary: 'your emotional styles balance each other', contrasting: 'you show feelings differently, so saying what you need helps' }[moon];
    out.push(`Moons ${m.my_moon} × ${m.their_moon}: ${t}.`);
  }
  const spark = elRel(m.my_venus, m.their_mars) ?? elRel(m.my_mars, m.their_venus);
  if (spark && m.their_mars && m.my_venus) {
    out.push(spark === 'contrasting'
      ? `Attraction: their Mars in ${m.their_mars} and your Venus in ${m.my_venus} spark through contrast rather than ease.`
      : `Attraction: their Mars in ${m.their_mars} suits your Venus in ${m.my_venus}, a natural spark.`);
  }
  return out;
}


/** Birth chart: sun, moon, rising, and love compatibility (instead of houses and the wheel). */
function BirthChart({ z, self, preview, targetId }: { z: MemberCard['zodiac']; self?: boolean; preview?: boolean; targetId: string }) {
  const [match, setMatch] = useState<any>(null);
  useEffect(() => {
    if (self || preview) return;
    supabase.rpc('zodiac_match', { p_target: targetId }).then(({ data }) => setMatch(data ?? null));
  }, [self, preview, targetId]);
  if (!z?.sun) return null;
  const big3: [string, string | null][] = [['Sun', z.sun], ['Moon', z.moon], ['Rising', z.rising]];
  const venus = z.placements?.find((p) => p.point === 'Venus')?.sign ?? null;
  const mars = z.placements?.find((p) => p.point === 'Mars')?.sign ?? null;
  const full = !!z.moon;
  return (
    <div className="rounded-xl border border-gold/30 bg-gold/5 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-widest text-gold flex items-center gap-1.5"><Star className="w-3.5 h-3.5" />Birth chart</div>
        {z.element && <span className="text-[11px] text-slate-500">{z.element} sun</span>}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {big3.map(([k, v]) => (
          <div key={k} className="rounded-lg bg-white/60 dark:bg-navy-3 p-2.5 text-center">
            <div className="text-xl leading-none text-gold">{v ? GLYPH[v] : '–'}</div>
            <div className="text-[13px] mt-1">{v ?? '—'}</div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500">{k}</div>
          </div>
        ))}
      </div>

      {!self && match && (
        <div className="space-y-1.5">
          <div className="text-[10px] uppercase tracking-widest text-gold flex items-center gap-1"><Heart className="w-3 h-3" />Your zodiac match</div>
          {match.source === 'synastry' && match.band ? (
            <>
              <p className="text-[13px]"><b>{match.band}</b>{match.score != null ? ` · ${Math.round(match.score)}/100` : ''}</p>
              {zodiacReading(match).map((t, i) => <p key={i} className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">{t}</p>)}
              <p className="text-[11px] text-slate-500">Based on both full birth charts. Astrology counts for 10% of your match %.</p>
            </>
          ) : match.element_match ? (
            <>
              {zodiacReading(match).map((t, i) => <p key={i} className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">{t}</p>)}
              <p className="text-[11px] text-slate-500">Sun signs only for now. Astrology counts for 10% of your match %.</p>
            </>
          ) : <p className="text-xs text-slate-500">Not enough birth details yet.</p>}
        </div>
      )}

      {(venus || mars) && (
        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-widest text-gold">{self ? 'Your love style' : preview ? 'Love style' : 'Their love style'}</div>
          {venus && <p className="text-xs leading-relaxed"><span className="text-gold">♀ Venus in {venus}:</span> {VENUS[venus]}</p>}
          {mars && <p className="text-xs leading-relaxed"><span className="text-gold">♂ Mars in {mars}:</span> {MARS[mars]}</p>}
        </div>
      )}

      {!full && self && (
        <p className="text-xs text-slate-500">Add your time and city of birth (Edit profile → Marriage & lifestyle) for your full chart and love style. It also makes your match compatibility more accurate.</p>
      )}
      {!full && !self && <p className="text-[11px] text-slate-500">Sun sign only. They haven't added birth time and place.</p>}
    </div>
  );
}
