import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
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

// Helper function to get month name in Kurdish
const getKurdishMonth = (month: number) => {
  const months = [
    'کانوونی دووەم', 'شوبات', 'ئازار', 'نیسان', 'ئایار', 'حوزەیران',
    'تەممووز', 'ئاب', 'ئەیلوول', 'تشرینی یەکەم', 'تشرینی دووەم', 'کانوونی یەکەم'
  ];
  return months[month] || '';
};

export default function BusinessAnalytics() {
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
    return customer?.fullNameKurdish || customer?.fullName || 'نەناسراو';
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
    csv += 'ڕاپۆرتی شیکاری بازرگانی\n\n';
    
    // Profit by type
    csv += 'قازانج بە جۆر\n';
    csv += 'جۆر,ژمارە,کۆی قازانج,تێکڕای قازانج\n';
    csv += `فول پاکێج,${profitByType?.fullPackage?.count || 0},${profitByType?.fullPackage?.totalProfit || 0},${profitByType?.fullPackage?.avgProfit?.toFixed(2) || 0}\n`;
    csv += `کڕین بە عمولە,${profitByType?.commission?.count || 0},${profitByType?.commission?.totalProfit || 0},${profitByType?.commission?.avgProfit?.toFixed(2) || 0}\n`;
    csv += `پاکەتی ئاسایی,${profitByType?.packages?.count || 0},${profitByType?.packages?.totalRevenue || 0},-\n\n`;
    
    // Top customers
    csv += 'باشترین کڕیارەکان\n';
    csv += 'کۆد,ناو,کۆی چارج,کۆی پارەدان\n';
    topCustomers?.forEach((c: any) => {
      csv += `${getCustomerCode(c.customerId)},${getCustomerName(c.customerId)},${c.totalCharges},${c.totalPayments}\n`;
    });
    csv += '\n';
    
    // Top debtors
    csv += 'قەرزدارەکان\n';
    csv += 'کۆد,ناو,قەرز\n';
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
                  <h1 className="text-3xl font-bold">شیکاری بازرگانی</h1>
                  <p className="text-white/80 mt-1">ڕاپۆرتی تەواوی قازانج، کڕیار، و قەرزداران</p>
                </div>
              </div>
              <Button 
                variant="secondary" 
                className="bg-white/20 hover:bg-white/30 text-white border-0"
                onClick={exportToCSV}
              >
                <Download className="h-4 w-4 ms-2" />
                هەناردەکردن
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
                  <p className="text-sm text-muted-foreground">کۆی قازانج</p>
                  <p className="text-3xl font-bold text-emerald-700">{formatCurrency(totalProfit)}</p>
                </div>
                <div className="rounded-xl bg-emerald-100 p-3">
                  <TrendingUp className="h-6 w-6 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-cyan-50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">کۆی ئۆردەرەکان</p>
                  <p className="text-3xl font-bold text-blue-700">{totalOrders}</p>
                </div>
                <div className="rounded-xl bg-blue-100 p-3">
                  <Package className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-amber-50 to-orange-50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">کۆی قەرز</p>
                  <p className="text-3xl font-bold text-amber-700">{formatCurrency(financialSummary?.totalDebtUsd || 0)}</p>
                </div>
                <div className="rounded-xl bg-amber-100 p-3">
                  <Wallet className="h-6 w-6 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-rose-50 to-pink-50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">قەرزدارەکان</p>
                  <p className="text-3xl font-bold text-rose-700">{financialSummary?.debtorsCount || 0}</p>
                </div>
                <div className="rounded-xl bg-rose-100 p-3">
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
                قازانج بە جۆری پاکەت
              </CardTitle>
              <CardDescription>شیکاری قازانج بۆ هەر جۆرێکی پاکەت</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Full Package */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-purple-50 border border-purple-100">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-purple-100 p-2">
                      <Boxes className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-purple-900">فول پاکێج</p>
                      <p className="text-sm text-purple-600">{profitByType?.fullPackage?.count || 0} ئۆردەر</p>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="text-xl font-bold text-purple-700">{formatCurrency(profitByType?.fullPackage?.totalProfit || 0)}</p>
                    <p className="text-xs text-purple-500">تێکڕا: {formatCurrency(profitByType?.fullPackage?.avgProfit || 0)}</p>
                  </div>
                </div>

                {/* Commission */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-orange-50 border border-orange-100">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-orange-100 p-2">
                      <Percent className="h-5 w-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-orange-900">کڕین بە عمولە</p>
                      <p className="text-sm text-orange-600">{profitByType?.commission?.count || 0} ئۆردەر</p>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="text-xl font-bold text-orange-700">{formatCurrency(profitByType?.commission?.totalProfit || 0)}</p>
                    <p className="text-xs text-orange-500">تێکڕا: {formatCurrency(profitByType?.commission?.avgProfit || 0)}</p>
                  </div>
                </div>

                {/* Regular Packages */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-slate-100 p-2">
                      <Package className="h-5 w-5 text-slate-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">پاکەتی ئاسایی</p>
                      <p className="text-sm text-slate-600">{profitByType?.packages?.count || 0} پاکەت</p>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="text-xl font-bold text-slate-700">{formatCurrency(profitByType?.packages?.totalRevenue || 0)}</p>
                    <p className="text-xs text-slate-500">داهات</p>
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
                ئاماری پاکەتەکان
              </CardTitle>
              <CardDescription>بارودۆخی پاکەتەکان بە ژمارە</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {packageStats?.map((stat: any, index: number) => {
                  const statusColors: Record<string, { bg: string; text: string; label: string }> = {
                    registered: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'تۆمارکراو' },
                    in_transit: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'لە ڕێگادا' },
                    arrived: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'گەیشتووە' },
                    delivered: { bg: 'bg-green-100', text: 'text-green-700', label: 'گەیەندرا' },
                    customs: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'گومرک' },
                  };
                  const config = statusColors[stat.status] || { bg: 'bg-gray-100', text: 'text-gray-700', label: stat.status };
                  
                  return (
                    <div key={index} className={`flex items-center justify-between p-3 rounded-lg ${config.bg}`}>
                      <span className={`font-medium ${config.text}`}>{config.label}</span>
                      <div className="flex items-center gap-4">
                        <span className={`font-bold ${config.text}`}>{stat.count} پاکەت</span>
                        <span className="text-sm text-muted-foreground">{stat.totalWeight?.toFixed(1)} کگ</span>
                      </div>
                    </div>
                  );
                })}
                {(!packageStats || packageStats.length === 0) && (
                  <p className="text-center text-muted-foreground py-8">هیچ داتایەک نییە</p>
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
                باشترین ١٠ کڕیار
              </CardTitle>
              <CardDescription>بە پێی داهات</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">#</TableHead>
                    <TableHead className="text-right">کڕیار</TableHead>
                    <TableHead className="text-left">کۆی چارج</TableHead>
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
                        هیچ داتایەک نییە
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
                قەرزدارترین ١٠ کڕیار
              </CardTitle>
              <CardDescription>کڕیارانی زۆرترین قەرز</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">#</TableHead>
                    <TableHead className="text-right">کڕیار</TableHead>
                    <TableHead className="text-left">قەرز</TableHead>
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
                          <p className="font-medium">{debtor.customer?.fullNameKurdish || debtor.customer?.fullName || 'نەناسراو'}</p>
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
                        هیچ قەرزدارێک نییە
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
                  ڕەوتی قازانجی مانگانە
                </CardTitle>
                <CardDescription>قازانج و خەرجی لە ماوەی ساڵ</CardDescription>
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
                      {getKurdishMonth(month.month - 1)}
                    </div>
                    <div className="flex-1 h-8 bg-slate-100 rounded-lg overflow-hidden relative">
                      <div 
                        className={`h-full rounded-lg transition-all ${isPositive ? 'bg-emerald-500' : 'bg-red-500'}`}
                        style={{ width: `${barWidth}%` }}
                      />
                      <span className={`absolute inset-0 flex items-center justify-center text-sm font-semibold ${barWidth > 50 ? 'text-white' : 'text-slate-700'}`}>
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
                <p className="text-center text-muted-foreground py-8">هیچ داتایەک نییە بۆ ئەم ساڵە</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
