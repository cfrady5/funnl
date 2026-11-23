import { getTheme, OPTION_LABELS, type BrandId } from './brand';
import { autoFraming } from './layout';
import { teamBlockColor } from './teams';
import { CoverSpecSchema, VideoSpecSchema, type CoverSpec, type PassingOption, type VideoSpec } from './spec';

export interface SourceMeta {
  src: string;
  width: number;
  height: number;
  fps: number;
  durationSec: number;
  attribution?: string | null;
}

/** A sensible editable starting spec for a freshly uploaded clip. */
export function createDefaultSpec(brand: BrandId, source: SourceMeta, contentId: string): VideoSpec {
  const theme = getTheme(brand);
  const freezeSec = Math.min(source.durationSec - 0.5, Math.max(0.5, source.durationSec * 0.45));
  const options: PassingOption[] = [
    [0.25, 0.62],
    [0.5, 0.48],
    [0.78, 0.6],
  ].map(([x, y], i) => ({
    label: OPTION_LABELS[i],
    description: brand === 'tiresias' ? ['Corner shooter', 'Roll man', 'Weak-side wing'][i] : ['Open shooter', 'Cutting teammate', 'The defender'][i],
    x,
    y,
    playerName: null,
    origin: 'manual',
    confidence: 1,
    labelDx: 0,
    labelDy: 0,
    reasoning: null,
  }));
  const handler = { x: 0.5, y: 0.7 };
  return VideoSpecSchema.parse({
    brand,
    contentId,
    source: { ...source, attribution: source.attribution ?? null },
    clip: { startSec: 0, endSec: source.durationSec },
    freezeSec: Math.round(freezeSec * 100) / 100,
    handler,
    options,
    assessment: { actual: 'A', bestSupported: 'unknown', decisionQuality: 'unclear' },
    framing: { mode: 'auto', keyframes: [autoFraming(source, [handler, ...options], { t: freezeSec })] },
    text: {
      hook: brand === 'tiresias' ? 'CAN YOU SEE THE PASS?' : 'WATCH THIS. THEN WORRY.',
      decisionPrompt: theme.copy.decisionPrompt,
      explanation: 'Describe what the footage shows: who helped, which lane opened, why the pass worked.',
      verdict: brand === 'antitiresias' ? 'GENERATIONAL COURT VISION.' : null,
      engagementPrimary: theme.copy.engagementPrimary,
      engagementSecondary: theme.copy.engagementSecondary,
    },
    player: { name: 'PLAYER NAME', teamAbbr: 'TBD', teamName: null, statLine: null, gameLabel: null },
  });
}

/** Re-run auto framing when options move (if the spec is in auto mode). */
export function withAutoFraming(spec: VideoSpec): VideoSpec {
  if (spec.framing.mode !== 'auto') return spec;
  const pts = [...(spec.handler ? [spec.handler] : []), ...spec.options];
  return { ...spec, framing: { mode: 'auto', keyframes: [autoFraming(spec.source, pts, { t: spec.freezeSec })] } };
}

export function coverFromVideoSpec(spec: VideoSpec, statValue: number | null): CoverSpec {
  const theme = getTheme(spec.brand);
  return CoverSpecSchema.parse({
    brand: spec.brand,
    contentId: spec.contentId,
    seriesTitle: theme.seriesTitle,
    playerName: spec.player.name,
    teamAbbr: spec.player.teamAbbr,
    teamName: spec.player.teamName,
    statValue,
    statLabel: spec.brand === 'tiresias' ? 'ASSISTS LAST NIGHT' : 'TURNOVERS LAST NIGHT',
    headline: spec.brand === 'tiresias' ? 'CAN YOU SEE THE PASS?' : 'SEE ABSOLUTELY NOTHING',
    gameLabel: spec.player.gameLabel,
    headshot: null,
    // Featured player = the ball handler at the decision frame (feet point → frame the body above it).
    backdrop: {
      src: spec.source.src,
      timeSec: spec.freezeSec,
      sourceWidth: spec.source.width,
      sourceHeight: spec.source.height,
      focusX: spec.handler?.x ?? 0.5,
      focusY: Math.max(0, (spec.handler?.y ?? 0.55) - 0.09),
      // Cap upscaling at ~1.6x the source pixels (the cover block is ~700 px tall), so 720p clips stay sharp.
      zoom: Math.min(3, Math.max(1, Math.round(((1.6 * spec.source.height) / 700) * 100) / 100)),
    },
    kicker: spec.brand === 'tiresias' ? 'assists:' : 'turnovers:',
    statLine: null,
    statSub: null,
    blockColor: teamBlockColor(spec.player.teamAbbr),
  });
}
