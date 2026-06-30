import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { getCompanyInfoFromSettings } from "@/hooks/useCompanyInfo";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CopyButton } from "@/components/CopyButton";
import { ZoomImage } from "@/components/ZoomImage";
import { toast } from "sonner";
import { TableSkeleton } from "@/components/ui/skeletons";
import { EmptyState } from "@/components/EmptyState";
import {
  Plus,
  Search,
  DollarSign,
  Package,
  Filter,
  Eye,
  Pencil,
  Percent,
  Clock,
  CheckCircle,
  Truck,
  Layers,
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
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import * as XLSX from "xlsx";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { StatusBadge } from "@/components/ui/status-badge";
import { RelativeTime } from "@/components/ui/relative-time";
import { FilterChips, type FilterChip } from "@/components/ui/filter-chips";

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  pending_quote: "bg-amber-100 text-amber-800",
  ordered: "bg-blue-100 text-blue-800",
  tracking_added: "bg-cyan-100 text-cyan-800",
  in_batch: "bg-violet-100 text-violet-800",
  in_transit: "bg-orange-100 text-orange-800",
  shipped: "bg-indigo-100 text-indigo-800",
  delivered: "bg-emerald-100 text-emerald-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-gray-100 text-gray-800",
};

type SortField = "date" | "itemPrice" | "commission" | "total" | "customer";
type SortDirection = "asc" | "desc";

