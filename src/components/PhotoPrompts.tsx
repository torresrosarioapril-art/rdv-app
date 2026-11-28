import { useState } from 'react';
import { ChevronLeft, ChevronRight, ImagePlus, Plus, Trash2 } from 'lucide-react';
import { uploadFile, type PhotoPrompt } from '@/lib/api';
import { PHOTO_PROMPTS } from '@/config/app';
import { Button, Input, Modal, Photo, cx, useToast } from '@/components/ui';

export const PHOTO_PROMPT_SLOTS = 4;
export const CAPTION_MAX = 40;

/** Editor: up to 4 optional photo prompts (a photo + a prompt + a short caption). */
export function PhotoPromptsEditor({ value, onChange }: { value: PhotoPrompt[]; onChange: (v: PhotoPrompt[]) => void }) {
  const toast = useToast();
  const items = Array.isArray(value) ? value : [];
  const [editing, setEditing] = useState<number | null>(null); // slot index
  const [stage, setStage] = useState<'prompt' | 'details'>('prompt');
  const [draft, setDraft] = useState<PhotoPrompt>({ prompt: '', path: '', caption: '' });
  const [busy, setBusy] = useState(false);

  const open = (i: number) => {
    const cur = items[i];
    setDraft(cur ? { ...cur } : { prompt: '', path: '', caption: '' });
    setStage(cur ? 'details' : 'prompt');
    setEditing(i);
  };
  const close = () => { setEditing(null); setBusy(false); };
  const used = new Set(items.filter((_, i) => i !== editing).map((p) => p.prompt));

  const pickPhoto = async (file: File) => {
    setBusy(true);
    try { setDraft((d) => ({ ...d, path: '' })); const path = await uploadFile('photos', file, (file.name.split('.').pop() || 'jpg').toLowerCase()); setDraft((d) => ({ ...d, path })); }
    catch (e) { toast(e instanceof Error ? e.message : 'Upload failed', 'err'); }
    finally { setBusy(false); }
  };

  const save = () => {
    if (editing == null) return;
    if (!draft.path) return toast('Add a photo for this prompt', 'err');
    const next = [...items];
    if (editing < next.length) next[editing] = draft; else next.push(draft);
    onChange(next.slice(0, PHOTO_PROMPT_SLOTS));
    close();
  };
  const remove = (i: number) => onChange(items.filter((_, j) => j !== i));

  return (
    <div className="space-y-2.5">
      {Array.from({ length: PHOTO_PROMPT_SLOTS }).map((_, i) => {
        const p = items[i];
        // only one empty slot at a time, right after the filled ones
        if (!p && i > items.length) return null;
        return p ? (
          <div key={i} className="flex items-stretch rounded-2xl border border-gold/40 overflow-hidden bg-white dark:bg-navy-2">
            <button type="button" onClick={() => open(i)} className="w-24 shrink-0 aspect-[4/5] cursor-pointer">
              <Photo path={p.path} alt="" className="w-full h-full" />
            </button>
            <button type="button" onClick={() => open(i)} className="flex-1 min-w-0 text-left px-3 py-2.5 cursor-pointer">
              <div className="text-[10px] uppercase tracking-wider text-gold-deep dark:text-gold">{p.prompt}</div>
              <div className="font-display italic text-base mt-0.5 break-words">{p.caption || <span className="text-slate-400 not-italic text-sm">Add a caption</span>}</div>
            </button>
            <button type="button" onClick={() => remove(i)} aria-label="Remove this photo prompt" className="px-3 text-slate-400 hover:text-rose-500 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
          </div>
        ) : (
          <button key={i} type="button" onClick={() => open(i)}
            className="w-full flex items-stretch rounded-2xl border-2 border-dashed border-slate-300 dark:border-white/15 hover:border-gold overflow-hidden text-left cursor-pointer">
            <span className="w-24 shrink-0 aspect-[4/5] bg-slate-100 dark:bg-navy-3 flex items-center justify-center text-gold"><Plus className="w-6 h-6" /></span>
            <span className="flex-1 px-3 py-2.5 flex flex-col justify-center">
              <span className="text-sm">Choose prompt</span>
              <span className="text-xs text-slate-500">Add a photo and a caption</span>
            </span>
          </button>
        );
      })}

      <Modal open={editing != null} onClose={close}>
        {stage === 'prompt' ? (
          <div>
            <h2 className="text-2xl font-display">Choose a <span className="italic text-gold">prompt</span></h2>
            <p className="text-xs text-slate-500 mt-1">You'll answer with a photo and a short caption ({CAPTION_MAX} characters or less).</p>
            <ul className="mt-4 divide-y divide-gold/20">
              {PHOTO_PROMPTS.filter((q) => !used.has(q)).map((q) => (
                <li key={q}>
                  <button type="button" onClick={() => { setDraft((d) => ({ ...d, prompt: q })); setStage('details'); }}
                    className={cx('w-full flex items-center justify-between py-3 text-sm text-left cursor-pointer', draft.prompt === q && 'text-gold-deep dark:text-gold font-semibold')}>
                    {q}<ChevronRight className="w-4 h-4 text-gold" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="space-y-4">
            <button type="button" onClick={() => setStage('prompt')} className="flex items-center gap-1 text-xs text-gold-deep dark:text-gold cursor-pointer">
              <ChevronLeft className="w-3.5 h-3.5" />Change prompt
            </button>
            <div className="text-[11px] uppercase tracking-wider text-gold-deep dark:text-gold">{draft.prompt}</div>
            <label className="block mx-auto w-56 aspect-[4/5] rounded-2xl overflow-hidden border-2 border-dashed border-gold/50 cursor-pointer relative bg-slate-50 dark:bg-navy-3">
              {draft.path
                ? <Photo path={draft.path} alt="" className="w-full h-full" />
                : <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-sm text-slate-500"><ImagePlus className="w-6 h-6 text-gold" />{busy ? 'Uploading…' : 'Add a photo'}</span>}
              {draft.path && <span className="absolute bottom-2 inset-x-2 text-center rounded-full bg-black/55 text-white text-[11px] py-1">Tap to change photo</span>}
              <input type="file" accept="image/jpeg,image/png,image/webp,image/heic" className="hidden"
                onChange={(e) => { const file = e.target.files?.[0]; if (file) pickPhoto(file); e.target.value = ''; }} />
            </label>
            <div>
              <Input maxLength={CAPTION_MAX} placeholder="Add a caption" value={draft.caption}
                onChange={(e) => setDraft((d) => ({ ...d, caption: e.target.value.slice(0, CAPTION_MAX) }))} />
              <div className="text-right text-[11px] text-slate-500 mt-1">{draft.caption.length} / {CAPTION_MAX}</div>
            </div>
            <Button className="w-full" busy={busy} onClick={save}>Save</Button>
          </div>
        )}
      </Modal>
    </div>
  );
}

/** How photo prompts look on a profile. */
export function PhotoPromptCards({ items }: { items?: PhotoPrompt[] | null }) {
  const list = (items ?? []).filter((p) => p?.path);
  if (!list.length) return null;
  return (
    <div className="grid grid-cols-2 gap-3">
      {list.map((p) => (
        <figure key={p.path} className="rounded-2xl overflow-hidden border border-gold/40 bg-white dark:bg-navy-2 shadow-sm">
          <Photo path={p.path} alt={p.caption || p.prompt} className="w-full aspect-[4/5]" />
          <figcaption className="px-3 py-2.5">
            <div className="text-[10px] uppercase tracking-wider text-gold-deep dark:text-gold leading-snug">{p.prompt}</div>
            {p.caption && <div className="font-display italic text-[15px] leading-snug mt-0.5 break-words">{p.caption}</div>}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
