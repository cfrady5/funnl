import { coverFromVideoSpec, createDefaultSpec, MediaRightsSchema, ownedRights, type BrandId, type CoverSpec, type MediaRights, type VideoSpec } from '@tiresias/core';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { FIXTURES_DIR, mediaKeyToPath } from '../config';
import { getStore, type LocalStore } from './local-store';
import type { MediaRecord, ProjectRecord } from './types';

export const ALLOWED_VIDEO_EXT = ['.mp4', '.mov', '.m4v', '.webm', '.mkv'];
export const MAX_UPLOAD_BYTES = 1024 * 1024 * 1024; // 1 GB

export async function sha256File(file: string): Promise<string> {
  const h = createHash('sha256');
  await new Promise<void>((resolve, reject) => {
    createReadStream(file).on('data', (d) => h.update(d)).on('end', resolve).on('error', reject);
  });
  return h.digest('hex');
}

/**
 * Store an uploaded video and register it. Identical bytes (same SHA-256)
 * return the existing record instead of a duplicate.
 */
export async function registerUpload(
  data: Buffer,
  originalName: string,
  rights: Partial<MediaRights>,
  store: LocalStore = getStore(),
): Promise<{ media: MediaRecord; duplicate: boolean }> {
  const ext = path.extname(originalName).toLowerCase();
  if (!ALLOWED_VIDEO_EXT.includes(ext)) throw new Error(`Unsupported file type "${ext}". Allowed: ${ALLOWED_VIDEO_EXT.join(', ')}`);
  if (data.byteLength > MAX_UPLOAD_BYTES) throw new Error('File exceeds the 1 GB upload limit.');
  const sha = createHash('sha256').update(data).digest('hex');
  const existing = (await store.read()).media.find((m) => m.sha256 === sha);
  if (existing) return { media: existing, duplicate: true };
  const id = randomUUID();
  const originalKey = `uploads/originals/${id}${ext}`;
  const file = mediaKeyToPath(originalKey);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, data);
  const media = await createMediaRecord(store, { id, originalKey, originalName, bytes: data.byteLength, sha256: sha, rights });
  return { media, duplicate: false };
}

async function createMediaRecord(
  store: LocalStore,
  m: { id: string; originalKey: string; originalName: string; bytes: number; sha256: string; rights: Partial<MediaRights> },
): Promise<MediaRecord> {
  const now = new Date().toISOString();
  const rec: MediaRecord = {
    id: m.id,
    key: null,
    originalKey: m.originalKey,
    kind: 'video',
    originalName: m.originalName,
    bytes: m.bytes,
    sha256: m.sha256,
    status: 'processing',
    error: null,
    probe: null,
    posterKey: null,
    rights: MediaRightsSchema.parse(m.rights),
    createdAt: now,
    updatedAt: now,
  };
  await store.update((db) => {
    db.media.push(rec);
  });
  await store.enqueue('ingest_media', { mediaId: rec.id }, { idempotencyKey: `ingest:${rec.id}` });
  await store.log('info', 'media', `Registered ${m.originalName}`, { mediaId: rec.id, rightsStatus: rec.rights.status });
  return rec;
}

/** Next human-facing content id for a brand, e.g. TRS-20261122-03. */
export function nextContentId(brand: BrandId, existing: string[], now = new Date()): string {
  const prefix = `${brand === 'tiresias' ? 'TRS' : 'ATR'}-${now.toISOString().slice(0, 10).replace(/-/g, '')}-`;
  const used = existing.filter((c) => c.startsWith(prefix)).map((c) => Number(c.slice(prefix.length)) || 0);
  return `${prefix}${String((used.length ? Math.max(...used) : 0) + 1).padStart(2, '0')}`;
}

