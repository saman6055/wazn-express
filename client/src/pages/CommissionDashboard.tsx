import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
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

const statusLabels: Record<string, string> = {
  pending: "چاوەڕوان",
  pending_quote: "چاوەڕوان",
  ordered: "پەت کراوە",
  tracking_added: "تراکینگ زیادکرا",
  in_batch: "لە باچ",
  in_transit: "لە ڕێگادا",
  shipped: "گواستراوەتەوە",
  delivered: "گەیشتووە",
  completed: "تەواوبووە",
  cancelled: "هەڵوەشاوە",
};

const statusOptions = [
  { value: "pending", label: "چاوەڕوان" },
  { value: "ordered", label: "پەت کراوە" },
  { value: "tracking_added", label: "تراکینگ زیادکرا" },
  { value: "in_batch", label: "لە باچ" },
  { value: "in_transit", label: "لە ڕێگادا" },
  { value: "shipped", label: "گواستراوەتەوە" },
  { value: "delivered", label: "گەیشتووە" },
  { value: "completed", label: "تەواوبووە" },
  { value: "cancelled", label: "هەڵوەشاوە" },
];

type SortField = "date" | "itemPrice" | "commission" | "total" | "customer";
type SortDirection = "asc" | "desc";

export default function CommissionDashboard() {
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
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
    status: statusFilter !== "all" ? statusFilter : undefined,
  });

  const { data: batches } = trpc.batches.list.useQuery();
  const { data: customers } = trpc.customers.list.useQuery();

  // Update status mutation
  const updateStatusMutation = trpc.fullPackage.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("بارودۆخ نوێکرایەوە");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Filter and sort orders
  const filteredOrders = useMemo(() => {
    let result = orders || [];
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(order =>
        order.productName?.toLowerCase().includes(query) ||
        order.orderCode?.toLowerCase().includes(query) ||
        (order as any).customer?.fullName?.toLowerCase().includes(query) ||
        (order as any).customer?.customerCode?.toLowerCase().includes(query)
      );
    }
    
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
      "کۆدی پەت": order.orderCode,
      "کڕیار": (order as any).customer?.fullName || "",
      "کۆدی کڕیار": (order as any).customer?.customerCode || "",
      "ناوی کاڵا": order.productName,
      "ژمارە": order.quantity,
      "باچ": (order as any).batch?.batchCode || "بێ باچ",
      "بەهای کاڵا ($)": (parseFloat(order.itemPriceUsd || "0") * (order.quantity || 1)).toFixed(2),
      "عمولە ($)": parseFloat(order.commissionFeeUsd || "0").toFixed(2),
      "کۆی گشتی ($)": ((parseFloat(order.itemPriceUsd || "0") * (order.quantity || 1)) + parseFloat(order.commissionFeeUsd || "0")).toFixed(2),
      "تراکینگ": order.trackingNumber || "",
      "بارودۆخ": statusLabels[order.status] || order.status,
      "بەروار": new Date(order.createdAt).toLocaleDateString("ku"),
    }));

    // Add summary row
    data.push({
      "کۆدی پەت": "کۆی گشتی",
      "کڕیار": "",
      "کۆدی کڕیار": "",
      "ناوی کاڵا": `${totalOrders} پەت`,
      "ژمارە": filteredOrders.reduce((sum, o) => sum + (o.quantity || 1), 0),
      "باچ": "",
      "بەهای کاڵا ($)": totalItemValue.toFixed(2),
      "عمولە ($)": totalCommission.toFixed(2),
      "کۆی گشتی ($)": totalCost.toFixed(2),
      "تراکینگ": "",
      "بارودۆخ": "",
      "بەروار": "",
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "کڕین بە عمولە");
    
    // Set column widths
    ws["!cols"] = [
      { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 25 }, { wch: 8 },
      { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 20 },
      { wch: 12 }, { wch: 12 }
    ];
    
    XLSX.writeFile(wb, `commission-report-${new Date().toISOString().split("T")[0]}.xlsx`);
    toast.success("فایلی Excel داگیرا");
  };

  // Export to PDF
  const exportToPDF = () => {
    const printContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ku">
      <head>
        <meta charset="UTF-8">
        <title>ڕاپۆرتی کڕین بە عمولە</title>
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
          <h1>% ڕاپۆرتی کڕین بە عمولە</h1>
          <p>Wazn Express - بەڕێوەبردنی کڕین بە عمولە</p>
          <p>بەروار: ${new Date().toLocaleDateString("ku")}</p>
        </div>
        
        <div class="stats">
          <div class="stat-card">
            <div class="value">${totalOrders}</div>
            <div class="label">کۆی پەتەکان</div>
          </div>
          <div class="stat-card">
            <div class="value">$${totalItemValue.toFixed(2)}</div>
            <div class="label">کۆی بەهای کاڵا</div>
          </div>
          <div class="stat-card">
            <div class="value">$${totalCommission.toFixed(2)}</div>
            <div class="label">کۆی عمولە</div>
          </div>
          <div class="stat-card">
            <div class="value">$${totalCost.toFixed(2)}</div>
            <div class="label">کۆی گشتی</div>
          </div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>کۆد</th>
              <th>کڕیار</th>
              <th>کاڵا</th>
              <th>ژمارە</th>
              <th>بەهای کاڵا</th>
              <th>عمولە</th>
              <th>کۆی گشتی</th>
              <th>بارودۆخ</th>
              <th>بەروار</th>
            </tr>
          </thead>
          <tbody>
            ${filteredOrders.map(order => `
              <tr>
                <td>${order.orderCode}</td>
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
              <td colspan="3">کۆی گشتی</td>
              <td>${filteredOrders.reduce((sum, o) => sum + (o.quantity || 1), 0)}</td>
              <td>$${totalItemValue.toFixed(2)}</td>
              <td>$${totalCommission.toFixed(2)}</td>
              <td>$${totalCost.toFixed(2)}</td>
              <td colspan="2"></td>
            </tr>
          </tbody>
        </table>
        
        <div class="footer">
          <p>ئەم ڕاپۆرتە لە لایەن سیستەمی Wazn Express دروستکراوە</p>
          <p>© ${new Date().getFullYear()} Wazn Express - هەموو مافەکان پارێزراون</p>
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
    toast.success("ڕاپۆرتی PDF ئامادەیە بۆ چاپکردن");
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
                <h1 className="text-2xl font-bold">کڕین بە عمولە</h1>
                <p className="text-amber-100">بەڕێوەبردنی پەتەکانی عمولە</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Export Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" className="bg-white/20 text-white hover:bg-white/30 border-0">
                    <Download className="h-4 w-4 ml-2" />
                    داگرتن
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={exportToExcel}>
                    <FileSpreadsheet className="h-4 w-4 ml-2 text-green-600" />
                    داگرتنی Excel
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportToPDF}>
                    <FileText className="h-4 w-4 ml-2 text-red-600" />
                    داگرتنی PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              <Button
                variant="outline"
                onClick={() => navigate("/commission/bulk-create?type=commission")}
                className="bg-white/80 text-amber-700 hover:bg-amber-50 border-amber-300"
              >
                <PackagePlus className="h-4 w-4 ml-2" />
                دروستکردن بە کۆمەڵ
              </Button>
              <Button
                onClick={() => navigate("/commission/new")}
                className="bg-white text-amber-700 hover:bg-amber-50"
              >
                <Plus className="h-4 w-4 ml-2" />
                پەتی نوێ
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
                  <p className="text-xs text-amber-600 font-medium">کۆی پەتەکان</p>
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
                  <p className="text-xs text-orange-600 font-medium">چاوەڕوان</p>
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
                  <p className="text-xs text-blue-600 font-medium">پەت کراوە</p>
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
                  <p className="text-xs text-green-600 font-medium">گەیشتووە</p>
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
                  <p className="text-xs text-red-600 font-medium">کۆی کڕین</p>
                  <p className="text-xl font-bold text-red-700">${totalCost.toFixed(2)}</p>
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
                  <p className="text-xs text-yellow-700 font-medium">کۆی عمولە</p>
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
                    placeholder="گەڕان بە کۆد، ئۆردەر نەمبەر، ناوی کاڵا..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pr-10"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-48">
                    <Filter className="h-4 w-4 ml-2" />
                    <SelectValue placeholder="هەموو" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">هەموو</SelectItem>
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
                  فلتەری پێشکەوتوو
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
                    <h4 className="font-medium text-sm">فلتەرە پێشکەوتووەکان</h4>
                    {hasActiveFilters && (
                      <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-red-600 hover:text-red-700">
                        <X className="h-4 w-4 ml-1" />
                        پاککردنەوەی هەموو
                      </Button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Customer Filter */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        کڕیار
                      </label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-between">
                            {customerFilter !== "all" 
                              ? customers?.find(c => c.id.toString() === customerFilter)?.fullName || "هەڵبژاردن"
                              : "هەموو کڕیارەکان"
                            }
                            <ChevronDown className="h-4 w-4 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-2" align="start">
                          <Input
                            placeholder="گەڕان بە ناو یان کۆد..."
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
                              هەموو کڕیارەکان
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
                        باچ
                      </label>
                      <Select value={batchFilter} onValueChange={setBatchFilter}>
                        <SelectTrigger>
                          <SelectValue placeholder="هەموو باچەکان" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">هەموو باچەکان</SelectItem>
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
                        ماوەی بەروار
                      </label>
                      <div className="flex gap-2">
                        <Input
                          type="date"
                          value={dateFrom}
                          onChange={(e) => setDateFrom(e.target.value)}
                          className="flex-1"
                          placeholder="لە"
                        />
                        <Input
                          type="date"
                          value={dateTo}
                          onChange={(e) => setDateTo(e.target.value)}
                          className="flex-1"
                          placeholder="بۆ"
                        />
                      </div>
                    </div>

                    {/* Price Range */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        بەهای کاڵا ($)
                      </label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          value={minPrice}
                          onChange={(e) => setMinPrice(e.target.value)}
                          placeholder="کەمترین"
                          className="flex-1"
                        />
                        <Input
                          type="number"
                          value={maxPrice}
                          onChange={(e) => setMaxPrice(e.target.value)}
                          placeholder="زۆرترین"
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
                  {filteredOrders.length} پەت دۆزرایەوە
                  {hasActiveFilters && (
                    <span className="text-amber-600 mr-2">(فلتەرکراو)</span>
                  )}
                </div>
                
                {/* Sort dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-2">
                      <ArrowUpDown className="h-4 w-4" />
                      ڕیزکردن
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => toggleSort("date")}>
                      بەروار {sortField === "date" && (sortDirection === "asc" ? "↑" : "↓")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => toggleSort("itemPrice")}>
                      بەهای کاڵا {sortField === "itemPrice" && (sortDirection === "asc" ? "↑" : "↓")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => toggleSort("commission")}>
                      عمولە {sortField === "commission" && (sortDirection === "asc" ? "↑" : "↓")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => toggleSort("total")}>
                      کۆی گشتی {sortField === "total" && (sortDirection === "asc" ? "↑" : "↓")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => toggleSort("customer")}>
                      کڕیار {sortField === "customer" && (sortDirection === "asc" ? "↑" : "↓")}
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
                <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">هیچ پەتێک نییە</p>
                <Button
                  className="mt-4"
                  variant="outline"
                  onClick={() => navigate("/commission/new")}
                >
                  <Plus className="h-4 w-4 ml-2" />
                  پەتی نوێ زیاد بکە
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>کۆدی پەت</TableHead>
                      <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => toggleSort("customer")}>
                        کڕیار {sortField === "customer" && (sortDirection === "asc" ? "↑" : "↓")}
                      </TableHead>
                      <TableHead>ناوی کاڵا</TableHead>
                      <TableHead>باچ</TableHead>
                      <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => toggleSort("itemPrice")}>
                        بەهای کاڵا {sortField === "itemPrice" && (sortDirection === "asc" ? "↑" : "↓")}
                      </TableHead>
                      <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => toggleSort("commission")}>
                        عمولە {sortField === "commission" && (sortDirection === "asc" ? "↑" : "↓")}
                      </TableHead>
                      <TableHead>تراکینگ</TableHead>
                      <TableHead>بارودۆخ</TableHead>
                      <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => toggleSort("date")}>
                        بەروار {sortField === "date" && (sortDirection === "asc" ? "↑" : "↓")}
                      </TableHead>
                      <TableHead className="text-left">کردارەکان</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-amber-600 border-amber-300">
                            {order.orderCode}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{(order as any).customer?.fullName || "کڕیار"}</p>
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
                              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                                <Package className="h-5 w-5 text-amber-600" />
                              </div>
                            )}
                            <div>
                              <p className="font-medium text-sm">{order.productName}</p>
                              {order.quantity > 1 && (
                                <p className="text-xs text-muted-foreground">{order.quantity} دانە</p>
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
                              بێ باچ
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
                            <Badge variant="secondary" className="font-mono text-xs">
                              {order.trackingNumber}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                              بێ تراکینگ
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
                              onClick={() => navigate(`/commission/${order.id}`)}
                              title="سەیرکردن"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => navigate(`/commission/${order.id}/edit`)}
                              title="دەستکاریکردن"
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
