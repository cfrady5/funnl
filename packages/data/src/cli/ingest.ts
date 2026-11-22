/**
 * Run the daily NBA pipeline for a date.
 *   npm run ingest -w @tiresias/data                      # previous New York game date
 *   npm run ingest -w @tiresias/data -- --date 2026-11-21
 *   npm run ingest -w @tiresias/data -- --from clips      # re-run from one stage
 *   npm run ingest -w @tiresias/data -- --mock            # SIMULATED providers (no keys)
 */
import { previousGameDate } from '@tiresias/core';
import { getDb } from '../db';
import { migrate } from '../migrate';
import { startMockProviders } from '../mock/server';
import { archiveTo, PIPELINE_STEPS, runDailyPipeline, type PipelineStep } from '../pipeline';
import { createBalldontlie } from '../providers/balldontlie';
import { createHighlightApi, createHighlightly } from '../providers/clips';

const arg = (n: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const date = arg('date') ?? previousGameDate();
const from = arg('from') as PipelineStep | undefined;
if (from && !PIPELINE_STEPS.includes(from)) throw new Error(`--from must be one of ${PIPELINE_STEPS.join(', ')}`);
const useMock = process.argv.includes('--mock');

const db = getDb();
await migrate(db);
const mock = useMock ? await startMockProviders() : null;
const env = mock ? { ...process.env, ...mock.env } : process.env;
if (mock) console.log('⚠ SIMULATED providers — fictional teams and players, not real NBA data.');
let runId: string | null = null;
const ctx = { env, onArchive: archiveTo(db, () => runId) };
const stats = createBalldontlie(ctx);
if (!stats.configured) {
  console.error('BALLDONTLIE_API_KEY is not set (or pass --mock).');
  process.exit(1);
}
const out = await runDailyPipeline({ db, date, stats, clips: [createHighlightApi(ctx), createHighlightly(ctx)], fromStep: from, trigger: 'manual', onRunId: (id) => (runId = id), log: (m) => console.log(m) });
runId = out.runId;
console.log(JSON.stringify({ date, status: out.status, incomplete: out.incompleteReason, summary: out.summary }, null, 2));
await mock?.close();
await db.end();
process.exit(out.status === 'succeeded' ? 0 : 1);
