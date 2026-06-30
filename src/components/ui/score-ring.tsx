import { cn } from "@/lib/utils";

/** Color scale: green (good) -> amber -> red (poor). */
export function scoreColor(score: number, invert = false): string {
  const s = invert ? 100 - score : score;
  if (s >= 75) return "#22C55E";
  if (s >= 50) return "#F59E0B";
  if (s >= 30) return "#F97316";
  return "#EF4444";
}

export function ScoreRing({
  score,
  size = 120,
  stroke = 10,
  label,
  invert = false,
  className,
}: {
  score: number;
  size?: number;
  stroke?: number;
  label?: string;
  /** For risk scores where higher = worse, color inverts. */
  invert?: boolean;
  className?: string;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  const offset = circumference - (clamped / 100) * circumference;
  const color = scoreColor(clamped, invert);

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold tabular-nums" style={{ color }}>
          {Math.round(clamped)}
        </span>
        {label && <span className="mt-0.5 px-2 text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>}
      </div>
    </div>
  );
}
