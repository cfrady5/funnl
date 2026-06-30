import { NextResponse } from "next/server";
import { getAudit } from "@/lib/store";
import { getDemoReport, DEMO_AUDIT_ID } from "@/lib/demo/report";

/** Polling endpoint for the audit run page. Returns status + steps + scores. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id === DEMO_AUDIT_ID) {
    const report = await getDemoReport();
    return NextResponse.json({ status: report.status, steps: report.steps });
  }
  const report = await getAudit(id);
  if (!report) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({
    status: report.status,
    steps: report.steps,
    error: report.error ?? null,
  });
}
