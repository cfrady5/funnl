import { describe, expect, it } from 'vitest';
import {
  clockToSeconds,
  extractEvents,
  highlightApiGameKey,
  linkClipToEvent,
  namesCompatible,
  normalizeName,
  reconcile,
  resolvePlayerName,
  type ClipReferenceRec,
  type PlayRec,
  type PlayerBoxRec,
} from '../src';

// Fictional roster — no real player data in tests.
const roster = [
  { id: '1', firstName: 'Marcus', lastName: 'Vale', teamId: '10' },
  { id: '2', firstName: 'Dex', lastName: 'Holloway', teamId: '10' },
  { id: '3', firstName: 'Nikola', lastName: 'Dončić Jr.', teamId: '10' },
  { id: '4', firstName: 'Mark', lastName: 'Vale', teamId: '20' },
  { id: '5', firstName: 'Ty', lastName: 'Ortega', teamId: '20' },
];

const play = (o: Partial<PlayRec>): PlayRec => ({
  provider: 'test',
  gameProviderId: 'g1',
  order: 1,
  type: 'Jump Shot',
  text: '',
  period: 1,
  clock: '4:45',
  homeScore: 0,
  awayScore: 0,
  scoringPlay: false,
  shootingPlay: false,
  scoreValue: null,
  teamProviderId: '10',
  teamAbbreviation: 'AAA',
  wallclock: '2026-11-22T00:10:00Z',
  participants: [],
  ...o,
});

describe('clock + names', () => {
  it('parses every provider clock format', () => {
    expect(clockToSeconds('4:45')).toBe(285);
    expect(clockToSeconds('12:00')).toBe(720);
    expect(clockToSeconds('53.4')).toBeCloseTo(53.4);
    expect(clockToSeconds('PT04M59.00S')).toBe(299);
    expect(clockToSeconds('PT00M07.20S')).toBeCloseTo(7.2);
    expect(clockToSeconds(null)).toBeNull();
    expect(clockToSeconds('garbage')).toBeNull();
  });
  it('normalises diacritics and suffixes', () => {
    expect(normalizeName('Nikola Dončić Jr.')).toBe('nikola doncic');
    expect(normalizeName("De'Aaron O'Neal III")).toBe('deaaron oneal');
  });
  it('resolves full, initial and last-name forms without guessing', () => {
    expect(resolvePlayerName('Marcus Vale', roster)?.id).toBe('1');
    expect(resolvePlayerName('M. Vale', roster, '10')?.id).toBe('1');
    expect(resolvePlayerName('M. Vale', roster)).toBeNull(); // Marcus vs Mark — ambiguous across teams
    expect(resolvePlayerName('Vale', roster)).toBeNull(); // two Vales
    expect(resolvePlayerName('Vale', roster, '20')?.id).toBe('4');
    expect(resolvePlayerName('Nikola Doncic', roster)?.id).toBe('3');
    expect(resolvePlayerName('Nobody Here', roster)).toBeNull();
  });
  it('compares names across formats', () => {
    expect(namesCompatible('M. Vale', 'Marcus Vale')).toBe(true);
    expect(namesCompatible('D. Vale', 'Marcus Vale')).toBe(false);
    expect(namesCompatible('Vale', 'Marcus Vale')).toBe(true);
  });
});

