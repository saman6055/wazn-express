import { Card, CardContent } from "@/components/ui/card";
import { memo } from "react";
import { cn } from "@/lib/utils";
import { ExplainableStat } from "@/components/dashboard/ExplainableStat";
import type { DashboardFigureId } from "@shared/dashboardExplain";
import { Sparkline } from "./Sparkline";
import { CountUp } from "@/components/CountUp";

/**
 * A figure at the top of a dashboard.
 *
 * Calm on purpose: staff read these all day. The icon sits on a soft tint of
 * its colour instead of a saturated gradient with a coloured shadow that
 * grew on hover, and the value is the same size and weight as its sibling
 * FinancialCard, so two rows of cards read as one set.
 */
const colorStyles = {
  blue: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  purple: "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
} as const;

const sparkColor = {
  blue: "text-sky-500",
  emerald: "text-emerald-500",
  amber: "text-amber-500",
  green: "text-emerald-500",
  purple: "text-violet-500",
} as const;

export type StatsCardColor = keyof typeof colorStyles;

export interface StatsCardProps {
  title: string;
  value: number;
  description?: string;
  icon: React.ReactNode;
  color?: StatsCardColor;
  /** Show skeleton placeholder when loading */
  isLoading?: boolean;
  /** Optional tiny trend series for a sparkline at the bottom of the card. */
  trend?: number[];
  /**
   * Which dashboard figure this is, when it has an explanation. Clicking the
   * number then opens where it came from instead of doing nothing.
   */
  figure?: DashboardFigureId;
}

export const StatsCard = memo(function StatsCard({
  title,
  value,
  description,
  icon,
  color = "blue",
  isLoading = false,
  trend,
  figure,
}: StatsCardProps) {
  return (
    <Card className="gap-0 overflow-hidden py-0 shadow-sm transition-colors hover:border-primary/30">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="truncate text-sm font-medium text-muted-foreground" title={title}>{title}</p>
            {isLoading ? (
              <div className="h-8 w-24 animate-pulse rounded-md bg-muted" />
            ) : (
              <p className="truncate text-2xl font-semibold tracking-tight tabular-nums">
                {figure ? (
                  <ExplainableStat figure={figure} value={value}>
                    <CountUp value={value} />
                  </ExplainableStat>
                ) : (
                  <CountUp value={value} />
                )}
              </p>
            )}
            {description && (
              <p className="truncate text-xs text-muted-foreground" title={description}>{description}</p>
            )}
          </div>
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-lg [&_svg]:size-5",
              colorStyles[color]
            )}
          >
            {icon}
          </div>
        </div>
        {!isLoading && trend && trend.length >= 2 && (
          <Sparkline data={trend} className={cn("mt-3 opacity-80", sparkColor[color])} />
        )}
      </CardContent>
    </Card>
  );
});
