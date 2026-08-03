import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { useState, useMemo } from "react";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Package, 
  Users, 
  BarChart3,
  PieChart,
  Calendar,
  Download,
  FileText,
  AlertTriangle,
  Crown,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Boxes,
  ShoppingBag,
  Percent,
  Target,
  Award
} from "lucide-react";

// Helper function to format currency
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
};

// Helper function to get localized month name
const MONTH_NAMES: { ku: string; en: string; ar: string; zh: string }[] = [
  { ku: 'کانوونی دووەم', en: 'January', ar: 'يناير', zh: '一月' },
  { ku: 'شوبات', en: 'February', ar: 'فبراير', zh: '二月' },
  { ku: 'ئازار', en: 'March', ar: 'مارس', zh: '三月' },
  { ku: 'نیسان', en: 'April', ar: 'أبريل', zh: '四月' },
  { ku: 'ئایار', en: 'May', ar: 'مايو', zh: '五月' },
  { ku: 'حوزەیران', en: 'June', ar: 'يونيو', zh: '六月' },
  { ku: 'تەممووز', en: 'July', ar: 'يوليو', zh: '七月' },
  { ku: 'ئاب', en: 'August', ar: 'أغسطس', zh: '八月' },
  { ku: 'ئەیلوول', en: 'September', ar: 'سبتمبر', zh: '九月' },
  { ku: 'تشرینی یەکەم', en: 'October', ar: 'أكتوبر', zh: '十月' },
  { ku: 'تشرینی دووەم', en: 'November', ar: 'نوفمبر', zh: '十一月' },
  { ku: 'کانوونی یەکەم', en: 'December', ar: 'ديسمبر', zh: '十二月' },
];
const getMonthName = (language: string, month: number) => {
  const m = MONTH_NAMES[month];
  return m ? pickLang(language, m) : '';
};

