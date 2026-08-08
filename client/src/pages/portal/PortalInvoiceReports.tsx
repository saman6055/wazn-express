import { usePortalPalette } from "@/components/portal/PortalHeaderControls";
import { CustomerPortalLayout } from "@/components/CustomerPortalLayout";
import { usePortalTheme } from "@/contexts/PortalThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { invoiceState, isInvoiceOutstanding } from "@/lib/portalMoney";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import { 
  FileText, 
  TrendingUp, 
  Calendar,
  Download,
  BarChart3,
  CheckCircle,
  Clock,
  Filter,
  FileSpreadsheet,
  File,
  ChevronDown
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatPortalDate } from "@/lib/portalClock";

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

function ClassicPortalInvoiceReports() {
  // Banner colour follows the mode the customer picked, like every other page.
  const { banner: portalBanner } = usePortalPalette();
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const isRTL = language === "ku" || language === "ar";
  
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [dateRange, setDateRange] = useState<"all" | "month" | "quarter" | "year">("year");
  const [showExportMenu, setShowExportMenu] = useState(false);
  
  // Calculate date range
  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    let start: Date | undefined;
    let end: Date | undefined;
    
    switch (dateRange) {
      case "month":
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        break;
      case "quarter":
        const quarter = Math.floor(now.getMonth() / 3);
        start = new Date(now.getFullYear(), quarter * 3, 1);
        end = new Date(now.getFullYear(), (quarter + 1) * 3, 0, 23, 59, 59, 999);
        break;
      case "year":
        start = new Date(selectedYear, 0, 1);
        end = new Date(selectedYear, 11, 31, 23, 59, 59, 999);
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

  // Fetch customer's invoice data
  const { data: invoices, isLoading: invoicesLoading } = trpc.customerPortal.getMyInvoices.useQuery();

  // Calculate summary from invoices
  const summary = useMemo(() => {
    if (!invoices) return null;
    
    let filtered = invoices;
    if (startDate && endDate) {
      filtered = invoices.filter((inv: any) => {
        const invDate = new Date(inv.createdAt);
        return invDate >= new Date(startDate) && invDate <= new Date(endDate);
      });
    }
    
    const totalInvoices = filtered.length;
    const paidInvoices = filtered.filter((inv: any) => inv.status === 'paid').length;
    const unpaidInvoices = filtered.filter((inv: any) => inv.status !== 'paid').length;
    const totalAmountUsd = filtered.reduce((sum: number, inv: any) => sum + Number(inv.totalUsd || 0), 0);
    const paidAmountUsd = filtered.filter((inv: any) => invoiceState(inv.status) === "paid")
      .reduce((sum: number, inv: any) => sum + Number(inv.totalUsd || 0), 0);
    const unpaidAmountUsd = filtered.filter((inv: any) => isInvoiceOutstanding(inv.status))
      .reduce((sum: number, inv: any) => sum + Number(inv.totalUsd || 0), 0);
    const averageInvoiceUsd = totalInvoices > 0 ? totalAmountUsd / totalInvoices : 0;
    
    return {
      totalInvoices,
      paidInvoices,
      unpaidInvoices,
      totalAmountUsd,
      paidAmountUsd,
      unpaidAmountUsd,
      averageInvoiceUsd
    };
  }, [invoices, startDate, endDate]);

  // Calculate monthly report
  const monthlyReport = useMemo(() => {
    if (!invoices) return [];
    
    const months = [];
    for (let i = 0; i < 12; i++) {
      const monthInvoices = invoices.filter((inv: any) => {
        const invDate = new Date(inv.createdAt);
        return invDate.getMonth() === i && invDate.getFullYear() === selectedYear;
      });
      
      months.push({
        month: kurdishMonths[i],
        monthEn: englishMonths[i],
        monthNumber: i + 1,
        count: monthInvoices.length,
        total: monthInvoices.reduce((sum: number, inv: any) => sum + Number(inv.totalUsd || 0), 0),
        paid: monthInvoices.filter((inv: any) => inv.status === 'paid')
          .reduce((sum: number, inv: any) => sum + Number(inv.totalUsd || 0), 0),
        unpaid: monthInvoices.filter((inv: any) => inv.status !== 'paid')
          .reduce((sum: number, inv: any) => sum + Number(inv.totalUsd || 0), 0)
      });
    }
    return months;
  }, [invoices, selectedYear]);

  const maxMonthlyTotal = useMemo(() => {
    if (!monthlyReport.length) return 1;
    return Math.max(...monthlyReport.map(m => m.total), 1);
  }, [monthlyReport]);

  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const dateFilters = [
    { value: "all", label: pickLang(language, { ku: "هەموو", en: "All Time", ar: "كل الفترات", zh: "全部时间" }) },
    { value: "month", label: pickLang(language, { ku: "ئەم مانگە", en: "This Month", ar: "هذا الشهر", zh: "本月" }) },
    { value: "quarter", label: pickLang(language, { ku: "ئەم چارەکە", en: "This Quarter", ar: "هذا الربع", zh: "本季度" }) },
    { value: "year", label: pickLang(language, { ku: "ئەم ساڵە", en: "This Year", ar: "هذه السنة", zh: "本年" }) },
  ];

  // Export to CSV
  const exportToCSV = () => {
    if (!monthlyReport.length) {
      toast.error(t('portal.exportNoData'));
      return;
    }

    const headers = ['Month', 'Invoice Count', 'Total Amount (USD)', 'Paid Amount (USD)', 'Unpaid Amount (USD)'];
    const data = monthlyReport.map(m => [
      m.monthEn,
      m.count,
      m.total.toFixed(2),
      m.paid.toFixed(2),
      m.unpaid.toFixed(2)
    ]);

    const csvContent = [
      headers.join(','),
      ...data.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `my-invoice-report-${selectedYear}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success(t('portal.reportDownloaded'));
    setShowExportMenu(false);
  };

  // Export to PDF (print)
  const exportToPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error(t('portal.allowPopupsForPrint'));
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice Report - ${selectedYear}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { text-align: center; color: #333; }
          .summary { display: flex; justify-content: space-around; margin: 20px 0; flex-wrap: wrap; }
          .summary-card { background: #f5f5f5; padding: 15px 25px; border-radius: 8px; text-align: center; margin: 5px; }
          .summary-card h3 { margin: 0; color: #666; font-size: 14px; }
          .summary-card p { margin: 5px 0 0; font-size: 20px; font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
          th { background-color: #4CAF50; color: white; }
          tr:nth-child(even) { background-color: #f9f9f9; }
          .footer { text-align: center; margin-top: 30px; color: #999; font-size: 12px; }
        </style>
      </head>
      <body>
        <h1>My Invoice Report - ${selectedYear}</h1>
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
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th>Invoice Count</th>
              <th>Total Amount</th>
              <th>Paid</th>
              <th>Unpaid</th>
            </tr>
          </thead>
          <tbody>
            ${monthlyReport.map(m => `
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
        <p class="footer">Generated on ${formatPortalDate(new Date(), language)}</p>
        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    toast.success(t('portal.reportReadyForPrint'));
    setShowExportMenu(false);
  };

  return (
    <CustomerPortalLayout>
      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0" style={portalBanner} />
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-10 right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-10 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
        </div>
        <div className="relative px-5 pt-14 pb-20">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">
                {pickLang(language, { ku: "ڕاپۆرتی پسوڵەکانم", en: "My Invoice Reports", ar: "تقارير فواتيري", zh: "我的发票报表" })}
              </h1>
              <p className="text-white/70 text-sm mt-1">
                {pickLang(language, { ku: "پوختەی پسوڵەکان و ئاماری دارایی", en: "Invoice summary and financial statistics", ar: "ملخص الفواتير والإحصاءات المالية", zh: "发票汇总与财务统计" })}
              </p>
            </div>
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center",
              "bg-white/20 backdrop-blur-sm"
            )}>
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="px-4 -mt-10 relative z-10 mb-4">
        <div className={cn(
          "rounded-2xl p-4 shadow-lg",
          isDark ? "bg-slate-800" : "bg-white"
        )}>
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="flex gap-2 flex-wrap">
              {dateFilters.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setDateRange(f.value as any)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                    dateRange === f.value
                      ? isDark 
                        ? "bg-emerald-600 text-white" 
                        : "bg-emerald-500 text-white"
                      : isDark 
                        ? "bg-slate-700 text-slate-300 hover:bg-slate-600" 
                        : "bg-gray-100 dark:bg-gray-950/40 text-gray-600 hover:bg-gray-200"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            
            <div className="flex gap-2 items-center">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-medium border-0 outline-none",
                  isDark 
                    ? "bg-slate-700 text-white" 
                    : "bg-gray-100 dark:bg-gray-950/40 text-gray-700 dark:text-gray-300"
                )}
              >
                {years.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              
              <div className="relative">
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2",
                    isDark 
                      ? "bg-emerald-600 text-white hover:bg-emerald-700" 
                      : "bg-emerald-500 text-white hover:bg-emerald-600"
                  )}
                >
                  <Download className="w-4 h-4" />
                  {pickLang(language, { ku: "دابەزاندن", en: "Export", ar: "تصدير", zh: "导出" })}
                  <ChevronDown className="w-3 h-3" />
                </button>
                
                {showExportMenu && (
                  <div className={cn(
                    "absolute right-0 mt-2 w-40 rounded-lg shadow-lg z-50",
                    isDark ? "bg-slate-700" : "bg-white border"
                  )}>
                    <button
                      onClick={exportToCSV}
                      className={cn(
                        "w-full px-4 py-2 text-sm text-left flex items-center gap-2",
                        isDark ? "hover:bg-slate-600 text-white" : "hover:bg-gray-100"
                      )}
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      Excel (CSV)
                    </button>
                    <button
                      onClick={exportToPDF}
                      className={cn(
                        "w-full px-4 py-2 text-sm text-left flex items-center gap-2",
                        isDark ? "hover:bg-slate-600 text-white" : "hover:bg-gray-100"
                      )}
                    >
                      <File className="w-4 h-4" />
                      PDF / {pickLang(language, { ku: "چاپکردن", en: "Print", ar: "طباعة", zh: "打印" })}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="px-4 mb-4">
        <div className="grid grid-cols-2 gap-3">
          <div className={cn(
            "rounded-2xl p-4 shadow-lg",
            isDark ? "bg-slate-800" : "bg-white"
          )}>
            <div className="flex items-center gap-2 mb-2">
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center",
                isDark ? "bg-blue-900/50" : "bg-blue-100 dark:bg-blue-950/40"
              )}>
                <FileText className="w-4 h-4 text-blue-500" />
              </div>
              <span className={cn(
                "text-xs",
                isDark ? "text-slate-400" : "text-gray-500"
              )}>
                {pickLang(language, { ku: "کۆی پسوڵە", en: "Total Invoices", ar: "إجمالي الفواتير", zh: "发票总数" })}
              </span>
            </div>
            {invoicesLoading ? (
              <Skeleton className="h-7 w-16" />
            ) : (
              <>
                <p className={cn(
                  "text-xl font-bold",
                  isDark ? "text-white" : "text-gray-900 dark:text-gray-200"
                )}>
                  {summary?.totalInvoices || 0}
                </p>
                <p className={cn(
                  "text-xs mt-1",
                  isDark ? "text-slate-400" : "text-gray-500"
                )}>
                  {formatCurrency(summary?.totalAmountUsd || 0)}
                </p>
              </>
            )}
          </div>

          <div className={cn(
            "rounded-2xl p-4 shadow-lg",
            isDark ? "bg-slate-800" : "bg-white"
          )}>
            <div className="flex items-center gap-2 mb-2">
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center",
                isDark ? "bg-emerald-900/50" : "bg-emerald-100 dark:bg-emerald-950/40"
              )}>
                <CheckCircle className="w-4 h-4 text-emerald-500" />
              </div>
              <span className={cn(
                "text-xs",
                isDark ? "text-slate-400" : "text-gray-500"
              )}>
                {pickLang(language, { ku: "پارەدراو", en: "Paid", ar: "مدفوعة", zh: "已支付" })}
              </span>
            </div>
            {invoicesLoading ? (
              <Skeleton className="h-7 w-16" />
            ) : (
              <>
                <p className="text-xl font-bold text-emerald-500">
                  {summary?.paidInvoices || 0}
                </p>
                <p className={cn(
                  "text-xs mt-1",
                  isDark ? "text-slate-400" : "text-gray-500"
                )}>
                  {formatCurrency(summary?.paidAmountUsd || 0)}
                </p>
              </>
            )}
          </div>

          <div className={cn(
            "rounded-2xl p-4 shadow-lg",
            isDark ? "bg-slate-800" : "bg-white"
          )}>
            <div className="flex items-center gap-2 mb-2">
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center",
                isDark ? "bg-purple-900/50" : "bg-purple-100 dark:bg-purple-950/40"
              )}>
                <TrendingUp className="w-4 h-4 text-purple-500" />
              </div>
              <span className={cn(
                "text-xs",
                isDark ? "text-slate-400" : "text-gray-500"
              )}>
                {pickLang(language, { ku: "ناوەندی", en: "Average", ar: "المتوسط", zh: "平均" })}
              </span>
            </div>
            {invoicesLoading ? (
              <Skeleton className="h-7 w-16" />
            ) : (
              <p className="text-xl font-bold text-purple-500">
                {formatCurrency(summary?.averageInvoiceUsd || 0)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Monthly Chart */}
      <div className="px-4 mb-4">
        <div className={cn(
          "rounded-2xl p-4 shadow-lg",
          isDark ? "bg-slate-800" : "bg-white"
        )}>
          <h3 className={cn(
            "font-semibold mb-4",
            isDark ? "text-white" : "text-gray-900 dark:text-gray-200"
          )}>
            {language === "ku" ? `ڕاپۆرتی مانگانە - ${selectedYear}` : `Monthly Report - ${selectedYear}`}
          </h3>
          
          {invoicesLoading ? (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Bar Chart */}
              <div className="grid grid-cols-12 gap-1 h-32 items-end">
                {monthlyReport.map((m, i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <div 
                      className={cn(
                        "w-full rounded-t transition-all",
                        isDark 
                          ? "bg-gradient-to-t from-emerald-600 to-emerald-400" 
                          : "bg-gradient-to-t from-emerald-500 to-emerald-300"
                      )}
                      style={{ 
                        height: `${(m.total / maxMonthlyTotal) * 100}%`,
                        minHeight: m.total > 0 ? '4px' : '0'
                      }}
                      title={`${m.month}: ${formatCurrency(m.total)}`}
                    />
                    <span className={cn(
                      "text-[8px] truncate w-full text-center",
                      isDark ? "text-slate-400" : "text-gray-500"
                    )}>
                      {m.month.slice(0, 2)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Monthly List */}
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {monthlyReport.map((m, i) => (
                  <div 
                    key={i}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-xl",
                      isDark ? "bg-slate-700/50" : "bg-gray-50 dark:bg-gray-950/40"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold",
                        isDark ? "bg-slate-600 text-white" : "bg-gray-200 text-gray-700 dark:text-gray-300"
                      )}>
                        {m.monthNumber}
                      </div>
                      <div>
                        <p className={cn(
                          "text-sm font-medium",
                          isDark ? "text-white" : "text-gray-900 dark:text-gray-200"
                        )}>
                          {m.month}
                        </p>
                        <p className={cn(
                          "text-xs",
                          isDark ? "text-slate-400" : "text-gray-500"
                        )}>
                          {m.count} {pickLang(language, { ku: "پسوڵە", en: "invoices", ar: "فاتورة", zh: "张发票" })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn(
                        "text-sm font-semibold",
                        isDark ? "text-white" : "text-gray-900 dark:text-gray-200"
                      )}>
                        {formatCurrency(m.total)}
                      </p>
                      <p className="text-xs text-emerald-500">{formatCurrency(m.paid)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom padding for mobile nav */}
      <div className="h-20" />
    </CustomerPortalLayout>
  );
}

export default function PortalInvoiceReports() {
  const { portalTheme } = usePortalTheme();
  
  // For now, use the classic theme for all
  // Can add modern version later if needed
  return <ClassicPortalInvoiceReports />;
}
