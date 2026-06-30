/**
 * Lightweight, polite website crawler built on Cheerio.
 *
 * SAFETY / SCOPE
 * --------------
 * - Crawls ONLY internal pages on the same registrable host as the seed URL.
 *   No external links are followed (prevents open-crawling / SSRF amplification).
 * - Hard caps: max 30 pages, max depth 2, per-request timeout, total time budget.
 * - normalizeUrl() (lib/utils) already blocks localhost/private IP seeds.
 * - TODO(production): add per-user/site rate limiting + a shared fetch budget,
 *   honor robots.txt crawl directives, and run crawls in a queue/worker.
 */

import * as cheerio from "cheerio";
import { normalizeUrl, rootDomain } from "@/lib/utils";
import { fetchPageSpeed } from "./pagespeed";
import type { CrawledPage, CtaButton, DetectedForm, PageType, SiteSignals } from "@/lib/types";

const MAX_PAGES = 30;
const MAX_DEPTH = 2;
const REQUEST_TIMEOUT_MS = 12000;
const TOTAL_BUDGET_MS = 55000;
const USER_AGENT = "FunnlBot/1.0 (+audit; respects-internal-links-only)";

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

const TRUST_TERMS = [
  "review", "testimonial", "rated", "stars", "5-star", "case study", "case studies",
  "licensed", "insured", "certified", "guarantee", "warranty", "trusted",
  "years of experience", "family owned", "award", "accredited", "bbb",
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

function linkPriority(url: string): number {
  const u = url.toLowerCase();
  if (/\/(services?|service-areas?|locations?)/.test(u)) return 5;
  if (/\/(contact|quote|estimate|book|booking|schedule)/.test(u)) return 5;
  if (/\/(pricing|plans|rates)/.test(u)) return 4;
  if (/\/(products?|shop)/.test(u)) return 3;
  if (/\/(about|team|reviews?|testimonials?)/.test(u)) return 2;
  if (/\/(blog|news|article)/.test(u)) return 0;
  return 1;
}

interface FetchResult {
  status: number | null;
  html: string | null;
}

async function fetchHtml(url: string): Promise<FetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": USER_AGENT, accept: "text/html" },
      redirect: "follow",
    });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok) return { status: res.status, html: null };
    if (!type.includes("text/html")) return { status: res.status, html: null };
    return { status: res.status, html: await res.text() };
  } catch {
    return { status: null, html: null };
  } finally {
    clearTimeout(timer);
  }
}

