/**
 * Audit orchestrator.
 *
 * Pipeline: crawl → crawlability/index checks → content review → landing review
 * → (connected) pull Google data → score (SEO + PPC + tracking) → recommendations
 * + content roadmap + A/B tests → executive summary. Works identically for demo
 * and live data because every input conforms to the same types.
 *
 * Philosophy: diagnose before prescribing; rank every recommendation by
 * impact × confidence × urgency ÷ difficulty.
 */

import { generateId, clamp } from "@/lib/utils";
import { crawlSite } from "@/lib/crawler/crawler";
import { generateExecutiveSummary } from "@/lib/ai/summary";
import { generateRecommendations } from "./rules";
import { generateSeoRecommendations } from "./seo-rules";
import { generateContentOpportunities } from "./content";
import { generateAbTests } from "./abtests";
import { manualToSyntheticData, generateManualRecommendations, manualHasData } from "./manual";
import {
  scoreBudgetWasteRisk,
  scoreCampaignStructure,
  scoreConversionFriction,
  scoreKeywordOpportunity,
  scoreLandingPageReadiness,
  scorePaidSearchEfficiency,
  scoreTrackingReadiness,
  type CrawledPageInput,
  type ScoringInput,
} from "./scoring";
import {
  scoreSeoFoundation,
  scoreTechnicalSeo,
  scoreContentQuality,
  scoreLocalVisibility,
  scoreAiSearchReadiness,
  scoreMeasurementConfidence,
} from "./seo";
import {
  DEMO_ADS_ROWS,
  DEMO_GA4_ROWS,
  DEMO_GTM,
  DEMO_SEARCH_CONSOLE_ROWS,
  DEMO_SEARCH_TERMS,
  DEMO_CRAWLED_PAGES,
  DEMO_SITE_SIGNALS,
} from "@/lib/demo/data";
import type {
  AuditMode,
  AuditReport,
  AuditStep,
  Business,
  CrawledPage,
  Ga4Row,
  GoogleAdsRow,
  GtmSnapshot,
  ManualAnalyticsInput,
  Recommendation,
  ReportSummary,
  ScoreBreakdown,
  ScoreSet,
  SearchConsoleRow,
  SiteSignals,
} from "@/lib/types";

export interface RunAuditParams {
  auditId?: string;
  userId?: string | null;
  business: Pick<
    Business,
    | "id"
    | "businessName"
    | "websiteUrl"
    | "primaryConversionGoal"
    | "profitableServices"
    | "topServices"
    | "monthlyAdBudget"
    | "primaryLocation"
    | "serviceArea"
    | "targetLocations"
  > | null;
  websiteUrl: string;
  businessName: string;
  mode: AuditMode;
  dateStart: string;
  dateEnd: string;
  useDemoData: boolean;
  /** User-entered analytics for a manual-mode audit. */
  manualInput?: ManualAnalyticsInput | null;
  providers?: {
    ads?: () => Promise<{ rows: GoogleAdsRow[]; searchTerms: GoogleAdsRow[] }>;
    ga4?: () => Promise<Ga4Row[]>;
    searchConsole?: () => Promise<SearchConsoleRow[]>;
    gtm?: () => Promise<GtmSnapshot | null>;
  };
  onProgress?: (report: AuditReport) => void | Promise<void>;
}

function initialSteps(mode: AuditMode): AuditStep[] {
  const connected = mode !== "url_only";
  return [
    { key: "crawl", label: "Crawling website", status: "pending" },
    { key: "crawlability", label: "Checking crawlability & indexability", status: "pending" },
    { key: "content", label: "Reviewing metadata & content", status: "pending" },
    { key: "landing", label: "Scoring landing pages", status: "pending" },
    { key: "ads", label: "Pulling Google Ads data", status: connected ? "pending" : "skipped" },
    { key: "ga4", label: "Pulling GA4 data", status: connected ? "pending" : "skipped" },
    { key: "search_console", label: "Pulling Search Console data", status: connected ? "pending" : "skipped" },
    { key: "gtm", label: "Inspecting GTM setup", status: connected ? "pending" : "skipped" },
    { key: "scoring", label: "Running scoring engine", status: "pending" },
    { key: "recommendations", label: "Generating recommendations", status: "pending" },
    { key: "report", label: "Building report", status: "pending" },
  ];
}