export async function createProject(mediaId: string, brand: BrandId, store: LocalStore = getStore()): Promise<ProjectRecord> {
  return store.update((db) => {
    const media = db.media.find((m) => m.id === mediaId);
    if (!media) throw new Error('Media not found');
    if (media.status !== 'ready' || !media.key || !media.probe) throw new Error('Media is not ready yet (still processing or failed).');
    const contentId = nextContentId(brand, db.projects.map((p) => p.spec.contentId));
    const { durationSec, width, height, fps } = media.probe;
    const spec = createDefaultSpec(brand, { src: media.key, durationSec, width, height, fps, attribution: media.rights.attributionText }, contentId);
    const now = new Date().toISOString();
    const project: ProjectRecord = {
      id: randomUUID(),
      brand,
      title: `${contentId} · ${media.originalName}`,
      status: 'needs_review',
      mediaId,
      spec,
      cover: {},
      notes: null,
      latestRenderId: null,
      createdAt: now,
      updatedAt: now,
    };
    db.projects.push(project);
    return project;
  });
}

/** Build the cover spec for a project (media keys, not URLs). */
export function coverForProject(project: ProjectRecord, headshotKey: string | null): CoverSpec {
  const base = coverFromVideoSpec(project.spec, project.cover.statValue ?? null);
  return {
    ...base,
    ...Object.fromEntries(Object.entries(project.cover).filter(([k, v]) => k !== 'headshotMediaId' && v !== undefined)),
    // Transparent PNGs are treated as cutouts (they break out of the colour block); other images are framed inside it.
    headshot: headshotKey ? { src: headshotKey, focusX: 0.5, focusY: 0.3, scale: 1, cutout: headshotKey.toLowerCase().endsWith('.png') } : null,
  } as CoverSpec;
}

/**
 * Register the synthetic fixtures (owned outright) and create one demo project
 * per brand. Idempotent: re-running reuses existing records.
 */
export async function seedDemoProjects(samples: VideoSpec[], store: LocalStore = getStore()): Promise<ProjectRecord[]> {
  const out: ProjectRecord[] = [];
  for (const sample of samples) {
    const fixture = mediaKeyToPath(sample.source.src);
    if (!existsSync(fixture)) throw new Error(`Fixture missing: ${sample.source.src}. Run "npm run fixtures".`);
    const sha = await sha256File(fixture);
    let media = (await store.read()).media.find((m) => m.sha256 === sha);
    if (!media) {
      const id = randomUUID();
      const originalKey = `uploads/originals/${id}.mp4`;
      await mkdir(path.dirname(mediaKeyToPath(originalKey)), { recursive: true });
      await copyFile(fixture, mediaKeyToPath(originalKey));
      const gtFile = path.join(FIXTURES_DIR, path.basename(fixture, '.mp4') + '.json');
      const notes = existsSync(gtFile) ? JSON.parse(await readFile(gtFile, 'utf8')).notes : null;
      media = await createMediaRecord(store, {
        id,
        originalKey,
        originalName: path.basename(fixture),
        bytes: (await stat(fixture)).size,
        sha256: sha,
        rights: { ...ownedRights('Tiresias Content Engine (procedurally generated)', `Synthetic test footage. ${notes ?? ''}`.trim()), sourceProvider: 'synthetic_fixture' },
      });
    }
    const existing = (await store.read()).projects.find((p) => p.spec.contentId === sample.contentId);
    if (existing) {
      out.push(existing);
      continue;
    }
    const now = new Date().toISOString();
    const project: ProjectRecord = {
      id: randomUUID(),
      brand: sample.brand,
      title: `${sample.contentId} · Synthetic demo`,
      status: 'ready_to_render',
      mediaId: media.id,
      // The project points at the normalised upload once ingest finishes; until then the fixture key works.
      spec: sample,
      cover: sample.brand === 'tiresias'
        ? { statValue: 12, statLabel: 'ASSISTS (DEMO DATA)', statLine: '18p/4r/12a', statSub: '+9', teamName: 'Demo U' }
        : { statValue: 6, statLabel: 'TURNOVERS (DEMO DATA)', statLine: '7p/2r/3a', statSub: '-14', teamName: 'Demo U' },
      notes: 'Demo project on synthetic footage. Names and stats are fictional.',
      latestRenderId: null,
      createdAt: now,
      updatedAt: now,
    };
    await store.update((db) => {
      db.projects.push(project);
    });
    out.push(project);
  }
  return out;
}
