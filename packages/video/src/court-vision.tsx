import {
  CANVAS,
  computeTimeline,
  framingAt,
  getTheme,
  layoutOptions,
  PANEL,
  projectPoint,
  resolveFraming,
  SAFE,
  sourceTimeAt,
  trackAt,
  type BrandTheme,
  type OptionLayout,
  type SceneWindow,
  type Timeline,
  type VideoSpec,
} from '@tiresias/core';
import React, { useMemo } from 'react';
import { AbsoluteFill, Audio, Easing, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { EyeGlyph, HazardStripes, Wordmark } from './brand-mark';
import { Footage } from './footage';
import { FitText, useFontsReady } from './text';

export type CourtVisionProps = { spec: VideoSpec };

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

function useScene(timeline: Timeline) {
  const frame = useCurrentFrame();
  const byId = Object.fromEntries(timeline.scenes.map((s) => [s.id, s])) as Record<SceneWindow['id'], SceneWindow>;
  const current = timeline.scenes.find((s) => frame >= s.from && frame < s.from + s.durationInFrames) ?? timeline.scenes[timeline.scenes.length - 1];
  return { frame, byId, current, local: frame - current.from };
}

export const CourtVision: React.FC<CourtVisionProps> = ({ spec }) => {
  const ready = useFontsReady();
  const theme = getTheme(spec.brand);
  const timeline = useMemo(() => computeTimeline(spec), [spec]);
  // Frame 0 is a real, readable frame (platforms often use it as the thumbnail): no fade-in.
  const { frame, byId } = useScene(timeline);
  const { fps } = useVideoConfig();
  const anti = spec.brand === 'antitiresias';

  const layout = useMemo(() => layoutOptions(spec), [spec]);
  const handlerPt = useMemo(() => {
    if (!spec.handler) return null;
    return projectPoint(spec.source, resolveFraming(spec.source, framingAt(spec.framing.keyframes, spec.freezeSec)), spec.handler);
  }, [spec]);

  if (!ready) return <AbsoluteFill style={{ backgroundColor: theme.colors.bg }} />;

  const d = byId.decision;
  const c = byId.countdown;
  const r = byId.reveal;
  const e = byId.explanation;
  const o = byId.outro;

  // Slow push-in during the freeze makes the still feel alive.
  const holdZoom = interpolate(frame, [d.from, c.from + c.durationInFrames], [1, 1.045], { ...clamp, easing: Easing.inOut(Easing.sin) });
  const extraZoom = frame >= d.from && frame < r.from + Math.round(spec.timing.revealHold * fps) ? holdZoom : 1;

  // AntiTiresias: shake on the reveal and on the verdict stamp.
  const verdictAt = r.from + Math.round(Math.min(r.durationInFrames - 20, spec.timing.revealHold * fps + 1.1 * fps));
  const shake = anti ? shakeOffset(frame, [r.from, verdictAt], 10) : { x: 0, y: 0 };

  const outroDim = interpolate(frame, [o.from, o.from + 12], [0, 0.72], clamp);
  const outroBlur = interpolate(frame, [o.from, o.from + 12], [0, 10], clamp);

  const markersVisible = frame >= d.from && frame < r.from + Math.round(spec.timing.revealHold * fps) + 12;

  return (
    <AbsoluteFill style={{ backgroundColor: theme.colors.bg, overflow: 'hidden' }}>
      <Backdrop theme={theme} anti={anti} />
      <AbsoluteFill style={{ transform: `translate(${shake.x}px, ${shake.y}px)` }}>
        <Footage spec={spec} timeline={timeline} extraZoom={extraZoom} dim={outroDim} blur={outroBlur}>
          {markersVisible ? (
            <OptionOverlay spec={spec} theme={theme} items={layout.items} handler={handlerPt} timeline={timeline} />
          ) : null}
          {spec.receiverTrack.length > 0 && frame >= r.from + Math.round(spec.timing.revealHold * fps) && frame < o.from ? (
            <ReceiverHighlight spec={spec} theme={theme} timeline={timeline} />
          ) : null}
        </Footage>
        <PanelFrame theme={theme} anti={anti} frame={frame} />
        <FreezeFlash at={d.from} theme={theme} />
        {frame >= e.from && frame < o.from ? <ReplayTag theme={theme} frame={frame - e.from} rate={spec.timing.replayRate} /> : null}
        {anti && frame >= verdictAt && frame < o.from ? <VerdictStamp text={spec.text.verdict ?? 'GENERATIONAL COURT VISION.'} theme={theme} local={frame - verdictAt} /> : null}
      </AbsoluteFill>

      <Header spec={spec} theme={theme} />

      {/* Top title region */}
      <Sequence from={byId.hook.from} durationInFrames={byId.hook.durationInFrames} layout="none">
        <TopTitle theme={theme} anti={anti} text={spec.text.hook} immediate />
      </Sequence>
      <Sequence from={d.from} durationInFrames={d.durationInFrames + c.durationInFrames} layout="none">
        <TopTitle theme={theme} anti={anti} text={spec.text.decisionPrompt} accent />
      </Sequence>
      <Sequence from={r.from} durationInFrames={r.durationInFrames} layout="none">
        <RevealTitle spec={spec} theme={theme} anti={anti} />
      </Sequence>
      <Sequence from={e.from} durationInFrames={e.durationInFrames} layout="none">
        <AssessmentRow spec={spec} theme={theme} anti={anti} />
      </Sequence>

      {/* Bottom region */}
      <Sequence from={byId.hook.from} durationInFrames={byId.hook.durationInFrames} layout="none">
        <PlayerCard spec={spec} theme={theme} anti={anti} />
      </Sequence>
      <Sequence from={d.from} durationInFrames={d.durationInFrames + c.durationInFrames + r.durationInFrames} layout="none">
        <Legend spec={spec} theme={theme} anti={anti} revealAt={r.from - d.from} />
      </Sequence>
      <Sequence from={c.from} durationInFrames={c.durationInFrames} layout="none">
        <Countdown theme={theme} anti={anti} seconds={spec.timing.countdown} />
      </Sequence>
      <Sequence from={e.from} durationInFrames={e.durationInFrames} layout="none">
        <Explanation spec={spec} theme={theme} anti={anti} />
      </Sequence>
      <Sequence from={o.from} durationInFrames={o.durationInFrames} layout="none">
        <Outro spec={spec} theme={theme} anti={anti} />
      </Sequence>

      <SoundDesign spec={spec} timeline={timeline} verdictAt={verdictAt} />
    </AbsoluteFill>
  );
};

function shakeOffset(frame: number, starts: number[], amp: number) {
  let x = 0;
  let y = 0;
  for (const s of starts) {
    const k = frame - s;
    if (k >= 0 && k < 10) {
      const a = amp * (1 - k / 10);
      x += Math.sin(k * 2.7 + s) * a;
      y += Math.cos(k * 3.3 + s) * a * 0.6;
    }
  }
  return { x, y };
}

const Backdrop: React.FC<{ theme: BrandTheme; anti: boolean }> = ({ theme, anti }) => (
  <AbsoluteFill
    style={{
      background: anti
        ? `radial-gradient(120% 60% at 50% 0%, #2A1606 0%, ${theme.colors.bg} 55%), ${theme.colors.bg}`
        : `radial-gradient(110% 55% at 50% 10%, #0E1A22 0%, ${theme.colors.bg} 60%), ${theme.colors.bg}`,
    }}
  />
);

const PanelFrame: React.FC<{ theme: BrandTheme; anti: boolean; frame: number }> = ({ theme, anti, frame }) => {
  if (anti) {
    return (
      <>
        <div style={{ position: 'absolute', left: 0, top: PANEL.y - 16, width: CANVAS.width, height: 16 }}>
          <HazardStripes width={CANVAS.width} height={16} offset={frame * 2} />
        </div>
        <div style={{ position: 'absolute', left: 0, top: PANEL.y + PANEL.height, width: CANVAS.width, height: 16 }}>
          <HazardStripes width={CANVAS.width} height={16} offset={-frame * 2} />
        </div>
      </>
    );
  }
  return (
    <>
      <div style={{ position: 'absolute', left: 0, top: PANEL.y, width: CANVAS.width, height: 1, backgroundColor: theme.colors.hairline }} />
      <div style={{ position: 'absolute', left: 0, top: PANEL.y + PANEL.height - 1, width: CANVAS.width, height: 1, backgroundColor: theme.colors.hairline }} />
      {/* soft fade so the footage sits inside the page instead of on it */}
      <div style={{ position: 'absolute', left: 0, top: PANEL.y, width: CANVAS.width, height: 90, background: `linear-gradient(${theme.colors.bg}99, transparent)` }} />
      <div style={{ position: 'absolute', left: 0, top: PANEL.y + PANEL.height - 120, width: CANVAS.width, height: 120, background: `linear-gradient(transparent, ${theme.colors.bg}CC)` }} />
    </>
  );
};

const FreezeFlash: React.FC<{ at: number; theme: BrandTheme }> = ({ at, theme }) => {
  const frame = useCurrentFrame();
  const k = frame - at;
  if (k < 0 || k > 14) return null;
  const flash = interpolate(k, [0, 2, 10], [0, 0.32, 0], clamp);
  const scanY = interpolate(k, [0, 12], [PANEL.y, PANEL.y + PANEL.height], { ...clamp, easing: Easing.out(Easing.cubic) });
  return (
    <>
      <div style={{ position: 'absolute', left: 0, top: PANEL.y, width: CANVAS.width, height: PANEL.height, backgroundColor: '#fff', opacity: flash }} />
      <div style={{ position: 'absolute', left: 0, top: scanY, width: CANVAS.width, height: 3, backgroundColor: theme.colors.accent, boxShadow: `0 0 24px ${theme.colors.accent}`, opacity: 1 - k / 14 }} />
    </>
  );
};

const Header: React.FC<{ spec: VideoSpec; theme: BrandTheme }> = ({ spec, theme }) => (
  <div style={{ position: 'absolute', left: SAFE.left, top: SAFE.top, width: SAFE.right - SAFE.left, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <EyeGlyph brand={spec.brand} size={44} strokeWidth={9} />
      <Wordmark brand={spec.brand} size={spec.brand === 'tiresias' ? 22 : 30} />
    </div>
    <div style={{ fontFamily: theme.fonts.mono, fontWeight: 700, fontSize: 20, letterSpacing: '0.12em', color: theme.colors.inkMuted }}>
      {theme.seriesTitle}
    </div>
  </div>
);

/** Title band: 200 → 312 px (two lines max), clear of the panel edge at 330 / hazard stripe at 314. */
const TITLE_TOP = 200;
const TITLE_W = SAFE.right - SAFE.left;

function useEnter(delay = 0, damping = 18) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping, mass: 0.6, stiffness: 170 } });
}

