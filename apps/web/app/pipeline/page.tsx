import { dueScheduleSlots, nextDailyRun, previousGameDate, RETRY_LADDER_MINUTES } from '@tiresias/core';
import { listRuns, PIPELINE_STEPS, STEP_LABELS } from '@tiresias/data';
import Link from 'next/link';
import { AutoRefresh } from '@/components/actions';
import { RunPipelineButton } from '@/components/nba';
import { DbNotConfigured } from '@/components/nba-views';
import { JobStatusBadge } from '@/components/status';
import { Badge, Card, CardBody, CardHeader, CardTitle, EmptyState, PageHeader } from '@/components/ui';
import { fmtAgo } from '@/lib/client';
import { withDb } from '@/lib/data';
import { readDb } from '@/lib/server';

export const dynamic = 'force-dynamic';

function outputSummary(step: string, o: Record<string, unknown> | null): string {
  if (!o || !Object.keys(o).length) return '';
  switch (step) {
    case 'games': return `${o.games} games · ${o.final} final`;
    case 'box_scores': return `${o.players} player lines · ${(o.unverifiedGames as string[] | undefined)?.length ? `${(o.unverifiedGames as string[]).length} unverified` : 'all games verified'}`;
    case 'leaders': return ((o.assistLeaders as string[]) ?? []).slice(0, 3).join(' · ');
    case 'plays': return `${o.plays} plays from ${o.games} games`;
    case 'events': return `${o.assists} assists · ${o.turnovers} turnovers · ${(o.gamesWithAssistMismatch as string[] | undefined)?.length ? `${(o.gamesWithAssistMismatch as string[]).length} games ≠ box` : 'all reconcile with box'}`;
    case 'clips': return Object.entries(o).map(([k, v]) => `${k}: ${(v as { status: string; references?: number }).status}${(v as { references?: number }).references != null ? ` (${(v as { references: number }).references})` : ''}`).join(' · ');
    case 'links': return `${o.linked} of ${o.playLevelClips} play-level clips linked`;
    case 'candidates': return `${o.candidates} candidate plays scored`;
    default: return JSON.stringify(o).slice(0, 120);
  }
}

export default async function Pipeline() {
  const { settings, jobs } = await readDb();
  const now = new Date();
  const gameDate = previousGameDate(now);
  const next = nextDailyRun(now, settings.dailyRunTime, settings.timezone);
  const due = dueScheduleSlots(now, settings.dailyRunTime, settings.timezone);
  const res = await withDb((db) => listRuns(db, 14));
  const active = jobs.some((j) => j.type === 'daily_ingest' && (j.status === 'queued' || j.status === 'running'));
  const workerConfigured = Boolean(process.env.BALLDONTLIE_API_KEY);

  return (
    <>
      {active ? <AutoRefresh everyMs={2500} /> : null}
      <PageHeader
        title="Daily Pipeline"
        description="The morning NBA workflow. Every stage is checkpointed in the database: a failed or stale stage can be re-run on its own without repeating the stages before it."
        actions={<RunPipelineButton date={gameDate} label={`Run now for ${gameDate}`} />}
      />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="px-5 py-4"><div className="text-[11px] uppercase tracking-wider text-muted">Game date to process</div><div className="mt-2 font-mono text-2xl">{gameDate}</div></Card>
        <Card className="px-5 py-4"><div className="text-[11px] uppercase tracking-wider text-muted">Next scheduled run</div><div className="mt-2 font-mono text-lg">{next.toLocaleString('en-US', { timeZone: settings.timezone, dateStyle: 'medium', timeStyle: 'short' })} ET</div></Card>
        <Card className="px-5 py-4"><div className="text-[11px] uppercase tracking-wider text-muted">Retry ladder (late / incomplete games)</div><div className="mt-2 font-mono text-sm">{RETRY_LADDER_MINUTES.map((m) => `+${m}m`).join(' · ')}</div><div className="mt-1 text-xs text-faint">{due.slots.length ? `due today: ${due.slots.join(', ')}` : 'none due yet today'}</div></Card>
        <Card className="px-5 py-4"><div className="text-[11px] uppercase tracking-wider text-muted">Web process credentials</div><div className="mt-2 text-sm">{workerConfigured ? <Badge tone="good">stats key present</Badge> : <Badge tone="warn">no stats key in web env</Badge>}</div><div className="mt-1 text-xs text-faint">The worker runs the pipeline and needs the key.</div></Card>
      </div>

      {!res.ok ? (
        <DbNotConfigured reason={res.reason} />
      ) : res.data.length === 0 ? (
        <EmptyState title="No runs yet" action={<RunPipelineButton date={gameDate} label="Run first ingestion" />}>Queue a run, then start the worker (<code className="font-mono">npm run worker</code>) with BALLDONTLIE_API_KEY and DATABASE_URL set.</EmptyState>
      ) : (
        <div className="flex flex-col gap-6">
          {res.data.map((r) => (
            <Card key={r.id}>
              <CardHeader>
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Link href={`/discovery?date=${r.game_date}`} className="hover:text-accent">{r.game_date}</Link>
                    <JobStatusBadge status={r.status} />
                    {r.incomplete_reason ? <Badge tone="warn">incomplete</Badge> : null}
                  </CardTitle>
                  <div className="mt-1 text-xs text-faint">trigger {r.trigger} · attempt {r.attempt} · started {fmtAgo(r.started_at)}{r.finished_at ? ` · finished ${fmtAgo(r.finished_at)}` : ''}</div>
                  {r.incomplete_reason ? <div className="mt-1 text-xs text-warn">{r.incomplete_reason}</div> : null}
                  {r.error ? <div className="mt-1 text-xs text-danger">{r.error}</div> : null}
                </div>
                <RunPipelineButton date={r.game_date} label="Re-run" size="sm" variant="ghost" />
              </CardHeader>
              <CardBody className="flex flex-col divide-y divide-line p-0">
                {PIPELINE_STEPS.map((s, i) => {
                  const st = r.steps.find((x) => x.step === s);
                  return (
                    <div key={s} className="grid grid-cols-[28px_minmax(0,1fr)_auto_auto] items-center gap-4 px-5 py-2.5">
                      <span className="font-mono text-xs text-faint">{String(i + 1).padStart(2, '0')}</span>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold">{STEP_LABELS[s]}</div>
                        <div className="truncate text-xs text-faint">{st?.error ? <span className="text-danger">{st.error}</span> : outputSummary(s, st?.output as Record<string, unknown> | null)}</div>
                      </div>
                      {st ? <JobStatusBadge status={st.status} /> : <Badge tone="neutral">not run</Badge>}
                      <RunPipelineButton date={r.game_date} fromStep={s} label="Retry from here" size="sm" variant="ghost" />
                    </div>
                  );
                })}
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
