/**
 * Google Search Console API service wrapper (read-only).
 *
 * - GET  sites                         -> list verified properties
 * - POST sites/{site}/searchAnalytics/query -> query analytics
 *
 * Demo mode injects DEMO_SEARCH_CONSOLE_ROWS upstream.
 */

import type { SearchConsoleRow } from "@/lib/types";

const BASE = "https://www.googleapis.com/webmasters/v3";

function authHeaders(accessToken: string) {
  return { authorization: `Bearer ${accessToken}`, "content-type": "application/json" };
}

export interface GscSite {
  siteUrl: string;
  permissionLevel: string;
}

export function createSearchConsoleService(accessToken: string) {
  return {
    async listSites(): Promise<GscSite[]> {
      const res = await fetch(`${BASE}/sites`, { headers: authHeaders(accessToken) });
      if (res.status === 401) throw new Error("TOKEN_EXPIRED");
      if (!res.ok) throw new Error(`Search Console error ${res.status}`);
      const data = (await res.json()) as {
        siteEntry?: Array<{ siteUrl: string; permissionLevel: string }>;
      };
      return (data.siteEntry ?? []).map((s) => ({
        siteUrl: s.siteUrl,
        permissionLevel: s.permissionLevel,
      }));
    },

    /**
     * Query search analytics. dimensions default to query+page so the engine
     * can detect organic-demand gaps. Optionally filter country/device.
     */
    async query(
      siteUrl: string,
      dateStart: string,
      dateEnd: string,
      opts: { dimensions?: string[]; country?: string; device?: string; rowLimit?: number } = {},
    ): Promise<SearchConsoleRow[]> {
      const dimensions = opts.dimensions ?? ["query", "page"];
      const dimensionFilterGroups = [];
      const filters = [];
      if (opts.country) filters.push({ dimension: "country", expression: opts.country });
      if (opts.device) filters.push({ dimension: "device", expression: opts.device });
      if (filters.length) dimensionFilterGroups.push({ filters });

      const res = await fetch(
        `${BASE}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
        {
          method: "POST",
          headers: authHeaders(accessToken),
          body: JSON.stringify({
            startDate: dateStart,
            endDate: dateEnd,
            dimensions,
            dimensionFilterGroups,
            rowLimit: opts.rowLimit ?? 250,
          }),
        },
      );
      if (res.status === 401) throw new Error("TOKEN_EXPIRED");
      if (res.status === 403) throw new Error("SITE_NOT_VERIFIED");
      if (!res.ok) throw new Error(`Search Console query error ${res.status}`);
      const data = (await res.json()) as {
        rows?: Array<{ keys: string[]; clicks: number; impressions: number; ctr: number; position: number }>;
      };
      return (data.rows ?? []).map((r) => {
        const keyMap: Record<string, string> = {};
        dimensions.forEach((dim, i) => (keyMap[dim] = r.keys[i] ?? ""));
        return {
          siteUrl,
          query: keyMap.query ?? "",
          page: keyMap.page ?? "",
          country: keyMap.country ?? "",
          device: keyMap.device ?? "",
          clicks: r.clicks,
          impressions: r.impressions,
          ctr: r.ctr,
          position: r.position,
        } satisfies SearchConsoleRow;
      });
    },
  };
}
