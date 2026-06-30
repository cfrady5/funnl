/**
 * Deterministic scoring engine.
 *
 * Every score is computed from concrete data — NOT from an LLM. The AI layer
 * (lib/ai/summary.ts) only narrates these findings. Each function returns a
 * 0–100 score plus the evidence/issues/recommendations that justify it, so the
 * report can always explain *why* a number is what it is.
 */

import { clamp, formatCurrency, formatPercent, microsToCurrency } from "@/lib/utils";
import type {
  Business,
  CrawledPage,
  Ga4Row,
  GoogleAdsRow,
  GtmSnapshot,
  ScoreBreakdown,
  SearchConsoleRow,
  SiteSignals,
} from "@/lib/types";

export type CrawledPageInput = Omit<CrawledPage, "id" | "auditId" | "createdAt">;

export interface ScoringInput {
  business: Pick<
    Business,
    "primaryConversionGoal" | "profitableServices" | "topServices" | "monthlyAdBudget" | "primaryLocation" | "serviceArea"
  > | null;
  pages: CrawledPageInput[];
  siteSignals: SiteSignals | null;
  adsRows: GoogleAdsRow[];
  searchTerms: GoogleAdsRow[];
  ga4Rows: Ga4Row[];
  searchConsoleRows: SearchConsoleRow[];
  gtm: GtmSnapshot | null;
  connected: boolean;
}

// Thresholds — centralized so they are easy to tune and document.
export const THRESHOLDS = {
  lowCtr: 0.02, // below 2% on local high-intent search is weak
  highImpressions: 3000,
  meaningfulClicks: 50,
  lowConvRate: 0.02,
  highCostPerConv: 120,
  poorQualityScore: 5,
  highImpressionGsc: 400,
  commercialIntentMaxPosition: 8, // worse (higher) than this = PPC opportunity
};

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

// --- Landing page readiness ------------------------------------------------

export function scoreLandingPageReadiness(input: ScoringInput): ScoreBreakdown {
  const { pages } = input;
  const evidence: string[] = [];
  const issues: string[] = [];
  const recommendations: string[] = [];

  if (pages.length === 0) {
    return {
      score: 0,
      label: "Landing Page Conversion",
      evidence: ["No pages were crawled."],
      issues: ["The website could not be crawled."],
      recommendations: ["Verify the URL is publicly reachable and re-run the audit."],
    };
  }

  let score = 100;
  const home = pages.find((p) => p.pageType === "home") ?? pages[0];

  const pagesWithForms = pages.filter((p) => p.forms.length > 0);
  const homeHasForm = home.forms.length > 0;
  const anyServiceLp = pages.some((p) => p.pageType === "service" && p.forms.length > 0);
  const phonePresent = pages.some((p) => p.phoneLinks.length > 0);
  const avgMobile = avg(pages.map((p) => p.mobileScore ?? 60));
  const avgDesktop = avg(pages.map((p) => p.pageSpeedScore ?? 65));
  const hasLocalSchema = pages.some((p) =>
    p.schemaTypes.some((t) => /LocalBusiness|Service|Organization/i.test(t)),
  );

  if (!homeHasForm) {
    score -= 18;
    issues.push("Homepage has no lead capture form — paid clicks must navigate to convert.");
    recommendations.push(
      "Add a short, above-the-fold lead form (or quote request) to the homepage so paid traffic can convert immediately.",
    );
  } else {
    evidence.push("Homepage has a lead capture form.");
  }

  if (!anyServiceLp) {
    score -= 16;
    issues.push("No service-specific landing page with its own conversion path.");
    recommendations.push(
      "Build dedicated, message-matched landing pages for each profitable service with their own form/CTA.",
    );
  }

  if (!phonePresent) {
    score -= 10;
    issues.push("No click-to-call phone link detected.");
    recommendations.push("Add a tappable tel: link in the header for mobile callers.");
  } else {
    evidence.push("Click-to-call phone link is present.");
  }

  if (avgMobile < 60) {
    score -= 18;
    issues.push(`Weak average mobile performance score (${Math.round(avgMobile)}/100).`);
    recommendations.push(
      "Improve mobile speed (compress images, defer scripts) — most local paid clicks are mobile.",
    );
  } else {
    evidence.push(`Average mobile performance score: ${Math.round(avgMobile)}/100.`);
  }

  if (avgDesktop < 60) {
    score -= 6;
    issues.push(`Below-average desktop performance score (${Math.round(avgDesktop)}/100).`);
  }

  if (!hasLocalSchema) {
    score -= 8;
    issues.push("No LocalBusiness/Service schema markup detected.");
    recommendations.push("Add LocalBusiness + Service structured data to strengthen local relevance.");
  } else {
    evidence.push("Structured data (schema) detected.");
  }

  // Long forms add friction.
  const longForm = pagesWithForms.find((p) => p.forms.some((f) => f.fieldCount > 5));
  if (longForm) {
    score -= 6;
    issues.push(`A form has more than 5 fields (${longForm.url}) — friction for paid traffic.`);
    recommendations.push("Reduce form length to name, phone/email, and service to lift conversion rate.");
  }

  evidence.push(`${pages.length} pages crawled, ${pagesWithForms.length} with forms.`);

  return {
    score: clamp(Math.round(score)),
    label: "Landing Page Conversion",
    evidence,
    issues,
    recommendations,
  };
}

