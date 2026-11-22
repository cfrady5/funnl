import { checkRights } from '@tiresias/core';
import { AutoRefresh, RightsEditor, UploadForm } from '@/components/actions';
import { JobStatusBadge, RightsBadge } from '@/components/status';
import { Badge, Card, CardBody, CardHeader, CardTitle, EmptyState, NotBuilt, PageHeader } from '@/components/ui';
import { fileUrl, fmtAgo, fmtBytes } from '@/lib/client';
import { readDb } from '@/lib/server';

export const dynamic = 'force-dynamic';

export default async function Discovery() {
  const db = await readDb();
  const processing = db.media.some((m) => m.status === 'processing');
  return (
    <>
      {processing ? <AutoRefresh /> : null}
      <PageHeader
        title="Play Discovery"
        description="The clip library. Discovery (knowing a play exists), acquisition (having the file) and publication rights are tracked separately. A clip whose rights are unknown can be edited and previewed internally, but it can never be approved for publication."
      />
      <div className="mb-6">
        <NotBuilt phase="Phase 3">
          Automatic candidate discovery from play-by-play is not connected. The research found no clip provider whose terms grant redistribution rights to NBA footage: PlayDB has no API and limits use to personal, non-commercial; NBA.com video terms bar commercial reuse. Licensed or permitted footage enters through the upload below.
        </NotBuilt>
      </div>
      <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1fr)_520px]">
        <Card>
          <CardHeader>
            <CardTitle>Clip library</CardTitle>
            <span className="text-xs text-faint">{db.media.length} clips</span>
          </CardHeader>
          <CardBody className="flex flex-col gap-3">
            {db.media.length === 0 ? <EmptyState title="No clips yet">Upload an authorised clip, or load the synthetic demo from the Overview page.</EmptyState> : null}
            {db.media
              .slice()
              .reverse()
              .map((m) => {
                const pub = checkRights(m.rights, 'social_publication');
                const projects = db.projects.filter((p) => p.mediaId === m.id).length;
                return (
                  <div key={m.id} className="grid grid-cols-[160px_1fr_auto] gap-4 rounded-lg border border-line bg-bg/40 p-3">
                    <div className="aspect-video overflow-hidden rounded-md bg-black">
                      {m.posterKey ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={fileUrl(m.posterKey)} alt="" className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-bold">{m.originalName}</span>
                        <JobStatusBadge status={m.status} />
                        <RightsBadge rights={m.rights} />
                        {pub.ok ? <Badge tone="good">publishable</Badge> : <Badge tone="bad">not publishable</Badge>}
                      </div>
                      <div className="mt-1.5 font-mono text-[11px] text-faint">
                        {m.probe ? `${m.probe.width}×${m.probe.height} · ${m.probe.fps.toFixed(2)} fps · ${m.probe.durationSec.toFixed(1)}s · ${m.probe.cuts.length} cuts · ` : ''}
                        {fmtBytes(m.bytes)} · source {m.rights.sourceProvider} · sha {m.sha256.slice(0, 10)} · {fmtAgo(m.createdAt)}
                      </div>
                      {m.error ? <div className="mt-1 text-xs text-danger">{m.error}</div> : null}
                      <div className="mt-1.5 text-xs text-muted">
                        Holder: {m.rights.rightsHolder ?? '—'} · Licence: {m.rights.licenseReference ?? '—'} · Uses: {m.rights.allowedUses.join(', ') || 'none'}
                        {m.rights.expiresAt ? ` · expires ${m.rights.expiresAt.slice(0, 10)}` : ''}
                      </div>
                      {!pub.ok ? <div className="mt-1 text-xs text-warn">Blocked for publication: {pub.reasons.join(' ')}</div> : null}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <RightsEditor media={m} />
                      <span className="text-xs text-faint">{projects} project{projects === 1 ? '' : 's'}</span>
                    </div>
                  </div>
                );
              })}
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Upload authorised footage</CardTitle>
          </CardHeader>
          <CardBody>
            <UploadForm />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
