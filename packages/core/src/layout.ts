import type { FramingKeyframe, PassingOption, Point, VideoSpec } from './spec';

export const CANVAS = { width: 1080, height: 1920 } as const;

/**
 * Vertical safe areas. TikTok / Reels / Shorts overlay UI at the top (status,
 * tabs), the bottom (caption, music, nav) and the right rail (like / comment).
 * All critical text stays inside SAFE.
 */
export const SAFE = { top: 150, bottom: 1500, left: 60, right: 940 } as const;

/** The footage window inside the canvas. */
export const PANEL = { x: 0, y: 330, width: 1080, height: 880 } as const;

export interface ResolvedFraming {
  /** Source pixels -> canvas pixels scale. */
  scale: number;
  /** Top-left of the scaled source, relative to the panel. */
  offsetX: number;
  offsetY: number;
  zoom: number;
  focusX: number;
  focusY: number;
}

/** Interpolate framing keyframes at a source time (linear, clamped). */
export function framingAt(keyframes: FramingKeyframe[], t: number): FramingKeyframe {
  const kfs = [...keyframes].sort((a, b) => a.t - b.t);
  if (t <= kfs[0].t) return kfs[0];
  const last = kfs[kfs.length - 1];
  if (t >= last.t) return last;
  for (let i = 0; i < kfs.length - 1; i++) {
    const a = kfs[i];
    const b = kfs[i + 1];
    if (t >= a.t && t <= b.t) {
      const k = (t - a.t) / (b.t - a.t || 1);
      const e = k * k * (3 - 2 * k); // smoothstep for camera-like easing
      return {
        t,
        zoom: a.zoom + (b.zoom - a.zoom) * e,
        focusX: a.focusX + (b.focusX - a.focusX) * e,
        focusY: a.focusY + (b.focusY - a.focusY) * e,
      };
    }
  }
  return last;
}

/**
 * zoom = 1 shows the full source width across the panel; the scaled source is
 * then positioned so that (focusX, focusY) sits as close to the panel centre
 * as possible without exposing empty space (when the source is larger than
 * the panel on that axis).
 */
export function resolveFraming(
  source: { width: number; height: number },
  kf: Pick<FramingKeyframe, 'zoom' | 'focusX' | 'focusY'>,
  panel = PANEL,
): ResolvedFraming {
  const scale = (panel.width / source.width) * kf.zoom;
  const w = source.width * scale;
  const h = source.height * scale;
  const axis = (focus: number, scaled: number, size: number) => {
    if (scaled <= size) return (size - scaled) / 2;
    const ideal = size / 2 - focus * scaled;
    return Math.min(0, Math.max(size - scaled, ideal));
  };
  return {
    scale,
    offsetX: axis(kf.focusX, w, panel.width),
    offsetY: axis(kf.focusY, h, panel.height),
    zoom: kf.zoom,
    focusX: kf.focusX,
    focusY: kf.focusY,
  };
}

/** Normalised source point -> canvas pixel coordinates. */
export function projectPoint(
  source: { width: number; height: number },
  framing: ResolvedFraming,
  p: Point,
  panel = PANEL,
): { x: number; y: number; insidePanel: boolean } {
  const x = panel.x + framing.offsetX + p.x * source.width * framing.scale;
  const y = panel.y + framing.offsetY + p.y * source.height * framing.scale;
  const insidePanel = x >= panel.x && x <= panel.x + panel.width && y >= panel.y && y <= panel.y + panel.height;
  return { x, y, insidePanel };
}

/** The zoom at which the scaled source exactly fills the panel height. */
export function fillZoom(source: { width: number; height: number }, panel = PANEL): number {
  return (panel.height / source.height) * (source.width / panel.width);
}

/**
 * Choose a framing that keeps the handler and every passing option visible
 * with a margin, as tight as allowed (more pixels on the action).
 */
export function autoFraming(
  source: { width: number; height: number },
  points: Point[],
  opts: { marginX?: number; maxZoom?: number; t?: number } = {},
): FramingKeyframe {
  const marginX = opts.marginX ?? 0.07;
  const maxZoom = opts.maxZoom ?? 2.2;
  if (points.length === 0) return { t: opts.t ?? 0, zoom: Math.min(maxZoom, fillZoom(source)), focusX: 0.5, focusY: 0.5 };
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const span = Math.min(1, maxX - minX + 2 * marginX);
  const zoom = Math.max(1, Math.min(maxZoom, 1 / span));
  const focusX = (minX + maxX) / 2;
  // Bias focus up a little: labels sit above players' feet.
  const focusY = Math.min(1, Math.max(0, (Math.min(...ys) + Math.max(...ys)) / 2 - 0.06));
  return { t: opts.t ?? 0, zoom: round(zoom, 3), focusX: round(focusX, 4), focusY: round(focusY, 4) };
}

