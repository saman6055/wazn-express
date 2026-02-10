import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { 
  Package, DollarSign, TrendingUp, TrendingDown, Plane, Ship, AlertTriangle,
  Eye, Search, Filter, Download, FileSpreadsheet, Printer, BarChart3,
  CheckCircle, Clock, Truck, Building2, Archive, ChevronRight, Wallet,
  Calculator, Scale, Boxes, Calendar, X, GitCompare, PieChart, FileDown
} from "lucide-react";
import { Link } from "wouter";
import { useState, useMemo, useRef } from "react";
import { toast } from "sonner";

// Helper functions
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

const formatNumber = (num: number) => {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(num);
};

const formatDate = (date: Date | string | null) => {
  if (!date) return '-';
  const d = new Date(date);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

// Shipping type labels and icons
const shippingTypeConfig: Record<string, { label: string; icon: React.ReactNode; color: string; bgColor: string }> = {
  air_regular: { 
    label: "ئاسمانی", 
    icon: <Plane className="h-4 w-4" />, 
    color: "text-blue-700",
    bgColor: "bg-blue-100"
  },
  air_irregular: { 
    label: "ئاسمانی مەترسیدار", 
    icon: <AlertTriangle className="h-4 w-4" />, 
    color: "text-orange-700",
    bgColor: "bg-orange-100"
  },
  sea: { 
    label: "دەریایی", 
    icon: <Ship className="h-4 w-4" />, 
    color: "text-cyan-700",
    bgColor: "bg-cyan-100"
  }
};

// Status labels and colors
const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: React.ReactNode }> = {
  preparing: { label: "ئامادەکاری", color: "text-yellow-700", bgColor: "bg-yellow-100", icon: <Clock className="h-3 w-3" /> },
  in_transit: { label: "لە ڕێگادا", color: "text-blue-700", bgColor: "bg-blue-100", icon: <Truck className="h-3 w-3" /> },
  arrived: { label: "گەیشتووە", color: "text-green-700", bgColor: "bg-green-100", icon: <CheckCircle className="h-3 w-3" /> },
  customs: { label: "گومرگ", color: "text-purple-700", bgColor: "bg-purple-100", icon: <Building2 className="h-3 w-3" /> },
  delivered: { label: "گەیەندرا", color: "text-emerald-700", bgColor: "bg-emerald-100", icon: <CheckCircle className="h-3 w-3" /> },
  closed: { label: "داخراوە", color: "text-gray-700", bgColor: "bg-gray-100", icon: <Archive className="h-3 w-3" /> }
};

// Generate month options
const getMonthOptions = () => {
  const months = [];
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      value: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      label: date.toLocaleDateString('ku', { year: 'numeric', month: 'long' })
    });
  }
  return months;
};

// Generate year options
const getYearOptions = () => {
  const years = [];
  const currentYear = new Date().getFullYear();
  for (let i = 0; i < 5; i++) {
    years.push({
      value: String(currentYear - i),
      label: String(currentYear - i)
    });
  }
  return years;
};

