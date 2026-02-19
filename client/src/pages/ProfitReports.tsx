import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  ShoppingBag,
  Percent,
  Calendar,
  BarChart3,
  ArrowUp,
  ArrowDown,
  Minus,
  FileText,
  Truck,
  Download,
  Printer,
  Wallet,
  AlertTriangle,
} from "lucide-react";
import * as XLSX from "xlsx";
import { useTranslation } from "@/contexts/LanguageContext";
import { formatCurrency, formatPercent } from "@/lib/format";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const CHART_COLORS = ["#10b981", "#8b5cf6", "#f59e0b"];
const MONTH_NAMES_KU = [
  "کانوونی دووەم", "شوبات", "ئازار", "نیسان", "ئایار", "حوزەیران",
  "تەممووز", "ئاب", "ئەیلوول", "تشرینی یەکەم", "تشرینی دووەم", "کانوونی یەکەم",
];
const MONTH_NAMES_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function ProfitReports() {
  const { t, language } = useTranslation();
  const isRTL = language === "ku" || language === "ar";
  const monthNames = language === "ku" ? MONTH_NAMES_KU : MONTH_NAMES_EN;

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedOrderType, setSelectedOrderType] = useState<string>("all");

  const { data: monthlyReport, isLoading: monthlyLoading } = trpc.fullPackage.getMonthlyProfitReport.useQuery({
    year: selectedYear,
  });
  const { data: profitByType, isLoading: typeLoading } = trpc.fullPackage.getProfitByOrderType.useQuery({});
  const { data: detailedReport, isLoading: detailedLoading } = trpc.fullPackage.getProfitReport.useQuery({
    orderType: selectedOrderType !== "all" ? (selectedOrderType as "full_package" | "commission") : undefined,
  });
  const { data: aggregatedData, isLoading: aggregatedLoading } = trpc.fullPackage.getAggregatedProfitAndExpenses.useQuery({
    year: selectedYear,
  });

  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const EXPENSE_RECOMMEND_PERCENT = 25;

  const chartData = useMemo(() => {
    if (!monthlyReport?.months?.length) return [];
    return monthlyReport.months.map((m) => ({
      name: monthNames[m.month - 1],
      profit: m.total.profit,
    }));
  }, [monthlyReport, monthNames]);

  const pieData = useMemo(() => {
    if (!profitByType) return [];
    return [
      { name: t("profitReport.fullPackage"), value: Math.max(0, profitByType.fullPackage?.totalProfit ?? 0), color: CHART_COLORS[0] },
      { name: t("profitReport.commission"), value: Math.max(0, profitByType.commission?.totalProfit ?? 0), color: CHART_COLORS[1] },
      { name: t("profitReport.package"), value: Math.max(0, profitByType.packages?.totalRevenue ?? 0), color: CHART_COLORS[2] },
    ].filter((d) => d.value > 0);
  }, [profitByType, t]);

  const exportToExcel = () => {
    if (!monthlyReport?.months?.length) return;
    const data = monthlyReport.months.map((m) => ({
      [t("profitReport.month")]: monthNames[m.month - 1],
      [t("profitReport.fullPackage")]: m.fullPackage.profit,
      [t("profitReport.commission")]: m.commission.profit,
      [t("profitReport.package")]: m.packages.revenue,
      [t("profitReport.totalProfit")]: m.total.profit,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, t("profitReport.title"));
    XLSX.writeFile(wb, `profit-report-${selectedYear}.xlsx`);
  };

  const handlePrint = () => window.print();

  const comparisonLabel = (monthIndex: number) => {
    if (!monthlyReport?.months?.length || monthIndex === 0) return null;
    const prev = monthlyReport.months[monthIndex - 1];
    if (prev.total.profit === 0) return "–";
    const curr = monthlyReport.months[monthIndex];
    const change = curr.total.profit - prev.total.profit;
    const pct = (change / Math.abs(prev.total.profit)) * 100;
    return formatPercent(pct);
  };

  const summary = monthlyReport?.yearSummary;
  const hasData = monthlyReport?.months?.some((m) => m.total.profit !== 0 || m.total.revenue !== 0);

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6" dir={isRTL ? "rtl" : "ltr"}>
        {/* Header */}
        <div className="bg-gradient-to-l from-violet-600 via-violet-700 to-indigo-800 rounded-2xl p-6 text-white shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <BarChart3 className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">{t("profitReport.title")}</h1>
                <p className="text-violet-100 mt-0.5">{t("profitReport.subtitle")}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={exportToExcel} variant="outline" size="sm" className="bg-white/15 border-white/30 text-white hover:bg-white/25">
                <Download className="h-4 w-4 ml-2 rtl:ml-0 rtl:mr-2" />
                {t("profitReport.excel")}
              </Button>
              <Button onClick={handlePrint} variant="outline" size="sm" className="bg-white/15 border-white/30 text-white hover:bg-white/25">
                <Printer className="h-4 w-4 ml-2 rtl:ml-0 rtl:mr-2" />
                {t("profitReport.pdf")}
              </Button>
              <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
                <SelectTrigger className="w-32 bg-white/15 border-white/30 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Executive Summary */}
        {summary && hasData && (
          <Card className="border-violet-200 bg-gradient-to-br from-violet-50/80 to-white dark:from-violet-950/20 dark:to-background">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-violet-600" />
                {t("profitReport.executiveSummary")}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {t("profitReport.summaryLine")
                .replace("{{year}}", String(selectedYear))
                .replace("{{profit}}", formatCurrency(summary.totalProfit))
                .replace("{{revenue}}", formatCurrency(summary.totalRevenue))}
              {summary.bestMonth && ` | ${t("profitReport.bestMonth")}: ${monthNames[summary.bestMonth.month - 1]} (${formatCurrency(summary.bestMonth.profit)})`}
              {summary.worstMonth && summary.worstMonth.month !== summary.bestMonth?.month && ` | ${t("profitReport.worstMonth")}: ${monthNames[summary.worstMonth.month - 1]} (${formatCurrency(summary.worstMonth.profit)})`}
            </CardContent>
          </Card>
        )}

        {/* KPI Cards */}
        {monthlyLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        ) : (
          monthlyReport && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="border-0 shadow-lg overflow-hidden transition-shadow hover:shadow-xl">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-emerald-600">{t("profitReport.totalProfit")}</p>
                      <p className="text-2xl font-bold text-emerald-700 tabular-nums">{formatCurrency(monthlyReport.yearSummary.totalProfit)}</p>
                    </div>
                    <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl">
                      <TrendingUp className="h-6 w-6 text-emerald-700 dark:text-emerald-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-lg overflow-hidden transition-shadow hover:shadow-xl">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-blue-600">{t("profitReport.totalRevenue")}</p>
                      <p className="text-2xl font-bold text-blue-700 tabular-nums">{formatCurrency(monthlyReport.yearSummary.totalRevenue)}</p>
                    </div>
                    <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                      <DollarSign className="h-6 w-6 text-blue-700 dark:text-blue-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-lg overflow-hidden transition-shadow hover:shadow-xl">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-orange-600">{t("profitReport.totalShipping")}</p>
                      <p className="text-2xl font-bold text-orange-700 tabular-nums">{formatCurrency(monthlyReport.yearSummary.totalShipping)}</p>
                    </div>
                    <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-xl">
                      <Truck className="h-6 w-6 text-orange-700 dark:text-orange-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-lg overflow-hidden transition-shadow hover:shadow-xl">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-purple-600">{t("profitReport.avgMonthly")}</p>
                      <p className="text-2xl font-bold text-purple-700 tabular-nums">{formatCurrency(monthlyReport.yearSummary.avgMonthlyProfit)}</p>
                    </div>
                    <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
                      <Calendar className="h-6 w-6 text-purple-700 dark:text-purple-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )
        )}

        {/* Tabs for different views */}
        <Tabs defaultValue="monthly" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-11 bg-muted/50 p-1 rounded-xl">
            <TabsTrigger value="monthly" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">{t("profitReport.monthlyTab")}</TabsTrigger>
            <TabsTrigger value="byType" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">{t("profitReport.byTypeTab")}</TabsTrigger>
            <TabsTrigger value="detailed" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">{t("profitReport.detailedTab")}</TabsTrigger>
            <TabsTrigger value="summaryExpense" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">{t("profitReport.summaryExpenseTab")}</TabsTrigger>
          </TabsList>

          <TabsContent value="monthly" className="space-y-4">
            {chartData.length > 0 && (
              <Card className="border-0 shadow-lg overflow-hidden">
                <CardHeader>
                  <CardTitle className="text-lg">{t("profitReport.monthlyTab")} — {selectedYear}</CardTitle>
                  <CardDescription>{t("profitReport.totalProfit")} {t("profitReport.month")}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 12, right: 12, left: 12, bottom: 12 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${Number(v).toLocaleString()}`} />
                        <Tooltip formatter={(v: number) => [formatCurrency(v), t("profitReport.profit")]} />
                        <Bar dataKey="profit" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} name={t("profitReport.profit")} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}
            <Card className="border-0 shadow-lg overflow-hidden">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  {t("profitReport.monthlyTab")} {selectedYear}
                </CardTitle>
                <CardDescription>{t("profitReport.totalProfit")} {t("profitReport.month")}</CardDescription>
              </CardHeader>
              <CardContent>
                {monthlyLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Skeleton key={i} className="h-14 w-full rounded-lg" />
                    ))}
                  </div>
                ) : !monthlyReport?.months?.length ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>{t("profitReport.noData")}</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                          <TableHead className="text-right font-semibold">{t("profitReport.month")}</TableHead>
                          <TableHead className="text-right font-semibold">{t("profitReport.fullPackage")}</TableHead>
                          <TableHead className="text-right font-semibold">{t("profitReport.commission")}</TableHead>
                          <TableHead className="text-right font-semibold">{t("profitReport.package")}</TableHead>
                          <TableHead className="text-right font-semibold">{t("profitReport.totalProfit")}</TableHead>
                          <TableHead className="text-right font-semibold">{t("profitReport.comparison")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {monthlyReport.months.map((month, idx) => {
                          const compLabel = comparisonLabel(idx);
                          const prevProfit = idx > 0 ? monthlyReport.months[idx - 1].total.profit : 0;
                          return (
                            <TableRow key={month.month} className="hover:bg-muted/30">
                              <TableCell className="font-medium">{monthNames[month.month - 1]}</TableCell>
                              <TableCell>
                                <div className="text-sm">
                                  <span className={`font-mono tabular-nums ${month.fullPackage.profit >= 0 ? "text-foreground" : "text-red-600"}`}>
                                    {formatCurrency(month.fullPackage.profit)}
                                  </span>
                                  <span className="text-muted-foreground text-xs ms-2">({month.fullPackage.count})</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="text-sm">
                                  <span className="font-mono tabular-nums">{formatCurrency(month.commission.profit)}</span>
                                  <span className="text-muted-foreground text-xs ms-2">({month.commission.count})</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="text-sm">
                                  <span className="font-mono tabular-nums">{formatCurrency(month.packages.revenue)}</span>
                                  <span className="text-muted-foreground text-xs ms-2">({month.packages.count})</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className={`font-mono font-bold tabular-nums ${month.total.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                                  {formatCurrency(month.total.profit)}
                                </span>
                              </TableCell>
                              <TableCell>
                                {compLabel === null ? (
                                  <span className="text-muted-foreground">–</span>
                                ) : compLabel === "–" ? (
                                  <span className="text-muted-foreground">–</span>
                                ) : (
                                  <div className="flex items-center gap-1">
                                    {month.comparison && month.comparison.profitChange > 0 && <ArrowUp className="h-4 w-4 text-green-500" />}
                                    {month.comparison && month.comparison.profitChange < 0 && <ArrowDown className="h-4 w-4 text-red-500" />}
                                    {month.comparison && month.comparison.profitChange === 0 && <Minus className="h-4 w-4 text-muted-foreground" />}
                                    <span className={`text-sm tabular-nums ${prevProfit === 0 ? "text-muted-foreground" : (month.comparison?.profitChange ?? 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
                                      {compLabel}
                                    </span>
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {summary?.bestMonth && summary?.worstMonth && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-green-200 dark:bg-green-800/50 rounded-xl">
                        <TrendingUp className="h-6 w-6 text-green-700 dark:text-green-300" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-green-600 dark:text-green-400">{t("profitReport.bestMonth")}</p>
                        <p className="text-lg font-bold text-green-800 dark:text-green-200">{monthNames[summary.bestMonth.month - 1]}</p>
                        <p className="text-xl font-mono font-bold text-green-900 dark:text-green-100 tabular-nums">{formatCurrency(summary.bestMonth.profit)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-red-200 dark:bg-red-800/50 rounded-xl">
                        <TrendingDown className="h-6 w-6 text-red-700 dark:text-red-300" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-red-600 dark:text-red-400">{t("profitReport.worstMonth")}</p>
                        <p className="text-lg font-bold text-red-800 dark:text-red-200">{monthNames[summary.worstMonth.month - 1]}</p>
                        <p className="text-xl font-mono font-bold text-red-900 dark:text-red-100 tabular-nums">{formatCurrency(summary.worstMonth.profit)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* By Type Tab */}
          <TabsContent value="byType" className="space-y-4">
            {pieData.length > 0 && (
              <Card className="border-0 shadow-lg overflow-hidden">
                <CardHeader>
                  <CardTitle className="text-lg">{t("profitReport.totalProfit")} — {t("profitReport.byTypeTab")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="value" label={({ name, value }) => `${name}: ${formatCurrency(value)}`}>
                          {pieData.map((_, i) => <Cell key={i} fill={pieData[i].color} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => formatCurrency(v)} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {typeLoading ? (
                [1,2,3,4].map(i => <Skeleton key={i} className="h-32" />)
              ) : (
                <>
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <ShoppingBag className="h-5 w-5 text-emerald-600" />
                        <CardTitle className="text-base">{t("profitReport.fullPackage")}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t("profitReport.ordersCount")}</span>
                          <span className="font-bold tabular-nums">{profitByType?.fullPackage.count ?? 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t("profitReport.totalProfit")}</span>
                          <span className="font-mono font-bold text-emerald-600 tabular-nums">
                            {formatCurrency(profitByType?.fullPackage.totalProfit ?? 0)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t("profitReport.avgMonthly")}</span>
                          <span className="font-mono">
                            {formatCurrency(profitByType?.fullPackage.avgProfit || 0)}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <Percent className="h-5 w-5 text-purple-600" />
                        <CardTitle className="text-base">{t("profitReport.commission")}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t("profitReport.ordersCount")}</span>
                          <span className="font-bold tabular-nums">{profitByType?.commission.count ?? 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t("profitReport.totalProfit")}</span>
                          <span className="font-mono font-bold text-purple-600 tabular-nums">
                            {formatCurrency(profitByType?.commission.totalProfit ?? 0)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t("profitReport.avgMonthly")}</span>
                          <span className="font-mono">
                            {formatCurrency(profitByType?.commission.avgProfit || 0)}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <Package className="h-5 w-5 text-orange-600" />
                        <CardTitle className="text-base">{t("profitReport.package")}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t("profitReport.ordersCount")}</span>
                          <span className="font-bold tabular-nums">{profitByType?.packages.count ?? 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t("profitReport.totalRevenue")}</span>
                          <span className="font-mono font-bold text-orange-600">
                            {formatCurrency(profitByType?.packages.totalRevenue || 0)}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          </TabsContent>

          {/* Detailed Tab */}
          <TabsContent value="detailed" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      {t("profitReport.detailedTab")}
                    </CardTitle>
                    <CardDescription>{t("profitReport.detailedDescription")}</CardDescription>
                  </div>
                  <Select value={selectedOrderType} onValueChange={setSelectedOrderType}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder={t("profitReport.type")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("profitReport.allTypes")}</SelectItem>
                      <SelectItem value="full_package">{t("profitReport.fullPackage")}</SelectItem>
                      <SelectItem value="commission">{t("profitReport.commission")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {detailedLoading ? (
                  <div className="space-y-3">
                    {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6 p-4 bg-muted/30 rounded-xl">
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">{t("profitReport.totalOrders")}</p>
                        <p className="text-xl font-bold tabular-nums">{detailedReport?.summary.totalOrders ?? 0}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">{t("profitReport.totalRevenue")}</p>
                        <p className="text-xl font-bold text-blue-600 tabular-nums">{formatCurrency(detailedReport?.summary.totalRevenue ?? 0)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">{t("profitReport.totalCost")}</p>
                        <p className="text-xl font-bold text-orange-600 tabular-nums">{formatCurrency(detailedReport?.summary.totalCost ?? 0)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">{t("profitReport.totalProfit")}</p>
                        <p className="text-xl font-bold text-green-600 tabular-nums">{formatCurrency(detailedReport?.summary.totalProfit ?? 0)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">{t("profitReport.profitMargin")}</p>
                        <p className="text-xl font-bold text-purple-600 tabular-nums">{detailedReport?.summary.avgProfitMargin?.toFixed(1) ?? 0}%</p>
                      </div>
                    </div>
                    <div className="overflow-x-auto rounded-lg border border-border">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead className="text-right font-semibold">{t("profitReport.orderCode")}</TableHead>
                            <TableHead className="text-right font-semibold">{t("profitReport.product")}</TableHead>
                            <TableHead className="text-right font-semibold">{t("profitReport.type")}</TableHead>
                            <TableHead className="text-right font-semibold">{t("profitReport.purchasePrice")}</TableHead>
                            <TableHead className="text-right font-semibold">{t("profitReport.sellingPrice")}</TableHead>
                            <TableHead className="text-right font-semibold">{t("profitReport.shipping")}</TableHead>
                            <TableHead className="text-right font-semibold">{t("profitReport.profit")}</TableHead>
                            <TableHead className="text-right font-semibold">{t("profitReport.margin")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {detailedReport?.orders.slice(0, 50).map((order) => (
                            <TableRow key={order.id} className="hover:bg-muted/20">
                              <TableCell className="font-mono text-sm">{order.orderCode}</TableCell>
                              <TableCell className="max-w-[200px] truncate">{order.productName}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">
                                  {order.orderType === "full_package" ? t("profitReport.fullPackage") : t("profitReport.commission")}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-mono tabular-nums">{formatCurrency(order.purchasePriceUsd)}</TableCell>
                              <TableCell className="font-mono text-emerald-600 tabular-nums">{formatCurrency(order.sellingPriceUsd)}</TableCell>
                              <TableCell className="font-mono text-orange-600 tabular-nums">{formatCurrency(order.shippingCostUsd)}</TableCell>
                              <TableCell className={`font-mono font-bold tabular-nums ${order.profitUsd >= 0 ? "text-green-600" : "text-red-600"}`}>
                                {formatCurrency(order.profitUsd)}
                              </TableCell>
                              <TableCell className="text-sm tabular-nums">{order.profitMargin.toFixed(1)}%</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {(detailedReport?.orders.length ?? 0) > 50 && (
                      <p className="text-center text-muted-foreground mt-4 text-sm">
                        {t("profitReport.showingFirst", { count: 50, total: detailedReport?.orders.length ?? 0 })}
                      </p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Total & Expenses Tab */}
          <TabsContent value="summaryExpense" className="space-y-4">
            {aggregatedLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Skeleton key={i} className="h-28 rounded-xl" />
                ))}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <ShoppingBag className="h-4 w-4 text-emerald-600" />
                        {t("profitReport.fullPackage")}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xl font-bold tabular-nums text-emerald-600">{formatCurrency(aggregatedData?.fullPackageProfit ?? 0)}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <Percent className="h-4 w-4 text-purple-600" />
                        {t("profitReport.commission")}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xl font-bold tabular-nums text-purple-600">{formatCurrency(aggregatedData?.commissionProfit ?? 0)}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <Package className="h-4 w-4 text-orange-600" />
                        {t("profitReport.packageNetProfitFromBatch")}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xl font-bold tabular-nums text-orange-600">{formatCurrency(aggregatedData?.packageNetProfitFromBatch ?? 0)}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-blue-600" />
                        {t("profitReport.serviceProfit")}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xl font-bold tabular-nums text-blue-600">{formatCurrency(aggregatedData?.serviceProfit ?? 0)}</p>
                    </CardContent>
                  </Card>
                </div>

                <Card className="border-0 shadow-lg bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-950/20 dark:to-indigo-950/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Wallet className="h-5 w-5" />
                      {t("profitReport.aggregatedProfit")} — {selectedYear}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold tabular-nums text-violet-700 dark:text-violet-300">{formatCurrency(aggregatedData?.totalProfit ?? 0)}</p>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="border-0 shadow-md">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">{t("profitReport.totalExpenses")}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold tabular-nums text-red-600">{formatCurrency(aggregatedData?.totalExpenses ?? 0)}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-0 shadow-md">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">{t("profitReport.netSurplus")}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className={`text-2xl font-bold tabular-nums ${(aggregatedData?.netSurplus ?? 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {formatCurrency(aggregatedData?.netSurplus ?? 0)}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {aggregatedData && aggregatedData.totalProfit > 0 && (
                  <Card className="border-0 shadow-md">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        {((aggregatedData?.totalExpenses ?? 0) > (aggregatedData?.totalProfit ?? 0) * (EXPENSE_RECOMMEND_PERCENT / 100)) ? (
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                        ) : null}
                        {t("profitReport.recommendedExpenseLimit", { percent: EXPENSE_RECOMMEND_PERCENT })}
                      </CardTitle>
                      <CardDescription>{t("profitReport.expenseRecommendationText", { percent: EXPENSE_RECOMMEND_PERCENT })}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        {t("profitReport.aggregatedProfit")}: {formatCurrency(aggregatedData.totalProfit)} → {t("profitReport.totalExpenses")}: {formatCurrency(aggregatedData.totalExpenses)}.
                        {aggregatedData.totalExpenses > aggregatedData.totalProfit * (EXPENSE_RECOMMEND_PERCENT / 100) && (
                          <span className="block mt-2 font-medium text-amber-600">{t("profitReport.expenseOverLimit")}</span>
                        )}
                      </p>
                    </CardContent>
                  </Card>
                )}

                <Card className="border-0 shadow-md overflow-hidden">
                  <CardHeader>
                    <CardTitle className="text-lg">{t("profitReport.expensesByCategory")}</CardTitle>
                    <CardDescription>{selectedYear}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {!aggregatedData?.expensesByCategory?.length ? (
                      <div className="py-8 text-center text-muted-foreground">
                        <p>{t("profitReport.noExpenses")}</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-lg border border-border">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/50">
                              <TableHead className="text-right font-semibold">{t("profitReport.category")}</TableHead>
                              <TableHead className="text-right font-semibold">{t("profitReport.amount")}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {aggregatedData.expensesByCategory.map((row) => (
                              <TableRow key={row.categoryId} className="hover:bg-muted/20">
                                <TableCell className="font-medium">{row.categoryName}</TableCell>
                                <TableCell className="font-mono tabular-nums text-red-600">{formatCurrency(row.amountUsd)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {aggregatedData && (aggregatedData.fullPackageProfit + aggregatedData.commissionProfit + (aggregatedData.packageNetProfitFromBatch ?? 0) + aggregatedData.serviceProfit) > 0 && (() => {
                  const summaryPieData = [
                    { name: t("profitReport.fullPackage"), value: Math.max(0, aggregatedData.fullPackageProfit), color: CHART_COLORS[0] },
                    { name: t("profitReport.commission"), value: Math.max(0, aggregatedData.commissionProfit), color: CHART_COLORS[1] },
                    { name: t("profitReport.packageNetProfitFromBatch"), value: Math.max(0, aggregatedData.packageNetProfitFromBatch ?? 0), color: CHART_COLORS[2] },
                    { name: t("profitReport.serviceProfit"), value: Math.max(0, aggregatedData.serviceProfit), color: "#3b82f6" },
                  ].filter((d) => d.value > 0);
                  return (
                    <Card className="border-0 shadow-lg overflow-hidden">
                      <CardHeader>
                        <CardTitle className="text-lg">{t("profitReport.aggregatedProfit")} — {t("profitReport.byTypeTab")}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={summaryPieData}
                                cx="50%"
                                cy="50%"
                                innerRadius={50}
                                outerRadius={80}
                                paddingAngle={2}
                                dataKey="value"
                                label={({ name, value }) => `${name}: ${formatCurrency(value)}`}
                              >
                                {summaryPieData.map((entry, i) => (
                                  <Cell key={i} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip formatter={(v: number) => formatCurrency(v)} />
                              <Legend />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })()}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
