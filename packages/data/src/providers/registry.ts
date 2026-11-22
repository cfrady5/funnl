import { createBalldontlie } from './balldontlie';
import { createHighlightApi, createHighlightly } from './clips';
import type { ClipDiscoveryProvider, ProviderContext, StatsProvider } from './types';

/**
 * Every clip source the system knows about. Only sources with
 * acquisition = licensed_download (or authorised manual uploads) can supply
 * footage for rendering; the rest are for discovery, linking and reference.
 */
export const CLIP_SOURCE_CATALOG = [
  { id: 'highlightapi', name: 'Highlight API', granularity: 'play', acquisition: 'none', display: 'embed_only', note: 'Official team/league X clips matched to exact plays. Playback via X embed only.' },
  { id: 'highlightly', name: 'Highlightly', granularity: 'game', acquisition: 'none', display: 'link_only', note: 'Game highlights aggregated from YouTube and other platforms. Data rights only.' },
  { id: 'manual_upload', name: 'Manual upload', granularity: 'play', acquisition: 'licensed_download', display: 'file', note: 'Footage you upload with a rights record. The only renderable source today.' },
  { id: 'licensed_feed', name: 'Licensed footage feed', granularity: 'play', acquisition: 'planned', display: 'file', note: 'Placeholder for a future licensed NBA footage agreement. Not implemented.' },
  { id: 'playdb', name: 'PlayDB', granularity: 'play', acquisition: 'none', display: 'link_only', note: 'Not integrated: terms §4 forbid monetised social use; clips are NBA.com’s; robots.txt disallows automated search. Fine for manual browsing only.' },
] as const;

export function statsProviders(ctx: ProviderContext = {}): StatsProvider[] {
  return [createBalldontlie(ctx)];
}

export function clipProviders(ctx: ProviderContext = {}): ClipDiscoveryProvider[] {
  return [createHighlightApi(ctx), createHighlightly(ctx)];
}
