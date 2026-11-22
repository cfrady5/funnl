import { CONTENT_STATUSES } from '@tiresias/render-worker/store';
import { Download } from 'lucide-react';
import Link from 'next/link';
import { AutoRefresh } from '@/components/actions';
import { BrandBadge, ContentStatusBadge } from '@/components/status';
import { Badge, Button, Card, CardBody, EmptyState, PageHeader } from '@/components/ui';
import { fileUrl, fmtAgo } from '@/lib/client';
import { readDb } from '@/lib/server';

export const dynamic = 'force-dynamic';

export default async function Queue({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const db = await readDb();
  const counts = Object.fromEntries(CONTENT_STATUSES.map((s) => [s, db.projects.filter((p) => p.status === s).length]));
  const rows = db.projects.filter((p) => !status || p.status === status).reverse();
  const active = db.projects.some((p) => p.status === 'rendering');
  return (
    <>
      {active ? <AutoRefresh /> : null}
      <PageHeader title="Content Queue" description="Every content item and its state. Manual mode (Mode 1): download the MP4 and cover from here. Approval (Mode 2) happens in the editor and is gated by QA and footage rights." />
      <div className="mb-6 flex flex-wrap gap-2">
        <Link href="/queue" className={`rounded-full border px-3 py-1 text-xs font-semibold ${!status ? 'border-accent/50 text-accent' : 'border-line-2 text-muted'}`}>
          all {db.projects.length}
        </Link>
        {CONTENT_STATUSES.map((s) => (
          <Link key={s} href={`/queue?status=${s}`} className={`rounded-full border px-3 py-1 text-xs font-semibold ${status === s ? 'border-accent/50 text-accent' : 'border-line-2 text-muted'}`}>
            {s.replace(/_/g, ' ')} {counts[s]}
          </Link>
        ))}
      </div>
      {rows.length === 0 ? (
        <EmptyState title="Nothing here" />
      ) : (
        <Card>
          <CardBody className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-line text-left text-[11px] uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-5 py-3">Content</th>
                  <th className="px-3 py-3">Brand</th>
                  <th className="px-3 py-3">Player</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">QA</th>
                  <th className="px-3 py-3">Updated</th>
                  <th className="px-5 py-3 text-right">Files</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((p) => {
                  const r = db.renders.find((x) => x.id === p.latestRenderId);
                  return (
                    <tr key={p.id} className="hover:bg-panel-2/40">
                      <td className="px-5 py-3 font-semibold">
                        <Link className="hover:text-accent" href={`/studio/${p.id}`}>{p.spec.contentId}</Link>
                      </td>
                      <td className="px-3 py-3"><BrandBadge brand={p.brand} /></td>
                      <td className="px-3 py-3 text-muted">{p.spec.player.name}</td>
                      <td className="px-3 py-3"><ContentStatusBadge status={p.status} /></td>
                      <td className="px-3 py-3">{r?.qaPassed === true ? <Badge tone="good">pass</Badge> : r?.qaPassed === false ? <Badge tone="bad">fail</Badge> : <span className="text-faint">—</span>}</td>
                      <td className="px-3 py-3 text-xs text-faint">{fmtAgo(p.updatedAt)}</td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-2">
                          {r?.videoKey ? <Button asChild size="sm" variant="secondary"><a href={`${fileUrl(r.videoKey)}?download=${p.spec.contentId}.mp4`}><Download /> MP4</a></Button> : null}
                          {r?.coverKey ? <Button asChild size="sm" variant="secondary"><a href={`${fileUrl(r.coverKey)}?download=${p.spec.contentId}-cover.png`}><Download /> PNG</a></Button> : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}
    </>
  );
}
