import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { runAudit } from "@/lib/audit/engine";
import { buildLiveProviders } from "@/lib/google/providers";
import { getBusiness, saveAudit, saveBusiness } from "@/lib/store";
import { newAuditSchema, dateRangeToBounds } from "@/lib/validation";
import { normalizeUrl, generateId } from "@/lib/utils";
import { DEMO_MODE, capabilities } from "@/lib/config";
import { DEMO_BUSINESS } from "@/lib/demo/data";
import type { AuditReport, AuditStep } from "@/lib/types";

// Crawling can take time; allow a generous (but bounded) execution window.
export const maxDuration = 60;

/**
 * Kicks off an audit. We persist an initial "running" report immediately, then
 * process in the background (fire-and-forget) updating progress per step. The
 * client polls GET /api/audit/[id] to render live status. This keeps the
 * request fast and the UI responsive.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const parsed = newAuditSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;

  const url = normalizeUrl(input.websiteUrl);
  if (!url) {
    return NextResponse.json({ error: "INVALID_URL" }, { status: 400 });
  }

  const savedBusiness = input.businessId ? await getBusiness(input.businessId) : null;
  // Build a transient business from inline intake context when none is saved,
  // so scoring has business signals (services, location) even without Supabase.
  const business =
    savedBusiness ??
    (input.businessName
      ? {
          id: generateId("biz"),
          userId: user.id,
          businessName: input.businessName,
          websiteUrl: url,
          industry: input.industry ?? null,
          primaryLocation: input.primaryLocation ?? null,
          serviceArea: input.serviceArea ?? null,
          monthlyAdBudget: input.manualInput?.businessContext.monthlyAdsBudget ?? null,
          monthlyMarketingBudget: input.manualInput?.businessContext.monthlySeoBudget ?? null,
          primaryConversionGoal: input.primaryGoal ?? null,
          averageCustomerValue: input.manualInput?.businessContext.averageCustomerValue ?? null,
          topServices: input.topServices ?? [],
          profitableServices: input.profitableService ? [input.profitableService] : [],
          targetLocations: input.serviceArea ? [input.serviceArea] : [],
          competitors: input.manualInput?.businessContext.competitors
            ? [input.manualInput.businessContext.competitors]
            : [],
          targetCustomer: null,
          adStatus: "unknown" as const,
          marketingStatus: "unknown" as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      : null);
  const businessName = business?.businessName ?? new URL(url).hostname.replace(/^www\./, "");
  const { dateStart, dateEnd } = dateRangeToBounds(input.dateRange, input.dateStart, input.dateEnd);

  // Demo data is used when explicitly requested OR when running a connected/full
  // audit without real Google credentials configured. Manual mode never uses demo.
  const manualMode = input.mode === "manual";
  const connectedMode = input.mode === "connected" || input.mode === "full";
  const useDemoData = !manualMode && (Boolean(input.demo) || (connectedMode && !capabilities.hasGoogleAds));

  const id = generateId("audit");

  // Persist a placeholder so polling has something to read immediately.
  const placeholder: AuditReport = {
    id,
    userId: user.id,
    businessId: business?.id ?? null,
    businessName,
    websiteUrl: url,
    auditMode: input.mode,
    dateStart,
    dateEnd,
    status: "running",
    scores: {
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
    },
    breakdowns: {} as AuditReport["breakdowns"],
    executiveSummary: "",
    summary: { diagnosis: "", mainLeak: null, bestQuickWin: null, biggestRisk: null },
    recommendations: [],
    abTests: [],
    contentOpportunities: [],
    crawledPages: [],
    siteSignals: null,
    manualInput: input.manualInput ?? null,
    adsRows: [],
    ga4Rows: [],
    searchConsoleRows: [],
    gtm: null,
    steps: initialSteps(input.mode),
    createdAt: new Date().toISOString(),
    completedAt: null,
  };
  await saveAudit(placeholder);
  // Persist a transient business so it appears on the dashboard.
  if (business && !savedBusiness) {
    void saveBusiness(business);
  }

  // Fire-and-forget processing. In dev/single-process this updates the same
  // in-memory record the poller reads. TODO(production): move to a durable
  // queue/worker (e.g. Supabase Edge Function, QStash, Inngest) so progress
  // survives across serverless instances.
  void (async () => {
    const report = await runAudit({
      auditId: id,
      userId: user.id,
      business: business ?? (useDemoData ? DEMO_BUSINESS : null),
      websiteUrl: url,
      businessName,
      mode: input.mode,
      dateStart,
      dateEnd,
      useDemoData,
      manualInput: input.manualInput ?? null,
      providers:
        connectedMode && !useDemoData && !DEMO_MODE
          ? buildLiveProviders(user.id, dateStart, dateEnd)
          : undefined,
      onProgress: (r) => saveAudit(r),
    });
    await saveAudit(report);
  })();

  return NextResponse.json({ id });
}

function initialSteps(mode: string): AuditStep[] {
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

