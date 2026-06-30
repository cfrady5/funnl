/**
 * Lightweight, polite website crawler built on Cheerio.
 *
 * SAFETY / SCOPE
 * --------------
 * - Crawls ONLY internal pages on the same registrable host as the seed URL.
 *   No external links are followed (prevents open-crawling / SSRF amplification).
 * - Hard caps: max 20 pages, max depth 2, per-request timeout, total time budget.
 * - normalizeUrl() (lib/utils) already blocks localhost/private IP seeds.
 * - TODO(production): add per-user/site rate limiting + a shared fetch budget,
 *   respect robots.txt, and run crawls in a queue/worker rather than inline.
 */

import * as cheerio from "cheerio";
import { normalizeUrl, rootDomain } from "@/lib/utils";
import { fetchPageSpeed } from "./pagespeed";
import type { CrawledPage, CtaButton, DetectedForm, PageType } from "@/lib/types";

const MAX_PAGES = 20;
const MAX_DEPTH = 2;
const REQUEST_TIMEOUT_MS = 12000;
const TOTAL_BUDGET_MS = 45000;
const USER_AGENT = "SEMCommandCenterBot/1.0 (+audit; respects-internal-links-only)";

type RawPage = Omit<CrawledPage, "id" | "auditId" | "createdAt">;

const SERVICE_TERMS = [
  "mowing", "lawn", "mulch", "edging", "cleanup", "landscaping", "fertiliz",
  "aeration", "trimming", "installation", "repair", "maintenance", "cleaning",
  "plumbing", "roofing", "hvac", "electrical", "painting", "remodel", "dental",
  "legal", "consulting", "design", "marketing", "training", "coaching",
];

const LOCATION_HINTS = [
  "indiana", "lafayette", "city", "county", "near me", "area", "serving",
  "located", "downtown", "neighborhood", "region", "local",
];

function classifyPage(url: string, title: string): PageType {
  const u = url.toLowerCase();
  if (/\/(services?|what-we-do)/.test(u)) return "service";
  if (/\/(products?|shop|store)/.test(u)) return "product";
  if (/\/(pricing|plans|rates|cost)/.test(u)) return "pricing";
  if (/\/(contact|get-in-touch|quote|estimate)/.test(u)) return "contact";
  if (/\/(book|booking|schedule|appointment)/.test(u)) return "booking";
  if (/\/(locations?|areas?|service-areas?)/.test(u)) return "location";
  if (/\/(about|our-story|team)/.test(u)) return "about";
  if (/\/(blog|news|articles?|posts?)/.test(u)) return "blog";
  try {
    if (new URL(url).pathname.replace(/\/+$/, "") === "") return "home";
  } catch {
    /* ignore */
  }
  if (/\bservice/.test(title.toLowerCase())) return "service";
  return "other";
}

/** Pages worth crawling first (conversion-relevant). */
function linkPriority(url: string): number {
  const u = url.toLowerCase();
  if (/\/(services?|service-areas?|locations?)/.test(u)) return 5;
  if (/\/(contact|quote|estimate|book|booking|schedule)/.test(u)) return 5;
  if (/\/(pricing|plans|rates)/.test(u)) return 4;
  if (/\/(products?|shop)/.test(u)) return 3;
  if (/\/(about|team)/.test(u)) return 2;
  if (/\/(blog|news|article)/.test(u)) return 0;
  return 1;
}

