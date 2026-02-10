import { Skeleton } from "@/components/ui/skeleton";

/**
 * Full-page loading skeleton matching DashboardLayout (sidebar + main content).
 * Used as Suspense fallback when lazy-loading route components.
 */
export function LoadingSkeleton() {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar skeleton */}
      <div className="relative w-[280px] shrink-0 border-r border-border bg-background p-4 space-y-6">
        <div className="flex items-center gap-3 px-2">
          <Skeleton className="h-8 w-8 rounded-md animate-pulse" />
          <Skeleton className="h-4 w-24 animate-pulse" />
        </div>
        <div className="space-y-2 px-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="absolute bottom-4 left-4 right-4">
          <div className="flex items-center gap-3 px-1">
            <Skeleton className="h-9 w-9 rounded-full animate-pulse" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-20 animate-pulse" />
              <Skeleton className="h-2 w-32 animate-pulse" />
            </div>
          </div>
        </div>
      </div>

      {/* Main content skeleton */}
      <div className="flex-1 p-6 space-y-6">
        <Skeleton className="h-10 w-64 rounded-lg animate-pulse" />
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
