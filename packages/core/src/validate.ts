import { layoutOptions } from './layout';
import type { VideoSpec } from './spec';
import { computeTimeline } from './timeline';

export interface Issue {
  severity: 'error' | 'warning';
  code: string;
  message: string;
  field?: string;
}

/** Soft character budgets that keep on-screen text legible at 1080 px wide. */
export const TEXT_BUDGETS = {
  hook: 52,
  decisionPrompt: 32,
  explanation: 170,
  verdict: 32,
  optionDescription: 30,
} as const;

/**
 * Deterministic pre-render checks. Errors block rendering; warnings are shown
 * to the editor. No LLM is involved here.
 */
export function validateSpec(spec: VideoSpec): Issue[] {
  const issues: Issue[] = [];
  const err = (code: string, message: string, field?: string) => issues.push({ severity: 'error', code, message, field });
  const warn = (code: string, message: string, field?: string) => issues.push({ severity: 'warning', code, message, field });

  const { startSec, endSec } = spec.clip;
  if (endSec <= startSec) err('clip.range', 'Clip end must be after clip start.', 'clip');
  if (endSec > spec.source.durationSec + 0.05) err('clip.end', 'Clip end is beyond the source duration.', 'clip.endSec');
  if (spec.freezeSec <= startSec || spec.freezeSec >= endSec) err('freeze.range', 'Freeze frame must be inside the clip window.', 'freezeSec');
  if (spec.freezeSec - startSec < 1) warn('freeze.leadin', 'Less than 1 s of build-up before the freeze; the hook will hold a still frame.', 'freezeSec');
  if (endSec - spec.freezeSec < 1.5) warn('reveal.short', 'Less than 1.5 s of footage after the freeze; the reveal may not show the pass completing.', 'clip.endSec');

  const labels = spec.options.map((o) => o.label);
  if (new Set(labels).size !== labels.length) err('options.duplicate', 'Option labels must be unique.', 'options');
  const expected = ['A', 'B', 'C', 'D'].slice(0, labels.length);
  if ([...labels].sort().join() !== expected.join()) err('options.sequence', `Options must be labelled ${expected.join(', ')} in sequence.`, 'options');
  if (!labels.includes(spec.assessment.actual)) err('assessment.actual', 'The actual read must be one of the options.', 'assessment.actual');
  if (spec.assessment.bestSupported !== 'unknown' && !labels.includes(spec.assessment.bestSupported)) {
    err('assessment.best', 'Best-supported option must be one of the options or "unknown".', 'assessment.bestSupported');
  }
  for (const o of spec.options) {
    if (o.description.length > TEXT_BUDGETS.optionDescription) warn('text.option', `Option ${o.label} description is long and may be shrunk.`, `options.${o.label}`);
    if (o.origin === 'auto' && o.confidence < 0.6) warn('option.lowconf', `Option ${o.label} was auto-detected with low confidence (${o.confidence.toFixed(2)}); verify its position.`, `options.${o.label}`);
  }

  const { problems } = layoutOptions(spec);
  for (const p of problems) err('layout.options', p, 'options');
  if (spec.handler) {
    const tooClose = spec.options.find((o) => Math.hypot(o.x - spec.handler!.x, o.y - spec.handler!.y) < 0.02);
    if (tooClose) warn('handler.overlap', `Ball handler marker sits on option ${tooClose.label}.`, 'handler');
  }

  if (spec.text.hook.length > TEXT_BUDGETS.hook) warn('text.hook', 'Hook is long; it will be shrunk to fit.', 'text.hook');
  if (spec.text.explanation.length > TEXT_BUDGETS.explanation) warn('text.explanation', 'Explanation is long for a 5 s read.', 'text.explanation');
  if (spec.brand === 'antitiresias' && spec.assessment.decisionQuality === 'good') {
    warn('brand.anti.good', 'AntiTiresias is mocking a decision assessed as good. Consider another clip or reframing the joke around the outcome.', 'assessment.decisionQuality');
  }
  if (spec.brand === 'tiresias' && spec.assessment.bestSupported !== 'unknown' && spec.assessment.bestSupported !== spec.assessment.actual) {
    warn('brand.tiresias.mismatch', 'Best-supported option differs from the actual pass; make sure the explanation says so.', 'text.explanation');
  }

  const tl = computeTimeline(spec);
  if (tl.durationInFrames / spec.fps < 15 || tl.durationInFrames / spec.fps > 30) {
    warn('timing.total', `Total duration is ${(tl.durationInFrames / spec.fps).toFixed(1)} s (target 18–22 s).`, 'timing');
  }
  return issues;
}

export function hasBlockingIssues(issues: Issue[]): boolean {
  return issues.some((i) => i.severity === 'error');
}
