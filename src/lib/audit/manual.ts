/**
 * Manual-analytics audit support.
 *
 * Turns user-entered numbers (ManualAnalyticsInput) into:
 *  1. synthetic data rows in the engine's existing shapes (GoogleAdsRow,
 *     Ga4Row, SearchConsoleRow, GtmSnapshot) so the deterministic scoring
 *     engine runs unchanged, and
 *  2. manual-specific recommendations that quote the user's own numbers as
 *     evidence.
 *
 * Precedence is enforced by the engine: connected Google data > manual data >
 * crawl > business assumptions. Blank fields lower a finding's confidence; the
 * audit always runs with whatever is provided.
 */

import { makeRecommendation as rec } from "./priority";
import { formatCurrency, formatPercent } from "@/lib/utils";
import type {
  Ga4Row,
  GoogleAdsRow,
  GtmSnapshot,
  GtmTag,
  GtmTrigger,
  ManualAnalyticsInput,
  Recommendation,
  SearchConsoleRow,
} from "@/lib/types";

const MICROS = 1_000_000;

export function manualHasData(m: ManualAnalyticsInput | null | undefined): boolean {
  if (!m) return false;
  const anyNum = (o: object) =>
    Object.values(o).some((v) => v !== undefined && v !== null && v !== "");
  return (
    anyNum(m.businessContext) ||
    anyNum(m.websiteMetrics) ||
    anyNum(m.ppcMetrics) ||
    anyNum(m.seoMetrics) ||
    anyNum(m.trackingMetrics)
  );
}

export interface SyntheticData {
  adsRows: GoogleAdsRow[];
  searchTerms: GoogleAdsRow[];
  ga4Rows: Ga4Row[];
  searchConsoleRows: SearchConsoleRow[];
  gtm: GtmSnapshot | null;
  hasPpc: boolean;
  hasWeb: boolean;
  hasSeo: boolean;
  hasTracking: boolean;
}

