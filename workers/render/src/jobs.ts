import { checkRights } from '@tiresias/core';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { DATA_DIR, mediaKeyToPath } from './config';
import { countCuts, extractFrame, probe, run } from './ffmpeg';
import { makeCancelSignal, renderCover, renderVideo } from './render';
import { coverForProject, getStore, type JobRecord, type LocalStore, type RenderRecord } from './store';

export class NonRetryableError extends Error {}

const toKey = (abs: string) => path.relative(DATA_DIR, abs).split(path.sep).join('/');

/** Validate + normalise an upload into an edit-friendly master. */
export async function ingestMedia(job: JobRecord, store: LocalStore): Promise<void> {
  const mediaId = job.payload.mediaId;
  const media = (await store.read()).media.find((m) => m.id === mediaId);
  if (!media) throw new NonRetryableError(`Media ${mediaId} not found`);
  const input = mediaKeyToPath(media.originalKey);
  let p;
  try {
    p = await probe(input);
  } catch (e) {
    throw new NonRetryableError(`Not a readable video: ${(e as Error).message}`);
  }
  const problems: string[] = [];
  if (!p.videoCodec) problems.push('no video stream');
  if (p.durationSec < 1 || p.durationSec > 180) problems.push(`duration ${p.durationSec.toFixed(1)} s outside 1–180 s`);
  if (p.width < 640 || p.height < 360) problems.push(`resolution ${p.width}×${p.height} below 640×360`);
  if (p.fps < 23) problems.push(`frame rate ${p.fps.toFixed(2)} below 23 fps`);
  if (problems.length) {
    await store.update((db) => {
      const m = db.media.find((x) => x.id === mediaId)!;
      Object.assign(m, { status: 'failed', error: `Rejected: ${problems.join('; ')}`, updatedAt: new Date().toISOString() });
    });
    throw new NonRetryableError(`Media rejected: ${problems.join('; ')}`);
  }

  const key = `uploads/normalized/${mediaId}.mp4`;
  const out = mediaKeyToPath(key);
  await mkdir(path.dirname(out), { recursive: true });
  // Constant 30 fps, short GOP: frame-accurate seeking in the editor and in Remotion.
  const r = await run('ffmpeg', [
    '-hide_banner', '-y', '-i', input,
    '-vf', "fps=30,scale='min(1920,iw)':-2:flags=lanczos",
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-g', '15', '-keyint_min', '15', '-sc_threshold', '0',
    '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-movflags', '+faststart', out,
  ]);
  if (r.code !== 0) throw new Error(`Normalisation failed: ${r.stderr.slice(-300)}`);
  await store.setJobProgress(job.id, 0.7);
  const np = await probe(out);
  const cuts = await countCuts(out, 0.4);
  const posterKey = `uploads/posters/${mediaId}.jpg`;
  await mkdir(path.dirname(mediaKeyToPath(posterKey)), { recursive: true });
  await extractFrame(out, Math.min(1, np.durationSec / 3), mediaKeyToPath(posterKey), 640);
  await store.update((db) => {
    const m = db.media.find((x) => x.id === mediaId)!;
    Object.assign(m, {
      key,
      posterKey,
      status: 'ready',
      error: null,
      probe: { durationSec: np.durationSec, width: np.width, height: np.height, fps: np.fps, videoCodec: np.videoCodec, audioCodec: np.audioCodec, cuts },
      updatedAt: new Date().toISOString(),
    });
    // Projects created before ingest finished (e.g. seeded demos) switch to the normalised master.
    for (const pr of db.projects) if (pr.mediaId === mediaId) pr.spec.source.src = key;
  });
  await store.log('info', 'ingest', `Normalised ${media.originalName}`, { mediaId, durationSec: np.durationSec, cuts: cuts.length });
}

