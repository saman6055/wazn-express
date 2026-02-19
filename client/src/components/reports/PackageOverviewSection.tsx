import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatsCard, ChartContainer, ChartEmpty } from "@/components/dashboard";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "@/contexts/LanguageContext";
import { Package, Truck, CheckCircle, Clock } from "lucide-react";
import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";

const STATUS_COLORS: Record<string, string> = {
  registered: "#94a3b8",
  in_china_warehouse: "#3b82f6",
  in_batch: "#6366f1",
  in_transit: "#f59e0b",
  customs_processing: "#a855f7",
  in_local_warehouse: "#14b8a6",
  ready_for_delivery: "#06b6d4",
  out_for_delivery: "#f97316",
  delivered: "#22c55e",
  returned: "#ef4444",
  cancelled: "#dc2626",
};

export function PackageOverviewSection() {
  const { t } = useTranslation();

  const { data: packagesByStatus, isLoading } = trpc.reports.packagesByStatus.useQuery();

  const stats = useMemo(() => {
    if (!packagesByStatus) return { total: 0, inTransit: 0, delivered: 0, pending: 0 };
    const getCount = (status: string) =>
      Number(packagesByStatus.find((s) => s.status === status)?.count || 0);
    const total = packagesByStatus.reduce((sum, s) => sum + Number(s.count), 0);
    const inTransit = getCount("in_transit") + getCount("in_batch");
    const delivered = getCount("delivered");
    const pending = getCount("registered") + getCount("in_china_warehouse");
    return { total, inTransit, delivered, pending };
  }, [packagesByStatus]);

  const chartData = useMemo(() => {
    if (!packagesByStatus) return [];
    return packagesByStatus
      .filter((s) => Number(s.count) > 0)
      .map((s) => ({
        status: s.status,
        count: Number(s.count),
      }))
      .sort((a, b) => b.count - a.count);
  }, [packagesByStatus]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title={t("reports.totalPackages")}
          value={stats.total}
          icon={<Package className="h-6 w-6" />}
          color="blue"
          isLoading={isLoading}
        />
        <StatsCard
          title={t("reports.inTransit")}
          value={stats.inTransit}
          icon={<Truck className="h-6 w-6" />}
          color="amber"
          isLoading={isLoading}
        />
        <StatsCard
          title={t("reports.delivered")}
          value={stats.delivered}
          icon={<CheckCircle className="h-6 w-6" />}
          color="green"
          isLoading={isLoading}
        />
        <StatsCard
          title={t("reports.pending")}
          value={stats.pending}
          icon={<Clock className="h-6 w-6" />}
          color="purple"
          isLoading={isLoading}
        />
      </div>

      <Card className="overflow-hidden border-0 shadow-lg">
        <CardHeader className="border-b bg-gradient-to-r from-muted/50 to-muted/30">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Package className="h-5 w-5 text-primary" />
            {t("reports.packageStatusDistribution")}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <ChartContainer height="h-[280px]" isLoading={isLoading}>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="status"
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry) => (
                      <Cell key={entry.status} fill={STATUS_COLORS[entry.status] || "#94a3b8"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <ChartEmpty message={t("reports.noDataAvailable")} icon={<Package className="h-10 w-10" />} />
            )}
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
