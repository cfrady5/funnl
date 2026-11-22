import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from '../migrate';

export function probeDir(provider: string, date: string) {
  const dir = path.join(repoRoot(), 'data', 'probes', provider, date);
  mkdirSync(dir, { recursive: true });
  return dir;
}
export function save(dir: string, name: string, data: unknown) {
  writeFileSync(path.join(dir, name), JSON.stringify(data, null, 2));
}
export function arg(n: string) {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
