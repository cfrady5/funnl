import { previousGameDate } from '@tiresias/core';
import Link from 'next/link';
import { SeedDemoButton } from '@/components/actions';
import { ContentStatusBadge, JobStatusBadge } from '@/components/status';
import { Button, Card, CardBody, CardHeader, CardTitle, EmptyState, NotBuilt, PageHeader, Stat } from '@/components/ui';
import { fmtAgo } from '@/lib/client';
import { readDb } from '@/lib/server';
import { withDb } from '@/lib/data';

export const dynamic = 'force-dynamic';

export default async function Overview() {
  const db = await readDb();
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const rendersToday = db.renders.filter((r) => r.status === 'succeeded' && r.finishedAt?.startsWith(today));
  const monthCost = db.renders.filter((r) => r.finishedAt?.startsWith(month)).reduce((s, r) => s + (r.estimatedCostUsd ?? 0), 0);
  const failedJobs = db.jobs.filter((j) => j.status === 'failed').length;
  const awaiting = db.projects.filter((p) => p.status === 'ready_for_approval').length;
  const published = db.projects.filter((p) => p.status === 'published').length;
  const gameDate = previousGameDate();
  const nba = await withDb((d) =>
    d.one<{ games: number; players: number; candidates: number }>(
      `select (select count(*)::int from public.games where game_date = $1 and status = 'final' and provider = 'balldontlie') games,
              (select count(*)::int from public.player_game_stats s join public.games g on g.id = s.game_id where g.game_date = $1) players,
              (select count(*)::int from public.candidate_clips where game_date = $1) candidates`,
      [gameDate],
    ),
  );
  return (
    <>
      <PageHeader
        eyebrow={`Game date in view · ${previousGameDate()}`}
        title="Overview"
        description="Today's production at a glance. Figures come from the stored records. A dash (—) means that data source is not connected yet; it never means zero activity."
        actions={<Button asChild><Link href="/studio">Open Video Studio</Link></Button>}
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label={`Games processed · ${gameDate}`} value={nba.ok ? nba.data?.games ?? 0 : '—'} hint={nba.ok ? 'Final games ingested' : 'Database not connected'} />
        <Stat label="Players evaluated" value={nba.ok ? nba.data?.players ?? 0 : '—'} hint="Box-score lines" />
        <Stat label="Candidate plays" value={nba.ok ? nba.data?.candidates ?? 0 : '—'} hint={`${db.media.filter((m) => m.status === 'ready').length} authorised clips in library`} />
        <Stat label="Videos generated today" value={rendersToday.length} />
        <Stat label="Awaiting approval" value={awaiting} tone={awaiting ? 'warn' : undefined} />
        <Stat label="Published" value={published} hint="Publishing not connected (Phase 6)" />
        <Stat label="Failed jobs" value={failedJobs} tone={failedJobs ? 'bad' : undefined} />
        <Stat label="Processing cost · this month" value={`$${monthCost < 1 ? monthCost.toFixed(4) : monthCost.toFixed(2)}`} hint="Render compute estimate. AI spend is not tracked yet because no AI calls are made." />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent projects</CardTitle>
            <Link className="text-xs text-info hover:underline" href="/queue">Content queue →</Link>
          </CardHeader>
          <CardBody className="flex flex-col divide-y divide-line">
            {db.projects.length === 0 ? (
              <EmptyState title="No projects yet" action={<SeedDemoButton />}>
                Upload an authorised clip in Play Discovery or load the synthetic demo projects. Those use procedurally generated footage that we own outright.
              </EmptyState>
            ) : (
              db.projects
                .slice(-8)
                .reverse()
                .map((p) => (
                  <Link key={p.id} href={`/studio/${p.id}`} className="flex items-center justify-between py-2.5 hover:text-accent">
                    <span className="text-sm font-semibold">
                      {p.spec.contentId} <span className="font-normal text-faint">· {p.spec.player.name}</span>
                    </span>
                    <ContentStatusBadge status={p.status} />
                  </Link>
                ))
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent jobs</CardTitle>
            <Link className="text-xs text-info hover:underline" href="/logs">System logs →</Link>
          </CardHeader>
          <CardBody className="flex flex-col divide-y divide-line">
            {db.jobs.length === 0 ? <div className="py-4 text-sm text-muted">No jobs have run.</div> : null}
            {db.jobs
              .slice(-8)
              .reverse()
              .map((j) => (
                <div key={j.id} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="font-mono text-xs">{j.type}</span>
                  <span className="text-xs text-faint">{fmtAgo(j.createdAt)}</span>
                  <JobStatusBadge status={j.status} />
                </div>
              ))}
          </CardBody>
        </Card>
      </div>
      <div className="mt-6">
        <NotBuilt phase="Phase 5">Daily ingestion runs from the worker at 08:00 America/New_York with a retry ladder for late games. Fully automatic video generation (footage acquisition + analysis) is not built yet: candidates need authorised footage attached.</NotBuilt>
      </div>
    </>
  );
}
