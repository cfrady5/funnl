import type { VideoSpec } from './spec';

export const SCENE_IDS = ['hook', 'decision', 'countdown', 'reveal', 'explanation', 'outro'] as const;
export type SceneId = (typeof SCENE_IDS)[number];

export interface SceneWindow {
  id: SceneId;
  from: number; // composition frame (inclusive)
  durationInFrames: number;
}

/** A playing source segment: composition frames [from, from+duration) map to source seconds. */
export interface SourceSegment {
  kind: 'play' | 'hold';
  from: number;
  durationInFrames: number;
  /** Source time at segment start, seconds. */
  sourceStartSec: number;
  playbackRate: number; // 0 for hold
}

export interface Timeline {
  fps: number;
  durationInFrames: number;
  scenes: SceneWindow[];
  segments: SourceSegment[];
  freezeFrameSource: number; // source frame index of the freeze
}

const toFrames = (sec: number, fps: number) => Math.round(sec * fps);

/**
 * Pure mapping from a spec to scene windows and source playback segments.
 * Shared by the Remotion compositions, the editor and the render validator so
 * they can never disagree about what is on screen at a given frame.
 */
export function computeTimeline(spec: VideoSpec): Timeline {
  const fps = spec.fps;
  const t = spec.timing;
  const lengths: Record<SceneId, number> = {
    hook: toFrames(t.hook, fps),
    decision: toFrames(t.decision, fps),
    countdown: toFrames(t.countdown, fps),
    reveal: toFrames(t.reveal, fps),
    explanation: toFrames(t.explanation, fps),
    outro: toFrames(t.outro, fps),
  };
  const scenes: SceneWindow[] = [];
  let cursor = 0;
  for (const id of SCENE_IDS) {
    scenes.push({ id, from: cursor, durationInFrames: lengths[id] });
    cursor += lengths[id];
  }
  const sceneOf = (id: SceneId) => scenes.find((s) => s.id === id)!;

  const { startSec, endSec } = spec.clip;
  const freeze = Math.min(Math.max(spec.freezeSec, startSec), endSec);
  const segments: SourceSegment[] = [];

  // HOOK — play the build-up into the freeze. If there is not enough lead-in,
  // slow down (to 0.5x at most) and then hold the first frame for the remainder.
  {
    const s = sceneOf('hook');
    const available = freeze - startSec;
    const rate = Math.max(0.5, Math.min(1, available / t.hook));
    const playFrames = Math.min(s.durationInFrames, Math.floor((available / rate) * fps));
    const holdFrames = s.durationInFrames - playFrames;
    const playStart = freeze - (playFrames / fps) * rate;
    if (holdFrames > 0) {
      segments.push({ kind: 'hold', from: s.from, durationInFrames: holdFrames, sourceStartSec: Math.max(startSec, playStart), playbackRate: 0 });
    }
    if (playFrames > 0) {
      segments.push({ kind: 'play', from: s.from + holdFrames, durationInFrames: playFrames, sourceStartSec: playStart, playbackRate: rate });
    }
  }

  // DECISION + COUNTDOWN — frozen on the decision frame.
  {
    const d = sceneOf('decision');
    const c = sceneOf('countdown');
    segments.push({ kind: 'hold', from: d.from, durationInFrames: d.durationInFrames + c.durationInFrames, sourceStartSec: freeze, playbackRate: 0 });
  }

  // REVEAL — short hold while the actual read is highlighted, then resume at 1x.
  {
    const r = sceneOf('reveal');
    const hold = Math.min(r.durationInFrames, toFrames(t.revealHold, fps));
    segments.push({ kind: 'hold', from: r.from, durationInFrames: hold, sourceStartSec: freeze, playbackRate: 0 });
    pushPlayThenHold(segments, r.from + hold, r.durationInFrames - hold, freeze, 1, endSec, fps);
  }

  // EXPLANATION — slow-motion replay of the decision.
  {
    const e = sceneOf('explanation');
    const replayStart = Math.max(startSec, freeze - t.replayLeadIn);
    pushPlayThenHold(segments, e.from, e.durationInFrames, replayStart, t.replayRate, endSec, fps);
  }

  // OUTRO — hold on the end of the play.
  {
    const o = sceneOf('outro');
    const holdAt = Math.min(endSec, freeze + t.reveal - t.revealHold) - 1 / fps;
    segments.push({ kind: 'hold', from: o.from, durationInFrames: o.durationInFrames, sourceStartSec: Math.max(startSec, holdAt), playbackRate: 0 });
  }

  return {
    fps,
    durationInFrames: cursor,
    scenes,
    segments: segments.filter((s) => s.durationInFrames > 0),
    freezeFrameSource: Math.round(freeze * spec.source.fps),
  };
}

function pushPlayThenHold(
  out: SourceSegment[],
  from: number,
  frames: number,
  sourceStartSec: number,
  rate: number,
  endSec: number,
  fps: number,
) {
  if (frames <= 0) return;
  const availableSec = Math.max(0, endSec - sourceStartSec);
  const playFrames = Math.min(frames, Math.floor((availableSec / rate) * fps));
  if (playFrames > 0) out.push({ kind: 'play', from, durationInFrames: playFrames, sourceStartSec, playbackRate: rate });
  const rest = frames - playFrames;
  if (rest > 0) {
    out.push({ kind: 'hold', from: from + playFrames, durationInFrames: rest, sourceStartSec: Math.max(0, endSec - 1 / fps), playbackRate: 0 });
  }
}

/** Source time (seconds) displayed at a composition frame. */
export function sourceTimeAt(timeline: Timeline, frame: number): number {
  const seg = timeline.segments.find((s) => frame >= s.from && frame < s.from + s.durationInFrames) ?? timeline.segments[timeline.segments.length - 1];
  if (seg.kind === 'hold') return seg.sourceStartSec;
  return seg.sourceStartSec + ((frame - seg.from) / timeline.fps) * seg.playbackRate;
}

export function sceneAt(timeline: Timeline, frame: number): SceneWindow {
  return timeline.scenes.find((s) => frame >= s.from && frame < s.from + s.durationInFrames) ?? timeline.scenes[timeline.scenes.length - 1];
}
