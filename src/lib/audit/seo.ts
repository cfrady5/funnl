/**
 * SEO + AI-search + measurement scoring.
 *
 * Deterministic, evidence-backed scores derived from the crawl + site signals
 * (and Google data where connected). These complement the PPC-side scores in
 * scoring.ts. Philosophy: reward crawlable, technically sound, genuinely
 * helpful, people-first sites — never reward thin/keyword-stuffed/"AEO-hack"
 * patterns. We diagnose before prescribing.
 */

import { clamp, formatPercent } from "@/lib/utils";
import type { ScoreBreakdown } from "@/lib/types";
import type { ScoringInput } from "./scoring";

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

const empty = (label: string): ScoreBreakdown => ({
  score: 0,
  label,
  evidence: ["No pages were crawled."],
  issues: ["The website could not be crawled."],
  recommendations: ["Verify the URL is publicly reachable and re-run the audit."],
});

// --- SEO Foundation (crawlability + indexability + structure + appearance) -

export function scoreSeoFoundation(input: ScoringInput): ScoreBreakdown {
  const { pages, siteSignals, searchConsoleRows, connected } = input;
  if (pages.length === 0) return empty("SEO Foundation");
  const evidence: string[] = [];
  const issues: string[] = [];
  const recommendations: string[] = [];
  let score = 100;

  // Crawlability / indexability.
  if (siteSignals) {
    if (!siteSignals.sitemapPresent) {
      score -= 8;
      issues.push("No sitemap.xml found — search engines may discover pages more slowly.");
      recommendations.push("Publish an XML sitemap and reference it in robots.txt.");
    } else {
      evidence.push("XML sitemap is present.");
    }
    if (siteSignals.robotsTxtBlocksAll) {
      score -= 30;
      issues.push("robots.txt appears to block crawling of the whole site.");
      recommendations.push("Fix robots.txt so important pages are crawlable.");
    }
  }

  const noindex = pages.filter((p) => /noindex/i.test(p.robotsMeta ?? ""));
  if (noindex.length > 0) {
    score -= Math.min(20, noindex.length * 8);
    issues.push(`${noindex.length} page(s) have a noindex robots meta tag.`);
    recommendations.push("Remove noindex from pages you want to rank (keep it only on intentional pages).");
  }
  const errorPages = pages.filter((p) => p.statusCode != null && p.statusCode >= 400);
  if (errorPages.length > 0) {
    score -= Math.min(20, errorPages.length * 6);
    issues.push(`${errorPages.length} crawled link(s) returned an error status.`);
  }

  // Titles / meta uniqueness + presence (search appearance).
  const titles = pages.map((p) => (p.title ?? "").trim().toLowerCase()).filter(Boolean);
  const dupTitles = titles.length - new Set(titles).size;
  const missingTitle = pages.filter((p) => !p.title).length;
  const missingMeta = pages.filter((p) => !p.metaDescription).length;
  if (missingTitle > 0) {
    score -= Math.min(12, missingTitle * 6);
    issues.push(`${missingTitle} page(s) missing a <title> tag.`);
  }
  if (dupTitles > 0) {
    score -= Math.min(10, dupTitles * 5);
    issues.push(`${dupTitles} duplicate title tag(s) — each page should have a unique, descriptive title.`);
    recommendations.push("Write unique, descriptive titles for each page.");
  }
  if (missingMeta > 0) {
    score -= Math.min(8, missingMeta * 3);
    issues.push(`${missingMeta} page(s) missing a meta description.`);
    recommendations.push("Add useful, non-duplicated meta descriptions to improve SERP CTR.");
  }

  // Internal linking.
  const orphanish = pages.filter((p) => p.internalLinks.length < 3 && p.pageType !== "home");
  if (orphanish.length > pages.length / 2) {
    score -= 8;
    issues.push("Weak internal linking — many pages link out to few others.");
    recommendations.push("Add contextual internal links between related service/location pages.");
  } else {
    evidence.push("Internal linking present across crawled pages.");
  }

  // Search appearance signal from GSC (poor CTR at decent position).
  if (connected && searchConsoleRows.length > 0) {
    const poorCtr = searchConsoleRows.filter((r) => r.position <= 12 && r.ctr < 0.02 && r.impressions > 200);
    if (poorCtr.length > 0) {
      score -= 6;
      issues.push(`${poorCtr.length} query(ies) rank on page 1 but earn poor CTR — titles/snippets may be weak.`);
      recommendations.push("Rewrite titles/meta for high-impression, low-CTR queries to better match intent.");
    }
  }

  evidence.push(`${pages.length} pages analyzed; ${new Set(titles).size} unique titles.`);
  return { score: clamp(Math.round(score)), label: "SEO Foundation", evidence, issues, recommendations };
}

