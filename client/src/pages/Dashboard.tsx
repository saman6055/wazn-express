import { RegistrationsSummaryCard } from "@/components/dashboard/RegistrationsSummaryCard";
import DashboardLayout from "@/components/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  FinancialCard,
  StatsCard,
  ChartEmpty,
  DashboardSection,
} from "@/components/dashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ExplainableStat } from "@/components/dashboard/ExplainableStat";
import { TodayGlance } from "@/components/dashboard/TodayGlance";
import { StatusBadge } from "@/components/ui/status-badge";
import { trpc } from "@/lib/trpc";
import {
  Package,
  Users,
  Layers,
  DollarSign,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  AlertCircle,
  LayoutDashboard,
  Crown,
  CreditCard,
  BarChart3,
  Activity,
  Briefcase,
  Truck,
  AlertTriangle,
  Info,
  Calendar,
  Wallet,
  Ship,
  Plane,
  FileDown,
  Loader2,
  Sparkles,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { batchesAwaitingShippingNumber } from "@shared/batchReminders";
import { Button } from "@/components/ui/button";
import { useState, useMemo, memo, useEffect } from "react";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useTranslation } from "@/contexts/LanguageContext";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, Legend, ComposedChart, Area,
} from "recharts";

export default function Dashboard() {
  const { t, language } = useLanguage();
  const { user } = useAuth();

  // Time-of-day greeting for the dashboard header.
  const greetingHour = new Date().getHours();
  const greetingWord =
    greetingHour < 12
      ? { ku: "بەیانیت باش", en: "Good morning", ar: "صباح الخير", zh: "早上好" }
      : greetingHour < 17
        ? { ku: "ڕۆژباش", en: "Good afternoon", ar: "طاب يومك", zh: "下午好" }
        : { ku: "ئێوارەت باش", en: "Good evening", ar: "مساء الخير", zh: "晚上好" };
  const greetingName = ((user?.name as string) || "").trim();
  const greeting = `${pickLang(language, greetingWord)}${greetingName ? "، " + greetingName : ""}`;
  const [isExporting, setIsExporting] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [exportPeriod, setExportPeriod] = useState<'week' | 'month' | 'year'>('month');
  
  // PDF Export mutation (basic)
  const exportPDF = trpc.dashboard.exportPDF.useMutation({
    onSuccess: (data) => {
      // Convert base64 to blob and download
      const byteCharacters = atob(data.pdf);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = data.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success(t('dashboard.pdfDownloaded'));
      setIsExporting(false);
    },
    onError: (error) => {
      toast.error(t('dashboard.pdfError') + ': ' + error.message);
      setIsExporting(false);
    }
  });

  const handleExportPDF = () => {
    setIsExporting(true);
    exportPDF.mutate();
  };

  // Filtered PDF Export mutation
  const exportFilteredPDF = trpc.dashboard.exportFilteredPDF.useMutation({
    onSuccess: (data) => {
      const byteCharacters = atob(data.pdf);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = data.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success(t('dashboard.pdfDownloaded'));
      setIsExportDialogOpen(false);
    },
    onError: (error) => {
      toast.error(t('dashboard.pdfError') + ': ' + error.message);
    }
  });

  const handleFilteredExport = () => {
    exportFilteredPDF.mutate({ period: exportPeriod });
  };
  
  // Existing queries
  const [, setLocation] = useLocation();
  const { data: batchesForReminder } = trpc.batches.list.useQuery();
  const awaitingNumber = useMemo(
    () => batchesAwaitingShippingNumber(
      (Array.isArray(batchesForReminder) ? batchesForReminder : batchesForReminder?.data ?? []) as any[]
    ),
    [batchesForReminder]
  );
  const { data: packageStats } = trpc.reports.packagesByStatus.useQuery();
  const { data: customers } = trpc.customers.list.useQuery();
  const { data: topCustomers } = trpc.reports.topCustomers.useQuery({ limit: 10 });
  const { data: vipCustomers } = trpc.vip.list.useQuery();
  
  // New dashboard queries
  const { data: financialStats } = trpc.dashboard.financialStats.useQuery();
  const { data: revenueChart } = trpc.dashboard.revenueChart.useQuery({ days: 30 });
  const { data: profitLossChart } = trpc.dashboard.profitLossChart.useQuery({ days: 30 });
  const { data: activeBatches } = trpc.dashboard.activeBatches.useQuery();
  const { data: topDebtors } = trpc.dashboard.topDebtors.useQuery({ limit: 10 });
  const { data: recentActivity } = trpc.dashboard.recentActivity.useQuery({ limit: 8 });
  const { data: alerts } = trpc.dashboard.alerts.useQuery();
  const { data: highlights } = trpc.dashboard.weeklyHighlights.useQuery();
  const { data: selfOrders } = trpc.reports.selfOrderReport.useQuery({ days: 30 });
  const { data: newCustomersCount } = trpc.dashboard.newCustomers.useQuery({ days: 7 });

  const { totalPackages, deliveredPackages, inTransitPackages, activeCustomers, deliveryRate } = useMemo(() => {
    const total = packageStats?.reduce((sum: number, s: { count: number | string }) => sum + Number(s.count), 0) || 0;
    const delivered = Number(packageStats?.find((s: { status: string }) => s.status === "delivered")?.count || 0);
    const inTransit = Number(packageStats?.find((s: { status: string }) => s.status === "in_transit")?.count || 0);
    const active = customers?.filter(c => c.isActive).length || 0;
    const rate = total > 0 ? Math.round((delivered / total) * 100) : 0;
    return { totalPackages: total, deliveredPackages: delivered, inTransitPackages: inTransit, activeCustomers: active, deliveryRate: rate };
  }, [packageStats, customers]);

  const chartData = useMemo(
    () =>
      revenueChart?.map(d => ({
        date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        revenue: d.revenue,
        packages: d.packages
      })) || [],
    [revenueChart]
  );

  const profitLossChartData = useMemo(
    () =>
      profitLossChart?.map(d => ({
        date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        revenue: d.revenue,
        expenses: d.expenses,
        profit: d.profit,
      })) || [],
    [profitLossChart]
  );

  const periodTotals = useMemo(() => {
    if (!profitLossChart?.length) return { revenue: 0, expenses: 0, profit: 0 };
    return profitLossChart.reduce(
      (acc, d) => ({
        revenue: acc.revenue + d.revenue,
        expenses: acc.expenses + d.expenses,
        profit: acc.profit + d.profit,
      }),
      { revenue: 0, expenses: 0, profit: 0 }
    );
  }, [profitLossChart]);

  const shippingTypeData = useMemo(
    () => [
      { name: 'Air Regular', value: packageStats?.find((s: any) => s.status === 'in_transit')?.count || 30, color: '#3b82f6' },
      { name: 'Air Irregular', value: 15, color: '#f59e0b' },
      { name: 'Sea', value: 10, color: '#10b981' },
    ],
    [packageStats]
  );

  // Defer the heavy below-the-fold charts until the browser is idle, so the
  // first dashboard paint isn't blocked by Recharts. The DOM is identical once
  // shown — it just mounts a moment later.
  const [chartsReady, setChartsReady] = useState(false);
  useEffect(() => {
    const w = window as unknown as {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    let idle: number | undefined;
    let timer: number | undefined;
    if (w.requestIdleCallback) idle = w.requestIdleCallback(() => setChartsReady(true), { timeout: 1500 });
    else timer = window.setTimeout(() => setChartsReady(true), 250);
    return () => {
      if (idle !== undefined && w.cancelIdleCallback) w.cancelIdleCallback(idle);
      if (timer !== undefined) clearTimeout(timer);
    };
  }, []);

  return (
    <DashboardLayout>
      {/* Flex column + `order-last` on the chart sections pushes ALL charts to
          the very bottom while keeping the dense stat/alert/list cards on top
          for the most info-per-screen on a laptop — without relocating JSX. */}
      <div className="pro-page flex flex-col gap-5">
        <PageHeader
          icon={LayoutDashboard}
          title={t("dashboard.title")}
          subtitle={`${greeting} — ${t("dashboard.subtitle")}`}
          variant="gradient"
          actions={
            <>
              <Button
                onClick={handleExportPDF}
                disabled={isExporting}
                variant="secondary"
                className="gap-2 bg-white/20 hover:bg-white/30 text-primary-foreground border-0"
              >
                {isExporting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> {t("common.creating")}</>
                ) : (
                  <><FileDown className="h-4 w-4" /> {t("dashboard.dailyReport")}</>
                )}
              </Button>
              <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="secondary"
                    className="gap-2 bg-white/20 hover:bg-white/30 text-primary-foreground border-0"
                  >
                    <Calendar className="h-4 w-4" /> {t("dashboard.reportByDate")}
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>{t("dashboard.downloadReportByPeriod")}</DialogTitle>
                    <DialogDescription>{t("dashboard.selectPeriodForPDF")}</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">{t("dashboard.period")}</label>
                      <Select value={exportPeriod} onValueChange={(v: "week" | "month" | "year") => setExportPeriod(v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="week">{t("dashboard.last7Days")}</SelectItem>
                          <SelectItem value="month">{t("dashboard.last30Days")}</SelectItem>
                          <SelectItem value="year">{t("dashboard.last12Months")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      onClick={handleFilteredExport}
                      disabled={exportFilteredPDF.isPending}
                      className="w-full gap-2"
                    >
                      {exportFilteredPDF.isPending ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> {t("common.creating")}</>
                      ) : (
                        <><FileDown className="h-4 w-4" /> {t("dashboard.downloadReport")}</>
                      )}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          }
        />

        {/* Batches travelling without their waybill or container number.
            The Batches page already chases these; on the dashboard it is the
            first thing seen in the morning, which is when there is still time
            to go and ask for the number. Clicking one opens that batch. */}
        {awaitingNumber.length > 0 && (
          <Card className="border-amber-200 dark:border-amber-800/60 bg-amber-50/50 dark:bg-amber-950/40">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {t("batches.awaitingNumberTitle", { count: awaitingNumber.length })}
                  </p>
                  <p className="text-sm text-muted-foreground mb-3">
                    {t("batches.awaitingNumberDesc")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {awaitingNumber.slice(0, 6).map((batch: any) => (
                      <Button
                        key={batch.id}
                        size="sm"
                        variant={batch.severity === "urgent" ? "default" : "outline"}
                        className={batch.severity === "urgent" ? "bg-amber-600 hover:bg-amber-700" : ""}
                        onClick={() => setLocation(`/batches?edit=${batch.id}`)}
                      >
                        <span className="font-mono">{batch.batchCode}</span>
                        <Badge variant="secondary" className="ms-2">
                          {t("batches.daysWaiting", { count: batch.daysWaiting })}
                        </Badge>
                      </Button>
                    ))}
                    {awaitingNumber.length > 6 && (
                      <Button size="sm" variant="ghost" onClick={() => setLocation("/batches")}>
                        {t("batches.andMore", { count: awaitingNumber.length - 6 })}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Today at a glance — uses only data already on the page */}
        <TodayGlance
          items={[
            {
              icon: <DollarSign />,
              label: t("dashboard.todayIncome") || pickLang(language, { ku: "داهاتی ئەمڕۆ", en: "Today's income", ar: "دخل اليوم", zh: "今日收入" }),
              value: (
                <ExplainableStat figure="todayIncome" value={financialStats?.todayRevenue || 0}>
                  {`$${(financialStats?.todayRevenue || 0).toFixed(2)}`}
                </ExplainableStat>
              ),
            },
            {
              icon: <Users />,
              label: t("dashboard.newCustomers7Days") || pickLang(language, { ku: "کڕیاری نوێ (٧ ڕۆژ)", en: "New customers (7 days)", ar: "عملاء جدد (٧ أيام)", zh: "新客户（7天）" }),
              value: (
                <ExplainableStat figure="newCustomers" value={newCustomersCount ?? 0}>
                  {newCustomersCount ?? 0}
                </ExplainableStat>
              ),
            },
            {
              icon: <Users />,
              label: t("dashboard.totalCustomers") || pickLang(language, { ku: "کۆی کڕیاران", en: "Total customers", ar: "إجمالي العملاء", zh: "客户总数" }),
              value: (
                <ExplainableStat figure="totalCustomers" value={customers?.length ?? 0}>
                  {customers?.length ?? 0}
                </ExplainableStat>
              ),
            },
            {
              icon: <Layers />,
              label: t("dashboard.activeBatches") || pickLang(language, { ku: "باچە چالاکەکان", en: "Active batches", ar: "الدفعات النشطة", zh: "活跃批次" }),
              value: (
                <ExplainableStat figure="activeBatches" value={activeBatches?.length || 0}>
                  {activeBatches?.length || 0}
                </ExplainableStat>
              ),
            },
          ]}
        />

        {/* Today's intake at the scanner — sums and the busiest customers;
            the Registrations tab on /packages is where the rows get worked. */}
            <RegistrationsSummaryCard className="mb-4" />

        {/* Financial overview */}
        <DashboardSection className="pro-section" title={t("dashboard.financialOverview") || "Financial overview"}>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <FinancialCard
            title={t('dashboard.todayIncome')}
            value={financialStats?.todayRevenue || 0}
            figure="todayIncome"
            change={financialStats?.todayChange || 0}
            icon={<DollarSign className="h-5 w-5" />}
            color="green"
            prefix="$"
          />
          <FinancialCard
            title={t('dashboard.weeklyIncome')}
            value={financialStats?.weekRevenue || 0}
            figure="weekIncome"
            change={financialStats?.weekChange || 0}
            icon={<TrendingUp className="h-5 w-5" />}
            color="blue"
            prefix="$"
            trend={chartData.map(d => d.revenue)}
          />
          <FinancialCard
            title={t('dashboard.monthlyIncome')}
            value={financialStats?.monthRevenue || 0}
            figure="monthIncome"
            change={financialStats?.monthChange || 0}
            icon={<Wallet className="h-5 w-5" />}
            color="purple"
            prefix="$"
            trend={chartData.map(d => d.revenue)}
          />
          <FinancialCard
            title={t('dashboard.totalDebt')}
            value={financialStats?.totalDebt || 0}
            figure="totalDebt"
            icon={<CreditCard className="h-5 w-5" />}
            color="red"
            prefix="$"
            isDebt
          />
        </div>
        </DashboardSection>

        {/* Operational stats */}
        <DashboardSection className="pro-section">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title={t("dashboard.totalCustomers") ?? "Total Customers"}
            value={customers?.length ?? 0}
            figure="totalCustomers"
            description={t("dashboard.activeCustomers") ?? "Active customers"}
            icon={<Users className="h-5 w-5" />}
            color="emerald"
          />
          <StatsCard
            title={t("dashboard.totalPackages") ?? "Total Packages"}
            value={totalPackages}
            figure="totalPackages"
            description={t("dashboard.registeredToday")}
            icon={<Package className="h-5 w-5" />}
            color="blue"
            trend={chartData.map(d => d.packages)}
          />
          <StatsCard
            title={t("dashboard.activeBatches")}
            value={activeBatches?.length || 0}
            figure="activeBatches"
            description={t("dashboard.onRouteOrPreparing")}
            icon={<Layers className="h-5 w-5" />}
            color="amber"
          />
          <StatsCard
            title={t("dashboard.delivered")}
            value={deliveredPackages}
            figure="deliveredPackages"
            description={`${deliveryRate}% ${t("dashboard.deliveryRate")}`}
            icon={<CheckCircle className="h-5 w-5" />}
            color="green"
          />
          </div>
        </DashboardSection>

        {/* Revenue, Profit & Loss — داهات، قازانج و زیان (charts → bottom) */}
        {chartsReady && (
        <DashboardSection className="pro-section order-last"
          title={t("dashboard.revenueProfitLossTitle")}
          description={t("dashboard.revenueProfitLossDesc")}
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <FinancialCard
              title={t("dashboard.totalRevenueInPeriod")}
              value={periodTotals.revenue}
              icon={<DollarSign className="h-5 w-5" />}
              color="green"
              prefix="$"
              trend={profitLossChartData.map(d => d.revenue)}
            />
            <FinancialCard
              title={t("dashboard.totalExpensesInPeriod")}
              value={periodTotals.expenses}
              icon={<CreditCard className="h-5 w-5" />}
              color="red"
              prefix="$"
              isDebt
            />
            <FinancialCard
              title={t("dashboard.netProfitInPeriod")}
              value={Math.abs(periodTotals.profit)}
              icon={periodTotals.profit >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
              color={periodTotals.profit >= 0 ? "green" : "red"}
              prefix={periodTotals.profit >= 0 ? "$" : "-$"}
              isDebt={periodTotals.profit < 0}
            />
          </div>
          <Card className="pro-card overflow-hidden">
            <CardContent className="pro-card-body">
              <div className="h-[320px] min-h-0 w-full">
                {profitLossChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={profitLossChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => `$${v}`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                        formatter={(value: number, name: string) => [
                          `$${Number(value).toFixed(2)}`,
                          name === "revenue"
                            ? t("common.revenue")
                            : name === "expenses"
                              ? t("dashboard.totalExpensesInPeriod")
                              : t("dashboard.netProfitInPeriod"),
                        ]}
                      />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        fill="#10b981"
                        fillOpacity={0.3}
                        stroke="#10b981"
                        strokeWidth={2}
                        name={t("common.revenue")}
                      />
                      <Area
                        type="monotone"
                        dataKey="expenses"
                        fill="#ef4444"
                        fillOpacity={0.2}
                        stroke="#ef4444"
                        strokeWidth={2}
                        name={t("dashboard.totalExpensesInPeriod")}
                      />
                      <Line
                        type="monotone"
                        dataKey="profit"
                        stroke={periodTotals.profit >= 0 ? "#059669" : "#dc2626"}
                        strokeWidth={2}
                        dot={false}
                        name={t("dashboard.netProfitInPeriod")}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <ChartEmpty
                    message={t("common.noData")}
                    icon={<BarChart3 className="h-12 w-12" />}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </DashboardSection>
        )}

        {/* Alert Summary Section */}
        <AlertSummarySection />

        {/* Problems / action-needed alerts */}
        {alerts && alerts.length > 0 && (
          <DashboardSection
            className="pro-section"
            title={t("dashboard.problemsTitle") || pickLang(language, { ku: "مەشاکل و کارە پێویستەکان", en: "Problems & required actions", ar: "المشاكل والإجراءات المطلوبة", zh: "问题与待办事项" })}
            description={t("dashboard.problemsDesc") || pickLang(language, { ku: "ئەو شتانەی پێویستیان بە چاودێری یان کردارە", en: "Items that need attention or action", ar: "العناصر التي تحتاج إلى متابعة أو إجراء", zh: "需要关注或处理的事项" })}
          >
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {alerts.map((alert) => (
                <AlertCard key={alert.id} alert={alert} />
              ))}
            </div>
          </DashboardSection>
        )}

        {/* Wins / records this week */}
        {highlights && (
          <DashboardSection
            className="pro-section"
            title={t("dashboard.winsTitle") || pickLang(language, { ku: "سەرکەوتنەکانی ئەم هەفتەیە", en: "This week's wins", ar: "إنجازات هذا الأسبوع", zh: "本周成果" })}
            description={t("dashboard.winsDesc") || pickLang(language, { ku: "ریکۆرد و خاڵە ئەرێنییەکانی ئەم هەفتەیە", en: "Records and positive highlights this week", ar: "الأرقام القياسية والنقاط الإيجابية لهذا الأسبوع", zh: "本周的纪录与亮点" })}
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {/* Weekly profit */}
              <div className="relative rounded-xl border bg-card p-4 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                  <TrendingUp className="h-5 w-5" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">{pickLang(language, { ku: "قازانجی ئەم هەفتەیە", en: "This week's profit", ar: "ربح هذا الأسبوع", zh: "本周利润" })}</p>
                  <p className="text-xl font-bold">${(highlights.profit.thisWeekUsd || 0).toFixed(0)}</p>
                  {highlights.profit.deltaPct !== null && (
                    <p className={`text-xs ${highlights.profit.deltaPct >= 0 ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300"}`}>
                      {highlights.profit.deltaPct >= 0 ? "▲" : "▼"} {Math.abs(Math.round(highlights.profit.deltaPct))}% {pickLang(language, { ku: "بەراورد بە هەفتەی ڕابردوو", en: "vs. last week", ar: "مقارنة بالأسبوع الماضي", zh: "对比上周" })}
                    </p>
                  )}
                </div>
                {highlights.profit.isRecord && (
                  <Badge className="absolute top-2 end-2 gap-1 bg-amber-500 text-white hover:bg-amber-500">
                    <Sparkles className="h-3 w-3" /> {pickLang(language, { ku: "ریکۆردی نوێ!", en: "New record!", ar: "رقم قياسي جديد!", zh: "新纪录！" })}
                  </Badge>
                )}
              </div>

              {/* New customers */}
              <div className="rounded-xl border bg-card p-4 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                  <Users className="h-5 w-5" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">{pickLang(language, { ku: "کڕیاری نوێی ئەم هەفتەیە", en: "New customers this week", ar: "عملاء جدد هذا الأسبوع", zh: "本周新客户" })}</p>
                  <p className="text-xl font-bold">{highlights.newCustomers.thisWeek}</p>
                  <p className="text-xs text-muted-foreground">{pickLang(language, { ku: "هەفتەی ڕابردوو", en: "Last week", ar: "الأسبوع الماضي", zh: "上周" })}: {highlights.newCustomers.lastWeek}</p>
                </div>
              </div>

              {/* Orders */}
              <div className="rounded-xl border bg-card p-4 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                  <Package className="h-5 w-5" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">{pickLang(language, { ku: "ئۆردەری ئەم هەفتەیە", en: "Orders this week", ar: "طلبات هذا الأسبوع", zh: "本周订单" })}</p>
                  <p className="text-xl font-bold">{highlights.orders.thisWeek}</p>
                  <p className="text-xs text-muted-foreground">{pickLang(language, { ku: "هەفتەی ڕابردوو", en: "Last week", ar: "الأسبوع الماضي", zh: "上周" })}: {highlights.orders.lastWeek}</p>
                </div>
              </div>

              {/* Most active customer */}
              {highlights.topCustomer && (
                <div className="rounded-xl border bg-card p-4 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                    <Crown className="h-5 w-5" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">{pickLang(language, { ku: "ئاکتیفترین کڕیار", en: "Most active customer", ar: "العميل الأكثر نشاطًا", zh: "最活跃客户" })}</p>
                    <p className="text-base font-bold truncate">{highlights.topCustomer.name || highlights.topCustomer.code}</p>
                    <p className="text-xs text-muted-foreground">{highlights.topCustomer.orders} {pickLang(language, { ku: "ئۆردەر", en: "orders", ar: "طلبات", zh: "订单" })} · ${highlights.topCustomer.spentUsd.toFixed(0)}</p>
                  </div>
                </div>
              )}

              {/* Fastest batch */}
              {highlights.fastestBatch && (
                <div className="rounded-xl border bg-card p-4 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400">
                    <Ship className="h-5 w-5" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">{pickLang(language, { ku: "خێراترین باچ", en: "Fastest batch", ar: "أسرع دفعة", zh: "最快批次" })}</p>
                    <p className="text-base font-bold truncate font-mono">{highlights.fastestBatch.code}</p>
                    <p className="text-xs text-muted-foreground">{highlights.fastestBatch.days} {pickLang(language, { ku: "ڕۆژ لە ڕێگادا", en: "days in transit", ar: "أيام في الطريق", zh: "天在途" })}</p>
                  </div>
                </div>
              )}
            </div>
          </DashboardSection>
        )}

        {/* Self orders (shipping-only, customer-bought) — last 30 days */}
        {selfOrders && selfOrders.summary.count > 0 && (
          <DashboardSection
            className="pro-section"
            title={t("nav.selfOrders") || "سێلف ئۆردەر"}
            description={pickLang(language, { ku: "پاکێجی خۆکڕاو (تەنها گواستنەوە) — ٣٠ ڕۆژی ڕابردوو", en: "Self-bought packages (shipping only) — last 30 days", ar: "طرود اشتراها العميل (شحن فقط) — آخر ٣٠ يوماً", zh: "客户自购包裹（仅运输）— 最近 30 天" })}
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border bg-card p-4 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"><Package className="h-5 w-5" /></span>
                <div><p className="text-xs text-muted-foreground">{pickLang(language, { ku: "ژمارە", en: "Count", ar: "العدد", zh: "数量" })}</p><p className="text-xl font-bold">{selfOrders.summary.count}</p></div>
              </div>
              <div className="rounded-xl border bg-card p-4 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"><DollarSign className="h-5 w-5" /></span>
                <div><p className="text-xs text-muted-foreground">{pickLang(language, { ku: "داهات", en: "Revenue", ar: "الإيرادات", zh: "收入" })}</p><p className="text-xl font-bold">${selfOrders.summary.revenueUsd.toFixed(0)}</p></div>
              </div>
              <div className="rounded-xl border bg-card p-4 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400"><TrendingUp className="h-5 w-5" /></span>
                <div><p className="text-xs text-muted-foreground">{pickLang(language, { ku: "قازانج", en: "Profit", ar: "الربح", zh: "利润" })}</p><p className="text-xl font-bold text-teal-700 dark:text-teal-400">${selfOrders.summary.profitUsd.toFixed(0)}</p></div>
              </div>
              <Link href="/self-orders" className="rounded-xl border bg-card p-4 flex items-center justify-between gap-3 hover:bg-accent transition-colors">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{pickLang(language, { ku: "باشترین کڕیار", en: "Top customer", ar: "أفضل عميل", zh: "最佳客户" })}</p>
                  <p className="text-base font-bold truncate">{selfOrders.summary.topCustomers[0]?.name || selfOrders.summary.topCustomers[0]?.code || "—"}</p>
                </div>
                <Badge variant="secondary">{pickLang(language, { ku: "بینینی هەموو", en: "View all", ar: "عرض الكل", zh: "查看全部" })}</Badge>
              </Link>
            </div>
          </DashboardSection>
        )}

        {/* Analytics (charts → bottom) */}
        {chartsReady && (
        <DashboardSection className="pro-section order-last" title={t("dashboard.analytics") || "Analytics"} description={t("dashboard.revenueAndPackagesByDay")}>
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Revenue Chart - Last 30 days income (line) */}
          <Card className="pro-card lg:col-span-2 overflow-hidden">
            <CardHeader className="border-b bg-muted/30 pro-card-body py-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    {t('dashboard.revenueChart30Days')}
                  </CardTitle>
                  <CardDescription>{t('dashboard.revenueAndPackagesByDay')}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pro-card-body">
              <div className="h-[300px] min-h-0 w-full">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fontSize: 12 }} 
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis 
                        tick={{ fontSize: 12 }} 
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `$${value}`}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                        formatter={(value: number, name: string) => [
                          name === 'revenue' ? `$${value.toFixed(2)}` : value,
                          name === 'revenue' ? t('common.revenue') : t('common.package')
                        ]}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="revenue" 
                        stroke="#10b981" 
                        strokeWidth={2}
                        dot={false}
                        name={t('common.revenue')}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="packages" 
                        stroke="#3b82f6" 
                        strokeWidth={2}
                        dot={false}
                        name={t('common.package')}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <ChartEmpty message={t("common.noData")} icon={<BarChart3 className="h-12 w-12" />} />
                )}
              </div>
            </CardContent>
          </Card>
          {/* Package volume - packages per day (bar chart) */}
          <Card className="pro-card overflow-hidden">
            <CardHeader className="border-b bg-muted/30 pro-card-body py-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                {t('dashboard.packageVolume') ?? 'Package Volume'}
              </CardTitle>
              <CardDescription>{t('dashboard.packagesPerDay') ?? 'Packages per day (30 days)'}</CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              <div className="h-[250px]">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                      <Tooltip formatter={(value: number) => [value, t('common.package')]} />
                      <Bar dataKey="packages" fill="#3b82f6" radius={[4, 4, 0, 0]} name={t('common.package')} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <ChartEmpty message={t("common.noData")} icon={<Package className="h-10 w-10" />} />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Shipping Type Pie Chart */}
          <Card className="pro-card overflow-hidden">
            <CardHeader className="border-b bg-muted/30 pro-card-body py-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Truck className="h-5 w-5 text-primary" />
                {t('dashboard.shippingType')}
              </CardTitle>
              <CardDescription>{t('dashboard.packageDistribution')}</CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={shippingTypeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {shippingTypeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-4 mt-2">
                {shippingTypeData.map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-xs text-muted-foreground">{item.name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
        </DashboardSection>
        )}

        {/* Activity & Lists Row */}
        <div className="pro-section grid gap-6 lg:grid-cols-3">
          {/* Recent Activity Timeline */}
          <Card className="pro-card lg:col-span-2 overflow-hidden">
            <CardHeader className="border-b bg-muted/30 pro-card-body py-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Activity className="h-5 w-5 text-primary" />
                    {t('dashboard.recentActivities')}
                  </CardTitle>
                  <CardDescription>{t('dashboard.activityTimeline')}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y max-h-[400px] overflow-y-auto">
                {recentActivity?.map((activity, index) => (
                  <ActivityItem key={activity.id} activity={activity} isLast={index === (recentActivity?.length || 0) - 1} />
                ))}
                {(!recentActivity || recentActivity.length === 0) && (
                  <div className="p-8 text-center text-muted-foreground">
                    <Activity className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>{t('dashboard.noActivity')}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="pro-card overflow-hidden">
            <CardHeader className="border-b bg-muted/30 pro-card-body py-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                {t('dashboard.quickActions')}
              </CardTitle>
              <CardDescription>{t('dashboard.commonTasks')}</CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-3">
                <QuickActionButton
                  title={t('dashboard.quickActionRegisterPackage') ?? 'Register Package'}
                  icon={<Package className="h-5 w-5" />}
                  href="/packages/register"
                  color="emerald"
                />
                <QuickActionButton
                  title={t('dashboard.quickActionCreateBatch') ?? 'Create Batch'}
                  icon={<Layers className="h-5 w-5" />}
                  href="/batches"
                  color="amber"
                />
                <QuickActionButton
                  title={t('dashboard.quickActionRecordPayment') ?? 'Record Payment'}
                  icon={<CreditCard className="h-5 w-5" />}
                  href="/finance"
                  color="green"
                />
                <QuickActionButton
                  title={t('nav.scan')}
                  icon={<Package className="h-5 w-5" />}
                  href="/scan-dashboard"
                  color="blue"
                />
                <QuickActionButton
                  title={t('common.customer')}
                  icon={<Users className="h-5 w-5" />}
                  href="/customers"
                  color="purple"
                />
                <QuickActionButton
                  title={t('nav.reports')}
                  icon={<BarChart3 className="h-5 w-5" />}
                  href="/reports"
                  color="red"
                />
                <QuickActionButton
                  title={t('nav.fullPackage')}
                  icon={<Briefcase className="h-5 w-5" />}
                  href="/full-package"
                  color="indigo"
                />
                <QuickActionButton
                  title={t('nav.settings')}
                  icon={<Activity className="h-5 w-5" />}
                  href="/settings"
                  color="slate"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bottom Row - Overdue debt alerts & Active Batches */}
        <div className="pro-section grid gap-6 lg:grid-cols-2">
          {/* Overdue debt alerts - customers with balance due */}
          <Card className="pro-card overflow-hidden ring-1 ring-red-200/50 dark:ring-red-800/30">
            <CardHeader className="border-b bg-red-50/50 dark:bg-red-950/20 pro-card-body py-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-500 dark:text-red-400" />
                    {t('dashboard.overdueDebtAlerts') ?? 'Overdue debt alerts'}
                  </CardTitle>
                  <CardDescription>{t('dashboard.customersWithHighDebt')}</CardDescription>
                </div>
                <Link href="/finance/debtors">
                  <Badge variant="outline" className="cursor-pointer hover:bg-accent transition-colors">
                    {t('common.all')}
                  </Badge>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {topDebtors?.map((debtor, index) => (
                  <div key={debtor.customerId} className="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm
                      ${index === 0 ? 'bg-gradient-to-br from-red-500 to-red-600 text-white' : 
                        index === 1 ? 'bg-gradient-to-br from-orange-400 to-orange-500 text-white' :
                        'bg-muted text-muted-foreground'}`}>
                      #{index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{debtor.customerName}</p>
                      <p className="text-sm text-muted-foreground">{debtor.customerCode}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-red-600 dark:text-red-400">
                        ${debtor.debtUsd.toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {debtor.lastPaymentDate 
                          ? new Date(debtor.lastPaymentDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                          : t('dashboard.noPayment')}
                      </p>
                    </div>
                  </div>
                ))}
                {(!topDebtors || topDebtors.length === 0) && (
                  <div className="p-8 text-center text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mx-auto mb-3 opacity-30 text-green-500 dark:text-green-400" />
                    <p>{t('dashboard.noDebtors')}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Active Batches */}
          <Card className="pro-card overflow-hidden">
            <CardHeader className="border-b bg-blue-50/50 dark:bg-blue-950/20 pro-card-body py-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Truck className="h-5 w-5 text-blue-500 dark:text-blue-400" />
                    {t('dashboard.activeBatchesList')}
                  </CardTitle>
                  <CardDescription>{t('dashboard.batchesOnRoute')}</CardDescription>
                </div>
                <Link href="/batches">
                  <Badge variant="outline" className="cursor-pointer hover:bg-accent transition-colors">
                    {t('common.all')}
                  </Badge>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {activeBatches?.map((batch) => (
                  <div key={batch.id} className="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center
                      ${batch.shippingType === 'sea' 
                        ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' 
                        : 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                      {batch.shippingType === 'sea' ? <Ship className="h-5 w-5" /> : <Plane className="h-5 w-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{batch.batchCode}</p>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={batch.status} kind="batch" />
                        <span className="text-xs text-muted-foreground">
                          {batch.packageCount} {t('common.package')}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{batch.totalWeight.toFixed(1)} kg</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(batch.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                  </div>
                ))}
                {(!activeBatches || activeBatches.length === 0) && (
                  <div className="p-8 text-center text-muted-foreground">
                    <Truck className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>{t('dashboard.noActiveBatches')}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top Customers & VIP Section */}
        <div className="pro-section grid gap-6 lg:grid-cols-2">
          {/* Top Customers */}
          <Card className="pro-card overflow-hidden">
            <CardHeader className="border-b bg-amber-50/50 dark:bg-amber-950/20 pro-card-body py-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Crown className="h-5 w-5 text-amber-500 dark:text-amber-400" />
                    {t('dashboard.topCustomers')}
                  </CardTitle>
                  <CardDescription>{t('dashboard.byRevenue')}</CardDescription>
                </div>
                <Link href="/customers">
                  <Badge variant="outline" className="cursor-pointer hover:bg-accent transition-colors">
                    {t('common.all')}
                  </Badge>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {topCustomers?.slice(0, 10).map((customer: { customerId: number; totalCharges: string | number; packageCount: number }, index: number) => {
                  const customerData = customers?.find(c => c.id === customer.customerId);
                  const isVip = vipCustomers?.some(v => v.customerId === customer.customerId);
                  return (
                    <div key={customer.customerId} className="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm
                        ${index === 0 ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-200 dark:shadow-amber-900/30' : 
                          index === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-400 text-slate-700 dark:from-slate-600 dark:to-slate-700 dark:text-slate-200' :
                          index === 2 ? 'bg-gradient-to-br from-orange-300 to-orange-400 text-orange-800 dark:text-orange-200' :
                          'bg-muted text-muted-foreground'}`}>
                        #{index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{customerData?.fullName || `Customer #${customer.customerId}`}</p>
                          {isVip && (
                            <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs border-0">{t("customers.stats.vip")}</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{customer.packageCount} {t('common.package')}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-green-600 dark:text-green-400">
                          ${Number(customer.totalCharges || 0).toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground">{t('common.revenue')}</p>
                      </div>
                    </div>
                  );
                })}
                {(!topCustomers || topCustomers.length === 0) && (
                  <div className="p-8 text-center text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>{t('dashboard.noCustomerData')}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Package Status Overview */}
          <Card className="pro-card overflow-hidden">
            <CardHeader className="border-b bg-muted/30 pro-card-body py-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Package className="h-5 w-5 text-primary" />
                    {t('dashboard.packageStatus')}
                  </CardTitle>
                  <CardDescription>{t('dashboard.distributionByStatus')}</CardDescription>
                </div>
                <Badge variant="secondary" className="font-mono text-sm px-3 py-1">
                  {deliveryRate}% {t('dashboard.delivered')}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-3">
                {packageStats?.map((stat: { status: string; count: number | string }) => (
                  <StatusBar key={stat.status} status={stat.status} count={Number(stat.count)} total={totalPackages} />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

// Alert Card Component
const AlertCard = memo(function AlertCard({ alert }: { alert: { id: string; type: string; title: string; description: string; count?: number; link?: string } }) {
  const typeStyles = {
    warning: {
      card: "from-amber-50 to-orange-50/50 dark:from-amber-950/30 dark:to-orange-950/20 border-amber-200/70 dark:border-amber-800/50",
      chip: "from-amber-400 to-orange-500",
      badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
      Icon: AlertTriangle,
    },
    info: {
      card: "from-sky-50 to-blue-50/50 dark:from-sky-950/30 dark:to-blue-950/20 border-sky-200/70 dark:border-sky-800/50",
      chip: "from-sky-400 to-blue-600",
      badge: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
      Icon: Info,
    },
    error: {
      card: "from-rose-50 to-red-50/50 dark:from-rose-950/30 dark:to-red-950/20 border-rose-200/70 dark:border-rose-800/50",
      chip: "from-rose-400 to-red-600",
      badge: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
      Icon: AlertCircle,
    },
    success: {
      card: "from-violet-50 to-purple-50/50 dark:from-violet-950/30 dark:to-purple-950/20 border-violet-200/70 dark:border-violet-800/50",
      chip: "from-violet-400 to-purple-600",
      badge: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
      Icon: CheckCircle,
    },
  };

  const style = typeStyles[alert.type as keyof typeof typeStyles] || typeStyles.info;
  const Icon = style.Icon;

  const content = (
    <div
      className={`group p-4 rounded-2xl border bg-gradient-to-br ${style.card} hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${style.chip} text-white shadow-sm transition-transform duration-200 group-hover:scale-105`}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-foreground">{alert.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{alert.description}</p>
        </div>
        {alert.count != null && (
          <span className={`shrink-0 rounded-lg px-2.5 py-1 text-sm font-bold tabular-nums ${style.badge}`}>
            {alert.count}
          </span>
        )}
      </div>
    </div>
  );

  return alert.link ? <Link href={alert.link}>{content}</Link> : content;
});

// Activity Item Component
function ActivityItem({ activity, isLast }: { activity: { id: string; type: string; title: string; description: string; timestamp: Date; icon: string; color: string }; isLast: boolean }) {
  const iconMap: Record<string, React.ReactNode> = {
    Package: <Package className="h-4 w-4" />,
    DollarSign: <DollarSign className="h-4 w-4" />,
    User: <Users className="h-4 w-4" />,
    CheckCircle: <CheckCircle className="h-4 w-4" />,
  };

  const colorStyles: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    green: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
    emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
  };

  return (
    <div className="flex gap-4 p-4 hover:bg-muted/50 transition-colors">
      <div className="flex flex-col items-center">
        <div className={`h-9 w-9 rounded-full flex items-center justify-center ${colorStyles[activity.color] || colorStyles.blue}`}>
          {iconMap[activity.icon] || <Activity className="h-4 w-4" />}
        </div>
        {!isLast && <div className="w-0.5 flex-1 bg-border mt-2" />}
      </div>
      <div className="flex-1 min-w-0 pb-2">
        <p className="font-medium text-sm">{activity.title}</p>
        <p className="text-sm text-muted-foreground">{activity.description}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {new Date(activity.timestamp).toLocaleString('en-US', { 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </p>
      </div>
    </div>
  );
}

// Quick Action Button
function QuickActionButton({ 
  title, 
  icon, 
  href,
  color
}: { 
  title: string; 
  icon: React.ReactNode; 
  href: string;
  color: string;
}) {
  const colorStyles: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 group-hover:bg-blue-200',
    emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 group-hover:bg-emerald-200',
    purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 group-hover:bg-purple-200',
    amber: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 group-hover:bg-amber-200',
    green: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400 group-hover:bg-green-200',
    red: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 group-hover:bg-red-200',
    indigo: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 group-hover:bg-indigo-200',
    slate: 'bg-slate-100 text-slate-600 dark:bg-slate-900/30 dark:text-slate-400 group-hover:bg-slate-200',
  };

  return (
    <Link href={href}>
      <div className="p-4 rounded-xl border bg-card hover:bg-accent/30 hover:shadow-md hover:border-primary/20 transition-all cursor-pointer group text-center">
        <div className={`h-12 w-12 rounded-xl flex items-center justify-center mx-auto mb-2 transition-all ${colorStyles[color]}`}>
          {icon}
        </div>
        <p className="text-sm font-medium">{title}</p>
      </div>
    </Link>
  );
}

// Status Bar Component
const StatusBar = memo(function StatusBar({ status, count, total }: { status: string; count: number; total: number }) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
  
  const statusConfig: Record<string, { color: string; bg: string }> = {
    delivered: { color: 'bg-green-500', bg: 'bg-green-100 dark:bg-green-900/30' },
    in_transit: { color: 'bg-amber-500', bg: 'bg-amber-100 dark:bg-amber-900/30' },
    customs_processing: { color: 'bg-purple-500', bg: 'bg-purple-100 dark:bg-purple-900/30' },
    registered: { color: 'bg-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30' },
    cancelled: { color: 'bg-red-500', bg: 'bg-red-100 dark:bg-red-900/30' },
    arrived: { color: 'bg-teal-500', bg: 'bg-teal-100 dark:bg-teal-900/30' },
  };

  const config = statusConfig[status] || statusConfig.registered;

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium w-32 capitalize truncate">{status.replace(/_/g, ' ')}</span>
      <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-700 ${config.color}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-sm font-medium w-12 text-right">{count}</span>
      <span className="text-xs text-muted-foreground w-10 text-right">{percentage}%</span>
    </div>
  );
});

// Alert Summary Section Component
function AlertSummarySection() {
  const { t } = useTranslation();
  const { data: packagesResponse } = trpc.packages.list.useQuery({ pageSize: 500 });
  const packages = packagesResponse?.data;
  const { data: batchesResponse } = trpc.batches.list.useQuery();
  const batchList = Array.isArray(batchesResponse) ? batchesResponse : batchesResponse?.data;

  // Calculate package alerts
  const packageAlerts = packages?.reduce((acc, pkg) => {
    const registeredAt = new Date(pkg.createdAt);
    const now = new Date();
    const daysSince = Math.floor((now.getTime() - registeredAt.getTime()) / (1000 * 60 * 60 * 24));
    const isDelivered = pkg.status === "delivered" || pkg.status === "cancelled" || pkg.status === "returned";
    
    if (isDelivered) {
      acc.normal++;
    } else if (daysSince > 20) {
      acc.highRisk++;
    } else if (daysSince > 10) {
      acc.warning++;
    } else {
      acc.normal++;
    }
    return acc;
  }, { normal: 0, warning: 0, highRisk: 0 }) || { normal: 0, warning: 0, highRisk: 0 };

  // Calculate batch alerts
  const batchAlerts = batchList?.reduce((acc, batch) => {
    const isCompleted = batch.status === "arrived" || batch.status === "delivered" || batch.status === "closed";
    if (isCompleted) {
      acc.normal++;
      return acc;
    }
    
    if (batch.estimatedArrival) {
      const eta = new Date(batch.estimatedArrival);
      const now = new Date();
      const daysOverdue = Math.floor((now.getTime() - eta.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysOverdue > 5) {
        acc.highRisk++;
      } else if (daysOverdue > 0) {
        acc.warning++;
      } else {
        acc.normal++;
      }
    } else if (batch.departureDate) {
      const departure = new Date(batch.departureDate);
      const now = new Date();
      const daysSince = Math.floor((now.getTime() - departure.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysSince > 30) {
        acc.highRisk++;
      } else if (daysSince > 15) {
        acc.warning++;
      } else {
        acc.normal++;
      }
    } else {
      acc.normal++;
    }
    return acc;
  }, { normal: 0, warning: 0, highRisk: 0 }) || { normal: 0, warning: 0, highRisk: 0 };

  const totalHighRisk = packageAlerts.highRisk + batchAlerts.highRisk;
  const totalWarning = packageAlerts.warning + batchAlerts.warning;

  if (totalHighRisk === 0 && totalWarning === 0) {
    return null;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {packageAlerts.highRisk > 0 && (
        <Link href="/packages/all">
          <Card className="border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900 hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
                  <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400 animate-pulse" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-700 dark:text-red-400">{packageAlerts.highRisk}</p>
                  <p className="text-sm text-red-600 dark:text-red-400">{t('dashboard.highRiskPackages')} 🔴</p>
                  <p className="text-xs text-red-500 dark:text-red-400">{t('dashboard.moreThan20Days')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      )}
      
      {packageAlerts.warning > 0 && (
        <Link href="/packages/all">
          <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900 hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                  <AlertCircle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{packageAlerts.warning}</p>
                  <p className="text-sm text-amber-600 dark:text-amber-400">{t('dashboard.warningPackages')} ⚠️</p>
                  <p className="text-xs text-amber-500 dark:text-amber-400">{t('dashboard.10to20Days')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      )}
      
      {batchAlerts.highRisk > 0 && (
        <Link href="/batches">
          <Card className="border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900 hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
                  <Ship className="h-6 w-6 text-red-600 dark:text-red-400 animate-pulse" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-700 dark:text-red-400">{batchAlerts.highRisk}</p>
                  <p className="text-sm text-red-600 dark:text-red-400">{t('dashboard.highRiskBatches')} 🔴</p>
                  <p className="text-xs text-red-500 dark:text-red-400">{t('dashboard.veryOverdue')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      )}
      
      {batchAlerts.warning > 0 && (
        <Link href="/batches">
          <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900 hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                  <Plane className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{batchAlerts.warning}</p>
                  <p className="text-sm text-amber-600 dark:text-amber-400">{t('dashboard.warningBatches')} ⚠️</p>
                  <p className="text-xs text-amber-500 dark:text-amber-400">{t('dashboard.nearETA')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      )}
    </div>
  );
}
