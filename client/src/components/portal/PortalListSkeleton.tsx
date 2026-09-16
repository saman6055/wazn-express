import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Skeleton for portal list pages (shipments, batches, etc.) */
export function PortalListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="p-4 space-y-4">
      <div className="flex gap-2">
        <Skeleton className="h-9 flex-1 rounded-xl" />
        <Skeleton className="h-9 w-9 rounded-xl" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-border/50 p-4 space-y-3">
          <div className="flex justify-between items-start">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-[75%]" />
          <div className="flex justify-between pt-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-28 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Skeleton for portal home (stats + list) */
export function PortalHomeSkeleton() {
  return (
    <div className="p-4 space-y-6">
      <div className="h-32 rounded-2xl">
        <Skeleton className="h-full w-full rounded-2xl" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
      <div>
        <Skeleton className="h-6 w-40 mb-3" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Skeleton for portal financial page */
export function PortalFinancialSkeleton() {
  return (
    <div className="p-4 space-y-6">
      <Skeleton className="h-28 rounded-2xl" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>
      <div>
        <Skeleton className="h-6 w-36 mb-3" />
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Skeleton for search / tracking page */
/** Skeleton for the search's answers: the three tabs, then a few cards. */
export function PortalSearchResultsSkeleton({ rows = 4, tabs = true }: { rows?: number; tabs?: boolean }) {
  return (
    <div className="space-y-3 px-4 pt-3">
      {tabs && (
        <div className="grid grid-cols-3 gap-1.5">
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
        </div>
      )}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-2xl border border-border/50 p-3">
          <Skeleton className="h-14 w-14 shrink-0 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-[60%]" />
            <Skeleton className="h-3 w-[40%]" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PortalSearchSkeleton() {
  return (
    <div className="p-4 space-y-4">
      <Skeleton className="h-12 w-full rounded-xl" />
      <Skeleton className="h-12 w-full rounded-xl" />
      <div className="py-12 flex flex-col items-center gap-4">
        <Skeleton className="h-20 w-20 rounded-full" />
        <Skeleton className="h-4 w-48" />
      </div>
    </div>
  );
}
