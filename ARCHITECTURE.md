# Architecture

```
apps/web (Next.js 16, Vercel)          workers/render (Node, long-running VM)      workers/analysis (Python)
 ├─ dashboard pages (RSC)               ├─ job loop: claim → run → finish           ├─ synthetic fixture generator
 ├─ Video Studio (client)               ├─ ingest: ffprobe, normalise, cuts, poster ├─ SFX generator
 │   ├─ SourceStage (frame editor)      ├─ render: Remotion bundle → renderMedia    └─ (Phase 4) CV: detection/tracking
 │   └─ Remotion <Player> preview       ├─ loudnorm (two-pass EBU R128)
 └─ API routes (enqueue only,           └─ QA validator + contact sheet
    never render)
            │                                        │
            └──────────── store (LocalStore now → Supabase Postgres + Storage) ───────┘

packages/core   pure TS: VideoSpec/CoverSpec (zod), timeline, layout, validation, rights gate,
                scoring, NBA date/DST maths. Shared by browser, renderer and worker.
packages/video  Remotion compositions (CourtVision, Cover), fonts (OFL, latin + latin-ext), SFX.
```

## Key decisions

- **One spec, three consumers.** `VideoSpec` drives the Player preview, the server render and QA. `computeTimeline` and `layoutOptions` are pure functions, so the editor, the composition and the validator can never disagree about where a label sits or which source frame shows at frame N.
- **Media keys, not URLs.** Specs store storage keys (`uploads/…`). They are resolved at runtime to `/api/files/…` (browser), a loopback server (renderer) or signed URLs (production). `mediaKeyToPath` whitelists prefixes and rejects traversal.
- **No rendering in web requests.** API routes enqueue jobs. Idempotency keys hash the spec, so a double click never renders twice.
- **Rights are separate from discovery and acquisition.** Unknown rights allow an internal preview only. Approval requires `checkRights(…, 'social_publication')` and a QA-passing render.
- **Deterministic first.** Framing, label layout, QA, scoring and scheduling use no LLM. Claude will be used only for language generation and grounded interpretation (Phase 4+).
- **Local mode.** `LocalStore` is a JSON store with a cross-process lock and atomic writes, used for single-machine operation and tests. Production uses the schema in `supabase/migrations`, which has the same entities plus `claim_next_job()` built on `FOR UPDATE SKIP LOCKED`.

## Video format (timing configurable, default 22 s @ 30 fps)

| Scene | Default | Source playback |
|---|---|---|
| Hook | 0–3 s | build-up into the freeze (slows to 0.5× / holds if lead-in is short) |
| Decision | 3–7 s | frozen; flash + scanline; options pop in with sightlines from the ball handler |
| Countdown | 7–10 s | frozen; 3·2·1 ring with ticks |
| Reveal | 10–14 s | 0.7 s hold while the actual read is highlighted, then resumes at 1×; receiver ring follows `receiverTrack` |
| Explanation | 14–19 s | 0.5× replay from 1.2 s before the freeze |
| Outro | 19–22 s | blurred hold, engagement lines, brand lockup |

Layout: 1080×1920. Footage panel y 330–1210. Text safe area x 60–940, y 150–1500, clear of the TikTok, Reels and Shorts UI.

## Security
- Secrets come only from env vars and Supabase Vault (`publishing_accounts.credential_secret_id`). The column is unreadable through the API even for admins (tested).
- Log payloads pass through `redact()`, which removes secret-named keys and bearer and API-key patterns.
- RLS roles: viewer (read), editor (produce), admin (delete, settings, accounts, audit log). Workers use the service role.
- The local mode has **no authentication**. Bind it to localhost only. Supabase Auth is required before deploying.
