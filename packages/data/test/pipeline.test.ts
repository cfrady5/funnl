import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '../src/db';
import { migrate } from '../src/migrate';
import { buildMockDay } from '../src/mock/dataset';
import { startMockProviders } from '../src/mock/server';
import { archiveTo, runDailyPipeline, PIPELINE_STEPS } from '../src/pipeline';
import { createBalldontlie } from '../src/providers/balldontlie';
import { createHighlightApi, createHighlightly } from '../src/providers/clips';

const DATE = '2026-11-21';
let pg: PGlite;
let server: PGLiteSocketServer;
let db: Db;
let mock: Awaited<ReturnType<typeof startMockProviders>>;

beforeAll(async () => {
  pg = await PGlite.create();
  server = new PGLiteSocketServer({ db: pg, port: 0, host: '127.0.0.1', maxConnections: 10 });
  await server.start();
  const addr = (server as unknown as { server: { address(): { port: number } } }).server.address();
  db = createDb(`postgres://postgres:postgres@127.0.0.1:${addr.port}/postgres`, { max: 3 });
  await migrate(db);
  mock = await startMockProviders();
});

afterAll(async () => {
  await db.end();
  await mock.close();
  await server.stop();
  await pg.close();
});

function providers(env: Record<string, string | undefined>, runId: { id: string | null }) {
  const ctx = { env, onArchive: archiveTo(db, () => runId.id) };
  return { stats: createBalldontlie(ctx), clips: [createHighlightApi(ctx), createHighlightly(ctx)] };
}

describe('daily pipeline (simulated providers, real adapters + Postgres)', () => {
  const run = { id: null as string | null };

  it('runs every stage and succeeds', async () => {
    const p = providers(mock.env, run);
    const out = await runDailyPipeline({ db, date: DATE, ...p, trigger: 'manual', onRunId: (id) => (run.id = id) });
    run.id = out.runId;
    expect(out.status).toBe('succeeded');
    expect(out.incompleteReason).toBeNull();
    const steps = await db.query<{ step: string; status: string }>(`select step, status from public.workflow_steps where run_id = $1 order by position`, [out.runId]);
    expect(steps.map((s) => s.step)).toEqual([...PIPELINE_STEPS]);
    expect(steps.every((s) => s.status === 'succeeded')).toBe(true);
  });

  it('stores games and verifies box scores against final scores', async () => {
    const g = await db.query<{ status: string; box_verified: boolean }>(`select status, box_verified from public.games where game_date = $1`, [DATE]);
    expect(g).toHaveLength(3);
    expect(g.every((x) => x.status === 'final' && x.box_verified)).toBe(true);
  });

  it('ranks the top 15 assist leaders exactly as the box score says', async () => {
    const day = buildMockDay(DATE);
    const expected = day.games.flatMap((g) => g.stats).map((s) => s as { ast: number; turnover: number }).sort((a, b) => b.ast - a.ast)[0].ast;
    const leaders = await db.query<{ rank: number; value: number; full_name: string }>(
      `select d.rank, d.value, p.full_name from public.daily_leaders d join public.players p on p.id = d.player_id where d.game_date = $1 and d.category = 'assists' order by d.rank`,
      [DATE],
    );
    expect(leaders).toHaveLength(15);
    expect(leaders[0].value).toBe(expected);
    for (let i = 1; i < leaders.length; i++) expect(leaders[i - 1].value).toBeGreaterThanOrEqual(leaders[i].value);
  });

  it('attributes every assist to a unique play and reconciles with the box score', async () => {
    const games = await db.query<{ pbp_reconciliation: { assistsVerified: boolean; unresolvedEvents: number } }>(`select pbp_reconciliation from public.games where game_date = $1 and plays_fetched_at is not null`, [DATE]);
    expect(games.length).toBeGreaterThan(0);
    for (const g of games) {
      expect(g.pbp_reconciliation.assistsVerified).toBe(true);
      expect(g.pbp_reconciliation.unresolvedEvents).toBe(0);
    }
    const top = await db.one<{ value: number; n: number }>(
      `select d.value, (select count(*)::int from public.play_events e where e.kind = 'assist' and e.primary_player_id = d.player_id and e.game_id = d.game_id) n
         from public.daily_leaders d where d.game_date = $1 and d.category = 'assists' and d.rank = 1`,
      [DATE],
    );
    expect(top!.n).toBe(top!.value);
    const confirmed = await db.one<{ n: number }>(`select count(*)::int n from public.play_events where kind = 'assist' and attribution = 'confirmed'`);
    expect(confirmed!.n).toBeGreaterThan(0);
  });

  it('discovers clips from both providers and links play-level clips to assists', async () => {
    const refs = await db.query<{ provider: string; granularity: string; n: number }>(`select provider, granularity, count(*)::int n from public.clip_references group by 1,2 order by 1,2`);
    expect(refs.find((r) => r.provider === 'highlightapi' && r.granularity === 'play')!.n).toBeGreaterThan(0);
    expect(refs.find((r) => r.provider === 'highlightly' && r.granularity === 'game')!.n).toBe(6);
    const links = await db.query<{ level: string; kind: string }>(`select l.level, e.kind from public.play_clip_links l join public.play_events e on e.id = l.play_event_id`);
    expect(links.length).toBeGreaterThan(0);
    expect(links.every((l) => l.kind === 'assist')).toBe(true);
    expect(links.filter((l) => l.level === 'strong').length / links.length).toBeGreaterThan(0.8);
  });

  it('creates scored candidates awaiting authorised footage', async () => {
    const c = await db.query<{ brand: string; status: string; suitability_score: number; score_coverage: number }>(`select brand, status, suitability_score::float, score_coverage::float from public.candidate_clips where game_date = $1`, [DATE]);
    expect(c.some((x) => x.brand === 'tiresias')).toBe(true);
    expect(c.some((x) => x.brand === 'antitiresias')).toBe(true);
    expect(c.every((x) => x.status === 'awaiting_footage')).toBe(true);
    expect(c.every((x) => x.score_coverage < 0.5)).toBe(true); // visual factors honestly unmeasured
  });

  it('attributes archived provider calls to the run and flags simulated data', async () => {
    const { dateUsesSimulatedData } = await import('../src/read');
    const n = await db.one<{ n: number }>(`select count(*)::int n from public.provider_requests where workflow_run_id = $1`, [run.id]);
    expect(n!.n).toBeGreaterThan(5);
    expect(await dateUsesSimulatedData(db, DATE)).toBe(true);
  });

  it('archives provider calls without storing credentials', async () => {
    const r = await db.query<{ provider: string; params: unknown; payload: unknown }>(`select provider, params, payload from public.provider_requests`);
    expect(new Set(r.map((x) => x.provider))).toEqual(new Set(['balldontlie', 'highlightapi', 'highlightly']));
    const dump = JSON.stringify(r);
    for (const k of Object.values(mock.keys)) expect(dump).not.toContain(k);
  });

  it('is idempotent: a second run adds no duplicates', async () => {
    const count = async () => db.one<{ g: number; s: number; e: number; c: number; l: number }>(
      `select (select count(*)::int from public.games) g, (select count(*)::int from public.player_game_stats) s, (select count(*)::int from public.play_events) e,
              (select count(*)::int from public.candidate_clips) c, (select count(*)::int from public.play_clip_links) l`,
    );
    const before = await count();
    const out = await runDailyPipeline({ db, date: DATE, ...providers(mock.env, run) });
    expect(out.runId).toBe(run.id);
    expect(await count()).toEqual(before);
    const attempt = await db.one<{ attempt: number }>(`select attempt from public.workflow_runs where id = $1`, [out.runId]);
    expect(attempt!.attempt).toBe(2);
  });

  it('re-runs from a single stage without repeating earlier stages', async () => {
    const callsBefore = mock.hits.filter((h) => h.includes('/bdl/')).length;
    const out = await runDailyPipeline({ db, date: DATE, ...providers(mock.env, run), fromStep: 'clips' });
    expect(out.status).toBe('succeeded');
    expect(mock.hits.filter((h) => h.includes('/bdl/')).length).toBe(callsBefore); // no stats calls
  });
});

