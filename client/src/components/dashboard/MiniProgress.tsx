import { cn } from "@/lib/utils";

export interface MiniProgressProps {
  value: number;
  max: number;
  /** Optional label shown above the bar. */
  label?: string;
  /** Tailwind class for the filled portion (e.g. "bg-emerald-500"). */
  color?: string;
  className?: string;
}

/**
 * Thin rounded progress bar with an optional label and a "value/max" caption.
 * Theme-aware: track uses the muted token, filled portion defaults to primary.
 */
export function MiniProgress({
  value,
  max,
  label,
  color = "bg-primary",
  className,
}: MiniProgressProps) {
  const safeMax = max > 0 ? max : 1;
  const ratio = Math.min(1, Math.max(0, value / safeMax));
  const pct = Math.round(ratio * 100);

  return (
    <div className={cn("space-y-1", className)}>
      {(label || max > 0) && (
        <div className="flex items-center justify-between text-xs">
          {label ? (
            <span className="font-medium text-foreground truncate">{label}</span>
          ) : (
            <span />
          )}
          <span className="shrink-0 ms-2 tabular-nums text-muted-foreground">
            {value.toLocaleString()}/{max.toLocaleString()}
          </span>
        </div>
      )}
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div
          className={cn("h-full rounded-full transition-all duration-300", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
