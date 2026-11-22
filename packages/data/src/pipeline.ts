import {
  extractEvents,
  linkClipToEvent,
  rankAssistLeaders,
  reconcile,
  scoreCandidate,
  type ExtractedEvent,
  type FactorValue,
  type GameRec,
  type PlayRec,
  type PlayerBoxRec,
  type ScoringFactor,
} from '@tiresias/core';
import type { Db } from './db';
import { ProviderAccessError, type ArchivedRequest } from './http';
import type { ClipDiscoveryProvider, StatsProvider } from './providers/types';

export const PIPELINE_STEPS = ['games', 'box_scores', 'leaders', 'plays', 'events', 'clips', 'links', 'candidates'] as const;
export type PipelineStep = (typeof PIPELINE_STEPS)[number];

export const STEP_LABELS: Record<PipelineStep, string> = {
  games: 'Retrieve games for the NBA date',
  box_scores: 'Retrieve final player box scores',
  leaders: 'Rank top 15 assist leaders',
  plays: 'Retrieve play-by-play for leaders’ games',
  events: 'Identify individual assists & turnovers',
  clips: 'Discover clip references',
  links: 'Link clips to plays',
  candidates: 'Score candidate plays',
};

export interface PipelineOptions {
  db: Db;
  date: string;
  stats: StatsProvider;
  clips: ClipDiscoveryProvider[];
  trigger?: 'schedule' | 'manual' | 'retry';
  /** Start (or restart) from this step; earlier steps are reused from the database. */
  fromStep?: PipelineStep;
  log?: (msg: string) => void;
  leaderCount?: number;
  /** Called as soon as the run row exists, so provider calls can be archived against it. */
  onRunId?: (runId: string) => void;
}

export interface RunOutcome {
  runId: string;
  status: 'succeeded' | 'failed';
  incompleteReason: string | null;
  summary: Record<string, unknown>;
}

export function workflowKey(date: string) {
  return `daily:nba:${date}`;
}

