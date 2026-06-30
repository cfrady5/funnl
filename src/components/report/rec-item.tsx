import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DifficultyBadge } from "@/components/report/severity-badge";
import type { Recommendation, RecommendationCategory, Confidence } from "@/lib/types";

/** Maps the fine-grained category onto the 7 client-facing badge labels. */
const CATEGORY_BADGE: Record<RecommendationCategory, { label: string; variant: "info" | "secondary" | "outline" }> = {
  seo: { label: "SEO", variant: "info" },
  technical_seo: { label: "SEO", variant: "info" },
  organic_gap: { label: "SEO", variant: "info" },
  keyword_strategy: { label: "SEO", variant: "info" },
  content: { label: "Content", variant: "secondary" },
  local_seo: { label: "Local", variant: "secondary" },
  ai_search: { label: "AI Search", variant: "outline" },
  ad_copy: { label: "PPC", variant: "info" },
  campaign_structure: { label: "PPC", variant: "info" },
  bidding: { label: "PPC", variant: "info" },
  negative_keywords: { label: "PPC", variant: "info" },
  budget_allocation: { label: "PPC", variant: "info" },
  landing_page: { label: "Landing Page", variant: "outline" },
  conversion_tracking: { label: "Tracking", variant: "secondary" },
  measurement: { label: "Analytics", variant: "secondary" },
};

const CONFIDENCE_LABEL: Record<Confidence, string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Lower confidence",
};

/**
 * A scannable recommendation row. Title + badges + impact are always visible;
 * evidence / why-it-matters / exact-fix are tucked into an expandable details
 * block so the report doesn't become a wall of text.
 */
export function RecItem({ rec }: { rec: Recommendation }) {
  const cat = CATEGORY_BADGE[rec.category];
  return (
    <details className="group rounded-xl border bg-card transition-colors hover:border-primary/30 open:border-primary/30">
      <summary className="flex cursor-pointer list-none items-start gap-3 p-4">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <Badge variant={cat.variant}>{cat.label}</Badge>
            <DifficultyBadge difficulty={rec.difficulty} />
            <span className="text-[11px] text-muted-foreground">{CONFIDENCE_LABEL[rec.confidence]}</span>
          </div>
          <p className="font-semibold leading-snug">{rec.title}</p>
          <p className="mt-1 text-sm text-primary">{rec.estimatedImpact}</p>
        </div>
        <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-3 border-t px-4 py-3 text-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Why this matters</p>
          <p className="mt-0.5 text-muted-foreground">{rec.whyItMatters}</p>
        </div>
        {rec.evidence.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Evidence</p>
            <ul className="mt-0.5 space-y-1">
              {rec.evidence.map((e, i) => (
                <li key={i} className="flex gap-2 text-muted-foreground">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" />
                  <span>{e}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Exact fix</p>
          <p className="mt-0.5 text-muted-foreground">{rec.recommendedFix}</p>
        </div>
      </div>
    </details>
  );
}
