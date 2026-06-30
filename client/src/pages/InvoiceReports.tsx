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
        return <Badge className="bg-green-500/20 text-green-600 border-green-500/30">پارەدراو</Badge>;
      case 'issued':
        return <Badge className="bg-blue-500/20 text-blue-600 border-blue-500/30">دەرچووە</Badge>;
      case 'draft':
        return <Badge className="bg-gray-500/20 text-gray-600 border-gray-500/30">ڕەشنووس</Badge>;
      case 'cancelled':
        return <Badge className="bg-red-500/20 text-red-600 border-red-500/30">هەڵوەشێنراوە</Badge>;
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
      toast.error('هیچ داتایەک نییە بۆ ناردن');
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
        toast.success('ڕاپۆرتی مانگانە دابەزێنرا');
      } else {
        // Generate PDF content
        generatePDFReport('monthly');
      }
    } catch (error) {
      toast.error('هەڵەیەک ڕوویدا لە کاتی ناردن');
    } finally {
      setIsExporting(false);
    }
  };

  // Export Customer Report
  const exportCustomerReport = (format: 'csv' | 'pdf') => {
    if (!customerReport?.length) {
      toast.error('هیچ داتایەک نییە بۆ ناردن');
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
        toast.success('ڕاپۆرتی کڕیارەکان دابەزێنرا');
      } else {
        generatePDFReport('customers');
      }
    } catch (error) {
      toast.error('هەڵەیەک ڕوویدا لە کاتی ناردن');
    } finally {
      setIsExporting(false);
    }
  };

  // Export Service Type Report
  const exportServiceReport = (format: 'csv' | 'pdf') => {
    if (!serviceTypeReport?.length) {
      toast.error('هیچ داتایەک نییە بۆ ناردن');
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
        toast.success('ڕاپۆرتی خزمەتگوزارییەکان دابەزێنرا');
      } else {
        generatePDFReport('services');
      }
    } catch (error) {
      toast.error('هەڵەیەک ڕوویدا لە کاتی ناردن');
    } finally {
      setIsExporting(false);
    }
  };

  // Generate PDF Report
  const generatePDFReport = (reportType: 'monthly' | 'customers' | 'services') => {
    // Create a printable HTML document
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('تکایە ڕێگە بدە بە popup لە براوزەرەکەت');
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
    toast.success('ڕاپۆرت ئامادەیە بۆ چاپکردن');
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">ڕاپۆرتی پسوڵەکان</h1>
            <p className="text-muted-foreground">پوختەی پسوڵەکان و ئاماری دارایی</p>
          </div>
          
          <div className="flex items-center gap-3">
            <Select value={dateRange} onValueChange={(v) => setDateRange(v as any)}>
              <SelectTrigger className="w-[140px]">
                <Filter className="h-4 w-4 ms-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">هەموو</SelectItem>
                <SelectItem value="month">ئەم مانگە</SelectItem>
                <SelectItem value="quarter">ئەم چارەکە</SelectItem>
                <SelectItem value="year">ئەم ساڵە</SelectItem>
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
              <CardTitle className="text-sm font-medium text-muted-foreground">کۆی پسوڵە</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {summaryLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{summary?.totalInvoices || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatCurrency(summary?.totalAmountUsd || 0)} کۆی بڕ
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">پارەدراو</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              {summaryLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-2xl font-bold text-green-600">{summary?.paidInvoices || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatCurrency(summary?.paidAmountUsd || 0)}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">ناوەندی پسوڵە</CardTitle>
              <TrendingUp className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              {summaryLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-2xl font-bold text-blue-600">
                    {formatCurrency(summary?.averageInvoiceUsd || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    بۆ هەر پسوڵەیەک
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
              <span className="hidden sm:inline">مانگانە</span>
            </TabsTrigger>
            <TabsTrigger value="customers" className="gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">کڕیارەکان</span>
            </TabsTrigger>
            <TabsTrigger value="services" className="gap-2">
              <PieChart className="h-4 w-4" />
              <span className="hidden sm:inline">خزمەتگوزارییەکان</span>
            </TabsTrigger>
            <TabsTrigger value="recent" className="gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">دوایین</span>
            </TabsTrigger>
          </TabsList>

          {/* Monthly Report Tab */}
          <TabsContent value="monthly" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>ڕاپۆرتی مانگانە - {selectedYear}</CardTitle>
                  <CardDescription>پوختەی پسوڵەکان بۆ هەر مانگێک</CardDescription>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" disabled={isExporting || monthlyLoading}>
                      <Download className="h-4 w-4 ms-2" />
                      دابەزاندن
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => exportMonthlyReport('csv')}>
                      <FileSpreadsheet className="h-4 w-4 ms-2" />
                      Excel (CSV)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportMonthlyReport('pdf')}>
                      <File className="h-4 w-4 ms-2" />
                      PDF / چاپکردن
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
                          <TableHead className="text-right">مانگ</TableHead>
                          <TableHead className="text-right">ژمارەی پسوڵە</TableHead>
                          <TableHead className="text-right">کۆی بڕ</TableHead>
                          <TableHead className="text-right">پارەدراو</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {monthlyTotals.map((m, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{m.month}</TableCell>
                            <TableCell>{m.count}</TableCell>
                            <TableCell>{formatCurrency(m.total)}</TableCell>
                            <TableCell className="text-green-600">{formatCurrency(m.paid)}</TableCell>
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
                  <CardTitle>ڕاپۆرتی کڕیارەکان</CardTitle>
                  <CardDescription>سەرەوەترین کڕیارەکان بەپێی بڕی پسوڵە</CardDescription>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" disabled={isExporting || customerLoading}>
                      <Download className="h-4 w-4 ms-2" />
                      دابەزاندن
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => exportCustomerReport('csv')}>
                      <FileSpreadsheet className="h-4 w-4 ms-2" />
                      Excel (CSV)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportCustomerReport('pdf')}>
                      <File className="h-4 w-4 ms-2" />
                      PDF / چاپکردن
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
                        <TableHead className="text-right">کڕیار</TableHead>
                        <TableHead className="text-right">کۆدی کڕیار</TableHead>
                        <TableHead className="text-right">ژمارەی پسوڵە</TableHead>
                        <TableHead className="text-right">کۆی بڕ</TableHead>
                        <TableHead className="text-right">پارەدراو</TableHead>
                        <TableHead className="text-right">ماوە</TableHead>
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
                          <TableCell className="text-green-600">{formatCurrency(c.paidAmountUsd)}</TableCell>
                          <TableCell className="text-amber-600">{formatCurrency(c.unpaidAmountUsd)}</TableCell>
                        </TableRow>
                      ))}
                      {(!customerReport || customerReport.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            هیچ داتایەک نییە
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
                  <CardTitle>ڕاپۆرتی خزمەتگوزارییەکان</CardTitle>
                  <CardDescription>دابەشکردنی پسوڵەکان بەپێی جۆری خزمەتگوزاری</CardDescription>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" disabled={isExporting || serviceTypeLoading}>
                      <Download className="h-4 w-4 ms-2" />
                      دابەزاندن
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => exportServiceReport('csv')}>
                      <FileSpreadsheet className="h-4 w-4 ms-2" />
                      Excel (CSV)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportServiceReport('pdf')}>
                      <File className="h-4 w-4 ms-2" />
                      PDF / چاپکردن
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
                                <p className="text-sm text-muted-foreground">{s.totalInvoices} پسوڵە</p>
                                <p className="text-sm text-muted-foreground">
                                  ناوەندی: {formatCurrency(s.averageAmountUsd)}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    {(!serviceTypeReport || serviceTypeReport.length === 0) && (
                      <div className="text-center text-muted-foreground py-8">
                        هیچ داتایەک نییە
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
                <CardTitle>دوایین پسوڵەکان</CardTitle>
                <CardDescription>١٠ پسوڵەی دوایین</CardDescription>
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
                        <TableHead className="text-right">ژمارەی پسوڵە</TableHead>
                        <TableHead className="text-right">بەروار</TableHead>
                        <TableHead className="text-right">بڕ</TableHead>
                        <TableHead className="text-right">دۆخ</TableHead>
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
                            هیچ پسوڵەیەک نییە
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