function extractPage(
  url: string,
  html: string,
  status: number | null,
  baseHost: string,
): { page: RawPage; links: string[] } {
  const $ = cheerio.load(html);
  const title = $("title").first().text().trim() || null;
  const metaDescription = $('meta[name="description"]').attr("content")?.trim() || null;
  const canonicalUrl = $('link[rel="canonical"]').attr("href")?.trim() || null;
  const robotsMeta = $('meta[name="robots"]').attr("content")?.trim() || null;
  const h1Els = $("h1");
  const h1 = h1Els.first().text().trim() || null;
  const h1Count = h1Els.length;
  const h2 = $("h2").map((_, el) => $(el).text().trim()).get().filter(Boolean).slice(0, 25);
  const h3 = $("h3").map((_, el) => $(el).text().trim()).get().filter(Boolean).slice(0, 25);

  const ctas: CtaButton[] = [];
  $("button, a.btn, a.button, [role=button], a[class*=cta]").each((_, el) => {
    const text = $(el).text().trim().replace(/\s+/g, " ");
    if (!text || text.length > 60) return;
    const href = $(el).attr("href") ?? null;
    ctas.push({ text, href, type: el.tagName === "button" ? "form_submit" : "primary" });
  });

  const forms: DetectedForm[] = [];
  $("form").each((_, el) => {
    const fields = $(el)
      .find("input, textarea, select")
      .map((_, f) => ($(f).attr("name") || $(f).attr("type") || "field").toString())
      .get()
      .filter((n) => n !== "hidden" && n !== "submit");
    const hasSubmit = $(el).find("[type=submit], button").length > 0;
    forms.push({ action: $(el).attr("action") ?? null, fieldCount: fields.length, fields: fields.slice(0, 20), hasSubmit });
  });

  const phoneLinks = $('a[href^="tel:"]').map((_, el) => $(el).attr("href")!).get();
  const emailLinks = $('a[href^="mailto:"]').map((_, el) => $(el).attr("href")!).get();

  const internalLinks: string[] = [];
  const externalLinks: string[] = [];
  $("a[href]").each((_, el) => {
    const raw = $(el).attr("href");
    if (!raw || raw.startsWith("#") || raw.startsWith("tel:") || raw.startsWith("mailto:")) return;
    try {
      const abs = new URL(raw, url).toString().split("#")[0];
      if (rootDomain(abs) === baseHost) internalLinks.push(abs);
      else if (/^https?:/.test(abs)) externalLinks.push(abs);
    } catch {
      /* skip */
    }
  });

  // Images + alt coverage.
  const imgs = $("img");
  const imageCount = imgs.length;
  let imagesMissingAlt = 0;
  imgs.each((_, el) => {
    const alt = ($(el).attr("alt") ?? "").trim();
    if (!alt) imagesMissingAlt += 1;
  });
  const hasVideo = $('video, iframe[src*="youtube"], iframe[src*="vimeo"]').length > 0;

  // Open Graph.
  const openGraph = $('meta[property^="og:"]').length > 0;

  // Body text.
  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  const bodyLower = bodyText.toLowerCase();
  const wordCount = bodyText.split(" ").filter(Boolean).length;
  const bodySummary = bodyText.slice(0, 300) || null;
  const detectedServices = [...new Set(SERVICE_TERMS.filter((t) => bodyLower.includes(t)))];
  const detectedLocations = [...new Set(LOCATION_HINTS.filter((t) => bodyLower.includes(t)))];
  const trustSignals = [...new Set(TRUST_TERMS.filter((t) => bodyLower.includes(t)))];

  // Last updated (best-effort).
  const lastUpdated =
    $('meta[property="article:modified_time"]').attr("content") ||
    $("time[datetime]").first().attr("datetime") ||
    null;

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

  const pageType = classifyPage(url, title ?? "");

  const issues: string[] = [];
  if (status != null && status >= 400) issues.push(`Returned HTTP ${status}.`);
  if (!title) issues.push("Missing <title> tag.");
  else if (title.length > 65) issues.push("Title tag longer than 65 characters (may truncate in SERP).");
  if (!metaDescription) issues.push("Missing meta description.");
  if (h1Count === 0) issues.push("Missing H1 heading.");
  if (h1Count > 1) issues.push(`Multiple H1 headings (${h1Count}).`);
  if (/noindex/i.test(robotsMeta ?? "")) issues.push("Page is set to noindex.");
  if (!canonicalUrl) issues.push("No canonical tag.");
  if (wordCount < 250 && ["service", "product", "location", "home"].includes(pageType)) {
    issues.push(`Thin content (~${wordCount} words) for a key page.`);
  }
  if (forms.length === 0 && pageType !== "blog" && pageType !== "about") {
    issues.push("No form detected on a conversion-relevant page.");
  }
  if (phoneLinks.length === 0) issues.push("No click-to-call (tel:) link.");
  if (imageCount > 0 && imagesMissingAlt / imageCount > 0.3) {
    issues.push(`${imagesMissingAlt}/${imageCount} images missing alt text.`);
  }

  const page: RawPage = {
    url,
    statusCode: status,
    pageType,
    title,
    metaDescription,
    canonicalUrl,
    robotsMeta,
    h1,
    h1Count,
    headings: { h2, h3 },
    bodySummary,
    ctas: ctas.slice(0, 15),
    forms,
    phoneLinks: [...new Set(phoneLinks)],
    emailLinks: [...new Set(emailLinks)],
    internalLinks: [...new Set(internalLinks)].slice(0, 60),
    externalLinks: [...new Set(externalLinks)].slice(0, 40),
    imageCount,
    imagesMissingAlt,
    hasVideo,
    detectedServices,
    detectedLocations,
    trustSignals,
    openGraph,
    schemaTypes: [...new Set(schemaTypes)],
    lastUpdated,
    pageSpeedScore: null,
    mobileScore: null,
    wordCount,
    issues,
  };
  return { page, links: [...new Set(internalLinks)] };
}