export async function renderProject(job: JobRecord, store: LocalStore): Promise<void> {
  const projectId = job.payload.projectId;
  const db = await store.read();
  const project = db.projects.find((x) => x.id === projectId);
  if (!project) throw new NonRetryableError(`Project ${projectId} not found`);
  const media = db.media.find((m) => m.id === project.mediaId);
  if (!media) throw new NonRetryableError('Source media record is missing');
  const rights = checkRights(media.rights, 'internal_preview');
  if (!rights.ok) throw new NonRetryableError(`Rights do not allow even an internal preview render: ${rights.reasons.join(' ')}`);
  const headshot = project.cover.headshotMediaId ? db.media.find((m) => m.id === project.cover.headshotMediaId) : null;

  const renderId = job.payload.renderId ?? randomUUID();
  const outDir = path.join(DATA_DIR, 'renders', projectId, renderId);
  const now = new Date().toISOString();
  await store.update((d) => {
    let rec = d.renders.find((x) => x.id === renderId);
    if (!rec) {
      rec = {
        id: renderId, projectId, status: 'rendering', progress: 0, videoKey: null, coverKey: null, contactSheetKey: null, specKey: null, specHash: null,
        qa: null, qaPassed: null, renderMs: null, bytes: null, estimatedCostUsd: null, error: null, createdAt: now, finishedAt: null,
      } satisfies RenderRecord;
      d.renders.push(rec);
    }
    rec.status = 'rendering';
    const p = d.projects.find((x) => x.id === projectId)!;
    p.status = 'rendering';
    p.latestRenderId = renderId;
  });

  const cancel = makeCancelSignal();
  const started = Date.now();
  let lastWrite = 0;
  try {
    const v = await renderVideo(project.spec, outDir, {
      basename: project.spec.contentId,
      cancelSignal: cancel.cancelSignal,
      onProgress: (pr) => {
        if (Date.now() - lastWrite < 1000) return;
        lastWrite = Date.now();
        void store.setJobProgress(job.id, pr * 0.92).then(({ cancelRequested }) => {
          if (cancelRequested) cancel.cancel();
        });
        void store.update((d) => {
          const rec = d.renders.find((x) => x.id === renderId);
          if (rec) rec.progress = pr;
        });
      },
    });
    const c = await renderCover(coverForProject(project, headshot?.key ?? null), outDir, project.spec.contentId);
    const ms = Date.now() - started;
    const settings = (await store.read()).settings;
    const cost = (ms / 3_600_000) * settings.workerCostPerHourUsd;
    const passed = v.qa.passed && c.qa.passed;
    await store.update((d) => {
      const rec = d.renders.find((x) => x.id === renderId)!;
      Object.assign(rec, {
        status: 'succeeded', progress: 1, videoKey: toKey(v.videoPath), coverKey: toKey(c.coverPath), contactSheetKey: toKey(v.contactSheetPath), specKey: toKey(v.specPath),
        specHash: v.specHash, qa: { video: v.qa, cover: c.qa }, qaPassed: passed, renderMs: ms, bytes: v.bytes, estimatedCostUsd: Math.round(cost * 10000) / 10000, finishedAt: new Date().toISOString(),
      });
      const p = d.projects.find((x) => x.id === projectId)!;
      p.status = passed ? 'ready_for_approval' : 'needs_review';
      p.updatedAt = new Date().toISOString();
    });
    await store.log(passed ? 'info' : 'warn', 'render', `Rendered ${project.spec.contentId} — QA ${passed ? 'passed' : 'failed'}`, { projectId, renderId, ms });
  } catch (e) {
    const message = (e as Error).message;
    await store.update((d) => {
      const rec = d.renders.find((x) => x.id === renderId);
      if (rec) Object.assign(rec, { status: /cancel/i.test(message) ? "cancelled" : "failed", error: message, finishedAt: new Date().toISOString() });
      const p = d.projects.find((x) => x.id === projectId);
      if (p) p.status = 'failed';
    });
    if (/Spec has blocking issues|Missing media asset/.test(message)) throw new NonRetryableError(message);
    throw e;
  }
}

export const HANDLERS: Record<JobRecord['type'], (job: JobRecord, store: LocalStore) => Promise<void>> = {
  ingest_media: ingestMedia,
  render_project: renderProject,
  daily_ingest: (job, store) => import('./daily').then((m) => m.dailyIngest(job, store)),
};

/** Process a single job; returns false when the queue is empty. */
export async function runOnce(store: LocalStore = getStore()): Promise<boolean> {
  const job = await store.claimNext();
  if (!job) return false;
  await store.log('info', 'worker', `Started ${job.type} (attempt ${job.attempts}/${job.maxAttempts})`, { jobId: job.id, ...job.payload });
  try {
    await HANDLERS[job.type](job, store);
    await store.finishJob(job.id, { ok: true });
    await store.log('info', 'worker', `Finished ${job.type}`, { jobId: job.id });
  } catch (e) {
    const retryable = !(e instanceof NonRetryableError);
    const after = await store.finishJob(job.id, { ok: false, error: (e as Error).message, retryable });
    await store.log('error', 'worker', `${job.type} ${after?.status === 'queued' ? 'failed (will retry)' : after?.status}: ${(e as Error).message}`, { jobId: job.id });
  }
  return true;
}
