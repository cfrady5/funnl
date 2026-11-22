import { z } from 'zod';
import { BRAND_IDS, OPTION_LABELS } from './brand';

/** Normalised (0..1) point in SOURCE video coordinates. */
export const PointSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});
export type Point = z.infer<typeof PointSchema>;

export const OptionLabelSchema = z.enum(OPTION_LABELS);

export const PassingOptionSchema = z.object({
  label: OptionLabelSchema,
  /** Short on-screen description, e.g. "Corner three". */
  description: z.string().min(1).max(48),
  /** Target player's floor position at the freeze frame (normalised source coords). */
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  playerName: z.string().max(40).nullable().default(null),
  /** Where the position came from. Automated positions are never treated as fact. */
  origin: z.enum(['manual', 'auto']).default('manual'),
  confidence: z.number().min(0).max(1).default(1),
  /** Manual nudge of the label chip relative to its automatic position (canvas px). */
  labelDx: z.number().min(-400).max(400).default(0),
  labelDy: z.number().min(-400).max(400).default(0),
  /** Optional reasoning recorded for this option (not shown on screen). */
  reasoning: z.string().max(400).nullable().default(null),
});
export type PassingOption = z.infer<typeof PassingOptionSchema>;

/** Camera framing keyframe: which part of the source frame the vertical panel shows. */
export const FramingKeyframeSchema = z.object({
  /** Source time in seconds. */
  t: z.number().min(0),
  /** 1 = full source width visible; larger = tighter. */
  zoom: z.number().min(1).max(3),
  focusX: z.number().min(0).max(1),
  focusY: z.number().min(0).max(1),
});
export type FramingKeyframe = z.infer<typeof FramingKeyframeSchema>;

export const TimingSchema = z.object({
  hook: z.number().min(1.5).max(6).default(3),
  decision: z.number().min(2).max(8).default(4),
  countdown: z.number().int().min(2).max(5).default(3),
  reveal: z.number().min(2).max(8).default(4),
  explanation: z.number().min(3).max(10).default(5),
  outro: z.number().min(2).max(5).default(3),
  /** Within reveal: how long to stay frozen while the actual read is highlighted. */
  revealHold: z.number().min(0).max(2).default(0.7),
  /** Explanation replay: seconds before the freeze to start the slow-motion replay. */
  replayLeadIn: z.number().min(0).max(4).default(1.2),
  replayRate: z.number().min(0.25).max(1).default(0.5),
});
export type Timing = z.infer<typeof TimingSchema>;

export const AssessmentSchema = z.object({
  /** The pass that actually happened (from verified footage / play-by-play). */
  actual: OptionLabelSchema,
  /** Best-supported option per the evidence, or 'unknown' when ambiguous. */
  bestSupported: z.union([OptionLabelSchema, z.literal('unknown')]).default('unknown'),
  /** For AntiTiresias: was this a genuinely poor read (vs. a good read with an unlucky outcome)? */
  decisionQuality: z.enum(['good', 'reasonable', 'poor', 'unclear']).default('unclear'),
});
export type Assessment = z.infer<typeof AssessmentSchema>;

