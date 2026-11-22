import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { mkdir, readFile, rename, rmdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DATA_DIR } from '../config';
import { DEFAULT_SETTINGS, type DbShape, type JobRecord, type JobType, type LogRecord } from './types';

const EMPTY: DbShape = { media: [], projects: [], renders: [], jobs: [], logs: [], settings: DEFAULT_SETTINGS };
const MAX_LOGS = 2000;

/** Redact anything that looks like a credential before it reaches a log. */
export function redact<T>(value: T): T {
  const SECRET_KEY = /(token|secret|password|authorization|api[_-]?key|cookie)/i;
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') {
      return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, SECRET_KEY.test(k) ? '[redacted]' : walk(x)]));
    }
    if (typeof v === 'string') return v.replace(/(sk-[A-Za-z0-9_-]{8,}|Bearer\s+[A-Za-z0-9._-]{8,})/g, '[redacted]');
    return v;
  };
  return walk(value) as T;
}

/**
 * File-backed store for local development and single-machine operation.
 * Cross-process safety: a lock directory (atomic mkdir) serialises every
 * read-modify-write; writes go to a temp file and are renamed into place.
 * Production uses the Supabase/Postgres schema in /supabase/migrations.
 */
export class LocalStore {
  readonly dir: string;
  private readonly file: string;
  private readonly lockDir: string;

  constructor(dataDir = DATA_DIR) {
    this.dir = path.join(dataDir, 'db');
    this.file = path.join(this.dir, 'store.json');
    this.lockDir = path.join(this.dir, '.lock');
    if (!existsSync(this.dir)) mkdirSync(this.dir, { recursive: true });
  }

  private async acquire(): Promise<void> {
    const deadline = Date.now() + 15_000;
    for (;;) {
      try {
        await mkdir(this.lockDir);
        return;
      } catch {
        try {
          const st = await stat(this.lockDir);
          if (Date.now() - st.mtimeMs > 10_000) await rmdir(this.lockDir).catch(() => undefined); // stale lock
        } catch {
          /* raced with release */
        }
        if (Date.now() > deadline) throw new Error('Timed out waiting for store lock');
        await new Promise((r) => setTimeout(r, 15 + Math.random() * 25));
      }
    }
  }

  private async release(): Promise<void> {
    await rmdir(this.lockDir).catch(() => undefined);
  }