export default function BatchReports() {
  const [shippingTypeFilter, setShippingTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Date filter states
  const [dateFilterType, setDateFilterType] = useState<string>("all"); // all, range, month, year
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>("");
  
  // Comparison states
  const [selectedBatches, setSelectedBatches] = useState<Set<number>>(new Set());
  const [showComparison, setShowComparison] = useState(false);

  // Fetch data
  const { data: batches, isLoading } = trpc.batches.list.useQuery();
  const { data: packages } = trpc.packages.list.useQuery({ pageSize: 10000 });

  const monthOptions = useMemo(() => getMonthOptions(), []);
  const yearOptions = useMemo(() => getYearOptions(), []);

  // Calculate financial data for each batch
  const batchFinancials = useMemo(() => {
    if (!batches || !packages?.data) return [];

    return batches.map(batch => {
      const batchPackages = packages.data.filter(p => p.batchId === batch.id);
      
      // Calculate chargeable weight for each package
      let totalChargeableWeight = 0;
      let totalActualWeight = 0;
      let totalCbm = 0;
      
      for (const pkg of batchPackages) {
        const actualKg = Number(pkg.weightKg) || 0;
        const lengthCm = Number(pkg.lengthCm) || 0;
        const widthCm = Number(pkg.widthCm) || 0;
        const heightCm = Number(pkg.heightCm) || 0;
        const volumetricKg = (lengthCm * widthCm * heightCm) / 6000;
        const chargeableKg = Math.max(actualKg, volumetricKg);
        
        totalChargeableWeight += chargeableKg;
        totalActualWeight += actualKg;
        totalCbm += Number(pkg.volumeCbm) || 0;
      }

      // Calculate cost and revenue
      const costPerKg = Number(batch.costPerKg) || 0;
      const costPerCbm = Number(batch.costPerCbm) || 0;
      
      let totalCost = 0;
      if (batch.shippingType === 'sea') {
        totalCost = totalCbm * costPerCbm;
      } else {
        totalCost = totalChargeableWeight * costPerKg;
      }

      const totalRevenue = batchPackages.reduce((sum, pkg) => sum + (Number(pkg.calculatedCostUsd) || 0), 0);
      const profit = totalRevenue - totalCost;
      const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

      return {
        ...batch,
        packageCount: batchPackages.length,
        totalChargeableWeight,
        totalActualWeight,
        totalCbm,
        totalCost,
        totalRevenue,
        profit,
        profitMargin
      };
    });
  }, [batches, packages]);

  // Filter batches
  const filteredBatches = useMemo(() => {
    return batchFinancials.filter(batch => {
      const matchesType = shippingTypeFilter === "all" || batch.shippingType === shippingTypeFilter;
      const matchesStatus = statusFilter === "all" || batch.status === statusFilter;
      const matchesSearch = searchQuery === "" || 
        batch.batchCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        batch.carrierInfo?.toLowerCase().includes(searchQuery.toLowerCase());
      
      // Date filtering
      let matchesDate = true;
      const batchDate = batch.estimatedArrival ? new Date(batch.estimatedArrival) : (batch.createdAt ? new Date(batch.createdAt) : null);
      
      if (dateFilterType === "range" && startDate && endDate && batchDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        matchesDate = batchDate >= start && batchDate <= end;
      } else if (dateFilterType === "month" && selectedMonth && batchDate) {
        const [year, month] = selectedMonth.split('-').map(Number);
        matchesDate = batchDate.getFullYear() === year && batchDate.getMonth() === month - 1;
      } else if (dateFilterType === "year" && selectedYear && batchDate) {
        matchesDate = batchDate.getFullYear() === parseInt(selectedYear);
      }
      
      return matchesType && matchesStatus && matchesSearch && matchesDate;
    });
  }, [batchFinancials, shippingTypeFilter, statusFilter, searchQuery, dateFilterType, startDate, endDate, selectedMonth, selectedYear]);

  // Calculate totals
  const totals = useMemo(() => {
    return filteredBatches.reduce((acc, batch) => ({
      totalBatches: acc.totalBatches + 1,
      totalPackages: acc.totalPackages + batch.packageCount,
      totalWeight: acc.totalWeight + batch.totalChargeableWeight,
      totalCost: acc.totalCost + batch.totalCost,
      totalRevenue: acc.totalRevenue + batch.totalRevenue,
      totalProfit: acc.totalProfit + batch.profit
    }), {
      totalBatches: 0,
      totalPackages: 0,
      totalWeight: 0,
      totalCost: 0,
      totalRevenue: 0,
      totalProfit: 0
    });
  }, [filteredBatches]);

  const overallProfitMargin = totals.totalRevenue > 0 
    ? (totals.totalProfit / totals.totalRevenue) * 100 
    : 0;

  // Get selected batches for comparison
  const comparisonBatches = useMemo(() => {
    return filteredBatches.filter(b => selectedBatches.has(b.id));
  }, [filteredBatches, selectedBatches]);

  // Toggle batch selection
  const toggleBatchSelection = (batchId: number) => {
    const newSelected = new Set(selectedBatches);
    if (newSelected.has(batchId)) {
      newSelected.delete(batchId);
    } else {
      newSelected.add(batchId);
    }
    setSelectedBatches(newSelected);
  };

  // Clear date filters
  const clearDateFilter = () => {
    setDateFilterType("all");
    setStartDate("");
    setEndDate("");
    setSelectedMonth("");
    setSelectedYear("");
  };

  // Export to Excel
  const handleExportExcel = () => {
    // Create CSV content
    const headers = ["کۆدی باچ", "جۆر", "دۆخ", "پاکەت", "کێش حسابکراو", "تێچوون", "داهات", "قازانج", "ڕێژە"];
    const rows = filteredBatches.map(batch => [
      batch.batchCode,
      shippingTypeConfig[batch.shippingType]?.label || batch.shippingType,
      statusConfig[batch.status]?.label || batch.status,
      batch.packageCount,
      batch.shippingType === 'sea' ? `${formatNumber(batch.totalCbm)} CBM` : `${formatNumber(batch.totalChargeableWeight)} KG`,
      formatNumber(batch.totalCost),
      formatNumber(batch.totalRevenue),
      formatNumber(batch.profit),
      `${batch.profitMargin.toFixed(1)}%`
    ]);
    
    // Add totals row
    rows.push([
      "کۆی گشتی",
      "",
      "",
      totals.totalPackages,
      `${formatNumber(totals.totalWeight)} KG`,
      formatNumber(totals.totalCost),
      formatNumber(totals.totalRevenue),
      formatNumber(totals.totalProfit),
      `${overallProfitMargin.toFixed(1)}%`
    ]);

    const csvContent = [headers.join(","), ...rows.map(row => row.join(","))].join("\n");
    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `batch-report-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("فایلی Excel داگیرا");
  };

  // Print report
  const handlePrint = () => {
    const printContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ku">
      <head>
        <meta charset="UTF-8">
        <title>ڕاپۆرتی دارایی باچەکان</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Tahoma, sans-serif; padding: 20px; direction: rtl; }
          .header { text-align: center; margin-bottom: 30px; padding: 20px; background: linear-gradient(135deg, #059669, #0891b2); color: white; border-radius: 10px; }
          .header h1 { font-size: 24px; margin-bottom: 5px; }
          .header p { opacity: 0.9; }
          .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 30px; }
          .summary-card { padding: 15px; border-radius: 8px; text-align: center; }
          .summary-card.batches { background: #eef2ff; color: #4338ca; }
          .summary-card.cost { background: #fef2f2; color: #dc2626; }
          .summary-card.revenue { background: #f0fdf4; color: #16a34a; }
          .summary-card.profit { background: #ecfdf5; color: #059669; }
          .summary-card h3 { font-size: 12px; margin-bottom: 5px; }
          .summary-card .value { font-size: 20px; font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { padding: 10px; text-align: right; border-bottom: 1px solid #e5e7eb; }
          th { background: #f9fafb; font-weight: 600; }
          .profit-positive { color: #059669; }
          .profit-negative { color: #dc2626; }
          .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>ڕاپۆرتی دارایی باچەکان</h1>
          <p>Wazn Express - ${new Date().toLocaleDateString('ku')}</p>
        </div>
        
        <div class="summary">
          <div class="summary-card batches">
            <h3>کۆی باچەکان</h3>
            <div class="value">${totals.totalBatches}</div>
          </div>
          <div class="summary-card cost">
            <h3>کۆی تێچوون</h3>
            <div class="value">${formatCurrency(totals.totalCost)}</div>
          </div>
          <div class="summary-card revenue">
            <h3>کۆی داهات</h3>
            <div class="value">${formatCurrency(totals.totalRevenue)}</div>
          </div>
          <div class="summary-card profit">
            <h3>کۆی قازانج</h3>
            <div class="value">${formatCurrency(totals.totalProfit)}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>کۆدی باچ</th>
              <th>جۆر</th>
              <th>دۆخ</th>
              <th>پاکەت</th>
              <th>کێش</th>
              <th>تێچوون</th>
              <th>داهات</th>
              <th>قازانج</th>
              <th>ڕێژە</th>
            </tr>
          </thead>
          <tbody>
            ${filteredBatches.map(batch => `
              <tr>
                <td>${batch.batchCode}</td>
                <td>${shippingTypeConfig[batch.shippingType]?.label || batch.shippingType}</td>
                <td>${statusConfig[batch.status]?.label || batch.status}</td>
                <td>${batch.packageCount}</td>
                <td>${batch.shippingType === 'sea' ? `${formatNumber(batch.totalCbm)} CBM` : `${formatNumber(batch.totalChargeableWeight)} KG`}</td>
                <td style="color: #dc2626;">${formatCurrency(batch.totalCost)}</td>
                <td style="color: #16a34a;">${formatCurrency(batch.totalRevenue)}</td>
                <td class="${batch.profit >= 0 ? 'profit-positive' : 'profit-negative'}">${formatCurrency(batch.profit)}</td>
                <td>${batch.profitMargin.toFixed(1)}%</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr style="font-weight: bold; background: #f3f4f6;">
              <td>کۆی گشتی</td>
              <td></td>
              <td></td>
              <td>${totals.totalPackages}</td>
              <td>${formatNumber(totals.totalWeight)} KG</td>
              <td style="color: #dc2626;">${formatCurrency(totals.totalCost)}</td>
              <td style="color: #16a34a;">${formatCurrency(totals.totalRevenue)}</td>
              <td class="${totals.totalProfit >= 0 ? 'profit-positive' : 'profit-negative'}">${formatCurrency(totals.totalProfit)}</td>
              <td>${overallProfitMargin.toFixed(1)}%</td>
            </tr>
          </tfoot>
        </table>

        <div class="footer">
          <p>دروستکراوە لە ${new Date().toLocaleString('ku')} - Wazn Express</p>
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

  // Calculate chart data
  const chartData = useMemo(() => {
    const byType = {
      air_regular: { cost: 0, revenue: 0, profit: 0, count: 0 },
      air_irregular: { cost: 0, revenue: 0, profit: 0, count: 0 },
      sea: { cost: 0, revenue: 0, profit: 0, count: 0 }
    };

    filteredBatches.forEach(batch => {
      const type = batch.shippingType as keyof typeof byType;
      if (byType[type]) {
        byType[type].cost += batch.totalCost;
        byType[type].revenue += batch.totalRevenue;
        byType[type].profit += batch.profit;
        byType[type].count += 1;
      }
    });

    return byType;
  }, [filteredBatches]);

  return (
    <DashboardLayout>
      <div className="space-y-6" dir="rtl">
        {/* Professional Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600 p-8 text-white">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMtOS45NDEgMC0xOCA4LjA1OS0xOCAxOHM4LjA1OSAxOCAxOCAxOCAxOC04LjA1OSAxOC0xOC04LjA1OS0xOC0xOC0xOHptMCAzMmMtNy43MzIgMC0xNC02LjI2OC0xNC0xNHM2LjI2OC0xNCAxNC0xNCAxNCA2LjI2OCAxNCAxNC02LjI2OCAxNC0xNCAxNHoiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iLjA1Ii8+PC9nPjwvc3ZnPg==')] opacity-30" />
          <div className="relative flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Boxes className="h-6 w-6" />
                <span className="text-sm font-medium opacity-90">ڕاپۆرتەکان</span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight mb-2">ڕاپۆرتی دارایی باچەکان</h1>
              <p className="text-white/80 max-w-lg">
                شیکاری دارایی هەموو باچەکان بە یەکجار
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {selectedBatches.size >= 2 && (
                <Button 
                  variant="outline" 
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                  onClick={() => setShowComparison(true)}
                >
                  <GitCompare className="h-4 w-4 ml-2" />
                  بەراوردکردن ({selectedBatches.size})
                </Button>
              )}
              <Button 
                variant="outline" 
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                onClick={handlePrint}
              >
                <Printer className="h-4 w-4 ml-2" />
                چاپکردن
              </Button>
              <Button 
                variant="outline" 
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                onClick={handleExportExcel}
              >
                <FileSpreadsheet className="h-4 w-4 ml-2" />
                Excel
              </Button>
            </div>
          </div>
          <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
        </div>

        {/* Overview Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Total Batches */}
          <Card className="border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-violet-50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-indigo-700">کۆی باچەکان</CardTitle>
              <div className="p-2 bg-indigo-100 rounded-lg">
                <Boxes className="h-5 w-5 text-indigo-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-indigo-700">{totals.totalBatches}</div>
              <p className="text-sm text-indigo-600/70 mt-1">
                {totals.totalPackages} پاکەت
              </p>
            </CardContent>
          </Card>

          {/* Total Cost */}
          <Card className="border-2 border-red-200 bg-gradient-to-br from-red-50 to-rose-50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-red-700">کۆی تێچوون</CardTitle>
              <div className="p-2 bg-red-100 rounded-lg">
                <DollarSign className="h-5 w-5 text-red-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">{formatCurrency(totals.totalCost)}</div>
              <p className="text-sm text-red-600/70 mt-1 flex items-center gap-1">
                <Scale className="h-3 w-3" />
                {formatNumber(totals.totalWeight)} KG
              </p>
            </CardContent>
          </Card>

          {/* Total Revenue */}
          <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-green-700">کۆی داهات</CardTitle>
              <div className="p-2 bg-green-100 rounded-lg">
                <Wallet className="h-5 w-5 text-green-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{formatCurrency(totals.totalRevenue)}</div>
              <p className="text-sm text-green-600/70 mt-1">
                لە {totals.totalPackages} پاکەت
              </p>
            </CardContent>
          </Card>

          {/* Total Profit */}
          <Card className={`border-2 ${totals.totalProfit >= 0 
            ? 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50' 
            : 'border-red-200 bg-gradient-to-br from-red-50 to-rose-50'}`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className={`text-sm font-medium ${totals.totalProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                {totals.totalProfit >= 0 ? 'کۆی قازانج' : 'کۆی زیان'}
              </CardTitle>
              <div className={`p-2 rounded-lg ${totals.totalProfit >= 0 ? 'bg-emerald-100' : 'bg-red-100'}`}>
                {totals.totalProfit >= 0 
                  ? <TrendingUp className="h-5 w-5 text-emerald-600" />
                  : <TrendingDown className="h-5 w-5 text-red-600" />
                }
              </div>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${totals.totalProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {formatCurrency(Math.abs(totals.totalProfit))}
              </div>
              <p className={`text-sm mt-1 ${totals.totalProfit >= 0 ? 'text-emerald-600/70' : 'text-red-600/70'}`}>
                ڕێژە: {overallProfitMargin.toFixed(1)}%
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Filter className="h-5 w-5" />
              فیلتەرەکان
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* First row - Basic filters */}
            <div className="flex flex-wrap gap-4">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="گەڕان بە کۆدی باچ..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-10"
                />
              </div>

              {/* Shipping Type Filter */}
              <Select value={shippingTypeFilter} onValueChange={setShippingTypeFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="جۆری گواستنەوە" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">هەموو جۆرەکان</SelectItem>
                  <SelectItem value="air_regular">✈️ ئاسمانی</SelectItem>
                  <SelectItem value="air_irregular">⚠️ ئاسمانی مەترسیدار</SelectItem>
                  <SelectItem value="sea">🚢 دەریایی</SelectItem>
                </SelectContent>
              </Select>

              {/* Status Filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="دۆخ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">هەموو دۆخەکان</SelectItem>
                  <SelectItem value="preparing">ئامادەکاری</SelectItem>
                  <SelectItem value="in_transit">لە ڕێگادا</SelectItem>
                  <SelectItem value="arrived">گەیشتووە</SelectItem>
                  <SelectItem value="customs">گومرگ</SelectItem>
                  <SelectItem value="delivered">گەیەندرا</SelectItem>
                  <SelectItem value="closed">داخراوە</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Second row - Date filters */}
            <div className="flex flex-wrap gap-4 items-end border-t pt-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">فیلتەری بەروار:</span>
              </div>

              {/* Date Filter Type */}
              <Select value={dateFilterType} onValueChange={(v) => { setDateFilterType(v); if (v === "all") clearDateFilter(); }}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="جۆری فیلتەر" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">هەموو کات</SelectItem>
                  <SelectItem value="range">ماوەی دیاریکراو</SelectItem>
                  <SelectItem value="month">مانگانە</SelectItem>
                  <SelectItem value="year">ساڵانە</SelectItem>
                </SelectContent>
              </Select>

              {/* Date Range Inputs */}
              {dateFilterType === "range" && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">لە:</span>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-[160px]"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">بۆ:</span>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-[160px]"
                    />
                  </div>
                </>
              )}

              {/* Month Selector */}
              {dateFilterType === "month" && (
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="هەڵبژاردنی مانگ" />
                  </SelectTrigger>
                  <SelectContent>
                    {monthOptions.map(month => (
                      <SelectItem key={month.value} value={month.value}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Year Selector */}
              {dateFilterType === "year" && (
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="هەڵبژاردنی ساڵ" />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map(year => (
                      <SelectItem key={year.value} value={year.value}>
                        {year.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Clear Filter Button */}
              {dateFilterType !== "all" && (
                <Button variant="ghost" size="sm" onClick={clearDateFilter} className="text-muted-foreground">
                  <X className="h-4 w-4 ml-1" />
                  پاککردنەوە
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Visual Charts */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Bar Chart - Cost vs Revenue */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BarChart3 className="h-5 w-5" />
                بەراوردی تێچوون و داهات
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(chartData).map(([type, data]) => {
                  const config = shippingTypeConfig[type];
                  const maxValue = Math.max(data.cost, data.revenue, 1);
                  return (
                    <div key={type} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded ${config.bgColor}`}>
                          {config.icon}
                        </div>
                        <span className="font-medium">{config.label}</span>
                        <span className="text-sm text-muted-foreground">({data.count} باچ)</span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs w-16 text-red-600">تێچوون</span>
                          <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-red-500 rounded-full transition-all duration-500"
                              style={{ width: `${(data.cost / maxValue) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs w-20 text-left">{formatCurrency(data.cost)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs w-16 text-green-600">داهات</span>
                          <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-green-500 rounded-full transition-all duration-500"
                              style={{ width: `${(data.revenue / maxValue) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs w-20 text-left">{formatCurrency(data.revenue)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Pie Chart - Profit Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <PieChart className="h-5 w-5" />
                دابەشبوونی قازانج
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center">
                <div className="relative w-48 h-48">
                  {(() => {
                    const totalProfit = Object.values(chartData).reduce((sum, d) => sum + Math.max(0, d.profit), 0);
                    let currentAngle = 0;
                    const colors = {
                      air_regular: '#3b82f6',
                      air_irregular: '#f97316',
                      sea: '#06b6d4'
                    };
                    
                    if (totalProfit === 0) {
                      return (
                        <div className="w-full h-full rounded-full bg-gray-100 flex items-center justify-center">
                          <span className="text-muted-foreground text-sm">هیچ قازانجێک نییە</span>
                        </div>
                      );
                    }

                    const segments = Object.entries(chartData)
                      .filter(([_, d]) => d.profit > 0)
                      .map(([type, data]) => {
                        const percentage = (data.profit / totalProfit) * 100;
                        const startAngle = currentAngle;
                        currentAngle += (percentage / 100) * 360;
                        return { type, percentage, startAngle, endAngle: currentAngle, color: colors[type as keyof typeof colors] };
                      });

                    return (
                      <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                        {segments.map((seg, i) => {
                          const startRad = (seg.startAngle * Math.PI) / 180;
                          const endRad = (seg.endAngle * Math.PI) / 180;
                          const largeArc = seg.endAngle - seg.startAngle > 180 ? 1 : 0;
                          const x1 = 50 + 40 * Math.cos(startRad);
                          const y1 = 50 + 40 * Math.sin(startRad);
                          const x2 = 50 + 40 * Math.cos(endRad);
                          const y2 = 50 + 40 * Math.sin(endRad);
                          
                          return (
                            <path
                              key={i}
                              d={`M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`}
                              fill={seg.color}
                              className="transition-all duration-500"
                            />
                          );
                        })}
                        <circle cx="50" cy="50" r="20" fill="white" />
                      </svg>
                    );
                  })()}
                </div>
              </div>
              <div className="flex justify-center gap-4 mt-4">
                {Object.entries(chartData).map(([type, data]) => {
                  const config = shippingTypeConfig[type];
                  const totalProfit = Object.values(chartData).reduce((sum, d) => sum + Math.max(0, d.profit), 0);
                  const percentage = totalProfit > 0 ? ((Math.max(0, data.profit) / totalProfit) * 100).toFixed(1) : '0';
                  return (
                    <div key={type} className="text-center">
                      <div className={`w-3 h-3 rounded-full mx-auto mb-1 ${type === 'air_regular' ? 'bg-blue-500' : type === 'air_irregular' ? 'bg-orange-500' : 'bg-cyan-500'}`} />
                      <div className="text-xs font-medium">{config.label}</div>
                      <div className="text-xs text-muted-foreground">{percentage}%</div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Batches Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-lg">
                <BarChart3 className="h-5 w-5" />
                لیستی باچەکان ({filteredBatches.length})
              </div>
              {selectedBatches.size > 0 && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setSelectedBatches(new Set())}
                >
                  <X className="h-4 w-4 ml-1" />
                  پاککردنەوەی هەڵبژاردن ({selectedBatches.size})
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : filteredBatches.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Boxes className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>هیچ باچێک نەدۆزرایەوە</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-center w-12">
                        <Checkbox
                          checked={selectedBatches.size === filteredBatches.length && filteredBatches.length > 0}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedBatches(new Set(filteredBatches.map(b => b.id)));
                            } else {
                              setSelectedBatches(new Set());
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead className="text-right font-bold">کۆدی باچ</TableHead>
                      <TableHead className="text-right font-bold">جۆر</TableHead>
                      <TableHead className="text-right font-bold">دۆخ</TableHead>
                      <TableHead className="text-right font-bold">پاکەت</TableHead>
                      <TableHead className="text-right font-bold">کێش حسابکراو</TableHead>
                      <TableHead className="text-right font-bold">تێچوون</TableHead>
                      <TableHead className="text-right font-bold">داهات</TableHead>
                      <TableHead className="text-right font-bold">قازانج</TableHead>
                      <TableHead className="text-right font-bold">ڕێژە</TableHead>
                      <TableHead className="text-center font-bold">کردار</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBatches.map((batch) => {
                      const typeConfig = shippingTypeConfig[batch.shippingType] || shippingTypeConfig.air_regular;
                      const statusCfg = statusConfig[batch.status] || statusConfig.preparing;
                      const isProfitable = batch.profit >= 0;
                      const isSelected = selectedBatches.has(batch.id);

                      return (
                        <TableRow 
                          key={batch.id} 
                          className={`hover:bg-muted/30 transition-colors ${isSelected ? 'bg-primary/5' : ''}`}
                        >
                          <TableCell className="text-center">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleBatchSelection(batch.id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <div className={`p-1.5 rounded ${typeConfig.bgColor}`}>
                                {typeConfig.icon}
                              </div>
                              {batch.batchCode}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`${typeConfig.color} ${typeConfig.bgColor} border-0`}>
                              {typeConfig.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`${statusCfg.color} ${statusCfg.bgColor} border-0 flex items-center gap-1 w-fit`}>
                              {statusCfg.icon}
                              {statusCfg.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Package className="h-4 w-4 text-muted-foreground" />
                              {batch.packageCount}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-medium">
                              {batch.shippingType === 'sea' 
                                ? `${formatNumber(batch.totalCbm)} CBM`
                                : `${formatNumber(batch.totalChargeableWeight)} KG`
                              }
                            </span>
                          </TableCell>
                          <TableCell className="text-red-600 font-medium">
                            {formatCurrency(batch.totalCost)}
                          </TableCell>
                          <TableCell className="text-green-600 font-medium">
                            {formatCurrency(batch.totalRevenue)}
                          </TableCell>
                          <TableCell className={`font-bold ${isProfitable ? 'text-emerald-600' : 'text-red-600'}`}>
                            {isProfitable ? '+' : ''}{formatCurrency(batch.profit)}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant="outline" 
                              className={`${
                                batch.profitMargin >= 20 ? 'bg-green-100 text-green-700' :
                                batch.profitMargin >= 10 ? 'bg-yellow-100 text-yellow-700' :
                                batch.profitMargin >= 0 ? 'bg-orange-100 text-orange-700' :
                                'bg-red-100 text-red-700'
                              } border-0`}
                            >
                              {batch.profitMargin.toFixed(1)}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Link href={`/reports/batch-financial/${batch.id}`}>
                              <Button variant="ghost" size="sm" className="hover:bg-primary/10">
                                <Eye className="h-4 w-4 ml-1" />
                                بینین
                                <ChevronRight className="h-4 w-4 mr-1" />
                              </Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary by Type */}
        <div className="grid gap-4 md:grid-cols-3">
          {/* Air Regular */}
          <Card className="border-2 border-blue-200">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-sky-50 rounded-t-lg">
              <CardTitle className="flex items-center gap-2 text-blue-700">
                <Plane className="h-5 w-5" />
                ئاسمانی
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">باچ:</span>
                  <span className="font-bold">{chartData.air_regular.count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">تێچوون:</span>
                  <span className="font-bold text-red-600">{formatCurrency(chartData.air_regular.cost)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">داهات:</span>
                  <span className="font-bold text-green-600">{formatCurrency(chartData.air_regular.revenue)}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-muted-foreground">قازانج:</span>
                  <span className={`font-bold ${chartData.air_regular.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {formatCurrency(chartData.air_regular.profit)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Air Irregular */}
          <Card className="border-2 border-orange-200">
            <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-t-lg">
              <CardTitle className="flex items-center gap-2 text-orange-700">
                <AlertTriangle className="h-5 w-5" />
                ئاسمانی مەترسیدار
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">باچ:</span>
                  <span className="font-bold">{chartData.air_irregular.count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">تێچوون:</span>
                  <span className="font-bold text-red-600">{formatCurrency(chartData.air_irregular.cost)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">داهات:</span>
                  <span className="font-bold text-green-600">{formatCurrency(chartData.air_irregular.revenue)}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-muted-foreground">قازانج:</span>
                  <span className={`font-bold ${chartData.air_irregular.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {formatCurrency(chartData.air_irregular.profit)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sea */}
          <Card className="border-2 border-cyan-200">
            <CardHeader className="bg-gradient-to-r from-cyan-50 to-teal-50 rounded-t-lg">
              <CardTitle className="flex items-center gap-2 text-cyan-700">
                <Ship className="h-5 w-5" />
                دەریایی
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">باچ:</span>
                  <span className="font-bold">{chartData.sea.count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">تێچوون:</span>
                  <span className="font-bold text-red-600">{formatCurrency(chartData.sea.cost)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">داهات:</span>
                  <span className="font-bold text-green-600">{formatCurrency(chartData.sea.revenue)}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-muted-foreground">قازانج:</span>
                  <span className={`font-bold ${chartData.sea.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {formatCurrency(chartData.sea.profit)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Comparison Dialog */}
        <Dialog open={showComparison} onOpenChange={setShowComparison}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <GitCompare className="h-5 w-5" />
                بەراوردکردنی باچەکان ({comparisonBatches.length})
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {comparisonBatches.length < 2 ? (
                <p className="text-center text-muted-foreground py-8">
                  تکایە لانیکەم ٢ باچ هەڵبژێرە بۆ بەراوردکردن
                </p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right font-bold">تایبەتمەندی</TableHead>
                          {comparisonBatches.map(batch => (
                            <TableHead key={batch.id} className="text-center font-bold">
                              {batch.batchCode}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell className="font-medium">جۆر</TableCell>
                          {comparisonBatches.map(batch => (
                            <TableCell key={batch.id} className="text-center">
                              <Badge className={`${shippingTypeConfig[batch.shippingType]?.bgColor} ${shippingTypeConfig[batch.shippingType]?.color} border-0`}>
                                {shippingTypeConfig[batch.shippingType]?.label}
                              </Badge>
                            </TableCell>
                          ))}
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">پاکەت</TableCell>
                          {comparisonBatches.map(batch => (
                            <TableCell key={batch.id} className="text-center font-bold">
                              {batch.packageCount}
                            </TableCell>
                          ))}
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">کێش حسابکراو</TableCell>
                          {comparisonBatches.map(batch => (
                            <TableCell key={batch.id} className="text-center font-bold">
                              {batch.shippingType === 'sea' 
                                ? `${formatNumber(batch.totalCbm)} CBM`
                                : `${formatNumber(batch.totalChargeableWeight)} KG`
                              }
                            </TableCell>
                          ))}
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">تێچوون</TableCell>
                          {comparisonBatches.map(batch => (
                            <TableCell key={batch.id} className="text-center font-bold text-red-600">
                              {formatCurrency(batch.totalCost)}
                            </TableCell>
                          ))}
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">داهات</TableCell>
                          {comparisonBatches.map(batch => (
                            <TableCell key={batch.id} className="text-center font-bold text-green-600">
                              {formatCurrency(batch.totalRevenue)}
                            </TableCell>
                          ))}
                        </TableRow>
                        <TableRow className="bg-muted/30">
                          <TableCell className="font-bold">قازانج</TableCell>
                          {comparisonBatches.map(batch => (
                            <TableCell key={batch.id} className={`text-center font-bold ${batch.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              {formatCurrency(batch.profit)}
                            </TableCell>
                          ))}
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">ڕێژەی قازانج</TableCell>
                          {comparisonBatches.map(batch => (
                            <TableCell key={batch.id} className="text-center">
                              <Badge 
                                className={`${
                                  batch.profitMargin >= 20 ? 'bg-green-100 text-green-700' :
                                  batch.profitMargin >= 10 ? 'bg-yellow-100 text-yellow-700' :
                                  batch.profitMargin >= 0 ? 'bg-orange-100 text-orange-700' :
                                  'bg-red-100 text-red-700'
                                } border-0`}
                              >
                                {batch.profitMargin.toFixed(1)}%
                              </Badge>
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>

                  {/* Comparison Summary */}
                  <Card className="bg-muted/30">
                    <CardContent className="pt-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                        <div>
                          <div className="text-sm text-muted-foreground">کۆی پاکەت</div>
                          <div className="text-xl font-bold">
                            {comparisonBatches.reduce((sum, b) => sum + b.packageCount, 0)}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">کۆی تێچوون</div>
                          <div className="text-xl font-bold text-red-600">
                            {formatCurrency(comparisonBatches.reduce((sum, b) => sum + b.totalCost, 0))}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">کۆی داهات</div>
                          <div className="text-xl font-bold text-green-600">
                            {formatCurrency(comparisonBatches.reduce((sum, b) => sum + b.totalRevenue, 0))}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">کۆی قازانج</div>
                          <div className={`text-xl font-bold ${comparisonBatches.reduce((sum, b) => sum + b.profit, 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {formatCurrency(comparisonBatches.reduce((sum, b) => sum + b.profit, 0))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
