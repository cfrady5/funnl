/**
 * Builds the live data-provider functions the audit engine calls in connected
 * mode. Each provider:
 *   1. loads the stored (encrypted) refresh token for the relevant scope,
 *   2. refreshes a short-lived access token,
 *   3. calls the corresponding service wrapper with the user's selected account.
 *
 * If anything is missing/expired, the provider throws a typed error and the
 * engine records that step as skipped/errored without failing the whole audit.
 */

import { decryptToken } from "@/lib/crypto";
import { getSelections, getTokens } from "@/lib/integrations";
import { refreshAccessToken } from "./oauth";
import { createAdsService } from "./ads";
import { createGa4Service } from "./ga4";
import { createSearchConsoleService } from "./searchconsole";
import { createGtmService } from "./gtm";
import type { Ga4Row, GoogleAdsRow, GtmSnapshot, IntegrationProvider, SearchConsoleRow } from "@/lib/types";

async function accessTokenFor(userId: string, provider: IntegrationProvider): Promise<string> {
  const tokens = await getTokens(userId, provider);
  if (!tokens?.refreshTokenEncrypted || tokens.refreshTokenEncrypted.startsWith("ENC_KEY_MISSING")) {
    throw new Error("NOT_CONNECTED");
  }
  const refreshToken = decryptToken(tokens.refreshTokenEncrypted);
  const { accessToken } = await refreshAccessToken(refreshToken);
  return accessToken;
}

export function buildLiveProviders(userId: string, dateStart: string, dateEnd: string) {
  // Selections are resolved lazily inside each provider so they're fetched from
  // durable storage on whichever serverless instance runs the audit.
  const selections = () => getSelections(userId);
  return {
    async ads(): Promise<{ rows: GoogleAdsRow[]; searchTerms: GoogleAdsRow[] }> {
      const sel = await selections();
      if (!sel?.googleAdsCustomerId) throw new Error("NO_ADS_ACCOUNT");
      const token = await accessTokenFor(userId, "google_ads");
      const svc = createAdsService(token);
      const [rows, searchTerms] = await Promise.all([
        svc.fetchKeywordPerformance(sel.googleAdsCustomerId, dateStart, dateEnd),
        svc.fetchSearchTerms(sel.googleAdsCustomerId, dateStart, dateEnd),
      ]);
      return { rows, searchTerms };
    },
    async ga4(): Promise<Ga4Row[]> {
      const sel = await selections();
      if (!sel?.ga4PropertyId) throw new Error("NO_GA4_PROPERTY");
      const token = await accessTokenFor(userId, "ga4");
      return createGa4Service(token).fetchLandingPagePerformance(sel.ga4PropertyId, dateStart, dateEnd);
    },
    async searchConsole(): Promise<SearchConsoleRow[]> {
      const sel = await selections();
      if (!sel?.searchConsoleSiteUrl) throw new Error("NO_GSC_SITE");
      const token = await accessTokenFor(userId, "search_console");
      return createSearchConsoleService(token).query(sel.searchConsoleSiteUrl, dateStart, dateEnd);
    },
    async gtm(): Promise<GtmSnapshot | null> {
      const sel = await selections();
      if (!sel?.gtmAccountId || !sel.gtmContainerId || !sel.gtmWorkspaceId) return null;
      const token = await accessTokenFor(userId, "gtm");
      return createGtmService(token).inspect(sel.gtmAccountId, sel.gtmContainerId, sel.gtmWorkspaceId);
    },
  };
}
