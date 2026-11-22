import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

// Every test run gets an isolated data directory so it never touches ./data.
const dataDir = mkdtempSync(path.join(tmpdir(), 'tiresias-test-'));

export default defineConfig({
  test: {
    env: { TIRESIAS_DATA_DIR: dataDir },
    testTimeout: 120_000,
    hookTimeout: 120_000,
    fileParallelism: false,
  },
});
