import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DATA_DIR, FIXTURES_DIR, mediaKeyToPath } from '../src/config';
import { runOnce } from '../src/jobs';
import { parseRange } from '../src/media-server';
import { LocalStore, nextContentId, redact, seedDemoProjects, createProject } from '../src/store';
import { SAMPLE_SPEC_TIRESIAS } from '@tiresias/video/samples';

describe('media keys', () => {
  it('uses the isolated test data dir', () => {
    expect(DATA_DIR).toContain('tiresias-test-');
  });
  it('maps allowed prefixes and rejects traversal', () => {
    expect(mediaKeyToPath('uploads/a.mp4')).toBe(path.join(DATA_DIR, 'uploads/a.mp4'));
    expect(mediaKeyToPath('fixtures/x.mp4')).toBe(path.join(FIXTURES_DIR, 'x.mp4'));
    for (const bad of ['../etc/passwd', 'uploads/../../etc/passwd', '/etc/passwd', 'db/store.json', 'fixtures/../../package.json', 'uploads\\..\\x']) {
      expect(() => mediaKeyToPath(bad), bad).toThrow();
    }
  });
});

describe('range parsing', () => {
  it('handles standard, open-ended and suffix ranges', () => {
    expect(parseRange('bytes=0-99', 1000)).toEqual({ start: 0, end: 99 });
    expect(parseRange('bytes=900-', 1000)).toEqual({ start: 900, end: 999 });
    expect(parseRange('bytes=-100', 1000)).toEqual({ start: 900, end: 999 });
    expect(parseRange('bytes=0-5000', 1000)).toEqual({ start: 0, end: 999 });
    expect(parseRange('bytes=2000-', 1000)).toBeNull();
    expect(parseRange(undefined, 1000)).toBeNull();
  });
});

describe('redaction', () => {
  it('removes secrets by key and by pattern', () => {
    const out = redact({ apiKey: 'abc', nested: { access_token: 'x', ok: 'fine' }, msg: 'used Bearer abcdefghijklmnop and sk-ant-12345678901' });
    expect(out.apiKey).toBe('[redacted]');
    expect(out.nested.access_token).toBe('[redacted]');
    expect(out.nested.ok).toBe('fine');
    expect(out.msg).not.toContain('abcdefghijklmnop');
    expect(out.msg).not.toContain('sk-ant-12345678901');
  });
});

describe('content ids', () => {
  it('increments per brand per day', () => {
    const d = new Date('2026-11-22T12:00:00Z');
    expect(nextContentId('tiresias', [], d)).toBe('TRS-20261122-01');
    expect(nextContentId('tiresias', ['TRS-20261122-01', 'TRS-20261122-07', 'ATR-20261122-09'], d)).toBe('TRS-20261122-08');
    expect(nextContentId('antitiresias', ['TRS-20261122-01'], d)).toBe('ATR-20261122-01');
  });
});

