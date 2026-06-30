/**
 * Google Ads API service wrapper (read-only).
 *
 * Uses the REST endpoint `customers/{id}/googleAds:searchStream` with GAQL.
 * Requires: a developer token, an OAuth access token (from a refresh token),
 * and a login-customer-id (the MCC). All requests are server-side.
 *
 * In demo mode (no developer token) the route layer injects the THOY dataset
 * instead of calling this — the shapes are identical, so the engine is agnostic.
 *
 * TODO(production): handle pagination (nextPageToken), partial failures, and
 * the Ads API quota/error model (RESOURCE_EXHAUSTED -> backoff + retry).
 */

import { env } from "@/lib/config";
import type { GoogleAdsRow } from "@/lib/types";

const API_VERSION = "v18";
const BASE = `https://googleads.googleapis.com/${API_VERSION}`;

function microsHeaders(accessToken: string) {
  return {
    authorization: `Bearer ${accessToken}`,
    "developer-token": env.googleAdsDeveloperToken ?? "",
    "login-customer-id": (env.googleAdsLoginCustomerId ?? "").replace(/-/g, ""),
    "content-type": "application/json",
  };
}

// --- GAQL query builders ---------------------------------------------------
// Example queries are exported so they can be reviewed/tested independently.

export const GAQL = {
  campaignPerformance: (dateStart: string, dateEnd: string) => `
    SELECT campaign.id, campaign.name, campaign.status,
           metrics.impressions, metrics.clicks, metrics.ctr,
           metrics.cost_micros, metrics.conversions,
           metrics.conversions_value, metrics.cost_per_conversion
    FROM campaign
    WHERE segments.date BETWEEN '${dateStart}' AND '${dateEnd}'
      AND campaign.status != 'REMOVED'
    ORDER BY metrics.cost_micros DESC`,

  adGroupPerformance: (dateStart: string, dateEnd: string) => `
    SELECT campaign.name, ad_group.id, ad_group.name,
           metrics.impressions, metrics.clicks, metrics.ctr,
           metrics.cost_micros, metrics.conversions,
           metrics.conversions_value, metrics.cost_per_conversion
    FROM ad_group
    WHERE segments.date BETWEEN '${dateStart}' AND '${dateEnd}'
      AND ad_group.status != 'REMOVED'
    ORDER BY metrics.cost_micros DESC`,

  keywordPerformance: (dateStart: string, dateEnd: string) => `
    SELECT campaign.name, ad_group.name,
           ad_group_criterion.keyword.text,
           ad_group_criterion.keyword.match_type,
           ad_group_criterion.quality_info.quality_score,
           metrics.impressions, metrics.clicks, metrics.ctr,
           metrics.cost_micros, metrics.conversions,
           metrics.conversions_value, metrics.cost_per_conversion
    FROM keyword_view
    WHERE segments.date BETWEEN '${dateStart}' AND '${dateEnd}'
    ORDER BY metrics.impressions DESC`,

  searchTermPerformance: (dateStart: string, dateEnd: string) => `
    SELECT campaign.name, ad_group.id, ad_group.name,
           search_term_view.search_term,
           segments.search_term_match_type,
           metrics.impressions, metrics.clicks, metrics.ctr,
           metrics.cost_micros, metrics.conversions, metrics.conversions_value
    FROM search_term_view
    WHERE segments.date BETWEEN '${dateStart}' AND '${dateEnd}'
    ORDER BY metrics.cost_micros DESC`,

  landingPagePerformance: (dateStart: string, dateEnd: string) => `
    SELECT landing_page_view.unexpanded_final_url,
           metrics.impressions, metrics.clicks, metrics.conversions,
           metrics.cost_micros
    FROM landing_page_view
    WHERE segments.date BETWEEN '${dateStart}' AND '${dateEnd}'
    ORDER BY metrics.clicks DESC`,

  conversionActions: () => `
    SELECT conversion_action.name, conversion_action.type,
           conversion_action.status, conversion_action.category
    FROM conversion_action`,
};

