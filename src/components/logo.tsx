import { cn } from "@/lib/utils";

/**
 * The srchr brand mark — a magnifying glass with three motion lines (electric
 * blue, search green, light blue) trailing into the lens, which holds a blue
 * focus dot. Recreated as inline SVG so it scales crisply and works on light or
 * dark surfaces. `mono` renders the whole mark in currentColor (e.g. on the
 * dark hero) while keeping the accent dot/lines tinted.
 */
export function SrchrMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("h-7 w-7", className)} aria-hidden="true" fill="none">
      {/* motion lines */}
      <line x1="6" y1="22" x2="20" y2="22" stroke="#2563EB" strokeWidth="3.4" strokeLinecap="round" />
      <line x1="6" y1="30" x2="20" y2="30" stroke="#22C55E" strokeWidth="3.4" strokeLinecap="round" />
      <line x1="8" y1="38" x2="20" y2="38" stroke="#BFDBFE" strokeWidth="3.4" strokeLinecap="round" />
      {/* lens */}
      <circle cx="38" cy="30" r="14" stroke="#0F172A" strokeWidth="4" />
      {/* handle */}
      <line x1="48.5" y1="40.5" x2="57" y2="49" stroke="#0F172A" strokeWidth="4" strokeLinecap="round" />
      {/* focus dot */}
      <circle cx="38" cy="30" r="3.4" fill="#2563EB" />
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
      <SrchrMark />
      {showWordmark && (
        <span className={cn("text-lg font-bold lowercase tracking-tight", wordmarkClassName)}>srchr</span>
      )}
    </span>
  );
}