export const CHIP = { size: 92, minLift: 95, maxLift: 185, minGap: 10 } as const;

/** Players nearer the camera (lower in frame) appear taller, so their labels sit higher. */
export function chipLift(anchorY: number, panel = PANEL): number {
  const k = Math.min(1, Math.max(0, (anchorY - panel.y) / panel.height));
  return CHIP.minLift + (CHIP.maxLift - CHIP.minLift) * k;
}

/** Linear interpolation of a {t,x,y} track at source time t (null outside its range). */
export function trackAt(track: Array<{ t: number; x: number; y: number }>, t: number): Point | null {
  if (track.length === 0) return null;
  const ks = [...track].sort((a, b) => a.t - b.t);
  if (t < ks[0].t || t > ks[ks.length - 1].t) return null;
  for (let i = 0; i < ks.length - 1; i++) {
    const a = ks[i];
    const b = ks[i + 1];
    if (t >= a.t && t <= b.t) {
      const k = (t - a.t) / (b.t - a.t || 1);
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
    }
  }
  return { x: ks[ks.length - 1].x, y: ks[ks.length - 1].y };
}

export interface OptionLayout {
  label: PassingOption['label'];
  /** Canvas position of the player's floor point. */
  anchor: { x: number; y: number; insidePanel: boolean };
  /** Canvas centre of the label chip. */
  chip: { x: number; y: number };
}

/**
 * Place label chips above each target player and separate any that collide.
 * Returns layouts plus problems for the QA validator.
 */
export function layoutOptions(spec: VideoSpec, t = spec.freezeSec): { items: OptionLayout[]; problems: string[] } {
  const framing = resolveFraming(spec.source, framingAt(spec.framing.keyframes, t));
  const problems: string[] = [];
  const half = CHIP.size / 2;
  const items: OptionLayout[] = spec.options.map((o) => {
    const anchor = projectPoint(spec.source, framing, o);
    if (!anchor.insidePanel) problems.push(`Option ${o.label} target is outside the visible panel at the freeze frame.`);
    return {
      label: o.label,
      anchor,
      chip: {
        x: clamp(anchor.x + o.labelDx, PANEL.x + half + 12, PANEL.x + PANEL.width - half - 12),
        y: clamp(anchor.y - chipLift(anchor.y) + o.labelDy, PANEL.y + half + 12, PANEL.y + PANEL.height - half - 12),
      },
    };
  });
  // Simple iterative separation on the x axis (chips share a similar height band).
  // Manually nudged chips are left where the editor put them.
  const manual = spec.options.map((o) => o.labelDx !== 0 || o.labelDy !== 0);
  for (let iter = 0; iter < 30; iter++) {
    let moved = false;
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i].chip;
        const b = items[j].chip;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const need = CHIP.size + CHIP.minGap;
        if (Math.abs(dx) < need && Math.abs(dy) < need) {
          const push = (need - Math.abs(dx)) / 2 + 0.5;
          const dir = dx === 0 ? (i < j ? 1 : -1) : Math.sign(dx);
          if (manual[i] && manual[j]) continue;
          const pa = manual[i] ? 0 : manual[j] ? 2 * push : push;
          const pb = manual[j] ? 0 : manual[i] ? 2 * push : push;
          a.x = clamp(a.x - dir * pa, PANEL.x + half, PANEL.x + PANEL.width - half);
          b.x = clamp(b.x + dir * pb, PANEL.x + half, PANEL.x + PANEL.width - half);
          moved = true;
        }
      }
    }
    if (!moved) break;
  }
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i].chip;
      const b = items[j].chip;
      if (Math.abs(a.x - b.x) < CHIP.size && Math.abs(a.y - b.y) < CHIP.size) {
        problems.push(`Option chips ${items[i].label} and ${items[j].label} overlap.`);
      }
    }
  }
  return { items, problems };
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}
function round(v: number, d: number) {
  const m = 10 ** d;
  return Math.round(v * m) / m;
}
