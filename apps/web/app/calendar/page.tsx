import Link from 'next/link';
import { ContentStatusBadge } from '@/components/status';
import { Card, CardBody, CardHeader, CardTitle, NotBuilt, PageHeader } from '@/components/ui';
import { readDb } from '@/lib/server';

export const dynamic = 'force-dynamic';

export default async function Calendar() {
  const db = await readDb();
  const approved = db.projects.filter((p) => ['approved', 'scheduled', 'published'].includes(p.status));
  return (
    <>
      <PageHeader title="Publishing Calendar" description="Approved content waiting to be scheduled, plus scheduled and published posts." />
      <div className="mb-6">
        <NotBuilt phase="Phase 6">
          No publishing integration is connected, so nothing can be scheduled or posted. Verified restrictions: TikTok posts stay private until the app passes TikTok's audit. YouTube uploads from unverified API projects are locked private until an audit. Instagram needs a professional account with instagram_business_content_publish. Until then, use Manual mode and download files from the Content Queue.
        </NotBuilt>
      </div>
      <Card>
        <CardHeader><CardTitle>Approved content</CardTitle></CardHeader>
        <CardBody className="flex flex-col divide-y divide-line">
          {approved.length === 0 ? <div className="py-3 text-sm text-muted">Nothing approved yet.</div> : null}
          {approved.map((p) => (
            <Link key={p.id} href={`/studio/${p.id}`} className="flex items-center justify-between py-2.5 text-sm hover:text-accent">
              <span className="font-semibold">{p.spec.contentId}</span>
              <ContentStatusBadge status={p.status} />
            </Link>
          ))}
        </CardBody>
      </Card>
    </>
  );
}
