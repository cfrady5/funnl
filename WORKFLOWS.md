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

## Planned: daily automation (Phase 5)
08:00 America/New_York (`nextDailyRun`, DST-safe). Idempotency key: `daily:<brand>:<gameDate>`.
```
date → games → box scores → rank top 15 → play-by-play → candidate assists → acquire authorised clips
     → score → select (≤5 Tiresias, ≤3 AntiTiresias) → analyse → draft text (Claude) → render → notify
```
- **Checkpoints:** each stage is a `workflow_steps` row with a checkpoint, so stages can be retried individually.
- **Incomplete data:** if games are unfinished or the feed is delayed, retry on a bounded schedule (e.g. 08:00, 08:30, 09:30, 11:00), then mark the run `incomplete_reason` and continue with whatever is verified.
- **Shortfalls:** fewer qualifying clips produce fewer videos. Nothing is substituted.
- **Budget:** the run halts when `daily_costs.total_usd` would exceed the configured budget.

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
