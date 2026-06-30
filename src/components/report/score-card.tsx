import { Card, CardContent } from "@/components/ui/card";
import { ScoreRing } from "@/components/ui/score-ring";
import { cn } from "@/lib/utils";
import type { ScoreBreakdown } from "@/lib/types";

export function ScoreCard({
  breakdown,
  invert = false,
  emphasis = false,
}: {
  breakdown: ScoreBreakdown;
  /** Risk scores (higher = worse) invert the color scale. */
  invert?: boolean;
  emphasis?: boolean;
}) {
  return (
    <Card className={cn(emphasis && "ring-2 ring-primary/30")}>
      <CardContent className="flex flex-col items-center gap-3 p-5 text-center">
        <ScoreRing score={breakdown.score} invert={invert} size={emphasis ? 132 : 104} label={breakdown.label} />
        {breakdown.issues.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            {breakdown.issues.length} issue{breakdown.issues.length > 1 ? "s" : ""} found
          </p>
        ) : (
          <p className="text-xs text-emerald-600">Looking healthy</p>
        )}
      </CardContent>
    </Card>
  );
}
