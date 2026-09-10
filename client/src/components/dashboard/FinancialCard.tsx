import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";
import { memo } from "react";
import { cn } from "@/lib/utils";
import { ExplainableStat } from "@/components/dashboard/ExplainableStat";
import type { DashboardFigureId } from "@shared/dashboardExplain";
import { Sparkline } from "./Sparkline";
import { CountUp } from "@/components/CountUp";

/**
 * A money figure at the top of a dashboard — the sibling of StatsCard, with
 * the same calm tile and the same value size, so the two rows read as one set
 * instead of two designs stacked on each other.
 */
const colorStyles = {
  green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  blue: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
  purple: "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
  red: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
} as const;

const sparkColor = {
  green: "text-emerald-500",
  blue: "text-sky-500",
  purple: "text-violet-500",
  red: "text-red-500",
} as const;

export interface FinancialCardProps {
  title: string;
  value: number;
  change?: number;
  icon: React.ReactNode;
  color: "green" | "blue" | "purple" | "red";
  prefix?: string;
  isDebt?: boolean;
  /** Optional tiny trend series for a sparkline at the bottom of the card. */
  trend?: number[];
  /**
   * Which dashboard figure this is, when it has an explanation. Clicking the
   * number then opens where it came from instead of doing nothing.
   */
  figure?: DashboardFigureId;
}

export const FinancialCard = memo(function FinancialCard({
  title,
  value,
  change,
  icon,
  color,
  prefix = "",
  isDebt = false,
  trend,
  figure,
}: FinancialCardProps) {
  const amount = (
    <>
      {prefix}
      <CountUp value={value} format={(n) => Math.round(n).toLocaleString("en-US")} />
    </>
  );

  return (
    <Card className="gap-0 overflow-hidden py-0 shadow-sm transition-colors hover:border-primary/30">
      <CardContent className="p-4">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-lg [&_svg]:size-5",
              colorStyles[color]
            )}
          >
            {icon}
          </div>
          {change !== undefined && !isDebt && (
            <div
              className={cn(
                "flex items-center gap-1 text-sm font-medium tabular-nums",
                change >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
              )}
            >
              {change >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              {Math.abs(change)}%
            </div>
          )}
        </div>
        <p className="mb-1 truncate text-sm font-medium text-muted-foreground" title={title}>{title}</p>
        <p
          className={cn(
            "truncate text-2xl font-semibold tracking-tight tabular-nums",
            isDebt && "text-red-600 dark:text-red-400"
          )}
        >
          {figure ? (
            <ExplainableStat figure={figure} value={value}>
              {amount}
            </ExplainableStat>
          ) : (
            amount
          )}
        </p>
        {trend && trend.length >= 2 && (
          <Sparkline data={trend} className={cn("mt-3 opacity-80", sparkColor[color])} />
        )}
      </CardContent>
    </Card>
  );
});
