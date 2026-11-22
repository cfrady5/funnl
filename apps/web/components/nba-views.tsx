import type { CandidateRow, LeaderRow } from '@tiresias/data';
import { ExternalLink, ShieldCheck, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { Badge, cn, NotBuilt } from './ui';

export function SimulatedBanner() {
  return (
    <div className="mb-6 rounded-xl border border-warn/40 bg-warn/10 px-5 py-3 text-sm text-warn">
      <strong>SIMULATED DATA:</strong> this date was ingested from the local mock providers. The teams and players are fictional and nothing here is real NBA data. The real BALLDONTLIE adapter runs once you set <code className="font-mono">BALLDONTLIE_API_KEY</code>.
    </div>
  );
}

export function DbNotConfigured({ reason }: { reason: string }) {
  return (
    <NotBuilt phase="setup">
      <div className="text-ink">No database connected.</div>
      <div className="mt-1">{reason}</div>
      <pre className="mt-3 overflow-x-auto rounded-md bg-bg p-3 font-mono text-xs text-muted">{`# local (embedded Postgres)            # or Supabase
npm run db:local -w @tiresias/data      export DATABASE_URL=<Supabase Postgres connection string>
export DATABASE_URL=postgres://postgres:postgres@127.0.0.1:54329/postgres`}</pre>
    </NotBuilt>
  );
}

export function LeaderCard({ l, href, active }: { l: LeaderRow; href: string; active?: boolean }) {
  return (
    <Link href={href} className={cn('group relative flex flex-col overflow-hidden rounded-xl border bg-panel p-5 transition-colors', active ? 'border-accent' : 'border-line hover:border-accent/60')}>
      <div className="flex items-start justify-between">
        <span className="font-mono text-xs text-faint">#{l.rank}</span>
        <span className="font-mono text-[11px] text-faint">{l.gameLabel} · {l.score}</span>
      </div>
      <div className="mt-3 font-mono text-6xl leading-none font-medium tracking-tighter text-accent tabular-nums">{l.assists}</div>
      <div className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-muted">assists</div>
      <div className="mt-4 truncate text-lg font-extrabold tracking-tight group-hover:text-accent">{l.name}</div>
      <div className="text-xs text-faint">{l.teamName ?? l.team}</div>
      <div className="mt-3 font-mono text-xs text-muted">
        {l.points}p/{l.rebounds}r/{l.assists}a · {l.turnovers} tov{l.plusMinus != null ? ` · ${l.plusMinus > 0 ? '+' : ''}${l.plusMinus}` : ''}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <PbpBadge l={l} />
        <Badge tone={l.linkedClips ? 'info' : 'neutral'}>{l.linkedClips} linked clips</Badge>
        <Badge tone="neutral">{l.candidates} plays</Badge>
      </div>
    </Link>
  );
}

export function PbpBadge({ l }: { l: Pick<LeaderRow, 'pbpAssists' | 'assists' | 'boxVerified'> }) {
  if (l.pbpAssists == null) return <Badge tone="neutral">no play-by-play</Badge>;
  return l.pbpAssists === l.assists ? (
    <Badge tone="good"><ShieldCheck className="size-3" /> {l.pbpAssists}/{l.assists} plays tied</Badge>
  ) : (
    <Badge tone="warn"><TriangleAlert className="size-3" /> {l.pbpAssists}/{l.assists} plays tied</Badge>
  );
}

const ATTR_TONE = { confirmed: 'good', text_only: 'info', unresolved: 'warn' } as const;

export function CandidateTable({ rows, actions }: { rows: CandidateRow[]; actions?: (c: CandidateRow) => React.ReactNode }) {
  return (
    <table className="w-full text-sm">
      <thead className="border-b border-line text-left text-[11px] uppercase tracking-wider text-muted">
        <tr>
          <th className="px-5 py-2.5">Play</th>
          <th className="px-3 py-2.5">Q / clock</th>
          <th className="px-3 py-2.5">Attribution</th>
          <th className="px-3 py-2.5">Clip reference</th>
          <th className="px-3 py-2.5">Score</th>
          <th className="px-3 py-2.5">Footage</th>
          <th className="px-5 py-2.5" />
        </tr>
      </thead>
      <tbody className="divide-y divide-line align-top">
        {rows.map((c) => (
          <tr key={c.id}>
            <td className="max-w-md px-5 py-3">
              <div className="font-semibold">{c.description}</div>
              <div className="mt-0.5 text-xs text-faint">{c.player} · {c.gameLabel}{c.partner ? ` · ${c.brand === 'tiresias' ? 'to' : 'stolen by'} ${c.partner}` : ''}</div>
            </td>
            <td className="px-3 py-3 font-mono text-xs whitespace-nowrap">Q{c.period} {c.clock ?? '—'}</td>
            <td className="px-3 py-3"><Badge tone={ATTR_TONE[c.attribution as keyof typeof ATTR_TONE] ?? 'neutral'}>{c.attribution.replace('_', ' ')}</Badge></td>
            <td className="px-3 py-3">
              {c.clip ? (
                <a href={c.clip.embedUrl ?? c.clip.url ?? '#'} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-info hover:underline">
                  {c.clip.provider} · {c.clip.level} <ExternalLink className="size-3" />
                </a>
              ) : (
                <span className="text-xs text-faint">{c.gameClips ? `none for this play (${c.gameClips} game-level)` : 'none found'}</span>
              )}
              {c.clip ? <div className="mt-0.5 text-[10px] text-faint">{c.clip.display === 'embed_only' ? 'official X embed only — not renderable' : 'link only — not renderable'}</div> : null}
            </td>
            <td className="px-3 py-3">
              <div className="font-mono text-sm tabular-nums">{c.score.toFixed(1)}</div>
              <div className="text-[10px] text-faint" title={c.breakdown.factors.filter((f) => f.source !== 'default').map((f) => `${f.factor}: ${f.value} (${f.note ?? f.source})`).join('\n')}>
                coverage {Math.round(c.coverage * 100)}%
              </div>
            </td>
            <td className="px-3 py-3">
              {c.projectRef ? <Link className="text-xs text-accent hover:underline" href={`/studio/${c.projectRef}`}>project →</Link> : <Badge tone="neutral">{c.status.replace('_', ' ')}</Badge>}
            </td>
            <td className="px-5 py-3">{actions ? actions(c) : null}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
