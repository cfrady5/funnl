import type { Db } from './db';

/** Official API hosts. A successful call to one of these is what makes an integration "verified". */
export const OFFICIAL_HOSTS: Record<string, string[]> = {
  balldontlie: ['api.balldontlie.io'],
  highlightapi: ['api.highlightapi.com'],
  highlightly: ['nba.highlightly.net', 'sports.highlightly.net', 'nba-ncaab-api.p.rapidapi.com', 'sport-highlights-api.p.rapidapi.com'],
};

export interface LeaderRow {
  rank: number;
  playerId: string;
  name: string;
  team: string;
  teamName: string | null;
  opponent: string;
  home: boolean;
  gameId: string;
  gameLabel: string;
  score: string;
  assists: number;
  points: number;
  rebounds: number;
  turnovers: number;
  plusMinus: number | null;
  minutes: string | null;
  pbpAssists: number | null;
  boxVerified: boolean | null;
  candidates: number;
  linkedClips: number;
  bestScore: number | null;
}

export async function latestRun(db: Db, date: string) {
  return db.one<{ id: string; status: string; incomplete_reason: string | null; started_at: string; finished_at: string | null; attempt: number; error: string | null; summary: Record<string, unknown> }>(
    `select id, status, incomplete_reason, started_at::text, finished_at::text, attempt, error, summary from public.workflow_runs where workflow = 'daily_nba' and game_date = $1`,
    [date],
  );
}

export async function listRuns(db: Db, limit = 20) {
  const runs = await db.query<{ id: string; game_date: string; status: string; trigger: string; incomplete_reason: string | null; started_at: string | null; finished_at: string | null; attempt: number; error: string | null }>(
    `select id, game_date::text, status, trigger, incomplete_reason, started_at::text, finished_at::text, attempt, error from public.workflow_runs where workflow = 'daily_nba' order by game_date desc limit $1`,
    [limit],
  );
  const steps = runs.length
    ? await db.query<{ run_id: string; step: string; status: string; attempts: number; output: unknown; error: string | null; started_at: string | null; finished_at: string | null }>(
        `select run_id, step, status, attempts, output, error, started_at::text, finished_at::text from public.workflow_steps where run_id = any($1) order by position`,
        [runs.map((r) => r.id)],
      )
    : [];
  return runs.map((r) => ({ ...r, steps: steps.filter((s) => s.run_id === r.id) }));
}

export async function availableDates(db: Db): Promise<string[]> {
  return (await db.query<{ d: string }>(`select distinct game_date::text d from public.daily_leaders order by d desc limit 30`)).map((r) => r.d);
}

export async function leaders(db: Db, date: string, category: 'assists' | 'turnovers' = 'assists'): Promise<LeaderRow[]> {
  const run = await latestRun(db, date);
  if (!run) return [];
  return db.query<LeaderRow>(
    `select d.rank, p.id "playerId", p.full_name name, t.abbreviation team, t.full_name "teamName",
            case when g.home_team_id = s.team_id then at.abbreviation else ht.abbreviation end opponent,
            (g.home_team_id = s.team_id) home, g.id "gameId",
            at.abbreviation || ' @ ' || ht.abbreviation "gameLabel", coalesce(g.away_score,0) || '–' || coalesce(g.home_score,0) score,
            s.assists, coalesce(s.points,0) points, coalesce(s.rebounds,0) rebounds, coalesce(s.turnovers,0) turnovers, s.plus_minus "plusMinus", s.minutes_text minutes,
            s.pbp_assists "pbpAssists", g.box_verified "boxVerified",
            (select count(*)::int from public.candidate_clips c where c.player_id = p.id and c.game_id = g.id and c.brand = $3) candidates,
            (select count(*)::int from public.play_clip_links l join public.play_events e on e.id = l.play_event_id where e.primary_player_id = p.id and e.game_id = g.id and e.kind = $4) "linkedClips",
            (select max(c.suitability_score)::float from public.candidate_clips c where c.player_id = p.id and c.game_id = g.id and c.brand = $3) "bestScore"
       from public.daily_leaders d
       join public.players p on p.id = d.player_id
       join public.games g on g.id = d.game_id
       join public.player_game_stats s on s.game_id = g.id and s.player_id = p.id
       join public.teams t on t.id = s.team_id
       join public.teams ht on ht.id = g.home_team_id
       join public.teams at on at.id = g.away_team_id
      where d.workflow_run_id = $1 and d.category = $2
      order by d.rank`,
    [run.id, category, category === 'assists' ? 'tiresias' : 'antitiresias', category === 'assists' ? 'assist' : 'turnover'],
  );
}

export async function games(db: Db, date: string) {
  return db.query<{ id: string; label: string; status: string; status_text: string | null; away: string; home: string; away_score: number | null; home_score: number | null; box_verified: boolean | null; pbp: Record<string, unknown>; plays_fetched: boolean; clips: number; tipoff_at: string | null; provider_game_id: string }>(
    `select g.id, at.abbreviation || ' @ ' || ht.abbreviation label, g.status, g.status_text, at.full_name away, ht.full_name home, g.away_score, g.home_score, g.box_verified,
            g.pbp_reconciliation pbp, g.plays_fetched_at is not null plays_fetched, (select count(*)::int from public.clip_references c where c.game_id = g.id) clips, g.tipoff_at::text, g.provider_game_id
       from public.games g join public.teams ht on ht.id = g.home_team_id join public.teams at on at.id = g.away_team_id
      where g.game_date = $1 order by g.tipoff_at nulls last`,
    [date],
  );
}

