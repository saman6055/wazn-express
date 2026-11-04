import { statusDot, statusTone, TONE_BG } from "@/lib/statusTone";
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
import { batchesHref, customersHref, packagesHref } from "@shared/listLinks";
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
  ExternalLink,
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
import { CopyButton } from "@/components/CopyButton";
import { PACKAGE_STATUS_LABEL, PACKAGE_STAGE_GROUPS } from "@/lib/packageStatus";
import { SHIPPING_TYPE_LABEL } from "@/lib/shipmentFilters";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { batchesAwaitingShippingNumber } from "@shared/batchReminders";
import { DailyBrief } from "@/components/DailyBrief";
import { StaleDepotCard } from "@/components/registrations/StaleDepotCard";
import { VolumetricWatchCard } from "@/components/registrations/VolumetricWatchCard";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { useState, useMemo, memo, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { fmtDate } from "@/lib/numericDate";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { MobileQuickActions } from "@/components/mobile/MobileAppShell";
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
import { soundManager } from "@/lib/soundManager";
import { CarrierSummaryCard } from "@/components/dashboard/CarrierSummaryCard";
import { customerCodeOnly } from "@shared/customerCode";
import "./dashboardLive.css";
import { useTranslation } from "@/contexts/LanguageContext";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, Legend, ComposedChart, Area,
} from "recharts";