const TopTitle: React.FC<{ theme: BrandTheme; anti: boolean; text: string; accent?: boolean; immediate?: boolean }> = ({ theme, anti, text, accent, immediate }) => {
  const enter = useEnter();
  // The hook is on screen from frame 0 (it doubles as the default thumbnail); it only settles.
  const k = immediate ? 1 : enter;
  const settle = immediate ? (1 - enter) * 0.04 : 0;
  return (
    <div
      style={{
        position: 'absolute',
        left: SAFE.left,
        top: TITLE_TOP,
        opacity: k,
        transform: `translateY(${(1 - k) * 24}px) scale(${1 + settle}) rotate(${anti ? -1.5 : 0}deg)`,
        transformOrigin: 'left center',
      }}
    >
      <FitText
        text={text}
        width={TITLE_W}
        maxLines={2}
        maxFontSize={54}
        fontFamily={theme.fonts.display}
        fontWeight={theme.fonts.displayWeight}
        letterSpacingEm={anti ? 0.01 : -0.02}
        lineHeight={anti ? 1.02 : 1.02}
        color={accent && !anti ? theme.colors.accent : theme.colors.ink}
        style={anti ? { textShadow: `4px 4px 0 ${theme.colors.danger}` } : undefined}
      />
    </div>
  );
};