// --- Tracking readiness ----------------------------------------------------

export function scoreTrackingReadiness(input: ScoringInput): ScoreBreakdown {
  const { gtm, ga4Rows, pages, connected } = input;
  const evidence: string[] = [];
  const issues: string[] = [];
  const recommendations: string[] = [];

  if (!gtm && !connected) {
    return {
      score: 40,
      label: "Tracking Confidence",
      evidence: ["No GTM container connected (URL-only audit)."],
      issues: ["Conversion tracking could not be inspected without a GTM connection."],
      recommendations: [
        "Connect Google Tag Manager to verify GA4 config, Ads conversion, and form/phone tracking.",
      ],
    };
  }

  if (!gtm) {
    return {
      score: 25,
      label: "Tracking Confidence",
      evidence: ["No GTM container was found for this site."],
      issues: ["No tag management detected — conversion measurement is likely missing or ad-hoc."],
      recommendations: [
        "Install Google Tag Manager and configure GA4 + Google Ads conversion tags before scaling spend.",
      ],
    };
  }

  let score = 100;
  const tagTypes = gtm.tags.map((t) => t.type.toLowerCase());
  const triggerTypes = gtm.triggers.map((t) => t.type.toLowerCase());

  const hasGa4Config = tagTypes.some((t) => t.includes("gaawc"));
  const hasGa4Event = tagTypes.some((t) => t.includes("gaawe"));
  const hasAdsConversion = tagTypes.some((t) => t.includes("awct") || t.includes("sp"));
  const hasFormTrigger = triggerTypes.some((t) => t.includes("form"));
  const hasClickTrigger = triggerTypes.some((t) => t.includes("click"));
  const hasClickVars = gtm.builtInVariables.some((v) => /click/i.test(v));
  const phoneOnSite = pages.some((p) => p.phoneLinks.length > 0);

  if (!hasGa4Config) {
    score -= 25;
    issues.push("No GA4 configuration tag — analytics may not be collecting at all.");
    recommendations.push("Add a GA4 Configuration tag firing on All Pages.");
  } else {
    evidence.push("GA4 configuration tag present.");
  }

  if (!hasAdsConversion) {
    score -= 30;
    issues.push("No Google Ads conversion tag — Ads cannot optimize bidding toward real leads.");
    recommendations.push(
      "Add a Google Ads conversion tag and import the key event so Smart Bidding can optimize toward conversions.",
    );
  } else {
    evidence.push("Google Ads conversion tag present.");
  }

  if (!hasFormTrigger) {
    score -= 18;
    issues.push("No form-submission trigger — form fills are untracked.");
    recommendations.push("Create a Form Submission trigger and fire a conversion event on it.");
  } else {
    evidence.push("Form submission trigger present.");
  }

  if (phoneOnSite && !hasClickTrigger) {
    score -= 14;
    issues.push("Phone links exist on the site but no click trigger tracks tel: taps.");
    recommendations.push("Add a click trigger matching tel: links and fire a phone-call conversion.");
  }

  if (!hasClickVars) {
    score -= 6;
    issues.push("Click-based built-in variables (Click URL/Text) are not enabled.");
    recommendations.push("Enable Click URL and Click Text built-in variables to support click tracking.");
  }

  if (!hasGa4Event && hasGa4Config) {
    score -= 5;
    issues.push("GA4 has a config tag but no event tags — no custom conversions are being sent.");
  }

  // Duplicate conversion tags?
  const adsConvCount = tagTypes.filter((t) => t.includes("awct")).length;
  if (adsConvCount > 1) {
    score -= 8;
    issues.push("Multiple Google Ads conversion tags detected — risk of double-counting.");
    recommendations.push("Consolidate to a single conversion tag per action to avoid inflated counts.");
  }

  if (ga4Rows.length > 0 && ga4Rows.every((r) => r.keyEvents === 0)) {
    score -= 10;
    issues.push("GA4 reports zero key events across landing pages — conversions may not be marked.");
  }

  return {
    score: clamp(Math.round(score)),
    label: "Tracking Confidence",
    evidence,
    issues,
    recommendations,
  };
}