export default function Dashboard() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { canViewPath } = usePermissions();

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
  // Carries the real by-shipping-type breakdown the pie below needs.
  const { data: parcelStats } = trpc.packages.stats.useQuery();
  const { data: customerCounts } = trpc.dashboard.customerCounts.useQuery();
  const { data: topCustomers } = trpc.reports.topCustomers.useQuery({ limit: 10 });
  const { data: vipCustomers } = trpc.vip.list.useQuery();
  
  // New dashboard queries
  const { data: financialStats } = trpc.dashboard.financialStats.useQuery();
  const { data: revenueChart } = trpc.dashboard.revenueChart.useQuery({ days: 30 });
  const { data: profitLossChart } = trpc.dashboard.profitLossChart.useQuery({ days: 30 });
  const { data: activeBatches } = trpc.dashboard.activeBatches.useQuery();
  // All of them, not the length of the five-row list (audit 2026-11-05).
  const { data: activeBatchCount } = trpc.dashboard.activeBatchCount.useQuery();
  const { data: topDebtors } = trpc.dashboard.topDebtors.useQuery({ limit: 10 });
  const { data: recentActivity } = trpc.dashboard.recentActivity.useQuery({ limit: 8 });
  const { data: alerts } = trpc.dashboard.alerts.useQuery();
  /*
   * A box fault to register now rings its own chime, once a visit (owner,
   * 2026-11-05: «زەنگێکی جیاوازی هەبێ … ئادمین وشیار بێتەوە بچێت تۆماری
   * بکات»). The bell's usual sound is for everything else.
   */
  const urgentBox = (alerts ?? []).filter((a) => a.urgent).map((a) => `${a.id}:${a.count}`).join("|");
  useEffect(() => {
    if (!urgentBox) return;
    try {
      if (sessionStorage.getItem("wazn-dash-box-chime") === urgentBox) return;
      sessionStorage.setItem("wazn-dash-box-chime", urgentBox);
    } catch { /* storage blocked: ring anyway */ }
    soundManager.playRiskChime();
  }, [urgentBox]);
  const { data: highlights } = trpc.dashboard.weeklyHighlights.useQuery();
  // Which figure's records are open: the week's days, the week's orders, the 30 days.
  const [drill, setDrill] = useState<null | "week" | "orders" | "month">(null);
  const weekOrdersQ = trpc.dashboard.weekOrders.useQuery(undefined, { enabled: drill === "orders" });
  const { data: selfOrders } = trpc.reports.selfOrderReport.useQuery({ days: 30 });
  const { data: newCustomersCount } = trpc.dashboard.newCustomers.useQuery({ days: 7 });

  const { totalPackages, deliveredPackages, inTransitPackages, activeCustomers, deliveryRate } = useMemo(() => {
    const countOf = (statuses: readonly string[]) =>
      (packageStats ?? []).reduce(
        (sum: number, s: { status: string; count: number | string }) =>
          statuses.includes(s.status) ? sum + Number(s.count) : sum, 0);

    const total = packageStats?.reduce((sum: number, s: { count: number | string }) => sum + Number(s.count), 0) || 0;
    const delivered = countOf(PACKAGE_STAGE_GROUPS.delivered);
    /**
     * Everything still moving, not the literal in_transit row alone.
     *
     * Counting one status left parcels in customs, ready for pickup and out
     * for delivery in no tile at all — the number under "in transit" was
     * always smaller than the number of parcels actually on the road.
     */
    const inTransit = countOf([...PACKAGE_STAGE_GROUPS.inTransit, ...PACKAGE_STAGE_GROUPS.arrived]);
    const active = customerCounts?.active ?? 0;
    /**
     * Cancelled and returned parcels are not failed deliveries, and counting
     * them in the denominator dragged the rate down for parcels that were
     * never going to be delivered.
     */
    const closedOut = countOf(["cancelled", "returned"]);
    const deliverable = total - closedOut;
    const rate = deliverable > 0 ? Math.round((delivered / deliverable) * 100) : 0;
    return { totalPackages: total, deliveredPackages: delivered, inTransitPackages: inTransit, activeCustomers: active, deliveryRate: rate };
  }, [packageStats, customerCounts]);

  const chartData = useMemo(
    () =>
      revenueChart?.map(d => {
        const on = new Date(d.date);
        return {
          date: on.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          // The axis label is for reading; this is for linking. Kept apart
          // because "Aug 16" cannot be turned back into a date reliably.
          day: `${on.getFullYear()}-${String(on.getMonth() + 1).padStart(2, '0')}-${String(on.getDate()).padStart(2, '0')}`,
          revenue: d.revenue,
          packages: d.packages,
        };
      }) || [],
    [revenueChart]
  );

  /** Opens the parcels registered on a clicked point of the daily chart. */
  const openChartDay = (state: any) => {
    const day = state?.activePayload?.[0]?.payload?.day;
    if (day) setLocation(packagesHref({ day }));
  };

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

  /**
   * How the parcels actually travel, counted.
   *
   * This pie was three invented numbers: the in-transit STATUS count
   * mislabelled "Air Regular" (falling back to a literal 30 when the query
   * had not answered), plus a flat 15 and 10 for the other two. Whatever the
   * warehouse was doing, the picture said the same thing. The real breakdown
   * was already coming back from packages.stats and nothing read it.
   */
  const shippingTypeData = useMemo(() => {
    // The dashboard's own blues and violets (owner, 2026-11-05).
    const colors: Record<string, string> = {
      air_regular: '#3b82f6',
      air_irregular: '#8b5cf6',
      sea: '#0ea5e9',
    };
    return (parcelStats?.byShippingType || [])
      .filter(row => Number(row.count) > 0)
      .map(row => ({
        name: SHIPPING_TYPE_LABEL[row.shippingType]
          ? pickLang(language, SHIPPING_TYPE_LABEL[row.shippingType]!)
          : row.shippingType,
        value: Number(row.count),
        color: colors[row.shippingType] || '#a855f7',
        type: row.shippingType as "air_regular" | "air_irregular" | "sea",
      }));
  }, [parcelStats, language]);

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
      {/* `dash-live`: the moving, glowing layer (dashboardLive.css). A soft tap
          sounds for every click on something clickable (owner, 2026-11-05). */}
      <div
        className="pro-page dash-live flex flex-col gap-5"
        onClickCapture={(e) => {
          if ((e.target as HTMLElement).closest("button, a, [role='button']")) soundManager.playTap();
        }}
      >
        {/* On a phone the day's jobs come first, one tap each. */}
        <MobileQuickActions language={language} canViewPath={canViewPath} onNavigate={setLocation} />
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

        {/* The morning brief, above everything.

            The tiles and charts below are excellent at showing a figure and
            silent on whether it moved or whether anybody should act. This
            answers both, ranked, before the reader has to choose where to
            look — which is the whole difference between a dashboard and a
            briefing. */}
        {/* Order on the page, by urgency (owner, 2026-11-05): needs-you 1-3,
            today 4-6, road and warehouse 7-8, customers 9-10, the rest after,
            charts last. Set with flex `order`, so no block moves in the file. */}
        <div className="order-[1]"><DailyBrief language={language} /></div>
        {/* The warehouse's standing risks, where they are seen first thing.
            They lived only on the registrations page, which nobody opens to
            look for problems (owner, 2026-09-16). Each row leads to its
            customer and its parcel, the title to the whole list. Silent — and
            the grid gone — when there is nothing waiting. */}
        {canViewPath("/packages/registrations") && (
          <div className="order-[8] grid gap-3 empty:hidden xl:grid-cols-2">
            <CarrierSummaryCard className="xl:col-span-2" />
            <StaleDepotCard variant="dashboard" />
            <VolumetricWatchCard variant="dashboard" />
          </div>
        )}
        {/* Batches travelling without their waybill or container number.
            The Batches page already chases these; on the dashboard it is the
            first thing seen in the morning, which is when there is still time
            to go and ask for the number. Clicking one opens that batch. */}
        {awaitingNumber.length > 0 && (
          <Card className="order-[7] border-amber-200 dark:border-amber-800/60 bg-amber-50/50 dark:bg-amber-950/40">
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
                      <div key={batch.id} className="inline-flex max-w-full items-center gap-0.5" data-awaiting-batch={batch.batchCode}>
                      <Button
                        size="sm"
                        variant={batch.severity === "urgent" ? "default" : "outline"}
                        className={cn("h-auto pointer-coarse:h-auto min-h-8 pointer-coarse:min-h-10 max-w-full flex-wrap justify-start gap-y-1 whitespace-normal py-1 text-start", batch.severity === "urgent" && "bg-amber-600 hover:bg-amber-700")}
                        onClick={() => setLocation(`/batches?find=${encodeURIComponent(batch.batchCode)}`)}
                      >
                        <span className="font-mono">{batch.batchCode}</span>
                        {/* Which piece, not just that something is missing.
                            "Waiting for a waybill" and "waiting for a flight
                            number" are different jobs for whoever picks this
                            up, and one word for both wastes their time. */}
                        {(batch.missing ?? []).map((piece: string) => (
                          <Badge key={piece} variant="secondary" className="ms-2">
                            {t(`batches.missing.${piece === "flight-number" ? "flightNumber" : piece}`)}
                          </Badge>
                        ))}
                        <Badge variant="secondary" className="ms-2">
                          {t("batches.daysWaiting", { count: batch.daysWaiting })}
                        </Badge>
                      </Button>
                      <CopyButton value={batch.batchCode} label={pickLang(language, { ku: "کۆپی کۆدی باچ", en: "Copy batch code", ar: "نسخ رمز الدفعة", zh: "复制批次代码" })} />
                      </div>
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
          className="order-[4]"
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
              label: t("dashboard.newCustomers7Days") || pickLang(language, { ku: "کڕیاری نوێ (7 ڕۆژ)", en: "New customers (7 days)", ar: "عملاء جدد (7 أيام)", zh: "新客户（7天）" }),
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
                <ExplainableStat figure="totalCustomers" value={customerCounts?.total ?? 0}>
                  {customerCounts?.total ?? 0}
                </ExplainableStat>
              ),
            },
            {
              icon: <Layers />,
              label: t("dashboard.activeBatches") || pickLang(language, { ku: "باچە چالاکەکان", en: "Active batches", ar: "الدفعات النشطة", zh: "活跃批次" }),
              value: (
                <ExplainableStat figure="activeBatches" value={activeBatchCount ?? 0}>
                  {activeBatchCount ?? 0}
                </ExplainableStat>
              ),
            },
          ]}
        />

        {/* Today's intake at the scanner — sums and the busiest customers;
            the Registrations tab on /packages is where the rows get worked. */}
            <RegistrationsSummaryCard className="order-[6]" />

        {/* Financial overview */}
        <DashboardSection className="pro-section order-[5]" title={t("dashboard.financialOverview") || "Financial overview"}>
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

        {/* Operational stats - the long-run totals, below the day's work */}
        <DashboardSection className="pro-section order-[15]">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title={t("dashboard.totalCustomers") ?? "Total Customers"}
            value={customerCounts?.total ?? 0}
            figure="totalCustomers"
            description={pickLang(language, { ku: "هەموو کڕیارە تۆمارکراوەکان", en: "Every registered customer", ar: "كل العملاء المسجلين", zh: "全部登记客户" })}
            icon={<Users className="h-5 w-5" />}
            color="emerald"
          />
          <StatsCard
            title={t("dashboard.totalPackages") ?? "Total Packages"}
            value={totalPackages}
            figure="totalPackages"
            description={pickLang(language, { ku: "هەموو پاکەتەکان، لە سەرەتاوە", en: "Every parcel, since the start", ar: "كل الطرود منذ البداية", zh: "自开始以来的全部包裹" })}
            icon={<Package className="h-5 w-5" />}
            color="blue"
            trend={chartData.map(d => d.packages)}
          />
          <StatsCard
            title={t("dashboard.activeBatches")}
            value={activeBatchCount ?? 0}
            figure="activeBatches"
            description={pickLang(language, { ku: "ئامادەکردن، لە ڕێگا یان لە کۆگا", en: "Preparing, on the road or at the depot", ar: "قيد التجهيز أو في الطريق أو في المستودع", zh: "准备中、在途或在仓库" })}
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
            <div className="contents" onClick={() => setDrill("month")} data-testid="dash-period-cards">
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
        <div className="order-[3] empty:hidden"><AlertSummarySection /></div>

        {/* Problems / action-needed alerts */}
        {alerts && alerts.length > 0 && (
          <DashboardSection
            className="pro-section order-[2]"
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
            className="pro-section order-[12]"
            title={t("dashboard.winsTitle") || pickLang(language, { ku: "سەرکەوتنەکانی ئەم هەفتەیە", en: "This week's wins", ar: "إنجازات هذا الأسبوع", zh: "本周成果" })}
            description={t("dashboard.winsDesc") || pickLang(language, { ku: "ریکۆرد و خاڵە ئەرێنییەکانی ئەم هەفتەیە", en: "Records and positive highlights this week", ar: "الأرقام القياسية والنقاط الإيجابية لهذا الأسبوع", zh: "本周的纪录与亮点" })}
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {/* Weekly profit: its seven days */}
              <div role="button" tabIndex={0} onClick={() => setDrill("week")} onKeyDown={(e) => { if (e.key === "Enter") setDrill("week"); }} className="relative cursor-pointer rounded-xl border bg-card p-4 flex items-center gap-3 hover:bg-accent transition-colors" data-testid="dash-week-profit">
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
              <a target="_blank" rel="noopener noreferrer" href={customersHref({ createdWithin: 7 })} className="rounded-xl border bg-card p-4 flex items-center gap-3 hover:bg-accent transition-colors">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                  <Users className="h-5 w-5" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">{pickLang(language, { ku: "کڕیاری نوێی ئەم هەفتەیە", en: "New customers this week", ar: "عملاء جدد هذا الأسبوع", zh: "本周新客户" })}</p>
                  <p className="text-xl font-bold">{highlights.newCustomers.thisWeek}</p>
                  <p className="text-xs text-muted-foreground">{pickLang(language, { ku: "هەفتەی ڕابردوو", en: "Last week", ar: "الأسبوع الماضي", zh: "上周" })}: {highlights.newCustomers.lastWeek}</p>
                </div>
              </a>

              {/* Orders: the orders themselves */}
              <div role="button" tabIndex={0} onClick={() => setDrill("orders")} onKeyDown={(e) => { if (e.key === "Enter") setDrill("orders"); }} className="cursor-pointer rounded-xl border bg-card p-4 flex items-center gap-3 hover:bg-accent transition-colors" data-testid="dash-week-orders">
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
                <a target="_blank" rel="noopener noreferrer"
                  href={`/customers/${highlights.topCustomer.id}`}
                  className="rounded-xl border bg-card p-4 flex items-center gap-3 hover:bg-accent transition-colors"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                    <Crown className="h-5 w-5" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">{pickLang(language, { ku: "ئاکتیفترین کڕیار", en: "Most active customer", ar: "العميل الأكثر نشاطًا", zh: "最活跃客户" })}</p>
                    <p className="text-base font-bold truncate">{highlights.topCustomer.name || highlights.topCustomer.code}</p>
                    <p className="text-xs text-muted-foreground">{highlights.topCustomer.orders} {pickLang(language, { ku: "ئۆردەر", en: "orders", ar: "طلبات", zh: "订单" })} · ${highlights.topCustomer.spentUsd.toFixed(0)}</p>
                  </div>
                </a>
              )}

              {/* Fastest batch */}
              {highlights.fastestBatch && (
                <a target="_blank" rel="noopener noreferrer"
                  href={`/batches?find=${encodeURIComponent(highlights.fastestBatch.code)}`}
                  className="rounded-xl border bg-card p-4 flex items-center gap-3 hover:bg-accent transition-colors"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400">
                    <Ship className="h-5 w-5" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">{pickLang(language, { ku: "خێراترین باچ", en: "Fastest batch", ar: "أسرع دفعة", zh: "最快批次" })}</p>
                    <p className="text-base font-bold truncate font-mono">{highlights.fastestBatch.code}</p>
                    <p className="text-xs text-muted-foreground">{highlights.fastestBatch.days} {pickLang(language, { ku: "ڕۆژ لە ڕێگادا", en: "days in transit", ar: "أيام في الطريق", zh: "天在途" })}</p>
                  </div>
                </a>
              )}
            </div>
          </DashboardSection>
        )}

        {/* Self orders (shipping-only, customer-bought) — last 30 days */}
        {selfOrders && selfOrders.summary.count > 0 && (
          <DashboardSection
            className="pro-section order-[13]"
            title={t("nav.selfOrders") || "سێلف ئۆردەر"}
            description={pickLang(language, { ku: "پاکێجی خۆکڕاو (تەنها گواستنەوە) — 30 ڕۆژی ڕابردوو", en: "Self-bought packages (shipping only) — last 30 days", ar: "طرود اشتراها العميل (شحن فقط) — آخر 30 يوماً", zh: "客户自购包裹（仅运输）— 最近 30 天" })}
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Link href="/self-orders" className="rounded-xl border bg-card p-4 flex items-center gap-3 hover:bg-accent transition-colors">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"><Package className="h-5 w-5" /></span>
                <div><p className="text-xs text-muted-foreground">{pickLang(language, { ku: "ژمارە", en: "Count", ar: "العدد", zh: "数量" })}</p><p className="text-xl font-bold">{selfOrders.summary.count}</p></div>
              </Link>
              <Link href="/self-orders" className="rounded-xl border bg-card p-4 flex items-center gap-3 hover:bg-accent transition-colors">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"><DollarSign className="h-5 w-5" /></span>
                <div><p className="text-xs text-muted-foreground">{pickLang(language, { ku: "داهات", en: "Revenue", ar: "الإيرادات", zh: "收入" })}</p><p className="text-xl font-bold">${selfOrders.summary.revenueUsd.toFixed(0)}</p></div>
              </Link>
              <Link href="/self-orders" className="rounded-xl border bg-card p-4 flex items-center gap-3 hover:bg-accent transition-colors">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400"><TrendingUp className="h-5 w-5" /></span>
                <div><p className="text-xs text-muted-foreground">{pickLang(language, { ku: "قازانج", en: "Profit", ar: "الربح", zh: "利润" })}</p><p className="text-xl font-bold text-teal-700 dark:text-teal-400">${selfOrders.summary.profitUsd.toFixed(0)}</p></div>
              </Link>
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
                    <LineChart data={chartData} onClick={openChartDay} style={{ cursor: "pointer" }}>
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
                    <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} onClick={openChartDay} style={{ cursor: "pointer" }}>
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
              <CardDescription>{pickLang(language, { ku: "هەموو پاکەتەکان، لە سەرەتاوە — کلیک لە هەر جۆرێک بکە بۆ پاکەتەکانی", en: "Every parcel, since the start — click a kind for its parcels", ar: "كل الطرود منذ البداية — انقر على نوع لعرض طروده", zh: "自开始以来的全部包裹——点击类型查看包裹" })}</CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              <div className="relative h-[250px]">
                {/* The total in the hole of the ring. */}
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold tabular-nums">{shippingTypeData.reduce((n, d) => n + d.value, 0).toLocaleString("en-US")}</span>
                  <span className="text-[11px] text-muted-foreground">{pickLang(language, { ku: "پاکەت", en: "parcels", ar: "طرد", zh: "包裹" })}</span>
                </div>
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
                      className="cursor-pointer"
                      onClick={(d: { type?: string }) => d?.type && setLocation(packagesHref({ shippingType: d.type as "air_regular" | "air_irregular" | "sea" }))}
                    >
                      {shippingTypeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 flex flex-wrap justify-center gap-2">
                {shippingTypeData.map((item) => {
                  const total = shippingTypeData.reduce((n, d) => n + d.value, 0) || 1;
                  return (
                    <Link key={item.type} href={packagesHref({ shippingType: item.type })} className="flex items-center gap-2 rounded-lg border px-2.5 py-1 text-xs transition-colors hover:border-sky-400 hover:bg-sky-50/60 dark:hover:bg-sky-950/30">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-muted-foreground">{item.name}</span>
                      <span className="font-semibold tabular-nums" dir="ltr">{item.value.toLocaleString("en-US")} · {Math.round((item.value / total) * 100)}%</span>
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
        </DashboardSection>
        )}

        {/* Activity & Lists Row */}
        <div className="pro-section order-[14] grid gap-6 lg:grid-cols-3">
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
                  href="/packages/quick-register"
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
        <div className="pro-section order-[9] grid gap-6 lg:grid-cols-2">
          {/* Overdue debt alerts - customers with balance due */}
          <Card className="pro-card overflow-hidden ring-1 ring-red-200/50 dark:ring-red-800/30">
            <CardHeader className="border-b bg-red-50/50 dark:bg-red-950/20 pro-card-body py-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-500 dark:text-red-400" />
                    {/* The biggest balances, not "overdue": nothing here measured
                        lateness until the days since the last payment came in
                        (audit 2026-11-05). */}
                    {pickLang(language, { ku: "گەورەترین قەرزەکان", en: "Biggest debts", ar: "أكبر الديون", zh: "最大欠款" })}
                  </CardTitle>
                  <CardDescription>{pickLang(language, { ku: "بە بڕی قەرز، و چەند ڕۆژە پارەی نەداوە", en: "By amount, and how long since they last paid", ar: "حسب المبلغ ومنذ متى لم يدفعوا", zh: "按金额排列，及距上次付款的天数" })}</CardDescription>
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
                  <Link
                    key={debtor.customerId}
                    href={`/finance/customer/${debtor.customerId}`}
                    className="flex items-center gap-4 px-4 py-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className={`h-10 w-10 shrink-0 rounded-full flex items-center justify-center font-bold text-sm
                      ${index === 0 ? 'bg-gradient-to-br from-red-500 to-red-600 text-white' : 
                        index === 1 ? 'bg-gradient-to-br from-orange-400 to-orange-500 text-white' :
                        'bg-muted text-muted-foreground'}`}>
                      #{index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{debtor.customerName}</p>
                      <p className="text-sm text-muted-foreground" dir="ltr">{customerCodeOnly(debtor.customerCode)}</p>
                      {/* Its share of the biggest debt on the list, as a bar. */}
                      <div className="mt-1.5 h-1.5 w-full max-w-48 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-rose-500 to-violet-500 transition-[width] duration-700"
                          style={{ width: `${Math.max(4, Math.round((debtor.debtUsd / Math.max(1, topDebtors[0]?.debtUsd ?? 1)) * 100))}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-end">
                      <p className="font-semibold tabular-nums text-red-600 dark:text-red-400" dir="ltr">
                        ${debtor.debtUsd.toFixed(2)}
                      </p>
                      {(() => {
                        const days = debtor.lastPaymentDate
                          ? Math.floor((Date.now() - new Date(debtor.lastPaymentDate).getTime()) / 86_400_000)
                          : null;
                        const tone = days == null || days > 30
                          ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300"
                          : days > 7
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300";
                        return (
                          <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${tone}`}>
                            {days == null
                              ? pickLang(language, { ku: "هەرگیز پارەی نەداوە", en: "Never paid", ar: "لم يدفع قط", zh: "从未付款" })
                              : days === 0
                                ? pickLang(language, { ku: "ئەمڕۆ پارەی دا", en: "Paid today", ar: "دفع اليوم", zh: "今天已付款" })
                                : pickLang(language, { ku: `${days} ڕۆژە پارەی نەداوە`, en: `${days} days since paying`, ar: `${days} يوماً دون دفع`, zh: `${days} 天未付款` })}
                          </span>
                        );
                      })()}
                    </div>
                  </Link>
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
                  <Link
                    key={batch.id}
                    href={`/batches/${batch.id}/financial`}
                    className="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors"
                  >
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
                  </Link>
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
        <div className="pro-section order-[10] grid gap-6 lg:grid-cols-2">
          {/* Top Customers */}
          <Card className="pro-card overflow-hidden">
            <CardHeader className="border-b bg-amber-50/50 dark:bg-amber-950/20 pro-card-body py-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Crown className="h-5 w-5 text-amber-500 dark:text-amber-400" />
                    {t('dashboard.topCustomers')}
                  </CardTitle>
                  {/* Ranked by what they were billed over all time (gross charges),
                      not cash received - said so (audit 2026-11-05). */}
                  <CardDescription>{pickLang(language, { ku: "بە پێی کۆی حیسابکراو، هەموو کات", en: "By total billed, all time", ar: "حسب إجمالي الفواتير، كل الأوقات", zh: "按累计开单金额" })}</CardDescription>
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
                  const isVip = vipCustomers?.some(v => v.customerId === customer.customerId);
                  return (
                    <Link
                      key={customer.customerId}
                      href={`/finance/customer/${customer.customerId}`}
                      className="flex items-center gap-4 px-4 py-3 hover:bg-muted/50 transition-colors"
                    >
                      <div className={`h-10 w-10 shrink-0 rounded-full flex items-center justify-center font-bold text-sm
                        ${index === 0 ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-200 dark:shadow-amber-900/30' : 
                          index === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-400 text-slate-700 dark:from-slate-600 dark:to-slate-700 dark:text-slate-200' :
                          index === 2 ? 'bg-gradient-to-br from-orange-300 to-orange-400 text-orange-800 dark:text-orange-200' :
                          'bg-muted text-muted-foreground'}`}>
                        #{index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{(customer as { fullName?: string | null }).fullName || `Customer #${customer.customerId}`}</p>
                          {isVip && (
                            <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs border-0">{t("customers.stats.vip")}</Badge>
                          )}
                        </div>
                        {/* The count is of billed records (parcels, orders, services), not parcels. */}
                        <p className="text-sm text-muted-foreground">{customer.packageCount} {pickLang(language, { ku: "حیساب", en: "charges", ar: "قيود", zh: "笔" })}</p>
                        <div className="mt-1.5 h-1.5 w-full max-w-48 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-sky-500 via-blue-500 to-violet-500 transition-[width] duration-700"
                            style={{ width: `${Math.max(4, Math.round((Number(customer.totalCharges || 0) / Math.max(1, Number(topCustomers?.[0]?.totalCharges || 1))) * 100))}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-end">
                        <p className="font-semibold tabular-nums text-green-600 dark:text-green-400" dir="ltr">
                          ${Number(customer.totalCharges || 0).toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground">{pickLang(language, { ku: "حیسابکراو", en: "billed", ar: "مُفوتر", zh: "已开单" })}</p>
                      </div>
                    </Link>
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
                  // A status the parcels list has a tab for opens it; the others have no list of their own.
                  stat.status === "delivered" ? (
                    <a key={stat.status} target="_blank" rel="noopener noreferrer" href={packagesHref({ tab: "delivered" })} className="block rounded-md hover:bg-accent" data-testid="dash-status-link">
                      <StatusBar status={stat.status} count={Number(stat.count)} total={totalPackages} language={language} />
                    </a>
                  ) : (
                    <StatusBar key={stat.status} status={stat.status} count={Number(stat.count)} total={totalPackages} language={language} />
                  )
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <Sheet open={drill !== null} onOpenChange={(o) => { if (!o) setDrill(null); }}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl" data-testid="dash-drill">
          <SheetHeader>
            <SheetTitle>
              {drill === "orders"
                ? pickLang(language, { ku: "ئۆردەرەکانی ئەم هەفتەیە", en: "This week's orders", ar: "طلبات هذا الأسبوع", zh: "本周订单" })
                : drill === "week"
                  ? pickLang(language, { ku: "قازانجی ئەم هەفتەیە، ڕۆژ بە ڕۆژ", en: "This week's profit, day by day", ar: "ربح هذا الأسبوع يوماً بيوم", zh: "本周利润（按日）" })
                  : pickLang(language, { ku: "داهات و خەرجی 30 ڕۆژ، ڕۆژ بە ڕۆژ", en: "30 days of revenue and expenses, day by day", ar: "30 يوماً يوماً بيوم", zh: "30 天（按日）" })}
            </SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-4">
            {drill === "orders" ? (
              <div className="divide-y text-sm">
                {(weekOrdersQ.data ?? []).map((o) => (
                  <div key={o.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2" data-testid="dash-drill-order">
                    <a target="_blank" rel="noopener noreferrer" href={o.orderType === "commission" ? `/commission/${o.id}` : `/full-package/${o.id}`} className="font-mono text-xs text-sky-700 underline dark:text-sky-300" dir="ltr">{o.orderCode}</a>
                    {o.customerId ? <a target="_blank" rel="noopener noreferrer" href={`/customers/${o.customerId}`} className="text-sky-700 underline dark:text-sky-300">{o.customerCode} {o.customerName}</a> : null}
                    <span className="ms-auto text-xs text-muted-foreground">{fmtDate(o.createdAt)}</span>
                  </div>
                ))}
                <p className="pt-2 font-semibold">{pickLang(language, { ku: "کۆ", en: "Total", ar: "المجموع", zh: "合计" })}: {weekOrdersQ.data?.length ?? 0}</p>
              </div>
            ) : (() => {
              const days = [...(profitLossChart ?? [])].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, drill === "week" ? 7 : undefined);
              const sum = (k: "revenue" | "expenses" | "profit") => days.reduce((s, d) => s + (Number(d[k]) || 0), 0);
              return (
                <>
                  <a target="_blank" rel="noopener noreferrer" href="/finance" className="text-sm text-sky-700 underline dark:text-sky-300">{pickLang(language, { ku: "بەشی دارایی", en: "Finance", ar: "المالية", zh: "财务" })}</a>
                  <table className="mt-3 w-full text-sm tabular-nums">
                    <thead className="text-xs text-muted-foreground">
                      <tr>
                        <th className="py-1 text-start">{pickLang(language, { ku: "ڕۆژ", en: "Day", ar: "اليوم", zh: "日期" })}</th>
                        <th className="py-1 text-start">{pickLang(language, { ku: "داهات", en: "Revenue", ar: "الإيراد", zh: "收入" })}</th>
                        <th className="py-1 text-start">{pickLang(language, { ku: "خەرجی", en: "Expenses", ar: "المصروفات", zh: "支出" })}</th>
                        <th className="py-1 text-start">{pickLang(language, { ku: "قازانج", en: "Profit", ar: "الربح", zh: "利润" })}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {days.map((d) => (
                        <tr key={d.date} className="border-t" data-testid="dash-drill-day">
                          <td className="py-1" dir="ltr">{d.date}</td>
                          <td className="py-1" dir="ltr">${(Number(d.revenue) || 0).toFixed(2)}</td>
                          <td className="py-1" dir="ltr">${(Number(d.expenses) || 0).toFixed(2)}</td>
                          <td className="py-1" dir="ltr">${(Number(d.profit) || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                      <tr className="border-t-2 font-semibold">
                        <td className="py-1">{pickLang(language, { ku: "کۆ", en: "Total", ar: "المجموع", zh: "合计" })}</td>
                        <td className="py-1" dir="ltr">${sum("revenue").toFixed(2)}</td>
                        <td className="py-1" dir="ltr">${sum("expenses").toFixed(2)}</td>
                        <td className="py-1" dir="ltr">${sum("profit").toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </>
              );
            })()}
          </div>
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  );
}

// Alert Card Component
const AlertCard = memo(function AlertCard({ alert }: { alert: { id: string; type: string; title: string; description: string; count?: number; link?: string; records?: Array<{ text: string; href?: string }>; urgent?: boolean } }) {
  const [open, setOpen] = useState(false);
  const [, go] = useLocation();
  const { language } = useTranslation();
  const records = alert.records ?? [];
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

  /*
   * A card with records opens in place to them, each a door to where it is
   * put right, and a button to the page (owner, 2026-11-05). One without
   * records still goes to its page.
   */
  const expandable = records.length > 0;
  const content = (
    <div
      role="button"
      tabIndex={0}
      aria-expanded={expandable ? open : undefined}
      onClick={() => (expandable ? setOpen((o) => !o) : alert.link && go(alert.link))}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); expandable ? setOpen((o) => !o) : alert.link && go(alert.link); } }}
      className={`group p-4 rounded-2xl border bg-gradient-to-br ${style.card} hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer ${open ? "md:col-span-2 lg:col-span-3" : ""}`}
      data-testid={`problem-${alert.id}`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${style.chip} text-white shadow-sm transition-transform duration-200 group-hover:scale-105`}
        >
          <Icon className="h-5 w-5" />
          {alert.urgent && <span aria-hidden className="absolute -end-1 -top-1 h-3 w-3 animate-ping rounded-full bg-rose-500/80 motion-reduce:hidden" />}
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
      {expandable && open && (
        <div className="mt-3 space-y-2 border-t border-current/10 pt-3" onClick={(e) => e.stopPropagation()} data-testid="problem-records">
          <ul className="flex flex-wrap gap-2">
            {records.map((r, i) => (
              <li key={i} className="inline-flex max-w-full items-center gap-1 rounded-lg border bg-background/80 ps-2.5 text-xs">
                {r.href ? (
                  <Link href={r.href} className="truncate py-1 font-mono font-medium text-blue-700 hover:underline dark:text-blue-300" dir="ltr">{r.text}</Link>
                ) : (
                  <span className="truncate py-1 font-mono" dir="ltr">{r.text}</span>
                )}
                <CopyButton value={r.text.split(" · ")[0]} label={pickLang(language, { ku: "کۆپی", en: "Copy", ar: "نسخ", zh: "复制" })} />
              </li>
            ))}
          </ul>
          {alert.count != null && alert.count > records.length && (
            <p className="text-xs text-muted-foreground">
              {pickLang(language, { ku: `${records.length} لە ${alert.count} پیشان دراوە`, en: `${records.length} of ${alert.count} shown`, ar: `عُرض ${records.length} من ${alert.count}`, zh: `显示 ${alert.count} 中的 ${records.length}` })}
            </p>
          )}
          {alert.link && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => go(alert.link!)}>
              <ExternalLink className="h-3.5 w-3.5" />
              {pickLang(language, { ku: "بڕۆ بۆ لیستەکە", en: "Open the list", ar: "افتح القائمة", zh: "打开列表" })}
            </Button>
          )}
        </div>
      )}
    </div>
  );

  return content;
});

// Activity Item Component
function ActivityItem({ activity, isLast }: { activity: { id: string; type: string; title: string; description: string; timestamp: Date; icon: string; color: string; href?: string }; isLast: boolean }) {
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
    <a {...(activity.href ? { href: activity.href, target: "_blank", rel: "noopener noreferrer" } : {})} className="flex gap-4 p-4 hover:bg-muted/50 transition-colors" data-testid="dash-activity">
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
    </a>
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
    blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50',
    emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 group-hover:bg-emerald-200 dark:group-hover:bg-emerald-900/50',
    purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 group-hover:bg-purple-200 dark:group-hover:bg-purple-900/50',
    amber: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 group-hover:bg-amber-200 dark:group-hover:bg-amber-900/50',
    green: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400 group-hover:bg-green-200 dark:group-hover:bg-green-900/50',
    red: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 group-hover:bg-red-200 dark:group-hover:bg-red-900/50',
    indigo: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 group-hover:bg-indigo-200 dark:group-hover:bg-indigo-900/50',
    slate: 'bg-slate-100 text-slate-600 dark:bg-slate-900/30 dark:text-slate-400 group-hover:bg-slate-200 dark:group-hover:bg-slate-900/50',
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
const StatusBar = memo(function StatusBar({ status, count, total, language }: { status: string; count: number; total: number; language: string }) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

  const statusConfig: Record<string, { color: string; bg: string }> = {
    delivered: { color: statusDot('delivered', 'package'), bg: TONE_BG[statusTone('delivered', 'package')] },
    in_transit: { color: statusDot('in_transit', 'package'), bg: TONE_BG[statusTone('in_transit', 'package')] },
    customs_processing: { color: statusDot('customs_processing', 'package'), bg: TONE_BG[statusTone('customs_processing', 'package')] },
    registered: { color: statusDot('registered', 'package'), bg: TONE_BG[statusTone('registered', 'package')] },
    cancelled: { color: statusDot('cancelled', 'package'), bg: TONE_BG[statusTone('cancelled', 'package')] },
    arrived: { color: statusDot('arrived', 'package'), bg: TONE_BG[statusTone('arrived', 'package')] },
  };

  const config = statusConfig[status] || statusConfig.registered;

  return (
    <div className="flex items-center gap-3">
      {/* The shared wording. This printed the raw enum — "customs processing",
          "out for delivery" — in Latin letters on an otherwise Kurdish page. */}
      <span className="text-sm font-medium w-32 truncate" title={status}>
        {PACKAGE_STATUS_LABEL[status] ? pickLang(language, PACKAGE_STATUS_LABEL[status]!) : status.replace(/_/g, ' ')}
      </span>
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
  /*
   * Late parcels and batches, counted on the server over all of them, each
   * card opening to its records (audit 2026-11-05: the old tiles read the
   * newest 500 parcels and 50 batches, counted parcels already in Erbil, and
   * called «1–5 days past the ETA» «near the ETA»).
   */
  const { data: late } = trpc.dashboard.lateAlerts.useQuery();
  if (!late || late.length === 0) return null;
  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4" data-testid="late-alerts">
      {late.map((alert) => (
        <AlertCard key={alert.id} alert={alert} />
      ))}
    </div>
  );
}