const RevealTitle: React.FC<{ spec: VideoSpec; theme: BrandTheme; anti: boolean }> = ({ spec, theme, anti }) => {
  const k = useEnter(0, 14);
  const actual = spec.options.find((o) => o.label === spec.assessment.actual)!;
  const color = theme.optionColors[actual.label];
  return (
    <div style={{ position: 'absolute', left: SAFE.left, top: TITLE_TOP - 4, display: 'flex', alignItems: 'center', gap: 22, opacity: k, transform: `scale(${0.9 + 0.1 * k})`, transformOrigin: 'left center' }}>
      <div style={{ fontFamily: theme.fonts.display, fontWeight: theme.fonts.displayWeight, fontSize: anti ? 50 : 46, color: theme.colors.ink, letterSpacing: anti ? '0.01em' : '-0.01em', lineHeight: 1 }}>
        {theme.copy.revealPrefix}:
      </div>
      <Chip label={actual.label} color={color} theme={theme} anti={anti} size={88} />
      <div style={{ fontFamily: theme.fonts.body, fontWeight: 800, fontSize: 30, color, maxWidth: 300, lineHeight: 1.05, textTransform: 'uppercase' }}>{actual.description}</div>
    </div>
  );
};

const AssessmentRow: React.FC<{ spec: VideoSpec; theme: BrandTheme; anti: boolean }> = ({ spec, theme, anti }) => {
  const k = useEnter();
  const a = spec.assessment;
  const cell = (label: string, value: string, color: string) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontFamily: theme.fonts.mono, fontWeight: 700, fontSize: 20, letterSpacing: '0.14em', color: theme.colors.inkMuted }}>{label}</div>
      <div style={{ fontFamily: theme.fonts.display, fontWeight: theme.fonts.displayWeight, fontSize: anti ? 48 : 44, color, lineHeight: 1 }}>{value}</div>
    </div>
  );
  const quality = { good: 'DEFENSIBLE READ', reasonable: 'DEFENSIBLE READ', poor: 'BAD READ', unclear: 'UNCLEAR' }[a.decisionQuality];
  return (
    <div style={{ position: 'absolute', left: SAFE.left, top: TITLE_TOP, display: 'flex', gap: 64, opacity: k }}>
      {cell('ACTUAL', a.actual, theme.optionColors[a.actual])}
      {anti
        ? cell('FILM SAYS', quality, a.decisionQuality === 'poor' ? theme.colors.danger : theme.colors.accent)
        : cell('BEST-SUPPORTED', a.bestSupported === 'unknown' ? 'UNCLEAR' : a.bestSupported, a.bestSupported === 'unknown' ? theme.colors.inkMuted : theme.optionColors[a.bestSupported])}
    </div>
  );
};

