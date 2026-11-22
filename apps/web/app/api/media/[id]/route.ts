import { MediaRightsSchema } from '@tiresias/core';
import { fail, handle, ok, readDb, store } from '@/lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const m = (await readDb()).media.find((x) => x.id === id);
  return m ? ok(m) : fail(404, 'Media not found');
});

/** Update the rights record. Every change is written to the audit log. */
export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const body = await req.json();
  const rights = MediaRightsSchema.parse(body.rights);
  const updated = await store().update((db) => {
    const m = db.media.find((x) => x.id === id);
    if (!m) throw new Error('Media not found');
    const before = m.rights.status;
    m.rights = { ...rights, verifiedAt: rights.verifiedBy ? new Date().toISOString() : rights.verifiedAt };
    m.updatedAt = new Date().toISOString();
    return { m, before };
  });
  await store().log('info', 'rights', `Rights for ${updated.m.originalName}: ${updated.before} → ${updated.m.rights.status}`, { mediaId: id });
  return ok(updated.m);
});
