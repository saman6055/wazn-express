import { useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { getCompanyInfoFromSettings } from "@/hooks/useCompanyInfo";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { ShippingRouteFilter, useShippingRouteFilter } from "@/components/ShippingRouteFilter";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { TableSkeleton } from "@/components/ui/skeletons";
import { EmptyState } from "@/components/EmptyState";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CopyButton } from "@/components/CopyButton";
import { ZoomImage } from "@/components/ZoomImage";
import { StatusBadge } from "@/components/ui/status-badge";
import { RelativeTime } from "@/components/ui/relative-time";
import { FilterChips, type FilterChip } from "@/components/ui/filter-chips";
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
  Plane,
  Barcode,
  ImageIcon,
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
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { PlatformChip } from "@/components/PlatformChip";

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200",
  approved: "bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200",
  ordered: "bg-indigo-100 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-200",
  tracking_added: "bg-cyan-100 dark:bg-cyan-950/40 text-cyan-800 dark:text-cyan-200",
  in_china_warehouse: "bg-purple-100 dark:bg-purple-950/40 text-purple-800 dark:text-purple-200",
  in_batch: "bg-violet-100 dark:bg-violet-950/40 text-violet-800 dark:text-violet-200",
  in_transit: "bg-orange-100 dark:bg-orange-950/40 text-orange-800 dark:text-orange-200",
  arrived: "bg-teal-100 dark:bg-teal-950/40 text-teal-800 dark:text-teal-200",
  delivered: "bg-green-100 dark:bg-green-950/40 text-green-800 dark:text-green-200",
  cancelled: "bg-red-100 dark:bg-red-950/40 text-red-800 dark:text-red-200",
};

type SortField = "date" | "purchase" | "selling" | "profit" | "customer";
type SortDirection = "asc" | "desc";

