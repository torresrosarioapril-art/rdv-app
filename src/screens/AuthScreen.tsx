import { useEffect, useState } from 'react';
import { Eye, EyeOff, KeyRound, Mail, Moon, ShieldCheck, Sun } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { checkInviteCode, signupOptions } from '@/lib/api';
import { BRAND, SIGNUP_COPY, SUPPORT } from '@/config/app';
import { Button, Card, Field, Input as BaseInput, cx, useToast } from '@/components/ui';

const Input = BaseInput;
import { CHARTER_VERSION, SafetyStandardsModal } from '@/components/SafetyStandardsModal';

type Mode = 'signin' | 'signup' | 'reset';
type Route = 'manual' | 'code';

export default function AuthScreen({ theme, onToggleTheme }: { theme?: 'dark' | 'light'; onToggleTheme?: () => void } = {}) {
  const toast = useToast();
  const params = new URLSearchParams(window.location.search);
  const codeFromLink = params.get(SIGNUP_COPY.codeParam) ?? '';
  const [mode, setMode] = useState<Mode>(codeFromLink ? 'signup' : 'signin');
  const [opts, setOpts] = useState<{ manual: boolean; invite: boolean; referral: boolean } | null>(null);
  const [route, setRoute] = useState<Route>(codeFromLink ? 'code' : 'manual');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState(codeFromLink.toUpperCase());
  const [adult, setAdult] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [charter, setCharter] = useState(false);
  const [charterOpen, setCharterOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  useEffect(() => {
    signupOptions().then((o) => {
      setOpts(o);
      if (!o.manual) setRoute('code');
      if (!o.invite && !o.referral) setRoute('manual');
    }).catch(() => setOpts({ manual: false, invite: true, referral: true }));
  }, []);

  const codesOpen = !!opts && (opts.invite || opts.referral);
  const codeLabel = opts?.invite && opts?.referral ? 'Invite or referral code' : opts?.invite ? 'Invite code' : 'Referral code';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
        if (error) throw error;
        setSent('We sent a password reset link to ' + email);
      } else {
        if (!charter) throw new Error('Please read and agree to the Community Charter.');
        if (!adult) throw new Error('Rendez-vous is for adults 18 and over.');
        const useCode = route === 'code';
        if (useCode) {
          if (!code.trim()) throw new Error('Enter your code');
          if (!(await checkInviteCode(code))) throw new Error('This code is not valid or has been used up.');
        }
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: name.trim(), invite_code: useCode ? code.trim().toUpperCase() : '', charter_version: CHARTER_VERSION, charter_accepted_at: new Date().toISOString() },
          },
        });
        if (error) throw new Error(error.message.includes('Database error') ? "We couldn't create this account. If you already have one with this email, sign in instead; otherwise check your invite code." : error.message);
        if (!data.session) setSent('Check ' + email + ' to confirm your address, then sign in.');
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Something went wrong', 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-ivory via-ivory to-white dark:from-navy dark:via-navy dark:to-navy-2 relative">
      {onToggleTheme && (
        <button type="button" onClick={onToggleTheme} title="Light or dark" className="absolute top-4 right-4 p-2 rounded-lg text-slate-500 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer">
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
      )}
      <div className="w-full max-w-md">
        <div className="text-center mb-8 text-navy dark:text-slate-100">
          <img src={BRAND.logo} alt="" className="w-20 h-20 mx-auto rounded-full mb-4 shadow-lg shadow-gold/10" />
          <h1 className="text-3xl font-display">{BRAND.name}</h1>
          <p className="font-display text-gold text-base mt-1 italic">{BRAND.tagline}</p>
        </div>

        <Card className="text-slate-800 dark:!bg-navy-2 dark:!border-white/10 dark:text-slate-100">
          {sent ? (
            <div className="text-center py-4">
              <Mail className="w-8 h-8 text-gold mx-auto mb-3" />
              <p className="text-sm">{sent}</p>
              <Button variant="outline" className="mt-5" onClick={() => { setSent(null); setMode('signin'); }}>Back to sign in</Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-navy-3">
                {(['signin', 'signup'] as const).map((m) => (
                  <button type="button" key={m} onClick={() => setMode(m)}
                    className={cx('py-2 rounded-lg text-sm cursor-pointer', mode === m ? 'bg-gold text-navy font-semibold' : 'text-slate-600 dark:text-slate-300')}>
                    {m === 'signin' ? 'Sign in' : 'Join'}
                  </button>
                ))}
              </div>

              {mode === 'signup' && opts && (
                <>
                  {opts.manual && codesOpen && (
                    <div className="space-y-2">
                      <RouteOption active={route === 'manual'} onClick={() => setRoute('manual')} title={SIGNUP_COPY.manual.title} hint={SIGNUP_COPY.manual.hint} />
                      <RouteOption active={route === 'code'} onClick={() => setRoute('code')}
                        title={opts.invite && opts.referral ? 'I have an invite or referral code' : opts.invite ? SIGNUP_COPY.invite.title : SIGNUP_COPY.referral.title}
                        hint={opts.invite && opts.referral ? `${SIGNUP_COPY.invite.hint} Or a member's referral code.` : opts.invite ? SIGNUP_COPY.invite.hint : SIGNUP_COPY.referral.hint} />
                    </div>
                  )}
                  {!opts.manual && !codesOpen && (
                    <p className="text-sm text-slate-600 dark:text-slate-300">New memberships are paused right now. Please check back soon.</p>
                  )}
                  <Field label="First name"><Input required value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" /></Field>
                  {route === 'code' && codesOpen && (
                    <Field label={codeLabel}>
                      <Input required value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. RDV12345" className="tracking-widest uppercase" />
                    </Field>
                  )}
                </>
              )}

              <Field label="Email"><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></Field>
              {mode !== 'reset' && (
                <Field label="Password" hint={mode === 'signup' ? 'At least 8 characters.' : undefined}>
                  <div className="relative">
                    <Input type={showPw ? 'text' : 'password'} required minLength={mode === 'signup' ? 8 : undefined} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} className="pr-10" />
                    <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? 'Hide password' : 'Show password'} className="absolute right-3 top-2.5 text-slate-400 hover:text-gold cursor-pointer">
                      {showPw ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                    </button>
                  </div>
                </Field>
              )}

              {mode === 'signup' && (
                <div className="rounded-xl border border-gold/30 bg-gold/5 p-3 text-xs text-slate-700 dark:text-slate-200 space-y-2">
                  <p>Before you join, please read our Community Charter: real people only, video ID check, zero tolerance for harassment.</p>
                  <div className="flex items-center justify-between gap-2">
                    <button type="button" onClick={() => setCharterOpen(true)} className="text-gold underline cursor-pointer">Read the Community Charter</button>
                    {charter ? <span className="text-emerald-600 dark:text-emerald-300">✓ Agreed</span> : <span className="text-slate-500 dark:text-slate-400">Not yet agreed</span>}
                  </div>
                </div>
              )}

              {mode === 'signup' && (
                <label className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} className="mt-0.5 accent-[#c9a24a]" />
                  I am 18 or older. I understand every member is verified by video ID before appearing to anyone, and that my age is checked during verification.
                </label>
              )}

              <Button type="submit" busy={busy} className="w-full" disabled={mode === 'signup' && ((!!opts && !opts.manual && !codesOpen) || !charter)}>
                {mode === 'signin' ? <><KeyRound className="w-4 h-4" /> Sign in</> : mode === 'reset' ? 'Send reset link' : <><ShieldCheck className="w-4 h-4" /> Create my application</>}
              </Button>

              <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                {mode === 'signin' ? <button type="button" onClick={() => setMode('reset')} className="hover:text-gold cursor-pointer">Forgot password?</button>
                  : <button type="button" onClick={() => setMode('signin')} className="hover:text-gold cursor-pointer">Back to sign in</button>}
                <a href={`mailto:${SUPPORT.email}`} className="hover:text-gold">Support</a>
              </div>
            </form>
          )}
        </Card>
        <p className="text-center text-[11px] text-slate-500 mt-6">{BRAND.pitch}</p>
        <SafetyStandardsModal isOpen={charterOpen} onClose={() => setCharterOpen(false)} onAccept={() => setCharter(true)} />
      </div>
    </div>
  );
}

function RouteOption({ active, onClick, title, hint }: { active: boolean; onClick: () => void; title: string; hint: string }) {
  return (
    <button type="button" onClick={onClick} className={cx('w-full text-left rounded-xl border p-3 cursor-pointer transition',
      active ? 'border-gold bg-gold/10' : 'border-slate-200 hover:border-slate-300 dark:border-white/10 dark:hover:border-white/25')}>
      <div className="text-sm font-medium">{title}</div>
      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{hint}</div>
    </button>
  );
}
