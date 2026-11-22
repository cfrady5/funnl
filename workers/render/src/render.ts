import { bundle } from '@remotion/bundler';
import { makeCancelSignal, renderMedia, renderStill, selectComposition, type CancelSignal } from '@remotion/renderer';
import { computeTimeline, CoverSpecSchema, hasBlockingIssues, validateSpec, VideoSpecSchema, type CoverSpec, type VideoSpec } from '@tiresias/core';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { browserExecutable, mediaKeyToPath, REMOTION_ENTRY, REMOTION_PUBLIC, RENDER_DEFAULTS } from './config';
import { contactSheet, normalizeLoudness } from './ffmpeg';
import { startMediaServer } from './media-server';
import { validateCover, validateRender, type QAReport } from './qa';

// Kept as literals here so the worker does not import React components.
const COMPOSITIONS = {
  tiresias: 'TiresiasCourtVision',
  antitiresias: 'AntiTiresiasNegativeCourtVision',
  tiresiasCover: 'TiresiasCover',
  antitiresiasCover: 'AntiTiresiasCover',
} as const;

let bundlePromise: Promise<string> | null = null;

/** Bundle the Remotion project once per worker process. */
export function getBundle(): Promise<string> {
  if (!bundlePromise) {
    bundlePromise = bundle({ entryPoint: REMOTION_ENTRY, publicDir: REMOTION_PUBLIC, onProgress: () => undefined }).catch((e) => {
      bundlePromise = null;
      throw e;
    });
  }
  return bundlePromise;
}

const chromium = () => ({
  browserExecutable: browserExecutable(),
  chromiumOptions: { gl: 'swangle' as const, disableWebSecurity: false },
});

function resolveVideoMedia(spec: VideoSpec, url: (k: string) => string): VideoSpec {
  return {
    ...spec,
    source: { ...spec.source, src: url(spec.source.src) },
    audio: {
      ...spec.audio,
      music: spec.audio.music ? { ...spec.audio.music, src: url(spec.audio.music.src) } : null,
      voiceover: spec.audio.voiceover ? { ...spec.audio.voiceover, src: url(spec.audio.voiceover.src) } : null,
    },
  };
}

