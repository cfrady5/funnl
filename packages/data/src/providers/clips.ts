import { clockToSeconds, highlightApiGameKey, type ClipReferenceRec } from '@tiresias/core';
import { ProviderAccessError, ProviderError, ProviderHttpClient } from '../http';
import type { ClipDiscoveryProvider, ProviderContext } from './types';

/* ───────────────────────────── Highlight API ─────────────────────────────
 * https://www.highlightapi.com/docs.html (read 2026-11-22)
 *   GET /v1/nba/games?date=YYYY-MM-DD   (U.S. Eastern calendar date)
 *   GET /v1/nba/games/:gameId/clips?status=matched
 *   Auth: X-API-Key. Dev tier 60 req/min.
 * Clips are official team/league/broadcaster X posts matched to an exact
 * play-by-play action. Terms: playback only via official X embeds; never
 * download or re-host. → display embed_only, acquisition none.
 */
interface HapiGame { id: string; nbaGameId?: string; date: string; homeTeam: string; awayTeam: string; status?: string }
interface HapiMatchedPlay {
  timeActual?: string; period?: number; clock?: string; actionType?: string; subType?: string | null; player?: string;
  teamTricode?: string; description?: string; assistPlayerNameInitial?: string | null;
}
interface HapiClip {
  id: number; tweetId: string; teamAccount?: string; gameId: string; postedAt?: string; caption?: string; embedUrl?: string;
  thumbnailUrl?: string | null; playType?: string[]; clipType?: string; matchStatus?: string; matchConfidence?: string | null;
  matchedPlay?: HapiMatchedPlay | null;
}

export function mapHighlightApiClip(c: HapiClip, gameProviderId: string | null): ClipReferenceRec & { gameProviderId: string | null } {
  const mp = c.matchedPlay ?? null;
  return {
    provider: 'highlightapi',
    externalId: c.tweetId,
    gameProviderKey: c.gameId,
    gameProviderId,
    title: c.caption ?? null,
    url: c.embedUrl ?? null,
    embedUrl: c.embedUrl ?? null,
    thumbnailUrl: c.thumbnailUrl ?? null,
    sourcePlatform: 'x',
    sourceAccount: c.teamAccount ?? null,
    postedAt: c.postedAt ?? null,
    granularity: mp ? 'play' : 'game',
    providerConfidence: c.matchConfidence ?? null,
    matchedPlay: mp
      ? {
          period: mp.period ?? null,
          clockSeconds: clockToSeconds(mp.clock),
          wallclock: mp.timeActual ?? null,
          teamAbbreviation: mp.teamTricode ?? null,
          player: mp.player ?? null,
          assistPlayer: mp.assistPlayerNameInitial ?? null,
          description: mp.description ?? null,
          actionType: mp.actionType ?? null,
        }
      : null,
    raw: c,
  };
}

export function createHighlightApi(ctx: ProviderContext = {}): ClipDiscoveryProvider {
  const env = ctx.env ?? process.env;
  const key = env.HIGHLIGHT_API_KEY;
  const http = new ProviderHttpClient({
    provider: 'highlightapi',
    baseUrl: env.HIGHLIGHT_API_BASE_URL ?? 'https://api.highlightapi.com',
    headers: (): Record<string, string> => (key ? { 'X-API-Key': key } : {}),
    requestsPerMinute: Number(env.HIGHLIGHT_API_RPM ?? 60),
    onArchive: ctx.onArchive,
    fetchImpl: ctx.fetchImpl,
    sleep: ctx.sleep,
  });
  return {
    kind: 'clips',
    id: 'highlightapi',
    name: 'Highlight API',
    configured: Boolean(key),
    needs: key ? [] : ['HIGHLIGHT_API_KEY'],
    docsUrl: 'https://www.highlightapi.com/docs.html',
    capabilities: { granularity: 'play', acquisition: 'none', display: 'embed_only', defaultRights: 'unknown' },
    async discover(date, games) {
      const list = await http.getJson<{ games: HapiGame[] }>('/v1/nba/games', { date });
      const out: Array<ClipReferenceRec & { gameProviderId: string | null }> = [];
      for (const hg of list.games ?? []) {
        const ours = games.find((g) => highlightApiGameKey(date, g.away.abbreviation, g.home.abbreviation) === hg.id || (g.home.abbreviation === hg.homeTeam && g.away.abbreviation === hg.awayTeam));
        if (!ours) continue;
        try {
          const r = await http.getJson<{ clips: HapiClip[] }>(`/v1/nba/games/${encodeURIComponent(hg.id)}/clips`, { status: 'matched' });
          for (const c of r.clips ?? []) out.push(mapHighlightApiClip(c, ours.providerId));
        } catch (e) {
          if (e instanceof ProviderAccessError) throw e;
          if (e instanceof ProviderError && e.status === 404) continue;
          throw e;
        }
      }
      return out;
    },
  };
}

