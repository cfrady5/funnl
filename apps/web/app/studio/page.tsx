import Link from 'next/link';
import { NewProject, SeedDemoButton } from '@/components/actions';
import { BrandBadge, ContentStatusBadge } from '@/components/status';
import { Card, CardBody, CardHeader, CardTitle, EmptyState, PageHeader } from '@/components/ui';
import { fileUrl, fmtAgo } from '@/lib/client';
import { readDb } from '@/lib/server';
import { previousGameDate } from '@tiresias/core';
import { dateUsesSimulatedData, leaders } from '@tiresias/data';
import { LeaderCard, SimulatedBanner } from '@/components/nba-views';
import { RunPipelineButton } from '@/components/nba';
import { withDb } from '@/lib/data';

export const dynamic = 'force-dynamic';

export default async function Studio() {
  const db = await readDb();
  const gameDate = previousGameDate();
  const last = await withDb(async (d) => ({ leaders: await leaders(d, gameDate, 'assists'), simulated: await dateUsesSimulatedData(d, gameDate) }));
  return (
    <>
      <PageHeader
        title="Video Studio"
        description="Create Court Vision videos from authorised clips. Set the freeze frame, place the passing options, write the explanation, preview live, then render the MP4 and cover."
      />
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Last night · {gameDate} · assist leaders</CardTitle>
          <Link href={`/discovery?date=${gameDate}`} className="text-xs text-info hover:underline">All plays & top 15 →</Link>
        </CardHeader>
        <CardBody>
          {!last.ok ? (
            <div className="text-sm text-muted">Connect a database to see last night’s leaders ({last.reason})</div>
          ) : last.data.leaders.length === 0 ? (
            <div className="flex items-center gap-3 text-sm text-muted">No ingestion for {gameDate} yet. <RunPipelineButton date={gameDate} label="Ingest now" size="sm" /></div>
          ) : (
            <>
              {last.data.simulated ? <SimulatedBanner /> : null}
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 2xl:grid-cols-5">
                {last.data.leaders.slice(0, 5).map((l) => (
                  <LeaderCard key={l.playerId} l={l} href={`/discovery?date=${gameDate}&player=${l.playerId}`} />
                ))}
              </div>
            </>
          )}
        </CardBody>
      </Card>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>New project</CardTitle>
        </CardHeader>
        <CardBody>
          <NewProject media={db.media.map(({ id, originalName, status }) => ({ id, originalName, status }))} />
        </CardBody>
      </Card>
      {db.projects.length === 0 ? (
        <EmptyState title="No projects yet" action={<SeedDemoButton />}>
          Load the synthetic demo projects to try the editor without any licensed footage.
        </EmptyState>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 2xl:grid-cols-4">
          {db.projects
            .slice()
            .reverse()
            .map((p) => {
              const media = db.media.find((m) => m.id === p.mediaId);
              const render = db.renders.find((r) => r.id === p.latestRenderId);
              const img = render?.coverKey ?? media?.posterKey;
              return (
                <Link key={p.id} href={`/studio/${p.id}`} className="group overflow-hidden rounded-xl border border-line bg-panel hover:border-accent/50">
                  <div className="relative aspect-video bg-black">
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={fileUrl(img)} alt="" className="absolute inset-0 h-full w-full object-cover object-top opacity-90" />
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-2 p-4">
                    <div className="flex items-center gap-2">
                      <BrandBadge brand={p.brand} />
                      <ContentStatusBadge status={p.status} />
                    </div>
                    <div className="font-bold group-hover:text-accent">{p.spec.contentId}</div>
                    <div className="text-xs text-faint">
                      {p.spec.player.name} · updated {fmtAgo(p.updatedAt)}
                    </div>
                  </div>
                </Link>
              );
            })}
        </div>
      )}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Keyboard</CardTitle>
        </CardHeader>
        <CardBody className="font-mono text-xs text-muted">← / → step one frame · Shift+← / → step ten frames · F set freeze · ⌘/Ctrl+S save</CardBody>
      </Card>
    </>
  );
}
