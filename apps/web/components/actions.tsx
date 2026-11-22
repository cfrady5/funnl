'use client';

import { MediaRightsSchema, RIGHTS_STATUSES, USAGE_TYPES, type MediaRights } from '@tiresias/core';
import type { MediaRecord, SettingsRecord } from '@tiresias/render-worker/store';
import { Loader2, RefreshCw, Sparkles, Upload, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { Button, Field, Input, Select, Textarea } from './ui';

export function AutoRefresh({ everyMs = 3000 }: { everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), everyMs);
    return () => clearInterval(t);
  }, [router, everyMs]);
  return null;
}

export function SeedDemoButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-center gap-2">
      <Button
        variant="secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setErr(null);
          try {
            await api('/api/demo', { method: 'POST' });
            router.refresh();
          } catch (e) {
            setErr((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? <Loader2 className="animate-spin" /> : <Sparkles />} Load synthetic demo projects
      </Button>
      {err ? <div className="text-xs text-danger">{err}</div> : null}
    </div>
  );
}

export function NewProject({ media }: { media: Array<Pick<MediaRecord, 'id' | 'originalName' | 'status'>> }) {
  const router = useRouter();
  const ready = media.filter((m) => m.status === 'ready');
  const [mediaId, setMediaId] = useState(ready[0]?.id ?? '');
  const [brand, setBrand] = useState<'tiresias' | 'antitiresias'>('tiresias');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!ready.length) return <div className="text-sm text-muted">Upload a clip in Play Discovery first.</div>;
  return (
    <div className="flex flex-wrap items-end gap-3">
      <Field label="Clip" className="min-w-64">
        <Select value={mediaId} onChange={(e) => setMediaId(e.target.value)}>
          {ready.map((m) => (
            <option key={m.id} value={m.id}>{m.originalName}</option>
          ))}
        </Select>
      </Field>
      <Field label="Brand">
        <Select value={brand} onChange={(e) => setBrand(e.target.value as typeof brand)}>
          <option value="tiresias">Tiresias · Court Vision</option>
          <option value="antitiresias">AntiTiresias · Negative Court Vision</option>
        </Select>
      </Field>
      <Button
        disabled={busy || !mediaId}
        onClick={async () => {
          setBusy(true);
          try {
            const p = await api<{ id: string }>('/api/projects', { method: 'POST', json: { mediaId, brand } });
            router.push(`/studio/${p.id}`);
          } catch (e) {
            setErr((e as Error).message);
            setBusy(false);
          }
        }}
      >
        Create project
      </Button>
      {err ? <div className="text-xs text-danger">{err}</div> : null}
    </div>
  );
}

const EMPTY_RIGHTS = MediaRightsSchema.parse({});

function RightsFields({ value, onChange }: { value: MediaRights; onChange: (r: MediaRights) => void }) {
  const set = <K extends keyof MediaRights>(k: K, v: MediaRights[K]) => onChange({ ...value, [k]: v });
  return (
    <div className="grid grid-cols-2 gap-4">
      <Field label="Rights status">
        <Select value={value.status} onChange={(e) => set('status', e.target.value as MediaRights['status'])}>
          {RIGHTS_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </Select>
      </Field>
      <Field label="Rights holder"><Input value={value.rightsHolder ?? ''} onChange={(e) => set('rightsHolder', e.target.value || null)} placeholder="Who owns the footage" /></Field>
      <Field label="Licence / permission reference"><Input value={value.licenseReference ?? ''} onChange={(e) => set('licenseReference', e.target.value || null)} placeholder="Contract no., email thread, etc." /></Field>
      <Field label="Source URL / identifier"><Input value={value.sourceUrl ?? ''} onChange={(e) => set('sourceUrl', e.target.value || null)} /></Field>
      <Field label="Allowed uses" className="col-span-2">
        <div className="flex gap-4 text-sm">
          {USAGE_TYPES.map((u) => (
            <label key={u} className="flex items-center gap-2">
              <input type="checkbox" checked={value.allowedUses.includes(u)} onChange={(e) => set('allowedUses', e.target.checked ? [...value.allowedUses, u] : value.allowedUses.filter((x) => x !== u))} />
              {u.replace(/_/g, ' ')}
            </label>
          ))}
        </div>
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={value.redistributionPermitted} onChange={(e) => set('redistributionPermitted', e.target.checked)} /> Public redistribution permitted
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={value.attributionRequired} onChange={(e) => set('attributionRequired', e.target.checked)} /> Attribution required
      </label>
      {value.attributionRequired ? <Field label="Attribution text" className="col-span-2"><Input value={value.attributionText ?? ''} onChange={(e) => set('attributionText', e.target.value || null)} /></Field> : null}
      <Field label="Expires (optional)"><Input type="date" value={value.expiresAt?.slice(0, 10) ?? ''} onChange={(e) => set('expiresAt', e.target.value ? new Date(e.target.value).toISOString() : null)} /></Field>
      <Field label="Verified by"><Input value={value.verifiedBy ?? ''} onChange={(e) => set('verifiedBy', e.target.value || null)} placeholder="Your name" /></Field>
      <Field label="Notes" className="col-span-2"><Textarea rows={2} value={value.notes ?? ''} onChange={(e) => set('notes', e.target.value || null)} /></Field>
    </div>
  );
}

export function UploadForm() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [rights, setRights] = useState<MediaRights>(EMPTY_RIGHTS);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null);
  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!file) return;
        setBusy(true);
        setMsg(null);
        try {
          const fd = new FormData();
          fd.append('file', file);
          fd.append('rights', JSON.stringify(rights));
          const res = await fetch('/api/media', { method: 'POST', body: fd });
          const body = await res.json();
          if (!res.ok) throw new Error(body.error);
          setMsg({ tone: 'good', text: body.duplicate ? 'This exact file is already in the library.' : 'Uploaded. The worker will validate and normalise it.' });
          setFile(null);
          router.refresh();
        } catch (err) {
          setMsg({ tone: 'bad', text: (err as Error).message });
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line-2 bg-bg/40 px-6 py-8 text-center hover:border-accent/50">
        <Upload className="size-5 text-accent" />
        <span className="text-sm font-semibold">{file ? file.name : 'Choose an authorised clip (MP4, MOV, WebM · ≤1 GB · 1–180 s)'}</span>
        <span className="text-xs text-faint">The file is stored privately and normalised to 30 fps for frame-accurate editing.</span>
        <input type="file" accept="video/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>
      <RightsFields value={rights} onChange={setRights} />
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={!file || busy}>{busy ? <Loader2 className="animate-spin" /> : <Upload />} Upload clip</Button>
        {msg ? <span className={msg.tone === 'good' ? 'text-sm text-accent' : 'text-sm text-danger'}>{msg.text}</span> : null}
      </div>
    </form>
  );
}

