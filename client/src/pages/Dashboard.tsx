import DashboardLayout from "@/components/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  FinancialCard,
  StatsCard,
  ChartEmpty,
  DashboardSection,
} from "@/components/dashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState, useMemo, memo } from "react";
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
  const { t } = useLanguage();
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

  return (
    <DashboardLayout>
      <div className="pro-page space-y-6">
        <PageHeader
          icon={LayoutDashboard}
          title={t("dashboard.title")}
          subtitle={`${t("dashboard.welcome")} ${t("dashboard.subtitle")}`}
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

        {/* Financial overview */}
        <DashboardSection className="pro-section" title={t("dashboard.financialOverview") || "Financial overview"}>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <FinancialCard
            title={t('dashboard.todayIncome')}
            value={financialStats?.todayRevenue || 0}
            change={financialStats?.todayChange || 0}
            icon={<DollarSign className="h-5 w-5" />}
            color="green"
            prefix="$"
          />
          <FinancialCard
            title={t('dashboard.weeklyIncome')}
            value={financialStats?.weekRevenue || 0}
            change={financialStats?.weekChange || 0}
            icon={<TrendingUp className="h-5 w-5" />}
            color="blue"
            prefix="$"
          />
          <FinancialCard
            title={t('dashboard.monthlyIncome')}
            value={financialStats?.monthRevenue || 0}
            change={financialStats?.monthChange || 0}
            icon={<Wallet className="h-5 w-5" />}
            color="purple"
            prefix="$"
          />
          <FinancialCard
            title={t('dashboard.totalDebt')}
            value={financialStats?.totalDebt || 0}
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
            description={t("dashboard.activeCustomers") ?? "Active customers"}
            icon={<Users className="h-5 w-5" />}
            color="emerald"
          />
          <StatsCard
            title={t("dashboard.totalPackages") ?? "Total Packages"}
            value={totalPackages}
            description={t("dashboard.registeredToday")}
            icon={<Package className="h-5 w-5" />}
            color="blue"
          />
          <StatsCard
            title={t("dashboard.activeBatches")}
            value={activeBatches?.length || 0}
            description={t("dashboard.onRouteOrPreparing")}
            icon={<Layers className="h-5 w-5" />}
            color="amber"
          />
          <StatsCard
            title={t("dashboard.delivered")}
            value={deliveredPackages}
            description={`${deliveryRate}% ${t("dashboard.deliveryRate")}`}
            icon={<CheckCircle className="h-5 w-5" />}
            color="green"
          />
          </div>
        </DashboardSection>

        {/* Revenue, Profit & Loss — داهات، قازانج و زیان */}
        <DashboardSection className="pro-section"
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

        {/* Alert Summary Section */}
        <AlertSummarySection />

        {/* Problems / action-needed alerts */}
        {alerts && alerts.length > 0 && (
          <DashboardSection
            className="pro-section"
            title={t("dashboard.problemsTitle") || "مەشاکل و کارە پێویستەکان"}
            description={t("dashboard.problemsDesc") || "ئەو شتانەی پێویستیان بە چاودێری یان کردارە"}
          >
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {alerts.map((alert) => (
                <AlertCard key={alert.id} alert={alert} />
              ))}
            </div>
          </DashboardSection>
        )}

        {/* Analytics */}
        <DashboardSection className="pro-section" title={t("dashboard.analytics") || "Analytics"} description={t("dashboard.revenueAndPackagesByDay")}>
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
                    <AlertTriangle className="h-5 w-5 text-red-500" />
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
                    <CheckCircle className="h-12 w-12 mx-auto mb-3 opacity-30 text-green-500" />
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
                    <Truck className="h-5 w-5 text-blue-500" />
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
                        <Badge variant="secondary" className="text-xs capitalize">
                          {batch.status.replace(/_/g, ' ')}
                        </Badge>
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
                    <Crown className="h-5 w-5 text-amber-500" />
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
                          index === 2 ? 'bg-gradient-to-br from-orange-300 to-orange-400 text-orange-800' :
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
    warning: { bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800', icon: <AlertTriangle className="h-5 w-5 text-amber-500" /> },
    info: { bg: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800', icon: <Info className="h-5 w-5 text-blue-500" /> },
    error: { bg: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800', icon: <AlertCircle className="h-5 w-5 text-red-500" /> },
    success: { bg: 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800', icon: <CheckCircle className="h-5 w-5 text-green-500" /> },
  };

  const style = typeStyles[alert.type as keyof typeof typeStyles] || typeStyles.info;

  const content = (
    <div className={`p-4 rounded-xl border ${style.bg} hover:shadow-md transition-all cursor-pointer`}>
      <div className="flex items-start gap-3">
        {style.icon}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">{alert.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{alert.description}</p>
        </div>
        {alert.count && (
          <Badge variant="secondary" className="font-mono">{alert.count}</Badge>
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
                  <p className="text-xs text-red-500">{t('dashboard.moreThan20Days')}</p>
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
                  <p className="text-xs text-amber-500">{t('dashboard.10to20Days')}</p>
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
                  <p className="text-xs text-red-500">{t('dashboard.veryOverdue')}</p>
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
                  <p className="text-xs text-amber-500">{t('dashboard.nearETA')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      )}
    </div>
  );
}