describe('job queue', () => {
  const store = new LocalStore(path.join(DATA_DIR, 'queue-test'));

  it('is idempotent per key', async () => {
    const a = await store.enqueue('render_project', { projectId: 'p1' }, { idempotencyKey: 'render:p1:abc' });
    const b = await store.enqueue('render_project', { projectId: 'p1' }, { idempotencyKey: 'render:p1:abc' });
    expect(b.id).toBe(a.id);
    expect((await store.read()).jobs).toHaveLength(1);
  });

  it('retries with backoff, then fails permanently', async () => {
    const job = await store.enqueue('render_project', { projectId: 'p2' }, { maxAttempts: 2 });
    const claimed = await store.claimNext();
    expect(claimed?.id).not.toBe(job.id); // p1 job is older and claimed first
    await store.finishJob(claimed!.id, { ok: true });
    const c2 = await store.claimNext();
    expect(c2?.id).toBe(job.id);
    const r1 = await store.finishJob(job.id, { ok: false, error: 'boom', retryable: true });
    expect(r1?.status).toBe('queued');
    expect(Date.parse(r1!.runAfter)).toBeGreaterThan(Date.now());
    expect(await store.claimNext()).toBeNull(); // backoff not elapsed
    await store.update((db) => {
      db.jobs.find((j) => j.id === job.id)!.runAfter = new Date(0).toISOString();
    });
    const c3 = await store.claimNext();
    expect(c3?.attempts).toBe(2);
    const r2 = await store.finishJob(job.id, { ok: false, error: 'boom again', retryable: true });
    expect(r2?.status).toBe('failed');
    const retried = await store.retry(job.id);
    expect(retried?.status).toBe('queued');
    expect(retried?.attempts).toBe(0);
  });

  it('cancels queued jobs immediately and running jobs cooperatively', async () => {
    const q = await store.enqueue('render_project', { projectId: 'p3' });
    expect((await store.requestCancel(q.id))?.status).toBe('cancelled');
    const r = await store.enqueue('render_project', { projectId: 'p4' });
    await store.update((db) => {
      db.jobs.filter((j) => j.status === 'queued' && j.id !== r.id).forEach((j) => (j.status = 'succeeded'));
    });
    const claimed = await store.claimNext();
    expect(claimed?.id).toBe(r.id);
    await store.requestCancel(r.id);
    expect((await store.setJobProgress(r.id, 0.5)).cancelRequested).toBe(true);
    const fin = await store.finishJob(r.id, { ok: false, error: 'Render cancelled', retryable: true });
    expect(fin?.status).toBe('cancelled');
  });

  it('recovers jobs orphaned by a crashed worker', async () => {
    const j = await store.enqueue('ingest_media', { mediaId: 'm1' });
    await store.update((db) => {
      const x = db.jobs.find((y) => y.id === j.id)!;
      Object.assign(x, { status: 'running', attempts: 1, startedAt: new Date(Date.now() - 3600_000).toISOString() });
    });
    expect(await store.recoverStale()).toBe(1);
    expect((await store.read()).jobs.find((y) => y.id === j.id)?.status).toBe('queued');
  });

  it('serialises concurrent writers across processes', async () => {
    const dir = path.join(DATA_DIR, 'lock-test');
    const script = `
      import { LocalStore } from ${JSON.stringify(path.resolve(__dirname, '../src/store/local-store.ts'))};
      const s = new LocalStore(${JSON.stringify(dir)});
      for (let i = 0; i < 25; i++) await s.log('info', 'test', 'p' + process.pid + '-' + i);
    `;
    const run = () =>
      new Promise<number>((resolve) => {
        const p = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script], { stdio: 'inherit', env: { ...process.env } });
        p.on('close', (code) => resolve(code ?? 1));
      });
    const codes = await Promise.all([run(), run(), run()]);
    expect(codes).toEqual([0, 0, 0]);
    expect((await new LocalStore(dir).read()).logs).toHaveLength(75);
  });
});

describe('ingest + project creation (real ffmpeg)', () => {
  const fixture = path.join(FIXTURES_DIR, 'synthetic_skip_pass.mp4');
  it.skipIf(!existsSync(fixture))('normalises a fixture, detects metadata and seeds a project', async () => {
    const store = new LocalStore();
    const [project] = await seedDemoProjects([SAMPLE_SPEC_TIRESIAS], store);
    expect(project.spec.contentId).toBe('TRS-DEMO-01');
    // the worker processes the ingest job
    expect(await runOnce(store)).toBe(true);
    const db = await store.read();
    const media = db.media.find((m) => m.id === project.mediaId)!;
    expect(media.status).toBe('ready');
    expect(media.rights.status).toBe('owned');
    expect(media.probe).toMatchObject({ width: 1920, height: 1080, fps: 30 });
    expect(media.probe!.durationSec).toBeCloseTo(8, 1);
    expect(existsSync(mediaKeyToPath(media.key!))).toBe(true);
    expect(existsSync(mediaKeyToPath(media.posterKey!))).toBe(true);
    // the seeded project now points at the normalised master
    expect(db.projects.find((p) => p.id === project.id)!.spec.source.src).toBe(media.key);
    // re-seeding is idempotent
    await seedDemoProjects([SAMPLE_SPEC_TIRESIAS], store);
    expect((await store.read()).media).toHaveLength(1);
    // a new editable project can be created from the ready media
    const p2 = await createProject(media.id, 'antitiresias', store);
    expect(p2.spec.brand).toBe('antitiresias');
    expect(p2.spec.contentId).toMatch(/^ATR-\d{8}-01$/);
    expect(p2.status).toBe('needs_review');
  });
});
