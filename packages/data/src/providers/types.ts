import type { ClipProviderCapabilities, ClipReferenceRec, GameRec, PlayRec, PlayerBoxRec } from '@tiresias/core';
import type { ArchivedRequest } from '../http';

/** Integration status shown in the dashboard. "verified" requires a successful real call recorded in provider_requests. */
export type IntegrationEvidence = 'documented' | 'verified' | 'mock';

export interface ProviderInfo {
  id: string;
  name: string;
  configured: boolean;
  /** Env var(s) needed when not configured. */
  needs: string[];
  docsUrl: string;
}

export interface StatsProvider extends ProviderInfo {
  kind: 'stats';
  listGames(date: string): Promise<GameRec[]>;
  playerStats(gameIds: string[]): Promise<PlayerBoxRec[]>;
  /** Play-by-play for one game, in chronological order. */
  plays(gameId: string): Promise<PlayRec[]>;
}

export interface ClipDiscoveryProvider extends ProviderInfo {
  kind: 'clips';
  capabilities: ClipProviderCapabilities;
  /**
   * Discover clip references for the games on a date. `games` are our games
   * (with team abbreviations) so the adapter can map provider game ids.
   */
  discover(date: string, games: Array<Pick<GameRec, 'providerId' | 'home' | 'away' | 'date'>>): Promise<Array<ClipReferenceRec & { gameProviderId: string | null }>>;
}

export interface ProviderContext {
  onArchive?: (r: ArchivedRequest) => void | Promise<void>;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  env?: Record<string, string | undefined>;
}
