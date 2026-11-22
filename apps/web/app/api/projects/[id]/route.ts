import { CoverSpecSchema, VideoSpecSchema, validateSpec } from '@tiresias/core';
import { z } from 'zod';
import { fail, handle, ok, readDb, store } from '@/lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const db = await readDb();
  const project = db.projects.find((p) => p.id === id);
  if (!project) return fail(404, 'Project not found');
  return ok({
    project,
    media: db.media.find((m) => m.id === project.mediaId) ?? null,
    renders: db.renders.filter((r) => r.projectId === id).reverse(),
    jobs: db.jobs.filter((j) => j.payload.projectId === id).reverse().slice(0, 10),
  });
});

const CoverPatch = CoverSpecSchema.pick({ headline: true, seriesTitle: true, statLabel: true, statValue: true, teamName: true }).partial();

export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const body = z.object({ spec: z.unknown().optional(), cover: CoverPatch.optional(), title: z.string().min(1).max(120).optional() }).parse(await req.json());
  const result = await store().update((db) => {
    const p = db.projects.find((x) => x.id === id);
    if (!p) throw new Error('Project not found');
    const media = db.media.find((m) => m.id === p.mediaId);
    if (body.spec !== undefined) {
      const spec = VideoSpecSchema.parse(body.spec);
      // The source can only ever be this project's own media file.
      if (media?.key && spec.source.src !== media.key && spec.source.src !== p.spec.source.src) throw new Error('Spec source does not match the project media.');
      p.spec = spec;
      if (['rendering'].includes(p.status) === false) p.status = 'ready_to_render';
    }
    if (body.cover) p.cover = { ...p.cover, ...body.cover };
    if (body.title) p.title = body.title;
    p.updatedAt = new Date().toISOString();
    return p;
  });
  return ok({ project: result, issues: validateSpec(result.spec) });
});

export const DELETE = handle(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  await store().update((db) => {
    const p = db.projects.find((x) => x.id === id);
    if (!p) throw new Error('Project not found');
    if (['scheduled', 'published'].includes(p.status)) throw new Error('Scheduled or published content cannot be deleted.');
    db.projects = db.projects.filter((x) => x.id !== id);
  });
  await store().log('info', 'project', 'Deleted project', { projectId: id });
  return ok({ deleted: true });
});
