import { mediaKeyToPath } from '@tiresias/render-worker/config';
import { contentTypeFor, parseRange } from '@tiresias/render-worker/media';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Serves stored media with HTTP range support (required for video scrubbing). */
export async function GET(req: Request, ctx: { params: Promise<{ key: string[] }> }) {
  const { key } = await ctx.params;
  let file: string;
  try {
    file = mediaKeyToPath(key.map(decodeURIComponent).join('/'));
  } catch {
    return new Response('Bad key', { status: 400 });
  }
  let size: number;
  try {
    const st = await stat(file);
    if (!st.isFile()) throw new Error();
    size = st.size;
  } catch {
    return new Response('Not found', { status: 404 });
  }
  const download = new URL(req.url).searchParams.get('download');
  const headers: Record<string, string> = {
    'Content-Type': contentTypeFor(file),
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, max-age=0, must-revalidate',
  };
  if (download) headers['Content-Disposition'] = `attachment; filename="${download.replace(/[^\w.\-]/g, '_')}"`;
  const range = parseRange(req.headers.get('range') ?? undefined, size);
  if (req.headers.get('range') && !range) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  if (range) {
    const body = Readable.toWeb(createReadStream(file, range)) as ReadableStream;
    return new Response(body, { status: 206, headers: { ...headers, 'Content-Range': `bytes ${range.start}-${range.end}/${size}`, 'Content-Length': String(range.end - range.start + 1) } });
  }
  return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream, { status: 200, headers: { ...headers, 'Content-Length': String(size) } });
}
