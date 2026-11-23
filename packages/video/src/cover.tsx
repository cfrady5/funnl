import { getTheme, type CoverSpec } from '@tiresias/core';
import React from 'react';
import { AbsoluteFill, Img, OffthreadVideo, useVideoConfig } from 'remotion';
import { EyeGlyph, HazardStripes } from './brand-mark';
import { FitText, useFontsReady } from './text';

export type CoverProps = { cover: CoverSpec };

/**
 * Editorial cover template (cream page, solid team-colour block, player
 * breaking out of the block, heavy lowercase type):
 *
 *   kicker:                        ◉ tiresias
 *   13                             can you see the pass?
 *   ┌──────── colour block ────────┐   ← cutout head breaks the top edge
 *   │          player              │
 *   └──────────────────────────────┘
 *   player name                       24p/6r/13a
 *   team                                     +21
 *
 * Image priority: authorised cutout headshot → still from the rights-cleared
 * clip cropped on the featured player → typography only (giant stat in block).
 * Key content stays inside the central 3:4 area (y ≈ 240–1680) that profile grids show.
 */
export const COVER_LAYOUT = {
  page: { width: 1080, height: 1920 },
  block: { x: 108, y: 640, width: 864, height: 700 },
} as const;

const INK = '#0B0B0C';
const PAPER = '#FBF8EF';

