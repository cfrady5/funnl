'use client';

import type { MediaRecord } from '@tiresias/render-worker/store';
import { Clapperboard, Loader2, Play, RotateCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/client';
import { Button, Input, Select } from './ui';

export function RunPipelineButton({ date, fromStep, label, size = 'default', variant = 'default' }: { date?: string; fromStep?: string; label?: string; size?: 'default' | 'sm'; variant?: 'default' | 'secondary' | 'ghost' }) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'busy' | 'queued' | string>('idle');
  return (
    <span className="inline-flex items-center gap-2">
      <Button
        size={size}
        variant={variant}
        disabled={state === 'busy'}
        onClick={async () => {
          setState('busy');
          try {
            await api('/api/pipeline', { method: 'POST', json: { date, fromStep } });
            setState('queued');
            router.refresh();
          } catch (e) {
            setState((e as Error).message);
          }
        }}
      >
        {state === 'busy' ? <Loader2 className="animate-spin" /> : fromStep ? <RotateCcw /> : <Play />}
        {label ?? (fromStep ? `Retry from ${fromStep}` : 'Run now')}
      </Button>
      {state === 'queued' ? <span className="text-xs text-accent">Queued on the worker</span> : null}
      {state !== 'idle' && state !== 'busy' && state !== 'queued' ? <span className="text-xs text-danger">{state}</span> : null}
    </span>
  );
}

export function DatePicker({ value, dates, basePath }: { value: string; dates: string[]; basePath: string }) {
  const router = useRouter();
  return (
    <div className="flex items-center gap-2">
      <Input type="date" value={value} className="h-8 w-40 text-xs" onChange={(e) => e.target.value && router.push(`${basePath}?date=${e.target.value}`)} />
      {dates.length ? (
        <Select className="h-8 w-40 text-xs" value={dates.includes(value) ? value : ''} onChange={(e) => e.target.value && router.push(`${basePath}?date=${e.target.value}`)}>
          <option value="">Ingested dates…</option>
          {dates.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </Select>
      ) : null}
    </div>
  );
}

export function CreateFromCandidate({ candidateId, media }: { candidateId: string; media: Array<Pick<MediaRecord, 'id' | 'originalName' | 'status'> & { publishable: boolean }> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mediaId, setMediaId] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ready = media.filter((m) => m.status === 'ready');
  if (!open) {
    return (
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <Clapperboard /> Create video
      </Button>
    );
  }
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line-2 bg-bg p-3">
      <div className="text-xs text-muted">
        Attach the authorised footage of this play. Discovery providers only give references and embeds, never files. Upload the clip in the library first if it isn’t there.
      </div>
      <div className="flex gap-2">
        <Select className="h-8 text-xs" value={mediaId} onChange={(e) => setMediaId(e.target.value)}>
          <option value="">Choose authorised clip…</option>
          {ready.map((m) => (
            <option key={m.id} value={m.id}>{m.originalName}{m.publishable ? '' : ' (internal preview only)'}</option>
          ))}
        </Select>
        <Button
          size="sm"
          disabled={!mediaId || busy}
          onClick={async () => {
            setBusy(true);
            setErr(null);
            try {
              const p = await api<{ id: string }>(`/api/candidates/${candidateId}/project`, { method: 'POST', json: { mediaId } });
              router.push(`/studio/${p.id}`);
            } catch (e) {
              setErr((e as Error).message);
              setBusy(false);
            }
          }}
        >
          {busy ? <Loader2 className="animate-spin" /> : null} Create
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
      {err ? <div className="text-xs text-danger">{err}</div> : null}
    </div>
  );
}