describe('failure modes', () => {
  it('stops at play-by-play with a clear access error on a tier without Plays', async () => {
    const m = await startMockProviders({ balldontlieTier: 'allstar' });
    try {
      const out = await runDailyPipeline({ db, date: '2026-11-19', stats: createBalldontlie({ env: m.env }), clips: [] });
      expect(out.status).toBe('failed');
      const step = await db.one<{ status: string; error: string }>(`select status, error from public.workflow_steps where run_id = $1 and step = 'plays'`, [out.runId]);
      expect(step!.status).toBe('failed');
      expect(step!.error).toMatch(/plan does not include this endpoint/);
      const leaders = await db.one<{ n: number }>(`select count(*)::int n from public.daily_leaders where workflow_run_id = $1`, [out.runId]);
      expect(leaders!.n).toBeGreaterThan(0); // leaders still available on ALL-STAR
    } finally {
      await m.close();
    }
  });

  it('flags unfinished games and proceeds with the final ones', async () => {
    const m = await startMockProviders({ unfinishedGames: 1 });
    try {
      const out = await runDailyPipeline({ db, date: '2026-11-18', stats: createBalldontlie({ env: m.env }), clips: [] });
      expect(out.status).toBe('succeeded');
      expect(out.incompleteReason).toMatch(/1 of 3 games not final/);
      const leaders = await db.query<{ status: string }>(`select g.status from public.daily_leaders d join public.games g on g.id = d.game_id where d.workflow_run_id = $1`, [out.runId]);
      expect(leaders.every((l) => l.status === 'final')).toBe(true);
    } finally {
      await m.close();
    }
  });

  it('skips unconfigured clip providers without failing the run', async () => {
    const env = { ...mock.env, HIGHLIGHT_API_KEY: undefined, HIGHLIGHTLY_API_KEY: undefined };
    const out = await runDailyPipeline({ db, date: '2026-11-17', stats: createBalldontlie({ env }), clips: [createHighlightApi({ env }), createHighlightly({ env })] });
    expect(out.status).toBe('succeeded');
    expect((out.summary.clips as Record<string, { status: string }>).highlightapi.status).toBe('skipped');
  });

  it('rejects requests without a valid key', async () => {
    const out = await runDailyPipeline({ db, date: '2026-11-16', stats: createBalldontlie({ env: { ...mock.env, BALLDONTLIE_API_KEY: 'wrong' } }), clips: [] });
    expect(out.status).toBe('failed');
    expect(String((await db.one<{ error: string }>(`select error from public.workflow_runs where id = $1`, [out.runId]))!.error)).toMatch(/401/);
  });
});
