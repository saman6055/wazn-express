import { useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { trpc } from "@/lib/trpc";
import { getCompanyInfoFromSettings } from "@/hooks/useCompanyInfo";
import { pickLang } from "@/lib/lang";
import { useTranslation } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { 
  FileText, 
  TrendingUp, 
  Users, 
  Calendar,
  Download,
  BarChart3,
  PieChart,
  CheckCircle,
  Clock,
  Filter,
  FileSpreadsheet,
  File
} from "lucide-react";

// Kurdish month names
const kurdishMonths = [
  "کانوونی دووەم", "شوبات", "ئازار", "نیسان", "ئایار", "حوزەیران",
  "تەممووز", "ئاب", "ئەیلوول", "تشرینی یەکەم", "تشرینی دووەم", "کانوونی یەکەم"
];

// English month names for export
const englishMonths = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function InvoiceReports() {
  const { language } = useTranslation();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [dateRange, setDateRange] = useState<"all" | "month" | "quarter" | "year">("year");
  const [isExporting, setIsExporting] = useState(false);
  
  // Calculate date range
  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    let start: Date | undefined;
    let end: Date | undefined;
    
    switch (dateRange) {
      case "month":
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case "quarter":
        const quarter = Math.floor(now.getMonth() / 3);
        start = new Date(now.getFullYear(), quarter * 3, 1);
        end = new Date(now.getFullYear(), (quarter + 1) * 3, 0);
        break;
      case "year":
        start = new Date(selectedYear, 0, 1);
        end = new Date(selectedYear, 11, 31);
        break;
      default:
        start = undefined;
        end = undefined;
    }
    
    return {
      startDate: start?.toISOString(),
      endDate: end?.toISOString()
    };
  }, [dateRange, selectedYear]);

  // Fetch data
  const { data: summary, isLoading: summaryLoading } = trpc.invoices.getSummary.useQuery({
    startDate,
    endDate
  });

  const { data: monthlyReport, isLoading: monthlyLoading } = trpc.invoices.getMonthlyReport.useQuery({
    year: selectedYear
  });

  const { data: customerReport, isLoading: customerLoading } = trpc.invoices.getByCustomerReport.useQuery({
    startDate,
    endDate,
    limit: 10
  });

  const { data: serviceTypeReport, isLoading: serviceTypeLoading } = trpc.invoices.getByServiceTypeReport.useQuery({
    startDate,
    endDate
  });
  const { data: settings } = trpc.settings.list.useQuery();

  const { data: recentInvoices, isLoading: recentLoading } = trpc.invoices.getRecent.useQuery({
    page: 1,
    pageSize: 10
  });

  // Calculate totals for charts
  const monthlyTotals = useMemo(() => {
    if (!monthlyReport) return [];
    return monthlyReport.map(m => ({
      month: kurdishMonths[m.monthNumber - 1],
      monthEn: englishMonths[m.monthNumber - 1],
      total: m.totalAmountUsd,
      paid: m.paidAmountUsd,
      unpaid: m.unpaidAmountUsd,
      count: m.totalInvoices
    }));
  }, [monthlyReport]);

  const maxMonthlyTotal = useMemo(() => {
    if (!monthlyTotals.length) return 1;
    return Math.max(...monthlyTotals.map(m => m.total), 1);
  }, [monthlyTotals]);

  // Years for dropdown
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-500/20 text-green-600 dark:text-green-300 border-green-500/30">{pickLang(language, {ku:"پارەدراو", en:"Paid", ar:"مدفوع", zh:"已付"})}</Badge>;
      case 'issued':
        return <Badge className="bg-blue-500/20 text-blue-600 dark:text-blue-300 border-blue-500/30">{pickLang(language, {ku:"دەرچووە", en:"Issued", ar:"صادر", zh:"已开具"})}</Badge>;
      case 'draft':
        return <Badge className="bg-gray-500/20 text-gray-600 dark:text-gray-300 border-gray-500/30">{pickLang(language, {ku:"ڕەشنووس", en:"Draft", ar:"مسودة", zh:"草稿"})}</Badge>;
      case 'cancelled':
        return <Badge className="bg-red-500/20 text-red-600 dark:text-red-300 border-red-500/30">{pickLang(language, {ku:"هەڵوەشێنراوە", en:"Cancelled", ar:"ملغى", zh:"已取消"})}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Export to CSV/Excel
  const exportToCSV = (data: any[], filename: string, headers: string[]) => {
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(h => {
        const value = row[h] ?? '';
        // Escape commas and quotes
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // Export Monthly Report
  const exportMonthlyReport = (format: 'csv' | 'pdf') => {
    if (!monthlyTotals.length) {
      toast.error(pickLang(language, {ku:"هیچ داتایەک نییە بۆ ناردن", en:"No data to export", ar:"لا توجد بيانات للتصدير", zh:"没有可导出的数据"}));
      return;
    }

    setIsExporting(true);
    try {
      if (format === 'csv') {
        const data = monthlyTotals.map(m => ({
          Month: m.monthEn,
          'Invoice Count': m.count,
          'Total Amount (USD)': m.total.toFixed(2),
          'Paid Amount (USD)': m.paid.toFixed(2),
          'Unpaid Amount (USD)': m.unpaid.toFixed(2)
        }));
        exportToCSV(data, `invoice-report-monthly-${selectedYear}`, ['Month', 'Invoice Count', 'Total Amount (USD)', 'Paid Amount (USD)', 'Unpaid Amount (USD)']);
        toast.success(pickLang(language, {ku:"ڕاپۆرتی مانگانە دابەزێنرا", en:"Monthly report downloaded", ar:"تم تنزيل التقرير الشهري", zh:"月度报告已下载"}));
      } else {
        // Generate PDF content
        generatePDFReport('monthly');
      }
    } catch (error) {
      toast.error(pickLang(language, {ku:"هەڵەیەک ڕوویدا لە کاتی ناردن", en:"An error occurred during export", ar:"حدث خطأ أثناء التصدير", zh:"导出时发生错误"}));
    } finally {
      setIsExporting(false);
    }
  };

  // Export Customer Report
  const exportCustomerReport = (format: 'csv' | 'pdf') => {
    if (!customerReport?.length) {
      toast.error(pickLang(language, {ku:"هیچ داتایەک نییە بۆ ناردن", en:"No data to export", ar:"لا توجد بيانات للتصدير", zh:"没有可导出的数据"}));
      return;
    }

    setIsExporting(true);
    try {
      if (format === 'csv') {
        const data = customerReport.map(c => ({
          'Customer Name': c.customerName,
          'Customer Code': c.customerCode,
          'Invoice Count': c.totalInvoices,
          'Total Amount (USD)': c.totalAmountUsd.toFixed(2),
          'Paid Amount (USD)': c.paidAmountUsd.toFixed(2),
          'Unpaid Amount (USD)': c.unpaidAmountUsd.toFixed(2)
        }));
        exportToCSV(data, `invoice-report-customers-${selectedYear}`, ['Customer Name', 'Customer Code', 'Invoice Count', 'Total Amount (USD)', 'Paid Amount (USD)', 'Unpaid Amount (USD)']);
        toast.success(pickLang(language, {ku:"ڕاپۆرتی کڕیارەکان دابەزێنرا", en:"Customer report downloaded", ar:"تم تنزيل تقرير العملاء", zh:"客户报告已下载"}));
      } else {
        generatePDFReport('customers');
      }
    } catch (error) {
      toast.error(pickLang(language, {ku:"هەڵەیەک ڕوویدا لە کاتی ناردن", en:"An error occurred during export", ar:"حدث خطأ أثناء التصدير", zh:"导出时发生错误"}));
    } finally {
      setIsExporting(false);
    }
  };

  // Export Service Type Report
  const exportServiceReport = (format: 'csv' | 'pdf') => {
    if (!serviceTypeReport?.length) {
      toast.error(pickLang(language, {ku:"هیچ داتایەک نییە بۆ ناردن", en:"No data to export", ar:"لا توجد بيانات للتصدير", zh:"没有可导出的数据"}));
      return;
    }

    setIsExporting(true);
    try {
      if (format === 'csv') {
        const data = serviceTypeReport.map(s => ({
          'Service Type': s.serviceType,
          'Invoice Count': s.totalInvoices,
          'Total Amount (USD)': s.totalAmountUsd.toFixed(2),
          'Average Amount (USD)': s.averageAmountUsd.toFixed(2)
        }));
        exportToCSV(data, `invoice-report-services-${selectedYear}`, ['Service Type', 'Invoice Count', 'Total Amount (USD)', 'Average Amount (USD)']);
        toast.success(pickLang(language, {ku:"ڕاپۆرتی خزمەتگوزارییەکان دابەزێنرا", en:"Services report downloaded", ar:"تم تنزيل تقرير الخدمات", zh:"服务报告已下载"}));
      } else {
        generatePDFReport('services');
      }
    } catch (error) {
      toast.error(pickLang(language, {ku:"هەڵەیەک ڕوویدا لە کاتی ناردن", en:"An error occurred during export", ar:"حدث خطأ أثناء التصدير", zh:"导出时发生错误"}));
    } finally {
      setIsExporting(false);
    }
  };

  // Generate PDF Report
  const generatePDFReport = (reportType: 'monthly' | 'customers' | 'services') => {
    // Create a printable HTML document
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error(pickLang(language, {ku:"تکایە ڕێگە بدە بە popup لە براوزەرەکەت", en:"Please allow popups in your browser", ar:"يرجى السماح بالنوافذ المنبثقة في متصفحك", zh:"请在浏览器中允许弹出窗口"}));
      return;
    }

    let tableContent = '';
    let title = '';

    if (reportType === 'monthly') {
      title = `Invoice Monthly Report - ${selectedYear}`;
      tableContent = `
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th>Invoice Count</th>
              <th>Total Amount (USD)</th>
              <th>Paid Amount (USD)</th>
              <th>Unpaid Amount (USD)</th>
            </tr>
          </thead>
          <tbody>
            ${monthlyTotals.map(m => `
              <tr>
                <td>${m.monthEn}</td>
                <td>${m.count}</td>
                <td>$${m.total.toFixed(2)}</td>
                <td style="color: green;">$${m.paid.toFixed(2)}</td>
                <td style="color: orange;">$${m.unpaid.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else if (reportType === 'customers') {
      title = `Invoice Customer Report - ${selectedYear}`;
      tableContent = `
        <table>
          <thead>
            <tr>
              <th>Customer Name</th>
              <th>Customer Code</th>
              <th>Invoice Count</th>
              <th>Total Amount (USD)</th>
              <th>Paid Amount (USD)</th>
              <th>Unpaid Amount (USD)</th>
            </tr>
          </thead>
          <tbody>
            ${customerReport?.map(c => `
              <tr>
                <td>${c.customerName}</td>
                <td>${c.customerCode}</td>
                <td>${c.totalInvoices}</td>
                <td>$${c.totalAmountUsd.toFixed(2)}</td>
                <td style="color: green;">$${c.paidAmountUsd.toFixed(2)}</td>
                <td style="color: orange;">$${c.unpaidAmountUsd.toFixed(2)}</td>
              </tr>
            `).join('') || ''}
          </tbody>
        </table>
      `;
    } else if (reportType === 'services') {
      title = `Invoice Service Type Report - ${selectedYear}`;
      tableContent = `
        <table>
          <thead>
            <tr>
              <th>Service Type</th>
              <th>Invoice Count</th>
              <th>Total Amount (USD)</th>
              <th>Average Amount (USD)</th>
            </tr>
          </thead>
          <tbody>
            ${serviceTypeReport?.map(s => `
              <tr>
                <td>${s.serviceType}</td>
                <td>${s.totalInvoices}</td>
                <td>$${s.totalAmountUsd.toFixed(2)}</td>
                <td>$${s.averageAmountUsd.toFixed(2)}</td>
              </tr>
            `).join('') || ''}
          </tbody>
        </table>
      `;
    }

    const company = getCompanyInfoFromSettings(settings || []);
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 20px;
            direction: ltr;
          }
          h1 {
            text-align: center;
            color: #333;
            margin-bottom: 10px;
          }
          .subtitle {
            text-align: center;
            color: #666;
            margin-bottom: 30px;
          }
          .summary {
            display: flex;
            justify-content: space-around;
            margin-bottom: 30px;
            flex-wrap: wrap;
          }
          .summary-card {
            background: #f5f5f5;
            padding: 15px 25px;
            border-radius: 8px;
            text-align: center;
            margin: 5px;
          }
          .summary-card h3 {
            margin: 0;
            color: #666;
            font-size: 14px;
          }
          .summary-card p {
            margin: 5px 0 0;
            font-size: 24px;
            font-weight: bold;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 12px 8px;
            text-align: left;
          }
          th {
            background-color: #4CAF50;
            color: white;
          }
          tr:nth-child(even) {
            background-color: #f9f9f9;
          }
          .footer {
            margin-top: 30px;
            text-align: center;
            color: #999;
            font-size: 12px;
          }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <h1>${company.name}</h1>
        <p class="subtitle">${title}</p>
        
        <div class="summary">
          <div class="summary-card">
            <h3>Total Invoices</h3>
            <p>${summary?.totalInvoices || 0}</p>
          </div>
          <div class="summary-card">
            <h3>Total Amount</h3>
            <p>$${(summary?.totalAmountUsd || 0).toFixed(2)}</p>
          </div>
          <div class="summary-card">
            <h3>Paid</h3>
            <p style="color: green;">$${(summary?.paidAmountUsd || 0).toFixed(2)}</p>
          </div>
          <div class="summary-card">
            <h3>Unpaid</h3>
            <p style="color: orange;">$${(summary?.unpaidAmountUsd || 0).toFixed(2)}</p>
          </div>
        </div>
        
        ${tableContent}
        
        <p class="footer">Generated on ${new Date().toLocaleDateString()} | ${company.name} Invoice Reports</p>
        
        <script>
          window.onload = function() {
            window.print();
          }
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    toast.success(pickLang(language, {ku:"ڕاپۆرت ئامادەیە بۆ چاپکردن", en:"Report ready to print", ar:"التقرير جاهز للطباعة", zh:"报告已准备好打印"}));
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{pickLang(language, {ku:"ڕاپۆرتی پسوڵەکان", en:"Invoice Reports", ar:"تقارير الفواتير", zh:"发票报告"})}</h1>
            <p className="text-muted-foreground">{pickLang(language, {ku:"پوختەی پسوڵەکان و ئاماری دارایی", en:"Invoice summary and financial statistics", ar:"ملخص الفواتير والإحصاءات المالية", zh:"发票摘要与财务统计"})}</p>
          </div>
          
          <div className="flex items-center gap-3">
            <Select value={dateRange} onValueChange={(v) => setDateRange(v as any)}>
              <SelectTrigger className="w-[140px]">
                <Filter className="h-4 w-4 ms-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{pickLang(language, {ku:"هەموو", en:"All", ar:"الكل", zh:"全部"})}</SelectItem>
                <SelectItem value="month">{pickLang(language, {ku:"ئەم مانگە", en:"This month", ar:"هذا الشهر", zh:"本月"})}</SelectItem>
                <SelectItem value="quarter">{pickLang(language, {ku:"ئەم چارەکە", en:"This quarter", ar:"هذا الربع", zh:"本季度"})}</SelectItem>
                <SelectItem value="year">{pickLang(language, {ku:"ئەم ساڵە", en:"This year", ar:"هذه السنة", zh:"本年"})}</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
              <SelectTrigger className="w-[120px]">
                <Calendar className="h-4 w-4 ms-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map(year => (
                  <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{pickLang(language, {ku:"کۆی پسوڵە", en:"Total invoices", ar:"إجمالي الفواتير", zh:"发票总数"})}</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {summaryLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{summary?.totalInvoices || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatCurrency(summary?.totalAmountUsd || 0)} {pickLang(language, {ku:"کۆی بڕ", en:"total amount", ar:"إجمالي المبلغ", zh:"总金额"})}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{pickLang(language, {ku:"پارەدراو", en:"Paid", ar:"مدفوع", zh:"已付"})}</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400" />
            </CardHeader>
            <CardContent>
              {summaryLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-300">{summary?.paidInvoices || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatCurrency(summary?.paidAmountUsd || 0)}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{pickLang(language, {ku:"ناوەندی پسوڵە", en:"Average invoice", ar:"متوسط الفاتورة", zh:"平均发票额"})}</CardTitle>
              <TrendingUp className="h-4 w-4 text-blue-500 dark:text-blue-400" />
            </CardHeader>
            <CardContent>
              {summaryLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-300">
                    {formatCurrency(summary?.averageInvoiceUsd || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {pickLang(language, {ku:"بۆ هەر پسوڵەیەک", en:"per invoice", ar:"لكل فاتورة", zh:"每张发票"})}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tabs for different reports */}
        <Tabs defaultValue="monthly" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
            <TabsTrigger value="monthly" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">{pickLang(language, {ku:"مانگانە", en:"Monthly", ar:"شهري", zh:"月度"})}</span>
            </TabsTrigger>
            <TabsTrigger value="customers" className="gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">{pickLang(language, {ku:"کڕیارەکان", en:"Customers", ar:"العملاء", zh:"客户"})}</span>
            </TabsTrigger>
            <TabsTrigger value="services" className="gap-2">
              <PieChart className="h-4 w-4" />
              <span className="hidden sm:inline">{pickLang(language, {ku:"خزمەتگوزارییەکان", en:"Services", ar:"الخدمات", zh:"服务"})}</span>
            </TabsTrigger>
            <TabsTrigger value="recent" className="gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">{pickLang(language, {ku:"دوایین", en:"Recent", ar:"الأحدث", zh:"最近"})}</span>
            </TabsTrigger>
          </TabsList>

          {/* Monthly Report Tab */}
          <TabsContent value="monthly" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>{pickLang(language, {ku:"ڕاپۆرتی مانگانە", en:"Monthly report", ar:"التقرير الشهري", zh:"月度报告"})} - {selectedYear}</CardTitle>
                  <CardDescription>{pickLang(language, {ku:"پوختەی پسوڵەکان بۆ هەر مانگێک", en:"Invoice summary for each month", ar:"ملخص الفواتير لكل شهر", zh:"每月发票摘要"})}</CardDescription>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" disabled={isExporting || monthlyLoading}>
                      <Download className="h-4 w-4 ms-2" />
                      {pickLang(language, {ku:"دابەزاندن", en:"Download", ar:"تنزيل", zh:"下载"})}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => exportMonthlyReport('csv')}>
                      <FileSpreadsheet className="h-4 w-4 ms-2" />
                      Excel (CSV)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportMonthlyReport('pdf')}>
                      <File className="h-4 w-4 ms-2" />
                      {pickLang(language, {ku:"PDF / چاپکردن", en:"PDF / Print", ar:"PDF / طباعة", zh:"PDF / 打印"})}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent>
                {monthlyLoading ? (
                  <div className="space-y-4">
                    {[...Array(6)].map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Simple bar chart */}
                    <div className="grid grid-cols-12 gap-2 h-48 items-end">
                      {monthlyTotals.map((m, i) => (
                        <div key={i} className="flex flex-col items-center gap-1">
                          <div 
                            className="w-full bg-gradient-to-t from-primary to-primary/60 rounded-t transition-all hover:from-primary/90"
                            style={{ 
                              height: `${(m.total / maxMonthlyTotal) * 100}%`,
                              minHeight: m.total > 0 ? '8px' : '0'
                            }}
                            title={`${m.month}: ${formatCurrency(m.total)}`}
                          />
                          <span className="text-[10px] text-muted-foreground truncate w-full text-center">
                            {m.month.slice(0, 3)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Monthly table */}
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">{pickLang(language, {ku:"مانگ", en:"Month", ar:"الشهر", zh:"月份"})}</TableHead>
                          <TableHead className="text-right">{pickLang(language, {ku:"ژمارەی پسوڵە", en:"Invoice count", ar:"عدد الفواتير", zh:"发票数量"})}</TableHead>
                          <TableHead className="text-right">{pickLang(language, {ku:"کۆی بڕ", en:"Total amount", ar:"إجمالي المبلغ", zh:"总金额"})}</TableHead>
                          <TableHead className="text-right">{pickLang(language, {ku:"پارەدراو", en:"Paid", ar:"مدفوع", zh:"已付"})}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {monthlyTotals.map((m, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{m.month}</TableCell>
                            <TableCell>{m.count}</TableCell>
                            <TableCell>{formatCurrency(m.total)}</TableCell>
                            <TableCell className="text-green-600 dark:text-green-300">{formatCurrency(m.paid)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Customers Report Tab */}
          <TabsContent value="customers" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>{pickLang(language, {ku:"ڕاپۆرتی کڕیارەکان", en:"Customer report", ar:"تقرير العملاء", zh:"客户报告"})}</CardTitle>
                  <CardDescription>{pickLang(language, {ku:"سەرەوەترین کڕیارەکان بەپێی بڕی پسوڵە", en:"Top customers by invoice amount", ar:"أبرز العملاء حسب مبلغ الفواتير", zh:"按发票金额排名的客户"})}</CardDescription>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" disabled={isExporting || customerLoading}>
                      <Download className="h-4 w-4 ms-2" />
                      {pickLang(language, {ku:"دابەزاندن", en:"Download", ar:"تنزيل", zh:"下载"})}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => exportCustomerReport('csv')}>
                      <FileSpreadsheet className="h-4 w-4 ms-2" />
                      Excel (CSV)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportCustomerReport('pdf')}>
                      <File className="h-4 w-4 ms-2" />
                      {pickLang(language, {ku:"PDF / چاپکردن", en:"PDF / Print", ar:"PDF / طباعة", zh:"PDF / 打印"})}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent>
                {customerLoading ? (
                  <div className="space-y-4">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">{pickLang(language, {ku:"کڕیار", en:"Customer", ar:"العميل", zh:"客户"})}</TableHead>
                        <TableHead className="text-right">{pickLang(language, {ku:"کۆدی کڕیار", en:"Customer code", ar:"رمز العميل", zh:"客户编码"})}</TableHead>
                        <TableHead className="text-right">{pickLang(language, {ku:"ژمارەی پسوڵە", en:"Invoice count", ar:"عدد الفواتير", zh:"发票数量"})}</TableHead>
                        <TableHead className="text-right">{pickLang(language, {ku:"کۆی بڕ", en:"Total amount", ar:"إجمالي المبلغ", zh:"总金额"})}</TableHead>
                        <TableHead className="text-right">{pickLang(language, {ku:"پارەدراو", en:"Paid", ar:"مدفوع", zh:"已付"})}</TableHead>
                        <TableHead className="text-right">{pickLang(language, {ku:"ماوە", en:"Remaining", ar:"المتبقي", zh:"剩余"})}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customerReport?.map((c, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{c.customerName}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{c.customerCode}</Badge>
                          </TableCell>
                          <TableCell>{c.totalInvoices}</TableCell>
                          <TableCell>{formatCurrency(c.totalAmountUsd)}</TableCell>
                          <TableCell className="text-green-600 dark:text-green-300">{formatCurrency(c.paidAmountUsd)}</TableCell>
                          <TableCell className="text-amber-600 dark:text-amber-300">{formatCurrency(c.unpaidAmountUsd)}</TableCell>
                        </TableRow>
                      ))}
                      {(!customerReport || customerReport.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            {pickLang(language, {ku:"هیچ داتایەک نییە", en:"No data available", ar:"لا توجد بيانات", zh:"暂无数据"})}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Services Report Tab */}
          <TabsContent value="services" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>{pickLang(language, {ku:"ڕاپۆرتی خزمەتگوزارییەکان", en:"Services report", ar:"تقرير الخدمات", zh:"服务报告"})}</CardTitle>
                  <CardDescription>{pickLang(language, {ku:"دابەشکردنی پسوڵەکان بەپێی جۆری خزمەتگوزاری", en:"Invoice breakdown by service type", ar:"توزيع الفواتير حسب نوع الخدمة", zh:"按服务类型的发票明细"})}</CardDescription>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" disabled={isExporting || serviceTypeLoading}>
                      <Download className="h-4 w-4 ms-2" />
                      {pickLang(language, {ku:"دابەزاندن", en:"Download", ar:"تنزيل", zh:"下载"})}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => exportServiceReport('csv')}>
                      <FileSpreadsheet className="h-4 w-4 ms-2" />
                      Excel (CSV)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportServiceReport('pdf')}>
                      <File className="h-4 w-4 ms-2" />
                      {pickLang(language, {ku:"PDF / چاپکردن", en:"PDF / Print", ar:"PDF / طباعة", zh:"PDF / 打印"})}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent>
                {serviceTypeLoading ? (
                  <div className="space-y-4">
                    {[...Array(4)].map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Service type cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {serviceTypeReport?.map((s, i) => (
                        <Card key={i} className="bg-muted/50">
                          <CardContent className="pt-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium">{s.serviceType}</p>
                                <p className="text-2xl font-bold mt-1">{formatCurrency(s.totalAmountUsd)}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm text-muted-foreground">{s.totalInvoices} {pickLang(language, {ku:"پسوڵە", en:"invoices", ar:"فاتورة", zh:"张发票"})}</p>
                                <p className="text-sm text-muted-foreground">
                                  {pickLang(language, {ku:"ناوەندی", en:"Average", ar:"المتوسط", zh:"平均"})}: {formatCurrency(s.averageAmountUsd)}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    {(!serviceTypeReport || serviceTypeReport.length === 0) && (
                      <div className="text-center text-muted-foreground py-8">
                        {pickLang(language, {ku:"هیچ داتایەک نییە", en:"No data available", ar:"لا توجد بيانات", zh:"暂无数据"})}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Recent Invoices Tab */}
          <TabsContent value="recent" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{pickLang(language, {ku:"دوایین پسوڵەکان", en:"Recent invoices", ar:"أحدث الفواتير", zh:"最近的发票"})}</CardTitle>
                <CardDescription>{pickLang(language, {ku:"١٠ پسوڵەی دوایین", en:"Last 10 invoices", ar:"آخر 10 فواتير", zh:"最近10张发票"})}</CardDescription>
              </CardHeader>
              <CardContent>
                {recentLoading ? (
                  <div className="space-y-4">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">{pickLang(language, {ku:"ژمارەی پسوڵە", en:"Invoice number", ar:"رقم الفاتورة", zh:"发票号"})}</TableHead>
                        <TableHead className="text-right">{pickLang(language, {ku:"بەروار", en:"Date", ar:"التاريخ", zh:"日期"})}</TableHead>
                        <TableHead className="text-right">{pickLang(language, {ku:"بڕ", en:"Amount", ar:"المبلغ", zh:"金额"})}</TableHead>
                        <TableHead className="text-right">{pickLang(language, {ku:"دۆخ", en:"Status", ar:"الحالة", zh:"状态"})}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentInvoices?.invoices.map((inv: any) => (
                        <TableRow key={inv.id}>
                          <TableCell className="font-medium font-mono">{inv.invoiceNumber}</TableCell>
                          <TableCell>
                            {new Date(inv.createdAt).toLocaleDateString('ku-IQ')}
                          </TableCell>
                          <TableCell>{formatCurrency(parseFloat(inv.totalUsd))}</TableCell>
                          <TableCell>{getStatusBadge(inv.status)}</TableCell>
                        </TableRow>
                      ))}
                      {(!recentInvoices?.invoices || recentInvoices.invoices.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                            {pickLang(language, {ku:"هیچ پسوڵەیەک نییە", en:"No invoices available", ar:"لا توجد فواتير", zh:"暂无发票"})}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
