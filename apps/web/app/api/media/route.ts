import { MediaRightsSchema } from '@tiresias/core';
import { registerUpload } from '@tiresias/render-worker/store';
import { handle, ok, readDb } from '@/lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = handle(async () => {
  const db = await readDb();
  return ok(db.media.slice().reverse());
});

/** Multipart upload: `file` + `rights` (JSON). Rights default to "unknown" (blocks publication). */
export const POST = handle(async (req: Request) => {
  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) throw new Error('No file uploaded');
  const rightsRaw = form.get('rights');
  const rights = MediaRightsSchema.parse(rightsRaw ? JSON.parse(String(rightsRaw)) : {});
  const { media, duplicate } = await registerUpload(Buffer.from(await file.arrayBuffer()), file.name, rights);
  return ok({ media, duplicate }, { status: duplicate ? 200 : 201 });
});