export const Cover: React.FC<CoverProps> = ({ cover }) => {
  const ready = useFontsReady();
  const theme = getTheme(cover.brand);
  const anti = cover.brand === 'antitiresias';
  if (!ready) return <AbsoluteFill style={{ backgroundColor: PAPER }} />;

  const { block } = COVER_LAYOUT;
  const blockColor = cover.blockColor ?? (anti ? '#FF3B1F' : '#C8323C');
  const cutout = cover.headshot?.cutout ? cover.headshot : null;
  const framedPhoto = cover.headshot && !cover.headshot.cutout ? cover.headshot : null;
  const typeOnly = !cover.headshot && !cover.backdrop;
  const heavy = { fontFamily: 'Inter Tight', fontWeight: 900, color: INK, letterSpacing: '-0.045em', lineHeight: 0.96 } as const;
  const rotate = anti ? -2.5 : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: PAPER, overflow: 'hidden' }}>
      {/* Top-left: kicker + stat value */}
      <div style={{ position: 'absolute', left: block.x, top: block.y - 178, ...heavy, fontSize: 64 }}>
        <div>{(cover.kicker ?? cover.statLabel).toLowerCase()}</div>
        {/* No verified stat → the line is omitted rather than shown as a placeholder. */}
        {cover.statValue != null ? <div style={{ fontSize: 76 }}>{cover.statValue}</div> : null}
      </div>

      {/* Top-right: brand mark + headline */}
      <div style={{ position: 'absolute', right: 1080 - block.x - block.width, top: block.y - 172, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <EyeGlyph brand={cover.brand} size={52} strokeWidth={9} color={anti ? INK : INK} />
          <span style={{ ...heavy, fontSize: 40, letterSpacing: '-0.02em' }}>{anti ? 'anti tiresias' : 'tiresias'}</span>
        </div>
        <div style={{ ...heavy, fontWeight: 800, fontSize: 30, letterSpacing: '-0.02em', color: '#55565A', textAlign: 'right', maxWidth: 380, lineHeight: 1.05 }}>
          {cover.headline.toLowerCase()}
        </div>
      </div>

      {/* Colour block (+ framed image inside it) */}
      <div
        style={{
          position: 'absolute',
          left: block.x,
          top: block.y,
          width: block.width,
          height: block.height,
          backgroundColor: blockColor,
          overflow: 'hidden',
          transform: `rotate(${rotate}deg)`,
        }}
      >
        {!cutout && !framedPhoto && cover.backdrop ? <ClipStill cover={cover} blockColor={blockColor} /> : null}
        {framedPhoto ? (
          <Img src={framedPhoto.src} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${framedPhoto.focusX * 100}% ${framedPhoto.focusY * 100}%` }} />
        ) : null}
        {typeOnly ? (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', ...heavy, color: PAPER, fontSize: 520, letterSpacing: '-0.07em', lineHeight: 1 }}>
            {cover.statValue ?? ''}
          </div>
        ) : null}
        {anti ? (
          <div style={{ position: 'absolute', left: 0, top: 0 }}>
            <HazardStripes width={block.width} height={22} colorB={INK} />
          </div>
        ) : null}
      </div>

      {/* Authorised cutout breaks out of the top of the block */}
      {cutout ? (
        <Img
          src={cutout.src}
          style={{
            position: 'absolute',
            left: block.x + block.width / 2 - (block.width * 1.05 * cutout.scale) / 2,
            bottom: 1920 - (block.y + block.height),
            width: block.width * 1.05 * cutout.scale,
            height: (block.height + 260) * cutout.scale,
            objectFit: 'contain',
            objectPosition: 'bottom center',
            filter: 'drop-shadow(0 18px 28px rgba(0,0,0,0.25))',
          }}
        />
      ) : null}

      {/* Bottom-left: name + team */}
      <div style={{ position: 'absolute', left: block.x, top: block.y + block.height + 28 }}>
        <FitText text={cover.playerName.toLowerCase()} width={cover.statLine ? 560 : block.width} maxLines={1} maxFontSize={68} minFontSize={40} fontFamily="Inter Tight" fontWeight={900} letterSpacingEm={-0.045} lineHeight={1} color={INK} uppercase={false} />
        <div style={{ ...heavy, fontSize: 60, marginTop: 4 }}>{(cover.teamName ?? cover.teamAbbr).toLowerCase()}</div>
      </div>

      {/* Bottom-right: verified stat line */}
      {cover.statLine || cover.statSub ? (
        <div style={{ position: 'absolute', right: 1080 - block.x - block.width, top: block.y + block.height + 28, textAlign: 'right', ...heavy, fontSize: 64 }}>
          {cover.statLine ? <div>{cover.statLine.toLowerCase()}</div> : null}
          {cover.statSub ? <div style={{ marginTop: 4 }}>{cover.statSub}</div> : null}
        </div>
      ) : null}

      {/* Footer: series + id (outside the grid crop, still legible full-screen) */}
      <div style={{ position: 'absolute', left: block.x, right: block.x, top: 1620, display: 'flex', justifyContent: 'space-between', fontFamily: 'JetBrains Mono', fontWeight: 700, fontSize: 22, letterSpacing: '0.08em', color: '#8A8B8F' }}>
        <span>{cover.seriesTitle.toLowerCase()}</span>
        <span>{cover.contentId.toLowerCase()}</span>
      </div>
      {/* theme reference keeps brand tokens tree-shaken consistently */}
      <span style={{ display: 'none' }}>{theme.id}</span>
    </AbsoluteFill>
  );
};

/** Still from the rights-cleared clip, cropped on the featured player, toned toward the block colour. */
const ClipStill: React.FC<{ cover: CoverSpec; blockColor: string }> = ({ cover, blockColor }) => {
  const b = cover.backdrop!;
  const { fps } = useVideoConfig();
  const { block } = COVER_LAYOUT;
  const s = Math.max(block.width / b.sourceWidth, block.height / b.sourceHeight) * b.zoom;
  const w = b.sourceWidth * s;
  const h = b.sourceHeight * s;
  const left = Math.min(0, Math.max(block.width - w, block.width / 2 - b.focusX * w));
  const top = Math.min(0, Math.max(block.height - h, block.height * 0.45 - b.focusY * h));
  return (
    <>
      <div style={{ position: 'absolute', left, top, width: w, height: h, filter: 'contrast(1.08) saturate(0.95)' }}>
        {/* A <Still> renders frame 0 at fps 1, so seek with trimBefore in the composition's own fps (a 30 fps frame number overshoots the clip). */}
        <OffthreadVideo src={b.src} muted trimBefore={Math.round(b.timeSec * fps)} style={{ width: '100%', height: '100%' }} />
      </div>
      {/* edge vignette in the block colour so the block still reads as a solid shape */}
      <div style={{ position: 'absolute', inset: 0, boxShadow: `inset 0 0 0 18px ${blockColor}, inset 0 0 120px 40px ${blockColor}99` }} />
    </>
  );
};
