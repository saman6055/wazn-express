import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Package,
  ShoppingBag,
  Handshake,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Download,
  BarChart3,
  PieChart as PieChartIcon,
  RefreshCw
} from "lucide-react";
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
import DashboardLayout from "@/components/DashboardLayout";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";

// Order type configuration
const orderTypeConfig = {
  full_package: { 
    label: "Full Package", 
    labelKu: "پاکێجی تەواو",
    color: "bg-emerald-500",
    textColor: "text-emerald-600",
    bgLight: "bg-emerald-50 dark:bg-emerald-950/40",
    icon: Package 
  },

  commission: { 
    label: "Commission", 
    labelKu: "عمولە",
    color: "bg-amber-500",
    textColor: "text-amber-600",
    bgLight: "bg-amber-50 dark:bg-amber-950/40",
    icon: Handshake 
  },
};

// Simple bar chart component
function SimpleBarChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const maxValue = Math.max(...data.map(d => d.value), 1);
  
  return (
    <div className="space-y-3">
      {data.map((item, index) => (
        <div key={index} className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{item.label}</span>
            <span className="font-medium">${item.value.toLocaleString()}</span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full rounded-full transition-all duration-500"
              style={{ 
                width: `${(item.value / maxValue) * 100}%`,
                backgroundColor: item.color 
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// Donut chart component
function DonutChart({ data, total, totalLabel }: { data: { label: string; value: number; color: string }[]; total: number; totalLabel: string }) {
  const segments = useMemo(() => {
    let currentAngle = 0;
    return data.map(item => {
      const percentage = total > 0 ? (item.value / total) * 100 : 0;
      const angle = (percentage / 100) * 360;
      const segment = {
        ...item,
        percentage,
        startAngle: currentAngle,
        endAngle: currentAngle + angle,
      };
      currentAngle += angle;
      return segment;
    });
  }, [data, total]);

  const gradientStops = segments.map((seg) => {
    const start = (seg.startAngle / 360) * 100;
    const end = (seg.endAngle / 360) * 100;
    return `${seg.color} ${start}% ${end}%`;
  }).join(', ');

  return (
    <div className="flex items-center gap-6">
      <div 
        className="w-32 h-32 rounded-full relative"
        style={{ 
          background: total > 0 ? `conic-gradient(${gradientStops})` : '#e5e7eb'
        }}
      >
        <div className="absolute inset-4 bg-background rounded-full flex items-center justify-center">
          <div className="text-center">
            <p className="text-lg font-bold">${total.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{totalLabel}</p>
          </div>
        </div>
      </div>
      <div className="space-y-2">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: seg.color }} />
            <span className="text-sm text-muted-foreground">{seg.label}</span>
            <span className="text-sm font-medium">{seg.percentage.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function UnifiedProfitDashboard() {
  const { t, isRTL, language } = useTranslation();
  const isKurdish = language === "ku";
  
  // Date range state
  const [dateRange, setDateRange] = useState<"week" | "month" | "quarter" | "year" | "all">("month");
  
  // Calculate date range
  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    const end = new Date(now);
    let start = new Date(now);
    
    switch (dateRange) {
      case "week":
        start.setDate(start.getDate() - 7);
        break;
      case "month":
        start.setMonth(start.getMonth() - 1);
        break;
      case "quarter":
        start.setMonth(start.getMonth() - 3);
        break;
      case "year":
        start.setFullYear(start.getFullYear() - 1);
        break;
      case "all":
        start = new Date(2020, 0, 1);
        break;
    }
    
    return { startDate: start, endDate: end };
  }, [dateRange]);
  
  // Fetch full package profit summary
  const { data: fpProfit, isLoading: fpLoading, refetch: refetchFp } = trpc.fullPackage.getProfitSummary.useQuery({
    startDate,
    endDate,
  });
  
  // Fetch full package orders for detailed breakdown
  const { data: fpOrders, isLoading: ordersLoading } = trpc.fullPackage.list.useQuery({
    startDate,
    endDate,
  });
  
  // Calculate profit by order type
  const profitByType = useMemo(() => {
    if (!fpOrders) return { full_package: 0, commission: 0 };
    
    const result = {
      full_package: 0,
      commission: 0,
    };
    
    fpOrders.forEach((order: any) => {
      const profit = parseFloat(order.profitUsd || "0");
      const type = order.orderType as keyof typeof result;
      if (result[type] !== undefined) {
        result[type] += profit;
      }
    });
    
    return result;
  }, [fpOrders]);
  
  // Calculate monthly breakdown
  const monthlyBreakdown = useMemo(() => {
    if (!fpOrders) return [];
    
    const monthlyData: Record<string, { full_package: number; commission: number; total: number }> = {};
    
    fpOrders.forEach((order: any) => {
      const date = new Date(order.createdAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { full_package: 0, commission: 0, total: 0 };
      }
      
      const profit = parseFloat(order.profitUsd || "0");
      const type = order.orderType as keyof typeof monthlyData[string];
      if (monthlyData[monthKey][type] !== undefined) {
        monthlyData[monthKey][type] += profit;
        monthlyData[monthKey].total += profit;
      }
    });
    
    return Object.entries(monthlyData)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 12)
      .map(([month, data]) => ({
        month,
        monthLabel: new Date(month + '-01').toLocaleDateString(isKurdish ? 'ku-IQ' : 'en-US', { year: 'numeric', month: 'short' }),
        ...data,
      }));
  }, [fpOrders, isKurdish]);
  
  // Total profit
  const totalProfit = profitByType.full_package + profitByType.commission;
  
  // Order counts by type
  const orderCounts = useMemo(() => {
    if (!fpOrders) return { full_package: 0, commission: 0, total: 0 };
    
    const counts = { full_package: 0, commission: 0, total: fpOrders.length };
    fpOrders.forEach((order: any) => {
      const type = order.orderType as keyof typeof counts;
      if (counts[type] !== undefined) {
        counts[type]++;
      }
    });
    
    return counts;
  }, [fpOrders]);
  
  const isLoading = fpLoading || ordersLoading;
  
  // Chart data
  const chartData = [
    { label: pickLang(language, { ku: "پاکێجی تەواو", en: "Full Package", ar: "الحزمة الكاملة", zh: "全包服务" }), value: profitByType.full_package, color: "#10b981" },
    { label: pickLang(language, { ku: "عمولە", en: "Commission", ar: "العمولة", zh: "佣金" }), value: profitByType.commission, color: "#f59e0b" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6" dir={isRTL ? "rtl" : "ltr"}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">
              {pickLang(language, { ku: "داشبۆردی قازانجی یەکگرتوو", en: "Unified Profit Dashboard", ar: "لوحة الأرباح الموحدة", zh: "统一利润仪表板" })}
            </h1>
            <p className="text-muted-foreground">
              {pickLang(language, { ku: "قازانجی هەر سێ جۆری ئۆردەر لە یەک شوێن", en: "Profit from all three order types in one place", ar: "أرباح أنواع الطلبات الثلاثة جميعها في مكان واحد", zh: "在一处查看全部三种订单类型的利润" })}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Select value={dateRange} onValueChange={(v: any) => setDateRange(v)}>
              <SelectTrigger className="w-[140px]">
                <Calendar className="w-4 h-4 me-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">{pickLang(language, { ku: "هەفتەی ڕابردوو", en: "Last Week", ar: "الأسبوع الماضي", zh: "上周" })}</SelectItem>
                <SelectItem value="month">{pickLang(language, { ku: "مانگی ڕابردوو", en: "Last Month", ar: "الشهر الماضي", zh: "上月" })}</SelectItem>
                <SelectItem value="quarter">{pickLang(language, { ku: "سێ مانگی ڕابردوو", en: "Last Quarter", ar: "الربع الماضي", zh: "上季度" })}</SelectItem>
                <SelectItem value="year">{pickLang(language, { ku: "ساڵی ڕابردوو", en: "Last Year", ar: "السنة الماضية", zh: "去年" })}</SelectItem>
                <SelectItem value="all">{pickLang(language, { ku: "هەموو کات", en: "All Time", ar: "كل الأوقات", zh: "全部时间" })}</SelectItem>
              </SelectContent>
            </Select>
            
            <Button variant="outline" size="icon" onClick={() => refetchFp()}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Total Profit */}
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm mb-1">
                    {pickLang(language, { ku: "کۆی قازانج", en: "Total Profit", ar: "إجمالي الربح", zh: "总利润" })}
                  </p>
                  {isLoading ? (
                    <Skeleton className="h-8 w-24 bg-blue-400" />
                  ) : (
                    <p className="text-3xl font-bold">${totalProfit.toLocaleString()}</p>
                  )}
                </div>
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <DollarSign className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Full Package Profit */}
          <Card className={cn("border-l-4 border-l-emerald-500")}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm mb-1">
                    {pickLang(language, { ku: "پاکێجی تەواو", en: "Full Package", ar: "الحزمة الكاملة", zh: "全包服务" })}
                  </p>
                  {isLoading ? (
                    <Skeleton className="h-7 w-20" />
                  ) : (
                    <p className="text-2xl font-bold text-emerald-600">
                      ${profitByType.full_package.toLocaleString()}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {orderCounts.full_package} {pickLang(language, { ku: "ئۆردەر", en: "orders", ar: "طلبات", zh: "订单" })}
                  </p>
                </div>
                <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-950/40 rounded-lg flex items-center justify-center">
                  <Package className="w-5 h-5 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          
          {/* Commission Profit */}
          <Card className={cn("border-l-4 border-l-amber-500")}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm mb-1">
                    {pickLang(language, { ku: "عمولە", en: "Commission", ar: "العمولة", zh: "佣金" })}
                  </p>
                  {isLoading ? (
                    <Skeleton className="h-7 w-20" />
                  ) : (
                    <p className="text-2xl font-bold text-amber-600">
                      ${profitByType.commission.toLocaleString()}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {orderCounts.commission} {pickLang(language, { ku: "ئۆردەر", en: "orders", ar: "طلبات", zh: "订单" })}
                  </p>
                </div>
                <div className="w-10 h-10 bg-amber-100 dark:bg-amber-950/40 rounded-lg flex items-center justify-center">
                  <Handshake className="w-5 h-5 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Profit Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChartIcon className="w-5 h-5" />
                {pickLang(language, { ku: "دابەشبوونی قازانج", en: "Profit Distribution", ar: "توزيع الأرباح", zh: "利润分布" })}
              </CardTitle>
              <CardDescription>
                {pickLang(language, { ku: "ڕێژەی قازانج بەپێی جۆری ئۆردەر", en: "Profit percentage by order type", ar: "نسبة الربح حسب نوع الطلب", zh: "按订单类型划分的利润百分比" })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center h-40">
                  <Skeleton className="w-32 h-32 rounded-full" />
                </div>
              ) : (
                <DonutChart data={chartData} total={totalProfit} totalLabel={pickLang(language, { ku: "کۆی گشتی", en: "Total", ar: "الإجمالي", zh: "总计" })} />
              )}
            </CardContent>
          </Card>
          
          {/* Profit Comparison */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                {pickLang(language, { ku: "بەراوردی قازانج", en: "Profit Comparison", ar: "مقارنة الأرباح", zh: "利润对比" })}
              </CardTitle>
              <CardDescription>
                {pickLang(language, { ku: "بەراوردکردنی قازانجی هەر جۆرێک", en: "Compare profit across order types", ar: "مقارنة الأرباح بين أنواع الطلبات", zh: "比较各订单类型的利润" })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : (
                <SimpleBarChart data={chartData} />
              )}
            </CardContent>
          </Card>
        </div>
        
        {/* Monthly Breakdown Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              {pickLang(language, { ku: "ڕاپۆرتی مانگانە", en: "Monthly Report", ar: "التقرير الشهري", zh: "月度报告" })}
            </CardTitle>
            <CardDescription>
              {pickLang(language, { ku: "قازانج بەپێی مانگ و جۆری ئۆردەر", en: "Profit by month and order type", ar: "الأرباح حسب الشهر ونوع الطلب", zh: "按月份和订单类型划分的利润" })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map(i => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : monthlyBreakdown.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {pickLang(language, { ku: "هیچ داتایەک نییە", en: "No data available", ar: "لا توجد بيانات متاحة", zh: "暂无数据" })}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{pickLang(language, { ku: "مانگ", en: "Month", ar: "الشهر", zh: "月份" })}</TableHead>
                      <TableHead className="text-right text-emerald-600">
                        {pickLang(language, { ku: "پاکێجی تەواو", en: "Full Package", ar: "الحزمة الكاملة", zh: "全包服务" })}
                      </TableHead>
                      <TableHead className="text-right text-purple-600">
                        {pickLang(language, { ku: "داواکاری کڕین", en: "Purchase Request", ar: "طلب الشراء", zh: "采购请求" })}
                      </TableHead>
                      <TableHead className="text-right text-amber-600">
                        {pickLang(language, { ku: "عمولە", en: "Commission", ar: "العمولة", zh: "佣金" })}
                      </TableHead>
                      <TableHead className="text-right font-bold">
                        {pickLang(language, { ku: "کۆی گشتی", en: "Total", ar: "الإجمالي", zh: "总计" })}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthlyBreakdown.map((row) => (
                      <TableRow key={row.month}>
                        <TableCell className="font-medium">{row.monthLabel}</TableCell>
                        <TableCell className="text-right">
                          <span className="text-emerald-600">${row.full_package.toLocaleString()}</span>
                        </TableCell>

                        <TableCell className="text-right">
                          <span className="text-amber-600">${row.commission.toLocaleString()}</span>
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          ${row.total.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
