import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface ChartContainerProps {
  children: React.ReactNode;
  /** Fixed height to avoid layout shift (e.g. h-[300px]) */
  height?: string;
  isLoading?: boolean;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  className?: string;
}

export function ChartContainer({
  children,
  height = "h-[300px]",
  isLoading = false,
  emptyMessage,
  emptyIcon,
  className,
}: ChartContainerProps) {
  if (isLoading) {
    return (
      <div className={cn(height, "flex items-center justify-center", className)}>
        <div className="flex w-full flex-col gap-3 p-4">
          <Skeleton className="h-full w-full rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn(height, "min-h-0 w-full", className)}>
      {children}
    </div>
  );
}

/** Empty state for charts when there is no data */
export function ChartEmpty({
  message,
  icon,
  className,
}: {
  message: string;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-full min-h-[200px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/30 p-6 text-center text-muted-foreground",
        className
      )}
    >
      {icon && <div className="opacity-40">{icon}</div>}
      <p className="text-sm">{message}</p>
    </div>
  );
}
