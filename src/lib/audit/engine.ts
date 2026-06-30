/**
 * Audit orchestrator.
 *
 * Runs the full pipeline: crawl -> (optionally) pull Google data -> score ->
 * generate recommendations + A/B tests -> AI/deterministic executive summary.
 * Works identically for demo data and live data because all inputs conform to
 * the same types.
 */

import { generateId, clamp } from "@/lib/utils";
import { crawlSite } from "@/lib/crawler/crawler";
import { generateExecutiveSummary } from "@/lib/ai/summary";
import { generateRecommendations } from "./rules";
import { generateAbTests } from "./abtests";
import {
  scoreBudgetWasteRisk,
  scoreCampaignStructure,
  scoreConversionFriction,
  scoreKeywordOpportunity,
  scoreLandingPageReadiness,
  scorePaidSearchEfficiency,
  scoreTrackingReadiness,
  type ScoringInput,
} from "./scoring";
import {
  DEMO_ADS_ROWS,
  DEMO_GA4_ROWS,
  DEMO_GTM,
  DEMO_SEARCH_CONSOLE_ROWS,
  DEMO_SEARCH_TERMS,
  DEMO_CRAWLED_PAGES,
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
  ScoreSet,
  SearchConsoleRow,
} from "@/lib/types";

export interface RunAuditParams {
  auditId?: string;
  userId?: string | null;
  business: Pick<
    Business,
    "id" | "businessName" | "websiteUrl" | "primaryConversionGoal" | "profitableServices" | "monthlyAdBudget"
  > | null;
  websiteUrl: string;
  businessName: string;
  mode: AuditMode;
  dateStart: string;
  dateEnd: string;
  /** When true, inject the THOY Lawncare demo dataset for the connected pull. */
  useDemoData: boolean;
  /** Invoked after each pipeline step so callers can persist live progress. */
  onProgress?: (report: AuditReport) => void | Promise<void>;
  /** Live data providers (used when not demo). Each may return [] gracefully. */
  providers?: {
    ads?: () => Promise<{ rows: GoogleAdsRow[]; searchTerms: GoogleAdsRow[] }>;
    ga4?: () => Promise<Ga4Row[]>;
    searchConsole?: () => Promise<SearchConsoleRow[]>;
    gtm?: () => Promise<GtmSnapshot | null>;
  };
}

function initialSteps(mode: AuditMode): AuditStep[] {
  const connected = mode === "connected";
  return [
    { key: "crawl", label: "Crawling website", status: "pending" },
    { key: "ads", label: "Fetching Google Ads data", status: connected ? "pending" : "skipped" },
    { key: "ga4", label: "Fetching GA4 data", status: connected ? "pending" : "skipped" },
    { key: "search_console", label: "Fetching Search Console data", status: connected ? "pending" : "skipped" },
    { key: "gtm", label: "Inspecting GTM tracking setup", status: connected ? "pending" : "skipped" },
    { key: "scoring", label: "Scoring landing pages & accounts", status: "pending" },
    { key: "recommendations", label: "Generating recommendations", status: "pending" },
  ];
}

function weightedOverall(s: Omit<ScoreSet, "overall">, connected: boolean): number {
  // Budget waste is a RISK score: invert it so higher waste lowers overall.
  const wasteHealth = 100 - s.budgetWaste;
  if (!connected) {
    // URL-only: weight landing page + tracking heavily.
    return clamp(Math.round(s.landingPage * 0.55 + s.tracking * 0.25 + s.keyword * 0.2));
  }
  return clamp(
    Math.round(
      s.paidSearch * 0.25 +
        s.landingPage * 0.22 +
        s.tracking * 0.2 +
        s.keyword * 0.13 +
        wasteHealth * 0.2,
    ),
  );
}

