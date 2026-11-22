'use client';

import {
  autoFraming,
  getTheme,
  OPTION_LABELS,
  TEXT_BUDGETS,
  validateSpec,
  withAutoFraming,
  type BrandId,
  type OptionLabel,
  type VideoSpec,
} from '@tiresias/core';
import type { JobRecord, MediaRecord, ProjectRecord, RenderRecord } from '@tiresias/render-worker/store';
import { AlertTriangle, CheckCircle2, Download, Film, Loader2, Plus, Save, ShieldAlert, Trash2, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, fileUrl, fmtAgo, fmtBytes } from '@/lib/client';
import { BrandBadge, ContentStatusBadge, JobStatusBadge, RightsBadge } from '../status';
import { Badge, Button, Card, CardBody, CardHeader, CardTitle, cn, Field, Input, Progress, Select, Textarea } from '../ui';
import { Preview } from './preview';
import { SourceStage } from './source-stage';

interface Data {
  project: ProjectRecord;
  media: MediaRecord | null;
  renders: RenderRecord[];
  jobs: JobRecord[];
}

const TABS = ['Text', 'Options', 'Player & cover', 'Framing & timing', 'Audio'] as const;

export function Editor({ initial }: { initial: Data }) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [spec, setSpec] = useState<VideoSpec>(initial.project.spec);
  const [cover, setCover] = useState(initial.project.cover);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'good' | 'bad'; text: string; list?: string[] } | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>('Text');
  const issues = useMemo(() => validateSpec(spec), [spec]);
  const errors = issues.filter((i) => i.severity === 'error');
  const theme = getTheme(spec.brand);
  const media = data.media;

  const update = useCallback((next: VideoSpec) => {
    setSpec((prev) => (prev.framing.mode === 'auto' && (next.options !== prev.options || next.handler !== prev.handler || next.freezeSec !== prev.freezeSec) ? withAutoFraming(next) : next));
    setDirty(true);
  }, []);

  const refresh = useCallback(async () => {
    const d = await api<Data>(`/api/projects/${data.project.id}`);
    setData(d);
    return d;
  }, [data.project.id]);

  const activeJob = data.jobs.find((j) => j.type === 'render_project' && (j.status === 'queued' || j.status === 'running'));
  const [wasActive, setWasActive] = useState(false);
  useEffect(() => {
    if (activeJob) setWasActive(true);
    else if (wasActive) {
      setWasActive(false);
      const r = data.renders[0];
      setMessage(r?.status === 'succeeded' ? { tone: r.qaPassed ? 'good' : 'bad', text: r.qaPassed ? 'Render finished — QA passed.' : 'Render finished but QA failed. See the QA report.' } : { tone: 'bad', text: `Render ${r?.status ?? 'failed'}${r?.error ? `: ${r.error}` : ''}` });
    }
  }, [activeJob, wasActive, data.renders]);
  useEffect(() => {
    if (!activeJob) return;
    const t = setInterval(() => void refresh(), 1500);
    return () => clearInterval(t);
  }, [activeJob, refresh]);

  const save = useCallback(async () => {
    setBusy('save');
    try {
      await api(`/api/projects/${data.project.id}`, { method: 'PATCH', json: { spec, cover } });
      setDirty(false);
      await refresh();
      setMessage({ tone: 'good', text: 'Saved.' });
    } catch (e) {
      setMessage({ tone: 'bad', text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }, [spec, cover, data.project.id, refresh]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save]);

  const render = async () => {
    setBusy('render');
    try {
      if (dirty) await api(`/api/projects/${data.project.id}`, { method: 'PATCH', json: { spec, cover } });
      setDirty(false);
      await api(`/api/projects/${data.project.id}/render`, { method: 'POST' });
      await refresh();
      setMessage({ tone: 'good', text: 'Render queued on the worker.' });
    } catch (e) {
      setMessage({ tone: 'bad', text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const decide = async (action: 'approve' | 'reject' | 'reopen') => {
    setBusy(action);
    try {
      const res = await fetch(`/api/projects/${data.project.id}/status`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action }) });
      const body = await res.json();
      if (!res.ok) setMessage({ tone: 'bad', text: body.error ?? 'Failed', list: body.blockers });
      else setMessage({ tone: 'good', text: `Project ${action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'reopened'}.` });
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!confirm('Delete this project? Renders stay on disk.')) return;
    await api(`/api/projects/${data.project.id}`, { method: 'DELETE' });
    router.push('/studio');
  };

  const latest = data.renders[0];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <div className="flex items-center gap-2">
            <BrandBadge brand={spec.brand} />
            <ContentStatusBadge status={data.project.status} />
            {media ? <RightsBadge rights={media.rights} /> : null}
            {dirty ? <Badge tone="warn">unsaved</Badge> : null}
          </div>
          <h1 className="mt-2 text-xl font-extrabold tracking-tight">{spec.contentId}</h1>
          <div className="text-xs text-faint">{data.project.title}</div>
        </div>
        <Button variant="secondary" onClick={() => void save()} disabled={!!busy || !dirty}>
          {busy === 'save' ? <Loader2 className="animate-spin" /> : <Save />} Save
        </Button>
        <Button onClick={() => void render()} disabled={!!busy || errors.length > 0 || !!activeJob} title={errors.length ? 'Fix blocking issues first' : undefined}>
          {busy === 'render' || activeJob ? <Loader2 className="animate-spin" /> : <Film />} {activeJob ? 'Rendering…' : 'Render MP4 + cover'}
        </Button>
      </div>

      {message ? (
        <div className={cn('rounded-lg border px-4 py-3 text-sm', message.tone === 'good' ? 'border-accent/30 bg-accent/5 text-accent' : 'border-danger/30 bg-danger/5 text-danger')}>
          {message.text}
          {message.list?.length ? (
            <ul className="mt-2 list-disc pl-5 text-muted">
              {message.list.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Source footage</CardTitle>
              <span className="font-mono text-[11px] text-faint">
                {media?.probe ? `${media.probe.width}×${media.probe.height} · ${media.probe.fps.toFixed(2)} fps · ${media.probe.durationSec.toFixed(2)}s` : ''}
              </span>
            </CardHeader>
            <CardBody>
              {media?.key ? (
                <SourceStage spec={spec} src={fileUrl(media.key)} cuts={media.probe?.cuts ?? []} onChange={update} />
              ) : (
                <div className="text-sm text-muted">Source media is still processing — refresh in a moment.</div>
              )}
            </CardBody>
          </Card>

          <Card>
            <div className="flex gap-1 border-b border-line px-3 pt-3">
              {TABS.map((t) => (
                <button key={t} onClick={() => setTab(t)} className={cn('rounded-t-md px-3 py-2 text-xs font-bold', tab === t ? 'bg-panel-2 text-ink' : 'text-muted hover:text-ink')}>
                  {t}
                </button>
              ))}
            </div>
            <CardBody className="grid gap-4">
              {tab === 'Text' ? <TextTab spec={spec} update={update} /> : null}
              {tab === 'Options' ? <OptionsTab spec={spec} update={update} /> : null}
              {tab === 'Player & cover' ? (
                <PlayerTab
                  spec={spec}
                  update={update}
                  cover={cover}
                  setCover={(c) => {
                    setCover(c);
                    setDirty(true);
                  }}
                />
              ) : null}
              {tab === 'Framing & timing' ? <FramingTab spec={spec} update={update} /> : null}
              {tab === 'Audio' ? <AudioTab spec={spec} update={update} /> : null}
            </CardBody>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Live preview</CardTitle>
              <Select
                className="h-8 w-40 text-xs"
                value={spec.brand}
                onChange={(e) => {
                  const brand = e.target.value as BrandId;
                  const t = getTheme(brand);
                  update({ ...spec, brand, text: { ...spec.text, decisionPrompt: t.copy.decisionPrompt, engagementPrimary: t.copy.engagementPrimary, verdict: brand === 'antitiresias' ? spec.text.verdict ?? 'GENERATIONAL COURT VISION.' : null } });
                }}
              >
                <option value="tiresias">Tiresias</option>
                <option value="antitiresias">AntiTiresias</option>
              </Select>
            </CardHeader>
            <CardBody>
              <Preview spec={spec} onChange={update} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Checks</CardTitle>
              {errors.length ? <Badge tone="bad">{errors.length} blocking</Badge> : <Badge tone="good">renderable</Badge>}
            </CardHeader>
            <CardBody className="flex flex-col gap-2 text-sm">
              {issues.length === 0 ? <div className="flex items-center gap-2 text-accent"><CheckCircle2 className="size-4" /> No issues.</div> : null}
              {issues.map((i) => (
                <div key={i.code + i.message} className="flex gap-2">
                  {i.severity === 'error' ? <XCircle className="mt-0.5 size-4 shrink-0 text-danger" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" />}
                  <span className="text-muted">{i.message}</span>
                </div>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Renders</CardTitle>
              <span className="text-xs text-faint">{data.renders.length} total</span>
            </CardHeader>
            <CardBody className="flex flex-col gap-4">
              {activeJob ? (
                <div>
                  <div className="mb-1.5 flex justify-between text-xs text-muted">
                    <span>Job {activeJob.status} (attempt {activeJob.attempts}/{activeJob.maxAttempts})</span>
                    <span className="font-mono">{Math.round(activeJob.progress * 100)}%</span>
                  </div>
                  <Progress value={activeJob.progress} />
                  {activeJob.status === 'queued' ? <div className="mt-2 text-xs text-warn">Waiting for a worker. Start one with <code className="font-mono">npm run worker</code>.</div> : null}
                </div>
              ) : null}
              {latest ? <RenderCard r={latest} contentId={spec.contentId} /> : <div className="text-sm text-muted">No renders yet.</div>}
              {data.renders.slice(1, 4).map((r) => (
                <div key={r.id} className="flex items-center justify-between text-xs text-faint">
                  <span>{fmtAgo(r.createdAt)}</span>
                  <JobStatusBadge status={r.status} />
                  {r.videoKey ? <a className="text-info hover:underline" href={fileUrl(r.videoKey)}>MP4</a> : <span>—</span>}
                </div>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Editorial decision</CardTitle>
            </CardHeader>
            <CardBody className="flex flex-col gap-3">
              <p className="text-xs text-muted">Approval requires a QA-passing render and footage rights that allow social publication. Synthetic demo footage is owned outright.</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => void decide('approve')} disabled={!!busy || dirty}><ShieldAlert /> Approve</Button>
                <Button size="sm" variant="destructive" onClick={() => void decide('reject')} disabled={!!busy}>Reject</Button>
                <Button size="sm" variant="ghost" onClick={() => void decide('reopen')} disabled={!!busy}>Reopen</Button>
                <Button size="sm" variant="ghost" className="ml-auto text-danger" onClick={() => void remove()}><Trash2 /></Button>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
      <div className="hidden" aria-hidden>{theme.name}</div>
    </div>
  );
}

function RenderCard({ r, contentId }: { r: RenderRecord; contentId: string }) {
  const qa = r.qa as { video?: { checks: Array<{ id: string; status: string; detail: string }> }; cover?: { checks: Array<{ id: string; status: string; detail: string }> } } | null;
  const checks = [...(qa?.video?.checks ?? []), ...(qa?.cover?.checks ?? [])];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <JobStatusBadge status={r.status} />
        {r.qaPassed === true ? <Badge tone="good">QA passed</Badge> : r.qaPassed === false ? <Badge tone="bad">QA failed</Badge> : null}
        <span className="ml-auto text-xs text-faint">{fmtAgo(r.finishedAt ?? r.createdAt)}</span>
      </div>
      {r.status === 'rendering' ? <Progress value={r.progress} /> : null}
      {r.error ? <div className="text-xs text-danger">{r.error}</div> : null}
      {r.videoKey ? (
        <>
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <video src={fileUrl(r.videoKey)} controls className="w-full rounded-lg border border-line" style={{ aspectRatio: '9/16' }} />
            {r.coverKey ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={fileUrl(r.coverKey)} alt="Cover" className="w-24 rounded-lg border border-line" style={{ aspectRatio: '9/16', objectFit: 'cover' }} />
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="secondary"><a href={`${fileUrl(r.videoKey)}?download=${contentId}.mp4`}><Download /> MP4</a></Button>
            {r.coverKey ? <Button asChild size="sm" variant="secondary"><a href={`${fileUrl(r.coverKey)}?download=${contentId}-cover.png`}><Download /> Cover PNG</a></Button> : null}
            {r.contactSheetKey ? <Button asChild size="sm" variant="ghost"><a href={fileUrl(r.contactSheetKey)} target="_blank">Contact sheet</a></Button> : null}
          </div>
          <div className="font-mono text-[11px] text-faint">
            {fmtBytes(r.bytes)} · {r.renderMs ? `${(r.renderMs / 1000).toFixed(0)}s render` : ''} · est. ${r.estimatedCostUsd?.toFixed(4) ?? '—'} · spec {r.specHash}
          </div>
        </>
      ) : null}
      {checks.length ? (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted">QA report ({checks.filter((c) => c.status === 'pass').length}/{checks.length} pass)</summary>
          <ul className="mt-2 flex flex-col gap-1">
            {checks.map((c) => (
              <li key={c.id} className="flex gap-2">
                <span className={cn('w-10 font-mono font-bold uppercase', c.status === 'pass' ? 'text-accent' : c.status === 'warn' ? 'text-warn' : 'text-danger')}>{c.status}</span>
                <span className="text-muted">{c.id}: {c.detail}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

type TabProps = { spec: VideoSpec; update: (s: VideoSpec) => void };

function TextTab({ spec, update }: TabProps) {
  const set = (k: keyof VideoSpec['text'], v: string) => update({ ...spec, text: { ...spec.text, [k]: v } });
  return (
    <>
      <Field label="Hook (0–3s)" counter={[spec.text.hook.length, TEXT_BUDGETS.hook]}>
        <Input value={spec.text.hook} maxLength={64} onChange={(e) => set('hook', e.target.value)} />
      </Field>
      <Field label="Decision prompt" counter={[spec.text.decisionPrompt.length, TEXT_BUDGETS.decisionPrompt]}>
        <Input value={spec.text.decisionPrompt} maxLength={40} onChange={(e) => set('decisionPrompt', e.target.value)} />
      </Field>
      <Field
        label={spec.brand === 'tiresias' ? 'Tactical explanation' : 'Commentary'}
        counter={[spec.text.explanation.length, TEXT_BUDGETS.explanation]}
        hint="State only what the footage shows. Don't call a read optimal unless the evidence supports it. Mock the decision, not the person."
      >
        <Textarea rows={3} value={spec.text.explanation} maxLength={200} onChange={(e) => set('explanation', e.target.value)} />
      </Field>
      {spec.brand === 'antitiresias' ? (
        <Field label="Verdict stamp" counter={[(spec.text.verdict ?? '').length, TEXT_BUDGETS.verdict]}>
          <Input value={spec.text.verdict ?? ''} maxLength={40} onChange={(e) => update({ ...spec, text: { ...spec.text, verdict: e.target.value || null } })} />
        </Field>
      ) : null}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Engagement line 1">
          <Input value={spec.text.engagementPrimary} maxLength={40} onChange={(e) => set('engagementPrimary', e.target.value)} />
        </Field>
        <Field label="Engagement line 2">
          <Input value={spec.text.engagementSecondary} maxLength={40} onChange={(e) => set('engagementSecondary', e.target.value)} />
        </Field>
      </div>
    </>
  );
}

function OptionsTab({ spec, update }: TabProps) {
  const theme = getTheme(spec.brand);
  const setOpt = (label: OptionLabel, patch: Partial<VideoSpec['options'][number]>) => update({ ...spec, options: spec.options.map((o) => (o.label === label ? { ...o, ...patch } : o)) });
  const add = () => {
    const label = OPTION_LABELS[spec.options.length];
    if (!label) return;
    update({ ...spec, options: [...spec.options, { label, description: 'New option', x: 0.5, y: 0.5, playerName: null, origin: 'manual', confidence: 1, labelDx: 0, labelDy: 0, reasoning: null }] });
  };
  const removeOpt = (label: OptionLabel) => {
    const kept = spec.options.filter((o) => o.label !== label).map((o, i) => ({ ...o, label: OPTION_LABELS[i] }));
    const relabel = (l: OptionLabel | 'unknown') => {
      if (l === 'unknown') return l;
      const idx = spec.options.filter((o) => o.label !== label).findIndex((o) => o.label === l);
      return idx >= 0 ? OPTION_LABELS[idx] : 'A';
    };
    update({ ...spec, options: kept, assessment: { ...spec.assessment, actual: relabel(spec.assessment.actual) as OptionLabel, bestSupported: relabel(spec.assessment.bestSupported) } });
  };
  return (
    <>
      <div className="grid grid-cols-3 gap-4">
        <Field label="Actual pass (verified)">
          <Select value={spec.assessment.actual} onChange={(e) => update({ ...spec, assessment: { ...spec.assessment, actual: e.target.value as OptionLabel } })}>
            {spec.options.map((o) => <option key={o.label} value={o.label}>{o.label} — {o.description}</option>)}
          </Select>
        </Field>
        <Field label="Best-supported option">
          <Select value={spec.assessment.bestSupported} onChange={(e) => update({ ...spec, assessment: { ...spec.assessment, bestSupported: e.target.value as OptionLabel | 'unknown' } })}>
            <option value="unknown">Unclear / ambiguous</option>
            {spec.options.map((o) => <option key={o.label} value={o.label}>{o.label} — {o.description}</option>)}
          </Select>
        </Field>
        <Field label="Decision quality">
          <Select value={spec.assessment.decisionQuality} onChange={(e) => update({ ...spec, assessment: { ...spec.assessment, decisionQuality: e.target.value as VideoSpec['assessment']['decisionQuality'] } })}>
            <option value="unclear">Unclear</option>
            <option value="good">Good read</option>
            <option value="reasonable">Reasonable (unlucky outcome)</option>
            <option value="poor">Poor read</option>
          </Select>
        </Field>
      </div>
      <div className="flex flex-col gap-2">
        {spec.options.map((o) => (
          <div key={o.label} className="grid grid-cols-[32px_1fr_160px_auto] items-center gap-3 rounded-lg border border-line bg-bg/50 p-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md text-sm font-extrabold text-black" style={{ background: theme.optionColors[o.label] }}>{o.label}</div>
            <Input value={o.description} maxLength={48} onChange={(e) => setOpt(o.label, { description: e.target.value })} placeholder="On-screen description" />
            <Input value={o.playerName ?? ''} maxLength={40} onChange={(e) => setOpt(o.label, { playerName: e.target.value || null })} placeholder="Player (optional)" />
            <div className="flex items-center gap-2">
              {o.origin === 'auto' ? <Badge tone="info">auto {Math.round(o.confidence * 100)}%</Badge> : null}
              <span className="font-mono text-[10px] text-faint">{o.x.toFixed(3)},{o.y.toFixed(3)}</span>
              <Button size="icon" variant="ghost" disabled={spec.options.length <= 2} onClick={() => removeOpt(o.label)} title="Remove option"><Trash2 /></Button>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <Button size="sm" variant="secondary" onClick={add} disabled={spec.options.length >= 4}><Plus /> Add option</Button>
        <label className="flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" checked={!!spec.handler} onChange={(e) => update({ ...spec, handler: e.target.checked ? { x: 0.5, y: 0.6 } : null })} /> Show ball handler + sightlines
        </label>
      </div>
    </>
  );
}

function PlayerTab({ spec, update, cover, setCover }: TabProps & { cover: ProjectRecord['cover']; setCover: (c: ProjectRecord['cover']) => void }) {
  const setP = (k: keyof VideoSpec['player'], v: string) => update({ ...spec, player: { ...spec.player, [k]: v || (k === 'name' || k === 'teamAbbr' ? v : null) } });
  return (
    <>
      <div className="rounded-lg border border-warn/25 bg-warn/5 px-3 py-2 text-xs text-muted">
        Names and statistics must come from a verified source. Once the stats provider is connected (Phase 2) these fields are filled from stored box scores.
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Player name"><Input value={spec.player.name} maxLength={40} onChange={(e) => setP('name', e.target.value)} /></Field>
        <Field label="Team abbr."><Input value={spec.player.teamAbbr} maxLength={4} onChange={(e) => setP('teamAbbr', e.target.value.toUpperCase())} /></Field>
        <Field label="Stat line (video)"><Input value={spec.player.statLine ?? ''} maxLength={40} onChange={(e) => setP('statLine', e.target.value)} placeholder="13 AST · 24 PTS" /></Field>
        <Field label="Game label"><Input value={spec.player.gameLabel ?? ''} maxLength={40} onChange={(e) => setP('gameLabel', e.target.value)} placeholder="DEN vs LAL" /></Field>
      </div>
      <div className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-muted">Cover</div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Cover headline"><Input value={cover.headline ?? ''} maxLength={40} placeholder={spec.brand === 'tiresias' ? 'CAN YOU SEE THE PASS?' : 'SEE ABSOLUTELY NOTHING'} onChange={(e) => setCover({ ...cover, headline: e.target.value || undefined })} /></Field>
        <Field label="Series title"><Input value={cover.seriesTitle ?? ''} maxLength={32} placeholder={getTheme(spec.brand).seriesTitle} onChange={(e) => setCover({ ...cover, seriesTitle: e.target.value || undefined })} /></Field>
        <Field label="Verified stat value"><Input type="number" min={0} max={99} value={cover.statValue ?? ''} onChange={(e) => setCover({ ...cover, statValue: e.target.value === '' ? null : Number(e.target.value) })} /></Field>
        <Field label="Stat label"><Input value={cover.statLabel ?? ''} maxLength={32} placeholder="ASSISTS LAST NIGHT" onChange={(e) => setCover({ ...cover, statLabel: e.target.value || undefined })} /></Field>
      </div>
      <div className="text-xs text-faint">No headshot is attached: covers use the typography-only layout. Headshots need an authorised image with rights recorded (see Integrations).</div>
    </>
  );
}

function FramingTab({ spec, update }: TabProps) {
  const kf = spec.framing.keyframes[0];
  const setKf = (patch: Partial<typeof kf>) => update({ ...spec, framing: { mode: 'manual', keyframes: [{ ...kf, ...patch, t: spec.freezeSec }] } });
  const setT = (k: keyof VideoSpec['timing'], v: number) => update({ ...spec, timing: { ...spec.timing, [k]: v } });
  return (
    <>
      <div className="flex items-center gap-3">
        <Badge tone={spec.framing.mode === 'auto' ? 'good' : 'neutral'}>{spec.framing.mode} framing</Badge>
        <Button size="sm" variant="secondary" onClick={() => update({ ...spec, framing: { mode: 'auto', keyframes: [autoFraming(spec.source, [...(spec.handler ? [spec.handler] : []), ...spec.options], { t: spec.freezeSec })] } })}>
          Auto-fit to options
        </Button>
        <span className="text-xs text-faint">Auto keeps every option and the handler inside the 9:16 panel.</span>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Field label={`Zoom ${kf.zoom.toFixed(2)}×`}><input type="range" min={1} max={2.6} step={0.01} value={kf.zoom} onChange={(e) => setKf({ zoom: Number(e.target.value) })} /></Field>
        <Field label={`Focus X ${kf.focusX.toFixed(2)}`}><input type="range" min={0} max={1} step={0.005} value={kf.focusX} onChange={(e) => setKf({ focusX: Number(e.target.value) })} /></Field>
        <Field label={`Focus Y ${kf.focusY.toFixed(2)}`}><input type="range" min={0} max={1} step={0.005} value={kf.focusY} onChange={(e) => setKf({ focusY: Number(e.target.value) })} /></Field>
      </div>
      <div className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-muted">Scene timing (seconds)</div>
      <div className="grid grid-cols-3 gap-4">
        {(['hook', 'decision', 'countdown', 'reveal', 'explanation', 'outro'] as const).map((k) => (
          <Field key={k} label={k}>
            <Input type="number" step={k === 'countdown' ? 1 : 0.5} min={1} max={10} value={spec.timing[k]} onChange={(e) => setT(k, Number(e.target.value))} />
          </Field>
        ))}
        <Field label="Replay speed"><Input type="number" step={0.05} min={0.25} max={1} value={spec.timing.replayRate} onChange={(e) => setT('replayRate', Number(e.target.value))} /></Field>
        <Field label="Replay lead-in"><Input type="number" step={0.1} min={0} max={4} value={spec.timing.replayLeadIn} onChange={(e) => setT('replayLeadIn', Number(e.target.value))} /></Field>
        <Field label="Reveal hold"><Input type="number" step={0.1} min={0} max={2} value={spec.timing.revealHold} onChange={(e) => setT('revealHold', Number(e.target.value))} /></Field>
      </div>
    </>
  );
}

function AudioTab({ spec, update }: TabProps) {
  const a = spec.audio;
  return (
    <>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={a.sfx} onChange={(e) => update({ ...spec, audio: { ...a, sfx: e.target.checked } })} /> Sound design (generated in-house — no licensing needed)
      </label>
      <div className="grid grid-cols-2 gap-4">
        <Field label={`SFX volume ${Math.round(a.sfxVolume * 100)}%`}><input type="range" min={0} max={1} step={0.05} value={a.sfxVolume} onChange={(e) => update({ ...spec, audio: { ...a, sfxVolume: Number(e.target.value) } })} /></Field>
        <Field label={`Source audio ${Math.round(a.sourceVolume * 100)}%`} hint="Off by default: broadcast audio often carries separate rights."><input type="range" min={0} max={1} step={0.05} value={a.sourceVolume} onChange={(e) => update({ ...spec, audio: { ...a, sourceVolume: Number(e.target.value) } })} /></Field>
      </div>
      <div className="text-xs text-faint">Music and voice-over tracks are supported by the renderer (with automatic ducking and −14 LUFS loudness normalisation) but need a licensed source; none is configured.</div>
    </>
  );
}