export function RightsEditor({ media }: { media: MediaRecord }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rights, setRights] = useState<MediaRights>(media.rights);
  const [err, setErr] = useState<string | null>(null);
  if (!open) return <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>Edit rights</Button>;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6" onClick={() => setOpen(false)}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-xl border border-line bg-panel p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-bold">Rights · {media.originalName}</h3>
          <Button size="icon" variant="ghost" onClick={() => setOpen(false)}><X /></Button>
        </div>
        <RightsFields value={rights} onChange={setRights} />
        <div className="mt-5 flex items-center gap-3">
          <Button
            onClick={async () => {
              try {
                await api(`/api/media/${media.id}`, { method: 'PATCH', json: { rights } });
                setOpen(false);
                router.refresh();
              } catch (e) {
                setErr((e as Error).message);
              }
            }}
          >
            Save rights
          </Button>
          {err ? <span className="text-sm text-danger">{err}</span> : null}
        </div>
      </div>
    </div>
  );
}

export function JobActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const act = async (action: 'cancel' | 'retry') => {
    await api(`/api/jobs/${id}`, { method: 'POST', json: { action } }).catch(() => undefined);
    router.refresh();
  };
  return (
    <div className="flex gap-1">
      {status === 'queued' || status === 'running' ? <Button size="sm" variant="ghost" onClick={() => void act('cancel')}>Cancel</Button> : null}
      {status === 'failed' || status === 'cancelled' ? <Button size="sm" variant="ghost" onClick={() => void act('retry')}><RefreshCw /> Retry</Button> : null}
    </div>
  );
}

export function SettingsForm({ settings }: { settings: SettingsRecord }) {
  const router = useRouter();
  const [s, setS] = useState(settings);
  const [msg, setMsg] = useState<string | null>(null);
  const num = (k: keyof SettingsRecord) => (e: React.ChangeEvent<HTMLInputElement>) => setS({ ...s, [k]: Number(e.target.value) });
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-3 gap-4">
        <Field label="Daily run time (America/New_York)"><Input type="time" value={s.dailyRunTime} onChange={(e) => setS({ ...s, dailyRunTime: e.target.value })} /></Field>
        <Field label="Tiresias videos / day"><Input type="number" min={0} max={10} value={s.tiresiasPerDay} onChange={num('tiresiasPerDay')} /></Field>
        <Field label="AntiTiresias videos / day (max)"><Input type="number" min={0} max={10} value={s.antiTiresiasPerDay} onChange={num('antiTiresiasPerDay')} /></Field>
        <Field label="Selection mode">
          <Select value={s.selectionMode} onChange={(e) => setS({ ...s, selectionMode: e.target.value as SettingsRecord['selectionMode'] })}>
            <option value="one_per_player">One per top-5 assist leader</option>
            <option value="best_from_pool">Best 5 clips from top-15 leaders</option>
          </Select>
        </Field>
        <Field label="Automation level">
          <Select value={s.automationLevel} onChange={(e) => setS({ ...s, automationLevel: e.target.value as SettingsRecord['automationLevel'] })}>
            <option value="manual">Manual (download only)</option>
            <option value="approval_required">Approval required</option>
            <option value="automatic" disabled>Automatic (needs verified publishing integration)</option>
          </Select>
        </Field>
        <Field label="Min. clip quality score"><Input type="number" min={0} max={100} value={s.minQualityScore} onChange={num('minQualityScore')} /></Field>
        <Field label="Daily budget (USD)"><Input type="number" min={0} step={0.5} value={s.dailyBudgetUsd} onChange={num('dailyBudgetUsd')} /></Field>
        <Field label="Monthly budget (USD)"><Input type="number" min={0} step={5} value={s.monthlyBudgetUsd} onChange={num('monthlyBudgetUsd')} /></Field>
        <Field label="Worker cost / hour (USD)" hint="Used to estimate per-render cost."><Input type="number" min={0} step={0.01} value={s.workerCostPerHourUsd} onChange={num('workerCostPerHourUsd')} /></Field>
        <Field label="Max job attempts"><Input type="number" min={1} max={10} value={s.maxJobAttempts} onChange={num('maxJobAttempts')} /></Field>
      </div>
      <div className="flex items-center gap-3">
        <Button
          onClick={async () => {
            try {
              const { timezone: _tz, ...patch } = s;
              await api('/api/settings', { method: 'PATCH', json: patch });
              setMsg('Saved.');
              router.refresh();
            } catch (e) {
              setMsg((e as Error).message);
            }
          }}
        >
          Save settings
        </Button>
        {msg ? <span className="text-sm text-muted">{msg}</span> : null}
      </div>
    </div>
  );
}
