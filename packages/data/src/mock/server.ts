import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { buildMockDay, type MockDay } from './dataset';

/**
 * SIMULATED provider server: speaks the documented request/response shapes of
 * BALLDONTLIE, Highlight API and Highlightly over HTTP so the real adapters,
 * HTTP client, pagination, auth and tier handling can be exercised offline.
 * Never used in production; responses are clearly fictional.
 */
export interface MockServerOptions {
  keys?: { balldontlie?: string; highlightapi?: string; highlightly?: string };
  /** Simulated BALLDONTLIE plan: which endpoints answer (others → 401 as documented). */
  balldontlieTier?: 'free' | 'allstar' | 'goat';
  /** Days to serve; built on demand from the date with buildMockDay when absent. */
  days?: Record<string, MockDay>;
  unfinishedGames?: number;
  /** Fraction of assists that get a Highlight API clip. */
  clipRate?: number;
}

const json = (res: http.ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
};

export async function startMockProviders(o: MockServerOptions = {}) {
  const keys = { balldontlie: 'mock-bdl-key', highlightapi: 'mock-hapi-key', highlightly: 'mock-hly-key', ...o.keys };
  const tier = o.balldontlieTier ?? 'goat';
  const days = new Map(Object.entries(o.days ?? {}));
  const day = (d: string) => {
    if (!days.has(d)) days.set(d, buildMockDay(d, { unfinishedGames: o.unfinishedGames ?? 0 }));
    return days.get(d)!;
  };
  const allGames = () => [...days.values()].flatMap((d) => d.games);
  const hits: string[] = [];

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://mock');
    const p = url.pathname;
    hits.push(`${req.method} ${p}${url.search}`);
    // ── BALLDONTLIE ──
    if (p.startsWith('/bdl/')) {
      if (req.headers.authorization !== keys.balldontlie) return json(res, 401, { error: 'Unauthorized' });
      const ep = p.replace(/^\/bdl\/nba\/v1/, '');
      const allowed = { free: ['/games'], allstar: ['/games', '/stats'], goat: ['/games', '/stats', '/plays'] }[tier];
      if (!allowed.some((a) => ep.startsWith(a))) return json(res, 401, { error: 'Unauthorized - your account tier does not have access to this endpoint' });
      const perPage = Math.min(100, Number(url.searchParams.get('per_page') ?? 25));
      const cursor = Number(url.searchParams.get('cursor') ?? 0);
      const page = <T>(rows: T[]) => {
        const slice = rows.slice(cursor, cursor + perPage);
        return { data: slice, meta: { per_page: perPage, ...(cursor + perPage < rows.length ? { next_cursor: cursor + perPage } : {}) } };
      };
      if (ep === '/games') {
        const dates = url.searchParams.getAll('dates[]');
        return json(res, 200, page(dates.flatMap((d) => day(d).games.map((g) => g.game))));
      }
      if (ep === '/stats') {
        const ids = url.searchParams.getAll('game_ids[]').map(Number);
        return json(res, 200, page(allGames().filter((g) => ids.includes(g.game.id)).flatMap((g) => g.stats)));
      }
      if (ep === '/plays') {
        const g = allGames().find((x) => x.game.id === Number(url.searchParams.get('game_id')));
        if (!g) return json(res, 400, { error: 'game_id required' });
        return json(res, 200, { data: g.plays });
      }
      return json(res, 404, { error: 'not found' });
    }
    // ── Highlight API ──
    if (p.startsWith('/hapi/')) {
      if (req.headers['x-api-key'] !== keys.highlightapi) return json(res, 401, { error: 'Missing or invalid key' });
      const ep = p.replace(/^\/hapi/, '');
      if (ep === '/v1/nba/games') {
        const d = url.searchParams.get('date');
        if (!d) return json(res, 400, { error: 'date query parameter is required (YYYY-MM-DD)' });
        const games = day(d).games.map((g) => ({ id: `nba-${d}-${g.game.visitor_team.abbreviation}-${g.game.home_team.abbreviation}`.toLowerCase(), nbaGameId: `00225${g.game.id}`.slice(0, 10), date: d, homeTeam: g.game.home_team.abbreviation, awayTeam: g.game.visitor_team.abbreviation, status: g.game.status_state, startTime: g.game.datetime }));
        return json(res, 200, { date: d, count: games.length, games });
      }
      const m = /^\/v1\/nba\/games\/([^/]+)\/clips$/.exec(ep);
      if (m) {
        const id = decodeURIComponent(m[1]);
        const g = allGames().find((x) => `nba-${x.game.date}-${x.game.visitor_team.abbreviation}-${x.game.home_team.abbreviation}`.toLowerCase() === id);
        if (!g) return json(res, 404, { error: 'Unknown game ID' });
        const rate = o.clipRate ?? 0.35;
        const clips = g.officialAssists
          .filter((_, i) => (i * 7919) % 100 < rate * 100)
          .map((a, i) => ({
            id: i + 1, tweetId: `19${g.game.id}${String(a.order).padStart(4, '0')}`, teamAccount: `${a.team.toLowerCase()}_official`, teamId: a.team, gameId: id,
            postedAt: new Date(Date.parse(a.wallclock) + 90_000).toISOString(), caption: `${a.assister} finds ${a.scorer}`, embedUrl: `https://x.com/${a.team.toLowerCase()}_official/status/19${g.game.id}${a.order}`,
            thumbnailUrl: null, playType: [a.shot, 'assist'], playersMentioned: [], quarter: null, gameClock: null, clipType: 'single_play', matchStatus: 'done', matchConfidence: i % 4 === 0 ? 'medium' : 'high',
            matchedPlay: { timeActual: a.wallclock, period: a.period, clock: `PT${String(Math.floor(a.clockSec / 60)).padStart(2, '0')}M${String(a.clockSec % 60).padStart(2, '0')}.00S`, actionType: a.shot === 'three_pointer' ? '3pt' : '2pt', subType: null, player: a.scorer, teamTricode: a.team, description: a.desc, scoreHome: '0', scoreAway: '0', assistPlayerNameInitial: a.assister },
          }));
        clips.push({ ...clips[0], id: 999, tweetId: `19${g.game.id}9999`, clipType: 'montage', matchedPlay: null as never, matchConfidence: null as never } as never);
        return json(res, 200, { gameId: id, count: clips.length, clips: clips.filter(Boolean) });
      }
      return json(res, 404, { error: 'not found' });
    }
    // ── Highlightly ──
    if (p.startsWith('/hly/')) {
      if (req.headers['x-rapidapi-key'] !== keys.highlightly) return json(res, 401, { message: 'Unauthorized' });
      if (p === '/hly/highlights') {
        const d = url.searchParams.get('date') ?? '';
        const data = day(d).games.flatMap((g, gi) =>
          ['Full Game Highlights', 'Post-game interview'].map((kind, k) => ({
            id: g.game.id * 10 + k, type: k === 0 ? 'VERIFIED' : 'UNVERIFIED', imgUrl: null, title: `${g.game.visitor_team.name} vs ${g.game.home_team.name} — ${kind}`, description: 'SIMULATED',
            url: `https://www.youtube.com/watch?v=mock${gi}${k}`, embedUrl: `https://www.youtube.com/embed/mock${gi}${k}`, channel: 'Mock League', source: 'youtube', category: k === 0 ? 'match-highlights' : 'interview',
            match: { id: 500 + gi, league: 'NBA', homeTeam: { id: g.game.home_team.id, abbreviation: g.game.home_team.abbreviation, displayName: g.game.home_team.full_name, name: g.game.home_team.name }, awayTeam: { id: g.game.visitor_team.id, abbreviation: g.game.visitor_team.abbreviation, displayName: g.game.visitor_team.full_name, name: g.game.visitor_team.name } },
          })),
        );
        const limit = Number(url.searchParams.get('limit') ?? 40);
        const offset = Number(url.searchParams.get('offset') ?? 0);
        return json(res, 200, { data: data.slice(offset, offset + limit), pagination: { totalCount: data.length, offset, limit }, plan: { tier: 'MOCK', message: 'SIMULATED DATA' } });
      }
      return json(res, 404, { message: 'not found' });
    }
    json(res, 404, { error: 'unknown mock route' });
  });
  await new Promise<void>((r) => server.listen(Number(process.env.MOCK_PROVIDERS_PORT ?? 0), '127.0.0.1', r));
  const { port } = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${port}`;
  return {
    base,
    hits,
    keys,
    /** Env that points the real adapters at this mock. */
    env: {
      BALLDONTLIE_API_KEY: keys.balldontlie,
      BALLDONTLIE_BASE_URL: `${base}/bdl`,
      BALLDONTLIE_RPM: '6000',
      HIGHLIGHT_API_KEY: keys.highlightapi,
      HIGHLIGHT_API_BASE_URL: `${base}/hapi`,
      HIGHLIGHT_API_RPM: '6000',
      HIGHLIGHTLY_API_KEY: keys.highlightly,
      HIGHLIGHTLY_BASE_URL: `${base}/hly`,
      HIGHLIGHTLY_RPM: '6000',
    } as Record<string, string>,
    close: () => new Promise<void>((r) => server.close(() => r())),
  };
}
