/**
 * GA4 Data API + Admin API service wrapper (read-only).
 *
 * - Admin API (analyticsadmin) lists accessible properties.
 * - Data API (analyticsdata) runs reports via `properties/{id}:runReport`.
 *
 * Demo mode injects DEMO_GA4_ROWS upstream; shapes match exactly.
 */

import type { Ga4Row } from "@/lib/types";

const DATA_BASE = "https://analyticsdata.googleapis.com/v1beta";
const ADMIN_BASE = "https://analyticsadmin.googleapis.com/v1beta";

function authHeaders(accessToken: string) {
  return { authorization: `Bearer ${accessToken}`, "content-type": "application/json" };
}

export interface Ga4Property {
  propertyId: string;
  displayName: string;
}

export function createGa4Service(accessToken: string) {
  return {
    /** List GA4 properties the user can access (via account summaries). */
    async listProperties(): Promise<Ga4Property[]> {
      const res = await fetch(`${ADMIN_BASE}/accountSummaries`, { headers: authHeaders(accessToken) });
      if (res.status === 401) throw new Error("TOKEN_EXPIRED");
      if (!res.ok) throw new Error(`GA4 admin error ${res.status}`);
      const data = (await res.json()) as {
        accountSummaries?: Array<{
          propertySummaries?: Array<{ property: string; displayName: string }>;
        }>;
      };
      const props: Ga4Property[] = [];
      for (const acct of data.accountSummaries ?? []) {
        for (const p of acct.propertySummaries ?? []) {
          props.push({ propertyId: p.property.split("/")[1], displayName: p.displayName });
        }
      }
      return props;
    },

    /**
     * Landing-page + source/medium performance for the date range. Mirrors the
     * fields the audit engine needs (sessions, conversions, engagement, etc.).
     */
    async fetchLandingPagePerformance(
      propertyId: string,
      dateStart: string,
      dateEnd: string,
    ): Promise<Ga4Row[]> {
      const body = {
        dateRanges: [{ startDate: dateStart, endDate: dateEnd }],
        dimensions: [
          { name: "landingPagePlusQueryString" },
          { name: "sessionSource" },
          { name: "sessionMedium" },
          { name: "sessionCampaignName" },
        ],
        metrics: [
          { name: "sessions" },
          { name: "totalUsers" },
          { name: "engagedSessions" },
          { name: "conversions" },
          { name: "eventCount" },
          { name: "keyEvents" },
          { name: "totalRevenue" },
          { name: "bounceRate" },
        ],
        limit: 250,
      };
      const res = await fetch(`${DATA_BASE}/properties/${propertyId}:runReport`, {
        method: "POST",
        headers: authHeaders(accessToken),
        body: JSON.stringify(body),
      });
      if (res.status === 401) throw new Error("TOKEN_EXPIRED");
      if (res.status === 429) throw new Error("QUOTA_EXCEEDED");
      if (!res.ok) throw new Error(`GA4 data error ${res.status}`);
      const data = (await res.json()) as {
        rows?: Array<{ dimensionValues: { value: string }[]; metricValues: { value: string }[] }>;
      };
      return (data.rows ?? []).map((r) => {
        const d = r.dimensionValues.map((x) => x.value);
        const m = r.metricValues.map((x) => Number(x.value) || 0);
        return {
          propertyId,
          pagePath: d[0],
          landingPage: d[0],
          source: d[1],
          medium: d[2],
          campaign: d[3],
          sessions: m[0],
          users: m[1],
          engagedSessions: m[2],
          conversions: m[3],
          eventCount: m[4],
          keyEvents: m[5],
          revenue: m[6],
          bounceRate: m[7],
        } satisfies Ga4Row;
      });
    },
  };
}
