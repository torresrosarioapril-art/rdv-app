import { AlertOctagon, Eye, Flag, HeartHandshake, MapPin, UserCheck, Video, X } from 'lucide-react';

/**
 * Rendez-vous Community Charter. Keep every statement true to how the app actually works
 * (manual video ID review, self-declared career/education, optional LinkedIn, approximate location only).
 */
export const CHARTER_VERSION = '2026-11-25';

const RULES: { icon: React.ReactNode; title: string; body: string }[] = [
  {
    icon: <UserCheck className="w-4 h-4" />,
    title: 'Real people only. No anonymous profiles.',
    body: 'Use your real first name and clear, recent photos of yourself. Anonymous, fake or impersonating profiles, and accounts run for someone else, are removed and banned. Your full legal name stays private and is only seen by our review team.',
  },
  {
    icon: <Video className="w-4 h-4" />,
    title: 'Every member passes a video ID check',
    body: 'Before you appear to anyone, you record a short video holding your Emirates ID or passport. A person on our team reviews it by hand to confirm it is really you and that you are 18 or over. It is not automated face scanning, and the video is never shown to other members.',
  },
  {
    icon: <Eye className="w-4 h-4" />,
    title: 'What we do and don\'t verify',
    body: 'We verify your identity and age. Your occupation, employer, education and LinkedIn link are provided by you and are not checked by Rendez-vous; LinkedIn is optional. Be truthful about who you are, your relationship status and your intentions. Misrepresentation leads to removal.',
  },
  {
    icon: <AlertOctagon className="w-4 h-4" />,
    title: 'Zero tolerance for harassment',
    body: 'Unsolicited explicit images, sexual comments, threats, pressure, hate speech, stalking, and asking for money or investments lead to a permanent ban. Intimate images shared without consent are hidden the moment they are reported.',
  },
  {
    icon: <MapPin className="w-4 h-4" />,
    title: 'Privacy and location',
    body: 'Nobody ever sees your exact location: you appear on the radar to the nearest 500 m, or not at all in Ghost mode. Safe Zones can hide you automatically at places like home or work. Never share another member\'s photos, messages or details outside the app.',
  },
  {
    icon: <HeartHandshake className="w-4 h-4" />,
    title: 'Respect, in the app and on dates',
    body: 'Be courteous and clear. Meet in public places, honour the plans you accept, and decline politely if you are not interested.',
  },
  {
    icon: <Flag className="w-4 h-4" />,
    title: 'Report and block, anytime',
    body: 'You can report or block anyone from their profile or any message. Reports go to our review team, who may suspend or remove accounts. Anyone found to be under 18 is removed immediately.',
  },
];

export function SafetyStandardsModal({ isOpen, onClose, onAccept }: {
  isOpen: boolean; onClose: () => void; onAccept?: () => void;
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-6 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl bg-white dark:bg-navy-2 border border-slate-200 dark:border-white/10 rounded-t-3xl sm:rounded-2xl p-5 md:p-7 text-slate-800 dark:text-slate-100 max-h-[92vh] overflow-y-auto">
        <button onClick={onClose} aria-label="Close" className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer">
          <X className="w-4 h-4" />
        </button>
        <div className="text-center max-w-lg mx-auto mb-5">
          <div className="text-[10px] uppercase tracking-widest text-gold mb-2">Community Charter</div>
          <h2 className="text-xl font-display">How we keep Rendez-vous safe and serious</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
            Rendez-vous is for marriage-minded adults in the UAE. Every member agrees to this charter before joining.
          </p>
        </div>
        <div className="space-y-2.5 mb-5">
          {RULES.map((r) => (
            <div key={r.title} className="p-3.5 rounded-xl bg-slate-50 dark:bg-navy-3 border border-slate-200 dark:border-white/10 flex items-start gap-3">
              <div className="p-2 rounded-lg bg-gold/10 text-gold shrink-0">{r.icon}</div>
              <div>
                <h3 className="text-sm font-semibold mb-0.5">{r.title}</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{r.body}</p>
              </div>
            </div>
          ))}
        </div>
        <button onClick={() => { onAccept?.(); onClose(); }}
          className="w-full py-3 rounded-xl bg-gold text-navy text-sm font-semibold hover:brightness-105 cursor-pointer">
          {onAccept ? 'I agree to the Community Charter' : 'Close'}
        </button>
      </div>
    </div>
  );
}
