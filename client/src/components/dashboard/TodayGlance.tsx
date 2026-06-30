import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type TodayGlanceItem = {
  icon?: ReactNode;
  label: string;
  value: ReactNode;
};

type TodayGlanceProps = {
  items: TodayGlanceItem[];
  className?: string;
};

/**
 * Presentational strip of compact stat tiles (label + value).
 * Horizontal row, wraps on small screens, theme-aware.
 * No data fetching — the caller passes already-computed items.
 */
export function TodayGlance({ items, className }: TodayGlanceProps) {
  if (!items?.length) return null;

  return (
    <div className={cn("flex flex-wrap gap-3", className)}>
      {items.map((item, i) => (
        <div
          key={i}
          className={cn(
            "flex min-w-[8rem] flex-1 items-center gap-3 rounded-xl border border-border bg-card px-4 py-3",
            "shadow-sm"
          )}
        >
          {item.icon && (
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground [&_svg]:size-4">
              {item.icon}
            </span>
          )}
          <div className="min-w-0">
            <div className="truncate text-xs text-muted-foreground">
              {item.label}
            </div>
            <div className="truncate text-lg font-semibold text-foreground">
              {item.value}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default TodayGlance;