export default function BusinessAnalytics() {
  const { language } = useLanguage();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString());
  
  // Fetch data
  const { data: profitByType } = trpc.reports.getProfitByType.useQuery();
  const { data: topCustomers } = trpc.reports.topCustomers.useQuery({ limit: 10 });
  const { data: financialSummary } = trpc.ledger.getSummary.useQuery();
  const { data: debtors } = trpc.ledger.getDebtors.useQuery({ minBalanceUsd: 0 });
  const { data: packageStats } = trpc.reports.packageStats.useQuery();
  const { data: customers } = trpc.customers.list.useQuery();
  const { data: monthlyPnl } = trpc.financialReports.getMonthlyTrend.useQuery({ 
    year: parseInt(selectedYear)
  });

  // Calculate totals
  const totalProfit = useMemo(() => {
    if (!profitByType) return 0;
    return (profitByType.fullPackage?.totalProfit || 0) + 
           (profitByType.commission?.totalProfit || 0) +
           (profitByType.packages?.totalRevenue || 0);
  }, [profitByType]);

  const totalOrders = useMemo(() => {
    if (!profitByType) return 0;
    return (profitByType.fullPackage?.count || 0) + 
           (profitByType.commission?.count || 0) +
           (profitByType.packages?.count || 0);
  }, [profitByType]);

  // Get customer name helper
  const getCustomerName = (customerId: number) => {
    const customer = customers?.find(c => c.id === customerId);
    return customer?.fullNameKurdish || customer?.fullName || pickLang(language, { ku: 'نەناسراو', en: 'Unknown', ar: 'غير معروف', zh: '未知' });
  };

  const getCustomerCode = (customerId: number) => {
    const customer = customers?.find(c => c.id === customerId);
    return customer?.customerCode || '';
  };

  // Top 10 debtors
  const topDebtors = useMemo(() => {
    if (!debtors) return [];
    return [...debtors]
      .sort((a, b) => b.balanceUsd - a.balanceUsd)
      .slice(0, 10);
  }, [debtors]);

  // Export to CSV
  const exportToCSV = () => {
    let csv = '\uFEFF'; // UTF-8 BOM
    csv += pickLang(language, { ku: 'ڕاپۆرتی شیکاری بازرگانی', en: 'Business Analytics Report', ar: 'تقرير التحليلات التجارية', zh: '商业分析报告' }) + '\n\n';

    // Profit by type
    csv += pickLang(language, { ku: 'قازانج بە جۆر', en: 'Profit by Type', ar: 'الربح حسب النوع', zh: '按类型分类的利润' }) + '\n';
    csv += pickLang(language, { ku: 'جۆر,ژمارە,کۆی قازانج,تێکڕای قازانج', en: 'Type,Count,Total Profit,Average Profit', ar: 'النوع,العدد,إجمالي الربح,متوسط الربح', zh: '类型,数量,总利润,平均利润' }) + '\n';
    csv += `${pickLang(language, { ku: 'پاکێجی تەواو', en: 'Full Package', ar: 'الباقة الكاملة', zh: '全套服务' })},${profitByType?.fullPackage?.count || 0},${profitByType?.fullPackage?.totalProfit || 0},${profitByType?.fullPackage?.avgProfit?.toFixed(2) || 0}\n`;
    csv += `${pickLang(language, { ku: 'کڕین بە تێچوو', en: 'Cost-based Purchase', ar: 'الشراء بالتكلفة', zh: '按成本采购' })},${profitByType?.commission?.count || 0},${profitByType?.commission?.totalProfit || 0},${profitByType?.commission?.avgProfit?.toFixed(2) || 0}\n`;
    csv += `${pickLang(language, { ku: 'پاکەتی ئاسایی', en: 'Regular Package', ar: 'الطرد العادي', zh: '普通包裹' })},${profitByType?.packages?.count || 0},${profitByType?.packages?.totalRevenue || 0},-\n\n`;

    // Top customers
    csv += pickLang(language, { ku: 'باشترین کڕیارەکان', en: 'Top Customers', ar: 'أفضل العملاء', zh: '顶级客户' }) + '\n';
    csv += pickLang(language, { ku: 'کۆد,ناو,کۆی چارج,کۆی پارەدان', en: 'Code,Name,Total Charges,Total Payments', ar: 'الرمز,الاسم,إجمالي الرسوم,إجمالي المدفوعات', zh: '编码,姓名,总费用,总付款' }) + '\n';
    topCustomers?.forEach((c: any) => {
      csv += `${getCustomerCode(c.customerId)},${getCustomerName(c.customerId)},${c.totalCharges},${c.totalPayments}\n`;
    });
    csv += '\n';

    // Top debtors
    csv += pickLang(language, { ku: 'قەرزدارەکان', en: 'Debtors', ar: 'المدينون', zh: '欠款客户' }) + '\n';
    csv += pickLang(language, { ku: 'کۆد,ناو,قەرز', en: 'Code,Name,Debt', ar: 'الرمز,الاسم,الدين', zh: '编码,姓名,欠款' }) + '\n';
    topDebtors.forEach(d => {
      csv += `${d.customer?.customerCode || ''},${d.customer?.fullNameKurdish || d.customer?.fullName || ''},${d.balanceUsd}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `business-analytics-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 p-8 text-white">
          <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,rgba(255,255,255,0.5))]"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="rounded-xl bg-white/20 p-3 backdrop-blur-sm">
                  <BarChart3 className="h-8 w-8" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold">{pickLang(language, { ku: 'شیکاری بازرگانی', en: 'Business Analytics', ar: 'التحليلات التجارية', zh: '商业分析' })}</h1>
                  <p className="text-white/80 mt-1">{pickLang(language, { ku: 'ڕاپۆرتی تەواوی قازانج، کڕیار، و قەرزداران', en: 'Complete report of profit, customers, and debtors', ar: 'تقرير كامل للأرباح والعملاء والمدينين', zh: '利润、客户和欠款客户的完整报告' })}</p>
                </div>
              </div>
              <Button 
                variant="secondary" 
                className="bg-white/20 hover:bg-white/30 text-white border-0"
                onClick={exportToCSV}
              >
                <Download className="h-4 w-4 ms-2" />
                {pickLang(language, { ku: 'هەناردەکردن', en: 'Export', ar: 'تصدير', zh: '导出' })}
              </Button>
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-0 shadow-lg bg-gradient-to-br from-emerald-50 to-teal-50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{pickLang(language, { ku: 'کۆی قازانج', en: 'Total Profit', ar: 'إجمالي الربح', zh: '总利润' })}</p>
                  <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-300">{formatCurrency(totalProfit)}</p>
                </div>
                <div className="rounded-xl bg-emerald-100 dark:bg-emerald-950/40 p-3">
                  <TrendingUp className="h-6 w-6 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-cyan-50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{pickLang(language, { ku: 'کۆی ئۆردەرەکان', en: 'Total Orders', ar: 'إجمالي الطلبات', zh: '订单总数' })}</p>
                  <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">{totalOrders}</p>
                </div>
                <div className="rounded-xl bg-blue-100 dark:bg-blue-950/40 p-3">
                  <Package className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-amber-50 to-orange-50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{pickLang(language, { ku: 'کۆی قەرز', en: 'Total Debt', ar: 'إجمالي الدين', zh: '欠款总额' })}</p>
                  <p className="text-3xl font-bold text-amber-700 dark:text-amber-300">{formatCurrency(financialSummary?.totalDebtUsd || 0)}</p>
                </div>
                <div className="rounded-xl bg-amber-100 dark:bg-amber-950/40 p-3">
                  <Wallet className="h-6 w-6 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-rose-50 to-pink-50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{pickLang(language, { ku: 'قەرزدارەکان', en: 'Debtors', ar: 'المدينون', zh: '欠款客户' })}</p>
                  <p className="text-3xl font-bold text-rose-700 dark:text-rose-300">{financialSummary?.debtorsCount || 0}</p>
                </div>
                <div className="rounded-xl bg-rose-100 dark:bg-rose-950/40 p-3">
                  <Users className="h-6 w-6 text-rose-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Profit by Type */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5 text-purple-600" />
                {pickLang(language, { ku: 'قازانج بە جۆری پاکەت', en: 'Profit by Package Type', ar: 'الربح حسب نوع الطرد', zh: '按包裹类型分类的利润' })}
              </CardTitle>
              <CardDescription>{pickLang(language, { ku: 'شیکاری قازانج بۆ هەر جۆرێکی پاکەت', en: 'Profit analysis for each package type', ar: 'تحليل الربح لكل نوع من أنواع الطرود', zh: '每种包裹类型的利润分析' })}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Full Package */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-800/60">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-purple-100 dark:bg-purple-950/40 p-2">
                      <Boxes className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-purple-900 dark:text-purple-200">{pickLang(language, { ku: 'پاکێجی تەواو', en: 'Full Package', ar: 'الباقة الكاملة', zh: '全套服务' })}</p>
                      <p className="text-sm text-purple-600">{profitByType?.fullPackage?.count || 0} {pickLang(language, { ku: 'ئۆردەر', en: 'orders', ar: 'طلب', zh: '订单' })}</p>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="text-xl font-bold text-purple-700 dark:text-purple-300">{formatCurrency(profitByType?.fullPackage?.totalProfit || 0)}</p>
                    <p className="text-xs text-purple-500">{pickLang(language, { ku: 'تێکڕا', en: 'Avg', ar: 'المتوسط', zh: '平均' })}: {formatCurrency(profitByType?.fullPackage?.avgProfit || 0)}</p>
                  </div>
                </div>

                {/* Commission */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-orange-50 dark:bg-orange-950/40 border border-orange-100 dark:border-orange-800/60">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-orange-100 dark:bg-orange-950/40 p-2">
                      <Percent className="h-5 w-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-orange-900 dark:text-orange-200">{pickLang(language, { ku: 'کڕین بە تێچوو', en: 'Cost-based Purchase', ar: 'الشراء بالتكلفة', zh: '按成本采购' })}</p>
                      <p className="text-sm text-orange-600">{profitByType?.commission?.count || 0} {pickLang(language, { ku: 'ئۆردەر', en: 'orders', ar: 'طلب', zh: '订单' })}</p>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="text-xl font-bold text-orange-700 dark:text-orange-300">{formatCurrency(profitByType?.commission?.totalProfit || 0)}</p>
                    <p className="text-xs text-orange-500">{pickLang(language, { ku: 'تێکڕا', en: 'Avg', ar: 'المتوسط', zh: '平均' })}: {formatCurrency(profitByType?.commission?.avgProfit || 0)}</p>
                  </div>
                </div>

                {/* Regular Packages */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/60">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-slate-100 dark:bg-slate-950/40 p-2">
                      <Package className="h-5 w-5 text-slate-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-slate-200">{pickLang(language, { ku: 'پاکەتی ئاسایی', en: 'Regular Package', ar: 'الطرد العادي', zh: '普通包裹' })}</p>
                      <p className="text-sm text-slate-600">{profitByType?.packages?.count || 0} {pickLang(language, { ku: 'پاکەت', en: 'packages', ar: 'طرد', zh: '包裹' })}</p>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="text-xl font-bold text-slate-700 dark:text-slate-300">{formatCurrency(profitByType?.packages?.totalRevenue || 0)}</p>
                    <p className="text-xs text-slate-500">{pickLang(language, { ku: 'داهات', en: 'Revenue', ar: 'الإيراد', zh: '收入' })}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Package Stats */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-blue-600" />
                {pickLang(language, { ku: 'ئاماری پاکەتەکان', en: 'Package Statistics', ar: 'إحصائيات الطرود', zh: '包裹统计' })}
              </CardTitle>
              <CardDescription>{pickLang(language, { ku: 'بارودۆخی پاکەتەکان بە ژمارە', en: 'Package status by count', ar: 'حالة الطرود حسب العدد', zh: '按数量统计的包裹状态' })}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {packageStats?.map((stat: any, index: number) => {
                  const statusColors: Record<string, { bg: string; text: string; label: string }> = {
                    registered: { bg: 'bg-blue-100 dark:bg-blue-950/40', text: 'text-blue-700 dark:text-blue-300', label: pickLang(language, { ku: 'تۆمارکراو', en: 'Registered', ar: 'مسجل', zh: '已登记' }) },
                    in_transit: { bg: 'bg-amber-100 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-300', label: pickLang(language, { ku: 'لە ڕێگادا', en: 'In Transit', ar: 'في الطريق', zh: '运输中' }) },
                    arrived: { bg: 'bg-purple-100 dark:bg-purple-950/40', text: 'text-purple-700 dark:text-purple-300', label: pickLang(language, { ku: 'گەیشتووە', en: 'Arrived', ar: 'وصل', zh: '已到达' }) },
                    delivered: { bg: 'bg-green-100 dark:bg-green-950/40', text: 'text-green-700 dark:text-green-300', label: pickLang(language, { ku: 'گەیەندرا', en: 'Delivered', ar: 'تم التسليم', zh: '已送达' }) },
                    customs: { bg: 'bg-orange-100 dark:bg-orange-950/40', text: 'text-orange-700 dark:text-orange-300', label: pickLang(language, { ku: 'گومرک', en: 'Customs', ar: 'الجمارك', zh: '海关' }) },
                  };
                  const config = statusColors[stat.status] || { bg: 'bg-gray-100 dark:bg-gray-950/40', text: 'text-gray-700 dark:text-gray-300', label: stat.status };
                  
                  return (
                    <div key={index} className={`flex items-center justify-between p-3 rounded-lg ${config.bg}`}>
                      <span className={`font-medium ${config.text}`}>{config.label}</span>
                      <div className="flex items-center gap-4">
                        <span className={`font-bold ${config.text}`}>{stat.count} {pickLang(language, { ku: 'پاکەت', en: 'packages', ar: 'طرد', zh: '包裹' })}</span>
                        <span className="text-sm text-muted-foreground">{stat.totalWeight?.toFixed(1)} {pickLang(language, { ku: 'کگ', en: 'kg', ar: 'كغ', zh: '公斤' })}</span>
                      </div>
                    </div>
                  );
                })}
                {(!packageStats || packageStats.length === 0) && (
                  <p className="text-center text-muted-foreground py-8">{pickLang(language, { ku: 'هیچ داتایەک نییە', en: 'No data', ar: 'لا توجد بيانات', zh: '暂无数据' })}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top Customers & Debtors */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Top Customers */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-amber-500" />
                {pickLang(language, { ku: 'باشترین ١٠ کڕیار', en: 'Top 10 Customers', ar: 'أفضل 10 عملاء', zh: '前10名客户' })}
              </CardTitle>
              <CardDescription>{pickLang(language, { ku: 'بە پێی داهات', en: 'By revenue', ar: 'حسب الإيراد', zh: '按收入' })}</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">#</TableHead>
                    <TableHead className="text-right">{pickLang(language, { ku: 'کڕیار', en: 'Customer', ar: 'العميل', zh: '客户' })}</TableHead>
                    <TableHead className="text-left">{pickLang(language, { ku: 'کۆی چارج', en: 'Total Charges', ar: 'إجمالي الرسوم', zh: '总费用' })}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topCustomers?.slice(0, 10).map((customer: any, index: number) => (
                    <TableRow key={customer.customerId}>
                      <TableCell>
                        {index < 3 ? (
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                            index === 0 ? 'bg-amber-500' : index === 1 ? 'bg-slate-400' : 'bg-amber-700'
                          }`}>
                            {index + 1}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">{index + 1}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{getCustomerName(customer.customerId)}</p>
                          <p className="text-xs text-muted-foreground font-mono">{getCustomerCode(customer.customerId)}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-left font-mono font-semibold text-emerald-600">
                        {formatCurrency(Number(customer.totalCharges) || 0)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!topCustomers || topCustomers.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                        {pickLang(language, { ku: 'هیچ داتایەک نییە', en: 'No data', ar: 'لا توجد بيانات', zh: '暂无数据' })}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Top Debtors */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                {pickLang(language, { ku: 'قەرزدارترین ١٠ کڕیار', en: 'Top 10 Debtors', ar: 'أكبر 10 مدينين', zh: '前10名欠款客户' })}
              </CardTitle>
              <CardDescription>{pickLang(language, { ku: 'کڕیارانی زۆرترین قەرز', en: 'Customers with the most debt', ar: 'العملاء الأكثر مديونية', zh: '欠款最多的客户' })}</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">#</TableHead>
                    <TableHead className="text-right">{pickLang(language, { ku: 'کڕیار', en: 'Customer', ar: 'العميل', zh: '客户' })}</TableHead>
                    <TableHead className="text-left">{pickLang(language, { ku: 'قەرز', en: 'Debt', ar: 'الدين', zh: '欠款' })}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topDebtors.map((debtor, index) => (
                    <TableRow key={debtor.customerId}>
                      <TableCell>
                        <span className={`${index < 3 ? 'text-red-600 font-bold' : 'text-muted-foreground'}`}>
                          {index + 1}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{debtor.customer?.fullNameKurdish || debtor.customer?.fullName || pickLang(language, { ku: 'نەناسراو', en: 'Unknown', ar: 'غير معروف', zh: '未知' })}</p>
                          <p className="text-xs text-muted-foreground font-mono">{debtor.customer?.customerCode || ''}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-left font-mono font-semibold text-red-600">
                        {formatCurrency(debtor.balanceUsd)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {topDebtors.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                        {pickLang(language, { ku: 'هیچ قەرزدارێک نییە', en: 'No debtors', ar: 'لا يوجد مدينون', zh: '无欠款客户' })}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Monthly Profit Trend */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                  {pickLang(language, { ku: 'ڕەوتی قازانجی مانگانە', en: 'Monthly Profit Trend', ar: 'اتجاه الربح الشهري', zh: '月度利润趋势' })}
                </CardTitle>
                <CardDescription>{pickLang(language, { ku: 'قازانج و خەرجی لە ماوەی ساڵ', en: 'Profit and expenses over the year', ar: 'الربح والمصروفات على مدار السنة', zh: '全年利润与支出' })}</CardDescription>
              </div>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2024">٢٠٢٤</SelectItem>
                  <SelectItem value="2025">٢٠٢٥</SelectItem>
                  <SelectItem value="2026">٢٠٢٦</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {monthlyPnl?.map((month: any, index: number) => {
                const profit = month.netProfit || 0;
                const isPositive = profit >= 0;
                const maxProfit = Math.max(...(monthlyPnl?.map((m: any) => Math.abs(m.netProfit || 0)) || [1]));
                const barWidth = maxProfit > 0 ? Math.abs(profit) / maxProfit * 100 : 0;
                
                return (
                  <div key={index} className="flex items-center gap-4">
                    <div className="w-24 text-sm font-medium text-right">
                      {getMonthName(language, month.month - 1)}
                    </div>
                    <div className="flex-1 h-8 bg-slate-100 dark:bg-slate-950/40 rounded-lg overflow-hidden relative">
                      <div 
                        className={`h-full rounded-lg transition-all ${isPositive ? 'bg-emerald-500' : 'bg-red-500'}`}
                        style={{ width: `${barWidth}%` }}
                      />
                      <span className={`absolute inset-0 flex items-center justify-center text-sm font-semibold ${barWidth > 50 ? 'text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                        {formatCurrency(profit)}
                      </span>
                    </div>
                    <div className="w-8">
                      {isPositive ? (
                        <ArrowUpRight className="h-5 w-5 text-emerald-500" />
                      ) : (
                        <ArrowDownRight className="h-5 w-5 text-red-500" />
                      )}
                    </div>
                  </div>
                );
              })}
              {(!monthlyPnl || monthlyPnl.length === 0) && (
                <p className="text-center text-muted-foreground py-8">{pickLang(language, { ku: 'هیچ داتایەک نییە بۆ ئەم ساڵە', en: 'No data for this year', ar: 'لا توجد بيانات لهذه السنة', zh: '本年度暂无数据' })}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
