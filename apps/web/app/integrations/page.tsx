import { CLIP_SOURCE_CATALOG, clipProviders, providerEvidence, statsProviders, type ProviderEvidence } from '@tiresias/data';
import { Badge, Card, CardBody, CardHeader, CardTitle, PageHeader } from '@/components/ui';
import { fmtAgo } from '@/lib/client';
import { withDb } from '@/lib/data';
import { INTEGRATIONS, type IntegrationState } from '@/lib/integrations';

export const dynamic = 'force-dynamic';

const TONE: Record<IntegrationState, 'good' | 'neutral' | 'bad' | 'warn' | 'info'> = {
  working: 'good',
  not_configured: 'neutral',
  blocked: 'bad',
  not_recommended: 'warn',
  planned: 'info',
};

function evidenceBadge(e: ProviderEvidence | undefined, configured: boolean) {
  if (e?.lastOfficialSuccess) return <Badge tone="good">verified · real API {fmtAgo(e.lastOfficialSuccess)}</Badge>;
  if (e?.lastOfficialFailure) return <Badge tone="bad">real API failed ({e.lastOfficialFailure.status ?? 'network'})</Badge>;
  if (e?.lastMockSuccess) return <Badge tone="warn">exercised against mock only</Badge>;
  return configured ? <Badge tone="info">configured · not yet called</Badge> : <Badge tone="neutral">documented · no key</Badge>;
}

export default async function Integrations() {
  const stats = statsProviders();
  const clips = clipProviders();
  const ev = await withDb((db) => providerEvidence(db));
  const evidence = ev.ok ? ev.data : [];
  return (
    <>
      <PageHeader
        title="Integrations"
        description="Documented ≠ verified. A provider counts as verified only after a successful call to its official API host is recorded in provider_requests. Calls to the local mock never count."
      />
      <Card className="mb-6">
        <CardHeader><CardTitle>Data & clip providers</CardTitle>{!ev.ok ? <span className="text-xs text-warn">database not connected — evidence unavailable</span> : null}</CardHeader>
        <CardBody className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-line text-left text-[11px] uppercase tracking-wider text-muted">
              <tr><th className="px-5 py-3">Provider</th><th className="px-3 py-3">Role</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Key in this process</th><th className="px-5 py-3">Last failure</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {[...stats, ...clips].map((p) => {
                const e = evidence.find((x) => x.provider === p.id);
                return (
                  <tr key={p.id}>
                    <td className="px-5 py-3 font-semibold"><a className="hover:text-accent" href={p.docsUrl} target="_blank" rel="noreferrer">{p.name}</a></td>
                    <td className="px-3 py-3 text-xs text-muted">{p.kind === 'stats' ? 'Games, box scores, play-by-play' : `Clip discovery (${'capabilities' in p ? `${p.capabilities.granularity}-level, ${p.capabilities.display.replace('_', ' ')}` : ''})`}</td>
                    <td className="px-3 py-3">{evidenceBadge(e, p.configured)}</td>
                    <td className="px-3 py-3 text-xs">{p.configured ? <Badge tone="good">set</Badge> : <span className="font-mono text-faint">{p.needs.join(', ')}</span>}</td>
                    <td className="max-w-sm truncate px-5 py-3 text-xs text-danger" title={e?.lastOfficialFailure?.error ?? ''}>{e?.lastOfficialFailure ? `${fmtAgo(e.lastOfficialFailure.at)}: ${e.lastOfficialFailure.error ?? e.lastOfficialFailure.status}` : ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardBody>
      </Card>

      <Card className="mb-6">
        <CardHeader><CardTitle>Clip sources & footage rights</CardTitle></CardHeader>
        <CardBody className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-line text-left text-[11px] uppercase tracking-wider text-muted">
              <tr><th className="px-5 py-3">Source</th><th className="px-3 py-3">Links to</th><th className="px-3 py-3">Footage for rendering</th><th className="px-5 py-3">Notes</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {CLIP_SOURCE_CATALOG.map((c) => (
                <tr key={c.id}>
                  <td className="px-5 py-3 font-semibold">{c.name}</td>
                  <td className="px-3 py-3 text-xs">{c.granularity === 'play' ? 'individual plays' : 'games'}</td>
                  <td className="px-3 py-3">{c.acquisition === 'licensed_download' ? <Badge tone="good">yes, with rights record</Badge> : c.acquisition === 'planned' ? <Badge tone="info">planned · needs a licence</Badge> : <Badge tone="neutral">no · {c.display.replace('_', ' ')}</Badge>}</td>
                  <td className="px-5 py-3 text-xs text-muted">{c.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Other services</CardTitle></CardHeader>
        <CardBody className="p-0">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-line align-top">
              {INTEGRATIONS.filter((i) => !['Stats', 'Clip discovery'].includes(i.category)).map((i) => (
                <tr key={i.name}>
                  <td className="px-5 py-3 font-semibold">{i.name}</td>
                  <td className="px-3 py-3 text-xs text-muted">{i.category}</td>
                  <td className="px-3 py-3"><Badge tone={TONE[i.state]}>{i.state.replace(/_/g, ' ')}</Badge></td>
                  <td className="max-w-xl px-3 py-3 text-xs text-muted">{i.summary}</td>
                  <td className="max-w-sm px-5 py-3 text-xs text-faint">{i.needs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </>
  );
}
