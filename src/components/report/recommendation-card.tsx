import { Lightbulb, TrendingUp, Wrench, Target } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SeverityBadge, DifficultyBadge } from "@/components/report/severity-badge";
import type { Recommendation } from "@/lib/types";

const CATEGORY_LABEL: Record<Recommendation["category"], string> = {
  seo: "SEO",
  technical_seo: "Technical SEO",
  content: "Content",
  local_seo: "Local SEO",
  ai_search: "AI Search",
  ad_copy: "Ad Copy",
  landing_page: "Landing Page",
  conversion_tracking: "Conversion Tracking",
  keyword_strategy: "Keyword Strategy",
  campaign_structure: "Campaign Structure",
  budget_allocation: "Budget Allocation",
  negative_keywords: "Negative Keywords",
  bidding: "Bidding & Quality Score",
  measurement: "Measurement",
  organic_gap: "Organic Demand Gap",
};

export function RecommendationCard({ rec, index }: { rec: Recommendation; index?: number }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="gap-3 bg-muted/30">
        <div className="flex flex-wrap items-center gap-2">
          <SeverityBadge severity={rec.severity} />
          <Badge variant="outline">{CATEGORY_LABEL[rec.category]}</Badge>
          <DifficultyBadge difficulty={rec.difficulty} />
          <span className="ml-auto flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <Target className="h-3.5 w-3.5" /> Priority {rec.priorityScore}
          </span>
        </div>
        <h3 className="text-base font-semibold leading-snug">
          {typeof index === "number" && <span className="mr-1.5 text-muted-foreground">{index + 1}.</span>}
          {rec.title}
        </h3>
      </CardHeader>
      <CardContent className="space-y-4 p-5 text-sm">
        {rec.evidence.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Evidence</p>
            <ul className="space-y-1">
              {rec.evidence.map((e, i) => (
                <li key={i} className="flex gap-2 text-muted-foreground">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60" />
                  <span className="font-mono text-[13px]">{e}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Lightbulb className="h-3.5 w-3.5" /> Why it matters
            </p>
            <p className="text-muted-foreground">{rec.whyItMatters}</p>
          </div>
          <div>
            <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Wrench className="h-3.5 w-3.5" /> Recommended fix
            </p>
            <p className="text-muted-foreground">{rec.recommendedFix}</p>
          </div>
        </div>

        <Separator />
        <div className="flex items-center gap-2 text-sm">
          <TrendingUp className="h-4 w-4 text-primary" />
          <span className="font-medium text-foreground">Estimated impact:</span>
          <span className="text-muted-foreground">{rec.estimatedImpact}</span>
        </div>
      </CardContent>
    </Card>
  );
}
