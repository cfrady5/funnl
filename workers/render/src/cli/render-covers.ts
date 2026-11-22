/**
 * Renders every cover variant for both brands for design review:
 *   cutout (owned synthetic cutout) · clip still · typography only
 *   npm run render:covers -w @tiresias/render-worker
 */
import { CoverSpecSchema, type CoverSpec } from '@tiresias/core';
import { SAMPLE_COVER } from '@tiresias/video/samples';
import path from 'node:path';
import { DATA_DIR } from '../config';
import { renderCover } from '../render';

const outDir = path.join(DATA_DIR, 'renders', 'covers');
const anti: Partial<CoverSpec> = { brand: 'antitiresias', contentId: 'ATR-DEMO-01', seriesTitle: 'NEGATIVE COURT VISION', playerName: 'Dex Holloway', kicker: 'turnovers:', statValue: 6, statLine: '7p/2r/3a', statSub: '-14', headline: 'SEE ABSOLUTELY NOTHING' };
const cutout = { src: 'fixtures/synthetic_player_cutout.png', focusX: 0.5, focusY: 0.3, scale: 1, cutout: true };

const variants: Array<[string, CoverSpec]> = [];
for (const [brand, base] of [['trs', SAMPLE_COVER], ['atr', { ...SAMPLE_COVER, ...anti }]] as const) {
  variants.push([`${brand}-cutout`, CoverSpecSchema.parse({ ...base, headshot: cutout, blockColor: brand === 'trs' ? '#1D1160' : null })]);
  variants.push([`${brand}-clip`, CoverSpecSchema.parse({ ...base })]);
  variants.push([`${brand}-type`, CoverSpecSchema.parse({ ...base, backdrop: null, blockColor: brand === 'trs' ? '#98002E' : null })]);
}
for (const [name, cover] of variants) {
  const r = await renderCover(cover, outDir, name);
  console.log(`${r.qa.passed ? 'PASS' : 'FAIL'} ${r.coverPath} (${(r.renderMs / 1000).toFixed(1)}s)`);
}