function weightedOverall(s: Omit<ScoreSet, "searchFunnel">, connected: boolean): number {
  const wasteHealth = 100 - s.budgetWasteRisk;
  const seoAvg = (s.seoFoundation + s.technicalSeo + s.contentQuality + s.localVisibility) / 4;
  if (!connected) {
    // URL-only: SEO foundation + content + landing readiness + AI search.
    return clamp(
      Math.round(seoAvg * 0.45 + s.landingPage * 0.25 + s.aiSearchReadiness * 0.15 + s.conversionTracking * 0.15),
    );
  }
  // Connected/full: balance SEO, PPC, conversion, and measurement.
  return clamp(
    Math.round(
      seoAvg * 0.26 +
        s.aiSearchReadiness * 0.06 +
        s.ppcEfficiency * 0.16 +
        s.landingPage * 0.16 +
        s.conversionTracking * 0.12 +
        s.measurementConfidence * 0.12 +
        wasteHealth * 0.12,
    ),
  );
}

export async function runAudit(params: RunAuditParams): Promise<AuditReport> {
  const id = params.auditId ?? generateId("audit");
  const connected = params.mode !== "url_only";
  const steps = initialSteps(params.mode);
  const setStep = (key: AuditStep["key"], status: AuditStep["status"], detail?: string) => {
    const step = steps.find((s) => s.key === key);
    if (step) {
      step.status = status;
      if (detail) step.detail = detail;
    }
    if (params.onProgress) void params.onProgress(report);
  };

  const nowIso = new Date().toISOString();
  const emptyScores: ScoreSet = {
    searchFunnel: 0,
    seoFoundation: 0,
    technicalSeo: 0,
    contentQuality: 0,
    localVisibility: 0,
    aiSearchReadiness: 0,
    ppcEfficiency: 0,
    conversionTracking: 0,
    landingPage: 0,
    budgetWasteRisk: 0,
    measurementConfidence: 0,
  };
  const report: AuditReport = {
    id,
    userId: params.userId ?? null,
    businessId: params.business?.id ?? null,
    businessName: params.businessName,
    websiteUrl: params.websiteUrl,
    auditMode: params.mode,
    dateStart: params.dateStart,
    dateEnd: params.dateEnd,
    status: "running",
    scores: emptyScores,
    breakdowns: {} as AuditReport["breakdowns"],
    executiveSummary: "",
    summary: { diagnosis: "", mainLeak: null, bestQuickWin: null, biggestRisk: null },
    recommendations: [],
    abTests: [],
    contentOpportunities: [],
    crawledPages: [],
    siteSignals: null,
    manualInput: params.manualInput ?? null,
    adsRows: [],
    ga4Rows: [],
    searchConsoleRows: [],
    gtm: null,
    steps,
    createdAt: nowIso,
    completedAt: null,
  };

  // Whether the user gave us enough manual data to produce a report even if
  // the live crawl can't be completed.
  const manualMode = params.mode === "manual" && manualHasData(params.manualInput);

  try {
    // 1. Crawl ------------------------------------------------------------
    setStep("crawl", "running");
    let pages: CrawledPageInput[];
    let siteSignals: SiteSignals | null;
    if (params.useDemoData) {
      pages = DEMO_CRAWLED_PAGES;
      siteSignals = DEMO_SITE_SIGNALS;
      setStep("crawl", "done", `${pages.length} demo pages`);
    } else {
      const result = await crawlSite(params.websiteUrl);
      if (result.error || result.pages.length === 0) {
        // If the user supplied manual data, don't throw the whole audit away
        // because the site was briefly unreachable — continue with what we have
        // and flag the crawl as incomplete (lower confidence on crawl findings).
        if (manualMode) {
          setStep("crawl", "error", "Site could not be crawled — continuing with your reported data.");
          pages = [];
          siteSignals = null;
        } else {
          setStep("crawl", "error", result.error ?? "No pages crawled");
          report.status = "failed";
          report.error = result.error ?? "CRAWL_FAILED";
          report.completedAt = new Date().toISOString();
          return report;
        }
      } else {
        pages = result.pages;
        siteSignals = result.siteSignals;
        setStep("crawl", "done", `${pages.length} pages crawled`);
      }
    }
    report.crawledPages = pages.map((p) => ({ ...p, id: generateId("page"), auditId: id, createdAt: new Date().toISOString() }));
    report.siteSignals = siteSignals;

    setStep("crawlability", "done", siteSignals ? `https=${siteSignals.https}, sitemap=${siteSignals.sitemapPresent}` : undefined);
    setStep("content", "done", `${pages.filter((p) => p.title).length}/${pages.length} pages have titles`);
    setStep("landing", "done");

    // 2. Google data ------------------------------------------------------
    let adsRows: GoogleAdsRow[] = [];
    let searchTerms: GoogleAdsRow[] = [];
    let ga4Rows: Ga4Row[] = [];
    let searchConsoleRows: SearchConsoleRow[] = [];
    let gtm: GtmSnapshot | null = null;

    if (manualMode && params.manualInput) {
      // Manual analytics audit: synthesize engine-shaped rows from user input.
      const syn = manualToSyntheticData(params.manualInput, params.websiteUrl);
      adsRows = syn.adsRows;
      ga4Rows = syn.ga4Rows;
      searchConsoleRows = syn.searchConsoleRows;
      gtm = syn.gtm;
      setStep("ads", syn.hasPpc ? "done" : "skipped", syn.hasPpc ? "from your reported data" : "no PPC data entered");
      setStep("ga4", syn.hasWeb ? "done" : "skipped", syn.hasWeb ? "from your reported data" : "no website data entered");
      setStep("search_console", syn.hasSeo ? "done" : "skipped", syn.hasSeo ? "from your reported data" : "no SEO data entered");
      setStep("gtm", syn.hasTracking ? "done" : "skipped", syn.hasTracking ? "from your reported tracking" : "no tracking data entered");
    } else if (connected) {
      if (params.useDemoData) {
        adsRows = DEMO_ADS_ROWS;
        searchTerms = DEMO_SEARCH_TERMS;
        ga4Rows = DEMO_GA4_ROWS;
        searchConsoleRows = DEMO_SEARCH_CONSOLE_ROWS;
        gtm = DEMO_GTM;
        setStep("ads", "done", `${adsRows.length} ad groups (demo)`);
        setStep("ga4", "done", `${ga4Rows.length} rows (demo)`);
        setStep("search_console", "done", `${searchConsoleRows.length} queries (demo)`);
        setStep("gtm", "done", "container inspected (demo)");
      } else {
        setStep("ads", "running");
        try {
          const ads = (await params.providers?.ads?.()) ?? { rows: [], searchTerms: [] };
          adsRows = ads.rows;
          searchTerms = ads.searchTerms;
          setStep("ads", adsRows.length ? "done" : "skipped", `${adsRows.length} ad groups`);
        } catch (e) {
          setStep("ads", "error", (e as Error).message);
        }
        setStep("ga4", "running");
        try {
          ga4Rows = (await params.providers?.ga4?.()) ?? [];
          setStep("ga4", ga4Rows.length ? "done" : "skipped", `${ga4Rows.length} rows`);
        } catch (e) {
          setStep("ga4", "error", (e as Error).message);
        }
        setStep("search_console", "running");
        try {
          searchConsoleRows = (await params.providers?.searchConsole?.()) ?? [];
          setStep("search_console", searchConsoleRows.length ? "done" : "skipped", `${searchConsoleRows.length} queries`);
        } catch (e) {
          setStep("search_console", "error", (e as Error).message);
        }
        setStep("gtm", "running");
        try {
          gtm = (await params.providers?.gtm?.()) ?? null;
          setStep("gtm", gtm ? "done" : "skipped", gtm ? "container inspected" : "no container");
        } catch (e) {
          setStep("gtm", "error", (e as Error).message);
        }
      }
    }

    report.adsRows = adsRows;
    report.ga4Rows = ga4Rows;
    report.searchConsoleRows = searchConsoleRows;
    report.gtm = gtm;

    // 3. Score ------------------------------------------------------------
    setStep("scoring", "running");
    const scoringInput: ScoringInput = {
      business: params.business
        ? {
            primaryConversionGoal: params.business.primaryConversionGoal,
            profitableServices: params.business.profitableServices,
            topServices: params.business.topServices,
            monthlyAdBudget: params.business.monthlyAdBudget,
            primaryLocation: params.business.primaryLocation,
            serviceArea: params.business.serviceArea,
          }
        : null,
      pages,
      siteSignals,
      adsRows,
      searchTerms,
      ga4Rows,
      searchConsoleRows,
      gtm,
      connected,
    };

    const seoFoundation = scoreSeoFoundation(scoringInput);
    const technicalSeo = scoreTechnicalSeo(scoringInput);
    const contentQuality = scoreContentQuality(scoringInput);
    const localVisibility = scoreLocalVisibility(scoringInput);
    const aiSearchReadiness = scoreAiSearchReadiness(scoringInput);
    const measurementConfidence = scoreMeasurementConfidence(scoringInput);
    const ppcEfficiency = scorePaidSearchEfficiency(scoringInput);
    const conversionTracking = scoreTrackingReadiness(scoringInput);
    const landingPage = scoreLandingPageReadiness(scoringInput);
    const budgetWasteRisk = scoreBudgetWasteRisk(scoringInput);
    const keyword = scoreKeywordOpportunity(scoringInput);
    const campaignStructure = scoreCampaignStructure(scoringInput);
    const conversionFriction = scoreConversionFriction(scoringInput);

    const partial: Omit<ScoreSet, "searchFunnel"> = {
      seoFoundation: seoFoundation.score,
      technicalSeo: technicalSeo.score,
      contentQuality: contentQuality.score,
      localVisibility: localVisibility.score,
      aiSearchReadiness: aiSearchReadiness.score,
      ppcEfficiency: ppcEfficiency.score,
      conversionTracking: conversionTracking.score,
      landingPage: landingPage.score,
      budgetWasteRisk: budgetWasteRisk.score,
      measurementConfidence: measurementConfidence.score,
    };
    const searchFunnel = weightedOverall(partial, connected);
    report.scores = { searchFunnel, ...partial };

    report.breakdowns = {
      searchFunnel: {
        score: searchFunnel,
        label: "Search Funnel Score",
        evidence: [
          connected
            ? "Weighted across SEO foundation, technical SEO, content, local, AI search, PPC efficiency, landing pages, tracking, measurement, and budget."
            : "Weighted across SEO foundation, technical SEO, content, local, AI search, landing pages, and tracking readiness.",
        ],
        issues: [],
        recommendations: [],
      },
      seoFoundation,
      technicalSeo,
      contentQuality,
      localVisibility,
      aiSearchReadiness,
      ppcEfficiency,
      conversionTracking,
      landingPage,
      budgetWasteRisk,
      measurementConfidence,
    };
    // Extra structural breakdowns surfaced in their report sections.
    const extra = report.breakdowns as Record<string, ScoreBreakdown>;
    extra.keyword = keyword;
    extra.campaignStructure = campaignStructure;
    extra.conversionFriction = conversionFriction;
    setStep("scoring", "done");

    // 4. Recommendations + content roadmap + A/B tests --------------------
    setStep("recommendations", "running");
    const ppcRecs = generateRecommendations(scoringInput);
    const seoRecs = generateSeoRecommendations(scoringInput);
    // Manual recommendations take precedence (quote the user's own numbers) and
    // are listed first so their de-duplication wins over generic equivalents.
    const manualRecs =
      manualMode && params.manualInput
        ? generateManualRecommendations(params.manualInput, params.businessName)
        : [];
    const all = [...manualRecs, ...seoRecs, ...ppcRecs].sort((a, b) => b.priorityScore - a.priorityScore);
    // Dedupe by title.
    const seen = new Set<string>();
    report.recommendations = all.filter((r) => (seen.has(r.title) ? false : (seen.add(r.title), true)));
    report.contentOpportunities = generateContentOpportunities(scoringInput);
    report.abTests = generateAbTests(scoringInput);
    setStep("recommendations", "done", `${report.recommendations.length} recommendations`);

    // 5. Executive summary + plain-English headline takeaways -------------
    setStep("report", "running");
    report.summary = computeSummary(report);
    report.executiveSummary = await generateExecutiveSummary(report);
    setStep("report", "done");

    report.status = "completed";
    report.completedAt = new Date().toISOString();
    return report;
  } catch (err) {
    report.status = "failed";
    report.error = (err as Error).message ?? "Audit failed";
    report.completedAt = new Date().toISOString();
    return report;
  }
}

