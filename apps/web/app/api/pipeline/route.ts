import { previousGameDate } from '@tiresias/core';
import { PIPELINE_STEPS } from '@tiresias/data';
import { z } from 'zod';
import { handle, ok, store } from '@/lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Queue a daily NBA run (or a partial rerun from one stage) on the worker. Never runs in the request. */
export const POST = handle(async (req: Request) => {
  const body = z
    .object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), fromStep: z.enum(PIPELINE_STEPS).optional() })
    .parse(await req.json().catch(() => ({})));
  const date = body.date ?? previousGameDate();
  const job = await store().enqueue('daily_ingest', { date, trigger: body.fromStep ? 'retry' : 'manual', ...(body.fromStep ? { fromStep: body.fromStep } : {}) }, {
    idempotencyKey: `daily-manual:${date}:${body.fromStep ?? 'all'}:${Math.floor(Date.now() / 60_000)}`,
    maxAttempts: 2,
  });
  await store().log('info', 'pipeline', `Queued daily NBA run for ${date}${body.fromStep ? ` from ${body.fromStep}` : ''}`);
  return ok({ job }, { status: 202 });
});
