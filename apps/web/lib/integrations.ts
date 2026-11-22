/**
 * Integration status as verified on 2026-11-22. "Verified" means checked
 * against the provider's own documentation (see INTEGRATIONS.md for sources).
 * Nothing here is reported as working until it has been exercised end to end.
 */
export type IntegrationState = 'working' | 'not_configured' | 'blocked' | 'not_recommended' | 'planned';

export interface Integration {
  name: string;
  category: 'Stats' | 'Clip discovery' | 'Footage' | 'Headshots' | 'AI' | 'Voice' | 'Publishing' | 'Infrastructure';
  state: IntegrationState;
  summary: string;
  needs: string;
}

export const INTEGRATIONS: Integration[] = [
  { name: 'Local upload + rights record', category: 'Footage', state: 'working', summary: 'Upload, SHA-256 de-duplication, ffprobe validation, 30 fps normalisation, cut detection, rights tracking.', needs: '—' },
  { name: 'Remotion + FFmpeg render worker', category: 'Infrastructure', state: 'working', summary: 'H.264/AAC 1080×1920 renders, −14 LUFS loudness normalisation, automated QA.', needs: 'Remotion company licence if the operating company has more than 3 people.' },
  { name: 'nba_api / stats.nba.com', category: 'Stats', state: 'blocked', summary: 'Unofficial wrapper. Scoreboard, BoxScoreTraditionalV3 and PlayByPlayV3 are documented in the wrapper. stats.nba.com often blocks cloud IPs. NBA terms limit the stats to news reporting or private non-commercial use.', needs: 'Network access to stats.nba.com (blocked in this environment) and a legal review for commercial use.' },
  { name: 'Sportradar NBA API', category: 'Stats', state: 'not_configured', summary: 'Licensed play-by-play and box scores. Authenticated with an x-api-key header. A 30-day trial is available.', needs: 'API key and network access to api.sportradar.com.' },
  { name: 'balldontlie', category: 'Stats', state: 'not_configured', summary: 'Low-cost box scores; player stats need the ALL-STAR tier ($9.99/mo). It has no play-level video IDs.', needs: 'API key and network access to api.balldontlie.io.' },
  { name: 'PlayDB (playdb.app)', category: 'Clip discovery', state: 'not_recommended', summary: 'Fan-built clip search. No public API was found. It says its clips come from NBA.com "for personal, non-commercial use only".', needs: 'Not integrable. It must not be scraped.' },
  { name: '“Highlight API”', category: 'Clip discovery', state: 'blocked', summary: 'highlightapi.com could not be resolved. The closest real product is Highlightly, which aggregates third-party highlight links and gives no video rights.', needs: 'Confirm which vendor is meant. Usable only for discovery metadata.' },
  { name: 'NBA video (via stats.nba.com video endpoints)', category: 'Footage', state: 'not_recommended', summary: 'VideoEventsAsset exposes clip URLs, but NBA terms bar public or commercial reuse.', needs: 'A written licence from the NBA or the rights holder.' },
  { name: 'Licensed headshots (Getty / provider)', category: 'Headshots', state: 'not_configured', summary: 'Getty is the NBA’s official photo agency, and NBA imagery needs approval. ESPN and NBA CDN headshots carry no reuse licence and are not used.', needs: 'A licence, or user-uploaded images with recorded rights. Covers fall back to typography only.' },
  { name: 'Anthropic API', category: 'AI', state: 'not_configured', summary: 'Will draft hooks, explanations and captions, grounded in verified data. Host reachable from this environment.', needs: 'ANTHROPIC_API_KEY (Phase 4).' },
  { name: 'TTS (ElevenLabs paid / OpenAI)', category: 'Voice', state: 'not_configured', summary: 'Renderer already supports voice-over with music ducking. ElevenLabs free tier has no commercial licence; OpenAI requires disclosing an AI voice.', needs: 'Provider key + plan with commercial rights.' },
  { name: 'TikTok Content Posting API', category: 'Publishing', state: 'not_configured', summary: 'Direct Post needs the video.publish scope. Unaudited clients can post only privately (SELF_ONLY). The upload-to-inbox flow needs video.upload. The cover is set by timestamp only.', needs: 'TikTok developer app, OAuth, and an audit for public posting (Phase 6).' },
  { name: 'Instagram Reels (Graph API)', category: 'Publishing', state: 'not_configured', summary: 'Flow: media_type=REELS container, then media_publish. cover_url is supported. Needs a professional account and instagram_business_content_publish.', needs: 'Meta app, a public HTTPS video URL, and a check of content_publishing_limit (Phase 6).' },
  { name: 'YouTube Data API (Shorts)', category: 'Publishing', state: 'not_configured', summary: 'Uses videos.insert. Uploads from unverified projects are private until they pass an audit. Custom thumbnails need a verified channel.', needs: 'Google Cloud project, OAuth, and an audit request (Phase 6).' },
  { name: 'Supabase (Postgres, Auth, Storage)', category: 'Infrastructure', state: 'not_configured', summary: 'Migrations and seed are written and tested against an embedded Postgres. The local file store is used until a project is connected.', needs: 'Supabase project URL and service role key. supabase.co must be reachable.' },
];
