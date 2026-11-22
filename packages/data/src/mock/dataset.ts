/**
 * SIMULATED NBA day for tests and local development without API keys.
 * Fictional teams and players only — nothing here is real NBA data.
 * Box scores are derived from the generated plays, so totals reconcile.
 * Payload shapes follow the providers' documented schemas (see INTEGRATIONS.md).
 */

export interface MockTeam { id: number; abbreviation: string; city: string; name: string; full_name: string; conference: string; division: string }
export interface MockPlayer { id: number; first_name: string; last_name: string; position: string; jersey_number: string; team: MockTeam }

const TEAMS: MockTeam[] = [
  ['HCO', 'Harbor City', 'Oracles'], ['LYN', 'Lynwood', 'Lanterns'], ['MSA', 'Mesa Alta', 'Comets'], ['RVR', 'Riverside', 'Ferrymen'],
  ['NTH', 'Northgate', 'Owls'], ['SVL', 'Silverlake', 'Sirens'],
].map(([abbreviation, city, name], i) => ({ id: 9001 + i, abbreviation, city, name, full_name: `${city} ${name}`, conference: i % 2 ? 'West' : 'East', division: 'Pacific' }));

const FIRST = ['Marcus', 'Dex', 'Theo', 'Andre', 'Kofi', 'Luca', 'Rafael', 'Jonah', 'Elias', 'Mateo', 'Isaiah', 'Nico', 'Oren', 'Silas', 'Tobias', 'Zane'];
const LAST = ['Vale', 'Holloway', 'Okafor', 'Brandt', 'Mensah', 'Ferreira', 'Quist', 'Lindqvist', 'Abara', 'Castell', 'Nkemelu', 'Royce', 'Petrov', 'Dunmore', 'Saari', 'Whitlock', 'Ibarra', 'Kestrel', 'Moreau', 'Tanaka', 'Adeyemi', 'Varga', 'Halloran', 'Juarez'];

/** Small deterministic PRNG so the dataset is identical on every run. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export interface MockPlay {
  game_id: number; order: number; type: string; text: string; home_score: number; away_score: number; period: number; period_display: string;
  clock: string; scoring_play: boolean; shooting_play: boolean; score_value: number | null; team: MockTeam; coordinate_x: null; coordinate_y: null;
  wallclock: string; participants: number[];
}

export interface MockGame {
  game: Record<string, unknown> & { id: number; home_team: MockTeam; visitor_team: MockTeam; status: string; status_state: string };
  plays: MockPlay[];
  stats: Array<Record<string, unknown>>;
  /** Official-feed style descriptions used for the Highlight API mock. */
  officialAssists: Array<{ order: number; period: number; clockSec: number; wallclock: string; team: string; scorer: string; assister: string; desc: string; shot: string }>;
}

export interface MockDay { date: string; games: MockGame[] }

const fmtClock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
const initial = (p: MockPlayer) => `${p.first_name[0]}. ${p.last_name}`;

