/**
 * Phase 1 acceptance render: produces real MP4 + PNG files for both brands
 * from the synthetic fixtures and prints the QA report.
 *
 *   npm run render:sample                # both brands
 *   npm run render:sample -- tiresias    # one brand
 */
import { coverFromVideoSpec } from '@tiresias/core';
import { SAMPLE_SPEC_ANTI, SAMPLE_SPEC_TIRESIAS } from '@tiresias/video/samples';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { DATA_DIR, mediaKeyToPath } from '../config';
import { renderCover, renderVideo } from '../render';

const which = process.argv[2];
const specs = [SAMPLE_SPEC_TIRESIAS, SAMPLE_SPEC_ANTI].filter((s) => !which || s.brand === which);
const outDir = path.join(DATA_DIR, 'renders', 'samples');

for (const spec of specs) {
  if (!existsSync(mediaKeyToPath(spec.source.src))) {
    console.error(`Fixture ${spec.source.src} is missing. Run: npm run fixtures`);
    process.exit(1);
  }
  console.log(`\n▶ Rendering ${spec.contentId} (${spec.brand})`);
  let last = -1;
  const v = await renderVideo(spec, outDir, {
    onProgress: (p) => {
      const pct = Math.floor(p * 10) * 10;
      if (pct !== last) {
        last = pct;
        process.stdout.write(`${pct}% `);
      }
    },
  });
  console.log(`\n  video  ${v.videoPath} (${(v.bytes / 1e6).toFixed(1)} MB, ${(v.renderMs / 1000).toFixed(1)} s)`);
  for (const c of v.qa.checks) console.log(`  [${c.status.toUpperCase().padEnd(4)}] ${c.id}: ${c.detail}`);
  const statValue = spec.brand === 'tiresias' ? 12 : 6; // fictional demo values, labelled DEMO on the cover
  const cover = { ...coverFromVideoSpec(spec, statValue), statLabel: spec.brand === 'tiresias' ? 'ASSISTS (DEMO DATA)' : 'TURNOVERS (DEMO DATA)' };
  const c = await renderCover(cover, outDir);
  console.log(`  cover  ${c.coverPath} (${(c.renderMs / 1000).toFixed(1)} s)`);
  for (const ch of c.qa.checks) console.log(`  [${ch.status.toUpperCase().padEnd(4)}] ${ch.id}: ${ch.detail}`);
  console.log(`  QA ${v.qa.passed && c.qa.passed ? 'PASSED' : 'FAILED'}`);
}