/** Derive the plain-English headline takeaways shown atop the report. */
function computeSummary(report: AuditReport): ReportSummary {
  const recs = report.recommendations;
  const byPriority = [...recs].sort((a, b) => b.priorityScore - a.priorityScore);
  const critical = byPriority.find((r: Recommendation) => r.group === "critical") ?? null;
  const easy = byPriority.find((r: Recommendation) => r.group === "easy") ?? null;
  const mainLeak = byPriority[0] ?? null;
  const s = report.scores;

  const grade =
    s.searchFunnel >= 75 ? "in good shape" : s.searchFunnel >= 55 ? "a solid foundation with clear gaps" : s.searchFunnel >= 40 ? "underperforming" : "leaking value in several places";

  const criticalCount = recs.filter((r) => r.group === "critical").length;
  let diagnosis: string;
  if (criticalCount > 0) {
    diagnosis = `Your search funnel is ${grade}. Fix the ${criticalCount} critical issue${criticalCount > 1 ? "s" : ""} blocking measurement and conversions before spending more on marketing.`;
  } else if (s.searchFunnel >= 75) {
    diagnosis = `Your search funnel is ${grade}. Focus on the quick wins and strategic improvements to compound your results.`;
  } else {
    diagnosis = `Your search funnel is ${grade}. There are no hard blockers, but several improvements will meaningfully lift results.`;
  }

  return {
    diagnosis,
    mainLeak: mainLeak ? mainLeak.title : null,
    bestQuickWin: easy ? easy.title : null,
    biggestRisk: critical ? critical.title : null,
  };
}
