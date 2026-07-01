import { cn } from "@/lib/utils";

interface DashboardSectionProps {
  /** Optional section title (e.g. "Overview", "Alerts") */
  title?: string;
  /** Optional short description below title */
  description?: string;
  /** Optional right-side content (e.g. "View all" link) */
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function DashboardSection({
  title,
  description,
  action,
  children,
  className,
}: DashboardSectionProps) {
  if (!title && !description && !action) {
    return <div className={cn("space-y-4", className)}>{children}</div>;
  }

  return (
    <section className={cn("space-y-4", className)}>
      {(title || action) && (
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            {title && (
              <span
                aria-hidden
                className="h-8 w-1.5 shrink-0 rounded-full bg-gradient-to-b from-sky-400 via-blue-500 to-violet-500"
              />
            )}
            <div>
              {title && (
                <h2 className="text-base font-bold tracking-tight text-foreground md:text-lg">
                  {title}
                </h2>
              )}
              {description && (
                <p className="text-sm text-muted-foreground">{description}</p>
              )}
            </div>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