export function buildMockDay(date: string, opts: { gamesCount?: number; unfinishedGames?: number; seed?: number } = {}): MockDay {
  const r = rng(opts.seed ?? Number(date.replace(/-/g, '')));
  const gamesCount = opts.gamesCount ?? 3;
  let pid = 70000;
  const rosters = new Map<number, MockPlayer[]>();
  TEAMS.forEach((t, ti) => {
    rosters.set(
      t.id,
      Array.from({ length: 8 }, (_, i) => ({
        id: ++pid,
        first_name: FIRST[(ti * 3 + i) % FIRST.length],
        last_name: LAST[(ti * 8 + i) % LAST.length],
        position: ['G', 'G', 'F', 'F', 'C', 'G', 'F', 'C'][i],
        jersey_number: String((ti * 7 + i * 3) % 50),
        team: t,
      })),
    );
  });

  const games: MockGame[] = [];
  for (let gi = 0; gi < gamesCount; gi++) {
    const home = TEAMS[(gi * 2) % TEAMS.length];
    const away = TEAMS[(gi * 2 + 1) % TEAMS.length];
    const gameId = 18400000 + Number(date.replace(/-/g, '').slice(2)) * 10 + gi;
    const unfinished = gi >= gamesCount - (opts.unfinishedGames ?? 0);
    const tip = new Date(`${date}T23:${String(10 + gi * 10).padStart(2, '0')}:00Z`);
    const plays: MockPlay[] = [];
    const box = new Map<number, Record<string, number>>();
    const line = (p: MockPlayer) => {
      if (!box.has(p.id)) box.set(p.id, { pts: 0, ast: 0, turnover: 0, fgm: 0, fga: 0, fg3m: 0, fg3a: 0, stl: 0, reb: 0, blk: 0, pf: 0, ftm: 0, fta: 0 });
      return box.get(p.id)!;
    };
    [...rosters.get(home.id)!, ...rosters.get(away.id)!].forEach(line);
    const officialAssists: MockGame['officialAssists'] = [];
    let hs = 0;
    let as = 0;
    let order = 0;
    let wall = tip.getTime();
    const periods = unfinished ? 2 : 4;
    // Each team has a primary playmaker who racks up assists (makes the leaderboard interesting).
    const playmaker = (t: MockTeam) => rosters.get(t.id)![gi % 3];
    for (let period = 1; period <= periods; period++) {
      let clock = 720;
      while (clock > 8) {
        const team = r() < 0.5 ? home : away;
        const roster = rosters.get(team.id)!;
        const opp = rosters.get(team.id === home.id ? away.id : home.id)!;
        clock -= 10 + Math.floor(r() * 14);
        if (clock < 0) clock = 0;
        wall += 25_000 + Math.floor(r() * 20_000);
        const shooter = roster[Math.floor(r() * 5)];
        const roll = r();
        order++;
        const base = { game_id: gameId, order, period, period_display: `${['1st', '2nd', '3rd', '4th'][period - 1]} Quarter`, clock: fmtClock(clock), coordinate_x: null, coordinate_y: null, wallclock: new Date(wall).toISOString(), team } as const;
        if (roll < 0.11) {
          // turnover — mostly bad passes with a steal
          const bad = r() < 0.6;
          const stealer = opp[Math.floor(r() * 5)];
          const who = r() < 0.4 ? playmaker(team) : shooter;
          line(who).turnover++;
          if (bad) line(stealer).stl++;
          plays.push({ ...base, type: bad ? 'Bad Pass Turnover' : 'Lost Ball Turnover', text: bad ? `${who.first_name} ${who.last_name} bad pass (${stealer.first_name} ${stealer.last_name} steals)` : `${who.first_name} ${who.last_name} lost ball turnover`, home_score: hs, away_score: as, scoring_play: false, shooting_play: false, score_value: null, participants: bad ? [who.id, stealer.id] : [who.id] });
          continue;
        }
        const three = r() < 0.38;
        const made = r() < (three ? 0.37 : 0.53);
        const l = line(shooter);
        l.fga++;
        if (three) l.fg3a++;
        if (!made) {
          plays.push({ ...base, type: three ? 'Jump Shot' : 'Driving Layup Shot', text: `${shooter.first_name} ${shooter.last_name} misses ${three ? '25-foot three point jumper' : 'driving layup'}`, home_score: hs, away_score: as, scoring_play: false, shooting_play: true, score_value: null, participants: [shooter.id] });
          continue;
        }
        const pts = three ? 3 : 2;
        if (team.id === home.id) hs += pts;
        else as += pts;
        l.pts += pts;
        l.fgm++;
        if (three) l.fg3m++;
        const assisted = r() < 0.62;
        const passer = assisted ? (r() < 0.45 && playmaker(team).id !== shooter.id ? playmaker(team) : roster.filter((p) => p.id !== shooter.id)[Math.floor(r() * 4)]) : null;
        if (passer) line(passer).ast++;
        const shot = three ? `${23 + Math.floor(r() * 5)}-foot three point jumper` : r() < 0.25 ? 'driving dunk' : 'driving layup';
        plays.push({
          ...base, type: three ? 'Jump Shot' : shot.includes('dunk') ? 'Dunk Shot' : 'Driving Layup Shot',
          text: `${shooter.first_name} ${shooter.last_name} makes ${shot}${passer ? ` (${passer.first_name} ${passer.last_name} assists)` : ''}`,
          home_score: hs, away_score: as, scoring_play: true, shooting_play: true, score_value: pts, participants: passer ? [shooter.id, passer.id] : [shooter.id],
        });
        if (passer) {
          officialAssists.push({
            order, period, clockSec: clock, wallclock: new Date(wall + 1000).toISOString(), team: team.abbreviation, scorer: initial(shooter), assister: initial(passer),
            desc: `${initial(shooter)} ${three ? `${shot.slice(0, 2)}' 3PT` : shot.includes('dunk') ? 'driving DUNK' : 'driving Layup'} (${l.pts} PTS) (${initial(passer)} ${line(passer).ast} AST)`,
            shot: three ? 'three_pointer' : shot.includes('dunk') ? 'dunk' : 'layup',
          });
        }
      }
    }
    const status = unfinished ? '2nd Qtr' : 'Final';
    const game = {
      id: gameId, date, season: 2026, status, status_state: unfinished ? 'in_progress' : 'final', period: unfinished ? 2 : 4, time: unfinished ? '4:12' : 'Final',
      period_detail: status, datetime: tip.toISOString(), postseason: false, home_team_score: hs, visitor_team_score: as, home_team: home, visitor_team: away, ist_stage: null,
    };
    const stats = [...rosters.get(home.id)!, ...rosters.get(away.id)!].map((p, i) => {
      const b = line(p);
      return {
        id: gameId * 100 + i, min: `${20 + ((p.id * 7) % 18)}:${String((p.id * 13) % 60).padStart(2, '0')}`, ...b, oreb: 0, dreb: b.reb,
        fg_pct: b.fga ? b.fgm / b.fga : 0, fg3_pct: b.fg3a ? b.fg3m / b.fg3a : 0, ft_pct: 0, plus_minus: 0,
        player: { id: p.id, first_name: p.first_name, last_name: p.last_name, position: p.position, jersey_number: p.jersey_number, team: p.team },
        team: p.team, game: { id: gameId, date, season: 2026, status, status_state: game.status_state, home_team_score: hs, visitor_team_score: as },
      };
    });
    games.push({ game, plays, stats, officialAssists });
  }
  return { date, games };
}
