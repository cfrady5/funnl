import { AutoRefresh, JobActions } from '@/components/actions';
import { JobStatusBadge } from '@/components/status';
import { Badge, Card, CardBody, CardHeader, CardTitle, PageHeader, Progress } from '@/components/ui';
import { fmtAgo } from '@/lib/client';
import { readDb } from '@/lib/server';

export const dynamic = 'force-dynamic';

const LEVEL_TONE = { debug: 'neutral', info: 'info', warn: 'warn', error: 'bad' } as const;

export default async function Logs() {
  const db = await readDb();
  const active = db.jobs.some((j) => j.status === 'running' || j.status === 'queued');
  return (
    <>
      {active ? <AutoRefresh everyMs={2000} /> : null}
      <PageHeader title="System Logs" description="Jobs (with retry, cancel and partial reruns) and the structured audit log. Secrets are redacted before anything is written." />
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Jobs</CardTitle>
          <span className="text-xs text-faint">{db.jobs.length} total</span>
        </CardHeader>
        <CardBody className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-line text-left text-[11px] uppercase tracking-wider text-muted">
              <tr>
                <th className="px-5 py-2.5">Type</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Attempts</th>
                <th className="px-3 py-2.5 w-40">Progress</th>
                <th className="px-3 py-2.5">Created</th>
                <th className="px-3 py-2.5">Last error</th>
                <th className="px-5 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {db.jobs.slice(-50).reverse().map((j) => (
                <tr key={j.id}>
                  <td className="px-5 py-2.5 font-mono text-xs">{j.type}</td>
                  <td className="px-3 py-2.5"><JobStatusBadge status={j.status} /></td>
                  <td className="px-3 py-2.5 font-mono text-xs">{j.attempts}/{j.maxAttempts}</td>
                  <td className="px-3 py-2.5"><Progress value={j.progress} /></td>
                  <td className="px-3 py-2.5 text-xs text-faint">{fmtAgo(j.createdAt)}</td>
                  <td className="max-w-md truncate px-3 py-2.5 text-xs text-danger" title={j.lastError ?? ''}>{j.lastError ?? ''}</td>
                  <td className="px-5 py-2.5"><JobActions id={j.id} status={j.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Audit log</CardTitle>
        </CardHeader>
        <CardBody className="flex flex-col gap-1 font-mono text-xs">
          {db.logs.slice(-200).reverse().map((l) => (
            <div key={l.id} className="grid grid-cols-[150px_60px_90px_1fr] gap-3 border-b border-line/50 py-1.5">
              <span className="text-faint">{new Date(l.at).toLocaleString()}</span>
              <Badge tone={LEVEL_TONE[l.level]}>{l.level}</Badge>
              <span className="text-muted">{l.scope}</span>
              <span>
                {l.message}
                {l.data ? <span className="text-faint"> {JSON.stringify(l.data)}</span> : null}
              </span>
            </div>
          ))}
        </CardBody>
      </Card>
    </>
  );
}