async function fetchHtml(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": USER_AGENT, accept: "text/html" },
      redirect: "follow",
    });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("text/html")) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function extractPage(url: string, html: string, baseHost: string): { page: RawPage; links: string[] } {
  const $ = cheerio.load(html);
  const title = $("title").first().text().trim() || null;
  const metaDescription = $('meta[name="description"]').attr("content")?.trim() || null;
  const h1 = $("h1").first().text().trim() || null;
  const h2 = $("h2").map((_, el) => $(el).text().trim()).get().filter(Boolean).slice(0, 25);
  const h3 = $("h3").map((_, el) => $(el).text().trim()).get().filter(Boolean).slice(0, 25);

  // CTAs: buttons + button-like links.
  const ctas: CtaButton[] = [];
  $("button, a.btn, a.button, [role=button], a[class*=cta]").each((_, el) => {
    const text = $(el).text().trim().replace(/\s+/g, " ");
    if (!text || text.length > 60) return;
    const href = $(el).attr("href") ?? null;
    ctas.push({ text, href, type: el.tagName === "button" ? "form_submit" : "primary" });
  });

  // Forms.
  const forms: DetectedForm[] = [];
  $("form").each((_, el) => {
    const fields = $(el)
      .find("input, textarea, select")
      .map((_, f) => ($(f).attr("name") || $(f).attr("type") || "field").toString())
      .get()
      .filter((n) => n !== "hidden" && n !== "submit");
    const hasSubmit = $(el).find("[type=submit], button").length > 0;
    forms.push({
      action: $(el).attr("action") ?? null,
      fieldCount: fields.length,
      fields: fields.slice(0, 20),
      hasSubmit,
    });
  });

  // Phone + email links.
  const phoneLinks = $('a[href^="tel:"]').map((_, el) => $(el).attr("href")!).get();
  const emailLinks = $('a[href^="mailto:"]').map((_, el) => $(el).attr("href")!).get();

  // Internal links.
  const links: string[] = [];
  $("a[href]").each((_, el) => {
    const raw = $(el).attr("href");
    if (!raw || raw.startsWith("#") || raw.startsWith("tel:") || raw.startsWith("mailto:")) return;
    try {
      const abs = new URL(raw, url).toString().split("#")[0];
      if (rootDomain(abs) === baseHost) links.push(abs);
    } catch {
      /* skip */
    }
  });

  // Body text for service/location detection.
  const bodyText = $("body").text().replace(/\s+/g, " ").toLowerCase();
  const wordCount = bodyText.split(" ").filter(Boolean).length;
  const detectedServices = [...new Set(SERVICE_TERMS.filter((t) => bodyText.includes(t)))];
  const detectedLocations = [...new Set(LOCATION_HINTS.filter((t) => bodyText.includes(t)))];

  // Schema.org JSON-LD types.
  const schemaTypes: string[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).contents().text());
      const collect = (obj: any) => {
        if (!obj) return;
        if (Array.isArray(obj)) return obj.forEach(collect);
        if (obj["@type"]) schemaTypes.push(String(obj["@type"]));
        if (obj["@graph"]) collect(obj["@graph"]);
      };
      collect(json);
    } catch {
      /* ignore malformed JSON-LD */
    }
  });

  // Per-page issues.
  const issues: string[] = [];
  if (!title) issues.push("Missing <title> tag.");
  else if (title.length > 65) issues.push("Title tag is longer than 65 characters (may truncate in SERP).");
  if (!metaDescription) issues.push("Missing meta description.");
  if (!h1) issues.push("Missing H1 heading.");
  if (forms.length === 0 && classifyPage(url, title ?? "") !== "blog") {
    issues.push("No form detected on a conversion-relevant page.");
  }
  if (phoneLinks.length === 0) issues.push("No click-to-call (tel:) link detected.");

  const page: RawPage = {
    url,
    pageType: classifyPage(url, title ?? ""),
    title,
    metaDescription,
    h1,
    headings: { h2, h3 },
    ctas: ctas.slice(0, 15),
    forms,
    phoneLinks: [...new Set(phoneLinks)],
    emailLinks: [...new Set(emailLinks)],
    internalLinks: [...new Set(links)].slice(0, 50),
    detectedServices,
    detectedLocations,
    schemaTypes: [...new Set(schemaTypes)],
    pageSpeedScore: null,
    mobileScore: null,
    wordCount,
    issues,
  };
  return { page, links: [...new Set(links)] };
}

export interface CrawlResult {
  pages: RawPage[];
  error?: string;
}

export async function crawlSite(seedUrl: string): Promise<CrawlResult> {
  const normalized = normalizeUrl(seedUrl);
  if (!normalized) {
    return { pages: [], error: "INVALID_URL" };
  }
  const baseHost = rootDomain(normalized);
  const started = Date.now();

  const visited = new Set<string>();
  const queue: Array<{ url: string; depth: number }> = [{ url: normalized, depth: 0 }];
  const pages: RawPage[] = [];

  // Probe the seed first so we can fail fast with a clear error.
  const seedHtml = await fetchHtml(normalized);
  if (seedHtml === null) {
    return { pages: [], error: "CRAWL_FAILED" };
  }
  {
    const { page, links } = extractPage(normalized, seedHtml, baseHost);
    visited.add(normalized);
    pages.push(page);
    for (const link of links) {
      if (!visited.has(link)) queue.push({ url: link, depth: 1 });
    }
  }
  // remove the seed from the front (already processed)
  queue.shift();
  // Prioritize conversion-relevant pages.
  queue.sort((a, b) => linkPriority(b.url) - linkPriority(a.url));

  while (queue.length > 0 && pages.length < MAX_PAGES) {
    if (Date.now() - started > TOTAL_BUDGET_MS) break;
    const { url, depth } = queue.shift()!;
    if (visited.has(url) || depth > MAX_DEPTH) continue;
    visited.add(url);
    const html = await fetchHtml(url);
    if (!html) continue;
    const { page, links } = extractPage(url, html, baseHost);
    pages.push(page);
    if (depth < MAX_DEPTH) {
      const fresh = links
        .filter((l) => !visited.has(l))
        .map((l) => ({ url: l, depth: depth + 1 }));
      queue.push(...fresh);
      queue.sort((a, b) => linkPriority(b.url) - linkPriority(a.url));
    }
  }

  // Optionally enrich the top few pages with PageSpeed scores (real or skipped).
  await enrichPageSpeed(pages);

  return { pages };
}

async function enrichPageSpeed(pages: RawPage[]): Promise<void> {
  // Only score the most important pages to stay within quota/time.
  const targets = pages
    .filter((p) => ["home", "service", "contact", "pricing", "booking"].includes(p.pageType))
    .slice(0, 4);
  await Promise.all(
    targets.map(async (p) => {
      const scores = await fetchPageSpeed(p.url);
      if (scores) {
        p.pageSpeedScore = scores.desktop;
        p.mobileScore = scores.mobile;
        if (scores.mobile != null && scores.mobile < 50) {
          p.issues.push(`Poor mobile performance score (${scores.mobile}/100).`);
        }
      }
    }),
  );
}