export default function CommissionDashboard() {
  const { t, language } = useTranslation();
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const statusLabels: Record<string, string> = {
    pending: t("commission.status.pending"),
    pending_quote: t("commission.status.pending_quote"),
    ordered: t("commission.status.ordered"),
    tracking_added: t("commission.status.tracking_added"),
    in_batch: t("commission.status.in_batch"),
    in_transit: t("commission.status.in_transit"),
    shipped: t("commission.status.shipped"),
    delivered: t("commission.status.delivered"),
    completed: t("commission.status.completed"),
    cancelled: t("commission.status.cancelled"),
  };

  const statusOptions = [
    { value: "pending", label: t("commission.status.pending") },
    { value: "ordered", label: t("commission.status.ordered") },
    { value: "tracking_added", label: t("commission.status.tracking_added") },
    { value: "in_batch", label: t("commission.status.in_batch") },
    { value: "in_transit", label: t("commission.status.in_transit") },
    { value: "shipped", label: t("commission.status.shipped") },
    { value: "delivered", label: t("commission.status.delivered") },
    { value: "completed", label: t("commission.status.completed") },
    { value: "cancelled", label: t("commission.status.cancelled") },
  ];
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

  // Fetch commission orders
  const { data: orders, isLoading, refetch } = trpc.fullPackage.list.useQuery({
    orderType: "commission",
    search: searchQuery || undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
  });

  const { data: batchesRaw } = trpc.batches.list.useQuery();
  const batches = Array.isArray(batchesRaw) ? batchesRaw : batchesRaw?.data;
  const { data: customers } = trpc.customers.list.useQuery();
  const { data: settings } = trpc.settings.list.useQuery();

  // Update status mutation
  const updateStatusMutation = trpc.fullPackage.updateStatus.useMutation({
    onSuccess: () => {
      toast.success(t("commission.statusUpdated"));
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Filter and sort orders
  const filteredOrders = useMemo(() => {
    let result = orders || [];

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
    
    // Price range filter (on total = itemPrice * quantity)
    if (minPrice) {
      const min = parseFloat(minPrice);
      result = result.filter(o => (parseFloat(o.itemPriceUsd || "0") * (o.quantity || 1)) >= min);
    }
    if (maxPrice) {
      const max = parseFloat(maxPrice);
      result = result.filter(o => (parseFloat(o.itemPriceUsd || "0") * (o.quantity || 1)) <= max);
    }
    
    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "date":
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case "itemPrice":
          comparison = (parseFloat(a.itemPriceUsd || "0") * (a.quantity || 1)) - 
                       (parseFloat(b.itemPriceUsd || "0") * (b.quantity || 1));
          break;
        case "commission":
          // Commission is a flat per-order fee — order creation
          // (fullPackage.router.ts createCommissionOrder) and the box
          // builder (deliveryBoxes.db.ts buildBoxItemValuesFromPackage)
          // both treat it that way. Multiplying by qty inflates the
          // sort key and produces wrong order on multi-qty rows.
          comparison = parseFloat(a.commissionFeeUsd || "0") - parseFloat(b.commissionFeeUsd || "0");
          break;
        case "total":
          const totalA = (parseFloat(a.itemPriceUsd || "0") * (a.quantity || 1)) + parseFloat(a.commissionFeeUsd || "0");
          const totalB = (parseFloat(b.itemPriceUsd || "0") * (b.quantity || 1)) + parseFloat(b.commissionFeeUsd || "0");
          comparison = totalA - totalB;
          break;
        case "customer":
          comparison = ((a as any).customer?.fullName || "").localeCompare((b as any).customer?.fullName || "");
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
    
    return result;
  }, [orders, searchQuery, customerFilter, batchFilter, dateFrom, dateTo, minPrice, maxPrice, sortField, sortDirection]);

  // Calculate stats based on filtered orders
  const totalOrders = filteredOrders.length;
  const pendingOrders = filteredOrders.filter(o => o.status === "pending" || o.status === "pending_quote").length;
  const orderedOrders = filteredOrders.filter(o => o.status === "ordered").length;
  const deliveredOrders = filteredOrders.filter(o => o.status === "delivered").length;
  
  const totalItemValue = filteredOrders.reduce((sum, o) => {
    return sum + (parseFloat(o.itemPriceUsd || "0") * (o.quantity || 1));
  }, 0);
  
  // Commission fee is a flat per-order amount (see commission order creation
  // at fullPackage.router.ts:1451 and the box builder at
  // deliveryBoxes.db.ts buildBoxItemValuesFromPackage — both add it once,
  // not once-per-unit). Multiplying by qty here inflated the dashboard
  // total against what the customer was actually charged, which is what
  // the box receipt shows. Sum without the qty multiplier so reports,
  // exports, and on-screen stats agree with the box and the ledger.
  const totalCommission = filteredOrders.reduce((sum, o) => {
    return sum + parseFloat(o.commissionFeeUsd || "0");
  }, 0);
  
  const totalCost = totalItemValue + totalCommission;

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
    setSearchQuery("");
  };

  // Active-filter chips built from existing filter state + setters
  const filterChips: FilterChip[] = [];
  if (searchQuery) {
    filterChips.push({
      id: "search",
      label: `${t("commission.searchChip") || pickLang(language, { ku: "گەڕان", en: "Search", ar: "بحث", zh: "搜索" })}: ${searchQuery}`,
      onRemove: () => setSearchQuery(""),
    });
  }
  if (statusFilter !== "all") {
    filterChips.push({
      id: "status",
      label: `${t("commission.statusColumn")}: ${statusLabels[statusFilter] || statusFilter}`,
      onRemove: () => setStatusFilter("all"),
    });
  }
  if (customerFilter !== "all") {
    filterChips.push({
      id: "customer",
      label: `${t("commission.customer")}: ${customers?.find(c => c.id.toString() === customerFilter)?.fullName || customerFilter}`,
      onRemove: () => setCustomerFilter("all"),
    });
  }
  if (batchFilter !== "all") {
    filterChips.push({
      id: "batch",
      label: `${t("commission.batchLabel")}: ${batches?.find(b => b.id.toString() === batchFilter)?.batchCode || batchFilter}`,
      onRemove: () => setBatchFilter("all"),
    });
  }
  if (dateFrom) {
    filterChips.push({
      id: "dateFrom",
      label: `${t("commission.fromPlaceholder") || pickLang(language, { ku: "لە", en: "From", ar: "من", zh: "从" })}: ${dateFrom}`,
      onRemove: () => setDateFrom(""),
    });
  }
  if (dateTo) {
    filterChips.push({
      id: "dateTo",
      label: `${t("commission.toPlaceholder") || pickLang(language, { ku: "بۆ", en: "To", ar: "إلى", zh: "至" })}: ${dateTo}`,
      onRemove: () => setDateTo(""),
    });
  }
  if (minPrice) {
    filterChips.push({
      id: "minPrice",
      label: `${t("commission.minPricePlaceholder") || pickLang(language, { ku: "کەمترین", en: "Min", ar: "الأدنى", zh: "最低" })}: ${minPrice}`,
      onRemove: () => setMinPrice(""),
    });
  }
  if (maxPrice) {
    filterChips.push({
      id: "maxPrice",
      label: `${t("commission.maxPricePlaceholder") || pickLang(language, { ku: "زۆرترین", en: "Max", ar: "الأقصى", zh: "最高" })}: ${maxPrice}`,
      onRemove: () => setMaxPrice(""),
    });
  }

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
      [t("commission.orderCode")]: order.orderCode,
      [pickLang(language, { ku: "ئۆردەر نەمبەر", en: "Order Number", ar: "رقم الطلب", zh: "订单号" })]: (order as any).orderNumber || "",
      [t("commission.customer")]: (order as any).customer?.fullName || "",
      [t("commission.customerCode")]: (order as any).customer?.customerCode || "",
      [t("commission.productName")]: order.productName,
      [t("commission.quantity")]: order.quantity,
      [t("commission.batchLabel")]: (order as any).batch?.batchCode || t("commission.noBatch"),
      [t("commission.itemPrice") + " ($)"]: (parseFloat(order.itemPriceUsd || "0") * (order.quantity || 1)).toFixed(2),
      // Commission is flat per-order — do NOT multiply by quantity, that
      // diverges from what the customer is actually charged at delivery.
      [t("commission.commissionAmount") + " ($)"]: parseFloat(order.commissionFeeUsd || "0").toFixed(2),
      [t("commission.grandTotal") + " ($)"]: ((parseFloat(order.itemPriceUsd || "0") * (order.quantity || 1)) + parseFloat(order.commissionFeeUsd || "0")).toFixed(2),
      [t("commission.tracking")]: order.trackingNumber || "",
      [t("commission.statusColumn")]: statusLabels[order.status] || order.status,
      [t("commission.dateColumn")]: new Date(order.createdAt).toLocaleDateString("ku"),
    }));

    // Add summary row
    data.push({
      [t("commission.orderCode")]: t("commission.grandTotal"),
      [pickLang(language, { ku: "ئۆردەر نەمبەر", en: "Order Number", ar: "رقم الطلب", zh: "订单号" })]: "",
      [t("commission.customer")]: "",
      [t("commission.customerCode")]: "",
      [t("commission.productName")]: `${totalOrders} ${t("commission.orders")}`,
      [t("commission.quantity")]: filteredOrders.reduce((sum, o) => sum + (o.quantity || 1), 0),
      [t("commission.batchLabel")]: "",
      [t("commission.itemPrice") + " ($)"]: totalItemValue.toFixed(2),
      [t("commission.commissionAmount") + " ($)"]: totalCommission.toFixed(2),
      [t("commission.grandTotal") + " ($)"]: totalCost.toFixed(2),
      [t("commission.tracking")]: "",
      [t("commission.statusColumn")]: "",
      [t("commission.dateColumn")]: "",
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, t("commission.sheetName"));
    
    // Set column widths
    ws["!cols"] = [
      { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 25 }, { wch: 8 },
      { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 20 },
      { wch: 12 }, { wch: 12 }
    ];
    
    XLSX.writeFile(wb, `commission-report-${new Date().toISOString().split("T")[0]}.xlsx`);
    toast.success(t("commission.excelDownloaded"));
  };

  // Export to PDF
  const exportToPDF = () => {
    const company = getCompanyInfoFromSettings(settings || []);
    const printContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ku">
      <head>
        <meta charset="UTF-8">
        <title>${t("commission.reportTitle")}</title>
        <style>
          * { font-family: 'Segoe UI', Tahoma, sans-serif; }
          body { padding: 20px; direction: rtl; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #f59e0b; padding-bottom: 20px; }
          .header h1 { color: #f59e0b; margin: 0; font-size: 28px; }
          .header p { color: #666; margin: 5px 0; }
          .stats { display: flex; justify-content: space-around; margin-bottom: 30px; flex-wrap: wrap; gap: 10px; }
          .stat-card { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 15px 25px; text-align: center; }
          .stat-card .value { font-size: 24px; font-weight: bold; color: #f59e0b; }
          .stat-card .label { font-size: 12px; color: #666; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 11px; }
          th { background: #f59e0b; color: white; padding: 10px 8px; text-align: right; }
          td { padding: 8px; border-bottom: 1px solid #e5e7eb; }
          tr:nth-child(even) { background: #f9fafb; }
          .footer { margin-top: 30px; text-align: center; color: #666; font-size: 11px; border-top: 1px solid #e5e7eb; padding-top: 15px; }
          .total-row { background: #fef3c7 !important; font-weight: bold; }
          @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🛍 ${t("commission.reportTitle")}</h1>
          <p>${company.name} - ${t("commission.managementSubtitle")}</p>
          <p>${t("commission.dateColumn")}: ${new Date().toLocaleDateString("ku")}</p>
        </div>
        
        <div class="stats">
          <div class="stat-card">
            <div class="value">${totalOrders}</div>
            <div class="label">${t("commission.totalOrdersLabel")}</div>
          </div>
          <div class="stat-card">
            <div class="value">$${totalItemValue.toFixed(2)}</div>
            <div class="label">${t("commission.totalItemValueLabel")}</div>
          </div>
          <div class="stat-card">
            <div class="value">$${totalCommission.toFixed(2)}</div>
            <div class="label">${t("commission.totalCommissionLabel")}</div>
          </div>
          <div class="stat-card">
            <div class="value">$${totalCost.toFixed(2)}</div>
            <div class="label">${t("commission.grandTotal")}</div>
          </div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>${t("commission.orderCode")}</th>
              <th>${pickLang(language, { ku: "ئۆردەر #", en: "Order #", ar: "الطلب #", zh: "订单 #" })}</th>
              <th>${t("commission.customer")}</th>
              <th>${t("commission.productName")}</th>
              <th>${t("commission.quantity")}</th>
              <th>${t("commission.itemPrice")}</th>
              <th>${t("commission.commissionAmount")}</th>
              <th>${t("commission.grandTotal")}</th>
              <th>${t("commission.statusColumn")}</th>
              <th>${t("commission.dateColumn")}</th>
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
                <td>$${(parseFloat(order.itemPriceUsd || "0") * (order.quantity || 1)).toFixed(2)}</td>
                <td>$${parseFloat(order.commissionFeeUsd || "0").toFixed(2)}</td>
                <td>$${((parseFloat(order.itemPriceUsd || "0") * (order.quantity || 1)) + parseFloat(order.commissionFeeUsd || "0")).toFixed(2)}</td>
                <td>${statusLabels[order.status] || order.status}</td>
                <td>${new Date(order.createdAt).toLocaleDateString("ku")}</td>
              </tr>
            `).join("")}
            <tr class="total-row">
              <td colspan="3">${t("commission.grandTotal")}</td>
              <td></td>
              <td>${filteredOrders.reduce((sum, o) => sum + (o.quantity || 1), 0)}</td>
              <td>$${totalItemValue.toFixed(2)}</td>
              <td>$${totalCommission.toFixed(2)}</td>
              <td>$${totalCost.toFixed(2)}</td>
              <td colspan="2"></td>
            </tr>
          </tbody>
        </table>
        
        <div class="footer">
          <p>${t("commission.reportGeneratedBy")}</p>
          <p>© ${new Date().getFullYear()} ${company.name} - ${t("commission.copyright")}</p>
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
    toast.success(t("commission.pdfReadyForPrint"));
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
        <div className="bg-gradient-to-l from-amber-500 to-yellow-600 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl">
                <Percent className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">{t("commission.title")}</h1>
                <p className="text-amber-100">{t("commission.subtitle")}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Export Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" className="bg-white/20 text-white hover:bg-white/30 border-0">
                    <Download className="h-4 w-4 ms-2" />
                    {t("common.export")}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={exportToExcel}>
                    <FileSpreadsheet className="h-4 w-4 ms-2 text-green-600" />
                    {t("commission.exportExcel")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportToPDF}>
                    <FileText className="h-4 w-4 ms-2 text-red-600" />
                    {t("commission.exportPDF")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              <Button
                variant="outline"
                onClick={() => navigate("/commission/bulk-create?type=commission")}
                className="bg-white/80 text-amber-700 hover:bg-amber-50 border-amber-300"
              >
                <PackagePlus className="h-4 w-4 ms-2" />
                {t("commission.bulkCreate")}
              </Button>
              <Button
                onClick={() => navigate("/commission/new")}
                className="bg-white text-amber-700 hover:bg-amber-50"
              >
                <Plus className="h-4 w-4 ms-2" />
                {t("commission.newOrder")}
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card className="bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-amber-600 font-medium">{t("commission.totalOrdersLabel")}</p>
                  <p className="text-2xl font-bold text-amber-700">{totalOrders}</p>
                </div>
                <div className="p-2 bg-amber-100 rounded-xl">
                  <Package className="h-5 w-5 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-orange-600 font-medium">{t("commission.pendingLabel")}</p>
                  <p className="text-2xl font-bold text-orange-700">{pendingOrders}</p>
                </div>
                <div className="p-2 bg-orange-100 rounded-xl">
                  <Clock className="h-5 w-5 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-sky-50 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-blue-600 font-medium">{t("commission.orderedLabel")}</p>
                  <p className="text-2xl font-bold text-blue-700">{orderedOrders}</p>
                </div>
                <div className="p-2 bg-blue-100 rounded-xl">
                  <Truck className="h-5 w-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-green-600 font-medium">{t("commission.deliveredLabel")}</p>
                  <p className="text-2xl font-bold text-green-700">{deliveredOrders}</p>
                </div>
                <div className="p-2 bg-green-100 rounded-xl">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-50 to-rose-50 border-red-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-red-600 font-medium">{t("commission.totalCostLabel")}</p>
                  {/* "کۆی کڕین" must show the goods-only purchase total,
                      NOT goods + commission. Commission has its own card
                      below; lumping them together here was confusing
                      because every other commission-flow document
                      (box receipt, invoice, ledger description) lists
                      the two separately. The grand total is still
                      available in the Excel and PDF exports. */}
                  <p className="text-xl font-bold text-red-700">${totalItemValue.toFixed(2)}</p>
                </div>
                <div className="p-2 bg-red-100 rounded-xl">
                  <ShoppingCart className="h-5 w-5 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-yellow-700 font-medium">{t("commission.totalCommissionLabel")}</p>
                  <p className="text-xl font-bold text-yellow-800">${totalCommission.toFixed(2)}</p>
                </div>
                <div className="p-2 bg-yellow-100 rounded-xl">
                  <Percent className="h-5 w-5 text-yellow-700" />
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
                    placeholder={t("commission.searchPlaceholder")}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pr-10"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-48">
                    <Filter className="h-4 w-4 ms-2" />
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
                  {t("commission.advancedFilter")}
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
                    <h4 className="font-medium text-sm">{t("commission.advancedFiltersTitle")}</h4>
                    {hasActiveFilters && (
                      <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-red-600 hover:text-red-700">
                        <X className="h-4 w-4 ms-1" />
                        {t("commission.clearAllFilters")}
                      </Button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Customer Filter */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        {t("commission.customer")}
                      </label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-between">
                            {customerFilter !== "all" 
                              ? customers?.find(c => c.id.toString() === customerFilter)?.fullName || t("fullPackage.selectCustomerPlaceholder")
                              : t("commission.allCustomers")
                            }
                            <ChevronDown className="h-4 w-4 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent variant="compact" className="w-64" align="start">
                          <Input
                            placeholder={t("commission.customerSearchPlaceholder")}
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
                              {t("commission.allCustomers")}
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
                        {t("commission.batchLabel")}
                      </label>
                      <Select value={batchFilter} onValueChange={setBatchFilter}>
                        <SelectTrigger>
                          <SelectValue placeholder={t("commission.allBatches")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t("commission.allBatches")}</SelectItem>
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
                        {t("commission.dateRangeLabel")}
                      </label>
                      <div className="flex gap-2">
                        <Input
                          type="date"
                          value={dateFrom}
                          onChange={(e) => setDateFrom(e.target.value)}
                          className="flex-1"
                          placeholder={t("commission.fromPlaceholder")}
                        />
                        <Input
                          type="date"
                          value={dateTo}
                          onChange={(e) => setDateTo(e.target.value)}
                          className="flex-1"
                          placeholder={t("commission.toPlaceholder")}
                        />
                      </div>
                    </div>

                    {/* Price Range */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        {t("commission.itemPriceFilter")}
                      </label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          value={minPrice}
                          onChange={(e) => setMinPrice(e.target.value)}
                          placeholder={t("commission.minPricePlaceholder")}
                          className="flex-1"
                        />
                        <Input
                          type="number"
                          value={maxPrice}
                          onChange={(e) => setMaxPrice(e.target.value)}
                          placeholder={t("commission.maxPricePlaceholder")}
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
                  {t("commission.ordersCountFound", { count: String(filteredOrders.length) })}
                  {hasActiveFilters && (
                    <span className="text-amber-600 me-2">{t("commission.filteredBadge")}</span>
                  )}
                </div>
                
                {/* Sort dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-2">
                      <ArrowUpDown className="h-4 w-4" />
                      {t("commission.sort")}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => toggleSort("date")}>
                      {t("commission.sortByDate")} {sortField === "date" && (sortDirection === "asc" ? "↑" : "↓")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => toggleSort("itemPrice")}>
                      {t("commission.sortByItemPrice")} {sortField === "itemPrice" && (sortDirection === "asc" ? "↑" : "↓")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => toggleSort("commission")}>
                      {t("commission.sortByCommission")} {sortField === "commission" && (sortDirection === "asc" ? "↑" : "↓")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => toggleSort("total")}>
                      {t("commission.sortByTotal")} {sortField === "total" && (sortDirection === "asc" ? "↑" : "↓")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => toggleSort("customer")}>
                      {t("commission.sortByCustomer")} {sortField === "customer" && (sortDirection === "asc" ? "↑" : "↓")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Active filter chips */}
              <FilterChips chips={filterChips} onClearAll={clearAllFilters} />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <TableSkeleton rows={6} cols={6} />
            ) : filteredOrders.length === 0 ? (
              <EmptyState
                icon={<Package />}
                title={t("commission.noOrdersMessage") || pickLang(language, { ku: "هیچ ئۆردەرێک نییە", en: "No orders", ar: "لا توجد طلبات", zh: "暂无订单" })}
                description={
                  hasActiveFilters
                    ? t("common.tryClearingFilters") || pickLang(language, { ku: "هەوڵبدە فلتەرەکان پاک بکەیتەوە", en: "Try clearing the filters", ar: "حاول مسح عوامل التصفية", zh: "尝试清除筛选条件" })
                    : undefined
                }
                action={
                  hasActiveFilters ? (
                    <Button variant="outline" onClick={clearAllFilters}>
                      <X className="h-4 w-4 ms-2" />
                      {t("commission.clearAllFilters") || pickLang(language, { ku: "پاککردنەوەی فلتەرەکان", en: "Clear filters", ar: "مسح عوامل التصفية", zh: "清除筛选" })}
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={() => navigate("/commission/new")}>
                      <Plus className="h-4 w-4 ms-2" />
                      {t("commission.addFirstOrderButton")}
                    </Button>
                  )
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{pickLang(language, { ku: "کۆدی ئۆردەر", en: "Order Code", ar: "رمز الطلب", zh: "订单代码" })}</TableHead>
                      <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => toggleSort("customer")}>
                        {t("commission.customer")} {sortField === "customer" && (sortDirection === "asc" ? "↑" : "↓")}
                      </TableHead>
                      <TableHead>{t("commission.productName")}</TableHead>
                      <TableHead>{t("commission.batchLabel")}</TableHead>
                      <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => toggleSort("itemPrice")}>
                        {t("commission.itemPrice")} {sortField === "itemPrice" && (sortDirection === "asc" ? "↑" : "↓")}
                      </TableHead>
                      <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => toggleSort("commission")}>
                        {t("commission.commissionAmount")} {sortField === "commission" && (sortDirection === "asc" ? "↑" : "↓")}
                      </TableHead>
                      <TableHead>{t("commission.tracking")}</TableHead>
                      <TableHead>{t("commission.statusColumn")}</TableHead>
                      <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => toggleSort("date")}>
                        {t("commission.dateColumn")} {sortField === "date" && (sortDirection === "asc" ? "↑" : "↓")}
                      </TableHead>
                      <TableHead className="text-left">{t("commission.actionsColumn")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order) => (
                      <TableRow
                        key={order.id}
                        className="transition-colors hover:bg-blue-50/60 dark:hover:bg-blue-950/30 hover:ring-2 hover:ring-inset hover:ring-blue-400/50"
                      >
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-1">
                              <Badge variant="outline" className="font-mono text-amber-600 border-amber-300">
                                {order.orderCode}
                              </Badge>
                              <CopyButton value={order.orderCode} label={pickLang(language, { ku: "کۆپی کۆد", en: "Copy code", ar: "نسخ الرمز", zh: "复制代码" })} />
                            </div>
                            {(order as any).orderNumber && (
                              <p className="text-xs text-muted-foreground font-mono">
                                #{(order as any).orderNumber}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <div>
                              <p className="font-medium">{(order as any).customer?.fullName || t("commission.customer")}</p>
                              <p className="text-xs text-muted-foreground font-mono">
                                {(order as any).customer?.customerCode || ""}
                              </p>
                            </div>
                            <CopyButton value={(order as any).customer?.fullName} label={pickLang(language, { ku: "کۆپی ناوی کڕیار", en: "Copy customer name", ar: "نسخ اسم العميل", zh: "复制客户名称" })} />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {order.productImage ? (
                              <ZoomImage
                                src={order.productImage}
                                alt={order.productName}
                                className="w-10 h-10"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                                <Package className="h-5 w-5 text-amber-600" />
                              </div>
                            )}
                            <div>
                              <p className="font-medium text-sm">{order.productName}</p>
                              {order.quantity > 1 && (
                                <p className="text-xs text-muted-foreground">{order.quantity} {t("commission.quantityUnit")}</p>
                              )}
                              {(order as any).orderNumber && (
                                <p className="text-xs text-blue-600 font-mono mt-0.5">
                                  # {(order as any).orderNumber}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {(order as any).batch ? (
                            <div className="flex items-center gap-1">
                              <Badge variant="secondary" className="text-xs font-mono">
                                <Layers className="h-3 w-3 me-1" />
                                {(order as any).batch.batchCode}
                              </Badge>
                              <CopyButton value={(order as any).batch.batchCode} label={pickLang(language, { ku: "کۆپی کۆدی باچ", en: "Copy batch code", ar: "نسخ رمز الدفعة", zh: "复制批次代码" })} />
                            </div>
                          ) : (
                            <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                              {t("commission.noBatch")}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-mono">
                          ${(parseFloat(order.itemPriceUsd || "0") * (order.quantity || 1)).toFixed(2)}
                        </TableCell>
                        <TableCell className="font-mono text-amber-600">
                          ${parseFloat(order.commissionFeeUsd || "0").toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {order.trackingNumber ? (
                            <div className="flex items-center gap-1">
                              <Badge variant="secondary" className="font-mono text-xs">
                                {order.trackingNumber}
                              </Badge>
                              <CopyButton value={order.trackingNumber} label={pickLang(language, { ku: "کۆپی تراکینگ", en: "Copy tracking", ar: "نسخ التتبع", zh: "复制追踪号" })} />
                            </div>
                          ) : (
                            <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                              {t("commission.noTracking")}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                className="cursor-pointer hover:ring-2 hover:ring-primary/50 rounded-full transition-all inline-flex items-center gap-1"
                              >
                                <StatusBadge status={order.status} />
                                <ChevronDown className="h-3 w-3 text-muted-foreground" />
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
                                  <span className={`w-2 h-2 rounded-full me-2 ${statusColors[option.value]?.split(" ")[0] || "bg-gray-300"}`} />
                                  {option.label}
                                  {order.status === option.value && " ✓"}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          <RelativeTime date={order.createdAt} />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => navigate(`/commission/${order.id}`)}
                              title={t("commission.viewAction")}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => navigate(`/commission/${order.id}/edit`)}
                              title={t("commission.editAction")}
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