// --- Technical SEO ---------------------------------------------------------

export function scoreTechnicalSeo(input: ScoringInput): ScoreBreakdown {
  const { pages, siteSignals } = input;
  if (pages.length === 0) return empty("Technical SEO");
  const evidence: string[] = [];
  const issues: string[] = [];
  const recommendations: string[] = [];
  let score = 100;

  if (siteSignals && !siteSignals.https) {
    score -= 25;
    issues.push("Site is not served over HTTPS.");
    recommendations.push("Enable HTTPS (free via Let's Encrypt or your host) and redirect HTTP→HTTPS.");
  } else if (siteSignals) {
    evidence.push("Served over HTTPS.");
  }

  const missingCanonical = pages.filter((p) => !p.canonicalUrl);
  if (missingCanonical.length > pages.length / 2) {
    score -= 8;
    issues.push("Most pages have no canonical tag — duplicate-content risk.");
    recommendations.push("Add self-referencing canonical tags to consolidate signals.");
  }

  const multiH1 = pages.filter((p) => p.h1Count > 1);
  if (multiH1.length > 0) {
    score -= Math.min(8, multiH1.length * 3);
    issues.push(`${multiH1.length} page(s) have multiple H1s — keep one clear H1 per page.`);
  }
  const noH1 = pages.filter((p) => p.h1Count === 0);
  if (noH1.length > 0) {
    score -= Math.min(8, noH1.length * 4);
    issues.push(`${noH1.length} page(s) missing an H1 heading.`);
  }

  const avgMobile = avg(pages.map((p) => p.mobileScore ?? 60));
  const avgDesktop = avg(pages.map((p) => p.pageSpeedScore ?? 65));
  if (avgMobile < 50) {
    score -= 18;
    issues.push(`Poor average mobile performance (${Math.round(avgMobile)}/100) — Core Web Vitals likely failing.`);
    recommendations.push("Compress images, defer non-critical JS, and reduce layout shift on mobile.");
  } else if (avgMobile < 70) {
    score -= 8;
    issues.push(`Mobile performance is mediocre (${Math.round(avgMobile)}/100).`);
  } else {
    evidence.push(`Average mobile performance: ${Math.round(avgMobile)}/100.`);
  }
  evidence.push(`Average desktop performance: ${Math.round(avgDesktop)}/100.`);

  // JS-trapped content heuristic: very low word count but a heavy page.
  const thinDom = pages.filter((p) => p.wordCount < 80);
  if (thinDom.length > 0) {
    score -= 6;
    issues.push(`${thinDom.length} page(s) returned very little crawlable text — content may be JS-rendered or trapped in images.`);
    recommendations.push("Ensure core content is in server-rendered HTML, not hidden behind JS or images.");
  }

  return { score: clamp(Math.round(score)), label: "Technical SEO", evidence, issues, recommendations };
}

// --- Content Quality -------------------------------------------------------

