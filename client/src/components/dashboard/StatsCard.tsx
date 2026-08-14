import { Card, CardContent } from "@/components/ui/card";
import { memo } from "react";
import { cn } from "@/lib/utils";
import { ExplainableStat } from "@/components/dashboard/ExplainableStat";
import type { DashboardFigureId } from "@shared/dashboardExplain";
import { Sparkline } from "./Sparkline";
import { CountUp } from "@/components/CountUp";

const colorStyles = {
  blue: "from-blue-500 to-blue-600",
  emerald: "from-emerald-500 to-emerald-600",
  amber: "from-amber-500 to-amber-600",
  green: "from-green-500 to-green-600",
  purple: "from-purple-500 to-purple-600",
} as const;

const sparkColor = {
  blue: "text-blue-500",
  emerald: "text-emerald-500",
  amber: "text-amber-500",
  green: "text-green-500",
  purple: "text-purple-500",
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
  const gradient = colorStyles[color];

  return (
    <Card className="pro-stat-card overflow-hidden transition-all duration-300 hover:shadow-md group">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1 min-w-0 flex-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            {isLoading ? (
              <div className="h-9 w-24 animate-pulse rounded-md bg-muted" />
            ) : (
              <p className="text-3xl font-bold tracking-tight">
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
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          <div
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg transition-transform duration-300 group-hover:scale-105",
              gradient
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