  async read(): Promise<DbShape> {
    try {
      const parsed = JSON.parse(await readFile(this.file, 'utf8')) as Partial<DbShape>;
      return { ...EMPTY, ...parsed, settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) } };
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return structuredClone(EMPTY);
      throw e;
    }
  }

  /** Atomic read-modify-write. */
  async update<T>(fn: (db: DbShape) => T | Promise<T>): Promise<T> {
    await this.acquire();
    try {
      const db = await this.read();
      const result = await fn(db);
      if (db.logs.length > MAX_LOGS) db.logs = db.logs.slice(-MAX_LOGS);
      const tmp = `${this.file}.${process.pid}.${randomUUID()}.tmp`;
      await writeFile(tmp, JSON.stringify(db));
      await rename(tmp, this.file);
      return result;
    } finally {
      await this.release();
    }
  }

  async log(level: LogRecord['level'], scope: string, message: string, data?: Record<string, unknown>): Promise<void> {
    await this.update((db) => {
      db.logs.push({ id: randomUUID(), at: new Date().toISOString(), level, scope, message, data: data ? redact(data) : undefined });
    });
  }

  /**
   * Enqueue a job. With an idempotency key, an existing non-failed job with the
   * same key is returned instead of creating a duplicate.
   */
  async enqueue(type: JobType, payload: Record<string, string>, opts: { idempotencyKey?: string; maxAttempts?: number } = {}): Promise<JobRecord> {
    return this.update((db) => {
      if (opts.idempotencyKey) {
        const existing = db.jobs.find((j) => j.idempotencyKey === opts.idempotencyKey && j.status !== 'failed' && j.status !== 'cancelled');
        if (existing) return existing;
      }
      const now = new Date().toISOString();
      const job: JobRecord = {
        id: randomUUID(),
        type,
        payload,
        status: 'queued',
        idempotencyKey: opts.idempotencyKey ?? null,
        attempts: 0,
        maxAttempts: opts.maxAttempts ?? db.settings.maxJobAttempts,
        progress: 0,
        runAfter: now,
        cancelRequested: false,
        lastError: null,
        createdAt: now,
        startedAt: null,
        finishedAt: null,
      };
      db.jobs.push(job);
      return job;
    });
  }

  /** Claim the oldest runnable job (single worker or many — the lock makes it exclusive). */
  async claimNext(types?: JobType[]): Promise<JobRecord | null> {
    return this.update((db) => {
      const now = Date.now();
      const job = db.jobs
        .filter((j) => j.status === 'queued' && !j.cancelRequested && Date.parse(j.runAfter) <= now && (!types || types.includes(j.type)))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
      if (!job) return null;
      job.status = 'running';
      job.attempts += 1;
      job.startedAt = new Date().toISOString();
      job.progress = 0;
      return structuredClone(job);
    });
  }

  async finishJob(id: string, outcome: { ok: true } | { ok: false; error: string; retryable: boolean }): Promise<JobRecord | null> {
    return this.update((db) => {
      const job = db.jobs.find((j) => j.id === id);
      if (!job) return null;
      if (outcome.ok) {
        job.status = 'succeeded';
        job.progress = 1;
        job.finishedAt = new Date().toISOString();
        job.lastError = null;
      } else if (job.cancelRequested) {
        job.status = 'cancelled';
        job.finishedAt = new Date().toISOString();
        job.lastError = outcome.error;
      } else if (outcome.retryable && job.attempts < job.maxAttempts) {
        const backoffMs = Math.min(10 * 60_000, 15_000 * 2 ** (job.attempts - 1));
        job.status = 'queued';
        job.runAfter = new Date(Date.now() + backoffMs).toISOString();
        job.lastError = outcome.error;
      } else {
        job.status = 'failed';
        job.finishedAt = new Date().toISOString();
        job.lastError = outcome.error;
      }
      return structuredClone(job);
    });
  }

  async setJobProgress(id: string, progress: number): Promise<{ cancelRequested: boolean }> {
    return this.update((db) => {
      const job = db.jobs.find((j) => j.id === id);
      if (!job) return { cancelRequested: true };
      job.progress = Math.round(progress * 1000) / 1000;
      return { cancelRequested: job.cancelRequested };
    });
  }

  async requestCancel(id: string): Promise<JobRecord | null> {
    return this.update((db) => {
      const job = db.jobs.find((j) => j.id === id);
      if (!job) return null;
      if (job.status === 'queued') {
        job.status = 'cancelled';
        job.finishedAt = new Date().toISOString();
      }
      job.cancelRequested = true;
      return structuredClone(job);
    });
  }

  /** Re-queue a failed/cancelled job as a fresh attempt series (partial rerun). */
  async retry(id: string): Promise<JobRecord | null> {
    return this.update((db) => {
      const job = db.jobs.find((j) => j.id === id);
      if (!job || (job.status !== 'failed' && job.status !== 'cancelled')) return null;
      Object.assign(job, { status: 'queued', attempts: 0, cancelRequested: false, runAfter: new Date().toISOString(), finishedAt: null, progress: 0 });
      return structuredClone(job);
    });
  }

  /** Jobs left "running" by a crashed worker go back to the queue. */
  async recoverStale(maxRunningMs = 30 * 60_000): Promise<number> {
    return this.update((db) => {
      let n = 0;
      for (const j of db.jobs) {
        if (j.status === 'running' && j.startedAt && Date.now() - Date.parse(j.startedAt) > maxRunningMs) {
          j.status = j.attempts < j.maxAttempts ? 'queued' : 'failed';
          j.lastError = 'Worker stopped while job was running';
          n++;
        }
      }
      return n;
    });
  }
}

let singleton: LocalStore | null = null;
export function getStore(): LocalStore {
  if (!singleton) singleton = new LocalStore();
  return singleton;
}
