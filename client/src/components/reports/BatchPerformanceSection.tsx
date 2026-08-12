import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatsCard, ChartContainer, ChartEmpty } from "@/components/dashboard";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "@/contexts/LanguageContext";
import { Layers, Scale, Boxes, ExternalLink, Plane, Ship } from "lucide-react";
import { Link } from "wouter";
import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";

export function BatchPerformanceSection() {
  const { t } = useTranslation();

  const { data: batchPerformance, isLoading } = trpc.reports.batchPerformance.useQuery();
  const { data: batches } = trpc.batches.list.useQuery();

  const stats = useMemo(() => {
    const batchList = Array.isArray(batches) ? batches : batches?.data ?? [];
    const activeBatches = batchList.filter((b: { status: string }) => b.status !== "closed").length || 0;
    const totalWeight = batchPerformance?.reduce(
      (sum, b) => sum + Number(b.totalWeight || 0),
      0
    ) || 0;
    const avgPackages =
      batchPerformance && batchPerformance.length > 0
        ? Math.round(
            batchPerformance.reduce((sum, b) => sum + Number(b.packageCount || 0), 0) /
              batchPerformance.length
          )
        : 0;

    return { activeBatches, totalWeight: Math.round(totalWeight), avgPackages };
  }, [batchPerformance, batches]);

  const chartData = useMemo(() => {
    if (!batchPerformance) return [];
    return batchPerformance
      .slice(0, 10)
      .map((b) => ({
        name: b.batchCode,
        packages: Number(b.packageCount || 0),
        shippingType: b.shippingType,
      }))
      .sort((a, b) => b.packages - a.packages);
  }, [batchPerformance]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <StatsCard
          title={t("reports.activeBatches")}
          value={stats.activeBatches}
          icon={<Layers className="h-6 w-6" />}
          color="blue"
          isLoading={isLoading}
        />
        <StatsCard
          title={t("reports.totalWeight")}
          value={stats.totalWeight}
          description="KG"
          icon={<Scale className="h-6 w-6" />}
          color="amber"
          isLoading={isLoading}
        />
        <StatsCard
          title={t("reports.avgPackagesPerBatch")}
          value={stats.avgPackages}
          icon={<Boxes className="h-6 w-6" />}
          color="green"
          isLoading={isLoading}
        />
      </div>

      <Card className="overflow-hidden border-0 shadow-lg">
        <CardHeader className="border-b bg-gradient-to-r from-muted/50 to-muted/30">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Layers className="h-5 w-5 text-blue-500 dark:text-blue-400" />
              {t("reports.topBatches")}
            </CardTitle>
            <Link href="/reports/batches">
              <Button variant="outline" size="sm" className="gap-2">
                {t("reports.viewBatchReports")}
                <ExternalLink className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <ChartContainer height="h-[280px]" isLoading={isLoading}>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="name"
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
                    labelFormatter={(label) => String(label)}
                  />
                  <Bar dataKey="packages" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={entry.shippingType === "sea" ? "#06b6d4" : "#3b82f6"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <ChartEmpty message={t("reports.noDataAvailable")} icon={<Layers className="h-10 w-10" />} />
            )}
          </ChartContainer>
          {chartData.length > 0 && (
            <div className="flex items-center justify-center gap-6 mt-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Plane className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400" />
                <span>{t("reports.airShipment")}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Ship className="h-3.5 w-3.5 text-cyan-500 dark:text-cyan-400" />
                <span>{t("reports.seaShipment")}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