async function searchStream(customerId: string, accessToken: string, query: string): Promise<any[]> {
  const id = customerId.replace(/-/g, "");
  const res = await fetch(`${BASE}/customers/${id}/googleAds:searchStream`, {
    method: "POST",
    headers: microsHeaders(accessToken),
    body: JSON.stringify({ query }),
  });
  if (res.status === 429) throw new Error("QUOTA_EXCEEDED");
  if (res.status === 401) throw new Error("TOKEN_EXPIRED");
  if (!res.ok) throw new Error(`Google Ads API error ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as Array<{ results?: any[] }>;
  return data.flatMap((chunk) => chunk.results ?? []);
}

export interface AdsService {
  listAccessibleCustomers(): Promise<string[]>;
  fetchAdGroupPerformance(customerId: string, dateStart: string, dateEnd: string): Promise<GoogleAdsRow[]>;
  fetchKeywordPerformance(customerId: string, dateStart: string, dateEnd: string): Promise<GoogleAdsRow[]>;
  fetchSearchTerms(customerId: string, dateStart: string, dateEnd: string): Promise<GoogleAdsRow[]>;
}

export function createAdsService(accessToken: string): AdsService {
  return {
    async listAccessibleCustomers() {
      const res = await fetch(`${BASE}/customers:listAccessibleCustomers`, {
        headers: microsHeaders(accessToken),
      });
      if (!res.ok) throw new Error(`listAccessibleCustomers failed: ${res.status}`);
      const data = (await res.json()) as { resourceNames?: string[] };
      // resourceNames look like "customers/1234567890"
      return (data.resourceNames ?? []).map((r) => r.split("/")[1]);
    },

    async fetchKeywordPerformance(customerId, dateStart, dateEnd) {
      const rows = await searchStream(customerId, accessToken, GAQL.keywordPerformance(dateStart, dateEnd));
      return rows.map((r) => mapRow(customerId, r));
    },

    async fetchAdGroupPerformance(customerId, dateStart, dateEnd) {
      const rows = await searchStream(customerId, accessToken, GAQL.adGroupPerformance(dateStart, dateEnd));
      return rows.map((r) => mapRow(customerId, r));
    },

    async fetchSearchTerms(customerId, dateStart, dateEnd) {
      const rows = await searchStream(customerId, accessToken, GAQL.searchTermPerformance(dateStart, dateEnd));
      return rows.map((r) => ({
        ...mapRow(customerId, r),
        searchTerm: r.searchTermView?.searchTerm ?? null,
      }));
    },
  };
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function mapRow(customerId: string, r: any): GoogleAdsRow {
  const m = r.metrics ?? {};
  return {
    customerId,
    campaignId: r.campaign?.id ?? "",
    campaignName: r.campaign?.name ?? "",
    adGroupId: r.adGroup?.id ?? null,
    adGroupName: r.adGroup?.name ?? null,
    keywordText: r.adGroupCriterion?.keyword?.text ?? null,
    searchTerm: r.searchTermView?.searchTerm ?? null,
    matchType: r.adGroupCriterion?.keyword?.matchType ?? r.segments?.searchTermMatchType ?? null,
    landingPageUrl: r.landingPageView?.unexpandedFinalUrl ?? null,
    impressions: num(m.impressions),
    clicks: num(m.clicks),
    ctr: num(m.ctr),
    costMicros: num(m.costMicros),
    conversions: num(m.conversions),
    conversionRate: num(m.clicks) > 0 ? num(m.conversions) / num(m.clicks) : 0,
    costPerConversion: num(m.costPerConversion) / 1_000_000,
    conversionValue: num(m.conversionsValue),
    qualityScore: r.adGroupCriterion?.qualityInfo?.qualityScore ?? null,
  };
}
