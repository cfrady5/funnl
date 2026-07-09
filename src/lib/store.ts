/**
 * Persistence abstraction.
 *
 * Two backends, chosen automatically:
 *  - Supabase (when configured): durable, multi-user, RLS-enforced.
 *  - In-memory (demo mode): a process-global map. Survives across requests in
 *    `next dev` (single process). NOTE: in serverless production each instance
 *    has its own memory, so the in-memory backend is for demo/local only — it
 *    is never used when Supabase is configured.
 *
 * Callers use the same API regardless of backend.
 */

import { capabilities } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/server";
import type { AuditReport, AuditSummaryCard, Business } from "@/lib/types";

// --- In-memory backend (demo / local) -------------------------------------
// Use globalThis so the map survives Next.js hot reloads in dev.
interface MemStore {
  audits: Map<string, AuditReport>;
  businesses: Map<string, Business>;
}
const g = globalThis as unknown as { __semStore?: MemStore };
const mem: MemStore =
  g.__semStore ?? (g.__semStore = { audits: new Map(), businesses: new Map() });

// --- Audits ----------------------------------------------------------------

export async function saveAudit(report: AuditReport): Promise<void> {
  mem.audits.set(report.id, report);
  if (!capabilities.hasSupabaseAdmin) return;
  const admin = createAdminClient();
  if (!admin) return;
  try {
    // Store the full report JSON in the audits row for durable retrieval.
    // The normalized snapshot tables (see migrations) can be populated by a
    // background job; for the MVP the report JSON is the source of truth.
    await admin.from("audits").upsert({
      id: report.id,
      user_id: report.userId,
      business_id: report.businessId,
      website_url: report.websiteUrl,
      audit_mode: report.auditMode,
      date_start: report.dateStart,
      date_end: report.dateEnd,
      status: report.status,
      audit_type: report.auditMode,
      search_funnel_score: report.scores.searchFunnel,
      seo_foundation_score: report.scores.seoFoundation,
      technical_seo_score: report.scores.technicalSeo,
      content_quality_score: report.scores.contentQuality,
      local_visibility_score: report.scores.localVisibility,
      ai_search_readiness_score: report.scores.aiSearchReadiness,
      ppc_efficiency_score: report.scores.ppcEfficiency,
      conversion_tracking_score: report.scores.conversionTracking,
      landing_page_score: report.scores.landingPage,
      budget_waste_risk_score: report.scores.budgetWasteRisk,
      measurement_confidence_score: report.scores.measurementConfidence,
      executive_summary: report.executiveSummary,
      report_json: report,
      created_at: report.createdAt,
      completed_at: report.completedAt,
    });
  } catch (err) {
    console.error("saveAudit: Supabase write failed (kept in memory):", err);
  }
}

export async function getAudit(id: string): Promise<AuditReport | null> {
  if (mem.audits.has(id)) return mem.audits.get(id)!;
  if (!capabilities.hasSupabaseAdmin) return null;
  const admin = createAdminClient();
  if (!admin) return null;
  try {
    const { data } = await admin.from("audits").select("report_json").eq("id", id).single();
    const report = (data?.report_json as AuditReport | undefined) ?? null;
    if (report) mem.audits.set(id, report);
    return report;
  } catch {
    return null;
  }
}

export async function listAudits(userId: string | null): Promise<AuditSummaryCard[]> {
  const fromMem: AuditSummaryCard[] = [...mem.audits.values()]
    .filter((a) => (userId ? a.userId === userId || a.userId === null : true))
    .map(toCard);

  if (capabilities.hasSupabaseAdmin && userId) {
    const admin = createAdminClient();
    if (admin) {
      try {
        const { data } = await admin
          .from("audits")
          .select("report_json")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(50);
        const fromDb = (data ?? [])
          .map((r) => r.report_json as AuditReport)
          .filter(Boolean)
          .map(toCard);
        // Merge, dedupe by id (memory wins for freshest state).
        const seen = new Set(fromMem.map((c) => c.id));
        return [...fromMem, ...fromDb.filter((c) => !seen.has(c.id))].sort(
          (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
        );
      } catch {
        /* fall through to memory */
      }
    }
  }
  return fromMem.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}

function toCard(a: AuditReport): AuditSummaryCard {
  return {
    id: a.id,
    businessName: a.businessName,
    websiteUrl: a.websiteUrl,
    auditMode: a.auditMode,
    status: a.status,
    overallScore: a.scores.searchFunnel,
    // Fall back to severity/difficulty for reports stored before `group` existed.
    criticalCount: a.recommendations.filter((r) => (r.group ?? (r.severity === "critical" ? "critical" : "")) === "critical").length,
    easyCount: a.recommendations.filter((r) => (r.group ?? (r.difficulty === "easy" ? "easy" : "")) === "easy").length,
    createdAt: a.createdAt,
  };
}

// --- Businesses ------------------------------------------------------------

export async function saveBusiness(business: Business): Promise<void> {
  mem.businesses.set(business.id, business);
  if (!capabilities.hasSupabaseAdmin) return;
  const admin = createAdminClient();
  if (!admin) return;
  try {
    await admin.from("businesses").upsert({
      id: business.id,
      user_id: business.userId,
      business_name: business.businessName,
      website_url: business.websiteUrl,
      industry: business.industry,
      primary_location: business.primaryLocation,
      service_area: business.serviceArea,
      monthly_ad_budget: business.monthlyAdBudget,
      monthly_marketing_budget: business.monthlyMarketingBudget,
      primary_conversion_goal: business.primaryConversionGoal,
      average_customer_value: business.averageCustomerValue,
      top_services: business.topServices,
      profitable_services: business.profitableServices,
      target_locations: business.targetLocations,
      competitors: business.competitors,
      target_customer: business.targetCustomer,
      ad_status: business.adStatus,
      marketing_status: business.marketingStatus,
      created_at: business.createdAt,
      updated_at: business.updatedAt,
    });
  } catch (err) {
    console.error("saveBusiness: Supabase write failed (kept in memory):", err);
  }
}

export async function listBusinesses(userId: string | null): Promise<Business[]> {
  return [...mem.businesses.values()].filter((b) =>
    userId ? b.userId === userId || b.userId === "demo_user" : true,
  );
}

export async function getBusiness(id: string): Promise<Business | null> {
  return mem.businesses.get(id) ?? null;
}
