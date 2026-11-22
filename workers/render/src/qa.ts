import { computeTimeline, validateSpec, type VideoSpec } from '@tiresias/core';
import { countCuts, detectBlack, measureLoudness, probe, type ProbeResult } from './ffmpeg';

export type CheckStatus = 'pass' | 'warn' | 'fail';
export interface QACheck {
  id: string;
  status: CheckStatus;
  detail: string;
}
export interface QAReport {
  passed: boolean;
  checkedAt: string;
  probe: ProbeResult | null;
  checks: QACheck[];
}

/**
 * Post-render quality gate. Everything here is deterministic (ffprobe/ffmpeg
 * measurements + spec geometry); nothing is judged by an LLM.
 */
export async function validateRender(file: string, spec: VideoSpec, opts: { expectAudio?: boolean } = {}): Promise<QAReport> {
  const checks: QACheck[] = [];
  const add = (id: string, ok: boolean | 'warn', detail: string) => checks.push({ id, status: ok === 'warn' ? 'warn' : ok ? 'pass' : 'fail', detail });
  let p: ProbeResult | null = null;
  try {
    p = await probe(file);
  } catch (e) {
    add('file.readable', false, String(e));
    return { passed: false, checkedAt: new Date().toISOString(), probe: null, checks };
  }
  const tl = computeTimeline(spec);
  const expected = tl.durationInFrames / tl.fps;

  add('resolution', p.width === 1080 && p.height === 1920, `${p.width}×${p.height} (expected 1080×1920)`);
  add('aspect', Math.abs(p.width / p.height - 9 / 16) < 0.001, `aspect ${(p.width / p.height).toFixed(4)} (expected 0.5625)`);
  add('codec.video', p.videoCodec === 'h264' && p.pixFmt === 'yuv420p', `${p.videoCodec} ${p.pixFmt}`);
  add('fps', Math.abs(p.fps - 30) < 0.01, `${p.fps.toFixed(3)} fps (minimum 30)`);
  add('duration', Math.abs(p.durationSec - expected) <= 0.1, `${p.durationSec.toFixed(3)} s (expected ${expected.toFixed(3)} s)`);
  if (opts.expectAudio ?? true) {
    add('codec.audio', p.audioCodec === 'aac', `audio: ${p.audioCodec ?? 'none'} @ ${p.audioSampleRate ?? '-'} Hz`);
  }

  const black = await detectBlack(file);
  add('black.frames', black.length === 0, black.length ? `black segments: ${black.map((b) => `${b.start.toFixed(2)}–${b.end.toFixed(2)}s`).join(', ')}` : 'no black segments ≥0.4 s');

  if (p.audioCodec) {
    const l = await measureLoudness(file);
    const okLoud = l.integrated !== null && l.integrated > -20 && l.integrated < -10;
    add('audio.loudness', okLoud ? true : 'warn', `integrated ${l.integrated ?? '?'} LUFS, true peak ${l.truePeak ?? '?'} dBFS (target −14 LUFS)`);
  }

  const cuts = await countCuts(file);
  // Designed hard transitions: freeze flash, reveal, explanation replay jump, outro. Allow a little slack.
  add('continuity', cuts.length <= 8 ? true : 'warn', `${cuts.length} hard visual cuts detected${cuts.length ? ` at ${cuts.map((c) => c.toFixed(2)).join(', ')} s` : ''}`);

  for (const issue of validateSpec(spec)) {
    add(`spec.${issue.code}`, issue.severity === 'error' ? false : 'warn', issue.message);
  }

  return { passed: checks.every((c) => c.status !== 'fail'), checkedAt: new Date().toISOString(), probe: p, checks };
}

export async function validateCover(file: string): Promise<QAReport> {
  const checks: QACheck[] = [];
  const p = await probe(file);
  checks.push({ id: 'cover.resolution', status: p.width === 1080 && p.height === 1920 ? 'pass' : 'fail', detail: `${p.width}×${p.height}` });
  checks.push({ id: 'cover.format', status: p.videoCodec === 'png' ? 'pass' : 'fail', detail: `${p.videoCodec}` });
  return { passed: checks.every((c) => c.status !== 'fail'), checkedAt: new Date().toISOString(), probe: p, checks };
}