// --- Keyword opportunity ---------------------------------------------------

export function scoreKeywordOpportunity(input: ScoringInput): ScoreBreakdown {
  const { searchConsoleRows, adsRows, business, connected } = input;
  const evidence: string[] = [];
  const issues: string[] = [];
  const recommendations: string[] = [];

  if (!connected || searchConsoleRows.length === 0) {
    return {
      score: 50,
      label: "Keyword Opportunity",
      evidence: ["Search Console not connected — organic demand gaps can't be measured."],
      issues: ["Connect Search Console to surface organic queries you're not bidding on."],
      recommendations: [
        "Connect Google Search Console to reveal high-demand commercial queries missing from paid search.",
      ],
    };
  }

  const paidKeywords = new Set(
    adsRows.map((r) => (r.keywordText ?? "").toLowerCase()).filter(Boolean),
  );

  // Opportunity = high-impression GSC queries with commercial intent not in paid.
  const gaps = searchConsoleRows.filter((r) => {
    const inPaid = [...paidKeywords].some(
      (kw) => r.query.includes(kw) || kw.includes(r.query),
    );
    return (
      r.impressions >= THRESHOLDS.highImpressionGsc &&
      r.position > THRESHOLDS.commercialIntentMaxPosition &&
      !inPaid
    );
  });

  let score = 60; // baseline; opportunity score is "how much upside exists"
  if (gaps.length > 0) {
    // More untapped demand = higher opportunity score.
    score = clamp(60 + gaps.length * 10);
    for (const g of gaps.slice(0, 5)) {
      evidence.push(
        `"${g.query}" — ${g.impressions.toLocaleString()} organic impressions at avg position ${g.position.toFixed(
          1,
        )}, not in paid keywords.`,
      );
    }
    recommendations.push(
      "Create dedicated ad groups + message-matched landing pages for the untapped query themes above.",
    );
    issues.push(`${gaps.length} high-demand commercial queries are not represented in paid search.`);
  } else {
    evidence.push("No major organic-demand gaps detected vs. current paid keywords.");
  }

  // Bonus: profitable services not represented in paid keywords.
  const services = (business?.profitableServices ?? []).map((s) => s.toLowerCase());
  const missingServices = services.filter(
    (svc) => ![...paidKeywords].some((kw) => kw.includes(svc.split(" ")[0])),
  );
  if (missingServices.length > 0) {
    issues.push(
      `Profitable services not covered by paid keywords: ${missingServices.join(", ")}.`,
    );
    recommendations.push(
      "Add campaigns/ad groups for your most profitable services that currently have no paid coverage.",
    );
    score = clamp(score + missingServices.length * 5);
  }

  return {
    score: Math.round(score),
    label: "Keyword Opportunity",
    evidence,
    issues,
    recommendations,
  };
}

