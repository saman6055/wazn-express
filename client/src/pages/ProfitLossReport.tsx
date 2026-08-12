import DashboardLayout from "@/components/DashboardLayout";
import { DashboardHero, DashboardSection, FinancialCard, ChartContainer, ChartEmpty } from "@/components/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useTranslation, useLanguage } from "@/contexts/LanguageContext";
import {
  DollarSign, TrendingUp, TrendingDown, Percent, Receipt,
  Package, Boxes, HandCoins, Wrench, ArrowUpRight, ArrowDownRight,
  BarChart3, PieChart as PieChartIcon, Calendar, Download,
  Trophy, AlertTriangle, ClipboardList, Activity,
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend,
  ComposedChart, Line,
} from "recharts";

const REVENUE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6"];
const EXPENSE_COLORS = ["#ef4444", "#f97316", "#ec4899", "#6366f1", "#14b8a6", "#84cc16", "#a855f7", "#06b6d4"];

export default function ProfitLossReport() {
  const { t } = useTranslation();
  const { language } = useLanguage();

  const currentYear = new Date().getFullYear();
  const [selectedMonth, setSelectedMonth] = useState(String(new Date().getMonth()));
  const [selectedYear, setSelectedYear] = useState(String(currentYear));

  const { startDate, endDate } = useMemo(() => {
    const y = parseInt(selectedYear);
    const m = parseInt(selectedMonth);
    return {
      startDate: new Date(y, m, 1),
      endDate: new Date(y, m + 1, 0, 23, 59, 59),
    };
  }, [selectedMonth, selectedYear]);

  const { data: pnl, isLoading } = trpc.financialReports.getDetailedPnL.useQuery({
    startDate,
    endDate,
  });

  const { data: monthlyTrend } = trpc.financialReports.getMonthlyTrend.useQuery({
    year: parseInt(selectedYear),
  });

  // Revenue chart data
  const revenueChartData = useMemo(() => {
    if (!pnl) return [];
    return [
      { name: t("profitLoss.packageShipping"), value: pnl.revenue.packageShipping, color: REVENUE_COLORS[0] },
      { name: t("profitLoss.fullPackageProfit"), value: pnl.revenue.fullPackageProfit, color: REVENUE_COLORS[1] },
      { name: t("profitLoss.commissionProfit"), value: pnl.revenue.commissionProfit, color: REVENUE_COLORS[2] },
      { name: t("profitLoss.serviceRevenue"), value: pnl.revenue.serviceRevenue, color: REVENUE_COLORS[3] },
    ].filter((d) => d.value > 0);
  }, [pnl, t]);

  // Expense chart data
  const expenseChartData = useMemo(() => {
    if (!pnl) return [];
    return pnl.expenses.byCategory
      .sort((a, b) => b.total - a.total)
      .map((c, i) => ({
        name: language === "ku" || language === "ar" ? c.categoryNameKu : c.categoryName,
        value: c.total,
        color: EXPENSE_COLORS[i % EXPENSE_COLORS.length],
      }));
  }, [pnl, language]);

  // Monthly trend chart data
  const trendData = useMemo(() => {
    if (!monthlyTrend) return [];
    const monthNames = language === "ku"
      ? ["کانوونی دووەم", "شوبات", "ئادار", "نیسان", "ئایار", "حوزەیران", "تەممووز", "ئاب", "ئەیلوول", "تشرینی یەکەم", "تشرینی دووەم", "کانوونی یەکەم"]
      : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return monthlyTrend.map((m) => ({
      name: monthNames[m.month - 1],
      revenue: m.revenue,
      expenses: m.expenses,
      profit: m.profit,
    }));
  }, [monthlyTrend, language]);

  // Key metrics
  const metrics = useMemo(() => {
    if (!pnl) return null;
    const revSources = [
      { name: t("profitLoss.packageShipping"), value: pnl.revenue.packageShipping, icon: <Package className="h-5 w-5" /> },
      { name: t("profitLoss.fullPackageProfit"), value: pnl.revenue.fullPackageProfit, icon: <Boxes className="h-5 w-5" /> },
      { name: t("profitLoss.commissionProfit"), value: pnl.revenue.commissionProfit, icon: <HandCoins className="h-5 w-5" /> },
      { name: t("profitLoss.serviceRevenue"), value: pnl.revenue.serviceRevenue, icon: <Wrench className="h-5 w-5" /> },
    ];
    const bestSource = revSources.reduce((a, b) => (a.value >= b.value ? a : b));
    const biggestExpense = pnl.expenses.byCategory.length > 0
      ? pnl.expenses.byCategory.reduce((a, b) => (a.total >= b.total ? a : b))
      : null;
    const totalOrders = pnl.orderCounts.packages + pnl.orderCounts.fullPackage + pnl.orderCounts.commission + pnl.orderCounts.services;
    const health = pnl.profitMargin > 20 ? "healthy" : pnl.profitMargin > 5 ? "warning" : "critical";
    return { bestSource, biggestExpense, totalOrders, health };
  }, [pnl, t]);

  // Excel export
  const handleExport = async () => {
    if (!pnl) { toast.error(t("toast.noDataToExport")); return; }
    const rows: Record<string, string | number>[] = [];
    rows.push({ [t("profitLoss.category")]: t("profitLoss.revenue"), [t("profitLoss.amount")]: "" });
    rows.push({ [t("profitLoss.category")]: `  ${t("profitLoss.packageShipping")}`, [t("profitLoss.amount")]: pnl.revenue.packageShipping });
    rows.push({ [t("profitLoss.category")]: `  ${t("profitLoss.fullPackageProfit")}`, [t("profitLoss.amount")]: pnl.revenue.fullPackageProfit });
    rows.push({ [t("profitLoss.category")]: `  ${t("profitLoss.commissionProfit")}`, [t("profitLoss.amount")]: pnl.revenue.commissionProfit });
    rows.push({ [t("profitLoss.category")]: `  ${t("profitLoss.serviceRevenue")}`, [t("profitLoss.amount")]: pnl.revenue.serviceRevenue });
    rows.push({ [t("profitLoss.category")]: t("profitLoss.totalRevenue"), [t("profitLoss.amount")]: pnl.revenue.totalRevenue });
    rows.push({ [t("profitLoss.category")]: "", [t("profitLoss.amount")]: "" });
    rows.push({ [t("profitLoss.category")]: t("profitLoss.costOfRevenue"), [t("profitLoss.amount")]: "" });
    rows.push({ [t("profitLoss.category")]: `  ${t("profitLoss.fullPackageCost")}`, [t("profitLoss.amount")]: pnl.costOfRevenue.fullPackageCost });
    rows.push({ [t("profitLoss.category")]: `  ${t("profitLoss.commissionCost")}`, [t("profitLoss.amount")]: pnl.costOfRevenue.commissionCost });
    rows.push({ [t("profitLoss.category")]: `  ${t("profitLoss.serviceCost")}`, [t("profitLoss.amount")]: pnl.costOfRevenue.serviceCost });
    rows.push({ [t("profitLoss.category")]: t("profitLoss.grossProfit"), [t("profitLoss.amount")]: pnl.grossProfit });
    rows.push({ [t("profitLoss.category")]: "", [t("profitLoss.amount")]: "" });
    rows.push({ [t("profitLoss.category")]: t("profitLoss.operatingExpenses"), [t("profitLoss.amount")]: "" });
    pnl.expenses.byCategory.forEach((c) => {
      rows.push({
        [t("profitLoss.category")]: `  ${language === "ku" || language === "ar" ? c.categoryNameKu : c.categoryName}`,
        [t("profitLoss.amount")]: c.total,
      });
    });
    rows.push({ [t("profitLoss.category")]: t("profitLoss.totalExpenses"), [t("profitLoss.amount")]: pnl.expenses.totalExpenses });
    rows.push({ [t("profitLoss.category")]: "", [t("profitLoss.amount")]: "" });
    rows.push({ [t("profitLoss.category")]: t("profitLoss.netProfit"), [t("profitLoss.amount")]: pnl.netProfit });
    rows.push({ [t("profitLoss.category")]: t("profitLoss.profitMargin"), [t("profitLoss.amount")]: `${pnl.profitMargin}%` });

    // Loaded on demand so the heavy xlsx bundle stays out of the page chunk.
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "P&L Report");
    XLSX.writeFile(wb, `profit-loss-${selectedYear}-${String(parseInt(selectedMonth) + 1).padStart(2, "0")}.xlsx`);
    toast.success(t("toast.excelDownloaded"));
  };

  const months = language === "ku"
    ? ["کانوونی دووەم", "شوبات", "ئادار", "نیسان", "ئایار", "حوزەیران", "تەممووز", "ئاب", "ئەیلوول", "تشرینی یەکەم", "تشرینی دووەم", "کانوونی یەکەم"]
    : ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const fmt = (v: number) => `$${v.toLocaleString()}`;
  const pct = (v: number, total: number) => total > 0 ? `${((v / total) * 100).toFixed(1)}%` : "0%";

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Hero Header */}
        <DashboardHero
          badge={t("profitLoss.title")}
          badgeIcon={<DollarSign className="h-5 w-5" />}
          title={t("profitLoss.title")}
          subtitle={t("profitLoss.subtitle")}
          actions={
            <>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[160px] border-white/20 bg-white/20 text-primary-foreground">
                  <Calendar className="h-4 w-4 me-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((m, i) => (
                    <SelectItem key={i} value={String(i)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[100px] border-white/20 bg-white/20 text-primary-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[currentYear - 2, currentYear - 1, currentYear].map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="secondary"
                className="gap-2 border-0 bg-white/20 text-primary-foreground hover:bg-white/30"
                onClick={handleExport}
              >
                <Download className="h-4 w-4" />
                Excel
              </Button>
            </>
          }
        />

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <FinancialCard
            title={t("profitLoss.totalRevenue")}
            value={pnl?.revenue.totalRevenue ?? 0}
            icon={<TrendingUp className="h-6 w-6" />}
            color="green"
            prefix="$"
          />
          <FinancialCard
            title={t("profitLoss.grossProfit")}
            value={pnl?.grossProfit ?? 0}
            icon={<DollarSign className="h-6 w-6" />}
            color="blue"
            prefix="$"
          />
          <FinancialCard
            title={t("profitLoss.totalExpenses")}
            value={pnl?.expenses.totalExpenses ?? 0}
            icon={<TrendingDown className="h-6 w-6" />}
            color="red"
            prefix="$"
            isDebt
          />
          <FinancialCard
            title={t("profitLoss.netProfit")}
            value={pnl?.netProfit ?? 0}
            icon={<Receipt className="h-6 w-6" />}
            color={(pnl?.netProfit ?? 0) >= 0 ? "green" : "red"}
            prefix="$"
            isDebt={(pnl?.netProfit ?? 0) < 0}
          />
          <FinancialCard
            title={t("profitLoss.profitMargin")}
            value={pnl?.profitMargin ?? 0}
            icon={<Percent className="h-6 w-6" />}
            color="purple"
            prefix=""
          />
        </div>

        {/* Revenue Breakdown */}
        <DashboardSection title={t("profitLoss.revenueBreakdown")}>
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Revenue Bar Chart */}
            <Card className="overflow-hidden border-0 shadow-lg">
              <CardHeader className="border-b bg-gradient-to-r from-muted/50 to-muted/30">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BarChart3 className="h-5 w-5 text-blue-500 dark:text-blue-400" />
                  {t("profitLoss.revenueBreakdown")}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <ChartContainer height="h-[280px]" isLoading={isLoading}>
                  {revenueChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={revenueChartData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v.toLocaleString()}`} />
                        <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 10 }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                          formatter={(value: number) => [`$${value.toLocaleString()}`, ""]}
                        />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                          {revenueChartData.map((entry, index) => (
                            <Cell key={index} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <ChartEmpty message={t("reports.noDataAvailable")} icon={<BarChart3 className="h-10 w-10" />} />
                  )}
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Revenue Pie Chart */}
            <Card className="overflow-hidden border-0 shadow-lg">
              <CardHeader className="border-b bg-gradient-to-r from-muted/50 to-muted/30">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <PieChartIcon className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
                  {t("profitLoss.revenueDistribution")}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <ChartContainer height="h-[280px]" isLoading={isLoading}>
                  {revenueChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={revenueChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={95}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {revenueChartData.map((entry, index) => (
                            <Cell key={index} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
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
        </DashboardSection>

        {/* P&L Statement Table */}
        <DashboardSection title={t("profitLoss.title")}>
          <Card className="overflow-hidden border-0 shadow-lg">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-6 py-3 text-start font-semibold">{t("profitLoss.category")}</th>
                      <th className="px-6 py-3 text-end font-semibold">{t("profitLoss.amount")}</th>
                      <th className="px-6 py-3 text-end font-semibold">{t("profitLoss.percentOfRevenue")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Revenue Section */}
                    <tr className="bg-green-50/50 dark:bg-green-950/20">
                      <td className="px-6 py-2.5 font-bold text-green-700 dark:text-green-400" colSpan={3}>
                        {t("profitLoss.revenue")}
                      </td>
                    </tr>
                    <tr className="border-b border-muted/30 hover:bg-muted/20">
                      <td className="px-6 py-2 ps-10">{t("profitLoss.packageShipping")}</td>
                      <td className="px-6 py-2 text-end font-medium text-green-600 dark:text-green-300">{fmt(pnl?.revenue.packageShipping ?? 0)}</td>
                      <td className="px-6 py-2 text-end text-muted-foreground">{pct(pnl?.revenue.packageShipping ?? 0, pnl?.revenue.totalRevenue ?? 0)}</td>
                    </tr>
                    <tr className="border-b border-muted/30 hover:bg-muted/20">
                      <td className="px-6 py-2 ps-10">{t("profitLoss.fullPackageProfit")}</td>
                      <td className="px-6 py-2 text-end font-medium text-green-600 dark:text-green-300">{fmt(pnl?.revenue.fullPackageProfit ?? 0)}</td>
                      <td className="px-6 py-2 text-end text-muted-foreground">{pct(pnl?.revenue.fullPackageProfit ?? 0, pnl?.revenue.totalRevenue ?? 0)}</td>
                    </tr>
                    <tr className="border-b border-muted/30 hover:bg-muted/20">
                      <td className="px-6 py-2 ps-10">{t("profitLoss.commissionProfit")}</td>
                      <td className="px-6 py-2 text-end font-medium text-green-600 dark:text-green-300">{fmt(pnl?.revenue.commissionProfit ?? 0)}</td>
                      <td className="px-6 py-2 text-end text-muted-foreground">{pct(pnl?.revenue.commissionProfit ?? 0, pnl?.revenue.totalRevenue ?? 0)}</td>
                    </tr>
                    <tr className="border-b border-muted/30 hover:bg-muted/20">
                      <td className="px-6 py-2 ps-10">{t("profitLoss.serviceRevenue")}</td>
                      <td className="px-6 py-2 text-end font-medium text-green-600 dark:text-green-300">{fmt(pnl?.revenue.serviceRevenue ?? 0)}</td>
                      <td className="px-6 py-2 text-end text-muted-foreground">{pct(pnl?.revenue.serviceRevenue ?? 0, pnl?.revenue.totalRevenue ?? 0)}</td>
                    </tr>
                    <tr className="border-y-2 border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-950/30">
                      <td className="px-6 py-2.5 font-bold">{t("profitLoss.totalRevenue")}</td>
                      <td className="px-6 py-2.5 text-end font-bold text-green-700 dark:text-green-400">{fmt(pnl?.revenue.totalRevenue ?? 0)}</td>
                      <td className="px-6 py-2.5 text-end font-bold">100%</td>
                    </tr>

                    {/* Spacer */}
                    <tr><td className="py-1" colSpan={3} /></tr>

                    {/* Cost of Revenue */}
                    <tr className="bg-orange-50/50 dark:bg-orange-950/20">
                      <td className="px-6 py-2.5 font-bold text-orange-700 dark:text-orange-400" colSpan={3}>
                        {t("profitLoss.costOfRevenue")}
                      </td>
                    </tr>
                    <tr className="border-b border-muted/30 hover:bg-muted/20">
                      <td className="px-6 py-2 ps-10">{t("profitLoss.fullPackageCost")}</td>
                      <td className="px-6 py-2 text-end font-medium text-orange-600 dark:text-orange-300">({fmt(pnl?.costOfRevenue.fullPackageCost ?? 0)})</td>
                      <td className="px-6 py-2 text-end text-muted-foreground">{pct(pnl?.costOfRevenue.fullPackageCost ?? 0, pnl?.revenue.totalRevenue ?? 0)}</td>
                    </tr>
                    <tr className="border-b border-muted/30 hover:bg-muted/20">
                      <td className="px-6 py-2 ps-10">{t("profitLoss.commissionCost")}</td>
                      <td className="px-6 py-2 text-end font-medium text-orange-600 dark:text-orange-300">({fmt(pnl?.costOfRevenue.commissionCost ?? 0)})</td>
                      <td className="px-6 py-2 text-end text-muted-foreground">{pct(pnl?.costOfRevenue.commissionCost ?? 0, pnl?.revenue.totalRevenue ?? 0)}</td>
                    </tr>
                    <tr className="border-b border-muted/30 hover:bg-muted/20">
                      <td className="px-6 py-2 ps-10">{t("profitLoss.serviceCost")}</td>
                      <td className="px-6 py-2 text-end font-medium text-orange-600 dark:text-orange-300">({fmt(pnl?.costOfRevenue.serviceCost ?? 0)})</td>
                      <td className="px-6 py-2 text-end text-muted-foreground">{pct(pnl?.costOfRevenue.serviceCost ?? 0, pnl?.revenue.totalRevenue ?? 0)}</td>
                    </tr>

                    {/* Gross Profit */}
                    <tr className="border-y-2 border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30">
                      <td className="px-6 py-2.5 font-bold">{t("profitLoss.grossProfit")}</td>
                      <td className="px-6 py-2.5 text-end font-bold text-blue-700 dark:text-blue-400">{fmt(pnl?.grossProfit ?? 0)}</td>
                      <td className="px-6 py-2.5 text-end font-bold">{pct(pnl?.grossProfit ?? 0, pnl?.revenue.totalRevenue ?? 0)}</td>
                    </tr>

                    {/* Spacer */}
                    <tr><td className="py-1" colSpan={3} /></tr>

                    {/* Operating Expenses */}
                    <tr className="bg-red-50/50 dark:bg-red-950/20">
                      <td className="px-6 py-2.5 font-bold text-red-700 dark:text-red-400" colSpan={3}>
                        {t("profitLoss.operatingExpenses")}
                      </td>
                    </tr>
                    {pnl?.expenses.byCategory.map((cat) => (
                      <tr key={cat.categoryId} className="border-b border-muted/30 hover:bg-muted/20">
                        <td className="px-6 py-2 ps-10">
                          {language === "ku" || language === "ar" ? cat.categoryNameKu : cat.categoryName}
                        </td>
                        <td className="px-6 py-2 text-end font-medium text-red-600 dark:text-red-300">({fmt(cat.total)})</td>
                        <td className="px-6 py-2 text-end text-muted-foreground">{pct(cat.total, pnl?.revenue.totalRevenue ?? 0)}</td>
                      </tr>
                    ))}
                    <tr className="border-y-2 border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30">
                      <td className="px-6 py-2.5 font-bold">{t("profitLoss.totalExpenses")}</td>
                      <td className="px-6 py-2.5 text-end font-bold text-red-700 dark:text-red-400">({fmt(pnl?.expenses.totalExpenses ?? 0)})</td>
                      <td className="px-6 py-2.5 text-end font-bold">{pct(pnl?.expenses.totalExpenses ?? 0, pnl?.revenue.totalRevenue ?? 0)}</td>
                    </tr>

                    {/* Spacer */}
                    <tr><td className="py-2" colSpan={3} /></tr>

                    {/* Net Profit */}
                    <tr className={`border-y-4 ${(pnl?.netProfit ?? 0) >= 0 ? "border-emerald-400 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/30" : "border-red-400 dark:border-red-700 bg-red-50 dark:bg-red-950/30"}`}>
                      <td className="px-6 py-3 text-base font-extrabold">{t("profitLoss.netProfit")}</td>
                      <td className={`px-6 py-3 text-end text-base font-extrabold ${(pnl?.netProfit ?? 0) >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
                        {(pnl?.netProfit ?? 0) >= 0 ? fmt(pnl?.netProfit ?? 0) : `(${fmt(Math.abs(pnl?.netProfit ?? 0))})`}
                      </td>
                      <td className="px-6 py-3 text-end text-base font-extrabold">{pct(Math.abs(pnl?.netProfit ?? 0), pnl?.revenue.totalRevenue ?? 0)}</td>
                    </tr>
                    <tr className="bg-muted/30">
                      <td className="px-6 py-2 font-semibold">{t("profitLoss.profitMargin")}</td>
                      <td className={`px-6 py-2 text-end font-bold ${(pnl?.profitMargin ?? 0) >= 0 ? "text-emerald-600 dark:text-emerald-300" : "text-red-600 dark:text-red-300"}`} colSpan={2}>
                        {pnl?.profitMargin ?? 0}%
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </DashboardSection>

        {/* Expense Breakdown */}
        <DashboardSection title={t("profitLoss.expenseBreakdown")}>
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Expense Bar Chart */}
            <Card className="overflow-hidden border-0 shadow-lg">
              <CardHeader className="border-b bg-gradient-to-r from-muted/50 to-muted/30">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BarChart3 className="h-5 w-5 text-red-500 dark:text-red-400" />
                  {t("profitLoss.expenseBreakdown")}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <ChartContainer height="h-[280px]" isLoading={isLoading}>
                  {expenseChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={expenseChartData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v.toLocaleString()}`} />
                        <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 10 }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                          formatter={(value: number) => [`$${value.toLocaleString()}`, ""]}
                        />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                          {expenseChartData.map((entry, index) => (
                            <Cell key={index} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <ChartEmpty message={t("reports.noDataAvailable")} icon={<BarChart3 className="h-10 w-10" />} />
                  )}
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Expense Pie Chart */}
            <Card className="overflow-hidden border-0 shadow-lg">
              <CardHeader className="border-b bg-gradient-to-r from-muted/50 to-muted/30">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <PieChartIcon className="h-5 w-5 text-orange-500 dark:text-orange-400" />
                  {t("profitLoss.expenseDistribution")}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <ChartContainer height="h-[280px]" isLoading={isLoading}>
                  {expenseChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={expenseChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={95}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {expenseChartData.map((entry, index) => (
                            <Cell key={index} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
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
        </DashboardSection>

        {/* Monthly Trend */}
        <DashboardSection title={t("profitLoss.monthlyTrend")}>
          <Card className="overflow-hidden border-0 shadow-lg">
            <CardContent className="p-4">
              <ChartContainer height="h-[320px]" isLoading={!monthlyTrend}>
                {trendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v.toLocaleString()}`} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                        formatter={(value: number) => [`$${value.toLocaleString()}`, ""]}
                      />
                      <Legend />
                      <Bar dataKey="revenue" name={t("profitLoss.revenue")} fill="#22c55e" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="expenses" name={t("profitLoss.operatingExpenses")} fill="#ef4444" radius={[4, 4, 0, 0]} />
                      <Line type="monotone" dataKey="profit" name={t("profitLoss.netProfit")} stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <ChartEmpty message={t("reports.noDataAvailable")} icon={<BarChart3 className="h-10 w-10" />} />
                )}
              </ChartContainer>
            </CardContent>
          </Card>
        </DashboardSection>

        {/* Key Metrics */}
        {metrics && pnl && (
          <DashboardSection title={t("profitLoss.ordersSummary")}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Best Revenue Source */}
              <Card className="border-0 shadow-lg overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-white">
                      <Trophy className="h-5 w-5" />
                    </div>
                    <span className="text-sm font-medium text-muted-foreground">{t("profitLoss.bestRevenueSource")}</span>
                  </div>
                  <p className="text-lg font-bold">{metrics.bestSource.name}</p>
                  <p className="text-sm text-green-600 dark:text-green-300 font-semibold">{fmt(metrics.bestSource.value)}</p>
                </CardContent>
              </Card>

              {/* Biggest Expense */}
              <Card className="border-0 shadow-lg overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-red-500 to-red-600 text-white">
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                    <span className="text-sm font-medium text-muted-foreground">{t("profitLoss.biggestExpense")}</span>
                  </div>
                  <p className="text-lg font-bold">
                    {metrics.biggestExpense
                      ? (language === "ku" || language === "ar" ? metrics.biggestExpense.categoryNameKu : metrics.biggestExpense.categoryName)
                      : "-"}
                  </p>
                  <p className="text-sm text-red-600 dark:text-red-300 font-semibold">
                    {metrics.biggestExpense ? fmt(metrics.biggestExpense.total) : "$0"}
                  </p>
                </CardContent>
              </Card>

              {/* Orders Summary */}
              <Card className="border-0 shadow-lg overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                      <ClipboardList className="h-5 w-5" />
                    </div>
                    <span className="text-sm font-medium text-muted-foreground">{t("profitLoss.ordersSummary")}</span>
                  </div>
                  <p className="text-2xl font-bold">{metrics.totalOrders}</p>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>{pnl.orderCounts.packages} {t("profitLoss.packageShipping")}</span>
                    <span>{pnl.orderCounts.fullPackage} FP</span>
                    <span>{pnl.orderCounts.commission} {t("profitLoss.commission")}</span>
                    <span>{pnl.orderCounts.services} {t("profitLoss.services")}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Profit Health */}
              <Card className="border-0 shadow-lg overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-white ${
                      metrics.health === "healthy" ? "from-green-500 to-green-600"
                        : metrics.health === "warning" ? "from-yellow-500 to-yellow-600"
                        : "from-red-500 to-red-600"
                    }`}>
                      <Activity className="h-5 w-5" />
                    </div>
                    <span className="text-sm font-medium text-muted-foreground">{t("profitLoss.profitHealth")}</span>
                  </div>
                  <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${
                    metrics.health === "healthy" ? "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400"
                      : metrics.health === "warning" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/50 dark:text-yellow-400"
                      : "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400"
                  }`}>
                    {metrics.health === "healthy" ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                    {t(`profitLoss.${metrics.health}`)}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{t("profitLoss.profitMargin")}: {pnl.profitMargin}%</p>
                </CardContent>
              </Card>
            </div>
          </DashboardSection>
        )}
      </div>
    </DashboardLayout>
  );
}