describe('assist + turnover extraction', () => {
  const plays = [
    play({ order: 1, scoringPlay: true, shootingPlay: true, scoreValue: 3, type: 'Jump Shot', text: 'Dex Holloway makes 26-foot three point jumper (Marcus Vale assists)', participants: ['2', '1'] }),
    play({ order: 2, scoringPlay: true, scoreValue: 2, type: 'Dunk', text: 'D. Holloway running DUNK (5 PTS) (M. Vale 2 AST)', participants: ['2'] }),
    play({ order: 3, scoringPlay: true, scoreValue: 2, text: 'Nikola Doncic makes driving layup', participants: ['3'] }),
    play({ order: 4, scoringPlay: true, scoreValue: 1, type: 'Free Throw', text: 'Dex Holloway makes free throw 1 of 2 (Marcus Vale assists)', participants: ['2'] }),
    play({ order: 5, type: 'Bad Pass Turnover', text: 'Marcus Vale bad pass (Ty Ortega steals)', participants: ['1', '5'] }),
    play({ order: 6, type: 'Shot Clock Turnover', text: 'AAA shot clock turnover', participants: [] }),
    play({ order: 7, scoringPlay: true, scoreValue: 2, text: 'Dex Holloway makes layup (Somebody Unknown assists)', participants: ['2'] }),
  ];
  const events = extractEvents(plays, roster);

  it('extracts assists from both text styles with attribution levels', () => {
    const assists = events.filter((e) => e.kind === 'assist');
    expect(assists.map((a) => [a.order, a.playerId, a.attribution])).toEqual([
      [1, '1', 'confirmed'],
      [2, '1', 'text_only'],
      [7, null, 'unresolved'],
    ]);
    expect(assists[0].secondaryPlayerId).toBe('2');
    expect(assists[0].clockSeconds).toBe(285);
  });
  it('never treats free throws as assisted and skips unassisted makes', () => {
    expect(events.find((e) => e.order === 4)).toBeUndefined();
    expect(events.find((e) => e.order === 3)).toBeUndefined();
  });
  it('extracts player turnovers with the stealer, ignoring team turnovers', () => {
    const tos = events.filter((e) => e.kind === 'turnover');
    expect(tos).toHaveLength(1);
    expect(tos[0]).toMatchObject({ playerId: '1', secondaryPlayerId: '5', attribution: 'confirmed' });
  });
  it('reconciles against the box score and reports gaps', () => {
    const box = (id: string, ast: number, tov: number): PlayerBoxRec => ({
      provider: 'test', providerStatId: null, gameProviderId: 'g1', teamProviderId: '10',
      player: { provider: 'test', providerId: id, firstName: '', lastName: '', position: null, jersey: null },
      minutes: '30', pts: 0, reb: 0, ast, stl: 0, blk: 0, turnovers: tov, pf: 0, fgm: 0, fga: 0, fg3m: 0, fg3a: 0, ftm: 0, fta: 0, plusMinus: null,
    });
    const ok = reconcile(events, [box('1', 2, 1), box('2', 0, 0)]);
    expect(ok.assistsVerified).toBe(true);
    expect(ok.assistCoverage).toBe(1);
    expect(ok.unresolvedEvents).toBe(1);
    const off = reconcile(events, [box('1', 3, 1), box('2', 1, 0)]);
    expect(off.assistsVerified).toBe(false);
    expect(off.assistCoverage).toBe(0.5);
    expect(off.players.find((p) => p.playerId === '1')).toMatchObject({ boxAssists: 3, extractedAssists: 2, assistsMatch: false });
  });
});

describe('clip linking', () => {
  const ev = {
    ...extractEvents([play({ order: 9, period: 2, clock: '4:12', scoringPlay: true, scoreValue: 2, text: 'Dex Holloway makes layup (Marcus Vale assists)', participants: ['2', '1'], wallclock: '2026-11-22T01:00:00Z' })], roster)[0],
    teamAbbreviation: 'AAA',
    playerName: 'Marcus Vale',
    scorerName: 'Dex Holloway',
  };
  const clip = (mp: Partial<NonNullable<ClipReferenceRec['matchedPlay']>>, granularity: 'play' | 'game' = 'play'): ClipReferenceRec => ({
    provider: 'highlightapi', externalId: 't1', gameProviderKey: null, title: null, url: null, embedUrl: null, thumbnailUrl: null,
    sourcePlatform: 'x', sourceAccount: null, postedAt: null, granularity, providerConfidence: 'high', raw: null,
    matchedPlay: { period: 2, clockSeconds: 252, wallclock: '2026-11-22T01:00:05Z', teamAbbreviation: 'AAA', player: 'D. Holloway', assistPlayer: 'M. Vale', description: null, actionType: '2pt', ...mp },
  });
  it('links an exact match strongly', () => {
    expect(linkClipToEvent(clip({}), ev).level).toBe('strong');
  });
  it('rejects other periods, other assisters and game-level clips', () => {
    expect(linkClipToEvent(clip({ period: 3 }), ev).level).toBe('none');
    expect(linkClipToEvent(clip({ assistPlayer: 'T. Ortega', teamAbbreviation: 'BBB' }), ev).level).not.toBe('strong');
    expect(linkClipToEvent(clip({}, 'game'), ev).level).toBe('none');
  });
  it('builds Highlight API game keys', () => {
    expect(highlightApiGameKey('2026-04-06', 'NYK', 'ATL')).toBe('nba-2026-04-06-nyk-atl');
  });
});
