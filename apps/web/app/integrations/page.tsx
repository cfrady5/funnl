import { Badge, Card, CardBody, PageHeader } from '@/components/ui';
import { INTEGRATIONS, type IntegrationState } from '@/lib/integrations';

const TONE: Record<IntegrationState, 'good' | 'neutral' | 'bad' | 'warn' | 'info'> = {
  working: 'good',
  not_configured: 'neutral',
  blocked: 'bad',
  not_recommended: 'warn',
  planned: 'info',
};

export default function Integrations() {
  return (
    <>
      <PageHeader
        title="Integrations"
        description="Verified capability and status of each external service. Nothing is marked working until it has been exercised end to end. Sources and dates are in INTEGRATIONS.md."
      />
      <Card>
        <CardBody className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-line text-left text-[11px] uppercase tracking-wider text-muted">
              <tr>
                <th className="px-5 py-3">Service</th>
                <th className="px-3 py-3">Category</th>
                <th className="px-3 py-3">State</th>
                <th className="px-3 py-3">What we verified</th>
                <th className="px-5 py-3">Needed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line align-top">
              {INTEGRATIONS.map((i) => (
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
