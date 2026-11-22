import { zonedDateString, type GameRec, type GameState, type PlayRec, type PlayerBoxRec, type TeamRec } from '@tiresias/core';
import { ProviderHttpClient } from '../http';
import type { ProviderContext, StatsProvider } from './types';

/**
 * BALLDONTLIE NBA adapter. Paths, params and fields follow the published
 * OpenAPI spec (https://www.balldontlie.io/openapi/nba.yml, read 2026-11-22):
 *   GET /nba/v1/games?dates[]=&per_page=&cursor=      (all tiers)
 *   GET /nba/v1/stats?game_ids[]=&per_page=&cursor=   (ALL-STAR and above)
 *   GET /nba/v1/plays?game_id=                        (GOAT)
 * Auth: `Authorization: <API_KEY>` (no "Bearer" prefix).
 */
interface BdlTeam { id: number; abbreviation: string; city: string; name: string; full_name: string }
interface BdlGame {
  id: number; date: string; season?: number; status?: string | null; status_state?: string; period?: number | null;
  datetime?: string | null; postseason?: boolean; home_team_score?: number; visitor_team_score?: number;
  home_team: BdlTeam; visitor_team: BdlTeam;
}
interface BdlPlayer { id: number; first_name: string; last_name: string; position?: string; jersey_number?: string }
interface BdlStat {
  id?: number; min?: string; fgm?: number; fga?: number; fg3m?: number; fg3a?: number; ftm?: number; fta?: number;
  reb?: number; ast?: number; stl?: number; blk?: number; turnover?: number; pf?: number; pts?: number; plus_minus?: number | null;
  player: BdlPlayer; team: BdlTeam; game: { id: number };
}
interface BdlPlay {
  game_id: number; order: number; type: string; text: string; home_score?: number; away_score?: number; period: number;
  clock: string | null; scoring_play?: boolean; shooting_play?: boolean; score_value?: number | null; team?: BdlTeam | null;
  wallclock?: string | null; participants?: number[];
}
interface Page<T> { data: T[]; meta?: { next_cursor?: number | null } }

const STATES: GameState[] = ['scheduled', 'in_progress', 'final', 'postponed', 'canceled', 'delayed', 'suspended', 'abandoned', 'unknown'];

export const BALLDONTLIE_ID = 'balldontlie';

export function mapTeam(t: BdlTeam): TeamRec {
  return { provider: BALLDONTLIE_ID, providerId: String(t.id), abbreviation: t.abbreviation, city: t.city, name: t.name, fullName: t.full_name };
}

export function mapGame(g: BdlGame): GameRec {
  const state = (STATES as string[]).includes(g.status_state ?? '') ? (g.status_state as GameState) : g.status === 'Final' ? 'final' : 'unknown';
  return {
    provider: BALLDONTLIE_ID,
    providerId: String(g.id),
    // Prefer the tip-off instant converted to the NBA (New York) calendar date; fall back to the provider's date.
    date: g.datetime ? zonedDateString(new Date(g.datetime)) : g.date,
    tipoffAt: g.datetime ?? null,
    state,
    statusText: g.status ?? null,
    period: g.period ?? null,
    postseason: Boolean(g.postseason),
    season: g.season ?? null,
    home: mapTeam(g.home_team),
    away: mapTeam(g.visitor_team),
    homeScore: g.home_team_score ?? null,
    awayScore: g.visitor_team_score ?? null,
  };
}

export function mapStat(s: BdlStat): PlayerBoxRec {
  return {
    provider: BALLDONTLIE_ID,
    providerStatId: s.id != null ? String(s.id) : null,
    gameProviderId: String(s.game.id),
    teamProviderId: String(s.team.id),
    player: { provider: BALLDONTLIE_ID, providerId: String(s.player.id), firstName: s.player.first_name, lastName: s.player.last_name, position: s.player.position || null, jersey: s.player.jersey_number || null },
    minutes: s.min ?? null,
    pts: s.pts ?? 0, reb: s.reb ?? 0, ast: s.ast ?? 0, stl: s.stl ?? 0, blk: s.blk ?? 0, turnovers: s.turnover ?? 0, pf: s.pf ?? 0,
    fgm: s.fgm ?? 0, fga: s.fga ?? 0, fg3m: s.fg3m ?? 0, fg3a: s.fg3a ?? 0, ftm: s.ftm ?? 0, fta: s.fta ?? 0,
    plusMinus: s.plus_minus ?? null,
  };
}

export function mapPlay(p: BdlPlay): PlayRec {
  return {
    provider: BALLDONTLIE_ID,
    gameProviderId: String(p.game_id),
    order: p.order,
    type: p.type,
    text: p.text,
    period: p.period,
    clock: p.clock,
    homeScore: p.home_score ?? null,
    awayScore: p.away_score ?? null,
    scoringPlay: Boolean(p.scoring_play),
    shootingPlay: Boolean(p.shooting_play),
    scoreValue: p.score_value ?? null,
    teamProviderId: p.team ? String(p.team.id) : null,
    teamAbbreviation: p.team?.abbreviation ?? null,
    wallclock: p.wallclock ?? null,
    participants: (p.participants ?? []).map(String),
  };
}

export function createBalldontlie(ctx: ProviderContext = {}): StatsProvider {
  const env = ctx.env ?? process.env;
  const key = env.BALLDONTLIE_API_KEY;
  const http = new ProviderHttpClient({
    provider: BALLDONTLIE_ID,
    baseUrl: env.BALLDONTLIE_BASE_URL ?? 'https://api.balldontlie.io',
    headers: (): Record<string, string> => (key ? { Authorization: key } : {}),
    // Free and trial keys: 5/min; ALL-STAR 60; GOAT 600. Default to the safe value.
    requestsPerMinute: Number(env.BALLDONTLIE_RPM ?? 5),
    onArchive: ctx.onArchive,
    fetchImpl: ctx.fetchImpl,
    sleep: ctx.sleep,
  });
  const prefix = env.BALLDONTLIE_PATH_PREFIX ?? '/nba/v1';

  async function all<T>(endpoint: string, params: Record<string, string | number | Array<string | number>>): Promise<T[]> {
    const out: T[] = [];
    let cursor: number | undefined;
    for (let i = 0; i < 100; i++) {
      const page = await http.getJson<Page<T>>(endpoint, { ...params, per_page: 100, cursor });
      out.push(...page.data);
      const next = page.meta?.next_cursor;
      if (next == null || page.data.length === 0) break;
      cursor = next;
    }
    return out;
  }

  return {
    kind: 'stats',
    id: BALLDONTLIE_ID,
    name: 'BALLDONTLIE',
    configured: Boolean(key),
    needs: key ? [] : ['BALLDONTLIE_API_KEY'],
    docsUrl: 'https://docs.balldontlie.io/',
    async listGames(date) {
      const games = await all<BdlGame>(`${prefix}/games`, { 'dates[]': [date] });
      return games.map(mapGame);
    },
    async playerStats(gameIds) {
      const out: PlayerBoxRec[] = [];
      for (let i = 0; i < gameIds.length; i += 20) {
        const chunk = gameIds.slice(i, i + 20);
        out.push(...(await all<BdlStat>(`${prefix}/stats`, { 'game_ids[]': chunk })).map(mapStat));
      }
      return out;
    },
    async plays(gameId) {
      const r = await http.getJson<{ data: BdlPlay[] }>(`${prefix}/plays`, { game_id: gameId });
      return r.data.map(mapPlay).sort((a, b) => a.order - b.order);
    },
  };
}
