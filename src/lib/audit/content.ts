/**
 * Content strategy engine.
 *
 * Produces a prioritized content roadmap from crawl gaps + business services +
 * (when connected) Search Console queries and Google Ads search terms. Strictly
 * avoids recommending thin, scaled, keyword-variation pages — every item is a
 * substantive, intent-matched page with required sections and a business goal.
 */

import { generateId } from "@/lib/utils";
import type { ContentOpportunity } from "@/lib/types";
import type { ScoringInput } from "./scoring";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function generateContentOpportunities(input: ScoringInput): ContentOpportunity[] {
  const out: ContentOpportunity[] = [];
  const { pages, business, searchConsoleRows, searchTerms, connected } = input;
  const services = business?.profitableServices?.length
    ? business.profitableServices
    : business?.topServices ?? [];
  const location = business?.primaryLocation ?? business?.serviceArea ?? "your area";

  const existingServicePages = new Set(
    pages.filter((p) => p.pageType === "service").flatMap((p) => p.detectedServices),
  );

  // 1. Dedicated service pages for profitable services lacking one.
  for (const svc of services.slice(0, 5)) {
    const key = svc.toLowerCase().split(" ")[0];
    const covered = [...existingServicePages].some((s) => s.includes(key));
    if (!covered) {
      out.push({
        id: generateId("content"),
        pageType: "service",
        title: `${svc} in ${location}`,
        slug: `/${slugify(svc)}`,
        searchIntent: "commercial",
        queryCluster: [svc.toLowerCase(), `${svc.toLowerCase()} ${location.toLowerCase()}`, `${svc.toLowerCase()} near me`],
        userProblem: `Someone needs ${svc.toLowerCase()} and is comparing local providers.`,
        businessGoal: "Capture high-intent local demand and convert it into a lead.",
        requiredSections: [
          "Hero with the service + location and a clear offer",
          "What's included / your process",
          "Pricing or 'what to expect' guidance",
          "Proof: reviews, photos, credentials",
          "FAQ answering real customer questions",
          "Primary CTA (quote form) + click-to-call",
        ],
        trustElements: ["Reviews/testimonials", "Before/after photos", "Licensed & insured badge"],
        suggestedCta: "Get a free quote",
        internalLinks: ["Homepage", "Related service pages", "Contact"],
        structuredDataRecommendation: "Service + LocalBusiness JSON-LD",
        ppcRelevance: `Use as the landing page for the '${svc}' ad group instead of the homepage.`,
        priorityScore: 88,
      });
    }
  }

  // 2. New-service-demand pages from Search Console / search terms (connected).
  if (connected) {
    const demandQueries = [
      ...searchConsoleRows.filter((r) => r.impressions >= 400 && r.position > 8).map((r) => r.query),
      ...searchTerms.filter((t) => t.conversions >= 1).map((t) => t.searchTerm ?? ""),
    ].filter(Boolean);
    const seen = new Set<string>();
    for (const q of demandQueries.slice(0, 6)) {
      if (seen.has(q)) continue;
      seen.add(q);
      const alreadyService = services.some((s) => q.toLowerCase().includes(s.toLowerCase().split(" ")[0]));
      if (alreadyService) continue;
      out.push({
        id: generateId("content"),
        pageType: "location_service",
        title: q.replace(/\b\w/g, (c) => c.toUpperCase()),
        slug: `/${slugify(q)}`,
        searchIntent: "commercial",
        queryCluster: [q.toLowerCase()],
        userProblem: `There's measured demand for "${q}" with no dedicated page to satisfy it.`,
        businessGoal: "Convert proven organic/paid demand instead of sending it to a generic page.",
        requiredSections: ["Intent-matched hero", "Specific service detail", "Proof", "FAQ", "Quote form + phone"],
        trustElements: ["Local reviews", "Service-area map"],
        suggestedCta: "Request a quote",
        internalLinks: ["Relevant service page", "Contact"],
        structuredDataRecommendation: "Service + FAQ JSON-LD (only if FAQs are genuinely useful)",
        ppcRelevance: "Strong PPC + SEO overlap — back this page with a matching ad group.",
        priorityScore: 82,
      });
    }
  }

  // 3. Proof / case-study page if none exists.
  if (!pages.some((p) => p.trustSignals.length > 0)) {
    out.push({
      id: generateId("content"),
      pageType: "proof",
      title: "Reviews & Recent Work",
      slug: "/reviews",
      searchIntent: "commercial",
      queryCluster: [`${(services[0] ?? "service").toLowerCase()} reviews`, "trusted local provider"],
      userProblem: "Prospects want proof you do good work before they call.",
      businessGoal: "Reduce friction and increase conversion across all traffic.",
      requiredSections: ["Aggregated reviews", "Before/after gallery", "Short case studies", "Trust badges"],
      trustElements: ["Verified reviews", "Photos", "Credentials"],
      suggestedCta: "See if we serve your area",
      internalLinks: ["Service pages", "Contact"],
      structuredDataRecommendation: "Review/AggregateRating only if backed by real, verifiable reviews",
      ppcRelevance: "Link from ads' sitelinks to reinforce trust.",
      priorityScore: 70,
    });
  }

  // 4. Helpful FAQ/support content (people-first, not for every variation).
  out.push({
    id: generateId("content"),
    pageType: "faq",
    title: `${services[0] ?? "Service"} FAQs — Costs, Timing & What to Expect`,
    slug: "/faqs",
    searchIntent: "informational",
    queryCluster: [`how much does ${(services[0] ?? "service").toLowerCase()} cost`, "what to expect"],
    userProblem: "Buyers research costs and process before committing.",
    businessGoal: "Build trust early and capture top-of-funnel demand that converts later.",
    requiredSections: ["Genuine, specific FAQs", "Transparent pricing guidance", "Process timeline", "CTA"],
    trustElements: ["First-hand expertise", "Local specifics"],
    suggestedCta: "Get an exact quote",
    internalLinks: ["Service pages", "Reviews"],
    structuredDataRecommendation: "FAQ JSON-LD only for genuinely useful Q&As (don't over-rely on it)",
    ppcRelevance: "Supports informational keywords; not a primary PPC landing page.",
    priorityScore: 58,
  });

  return out.sort((a, b) => b.priorityScore - a.priorityScore);
}
