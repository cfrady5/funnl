# Implementation Plan — Tiresias Content Engine

Persistent, checkpointed plan. Status legend: ✅ done & verified · 🟡 partial · ⛔ blocked (external) · ⬜ not started.
Last updated: 2026-11-22.

## Phase 1 — Working video generator ✅

| Item | Status | Evidence |
|---|---|---|
| Monorepo (npm workspaces): `packages/core`, `packages/video`, `apps/web`, `workers/render`, `workers/analysis` | ✅ | `npm run typecheck` clean |
| Next.js 16 dashboard, Tailwind 4, shadcn-pattern components, Remotion Player | ✅ | `next build` passes |
| Remotion compositions: Tiresias Court Vision, AntiTiresias Negative Court Vision, both covers | ✅ | `npm run render:sample` |
| Synthetic, owned test footage with exact ground truth | ✅ | `npm run fixtures` |
| Upload authorised clip → validate → normalise (30 fps CFR, short GOP) → cut detection → poster | ✅ | `workers/render/test/store.test.ts` |
| Manual freeze-frame, frame-by-frame scrubbing, clip in/out | ✅ | `scripts/e2e-studio.mjs` |
| Manual A/B/C/D placement (drag on source frame) + label drag on preview | ✅ | e2e |
| Render MP4 (H.264/AAC 1080×1920 30 fps, −14 LUFS) + PNG cover | ✅ | QA 11/11 pass |
| Automated render QA (resolution, aspect, codec, fps, duration, audio, black frames, loudness, continuity, layout) | ✅ | `qa.ts` |
| Rights gate on approval | ✅ | e2e asserts block on unknown rights |
| Supabase migrations + seed + RLS, verified on embedded Postgres | ✅ | `migrations.test.ts` 12/12 |

## Phase 2 — NBA statistics ⛔ (blocked on network/credentials)
- Provider interface + pure ranking (`rankAssistLeaders`) and DST-safe date logic are done and tested.
- **Blocked:** this environment's network policy blocks stats.nba.com, cdn.nba.com, ESPN, balldontlie, Sportradar.
- **Decision needed from you:** provider. Recommendation: Sportradar NBA trial for play-by-play (licensed), or balldontlie ALL-STAR ($9.99/mo) for box scores only. nba_api is acceptable for internal analysis but NBA terms restrict commercial use.
- Next steps once unblocked: `StatsProvider` implementations, store into `games`/`player_game_stats`/`play_events`, reconcile totals (`verified` flag), bounded retry schedule for late/incomplete games.

## Phase 3 — Clip discovery 🟡
- ✅ Scoring (10 weighted, transparent factors) and selection (both modes, never substitutes ineligible clips).
- ✅ Manual upload + rights record = functional fallback.
- ⛔ PlayDB: no API; terms say personal/non-commercial. Will not integrate.
- ⛔ "Highlight API": domain unresolvable; closest product (Highlightly) aggregates third-party links with no video rights. Confirm intended vendor.
- ⬜ Link clips to play events (needs Phase 2 data).

## Phase 4 — Assisted analysis ⬜
- Frame extraction & cut detection exist (ffmpeg). Next: player/ball detection (YOLO-class model, licence check), tracking → `receiverTrack` + framing keyframes (both already consumed by the renderer), candidate freeze frames, option suggestions with confidence, Claude-drafted explanations grounded in extracted evidence (needs `ANTHROPIC_API_KEY`).
- Ground-truth fixtures make CV accuracy measurable without real footage.

## Phase 5 — Daily automation ⬜
- Scheduler at 08:00 America/New_York (`nextDailyRun` handles DST), `workflow_runs` idempotency keys, per-stage checkpoints and retries, budget enforcement via `daily_costs`, completion notification.

## Phase 6 — Publishing ⬜
- TikTok (audit required for public posts), Instagram Reels (professional account, `instagram_business_content_publish`), YouTube (audit required to leave private). Schema already prevents duplicate live posts and stores tokens only as Vault references.

## Phase 7 — Optimisation ⬜

## Operating cost estimate (5–8 videos/day)

Measured: one 22 s video + cover + QA = **~70–80 s** on 4 vCPU (render concurrency 2), ~9 MB output.

| Item | Type | Estimate |
|---|---|---|
| Render worker (4 vCPU / 8 GB VM, always on) | fixed | $20–40 / mo |
| Vercel Pro (Hobby is non-commercial only) | fixed | $20 / mo per member |
| Supabase Pro (8 GB DB, 100 GB storage included) | fixed | $25 / mo |
| Remotion company licence (only if >3 people) | fixed | from $100 / mo (Automators, $0.01/render) |
| Claude API — 3 calls/video on Claude Opus 5.5 ($4 in / $20 out per MTok): ~10k input tokens (incl. 3–4 sampled frames) + ~3k output | per video | ≈ $0.10 |
| Render compute (if billed per use) | per video | ≈ $0.002 |
| Storage | per video | ~20 MB (source master + render + cover); 30-day render retention ≈ 5 GB |
| TTS (optional, paid plan for commercial rights) | per video | ~$0.02–0.05 |

**Total:** ≈ $65–85/mo fixed (+$100 if the Remotion licence applies) plus ≈ $0.10–0.15 per video → **$15–36/mo variable at 5–8 videos/day**. Estimates, not quotes; verify prices at signup.
