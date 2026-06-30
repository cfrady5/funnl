/**
 * Recommendation construction + prioritization.
 *
 * Priority Score = Impact × Confidence × Urgency ÷ Difficulty, normalized to
 * 0–100. Impact is derived from severity; urgency and confidence default from
 * severity but can be overridden per-rule. This makes the action list ranking
 * explainable and consistent across SEO and PPC recommendations.
 */

import { clamp, generateId } from "@/lib/utils";
import type {
  Confidence,
  Difficulty,
  Recommendation,
  Severity,
  Urgency,
} from "@/lib/types";

const IMPACT: Record<Severity, number> = { critical: 1.0, high: 0.8, medium: 0.55, low: 0.3 };
const URGENCY: Record<Urgency, number> = { now: 1.0, soon: 0.75, later: 0.5 };
const CONFIDENCE: Record<Confidence, number> = { high: 1.0, medium: 0.8, low: 0.6 };
const DIFFICULTY: Record<Difficulty, number> = { easy: 0.7, medium: 1.0, hard: 1.4 };

const DEFAULT_URGENCY: Record<Severity, Urgency> = {
  critical: "now",
  high: "soon",
  medium: "soon",
  low: "later",
};

export function computePriority(
  severity: Severity,
  difficulty: Difficulty,
  urgency: Urgency,
  confidence: Confidence,
): number {
  const raw = (IMPACT[severity] * CONFIDENCE[confidence] * URGENCY[urgency]) / DIFFICULTY[difficulty];
  // raw max ≈ 1.0/0.7 = 1.43; normalize to 0–100.
  return clamp(Math.round((raw / 1.43) * 100));
}

type RecInput = Omit<Recommendation, "id" | "priorityScore" | "urgency" | "confidence"> & {
  urgency?: Urgency;
  confidence?: Confidence;
  priorityScore?: number;
};

export function makeRecommendation(input: RecInput): Recommendation {
  const urgency = input.urgency ?? DEFAULT_URGENCY[input.severity];
  const confidence = input.confidence ?? "high";
  const priorityScore = input.priorityScore ?? computePriority(input.severity, input.difficulty, urgency, confidence);
  return {
    ...input,
    id: generateId("rec"),
    urgency,
    confidence,
    priorityScore,
  };
}
