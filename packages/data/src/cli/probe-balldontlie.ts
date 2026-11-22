/**
 * Verify BALLDONTLIE with YOUR key (run locally if this environment blocks the host):
 *   BALLDONTLIE_API_KEY=... npm run probe:balldontlie -w @tiresias/data -- [--date YYYY-MM-DD] [--rpm 5]
 * Reports which endpoints your plan can reach, saves raw responses under
 * data/probes/balldontlie/<date>/, and checks whether every assist in the
 * play-by-play can be tied to one player and one play (reconciled with the box score).
 */
import { extractEvents, previousGameDate, reconcile } from '@tiresias/core';
import { ProviderAccessError, ProviderHttpClient } from '../http';
import { mapGame, mapPlay, mapStat } from '../providers/balldontlie';
import { arg, probeDir, save } from './probe-util';

const key = process.env.BALLDONTLIE_API_KEY;
if (!key) {
  console.error('Set BALLDONTLIE_API_KEY first.');
  process.exit(1);
}
const date = arg('date') ?? previousGameDate();
const dir = probeDir('balldontlie', date);
const http = new ProviderHttpClient({ provider: 'balldontlie', baseUrl: process.env.BALLDONTLIE_BASE_URL ?? 'https://api.balldontlie.io', headers: () => ({ Authorization: key }), requestsPerMinute: Number(arg('rpm') ?? 5) });
const prefix = '/nba/v1';
const report: Record<string, unknown> = { date, ranAt: new Date().toISOString(), endpoints: {} };
const endpoints = report.endpoints as Record<string, unknown>;

async function attempt<T>(name: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    const r = await fn();
    endpoints[name] = 'ok';
    return r;
  } catch (e) {
    endpoints[name] = e instanceof ProviderAccessError ? 'denied (key/tier)' : `error: ${(e as Error).message}`;
    return null;
  }
}

const games = await attempt('games', () => http.getJson<{ data: never[] }>(`${prefix}/games`, { 'dates[]': [date], per_page: 100 }));
if (games) save(dir, 'games.json', games);
const mapped = (games?.data ?? []).map(mapGame);
report.games = mapped.map((g) => ({ id: g.providerId, label: `${g.away.abbreviation} @ ${g.home.abbreviation}`, state: g.state, status: g.statusText, nbaDate: g.date }));
const final = mapped.filter((g) => g.state === 'final');
const target = final[0];
if (target) {
  const stats = await attempt('stats', () => http.getJson<{ data: never[] }>(`${prefix}/stats`, { 'game_ids[]': [target.providerId], per_page: 100 }));
  if (stats) save(dir, `stats-${target.providerId}.json`, stats);
  const plays = await attempt('plays', () => http.getJson<{ data: never[] }>(`${prefix}/plays`, { game_id: target.providerId }));
  if (plays) save(dir, `plays-${target.providerId}.json`, plays);
  if (stats && plays) {
    const box = stats.data.map(mapStat);
    const pr = plays.data.map(mapPlay);
    const roster = box.map((b) => ({ id: b.player.providerId, firstName: b.player.firstName, lastName: b.player.lastName, teamId: b.teamProviderId }));
    const events = extractEvents(pr, roster);
    const rec = reconcile(events, box);
    const assistTexts = pr.filter((p) => /assist/i.test(p.text)).map((p) => ({ text: p.text, participants: p.participants.length }));
    report.assistAnalysis = {
      game: `${target.away.abbreviation} @ ${target.home.abbreviation}`,
      plays: pr.length,
      playsMentioningAssist: assistTexts.length,
      sampleAssistTexts: assistTexts.slice(0, 8),
      participantsLengthOnAssistPlays: Object.fromEntries(Object.entries(assistTexts.reduce<Record<number, number>>((m, a) => ((m[a.participants] = (m[a.participants] ?? 0) + 1), m), {}))),
      extracted: { assists: events.filter((e) => e.kind === 'assist').length, turnovers: events.filter((e) => e.kind === 'turnover').length, byAttribution: events.reduce<Record<string, number>>((m, e) => ((m[e.attribution] = (m[e.attribution] ?? 0) + 1), m), {}) },
      boxScoreAssists: box.reduce((s, b) => s + b.ast, 0),
      assistsVerified: rec.assistsVerified,
      assistCoverage: rec.assistCoverage,
      mismatches: rec.players.filter((p) => !p.assistsMatch || !p.turnoversMatch),
      verdict: rec.assistsVerified
        ? 'VERIFIED: every box-score assist was tied to exactly one play and one passer.'
        : 'NOT VERIFIED: see mismatches/sampleAssistTexts; the text format may differ from the parser — share this report.',
    };
  }
} else {
  report.note = 'No final games on this date. Try --date with a completed game day.';
}
save(dir, 'report.json', report);
console.log(JSON.stringify(report, null, 2));
console.log(`\nSaved raw responses + report to ${dir}`);
