import { Skeleton } from './ui/skeleton';

export function DashboardLayoutSkeleton() {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar skeleton — matches the collapsed icon rail (w-20) */}
      <div className="w-20 border-r border-border bg-background py-3 flex flex-col items-center gap-3">
        {/* Logo */}
        <Skeleton className="h-10 w-10 rounded-xl" />
        {/* Group icons */}
        <div className="mt-2 flex flex-col items-center gap-1.5">
          <Skeleton className="h-11 w-11 rounded-xl" />
          <Skeleton className="h-11 w-11 rounded-xl" />
          <Skeleton className="h-11 w-11 rounded-xl" />
          <Skeleton className="h-11 w-11 rounded-xl" />
          <Skeleton className="h-11 w-11 rounded-xl" />
        </div>
      </div>

      {/* Main content skeleton */}
      <div className="flex-1 p-4 space-y-4">
        {/* Content blocks */}
        <Skeleton className="h-12 w-48 rounded-lg" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}