// --- Paid search efficiency ------------------------------------------------

export function scorePaidSearchEfficiency(input: ScoringInput): ScoreBreakdown {
  const { adsRows, connected } = input;
  const evidence: string[] = [];
  const issues: string[] = [];
  const recommendations: string[] = [];

  if (!connected || adsRows.length === 0) {
    return {
      score: 50,
      label: "Paid Search Efficiency",
      evidence: ["Google Ads not connected — efficiency can't be measured on live data."],
      issues: ["Connect Google Ads to measure CTR, conversion rate, and cost efficiency."],
      recommendations: ["Connect Google Ads to benchmark CTR, CVR, and cost per conversion."],
    };
  }

  let score = 100;
  const totalImpr = adsRows.reduce((s, r) => s + r.impressions, 0);
  const totalClicks = adsRows.reduce((s, r) => s + r.clicks, 0);
  const totalCost = adsRows.reduce((s, r) => s + microsToCurrency(r.costMicros), 0);
  const totalConv = adsRows.reduce((s, r) => s + r.conversions, 0);
  const blendedCtr = totalImpr > 0 ? totalClicks / totalImpr : 0;
  const blendedCvr = totalClicks > 0 ? totalConv / totalClicks : 0;
  const cpa = totalConv > 0 ? totalCost / totalConv : 0;

  evidence.push(
    `Blended CTR ${formatPercent(blendedCtr)}, CVR ${formatPercent(blendedCvr)}, CPA ${formatCurrency(cpa)} over ${formatCurrency(
      totalCost,
    )} spend.`,
  );

  if (blendedCtr < THRESHOLDS.lowCtr) {
    score -= 22;
    issues.push(`Blended CTR (${formatPercent(blendedCtr)}) is below the 2% benchmark for local high-intent search.`);
    recommendations.push("Tighten ad copy + match types so ads better match searcher intent.");
  }

  const lowCtrAdGroups = adsRows.filter(
    (r) => r.impressions >= THRESHOLDS.highImpressions && r.ctr < THRESHOLDS.lowCtr,
  );
  if (lowCtrAdGroups.length > 0) {
    score -= 12;
    for (const ag of lowCtrAdGroups.slice(0, 3)) {
      issues.push(
        `"${ag.adGroupName}" — ${ag.impressions.toLocaleString()} impressions but only ${formatPercent(ag.ctr)} CTR.`,
      );
    }
  }

  const poorQs = adsRows.filter((r) => r.qualityScore != null && r.qualityScore <= THRESHOLDS.poorQualityScore);
  if (poorQs.length > 0) {
    score -= 12;
    issues.push(
      `${poorQs.length} keyword(s) have a poor Quality Score (≤${THRESHOLDS.poorQualityScore}), inflating CPCs.`,
    );
    recommendations.push("Improve ad relevance + landing page experience to raise Quality Score and lower CPC.");
  }

  const highCpa = adsRows.filter((r) => r.costPerConversion > THRESHOLDS.highCostPerConv && r.conversions > 0);
  if (highCpa.length > 0) {
    score -= 10;
    for (const r of highCpa.slice(0, 3)) {
      issues.push(`"${r.adGroupName}" CPA is ${formatCurrency(r.costPerConversion)} — above target.`);
    }
  }

  if (blendedCvr < THRESHOLDS.lowConvRate) {
    score -= 14;
    issues.push(`Blended conversion rate (${formatPercent(blendedCvr)}) is low.`);
    recommendations.push("Audit landing page message match and form friction to lift conversion rate.");
  }

  return {
    score: clamp(Math.round(score)),
    label: "Paid Search Efficiency",
    evidence,
    issues,
    recommendations,
  };
}

