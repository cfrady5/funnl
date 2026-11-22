import { dueScheduleSlots } from '@tiresias/core';
import { archiveTo, clipProviders, createBalldontlie, getDb, latestRunStatus, migrate, PIPELINE_STEPS, runDailyPipeline, type PipelineStep } from '@tiresias/data';
import type { JobRecord, LocalStore } from './store';

let migrated = false;

/** Job handler: run (or resume) the daily NBA pipeline for one date. */
export async function dailyIngest(job: JobRecord, store: LocalStore): Promise<void> {
  const db = getDb();
  if (!migrated) {
    await migrate(db);
    migrated = true;
  }
  const date = job.payload.date;
  const fromStep = job.payload.fromStep as PipelineStep | undefined;
  if (fromStep && !PIPELINE_STEPS.includes(fromStep)) throw new Error(`Unknown step ${fromStep}`);
  let runId: string | null = null;
  const ctx = { onArchive: archiveTo(db, () => runId) };
  const stats = createBalldontlie(ctx);
  if (!stats.configured) throw new Error('BALLDONTLIE_API_KEY is not configured for the worker.');
  const out = await runDailyPipeline({
    db,
    date,
    stats,
    clips: clipProviders(ctx),
    fromStep,
    onRunId: (id) => (runId = id),
    trigger: (job.payload.trigger as 'schedule' | 'manual' | 'retry') ?? 'manual',
    log: (m) => void store.log('info', 'pipeline', `${date} ${m}`),
  });
  runId = out.runId;
  await store.log(out.status === 'succeeded' ? 'info' : 'error', 'pipeline', `Daily NBA run for ${date}: ${out.status}${out.incompleteReason ? ` (incomplete: ${out.incompleteReason})` : ''}`, { runId: out.runId });
  if (out.status === 'failed') throw new Error(`Pipeline failed: ${JSON.stringify(out.summary).slice(0, 300)}`);
}

/**
 * Scheduler tick (called every minute by the worker). Enqueues one job per due
 * slot of the retry ladder; each slot has its own idempotency key, so a slot
 * runs at most once. Later slots are skipped once a run is complete.
 */
export async function scheduleTick(store: LocalStore, now = new Date()): Promise<string[]> {
  if (!process.env.DATABASE_URL || !process.env.BALLDONTLIE_API_KEY) return [];
  const settings = (await store.read()).settings;
  const { gameDate, slots } = dueScheduleSlots(now, settings.dailyRunTime, settings.timezone);
  if (!slots.length) return [];
  const status = await latestRunStatus(getDb(), gameDate);
  if (status?.complete) return [];
  const enqueued: string[] = [];
  for (const slot of slots) {
    const job = await store.enqueue('daily_ingest', { date: gameDate, trigger: slot === slots[0] && !status ? 'schedule' : 'retry' }, { idempotencyKey: `daily:${gameDate}:${slot}`, maxAttempts: 2 });
    if (job.createdAt >= new Date(now.getTime() - 5_000).toISOString()) enqueued.push(slot);
  }
  return enqueued;
}
