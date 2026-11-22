import { dailyRunKey, nextDailyRun, previousGameDate } from '@tiresias/core';
import { Badge, Card, CardBody, CardHeader, CardTitle, NotBuilt, PageHeader } from '@/components/ui';
import { readDb } from '@/lib/server';

export const dynamic = 'force-dynamic';

const STAGES = [
  { id: 'date', name: 'Determine NBA game date (America/New_York)', state: 'built', note: 'previousGameDate(); DST-tested' },
  { id: 'games', name: 'Retrieve games for that date', state: 'blocked', note: 'Needs a stats provider and network access' },
  { id: 'box', name: 'Retrieve player box scores', state: 'blocked', note: 'Needs a stats provider' },
  { id: 'rank', name: 'Rank top 15 assist leaders', state: 'built', note: 'rankAssistLeaders(); deterministic tie-breaks' },
  { id: 'pbp', name: 'Retrieve play-by-play for top players', state: 'blocked', note: 'Needs a stats provider' },
  { id: 'candidates', name: 'Identify candidate assists', state: 'planned', note: 'Phase 3' },
  { id: 'clips', name: 'Acquire authorised clips', state: 'blocked', note: 'No source with redistribution rights; upload is the fallback' },
  { id: 'score', name: 'Score suitability (weighted, transparent)', state: 'built', note: 'scoreCandidate(); 10 factors' },
  { id: 'select', name: 'Select ≤5 Tiresias + ≤3 AntiTiresias', state: 'built', note: 'selectClips(): returns fewer clips rather than substituting' },
  { id: 'analyze', name: 'Analyse footage (CV)', state: 'planned', note: 'Phase 4' },
  { id: 'render', name: 'Render video + cover + QA', state: 'built', note: 'Render worker' },
  { id: 'notify', name: 'Notify: queue ready', state: 'planned', note: 'Phase 5' },
];

const TONE = { built: 'good', blocked: 'bad', planned: 'neutral' } as const;

export default async function Pipeline() {
  const { settings } = await readDb();
  const now = new Date();
  const gameDate = previousGameDate(now);
  const next = nextDailyRun(now, settings.dailyRunTime, settings.timezone);
  return (
    <>
      <PageHeader title="Daily Pipeline" description="The morning workflow. Each stage is checkpointed and can be retried on its own once the scheduler is live." />
      <div className="mb-6 grid grid-cols-3 gap-4">
        <Card className="px-5 py-4"><div className="text-[11px] uppercase tracking-wider text-muted">Game date to process</div><div className="mt-2 font-mono text-2xl">{gameDate}</div></Card>
        <Card className="px-5 py-4"><div className="text-[11px] uppercase tracking-wider text-muted">Next scheduled run</div><div className="mt-2 font-mono text-lg">{next.toLocaleString('en-US', { timeZone: settings.timezone, dateStyle: 'medium', timeStyle: 'short' })} ET</div><div className="mt-1 font-mono text-xs text-faint">{next.toISOString()}</div></Card>
        <Card className="px-5 py-4"><div className="text-[11px] uppercase tracking-wider text-muted">Idempotency key</div><div className="mt-2 font-mono text-sm">{dailyRunKey('tiresias', gameDate)}</div></Card>
      </div>
      <div className="mb-6">
        <NotBuilt phase="Phases 2–5">Data-dependent stages are blocked. This environment's network policy blocks every NBA data host, and no licensed provider credentials are configured. The pure stages (date maths, ranking, scoring, selection) are built and unit-tested so they can run as soon as data arrives.</NotBuilt>
      </div>
      <Card>
        <CardHeader><CardTitle>Stages</CardTitle></CardHeader>
        <CardBody className="flex flex-col divide-y divide-line">
          {STAGES.map((s, i) => (
            <div key={s.id} className="grid grid-cols-[32px_1fr_auto] items-center gap-4 py-3">
              <span className="font-mono text-xs text-faint">{String(i + 1).padStart(2, '0')}</span>
              <div>
                <div className="text-sm font-semibold">{s.name}</div>
                <div className="text-xs text-faint">{s.note}</div>
              </div>
              <Badge tone={TONE[s.state as keyof typeof TONE]}>{s.state}</Badge>
            </div>
          ))}
        </CardBody>
      </Card>
    </>
  );
}
