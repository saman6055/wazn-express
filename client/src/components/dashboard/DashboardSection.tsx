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
          <div>
            {title && (
              <h2 className="text-base font-semibold tracking-tight text-foreground md:text-lg">
                {title}
              </h2>
            )}
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
