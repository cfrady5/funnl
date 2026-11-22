import { autoFraming, CoverSpecSchema, VideoSpecSchema, type CoverSpec, type VideoSpec } from '@tiresias/core';

/**
 * Sample specs built on the procedurally generated fixtures in /fixtures.
 * Option coordinates come from the generator's ground truth at the decision
 * frame. Player names and stat lines are fictional and labelled as a demo —
 * no real player data is used here.
 */
/** Receiver ground truth from the fixture generator (every 0.2 s after the freeze). */
const SKIP_TRACK = [{"t": 3.9, "x": 0.622, "y": 0.3661}, {"t": 4.1, "x": 0.6168, "y": 0.3661}, {"t": 4.3, "x": 0.6064, "y": 0.3661}, {"t": 4.5, "x": 0.5915, "y": 0.3661}, {"t": 4.7, "x": 0.5734, "y": 0.3661}, {"t": 4.9, "x": 0.5549, "y": 0.3661}, {"t": 5.1, "x": 0.5419, "y": 0.3661}, {"t": 5.3, "x": 0.5329, "y": 0.3661}, {"t": 5.5, "x": 0.5267, "y": 0.3661}, {"t": 5.7, "x": 0.5224, "y": 0.3661}, {"t": 5.9, "x": 0.5194, "y": 0.3661}, {"t": 6.1, "x": 0.5174, "y": 0.3661}, {"t": 6.3, "x": 0.516, "y": 0.3661}, {"t": 6.5, "x": 0.515, "y": 0.3661}, {"t": 6.7, "x": 0.5143, "y": 0.3661}, {"t": 6.9, "x": 0.5139, "y": 0.3661}, {"t": 7.1, "x": 0.5135, "y": 0.3661}, {"t": 7.3, "x": 0.5133, "y": 0.3661}, {"t": 7.5, "x": 0.5132, "y": 0.3661}, {"t": 7.7, "x": 0.5131, "y": 0.3661}, {"t": 7.9, "x": 0.513, "y": 0.3661}];
const TURNOVER_TRACK = [{"t": 3.6, "x": 0.5577, "y": 0.4295}, {"t": 3.8, "x": 0.5569, "y": 0.4328}, {"t": 4.0, "x": 0.5534, "y": 0.4399}, {"t": 4.2, "x": 0.5473, "y": 0.4473}, {"t": 4.4, "x": 0.5398, "y": 0.4507}, {"t": 4.6, "x": 0.532, "y": 0.4509}, {"t": 4.8, "x": 0.5262, "y": 0.4515}, {"t": 5.0, "x": 0.5218, "y": 0.4524}, {"t": 5.2, "x": 0.5184, "y": 0.4535}, {"t": 5.4, "x": 0.5158, "y": 0.4549}, {"t": 5.6, "x": 0.5138, "y": 0.4566}, {"t": 5.8, "x": 0.5121, "y": 0.4583}, {"t": 6.0, "x": 0.5109, "y": 0.4602}, {"t": 6.2, "x": 0.5101, "y": 0.462}, {"t": 6.4, "x": 0.5094, "y": 0.464}, {"t": 6.6, "x": 0.5091, "y": 0.4659}, {"t": 6.8, "x": 0.509, "y": 0.4678}, {"t": 7.0, "x": 0.5091, "y": 0.4694}, {"t": 7.2, "x": 0.5095, "y": 0.4709}, {"t": 7.4, "x": 0.5101, "y": 0.4722}, {"t": 7.6, "x": 0.5108, "y": 0.4731}, {"t": 7.8, "x": 0.5118, "y": 0.4738}];

const SOURCE = { width: 1920, height: 1080, fps: 30, durationSec: 8, attribution: 'Synthetic test footage' };

const skipHandler = { x: 0.5388, y: 0.5184 };
const skipOptions = [
  { label: 'A', description: 'Roll man', x: 0.5685, y: 0.474 },
  { label: 'B', description: 'Weak-side wing', x: 0.4569, y: 0.3869 },
  { label: 'C', description: 'Corner skip', x: 0.622, y: 0.3661 },
  { label: 'D', description: 'Near wing', x: 0.3209, y: 0.7999 },
] as const;