async function fetchSiteSignals(seed: string, homepageStatus: number | null): Promise<SiteSignals> {
  const origin = new URL(seed).origin;
  const https = new URL(seed).protocol === "https:";

  let robotsTxtPresent = false;
  let robotsTxtBlocksAll = false;
  let sitemapPresent = false;
  let sitemapUrl: string | null = null;

  try {
    const res = await fetch(`${origin}/robots.txt`, {
      headers: { "user-agent": USER_AGENT },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      robotsTxtPresent = true;
      const text = await res.text();
      // Crude "blocks all" detection: a wildcard agent disallowing root.
      robotsTxtBlocksAll = /user-agent:\s*\*[\s\S]*?disallow:\s*\/\s*(\n|$)/i.test(text);
      const sm = text.match(/sitemap:\s*(\S+)/i);
      if (sm) {
        sitemapPresent = true;
        sitemapUrl = sm[1];
      }
    }
  } catch {
    /* ignore */
  }

  if (!sitemapPresent) {
    try {
      const res = await fetch(`${origin}/sitemap.xml`, {
        method: "HEAD",
        headers: { "user-agent": USER_AGENT },
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        sitemapPresent = true;
        sitemapUrl = `${origin}/sitemap.xml`;
      }
    } catch {
      /* ignore */
    }
  }

  return { https, robotsTxtPresent, robotsTxtBlocksAll, sitemapPresent, sitemapUrl, homepageStatus };
}

export interface CrawlResult {
  pages: RawPage[];
  siteSignals: SiteSignals | null;
  error?: string;
}

export async function crawlSite(seedUrl: string): Promise<CrawlResult> {
  const normalized = normalizeUrl(seedUrl);
  if (!normalized) return { pages: [], siteSignals: null, error: "INVALID_URL" };

  const baseHost = rootDomain(normalized);
  const started = Date.now();
  const visited = new Set<string>();
  const queue: Array<{ url: string; depth: number }> = [];
  const pages: RawPage[] = [];

  const seed = await fetchHtml(normalized);
  if (seed.html === null) {
    return { pages: [], siteSignals: null, error: "CRAWL_FAILED" };
  }
  {
    const { page, links } = extractPage(normalized, seed.html, seed.status, baseHost);
    visited.add(normalized);
    pages.push(page);
    for (const link of links) if (!visited.has(link)) queue.push({ url: link, depth: 1 });
  }
  queue.sort((a, b) => linkPriority(b.url) - linkPriority(a.url));

  const siteSignals = await fetchSiteSignals(normalized, seed.status);

  while (queue.length > 0 && pages.length < MAX_PAGES) {
    if (Date.now() - started > TOTAL_BUDGET_MS) break;
    const { url, depth } = queue.shift()!;
    if (visited.has(url) || depth > MAX_DEPTH) continue;
    visited.add(url);
    const { html, status } = await fetchHtml(url);
    if (!html) {
      // Record error pages (4xx/5xx) so crawlability scoring can see them.
      if (status != null && status >= 400) {
        pages.push(makeErrorPage(url, status));
      }
      continue;
    }
    const { page, links } = extractPage(url, html, status, baseHost);
    pages.push(page);
    if (depth < MAX_DEPTH) {
      queue.push(...links.filter((l) => !visited.has(l)).map((l) => ({ url: l, depth: depth + 1 })));
      queue.sort((a, b) => linkPriority(b.url) - linkPriority(a.url));
    }
  }

  await enrichPageSpeed(pages);
  return { pages, siteSignals };
}

function makeErrorPage(url: string, status: number): RawPage {
  return {
    url,
    statusCode: status,
    pageType: "other",
    title: null,
    metaDescription: null,
    canonicalUrl: null,
    robotsMeta: null,
    h1: null,
    h1Count: 0,
    headings: { h2: [], h3: [] },
    bodySummary: null,
    ctas: [],
    forms: [],
    phoneLinks: [],
    emailLinks: [],
    internalLinks: [],
    externalLinks: [],
    imageCount: 0,
    imagesMissingAlt: 0,
    hasVideo: false,
    detectedServices: [],
    detectedLocations: [],
    trustSignals: [],
    openGraph: false,
    schemaTypes: [],
    lastUpdated: null,
    pageSpeedScore: null,
    mobileScore: null,
    wordCount: 0,
    issues: [`Returned HTTP ${status} (broken or inaccessible link).`],
  };
}

async function enrichPageSpeed(pages: RawPage[]): Promise<void> {
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