export const Chip: React.FC<{ label: string; color: string; theme: BrandTheme; anti: boolean; size: number; dim?: number; style?: React.CSSProperties }> = ({
  label,
  color,
  theme,
  anti,
  size,
  dim = 0,
  style,
}) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: anti ? 6 : size * 0.26,
      backgroundColor: color,
      border: anti ? `${Math.max(3, size * 0.07)}px solid #000` : 'none',
      boxShadow: anti ? `${size * 0.07}px ${size * 0.07}px 0 #000` : `0 ${size * 0.08}px ${size * 0.3}px rgba(0,0,0,0.45)`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: theme.fonts.display,
      fontWeight: theme.fonts.displayWeight,
      fontSize: size * (anti ? 0.66 : 0.58),
      color: '#06080B',
      lineHeight: 1,
      opacity: 1 - dim,
      flexShrink: 0,
      ...style,
    }}
  >
    {label}
  </div>
);

const OptionOverlay: React.FC<{ spec: VideoSpec; theme: BrandTheme; items: OptionLayout[]; handler: { x: number; y: number } | null; timeline: Timeline }> = ({
  spec,
  theme,
  items,
  handler,
  timeline,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const anti = spec.brand === 'antitiresias';
  const d = timeline.scenes.find((s) => s.id === 'decision')!;
  const r = timeline.scenes.find((s) => s.id === 'reveal')!;
  const holdEnd = r.from + Math.round(spec.timing.revealHold * fps);
  const fadeOutAll = interpolate(frame, [holdEnd, holdEnd + 10], [1, 0], clamp);
  const revealK = interpolate(frame, [r.from, r.from + 12], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });

  return (
    <AbsoluteFill style={{ opacity: fadeOutAll }}>
      <svg width={CANVAS.width} height={CANVAS.height} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {items.map((it, i) => {
          const appear = spring({ frame: frame - d.from - 6 - i * 5, fps, config: { damping: 16, stiffness: 180, mass: 0.6 } });
          const isActual = it.label === spec.assessment.actual;
          const color = theme.optionColors[it.label];
          const dimmed = isActual ? 0 : revealK * 0.78;
          // sightline from ball handler to the target's chest
          const tx = it.anchor.x;
          const ty = it.anchor.y - 70;
          const len = handler ? Math.hypot(tx - handler.x, ty - handler.y) : 0;
          const draw = interpolate(frame, [d.from + 8 + i * 5, d.from + 26 + i * 5], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
          const revealDraw = isActual ? revealK : 0;
          return (
            <g key={it.label} opacity={appear * (1 - dimmed)}>
              {handler ? (
                <line
                  x1={handler.x}
                  y1={handler.y - 60}
                  x2={tx}
                  y2={ty}
                  stroke={color}
                  strokeWidth={isActual ? 3 + 4 * revealDraw : 3}
                  strokeDasharray={isActual && revealDraw > 0.5 ? undefined : `${anti ? 4 : 2} ${anti ? 14 : 12}`}
                  strokeDashoffset={len * (1 - draw)}
                  strokeLinecap="round"
                  opacity={0.55 + 0.45 * revealDraw}
                  filter={isActual && revealDraw > 0 ? 'url(#glow)' : undefined}
                />
              ) : null}
              <ellipse
                cx={it.anchor.x}
                cy={it.anchor.y}
                rx={56 * appear * (1 + (isActual ? 0.25 * revealDraw * (1 + Math.sin(frame / 3) * 0.2) : 0))}
                ry={19 * appear}
                fill={`${color}33`}
                stroke={color}
                strokeWidth={anti ? 6 : 4}
                filter={isActual && revealDraw > 0 ? 'url(#glow)' : undefined}
              />
              <line x1={it.anchor.x} y1={it.anchor.y - 10} x2={it.chip.x} y2={it.chip.y + 46} stroke={color} strokeWidth={2} opacity={0.8} />
            </g>
          );
        })}
        {handler ? <HandlerMarker x={handler.x} y={handler.y} theme={theme} appear={spring({ frame: frame - d.from, fps, config: { damping: 18 } })} /> : null}
      </svg>
      {items.map((it, i) => {
        const appear = spring({ frame: frame - d.from - 6 - i * 5, fps, config: { damping: 13, stiffness: 200, mass: 0.6 } });
        const isActual = it.label === spec.assessment.actual;
        const dimmed = isActual ? 0 : revealK * 0.78;
        const pop = isActual ? 1 + 0.18 * revealK : 1;
        return (
          <div
            key={it.label}
            style={{
              position: 'absolute',
              left: it.chip.x - 46,
              top: it.chip.y - 46,
              transform: `scale(${appear * pop}) rotate(${anti ? (i % 2 ? 4 : -4) : 0}deg)`,
            }}
          >
            <Chip label={it.label} color={theme.optionColors[it.label]} theme={theme} anti={anti} size={92} dim={dimmed} />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/** Keeps the actual recipient highlighted while play resumes (needs a receiver track). */
const ReceiverHighlight: React.FC<{ spec: VideoSpec; theme: BrandTheme; timeline: Timeline }> = ({ spec, theme, timeline }) => {
  const frame = useCurrentFrame();
  const t = sourceTimeAt(timeline, frame);
  const p = trackAt(spec.receiverTrack, t);
  if (!p) return null;
  const fr = resolveFraming(spec.source, framingAt(spec.framing.keyframes, t));
  const a = projectPoint(spec.source, fr, p);
  const color = theme.optionColors[spec.assessment.actual];
  const pulse = 1 + Math.sin(frame / 4) * 0.08;
  const anti = spec.brand === 'antitiresias';
  return (
    <AbsoluteFill>
      <svg width={CANVAS.width} height={CANVAS.height} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        <ellipse cx={a.x} cy={a.y} rx={60 * pulse} ry={20 * pulse} fill={`${color}40`} stroke={color} strokeWidth={anti ? 7 : 5} />
        <line x1={a.x} y1={a.y - 12} x2={a.x} y2={a.y - 96} stroke={color} strokeWidth={3} />
      </svg>
      <div style={{ position: 'absolute', left: a.x - 30, top: a.y - 162 }}>
        <Chip label={spec.assessment.actual} color={color} theme={theme} anti={anti} size={60} />
      </div>
    </AbsoluteFill>
  );
};

const HandlerMarker: React.FC<{ x: number; y: number; theme: BrandTheme; appear: number }> = ({ x, y, theme, appear }) => (
  <g opacity={appear}>
    <ellipse cx={x} cy={y} rx={46 * appear} ry={15 * appear} fill="none" stroke={theme.colors.ink} strokeWidth={3} strokeDasharray="6 6" />
    <rect x={x - 38} y={y + 18} width={76} height={30} rx={6} fill={theme.colors.ink} />
    <text x={x} y={y + 40} textAnchor="middle" fontFamily={theme.fonts.mono} fontWeight={800} fontSize={18} fill={theme.colors.bg} letterSpacing="0.08em">
      BALL
    </text>
  </g>
);

const BOTTOM_TOP = PANEL.y + PANEL.height + 40;

const PlayerCard: React.FC<{ spec: VideoSpec; theme: BrandTheme; anti: boolean }> = ({ spec, theme, anti }) => {
  // Visible on frame 0 like the hook; a short slide gives it life without hiding it.
  const enter = useEnter();
  const k = 1;
  const slide = (1 - enter) * 0.4;
  const p = spec.player;
  const meta = [p.teamAbbr, p.gameLabel].filter(Boolean).join(' · ');
  return (
    <div style={{ position: 'absolute', left: SAFE.left, top: BOTTOM_TOP + 10, opacity: k, transform: `translateY(${slide * 30}px)` }}>
      <div style={{ fontFamily: theme.fonts.mono, fontWeight: 700, fontSize: 22, letterSpacing: '0.14em', color: theme.colors.inkMuted, marginBottom: 12 }}>{meta}</div>
      <FitText
        text={p.name}
        width={TITLE_W}
        maxLines={1}
        maxFontSize={anti ? 92 : 80}
        fontFamily={theme.fonts.display}
        fontWeight={theme.fonts.displayWeight}
        letterSpacingEm={anti ? 0.01 : -0.03}
        color={theme.colors.ink}
      />
      {p.statLine ? (
        <div style={{ marginTop: 14, display: 'inline-block', fontFamily: theme.fonts.mono, fontWeight: 800, fontSize: 30, letterSpacing: '0.06em', color: theme.colors.accentInk, backgroundColor: theme.colors.accent, padding: '8px 14px', borderRadius: anti ? 0 : 8 }}>
          {p.statLine}
        </div>
      ) : null}
    </div>
  );
};

const Legend: React.FC<{ spec: VideoSpec; theme: BrandTheme; anti: boolean; revealAt: number }> = ({ spec, theme, anti, revealAt }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const colW = (TITLE_W - 36) / 2;
  const revealK = interpolate(frame, [revealAt, revealAt + 12], [0, 1], clamp);
  const n = spec.options.length;
  // With 3 options, use a single column so the countdown ring has room on the right.
  const singleCol = n <= 3;
  return (
    <div
      style={{
        position: 'absolute',
        left: SAFE.left,
        top: BOTTOM_TOP + 50,
        width: TITLE_W,
        display: 'grid',
        gridTemplateColumns: singleCol ? '1fr' : `${colW}px ${colW}px`,
        columnGap: 36,
        rowGap: singleCol ? 14 : 22,
      }}
    >
      {spec.options.map((o, i) => {
        const k = spring({ frame: frame - 8 - i * 5, fps, config: { damping: 16, stiffness: 170, mass: 0.6 } });
        const isActual = o.label === spec.assessment.actual;
        const dim = isActual ? 0 : revealK * 0.72;
        return (
          <div key={o.label} style={{ display: 'flex', alignItems: 'center', gap: 18, opacity: k * (1 - dim), transform: `translateX(${(1 - k) * -30}px)` }}>
            <Chip label={o.label} color={theme.optionColors[o.label]} theme={theme} anti={anti} size={singleCol ? 56 : 60} />
            <FitText
              text={o.description}
              width={singleCol ? 560 : colW - 80}
              maxLines={1}
              maxFontSize={singleCol ? 36 : 32}
              minFontSize={20}
              fontFamily={theme.fonts.body}
              fontWeight={800}
              color={isActual && revealK > 0 ? theme.optionColors[o.label] : theme.colors.ink}
            />
          </div>
        );
      })}
    </div>
  );
};

const Countdown: React.FC<{ theme: BrandTheme; anti: boolean; seconds: number }> = ({ theme, anti, seconds }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const idx = Math.min(seconds - 1, Math.floor(frame / fps));
  const n = seconds - idx;
  const within = frame - idx * fps;
  const pop = spring({ frame: within, fps, config: { damping: 11, stiffness: 220, mass: 0.5 } });
  const progress = 1 - frame / (seconds * fps);
  const R = 96;
  const C = 2 * Math.PI * (R - 8);
  const cx = SAFE.right - R;
  const cy = PANEL.y + PANEL.height - 14;
  const enter = spring({ frame, fps, config: { damping: 16 } });
  return (
    <div style={{ position: 'absolute', left: cx - R, top: cy - R, width: R * 2, height: R * 2, transform: `scale(${enter})` }}>
      <svg width={R * 2} height={R * 2} style={{ position: 'absolute', inset: 0 }}>
        <circle cx={R} cy={R} r={R - 2} fill={anti ? theme.colors.accent : theme.colors.bgElevated} stroke={anti ? '#000' : theme.colors.hairline} strokeWidth={anti ? 6 : 2} />
        <circle
          cx={R}
          cy={R}
          r={R - 8}
          fill="none"
          stroke={anti ? theme.colors.danger : theme.colors.accent}
          strokeWidth={8}
          strokeDasharray={C}
          strokeDashoffset={C * (1 - progress)}
          strokeLinecap="round"
          transform={`rotate(-90 ${R} ${R})`}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: theme.fonts.display,
          fontWeight: theme.fonts.displayWeight,
          fontSize: 108,
          color: anti ? '#000' : theme.colors.ink,
          transform: `scale(${1.5 - 0.5 * pop})`,
          opacity: pop,
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1,
        }}
      >
        {n}
      </div>
    </div>
  );
};

const Explanation: React.FC<{ spec: VideoSpec; theme: BrandTheme; anti: boolean }> = ({ spec, theme, anti }) => {
  const k = useEnter(4);
  return (
    <div style={{ position: 'absolute', left: SAFE.left, top: BOTTOM_TOP - 4, width: TITLE_W, opacity: k, transform: `translateY(${(1 - k) * 24}px)` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ width: 28, height: 4, backgroundColor: anti ? theme.colors.danger : theme.colors.accent }} />
        <div style={{ fontFamily: theme.fonts.mono, fontWeight: 800, fontSize: 22, letterSpacing: '0.16em', color: anti ? theme.colors.danger : theme.colors.accent }}>{theme.copy.explanationEyebrow}</div>
      </div>
      <FitText
        text={spec.text.explanation}
        width={TITLE_W}
        maxLines={4}
        maxFontSize={44}
        minFontSize={28}
        fontFamily={theme.fonts.body}
        fontWeight={700}
        lineHeight={1.18}
        letterSpacingEm={-0.01}
        uppercase={false}
        color={theme.colors.ink}
      />
    </div>
  );
};

const ReplayTag: React.FC<{ theme: BrandTheme; frame: number; rate: number }> = ({ theme, frame, rate }) => (
  <div
    style={{
      position: 'absolute',
      left: SAFE.left,
      top: PANEL.y + 28,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '8px 14px',
      backgroundColor: 'rgba(0,0,0,0.55)',
      borderRadius: 8,
      fontFamily: theme.fonts.mono,
      fontWeight: 800,
      fontSize: 20,
      letterSpacing: '0.12em',
      color: theme.colors.ink,
      opacity: interpolate(frame, [0, 8], [0, 1], clamp),
    }}
  >
    <div style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: theme.colors.danger, opacity: Math.floor(frame / 12) % 2 ? 0.3 : 1 }} />
    REPLAY {rate}×
  </div>
);

const VerdictStamp: React.FC<{ text: string; theme: BrandTheme; local: number }> = ({ text, theme, local }) => {
  const { fps } = useVideoConfig();
  const k = spring({ frame: local, fps, config: { damping: 9, stiffness: 260, mass: 0.7 } });
  return (
    <div
      style={{
        position: 'absolute',
        left: 60,
        top: PANEL.y + PANEL.height / 2 - 110,
        width: 960,
        display: 'flex',
        justifyContent: 'center',
        transform: `scale(${2.2 - 1.2 * k}) rotate(-7deg)`,
        opacity: Math.min(1, k * 1.4),
      }}
    >
      <div style={{ border: `10px solid ${theme.colors.danger}`, padding: '18px 26px', backgroundColor: 'rgba(11,7,4,0.82)' }}>
        <FitText text={text} width={820} maxLines={2} maxFontSize={92} fontFamily="Anton" fontWeight={400} letterSpacingEm={0.02} lineHeight={1} color={theme.colors.accent} align="center" />
      </div>
    </div>
  );
};

const Outro: React.FC<{ spec: VideoSpec; theme: BrandTheme; anti: boolean }> = ({ spec, theme, anti }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const k1 = spring({ frame: frame - 2, fps, config: { damping: 15, stiffness: 160 } });
  const k2 = spring({ frame: frame - 10, fps, config: { damping: 15, stiffness: 160 } });
  const k3 = spring({ frame: frame - 22, fps, config: { damping: 20 } });
  return (
    <>
      <div style={{ position: 'absolute', left: SAFE.left, top: PANEL.y + 250, width: TITLE_W, opacity: k1, transform: `translateY(${(1 - k1) * 40}px) rotate(${anti ? -2 : 0}deg)` }}>
        <FitText
          text={spec.text.engagementPrimary}
          width={TITLE_W}
          maxLines={2}
          maxFontSize={anti ? 120 : 104}
          fontFamily={theme.fonts.display}
          fontWeight={theme.fonts.displayWeight}
          letterSpacingEm={anti ? 0.01 : -0.03}
          lineHeight={0.98}
          color={theme.colors.ink}
          align="left"
        />
      </div>
      <div style={{ position: 'absolute', left: SAFE.left, top: PANEL.y + 520, opacity: k2, transform: `translateY(${(1 - k2) * 30}px)` }}>
        <div style={{ display: 'inline-block', fontFamily: theme.fonts.display, fontWeight: theme.fonts.displayWeight, fontSize: anti ? 56 : 50, color: theme.colors.accentInk, backgroundColor: theme.colors.accent, padding: '10px 20px', borderRadius: anti ? 0 : 12, letterSpacing: anti ? '0.02em' : '-0.01em' }}>
          {spec.text.engagementSecondary.toUpperCase()}
        </div>
      </div>
      <div style={{ position: 'absolute', left: SAFE.left, top: BOTTOM_TOP + 70, display: 'flex', alignItems: 'center', gap: 22, opacity: k3 }}>
        <EyeGlyph brand={spec.brand} size={92} strokeWidth={8} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Wordmark brand={spec.brand} size={anti ? 44 : 34} />
          <div style={{ fontFamily: theme.fonts.mono, fontWeight: 700, fontSize: 20, letterSpacing: '0.12em', color: theme.colors.inkMuted }}>{theme.tagline}</div>
        </div>
      </div>
    </>
  );
};

const SoundDesign: React.FC<{ spec: VideoSpec; timeline: Timeline; verdictAt: number }> = ({ spec, timeline, verdictAt }) => {
  const { fps } = useVideoConfig();
  if (!spec.audio.sfx && !spec.audio.music && !spec.audio.voiceover) return null;
  const s = Object.fromEntries(timeline.scenes.map((x) => [x.id, x])) as Record<SceneWindow['id'], SceneWindow>;
  const v = spec.audio.sfxVolume;
  const anti = spec.brand === 'antitiresias';
  const cue = (name: string, from: number, vol = 1, dur = 30) => (
    <Sequence key={`${name}-${from}`} from={from} durationInFrames={dur} layout="none">
      <Audio src={staticFile(`sfx/${name}.wav`)} volume={v * vol} />
    </Sequence>
  );
  const vo = spec.audio.voiceover;
  const voFrom = vo ? Math.round(vo.offsetSec * fps) : 0;
  const voTo = vo ? voFrom + Math.round(vo.durationSec * fps) : 0;
  return (
    <>
      {spec.audio.sfx ? (
        <>
          {cue('whoosh', 0, 0.6, 20)}
          {cue('freeze', s.decision.from, 0.9, 20)}
          {Array.from({ length: spec.timing.countdown }, (_, i) =>
            cue(i === spec.timing.countdown - 1 ? 'tick-final' : 'tick', s.countdown.from + i * fps, 1, 12),
          )}
          {cue(anti ? 'buzzer' : 'reveal', s.reveal.from, 0.9, 40)}
          {anti ? cue('stamp', verdictAt, 1, 20) : null}
          {anti ? cue('boing', s.explanation.from, 0.5, 25) : cue('whoosh', s.explanation.from, 0.4, 20)}
          {cue('outro', s.outro.from, 0.6, 60)}
        </>
      ) : null}
      {spec.audio.music ? (
        <Audio
          src={spec.audio.music.src}
          volume={(f) => {
            const base = spec.audio.music!.volume;
            if (!vo) return base;
            const duck = interpolate(f, [voFrom - 8, voFrom, voTo, voTo + 8], [1, 0.3, 0.3, 1], clamp);
            return base * duck;
          }}
        />
      ) : null}
      {vo ? (
        <Sequence from={voFrom} layout="none">
          <Audio src={vo.src} />
        </Sequence>
      ) : null}
    </>
  );
};
