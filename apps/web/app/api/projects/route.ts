import { BRAND_IDS } from '@tiresias/core';
import { createProject } from '@tiresias/render-worker/store';
import { z } from 'zod';
import { handle, ok, readDb } from '@/lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = handle(async () => {
  const db = await readDb();
  return ok(db.projects.slice().reverse());
});

export const POST = handle(async (req: Request) => {
  const body = z.object({ mediaId: z.string().uuid(), brand: z.enum(BRAND_IDS) }).parse(await req.json());
  const project = await createProject(body.mediaId, body.brand);
  return ok(project, { status: 201 });
});
