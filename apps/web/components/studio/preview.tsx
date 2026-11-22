'use client';

import { Player, type PlayerRef } from '@remotion/player';
import { computeTimeline, layoutOptions, type VideoSpec } from '@tiresias/core';
import { CourtVision, resolveVideoSpecMedia } from '@tiresias/video';
import { Move } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { fileUrl } from '@/lib/client';
import { Button, cn } from '../ui';

/**
 * Live Remotion preview. With "Adjust labels" on, the player parks on the
 * decision scene and the label chips become draggable (stored as offsets).
 */
export function Preview({ spec, onChange }: { spec: VideoSpec; onChange: (s: VideoSpec) => void }) {
  const player = useRef<PlayerRef>(null);
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(360);
  const [editLabels, setEditLabels] = useState(false);
  const timeline = useMemo(() => computeTimeline(spec), [spec]);
  const resolved = useMemo(() => resolveVideoSpecMedia(spec, fileUrl), [spec]);
  const scale = width / 1080;
  const decision = timeline.scenes.find((s) => s.id === 'decision')!;

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (editLabels) {
      player.current?.pause();
      player.current?.seekTo(decision.from + 40);
    }
  }, [editLabels, decision.from]);

  const chips = editLabels ? layoutOptions(spec).items : [];

  const drag = (e: React.PointerEvent, label: string) => {
    e.preventDefault();
    const start = { x: e.clientX, y: e.clientY };
    const opt = spec.options.find((o) => o.label === label)!;
    const base = { dx: opt.labelDx, dy: opt.labelDy };
    const move = (ev: PointerEvent) => {
      const dx = Math.round(base.dx + (ev.clientX - start.x) / scale);
      const dy = Math.round(base.dy + (ev.clientY - start.y) / scale);
      onChange({ ...spec, options: spec.options.map((o) => (o.label === label ? { ...o, labelDx: clampOff(dx), labelDy: clampOff(dy) } : o)) });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <div className="flex flex-col gap-3">
      <div ref={box} className="relative w-full overflow-hidden rounded-xl border border-line bg-black" style={{ aspectRatio: '9 / 16' }}>
        <Player
          ref={player}
          component={CourtVision}
          inputProps={{ spec: resolved }}
          durationInFrames={timeline.durationInFrames}
          fps={timeline.fps}
          compositionWidth={1080}
          compositionHeight={1920}
          style={{ width: '100%', height: '100%' }}
          controls={!editLabels}
          clickToPlay={!editLabels}
          acknowledgeRemotionLicense
        />
        {editLabels
          ? chips.map((c) => (
              <div
                key={c.label}
                onPointerDown={(e) => drag(e, c.label)}
                title={`Drag label ${c.label}`}
                className="absolute cursor-move rounded-md border-2 border-dashed border-white/90 bg-white/10"
                style={{ left: (c.chip.x - 50) * scale, top: (c.chip.y - 50) * scale, width: 100 * scale, height: 100 * scale }}
              />
            ))
          : null}
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant={editLabels ? 'default' : 'secondary'} onClick={() => setEditLabels((v) => !v)}>
          <Move /> {editLabels ? 'Done adjusting labels' : 'Adjust labels'}
        </Button>
        {editLabels ? (
          <Button size="sm" variant="ghost" onClick={() => onChange({ ...spec, options: spec.options.map((o) => ({ ...o, labelDx: 0, labelDy: 0 })) })}>
            Reset positions
          </Button>
        ) : null}
        <span className={cn('ml-auto font-mono text-[11px] text-faint')}>{(timeline.durationInFrames / timeline.fps).toFixed(1)}s · 1080×1920 · 30fps</span>
      </div>
    </div>
  );
}

const clampOff = (v: number) => Math.max(-400, Math.min(400, v));
