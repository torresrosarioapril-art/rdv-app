import { useState } from 'react';
import { Ban, Flag } from 'lucide-react';
import { blockMember, reportMember } from '@/lib/api';
import { REPORT_REASONS, SUPPORT } from '@/config/app';
import { Button, Field, Modal, Select, Textarea, Toggle, useAction } from './ui';

/** Report & block (Apple Guideline 1.2). */
export function SafetyMenu({ memberId, name, onDone, target = 'profile', refId }: {
  memberId: string; name: string; onDone?: () => void;
  target?: 'profile' | 'photo' | 'message' | 'voice'; refId?: string | null;
}) {
  const [open, setOpen] = useState<'report' | 'block' | null>(null);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(true);
  const { busy, run } = useAction();

  return (
    <>
      <div className="flex gap-2">
        <Button variant="ghost" className="!px-2.5 !py-1.5 text-xs" onClick={() => setOpen('report')}><Flag className="w-3.5 h-3.5" />Report</Button>
        <Button variant="ghost" className="!px-2.5 !py-1.5 text-xs" onClick={() => setOpen('block')}><Ban className="w-3.5 h-3.5" />Block</Button>
      </div>

      <Modal open={open === 'block'} onClose={() => setOpen(null)} title={`Block ${name}?`}>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">You won't see each other anywhere: radar, daily batch, curated drops or chat. They aren't told.</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(null)}>Cancel</Button>
          <Button variant="danger" busy={busy} onClick={async () => {
            const ok = await run(() => blockMember(memberId), `${name} is blocked`);
            if (ok) { setOpen(null); onDone?.(); }
          }}>Block</Button>
        </div>
      </Modal>

      <Modal open={open === 'report'} onClose={() => setOpen(null)} title={`Report ${name}`}>
        <div className="space-y-4">
          <Field label="Reason"><Select options={REPORT_REASONS} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
          <Field label="What happened?" optional><Textarea value={details} onChange={(e) => setDetails(e.target.value)} maxLength={2000} /></Field>
          <Toggle checked={alsoBlock} onChange={setAlsoBlock} label={`Also block ${name}`} />
          <p className="text-xs text-slate-500">Reports go straight to the review team. Intimate images shared without consent are hidden immediately while we review. Urgent? Email {SUPPORT.email}.</p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(null)}>Cancel</Button>
            <Button variant="danger" busy={busy} disabled={!reason} onClick={async () => {
              const ok = await run(() => reportMember(memberId, target, reason, refId, details, alsoBlock), 'Thank you. Our team will review this.');
              if (ok) { setOpen(null); setReason(''); setDetails(''); if (alsoBlock) onDone?.(); }
            }}>Send report</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