export interface CandidateRow {
  id: string;
  brand: 'tiresias' | 'antitiresias';
  playerId: string;
  player: string;
  team: string | null;
  gameLabel: string;
  period: number;
  clock: string | null;
  description: string;
  attribution: string;
  partner: string | null;
  scoreValue: number | null;
  score: number;
  coverage: number;
  breakdown: { factors: Array<{ factor: string; value: number; source: string; note?: string; contribution: number }> };
  status: string;
  projectRef: string | null;
  clip: { provider: string; embedUrl: string | null; url: string | null; level: string; display: string; title: string | null } | null;
  gameClips: number;
  playEventId: string;
  gameId: string;
}

export async function candidates(db: Db, date: string, opts: { playerId?: string; brand?: 'tiresias' | 'antitiresias'; limit?: number } = {}): Promise<CandidateRow[]> {
  return db.query<CandidateRow>(
    `select c.id, c.brand, p.id "playerId", p.full_name player, t.abbreviation team, at.abbreviation || ' @ ' || ht.abbreviation "gameLabel", e.period, e.clock, e.description,
            e.attribution, e.secondary_name_text partner, e.score_value "scoreValue", c.suitability_score::float score, c.score_coverage::float coverage, c.score_breakdown breakdown,
            c.status, c.project_ref "projectRef", e.id "playEventId", g.id "gameId",
            case when cr.id is null then null else json_build_object('provider', cr.provider, 'embedUrl', cr.embed_url, 'url', cr.url, 'level', l.level, 'display', cr.display, 'title', cr.title) end clip,
            (select count(*)::int from public.clip_references x where x.game_id = g.id) "gameClips"
       from public.candidate_clips c
       join public.play_events e on e.id = c.play_event_id
       join public.players p on p.id = c.player_id
       join public.games g on g.id = c.game_id
       join public.teams ht on ht.id = g.home_team_id
       join public.teams at on at.id = g.away_team_id
       left join public.teams t on t.id = e.team_id
       left join public.clip_references cr on cr.id = c.best_clip_reference_id
       left join public.play_clip_links l on l.play_event_id = e.id and l.clip_reference_id = cr.id
      where c.game_date = $1 and ($2::uuid is null or c.player_id = $2) and ($3::text is null or c.brand::text = $3)
      order by c.suitability_score desc nulls last, e.period, e.clock_seconds desc
      limit $4`,
    [date, opts.playerId ?? null, opts.brand ?? null, opts.limit ?? 200],
  );
}

export async function gameHighlights(db: Db, gameId: string) {
  return db.query<{ provider: string; title: string | null; url: string | null; embed_url: string | null; source_platform: string | null; provider_confidence: string | null; display: string }>(
    `select provider, title, url, embed_url, source_platform, provider_confidence, display from public.clip_references where game_id = $1 and granularity = 'game' order by provider, title`,
    [gameId],
  );
}

export interface ProviderEvidence {
  provider: string;
  lastOfficialSuccess: string | null;
  lastOfficialFailure: { at: string; status: number | null; error: string | null } | null;
  lastMockSuccess: string | null;
  officialCalls: number;
}

/** What has actually been exercised, per provider — the basis for "verified" vs "documented". */
export async function providerEvidence(db: Db): Promise<ProviderEvidence[]> {
  const rows = await db.query<{ provider: string; host: string | null; ok: boolean; http_status: number | null; error: string | null; at: string }>(
    `select provider, params->>'_host' host, ok, http_status, error, retrieved_at::text at from public.provider_requests order by retrieved_at desc limit 2000`,
  );
  return Object.keys(OFFICIAL_HOSTS).map((provider) => {
    const mine = rows.filter((r) => r.provider === provider);
    const official = mine.filter((r) => r.host && OFFICIAL_HOSTS[provider].includes(r.host));
    const fail = official.find((r) => !r.ok);
    return {
      provider,
      lastOfficialSuccess: official.find((r) => r.ok)?.at ?? null,
      lastOfficialFailure: fail ? { at: fail.at, status: fail.http_status, error: fail.error } : null,
      lastMockSuccess: mine.find((r) => r.ok && !(r.host && OFFICIAL_HOSTS[provider].includes(r.host)))?.at ?? null,
      officialCalls: official.length,
    };
  });
}

/** True if any stored data for the date came from a non-official (mock) host. */
export async function dateUsesSimulatedData(db: Db, date: string): Promise<boolean> {
  const run = await latestRun(db, date);
  if (!run) return false;
  const r = await db.one<{ n: number }>(
    `select count(*)::int n from public.provider_requests where workflow_run_id = $1 and provider = 'balldontlie' and coalesce(params->>'_host','') <> all($2)`,
    [run.id, OFFICIAL_HOSTS.balldontlie],
  );
  return (r?.n ?? 0) > 0;
}

/** Has the date's run finished with every game final? (drives the retry ladder) */
export async function latestRunStatus(db: Db, date: string): Promise<{ status: string; complete: boolean } | null> {
  const r = await db.one<{ status: string; incomplete_reason: string | null }>(`select status, incomplete_reason from public.workflow_runs where workflow = 'daily_nba' and game_date = $1`, [date]);
  return r ? { status: r.status, complete: r.status === 'succeeded' && !r.incomplete_reason } : null;
}
