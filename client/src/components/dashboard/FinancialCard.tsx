import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";
import { memo } from "react";
import { cn } from "@/lib/utils";
import { Sparkline } from "./Sparkline";
import { CountUp } from "@/components/CountUp";

const colorStyles = {
  green: {
    icon: "from-green-500 to-emerald-600",
    iconShadow: "shadow-green-500/25",
  },
  blue: {
    icon: "from-blue-500 to-indigo-600",
    iconShadow: "shadow-blue-500/25",
  },
  purple: {
    icon: "from-purple-500 to-violet-600",
    iconShadow: "shadow-purple-500/25",
  },
  red: {
    icon: "from-red-500 to-rose-600",
    iconShadow: "shadow-red-500/25",
  },
} as const;

const sparkColor = {
  green: "text-green-500",
  blue: "text-blue-500",
  purple: "text-purple-500",
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
}: FinancialCardProps) {
  const styles = colorStyles[color];

  return (
    <Card className="pro-stat-card overflow-hidden transition-all duration-300 hover:shadow-md">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg",
              styles.icon
            )}
          >
            {icon}
          </div>
          {change !== undefined && !isDebt && (
            <div
              className={cn(
                "flex items-center gap-1 text-sm font-medium",
                change >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
              )}
            >
              {change >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              {Math.abs(change)}%
            </div>
          )}
        </div>
        <p className="mb-1 text-sm font-medium text-muted-foreground">{title}</p>
        <p
          className={cn(
            "text-2xl font-bold tracking-tight",
            isDebt && "text-red-600 dark:text-red-400"
          )}
        >
          {prefix}
          <CountUp value={value} format={(n) => Math.round(n).toLocaleString("en-US")} />
        </p>
        {trend && trend.length >= 2 && (
          <Sparkline data={trend} className={cn("mt-3 opacity-80", sparkColor[color])} />
        )}
      </CardContent>
    </Card>
  );
});
