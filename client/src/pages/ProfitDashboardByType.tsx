import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { pickLang } from "@/lib/lang";
import { useTranslation } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, TrendingUp, Package, ShoppingCart, HandCoins, Calendar, FileDown, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const COLORS = {
  full_package: "#10b981", // emerald-500
  commission: "#f59e0b", // amber-500
};

const orderTypeLabelMap: Record<string, { ku: string; en: string; ar: string; zh: string }> = {
  full_package: { ku: "پاکێجی تەواو", en: "Full Package", ar: "الباقة الكاملة", zh: "全包套餐" },
  commission: { ku: "کڕین بە تێچوو", en: "Buy at Cost", ar: "الشراء بالتكلفة", zh: "代购按成本" },
};

export default function ProfitDashboardByType() {
  const { language } = useTranslation();
  const orderTypeLabel = (orderType: string) =>
    orderTypeLabelMap[orderType] ? pickLang(language, orderTypeLabelMap[orderType]) : orderType;

  const [dateRange, setDateRange] = useState<string>("all");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");

  const { data: profitData, isLoading } = trpc.fullPackage.getProfitSummaryByType.useQuery();

  const profitByType = profitData?.byType || [];

  const exportToExcel = () => {
    if (profitByType.length === 0) return;
    
    // Prepare data for Excel
    const data = profitByType.map(item => ({
      [pickLang(language, { ku: "جۆری ئۆردەر", en: "Order Type", ar: "نوع الطلب", zh: "订单类型" })]: orderTypeLabel(item.orderType),
      [pickLang(language, { ku: "ژمارەی ئۆردەرەکان", en: "Number of Orders", ar: "عدد الطلبات", zh: "订单数量" })]: item.totalOrders,
      [pickLang(language, { ku: "کۆی قازانج ($)", en: "Total Profit ($)", ar: "إجمالي الربح ($)", zh: "总利润 ($)" })]: Number(item.totalProfit || 0).toFixed(2),
      [pickLang(language, { ku: "ناوەندی قازانج ($)", en: "Average Profit ($)", ar: "متوسط الربح ($)", zh: "平均利润 ($)" })]: Number(item.avgProfit || 0).toFixed(2),
    }));

    // Convert to CSV
    const headers = Object.keys(data[0]);
    const csv = [
      headers.join(","),
      ...data.map(row => headers.map(header => row[header as keyof typeof row]).join(","))
    ].join("\n");

    // Download
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `profit-report-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const exportToPDF = () => {
    window.print();
  };

  // Calculate totals
  const totalProfit = Number(profitByType.reduce((sum, item) => sum + (item.totalProfit || 0), 0));
  const totalOrders = Number(profitByType.reduce((sum, item) => sum + (item.totalOrders || 0), 0));

  // Prepare chart data
  const barChartData = profitByType.map(item => ({
    name: orderTypeLabel(item.orderType),
    profit: Number(item.totalProfit || 0),
    orderType: item.orderType,
  }));

  const pieChartData = profitByType.map(item => ({
    name: orderTypeLabel(item.orderType),
    value: Number(item.totalProfit || 0),
    orderType: item.orderType,
  }));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-l from-emerald-600 to-emerald-700 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl">
                <TrendingUp className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">{pickLang(language, { ku: "داشبۆردی قازانج", en: "Profit Dashboard", ar: "لوحة الأرباح", zh: "利润仪表板" })}</h1>
                <p className="text-emerald-100">{pickLang(language, { ku: "قازانج بە جۆری ئۆردەر", en: "Profit by Order Type", ar: "الربح حسب نوع الطلب", zh: "按订单类型的利润" })}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5" />
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-[200px] bg-white/10 border-white/20 text-white">
                  <SelectValue placeholder={pickLang(language, { ku: "هەڵبژاردنی ماوە", en: "Select period", ar: "اختر الفترة", zh: "选择时间段" })} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{pickLang(language, { ku: "هەموو کاتەکان", en: "All time", ar: "كل الأوقات", zh: "全部时间" })}</SelectItem>
                  <SelectItem value="today">{pickLang(language, { ku: "ئەمڕۆ", en: "Today", ar: "اليوم", zh: "今天" })}</SelectItem>
                  <SelectItem value="this_week">{pickLang(language, { ku: "ئەم هەفتەیە", en: "This week", ar: "هذا الأسبوع", zh: "本周" })}</SelectItem>
                  <SelectItem value="this_month">{pickLang(language, { ku: "ئەم مانگە", en: "This month", ar: "هذا الشهر", zh: "本月" })}</SelectItem>
                  <SelectItem value="this_year">{pickLang(language, { ku: "ئەم ساڵە", en: "This year", ar: "هذه السنة", zh: "今年" })}</SelectItem>
                  <SelectItem value="custom">{pickLang(language, { ku: "ماوەی دیاریکراو", en: "Custom range", ar: "نطاق مخصص", zh: "自定义范围" })}</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={exportToExcel}
                variant="outline"
                size="sm"
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                <FileDown className="h-4 w-4 me-2" />
                Excel
              </Button>
              <Button
                onClick={exportToPDF}
                variant="outline"
                size="sm"
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                <FileText className="h-4 w-4 me-2" />
                PDF
              </Button>
            </div>
          </div>
          {dateRange === "custom" && (
            <div className="mt-4 flex gap-3">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
                placeholder={pickLang(language, { ku: "لە بەرواری", en: "From date", ar: "من تاريخ", zh: "起始日期" })}
              />
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
                placeholder={pickLang(language, { ku: "بۆ بەرواری", en: "To date", ar: "إلى تاريخ", zh: "结束日期" })}
              />
            </div>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-emerald-600 font-medium">{pickLang(language, { ku: "کۆی قازانج", en: "Total Profit", ar: "إجمالي الربح", zh: "总利润" })}</p>
                  <p className="text-2xl font-bold text-emerald-700">${(totalProfit || 0).toFixed(2)}</p>
                </div>
                <div className="p-3 bg-emerald-100 rounded-xl">
                  <DollarSign className="h-6 w-6 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600 font-medium">{pickLang(language, { ku: "کۆی ئۆردەرەکان", en: "Total Orders", ar: "إجمالي الطلبات", zh: "订单总数" })}</p>
                  <p className="text-2xl font-bold text-blue-700">{totalOrders}</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-xl">
                  <Package className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          {profitByType.map(item => {
            const Icon = item.orderType === "full_package" ? ShoppingCart : HandCoins;
            const colorClass = item.orderType === "full_package" ? "emerald" : "amber";
            
            return (
              <Card key={item.orderType} className={`bg-gradient-to-br from-${colorClass}-50 to-white border-${colorClass}-200`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-sm text-${colorClass}-600 font-medium`}>{orderTypeLabel(item.orderType)}</p>
                      <p className="text-2xl font-bold text-${colorClass}-700">${Number(item.totalProfit || 0).toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">{item.totalOrders} {pickLang(language, { ku: "ئۆردەر", en: "orders", ar: "طلبات", zh: "订单" })}</p>
                    </div>
                    <div className={`p-3 bg-${colorClass}-100 rounded-xl`}>
                      <Icon className={`h-6 w-6 text-${colorClass}-600`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Bar Chart */}
          <Card>
            <CardHeader>
              <CardTitle>{pickLang(language, { ku: "قازانج بە جۆری ئۆردەر", en: "Profit by Order Type", ar: "الربح حسب نوع الطلب", zh: "按订单类型的利润" })}</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-80 w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={barChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="profit" name={pickLang(language, { ku: "قازانج", en: "Profit", ar: "الربح", zh: "利润" })} fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Pie Chart */}
          <Card>
            <CardHeader>
              <CardTitle>{pickLang(language, { ku: "ڕێژەی قازانج بە جۆری ئۆردەر", en: "Profit Share by Order Type", ar: "نسبة الربح حسب نوع الطلب", zh: "按订单类型的利润占比" })}</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-80 w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => `${entry.name}: $${Number(entry.value || 0).toFixed(2)}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pieChartData.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[entry.orderType as keyof typeof COLORS]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Detailed Table */}
        <Card className="print:shadow-none">
          <CardHeader>
            <CardTitle>{pickLang(language, { ku: "وردەکاریەکان", en: "Details", ar: "التفاصيل", zh: "详细信息" })}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : (
              <div className="space-y-4">
                {profitByType.map((item: any) => (
                  <div key={item.orderType} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className={`w-4 h-4 rounded-full`} style={{ backgroundColor: COLORS[item.orderType as keyof typeof COLORS] }}></div>
                      <div>
                        <p className="font-medium">{orderTypeLabel(item.orderType)}</p>
                        <p className="text-sm text-muted-foreground">{item.totalOrders} {pickLang(language, { ku: "ئۆردەر", en: "orders", ar: "طلبات", zh: "订单" })}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-emerald-600">${Number(item.totalProfit || 0).toFixed(2)}</p>
                      <p className="text-sm text-muted-foreground">
                        {pickLang(language, { ku: "ناوەندی", en: "Average", ar: "المتوسط", zh: "平均" })}: ${Number(item.avgProfit || 0).toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
