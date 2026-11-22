# Workflows

## Today (Phase 1): manual production
1. **Play Discovery** → upload a clip and fill in the rights record. Unknown rights = internal preview only.
2. The worker ingests the clip as an `ingest_media` job: ffprobe validation (1–180 s, ≥640×360, ≥23 fps) → normalisation to 30 fps CFR with a 15-frame GOP → cut detection → poster.
3. **Video Studio** → New project (pick the clip and brand). In the editor:
   - scrub frame by frame (←/→, Shift for ten frames) and set clip in/out and the freeze (F);
   - drag A–D markers to the target players' feet and the white marker to the ball handler;
   - set the actual pass, best-supported option and decision quality;
   - write the hook and explanation; the preview updates live;
   - optionally drag label chips on the preview (Adjust labels).
4. **Render** queues a `render_project` job. The worker renders the MP4 and cover, normalises loudness, runs QA and writes a contact sheet plus the spec snapshot.
5. **Approve.** This requires QA to have passed and the footage to be cleared for social publication. Otherwise approval is refused with the reasons.
6. **Content Queue** → download the MP4 and PNG (Mode 1, manual).

## Daily NBA ingestion (Phase 2, built)
- **Schedule:** the worker ticks every minute. From 08:00 America/New_York it enqueues `daily_ingest` for the previous NBA date. If a run is incomplete or failed, it retries at +30, +90, +180 and +360 minutes (`dueScheduleSlots`, DST-safe). Each slot runs at most once (idempotency key `daily:<date>:<slot>`), and the ladder stops once a run completes with every game final.
- **Stages** (each is a `workflow_steps` row with its output; retry any stage from Daily Pipeline):
  1. **games:** `/nba/v1/games?dates[]=`. Unfinished games are flagged (`incomplete_reason`) and the run continues with final games only.
  2. **box_scores:** `/nba/v1/stats`. Player points must sum to each team's final score (`box_verified`).
  3. **leaders:** top 15 by assists (deterministic tie-breaks) plus top 10 by turnovers, frozen in `daily_leaders`.
  4. **plays:** `/nba/v1/plays` for the leaders' games; every play is stored.
  5. **events:** assists and turnovers are attributed to players and reconciled with the box score.
  6. **clips:** each configured clip provider. Unconfigured providers are skipped; one failing provider doesn't block the others.
  7. **links:** play-level clips are linked to assists by period, clock, wall clock, team and names.
  8. **candidates:** every leader's assist (Tiresias) and turnover (AntiTiresias) is scored transparently and starts as `awaiting_footage`.
- **Each morning:** Video Studio shows last night's top 5. Play Discovery lists each leader's plays with clip references. **Create video** attaches an authorised clip and opens a Phase 1 project pre-filled from the verified box score.
- **Run by hand:** `npm run ingest -w @tiresias/data -- --date YYYY-MM-DD [--from stage]`, or the dashboard buttons. Both enqueue work for the worker or run the CLI; nothing runs inside a web request.

## Jobs
- **Status flow:** `queued → running → succeeded | failed | cancelled`.
- **Retries:** exponential backoff from 15 s, capped at 10 min, up to `max_attempts`. Non-retryable errors (bad spec, missing asset, rejected media) fail immediately.
- **Cancel:** queued jobs cancel immediately. Running renders are aborted through Remotion's cancel signal.
- **Retry:** a failed or cancelled job can be re-queued from System Logs as a partial rerun.
- **Worker crash:** a job left `running` for more than 30 min is re-queued when the next worker starts.

## Content statuses
discovered · awaiting_footage · analyzing · needs_review · ready_to_render · rendering · ready_for_approval · approved · scheduled · published · failed · rejected

## Publishing modes
1. **Manual:** download files. Available now.
2. **Approval required:** drafts are generated automatically, then approved by a human. The approval gate exists now; scheduling comes in Phase 6.
3. **Automatic:** only with a verified integration, granted scopes and audit, cleared rights, passing QA, and no review flag. Failed publishes are never reported as success.
