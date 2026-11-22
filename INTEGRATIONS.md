# Integrations: documented capabilities vs verified behaviour

Last reviewed **2026-11-22**. The facts below were read from each provider's own docs and OpenAPI specs (fetched directly, not from memory).

**Status vocabulary** (also shown live on the dashboard's Integrations page):
- **documented:** described in the provider's docs; not yet exercised.
- **mock-tested:** the real adapter (paths, params, auth headers, pagination, error handling) runs against a local simulated server that serves the documented response shapes.
- **verified:** a successful call to the provider's *official* host is recorded in `provider_requests`. Calls to the mock never count.

| Provider | Role | Status today |
|---|---|---|
| BALLDONTLIE | games, box scores, play-by-play | **mock-tested**. Real host reachable: it returns 401 for a placeholder key and the adapter reports "denied (key/tier)". **Not yet called with a real key.** |
| Highlight API | play-level clip discovery | **mock-tested**. Docs host reachable. The API host `api.highlightapi.com` is **unreachable from this environment** (the proxy reports no route / no public DNS even though the host is allowed). Run the probe locally. |
| Highlightly | game-level highlight discovery | **mock-tested**. Real host reachable: it returns 401/403 for a placeholder key. **Not yet called with a real key.** |
| Manual upload | authorised footage | **working** (Phase 1) |
| Sportradar | fallback stats | not integrated (kept as a fallback, per your decision) |
| PlayDB | — | not integrated: no API; clips are for personal, non-commercial use |

## BALLDONTLIE: https://docs.balldontlie.io, OpenAPI https://www.balldontlie.io/openapi/nba.yml
- **Auth:** `Authorization: <API_KEY>` with no "Bearer" prefix. Base `https://api.balldontlie.io`; the OpenAPI paths use `/nba/v1/...`.
- **Pricing:** priced per league. Annual billing saves 20%.

  | Tier | $/mo | req/min | NBA endpoints we need |
  |---|---|---|---|
  | Free | 0 | 5 | Games |
  | ALL-STAR | 9.99 | 60 | + Game Player Stats (`/stats`), so assist leaders are possible |
  | GOAT | 39.99 | 600 | + **Plays** (`/plays`), Box Scores. Needed for individual assists |

  A 7-day GOAT trial is available (card required, 5 req/min during the trial, one trial per league).
- **Endpoints used:**
  - `GET /nba/v1/games?dates[]=YYYY-MM-DD&per_page=100&cursor=`
  - `GET /nba/v1/stats?game_ids[]=…&per_page=100&cursor=`. Player stats; `min` is a string; `plus_minus` is nullable.
  - `GET /nba/v1/plays?game_id=`. Chronological plays with `order`, `type`, `text`, `period`, `clock` ("M:SS" or decimal seconds), `scoring_play`, `score_value`, `team`, `wallclock` and `participants[]` (player ids).
- **Pagination:** cursor-based. `meta.next_cursor` is *omitted* (not null) on the last page.
- **Game status:** `status_state` ∈ scheduled | in_progress | **final** | postponed | canceled | delayed | suspended | abandoned | unknown.
- **Assist linkage (the key Phase 2 risk):** plays have **no explicit assist field**, only `text` and `participants[]`. The docs' example plays show no assisted make, so the exact assist text format is **unverified**. The extractor:
  - accepts both `(Name assists)` (ESPN style) and `(F. Name N AST)` (official feed style);
  - resolves names against the game roster and never guesses between two candidates;
  - marks each attribution `confirmed` (name plus id in `participants`), `text_only` or `unresolved`;
  - reconciles every player's count with the box-score `ast`.

  The first real probe (below) settles the format.

## Highlight API: https://www.highlightapi.com/docs.html
- **What it is:** official team, league and broadcast-partner clips posted on X, matched by a model to the exact play in the official play-by-play.
- **Auth and endpoints:**
  - `X-API-Key` header. Base `https://api.highlightapi.com`.
  - `GET /v1/nba/games?date=` (U.S. Eastern date). Game id format is `nba-{date}-{away}-{home}`.
  - `GET /v1/nba/games/:id/clips?status=matched`.
- **Clip fields:** `tweetId`, `embedUrl`, `thumbnailUrl`, `matchConfidence` (high/medium/low), and `matchedPlay`. The matched play includes `timeActual`, `period`, `clock` (ISO duration `PT04M59.00S`), `player`, `teamTricode`, `description` and `assistPlayerNameInitial`.
- **Linking:** we join to BALLDONTLIE plays on period, clock, wall clock, team, assister and scorer.
- **Rights (verbatim):** "Do not download or re-host the video files… all playback goes through official X embeds." So clips are **discovery and reference only, never render sources**.
- **Limits and price:** Development tier 60 req/min, burst 120. No public price ("Get API Access").

## Highlightly: https://highlightly.net/nba-api/documentation/ (OpenAPI 4.1.4)
- **Base URL:** `https://nba.highlightly.net` (or the RapidAPI host). Header `x-rapidapi-key`, plus `x-rapidapi-host` only on RapidAPI.
- **Endpoint:** `GET /highlights?date=&timezone=America/New_York&leagueName=NBA&limit≤40&offset`.
- **Highlight fields:** `title`, `url`, `embedUrl`, `imgUrl`, `source` (e.g. youtube), `channel`, `type` (VERIFIED/UNVERIFIED), and `match{id, homeTeam.abbreviation, awayTeam.abbreviation}`. Highlights are **game-level**, not play-level.
- **Terms §6:** data may be stored and displayed in your own products. Images and visual content are "for identification purposes only", and commercial use of media requires your own permissions. → **link only, not renderable.**
- **Plans:** free to start; the Basic/Free plan "might have certain restrictions on highlights".

## Footage rights (unchanged policy)
No discovery provider supplies renderable footage. Videos render only from clips in the library whose rights record allows it. The architecture already has a `licensed_feed` clip-source slot (`acquisition: licensed_download`) for a future licensed NBA footage agreement.

## Verify with your own keys (reproducible, runs on any machine)
```bash
npm install
BALLDONTLIE_API_KEY=…  npm run probe:balldontlie  -w @tiresias/data -- --date 2026-11-21 --rpm 5
HIGHLIGHT_API_KEY=…    npm run probe:highlightapi -w @tiresias/data -- --date 2026-11-21
HIGHLIGHTLY_API_KEY=…  npm run probe:highlightly  -w @tiresias/data -- --date 2026-11-21
```
- **Output:** raw responses and a `report.json` under `data/probes/<provider>/<date>/`.
- **BALLDONTLIE report:** shows which endpoints your plan reaches, sample assist texts, the participants pattern, and whether every box-score assist was tied to exactly one play (`assistsVerified`).
- **Next step:** share the report if the verdict is NOT VERIFIED, and I'll adapt the parser to the real format.

## Network (cloud environment `funnl`)
- **Allowed hosts:** api/docs/www.balldontlie.io, highlightapi.com, www.highlightapi.com, api.highlightapi.com, highlightly.net, nba.highlightly.net, sports.highlightly.net, plus your Supabase host.
- **Proxy support:** provider scripts set `NODE_USE_ENV_PROXY=1` so Node's `fetch` honours `HTTPS_PROXY`. This is harmless where no proxy exists.

## Other services
- **TikTok:** Direct Post needs `video.publish`, and unaudited clients post `SELF_ONLY`.
- **Instagram:** Reels need a professional account and `instagram_business_content_publish`.
- **YouTube:** uploads from unverified projects stay private until audit.
- **Remotion:** a company licence is needed for teams of more than 3 people.
- **Claude API:** `claude-opus-5-5`, $4 / $20 per MTok.
- **Headshots:** no ESPN or NBA CDN images; only licensed or uploaded images with rights.