export function scoreContentQuality(input: ScoringInput): ScoreBreakdown {
  const { pages, business } = input;
  if (pages.length === 0) return empty("Content Quality");
  const evidence: string[] = [];
  const issues: string[] = [];
  const recommendations: string[] = [];
  let score = 100;

  const thin = pages.filter((p) => p.wordCount < 250 && ["service", "product", "location", "home"].includes(p.pageType));
  if (thin.length > 0) {
    score -= Math.min(24, thin.length * 8);
    issues.push(`${thin.length} key page(s) have thin content (<250 words).`);
    recommendations.push(
      "Expand key pages with genuinely useful, first-hand detail: what's included, process, pricing expectations, FAQs.",
    );
  } else {
    evidence.push("Key pages have reasonable content depth.");
  }

  const altGap = pages.reduce((s, p) => s + p.imagesMissingAlt, 0);
  const totalImg = pages.reduce((s, p) => s + p.imageCount, 0);
  if (totalImg > 0 && altGap / totalImg > 0.3) {
    score -= 8;
    issues.push(`${altGap} of ${totalImg} images are missing descriptive alt text.`);
    recommendations.push("Add descriptive alt text to images placed near relevant content.");
  }

  // Service specificity: are profitable services actually covered on pages?
  const services = (business?.profitableServices ?? business?.topServices ?? []).map((s) => s.toLowerCase());
  const covered = services.filter((svc) =>
    pages.some((p) => p.detectedServices.some((d) => d.includes(svc.split(" ")[0])) || (p.bodySummary ?? "").toLowerCase().includes(svc)),
  );
  if (services.length > 0 && covered.length < services.length) {
    score -= 12;
    issues.push(`Not all profitable services have dedicated, specific content (${covered.length}/${services.length} covered).`);
    recommendations.push("Create a focused, specific page for each profitable service rather than one generic page.");
  }

  // Trust / proof.
  const hasProof = pages.some((p) => p.trustSignals.length > 0);
  if (!hasProof) {
    score -= 12;
    issues.push("No clear proof detected (reviews, testimonials, case studies, credentials).");
    recommendations.push("Add real reviews/testimonials and proof of work to build trust (E-E-A-T).");
  } else {
    evidence.push("Trust signals detected on the site.");
  }

  return { score: clamp(Math.round(score)), label: "Content Quality", evidence, issues, recommendations };
}

// --- Local Visibility ------------------------------------------------------

export function scoreLocalVisibility(input: ScoringInput): ScoreBreakdown {
  const { pages, business } = input;
  if (pages.length === 0) return empty("Local Visibility");
  const evidence: string[] = [];
  const issues: string[] = [];
  const recommendations: string[] = [];
  let score = 100;

  const hasLocalSchema = pages.some((p) => p.schemaTypes.some((t) => /LocalBusiness/i.test(t)));
  if (!hasLocalSchema) {
    score -= 16;
    issues.push("No LocalBusiness schema detected.");
    recommendations.push("Add LocalBusiness structured data (name, address, phone, hours, area served).");
  } else {
    evidence.push("LocalBusiness schema present.");
  }

  const locationMentions = pages.filter((p) => p.detectedLocations.length > 0).length;
  if (locationMentions === 0) {
    score -= 18;
    issues.push("Little or no location relevance detected in page content.");
    recommendations.push("Reference your service area naturally in titles, headings, and body copy.");
  } else {
    evidence.push(`${locationMentions} page(s) reference location/service-area terms.`);
  }

  const hasPhone = pages.some((p) => p.phoneLinks.length > 0);
  if (!hasPhone) {
    score -= 14;
    issues.push("No click-to-call phone link found — important for local intent.");
    recommendations.push("Add a tappable phone number in the header and on service pages.");
  }

  // Dedicated location pages?
  const locationPages = pages.filter((p) => p.pageType === "location").length;
  if (locationPages === 0 && business?.serviceArea) {
    score -= 8;
    issues.push("No dedicated location/service-area pages for a multi-area business.");
    recommendations.push("Create useful (not thin) location pages only where you genuinely serve and can differentiate.");
  }

  return { score: clamp(Math.round(score)), label: "Local Visibility", evidence, issues, recommendations };
}

// --- AI Search Readiness ---------------------------------------------------

