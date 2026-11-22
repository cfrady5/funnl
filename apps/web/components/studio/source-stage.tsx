'use client';

import { framingAt, getTheme, PANEL, resolveFraming, type PassingOption, type VideoSpec } from '@tiresias/core';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Crosshair, Flag, Pause, Play, Snowflake } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, cn } from '../ui';

type Point = { x: number; y: number };

interface Props {
  spec: VideoSpec;
  src: string;
  cuts: number[];
  onChange: (next: VideoSpec) => void;
}

/**
 * Frame-accurate source view. All marker coordinates are normalised (0..1)
 * against the source frame so they survive any later re-framing.
 */
export function SourceStage({ spec, src, cuts, onChange }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [t, setT] = useState(spec.freezeSec);
  const [playing, setPlaying] = useState(false);
  const fps = spec.source.fps || 30;
  const dur = spec.source.durationSec;
  const theme = getTheme(spec.brand);
  const frameIdx = Math.round(t * fps);
  const atFreeze = Math.abs(t - spec.freezeSec) < 0.5 / fps;

  const seek = useCallback(
    (time: number) => {
      const v = video.current;
      const clamped = Math.max(0, Math.min(dur - 1 / fps, time));
      // Land in the middle of the frame so the browser shows exactly this frame.
      if (v) v.currentTime = Math.round(clamped * fps) / fps + 0.5 / fps;
      setT(Math.round(clamped * fps) / fps);
    },
    [dur, fps],
  );

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    const onTime = () => playing && setT(v.currentTime);
    const onLoaded = () => seek(spec.freezeSec);
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('loadedmetadata', onLoaded);
    let raf = 0;
    const tick = () => {
      if (!v.paused) setT(v.currentTime);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('loadedmetadata', onLoaded);
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input,textarea,select')) return;
      if (e.key === 'ArrowLeft') seek(t - (e.shiftKey ? 10 : 1) / fps);
      else if (e.key === 'ArrowRight') seek(t + (e.shiftKey ? 10 : 1) / fps);
      else if (e.key.toLowerCase() === 'f') onChange({ ...spec, freezeSec: round2(t) });
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [t, fps, seek, spec, onChange]);

  const togglePlay = () => {
    const v = video.current;
    if (!v) return;
    if (v.paused) {
      void v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
      seek(v.currentTime);
    }
  };

  const dragPoint = (e: React.PointerEvent, apply: (p: Point) => void) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = stage.current!.getBoundingClientRect();
    const move = (ev: PointerEvent) => {
      apply({
        x: round4(Math.min(1, Math.max(0, (ev.clientX - rect.left) / rect.width))),
        y: round4(Math.min(1, Math.max(0, (ev.clientY - rect.top) / rect.height))),
      });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const updateOption = (label: PassingOption['label'], p: Point) =>
    onChange({ ...spec, framing: spec.framing, options: spec.options.map((o) => (o.label === label ? { ...o, ...p, origin: 'manual', confidence: 1 } : o)) });

  // Visible 9:16 window at the freeze frame, in normalised source coordinates.
  const fr = resolveFraming(spec.source, framingAt(spec.framing.keyframes, spec.freezeSec));
  const sw = spec.source.width * fr.scale;
  const sh = spec.source.height * fr.scale;
  const crop = { x: -fr.offsetX / sw, y: -fr.offsetY / sh, w: PANEL.width / sw, h: PANEL.height / sh };

  const pct = (v: number) => `${(v / dur) * 100}%`;

  return (
    <div className="flex flex-col gap-3">
      <div ref={stage} className="relative w-full overflow-hidden rounded-lg bg-black select-none" style={{ aspectRatio: `${spec.source.width} / ${spec.source.height}` }}>
        <video ref={video} src={src} muted playsInline preload="auto" className="absolute inset-0 h-full w-full" onEnded={() => setPlaying(false)} />
        {/* 9:16 crop window */}
        <div
          className="pointer-events-none absolute border-2 border-dashed border-white/50"
          style={{ left: `${Math.max(0, crop.x) * 100}%`, top: `${Math.max(0, crop.y) * 100}%`, width: `${Math.min(1, crop.w) * 100}%`, height: `${Math.min(1, crop.h) * 100}%`, boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)' }}
        >
          <span className="absolute top-1 left-1 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] text-white/80">9:16 PANEL @ FREEZE</span>
        </div>
        <div className={cn('absolute inset-0 transition-opacity', atFreeze ? 'opacity-100' : 'opacity-35')}>
          {spec.handler ? (
            <Marker x={spec.handler.x} y={spec.handler.y} color="#ffffff" label="●" title="Ball handler" onPointerDown={(e) => dragPoint(e, (p) => onChange({ ...spec, handler: p }))} />
          ) : null}
          {spec.options.map((o) => (
            <Marker
              key={o.label}
              x={o.x}
              y={o.y}
              color={theme.optionColors[o.label]}
              label={o.label}
              title={`${o.label}: ${o.description}${o.origin === 'auto' ? ` (auto, ${Math.round(o.confidence * 100)}%)` : ''}`}
              ring={o.label === spec.assessment.actual}
              onPointerDown={(e) => dragPoint(e, (p) => updateOption(o.label, p))}
            />
          ))}
        </div>
        {!atFreeze ? (
          <button onClick={() => seek(spec.freezeSec)} className="absolute top-3 right-3 rounded-md bg-black/75 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black">
            Markers are placed on the freeze frame — jump to {spec.freezeSec.toFixed(2)}s
          </button>
        ) : (
          <div className="absolute top-3 right-3 rounded-md bg-accent px-2.5 py-1 font-mono text-[11px] font-bold text-accent-ink">FREEZE FRAME</div>
        )}
      </div>

      {/* Scrubber */}
      <div className="relative h-8">
        <div className="absolute top-3.5 right-0 left-0 h-1 rounded bg-line" />
        <div className="absolute top-3 h-2 rounded bg-accent/25" style={{ left: pct(spec.clip.startSec), width: pct(spec.clip.endSec - spec.clip.startSec) }} />
        {cuts.map((c) => (
          <div key={c} title={`Camera cut at ${c.toFixed(2)}s`} className="absolute top-1.5 h-5 w-0.5 bg-warn" style={{ left: pct(c) }} />
        ))}
        <div title="Freeze" className="absolute top-0.5 -ml-1.5 h-0 w-0 border-x-[6px] border-t-[8px] border-x-transparent border-t-info" style={{ left: pct(spec.freezeSec) }} />
        <input
          type="range"
          min={0}
          max={dur}
          step={1 / fps}
          value={t}
          onChange={(e) => seek(Number(e.target.value))}
          className="absolute inset-0 w-full cursor-pointer opacity-90"
          style={{ background: 'transparent' }}
          aria-label="Scrub"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="icon" variant="secondary" onClick={() => seek(t - 10 / fps)} title="Back 10 frames (Shift+←)"><ChevronsLeft /></Button>
        <Button size="icon" variant="secondary" onClick={() => seek(t - 1 / fps)} title="Back 1 frame (←)"><ChevronLeft /></Button>
        <Button size="icon" variant="secondary" onClick={togglePlay} title="Play / pause">{playing ? <Pause /> : <Play />}</Button>
        <Button size="icon" variant="secondary" onClick={() => seek(t + 1 / fps)} title="Forward 1 frame (→)"><ChevronRight /></Button>
        <Button size="icon" variant="secondary" onClick={() => seek(t + 10 / fps)} title="Forward 10 frames (Shift+→)"><ChevronsRight /></Button>
        <div className="ml-1 font-mono text-xs text-muted tabular-nums">
          {t.toFixed(2)}s · frame {frameIdx}
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => onChange({ ...spec, clip: { ...spec.clip, startSec: round2(Math.min(t, spec.freezeSec - 0.2)) } })}><Flag /> Clip in</Button>
          <Button size="sm" variant="outline" onClick={() => onChange({ ...spec, clip: { ...spec.clip, endSec: round2(Math.max(t, spec.freezeSec + 0.2)) } })}><Flag /> Clip out</Button>
          <Button size="sm" onClick={() => onChange({ ...spec, freezeSec: round2(t) })} title="Set freeze here (F)"><Snowflake /> Freeze here</Button>
          <Button size="sm" variant="ghost" onClick={() => seek(spec.freezeSec)}><Crosshair /> Go to freeze</Button>
        </div>
      </div>
      <div className="font-mono text-[11px] text-faint">
        Clip {spec.clip.startSec.toFixed(2)}–{spec.clip.endSec.toFixed(2)}s · freeze {spec.freezeSec.toFixed(2)}s · {cuts.length} camera cut{cuts.length === 1 ? '' : 's'} detected · drag markers to the target players’ feet
      </div>
    </div>
  );
}

function Marker({ x, y, color, label, title, ring, onPointerDown }: Point & { color: string; label: string; title: string; ring?: boolean; onPointerDown: (e: React.PointerEvent) => void }) {
  return (
    <div className="absolute" style={{ left: `${x * 100}%`, top: `${y * 100}%` }}>
      <div className="absolute -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-2" style={{ width: 44, height: 14, borderColor: color, background: `${color}33` }} />
      <button
        title={title}
        onPointerDown={onPointerDown}
        className={cn('absolute flex h-7 w-7 -translate-x-1/2 cursor-grab items-center justify-center rounded-md text-xs font-extrabold text-black shadow-lg active:cursor-grabbing', ring && 'ring-2 ring-white ring-offset-1 ring-offset-black')}
        style={{ top: -40, background: color }}
      >
        {label}
      </button>
      <div className="absolute w-px -translate-x-1/2" style={{ top: -13, height: 12, background: color }} />
    </div>
  );
}

const round2 = (v: number) => Math.round(v * 100) / 100;
const round4 = (v: number) => Math.round(v * 10000) / 10000;
