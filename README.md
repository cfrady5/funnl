# Tiresias Content Engine

Automated basketball content production for two brands:
- **Tiresias** ("see what the box score can't") produces premium "can you see the pass?" court-vision challenges.
- **AntiTiresias** ("see absolutely nothing") produces comedic breakdowns of terrible decisions.

**Status:**
- **Phase 1** (video generator) is complete and verified.
- **Phase 2** (daily NBA ingestion → assist leaders → individual plays → clip references → candidates) is built and tested end to end against simulated providers. It is waiting on real API keys for verification. See [PLAN.md](PLAN.md).
Data, publishing and footage integrations are blocked on credentials and rights; see [INTEGRATIONS.md](INTEGRATIONS.md).

## Quick start
Requires Node ≥ 20, Python 3.11+, and ffmpeg/ffprobe on PATH. Remotion needs headless Chrome: set `REMOTION_BROWSER_EXECUTABLE`, or let Remotion download one.

```bash
npm install
python3 -m venv workers/analysis/.venv && workers/analysis/.venv/bin/pip install opencv-python-headless==4.12.0.88
cd workers/analysis && .venv/bin/python -m tiresias_analysis.fixtures.synthetic_court --out ../../fixtures && cd ../..

npm run render:sample          # → data/renders/samples/*.mp4, *.cover.png, *.qa.json
npm run build && (cd apps/web && npx next start)   # dashboard on :3000
npm run worker                 # in another terminal: ingest + render jobs
```
Open http://localhost:3000. On the Overview page, click **Load synthetic demo projects**, then open **Video Studio**.

### Phase 2: daily NBA data
```bash
npm run db:local -w @tiresias/data      # or use Supabase: DATABASE_URL=<Supabase Postgres connection string>
export DATABASE_URL=postgres://postgres:postgres@127.0.0.1:54329/postgres
export BALLDONTLIE_API_KEY=…            # GOAT tier (or 7-day trial) for play-by-play
export HIGHLIGHT_API_KEY=… HIGHLIGHTLY_API_KEY=…   # optional clip discovery
npm run worker                          # schedules 08:00 ET + retries; runs queued jobs
npm run probe:balldontlie -w @tiresias/data   # verify your key + assist format first
```
No keys yet? Use `npm run mock:providers -w @tiresias/data`, which serves fictional data and is clearly labelled in the UI.

## Layout
`packages/core` (spec, timeline, layout, validation, rights, scoring, dates, NBA play logic) · `packages/data` (Postgres, providers, daily pipeline) · `packages/video` (Remotion) · `apps/web` (dashboard) · `workers/render` (ingest, render, QA, store) · `workers/analysis` (Python fixtures, SFX, CV) · `supabase/` (migrations, seed).

Docs: [ARCHITECTURE](ARCHITECTURE.md) · [WORKFLOWS](WORKFLOWS.md) · [BRAND_GUIDELINES](BRAND_GUIDELINES.md) · [TESTING](TESTING.md) · [INTEGRATIONS](INTEGRATIONS.md)

> Local mode has no authentication. Run it on localhost only.
