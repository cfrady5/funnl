import { hasBlockingIssues, validateSpec } from '@tiresias/core';
import { createHash } from 'node:crypto';
import { fail, handle, ok, readDb, store } from '@/lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Enqueue a render on the worker. Rendering never runs inside the web request.
 * Idempotent per (project, spec, cover): double-clicks do not create duplicate jobs.
 */
export const POST = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const db = await readDb();
  const p = db.projects.find((x) => x.id === id);
  if (!p) return fail(404, 'Project not found');
  const media = db.media.find((m) => m.id === p.mediaId);
  if (!media || media.status !== 'ready') return fail(409, 'Source media is not ready.');
  const issues = validateSpec(p.spec);
  if (hasBlockingIssues(issues)) return fail(422, 'Fix the blocking issues before rendering.', issues);
  const hash = createHash('sha256').update(JSON.stringify({ spec: p.spec, cover: p.cover })).digest('hex').slice(0, 16);
  const job = await store().enqueue('render_project', { projectId: id }, { idempotencyKey: `render:${id}:${hash}` });
  return ok({ job }, { status: 202 });
});
