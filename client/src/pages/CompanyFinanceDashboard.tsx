import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { ExplainableFigure } from "@/components/finance/ExplainableFigure";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Package,
  ShoppingBag,
  Receipt,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  BarChart3,
  PieChart as PieChartIcon,
  Wallet,
  CreditCard,
  Building2,
  RefreshCw,
  Plane,
  Ship,
  AlertTriangle,
  Briefcase,
  Wrench,
  FileText,
  Download,
  Users,
  Activity,
  Layers,
  Target,
  CircleDollarSign,
  Minus,
  Plus,
  Equal,
} from "lucide-react";
import { Link } from "wouter";
import { useTranslation } from "@/contexts/LanguageContext";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, RadialBarChart, RadialBar,
} from "recharts";

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

export default function CompanyFinanceDashboard() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'year'>('month');
  const [activeTab, setActiveTab] = useState('overview');

  const { data: stats, isLoading, refetch } = trpc.financeIntegration.dashboardStats.useQuery({ period });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(amount);
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  const getPeriodLabel = (p: string) => {
    const labels: Record<string, string> = {
      'today': t('common.today'),
      'week': t('common.thisWeek'),
      'month': t('common.thisMonth'),
      'year': t('common.thisYear'),
    };
    return labels[p] || p;
  };

  // Revenue by source for pie chart
  const revenueChartData = useMemo(() => {
    if (!stats?.revenueBySource) return [];
    const src = stats.revenueBySource;
    return [
      { name: t('companyFinance.batchProfitAir') || 'باچی ئاسمانی', value: Math.max(0, src.batchProfit?.air_regular?.profit || 0), color: '#3B82F6' },
      { name: t('companyFinance.batchProfitIrregular') || 'ئاسمانی مەترسیدار', value: Math.max(0, src.batchProfit?.air_irregular?.profit || 0), color: '#F59E0B' },
      { name: t('companyFinance.batchProfitSea') || 'دەریایی', value: Math.max(0, src.batchProfit?.sea?.profit || 0), color: '#06B6D4' },
      { name: t('companyFinance.fullPackageProfit') || 'پاکێجی تەواو', value: Math.max(0, src.fullPackage?.profit || 0), color: '#10B981' },
      { name: t('companyFinance.commissionIncome') || 'عمولە', value: Math.max(0, src.commission?.totalCommission || 0), color: '#8B5CF6' },
      { name: t('companyFinance.serviceProfit') || 'خزمەتگوزاری', value: Math.max(0, src.service?.profit || 0), color: '#EC4899' },
    ].filter(d => d.value > 0);
  }, [stats, t]);

  // Monthly trend data for area chart
  const trendData = useMemo(() => {
    if (!stats?.monthlyTrend) return [];
    return stats.monthlyTrend.map((m: any) => ({
      month: m.month,
      revenue: m.revenue,
      expenses: m.expenses,
      netProfit: m.netProfit,
    }));
  }, [stats]);

  // Expense chart data
  const expenseChartData = useMemo(() => {
    if (!stats?.expenseBreakdown?.categories) return [];
    return stats.expenseBreakdown.categories.map((cat: any, i: number) => ({
      name: cat.nameKu || cat.nameEn,
      value: cat.amount,
      color: COLORS[i % COLORS.length],
    }));
  }, [stats]);

  const revenueBySource = stats?.revenueBySource;
  const pl = stats?.profitLoss;
  const activity = stats?.activity;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-8 text-white">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDJ2LTJoMzR6bTAtNHYySDJ2LTJoMzR6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30"></div>
          <div className="relative flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{t("companyFinance.dashboardTitle") || "داشبۆردی دارایی کۆمپانیا"}</h1>
              <p className="text-blue-200 mt-2 text-lg">{t("companyFinance.dashboardSubtitle") || "شوێنگیری داهات، خەرجی، قازانج و زەرەر"}</p>
            </div>
            <div className="flex gap-3 items-center">
              <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
                <SelectTrigger className="w-[160px] bg-white/10 border-white/20 text-white backdrop-blur-sm">
                  <Calendar className="w-4 h-4 ms-2 opacity-70" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">{t("common.today")}</SelectItem>
                  <SelectItem value="week">{t("common.thisWeek")}</SelectItem>
                  <SelectItem value="month">{t("common.thisMonth")}</SelectItem>
                  <SelectItem value="year">{t("common.thisYear")}</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                variant="secondary" 
                size="icon"
                className="bg-white/10 hover:bg-white/20 text-white border-0 backdrop-blur-sm"
                onClick={() => refetch()}
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 h-12">
            <TabsTrigger value="overview" className="text-sm font-medium">
              <BarChart3 className="w-4 h-4 ms-2" />
              {t("companyFinance.tabOverview") || "گشتی"}
            </TabsTrigger>
            <TabsTrigger value="revenue" className="text-sm font-medium">
              <TrendingUp className="w-4 h-4 ms-2" />
              {t("companyFinance.tabRevenue") || "داهات"}
            </TabsTrigger>
            <TabsTrigger value="expenses" className="text-sm font-medium">
              <TrendingDown className="w-4 h-4 ms-2" />
              {t("companyFinance.tabExpenses") || "خەرجی"}
            </TabsTrigger>
            <TabsTrigger value="profitloss" className="text-sm font-medium">
              <Target className="w-4 h-4 ms-2" />
              {t("companyFinance.tabProfitLoss") || "قازانج/زەرەر"}
            </TabsTrigger>
            <TabsTrigger value="charts" className="text-sm font-medium">
              <PieChartIcon className="w-4 h-4 ms-2" />
              {t("companyFinance.tabCharts") || "چارتەکان"}
            </TabsTrigger>
          </TabsList>

          {/* Hint when all main metrics are zero */}
          {!isLoading && (pl?.totalRevenue ?? 0) === 0 && (pl?.totalExpenses ?? 0) === 0 && (
            <div className="mt-4 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800 dark:text-amber-200">
                <p className="font-medium">{t("companyFinance.noActivityHintTitle") || "هەموو ژمارەکان سفڕن"}</p>
                <p className="mt-1 text-amber-700 dark:text-amber-300">
                  {t("companyFinance.noActivityHintBody") || "لە ماوەی هەڵبژێردراو (ئەم مانگە) هیچ داهات یان خەرجی تۆمار نەکراوە. داهاتی باچ پەیوەندی بە باچە دروستکراوەکانی ئەم ماوەیەوە هەیە. دەتوانیت «ئەم ساڵە» هەڵبژێریت یان ماوەیەکی تر."}
                </p>
              </div>
            </div>
          )}

          {/* ============ OVERVIEW TAB ============ */}
          <TabsContent value="overview" className="space-y-6 mt-6">
            {/* Top 4 Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Revenue */}
              <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-emerald-50 dark:from-emerald-950/40 to-green-50 dark:to-green-950/40">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500 rounded-r-full"></div>
                <CardContent className="pt-6 pr-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-emerald-600 dark:text-emerald-300">{t("companyFinance.totalRevenue") || "قازانجی سەرەتایی"}</p>
                      <ExplainableFigure
                        figure="totalRevenue"
                        period={period}
                        className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1"
                        value={isLoading ? '...' : formatCurrency(pl?.totalRevenue || 0)}
                      />
                      <p className="text-xs text-emerald-500 dark:text-emerald-400 mt-1">{getPeriodLabel(period)}</p>
                    </div>
                    <div className="p-3 bg-emerald-100 dark:bg-emerald-950/40 rounded-xl">
                      <DollarSign className="h-6 w-6 text-emerald-600 dark:text-emerald-300" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Total Expenses */}
              <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-red-50 dark:from-red-950/40 to-rose-50 dark:to-rose-950/40">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-red-500 rounded-r-full"></div>
                <CardContent className="pt-6 pr-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-red-600 dark:text-red-300">{t("companyFinance.totalExpenses") || "کۆی خەرجی"}</p>
                      <ExplainableFigure
                        figure="totalExpenses"
                        period={period}
                        className="text-2xl font-bold text-red-700 dark:text-red-300 mt-1"
                        value={isLoading ? '...' : formatCurrency(pl?.totalExpenses || 0)}
                      />
                      <p className="text-xs text-red-500 dark:text-red-400 mt-1">{getPeriodLabel(period)}</p>
                    </div>
                    <div className="p-3 bg-red-100 dark:bg-red-950/40 rounded-xl">
                      <CreditCard className="h-6 w-6 text-red-600 dark:text-red-300" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Net Profit */}
              <Card className={`relative overflow-hidden border-0 shadow-lg ${(pl?.netProfit || 0) >= 0 ? 'bg-gradient-to-br from-blue-50 dark:from-blue-950/40 to-indigo-50 dark:to-indigo-950/40' : 'bg-gradient-to-br from-orange-50 dark:from-orange-950/40 to-amber-50 dark:to-amber-950/40'}`}>
                <div className={`absolute top-0 left-0 w-1.5 h-full ${(pl?.netProfit || 0) >= 0 ? 'bg-blue-500' : 'bg-orange-500'} rounded-r-full`}></div>
                <CardContent className="pt-6 pr-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-sm font-medium ${(pl?.netProfit || 0) >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                        {t("companyFinance.netProfit") || "قازانجی خاوێن"}
                      </p>
                      <ExplainableFigure
                        figure="netProfit"
                        period={period}
                        className={`text-2xl font-bold mt-1 ${(pl?.netProfit || 0) >= 0 ? 'text-blue-700 dark:text-blue-300' : 'text-orange-700 dark:text-orange-300'}`}
                        value={isLoading ? '...' : formatCurrency(pl?.netProfit || 0)}
                      />
                      <div className="flex items-center gap-1 mt-1">
                        {(pl?.netProfit || 0) >= 0 ? (
                          <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs">
                            <ArrowUpRight className="w-3 h-3 ms-1" />
                            {t("companyFinance.profit") || "قازانج"}
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 text-xs">
                            <ArrowDownRight className="w-3 h-3 ms-1" />
                            {t("companyFinance.loss") || "زەرەر"}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className={`p-3 rounded-xl ${(pl?.netProfit || 0) >= 0 ? 'bg-blue-100 dark:bg-blue-950/40' : 'bg-orange-100 dark:bg-orange-950/40'}`}>
                      {(pl?.netProfit || 0) >= 0 ? (
                        <TrendingUp className="h-6 w-6 text-blue-600 dark:text-blue-300" />
                      ) : (
                        <TrendingDown className="h-6 w-6 text-orange-600 dark:text-orange-300" />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Profit Margin */}
              <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-purple-50 dark:from-purple-950/40 to-violet-50 dark:to-violet-950/40">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-purple-500 rounded-r-full"></div>
                <CardContent className="pt-6 pr-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-purple-600 dark:text-purple-300">{t("companyFinance.profitMargin") || "ڕێژەی قازانج"}</p>
                      <p className="text-2xl font-bold text-purple-700 dark:text-purple-300 mt-1">
                        {isLoading ? '...' : formatPercent(pl?.profitMargin || 0)}
                      </p>
                      <p className="text-xs text-purple-500 dark:text-purple-400 mt-1">{getPeriodLabel(period)}</p>
                    </div>
                    <div className="p-3 bg-purple-100 dark:bg-purple-950/40 rounded-xl">
                      <Activity className="h-6 w-6 text-purple-600 dark:text-purple-300" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Revenue by Source - 6 Cards */}
            <div>
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                {t("companyFinance.revenueBySource") || "داهات بە سەرچاوە"}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Batch Air Regular */}
                <Link href="/batches">
                  <Card className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 border-0 shadow-md">
                    <CardContent className="pt-5">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2.5 bg-blue-100 dark:bg-blue-950/40 rounded-xl">
                          <Plane className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{t("companyFinance.batchProfitAir") || "باچی ئاسمانی"}</p>
                          <p className="text-xs text-muted-foreground">{t("companyFinance.airRegular") || "ئاسمانی ئاسایی"}</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{t("companyFinance.revenue") || "داهات"}</span>
                          <span className="font-medium text-green-600 dark:text-green-300">{formatCurrency(revenueBySource?.batchProfit?.air_regular?.revenue || 0)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{t("companyFinance.cost") || "تێچوو"}</span>
                          <span className="font-medium text-red-600 dark:text-red-300">{formatCurrency(revenueBySource?.batchProfit?.air_regular?.cost || 0)}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between text-sm font-bold">
                          <span>{t("companyFinance.netProfit") || "قازانجی خاوێن"}</span>
                          <span className={`${(revenueBySource?.batchProfit?.air_regular?.profit || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {formatCurrency(revenueBySource?.batchProfit?.air_regular?.profit || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{revenueBySource?.batchProfit?.air_regular?.count || 0} {t("companyFinance.packages") || "پاکەت"}</span>
                          <span>{revenueBySource?.batchProfit?.air_regular?.batchCount || 0} {t("companyFinance.batches") || "باچ"}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>

                {/* Batch Air Irregular */}
                <Link href="/batches">
                  <Card className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 border-0 shadow-md">
                    <CardContent className="pt-5">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2.5 bg-amber-100 dark:bg-amber-950/40 rounded-xl">
                          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-300" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{t("companyFinance.batchProfitIrregular") || "ئاسمانی مەترسیدار"}</p>
                          <p className="text-xs text-muted-foreground">{t("companyFinance.airIrregular") || "ئاسمانی نائاسایی"}</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{t("companyFinance.revenue") || "داهات"}</span>
                          <span className="font-medium text-green-600 dark:text-green-300">{formatCurrency(revenueBySource?.batchProfit?.air_irregular?.revenue || 0)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{t("companyFinance.cost") || "تێچوو"}</span>
                          <span className="font-medium text-red-600 dark:text-red-300">{formatCurrency(revenueBySource?.batchProfit?.air_irregular?.cost || 0)}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between text-sm font-bold">
                          <span>{t("companyFinance.netProfit") || "قازانجی خاوێن"}</span>
                          <span className={`${(revenueBySource?.batchProfit?.air_irregular?.profit || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {formatCurrency(revenueBySource?.batchProfit?.air_irregular?.profit || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{revenueBySource?.batchProfit?.air_irregular?.count || 0} {t("companyFinance.packages") || "پاکەت"}</span>
                          <span>{revenueBySource?.batchProfit?.air_irregular?.batchCount || 0} {t("companyFinance.batches") || "باچ"}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>

                {/* Batch Sea */}
                <Link href="/batches">
                  <Card className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 border-0 shadow-md">
                    <CardContent className="pt-5">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2.5 bg-cyan-100 dark:bg-cyan-950/40 rounded-xl">
                          <Ship className="h-5 w-5 text-cyan-600 dark:text-cyan-300" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{t("companyFinance.batchProfitSea") || "باچی دەریایی"}</p>
                          <p className="text-xs text-muted-foreground">{t("companyFinance.seaShipping") || "گواستنەوەی دەریایی"}</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{t("companyFinance.revenue") || "داهات"}</span>
                          <span className="font-medium text-green-600 dark:text-green-300">{formatCurrency(revenueBySource?.batchProfit?.sea?.revenue || 0)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{t("companyFinance.cost") || "تێچوو"}</span>
                          <span className="font-medium text-red-600 dark:text-red-300">{formatCurrency(revenueBySource?.batchProfit?.sea?.cost || 0)}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between text-sm font-bold">
                          <span>{t("companyFinance.netProfit") || "قازانجی خاوێن"}</span>
                          <span className={`${(revenueBySource?.batchProfit?.sea?.profit || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {formatCurrency(revenueBySource?.batchProfit?.sea?.profit || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{revenueBySource?.batchProfit?.sea?.count || 0} {t("companyFinance.packages") || "پاکەت"}</span>
                          <span>{revenueBySource?.batchProfit?.sea?.batchCount || 0} {t("companyFinance.batches") || "باچ"}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>

                {/* Full Package Profit */}
                <Link href="/full-package">
                  <Card className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 border-0 shadow-md">
                    <CardContent className="pt-5">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2.5 bg-green-100 dark:bg-green-950/40 rounded-xl">
                          <ShoppingBag className="h-5 w-5 text-green-600 dark:text-green-300" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{t("companyFinance.fullPackageProfit") || "قازانجی پاکێجی تەواو"}</p>
                          <p className="text-xs text-muted-foreground">{revenueBySource?.fullPackage?.count || 0} {t("companyFinance.orders") || "داواکاری"}</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{t("companyFinance.sellingPrice") || "نرخی فرۆشتن"}</span>
                          <span className="font-medium text-green-600 dark:text-green-300">{formatCurrency(revenueBySource?.fullPackage?.revenue || 0)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{t("companyFinance.purchasePrice") || "نرخی کڕین"}</span>
                          <span className="font-medium text-red-600 dark:text-red-300">{formatCurrency(revenueBySource?.fullPackage?.cost || 0)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{t("companyFinance.shippingCost") || "تێچووی گواستنەوە"}</span>
                          <span className="font-medium text-orange-600 dark:text-orange-300">{formatCurrency(revenueBySource?.fullPackage?.shippingCost || 0)}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between text-sm font-bold">
                          <span>{t("companyFinance.netProfit") || "قازانجی خاوێن"}</span>
                          <span className={`${(revenueBySource?.fullPackage?.profit || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {formatCurrency(revenueBySource?.fullPackage?.profit || 0)}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>

                {/* Commission Income */}
                <Link href="/full-package">
                  <Card className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 border-0 shadow-md">
                    <CardContent className="pt-5">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2.5 bg-violet-100 dark:bg-violet-950/40 rounded-xl">
                          <Briefcase className="h-5 w-5 text-violet-600 dark:text-violet-300" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{t("companyFinance.commissionIncome") || "عمولەی کڕین"}</p>
                          <p className="text-xs text-muted-foreground">{revenueBySource?.commission?.count || 0} {t("companyFinance.orders") || "داواکاری"}</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Separator />
                        <div className="flex justify-between text-sm font-bold">
                          <span>{t("companyFinance.totalCommission") || "کۆی عمولە"}</span>
                          <span className="text-violet-600 dark:text-violet-300">
                            {formatCurrency(revenueBySource?.commission?.totalCommission || 0)}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>

                {/* Service Profit */}
                <Link href="/services">
                  <Card className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 border-0 shadow-md">
                    <CardContent className="pt-5">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2.5 bg-pink-100 dark:bg-pink-950/40 rounded-xl">
                          <Wrench className="h-5 w-5 text-pink-600 dark:text-pink-300" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{t("companyFinance.serviceProfit") || "قازانجی خزمەتگوزاری"}</p>
                          <p className="text-xs text-muted-foreground">{revenueBySource?.service?.count || 0} {t("companyFinance.services") || "خزمەتگوزاری"}</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{t("companyFinance.revenue") || "داهات"}</span>
                          <span className="font-medium text-green-600 dark:text-green-300">{formatCurrency(revenueBySource?.service?.revenue || 0)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{t("companyFinance.cost") || "تێچوو"}</span>
                          <span className="font-medium text-red-600 dark:text-red-300">{formatCurrency(revenueBySource?.service?.cost || 0)}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between text-sm font-bold">
                          <span>{t("companyFinance.netProfit") || "قازانجی خاوێن"}</span>
                          <span className={`${(revenueBySource?.service?.profit || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {formatCurrency(revenueBySource?.service?.profit || 0)}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </div>
            </div>

            {/* Activity Stats */}
            <div>
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                {t("companyFinance.activityStats") || "ئاماری چالاکی"}
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                <StatCard icon={Package} color="blue" label={t("companyFinance.packagesDelivered") || "پاکەتی گەیاندراو"} value={activity?.packagesDelivered || 0} href="/packages" />
                <StatCard icon={ShoppingBag} color="green" label={t("companyFinance.fullPackagesSold") || "پاکێجی تەواوی فرۆشراو"} value={activity?.fullPackagesSold || 0} href="/full-package" />
                <StatCard icon={Briefcase} color="violet" label={t("companyFinance.commissionOrders") || "کڕینی عمولە"} value={activity?.commissionOrders || 0} href="/full-package" />
                <StatCard icon={Receipt} color="purple" label={t("companyFinance.invoicesIssued") || "پسوڵەی دەرکراو"} value={activity?.invoicesIssued || 0} href="/invoices" />
                <StatCard icon={Wallet} color="amber" label={t("companyFinance.paymentsReceived") || "پارەدانی وەرگیراو"} value={activity?.paymentsReceived || 0} href="/finance" />
                <StatCard icon={Wrench} color="pink" label={t("companyFinance.servicesCompleted") || "خزمەتگوزاری"} value={activity?.servicesCompleted || 0} href="/services" />
                <StatCard icon={Users} color="cyan" label={t("companyFinance.totalCustomers") || "کۆی کڕیار"} value={activity?.totalCustomers || 0} href="/customers" />
              </div>
            </div>

            {/* Quick Links */}
            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle className="text-base">{t("dashboard.quickActions") || "کردارە خێراکان"}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Link href="/finance/reports">
                    <Button variant="outline" className="w-full h-auto py-4 flex flex-col gap-2 hover:bg-blue-50 hover:border-blue-200">
                      <BarChart3 className="h-6 w-6 text-blue-500 dark:text-blue-400" />
                      <span className="text-sm">{t("reports.title") || "ڕاپۆرتەکان"}</span>
                    </Button>
                  </Link>
                  <Link href="/finance/expenses">
                    <Button variant="outline" className="w-full h-auto py-4 flex flex-col gap-2 hover:bg-red-50 hover:border-red-200">
                      <CreditCard className="h-6 w-6 text-red-500 dark:text-red-400" />
                      <span className="text-sm">{t("companyFinance.expenses") || "خەرجییەکان"}</span>
                    </Button>
                  </Link>
                  <Link href="/finance/bank-accounts">
                    <Button variant="outline" className="w-full h-auto py-4 flex flex-col gap-2 hover:bg-purple-50 hover:border-purple-200">
                      <Building2 className="h-6 w-6 text-purple-500 dark:text-purple-400" />
                      <span className="text-sm">{t("bankAccounts.pageTitle") || "حسابە بانکییەکان"}</span>
                    </Button>
                  </Link>
                  <Link href="/finance">
                    <Button variant="outline" className="w-full h-auto py-4 flex flex-col gap-2 hover:bg-green-50 hover:border-green-200">
                      <CircleDollarSign className="h-6 w-6 text-green-500 dark:text-green-400" />
                      <span className="text-sm">{t("companyFinance.financeManagement") || "بەڕێوەبردنی دارایی"}</span>
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============ REVENUE TAB ============ */}
          <TabsContent value="revenue" className="space-y-6 mt-6">
            {/* Total Revenue Banner */}
            <Card className="border-0 shadow-lg bg-gradient-to-r from-emerald-500 to-green-600 text-white">
              <CardContent className="py-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-emerald-100 text-sm">{t("companyFinance.totalRevenue") || "قازانجی سەرەتایی"} - {getPeriodLabel(period)}</p>
                    <p className="text-4xl font-bold mt-1">{formatCurrency(pl?.totalRevenue || 0)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-emerald-100 text-sm">{t("companyFinance.profitMargin") || "ڕێژەی قازانج"}</p>
                    <p className="text-3xl font-bold mt-1">{formatPercent(pl?.profitMargin || 0)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Batch Profit Details */}
            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                  {t("companyFinance.batchProfitBreakdown") || "وردەکاری قازانجی باچەکان"}
                </CardTitle>
                <CardDescription>{t("companyFinance.batchProfitDesc") || "قازانجی خاوێن بۆ هەموو جۆرە باچەکان"}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-right py-3 px-4 font-semibold">{t("companyFinance.shippingType") || "جۆری گواستنەوە"}</th>
                        <th className="text-right py-3 px-4 font-semibold">{t("companyFinance.batchCount") || "ژمارەی باچ"}</th>
                        <th className="text-right py-3 px-4 font-semibold">{t("companyFinance.packageCount") || "ژمارەی پاکەت"}</th>
                        <th className="text-right py-3 px-4 font-semibold text-green-600 dark:text-green-300">{t("companyFinance.revenue") || "داهات"}</th>
                        <th className="text-right py-3 px-4 font-semibold text-red-600 dark:text-red-300">{t("companyFinance.cost") || "تێچوو"}</th>
                        <th className="text-right py-3 px-4 font-semibold text-blue-600 dark:text-blue-300">{t("companyFinance.netProfit") || "قازانجی خاوێن"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b hover:bg-muted/30">
                        <td className="py-3 px-4 flex items-center gap-2"><Plane className="w-4 h-4 text-blue-500 dark:text-blue-400" /> {t("companyFinance.airRegular") || "ئاسمانی ئاسایی"}</td>
                        <td className="py-3 px-4 text-right">{revenueBySource?.batchProfit?.air_regular?.batchCount || 0}</td>
                        <td className="py-3 px-4 text-right">{revenueBySource?.batchProfit?.air_regular?.count || 0}</td>
                        <td className="py-3 px-4 text-right text-green-600 dark:text-green-300 font-medium">{formatCurrency(revenueBySource?.batchProfit?.air_regular?.revenue || 0)}</td>
                        <td className="py-3 px-4 text-right text-red-600 dark:text-red-300 font-medium">{formatCurrency(revenueBySource?.batchProfit?.air_regular?.cost || 0)}</td>
                        <td className={`py-3 px-4 text-right font-bold ${(revenueBySource?.batchProfit?.air_regular?.profit || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(revenueBySource?.batchProfit?.air_regular?.profit || 0)}</td>
                      </tr>
                      <tr className="border-b hover:bg-muted/30">
                        <td className="py-3 px-4 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400" /> {t("companyFinance.airIrregular") || "ئاسمانی مەترسیدار"}</td>
                        <td className="py-3 px-4 text-right">{revenueBySource?.batchProfit?.air_irregular?.batchCount || 0}</td>
                        <td className="py-3 px-4 text-right">{revenueBySource?.batchProfit?.air_irregular?.count || 0}</td>
                        <td className="py-3 px-4 text-right text-green-600 dark:text-green-300 font-medium">{formatCurrency(revenueBySource?.batchProfit?.air_irregular?.revenue || 0)}</td>
                        <td className="py-3 px-4 text-right text-red-600 dark:text-red-300 font-medium">{formatCurrency(revenueBySource?.batchProfit?.air_irregular?.cost || 0)}</td>
                        <td className={`py-3 px-4 text-right font-bold ${(revenueBySource?.batchProfit?.air_irregular?.profit || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(revenueBySource?.batchProfit?.air_irregular?.profit || 0)}</td>
                      </tr>
                      <tr className="border-b hover:bg-muted/30">
                        <td className="py-3 px-4 flex items-center gap-2"><Ship className="w-4 h-4 text-cyan-500 dark:text-cyan-400" /> {t("companyFinance.seaShipping") || "دەریایی"}</td>
                        <td className="py-3 px-4 text-right">{revenueBySource?.batchProfit?.sea?.batchCount || 0}</td>
                        <td className="py-3 px-4 text-right">{revenueBySource?.batchProfit?.sea?.count || 0}</td>
                        <td className="py-3 px-4 text-right text-green-600 dark:text-green-300 font-medium">{formatCurrency(revenueBySource?.batchProfit?.sea?.revenue || 0)}</td>
                        <td className="py-3 px-4 text-right text-red-600 dark:text-red-300 font-medium">{formatCurrency(revenueBySource?.batchProfit?.sea?.cost || 0)}</td>
                        <td className={`py-3 px-4 text-right font-bold ${(revenueBySource?.batchProfit?.sea?.profit || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(revenueBySource?.batchProfit?.sea?.profit || 0)}</td>
                      </tr>
                      <tr className="bg-blue-50 dark:bg-blue-950/40 font-bold">
                        <td className="py-3 px-4">{t("companyFinance.totalBatchProfit") || "کۆی قازانجی باچ"}</td>
                        <td className="py-3 px-4 text-right">
                          {(revenueBySource?.batchProfit?.air_regular?.batchCount || 0) + (revenueBySource?.batchProfit?.air_irregular?.batchCount || 0) + (revenueBySource?.batchProfit?.sea?.batchCount || 0)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {(revenueBySource?.batchProfit?.air_regular?.count || 0) + (revenueBySource?.batchProfit?.air_irregular?.count || 0) + (revenueBySource?.batchProfit?.sea?.count || 0)}
                        </td>
                        <td className="py-3 px-4 text-right text-green-600 dark:text-green-300">
                          {formatCurrency(
                            (revenueBySource?.batchProfit?.air_regular?.revenue || 0) +
                            (revenueBySource?.batchProfit?.air_irregular?.revenue || 0) +
                            (revenueBySource?.batchProfit?.sea?.revenue || 0)
                          )}
                        </td>
                        <td className="py-3 px-4 text-right text-red-600 dark:text-red-300">
                          {formatCurrency(
                            (revenueBySource?.batchProfit?.air_regular?.cost || 0) +
                            (revenueBySource?.batchProfit?.air_irregular?.cost || 0) +
                            (revenueBySource?.batchProfit?.sea?.cost || 0)
                          )}
                        </td>
                        <td className="py-3 px-4 text-right text-blue-700 dark:text-blue-300">
                          {formatCurrency(revenueBySource?.batchProfit?.total || 0)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Full Package & Commission & Service Details */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Full Package */}
              <Card className="border-0 shadow-md">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ShoppingBag className="w-5 h-5 text-green-500 dark:text-green-400" />
                    {t("companyFinance.fullPackageProfit") || "قازانجی پاکێجی تەواو"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <DetailRow label={t("companyFinance.sellingPrice") || "نرخی فرۆشتن"} value={formatCurrency(revenueBySource?.fullPackage?.revenue || 0)} color="text-green-600" />
                    <DetailRow label={t("companyFinance.purchasePrice") || "نرخی کڕین"} value={formatCurrency(revenueBySource?.fullPackage?.cost || 0)} color="text-red-600" icon={<Minus className="w-3 h-3" />} />
                    <DetailRow label={t("companyFinance.shippingCost") || "تێچووی گواستنەوە"} value={formatCurrency(revenueBySource?.fullPackage?.shippingCost || 0)} color="text-orange-600" icon={<Minus className="w-3 h-3" />} />
                    <Separator />
                    <DetailRow label={t("companyFinance.netProfit") || "قازانجی خاوێن"} value={formatCurrency(revenueBySource?.fullPackage?.profit || 0)} color={(revenueBySource?.fullPackage?.profit || 0) >= 0 ? "text-emerald-600" : "text-red-600"} bold icon={<Equal className="w-3 h-3" />} />
                    <p className="text-xs text-muted-foreground">{revenueBySource?.fullPackage?.count || 0} {t("companyFinance.orders") || "داواکاری"}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Commission */}
              <Card className="border-0 shadow-md">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Briefcase className="w-5 h-5 text-violet-500 dark:text-violet-400" />
                    {t("companyFinance.commissionIncome") || "عمولەی کڕین"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="text-center py-4">
                      <p className="text-3xl font-bold text-violet-600 dark:text-violet-300">{formatCurrency(revenueBySource?.commission?.totalCommission || 0)}</p>
                      <p className="text-sm text-muted-foreground mt-2">{revenueBySource?.commission?.count || 0} {t("companyFinance.commissionOrders") || "کڕینی عمولە"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Service */}
              <Card className="border-0 shadow-md">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Wrench className="w-5 h-5 text-pink-500 dark:text-pink-400" />
                    {t("companyFinance.serviceProfit") || "قازانجی خزمەتگوزاری"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <DetailRow label={t("companyFinance.revenue") || "داهات"} value={formatCurrency(revenueBySource?.service?.revenue || 0)} color="text-green-600" />
                    <DetailRow label={t("companyFinance.cost") || "تێچوو"} value={formatCurrency(revenueBySource?.service?.cost || 0)} color="text-red-600" icon={<Minus className="w-3 h-3" />} />
                    <Separator />
                    <DetailRow label={t("companyFinance.netProfit") || "قازانجی خاوێن"} value={formatCurrency(revenueBySource?.service?.profit || 0)} color={(revenueBySource?.service?.profit || 0) >= 0 ? "text-emerald-600" : "text-red-600"} bold icon={<Equal className="w-3 h-3" />} />
                    <p className="text-xs text-muted-foreground">{revenueBySource?.service?.count || 0} {t("companyFinance.services") || "خزمەتگوزاری"}</p>
                    {/* Service by type */}
                    {revenueBySource?.service?.byType && revenueBySource.service.byType.length > 0 && (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">{t("companyFinance.byServiceType") || "بە جۆری خزمەتگوزاری"}</p>
                        {revenueBySource.service.byType.map((st: any) => (
                          <div key={st.typeId} className="flex justify-between text-xs">
                            <span>{st.typeName}</span>
                            <span className="font-medium">{formatCurrency(st.profit)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ============ EXPENSES TAB ============ */}
          <TabsContent value="expenses" className="space-y-6 mt-6">
            {/* Total Expenses Banner */}
            <Card className="border-0 shadow-lg bg-gradient-to-r from-red-500 to-rose-600 text-white">
              <CardContent className="py-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-red-100 text-sm">{t("companyFinance.totalExpenses") || "کۆی خەرجی"} - {getPeriodLabel(period)}</p>
                    <p className="text-4xl font-bold mt-1">{formatCurrency(stats?.expenseBreakdown?.total || 0)}</p>
                  </div>
                  <Link href="/finance/expenses">
                    <Button variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-0">
                      <FileText className="w-4 h-4 ms-2" />
                      {t("companyFinance.viewAll") || "هەمووی ببینە"}
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Expense Categories */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Category List */}
              <Card className="border-0 shadow-md">
                <CardHeader>
                  <CardTitle className="text-base">{t("companyFinance.expenseByCategory") || "خەرجی بە جۆر"}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {stats?.expenseBreakdown?.categories?.map((cat: any, i: number) => (
                      <div key={cat.id} className="space-y-2">
                        <div className="flex justify-between items-center text-sm">
                          <div className="flex items-center gap-2">
                            <span>{cat.icon || '📦'}</span>
                            <span className="font-medium">{cat.nameKu || cat.nameEn}</span>
                            <Badge variant="secondary" className="text-xs">{cat.count}</Badge>
                          </div>
                          <span className="font-bold text-red-600 dark:text-red-300">{formatCurrency(cat.amount)}</span>
                        </div>
                        <div className="h-2 bg-gray-100 dark:bg-gray-950/40 rounded-full overflow-hidden">
                          <div 
                            className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${cat.percentage}%`, backgroundColor: COLORS[i % COLORS.length] }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">{cat.percentage.toFixed(1)}% {t("companyFinance.ofTotal") || "لە کۆی گشتی"}</p>
                      </div>
                    ))}
                    {(!stats?.expenseBreakdown?.categories || stats.expenseBreakdown.categories.length === 0) && (
                      <p className="text-center text-muted-foreground py-8">{t("companyFinance.noExpenses") || "هیچ خەرجییەک تۆمار نەکراوە"}</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Expense Pie Chart */}
              <Card className="border-0 shadow-md">
                <CardHeader>
                  <CardTitle className="text-base">{t("companyFinance.expenseDistribution") || "دابەشبوونی خەرجی"}</CardTitle>
                </CardHeader>
                <CardContent>
                  {expenseChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={350}>
                      <PieChart>
                        <Pie
                          data={expenseChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={80}
                          outerRadius={130}
                          paddingAngle={3}
                          dataKey="value"
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        >
                          {expenseChartData.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[350px] text-muted-foreground">
                      {t("companyFinance.noData") || "داتا بوونی نییە"}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ============ PROFIT & LOSS TAB ============ */}
          <TabsContent value="profitloss" className="space-y-6 mt-6">
            {/* P&L Statement */}
            <Card className="border-0 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-slate-50 dark:from-slate-950/40 to-blue-50 dark:to-blue-950/40 rounded-t-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl">{t("companyFinance.plStatement") || "بەیاننامەی قازانج و زەرەر"}</CardTitle>
                    <CardDescription>{getPeriodLabel(period)}</CardDescription>
                  </div>
                  <Badge variant={pl?.isProfit ? "default" : "destructive"} className="text-lg px-4 py-2">
                    {pl?.isProfit ? (t("companyFinance.profit") || "قازانج") : (t("companyFinance.loss") || "زەرەر")}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-1">
                  {/* Revenue Section */}
                  <div className="bg-emerald-50 dark:bg-emerald-950/40 rounded-xl p-5 mb-4">
                    <h3 className="font-bold text-emerald-800 dark:text-emerald-200 text-lg mb-4 flex items-center gap-2">
                      <Plus className="w-5 h-5" />
                      {t("companyFinance.totalRevenue") || "قازانجی سەرەتایی"}
                    </h3>
                    <div className="space-y-3 me-6">
                      <PLRow label={`🛫 ${t("companyFinance.batchProfitAir") || "قازانجی باچی ئاسمانی"}`} value={revenueBySource?.batchProfit?.air_regular?.profit || 0} />
                      <PLRow label={`⚠️ ${t("companyFinance.batchProfitIrregular") || "قازانجی باچی ئاسمانی مەترسیدار"}`} value={revenueBySource?.batchProfit?.air_irregular?.profit || 0} />
                      <PLRow label={`🚢 ${t("companyFinance.batchProfitSea") || "قازانجی باچی دەریایی"}`} value={revenueBySource?.batchProfit?.sea?.profit || 0} />
                      <PLRow label={`📦 ${t("companyFinance.fullPackageProfit") || "قازانجی پاکێجی تەواو"}`} value={revenueBySource?.fullPackage?.profit || 0} />
                      <PLRow label={`💼 ${t("companyFinance.commissionIncome") || "عمولەی کڕین"}`} value={revenueBySource?.commission?.totalCommission || 0} />
                      <PLRow label={`🔧 ${t("companyFinance.serviceProfit") || "قازانجی خزمەتگوزاری"}`} value={revenueBySource?.service?.profit || 0} />
                      <Separator className="my-2" />
                      <div className="flex justify-between items-center font-bold text-lg">
                        <span className="text-emerald-800 dark:text-emerald-200">{t("companyFinance.totalRevenueLabel") || "کۆی قازانجی سەرەتایی"}</span>
                        <span className="text-emerald-700 dark:text-emerald-300">{formatCurrency(pl?.totalRevenue || 0)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Expenses Section */}
                  <div className="bg-red-50 dark:bg-red-950/40 rounded-xl p-5 mb-4">
                    <h3 className="font-bold text-red-800 dark:text-red-200 text-lg mb-4 flex items-center gap-2">
                      <Minus className="w-5 h-5" />
                      {t("companyFinance.totalExpenses") || "کۆی خەرجی"}
                    </h3>
                    <div className="space-y-3 me-6">
                      {stats?.expenseBreakdown?.categories?.map((cat: any) => (
                        <PLRow key={cat.id} label={`${cat.icon || '📦'} ${cat.nameKu || cat.nameEn}`} value={-cat.amount} />
                      ))}
                      {(!stats?.expenseBreakdown?.categories || stats.expenseBreakdown.categories.length === 0) && (
                        <p className="text-sm text-muted-foreground">{t("companyFinance.noExpenses") || "هیچ خەرجییەک تۆمار نەکراوە"}</p>
                      )}
                      <Separator className="my-2" />
                      <div className="flex justify-between items-center font-bold text-lg">
                        <span className="text-red-800 dark:text-red-200">{t("companyFinance.totalExpensesLabel") || "کۆی گشتی خەرجی"}</span>
                        <span className="text-red-700 dark:text-red-300">({formatCurrency(pl?.totalExpenses || 0)})</span>
                      </div>
                    </div>
                  </div>

                  {/* Net Profit/Loss */}
                  <div className={`rounded-xl p-6 ${pl?.isProfit ? 'bg-gradient-to-r from-blue-600 to-indigo-600' : 'bg-gradient-to-r from-orange-500 to-red-500'} text-white`}>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <Equal className="w-6 h-6" />
                        <span className="text-xl font-bold">
                          {pl?.isProfit ? (t("companyFinance.netProfitLabel") || "قازانجی خاوێن") : (t("companyFinance.netLossLabel") || "زەرەری خاوێن")}
                        </span>
                      </div>
                      <div className="text-left">
                        <p className="text-3xl font-bold">{formatCurrency(Math.abs(pl?.netProfit || 0))}</p>
                        <p className="text-sm opacity-80 mt-1">{t("companyFinance.profitMargin") || "ڕێژەی قازانج"}: {formatPercent(pl?.profitMargin || 0)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============ CHARTS TAB ============ */}
          <TabsContent value="charts" className="space-y-6 mt-6">
            {/* Revenue Distribution Pie Chart */}
            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChartIcon className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                  {t("companyFinance.revenueDistribution") || "دابەشبوونی داهات بە سەرچاوە"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {revenueChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={400}>
                    <PieChart>
                      <Pie
                        data={revenueChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={90}
                        outerRadius={150}
                        paddingAngle={3}
                        dataKey="value"
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      >
                        {revenueChartData.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                    {t("companyFinance.noData") || "داتا بوونی نییە"}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Monthly Trend */}
            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                  {t("companyFinance.monthlyTrend") || "ڕەوتی مانگانە"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {trendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={400}>
                    <AreaChart data={trendData}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Legend />
                      <Area type="monotone" dataKey="revenue" name={t("companyFinance.revenue") || "داهات"} stroke="#10B981" fillOpacity={1} fill="url(#colorRevenue)" strokeWidth={2} />
                      <Area type="monotone" dataKey="expenses" name={t("companyFinance.expenses") || "خەرجی"} stroke="#EF4444" fillOpacity={1} fill="url(#colorExpenses)" strokeWidth={2} />
                      <Area type="monotone" dataKey="netProfit" name={t("companyFinance.netProfit") || "قازانجی خاوێن"} stroke="#3B82F6" fillOpacity={1} fill="url(#colorProfit)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                    {t("companyFinance.noData") || "داتا بوونی نییە"}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Revenue Comparison Bar Chart */}
            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-purple-500 dark:text-purple-400" />
                  {t("companyFinance.revenueComparison") || "بەراوردی داهات بە سەرچاوە"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {revenueBySource ? (
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={[
                      { name: t("companyFinance.airRegular") || "ئاسمانی", profit: revenueBySource.batchProfit?.air_regular?.profit || 0 },
                      { name: t("companyFinance.airIrregular") || "مەترسیدار", profit: revenueBySource.batchProfit?.air_irregular?.profit || 0 },
                      { name: t("companyFinance.seaShipping") || "دەریایی", profit: revenueBySource.batchProfit?.sea?.profit || 0 },
                      { name: t("companyFinance.fullPackageShort") || "پاکێجی تەواو", profit: revenueBySource.fullPackage?.profit || 0 },
                      { name: t("companyFinance.commissionShort") || "عمولە", profit: revenueBySource.commission?.totalCommission || 0 },
                      { name: t("companyFinance.serviceShort") || "خزمەتگوزاری", profit: revenueBySource.service?.profit || 0 },
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Bar dataKey="profit" name={t("companyFinance.netProfit") || "قازانجی خاوێن"} radius={[8, 8, 0, 0]}>
                        {[0,1,2,3,4,5].map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[350px] text-muted-foreground">
                    {t("companyFinance.noData") || "داتا بوونی نییە"}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

// Helper Components
function StatCard({ icon: Icon, color, label, value, href }: { icon: any; color: string; label: string; value: number; href: string }) {
  const colorMap: Record<string, { bg: string; text: string }> = {
    blue: { bg: 'bg-blue-100 dark:bg-blue-950/40', text: 'text-blue-600' },
    green: { bg: 'bg-green-100 dark:bg-green-950/40', text: 'text-green-600' },
    violet: { bg: 'bg-violet-100 dark:bg-violet-950/40', text: 'text-violet-600' },
    purple: { bg: 'bg-purple-100 dark:bg-purple-950/40', text: 'text-purple-600' },
    amber: { bg: 'bg-amber-100 dark:bg-amber-950/40', text: 'text-amber-600' },
    pink: { bg: 'bg-pink-100 dark:bg-pink-950/40', text: 'text-pink-600' },
    cyan: { bg: 'bg-cyan-100 dark:bg-cyan-950/40', text: 'text-cyan-600' },
  };
  const c = colorMap[color] || colorMap.blue;
  
  return (
    <Link href={href}>
      <Card className="cursor-pointer hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 border-0 shadow-sm">
        <CardContent className="pt-4 pb-3 px-3">
          <div className="flex flex-col items-center text-center gap-2">
            <div className={`p-2 ${c.bg} rounded-lg`}>
              <Icon className={`h-4 w-4 ${c.text}`} />
            </div>
            <p className="text-xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground leading-tight">{label}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function DetailRow({ label, value, color, bold, icon }: { label: string; value: string; color: string; bold?: boolean; icon?: React.ReactNode }) {
  return (
    <div className={`flex justify-between items-center text-sm ${bold ? 'font-bold' : ''}`}>
      <div className="flex items-center gap-1.5">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        <span>{label}</span>
      </div>
      <span className={`${color} font-medium`}>{value}</span>
    </div>
  );
}

function PLRow({ label, value }: { label: string; value: number }) {
  const isNegative = value < 0;
  return (
    <div className="flex justify-between items-center text-sm">
      <span>{label}</span>
      <span className={`font-medium ${isNegative ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
        {isNegative ? `(${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(value))})` : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)}
      </span>
    </div>
  );
}
