import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "wouter";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Wallet,
  CreditCard,
  AlertTriangle,
  Receipt,
  FileText,
  BarChart3,
  PieChart as PieChartIcon,
  Users,
  ChevronRight,
  Sparkles,
  Landmark,
  Banknote,
  ArrowUpRight,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useMemo } from "react";

const REVENUE_COLOR = "#10b981";
const DEBT_COLOR = "#ef4444";

export default function AccountantDashboard() {
  const { t, language } = useLanguage();

  const { data: financialStats } = trpc.dashboard.financialStats.useQuery();
  const { data: revenueChart } = trpc.dashboard.revenueChart.useQuery({ days: 30 });
  const { data: topDebtors } = trpc.dashboard.topDebtors.useQuery({ limit: 20 });
  const { data: recentPayments } = trpc.ledger.getRecentPayments.useQuery({ limit: 20 });
  const { data: unpaidSummary } = trpc.ledger.getUnpaidInvoicesSummary.useQuery();
  const { data: balanceDist } = trpc.ledger.getBalanceDistribution.useQuery();

  const chartData = useMemo(
    () =>
      revenueChart?.map((d) => ({
        date: new Date(d.date).toLocaleDateString(language === "ku" ? "ar-IQ" : "en-US", { month: "short", day: "numeric" }),
        revenue: d.revenue,
      })) ?? [],
    [revenueChart, language]
  );

  const pieData = useMemo(() => {
    if (!balanceDist) return [];
    return [
      { name: t("accountantDashboard.debt"), value: balanceDist.debtCount, color: "#ef4444" },
      { name: t("accountantDashboard.credit"), value: balanceDist.creditCount, color: "#10b981" },
      { name: t("accountantDashboard.zeroBalance"), value: balanceDist.zeroCount, color: "#94a3b8" },
    ].filter((d) => d.value > 0);
  }, [balanceDist, t]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-purple-700 to-indigo-800 p-6 md:p-8 text-white">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMtOS45NDEgMC0xOCA4LjA1OS0xOCAxOHM4LjA1OSAxOCAxOCAxOCAxOC04LjA1OSAxOC0xOC04LjA1OS0xOC0xOC0xOHptMCAzMmMtNy43MzIgMC0xNC02LjI2OC0xNC0xNHM2LjI2OC0xNCAxNC0xNCAxNCA2LjI2OCAxNCAxNC02LjI2OCAxNC0xNCAxNHoiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iLjA1Ii8+PC9nPjwvc3ZnPg==')] opacity-30" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <Landmark className="h-5 w-5" />
              <span className="text-sm font-medium opacity-90">{t("common.appName")}</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">
              {t("accountantDashboard.title")}
            </h1>
            <p className="text-white/80 max-w-lg text-sm md:text-base">
              {t("accountantDashboard.welcome")}
            </p>
          </div>
        </div>

        {/* Financial overview cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t("accountantDashboard.totalRevenue")}</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    ${(financialStats?.monthRevenue ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-muted-foreground">{t("dashboard.thisMonth") ?? "This month"}</p>
                </div>
                <div className="h-11 w-11 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400">
                  <TrendingUp className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t("accountantDashboard.totalDebt")}</p>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                    ${(financialStats?.totalDebt ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="h-11 w-11 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400">
                  <AlertTriangle className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t("accountantDashboard.unpaidInvoices")}</p>
                  <p className="text-2xl font-bold">{(unpaidSummary?.unpaidInvoices ?? 0)}</p>
                  <p className="text-xs text-muted-foreground">
                    ${(unpaidSummary?.unpaidAmountUsd ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })} {t("accountantDashboard.total")}
                  </p>
                </div>
                <div className="h-11 w-11 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <FileText className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t("accountantDashboard.netProfit")}</p>
                  <p className="text-2xl font-bold">
                    ${((financialStats?.monthRevenue ?? 0) - (financialStats?.totalDebt ?? 0)).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-muted-foreground">{t("dashboard.thisMonth") ?? "This month"}</p>
                </div>
                <div className="h-11 w-11 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <Wallet className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick actions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              {t("accountantDashboard.quickActions")}
            </CardTitle>
            <CardDescription>{t("accountantDashboard.quickActionsDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              <Link href="/finance">
                <div className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:bg-accent/30 transition-colors cursor-pointer">
                  <Banknote className="h-8 w-8 text-green-600 dark:text-green-400" />
                  <div>
                    <p className="font-medium">{t("accountantDashboard.recordPayment")}</p>
                    <p className="text-xs text-muted-foreground">{t("accountantDashboard.recordPaymentDesc")}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground ml-auto" />
                </div>
              </Link>
              <Link href="/finance/debtors">
                <div className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:bg-accent/30 transition-colors cursor-pointer">
                  <Users className="h-8 w-8 text-red-600 dark:text-red-400" />
                  <div>
                    <p className="font-medium">{t("accountantDashboard.viewDebtors")}</p>
                    <p className="text-xs text-muted-foreground">{t("accountantDashboard.viewDebtorsDesc")}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground ml-auto" />
                </div>
              </Link>
              <Link href="/reports">
                <div className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:bg-accent/30 transition-colors cursor-pointer">
                  <FileText className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                  <div>
                    <p className="font-medium">{t("accountantDashboard.generateReport")}</p>
                    <p className="text-xs text-muted-foreground">{t("accountantDashboard.generateReportDesc")}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground ml-auto" />
                </div>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Revenue chart + Balance distribution */}
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                {t("accountantDashboard.revenueVsExpenses")}
              </CardTitle>
              <CardDescription>{t("accountantDashboard.revenueLast30Days")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                      <Tooltip formatter={(value: number) => [`$${Number(value).toFixed(2)}`, t("common.revenue")]} />
                      <Legend />
                      <Line type="monotone" dataKey="revenue" stroke={REVENUE_COLOR} strokeWidth={2} dot={false} name={t("common.revenue")} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    <p>{t("common.noData")}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <PieChartIcon className="h-5 w-5 text-primary" />
                {t("accountantDashboard.balanceDistribution")}
              </CardTitle>
              <CardDescription>{t("accountantDashboard.creditVsDebtVsZero")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[240px]">
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    <p>{t("common.noData")}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Debtors + Recent payments */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="overflow-hidden border-red-200/50 dark:border-red-800/30">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    {t("accountantDashboard.debtorsList")}
                  </CardTitle>
                  <CardDescription>{t("accountantDashboard.top20Debtors")}</CardDescription>
                </div>
                <Link href="/finance/debtors">
                  <Button variant="outline" size="sm">{t("common.all")}</Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y max-h-[360px] overflow-y-auto">
                {topDebtors?.slice(0, 20).map((d: { customerId: number; customerName: string; customerCode: string; debtUsd: number; lastPaymentDate: Date | null }, i: number) => (
                  <div key={d.customerId} className="flex items-center justify-between p-4 hover:bg-muted/50">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-sm font-medium text-muted-foreground w-6">#{i + 1}</span>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{d.customerName}</p>
                        <p className="text-xs text-muted-foreground">{d.customerCode}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold text-red-600 dark:text-red-400">${d.debtUsd.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.lastPaymentDate
                          ? new Date(d.lastPaymentDate).toLocaleDateString(language === "ku" ? "ar-IQ" : "en-US", { month: "short", day: "numeric" })
                          : t("dashboard.noPayment")}
                      </p>
                    </div>
                  </div>
                ))}
                {(!topDebtors || topDebtors.length === 0) && (
                  <div className="p-8 text-center text-muted-foreground">
                    <p>{t("dashboard.noDebtors")}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Receipt className="h-5 w-5 text-green-500" />
                    {t("accountantDashboard.recentPayments")}
                  </CardTitle>
                  <CardDescription>{t("accountantDashboard.last20Payments")}</CardDescription>
                </div>
                <Link href="/finance">
                  <Button variant="outline" size="sm">{t("common.all")}</Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y max-h-[360px] overflow-y-auto">
                {recentPayments?.map((p: { id: number; amountUsd: string | number; createdAt: Date; customerName?: string; customerCode?: string }) => (
                  <div key={p.id} className="flex items-center justify-between p-4 hover:bg-muted/50">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{p.customerName ?? t("common.unknown")}</p>
                      <p className="text-xs text-muted-foreground">{p.customerCode}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold text-green-600 dark:text-green-400">
                        ${Number(p.amountUsd).toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(p.createdAt).toLocaleString(language === "ku" ? "ar-IQ" : "en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                ))}
                {(!recentPayments || recentPayments.length === 0) && (
                  <div className="p-8 text-center text-muted-foreground">
                    <p>{t("common.noData")}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Monthly comparison */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              {t("accountantDashboard.monthlyComparison")}
            </CardTitle>
            <CardDescription>{t("accountantDashboard.thisMonthVsLast")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="p-4 rounded-xl border bg-muted/30">
                <p className="text-sm font-medium text-muted-foreground">{t("common.revenue")}</p>
                <p className="text-xl font-bold">${(financialStats?.monthRevenue ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
                <p className="text-xs flex items-center gap-1">
                  {(financialStats?.monthChange ?? 0) >= 0 ? (
                    <TrendingUp className="h-3 w-3 text-green-500" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-500" />
                  )}
                  {Math.abs(financialStats?.monthChange ?? 0)}% {t("accountantDashboard.vsLastMonth")}
                </p>
              </div>
              <div className="p-4 rounded-xl border bg-muted/30">
                <p className="text-sm font-medium text-muted-foreground">{t("dashboard.weeklyIncome")}</p>
                <p className="text-xl font-bold">${(financialStats?.weekRevenue ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="p-4 rounded-xl border bg-muted/30">
                <p className="text-sm font-medium text-muted-foreground">{t("dashboard.todayIncome")}</p>
                <p className="text-xl font-bold">${(financialStats?.todayRevenue ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
