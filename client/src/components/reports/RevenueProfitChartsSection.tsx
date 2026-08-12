import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartEmpty } from "@/components/dashboard";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "@/contexts/LanguageContext";
import { TrendingUp, PieChart as PieChartIcon } from "lucide-react";
import { useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";

interface Props {
  startDate: Date;
  endDate: Date;
  dateRange: string;
}

const PROFIT_COLORS = ["#3b82f6", "#f59e0b", "#10b981", "#a855f7"];

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
};

export function RevenueProfitChartsSection({ startDate, endDate }: Props) {
  const { t } = useTranslation();

  const { data: revenueData, isLoading: loadingRevenue } = trpc.reports.revenue.useQuery({
    startDate,
    endDate,
  });

  const { data: profitByType, isLoading: loadingProfit } = trpc.reports.getProfitByType.useQuery({
    startDate,
    endDate,
  });

  const revenueChartData = useMemo(() => {
    if (!revenueData) return [];
    return revenueData.map((d) => ({
      date: d.date,
      revenue: Number(d.totalPayments || 0),
    }));
  }, [revenueData]);

  const profitTypeData = useMemo(() => {
    if (!profitByType) return [];
    const items = [
      { name: t("reports.fullPackageProfit"), value: Number(profitByType.fullPackage?.totalProfit || 0) },
      { name: t("reports.commissionProfit"), value: Number(profitByType.commission?.totalProfit || 0) },
      { name: t("reports.packageRevenue"), value: Number(profitByType.packages?.totalRevenue || 0) },
    ];
    return items.filter((i) => i.value > 0);
  }, [profitByType, t]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Revenue Trend */}
      <Card className="overflow-hidden border-0 shadow-lg">
        <CardHeader className="border-b bg-gradient-to-r from-muted/50 to-muted/30">
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
            {t("reports.salesTrend")}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <ChartContainer height="h-[300px]" isLoading={loadingRevenue}>
            {revenueChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tickFormatter={(v) => `$${v}`}
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={false}
                    name={t("reports.totalRevenue")}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <ChartEmpty message={t("reports.noDataAvailable")} icon={<TrendingUp className="h-10 w-10" />} />
            )}
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Profit by Type */}
      <Card className="overflow-hidden border-0 shadow-lg">
        <CardHeader className="border-b bg-gradient-to-r from-muted/50 to-muted/30">
          <CardTitle className="flex items-center gap-2 text-lg">
            <PieChartIcon className="h-5 w-5 text-blue-500 dark:text-blue-400" />
            {t("reports.profitBreakdown")}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <ChartContainer height="h-[300px]" isLoading={loadingProfit}>
            {profitTypeData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={profitTypeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {profitTypeData.map((_, index) => (
                      <Cell key={index} fill={PROFIT_COLORS[index % PROFIT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: number) => [`$${value.toLocaleString()}`, ""]}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <ChartEmpty message={t("reports.noDataAvailable")} icon={<PieChartIcon className="h-10 w-10" />} />
            )}
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