/** Build engine-shaped rows from the manual input. */
export function manualToSyntheticData(m: ManualAnalyticsInput, websiteUrl: string): SyntheticData {
  const ppc = m.ppcMetrics;
  const web = m.websiteMetrics;
  const seo = m.seoMetrics;
  const tr = m.trackingMetrics;

  const hasPpc = numPresent(ppc.impressions) || numPresent(ppc.clicks) || numPresent(ppc.monthlySpend);
  const hasWeb = numPresent(web.sessions) || numPresent(web.conversions) || numPresent(web.paidSessions);
  const hasSeo = numPresent(seo.organicImpressions) || numPresent(seo.organicClicks) || Boolean(seo.topQuery);
  const hasTracking = Object.values(tr).some((v) => v !== undefined);

  // --- Synthetic Google Ads aggregate row ---------------------------------
  const adsRows: GoogleAdsRow[] = [];
  if (hasPpc) {
    const impressions = ppc.impressions ?? 0;
    const clicks = ppc.clicks ?? 0;
    const ctr = ppc.ctr ?? (impressions > 0 ? clicks / impressions : 0);
    const conversions = ppc.conversions ?? 0;
    const spend = ppc.monthlySpend ?? (clicks && ppc.avgCpc ? clicks * ppc.avgCpc : 0);
    const cpa = ppc.costPerConversion ?? (conversions > 0 ? spend / conversions : 0);
    const home = /homepage/.test(ppc.trafficDestination ?? "");
    adsRows.push({
      customerId: "manual",
      campaignId: "manual_c1",
      campaignName: ppc.topCampaign || "Reported paid search",
      adGroupId: "manual_ag1",
      adGroupName: ppc.topAdGroup || ppc.topKeyword || "Reported ad group",
      keywordText: ppc.topKeyword || null,
      searchTerm: null,
      matchType: ppc.negativeKeywordsUsed === false ? "BROAD" : null,
      landingPageUrl: home ? websiteUrl : ppc.trafficDestination === "dedicated" ? `${websiteUrl}/services` : websiteUrl,
      impressions,
      clicks,
      ctr,
      costMicros: spend * MICROS,
      conversions,
      conversionRate: ppc.conversionRate ?? (clicks > 0 ? conversions / clicks : 0),
      costPerConversion: cpa,
      conversionValue: conversions && m.businessContext.averageCustomerValue ? conversions * m.businessContext.averageCustomerValue : 0,
      qualityScore: null,
    });
  }

  // --- Synthetic GA4 rows --------------------------------------------------
  const ga4Rows: Ga4Row[] = [];
  if (hasWeb) {
    const sessions = web.sessions ?? 0;
    const paid = web.paidSessions ?? 0;
    const organic = web.organicSessions ?? Math.max(0, sessions - paid);
    const totalConv = web.conversions ?? 0;
    const engagement = web.bounceOrEngagementRate ?? 0.5;
    const topLp = web.topLandingPageUrl || "/";
    if (paid > 0) {
      ga4Rows.push(synthGa4(topLp, "google", "cpc", paid, web.topLandingPageConversions ?? Math.round(totalConv * (paid / Math.max(1, sessions))), engagement));
    }
    if (organic > 0) {
      ga4Rows.push(synthGa4("/", "google", "organic", organic, Math.round(totalConv * (organic / Math.max(1, sessions))), engagement));
    }
    if (paid === 0 && organic === 0 && sessions > 0) {
      ga4Rows.push(synthGa4(topLp, "(direct)", "(none)", sessions, totalConv, engagement));
    }
  }

  // --- Synthetic Search Console rows --------------------------------------
  const searchConsoleRows: SearchConsoleRow[] = [];
  if (hasSeo) {
    const impr = seo.organicImpressions ?? 0;
    const clicks = seo.organicClicks ?? 0;
    const ctr = seo.organicCtr ?? (impr > 0 ? clicks / impr : 0);
    const position = seo.averagePosition ?? 0;
    if (seo.topQuery || impr > 0) {
      searchConsoleRows.push({
        siteUrl: websiteUrl,
        query: seo.topQuery || "(reported top query)",
        page: seo.topPage || websiteUrl,
        country: "usa",
        device: "ALL",
        clicks,
        impressions: impr,
        ctr,
        position: position || 10,
      });
    }
    if (seo.highImpressionLowCtrPage || seo.highImpressionLowClickQuery) {
      searchConsoleRows.push({
        siteUrl: websiteUrl,
        query: seo.highImpressionLowClickQuery || "(high-impression query)",
        page: seo.highImpressionLowCtrPage || seo.topPage || websiteUrl,
        country: "usa",
        device: "ALL",
        clicks: Math.round((clicks || 10) * 0.2),
        impressions: Math.max(impr, 600),
        ctr: 0.008,
        position: 12,
      });
    }
  }

  // --- Synthetic GTM snapshot from tracking booleans ----------------------
  let gtm: GtmSnapshot | null = null;
  if (hasTracking && (tr.gtmInstalled !== false || tr.analyticsInstalled)) {
    const tags: GtmTag[] = [];
    const triggers: GtmTrigger[] = [];
    if (tr.analyticsInstalled) tags.push({ tagId: "m1", name: "GA4 Configuration (reported)", type: "gaawc", firingTriggerIds: ["m_all"] });
    if (tr.adsConversionTracking) tags.push({ tagId: "m2", name: "Google Ads Conversion (reported)", type: "awct", firingTriggerIds: ["m_conv"] });
    if (tr.formTracking) triggers.push({ triggerId: "m_form", name: "Form Submission (reported)", type: "formSubmission" });
    if (tr.phoneCallTracking) triggers.push({ triggerId: "m_phone", name: "Phone Click (reported)", type: "click" });
    triggers.push({ triggerId: "m_all", name: "All Pages", type: "pageview" });
    gtm = {
      accountId: "manual",
      containerId: tr.gtmInstalled ? "Reported GTM" : "No GTM (GA only)",
      workspaceId: "1",
      tags,
      triggers,
      variables: [],
      builtInVariables: tr.phoneCallTracking ? ["Click URL", "Click Text"] : ["Page URL"],
      detectedTrackingIssues: [],
    };
  }

  return { adsRows, searchTerms: [], ga4Rows, searchConsoleRows, gtm, hasPpc, hasWeb, hasSeo, hasTracking };
}