function assertLocalMediaExists(keys: Array<string | null | undefined>) {
  for (const k of keys) {
    if (!k || /^https?:\/\//.test(k)) continue;
    if (!existsSync(mediaKeyToPath(k))) throw new MissingAssetError(k);
  }
}

export class MissingAssetError extends Error {
  constructor(public key: string) {
    super(`Missing media asset: ${key}`);
    this.name = 'MissingAssetError';
  }
}
export class SpecValidationError extends Error {
  constructor(public issues: ReturnType<typeof validateSpec>) {
    super(`Spec has blocking issues: ${issues.filter((i) => i.severity === 'error').map((i) => i.message).join(' ')}`);
    this.name = 'SpecValidationError';
  }
}

export interface RenderVideoResult {
  videoPath: string;
  contactSheetPath: string;
  specPath: string;
  qaPath: string;
  qa: QAReport;
  renderMs: number;
  bytes: number;
  specHash: string;
}

export function specHash(spec: unknown): string {
  return createHash('sha256').update(JSON.stringify(spec)).digest('hex').slice(0, 16);
}

/**
 * Render one Court Vision video: validate → render (H.264/AAC) → loudness
 * normalise → QA → contact sheet. The exact spec used is stored next to the
 * output so every render is reproducible.
 */
export async function renderVideo(
  rawSpec: VideoSpec,
  outDir: string,
  opts: { onProgress?: (p: number) => void; cancelSignal?: CancelSignal; basename?: string } = {},
): Promise<RenderVideoResult> {
  const spec = VideoSpecSchema.parse(rawSpec);
  const issues = validateSpec(spec);
  if (hasBlockingIssues(issues)) throw new SpecValidationError(issues);
  assertLocalMediaExists([spec.source.src, spec.audio.music?.src, spec.audio.voiceover?.src]);

  await mkdir(outDir, { recursive: true });
  const base = opts.basename ?? spec.contentId;
  const raw = path.join(outDir, `${base}.raw.mp4`);
  const final = path.join(outDir, `${base}.mp4`);
  const started = Date.now();
  const server = await startMediaServer();
  try {
    const serveUrl = await getBundle();
    const inputProps = { spec: resolveVideoMedia(spec, server.url) };
    const composition = await selectComposition({ serveUrl, id: COMPOSITIONS[spec.brand], inputProps, logLevel: 'error', ...chromium() });
    const expectedFrames = computeTimeline(spec).durationInFrames;
    if (composition.durationInFrames !== expectedFrames) throw new Error(`Composition duration mismatch (${composition.durationInFrames} vs ${expectedFrames})`);
    await renderMedia({
      serveUrl,
      composition,
      inputProps,
      codec: 'h264',
      audioCodec: 'aac',
      pixelFormat: 'yuv420p',
      colorSpace: 'bt709',
      logLevel: 'error',
      crf: RENDER_DEFAULTS.crf,
      x264Preset: 'medium',
      enforceAudioTrack: true,
      outputLocation: raw,
      concurrency: RENDER_DEFAULTS.concurrency,
      cancelSignal: opts.cancelSignal,
      onProgress: ({ progress }) => opts.onProgress?.(progress * 0.9),
      ...chromium(),
    });
  } finally {
    await server.close();
  }
  await normalizeLoudness(raw, final, RENDER_DEFAULTS.loudnessTargetLufs, RENDER_DEFAULTS.truePeakDb, computeTimeline(spec).durationInFrames / spec.fps);
  await rm(raw, { force: true });
  opts.onProgress?.(0.95);

  const qa = await validateRender(final, spec);
  const tl = computeTimeline(spec);
  const sheetTimes = tl.scenes.map((s) => (s.from + s.durationInFrames * 0.6) / tl.fps);
  const contactSheetPath = path.join(outDir, `${base}.contact.png`);
  await contactSheet(final, sheetTimes, contactSheetPath);
  const specPath = path.join(outDir, `${base}.spec.json`);
  const qaPath = path.join(outDir, `${base}.qa.json`);
  await writeFile(specPath, JSON.stringify(spec, null, 2));
  await writeFile(qaPath, JSON.stringify(qa, null, 2));
  opts.onProgress?.(1);
  return { videoPath: final, contactSheetPath, specPath, qaPath, qa, renderMs: Date.now() - started, bytes: (await stat(final)).size, specHash: specHash(spec) };
}

export interface RenderCoverResult {
  coverPath: string;
  qa: QAReport;
  renderMs: number;
}

export async function renderCover(rawCover: CoverSpec, outDir: string, basename?: string): Promise<RenderCoverResult> {
  const cover = CoverSpecSchema.parse(rawCover);
  assertLocalMediaExists([cover.headshot?.src, cover.backdrop?.src]);
  await mkdir(outDir, { recursive: true });
  const out = path.join(outDir, `${basename ?? cover.contentId}.cover.png`);
  const tmp = `${out}.tmp.png`;
  const started = Date.now();
  const server = await startMediaServer();
  try {
    const serveUrl = await getBundle();
    const inputProps = {
      cover: {
        ...cover,
        headshot: cover.headshot ? { ...cover.headshot, src: server.url(cover.headshot.src) } : null,
        backdrop: cover.backdrop ? { ...cover.backdrop, src: server.url(cover.backdrop.src) } : null,
      },
    };
    const id = cover.brand === 'tiresias' ? COMPOSITIONS.tiresiasCover : COMPOSITIONS.antitiresiasCover;
    const composition = await selectComposition({ serveUrl, id, inputProps, logLevel: 'error', ...chromium() });
    await renderStill({ serveUrl, composition, inputProps, output: tmp, imageFormat: 'png', logLevel: 'error', ...chromium() });
  } finally {
    await server.close();
  }
  await rename(tmp, out);
  return { coverPath: out, qa: await validateCover(out), renderMs: Date.now() - started };
}

export { makeCancelSignal };
