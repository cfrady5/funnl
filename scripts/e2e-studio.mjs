/**
 * End-to-end check of the Phase 1 workflow through the real UI.
 * Requires: dashboard on BASE_URL (default http://localhost:3000), a running
 * worker (npm run worker) and the demo projects (POST /api/demo).
 *
 *   node scripts/e2e-studio.mjs [screenshotDir]
 */
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

// The environment's pre-installed Playwright is resolvable via require().
const { chromium } = createRequire(import.meta.url)('playwright');
const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const OUT = process.argv[2] ?? 'e2e-screenshots';
mkdirSync(OUT, { recursive: true });
const shot = (page, name) => page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
const step = (msg) => console.log(`• ${msg}`);
const assert = (cond, msg) => {
  if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`);
  console.log(`  ✓ ${msg}`);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
const consoleErrors = [];
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
page.on('pageerror', (e) => consoleErrors.push(e.message));

try {
  step('Video Studio lists the demo projects');
  await page.goto(`${BASE}/studio`);
  await page.getByText('TRS-DEMO-01').first().waitFor();
  await shot(page, '01-studio');

  step('Open the Tiresias project editor');
  await page.getByText('TRS-DEMO-01').first().click();
  await page.waitForURL(/\/studio\/[0-9a-f-]+$/);
  await page.getByText('Live preview').waitFor();
  await page.waitForTimeout(2500); // fonts + first player frame
  const playerText = () => page.locator('.__remotion-player').first().innerText();
  const currentHook = (await page.locator('label:has-text("Hook") input').inputValue()).toUpperCase();
  assert((await playerText()).includes(currentHook), `Remotion player renders the hook text ("${currentHook}")`);
  await shot(page, '02-editor');

  step('Change the hook and see the preview update live');
  const hook = page.locator('label:has-text("Hook") input');
  const newHook = currentHook === 'CAN YOU FIND THE SKIP PASS?' ? 'CAN YOU SEE THE SKIP PASS?' : 'CAN YOU FIND THE SKIP PASS?';
  await hook.fill(newHook);
  await page.waitForTimeout(600);
  assert((await playerText()).includes(newHook), 'preview reflects the edited hook');
  assert(await page.getByText('unsaved').isVisible(), 'editor marks the project unsaved');

  step('Drag passing option B on the source frame');
  const markerB = page.locator('button[title^="B:"]');
  const box = await markerB.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 30, box.y + box.height / 2 + 6, { steps: 6 });
  await page.mouse.up();
  const after = await markerB.boundingBox();
  assert(Math.abs(after.x - box.x) > 10, 'marker B moved with the pointer');
  // put it back roughly where it was so the render stays accurate
  await page.mouse.move(after.x + after.width / 2, after.y + after.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 6 });
  await page.mouse.up();

  step('Frame stepping moves exactly one frame');
  const frameLabel = page.locator('text=/frame \\d+/').first();
  const f0 = Number((await frameLabel.innerText()).match(/frame (\d+)/)[1]);
  await page.locator('button[title^="Forward 1 frame"]').click();
  const f1 = Number((await frameLabel.innerText()).match(/frame (\d+)/)[1]);
  assert(f1 === f0 + 1, `frame advanced ${f0} → ${f1}`);
  await page.locator('button[title^="Back 1 frame"]').click();

  step('Save');
  await page.getByRole('button', { name: 'Save' }).click();
  await page.getByText('Saved.').waitFor();

  step('Render MP4 + cover on the worker');
  await page.getByRole('button', { name: /Render MP4/ }).click();
  await page.getByText('QA passed').waitFor({ timeout: 300_000 });
  await shot(page, '03-rendered');
  const mp4 = await page.locator('a:has-text("MP4")').first().getAttribute('href');
  const png = await page.locator('a:has-text("Cover PNG")').first().getAttribute('href');
  const mp4Res = await page.request.get(`${BASE}${mp4}`);
  assert(mp4Res.ok() && mp4Res.headers()['content-type'] === 'video/mp4', `MP4 download works (${((await mp4Res.body()).length / 1e6).toFixed(1)} MB)`);
  const pngRes = await page.request.get(`${BASE}${png}`);
  assert(pngRes.ok() && pngRes.headers()['content-type'] === 'image/png', 'cover PNG download works');

  step('Approve (QA passed + owned synthetic footage)');
  await page.getByRole('button', { name: 'Approve' }).click();
  await page.getByText('Project approved.').waitFor();

  step('Approval is blocked when footage rights are unknown');
  const projectId = page.url().split('/').pop();
  const project = await (await page.request.get(`${BASE}/api/projects/${projectId}`)).json();
  const mediaId = project.media.id;
  const original = project.media.rights;
  await page.request.patch(`${BASE}/api/media/${mediaId}`, { data: { rights: { ...original, status: 'unknown' } } });
  const blocked = await page.request.post(`${BASE}/api/projects/${projectId}/status`, { data: { action: 'approve' } });
  const body = await blocked.json();
  assert(blocked.status() === 409 && body.blockers.some((b) => b.includes('Rights status is "unknown"')), 'approval refused with a rights reason');
  await page.request.patch(`${BASE}/api/media/${mediaId}`, { data: { rights: original } });

  step('Visit every dashboard section');
  for (const [p, name] of [['/', '04-overview'], ['/queue', '05-queue'], ['/discovery', '06-discovery'], ['/pipeline', '07-pipeline'], ['/integrations', '08-integrations'], ['/brand', '09-brand'], ['/logs', '10-logs'], ['/calendar', '11-calendar'], ['/analytics', '12-analytics']]) {
    const res = await page.goto(`${BASE}${p}`);
    assert(res.ok(), `${p} responds ${res.status()}`);
    await shot(page, name);
  }

  const relevantErrors = consoleErrors.filter((e) => !/Download the React DevTools|favicon/.test(e));
  assert(relevantErrors.length === 0, `no browser console errors${relevantErrors.length ? `: ${relevantErrors.join(' | ')}` : ''}`);
  console.log('\nE2E PASSED');
} catch (e) {
  await shot(page, 'failure').catch(() => undefined);
  console.error(e);
  console.error('Console errors:', consoleErrors);
  process.exitCode = 1;
} finally {
  await browser.close();
}