export default function FullPackageDashboard() {
  const { t, language } = useTranslation();
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
  const [shippingFilter, setShippingFilter] = useState<string>("all");
  const [trackingFilter, setTrackingFilter] = useState<"all" | "with" | "without">("all");
  // Orders missing a product photo are hard to identify later, so they can
  // be listed and completed rather than quietly forgotten.
  const [imageFilter, setImageFilter] = useState<"all" | "with" | "without">("all");
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

  const { data: batchesRaw } = trpc.batches.list.useQuery();
  const batches = Array.isArray(batchesRaw) ? batchesRaw : batchesRaw?.data;
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

    // Shipping-method filter
    if (shippingFilter !== "all") {
      result = result.filter(o => (o as any).shippingType === shippingFilter);
    }

    // Tracking filter (has / no tracking number)
    if (trackingFilter !== "all") {
      result = result.filter(o => {
        const tn = (o as any).trackingNumber;
        const has = typeof tn === "string" && tn.trim() !== "";
        return trackingFilter === "with" ? has : !has;
      });
    }

    // Image filter (has / no product photo)
    if (imageFilter !== "all") {
      result = result.filter(o => {
        const imgs = (o as any).productImages;
        const has = (Array.isArray(imgs) && imgs.length > 0) || !!(o as any).productImage;
        return imageFilter === "with" ? has : !has;
      });
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
  }, [orders, customerFilter, batchFilter, dateFrom, dateTo, minPrice, maxPrice, shippingFilter, trackingFilter, imageFilter, sortField, sortDirection]);

  // Calculate stats
  // Route is applied last, so the counts on the control describe what the
  // other filters have already left rather than the whole table.
  const {
    route: routeFilter,
    setRoute: setRouteFilter,
    counts: routeCounts,
    filtered: routedOrders,
  } = useShippingRouteFilter(filteredOrders, (o: any) => o.shippingType);

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
    dateFrom || dateTo || minPrice || maxPrice || shippingFilter !== "all" || trackingFilter !== "all";

  // Clear all filters
  const clearAllFilters = () => {
    setCustomerFilter("all");
    setBatchFilter("all");
    setDateFrom("");
    setDateTo("");
    setMinPrice("");
    setMaxPrice("");
    setShippingFilter("all");
    setTrackingFilter("all");
    setStatusFilter("all");
    setSearch("");
  };

  // Active-filter chips (presentational; each reuses an existing setter)
  const filterChips = useMemo<FilterChip[]>(() => {
    const chips: FilterChip[] = [];
    if (search) {
      chips.push({
        id: "search",
        label: `${t("fullPackage.searchChip") || pickLang(language, { ku: "گەڕان", en: "Search", ar: "بحث", zh: "搜索" })}: ${search}`,
        onRemove: () => setSearch(""),
      });
    }
    if (statusFilter !== "all") {
      chips.push({
        id: "status",
        label: `${t("fullPackage.statusColumn")}: ${statusLabels[statusFilter] || statusFilter}`,
        onRemove: () => setStatusFilter("all"),
      });
    }
    if (customerFilter !== "all") {
      const name = customers?.find(c => c.id.toString() === customerFilter)?.fullName || customerFilter;
      chips.push({
        id: "customer",
        label: `${t("fullPackage.customer")}: ${name}`,
        onRemove: () => setCustomerFilter("all"),
      });
    }
    if (batchFilter !== "all") {
      const code = batches?.find(b => b.id.toString() === batchFilter)?.batchCode || batchFilter;
      chips.push({
        id: "batch",
        label: `${t("fullPackage.batchLabel")}: ${code}`,
        onRemove: () => setBatchFilter("all"),
      });
    }
    if (dateFrom) {
      chips.push({
        id: "dateFrom",
        label: `${t("fullPackage.fromPlaceholder") || pickLang(language, { ku: "لە", en: "From", ar: "من", zh: "从" })}: ${dateFrom}`,
        onRemove: () => setDateFrom(""),
      });
    }
    if (dateTo) {
      chips.push({
        id: "dateTo",
        label: `${t("fullPackage.toPlaceholder") || pickLang(language, { ku: "بۆ", en: "To", ar: "إلى", zh: "至" })}: ${dateTo}`,
        onRemove: () => setDateTo(""),
      });
    }
    if (minPrice) {
      chips.push({
        id: "minPrice",
        label: `${t("fullPackage.minPricePlaceholder") || pickLang(language, { ku: "کەمترین نرخ", en: "Min price", ar: "أدنى سعر", zh: "最低价" })}: ${minPrice}`,
        onRemove: () => setMinPrice(""),
      });
    }
    if (maxPrice) {
      chips.push({
        id: "maxPrice",
        label: `${t("fullPackage.maxPricePlaceholder") || pickLang(language, { ku: "زۆرترین نرخ", en: "Max price", ar: "أعلى سعر", zh: "最高价" })}: ${maxPrice}`,
        onRemove: () => setMaxPrice(""),
      });
    }
    if (shippingFilter !== "all") {
      const shippingLabels: Record<string, string> = {
        air_regular: t("fullPackage.airRegular"),
        air_irregular: t("fullPackage.airIrregular"),
        sea: t("fullPackage.sea"),
      };
      chips.push({
        id: "shipping",
        label: `${t("fullPackage.shippingMethodLabel")}: ${shippingLabels[shippingFilter] || shippingFilter}`,
        onRemove: () => setShippingFilter("all"),
      });
    }
    if (trackingFilter !== "all") {
      chips.push({
        id: "tracking",
        label: `${t("fullPackage.trackingLabel")}: ${trackingFilter === "with" ? t("fullPackage.withTracking") : t("fullPackage.withoutTracking")}`,
        onRemove: () => setTrackingFilter("all"),
      });
    }
    return chips;
  }, [search, statusFilter, customerFilter, batchFilter, dateFrom, dateTo, minPrice, maxPrice, shippingFilter, trackingFilter, customers, batches, statusLabels, t]);

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
  const exportToExcel = async () => {
    const orderNumberCol = pickLang(language, { ku: "ئۆردەر نەمبەر", en: "Order Number", ar: "رقم الطلب", zh: "订单号" });
    const data = filteredOrders.map(order => ({
      [t("fullPackage.orderCode")]: order.orderCode,
      [orderNumberCol]: (order as any).orderNumber || "",
      [t("fullPackage.customer")]: (order as any).customer?.fullName || "",
      [t("fullPackage.customerCode")]: (order as any).customer?.customerCode || "",
      [t("fullPackage.productName")]: order.productName,
      [pickLang(language, { ku: "پلاتفۆرم", en: "Platform", ar: "المنصة", zh: "平台" })]: (order as any).platform || "",
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
      [orderNumberCol]: "",
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

    // Loaded on demand so the heavy xlsx bundle stays out of the page chunk.
    const XLSX = await import("xlsx");
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
              <th>${pickLang(language, { ku: "ئۆردەر #", en: "Order #", ar: "الطلب #", zh: "订单 #" })}</th>
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
                    <Download className="h-4 w-4 ms-2" />
                    {t("common.export")}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={exportToExcel}>
                    <FileSpreadsheet className="h-4 w-4 ms-2 text-green-600 dark:text-green-300" />
                    {t("fullPackage.exportExcel")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportToPDF}>
                    <FileText className="h-4 w-4 ms-2 text-red-600 dark:text-red-300" />
                    {t("fullPackage.exportPDF")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              <Link href="/full-package/bulk-create?type=full_package">
                <Button variant="outline" className="bg-white/80 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 border-emerald-300 dark:border-emerald-800/60">
                  <PackagePlus className="h-4 w-4 ms-2" />
                  {t("fullPackage.bulkCreate")}
                </Button>
              </Link>
              <Link href="/full-package/new">
                <Button className="bg-white dark:bg-card text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50">
                  <Plus className="h-4 w-4 ms-2" />
                  {t("fullPackage.newOrder")}
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card className="bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-emerald-600 dark:text-emerald-300 font-medium">{t("fullPackage.ordersCountLabel")}</p>
                  <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{totalOrders}</p>
                </div>
                <div className="p-2 bg-emerald-100 dark:bg-emerald-950/40 rounded-xl">
                  <Package className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-amber-600 dark:text-amber-300 font-medium">{t("fullPackage.pendingLabel")}</p>
                  <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{pendingOrders}</p>
                </div>
                <div className="p-2 bg-amber-100 dark:bg-amber-950/40 rounded-xl">
                  <Clock className="h-5 w-5 text-amber-600 dark:text-amber-300" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-blue-600 dark:text-blue-300 font-medium">{t("fullPackage.inTransitLabel")}</p>
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{inTransitOrders}</p>
                </div>
                <div className="p-2 bg-blue-100 dark:bg-blue-950/40 rounded-xl">
                  <Clock className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-red-600 dark:text-red-300 font-medium">{t("fullPackage.totalPurchaseCost")}</p>
                  <p className="text-xl font-bold text-red-700 dark:text-red-300">${totalPurchaseCost.toFixed(2)}</p>
                </div>
                <div className="p-2 bg-red-100 dark:bg-red-950/40 rounded-xl">
                  <ShoppingCart className="h-5 w-5 text-red-600 dark:text-red-300" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-green-600 dark:text-green-300 font-medium">{t("fullPackage.grossProfitLabel")}</p>
                  <p className="text-xl font-bold text-green-700 dark:text-green-300">${totalGrossProfit.toFixed(2)}</p>
                </div>
                <div className="p-2 bg-green-100 dark:bg-green-950/40 rounded-xl">
                  <DollarSign className="h-5 w-5 text-green-600 dark:text-green-300" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-purple-600 dark:text-purple-300 font-medium">{t("fullPackage.netProfitLabel")}</p>
                  <p className="text-xl font-bold text-purple-700 dark:text-purple-300">${totalNetProfit.toFixed(2)}</p>
                </div>
                <div className="p-2 bg-purple-100 dark:bg-purple-950/40 rounded-xl">
                  <TrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-300" />
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
                {/* Route first: it is the question asked most often, and it
                    answers without opening a panel. */}
                <ShippingRouteFilter
                  value={routeFilter}
                  onChange={setRouteFilter}
                  counts={routeCounts}
                />
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
                      <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-red-600 dark:text-red-300 hover:text-red-700">
                        <X className="h-4 w-4 ms-1" />
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

                    {/* Shipping-method Filter */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <Plane className="h-4 w-4" />
                        {t("fullPackage.shippingMethodLabel")}
                      </label>
                      <Select value={shippingFilter} onValueChange={setShippingFilter}>
                        <SelectTrigger>
                          <SelectValue placeholder={t("fullPackage.allShipping")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t("fullPackage.allShipping")}</SelectItem>
                          <SelectItem value="air_regular">{t("fullPackage.airRegular")}</SelectItem>
                          <SelectItem value="air_irregular">{t("fullPackage.airIrregular")}</SelectItem>
                          <SelectItem value="sea">{t("fullPackage.sea")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Tracking Filter */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <Barcode className="h-4 w-4" />
                        {t("fullPackage.trackingLabel")}
                      </label>
                      <Select value={trackingFilter} onValueChange={(v) => setTrackingFilter(v as "all" | "with" | "without")}>
                        <SelectTrigger>
                          <SelectValue placeholder={t("fullPackage.allTracking")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t("fullPackage.allTracking")}</SelectItem>
                          <SelectItem value="with">{t("fullPackage.withTracking")}</SelectItem>
                          <SelectItem value="without">{t("fullPackage.withoutTracking")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <ImageIcon className="h-4 w-4" />
                        {pickLang(language, { ku: "وێنەی کاڵا", en: "Product image", ar: "صورة المنتج", zh: "商品图片" })}
                      </label>
                      <Select value={imageFilter} onValueChange={(v) => setImageFilter(v as "all" | "with" | "without")}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{pickLang(language, { ku: "هەموو", en: "All", ar: "الكل", zh: "全部" })}</SelectItem>
                          <SelectItem value="with">{pickLang(language, { ku: "بە وێنە", en: "With image", ar: "مع صورة", zh: "有图片" })}</SelectItem>
                          <SelectItem value="without">{pickLang(language, { ku: "بێ وێنە", en: "Without image", ar: "بدون صورة", zh: "无图片" })}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              {/* Results count and active filters summary */}
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {t("fullPackage.ordersCountFound", { count: String(filteredOrders.length) })}
                  {hasActiveFilters && (
                    <span className="text-emerald-600 dark:text-emerald-300 me-2">{t("fullPackage.filteredBadge")}</span>
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

              {/* Active filter chips */}
              <FilterChips chips={filterChips} onClearAll={clearAllFilters} />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <TableSkeleton rows={6} cols={6} />
            ) : filteredOrders.length === 0 ? (
              <EmptyState
                icon={<ShoppingBag />}
                title={t("fullPackage.noOrdersMessage") || pickLang(language, { ku: "هیچ ئۆردەرێک نییە", en: "No orders yet", ar: "لا توجد طلبات", zh: "暂无订单" })}
                description={
                  hasActiveFilters
                    ? t("common.tryClearingFilters") || pickLang(language, { ku: "هەوڵبدە فلتەرەکان پاک بکەیتەوە", en: "Try clearing the filters", ar: "حاول مسح عوامل التصفية", zh: "请尝试清除筛选条件" })
                    : undefined
                }
                action={
                  hasActiveFilters ? (
                    <Button variant="outline" onClick={clearAllFilters}>
                      <X className="h-4 w-4 ms-2" />
                      {t("fullPackage.clearAllFilters") || pickLang(language, { ku: "پاککردنەوەی فلتەرەکان", en: "Clear filters", ar: "مسح عوامل التصفية", zh: "清除筛选" })}
                    </Button>
                  ) : (
                    <Link href="/full-package/new">
                      <Button variant="outline">
                        <Plus className="h-4 w-4 ms-2" />
                        {t("fullPackage.addFirstOrderButton")}
                      </Button>
                    </Link>
                  )
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  {/* Same treatment as the markup-purchase table: headings
                      centred over their columns, money columns right-aligned
                      with their figures, one padding value throughout. */}
                  <TableHeader>
                    <TableRow className="[&>th]:h-11 [&>th]:px-3 [&>th]:text-center [&>th]:align-middle [&>th]:font-semibold [&>th]:whitespace-nowrap">
                      <TableHead>{pickLang(language, { ku: "کۆدی ئۆردەر", en: "Order Code", ar: "رمز الطلب", zh: "订单编码" })}</TableHead>
                      <TableHead>{t("fullPackage.customer")}</TableHead>
                      <TableHead>{t("fullPackage.productName")}</TableHead>
                      <TableHead>{t("fullPackage.batchLabel")}</TableHead>
                      <TableHead className="cursor-pointer text-end hover:bg-muted/50" onClick={() => toggleSort("purchase")}>
                        {t("fullPackage.purchaseColumn")} {sortField === "purchase" && (sortDirection === "asc" ? "↑" : "↓")}
                      </TableHead>
                      <TableHead className="cursor-pointer text-end hover:bg-muted/50" onClick={() => toggleSort("selling")}>
                        {t("fullPackage.sellingColumn")} {sortField === "selling" && (sortDirection === "asc" ? "↑" : "↓")}
                      </TableHead>
                      <TableHead className="cursor-pointer text-end hover:bg-muted/50" onClick={() => toggleSort("profit")}>
                        {t("fullPackage.profit")} {sortField === "profit" && (sortDirection === "asc" ? "↑" : "↓")}
                      </TableHead>
                      <TableHead>{t("fullPackage.tracking")}</TableHead>
                      <TableHead>{t("fullPackage.statusColumn")}</TableHead>
                      <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => toggleSort("date")}>
                        {t("fullPackage.dateColumn")} {sortField === "date" && (sortDirection === "asc" ? "↑" : "↓")}
                      </TableHead>
                      <TableHead>{t("fullPackage.actionsColumn")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {routedOrders.map((order) => (
                      <TableRow
                        key={order.id}
                        className="transition-colors hover:bg-blue-50/60 dark:hover:bg-blue-950/30 hover:ring-2 hover:ring-inset hover:ring-blue-400/50 [&>td]:px-3 [&>td]:py-2.5 [&>td]:align-middle [&>td:not(:nth-child(2)):not(:nth-child(3))]:text-center [&>td>div]:justify-center [&>td:nth-child(2)>div]:justify-start [&>td:nth-child(3)>div]:justify-start"
                      >
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-1">
                              <Badge variant="outline" className="font-mono text-emerald-600 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800/60">
                                {order.orderCode}
                              </Badge>
                              <CopyButton value={order.orderCode} label={pickLang(language, { ku: "کۆپی کۆدی ئۆردەر", en: "Copy order code", ar: "نسخ رمز الطلب", zh: "复制订单编码" })} />
                            </div>
                            {(order as any).orderNumber && (
                              <div className="flex items-center gap-1">
                                <p className="text-xs text-muted-foreground font-mono">
                                  #{(order as any).orderNumber}
                                </p>
                                <CopyButton value={(order as any).orderNumber} label={pickLang(language, { ku: "کۆپی ئۆردەر نەمبەر", en: "Copy order number", ar: "نسخ رقم الطلب", zh: "复制订单号" })} />
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <div>
                              <p className="font-medium">{(order as any).customer?.fullName || t("fullPackage.customer")}</p>
                              <p className="text-xs text-muted-foreground font-mono">
                                {(order as any).customer?.customerCode || ""}
                              </p>
                            </div>
                            <CopyButton value={(order as any).customer?.fullName} label={pickLang(language, { ku: "کۆپی ناوی کڕیار", en: "Copy customer name", ar: "نسخ اسم العميل", zh: "复制客户姓名" })} />
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
                              <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center">
                                <Package className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
                              </div>
                            )}
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="font-medium text-sm">{order.productName}</p>
                                {/* Inline rather than its own column — the table
                                    already scrolls sideways, and the shop reads
                                    naturally next to the product. */}
                                <PlatformChip platform={(order as any).platform} size="xs" />
                              </div>
                              {order.quantity > 1 && (
                                <p className="text-xs text-muted-foreground">{order.quantity} {t("fullPackage.quantityUnit")}</p>
                              )}
                              {/* The shop's order number is not repeated here.
                                  It sits in the first column with the order
                                  code and its copy button, where the row's
                                  identifiers belong — printing it twice made
                                  the product cell look like it held a second,
                                  different number. */}
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
                              <CopyButton value={(order as any).batch.batchCode} label={pickLang(language, { ku: "کۆپی کۆدی باچ", en: "Copy batch code", ar: "نسخ رمز الدفعة", zh: "复制批次编码" })} />
                            </div>
                          ) : (
                            <Badge variant="outline" className="text-xs bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60">
                              {t("fullPackage.noBatch")}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-mono">${((parseFloat(order.purchasePriceUsd || "0") * (order.quantity || 1))).toFixed(2)}</TableCell>
                        <TableCell className="font-mono text-emerald-600 dark:text-emerald-300">${((parseFloat(order.sellingPriceUsd || "0") * (order.quantity || 1))).toFixed(2)}</TableCell>
                        <TableCell className="font-mono font-bold text-green-600 dark:text-green-300">
                          ${((parseFloat(order.grossProfitUsd || "0") * (order.quantity || 1))).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {order.trackingNumber ? (
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-1">
                                <Badge variant="secondary" className="font-mono text-xs">
                                  {order.trackingNumber}
                                </Badge>
                                <CopyButton value={order.trackingNumber} label={pickLang(language, { ku: "کۆپی تراکینگ", en: "Copy tracking", ar: "نسخ التتبع", zh: "复制跟踪号" })} />
                              </div>
                              {order.trackingAddedDate && (
                                <p className="text-xs text-muted-foreground">
                                  {new Date(order.trackingAddedDate).toLocaleDateString("ku")}
                                </p>
                              )}
                            </div>
                          ) : (
                            <Badge variant="outline" className="text-xs bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60">
                              {t("fullPackage.noTracking")}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                className="inline-flex items-center gap-1 cursor-pointer rounded-full hover:ring-2 hover:ring-primary/50 transition-all"
                              >
                                <StatusBadge status={order.status} kind="order" />
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
