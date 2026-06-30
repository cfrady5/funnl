/**
 * SEO / technical / content / local / AI-search recommendation rules.
 *
 * Mirrors the deterministic findings from seo.ts into actionable, ranked
 * recommendations. Ethics first: we never recommend keyword stuffing, thin
 * scaled pages, fake mentions, or "AEO hacks" — only durable, people-first
 * improvements.
 */

import { makeRecommendation as rec } from "./priority";
import type { Recommendation } from "@/lib/types";
import type { ScoringInput } from "./scoring";

export function generateSeoRecommendations(input: ScoringInput): Recommendation[] {
  const out: Recommendation[] = [];
  const { pages, siteSignals, business } = input;
  if (pages.length === 0) return out;

  // --- Technical / crawlability -------------------------------------------
  if (siteSignals && !siteSignals.https) {
    out.push(
      rec({
        title: "Serve the entire site over HTTPS",
        category: "technical_seo",
        severity: "critical",
        urgency: "now",
        confidence: "high",
        evidence: ["The site is not served over HTTPS."],
        whyItMatters:
          "HTTPS is a baseline ranking and trust signal, and browsers flag non-HTTPS pages as 'Not secure', which kills conversion. Paid traffic to an insecure page wastes spend.",
        recommendedFix: "Install a TLS certificate (free via Let's Encrypt or your host) and 301-redirect all HTTP URLs to HTTPS.",
        estimatedImpact: "Removes a trust blocker affecting every visitor and a basic ranking factor.",
        difficulty: "medium",
        relatedEntityType: "page",
        relatedEntityId: null,
      }),
    );
  }
  if (siteSignals && !siteSignals.sitemapPresent) {
    out.push(
      rec({
        title: "Publish an XML sitemap",
        category: "technical_seo",
        severity: "medium",
        evidence: ["No sitemap.xml was found at the usual locations."],
        whyItMatters: "A sitemap helps Google discover and prioritize your important pages, especially on newer or larger sites.",
        recommendedFix: "Generate /sitemap.xml, list canonical URLs, and reference it from robots.txt.",
        estimatedImpact: "Faster, more complete indexing of key pages.",
        difficulty: "easy",
        relatedEntityType: "page",
        relatedEntityId: null,
      }),
    );
  }
  if (siteSignals?.robotsTxtBlocksAll) {
    out.push(
      rec({
        title: "Fix robots.txt — it is blocking crawling",
        category: "technical_seo",
        severity: "critical",
        urgency: "now",
        evidence: ["robots.txt appears to disallow crawling of the whole site."],
        whyItMatters: "If Googlebot can't crawl your pages, they can't be indexed or ranked — no SEO is possible until this is fixed.",
        recommendedFix: "Edit robots.txt to allow crawling of important pages; only disallow truly private/duplicate paths.",
        estimatedImpact: "Unblocks all organic visibility.",
        difficulty: "easy",
        relatedEntityType: "page",
        relatedEntityId: null,
      }),
    );
  }

  const noindex = pages.filter((p) => /noindex/i.test(p.robotsMeta ?? ""));
  if (noindex.length > 0) {
    out.push(
      rec({
        title: `Remove noindex from ${noindex.length} important page(s)`,
        category: "technical_seo",
        severity: "high",
        urgency: "now",
        evidence: noindex.slice(0, 4).map((p) => `noindex on ${p.url}`),
        whyItMatters: "A noindex tag tells search engines to exclude the page entirely. On pages you want found, this silently removes them from results.",
        recommendedFix: "Remove the noindex robots meta from pages that should rank; keep it only on intentional pages (thank-you, internal search).",
        estimatedImpact: "Restores eligibility for organic and AI search results.",
        difficulty: "easy",
        relatedEntityType: "page",
        relatedEntityId: null,
      }),
    );
  }

  // --- Content quality / structure ----------------------------------------
  const missingTitle = pages.filter((p) => !p.title);
  if (missingTitle.length > 0) {
    out.push(
      rec({
        title: `Add unique title tags to ${missingTitle.length} page(s)`,
        category: "seo",
        severity: "high",
        evidence: missingTitle.slice(0, 4).map((p) => `Missing <title>: ${p.url}`),
        whyItMatters: "The title tag is the strongest on-page signal of a page's topic and the headline searchers see in results.",
        recommendedFix: "Write a unique, descriptive title for each page: [Service] in [Location] | [Brand].",
        estimatedImpact: "Improves relevance and SERP click-through.",
        difficulty: "easy",
        relatedEntityType: "page",
        relatedEntityId: null,
      }),
    );
  }

  const thin = pages.filter((p) => p.wordCount < 250 && ["service", "product", "location", "home"].includes(p.pageType));
  if (thin.length > 0) {
    out.push(
      rec({
        title: `Strengthen thin content on ${thin.length} key page(s)`,
        category: "content",
        severity: "high",
        confidence: "medium",
        evidence: thin.slice(0, 4).map((p) => `${p.url} (~${p.wordCount} words)`),
        whyItMatters:
          "Thin pages rarely satisfy search intent and are unlikely to be cited by AI search. Helpful, specific content wins long-term — without resorting to keyword stuffing.",
        recommendedFix:
          "Expand each page with first-hand detail: what's included, your process, pricing expectations, real photos, FAQs, and local specifics. Do NOT spin thin variations per keyword.",
        estimatedImpact: "Better rankings, higher conversion, and stronger AI-search eligibility.",
        difficulty: "medium",
        relatedEntityType: "page",
        relatedEntityId: null,
      }),
    );
  }

  const altGap = pages.reduce((s, p) => s + p.imagesMissingAlt, 0);
  if (altGap >= 5) {
    out.push(
      rec({
        title: `Add alt text to ${altGap} images`,
        category: "seo",
        severity: "low",
        urgency: "later",
        evidence: [`${altGap} images across the crawl are missing descriptive alt text.`],
        whyItMatters: "Alt text improves accessibility and helps search engines understand images placed near relevant content.",
        recommendedFix: "Write concise, descriptive alt text that reflects the image and its context — not keyword lists.",
        estimatedImpact: "Accessibility + incremental image/search understanding.",
        difficulty: "easy",
        relatedEntityType: "page",
        relatedEntityId: null,
      }),
    );
  }

  // --- Local SEO -----------------------------------------------------------
  const hasLocalSchema = pages.some((p) => p.schemaTypes.some((t) => /LocalBusiness/i.test(t)));
  if (!hasLocalSchema) {
    out.push(
      rec({
        title: "Add LocalBusiness structured data",
        category: "local_seo",
        severity: "medium",
        evidence: ["No LocalBusiness schema detected during the crawl."],
        whyItMatters: "LocalBusiness schema helps search engines (and AI systems) confidently associate your site with your services, location, and contact details.",
        recommendedFix: "Add LocalBusiness JSON-LD with name, address, phone, hours, and areaServed — matching your Google Business Profile.",
        estimatedImpact: "Stronger local entity signals and richer results.",
        difficulty: "easy",
        relatedEntityType: "page",
        relatedEntityId: null,
      }),
    );
  }

  // --- Proof / E-E-A-T -----------------------------------------------------
  const hasProof = pages.some((p) => p.trustSignals.length > 0);
  if (!hasProof) {
    out.push(
      rec({
        title: "Add reviews, testimonials, and proof of work",
        category: "content",
        severity: "medium",
        confidence: "medium",
        evidence: ["No reviews/testimonials/case studies detected on crawled pages."],
        whyItMatters:
          "First-hand proof builds trust with customers and demonstrates experience/expertise (E-E-A-T) — exactly the signals durable rankings and AI citations rely on.",
        recommendedFix: "Add a genuine reviews/testimonials section, before/after photos, and credentials. Keep it real — don't fabricate.",
        estimatedImpact: "Higher conversion rate and stronger trust signals.",
        difficulty: "medium",
        relatedEntityType: "page",
        relatedEntityId: null,
      }),
    );
  }

  // --- AI search (people-first guidance) ----------------------------------
  out.push(
    rec({
      title: "Earn AI-search visibility with people-first content (not hacks)",
      category: "ai_search",
      severity: "low",
      urgency: "later",
      confidence: "medium",
      evidence: [
        "AI Search Readiness is built on crawlable, helpful, first-hand content — there are no reliable 'AEO/GEO hacks'.",
      ],
      whyItMatters:
        "Generative search surfaces sources it can crawl, understand, and trust. Thin AI-generated pages, keyword stuffing, fake mentions, and date-only updates don't help and can hurt.",
      recommendedFix:
        "Publish genuinely useful, original content with first-hand expertise and clear local detail; keep the DOM accessible and navigation clear so AI agents can read it.",
      estimatedImpact: "Durable eligibility to be cited by AI Overviews and assistants.",
      difficulty: "medium",
      relatedEntityType: "page",
      relatedEntityId: null,
    }),
  );

  return out;
}
