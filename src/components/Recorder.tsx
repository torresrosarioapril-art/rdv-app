import { useEffect, useRef, useState } from 'react';
import { Circle, Mic, Square, Video } from 'lucide-react';
import { Button } from './ui';

/** Records audio or video with the browser's MediaRecorder and hands back a Blob. */
export function Recorder({ kind, maxSeconds, onDone, label }: {
  kind: 'audio' | 'video'; maxSeconds: number; label?: string;
  onDone: (blob: Blob, seconds: number, ext: string) => void;
}) {
  const [state, setState] = useState<'idle' | 'count' | 'rec' | 'error'>('idle');
  const [count, setCount] = useState(0);
  const countTimer = useRef<number | null>(null);
  const [secs, setSecs] = useState(0);
  const [err, setErr] = useState('');
  const rec = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const preview = useRef<HTMLVideoElement | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<number | null>(null);
  const started = useRef(0);

  useEffect(() => () => stop(true), []); // eslint-disable-line react-hooks/exhaustive-deps

  const pickType = () => {
    const opts = kind === 'audio'
      ? ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']
      : ['video/webm;codecs=vp9,opus', 'video/webm', 'video/mp4'];
    return opts.find((t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) ?? '';
  };

  const start = async () => {
    setErr('');
    try {
      const s = await navigator.mediaDevices.getUserMedia(kind === 'audio' ? { audio: true } : { audio: true, video: { facingMode: 'user' } });
      stream.current = s;
      if (preview.current && kind === 'video') { preview.current.srcObject = s; preview.current.play().catch(() => {}); }
      // Video: show the camera with a 5-second countdown first, so people can get ready
      if (kind === 'video') {
        setState('count'); setCount(5);
        await new Promise<void>((resolve, reject) => {
          let n = 5;
          countTimer.current = window.setInterval(() => {
            if (!stream.current) { window.clearInterval(countTimer.current!); reject(new Error('cancelled')); return; }
            n -= 1;
            if (n <= 0) { window.clearInterval(countTimer.current!); countTimer.current = null; resolve(); }
            else setCount(n);
          }, 1000);
        });
      }
      const type = pickType();
      const r = new MediaRecorder(s, type ? { mimeType: type } : undefined);
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = () => {
        const mime = r.mimeType || (kind === 'audio' ? 'audio/webm' : 'video/webm');
        const blob = new Blob(chunks.current, { type: mime.split(';')[0] });
        const ext = mime.includes('mp4') ? (kind === 'audio' ? 'm4a' : 'mp4') : mime.includes('ogg') ? 'ogg' : 'webm';
        const seconds = Math.max(1, Math.round((Date.now() - started.current) / 1000));
        if (blob.size) onDone(blob, seconds, ext);
      };
      rec.current = r;
      started.current = Date.now();
      r.start(500);
      setState('rec');
      setSecs(0);
      timer.current = window.setInterval(() => {
        const s2 = Math.round((Date.now() - started.current) / 1000);
        setSecs(s2);
        if (s2 >= maxSeconds) stop();
      }, 250);
    } catch (e) {
      if (e instanceof Error && e.message === 'cancelled') { setState('idle'); return; }
      setState('error');
      setErr(kind === 'audio' ? 'Microphone access was blocked. Allow it in your browser settings.' : 'Camera access was blocked. Allow it in your browser settings, or upload a video instead.');
    }
  };

  const stop = (silent = false) => {
    if (timer.current) window.clearInterval(timer.current);
    if (countTimer.current) { window.clearInterval(countTimer.current); countTimer.current = null; }
    if (rec.current && rec.current.state !== 'inactive' && !silent) rec.current.stop();
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (!silent) setState('idle');
  };

  return (
    <div className="space-y-2">
      {kind === 'video' && (
        <div className={state === 'rec' || state === 'count' ? 'relative' : 'hidden'}>
          <video ref={preview} muted playsInline className="w-full max-h-72 rounded-xl bg-black object-cover" />
          {state === 'count' && (
            <div className="absolute inset-0 rounded-xl bg-black/40 flex flex-col items-center justify-center text-white">
              <span key={count} className="font-display text-7xl leading-none text-gold-soft animate-pulse">{count}</span>
              <span className="mt-2 text-xs">Get ready, recording starts soon</span>
            </div>
          )}
        </div>
      )}
      {state === 'count' ? (
        <Button type="button" variant="outline" onClick={() => { stop(true); setState('idle'); }}>Cancel</Button>
      ) : state !== 'rec' ? (
        <Button type="button" variant="outline" onClick={start}>
          {kind === 'audio' ? <Mic className="w-4 h-4" /> : <Video className="w-4 h-4" />}{label ?? 'Record'}
        </Button>
      ) : (
        <Button type="button" variant="danger" onClick={() => stop()}>
          <Square className="w-4 h-4" /> Stop · {secs}s / {maxSeconds}s <Circle className="w-2.5 h-2.5 fill-rose-500 text-rose-500 pulse-dot" />
        </Button>
      )}
      {err && <p className="text-xs text-rose-500">{err}</p>}
    </div>
  );
}
