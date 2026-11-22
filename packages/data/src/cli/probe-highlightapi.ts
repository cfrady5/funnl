/**
 * Verify Highlight API with YOUR key:
 *   HIGHLIGHT_API_KEY=... npm run probe:highlightapi -w @tiresias/data -- [--date YYYY-MM-DD]
 */
import { previousGameDate } from '@tiresias/core';
import { ProviderAccessError, ProviderHttpClient } from '../http';
import { mapHighlightApiClip } from '../providers/clips';
import { arg, probeDir, save } from './probe-util';

const key = process.env.HIGHLIGHT_API_KEY;
if (!key) {
  console.error('Set HIGHLIGHT_API_KEY first.');
  process.exit(1);
}
const date = arg('date') ?? previousGameDate();
const dir = probeDir('highlightapi', date);
const http = new ProviderHttpClient({ provider: 'highlightapi', baseUrl: process.env.HIGHLIGHT_API_BASE_URL ?? 'https://api.highlightapi.com', headers: () => ({ 'X-API-Key': key }), requestsPerMinute: 30 });
const report: Record<string, unknown> = { date, ranAt: new Date().toISOString() };
try {
  const games = await http.getJson<{ games: Array<{ id: string; homeTeam: string; awayTeam: string; status: string }> }>('/v1/nba/games', { date });
  save(dir, 'games.json', games);
  report.games = games.games;
  const first = games.games?.[0];
  if (first) {
    const clips = await http.getJson<{ clips: never[] }>(`/v1/nba/games/${encodeURIComponent(first.id)}/clips`, { status: 'matched' });
    save(dir, `clips-${first.id}.json`, clips);
    const mapped = (clips.clips ?? []).map((c) => mapHighlightApiClip(c, null));
    report.clips = {
      game: first.id,
      total: mapped.length,
      playLevel: mapped.filter((c) => c.granularity === 'play').length,
      withAssistPlayer: mapped.filter((c) => c.matchedPlay?.assistPlayer).length,
      byConfidence: mapped.reduce<Record<string, number>>((m, c) => ((m[c.providerConfidence ?? 'none'] = (m[c.providerConfidence ?? 'none'] ?? 0) + 1), m), {}),
      sample: mapped.slice(0, 5).map((c) => ({ embed: c.embedUrl, play: c.matchedPlay })),
    };
  }
  report.verdict = 'Endpoint reachable with your key.';
} catch (e) {
  report.verdict = e instanceof ProviderAccessError ? 'Access denied: check the key / plan.' : `Error: ${(e as Error).message}`;
}
save(dir, 'report.json', report);
console.log(JSON.stringify(report, null, 2));
