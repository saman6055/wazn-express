import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "@/contexts/LanguageContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Wrench,
  ArrowRight,
  TrendingUp,
  DollarSign,
  Receipt,
  Users,
  Calendar,
  Printer,
  Download,
  FileText,
  PieChart,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Building2,
} from "lucide-react";
import { toast } from "sonner";
import { useCompanyInfo } from "@/hooks/useCompanyInfo";

export default function ServicesReport() {
  const { t } = useTranslation();
  const company = useCompanyInfo();
  const [, navigate] = useLocation();
  
  // Filters
  const [dateFilterType, setDateFilterType] = useState<"all" | "range" | "month" | "year">("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  
  // Queries
  const { data: services, isLoading } = trpc.extraServices.list.useQuery({});
  const { data: serviceTypes } = trpc.extraServices.getServiceTypes.useQuery();
  const { data: customers } = trpc.customers.list.useQuery();
  
  // Filter services by date
  const filteredServices = useMemo(() => {
    const servicesList = services?.services || [];
    
    return servicesList.filter((service: any) => {
      const serviceDate = service.createdAt ? new Date(service.createdAt) : null;
      
      if (dateFilterType === "range" && startDate && endDate && serviceDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        return serviceDate >= start && serviceDate <= end;
      } else if (dateFilterType === "month" && selectedMonth && serviceDate) {
        const [year, month] = selectedMonth.split("-");
        return serviceDate.getFullYear() === parseInt(year) && 
               serviceDate.getMonth() === parseInt(month) - 1;
      } else if (dateFilterType === "year" && selectedYear && serviceDate) {
        return serviceDate.getFullYear() === parseInt(selectedYear);
      }
      
      return true;
    });
  }, [services, dateFilterType, startDate, endDate, selectedMonth, selectedYear]);
  
  // Calculate totals
  const totals = useMemo(() => {
    const total = filteredServices.length;
    const totalRevenue = filteredServices.reduce((sum: number, s: any) => sum + Number(s.priceAmount || 0), 0);
    const totalCost = filteredServices.reduce((sum: number, s: any) => sum + Number(s.costAmount || 0), 0);
    const totalProfit = totalRevenue - totalCost;
    const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    
    return { total, totalRevenue, totalCost, totalProfit, profitMargin };
  }, [filteredServices]);
  
  // Calculate by service type
  const byServiceType = useMemo(() => {
    const typeMap = new Map<number, { name: string; count: number; revenue: number; cost: number; profit: number }>();
    
    filteredServices.forEach((service: any) => {
      const typeId = service.serviceTypeId;
      const typeName = service.serviceType?.nameKu || service.serviceType?.nameEn || 'نادیار';
      
      if (!typeMap.has(typeId)) {
        typeMap.set(typeId, { name: typeName, count: 0, revenue: 0, cost: 0, profit: 0 });
      }
      
      const entry = typeMap.get(typeId)!;
      entry.count++;
      entry.revenue += Number(service.priceAmount || 0);
      entry.cost += Number(service.costAmount || 0);
      entry.profit = entry.revenue - entry.cost;
    });
    
    return Array.from(typeMap.values()).sort((a, b) => b.revenue - a.revenue);
  }, [filteredServices]);
  
  // Calculate by customer (top 10)
  const byCustomer = useMemo(() => {
    const customerMap = new Map<number, { name: string; count: number; revenue: number; profit: number }>();
    
    filteredServices.forEach((service: any) => {
      const customerId = service.customerId;
      if (!customerId) return;
      
      const customer = customers?.find((c: any) => c.id === customerId);
      const customerName = customer?.fullName || `کڕیار #${customerId}`;
      
      if (!customerMap.has(customerId)) {
        customerMap.set(customerId, { name: customerName, count: 0, revenue: 0, profit: 0 });
      }
      
      const entry = customerMap.get(customerId)!;
      entry.count++;
      entry.revenue += Number(service.priceAmount || 0);
      entry.profit += Number(service.priceAmount || 0) - Number(service.costAmount || 0);
    });
    
    return Array.from(customerMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }, [filteredServices, customers]);
  
  // Calculate monthly trend (last 6 months)
  const monthlyTrend = useMemo(() => {
    const months: { month: string; revenue: number; cost: number; profit: number }[] = [];
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleDateString('ku', { month: 'short', year: 'numeric' });
      
      const monthServices = (services?.services || []).filter((s: any) => {
        const sDate = s.createdAt ? new Date(s.createdAt) : null;
        return sDate && sDate.getFullYear() === date.getFullYear() && sDate.getMonth() === date.getMonth();
      });
      
      const revenue = monthServices.reduce((sum: number, s: any) => sum + Number(s.priceAmount || 0), 0);
      const cost = monthServices.reduce((sum: number, s: any) => sum + Number(s.costAmount || 0), 0);
      
      months.push({ month: monthName, revenue, cost, profit: revenue - cost });
    }
    
    return months;
  }, [services]);
  
  // Generate years for filter
  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => currentYear - i);
  }, []);
  
  // Handle print
  const handlePrint = () => {
    const printContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ku">
      <head>
        <meta charset="UTF-8">
        <title>ڕاپۆرتی دارایی خزمەتگوزارییەکان</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, sans-serif; padding: 30px; direction: rtl; background: white; }
          .header { text-align: center; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 3px solid #10b981; }
          .header h1 { color: #10b981; margin: 0; font-size: 28px; }
          .header .company { font-size: 14px; color: #666; margin-top: 5px; }
          .header .date { font-size: 12px; color: #999; margin-top: 10px; }
          .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 40px; }
          .stat { text-align: center; padding: 20px; background: linear-gradient(135deg, #f0fdf4, #dcfce7); border-radius: 12px; }
          .stat-value { font-size: 28px; font-weight: bold; color: #10b981; }
          .stat-label { font-size: 12px; color: #666; margin-top: 5px; }
          .section { margin-bottom: 30px; }
          .section-title { font-size: 18px; font-weight: bold; color: #333; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #e5e7eb; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th, td { border: 1px solid #e5e7eb; padding: 12px; text-align: right; }
          th { background: #10b981; color: white; font-weight: 600; }
          tr:nth-child(even) { background: #f9fafb; }
          .profit-positive { color: #10b981; font-weight: bold; }
          .profit-negative { color: #ef4444; font-weight: bold; }
          .chart-placeholder { background: #f3f4f6; padding: 40px; text-align: center; border-radius: 8px; color: #666; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🔧 ڕاپۆرتی دارایی خزمەتگوزارییەکان</h1>
          <div class="company">${company.name} - ${company.nameKu}</div>
          <div class="date">بەرواری دروستکردن: ${new Date().toLocaleDateString('ku')} - ${new Date().toLocaleTimeString('ku')}</div>
        </div>
        
        <div class="stats">
          <div class="stat">
            <div class="stat-value">${totals.total}</div>
            <div class="stat-label">کۆی خزمەتگوزاری</div>
          </div>
          <div class="stat">
            <div class="stat-value">$${totals.totalRevenue.toFixed(2)}</div>
            <div class="stat-label">کۆی داهات</div>
          </div>
          <div class="stat">
            <div class="stat-value">$${totals.totalCost.toFixed(2)}</div>
            <div class="stat-label">کۆی تێچوون</div>
          </div>
          <div class="stat">
            <div class="stat-value ${totals.totalProfit >= 0 ? 'profit-positive' : 'profit-negative'}">$${totals.totalProfit.toFixed(2)}</div>
            <div class="stat-label">قازانجی خاوێن (${totals.profitMargin.toFixed(1)}%)</div>
          </div>
        </div>
        
        <div class="section">
          <div class="section-title">📊 شیکاری بەپێی جۆری خزمەتگوزاری</div>
          <table>
            <thead>
              <tr>
                <th>جۆر</th>
                <th>ژمارە</th>
                <th>تێچوون</th>
                <th>داهات</th>
                <th>قازانج</th>
                <th>ڕێژە</th>
              </tr>
            </thead>
            <tbody>
              ${byServiceType.map(type => {
                const margin = type.revenue > 0 ? (type.profit / type.revenue) * 100 : 0;
                return `
                  <tr>
                    <td>${type.name}</td>
                    <td>${type.count}</td>
                    <td>$${type.cost.toFixed(2)}</td>
                    <td>$${type.revenue.toFixed(2)}</td>
                    <td class="${type.profit >= 0 ? 'profit-positive' : 'profit-negative'}">$${type.profit.toFixed(2)}</td>
                    <td>${margin.toFixed(1)}%</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
        
        <div class="section">
          <div class="section-title">👥 باشترین ١٠ کڕیار بەپێی داهات</div>
          <table>
            <thead>
              <tr>
                <th>کڕیار</th>
                <th>ژمارەی خزمەتگوزاری</th>
                <th>کۆی داهات</th>
                <th>کۆی قازانج</th>
              </tr>
            </thead>
            <tbody>
              ${byCustomer.map(customer => `
                <tr>
                  <td>${customer.name}</td>
                  <td>${customer.count}</td>
                  <td>$${customer.revenue.toFixed(2)}</td>
                  <td class="${customer.profit >= 0 ? 'profit-positive' : 'profit-negative'}">$${customer.profit.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        
        <div class="section">
          <div class="section-title">📈 ترێندی مانگانە (٦ مانگی کۆتایی)</div>
          <table>
            <thead>
              <tr>
                <th>مانگ</th>
                <th>تێچوون</th>
                <th>داهات</th>
                <th>قازانج</th>
              </tr>
            </thead>
            <tbody>
              ${monthlyTrend.map(month => `
                <tr>
                  <td>${month.month}</td>
                  <td>$${month.cost.toFixed(2)}</td>
                  <td>$${month.revenue.toFixed(2)}</td>
                  <td class="${month.profit >= 0 ? 'profit-positive' : 'profit-negative'}">$${month.profit.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </body>
      </html>
    `;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  };
  
  // Handle CSV export
  const handleExportCSV = () => {
    // Export detailed services data
    const headers = ["بەروار", "کڕیار", "جۆر", "وەسف", "تێچوون", "داهات", "قازانج"];
    const rows = filteredServices.map((service: any) => {
      const customer = customers?.find((c: any) => c.id === service.customerId);
      const profit = Number(service.priceAmount || 0) - Number(service.costAmount || 0);
      return [
        service.createdAt ? new Date(service.createdAt).toLocaleDateString() : '',
        customer?.fullName || '',
        service.serviceType?.nameKu || service.serviceType?.nameEn || '',
        service.description || '',
        Number(service.costAmount || 0).toFixed(2),
        Number(service.priceAmount || 0).toFixed(2),
        profit.toFixed(2),
      ];
    });
    
    const csvContent = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `services-financial-report-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(t("toast.excelDownloaded"));
  };

  // Calculate max values for chart scaling
  const maxRevenue = Math.max(...byServiceType.map(t => t.revenue), 1);
  const maxMonthlyRevenue = Math.max(...monthlyTrend.map(m => m.revenue), 1);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-l from-emerald-600 via-teal-600 to-cyan-600 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20"
                onClick={() => navigate("/reports")}
              >
                <ArrowRight className="h-5 w-5" />
              </Button>
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <Building2 className="h-8 w-8" />
              </div>
              <div>
                <p className="text-emerald-100 text-sm">{company.name}</p>
                <h1 className="text-2xl font-bold">ڕاپۆرتی دارایی خزمەتگوزارییەکان</h1>
                <p className="text-emerald-100 mt-1">شیکاری تەواو بۆ داهات و قازانجی خزمەتگوزارییەکان</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                onClick={handlePrint}
              >
                <Printer className="h-4 w-4 ml-2" />
                چاپکردن
              </Button>
              <Button
                className="bg-white text-emerald-600 hover:bg-emerald-50"
                onClick={handleExportCSV}
              >
                <Download className="h-4 w-4 ml-2" />
                داگرتنی Excel
              </Button>
            </div>
          </div>
          
          {/* Date Filter */}
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <Select value={dateFilterType} onValueChange={(v: any) => setDateFilterType(v)}>
              <SelectTrigger className="w-40 bg-white/10 border-white/20 text-white">
                <SelectValue placeholder="فیلتەری بەروار" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">هەموو کات</SelectItem>
                <SelectItem value="range">ماوەی دیاریکراو</SelectItem>
                <SelectItem value="month">مانگانە</SelectItem>
                <SelectItem value="year">ساڵانە</SelectItem>
              </SelectContent>
            </Select>
            
            {dateFilterType === "range" && (
              <>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-40 bg-white/10 border-white/20 text-white"
                />
                <span className="text-white/60">بۆ</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-40 bg-white/10 border-white/20 text-white"
                />
              </>
            )}
            
            {dateFilterType === "month" && (
              <Input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-40 bg-white/10 border-white/20 text-white"
              />
            )}
            
            {dateFilterType === "year" && (
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-40 bg-white/10 border-white/20 text-white">
                  <SelectValue placeholder="ساڵ هەڵبژێرە" />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
        
        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">کۆی خزمەتگوزاری</p>
                  <p className="text-3xl font-bold text-blue-600 mt-1">{totals.total}</p>
                </div>
                <div className="p-3 bg-blue-500/10 rounded-xl">
                  <Wrench className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">کۆی داهات</p>
                  <p className="text-3xl font-bold text-green-600 mt-1">${totals.totalRevenue.toFixed(2)}</p>
                </div>
                <div className="p-3 bg-green-500/10 rounded-xl">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-lg bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">کۆی تێچوون</p>
                  <p className="text-3xl font-bold text-red-600 mt-1">${totals.totalCost.toFixed(2)}</p>
                </div>
                <div className="p-3 bg-red-500/10 rounded-xl">
                  <DollarSign className="h-6 w-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-lg bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">قازانجی خاوێن</p>
                  <p className={`text-3xl font-bold mt-1 ${totals.totalProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    ${totals.totalProfit.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {totals.profitMargin.toFixed(1)}% ڕێژەی قازانج
                  </p>
                </div>
                <div className="p-3 bg-emerald-500/10 rounded-xl">
                  {totals.totalProfit >= 0 ? (
                    <ArrowUpRight className="h-6 w-6 text-emerald-600" />
                  ) : (
                    <ArrowDownRight className="h-6 w-6 text-red-600" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue by Service Type - Bar Chart */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-emerald-600" />
                <CardTitle className="text-lg">داهات بەپێی جۆری خزمەتگوزاری</CardTitle>
              </div>
              <CardDescription>بەراوردی تێچوون و داهات</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {byServiceType.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">هیچ داتایەک نییە</p>
                ) : (
                  byServiceType.map((type, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{type.name}</span>
                        <span className="text-muted-foreground">${type.revenue.toFixed(2)}</span>
                      </div>
                      <div className="flex gap-1 h-6">
                        {/* Cost bar */}
                        <div 
                          className="bg-red-400 rounded-r-sm transition-all duration-500"
                          style={{ width: `${(type.cost / maxRevenue) * 100}%` }}
                          title={`تێچوون: $${type.cost.toFixed(2)}`}
                        />
                        {/* Revenue bar */}
                        <div 
                          className="bg-emerald-500 rounded-l-sm transition-all duration-500"
                          style={{ width: `${(type.revenue / maxRevenue) * 100}%` }}
                          title={`داهات: $${type.revenue.toFixed(2)}`}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="flex items-center justify-center gap-6 mt-6 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-400 rounded-sm" />
                  <span className="text-sm text-muted-foreground">تێچوون</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-emerald-500 rounded-sm" />
                  <span className="text-sm text-muted-foreground">داهات</span>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Profit Distribution - Pie Chart */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <div className="flex items-center gap-2">
                <PieChart className="h-5 w-5 text-emerald-600" />
                <CardTitle className="text-lg">دابەشبوونی قازانج</CardTitle>
              </div>
              <CardDescription>بەپێی جۆری خزمەتگوزاری</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center">
                {byServiceType.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">هیچ داتایەک نییە</p>
                ) : (
                  <div className="relative w-48 h-48">
                    {/* Simple pie chart visualization */}
                    <svg viewBox="0 0 100 100" className="transform -rotate-90">
                      {(() => {
                        const totalProfit = byServiceType.reduce((sum, t) => sum + Math.max(0, t.profit), 0);
                        let currentAngle = 0;
                        const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
                        
                        return byServiceType.map((type, index) => {
                          if (type.profit <= 0) return null;
                          const percentage = totalProfit > 0 ? (type.profit / totalProfit) * 100 : 0;
                          const angle = (percentage / 100) * 360;
                          const startAngle = currentAngle;
                          currentAngle += angle;
                          
                          // Calculate arc path
                          const largeArc = angle > 180 ? 1 : 0;
                          const startX = 50 + 40 * Math.cos((startAngle * Math.PI) / 180);
                          const startY = 50 + 40 * Math.sin((startAngle * Math.PI) / 180);
                          const endX = 50 + 40 * Math.cos(((startAngle + angle) * Math.PI) / 180);
                          const endY = 50 + 40 * Math.sin(((startAngle + angle) * Math.PI) / 180);
                          
                          return (
                            <path
                              key={index}
                              d={`M 50 50 L ${startX} ${startY} A 40 40 0 ${largeArc} 1 ${endX} ${endY} Z`}
                              fill={colors[index % colors.length]}
                              className="transition-all duration-500 hover:opacity-80"
                            />
                          );
                        });
                      })()}
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-emerald-600">${totals.totalProfit.toFixed(0)}</p>
                        <p className="text-xs text-muted-foreground">قازانج</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              {/* Legend */}
              <div className="grid grid-cols-2 gap-2 mt-6 pt-4 border-t">
                {byServiceType.slice(0, 6).map((type, index) => {
                  const colors = ['bg-emerald-500', 'bg-blue-500', 'bg-amber-500', 'bg-red-500', 'bg-violet-500', 'bg-pink-500'];
                  return (
                    <div key={index} className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-sm ${colors[index % colors.length]}`} />
                      <span className="text-xs text-muted-foreground truncate">{type.name}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Monthly Trend */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-emerald-600" />
              <CardTitle className="text-lg">ترێندی مانگانە</CardTitle>
            </div>
            <CardDescription>داهات و قازانجی ٦ مانگی کۆتایی</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {monthlyTrend.map((month, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium w-24">{month.month}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-red-600 text-xs">تێچوون: ${month.cost.toFixed(0)}</span>
                      <span className="text-green-600 text-xs">داهات: ${month.revenue.toFixed(0)}</span>
                      <span className={`font-bold ${month.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        قازانج: ${month.profit.toFixed(0)}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1 h-4">
                    <div 
                      className="bg-red-400 rounded-r-sm transition-all duration-500"
                      style={{ width: `${maxMonthlyRevenue > 0 ? (month.cost / maxMonthlyRevenue) * 50 : 0}%` }}
                    />
                    <div 
                      className="bg-emerald-500 rounded-l-sm transition-all duration-500"
                      style={{ width: `${maxMonthlyRevenue > 0 ? (month.revenue / maxMonthlyRevenue) * 50 : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        
        {/* Tables Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* By Service Type Table */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Wrench className="h-5 w-5 text-emerald-600" />
                <CardTitle className="text-lg">شیکاری بەپێی جۆر</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="text-right">جۆر</TableHead>
                    <TableHead className="text-right">ژمارە</TableHead>
                    <TableHead className="text-right">تێچوون</TableHead>
                    <TableHead className="text-right">داهات</TableHead>
                    <TableHead className="text-right">قازانج</TableHead>
                    <TableHead className="text-right">ڕێژە</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byServiceType.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        هیچ داتایەک نییە
                      </TableCell>
                    </TableRow>
                  ) : (
                    byServiceType.map((type, index) => {
                      const margin = type.revenue > 0 ? (type.profit / type.revenue) * 100 : 0;
                      return (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{type.name}</TableCell>
                          <TableCell>{type.count}</TableCell>
                          <TableCell className="text-red-600">${type.cost.toFixed(2)}</TableCell>
                          <TableCell className="text-green-600">${type.revenue.toFixed(2)}</TableCell>
                          <TableCell className={`font-bold ${type.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            ${type.profit.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={margin >= 30 ? "default" : margin >= 15 ? "secondary" : "destructive"}>
                              {margin.toFixed(1)}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          
          {/* Top Customers Table */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-emerald-600" />
                <CardTitle className="text-lg">باشترین ١٠ کڕیار</CardTitle>
              </div>
              <CardDescription>بەپێی داهات لە خزمەتگوزارییەکان</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="text-right">#</TableHead>
                    <TableHead className="text-right">کڕیار</TableHead>
                    <TableHead className="text-right">ژمارە</TableHead>
                    <TableHead className="text-right">داهات</TableHead>
                    <TableHead className="text-right">قازانج</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byCustomer.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        هیچ داتایەک نییە
                      </TableCell>
                    </TableRow>
                  ) : (
                    byCustomer.map((customer, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Badge variant="outline" className="w-6 h-6 p-0 flex items-center justify-center">
                            {index + 1}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{customer.name}</TableCell>
                        <TableCell>{customer.count}</TableCell>
                        <TableCell className="text-green-600">${customer.revenue.toFixed(2)}</TableCell>
                        <TableCell className={`font-bold ${customer.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          ${customer.profit.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
