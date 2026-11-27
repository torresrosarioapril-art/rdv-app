import { useEffect, useState } from 'react';
import { CheckCircle2, ShieldCheck, XCircle } from 'lucide-react';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, BRAND } from '@/config/app';
import { Button, Card, Field, Spinner, Textarea } from '@/components/ui';
import { BrandLogo } from '@/components/BrandLogo';

/** One-tap review links from the shared inbox open here (no sign-in needed; the link itself is the key). */
export default function ReviewPage() {
  const token = new URLSearchParams(window.location.search).get('token') ?? '';
  const endpoint = `${SUPABASE_URL}/functions/v1/review`;
  const headers = { apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' };
  const [info, setInfo] = useState<any>(null);
  const [reason, setReason] = useState('');
  const [ageOk, setAgeOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    fetch(`${endpoint}?token=${encodeURIComponent(token)}`, { headers }).then((r) => r.json()).then(setInfo).catch(() => setInfo({ valid: false }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const confirm = async () => {
    setBusy(true);
    try {
      const r = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ token, reason, ageConfirmed: ageOk }) });
      setDone(await r.json());
    } catch { setDone({ ok: false, message: 'Network error. Please try again.' }); }
    finally { setBusy(false); }
  };

  const labels: Record<string, string> = { approve: 'Approve member', changes: 'Request changes', reject: 'Reject application (final)', action: 'Suspend reported member', dismiss: 'Dismiss report' };
  const danger = info?.action === 'reject' || info?.action === 'action';
  const needsNote = info?.action === 'changes';

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-lg w-full space-y-4">
        <div className="flex items-center gap-2"><BrandLogo className="w-8 h-8" /><span className="text-xs uppercase tracking-widest text-gold">Review team</span></div>
        {!info ? <Spinner /> : done ? (
          <div className="text-center py-6">
            {done.ok ? <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" /> : <XCircle className="w-10 h-10 text-rose-500 mx-auto" />}
            <p className="mt-3">{done.message}</p>
          </div>
        ) : !info.valid ? (
          <p className="py-6 text-center">This link has already been used, or it expired.</p>
        ) : (
          <>
            <h1 className="text-2xl font-display">{labels[info.action] ?? info.action}</h1>
            {info.type === 'verification' ? (
              <div className="space-y-3">
                <div className="flex gap-3">
                  {info.photo && <img src={info.photo} alt="" className="w-20 h-24 object-cover rounded-xl" />}
                  <dl className="text-sm space-y-0.5">
                    <div><b>{info.member.name}</b> ({info.member.legal_name})</div>
                    <div>{info.member.gender}, {info.member.age} · born {info.member.birth_date}</div>
                    <div>{info.member.nationality} · {info.member.city} · {info.member.occupation}</div>
                    <div className="text-slate-500">Joined via {info.member.signup_method}{info.member.invited_by_code ? ` (${info.member.invited_by_code})` : ''} · status {info.status}</div>
                    {info.member.linkedin_url && <a className="text-gold" href={info.member.linkedin_url} target="_blank" rel="noreferrer">LinkedIn</a>}
                  </dl>
                </div>
                {info.member.possible_duplicates?.length > 0 && (
                  <p className="text-sm rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 p-3">
                    <b>Possible duplicate account:</b> {info.member.possible_duplicates.map((d: any) => `${d.name} (${d.status}, ${d.why})`).join('; ')}. Check before approving.
                  </p>
                )}
                {info.video ? <video src={info.video} controls playsInline className="w-full rounded-xl bg-black max-h-80" /> : <p className="text-rose-500 text-sm">No ID video found.</p>}
                <p className="text-xs text-slate-500 flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" />Check the face matches the ID, the name and the 18+ birth date.</p>
              </div>
            ) : (
              <div className="text-sm space-y-1">
                <div><b>Reason:</b> {info.report?.reason} ({info.report?.priority})</div>
                <div><b>About:</b> a {info.report?.target_type}</div>
                {info.report?.details && <p className="rounded-xl bg-slate-50 dark:bg-navy-3 p-3">{info.report.details}</p>}
              </div>
            )}
            {info.action !== 'approve' && (
              <Field label={needsNote ? 'What should the member change?' : info.action === 'reject' ? 'Reason shown to the member' : 'Note'} optional={!needsNote}
                hint={needsNote ? 'They see this note at the top of their application, e.g. "Your video is too dark, please re-record in good light."' : info.action === 'reject' ? 'Rejection is final: they cannot resubmit. Use Request changes if they can fix the problem.' : undefined}>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
              </Field>
            )}
            {info.action === 'approve' && info.type === 'verification' && (
              <label className="flex items-start gap-2 text-sm rounded-xl border border-gold/40 bg-gold/5 p-3 cursor-pointer">
                <input type="checkbox" className="mt-0.5 accent-[#c9a24a]" checked={ageOk} onChange={(e) => setAgeOk(e.target.checked)} />
                <span>I checked the ID in the video: the date of birth matches <b>{info.member.birth_date}</b>, the face matches, and the member is 18 or older.</span>
              </label>
            )}
            <Button className="w-full" variant={danger ? 'danger' : 'gold'} busy={busy} disabled={(needsNote && !reason.trim()) || (info.action === 'approve' && info.type === 'verification' && !ageOk)} onClick={confirm}>Confirm: {labels[info.action]}</Button>
          </>
        )}
      </Card>
    </div>
  );
}
