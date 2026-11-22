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

## Phase 2 — Daily NBA data & play discovery 🟡 (built & mock-tested; awaiting real API keys)

### Audit (2026-11-22)
- Phase 1 entities (media, projects, renders, jobs) live in the local JSON `LocalStore`. The Supabase schema existed but nothing wrote to it.
- The pure logic Phase 2 needs already exists and is tested: `previousGameDate`, `nextDailyRun`, `rankAssistLeaders`, `scoreCandidate` and `selectClips`.
- The Daily Pipeline and Play Discovery pages were honest placeholders.
- Network: a dedicated `funnl` cloud environment now allows api.balldontlie.io, highlightapi.com and highlightly.net (plus their docs hosts).

### Provider facts (read from the providers' own docs and OpenAPI specs on 2026-11-22; see INTEGRATIONS.md)
| Provider | Role | Documented | Verified working |
|---|---|---|---|
| BALLDONTLIE | stats + play-by-play | games (free), `/nba/v1/stats` (ALL-STAR $9.99), `/nba/v1/plays` (**GOAT $39.99**). 7-day GOAT trial at 5 req/min. | host reachable, 401 without key. **Not yet called with a key.** |
| Highlight API | play-level clip discovery | official team/league X clips matched to exact PBP plays, incl. `assistPlayerNameInitial`. **Embed only — no download/re-host.** | host reachable. **No key.** |
| Highlightly | game-level highlight discovery | `/highlights?date=&timezone=`, YouTube etc. URLs/embeds. Terms grant data rights only, no media rights. | host reachable. **No key.** |
| Manual upload | authorised footage | — | ✅ working (Phase 1) |
| Sportradar | fallback stats | — | not integrated (fallback only) |

**Assist linkage risk:** BALLDONTLIE plays have no explicit assist field, only `text` + `participants[]`. The extractor parses "(Name assists)" from the text, checks the name against the participants and the game roster, and **reconciles per-player counts with box-score `ast`**. Unmatched plays are flagged and never guessed. The exact text format must be confirmed with one real call (`npm run probe:balldontlie`).

### Tasks
| # | Task | Status |
|---|---|---|
| 2.1 | Postgres data layer (`@tiresias/data`) over `DATABASE_URL` → Supabase in production. Local Postgres-protocol server (PGlite + multiplexer) and migration runner. | ✅ |
| 2.2 | Migration: provider request archive, clip references, assist/turnover columns on play events, run steps, leader views | ✅ |
| 2.3 | Pure NBA logic in core: clock parsing, name matching, assist/turnover extraction, box-score reconciliation, clip↔play linking | ✅ |
| 2.4 | HTTP client with rate limiting (token bucket), retry/backoff on 429/5xx, raw-response archive (source + retrieval timestamp) | ✅ |
| 2.5 | `StatsProvider`: BALLDONTLIE adapter (games, stats, plays) + Sportradar stub (not implemented, fallback) | 🟡 BALLDONTLIE adapter mock-tested; real key pending. Sportradar: fallback, not built |
| 2.6 | `ClipDiscoveryProvider` adapters: Highlight API (play-level), Highlightly (game-level), manual library, synthetic. Capability + rights flags per adapter. | 🟡 Highlight API + Highlightly adapters mock-tested; manual library working; licensed feed = placeholder |
| 2.7 | Daily ingestion workflow, checkpointed per stage: date → games → completeness → box scores → rank top 15 → plays → assists → clip discovery → linking → candidate scoring. Bounded retry for late or incomplete games. | ✅ |
| 2.8 | Scheduler in the worker: 08:00 America/New_York, idempotency key per date, retry ladder 08:00 / 08:30 / 09:30 / 11:00 / 14:00 | ✅ |
| 2.9 | Dashboard: Daily Pipeline (runs, stages, per-stage retry), Play Discovery (top 5 prominent, top 15, games, candidate plays with clip refs), Studio home "Last night" panel | ✅ |
| 2.10 | Candidate → video project. Uses the Phase 1 templates unchanged. Blocked to "awaiting footage" unless authorised footage is attached. | ✅ (needs authorised footage attached) |
| 2.11 | Reproducible local probe scripts for each provider (run with your keys), raw responses saved as test fixtures | ✅ |
| 2.12 | Tests: unit (pure logic), adapter contract tests against a local mock server serving doc-shaped responses, pipeline end-to-end on embedded Postgres | ✅ |

### Verified vs not (2026-11-22)
- ✅ The pipeline runs end to end through the real adapters, HTTP client and SQL, against Postgres and the simulated providers. It is driven by the worker's scheduler and by "Run now". 71 automated tests pass.
- ✅ The real BALLDONTLIE and Highlightly hosts answer from this environment; both reject a placeholder key, as expected.
- ⛔ Highlight API: the API host is unreachable from here (proxy reports no route). It must be verified locally with `npm run probe:highlightapi`.
- ⏳ **Not yet verified with real data:** assist-text format, real game/box/plays payloads, clip linking accuracy. One probe run with your keys settles this.

### Decisions needed
- BALLDONTLIE tier. ALL-STAR gives leaders only. GOAT is required for play-by-play, i.e. individual assists. Recommendation: start the 7-day GOAT trial, run the probe, then decide.
- Highlight API has no public price ("Get API Access"), so contact the vendor.

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
