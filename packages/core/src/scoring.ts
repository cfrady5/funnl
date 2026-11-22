/**
 * Transparent candidate scoring. Every factor is a 0..1 measurement with a
 * recorded source (measured by CV, derived from data, or set by a reviewer);
 * the total is a weighted average reported with its full breakdown.
 * The highest assist total never implies the best individual assist.
 */
export const SCORING_FACTORS = [
  'passingOptions',
  'handlerVisibility',
  'teammateDefenseVisibility',
  'decisionComplexity',
  'cameraAngle',
  'resolution',
  'possessionContinuity',
  'decisionPointClarity',
  'entertainment',
  'explainability',
] as const;
export type ScoringFactor = (typeof SCORING_FACTORS)[number];

export const DEFAULT_WEIGHTS: Record<ScoringFactor, number> = {
  passingOptions: 14,
  handlerVisibility: 10,
  teammateDefenseVisibility: 12,
  decisionComplexity: 12,
  cameraAngle: 10,
  resolution: 6,
  possessionContinuity: 10,
  decisionPointClarity: 12,
  entertainment: 7,
  explainability: 7,
};

export interface FactorValue {
  value: number; // 0..1
  source: 'cv' | 'data' | 'reviewer' | 'llm' | 'default';
  note?: string;
}

export interface ScoreBreakdown {
  total: number; // 0..100
  coverage: number; // share of weight that came from non-default measurements
  factors: Array<{ factor: ScoringFactor; weight: number; value: number; contribution: number; source: FactorValue['source']; note?: string }>;
}

export function scoreCandidate(
  values: Partial<Record<ScoringFactor, FactorValue>>,
  weights: Record<ScoringFactor, number> = DEFAULT_WEIGHTS,
): ScoreBreakdown {
  const totalWeight = SCORING_FACTORS.reduce((s, f) => s + Math.max(0, weights[f]), 0) || 1;
  let sum = 0;
  let measured = 0;
  const factors = SCORING_FACTORS.map((factor) => {
    const fv = values[factor] ?? { value: 0, source: 'default' as const, note: 'not measured' };
    const value = Math.min(1, Math.max(0, fv.value));
    const weight = Math.max(0, weights[factor]);
    const contribution = (weight / totalWeight) * value * 100;
    sum += contribution;
    if (fv.source !== 'default') measured += weight;
    return { factor, weight, value, contribution: Math.round(contribution * 100) / 100, source: fv.source, note: fv.note };
  });
  return { total: Math.round(sum * 10) / 10, coverage: Math.round((measured / totalWeight) * 100) / 100, factors };
}

export interface PlayerLine {
  playerId: string;
  name: string;
  teamAbbr: string;
  gameId: string;
  assists: number;
  turnovers: number;
  minutes: number;
}

/** Top-N assist leaders, unique per player, deterministic tie-breaks. */
export function rankAssistLeaders(lines: PlayerLine[], n = 15): PlayerLine[] {
  const best = new Map<string, PlayerLine>();
  for (const l of lines) {
    const prev = best.get(l.playerId);
    if (!prev || l.assists > prev.assists) best.set(l.playerId, l);
  }
  return [...best.values()]
    .sort((a, b) => b.assists - a.assists || a.turnovers - b.turnovers || a.minutes - b.minutes || a.name.localeCompare(b.name))
    .slice(0, n);
}

export interface ScoredClip {
  clipId: string;
  playerId: string;
  score: number;
  eligible: boolean; // rights cleared + analysis valid
}

/**
 * Selection modes:
 *  - 'one_per_player': best eligible clip for each of the top-5 assist leaders.
 *  - 'best_from_pool': five best eligible clips from the top-15 leaders (max one per player).
 * Never substitutes ineligible clips; returns fewer when material is insufficient.
 */
export function selectClips(
  leaders: PlayerLine[],
  clips: ScoredClip[],
  mode: 'one_per_player' | 'best_from_pool',
  count = 5,
): ScoredClip[] {
  const pool = mode === 'one_per_player' ? leaders.slice(0, count) : leaders.slice(0, 15);
  const allowed = new Set(pool.map((p) => p.playerId));
  const bestPerPlayer = new Map<string, ScoredClip>();
  for (const c of clips) {
    if (!c.eligible || !allowed.has(c.playerId)) continue;
    const prev = bestPerPlayer.get(c.playerId);
    if (!prev || c.score > prev.score) bestPerPlayer.set(c.playerId, c);
  }
  const picked = [...bestPerPlayer.values()];
  if (mode === 'one_per_player') {
    const order = new Map(pool.map((p, i) => [p.playerId, i]));
    return picked.sort((a, b) => order.get(a.playerId)! - order.get(b.playerId)!);
  }
  return picked.sort((a, b) => b.score - a.score).slice(0, count);
}
