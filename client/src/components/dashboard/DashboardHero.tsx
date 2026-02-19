import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface DashboardHeroAction {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  asChild?: boolean;
  children?: React.ReactNode;
}

interface DashboardHeroProps {
  /** Small label above title (e.g. app name) */
  badge?: string;
  badgeIcon?: React.ReactNode;
  title: string;
  subtitle?: string;
  /** Primary actions (buttons or custom content) */
  actions?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

export function DashboardHero({
  badge,
  badgeIcon,
  title,
  subtitle,
  actions,
  className,
  children,
}: DashboardHeroProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-primary/70 px-6 py-6 md:px-8 md:py-8 text-primary-foreground",
        className
      )}
    >
      {/* Subtle pattern overlay */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cpath d='M36 18c-9.94 0-18 8.06-18 18s8.06 18 18 18 18-8.06 18-18-8.06-18-18-18zm0 32c-7.73 0-14-6.27-14-14s6.27-14 14-14 14 6.27 14 14-6.27 14-14 14z' fill='%23fff' fill-opacity='.05'/%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />
      <div className="relative">
        {badge && (
          <div className="flex items-center gap-2 mb-2">
            {badgeIcon}
            <span className="text-sm font-medium opacity-90">{badge}</span>
          </div>
        )}
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl mb-2">{title}</h1>
        {subtitle && (
          <p className="text-primary-foreground/80 max-w-lg text-sm md:text-base">{subtitle}</p>
        )}
        {actions && (
          <div className="flex flex-wrap gap-2 mt-4">{actions}</div>
        )}
        {children}
      </div>
      {/* Soft glow orbs */}
      <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
      <div className="absolute -right-20 -bottom-20 h-60 w-60 rounded-full bg-white/5 blur-3xl" />
    </div>
  );
}
