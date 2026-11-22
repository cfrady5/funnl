# Integrations — verified capabilities and blockers (2026-11-22)

**Method.** This environment's network blocks most target hosts, so the facts below come from official documentation as surfaced by web search, plus the nba_api GitHub source. Re-read the live page before relying on exact numbers. Nothing is marked as working until it has been exercised end to end. This is not legal advice.

**Reachable from this environment:** npm, PyPI, `api.anthropic.com`, Google Fonts.
**Blocked:** stats.nba.com, cdn.nba.com, site.api.espn.com, api.balldontlie.io, playdb.app, highlightapi.com, open.tiktokapis.com, graph.facebook.com, supabase.com.

## Bottom line
**Footage rights are the critical-path blocker, not engineering.** No source found (NBA.com, nba_api video endpoints, PlayDB, Highlightly, the data vendors) grants a licence to republish NBA video on social platforms. The system therefore supports:
1. licensed footage, or footage with documented permission, entered through upload, with a rights record; and
2. owned synthetic footage, for testing.

A licence from the NBA or the relevant rights holder is needed before NBA footage can be published. An alternative product direction is original animated court diagrams built from licensed play-by-play data.

## Stats
| Source | Verified | Blockers |
|---|---|---|
| nba_api (MIT, unofficial) | Endpoints `ScoreboardV2/V3`, `BoxScoreTraditionalV3`, `PlayByPlayV3`, `VideoEventsAsset` (github.com/swar/nba_api docs). stats.nba.com needs browser-like headers. The README warns that cloud IPs (AWS/GCP/Azure) are often blocked. | NBA Terms (nba.com/termsofuse): stats only for news reporting or private non-commercial use, with attribution. A monetised channel needs legal review. |
| cdn.nba.com liveData | Used by nba_api's `live` module. | No official documentation; endpoints are undocumented. |
| Sportradar NBA | `x-api-key` header; 30-day trial (developer.sportradar.com). | Images add-on excludes name, image and likeness rights. |
| SportsDataIO | Sales-led production keys; headshots licensed via USA Today. | Pricing via sales. |
| balldontlie | `Authorization: <key>`; Free 5 req/min, ALL-STAR $9.99/mo (player stats), GOAT $39.99/mo. | No play-level video IDs. |

## Clip discovery
| Source | Verified | Decision |
|---|---|---|
| PlayDB (playdb.app) | Fan-built search, "not affiliated with the NBA". Clips are "sourced from NBA.com … for personal, non-commercial use only". No API found. | **Do not integrate or scrape.** |
| "Highlight API" (highlightapi.com) | The domain could not be resolved. The closest real product is **Highlightly** (highlightly.net): `x-rapidapi-key` header, NBA highlights aggregated from YouTube, X and Reddit with URL or `embedUrl`. | Metadata and discovery only, and only if this is the intended vendor (**please confirm**). It grants no video rights. |

## Headshots
- ESPN and NBA CDN headshots carry no reuse licence, so **they are not used**.
- Getty Images is the NBA's official photo agency. NBA imagery needs approval; editorial web use defaults to a 30-day display limit.
- Player publicity rights apply separately from photo copyright.
- Covers fall back to a typography-only layout. A user-uploaded image can be used when rights are recorded.

## Publishing
| Platform | Verified requirements |
|---|---|
| TikTok Content Posting API | Direct Post needs the `video.publish` scope. **Unaudited clients can post only `SELF_ONLY` (private)**, and the posting account must be private (otherwise 403 `unaudited_client_can_only_post_to_private_accounts`). Upload-to-inbox needs `video.upload`, with a limit of 5 pending shares per 24 h. Media is sent by `FILE_UPLOAD` or `PULL_FROM_URL`; the latter needs a verified domain. About 15 posts/day per creator. The cover is set only by `video_cover_timestamp_ms`, so the cover design should also appear in a video frame. |
| Instagram Reels | Needs a professional account and `instagram_business_content_publish` (Instagram Login). Flow: a container with `media_type=REELS` and `video_url` (public HTTPS) or a resumable upload, then `media_publish`. `cover_url` is supported. The daily limit varies by doc (50 vs 100), so query `content_publishing_limit`. Standard Access covers your own accounts. |
| YouTube Data API | Uses `videos.insert`. **Uploads from unverified projects (created after 2020-07-28) are locked private** until an audit is passed. Vertical videos up to 3 min are Shorts. `thumbnails.set` needs a phone-verified channel. Quota figures changed in 2025; check the Cloud Console. |

## Other
- **Remotion:** free for individuals and companies of up to 3 people. Above that a Company Licence is required: Automators $0.01/render with a $100/mo minimum, or Creators $25/seat/mo.
- **TTS:** the ElevenLabs free tier has no commercial licence. OpenAI TTS requires disclosing that the voice is AI-generated. Google Cloud TTS output may be used in media under the GCP terms.
- **Anthropic API:** reachable. Default model `claude-opus-5-5` ($4/$20 per MTok). Not yet called by the app.

## Credentials needed (only when that phase starts)
| Phase | What | Where |
|---|---|---|
| 2 | Stats provider key + network allowance for its host | env `STATS_PROVIDER`, `SPORTRADAR_API_KEY` / `BALLDONTLIE_API_KEY` |
| 4 | `ANTHROPIC_API_KEY` | env (never committed) |
| prod | Supabase URL, anon key, service role key | env |
| 6 | TikTok / Meta / Google OAuth apps | Supabase Vault |