/** Archive hook factory: every provider call is stored with the run it belongs to. */
export function archiveTo(db: Db, runId: () => string | null) {
  return async (r: ArchivedRequest) => {
    await db.query(
      `insert into public.provider_requests (provider, endpoint, params, http_status, ok, duration_ms, payload, payload_sha256, error, workflow_run_id, retrieved_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [r.provider, r.endpoint, JSON.stringify({ ...r.params, _host: r.host }), r.httpStatus, r.ok, r.durationMs, r.payload == null ? null : JSON.stringify(r.payload), r.payloadSha256, r.error, runId(), r.retrievedAt],
    );
  };
}

/* ───────────────────────── upserts ───────────────────────── */

async function upsertTeam(db: Db, t: GameRec['home']): Promise<string> {
  const r = await db.one<{ id: string }>(
    `insert into public.teams (provider, provider_team_id, abbreviation, name, city, full_name) values ($1,$2,$3,$4,$5,$6)
     on conflict (provider, provider_team_id) do update set abbreviation = excluded.abbreviation, name = excluded.name, city = excluded.city, full_name = excluded.full_name
     returning id`,
    [t.provider, t.providerId, t.abbreviation, t.name, t.city, t.fullName],
  );
  return r!.id;
}

async function upsertGame(db: Db, g: GameRec, retrievedAt: string): Promise<string> {
  const home = await upsertTeam(db, g.home);
  const away = await upsertTeam(db, g.away);
  const r = await db.one<{ id: string }>(
    `insert into public.games (provider, provider_game_id, game_date, tipoff_at, home_team_id, away_team_id, status, status_text, period, postseason, season, home_score, away_score, data_complete, retrieved_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     on conflict (provider, provider_game_id) do update set game_date = excluded.game_date, tipoff_at = excluded.tipoff_at, status = excluded.status,
       status_text = excluded.status_text, period = excluded.period, home_score = excluded.home_score, away_score = excluded.away_score,
       data_complete = excluded.data_complete, retrieved_at = excluded.retrieved_at
     returning id`,
    [g.provider, g.providerId, g.date, g.tipoffAt, home, away, g.state, g.statusText, g.period, g.postseason, g.season, g.homeScore, g.awayScore, g.state === 'final', retrievedAt],
  );
  return r!.id;
}

async function upsertPlayer(db: Db, p: PlayerBoxRec['player'], teamId: string): Promise<string> {
  const r = await db.one<{ id: string }>(
    `insert into public.players (provider, provider_player_id, full_name, team_id, jersey, position) values ($1,$2,$3,$4,$5,$6)
     on conflict (provider, provider_player_id) do update set full_name = excluded.full_name, team_id = excluded.team_id, jersey = excluded.jersey, position = excluded.position
     returning id`,
    [p.provider, p.providerId, `${p.firstName} ${p.lastName}`.trim(), teamId, p.jersey, p.position],
  );
  return r!.id;
}

export function minutesToNumber(min: string | null): number {
  if (!min) return 0;
  const [m, s] = min.split(':');
  return Number(m || 0) + Number(s || 0) / 60;
}

/* ───────────────────────── run bookkeeping ───────────────────────── */

async function startRun(db: Db, date: string, trigger: string): Promise<string> {
  const r = await db.one<{ id: string }>(
    `insert into public.workflow_runs (workflow, game_date, idempotency_key, status, trigger, started_at)
     values ('daily_nba', $1, $2, 'running', $3, now())
     on conflict (idempotency_key) do update set status = 'running', trigger = excluded.trigger, started_at = now(), finished_at = null, error = null,
       attempt = public.workflow_runs.attempt + 1
     returning id`,
    [date, workflowKey(date), trigger],
  );
  return r!.id;
}

async function stepStart(db: Db, runId: string, step: PipelineStep) {
  await db.query(
    `insert into public.workflow_steps (run_id, step, status, attempts, started_at, position) values ($1,$2,'running',1,now(),$3)
     on conflict (run_id, step) do update set status = 'running', attempts = public.workflow_steps.attempts + 1, started_at = now(), finished_at = null, error = null`,
    [runId, step, PIPELINE_STEPS.indexOf(step)],
  );
}

async function stepEnd(db: Db, runId: string, step: PipelineStep, status: 'succeeded' | 'failed', output: unknown, error?: string) {
  await db.query(`update public.workflow_steps set status = $3, output = $4, error = $5, finished_at = now() where run_id = $1 and step = $2`, [
    runId,
    step,
    status,
    JSON.stringify(output ?? {}),
    error ?? null,
  ]);
}

/* ───────────────────────── the pipeline ───────────────────────── */

export async function runDailyPipeline(o: PipelineOptions): Promise<RunOutcome> {
  const { db, date } = o;
  const log = o.log ?? (() => undefined);
  const runId = await startRun(db, date, o.trigger ?? 'manual');
  o.onRunId?.(runId);
  const startIdx = o.fromStep ? PIPELINE_STEPS.indexOf(o.fromStep) : 0;
  const summary: Record<string, unknown> = {};
  let incompleteReason: string | null = null;
  const leaderCount = o.leaderCount ?? 15;

  const games = async () => db.query<{ id: string; provider_game_id: string; status: string; home_abbr: string; away_abbr: string; home_team_id: string; away_team_id: string; home_score: number | null; away_score: number | null; game_date: string }>(
    `select g.id, g.provider_game_id, g.status, ht.abbreviation home_abbr, at.abbreviation away_abbr, g.home_team_id, g.away_team_id, g.home_score, g.away_score, g.game_date::text
       from public.games g join public.teams ht on ht.id = g.home_team_id join public.teams at on at.id = g.away_team_id
      where g.game_date = $1 and g.provider = $2 order by g.tipoff_at nulls last`,
    [date, o.stats.id],
  );

  const steps: Record<PipelineStep, () => Promise<unknown>> = {
    async games() {
      const recs = await o.stats.listGames(date);
      const onDate = recs.filter((g) => g.date === date);
      const now = new Date().toISOString();
      for (const g of onDate) await upsertGame(db, g, now);
      const notFinal = onDate.filter((g) => g.state !== 'final');
      if (onDate.length === 0) incompleteReason = null;
      else if (notFinal.length) incompleteReason = `${notFinal.length} of ${onDate.length} games not final (${notFinal.map((g) => `${g.away.abbreviation}@${g.home.abbreviation}: ${g.statusText ?? g.state}`).join(', ')})`;
      return { games: onDate.length, final: onDate.length - notFinal.length, returnedByProvider: recs.length, notFinal: notFinal.map((g) => g.providerId) };
    },

    async box_scores() {
      const final = (await games()).filter((g) => g.status === 'final');
      if (!final.length) return { players: 0, games: 0 };
      const stats = await o.stats.playerStats(final.map((g) => g.provider_game_id));
      const now = new Date().toISOString();
      const teamIds = new Map<string, string>();
      for (const t of await db.query<{ id: string; provider_team_id: string }>(`select id, provider_team_id from public.teams where provider = $1`, [o.stats.id])) teamIds.set(t.provider_team_id, t.id);
      let n = 0;
      for (const s of stats) {
        const game = final.find((g) => g.provider_game_id === s.gameProviderId);
        const teamId = teamIds.get(s.teamProviderId);
        if (!game || !teamId) continue;
        const playerId = await upsertPlayer(db, s.player, teamId);
        await db.query(
          `insert into public.player_game_stats (game_id, player_id, team_id, minutes, minutes_text, points, assists, turnovers, rebounds, steals, blocks, fouls, fgm, fga, fg3m, fg3a, ftm, fta, plus_minus, raw, provider, provider_stat_id, retrieved_at)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
           on conflict (game_id, player_id) do update set minutes = excluded.minutes, minutes_text = excluded.minutes_text, points = excluded.points, assists = excluded.assists,
             turnovers = excluded.turnovers, rebounds = excluded.rebounds, steals = excluded.steals, blocks = excluded.blocks, fouls = excluded.fouls, fgm = excluded.fgm,
             fga = excluded.fga, fg3m = excluded.fg3m, fg3a = excluded.fg3a, ftm = excluded.ftm, fta = excluded.fta, plus_minus = excluded.plus_minus, raw = excluded.raw, retrieved_at = excluded.retrieved_at`,
          [game.id, playerId, teamId, Math.round(minutesToNumber(s.minutes) * 100) / 100, s.minutes, s.pts, s.ast, s.turnovers, s.reb, s.stl, s.blk, s.pf, s.fgm, s.fga, s.fg3m, s.fg3a, s.ftm, s.fta, s.plusMinus, JSON.stringify(s), s.provider, s.providerStatId, now],
        );
        n++;
      }
      // Verification: player points must add up to each team's final score.
      const verification: Record<string, unknown> = {};
      for (const g of final) {
        const sums = await db.query<{ team_id: string; pts: number }>(`select team_id, sum(points)::int pts from public.player_game_stats where game_id = $1 group by team_id`, [g.id]);
        const home = sums.find((x) => x.team_id === g.home_team_id)?.pts ?? null;
        const away = sums.find((x) => x.team_id === g.away_team_id)?.pts ?? null;
        const ok = home === g.home_score && away === g.away_score;
        verification[g.provider_game_id] = { ok, home: [home, g.home_score], away: [away, g.away_score] };
        await db.query(`update public.games set box_verified = $2, box_verification = $3 where id = $1`, [g.id, ok, JSON.stringify({ home: [home, g.home_score], away: [away, g.away_score] })]);
        await db.query(`update public.player_game_stats set verified = $2 where game_id = $1`, [g.id, ok]);
      }
      const unverified = Object.entries(verification).filter(([, v]) => !(v as { ok: boolean }).ok).map(([k]) => k);
      return { players: n, games: final.length, unverifiedGames: unverified };
    },

    async leaders() {
      const rows = await db.query<{ player_id: string; name: string; abbr: string; game_id: string; assists: number; turnovers: number; minutes: number }>(
        `select s.player_id, p.full_name name, t.abbreviation abbr, s.game_id, s.assists, coalesce(s.turnovers,0) turnovers, coalesce(s.minutes,0)::float minutes
           from public.player_game_stats s join public.players p on p.id = s.player_id join public.teams t on t.id = s.team_id join public.games g on g.id = s.game_id
          where g.game_date = $1 and g.provider = $2 and g.status = 'final'`,
        [date, o.stats.id],
      );
      const lines = rows.map((r) => ({ playerId: r.player_id, name: r.name, teamAbbr: r.abbr, gameId: r.game_id, assists: r.assists, turnovers: r.turnovers, minutes: r.minutes }));
      const top = rankAssistLeaders(lines, leaderCount);
      const tov = [...lines].sort((a, b) => b.turnovers - a.turnovers || a.minutes - b.minutes || a.name.localeCompare(b.name)).filter((l) => l.turnovers > 0).slice(0, 10);
      await db.query(`delete from public.daily_leaders where workflow_run_id = $1`, [runId]);
      for (const [cat, list] of [['assists', top], ['turnovers', tov]] as const) {
        for (const [i, l] of list.entries()) {
          await db.query(`insert into public.daily_leaders (workflow_run_id, game_date, category, rank, player_id, game_id, value) values ($1,$2,$3,$4,$5,$6,$7)`, [
            runId, date, cat, i + 1, l.playerId, l.gameId, cat === 'assists' ? l.assists : l.turnovers,
          ]);
        }
      }
      return { assistLeaders: top.map((l) => `${l.name} ${l.assists}`), turnoverLeaders: tov.slice(0, 5).map((l) => `${l.name} ${l.turnovers}`) };
    },

    async plays() {
      const gameIds = (await db.query<{ game_id: string; provider_game_id: string }>(
        `select distinct d.game_id, g.provider_game_id from public.daily_leaders d join public.games g on g.id = d.game_id where d.workflow_run_id = $1`,
        [runId],
      ));
      let total = 0;
      const fetched: string[] = [];
      for (const g of gameIds) {
        const plays = await o.stats.plays(g.provider_game_id);
        await storePlays(db, g.game_id, plays);
        await db.query(`update public.games set plays_fetched_at = now() where id = $1`, [g.game_id]);
        total += plays.length;
        fetched.push(g.provider_game_id);
      }
      return { games: fetched.length, plays: total };
    },

    async events() {
      const gs = await db.query<{ id: string; provider_game_id: string }>(
        `select distinct g.id, g.provider_game_id from public.daily_leaders d join public.games g on g.id = d.game_id where d.workflow_run_id = $1 and g.plays_fetched_at is not null`,
        [runId],
      );
      const perGame: Record<string, unknown> = {};
      let assists = 0;
      let turnovers = 0;
      for (const g of gs) {
        const res = await classifyGame(db, g.id, o.stats.id);
        perGame[g.provider_game_id] = res.summary;
        assists += res.assists;
        turnovers += res.turnovers;
      }
      const unverified = Object.entries(perGame).filter(([, v]) => !(v as { assistsVerified: boolean }).assistsVerified).map(([k]) => k);
      return { games: gs.length, assists, turnovers, gamesWithAssistMismatch: unverified, perGame };
    },

    async clips() {
      const gs = await games();
      const recs: Array<Pick<GameRec, 'providerId' | 'home' | 'away' | 'date'>> = gs.map((g) => ({
        providerId: g.provider_game_id,
        date: g.game_date,
        home: { provider: o.stats.id, providerId: '', abbreviation: g.home_abbr, city: '', name: '', fullName: '' },
        away: { provider: o.stats.id, providerId: '', abbreviation: g.away_abbr, city: '', name: '', fullName: '' },
      }));
      const out: Record<string, unknown> = {};
      for (const p of o.clips) {
        if (!p.configured) {
          out[p.id] = { status: 'skipped', reason: `not configured (needs ${p.needs.join(', ')})` };
          continue;
        }
        try {
          const refs = await p.discover(date, recs);
          let stored = 0;
          for (const r of refs) {
            const game = gs.find((g) => g.provider_game_id === r.gameProviderId);
            await db.query(
              `insert into public.clip_references (provider, external_id, game_id, provider_game_key, granularity, title, url, embed_url, thumbnail_url, source_platform, source_account, posted_at, provider_confidence, matched_play, display, acquisition, raw, retrieved_at)
               values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17, now())
               on conflict (provider, external_id) do update set game_id = excluded.game_id, granularity = excluded.granularity, title = excluded.title, url = excluded.url,
                 embed_url = excluded.embed_url, thumbnail_url = excluded.thumbnail_url, provider_confidence = excluded.provider_confidence, matched_play = excluded.matched_play,
                 raw = excluded.raw, retrieved_at = now()`,
              [r.provider, r.externalId, game?.id ?? null, r.gameProviderKey, r.granularity, r.title, r.url, r.embedUrl, r.thumbnailUrl, r.sourcePlatform, r.sourceAccount, r.postedAt,
               r.providerConfidence, r.matchedPlay ? JSON.stringify(r.matchedPlay) : null, p.capabilities.display, p.capabilities.acquisition, JSON.stringify(r.raw ?? null)],
            );
            stored++;
          }
          out[p.id] = { status: 'ok', references: stored, playLevel: refs.filter((r) => r.granularity === 'play').length };
        } catch (e) {
          // One provider failing must not block the others or the rest of the run.
          out[p.id] = { status: e instanceof ProviderAccessError ? 'access_denied' : 'error', reason: (e as Error).message };
        }
      }
      return out;
    },

    async links() {
      const events = await db.query<{ id: string; kind: 'assist' | 'turnover'; sequence: number; period: number; clock_seconds: number | null; wallclock: string | null; abbr: string | null; primary_name_text: string | null; secondary_name_text: string | null; game_id: string; attribution: string }>(
        `select e.id, e.kind, e.sequence, e.period, e.clock_seconds::float, e.wallclock::text, t.abbreviation abbr, e.primary_name_text, e.secondary_name_text, e.game_id, e.attribution
           from public.play_events e left join public.teams t on t.id = e.team_id
          where e.kind in ('assist','turnover') and e.game_id in (select distinct game_id from public.daily_leaders where workflow_run_id = $1)`,
        [runId],
      );
      const clips = await db.query<{ id: string; game_id: string; provider: string; external_id: string; granularity: 'play' | 'game'; matched_play: never; provider_confidence: string | null }>(
        `select id, game_id, provider, external_id, granularity, matched_play, provider_confidence from public.clip_references where granularity = 'play' and game_id in (select distinct game_id from public.daily_leaders where workflow_run_id = $1)`,
        [runId],
      );
      let links = 0;
      for (const c of clips) {
        const candidates = events.filter((e) => e.game_id === c.game_id);
        let best: { id: string; r: ReturnType<typeof linkClipToEvent> } | null = null;
        for (const e of candidates) {
          const r = linkClipToEvent(
            { provider: c.provider, externalId: c.external_id, gameProviderKey: null, title: null, url: null, embedUrl: null, thumbnailUrl: null, sourcePlatform: null, sourceAccount: null, postedAt: null, granularity: c.granularity, providerConfidence: c.provider_confidence, matchedPlay: c.matched_play, raw: null },
            {
              kind: e.kind, order: e.sequence, period: e.period, clockSeconds: e.clock_seconds, wallclock: e.wallclock, teamProviderId: null, playerId: null, playerNameInText: e.primary_name_text,
              secondaryPlayerId: null, secondaryNameInText: e.secondary_name_text, attribution: e.attribution as ExtractedEvent['attribution'], scoreValue: null, shotType: '', text: '',
              teamAbbreviation: e.abbr, playerName: e.primary_name_text, scorerName: e.secondary_name_text,
            },
          );
          if (r.level !== 'none' && (!best || r.score > best.r.score)) best = { id: e.id, r };
        }
        if (best && best.r.level !== 'none') {
          await db.query(
            `insert into public.play_clip_links (play_event_id, clip_reference_id, score, level, reasons) values ($1,$2,$3,$4,$5)
             on conflict (play_event_id, clip_reference_id) do update set score = excluded.score, level = excluded.level, reasons = excluded.reasons`,
            [best.id, c.id, best.r.score, best.r.level, JSON.stringify(best.r.reasons)],
          );
          links++;
        }
      }
      return { playLevelClips: clips.length, linked: links };
    },

    async candidates() {
      const rows = await db.query<{
        id: string; kind: 'assist' | 'turnover'; brand: 'tiresias' | 'antitiresias'; player_id: string; game_id: string; period: number; clock_seconds: number | null;
        score_value: number | null; play_type: string | null; description: string; attribution: string; home_score: number | null; away_score: number | null;
        best_clip: string | null; best_level: string | null; best_provider: string | null; best_embed: string | null;
      }>(
        `select e.id, e.kind, case when e.kind = 'assist' then 'tiresias' else 'antitiresias' end brand, e.primary_player_id player_id, e.game_id, e.period, e.clock_seconds::float,
                e.score_value, e.play_type, e.description, e.attribution, e.home_score, e.away_score,
                l.clip_reference_id best_clip, l.level best_level, c.provider best_provider, c.embed_url best_embed
           from public.play_events e
           join public.daily_leaders d on d.workflow_run_id = $1 and d.player_id = e.primary_player_id and d.game_id = e.game_id
                and d.category = case when e.kind = 'assist' then 'assists' else 'turnovers' end
           left join lateral (select * from public.play_clip_links x where x.play_event_id = e.id order by x.score desc limit 1) l on true
           left join public.clip_references c on c.id = l.clip_reference_id
          where e.kind in ('assist','turnover') and e.primary_player_id is not null`,
        [runId],
      );
      let n = 0;
      for (const r of rows) {
        const s = scoreCandidate(dataFactors(r));
        await db.query(
          `insert into public.candidate_clips (play_event_id, brand, discovery_provider, discovery_reference, suitability_score, score_breakdown, score_coverage, status, player_id, game_id, game_date, best_clip_reference_id)
           values ($1,$2,$3,$4,$5,$6,$7,'awaiting_footage',$8,$9,$10,$11)
           on conflict (play_event_id, brand) where play_event_id is not null do update set discovery_provider = excluded.discovery_provider, discovery_reference = excluded.discovery_reference,
             suitability_score = excluded.suitability_score, score_breakdown = excluded.score_breakdown, score_coverage = excluded.score_coverage, best_clip_reference_id = excluded.best_clip_reference_id,
             updated_at = now()`,
          [r.id, r.brand, r.best_provider ?? o.stats.id, r.best_embed, s.total, JSON.stringify(s), s.coverage, r.player_id, r.game_id, date, r.best_clip],
        );
        n++;
      }
      return { candidates: n, note: 'Visual factors are not measured until Phase 4 (CV); coverage reflects that.' };
    },
  };

  let failed: { step: PipelineStep; error: string } | null = null;
  for (const step of PIPELINE_STEPS.slice(startIdx)) {
    log(`▶ ${step}`);
    await stepStart(db, runId, step);
    try {
      const out = await steps[step]();
      summary[step] = out;
      await stepEnd(db, runId, step, 'succeeded', out);
      if (step === 'games' && (out as { games: number }).games === 0) {
        summary.note = 'No games on this date.';
        break;
      }
    } catch (e) {
      const msg = (e as Error).message;
      await stepEnd(db, runId, step, 'failed', {}, msg);
      failed = { step, error: msg };
      log(`✖ ${step}: ${msg}`);
      break;
    }
  }
  if (startIdx > 0 && incompleteReason === null) {
    const prev = await db.one<{ incomplete_reason: string | null }>(`select incomplete_reason from public.workflow_runs where id = $1`, [runId]);
    incompleteReason = prev?.incomplete_reason ?? null;
  }
  const status = failed ? 'failed' : 'succeeded';
  await db.query(`update public.workflow_runs set status = $2, finished_at = now(), incomplete_reason = $3, summary = $4, error = $5 where id = $1`, [
    runId, status, incompleteReason, JSON.stringify(summary), failed ? `${failed.step}: ${failed.error}` : null,
  ]);
  return { runId, status, incompleteReason, summary };
}

/** Bulk upsert of a game's plays (all plays kept for traceability; classified later). */
async function storePlays(db: Db, gameId: string, plays: PlayRec[]) {
  if (!plays.length) return;
  const teamIds = new Map<string, string>();
  for (const t of await db.query<{ id: string; provider_team_id: string }>(`select id, provider_team_id from public.teams where provider = $1`, [plays[0].provider])) teamIds.set(t.provider_team_id, t.id);
  const col = <T>(f: (p: PlayRec) => T) => plays.map(f);
  await db.query(
    `insert into public.play_events (game_id, provider, provider_event_id, kind, sequence, period, clock, clock_seconds, description, play_type, team_id, wallclock, scoring_play, shooting_play, score_value, home_score, away_score, participants, raw, retrieved_at)
     select $1, $2, x.eid, 'other', x.seq, x.period, x.clock, x.secs, x.text, x.ptype, x.team, x.wall, x.scoring, x.shooting, x.sval, x.hs, x.aws, string_to_array(x.parts, ','), x.raw, now()
       from unnest($3::text[], $4::int[], $5::int[], $6::text[], $7::numeric[], $8::text[], $9::text[], $10::uuid[], $11::timestamptz[], $12::bool[], $13::bool[], $14::int[], $15::int[], $16::int[], $17::text[], $18::jsonb[])
         as x(eid, seq, period, clock, secs, text, ptype, team, wall, scoring, shooting, sval, hs, aws, parts, raw)
     on conflict (game_id, provider, provider_event_id) do update set sequence = excluded.sequence, period = excluded.period, clock = excluded.clock, clock_seconds = excluded.clock_seconds,
       description = excluded.description, play_type = excluded.play_type, team_id = excluded.team_id, wallclock = excluded.wallclock, scoring_play = excluded.scoring_play,
       shooting_play = excluded.shooting_play, score_value = excluded.score_value, home_score = excluded.home_score, away_score = excluded.away_score, participants = excluded.participants, raw = excluded.raw`,
    [
      gameId,
      plays[0].provider,
      col((p) => String(p.order)),
      col((p) => p.order),
      col((p) => p.period),
      col((p) => p.clock),
      col((p) => {
        const c = p.clock;
        if (!c) return null;
        const m = /^(\d+):(\d+(?:\.\d+)?)$/.exec(c);
        return m ? Number(m[1]) * 60 + Number(m[2]) : Number.isFinite(Number(c)) ? Number(c) : null;
      }),
      col((p) => p.text),
      col((p) => p.type),
      col((p) => (p.teamProviderId ? teamIds.get(p.teamProviderId) ?? null : null)),
      col((p) => p.wallclock),
      col((p) => p.scoringPlay),
      col((p) => p.shootingPlay),
      col((p) => p.scoreValue),
      col((p) => p.homeScore),
      col((p) => p.awayScore),
      col((p) => p.participants.join(',')),
      col((p) => JSON.stringify(p)),
    ],
  );
}

/** Classify one game's plays into assists/turnovers and reconcile with the box score. */
async function classifyGame(db: Db, gameId: string, provider: string) {
  const plays = (await db.query<{ raw: PlayRec }>(`select raw from public.play_events where game_id = $1 order by sequence`, [gameId])).map((r) => r.raw);
  const rosterRows = await db.query<{ player_uuid: string; provider_player_id: string; full_name: string; team_uuid: string; provider_team_id: string; raw: PlayerBoxRec }>(
    `select p.id player_uuid, p.provider_player_id, p.full_name, t.id team_uuid, t.provider_team_id, s.raw
       from public.player_game_stats s join public.players p on p.id = s.player_id join public.teams t on t.id = s.team_id
      where s.game_id = $1 and p.provider = $2`,
    [gameId, provider],
  );
  const roster = rosterRows.map((r) => ({ id: r.provider_player_id, firstName: r.raw.player.firstName, lastName: r.raw.player.lastName, teamId: r.provider_team_id }));
  const events = extractEvents(plays, roster);
  const uuid = new Map(rosterRows.map((r) => [r.provider_player_id, r.player_uuid]));
  await db.query(`update public.play_events set kind = 'other', primary_player_id = null, secondary_player_id = null, attribution = null, primary_name_text = null, secondary_name_text = null where game_id = $1`, [gameId]);
  for (const e of events) {
    await db.query(
      `update public.play_events set kind = $3, primary_player_id = $4, secondary_player_id = $5, attribution = $6, primary_name_text = $7, secondary_name_text = $8
        where game_id = $1 and provider_event_id = $2`,
      [gameId, String(e.order), e.kind, e.playerId ? uuid.get(e.playerId) ?? null : null, e.secondaryPlayerId ? uuid.get(e.secondaryPlayerId) ?? null : null, e.attribution, e.playerNameInText, e.secondaryNameInText],
    );
  }
  const summary = reconcile(events, rosterRows.map((r) => r.raw));
  for (const p of summary.players) {
    await db.query(`update public.player_game_stats set pbp_assists = $3, pbp_turnovers = $4 where game_id = $1 and player_id = $2`, [gameId, uuid.get(p.playerId), p.extractedAssists, p.extractedTurnovers]);
  }
  const compact = { assistsVerified: summary.assistsVerified, assistCoverage: summary.assistCoverage, unresolvedEvents: summary.unresolvedEvents, mismatches: summary.players.filter((p) => !p.assistsMatch).length };
  await db.query(`update public.games set pbp_reconciliation = $2 where id = $1`, [gameId, JSON.stringify(compact)]);
  return { summary: compact, assists: events.filter((e) => e.kind === 'assist').length, turnovers: events.filter((e) => e.kind === 'turnover').length };
}

/** Candidate factors derivable from data alone (no footage yet). Visual factors stay unmeasured. */
export function dataFactors(r: { kind: 'assist' | 'turnover'; period: number; clock_seconds: number | null; score_value: number | null; play_type: string | null; description: string; attribution: string; home_score: number | null; away_score: number | null; best_level: string | null }): Partial<Record<ScoringFactor, FactorValue>> {
  const f: Partial<Record<ScoringFactor, FactorValue>> = {};
  const text = `${r.play_type ?? ''} ${r.description}`.toLowerCase();
  const margin = r.home_score != null && r.away_score != null ? Math.abs(r.home_score - r.away_score) : null;
  const clutch = r.period >= 4 && (r.clock_seconds ?? 720) <= 300 && margin != null && margin <= 8;
  let ent = r.kind === 'assist' ? (/alley|dunk/.test(text) ? 0.85 : r.score_value === 3 ? 0.75 : 0.55) : /bad pass/.test(text) ? 0.8 : 0.55;
  if (clutch) ent = Math.min(1, ent + 0.15);
  f.entertainment = { value: ent, source: 'data', note: [r.score_value === 3 ? '3PT' : null, /alley|dunk/.test(text) ? 'rim finish' : null, clutch ? 'clutch' : null].filter(Boolean).join(', ') || 'standard' };
  f.explainability = { value: r.attribution === 'confirmed' ? 1 : r.attribution === 'text_only' ? 0.7 : 0.2, source: 'data', note: `attribution ${r.attribution}` };
  f.decisionComplexity = { value: r.kind === 'assist' ? (r.score_value === 3 ? 0.7 : 0.55) : /bad pass/.test(text) ? 0.7 : 0.4, source: 'data', note: r.kind === 'assist' ? 'kick-outs > interior feeds (heuristic)' : 'passing turnovers are decision errors (heuristic)' };
  if (r.best_level) f.possessionContinuity = { value: r.best_level === 'strong' ? 0.7 : 0.5, source: 'data', note: `official clip linked (${r.best_level})` };
  return f;
}