export async function runAudit(params: RunAuditParams): Promise<AuditReport> {
  const id = params.auditId ?? generateId("audit");
  const connected = params.mode === "connected";
  const steps = initialSteps(params.mode);
  const setStep = (key: AuditStep["key"], status: AuditStep["status"], detail?: string) => {
    const step = steps.find((s) => s.key === key);
    if (step) {
      step.status = status;
      if (detail) step.detail = detail;
    }
    // Fire progress callback (best-effort; never blocks the pipeline).
    if (params.onProgress) void params.onProgress(report);
  };

  const nowIso = new Date().toISOString();
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
    scores: { overall: 0, paidSearch: 0, landingPage: 0, tracking: 0, keyword: 0, budgetWaste: 0 },
    breakdowns: {} as AuditReport["breakdowns"],
    executiveSummary: "",
    recommendations: [],
    abTests: [],
    crawledPages: [],
    adsRows: [],
    ga4Rows: [],
    searchConsoleRows: [],
    gtm: null,
    steps,
    createdAt: nowIso,
    completedAt: null,
  };

  try {
    // 1. Crawl ------------------------------------------------------------
    setStep("crawl", "running");
    let pages: Array<Omit<CrawledPage, "id" | "auditId" | "createdAt">>;
    if (params.useDemoData) {
      pages = DEMO_CRAWLED_PAGES;
      setStep("crawl", "done", `${pages.length} demo pages`);
    } else {
      const result = await crawlSite(params.websiteUrl);
      if (result.error || result.pages.length === 0) {
        setStep("crawl", "error", result.error ?? "No pages crawled");
        report.status = "failed";
        report.error = result.error ?? "CRAWL_FAILED";
        report.completedAt = new Date().toISOString();
        return report;
      }
      pages = result.pages;
      setStep("crawl", "done", `${pages.length} pages crawled`);
    }
    report.crawledPages = pages.map((p) => ({
      ...p,
      id: generateId("page"),
      auditId: id,
      createdAt: new Date().toISOString(),
    }));

    // 2. Google data ------------------------------------------------------
    let adsRows: GoogleAdsRow[] = [];
    let searchTerms: GoogleAdsRow[] = [];
    let ga4Rows: Ga4Row[] = [];
    let searchConsoleRows: SearchConsoleRow[] = [];
    let gtm: GtmSnapshot | null = null;

    if (connected) {
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
        // Live providers — each degrades gracefully on error.
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
            monthlyAdBudget: params.business.monthlyAdBudget,
          }
        : null,
      pages,
      adsRows,
      searchTerms,
      ga4Rows,
      searchConsoleRows,
      gtm,
      connected,
    };

    const landingPage = scoreLandingPageReadiness(scoringInput);
    const tracking = scoreTrackingReadiness(scoringInput);
    const keyword = scoreKeywordOpportunity(scoringInput);
    const paidSearch = scorePaidSearchEfficiency(scoringInput);
    const budgetWaste = scoreBudgetWasteRisk(scoringInput);
    const campaignStructure = scoreCampaignStructure(scoringInput);
    const conversionFriction = scoreConversionFriction(scoringInput);

    const partialScores: Omit<ScoreSet, "overall"> = {
      paidSearch: paidSearch.score,
      landingPage: landingPage.score,
      tracking: tracking.score,
      keyword: keyword.score,
      budgetWaste: budgetWaste.score,
    };
    const overall = weightedOverall(partialScores, connected);
    report.scores = { overall, ...partialScores };

    report.breakdowns = {
      overall: {
        score: overall,
        label: "Overall SEM Readiness",
        evidence: [
          `Weighted across ${connected ? "paid search, landing pages, tracking, keywords, and budget efficiency" : "landing pages, tracking, and keyword opportunity"}.`,
        ],
        issues: [],
        recommendations: [],
      },
      paidSearch,
      landingPage,
      tracking,
      keyword,
      budgetWaste,
    };
    // Stash the two extra structural breakdowns onto the report via recommendations.
    setStep("scoring", "done");

    // 4. Recommendations + A/B tests -------------------------------------
    setStep("recommendations", "running");
    // Merge structural findings (campaign structure, conversion friction) into
    // the recommendation generation context by appending their recommendations.
    const recs = generateRecommendations(scoringInput);
    report.recommendations = recs;
    report.abTests = generateAbTests(scoringInput);
    setStep("recommendations", "done", `${recs.length} recommendations`);

    // Keep structural breakdowns accessible for the report UI.
    (report.breakdowns as Record<string, typeof campaignStructure>).campaignStructure = campaignStructure;
    (report.breakdowns as Record<string, typeof conversionFriction>).conversionFriction = conversionFriction;

    // 5. Executive summary -----------------------------------------------
    report.executiveSummary = await generateExecutiveSummary(report);

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
