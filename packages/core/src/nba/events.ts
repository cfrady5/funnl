import { clockToSeconds, resolvePlayerName, type NamedPlayer } from './text';
import type { PlayRec, PlayerBoxRec } from './types';

/**
 * How an assist/turnover attribution was established:
 *  - confirmed:   named in the play text AND the player id is in participants[]
 *  - text_only:   named in the text and resolved on the roster, but not in participants[]
 *  - unresolved:  the text indicates an assist/turnover but the name could not be resolved
 */
export type Attribution = 'confirmed' | 'text_only' | 'unresolved';

export interface ExtractedEvent {
  kind: 'assist' | 'turnover';
  order: number;
  period: number;
  clockSeconds: number | null;
  wallclock: string | null;
  teamProviderId: string | null;
  /** Assist: the passer. Turnover: the player who turned it over. */
  playerId: string | null;
  playerNameInText: string | null;
  /** Assist: the scorer. Turnover: the player credited with the steal, if any. */
  secondaryPlayerId: string | null;
  secondaryNameInText: string | null;
  attribution: Attribution;
  scoreValue: number | null;
  shotType: string;
  text: string;
}

// "(Jalen Brunson assists)"  — ESPN-style text
// "(M. McBride 1 AST)"       — official NBA feed style
const ASSIST_PATTERNS = [/\(([^()]+?)\s+assists?\)/i, /\(([^()]+?)\s+\d+\s+AST\)/i];
const STEAL_PATTERNS = [/\(([^()]+?)\s+steals?\)/i, /\(([^()]+?)\s+\d+\s+STL\)/i];
const TURNOVER_HINT = /turnover|bad pass|lost ball|traveling|travel\b|offensive foul|out of bounds|backcourt|shot clock|3 second|three second|double dribble|discontinued dribble|kicked ball|palming|offensive goaltending/i;

function scorerName(text: string): string | null {
  const m = /^(.+?)\s+(makes|made|dunk|layup)\b/i.exec(text.trim());
  return m ? m[1].trim() : null;
}

function turnoverName(text: string): string | null {
  const t = text.trim();
  const m = /^(.+?)\s+(bad pass|lost ball|traveling|turnover|offensive foul|out of bounds|backcourt|double dribble|discontinued dribble|kicked ball|palming|3 second|three second|offensive goaltending)/i.exec(t);
  return m ? m[1].trim() : null;
}

/** Extract assists and turnovers from a game's plays using the game roster. */
export function extractEvents(plays: PlayRec[], roster: NamedPlayer[]): ExtractedEvent[] {
  const out: ExtractedEvent[] = [];
  for (const p of plays) {
    const base = {
      order: p.order,
      period: p.period,
      clockSeconds: clockToSeconds(p.clock),
      wallclock: p.wallclock,
      teamProviderId: p.teamProviderId,
      scoreValue: p.scoreValue,
      shotType: p.type,
      text: p.text,
    };
    // Assists: only on made field goals (scoring plays; free throws are never assisted).
    if (p.scoringPlay && !/free throw/i.test(`${p.type} ${p.text}`)) {
      const pattern = ASSIST_PATTERNS.map((r) => r.exec(p.text)).find(Boolean);
      if (pattern) {
        const assistName = pattern[1].trim();
        const assister = resolvePlayerName(assistName, roster, p.teamProviderId);
        const sName = scorerName(p.text);
        const scorer = sName ? resolvePlayerName(sName, roster, p.teamProviderId) : null;
        out.push({
          kind: 'assist',
          ...base,
          playerId: assister?.id ?? null,
          playerNameInText: assistName,
          secondaryPlayerId: scorer?.id ?? (p.participants[0] ?? null),
          secondaryNameInText: sName,
          attribution: !assister ? 'unresolved' : p.participants.includes(assister.id) ? 'confirmed' : 'text_only',
        });
        continue;
      }
    }
    if (TURNOVER_HINT.test(`${p.type} ${p.text}`) && !p.scoringPlay) {
      const tName = turnoverName(p.text);
      const player = tName ? resolvePlayerName(tName, roster, p.teamProviderId) : null;
      const steal = STEAL_PATTERNS.map((r) => r.exec(p.text)).find(Boolean);
      const stealer = steal ? resolvePlayerName(steal[1].trim(), roster) : null;
      // Team turnovers (shot clock etc.) carry no player: no resolvable name and no participants.
      if (!tName || (!player && p.participants.length === 0)) continue;
      out.push({
        kind: 'turnover',
        ...base,
        playerId: player?.id ?? null,
        playerNameInText: tName,
        secondaryPlayerId: stealer?.id ?? null,
        secondaryNameInText: steal ? steal[1].trim() : null,
        attribution: !player ? 'unresolved' : p.participants.includes(player.id) ? 'confirmed' : 'text_only',
      });
    }
  }
  return out;
}

export interface Reconciliation {
  playerId: string;
  boxAssists: number;
  extractedAssists: number;
  boxTurnovers: number;
  extractedTurnovers: number;
  assistsMatch: boolean;
  turnoversMatch: boolean;
}

export interface ReconciliationSummary {
  players: Reconciliation[];
  /** Share of box-score assists that we attributed to individual plays. */
  assistCoverage: number;
  unresolvedEvents: number;
  /** True when every player's assist count matches the box score exactly. */
  assistsVerified: boolean;
}

/**
 * Compare per-player counts extracted from play-by-play with the official box
 * score. A match is the evidence that the attribution is right; mismatches
 * are surfaced, never silently "fixed".
 */
export function reconcile(events: ExtractedEvent[], box: PlayerBoxRec[]): ReconciliationSummary {
  const count = (kind: 'assist' | 'turnover', id: string) => events.filter((e) => e.kind === kind && e.playerId === id).length;
  const players = box.map((b) => {
    const ea = count('assist', b.player.providerId);
    const et = count('turnover', b.player.providerId);
    return {
      playerId: b.player.providerId,
      boxAssists: b.ast,
      extractedAssists: ea,
      boxTurnovers: b.turnovers,
      extractedTurnovers: et,
      assistsMatch: ea === b.ast,
      turnoversMatch: et === b.turnovers,
    };
  });
  const totalBox = box.reduce((s, b) => s + b.ast, 0);
  const matched = players.reduce((s, p) => s + Math.min(p.boxAssists, p.extractedAssists), 0);
  return {
    players,
    assistCoverage: totalBox ? Math.round((matched / totalBox) * 1000) / 1000 : 1,
    unresolvedEvents: events.filter((e) => e.attribution === 'unresolved').length,
    assistsVerified: players.every((p) => p.assistsMatch),
  };
}
