import { Skeleton } from "@/components/ui/skeleton";
import { currentSurface } from "@/lib/errorSurface";

/**
 * What shows while a page's code arrives (the Suspense fallback for every
 * lazy route).
 *
 * One skeleton served every route: the staff layout, with a 280px sidebar on
 * the physical left. A customer opening a portal page, or anyone on the
 * public site, saw a staff sidebar flash up first; and staff saw a sidebar
 * wider than the real one — 80px, on the right in Kurdish and Arabic — jump
 * into place as the page arrived.
 */
export function LoadingSkeleton() {
  if (currentSurface() !== "staff") {
    return (
      <div className="min-h-dvh bg-background" aria-busy="true">
        <div className="mx-auto w-full max-w-lg space-y-4 p-4">
          <Skeleton className="h-12 w-full rounded-xl animate-pulse" />
          <Skeleton className="h-32 w-full rounded-2xl animate-pulse" />
          <div className="grid grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 rounded-xl animate-pulse" />
            ))}
          </div>
          <Skeleton className="h-24 w-full rounded-2xl animate-pulse" />
          <Skeleton className="h-24 w-full rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh bg-background" aria-busy="true">
      {/* The real sidebar: 80px wide, at the start of the reading direction. */}
      <div className="hidden w-20 shrink-0 flex-col items-center gap-3 border-e border-border bg-background py-4 md:flex">
        <Skeleton className="size-10 rounded-xl animate-pulse" />
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="size-10 rounded-lg animate-pulse" />
        ))}
      </div>

      <div className="min-w-0 flex-1 space-y-6 p-4 md:p-6">
        <Skeleton className="h-10 w-64 max-w-full rounded-lg animate-pulse" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-32 rounded-xl animate-pulse" />
          <Skeleton className="h-32 rounded-xl animate-pulse" />
          <Skeleton className="h-32 rounded-xl animate-pulse" />
        </div>
        <Skeleton className="h-96 rounded-xl animate-pulse" />
      </div>
    </div>
  );
}
