import { z } from 'zod';
import { fail, handle, ok, store } from '@/lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const { action } = z.object({ action: z.enum(['cancel', 'retry']) }).parse(await req.json());
  const job = action === 'cancel' ? await store().requestCancel(id) : await store().retry(id);
  if (!job) return fail(409, action === 'retry' ? 'Only failed or cancelled jobs can be retried.' : 'Job not found');
  await store().log('info', 'jobs', `Job ${action} requested`, { jobId: id });
  return ok(job);
});
