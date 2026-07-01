import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type PageHeaderVariant = "gradient" | "solid" | "muted" | "white";

const variantStyles: Record<PageHeaderVariant, string> = {
  gradient:
    "relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-6 md:p-8 text-white shadow-xl ring-1 ring-white/10",
  solid:
    "relative overflow-hidden rounded-3xl bg-gradient-to-br from-card to-muted/50 border border-border shadow-sm p-6 md:p-8 text-foreground",
  muted:
    "relative overflow-hidden rounded-3xl bg-gradient-to-br from-muted/70 to-muted/30 dark:from-muted/40 dark:to-muted/10 border border-border/50 p-6 md:p-8 text-foreground",
  white:
    "relative overflow-hidden rounded-3xl bg-gradient-to-br from-white to-sky-50/40 dark:from-card dark:to-card border border-border shadow-sm p-6 md:p-8 text-foreground",
};

const iconBgStyles: Record<PageHeaderVariant, string> = {
  gradient: "bg-white/15 backdrop-blur-md ring-1 ring-white/25 text-white shadow-lg",
  solid: "bg-gradient-to-br from-sky-500 to-violet-500 text-white shadow-md",
  muted: "bg-gradient-to-br from-sky-500 to-violet-500 text-white shadow-md",
  white: "bg-gradient-to-br from-sky-500 to-violet-500 text-white shadow-md",
};

const titleStyles: Record<PageHeaderVariant, string> = {
  gradient: "text-white drop-shadow-sm",
  solid: "text-foreground",
  muted: "text-foreground",
  white: "text-foreground",
};

const subtitleStyles: Record<PageHeaderVariant, string> = {
  gradient: "text-white/85",
  solid: "text-muted-foreground",
  muted: "text-muted-foreground",
  white: "text-muted-foreground",
};

interface PageHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  variant?: PageHeaderVariant;
  className?: string;
  actions?: React.ReactNode;
  /** Optional pattern overlay for gradient (subtle grid/dots) */
  withPattern?: boolean;
  /** Optional stats row below title (e.g. 4 small stat cards) */
  stats?: React.ReactNode;
}

export function PageHeader({
  icon: Icon,
  title,
  subtitle,
  variant = "gradient",
  className,
  actions,
  withPattern = true,
  stats,
}: PageHeaderProps) {
  const isGradient = variant === "gradient";
  return (
    <header
      className={cn(
        variantStyles[variant],
        className // e.g. custom gradient: from-blue-600 to-indigo-600
      )}
    >
      {isGradient && withPattern && (
        <div
          className="absolute inset-0 opacity-[0.08] pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='32' height='32' viewBox='0 0 32 32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h32v32H0z' fill='none'/%3E%3Cpath d='M16 4v24M4 16h24' stroke='%23fff' stroke-width='0.5' fill='none'/%3E%3C/svg%3E")`,
          }}
        />
      )}
      {/* Depth: soft glow orbs + a top sheen. Purely decorative, GPU-cheap. */}
      {isGradient && (
        <>
          <div className="pointer-events-none absolute -end-16 -top-20 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -start-10 -bottom-24 h-56 w-56 rounded-full bg-white/5 blur-3xl" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/10 to-transparent" />
        </>
      )}
      <div className="relative flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-transform duration-300 hover:scale-105",
                iconBgStyles[variant]
              )}
            >
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <h1
                className={cn(
                  "text-2xl font-bold tracking-tight md:text-3xl",
                  titleStyles[variant]
                )}
              >
                {title}
              </h1>
              {subtitle && (
                <p
                  className={cn(
                    "mt-1 text-sm md:text-base max-w-2xl",
                    subtitleStyles[variant]
                  )}
                >
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {actions && (
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {actions}
            </div>
          )}
        </div>
        {stats && <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{stats}</div>}
      </div>
    </header>
  );
}
