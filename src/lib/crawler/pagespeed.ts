/**
 * PageSpeed Insights integration.
 *
 * Returns Lighthouse performance scores (0–100) for desktop + mobile. If
 * PAGESPEED_API_KEY is not configured we return null and the crawler simply
 * omits speed scores — the audit still runs, scoring treats missing speed as
 * a neutral default.
 *
 * TODO(production): cache results per-URL (scores change slowly) and respect
 * the API's per-minute quota with a token-bucket limiter.
 */

import { capabilities, env } from "@/lib/config";

interface PageSpeedScores {
  desktop: number | null;
  mobile: number | null;
}

const ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

async function runStrategy(url: string, strategy: "desktop" | "mobile"): Promise<number | null> {
  try {
    const params = new URLSearchParams({
      url,
      strategy,
      category: "performance",
      key: env.pageSpeedApiKey!,
    });
    const res = await fetch(`${ENDPOINT}?${params.toString()}`, {
      // PageSpeed can be slow; give it room but cap it.
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      lighthouseResult?: { categories?: { performance?: { score?: number } } };
    };
    const score = data.lighthouseResult?.categories?.performance?.score;
    return typeof score === "number" ? Math.round(score * 100) : null;
  } catch {
    return null;
  }
}

export async function fetchPageSpeed(url: string): Promise<PageSpeedScores | null> {
  if (!capabilities.hasPageSpeed) return null;
  const [desktop, mobile] = await Promise.all([
    runStrategy(url, "desktop"),
    runStrategy(url, "mobile"),
  ]);
  if (desktop == null && mobile == null) return null;
  return { desktop, mobile };
}
