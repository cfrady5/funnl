import { framingAt, PANEL, resolveFraming, sourceTimeAt, type Timeline, type VideoSpec } from '@tiresias/core';
import React from 'react';
import { AbsoluteFill, Freeze, OffthreadVideo, Sequence, useCurrentFrame } from 'remotion';

/**
 * Renders the source clip inside the vertical panel according to the timeline:
 * playing segments use normal playback (smooth in the Player), holds use a
 * frozen frame. Framing (crop/zoom/pan) follows the spec keyframes and is
 * evaluated at the source time being displayed.
 */
export const Footage: React.FC<{ spec: VideoSpec; timeline: Timeline; extraZoom?: number; children?: React.ReactNode; dim?: number; blur?: number }> = ({
  spec,
  timeline,
  extraZoom = 1,
  children,
  dim = 0,
  blur = 0,
}) => {
  const frame = useCurrentFrame();
  const t = sourceTimeAt(timeline, frame);
  const fr = resolveFraming(spec.source, framingAt(spec.framing.keyframes, t));
  const w = spec.source.width * fr.scale;
  const h = spec.source.height * fr.scale;
  const fps = timeline.fps;
  const focusPx = { x: fr.offsetX + fr.focusX * w, y: fr.offsetY + fr.focusY * h };

  return (
    <div
      style={{
        position: 'absolute',
        left: PANEL.x,
        top: PANEL.y,
        width: PANEL.width,
        height: PANEL.height,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `scale(${extraZoom})`,
          transformOrigin: `${focusPx.x}px ${focusPx.y}px`,
          filter: blur > 0 ? `blur(${blur}px)` : undefined,
        }}
      >
        <div style={{ position: 'absolute', left: fr.offsetX, top: fr.offsetY, width: w, height: h }}>
          {timeline.segments.map((seg, i) => (
            <Sequence key={i} from={seg.from} durationInFrames={seg.durationInFrames} premountFor={15}>
              {seg.kind === 'play' ? (
                <OffthreadVideo
                  src={spec.source.src}
                  trimBefore={Math.round(seg.sourceStartSec * fps)}
                  playbackRate={seg.playbackRate}
                  volume={spec.audio.sourceVolume}
                  muted={spec.audio.sourceVolume === 0}
                  style={{ width: '100%', height: '100%', display: 'block' }}
                />
              ) : (
                <Freeze frame={Math.round(seg.sourceStartSec * fps)}>
                  <OffthreadVideo src={spec.source.src} muted style={{ width: '100%', height: '100%', display: 'block' }} />
                </Freeze>
              )}
            </Sequence>
          ))}
        </div>
        {/* Overlay layer shares the exact transform so markers stay glued to players. */}
        <div style={{ position: 'absolute', left: -PANEL.x, top: -PANEL.y, width: 1080, height: 1920 }}>{children}</div>
      </div>
      {dim > 0 ? <AbsoluteFill style={{ backgroundColor: `rgba(0,0,0,${dim})` }} /> : null}
    </div>
  );
};
