import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartEmpty } from "@/components/dashboard";
import { trpc } from "@/lib/trpc";
import { useTranslation, useLanguage } from "@/contexts/LanguageContext";
import { QrCode } from "lucide-react";
import { useMemo } from "react";
import { SCANNER_MODULES } from "@/constants/scannerModules";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const MODULE_COLORS = ["#3b82f6", "#a855f7", "#14b8a6", "#22c55e"];

interface Props {
  startDate: Date;
  endDate: Date;
}

export function ScanningActivitySection({ startDate, endDate }: Props) {
  const { t } = useTranslation();
  const { language } = useLanguage();

  const { data: todayStats, isLoading } = trpc.scanning.todayStats.useQuery();

  const totalToday = useMemo(() => {
    if (!todayStats) return 0;
    return todayStats.reduce((sum: number, s: { count: number }) => sum + Number(s.count || 0), 0);
  }, [todayStats]);

  const pieData = useMemo(() => {
    if (!todayStats) return [];
    return SCANNER_MODULES.map((mod, index) => {
      const stat = todayStats.find((s: { scanType: string }) => s.scanType === mod.scanType);
      return {
        name: language === "ku" || language === "ar" ? mod.labelKu : mod.labelEn,
        value: Number(stat?.count || 0),
        color: MODULE_COLORS[index % MODULE_COLORS.length],
      };
    }).filter((d) => d.value > 0);
  }, [todayStats, language]);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Stats */}
      <Card className="overflow-hidden border-0 shadow-lg">
        <CardHeader className="border-b bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30">
          <CardTitle className="flex items-center gap-2 text-lg">
            <QrCode className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />
            {t("reports.todayScans")}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="text-center">
            <p className="text-5xl font-bold tracking-tight">{totalToday}</p>
            <p className="mt-2 text-sm text-muted-foreground">{t("reports.scansToday")}</p>
          </div>
          <div className="mt-6 space-y-3">
            {SCANNER_MODULES.map((mod, index) => {
              const stat = todayStats?.find((s: { scanType: string }) => s.scanType === mod.scanType);
              const count = Number(stat?.count || 0);
              return (
                <div key={mod.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: MODULE_COLORS[index] }}
                    />
                    <span className="text-sm">
                      {language === "ku" || language === "ar" ? mod.labelKu : mod.labelEn}
                    </span>
                  </div>
                  <span className="text-sm font-semibold">{count}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Pie Chart */}
      <Card className="overflow-hidden border-0 shadow-lg lg:col-span-2">
        <CardHeader className="border-b bg-gradient-to-r from-muted/50 to-muted/30">
          <CardTitle className="flex items-center gap-2 text-lg">
            <QrCode className="h-5 w-5 text-purple-500 dark:text-purple-400" />
            {t("reports.scanModuleBreakdown")}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <ChartContainer height="h-[300px]" isLoading={isLoading}>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <ChartEmpty message={t("reports.noDataAvailable")} icon={<QrCode className="h-10 w-10" />} />
            )}
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
