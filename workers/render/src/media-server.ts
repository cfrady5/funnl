import { createReadStream, statSync } from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { mediaKeyToPath } from './config';

const TYPES: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
};

export function contentTypeFor(file: string): string {
  return TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
}

/**
 * Parse a single HTTP Range header. Returns null when absent or unsatisfiable.
 */
export function parseRange(header: string | undefined, size: number): { start: number; end: number } | null {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m) return null;
  let start = m[1] === '' ? NaN : Number(m[1]);
  let end = m[2] === '' ? NaN : Number(m[2]);
  if (Number.isNaN(start)) {
    if (Number.isNaN(end)) return null;
    start = Math.max(0, size - end);
    end = size - 1;
  } else if (Number.isNaN(end) || end >= size) {
    end = size - 1;
  }
  if (start > end || start >= size) return null;
  return { start, end };
}

/**
 * Loopback-only static server so headless Chrome can read local media during
 * a render. Bound to 127.0.0.1 on an ephemeral port; never exposed.
 */
export async function startMediaServer(): Promise<{ url: (key: string) => string; close: () => Promise<void> }> {
  const server = http.createServer((req, res) => {
    try {
      const key = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname.replace(/^\/media\//, ''));
      const file = mediaKeyToPath(key);
      const st = statSync(file);
      if (!st.isFile()) throw new Error('not a file');
      const range = parseRange(req.headers.range, st.size);
      const headers: Record<string, string | number> = {
        'Content-Type': contentTypeFor(file),
        'Accept-Ranges': 'bytes',
        'Access-Control-Allow-Origin': '*',
      };
      if (range) {
        res.writeHead(206, { ...headers, 'Content-Range': `bytes ${range.start}-${range.end}/${st.size}`, 'Content-Length': range.end - range.start + 1 });
        createReadStream(file, range).pipe(res);
      } else {
        res.writeHead(200, { ...headers, 'Content-Length': st.size });
        createReadStream(file).pipe(res);
      }
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: (key: string) => (/^https?:\/\//.test(key) ? key : `http://127.0.0.1:${port}/media/${key.split('/').map(encodeURIComponent).join('/')}`),
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
