import { Card, CardBody, CardHeader, CardTitle, NotBuilt, PageHeader, Stat } from '@/components/ui';
import { readDb } from '@/lib/server';

export const dynamic = 'force-dynamic';

export default async function Analytics() {
  const db = await readDb();
  const done = db.renders.filter((r) => r.status === 'succeeded');
  const avgMs = done.length ? done.reduce((s, r) => s + (r.renderMs ?? 0), 0) / done.length : 0;
  const totalCost = done.reduce((s, r) => s + (r.estimatedCostUsd ?? 0), 0);
  const bytes = done.reduce((s, r) => s + (r.bytes ?? 0), 0);
  const qaRate = done.length ? done.filter((r) => r.qaPassed).length / done.length : 0;
  return (
    <>
      <PageHeader title="Analytics" description="Production metrics from stored render records. Engagement metrics arrive once publishing is connected." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Successful renders" value={done.length} />
        <Stat label="Avg render time" value={done.length ? `${(avgMs / 1000).toFixed(0)}s` : '—'} hint="Per 22 s video incl. QA" />
        <Stat label="QA pass rate" value={done.length ? `${Math.round(qaRate * 100)}%` : '—'} />
        <Stat label="Render cost (est.)" value={`$${totalCost.toFixed(3)}`} hint={`Storage used by renders: ${(bytes / 1e6).toFixed(1)} MB`} />
      </div>
      <Card className="mt-6">
        <CardHeader><CardTitle>Engagement</CardTitle></CardHeader>
        <CardBody>
          <NotBuilt phase="Phase 7">Views, completion and comment metrics need connected publishing accounts with analytics scopes. Nothing is shown until real data exists.</NotBuilt>
        </CardBody>
      </Card>
    </>
  );
}
