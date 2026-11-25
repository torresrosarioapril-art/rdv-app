import { useEffect, useState } from 'react';
import { BadgeCheck, Briefcase, Mail } from 'lucide-react';
import { myWorkEmail, removeWorkEmail, sendWorkEmailLink, setHideFromCoworkers, type WorkEmailState } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { Badge, Button, Card, Field, Input, Toggle, useToast } from './ui';

/** Optional work email: verified by a one-time emailed link. Once verified, "Hide from coworkers" appears.
 *  Skippable: members without a work email simply never see the toggle. */
export function WorkEmailCard({ bare }: { bare?: boolean }) {
  const toast = useToast();
  const [st, setSt] = useState<WorkEmailState | null>(null);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const load = () => myWorkEmail().then((s) => { setSt(s); if (s?.email && !s.verified) setEmail(s.email); }).catch(() => {});
  useEffect(() => {
    load();
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null));
    const onFocus = () => load(); // pick up the verification after they click the link in another tab
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const send = async () => {
    setBusy(true);
    try { await sendWorkEmailLink(email); toast(`Link sent to ${email}. Open it to confirm.`); load(); }
    catch (e) { toast(e instanceof Error ? e.message : 'Could not send', 'err'); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    try { await removeWorkEmail(); setEmail(''); toast('Work email removed'); load(); }
    catch (e) { toast(e instanceof Error ? e.message : 'Could not remove', 'err'); }
  };
  const hide = async (on: boolean) => {
    if (!uid) return;
    setSt((s) => (s ? { ...s, hide_from_coworkers: on } : s));
    try { await setHideFromCoworkers(uid, on); toast(on ? "Coworkers won't see you, and you won't see them" : 'Coworkers can appear again'); }
    catch (e) { toast(e instanceof Error ? e.message : 'Could not change', 'err'); load(); }
  };

  const body = (
    <div className="space-y-3">
      {!bare && (
        <div className="flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-gold" /><h3 className="font-display text-lg">Work email</h3>
          <span className="text-[11px] text-slate-500">Optional</span>
        </div>
      )}
      {st?.verified ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Badge tone="green"><BadgeCheck className="w-3 h-3" />Verified · {st.email}</Badge>
            <button type="button" onClick={remove} className="text-xs text-slate-500 hover:text-rose-500 cursor-pointer">Remove</button>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">Hide from coworkers</div>
              <div className="text-[11px] text-slate-500">Anyone with a verified email at the same company won't appear in your batches, drops or radar, and you won't appear in theirs. They're never told.</div>
            </div>
            <Toggle checked={!!st.hide_from_coworkers} onChange={hide} label="" />
          </div>
        </>
      ) : (
        <>
          <p className="text-[11px] text-slate-500">Confirm your work address to unlock <b>Hide from coworkers</b>. It's never shown to other members. No work email? Just skip this.</p>
          <Field label="Work email">
            <div className="flex gap-2">
              <div className="relative flex-1 min-w-0"><Mail className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <Input type="email" className="pl-9" placeholder="name@company.com" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <Button type="button" variant="outline" busy={busy} disabled={!email.includes('@')} onClick={send}>{st?.pending ? 'Resend' : 'Send link'}</Button>
            </div>
          </Field>
          {st?.pending && <p className="text-[11px] text-gold">Link sent to {st.email}. Open it on any device to confirm. It expires in 24 hours.</p>}
        </>
      )}
    </div>
  );
  return bare ? body : <Card>{body}</Card>;
}
