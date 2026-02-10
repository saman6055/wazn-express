import { useState } from "react";
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
} from "lucide-react";
import * as XLSX from 'xlsx';

const monthNames = [
  "کانوونی دووەم", "شوبات", "ئازار", "نیسان", "ئایار", "حوزەیران",
  "تەممووز", "ئاب", "ئەیلوول", "تشرینی یەکەم", "تشرینی دووەم", "کانوونی یەکەم"
];

const monthNamesEn = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function ProfitReports() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedOrderType, setSelectedOrderType] = useState<string>("all");
  
  // Fetch monthly report
  const { data: monthlyReport, isLoading: monthlyLoading } = trpc.fullPackage.getMonthlyProfitReport.useQuery({
    year: selectedYear,
  });
  
  // Fetch profit by order type
  const { data: profitByType, isLoading: typeLoading } = trpc.fullPackage.getProfitByOrderType.useQuery({});
  
  // Fetch detailed profit report
  const { data: detailedReport, isLoading: detailedLoading } = trpc.fullPackage.getProfitReport.useQuery({
    orderType: selectedOrderType !== "all" ? selectedOrderType as any : undefined,
  });
  
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  };
  
  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  const exportToExcel = () => {
    if (!monthlyReport?.months) return;
    
    const data = monthlyReport.months.map((month) => ({
      'مانگ': monthNames[month.month - 1],
      'Month': monthNamesEn[month.month - 1],
      'فول پاکێج - قازانج': month.fullPackage.profit,
      'فول پاکێج - ژمارە': month.fullPackage.count,
      'کۆمیشن - قازانج': month.commission.profit,
      'کۆمیشن - ژمارە': month.commission.count,
      'پاکەت - داهات': month.packages.revenue,
      'پاکەت - ژمارە': month.packages.count,
      'کۆی قازانج': month.total.profit,
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ڕاپۆرتی قازانج');
    XLSX.writeFile(wb, `profit-report-${selectedYear}.xlsx`);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="bg-gradient-to-l from-violet-600 to-violet-700 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl">
                <BarChart3 className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">ڕاپۆرتی قازانج</h1>
                <p className="text-violet-100">شیکردنەوەی قازانج و داهات بەپێی جۆر و مانگ</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={exportToExcel}
                variant="outline"
                className="bg-white/20 border-white/30 text-white hover:bg-white/30"
              >
                <Download className="h-4 w-4 ml-2" />
                Excel
              </Button>
              <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(Number(v))}>
                <SelectTrigger className="w-32 bg-white/20 border-white/30 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        {monthlyReport && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-emerald-600 font-medium">کۆی قازانج</p>
                    <p className="text-2xl font-bold text-emerald-700">
                      {formatCurrency(monthlyReport.yearSummary.totalProfit)}
                    </p>
                  </div>
                  <div className="p-3 bg-emerald-200 rounded-xl">
                    <TrendingUp className="h-6 w-6 text-emerald-700" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-blue-600 font-medium">کۆی داهات</p>
                    <p className="text-2xl font-bold text-blue-700">
                      {formatCurrency(monthlyReport.yearSummary.totalRevenue)}
                    </p>
                  </div>
                  <div className="p-3 bg-blue-200 rounded-xl">
                    <DollarSign className="h-6 w-6 text-blue-700" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-orange-600 font-medium">کۆی گواستنەوە</p>
                    <p className="text-2xl font-bold text-orange-700">
                      {formatCurrency(monthlyReport.yearSummary.totalShipping)}
                    </p>
                  </div>
                  <div className="p-3 bg-orange-200 rounded-xl">
                    <Truck className="h-6 w-6 text-orange-700" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-purple-600 font-medium">تێکڕای مانگانە</p>
                    <p className="text-2xl font-bold text-purple-700">
                      {formatCurrency(monthlyReport.yearSummary.avgMonthlyProfit)}
                    </p>
                  </div>
                  <div className="p-3 bg-purple-200 rounded-xl">
                    <Calendar className="h-6 w-6 text-purple-700" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabs for different views */}
        <Tabs defaultValue="monthly" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="monthly">ڕاپۆرتی مانگانە</TabsTrigger>
            <TabsTrigger value="byType">بەپێی جۆر</TabsTrigger>
            <TabsTrigger value="detailed">وردەکاری</TabsTrigger>
          </TabsList>

          {/* Monthly Report Tab */}
          <TabsContent value="monthly" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  ڕاپۆرتی مانگانەی {selectedYear}
                </CardTitle>
                <CardDescription>قازانج و داهات بەپێی هەر مانگ</CardDescription>
              </CardHeader>
              <CardContent>
                {monthlyLoading ? (
                  <div className="space-y-3">
                    {[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">مانگ</TableHead>
                        <TableHead className="text-right">فول پاکیج</TableHead>

                        <TableHead className="text-right">کۆمیشن</TableHead>
                        <TableHead className="text-right">پاکەت</TableHead>
                        <TableHead className="text-right">کۆی قازانج</TableHead>
                        <TableHead className="text-right">بەراورد</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monthlyReport?.months.map((month) => (
                        <TableRow key={month.month}>
                          <TableCell className="font-medium">
                            {monthNames[month.month - 1]}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <span className="font-mono">{formatCurrency(month.fullPackage.profit)}</span>
                              <span className="text-muted-foreground text-xs mr-2">({month.fullPackage.count})</span>
                            </div>
                          </TableCell>

                          <TableCell>
                            <div className="text-sm">
                              <span className="font-mono">{formatCurrency(month.commission.profit)}</span>
                              <span className="text-muted-foreground text-xs mr-2">({month.commission.count})</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <span className="font-mono">{formatCurrency(month.packages.revenue)}</span>
                              <span className="text-muted-foreground text-xs mr-2">({month.packages.count})</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className={`font-mono font-bold ${month.total.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {formatCurrency(month.total.profit)}
                            </span>
                          </TableCell>
                          <TableCell>
                            {month.comparison ? (
                              <div className="flex items-center gap-1">
                                {month.comparison.profitChange > 0 ? (
                                  <ArrowUp className="h-4 w-4 text-green-500" />
                                ) : month.comparison.profitChange < 0 ? (
                                  <ArrowDown className="h-4 w-4 text-red-500" />
                                ) : (
                                  <Minus className="h-4 w-4 text-gray-400" />
                                )}
                                <span className={`text-sm ${month.comparison.profitChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {formatPercent(month.comparison.profitChangePercent)}
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
            
            {/* Best/Worst Month Cards */}
            {monthlyReport?.yearSummary.bestMonth && monthlyReport?.yearSummary.worstMonth && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border-green-200 bg-green-50">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-green-200 rounded-xl">
                        <TrendingUp className="h-6 w-6 text-green-700" />
                      </div>
                      <div>
                        <p className="text-sm text-green-600">باشترین مانگ</p>
                        <p className="text-lg font-bold text-green-700">
                          {monthNames[monthlyReport.yearSummary.bestMonth.month - 1]}
                        </p>
                        <p className="text-xl font-mono font-bold text-green-800">
                          {formatCurrency(monthlyReport.yearSummary.bestMonth.profit)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="border-red-200 bg-red-50">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-red-200 rounded-xl">
                        <TrendingDown className="h-6 w-6 text-red-700" />
                      </div>
                      <div>
                        <p className="text-sm text-red-600">خراپترین مانگ</p>
                        <p className="text-lg font-bold text-red-700">
                          {monthNames[monthlyReport.yearSummary.worstMonth.month - 1]}
                        </p>
                        <p className="text-xl font-mono font-bold text-red-800">
                          {formatCurrency(monthlyReport.yearSummary.worstMonth.profit)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* By Type Tab */}
          <TabsContent value="byType" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {typeLoading ? (
                [1,2,3,4].map(i => <Skeleton key={i} className="h-32" />)
              ) : (
                <>
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <ShoppingBag className="h-5 w-5 text-emerald-600" />
                        <CardTitle className="text-base">فول پاکیج</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">ژمارە</span>
                          <span className="font-bold">{profitByType?.fullPackage.count || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">کۆی قازانج</span>
                          <span className="font-mono font-bold text-emerald-600">
                            {formatCurrency(profitByType?.fullPackage.totalProfit || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">تێکڕا</span>
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
                        <CardTitle className="text-base">کۆمیشن</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">ژمارە</span>
                          <span className="font-bold">{profitByType?.commission.count || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">کۆی قازانج</span>
                          <span className="font-mono font-bold text-purple-600">
                            {formatCurrency(profitByType?.commission.totalProfit || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">تێکڕا</span>
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
                        <CardTitle className="text-base">پاکەت</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">ژمارە</span>
                          <span className="font-bold">{profitByType?.packages.count || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">کۆی داهات</span>
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
                      وردەکاری ئۆردەرەکان
                    </CardTitle>
                    <CardDescription>لیستی هەموو ئۆردەرەکان لەگەڵ قازانج</CardDescription>
                  </div>
                  <Select value={selectedOrderType} onValueChange={setSelectedOrderType}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="جۆر" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">هەموو</SelectItem>
                      <SelectItem value="full_package">فول پاکیج</SelectItem>

                      <SelectItem value="commission">کۆمیشن</SelectItem>
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
                    {/* Summary Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">کۆی ئۆردەر</p>
                        <p className="text-xl font-bold">{detailedReport?.summary.totalOrders || 0}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">کۆی داهات</p>
                        <p className="text-xl font-bold text-blue-600">{formatCurrency(detailedReport?.summary.totalRevenue || 0)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">کۆی تێچوو</p>
                        <p className="text-xl font-bold text-orange-600">{formatCurrency(detailedReport?.summary.totalCost || 0)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">کۆی قازانج</p>
                        <p className="text-xl font-bold text-green-600">{formatCurrency(detailedReport?.summary.totalProfit || 0)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">پڕۆفیت مارجین</p>
                        <p className="text-xl font-bold text-purple-600">{detailedReport?.summary.avgProfitMargin?.toFixed(1) || 0}%</p>
                      </div>
                    </div>
                    
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">کۆد</TableHead>
                          <TableHead className="text-right">کاڵا</TableHead>
                          <TableHead className="text-right">جۆر</TableHead>
                          <TableHead className="text-right">نرخی کڕین</TableHead>
                          <TableHead className="text-right">نرخی فرۆشتن</TableHead>
                          <TableHead className="text-right">گواستنەوە</TableHead>
                          <TableHead className="text-right">قازانج</TableHead>
                          <TableHead className="text-right">مارجین</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detailedReport?.orders.slice(0, 50).map((order) => (
                          <TableRow key={order.id}>
                            <TableCell className="font-mono text-sm">{order.orderCode}</TableCell>
                            <TableCell className="max-w-[200px] truncate">{order.productName}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {order.orderType === 'full_package' ? 'فول پاکیج' : 'کۆمیشن'}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono">{formatCurrency(order.purchasePriceUsd)}</TableCell>
                            <TableCell className="font-mono text-emerald-600">{formatCurrency(order.sellingPriceUsd)}</TableCell>
                            <TableCell className="font-mono text-orange-600">{formatCurrency(order.shippingCostUsd)}</TableCell>
                            <TableCell className={`font-mono font-bold ${order.profitUsd >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {formatCurrency(order.profitUsd)}
                            </TableCell>
                            <TableCell className="text-sm">
                              {order.profitMargin.toFixed(1)}%
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    
                    {(detailedReport?.orders.length || 0) > 50 && (
                      <p className="text-center text-muted-foreground mt-4">
                        نیشاندانی ٥٠ لە {detailedReport?.orders.length} ئۆردەر
                      </p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
