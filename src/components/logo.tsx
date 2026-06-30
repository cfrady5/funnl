import { cn } from "@/lib/utils";

/**
 * The funnl brand mark — three stacked descending bars forming an inverted
 * funnel, in the brand green, beside the "funnl" wordmark. Recreated as inline
 * SVG so it scales crisply and inherits color in dark/light contexts.
 */
export function FunnlMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("h-7 w-7", className)} aria-hidden="true">
      <path d="M10 14 H54 L46 26 H18 Z" fill="#22C55E" />
      <path d="M19 30 H45 L39 41 H25 Z" fill="#34D27A" />
      <path d="M27 45 H37 L32 56 Z" fill="#4ADE80" />
    </svg>
  );
}

export function Logo({
  className,
  showWordmark = true,
  wordmarkClassName,
}: {
  className?: string;
  showWordmark?: boolean;
  wordmarkClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <FunnlMark />
      {showWordmark && (
        <span className={cn("text-lg font-bold tracking-tight", wordmarkClassName)}>
          funnl
          <span className="ml-1 text-xs font-medium text-muted-foreground">SEM</span>
        </span>
      )}
    </span>
  );
}
