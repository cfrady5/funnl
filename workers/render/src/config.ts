import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Repo root: TIRESIAS_ROOT if set, else the nearest ancestor of the working
 * directory that contains packages/video (works when this module is bundled by
 * Next.js, where import.meta.url points into .next/), else relative to this file.
 */
function findRepoRoot(): string {
  if (process.env.TIRESIAS_ROOT) return path.resolve(process.env.TIRESIAS_ROOT);
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    if (existsSync(path.join(dir, 'packages/video/public')) && existsSync(path.join(dir, 'workers/render'))) return dir;
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
}
export const REPO_ROOT = findRepoRoot();
export const VIDEO_PKG = path.join(REPO_ROOT, 'packages/video');
export const REMOTION_ENTRY = path.join(VIDEO_PKG, 'src/remotion-entry.ts');
export const REMOTION_PUBLIC = path.join(VIDEO_PKG, 'public');
export const FIXTURES_DIR = path.join(REPO_ROOT, 'fixtures');

/** Local runtime data (uploads, renders, job store). Supabase replaces this in production. */
export const DATA_DIR = path.resolve(process.env.TIRESIAS_DATA_DIR ?? path.join(REPO_ROOT, 'data'));

const BROWSER_CANDIDATES = [
  process.env.REMOTION_BROWSER_EXECUTABLE,
  '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell',
];

/** Headless Chrome for Remotion. Null lets Remotion download its own (needs network). */
export function browserExecutable(): string | null {
  for (const c of BROWSER_CANDIDATES) if (c && existsSync(c)) return c;
  return null;
}

/** Media keys are storage-relative paths. `fixtures/` maps to the repo, everything else to DATA_DIR. */
export const MEDIA_KEY_PREFIXES = ['uploads/', 'renders/', 'fixtures/'] as const;

export function mediaKeyToPath(key: string): string {
  if (key.includes('\0') || key.includes('\\')) throw new Error('Invalid media key');
  const clean = path.posix.normalize(key);
  if (clean.startsWith('../') || clean.startsWith('/') || !MEDIA_KEY_PREFIXES.some((p) => clean.startsWith(p))) {
    throw new Error(`Invalid media key: ${key}`);
  }
  const root = clean.startsWith('fixtures/') ? FIXTURES_DIR : DATA_DIR;
  const rel = clean.startsWith('fixtures/') ? clean.slice('fixtures/'.length) : clean;
  const abs = path.resolve(root, rel);
  if (!abs.startsWith(root + path.sep)) throw new Error(`Invalid media key: ${key}`);
  return abs;
}

export const RENDER_DEFAULTS = {
  crf: 18,
  concurrency: Math.max(1, Math.min(4, Number(process.env.RENDER_CONCURRENCY ?? 2))),
  loudnessTargetLufs: -14,
  truePeakDb: -1.5,
};
