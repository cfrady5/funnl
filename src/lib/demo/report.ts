/**
 * Builds (and caches) the THOY Lawncare demo report. This is what powers the
 * "View Demo Report" CTA and the demo connected-data audit. It runs the REAL
 * engine over the demo dataset, so the output is identical in shape and logic
 * to a live audit.
 */

import { runAudit } from "@/lib/audit/engine";
import { DEMO_BUSINESS } from "./data";
import type { AuditReport } from "@/lib/types";

const g = globalThis as unknown as { __demoReport?: AuditReport };

export const DEMO_AUDIT_ID = "demo";

export async function getDemoReport(): Promise<AuditReport> {
  if (g.__demoReport) return g.__demoReport;
  const report = await runAudit({
    auditId: DEMO_AUDIT_ID,
    userId: "demo_user",
    business: DEMO_BUSINESS,
    websiteUrl: DEMO_BUSINESS.websiteUrl,
    businessName: DEMO_BUSINESS.businessName,
    mode: "connected",
    dateStart: "2026-05-31",
    dateEnd: "2026-06-29",
    useDemoData: true,
  });
  g.__demoReport = report;
  return report;
}
