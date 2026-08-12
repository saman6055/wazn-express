import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SessionStatsProps {
  stats: {
    label: string;
    value: number | string;
    color: string;
    format?: "number" | "decimal" | "string";
  }[];
  title?: string;
  className?: string;
}

export function SessionStats({ stats, title, className }: SessionStatsProps) {
  const colorMap: Record<string, { bg: string; text: string }> = {
    indigo: { bg: "bg-indigo-50 dark:bg-indigo-900/20", text: "text-indigo-600" },
    purple: { bg: "bg-purple-50 dark:bg-purple-900/20", text: "text-purple-600" },
    violet: { bg: "bg-violet-50 dark:bg-violet-900/20", text: "text-violet-600" },
    green: { bg: "bg-green-50 dark:bg-green-900/20", text: "text-green-600" },
    yellow: { bg: "bg-yellow-50 dark:bg-yellow-900/20", text: "text-yellow-600" },
    blue: { bg: "bg-blue-50 dark:bg-blue-900/20", text: "text-blue-600" },
    teal: { bg: "bg-teal-50 dark:bg-teal-900/20", text: "text-teal-600" },
    emerald: { bg: "bg-emerald-50 dark:bg-emerald-900/20", text: "text-emerald-600" },
    red: { bg: "bg-red-50 dark:bg-red-900/20", text: "text-red-600" },
  };

  return (
    <Card className={cn("border-0 shadow-lg", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-indigo-600 dark:text-indigo-300" />
          {title || "Session Stats"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {stats.map((stat, i) => {
            const colors = colorMap[stat.color] || colorMap.indigo;
            return (
              <div
                key={i}
                className={cn(colors.bg, "rounded-lg p-3 text-center")}
              >
                <div className={cn("text-2xl font-bold", colors.text)}>
                  {typeof stat.value === "number" && stat.format === "decimal"
                    ? stat.value.toFixed(1)
                    : stat.value}
                </div>
                <div className="text-xs text-muted-foreground">
                  {stat.label}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