/* ───────────────────────────── Highlightly ─────────────────────────────
 * https://highlightly.net/nba-api/documentation/ + docs.json (OpenAPI 4.1.4, read 2026-11-22)
 *   GET {base}/highlights?date=&timezone=&leagueName=&limit(≤40)&offset
 *   base: https://nba.highlightly.net (or RapidAPI host). Auth: x-rapidapi-key
 *   (+ x-rapidapi-host only via RapidAPI).
 * Highlights are game-level (match id + teams), sourced from YouTube etc.
 * Terms grant data-use rights only; media permissions are the user's
 * responsibility. → display link_only, acquisition none.
 */
interface HlyTeam { id: number; abbreviation: string; displayName?: string; name?: string }
interface HlyHighlight {
  id: number; match?: { id: number; league?: string; homeTeam?: HlyTeam; awayTeam?: HlyTeam }; type?: string; imgUrl?: string;
  title?: string; description?: string; url?: string; embedUrl?: string; channel?: string; source?: string; category?: string;
}

export function mapHighlightlyHighlight(h: HlyHighlight, gameProviderId: string | null): ClipReferenceRec & { gameProviderId: string | null } {
  return {
    provider: 'highlightly',
    externalId: String(h.id),
    gameProviderKey: h.match ? String(h.match.id) : null,
    gameProviderId,
    title: h.title ?? null,
    url: h.url ?? null,
    embedUrl: h.embedUrl ?? null,
    thumbnailUrl: h.imgUrl ?? null,
    sourcePlatform: h.source ?? null,
    sourceAccount: h.channel ?? null,
    postedAt: null,
    granularity: 'game',
    providerConfidence: h.type ?? null, // VERIFIED / UNVERIFIED source flag
    matchedPlay: null,
    raw: h,
  };
}

export function createHighlightly(ctx: ProviderContext = {}): ClipDiscoveryProvider {
  const env = ctx.env ?? process.env;
  const key = env.HIGHLIGHTLY_API_KEY;
  const rapidHost = env.HIGHLIGHTLY_RAPIDAPI_HOST; // set only when using RapidAPI
  const http = new ProviderHttpClient({
    provider: 'highlightly',
    baseUrl: env.HIGHLIGHTLY_BASE_URL ?? 'https://nba.highlightly.net',
    headers: () => ({ ...(key ? { 'x-rapidapi-key': key } : {}), ...(rapidHost ? { 'x-rapidapi-host': rapidHost } : {}) }),
    requestsPerMinute: Number(env.HIGHLIGHTLY_RPM ?? 30),
    onArchive: ctx.onArchive,
    fetchImpl: ctx.fetchImpl,
    sleep: ctx.sleep,
  });
  return {
    kind: 'clips',
    id: 'highlightly',
    name: 'Highlightly',
    configured: Boolean(key),
    needs: key ? [] : ['HIGHLIGHTLY_API_KEY'],
    docsUrl: 'https://highlightly.net/nba-api/documentation/',
    capabilities: { granularity: 'game', acquisition: 'none', display: 'link_only', defaultRights: 'unknown' },
    async discover(date, games) {
      const out: Array<ClipReferenceRec & { gameProviderId: string | null }> = [];
      for (let offset = 0; offset < 400; offset += 40) {
        const r = await http.getJson<{ data: HlyHighlight[]; pagination?: { totalCount?: number } }>('/highlights', {
          date,
          timezone: 'America/New_York',
          leagueName: 'NBA',
          limit: 40,
          offset,
        });
        for (const h of r.data ?? []) {
          const home = h.match?.homeTeam?.abbreviation;
          const away = h.match?.awayTeam?.abbreviation;
          const ours = games.find((g) => g.home.abbreviation === home && g.away.abbreviation === away) ?? null;
          out.push(mapHighlightlyHighlight(h, ours?.providerId ?? null));
        }
        const total = r.pagination?.totalCount ?? 0;
        if (!r.data?.length || offset + 40 >= total) break;
      }
      return out;
    },
  };
}
