/**
 * Verify Highlightly with YOUR key:
 *   HIGHLIGHTLY_API_KEY=... npm run probe:highlightly -w @tiresias/data -- [--date YYYY-MM-DD]
 *   (RapidAPI: also set HIGHLIGHTLY_BASE_URL=https://nba-ncaab-api.p.rapidapi.com HIGHLIGHTLY_RAPIDAPI_HOST=nba-ncaab-api.p.rapidapi.com)
 */
import { previousGameDate } from '@tiresias/core';
import { ProviderAccessError, ProviderHttpClient } from '../http';
import { arg, probeDir, save } from './probe-util';

const key = process.env.HIGHLIGHTLY_API_KEY;
if (!key) {
  console.error('Set HIGHLIGHTLY_API_KEY first.');
  process.exit(1);
}
const date = arg('date') ?? previousGameDate();
const dir = probeDir('highlightly', date);
const host = process.env.HIGHLIGHTLY_RAPIDAPI_HOST;
const http = new ProviderHttpClient({ provider: 'highlightly', baseUrl: process.env.HIGHLIGHTLY_BASE_URL ?? 'https://nba.highlightly.net', headers: () => ({ 'x-rapidapi-key': key, ...(host ? { 'x-rapidapi-host': host } : {}) }), requestsPerMinute: 20 });
const report: Record<string, unknown> = { date, ranAt: new Date().toISOString() };
try {
  const r = await http.getJson<{ data: Array<Record<string, unknown>>; pagination: unknown; plan: unknown }>('/highlights', { date, timezone: 'America/New_York', leagueName: 'NBA', limit: 40, offset: 0 });
  save(dir, 'highlights.json', r);
  report.plan = r.plan;
  report.pagination = r.pagination;
  report.count = r.data?.length ?? 0;
  report.sample = (r.data ?? []).slice(0, 5).map((h) => ({ title: h.title, type: h.type, source: h.source, url: h.url, embedUrl: h.embedUrl, match: h.match }));
  report.verdict = 'Endpoint reachable with your key.';
} catch (e) {
  report.verdict = e instanceof ProviderAccessError ? 'Access denied: check the key / plan.' : `Error: ${(e as Error).message}`;
}
save(dir, 'report.json', report);
console.log(JSON.stringify(report, null, 2));
