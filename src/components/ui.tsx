import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { signedUrl } from '@/lib/api';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

type BtnVariant = 'gold' | 'ghost' | 'outline' | 'danger';
export function Button({
  variant = 'gold', busy, className, children, ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; busy?: boolean }) {
  const styles: Record<BtnVariant, string> = {
    gold: 'bg-gold text-navy hover:brightness-110 font-semibold',
    ghost: 'text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5',
    outline: 'border border-slate-300 dark:border-white/15 hover:border-gold text-slate-800 dark:text-slate-100',
    danger: 'border border-rose-400/50 text-rose-600 dark:text-rose-300 hover:bg-rose-500/10',
  };
  return (
    <button
      {...rest}
      disabled={rest.disabled || busy}
      className={cx('inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer', styles[variant], className)}
    >
      {busy && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cx('rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-navy-2 p-5', className)}>
      {children}
    </div>
  );
}

export function Field({ label, hint, optional, children }: { label: string; hint?: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="flex items-baseline gap-2 text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
        {label}
        {optional && <span className="text-[10px] uppercase tracking-wider text-slate-400">Optional</span>}
      </span>
      {children}
      {hint && <span className="block mt-1 text-[11px] text-slate-500 dark:text-slate-400">{hint}</span>}
    </label>
  );
}

const inputCls =
  'w-full rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 px-3 py-2.5 text-sm outline-none focus:border-gold dark:border-white/15 dark:bg-navy-3 dark:text-slate-100 dark:placeholder:text-slate-500';

export const Input = (p: React.InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cx(inputCls, p.className)} />;
export const Textarea = (p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea {...p} className={cx(inputCls, 'min-h-28', p.className)} />
);
export function Select({ options, placeholder = 'Select…', ...p }: React.SelectHTMLAttributes<HTMLSelectElement> & {
  options: readonly ({ value: string; label: string } | string)[]; placeholder?: string;
}) {
  return (
    <select {...p} className={cx(inputCls, p.className)}>
      <option value="">{placeholder}</option>
      {options.map((o) => {
        const v = typeof o === 'string' ? o : o.value;
        const l = typeof o === 'string' ? o : o.label;
        return <option key={v} value={v}>{l}</option>;
      })}
    </select>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex items-center gap-2.5 text-sm cursor-pointer">
      <span className={cx('relative w-9 h-5 rounded-full transition', checked ? 'bg-gold' : 'bg-slate-300 dark:bg-white/15')}>
        <span className={cx('absolute top-0.5 w-4 h-4 rounded-full bg-white transition', checked ? 'left-4.5' : 'left-0.5')} />
      </span>
      <span className="text-slate-700 dark:text-slate-200">{label}</span>
    </button>
  );
}

export function Modal({ open, onClose, title, children, wide, actions }: {
  open: boolean; onClose: () => void; title?: string; children: React.ReactNode; wide?: boolean;
  /** Shown on the right of the top bar (e.g. report / block). Close is always on the left. */
  actions?: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className={cx('relative w-full max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white dark:bg-navy-2 border border-slate-200 dark:border-white/10 p-5 sm:p-6', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}
      >
        {/* Top bar stays visible while scrolling: big Close on the left, actions on the right */}
        <div className="sticky -top-5 sm:-top-6 z-20 -mx-5 sm:-mx-6 -mt-5 sm:-mt-6 mb-3 px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2 bg-white/95 dark:bg-navy-2/95 backdrop-blur border-b border-slate-200/70 dark:border-white/10 rounded-t-3xl">
          <button onClick={onClose} aria-label="Close"
            className="flex items-center gap-1.5 rounded-full bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 pl-2 pr-3 py-1.5 text-sm font-medium cursor-pointer">
            <X className="w-5 h-5" />Close
          </button>
          {actions && <div className="flex items-center gap-1">{actions}</div>}
        </div>
        {title && <h2 className="text-xl font-display mb-4">{title}</h2>}
        {children}
      </div>
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-500 dark:text-slate-400">
      <Loader2 className="w-6 h-6 animate-spin text-gold" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}

export function Empty({ icon, title, children }: { icon?: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="text-center py-14 px-6">
      {icon && <div className="mx-auto mb-4 w-14 h-14 rounded-full border border-gold/30 flex items-center justify-center text-gold">{icon}</div>}
      <h3 className="text-lg font-display mb-1.5">{title}</h3>
      {children && <div className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">{children}</div>}
    </div>
  );
}

export function Photo({ path, alt, className }: { path?: string | null; alt: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    signedUrl('photos', path).then((u) => alive && setUrl(u));
    return () => { alive = false; };
  }, [path]);
  if (!url) {
    return (
      <div className={cx('flex items-center justify-center bg-navy-3 text-gold font-display text-3xl', className)}>
        {alt.slice(0, 1)}
      </div>
    );
  }
  return <img src={url} alt={alt} className={cx('object-cover', className)} />;
}

export function Badge({ children, tone = 'gold' }: { children: React.ReactNode; tone?: 'gold' | 'green' | 'slate' | 'rose' }) {
  const t = {
    gold: 'border-gold/40 text-gold bg-gold/10',
    green: 'border-emerald-400/40 text-emerald-600 dark:text-emerald-300 bg-emerald-500/10',
    slate: 'border-slate-300 dark:border-white/15 text-slate-600 dark:text-slate-300',
    rose: 'border-rose-400/40 text-rose-600 dark:text-rose-300 bg-rose-500/10',
  }[tone];
  return <span className={cx('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium', t)}>{children}</span>;
}

// ---------- Toasts ----------
type Toast = { id: number; text: string; tone: 'ok' | 'err' };
const ToastCtx = createContext<(text: string, tone?: 'ok' | 'err') => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: 'ok' | 'err' = 'ok') => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, text, tone }]);
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), 4500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed z-[60] bottom-24 sm:bottom-6 left-1/2 -translate-x-1/2 flex flex-col gap-2 w-[92%] max-w-sm">
        {items.map((t) => (
          <div key={t.id} className={cx('rounded-xl px-4 py-3 text-sm shadow-lg border', t.tone === 'ok'
            ? 'bg-navy text-slate-100 border-gold/40' : 'bg-rose-950 text-rose-100 border-rose-400/40')}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/** Run an async action, report errors as toasts, and resolve to true on success. */
export function useAction() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = useCallback(async (fn: () => Promise<unknown>, ok?: string): Promise<boolean> => {
    setBusy(true);
    try {
      await fn();
      if (ok) toast(ok);
      return true;
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Something went wrong', 'err');
      return false;
    } finally {
      setBusy(false);
    }
  }, [toast]);
  return { busy, run };
}
