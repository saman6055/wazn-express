import { useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { getCompanyInfoFromSettings } from "@/hooks/useCompanyInfo";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Package,
  Plus,
  DollarSign,
  TrendingUp,
  Clock,
  Search,
  ShoppingBag,
  Filter,
  Layers,
  Eye,
  Pencil,
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileText,
  Calendar,
  X,
  ArrowUpDown,
  ShoppingCart,
  Users,
  PackagePlus,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { useTranslation } from "@/contexts/LanguageContext";

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-blue-100 text-blue-800",
  ordered: "bg-indigo-100 text-indigo-800",
  tracking_added: "bg-cyan-100 text-cyan-800",
  in_china_warehouse: "bg-purple-100 text-purple-800",
  in_batch: "bg-violet-100 text-violet-800",
  in_transit: "bg-orange-100 text-orange-800",
  arrived: "bg-teal-100 text-teal-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

type SortField = "date" | "purchase" | "selling" | "profit" | "customer";
type SortDirection = "asc" | "desc";

export default function FullPackageDashboard() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [customerFilter, setCustomerFilter] = useState<string>("all");
  const [batchFilter, setBatchFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [minPrice, setMinPrice] = useState<string>("");
  const [maxPrice, setMaxPrice] = useState<string>("");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [showFilters, setShowFilters] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");

  const statusLabels: Record<string, string> = {
    pending: t("fullPackage.status.pending"),
    approved: t("fullPackage.status.approved"),
    ordered: t("fullPackage.status.ordered"),
    tracking_added: t("fullPackage.status.tracking_added"),
    in_china_warehouse: t("fullPackage.status.in_china_warehouse"),
    in_batch: t("fullPackage.status.in_batch"),
    in_transit: t("fullPackage.status.in_transit"),
    arrived: t("fullPackage.status.arrived"),
    delivered: t("fullPackage.status.delivered"),
    cancelled: t("fullPackage.status.cancelled"),
  };

  const statusOptions = [
    { value: "pending", label: t("fullPackage.status.pending") },
    { value: "approved", label: t("fullPackage.status.approved") },
    { value: "ordered", label: t("fullPackage.status.ordered") },
    { value: "tracking_added", label: t("fullPackage.status.tracking_added") },
    { value: "in_china_warehouse", label: t("fullPackage.status.in_china_warehouse") },
    { value: "in_batch", label: t("fullPackage.status.in_batch") },
    { value: "in_transit", label: t("fullPackage.status.in_transit") },
    { value: "arrived", label: t("fullPackage.status.arrived") },
    { value: "delivered", label: t("fullPackage.status.delivered") },
    { value: "cancelled", label: t("fullPackage.status.cancelled") },
  ];

  const { data: orders, isLoading, refetch } = trpc.fullPackage.list.useQuery({
    orderType: "full_package",
    search: search || undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
  });

  const { data: batches } = trpc.batches.list.useQuery();
  const { data: customers } = trpc.customers.list.useQuery();
  const { data: settings } = trpc.settings.list.useQuery();

  const updateStatusMutation = trpc.fullPackage.updateStatus.useMutation({
    onSuccess: () => {
      toast.success(t("fullPackage.statusUpdated"));
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  // Filter and sort orders
  const filteredOrders = useMemo(() => {
    let result = orders?.filter(o => o.orderType === "full_package") || [];
    
    // Customer filter
    if (customerFilter !== "all") {
      result = result.filter(o => (o as any).customerId?.toString() === customerFilter);
    }
    
    // Batch filter
    if (batchFilter !== "all") {
      result = result.filter(o => (o as any).batchId?.toString() === batchFilter);
    }
    
    // Date range filter
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      result = result.filter(o => new Date(o.createdAt) >= fromDate);
    }
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      result = result.filter(o => new Date(o.createdAt) <= toDate);
    }
    
    // Price range filter (on total purchase)
    if (minPrice) {
      const min = parseFloat(minPrice);
      result = result.filter(o => (parseFloat(o.purchasePriceUsd || "0") * (o.quantity || 1)) >= min);
    }
    if (maxPrice) {
      const max = parseFloat(maxPrice);
      result = result.filter(o => (parseFloat(o.purchasePriceUsd || "0") * (o.quantity || 1)) <= max);
    }
    
    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "date":
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case "purchase":
          comparison = (parseFloat(a.purchasePriceUsd || "0") * (a.quantity || 1)) - 
                       (parseFloat(b.purchasePriceUsd || "0") * (b.quantity || 1));
          break;
        case "selling":
          comparison = (parseFloat(a.sellingPriceUsd || "0") * (a.quantity || 1)) - 
                       (parseFloat(b.sellingPriceUsd || "0") * (b.quantity || 1));
          break;
        case "profit":
          comparison = (parseFloat(a.grossProfitUsd || "0") * (a.quantity || 1)) - 
                       (parseFloat(b.grossProfitUsd || "0") * (b.quantity || 1));
          break;
        case "customer":
          comparison = ((a as any).customer?.fullName || "").localeCompare((b as any).customer?.fullName || "");
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
    
    return result;
  }, [orders, customerFilter, batchFilter, dateFrom, dateTo, minPrice, maxPrice, sortField, sortDirection]);

  // Calculate stats
  const totalOrders = filteredOrders.length;
  const pendingOrders = filteredOrders.filter(o => ["pending", "ordered", "tracking_added"].includes(o.status)).length;
  const inTransitOrders = filteredOrders.filter(o => ["in_batch", "in_transit"].includes(o.status)).length;
  
  const totalPurchaseCost = filteredOrders.reduce((sum, o) => {
    return sum + (parseFloat(o.purchasePriceUsd || "0") * (o.quantity || 1));
  }, 0);
  
  const totalSellingPrice = filteredOrders.reduce((sum, o) => {
    return sum + (parseFloat(o.sellingPriceUsd || "0") * (o.quantity || 1));
  }, 0);
  
  const totalGrossProfit = filteredOrders.reduce((sum, o) => {
    return sum + (parseFloat(o.grossProfitUsd || "0") * (o.quantity || 1));
  }, 0);
  
  const totalNetProfit = filteredOrders.reduce((sum, o) => {
    return sum + (parseFloat(o.netProfitUsd || "0") * (o.quantity || 1));
  }, 0);

  // Check if any filter is active
  const hasActiveFilters = customerFilter !== "all" || batchFilter !== "all" || 
    dateFrom || dateTo || minPrice || maxPrice;

  // Clear all filters
  const clearAllFilters = () => {
    setCustomerFilter("all");
    setBatchFilter("all");
    setDateFrom("");
    setDateTo("");
    setMinPrice("");
    setMaxPrice("");
    setStatusFilter("all");
    setSearch("");
  };

  // Toggle sort
  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  // Export to Excel
  const exportToExcel = () => {
    const data = filteredOrders.map(order => ({
      [t("fullPackage.orderCode")]: order.orderCode,
      "ئۆردەر نەمبەر": (order as any).orderNumber || "",
      [t("fullPackage.customer")]: (order as any).customer?.fullName || "",
      [t("fullPackage.customerCode")]: (order as any).customer?.customerCode || "",
      [t("fullPackage.productName")]: order.productName,
      [t("fullPackage.quantity")]: order.quantity,
      [t("fullPackage.batchLabel")]: (order as any).batch?.batchCode || t("fullPackage.noBatch"),
      [t("fullPackage.purchasePrice") + " ($)"]: (parseFloat(order.purchasePriceUsd || "0") * (order.quantity || 1)).toFixed(2),
      [t("fullPackage.sellingPrice") + " ($)"]: (parseFloat(order.sellingPriceUsd || "0") * (order.quantity || 1)).toFixed(2),
      [t("fullPackage.profit") + " ($)"]: (parseFloat(order.grossProfitUsd || "0") * (order.quantity || 1)).toFixed(2),
      [t("fullPackage.tracking")]: order.trackingNumber || "",
      [t("fullPackage.statusColumn")]: statusLabels[order.status] || order.status,
      [t("fullPackage.dateColumn")]: new Date(order.createdAt).toLocaleDateString("ku"),
    }));

    // Add summary row
    data.push({
      [t("fullPackage.orderCode")]: t("fullPackage.grandTotal"),
      "ئۆردەر نەمبەر": "",
      [t("fullPackage.customer")]: "",
      [t("fullPackage.customerCode")]: "",
      [t("fullPackage.productName")]: `${totalOrders} ${t("fullPackage.orders")}`,
      [t("fullPackage.quantity")]: filteredOrders.reduce((sum, o) => sum + (o.quantity || 1), 0),
      [t("fullPackage.batchLabel")]: "",
      [t("fullPackage.purchasePrice") + " ($)"]: totalPurchaseCost.toFixed(2),
      [t("fullPackage.sellingPrice") + " ($)"]: totalSellingPrice.toFixed(2),
      [t("fullPackage.profit") + " ($)"]: totalGrossProfit.toFixed(2),
      [t("fullPackage.tracking")]: "",
      [t("fullPackage.statusColumn")]: "",
      [t("fullPackage.dateColumn")]: "",
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, t("fullPackage.sheetName"));
    
    // Set column widths
    ws["!cols"] = [
      { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 25 }, { wch: 8 },
      { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 20 },
      { wch: 12 }, { wch: 12 }
    ];
    
    XLSX.writeFile(wb, `full-package-report-${new Date().toISOString().split("T")[0]}.xlsx`);
    toast.success(t("fullPackage.excelDownloaded"));
  };

  // Export to PDF
  const exportToPDF = () => {
    const company = getCompanyInfoFromSettings(settings || []);
    const printContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ku">
      <head>
        <meta charset="UTF-8">
        <title>${t("fullPackage.reportTitle")}</title>
        <style>
          * { font-family: 'Segoe UI', Tahoma, sans-serif; }
          body { padding: 20px; direction: rtl; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #10b981; padding-bottom: 20px; }
          .header h1 { color: #10b981; margin: 0; font-size: 28px; }
          .header p { color: #666; margin: 5px 0; }
          .stats { display: flex; justify-content: space-around; margin-bottom: 30px; flex-wrap: wrap; gap: 10px; }
          .stat-card { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 15px 25px; text-align: center; }
          .stat-card .value { font-size: 24px; font-weight: bold; color: #10b981; }
          .stat-card .label { font-size: 12px; color: #666; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 11px; }
          th { background: #10b981; color: white; padding: 10px 8px; text-align: right; }
          td { padding: 8px; border-bottom: 1px solid #e5e7eb; }
          tr:nth-child(even) { background: #f9fafb; }
          .footer { margin-top: 30px; text-align: center; color: #666; font-size: 11px; border-top: 1px solid #e5e7eb; padding-top: 15px; }
          .total-row { background: #ecfdf5 !important; font-weight: bold; }
          @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🛍️ ${t("fullPackage.reportTitle")}</h1>
          <p>${company.name} - ${t("fullPackage.managementSubtitle")}</p>
          <p>${t("fullPackage.dateColumn")}: ${new Date().toLocaleDateString("ku")}</p>
        </div>
        
        <div class="stats">
          <div class="stat-card">
            <div class="value">${totalOrders}</div>
            <div class="label">${t("fullPackage.ordersCountLabel")}</div>
          </div>
          <div class="stat-card">
            <div class="value">$${totalPurchaseCost.toFixed(2)}</div>
            <div class="label">${t("fullPackage.totalPurchaseCost")}</div>
          </div>
          <div class="stat-card">
            <div class="value">$${totalSellingPrice.toFixed(2)}</div>
            <div class="label">${t("fullPackage.totalSellingCost")}</div>
          </div>
          <div class="stat-card">
            <div class="value">$${totalGrossProfit.toFixed(2)}</div>
            <div class="label">${t("fullPackage.grossProfitLabel")}</div>
          </div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>${t("fullPackage.orderCode")}</th>
              <th>ئۆردەر #</th>
              <th>${t("fullPackage.customer")}</th>
              <th>${t("fullPackage.productName")}</th>
              <th>${t("fullPackage.quantity")}</th>
              <th>${t("fullPackage.purchaseColumn")}</th>
              <th>${t("fullPackage.sellingColumn")}</th>
              <th>${t("fullPackage.profit")}</th>
              <th>${t("fullPackage.statusColumn")}</th>
              <th>${t("fullPackage.dateColumn")}</th>
            </tr>
          </thead>
          <tbody>
            ${filteredOrders.map(order => `
              <tr>
                <td>${order.orderCode}</td>
                <td>${(order as any).orderNumber || "-"}</td>
                <td>${(order as any).customer?.fullName || "-"}</td>
                <td>${order.productName}</td>
                <td>${order.quantity}</td>
                <td>$${(parseFloat(order.purchasePriceUsd || "0") * (order.quantity || 1)).toFixed(2)}</td>
                <td>$${(parseFloat(order.sellingPriceUsd || "0") * (order.quantity || 1)).toFixed(2)}</td>
                <td>$${(parseFloat(order.grossProfitUsd || "0") * (order.quantity || 1)).toFixed(2)}</td>
                <td>${statusLabels[order.status] || order.status}</td>
                <td>${new Date(order.createdAt).toLocaleDateString("ku")}</td>
              </tr>
            `).join("")}
            <tr class="total-row">
              <td colspan="3">${t("fullPackage.grandTotal")}</td>
              <td></td>
              <td>${filteredOrders.reduce((sum, o) => sum + (o.quantity || 1), 0)}</td>
              <td>$${totalPurchaseCost.toFixed(2)}</td>
              <td>$${totalSellingPrice.toFixed(2)}</td>
              <td>$${totalGrossProfit.toFixed(2)}</td>
              <td colspan="2"></td>
            </tr>
          </tbody>
        </table>
        
        <div class="footer">
          <p>${t("fullPackage.reportGeneratedBy")}</p>
          <p>© ${new Date().getFullYear()} ${company.name} - ${t("fullPackage.copyright")}</p>
        </div>
      </body>
      </html>
    `;
    
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
    }
    toast.success(t("fullPackage.pdfReadyForPrint"));
  };

  // Filtered customers for dropdown
  const filteredCustomers = useMemo(() => {
    if (!customers) return [];
    if (!customerSearch) return customers;
    const search = customerSearch.toLowerCase();
    return customers.filter(c => 
      c.fullName.toLowerCase().includes(search) || 
      c.customerCode.toLowerCase().includes(search)
    );
  }, [customers, customerSearch]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-l from-emerald-600 to-emerald-700 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl">
                <ShoppingBag className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">{t("fullPackage.title")}</h1>
                <p className="text-emerald-100">{t("fullPackage.managementSubtitle")}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Export Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" className="bg-white/20 text-white hover:bg-white/30 border-0">
                    <Download className="h-4 w-4 ml-2" />
                    {t("common.export")}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={exportToExcel}>
                    <FileSpreadsheet className="h-4 w-4 ml-2 text-green-600" />
                    {t("fullPackage.exportExcel")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportToPDF}>
                    <FileText className="h-4 w-4 ml-2 text-red-600" />
                    {t("fullPackage.exportPDF")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              <Link href="/full-package/bulk-create?type=full_package">
                <Button variant="outline" className="bg-white/80 text-emerald-700 hover:bg-emerald-50 border-emerald-300">
                  <PackagePlus className="h-4 w-4 ml-2" />
                  {t("fullPackage.bulkCreate")}
                </Button>
              </Link>
              <Link href="/full-package/new">
                <Button className="bg-white text-emerald-700 hover:bg-emerald-50">
                  <Plus className="h-4 w-4 ml-2" />
                  {t("fullPackage.newOrder")}
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-emerald-600 font-medium">{t("fullPackage.ordersCountLabel")}</p>
                  <p className="text-2xl font-bold text-emerald-700">{totalOrders}</p>
                </div>
                <div className="p-2 bg-emerald-100 rounded-xl">
                  <Package className="h-5 w-5 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-50 to-white border-amber-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-amber-600 font-medium">{t("fullPackage.pendingLabel")}</p>
                  <p className="text-2xl font-bold text-amber-700">{pendingOrders}</p>
                </div>
                <div className="p-2 bg-amber-100 rounded-xl">
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-blue-600 font-medium">{t("fullPackage.inTransitLabel")}</p>
                  <p className="text-2xl font-bold text-blue-700">{inTransitOrders}</p>
                </div>
                <div className="p-2 bg-blue-100 rounded-xl">
                  <Clock className="h-5 w-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-50 to-white border-red-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-red-600 font-medium">{t("fullPackage.totalPurchaseCost")}</p>
                  <p className="text-xl font-bold text-red-700">${totalPurchaseCost.toFixed(2)}</p>
                </div>
                <div className="p-2 bg-red-100 rounded-xl">
                  <ShoppingCart className="h-5 w-5 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-white border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-green-600 font-medium">{t("fullPackage.grossProfitLabel")}</p>
                  <p className="text-xl font-bold text-green-700">${totalGrossProfit.toFixed(2)}</p>
                </div>
                <div className="p-2 bg-green-100 rounded-xl">
                  <DollarSign className="h-5 w-5 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-purple-600 font-medium">{t("fullPackage.netProfitLabel")}</p>
                  <p className="text-xl font-bold text-purple-700">${totalNetProfit.toFixed(2)}</p>
                </div>
                <div className="p-2 bg-purple-100 rounded-xl">
                  <TrendingUp className="h-5 w-5 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Table Card */}
        <Card>
          <CardHeader>
            <div className="space-y-4">
              {/* Search and Filter Row */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t("fullPackage.searchPlaceholder")}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pr-10"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-48">
                    <Filter className="h-4 w-4 ml-2" />
                    <SelectValue placeholder={t("common.all")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("common.all")}</SelectItem>
                    {statusOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button 
                  variant={showFilters ? "secondary" : "outline"} 
                  onClick={() => setShowFilters(!showFilters)}
                  className="gap-2"
                >
                  <Filter className="h-4 w-4" />
                  {t("fullPackage.advancedFilter")}
                  {hasActiveFilters && (
                    <Badge variant="destructive" className="h-5 w-5 p-0 flex items-center justify-center text-xs">
                      !
                    </Badge>
                  )}
                </Button>
              </div>

              {/* Advanced Filters */}
              {showFilters && (
                <div className="bg-muted/50 rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm">{t("fullPackage.advancedFiltersTitle")}</h4>
                    {hasActiveFilters && (
                      <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-red-600 hover:text-red-700">
                        <X className="h-4 w-4 ml-1" />
                        {t("fullPackage.clearAllFilters")}
                      </Button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Customer Filter */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        {t("fullPackage.customer")}
                      </label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-between">
                            {customerFilter !== "all" 
                              ? customers?.find(c => c.id.toString() === customerFilter)?.fullName || t("fullPackage.selectCustomerPlaceholder")
                              : t("fullPackage.allCustomers")
                            }
                            <ChevronDown className="h-4 w-4 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent variant="compact" className="w-64" align="start">
                          <Input
                            placeholder={t("fullPackage.customerSearchPlaceholder")}
                            value={customerSearch}
                            onChange={(e) => setCustomerSearch(e.target.value)}
                            className="mb-2"
                          />
                          <div className="max-h-48 overflow-y-auto space-y-1">
                            <Button
                              variant={customerFilter === "all" ? "secondary" : "ghost"}
                              className="w-full justify-start"
                              onClick={() => { setCustomerFilter("all"); setCustomerSearch(""); }}
                            >
                              {t("fullPackage.allCustomers")}
                            </Button>
                            {filteredCustomers.map(customer => (
                              <Button
                                key={customer.id}
                                variant={customerFilter === customer.id.toString() ? "secondary" : "ghost"}
                                className="w-full justify-start"
                                onClick={() => { setCustomerFilter(customer.id.toString()); setCustomerSearch(""); }}
                              >
                                <span className="truncate">{customer.fullName}</span>
                                <span className="text-xs text-muted-foreground mr-auto">{customer.customerCode}</span>
                              </Button>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Batch Filter */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <Layers className="h-4 w-4" />
                        {t("fullPackage.batchLabel")}
                      </label>
                      <Select value={batchFilter} onValueChange={setBatchFilter}>
                        <SelectTrigger>
                          <SelectValue placeholder={t("fullPackage.allBatches")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t("fullPackage.allBatches")}</SelectItem>
                          {batches?.map(batch => (
                            <SelectItem key={batch.id} value={batch.id.toString()}>
                              {batch.batchCode}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Date Range */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {t("fullPackage.dateRangeLabel")}
                      </label>
                      <div className="flex gap-2">
                        <Input
                          type="date"
                          value={dateFrom}
                          onChange={(e) => setDateFrom(e.target.value)}
                          className="flex-1"
                          placeholder={t("fullPackage.fromPlaceholder")}
                        />
                        <Input
                          type="date"
                          value={dateTo}
                          onChange={(e) => setDateTo(e.target.value)}
                          className="flex-1"
                          placeholder={t("fullPackage.toPlaceholder")}
                        />
                      </div>
                    </div>

                    {/* Price Range */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        {t("fullPackage.purchasePriceFilter")}
                      </label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          value={minPrice}
                          onChange={(e) => setMinPrice(e.target.value)}
                          placeholder={t("fullPackage.minPricePlaceholder")}
                          className="flex-1"
                        />
                        <Input
                          type="number"
                          value={maxPrice}
                          onChange={(e) => setMaxPrice(e.target.value)}
                          placeholder={t("fullPackage.maxPricePlaceholder")}
                          className="flex-1"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Results count and active filters summary */}
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {t("fullPackage.ordersCountFound", { count: String(filteredOrders.length) })}
                  {hasActiveFilters && (
                    <span className="text-emerald-600 mr-2">{t("fullPackage.filteredBadge")}</span>
                  )}
                </div>
                
                {/* Sort dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-2">
                      <ArrowUpDown className="h-4 w-4" />
                      {t("fullPackage.sort")}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => toggleSort("date")}>
                      {t("fullPackage.sortByDate")} {sortField === "date" && (sortDirection === "asc" ? "↑" : "↓")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => toggleSort("purchase")}>
                      {t("fullPackage.sortByPurchase")} {sortField === "purchase" && (sortDirection === "asc" ? "↑" : "↓")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => toggleSort("selling")}>
                      {t("fullPackage.sortBySelling")} {sortField === "selling" && (sortDirection === "asc" ? "↑" : "↓")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => toggleSort("profit")}>
                      {t("fullPackage.sortByProfit")} {sortField === "profit" && (sortDirection === "asc" ? "↑" : "↓")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => toggleSort("customer")}>
                      {t("fullPackage.sortByCustomer")} {sortField === "customer" && (sortDirection === "asc" ? "↑" : "↓")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-12">
                <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">{t("fullPackage.noOrdersMessage")}</p>
                <Link href="/full-package/new">
                  <Button className="mt-4" variant="outline">
                    <Plus className="h-4 w-4 ml-2" />
                    {t("fullPackage.addFirstOrderButton")}
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>کۆدی ئۆردەر</TableHead>
                      <TableHead>{t("fullPackage.customer")}</TableHead>
                      <TableHead>{t("fullPackage.productName")}</TableHead>
                      <TableHead>{t("fullPackage.batchLabel")}</TableHead>
                      <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => toggleSort("purchase")}>
                        {t("fullPackage.purchaseColumn")} {sortField === "purchase" && (sortDirection === "asc" ? "↑" : "↓")}
                      </TableHead>
                      <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => toggleSort("selling")}>
                        {t("fullPackage.sellingColumn")} {sortField === "selling" && (sortDirection === "asc" ? "↑" : "↓")}
                      </TableHead>
                      <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => toggleSort("profit")}>
                        {t("fullPackage.profit")} {sortField === "profit" && (sortDirection === "asc" ? "↑" : "↓")}
                      </TableHead>
                      <TableHead>{t("fullPackage.tracking")}</TableHead>
                      <TableHead>{t("fullPackage.statusColumn")}</TableHead>
                      <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => toggleSort("date")}>
                        {t("fullPackage.dateColumn")} {sortField === "date" && (sortDirection === "asc" ? "↑" : "↓")}
                      </TableHead>
                      <TableHead className="text-left">{t("fullPackage.actionsColumn")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell>
                          <div className="space-y-1">
                            <Badge variant="outline" className="font-mono text-emerald-600 border-emerald-300">
                              {order.orderCode}
                            </Badge>
                            {(order as any).orderNumber && (
                              <p className="text-xs text-muted-foreground font-mono">
                                #{(order as any).orderNumber}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{(order as any).customer?.fullName || t("fullPackage.customer")}</p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {(order as any).customer?.customerCode || ""}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {order.productImage ? (
                              <img
                                src={order.productImage}
                                alt={order.productName}
                                className="w-10 h-10 rounded-lg object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                                <Package className="h-5 w-5 text-emerald-600" />
                              </div>
                            )}
                            <div>
                              <p className="font-medium text-sm">{order.productName}</p>
                              {order.quantity > 1 && (
                                <p className="text-xs text-muted-foreground">{order.quantity} {t("fullPackage.quantityUnit")}</p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {(order as any).batch ? (
                            <Badge variant="secondary" className="text-xs font-mono">
                              <Layers className="h-3 w-3 mr-1" />
                              {(order as any).batch.batchCode}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                              {t("fullPackage.noBatch")}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-mono">${((parseFloat(order.purchasePriceUsd || "0") * (order.quantity || 1))).toFixed(2)}</TableCell>
                        <TableCell className="font-mono text-emerald-600">${((parseFloat(order.sellingPriceUsd || "0") * (order.quantity || 1))).toFixed(2)}</TableCell>
                        <TableCell className="font-mono font-bold text-green-600">
                          ${((parseFloat(order.grossProfitUsd || "0") * (order.quantity || 1))).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {order.trackingNumber ? (
                            <div className="flex flex-col gap-1">
                              <Badge variant="secondary" className="font-mono text-xs">
                                {order.trackingNumber}
                              </Badge>
                              {order.trackingAddedDate && (
                                <p className="text-xs text-muted-foreground">
                                  {new Date(order.trackingAddedDate).toLocaleDateString("ku")}
                                </p>
                              )}
                            </div>
                          ) : (
                            <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                              {t("fullPackage.noTracking")}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                className={`px-2 py-1 rounded-full text-xs font-medium cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all flex items-center gap-1 ${statusColors[order.status] || "bg-gray-100"}`}
                              >
                                {statusLabels[order.status] || order.status}
                                <ChevronDown className="h-3 w-3" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                              {statusOptions.map((option) => (
                                <DropdownMenuItem
                                  key={option.value}
                                  onClick={() => {
                                    if (option.value !== order.status) {
                                      updateStatusMutation.mutate({
                                        id: order.id,
                                        status: option.value as any,
                                      });
                                    }
                                  }}
                                  className={order.status === option.value ? "bg-accent" : ""}
                                >
                                  <span className={`w-2 h-2 rounded-full mr-2 ${statusColors[option.value]?.split(" ")[0] || "bg-gray-300"}`} />
                                  {option.label}
                                  {order.status === option.value && " ✓"}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(order.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => setLocation(`/full-package/${order.id}`)}
                              title={t("fullPackage.viewAction")}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => setLocation(`/full-package/${order.id}/edit`)}
                              title={t("fullPackage.editAction")}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </div>
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
