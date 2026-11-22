import { checkRights, previousGameDate } from '@tiresias/core';
import { availableDates, candidates, dateUsesSimulatedData, gameHighlights, games, latestRun, leaders } from '@tiresias/data';
import { ExternalLink, Library } from 'lucide-react';
import Link from 'next/link';
import { CreateFromCandidate, DatePicker, RunPipelineButton } from '@/components/nba';
import { CandidateTable, DbNotConfigured, LeaderCard, PbpBadge, SimulatedBanner } from '@/components/nba-views';
import { Badge, Button, Card, CardBody, CardHeader, CardTitle, EmptyState, PageHeader } from '@/components/ui';
import { withDb } from '@/lib/data';
import { readDb } from '@/lib/server';

export const dynamic = 'force-dynamic';

export default async function Discovery({ searchParams }: { searchParams: Promise<{ date?: string; player?: string; view?: string }> }) {
  const sp = await searchParams;
  const date = sp.date ?? previousGameDate();
  const anti = sp.view === 'turnovers';
  const res = await withDb(async (db) => {
    const [run, ast, tov, gs, dates, simulated] = await Promise.all([latestRun(db, date), leaders(db, date, 'assists'), leaders(db, date, 'turnovers'), games(db, date), availableDates(db), dateUsesSimulatedData(db, date)]);
    const list = anti ? tov : ast;
    const player = sp.player ?? list[0]?.playerId;
    const plays = player ? await candidates(db, date, { playerId: player, brand: anti ? 'antitiresias' : 'tiresias' }) : [];
    const selected = list.find((l) => l.playerId === player) ?? null;
    const highlights = selected ? await gameHighlights(db, selected.gameId) : [];
    return { run, ast, tov, gs, dates, simulated, player, plays, selected, highlights };
  });
  const media = (await readDb()).media.map((m) => ({ id: m.id, originalName: m.originalName, status: m.status, publishable: checkRights(m.rights, 'social_publication').ok }));

  const header = (
    <PageHeader
      eyebrow={`NBA game date · ${date} (America/New_York)`}
      title="Play Discovery"
      description="Last night's assist leaders from the box score, with each player's assists tied to individual plays from play-by-play and linked to clip references where a provider has them."
      actions={
        <>
          <DatePicker value={date} dates={res.ok ? res.data.dates : []} basePath="/discovery" />
          <RunPipelineButton date={date} label="Ingest this date" variant="secondary" />
          <Button asChild variant="ghost"><Link href="/discovery/library"><Library /> Clip library</Link></Button>
        </>
      }
    />
  );
  if (!res.ok) return (<>{header}<DbNotConfigured reason={res.reason} /></>);
  const { run, ast, tov, gs, simulated, player, plays, selected, highlights } = res.data;
  const list = anti ? tov : ast;

  return (
    <>
      {header}
      {simulated ? <SimulatedBanner /> : null}
      {!run ? (
        <EmptyState title={`No ingestion for ${date} yet`} action={<RunPipelineButton date={date} label="Ingest now" />}>
          The daily run fires at 08:00 New York time. You can also queue it now; the worker needs <code className="font-mono">BALLDONTLIE_API_KEY</code> and <code className="font-mono">DATABASE_URL</code>.
        </EmptyState>
      ) : (
        <>
          {run.incomplete_reason ? <div className="mb-4 rounded-lg border border-warn/30 bg-warn/5 px-4 py-2.5 text-sm text-warn">Incomplete: {run.incomplete_reason}. The worker retries on the ladder (08:30 → 14:00).</div> : null}
          {run.status === 'failed' ? <div className="mb-4 rounded-lg border border-danger/30 bg-danger/5 px-4 py-2.5 text-sm text-danger">Last run failed: {run.error}. <Link className="underline" href="/pipeline">Open pipeline →</Link></div> : null}

          <div className="mb-3 flex items-center gap-2">
            <Link href={`/discovery?date=${date}`} className={`rounded-full border px-3 py-1 text-xs font-semibold ${!anti ? 'border-accent/50 text-accent' : 'border-line-2 text-muted'}`}>Assist leaders · Tiresias</Link>
            <Link href={`/discovery?date=${date}&view=turnovers`} className={`rounded-full border px-3 py-1 text-xs font-semibold ${anti ? 'border-anti/50 text-anti' : 'border-line-2 text-muted'}`}>Turnover leaders · AntiTiresias</Link>
          </div>

          {!anti ? (
            <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-3 2xl:grid-cols-5">
              {ast.slice(0, 5).map((l) => (
                <LeaderCard key={l.playerId} l={l} href={`/discovery?date=${date}&player=${l.playerId}`} active={l.playerId === player} />
              ))}
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1fr)_420px]">
            <Card>
              <CardHeader>
                <CardTitle>{selected ? `${selected.name} — ${anti ? 'turnovers' : 'assists'} (${plays.length} plays)` : 'Plays'}</CardTitle>
                {selected ? <PbpBadge l={selected} /> : null}
              </CardHeader>
              <CardBody className="p-0">
                {plays.length ? (
                  <CandidateTable rows={plays} actions={(c) => (c.projectRef ? null : <CreateFromCandidate candidateId={c.id} media={media} />)} />
                ) : (
                  <div className="px-5 py-6 text-sm text-muted">No plays for this player. Either play-by-play wasn’t retrieved (check your BALLDONTLIE plan) or none could be attributed.</div>
                )}
              </CardBody>
            </Card>

            <div className="flex flex-col gap-6">
              <Card>
                <CardHeader><CardTitle>Top 15 · {anti ? 'turnovers' : 'assists'}</CardTitle></CardHeader>
                <CardBody className="p-0">
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-line">
                      {list.map((l) => (
                        <tr key={l.playerId} className={l.playerId === player ? 'bg-panel-2' : ''}>
                          <td className="w-8 px-4 py-2 font-mono text-xs text-faint">{l.rank}</td>
                          <td className="py-2"><Link className="font-semibold hover:text-accent" href={`/discovery?date=${date}&player=${l.playerId}${anti ? '&view=turnovers' : ''}`}>{l.name}</Link><div className="text-[11px] text-faint">{l.team} · {l.gameLabel}</div></td>
                          <td className="px-4 py-2 text-right font-mono tabular-nums">{anti ? l.turnovers : l.assists}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardBody>
              </Card>

              {highlights.length ? (
                <Card>
                  <CardHeader><CardTitle>Game-level highlights</CardTitle><span className="text-xs text-faint">reference only</span></CardHeader>
                  <CardBody className="flex flex-col gap-2">
                    {highlights.map((h) => (
                      <a key={`${h.provider}${h.url}`} href={h.url ?? h.embed_url ?? '#'} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 text-sm hover:text-accent">
                        <span className="truncate">{h.title}</span>
                        <span className="flex shrink-0 items-center gap-1 text-xs text-faint">{h.provider} · {h.source_platform} <ExternalLink className="size-3" /></span>
                      </a>
                    ))}
                  </CardBody>
                </Card>
              ) : null}

              <Card>
                <CardHeader><CardTitle>Games · {gs.length}</CardTitle></CardHeader>
                <CardBody className="flex flex-col divide-y divide-line p-0">
                  {gs.map((g) => (
                    <div key={g.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                      <div>
                        <div className="font-semibold">{g.label} <span className="font-mono text-xs text-muted">{g.away_score ?? '–'}–{g.home_score ?? '–'}</span></div>
                        <div className="text-[11px] text-faint">{g.status_text ?? g.status} · {g.clips} clip refs</div>
                      </div>
                      <div className="flex flex-wrap justify-end gap-1">
                        {g.status !== 'final' ? <Badge tone="warn">{g.status}</Badge> : g.box_verified ? <Badge tone="good">box ✓</Badge> : <Badge tone="bad">box ✗</Badge>}
                        {g.plays_fetched ? (g.pbp as { assistsVerified?: boolean }).assistsVerified ? <Badge tone="good">pbp ✓</Badge> : <Badge tone="warn">pbp ≠ box</Badge> : null}
                      </div>
                    </div>
                  ))}
                </CardBody>
              </Card>
            </div>
          </div>
        </>
      )}
    </>
  );
}
