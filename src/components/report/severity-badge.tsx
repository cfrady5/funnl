import { AlertTriangle, AlertCircle, Info, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Severity, Difficulty } from "@/lib/types";

const SEVERITY_ICON = {
  critical: AlertCircle,
  high: AlertTriangle,
  medium: Info,
  low: CheckCircle2,
} as const;

export function SeverityBadge({ severity }: { severity: Severity }) {
  const Icon = SEVERITY_ICON[severity];
  return (
    <Badge variant={severity} className="capitalize">
      <Icon className="h-3 w-3" />
      {severity}
    </Badge>
  );
}

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  const variant = difficulty === "easy" ? "success" : difficulty === "medium" ? "info" : "secondary";
  return (
    <Badge variant={variant} className="capitalize">
      {difficulty}
    </Badge>
  );
}
