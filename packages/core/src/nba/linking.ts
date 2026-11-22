import { normalizeName } from './text';
import type { ClipReferenceRec } from './types';
import type { ExtractedEvent } from './events';

export interface LinkResult {
  score: number; // 0..1
  level: 'strong' | 'probable' | 'weak' | 'none';
  reasons: string[];
}

/** "M. McBride" ↔ "Miles McBride" ↔ "McBride". */
export function namesCompatible(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const x = normalizeName(a).split(' ');
  const y = normalizeName(b).split(' ');
  const lastX = x[x.length - 1];
  const lastY = y[y.length - 1];
  if (lastX !== lastY) return false;
  if (x.length === 1 || y.length === 1) return true;
  return x[0][0] === y[0][0];
}

/**
 * Score how well a play-level clip reference matches one of our extracted
 * events. Requires the same period; then weighs clock, wall-clock time, team
 * and names. Game-level clips never link to individual plays.
 */
export function linkClipToEvent(
  clip: ClipReferenceRec,
  event: ExtractedEvent & { teamAbbreviation: string | null; playerName: string | null; scorerName: string | null },
): LinkResult {
  const mp = clip.matchedPlay;
  if (clip.granularity !== 'play' || !mp) return { score: 0, level: 'none', reasons: ['clip is not play-level'] };
  const reasons: string[] = [];
  if (mp.period == null || mp.period !== event.period) return { score: 0, level: 'none', reasons: ['different period'] };
  let score = 0.2;
  reasons.push('same period');
  if (mp.clockSeconds != null && event.clockSeconds != null) {
    const d = Math.abs(mp.clockSeconds - event.clockSeconds);
    if (d <= 1.5) {
      score += 0.35;
      reasons.push(`clock within ${d.toFixed(1)}s`);
    } else if (d <= 5) {
      score += 0.15;
      reasons.push(`clock within ${d.toFixed(1)}s`);
    } else reasons.push(`clock differs by ${d.toFixed(1)}s`);
  }
  if (mp.wallclock && event.wallclock) {
    const d = Math.abs(Date.parse(mp.wallclock) - Date.parse(event.wallclock)) / 1000;
    if (d <= 20) {
      score += 0.15;
      reasons.push(`wall clock within ${Math.round(d)}s`);
    } else if (d > 120) {
      score -= 0.2;
      reasons.push(`wall clock differs by ${Math.round(d)}s`);
    }
  }
  if (mp.teamAbbreviation && event.teamAbbreviation) {
    if (mp.teamAbbreviation.toUpperCase() === event.teamAbbreviation.toUpperCase()) {
      score += 0.1;
      reasons.push('same team');
    } else {
      score -= 0.3;
      reasons.push('different team');
    }
  }
  if (event.kind === 'assist') {
    if (namesCompatible(mp.assistPlayer, event.playerName)) {
      score += 0.15;
      reasons.push('assister name matches');
    } else if (mp.assistPlayer) {
      score -= 0.2;
      reasons.push('assister name differs');
    }
    if (namesCompatible(mp.player, event.scorerName)) {
      score += 0.05;
      reasons.push('scorer name matches');
    }
  } else if (namesCompatible(mp.player, event.playerName)) {
    score += 0.15;
    reasons.push('player name matches');
  }
  score = Math.max(0, Math.min(1, score));
  const level = score >= 0.8 ? 'strong' : score >= 0.6 ? 'probable' : score > 0.3 ? 'weak' : 'none';
  return { score: Math.round(score * 100) / 100, level, reasons };
}

/** Highlight API deterministic game key: nba-{date}-{away}-{home}, lowercase. */
export function highlightApiGameKey(date: string, awayAbbr: string, homeAbbr: string): string {
  return `nba-${date}-${awayAbbr}-${homeAbbr}`.toLowerCase();
}
