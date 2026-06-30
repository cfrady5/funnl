"use client";

import { useState } from "react";
import { Printer, Download, ClipboardCopy, ListChecks, FileText, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Recommendation } from "@/lib/types";

/**
 * Report actions. "Download" uses the browser's print-to-PDF (window.print)
 * against a print-optimized layout — zero server dependency. The copy actions
 * build clipboard-ready text from the structured recommendations.
 * TODO(production): server-side branded PDF (e.g. headless Chromium) + email.
 */
export function ReportToolbar({
  recommendations,
  executiveSummary,
  businessName,
}: {
  recommendations: Recommendation[];
  executiveSummary: string;
  businessName: string;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      /* clipboard unavailable */
    }
  };

  const recsText = recommendations
    .map(
      (r, i) =>
        `${i + 1}. [${r.severity.toUpperCase()}] ${r.title}\n   Why: ${r.whyItMatters}\n   Fix: ${r.recommendedFix}\n   Impact: ${r.estimatedImpact}`,
    )
    .join("\n\n");

  // Group the task list by the three client-facing buckets.
  const groupTasks = (group: "critical" | "easy" | "eventually") =>
    recommendations
      .filter((r) => r.group === group)
      .map((r) => `- [ ] ${r.title} (${r.difficulty})`)
      .join("\n");
  const taskList = [
    "## Critical (do first)",
    groupTasks("critical") || "- (none)",
    "\n## Easy fixes",
    groupTasks("easy") || "- (none)",
    "\n## Later improvements",
    groupTasks("eventually") || "- (none)",
  ].join("\n");

  const clientSummary = `${businessName} — Search Funnel Audit Summary\n\n${executiveSummary}\n\nTop priorities:\n${recommendations
    .slice(0, 5)
    .map((r, i) => `${i + 1}. ${r.title} — ${r.estimatedImpact}`)
    .join("\n")}`;

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <Button variant="outline" size="sm" onClick={() => copy("recs", recsText)}>
        {copied === "recs" ? <Check className="h-4 w-4" /> : <ClipboardCopy className="h-4 w-4" />}
        Copy recommendations
      </Button>
      <Button variant="outline" size="sm" onClick={() => copy("tasks", taskList)}>
        {copied === "tasks" ? <Check className="h-4 w-4" /> : <ListChecks className="h-4 w-4" />}
        Create task list
      </Button>
      <Button variant="outline" size="sm" onClick={() => copy("summary", clientSummary)}>
        {copied === "summary" ? <Check className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
        Client summary
      </Button>
      <Button variant="outline" size="sm" onClick={() => window.print()}>
        <Printer className="h-4 w-4" /> Print
      </Button>
      <Button size="sm" onClick={() => window.print()}>
        <Download className="h-4 w-4" /> PDF
      </Button>
    </div>
  );
}