export function scoreAiSearchReadiness(input: ScoringInput): ScoreBreakdown {
  const { pages } = input;
  if (pages.length === 0) return empty("AI Search Readiness");
  const evidence: string[] = [];
  const issues: string[] = [];
  const recommendations: string[] = [];
  let score = 100;

  // AI search readiness is built on strong fundamentals — not hacks.
  const crawlableText = avg(pages.map((p) => Math.min(1, p.wordCount / 400))) * 100;
  if (crawlableText < 50) {
    score -= 16;
    issues.push("Limited crawlable, substantive text — AI systems summarize from visible HTML content.");
    recommendations.push("Ensure clear, useful text is server-rendered and not locked in images/JS.");
  } else {
    evidence.push("Pages expose substantive, crawlable text.");
  }

  const hasFaq = pages.some(
    (p) => p.schemaTypes.some((t) => /FAQ/i.test(t)) || (p.headings.h2.some((h) => /\?$/.test(h)) ),
  );
  if (!hasFaq) {
    score -= 8;
    issues.push("No genuinely useful FAQ content detected.");
    recommendations.push("Add FAQs only where they answer real customer questions (don't over-rely on FAQ schema).");
  } else {
    evidence.push("FAQ-style content detected.");
  }

  const hasAbout = pages.some((p) => p.pageType === "about");
  const hasContact = pages.some((p) => p.pageType === "contact");
  if (!hasAbout || !hasContact) {
    score -= 10;
    issues.push("Missing a clear About and/or Contact page — weakens entity/trust signals AI systems rely on.");
    recommendations.push("Publish strong About + Contact pages explaining who you are, where you operate, and how to reach you.");
  }

  const hasProof = pages.some((p) => p.trustSignals.length > 0);
  if (!hasProof) {
    score -= 8;
    issues.push("Little first-hand experience/proof — commodity content is less likely to be cited by AI search.");
    recommendations.push("Add first-hand expertise, original photos, and specific local detail that competitors can't copy.");
  }

  const hasSchema = pages.some((p) => p.schemaTypes.length > 0);
  if (hasSchema) evidence.push("Structured data present (used appropriately, not overstated).");

  evidence.push("Note: AI Search visibility is earned through helpful, people-first content — there are no reliable 'AEO/GEO hacks.'");
  return { score: clamp(Math.round(score)), label: "AI Search Readiness", evidence, issues, recommendations };
}

// --- Measurement Confidence ------------------------------------------------

export function scoreMeasurementConfidence(input: ScoringInput): ScoreBreakdown {
  const { gtm, ga4Rows, adsRows, connected } = input;
  const evidence: string[] = [];
  const issues: string[] = [];
  const recommendations: string[] = [];

  if (!connected) {
    return {
      score: 35,
      label: "Measurement Confidence",
      evidence: ["No analytics/tag data connected."],
      issues: ["Measurement can't be verified in a URL-only audit."],
      recommendations: ["Connect GA4 + GTM to verify conversions are tracked correctly before scaling spend."],
    };
  }

  let score = 100;
  if (!gtm) {
    score -= 35;
    issues.push("No GTM container connected — tag setup is unverified.");
  } else {
    const adsConv = gtm.tags.filter((t) => t.type.toLowerCase().includes("awct")).length;
    if (adsConv === 0) {
      score -= 25;
      issues.push("No Google Ads conversion tag — spend can't be optimized toward leads.");
      recommendations.push("Install a Google Ads conversion tag before scaling spend.");
    }
    if (adsConv > 1) {
      score -= 12;
      issues.push("Duplicate Google Ads conversion tags risk inflating reported conversions.");
    }
    if (!gtm.triggers.some((t) => t.type.toLowerCase().includes("form"))) {
      score -= 12;
      issues.push("No form-submit trigger — primary lead action likely untracked.");
    }
  }

  if (ga4Rows.length > 0 && ga4Rows.every((r) => r.keyEvents === 0)) {
    score -= 12;
    issues.push("GA4 reports zero key events — conversions may not be marked as key events.");
  }
  if (adsRows.length > 0 && adsRows.every((r) => r.conversions === 0)) {
    score -= 10;
    issues.push("Google Ads shows spend but zero conversions recorded — tracking gap or genuinely no conversions.");
  }
  if (issues.length === 0) evidence.push("Conversion measurement appears wired up and consistent.");

  return { score: clamp(Math.round(score)), label: "Measurement Confidence", evidence, issues, recommendations };
}
