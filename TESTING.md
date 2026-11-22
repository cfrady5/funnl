# Testing

No production NBA footage is needed. All tests use procedurally generated, owned footage.

| Command | What it covers | Result (2026-11-22) |
|---|---|---|
| `npm test -w @tiresias/core` | timeline integrity, layout and auto-framing, chip collision, validation, rights gate, America/New_York dates incl. DST gap/overlap, scoring, selection | 21/21 ✅ |
| `cd workers/render && npx vitest run test/store.test.ts` | media-key traversal, HTTP ranges, secret redaction, content IDs, job queue (idempotency, backoff, cancel, crash recovery), **3-process lock contention**, **real ffmpeg ingest** | 11/11 ✅ |
| `cd workers/render && npx vitest run test/migrations.test.ts` | Supabase migrations + seed on embedded Postgres (PGlite): constraints, idempotency, `claim_next_job` SKIP LOCKED, duplicate-publication guard, RLS by role, approval spoofing, Vault column privacy, admin-only audit log | 12/12 ✅ |
| `npm run render:sample` | renders both brands + covers and runs QA (resolution, aspect, H.264/yuv420p, 30 fps, exact duration, AAC, black frames, loudness, continuity, layout) | QA pass ✅ |
| `node scripts/e2e-studio.mjs <dir>` | real browser (Playwright): live preview edits, marker drag, single-frame stepping, save, worker render, MP4/PNG download, approve, rights-blocked approval, every page, zero console errors | pass ✅ |
| `npm run typecheck` / `next build` | all packages | clean ✅ |

## Fixtures
```
npm run fixtures   # writes fixtures/synthetic_*.mp4 + ground-truth JSON (~2 min)
```
Each JSON holds per-frame screen positions of all 10 players and the ball, the camera pan, the decision frame and the actual target. Phase 4 CV accuracy will be measured against it.

## Running the E2E locally
```
npm run build && (cd apps/web && npx next start) &
npm run worker &
curl -X POST localhost:3000/api/demo
node scripts/e2e-studio.mjs /tmp/e2e
```

## Visual review
Every render writes `<id>.contact.png`, one frame per scene, for fast human review. Screenshots from the E2E run are written to the given directory.

## Known gaps
- No automated pixel-diff test of compositions. Visual review is manual via contact sheets.
- The E2E needs a running server and worker; it is not wired into CI yet.
