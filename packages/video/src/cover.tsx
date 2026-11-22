import { getTheme, SAFE, type CoverSpec } from '@tiresias/core';
import React from 'react';
import { AbsoluteFill, Freeze, Img, OffthreadVideo } from 'remotion';
import { EyeGlyph, HazardStripes, Wordmark } from './brand-mark';
import { FitText, useFontsReady } from './text';

export type CoverProps = { cover: CoverSpec };

/**
 * Reusable cover template. Profile grids crop covers to roughly the central
 * 3:4 area (y ≈ 240–1680), so all key information stays inside it.
 */
export const Cover: React.FC<CoverProps> = ({ cover }) => {
  const ready = useFontsReady();
  const theme = getTheme(cover.brand);
  const anti = cover.brand === 'antitiresias';
  if (!ready) return <AbsoluteFill style={{ backgroundColor: theme.colors.bg }} />;
  const W = SAFE.right - SAFE.left;
  const hasHeadshot = Boolean(cover.headshot);

  return (
    <AbsoluteFill style={{ backgroundColor: theme.colors.bg, overflow: 'hidden' }}>
      {/* Backdrop: a still from the rights-cleared clip, duotoned so type stays dominant. */}
      {cover.backdrop ? (
        <AbsoluteFill style={{ height: 1180 }}>
          <div style={{ position: 'absolute', left: -420, top: 0, width: 1920 * 1.1, height: 1080 * 1.1, filter: 'grayscale(1) contrast(1.15) brightness(0.55)' }}>
            <Freeze frame={Math.round(cover.backdrop.timeSec * 30)}>
              <OffthreadVideo src={cover.backdrop.src} muted style={{ width: '100%', height: '100%' }} />
            </Freeze>
          </div>
          <AbsoluteFill style={{ backgroundColor: anti ? '#FF3B1F' : theme.colors.accent, mixBlendMode: 'color', opacity: anti ? 0.55 : 0.35 }} />
          <AbsoluteFill style={{ background: `linear-gradient(180deg, ${theme.colors.bg}E6 0%, ${theme.colors.bg}55 22%, ${theme.colors.bg}66 55%, ${theme.colors.bg} 96%)` }} />
        </AbsoluteFill>
      ) : (
        <AbsoluteFill style={{ background: `radial-gradient(90% 50% at 70% 30%, ${anti ? '#3A1A06' : '#0F2A2A'} 0%, ${theme.colors.bg} 70%)` }} />
      )}

      {hasHeadshot ? <Headshot cover={cover} /> : <GiantGlyph brand={cover.brand} />}

      {anti ? (
        <>
          <div style={{ position: 'absolute', top: 0, left: 0 }}>
            <HazardStripes width={1080} height={26} />
          </div>
          <div style={{ position: 'absolute', bottom: 0, left: 0 }}>
            <HazardStripes width={1080} height={26} />
          </div>
        </>
      ) : null}

      {/* Header */}
      <div style={{ position: 'absolute', left: SAFE.left, top: 270, display: 'flex', alignItems: 'center', gap: 18 }}>
        <EyeGlyph brand={cover.brand} size={64} strokeWidth={9} />
        <Wordmark brand={cover.brand} size={anti ? 46 : 34} />
      </div>
      <div
        style={{
          position: 'absolute',
          left: SAFE.left,
          top: 350,
          fontFamily: theme.fonts.mono,
          fontWeight: 800,
          fontSize: 26,
          letterSpacing: '0.18em',
          color: anti ? theme.colors.accent : theme.colors.accent,
        }}
      >
        {cover.seriesTitle}
      </div>

      {/* Stat block */}
      {cover.statValue !== null ? (
        <div style={{ position: 'absolute', left: SAFE.left - 8, top: 780, display: 'flex', alignItems: 'flex-end', gap: 20 }}>
          <div
            style={{
              fontFamily: theme.fonts.display,
              fontWeight: anti ? 400 : 900,
              fontSize: anti ? 300 : 280,
              lineHeight: 0.8,
              letterSpacing: '-0.04em',
              color: anti ? theme.colors.danger : theme.colors.accent,
              textShadow: anti ? '8px 8px 0 #000' : undefined,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {cover.statValue}
          </div>
          <div style={{ fontFamily: theme.fonts.mono, fontWeight: 800, fontSize: 30, lineHeight: 1.2, letterSpacing: '0.08em', color: theme.colors.ink, paddingBottom: 12, maxWidth: 300 }}>
            {cover.statLabel}
          </div>
        </div>
      ) : null}

      {/* Player */}
      <div style={{ position: 'absolute', left: SAFE.left, top: 1060, width: W }}>
        <div style={{ fontFamily: theme.fonts.mono, fontWeight: 700, fontSize: 26, letterSpacing: '0.14em', color: theme.colors.inkMuted, marginBottom: 14 }}>
          {[cover.teamName ?? cover.teamAbbr, cover.gameLabel].filter(Boolean).join(' · ').toUpperCase()}
        </div>
        <FitText
          text={cover.playerName}
          width={hasHeadshot ? W : W}
          maxLines={2}
          maxFontSize={anti ? 150 : 132}
          fontFamily={theme.fonts.display}
          fontWeight={anti ? 400 : 900}
          letterSpacingEm={anti ? 0.0 : -0.04}
          lineHeight={0.92}
          color={theme.colors.ink}
        />
      </div>

      {/* Headline band */}
      <div
        style={{
          position: 'absolute',
          left: SAFE.left,
          top: 1450,
          transform: anti ? 'rotate(-3deg)' : undefined,
          transformOrigin: 'left center',
          backgroundColor: theme.colors.accent,
          padding: anti ? '14px 22px' : '16px 24px',
          borderRadius: anti ? 0 : 14,
          border: anti ? '6px solid #000' : 'none',
        }}
      >
        <FitText text={cover.headline} width={W - 48} maxLines={1} maxFontSize={anti ? 72 : 60} fontFamily={theme.fonts.display} fontWeight={anti ? 400 : 900} letterSpacingEm={anti ? 0.01 : -0.02} color={theme.colors.accentInk} />
      </div>

      <div style={{ position: 'absolute', left: SAFE.left, top: 1740, fontFamily: theme.fonts.mono, fontWeight: 700, fontSize: 22, letterSpacing: '0.14em', color: theme.colors.inkMuted }}>
        {cover.contentId} · {theme.tagline}
      </div>
    </AbsoluteFill>
  );
};

const Headshot: React.FC<{ cover: CoverSpec }> = ({ cover }) => {
  const theme = getTheme(cover.brand);
  const h = cover.headshot!;
  const size = 720 * h.scale;
  return (
    <div style={{ position: 'absolute', right: -60, top: 380, width: 720, height: 720 }}>
      <div style={{ position: 'absolute', inset: 40, borderRadius: '50%', background: `radial-gradient(circle, ${theme.colors.accent}55 0%, transparent 68%)` }} />
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: h.cutout ? 0 : 36, maskImage: h.cutout ? undefined : 'linear-gradient(180deg, #000 70%, transparent 100%)' }}>
        <Img
          src={h.src}
          style={{
            position: 'absolute',
            width: size,
            height: size,
            objectFit: 'cover',
            left: 360 - h.focusX * size,
            top: 300 - h.focusY * size,
            filter: 'contrast(1.06) saturate(0.9)',
          }}
        />
      </div>
    </div>
  );
};

/** Typography-only fallback when no authorised headshot exists. */
const GiantGlyph: React.FC<{ brand: CoverSpec['brand'] }> = ({ brand }) => {
  const theme = getTheme(brand);
  return (
    <div style={{ position: 'absolute', right: -180, top: 430, opacity: 0.14, transform: 'rotate(-8deg)' }}>
      <EyeGlyph brand={brand} size={760} strokeWidth={5} color={theme.colors.ink} />
    </div>
  );
};