// --- Budget waste risk -----------------------------------------------------
// Higher score = HIGHER risk of wasted budget (this is a risk score, not a grade).

export function scoreBudgetWasteRisk(input: ScoringInput): ScoreBreakdown {
  const { adsRows, searchTerms, connected } = input;
  const evidence: string[] = [];
  const issues: string[] = [];
  const recommendations: string[] = [];

  if (!connected || adsRows.length === 0) {
    return {
      score: 40,
      label: "Budget Waste Risk",
      evidence: ["Google Ads not connected — spend-waste risk can't be quantified."],
      issues: ["Without Ads data, budget waste is unknown."],
      recommendations: ["Connect Google Ads to identify wasted spend on irrelevant search terms."],
    };
  }

  let risk = 10;
  const totalCost = adsRows.reduce((s, r) => s + microsToCurrency(r.costMicros), 0);

  // Spend on zero-conversion ad groups.
  const zeroConvSpend = adsRows
    .filter((r) => r.conversions === 0)
    .reduce((s, r) => s + microsToCurrency(r.costMicros), 0);
  const zeroConvShare = totalCost > 0 ? zeroConvSpend / totalCost : 0;
  if (zeroConvShare > 0.15) {
    risk += Math.min(40, Math.round(zeroConvShare * 60));
    issues.push(
      `${formatPercent(zeroConvShare)} of spend (${formatCurrency(zeroConvSpend)}) is on ad groups with zero conversions.`,
    );
    recommendations.push("Pause or restructure zero-conversion ad groups; reallocate to proven performers.");
  }

  // Wasted search terms (clicks/spend, no conversions, off-intent).
  const wasted = searchTerms.filter((t) => t.conversions === 0 && t.clicks > 0);
  const wastedSpend = wasted.reduce((s, t) => s + microsToCurrency(t.costMicros), 0);
  if (wasted.length > 0) {
    risk += Math.min(25, wasted.length * 6);
    for (const t of wasted.slice(0, 4)) {
      evidence.push(
        `Search term "${t.searchTerm}" spent ${formatCurrency(microsToCurrency(t.costMicros))} with 0 conversions.`,
      );
    }
    recommendations.push(
      `Add negative keywords for off-intent search terms — recovering ~${formatCurrency(wastedSpend)} of spend.`,
    );
    issues.push(`${wasted.length} search terms drew clicks but no conversions.`);
  }

  // Broad match without conversions is risky.
  const riskyBroad = adsRows.filter((r) => r.matchType === "BROAD" && r.conversions <= 1);
  if (riskyBroad.length > 0) {
    risk += 10;
    issues.push(`${riskyBroad.length} broad-match keyword(s) with ≤1 conversion — high waste exposure.`);
    recommendations.push("Tighten broad match to phrase/exact and add negatives before re-expanding.");
  }

  return {
    score: clamp(Math.round(risk)),
    label: "Budget Waste Risk",
    evidence,
    issues,
    recommendations,
  };
}

// --- Campaign structure ----------------------------------------------------