export const SAMPLE_SPEC_TIRESIAS: VideoSpec = VideoSpecSchema.parse({
  brand: 'tiresias',
  contentId: 'TRS-DEMO-01',
  source: { src: 'fixtures/synthetic_skip_pass.mp4', ...SOURCE },
  clip: { startSec: 0.5, endSec: 8 },
  freezeSec: 3.9,
  handler: skipHandler,
  options: skipOptions.map((o) => ({ ...o, origin: 'manual', confidence: 1 })),
  receiverTrack: SKIP_TRACK,
  assessment: { actual: 'C', bestSupported: 'C', decisionQuality: 'good' },
  framing: { mode: 'auto', keyframes: [autoFraming(SOURCE, [skipHandler, ...skipOptions], { t: 3.9 })] },
  text: {
    hook: 'CAN YOU SEE THE PASS BEFORE HE DOES?',
    decisionPrompt: 'WHAT’S THE READ?',
    explanation: 'The weak-side corner defender steps in to help on the drive. That leaves the corner empty — one skip pass and it’s a clean catch-and-shoot.',
    verdict: null,
    engagementPrimary: 'DID YOU SEE IT?',
    engagementSecondary: 'COMMENT YOUR PICK.',
  },
  player: { name: 'Marcus Vale', teamAbbr: 'DEMO', teamName: 'Synthetic Demo', statLine: '12 AST · DEMO DATA', gameLabel: 'DEMO GAME' },
});

const toHandler = { x: 0.5233, y: 0.5718 };
const toOptions = [
  { label: 'A', description: 'Open shooter', x: 0.6167, y: 0.8231 },
  { label: 'B', description: 'Cutting teammate', x: 0.7635, y: 0.5492 },
  { label: 'C', description: 'The defender', x: 0.5577, y: 0.4295 },
] as const;

export const SAMPLE_SPEC_ANTI: VideoSpec = VideoSpecSchema.parse({
  brand: 'antitiresias',
  contentId: 'ATR-DEMO-01',
  source: { src: 'fixtures/synthetic_turnover.mp4', ...SOURCE },
  clip: { startSec: 0.3, endSec: 8 },
  freezeSec: 3.6,
  handler: toHandler,
  options: toOptions.map((o) => ({ ...o, origin: 'manual', confidence: 1 })),
  receiverTrack: TURNOVER_TRACK,
  assessment: { actual: 'C', bestSupported: 'A', decisionQuality: 'poor' },
  framing: { mode: 'auto', keyframes: [autoFraming(SOURCE, [toHandler, ...toOptions], { t: 3.6 })] },
  text: {
    hook: 'A WIDE-OPEN SHOOTER. A FREE CUTTER. AND…',
    decisionPrompt: 'THREE OPTIONS. ONE DISASTER.',
    explanation: 'Shooter alone in the corner. Cutter alone at the rim. He picked the only player on the floor wearing the other jersey.',
    verdict: 'GENERATIONAL COURT VISION.',
    engagementPrimary: 'WOULD YOU HAVE DONE WORSE?',
    engagementSecondary: 'COMMENT YOUR PICK.',
  },
  player: { name: 'Dex Holloway', teamAbbr: 'DEMO', teamName: 'Synthetic Demo', statLine: '6 TOV · DEMO DATA', gameLabel: 'DEMO GAME' },
});

export const SAMPLE_COVER: CoverSpec = CoverSpecSchema.parse({
  brand: 'tiresias',
  contentId: 'TRS-DEMO-01',
  seriesTitle: 'COURT VISION',
  playerName: 'Marcus Vale',
  teamAbbr: 'DEMO',
  teamName: 'Synthetic Demo',
  statValue: 12,
  statLabel: 'ASSISTS (DEMO DATA)',
  headline: 'CAN YOU SEE THE PASS?',
  gameLabel: 'Demo game',
  headshot: null,
  backdrop: { src: 'fixtures/synthetic_skip_pass.mp4', timeSec: 3.9 },
});

/** Rewrites every media key in a spec through a resolver (local server, signed URL, /api/media…). */
export function resolveVideoSpecMedia(spec: VideoSpec, resolve: (key: string) => string): VideoSpec {
  return {
    ...spec,
    source: { ...spec.source, src: resolve(spec.source.src) },
    audio: {
      ...spec.audio,
      music: spec.audio.music ? { ...spec.audio.music, src: resolve(spec.audio.music.src) } : null,
      voiceover: spec.audio.voiceover ? { ...spec.audio.voiceover, src: resolve(spec.audio.voiceover.src) } : null,
    },
  };
}

export function resolveCoverMedia(cover: CoverSpec, resolve: (key: string) => string): CoverSpec {
  return {
    ...cover,
    headshot: cover.headshot ? { ...cover.headshot, src: resolve(cover.headshot.src) } : null,
    backdrop: cover.backdrop ? { ...cover.backdrop, src: resolve(cover.backdrop.src) } : null,
  };
}
