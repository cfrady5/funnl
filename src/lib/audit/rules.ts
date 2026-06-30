/**
 * Recommendation rules.
 *
 * Each rule inspects the gathered data and, when its condition fires, emits a
 * specific, evidence-backed Recommendation. Rules are deterministic and
 * independent — order doesn't matter; the engine sorts the output by priority.
 */

import { generateId, formatCurrency, formatPercent, microsToCurrency } from "@/lib/utils";
import type { Recommendation, Severity, Difficulty } from "@/lib/types";
import { THRESHOLDS, type ScoringInput } from "./scoring";

const SEVERITY_WEIGHT: Record<Severity, number> = {
  critical: 100,
  high: 75,
  medium: 50,
  low: 25,
};
const DIFFICULTY_WEIGHT: Record<Difficulty, number> = {
  easy: 1,
  medium: 0.85,
  hard: 0.7,
};

function rec(
  partial: Omit<Recommendation, "id" | "priorityScore"> & { priorityScore?: number },
): Recommendation {
  const base = SEVERITY_WEIGHT[partial.severity];
  const priorityScore =
    partial.priorityScore ?? Math.round(base * DIFFICULTY_WEIGHT[partial.difficulty]);
  return { id: generateId("rec"), priorityScore, ...partial };
}

export function generateRecommendations(input: ScoringInput): Recommendation[] {
  const out: Recommendation[] = [];
  const { adsRows, searchTerms, ga4Rows, searchConsoleRows, gtm, pages, business, connected } = input;

  // --- Low CTR rule --------------------------------------------------------
  for (const r of adsRows) {
    if (r.impressions >= THRESHOLDS.highImpressions && r.ctr < THRESHOLDS.lowCtr) {
      out.push(
        rec({
          title: `Rewrite ad copy for "${r.adGroupName}" — high impressions, weak CTR`,
          category: "ad_copy",
          severity: r.impressions > 10000 ? "high" : "medium",
          evidence: [
            `Campaign: ${r.campaignName}`,
            `Ad group: ${r.adGroupName}`,
            `${r.impressions.toLocaleString()} impressions, ${formatPercent(r.ctr)} CTR.`,
            r.keywordText ? `Keyword: ${r.keywordText}` : "",
          ].filter(Boolean),
          whyItMatters:
            "The ad is being shown to plenty of searchers but isn't earning clicks. That usually means the headline doesn't match search intent — you're paying for impressions you can't convert.",
          recommendedFix:
            "Rewrite headlines to mirror the exact search query, add the location, lead with the offer/benefit, and include a clear CTA. Test 3 new responsive search ad headlines against the current set.",
          estimatedImpact: "Lifting CTR from ~1.5% to 3% roughly doubles clicks at the same spend.",
          difficulty: "easy",
          relatedEntityType: "ad_group",
          relatedEntityId: r.adGroupId,
        }),
      );
    }
  }

  // --- Clicks without conversions rule ------------------------------------
  for (const r of adsRows) {
    if (r.clicks >= THRESHOLDS.meaningfulClicks && r.conversions <= 1) {
      out.push(
        rec({
          title: `Diagnose conversion drop-off on "${r.adGroupName}"`,
          category: "landing_page",
          severity: r.clicks > 150 ? "critical" : "high",
          evidence: [
            `${r.clicks} clicks, ${r.conversions} conversions.`,
            r.landingPageUrl ? `Landing page: ${r.landingPageUrl}` : "",
            `Spend: ${formatCurrency(microsToCurrency(r.costMicros))}`,
          ].filter(Boolean),
          whyItMatters:
            "You're paying for clicks that aren't turning into leads. The problem is almost always after the click: message mismatch, form friction, slow mobile load, or broken/missing conversion tracking.",
          recommendedFix:
            "Audit the landing page for message match to the keyword, shorten the form, ensure a click-to-call button, verify mobile speed, and confirm the conversion tag actually fires on submit.",
          estimatedImpact: "Recovering even a 2% conversion rate on this traffic adds several leads/month.",
          difficulty: "medium",
          relatedEntityType: "ad_group",
          relatedEntityId: r.adGroupId,
        }),
      );
    }
  }

  // --- High spend, low return rule ----------------------------------------
  for (const r of adsRows) {
    const cost = microsToCurrency(r.costMicros);
    if (cost >= 300 && (r.conversions === 0 || r.costPerConversion > THRESHOLDS.highCostPerConv)) {
      out.push(
        rec({
          title: `Reallocate budget away from "${r.adGroupName}"`,
          category: "budget_allocation",
          severity: r.conversions === 0 ? "high" : "medium",
          evidence: [
            `Spend: ${formatCurrency(cost)}`,
            `Conversions: ${r.conversions}`,
            r.conversions > 0 ? `CPA: ${formatCurrency(r.costPerConversion)}` : "No conversions recorded.",
          ],
          whyItMatters:
            "This ad group consumes meaningful budget without a proportional return. That money is better spent on ad groups that are already converting profitably.",
          recommendedFix:
            "Pause or cap this ad group, review its match types and search terms, and shift the freed budget to your best-performing service campaigns.",
          estimatedImpact: `Reallocating ~${formatCurrency(cost)}/period toward proven ad groups.`,
          difficulty: "easy",
          relatedEntityType: "ad_group",
          relatedEntityId: r.adGroupId,
        }),
      );
    }
  }

  // --- Negative keyword rule ----------------------------------------------
  for (const t of searchTerms) {
    if (t.conversions === 0 && t.clicks >= 15) {
      out.push(
        rec({
          title: `Add negative keyword: "${t.searchTerm}"`,
          category: "negative_keywords",
          severity: "medium",
          evidence: [
            `Search term: "${t.searchTerm}"`,
            `${t.clicks} clicks, ${formatCurrency(microsToCurrency(t.costMicros))} spent, 0 conversions.`,
            `Matched via: ${t.keywordText} (${t.matchType ?? "?"})`,
          ],
          whyItMatters:
            "This search term is draining budget on intent that doesn't convert (often informational or off-service searches). Adding it as a negative stops the bleed immediately.",
          recommendedFix: `Add "${t.searchTerm}" (or its root) as a negative keyword at the ad group or campaign level.`,
          estimatedImpact: `Recovers ~${formatCurrency(microsToCurrency(t.costMicros))} per period.`,
          difficulty: "easy",
          relatedEntityType: "keyword",
          relatedEntityId: t.adGroupId,
        }),
      );
    }
  }

  // --- Promote high-intent search term to exact keyword -------------------
  for (const t of searchTerms) {
    if (t.conversions >= 2 && t.conversionRate >= 0.06) {
      out.push(
        rec({
          title: `Promote "${t.searchTerm}" to an exact-match keyword`,
          category: "keyword_strategy",
          severity: "medium",
          evidence: [
            `Search term: "${t.searchTerm}"`,
            `${t.conversions} conversions at ${formatPercent(t.conversionRate)} CVR.`,
          ],
          whyItMatters:
            "This exact phrase converts well but is currently being matched loosely. Adding it as an exact-match keyword with its own ad gives you tighter control and better Quality Score.",
          recommendedFix: `Add [${t.searchTerm}] as an exact-match keyword in a dedicated ad group with a message-matched ad + landing page.`,
          estimatedImpact: "Higher CTR and Quality Score → lower CPC on your best-converting query.",
          difficulty: "easy",
          relatedEntityType: "keyword",
          relatedEntityId: t.adGroupId,
        }),
      );
    }
  }

  // --- Poor Quality Score rule --------------------------------------------
  for (const r of adsRows) {
    if (r.qualityScore != null && r.qualityScore <= THRESHOLDS.poorQualityScore) {
      out.push(
        rec({
          title: `Raise Quality Score for "${r.keywordText ?? r.adGroupName}" (QS ${r.qualityScore}/10)`,
          category: "bidding",
          severity: "medium",
          evidence: [`Keyword: ${r.keywordText}`, `Quality Score: ${r.qualityScore}/10`],
          whyItMatters:
            "A low Quality Score means you pay more per click and rank lower than competitors for the same bid. It's driven by ad relevance, expected CTR, and landing page experience.",
          recommendedFix:
            "Move the keyword into a tightly themed ad group, write an ad that includes the keyword, and point it at a relevant landing page.",
          estimatedImpact: "Each Quality Score point can cut CPC meaningfully on affected keywords.",
          difficulty: "medium",
          relatedEntityType: "keyword",
          relatedEntityId: r.adGroupId,
        }),
      );
    }
  }

  // --- Landing page mismatch rule (homepage for service-specific intent) --
  for (const r of adsRows) {
    const lp = (r.landingPageUrl ?? "").replace(/\/+$/, "");
    const isHome = lp === "" || /\/$|^https?:\/\/[^/]+$/.test(r.landingPageUrl ?? "");
    const serviceSpecific = /near me|mowing|mulch|cleanup|repair|installation|service/i.test(
      `${r.keywordText} ${r.adGroupName}`,
    );
    if (r.landingPageUrl && isHome && serviceSpecific) {
      out.push(
        rec({
          title: `Send "${r.adGroupName}" traffic to a service page, not the homepage`,
          category: "landing_page",
          severity: "high",
          evidence: [
            `Keyword/ad group: ${r.keywordText ?? r.adGroupName}`,
            `Landing page: ${r.landingPageUrl} (homepage)`,
          ],
          whyItMatters:
            "Service-specific searchers landing on a generic homepage have to hunt for what they searched for. Message-matched landing pages convert far better than the homepage.",
          recommendedFix:
            "Build a dedicated landing page for this service (headline = the search, one clear offer, short form, click-to-call) and point the ad group's final URL there.",
          estimatedImpact: "Message-matched pages commonly lift conversion rate 30–100% vs. the homepage.",
          difficulty: "medium",
          relatedEntityType: "ad_group",
          relatedEntityId: r.adGroupId,
        }),
      );
    }
  }

  // --- Organic demand gap rule --------------------------------------------
  if (connected) {
    const paidKeywords = new Set(adsRows.map((r) => (r.keywordText ?? "").toLowerCase()));
    for (const q of searchConsoleRows) {
      const inPaid = [...paidKeywords].some((kw) => kw && (q.query.includes(kw) || kw.includes(q.query)));
      if (
        q.impressions >= THRESHOLDS.highImpressionGsc &&
        q.position > THRESHOLDS.commercialIntentMaxPosition &&
        !inPaid
      ) {
        out.push(
          rec({
            title: `Capture organic demand: "${q.query}"`,
            category: "organic_gap",
            severity: "high",
            evidence: [
              `Query: "${q.query}"`,
              `${q.impressions.toLocaleString()} organic impressions, avg position ${q.position.toFixed(1)}.`,
              `Top page: ${q.page}`,
            ],
            whyItMatters:
              "Search Console shows real, repeated demand for this query — but you rank poorly organically and aren't bidding on it. Competitors are capturing this traffic.",
            recommendedFix:
              "Create a dedicated paid ad group + message-matched landing page for this query theme to capture the demand immediately while organic catches up.",
            estimatedImpact: `Tapping ${q.impressions.toLocaleString()} impressions of unmet demand.`,
            difficulty: "medium",
            relatedEntityType: "query",
            relatedEntityId: null,
          }),
        );
      }
    }
  }

  // --- GA4 paid-no-conversion rule ----------------------------------------
  for (const r of ga4Rows) {
    if (r.medium === "cpc" && r.sessions >= 50 && r.conversions === 0) {
      out.push(
        rec({
          title: `Paid landing page ${r.landingPage} gets traffic but no conversions`,
          category: "landing_page",
          severity: "high",
          evidence: [
            `Source/medium: ${r.source} / ${r.medium}`,
            `${r.sessions} sessions, ${r.conversions} key events.`,
            `Engagement: ${formatPercent(r.sessions > 0 ? r.engagedSessions / r.sessions : 0)}`,
          ],
          whyItMatters:
            "GA4 confirms paid visitors are arriving but not completing the goal. This is a landing-page or tracking problem, not a traffic problem.",
          recommendedFix:
            "Verify the conversion event fires, then improve message match and reduce form friction on this page.",
          estimatedImpact: "Converting even 3% of these sessions adds steady leads at no extra ad spend.",
          difficulty: "medium",
          relatedEntityType: "page",
          relatedEntityId: null,
        }),
      );
    }
  }

  // --- Tracking missing rule ----------------------------------------------
  if (connected) {
    if (!gtm) {
      out.push(
        rec({
          title: "Set up conversion tracking before scaling paid ads",
          category: "conversion_tracking",
          severity: "critical",
          evidence: ["No GTM container is connected to this account."],
          whyItMatters:
            "Without conversion tracking you're flying blind. Smart Bidding can't optimize, and you can't tell which keywords actually produce leads — so every scaling decision is a guess.",
          recommendedFix:
            "Install Google Tag Manager, add a GA4 configuration tag, a Google Ads conversion tag, and triggers for form submits and phone clicks.",
          estimatedImpact: "Unlocks conversion-based bidding — typically the single biggest efficiency gain.",
          difficulty: "medium",
          relatedEntityType: "tracking",
          relatedEntityId: null,
        }),
      );
    } else {
      const tagTypes = gtm.tags.map((t) => t.type.toLowerCase());
      const triggerTypes = gtm.triggers.map((t) => t.type.toLowerCase());
      const phoneOnSite = pages.some((p) => p.phoneLinks.length > 0);

      if (!tagTypes.some((t) => t.includes("awct"))) {
        out.push(
          rec({
            title: "Add a Google Ads conversion tag",
            category: "conversion_tracking",
            severity: "critical",
            evidence: ["GTM container has no Google Ads conversion tag."],
            whyItMatters:
              "Google Ads can't optimize bidding toward leads it can't see. Without a conversion tag, Smart Bidding and conversion reporting don't work.",
            recommendedFix:
              "Create a conversion action in Google Ads, then add the Google Ads Conversion Tracking tag in GTM firing on your lead events.",
            estimatedImpact: "Enables conversion-based bidding and accurate CPA reporting.",
            difficulty: "medium",
            relatedEntityType: "tracking",
            relatedEntityId: null,
          }),
        );
      }
      if (!triggerTypes.some((t) => t.includes("form"))) {
        out.push(
          rec({
            title: "Add a form-submission trigger + conversion event",
            category: "conversion_tracking",
            severity: "high",
            evidence: ["No form-submission trigger found in GTM."],
            whyItMatters: "Form fills are likely your primary lead source and they're going untracked.",
            recommendedFix: "Create a Form Submission trigger and fire GA4 + Ads conversion tags on it.",
            estimatedImpact: "Makes your main lead action measurable and optimizable.",
            difficulty: "easy",
            relatedEntityType: "tracking",
            relatedEntityId: null,
          }),
        );
      }
      if (phoneOnSite && !triggerTypes.some((t) => t.includes("click"))) {
        out.push(
          rec({
            title: "Track phone-click conversions",
            category: "conversion_tracking",
            severity: "high",
            evidence: ["Phone (tel:) links exist on the site but no click trigger tracks them."],
            whyItMatters:
              "For a phone-heavy local service business, calls are a primary conversion. Untracked, you can't tell which keywords drive calls.",
            recommendedFix:
              "Enable Click URL built-in variable, add a click trigger matching tel: links, and fire a phone-call conversion.",
            estimatedImpact: "Reveals call-driving keywords so you can bid toward them.",
            difficulty: "easy",
            relatedEntityType: "tracking",
            relatedEntityId: null,
          }),
        );
      }
    }
  }

  // --- Mixed ad group rule ------------------------------------------------
  for (const r of adsRows) {
    if (/general|\+|and|misc/i.test(r.adGroupName ?? "")) {
      out.push(
        rec({
          title: `Split mixed ad group "${r.adGroupName}" into single-theme groups`,
          category: "campaign_structure",
          severity: "medium",
          evidence: [`Ad group name suggests multiple unrelated themes: "${r.adGroupName}".`],
          whyItMatters:
            "When unrelated keywords share an ad group, one ad can't be relevant to all of them — hurting CTR and Quality Score across the board.",
          recommendedFix:
            "Break the ad group into tightly themed groups (one service/intent each) with dedicated ads.",
          estimatedImpact: "Tighter relevance lifts CTR and lowers CPC across the split groups.",
          difficulty: "medium",
          relatedEntityType: "ad_group",
          relatedEntityId: r.adGroupId,
        }),
      );
    }
  }

  // --- Missing service coverage (URL-only friendly) -----------------------
  const services = (business?.profitableServices ?? []).map((s) => s.toLowerCase());
  if (services.length > 0 && pages.length > 0) {
    const servicePages = pages.filter((p) => p.pageType === "service").length;
    if (servicePages === 0) {
      out.push(
        rec({
          title: "Build dedicated landing pages for your profitable services",
          category: "landing_page",
          severity: "high",
          evidence: [
            `Profitable services: ${services.join(", ")}.`,
            "No dedicated service landing pages were found during the crawl.",
          ],
          whyItMatters:
            "Each profitable service deserves its own message-matched page so paid (and organic) traffic for that service converts instead of bouncing off a generic page.",
          recommendedFix:
            "Create one focused landing page per service: headline matching the search, the offer, a short form, and click-to-call.",
          estimatedImpact: "Message-matched pages typically convert 30–100% better than a shared homepage.",
          difficulty: "medium",
          relatedEntityType: "page",
          relatedEntityId: null,
        }),
      );
    }
  }

  // Sort by priority, dedupe by title.
  const seen = new Set<string>();
  return out
    .filter((r) => (seen.has(r.title) ? false : (seen.add(r.title), true)))
    .sort((a, b) => b.priorityScore - a.priorityScore);
}