export function scoreCampaignStructure(input: ScoringInput): ScoreBreakdown {
  const { adsRows, connected } = input;
  const evidence: string[] = [];
  const issues: string[] = [];
  const recommendations: string[] = [];

  if (!connected || adsRows.length === 0) {
    return {
      score: 50,
      label: "Campaign Structure",
      evidence: ["Google Ads not connected."],
      issues: [],
      recommendations: ["Connect Google Ads to review campaign + ad group organization."],
    };
  }

  let score = 100;
  const campaigns = new Set(adsRows.map((r) => r.campaignName));
  evidence.push(`${campaigns.size} campaign(s), ${adsRows.length} ad group rows.`);

  // Vague campaign naming.
  const vague = [...campaigns].filter((c) => /general|misc|test|untitled|campaign\s*#?\d/i.test(c));
  if (vague.length > 0) {
    score -= 10;
    issues.push(`Unclear campaign naming: ${vague.join(", ")}.`);
    recommendations.push("Adopt a naming convention: [Service] - [Location] - [Match Type].");
  }

  // Ad groups whose name suggests mixed/unrelated themes.
  const mixed = adsRows.filter((r) => /general|\+|and|misc/i.test(r.adGroupName ?? ""));
  if (mixed.length > 0) {
    score -= 14;
    for (const m of mixed.slice(0, 3)) {
      issues.push(`Ad group "${m.adGroupName}" appears to mix unrelated themes.`);
    }
    recommendations.push("Split mixed ad groups into single-theme groups for tighter ad relevance.");
  }

  return {
    score: clamp(Math.round(score)),
    label: "Campaign Structure",
    evidence,
    issues,
    recommendations,
  };
}

// --- Conversion friction ---------------------------------------------------

export function scoreConversionFriction(input: ScoringInput): ScoreBreakdown {
  const { ga4Rows, adsRows, pages, connected } = input;
  const evidence: string[] = [];
  const issues: string[] = [];
  const recommendations: string[] = [];

  if (!connected || ga4Rows.length === 0) {
    // Fall back to page-structure friction signals only.
    const home = pages.find((p) => p.pageType === "home");
    const friction = home && home.forms.length === 0;
    return {
      score: friction ? 45 : 65,
      label: "Conversion Friction",
      evidence: home ? [`Homepage form present: ${home.forms.length > 0 ? "yes" : "no"}.`] : [],
      issues: friction ? ["Homepage lacks a direct conversion path for paid traffic."] : [],
      recommendations: friction
        ? ["Add a primary conversion action above the fold on paid landing pages."]
        : ["Connect GA4 to measure real conversion friction by landing page."],
    };
  }

  let score = 100;
  const paid = ga4Rows.filter((r) => r.medium === "cpc");
  for (const r of paid) {
    const cvr = r.sessions > 0 ? r.conversions / r.sessions : 0;
    const engagement = r.sessions > 0 ? r.engagedSessions / r.sessions : 0;
    if (r.sessions >= 50 && r.conversions === 0) {
      score -= 18;
      issues.push(`Paid landing page ${r.landingPage} has ${r.sessions} sessions but 0 conversions.`);
      recommendations.push(`Investigate message match + form friction on ${r.landingPage}.`);
    } else if (r.sessions >= 50 && cvr < 0.02) {
      score -= 10;
      issues.push(`Paid landing page ${r.landingPage} converts at only ${formatPercent(cvr)}.`);
    }
    if (engagement < 0.45 && r.sessions >= 50) {
      score -= 6;
      issues.push(`Low engagement (${formatPercent(engagement)}) on ${r.landingPage}.`);
    }
  }

  // Paid traffic landing on the homepage instead of a service page.
  const paidToHome = paid.filter((r) => r.landingPage === "/" || r.landingPage.endsWith("/"));
  if (paidToHome.length > 0) {
    score -= 12;
    issues.push("Paid traffic is landing on the generic homepage rather than a service-specific page.");
    recommendations.push("Route each ad group to a dedicated, message-matched landing page.");
  }

  if (issues.length === 0) {
    evidence.push("Paid landing pages show healthy conversion + engagement.");
  }

  return {
    score: clamp(Math.round(score)),
    label: "Conversion Friction",
    evidence,
    issues,
    recommendations,
  };
}