function synthGa4(landingPage: string, source: string, medium: string, sessions: number, conversions: number, engagement: number): Ga4Row {
  return {
    propertyId: "manual",
    pagePath: landingPage,
    landingPage,
    source,
    medium,
    campaign: medium === "cpc" ? "Reported paid" : "(organic)",
    sessions,
    users: Math.round(sessions * 0.9),
    engagedSessions: Math.round(sessions * engagement),
    conversions,
    eventCount: sessions * 4,
    keyEvents: conversions,
    revenue: 0,
    bounceRate: 1 - engagement,
  };
}

function numPresent(v: number | undefined): boolean {
  return typeof v === "number" && !Number.isNaN(v);
}

// --- Manual-specific recommendations --------------------------------------

export function generateManualRecommendations(
  m: ManualAnalyticsInput,
  businessName: string,
): Recommendation[] {
  const out: Recommendation[] = [];
  const ppc = m.ppcMetrics;
  const web = m.websiteMetrics;
  const seo = m.seoMetrics;
  const tr = m.trackingMetrics;
  const ctx = m.businessContext;

  const spend = ppc.monthlySpend ?? 0;
  const clicks = ppc.clicks ?? 0;
  const impressions = ppc.impressions ?? 0;
  const ppcConversions = ppc.conversions ?? 0;
  const ctr = ppc.ctr ?? (impressions > 0 ? clicks / impressions : undefined);
  const cvr = ppc.conversionRate ?? (clicks > 0 ? ppcConversions / clicks : undefined);

  const anyConversionTracking =
    tr.formTracking || tr.phoneCallTracking || tr.bookingPurchaseTracking || tr.adsConversionTracking;

  // 1. Ad spend without reliable conversion tracking → CRITICAL (blocking).
  if (spend > 0 && tr.adsConversionTracking === false && !anyConversionTracking) {
    out.push(
      rec({
        title: "Ad spend is running without reliable conversion tracking",
        category: "conversion_tracking",
        severity: "critical",
        blocking: true,
        urgency: "now",
        confidence: "high",
        evidence: [
          `You reported ${formatCurrency(spend)}/mo in Google Ads spend, but no form, phone, or booking conversion tracking is installed.`,
        ],
        whyItMatters:
          "Without conversion tracking, Google can't optimize bidding toward real leads and you can't tell which clicks produce customers. Every dollar scaled amplifies the blind spot.",
        recommendedFix: "Install GA4 + GTM conversion tracking (form submits, phone clicks, bookings) and import a Google Ads conversion before scaling paid search.",
        estimatedImpact: "Unlocks conversion-based bidding and accurate cost-per-lead reporting — usually the single biggest efficiency gain.",
        difficulty: "medium",
        relatedEntityType: "tracking",
        relatedEntityId: null,
      }),
    );
  }

  // 2. Paid clicks high but conversions low → CRITICAL (blocking).
  if (clicks >= 100 && cvr !== undefined && cvr < 0.01) {
    out.push(
      rec({
        title: "Paid search traffic is not converting efficiently",
        category: "landing_page",
        severity: "critical",
        blocking: true,
        urgency: "now",
        confidence: "high",
        evidence: [
          `You reported ${clicks.toLocaleString()} paid search clicks and ${ppcConversions} conversions — a ${formatPercent(cvr)} conversion rate.`,
          spend > 0 ? `Spend: ${formatCurrency(spend)}/mo.` : "",
        ].filter(Boolean),
        whyItMatters:
          "You're paying for clicks that don't become leads. The problem is almost always after the click: message mismatch, form friction, slow mobile, or broken tracking.",
        recommendedFix: "Review landing page message match, form friction, and mobile speed, and confirm conversion tracking fires — before increasing ad spend.",
        estimatedImpact: "Lifting CVR from <1% to 3–5% can multiply leads at the same spend.",
        difficulty: "medium",
        relatedEntityType: "campaign",
        relatedEntityId: null,
      }),
    );
  }

  // 3. Low CTR → ads seen but not clicked.
  if (impressions >= 5000 && ctr !== undefined && ctr < 0.02) {
    out.push(
      rec({
        title: "Ads are being seen but not clicked",
        category: "ad_copy",
        severity: "high",
        urgency: "soon",
        confidence: "high",
        evidence: [`You reported ${impressions.toLocaleString()} impressions and ${clicks.toLocaleString()} clicks — a ${formatPercent(ctr)} CTR.`],
        whyItMatters: "Low CTR means your ads aren't matching searcher intent, so you're paying for impressions you can't convert and signalling low relevance to Google.",
        recommendedFix: "Rewrite headlines around specific service intent, location, a concrete offer, and trust signals. Test three new responsive search ad headlines.",
        estimatedImpact: "Doubling CTR roughly doubles clicks at the same spend and can improve Quality Score.",
        difficulty: "easy",
        relatedEntityType: "ad_group",
        relatedEntityId: null,
      }),
    );
  }

  // 4. Paid traffic to homepage → dedicated landing pages.
  if (spend > 0 && ppc.trafficDestination === "homepage") {
    out.push(
      rec({
        title: "Paid traffic is being sent to a generic homepage",
        category: "landing_page",
        severity: "high",
        blocking: true,
        urgency: "soon",
        confidence: "high",
        evidence: ["You reported that paid traffic lands on the homepage rather than dedicated service pages."],
        whyItMatters: "Service-specific searchers landing on a generic homepage have to hunt for what they searched for. Message-matched pages convert far better.",
        recommendedFix: "Create dedicated service landing pages matched to each ad group (headline = the search, one clear offer, short form, click-to-call) and point ads there.",
        estimatedImpact: "Message-matched landing pages commonly lift conversion rate 30–100% vs. the homepage.",
        difficulty: "medium",
        relatedEntityType: "ad_group",
        relatedEntityId: null,
      }),
    );
  }

  // 5. Organic high impressions, low CTR.
  if ((seo.organicImpressions ?? 0) >= 2000 && seo.organicCtr !== undefined && seo.organicCtr < 0.015) {
    out.push(
      rec({
        title: "Organic search listings may not be earning clicks",
        category: "seo",
        severity: "medium",
        urgency: "soon",
        confidence: "high",
        evidence: [`You reported ${(seo.organicImpressions ?? 0).toLocaleString()} organic impressions at a ${formatPercent(seo.organicCtr)} CTR.`],
        whyItMatters: "You're earning visibility but not clicks — usually a sign that titles and meta descriptions don't match what searchers want.",
        recommendedFix: "Rewrite titles and meta descriptions for high-impression pages to clearly match intent and include location + a reason to click.",
        estimatedImpact: "Higher organic CTR captures traffic you already rank for, at no extra spend.",
        difficulty: "easy",
        relatedEntityType: "page",
        relatedEntityId: null,
      }),
    );
  }

  // 6. Missing Google Business Profile for a local business.
  if (seo.hasGoogleBusinessProfile === false) {
    out.push(
      rec({
        title: "Local visibility foundation is incomplete",
        category: "local_seo",
        severity: "high",
        urgency: "soon",
        confidence: "high",
        evidence: ["You reported that the business does not have a Google Business Profile set up."],
        whyItMatters: "For a local service business, Google Business Profile is often the highest-ROI local visibility asset — it powers the map pack and local discovery.",
        recommendedFix: "Set up or claim and optimize your Google Business Profile, align NAP (name/address/phone) across the web, and create location/service pages.",
        estimatedImpact: "Opens up local map-pack visibility and reviews — a major source of local leads.",
        difficulty: "medium",
        relatedEntityType: null,
        relatedEntityId: null,
      }),
    );
  }

  // 7. Forms not tracked (any conversion goal).
  if (tr.formTracking === false) {
    out.push(
      rec({
        title: "Form submissions are not being tracked",
        category: "conversion_tracking",
        severity: "high",
        blocking: true,
        urgency: "now",
        confidence: "high",
        evidence: ["You reported that form submissions are not tracked."],
        whyItMatters: "Form fills are likely a primary lead source. Untracked, you can't attribute them to campaigns or optimize toward them.",
        recommendedFix: "Add a form-submission trigger in GTM and fire GA4 + Google Ads conversion tags on it.",
        estimatedImpact: "Makes your main lead action measurable and optimizable.",
        difficulty: "easy",
        relatedEntityType: "tracking",
        relatedEntityId: null,
      }),
    );
  }

  // 8. Phone clicks not tracked.
  if (tr.phoneCallTracking === false) {
    out.push(
      rec({
        title: "Phone-call clicks are not being tracked",
        category: "conversion_tracking",
        severity: "medium",
        urgency: "soon",
        confidence: "high",
        evidence: ["You reported that phone-click tracking is not installed."],
        whyItMatters: "For phone-heavy local businesses, calls are a primary conversion. Untracked, you can't tell which keywords drive calls.",
        recommendedFix: "Add a click trigger matching tel: links and fire a phone-call conversion in GA4 + Google Ads.",
        estimatedImpact: "Reveals call-driving keywords so you can bid toward them.",
        difficulty: "easy",
        relatedEntityType: "tracking",
        relatedEntityId: null,
      }),
    );
  }

  // 9. Branded/non-branded not separated.
  if (ppc.brandedSeparated === false && spend > 0) {
    out.push(
      rec({
        title: "Separate branded and non-branded campaigns",
        category: "campaign_structure",
        severity: "medium",
        urgency: "soon",
        confidence: "medium",
        evidence: ["You reported that branded and non-branded keywords are not separated into different campaigns."],
        whyItMatters: "Mixing branded and non-branded terms hides true performance — cheap branded clicks mask expensive non-branded waste, and budgets compete.",
        recommendedFix: "Split branded terms into their own campaign so you can budget and bid each correctly and report on them separately.",
        estimatedImpact: "Clearer reporting and more efficient budget allocation.",
        difficulty: "medium",
        relatedEntityType: "campaign",
        relatedEntityId: null,
      }),
    );
  }

  // 10. Negative keywords not used → easy.
  if (ppc.negativeKeywordsUsed === false && spend > 0) {
    out.push(
      rec({
        title: "Add negative keywords to stop wasted spend",
        category: "negative_keywords",
        severity: "medium",
        urgency: "soon",
        confidence: "medium",
        evidence: ["You reported that negative keywords are not being used.", ppc.worstKeyword ? `Worst-performing term reported: "${ppc.worstKeyword}".` : ""].filter(Boolean),
        whyItMatters: "Without negatives, broad and phrase keywords match off-intent searches that drain budget without converting.",
        recommendedFix: "Review the search terms report weekly and add irrelevant terms as negatives at the ad group or campaign level.",
        estimatedImpact: "Recovers budget currently spent on off-intent clicks.",
        difficulty: "easy",
        relatedEntityType: "keyword",
        relatedEntityId: null,
      }),
    );
  }

  // 11. Ad extensions/assets not used → easy.
  if (ppc.adExtensionsUsed === false && spend > 0) {
    out.push(
      rec({
        title: "Add ad extensions/assets (sitelinks, callouts, call)",
        category: "ad_copy",
        severity: "low",
        urgency: "later",
        confidence: "medium",
        evidence: ["You reported that ad extensions/assets are not in use."],
        whyItMatters: "Assets increase ad real estate and CTR at no extra cost, and call/location assets are essential for local lead gen.",
        recommendedFix: "Add sitelink, callout, structured snippet, call, and location assets to every campaign.",
        estimatedImpact: "Typically a quick CTR lift with no added spend.",
        difficulty: "easy",
        relatedEntityType: "campaign",
        relatedEntityId: null,
      }),
    );
  }

  // 12. No dedicated service pages.
  if (seo.hasServicePages === false) {
    out.push(
      rec({
        title: "Create dedicated service pages",
        category: "content",
        severity: "medium",
        urgency: "soon",
        confidence: "medium",
        evidence: ["You reported that the site has no dedicated service pages."],
        whyItMatters: "One generic page can't rank for or convert multiple distinct services. Each profitable service deserves its own message-matched page.",
        recommendedFix: "Build a focused page per service with specific detail, proof, FAQs, and a clear CTA — useful pages, not thin keyword variations.",
        estimatedImpact: "Improves both organic relevance and paid landing-page quality.",
        difficulty: "medium",
        relatedEntityType: "page",
        relatedEntityId: null,
      }),
    );
  }

  return out;
}

/**
 * A short note on data completeness, used to set the overall confidence framing
 * in the report when the user left fields blank.
 */
export function manualCompleteness(m: ManualAnalyticsInput): { filled: number; total: number } {
  let filled = 0;
  let total = 0;
  for (const section of [m.businessContext, m.websiteMetrics, m.ppcMetrics, m.seoMetrics, m.trackingMetrics]) {
    for (const v of Object.values(section)) {
      total += 1;
      if (v !== undefined && v !== null && v !== "") filled += 1;
    }
  }
  return { filled, total };
}