export const VideoSpecSchema = z.object({
  version: z.literal(1).default(1),
  brand: z.enum(BRAND_IDS),
  /** Human-facing content identifier, e.g. TRS-20261121-01. */
  contentId: z.string().min(1).max(40),
  source: z.object({
    /** URL the renderer / player can fetch. Resolved at runtime from a media key. */
    src: z.string().min(1),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    fps: z.number().positive(),
    durationSec: z.number().positive(),
    attribution: z.string().max(120).nullable().default(null),
  }),
  /** Usable window of the source, seconds. */
  clip: z.object({ startSec: z.number().min(0), endSec: z.number().positive() }),
  /** Source time of the decision freeze-frame, seconds. */
  freezeSec: z.number().min(0),
  /** Ball handler position at the freeze (for sightlines). Null hides sightlines. */
  handler: PointSchema.nullable().default(null),
  options: z.array(PassingOptionSchema).min(2).max(4),
  /**
   * Optional positions of the actual recipient after the freeze (source
   * seconds, normalised coords) — from CV tracking or manual keyframes. When
   * present the reveal keeps a highlight on the receiver as play resumes.
   */
  receiverTrack: z.array(z.object({ t: z.number().min(0), x: z.number().min(0).max(1), y: z.number().min(0).max(1) })).max(120).default([]),
  assessment: AssessmentSchema,
  framing: z.object({
    mode: z.enum(['auto', 'manual']).default('auto'),
    keyframes: z.array(FramingKeyframeSchema).min(1),
  }),
  text: z.object({
    hook: z.string().min(1).max(64),
    decisionPrompt: z.string().min(1).max(40),
    explanation: z.string().min(1).max(200),
    /** AntiTiresias stamp after the reveal, e.g. "GENERATIONAL COURT VISION." */
    verdict: z.string().max(40).nullable().default(null),
    engagementPrimary: z.string().min(1).max(40),
    engagementSecondary: z.string().min(1).max(40),
  }),
  player: z.object({
    name: z.string().min(1).max(40),
    teamAbbr: z.string().min(2).max(4),
    teamName: z.string().max(40).nullable().default(null),
    /** e.g. "13 AST · 24 PTS" — must come from verified stats. */
    statLine: z.string().max(40).nullable().default(null),
    gameLabel: z.string().max(40).nullable().default(null),
  }),
  timing: TimingSchema.default(TimingSchema.parse({})),
  audio: z
    .object({
      sfx: z.boolean().default(true),
      sfxVolume: z.number().min(0).max(1).default(0.8),
      sourceVolume: z.number().min(0).max(1).default(0.0),
      music: z
        .object({ src: z.string(), volume: z.number().min(0).max(1).default(0.25), license: z.string().min(1) })
        .nullable()
        .default(null),
      voiceover: z
        .object({ src: z.string(), offsetSec: z.number().min(0).default(0), durationSec: z.number().positive(), provider: z.string().min(1) })
        .nullable()
        .default(null),
    })
    .default({ sfx: true, sfxVolume: 0.8, sourceVolume: 0, music: null, voiceover: null }),
  fps: z.literal(30).default(30),
});
export type VideoSpec = z.infer<typeof VideoSpecSchema>;
export type VideoSpecInput = z.input<typeof VideoSpecSchema>;

export const CoverSpecSchema = z.object({
  brand: z.enum(BRAND_IDS),
  contentId: z.string().min(1).max(40),
  seriesTitle: z.string().min(1).max(32),
  playerName: z.string().min(1).max(40),
  teamAbbr: z.string().min(2).max(4),
  teamName: z.string().max(40).nullable().default(null),
  /** Verified stat value, e.g. 13. */
  statValue: z.number().int().min(0).max(99).nullable().default(null),
  statLabel: z.string().max(32).default('ASSISTS LAST NIGHT'),
  headline: z.string().min(1).max(40),
  gameLabel: z.string().max(40).nullable().default(null),
  /** Authorised headshot (must pass rights gate). Null => typography-only layout. */
  headshot: z
    .object({
      src: z.string(),
      /** Crop: focal point + scale, so the template stays consistent day to day. */
      focusX: z.number().min(0).max(1).default(0.5),
      focusY: z.number().min(0).max(1).default(0.3),
      scale: z.number().min(0.5).max(3).default(1),
      cutout: z.boolean().default(false),
    })
    .nullable()
    .default(null),
  /**
   * Fallback image when no authorised headshot exists: a still from the
   * rights-cleared source clip, cropped around the featured player.
   */
  backdrop: z
    .object({
      src: z.string(),
      timeSec: z.number().min(0),
      sourceWidth: z.number().int().positive().default(1920),
      sourceHeight: z.number().int().positive().default(1080),
      focusX: z.number().min(0).max(1).default(0.5),
      focusY: z.number().min(0).max(1).default(0.5),
      zoom: z.number().min(1).max(6).default(2.2),
    })
    .nullable()
    .default(null),
  /** Top-left kicker above the stat value, e.g. "assists:". */
  kicker: z.string().max(24).nullable().default(null),
  /** Bottom-right verified stat line, e.g. "24p/6r/13a". */
  statLine: z.string().max(20).nullable().default(null),
  /** Second bottom-right line, e.g. "+21" (plus/minus) — verified data only. */
  statSub: z.string().max(12).nullable().default(null),
  /** Colour block behind the player (team primary). Null → brand default. */
  blockColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().default(null),
});
export type CoverSpec = z.infer<typeof CoverSpecSchema>;
export type CoverSpecInput = z.input<typeof CoverSpecSchema>;
