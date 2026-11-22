/**
 * Provider-neutral NBA domain records. Every adapter maps its own payloads
 * into these shapes; every record keeps its provider + provider id so it can
 * always be traced back to the source response.
 */
export type GameState = 'scheduled' | 'in_progress' | 'final' | 'postponed' | 'canceled' | 'delayed' | 'suspended' | 'abandoned' | 'unknown';

export interface TeamRec {
  provider: string;
  providerId: string;
  abbreviation: string;
  city: string;
  name: string;
  fullName: string;
}

export interface GameRec {
  provider: string;
  providerId: string;
  /** NBA calendar date (America/New_York), YYYY-MM-DD. */
  date: string;
  tipoffAt: string | null;
  state: GameState;
  statusText: string | null;
  period: number | null;
  postseason: boolean;
  season: number | null;
  home: TeamRec;
  away: TeamRec;
  homeScore: number | null;
  awayScore: number | null;
}

export interface PlayerRec {
  provider: string;
  providerId: string;
  firstName: string;
  lastName: string;
  position: string | null;
  jersey: string | null;
}

export interface PlayerBoxRec {
  provider: string;
  providerStatId: string | null;
  gameProviderId: string;
  teamProviderId: string;
  player: PlayerRec;
  minutes: string | null;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  turnovers: number;
  pf: number;
  fgm: number;
  fga: number;
  fg3m: number;
  fg3a: number;
  ftm: number;
  fta: number;
  plusMinus: number | null;
}

export interface PlayRec {
  provider: string;
  gameProviderId: string;
  /** Provider ordering within the game; (game, order) is the unique event key. */
  order: number;
  type: string;
  text: string;
  period: number;
  clock: string | null;
  homeScore: number | null;
  awayScore: number | null;
  scoringPlay: boolean;
  shootingPlay: boolean;
  scoreValue: number | null;
  teamProviderId: string | null;
  teamAbbreviation: string | null;
  wallclock: string | null;
  participants: string[];
}

/** What a clip discovery provider can do — drives what the pipeline may use it for. */
export interface ClipProviderCapabilities {
  /** Finest level the provider links clips to. */
  granularity: 'play' | 'game';
  /** Can we legally obtain the video bytes for editing/rendering? */
  acquisition: 'none' | 'licensed_download';
  /** How the clip may be shown in our own dashboard. */
  display: 'embed_only' | 'link_only' | 'file';
  /** Default rights status for media obtained from this provider. */
  defaultRights: 'unknown' | 'licensed' | 'owned';
}

export interface ClipReferenceRec {
  provider: string;
  externalId: string;
  gameProviderKey: string | null;
  title: string | null;
  url: string | null;
  embedUrl: string | null;
  thumbnailUrl: string | null;
  sourcePlatform: string | null;
  sourceAccount: string | null;
  postedAt: string | null;
  granularity: 'play' | 'game';
  /** Provider-reported match quality (e.g. high/medium/low). */
  providerConfidence: string | null;
  /** Provider's own description of the matched play, if play-level. */
  matchedPlay: {
    period: number | null;
    clockSeconds: number | null;
    wallclock: string | null;
    teamAbbreviation: string | null;
    player: string | null;
    assistPlayer: string | null;
    description: string | null;
    actionType: string | null;
  } | null;
  raw: unknown;
}
