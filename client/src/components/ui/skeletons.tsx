import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type TableSkeletonProps = {
  rows?: number;
  cols?: number;
  className?: string;
};

export function TableSkeleton({ rows = 6, cols = 5, className }: TableSkeletonProps) {
  return (
    <div className={cn("w-full space-y-3", className)} aria-hidden="true">
      {/* Header row */}
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={`h-${i}`} className="h-4 w-3/4" />
        ))}
      </div>
      {/* Body rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={`r-${r}`}
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={`c-${r}-${c}`} className="h-9 w-full" />
          ))}
        </div>
      ))}
    </div>
  );
}

type CardGridSkeletonProps = {
  count?: number;
  className?: string;
};
