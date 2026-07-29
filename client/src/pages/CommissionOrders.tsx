import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CopyButton } from "@/components/CopyButton";
import { ZoomImage } from "@/components/ZoomImage";
import {
  Package,
  Plus,
  DollarSign,
  TrendingUp,
  Clock,
  Search,
  ShoppingBag,
  Filter,
  Plane,
  Layers,
  Eye,
  Pencil,
  ChevronDown,
  Truck,
  Calendar,
  ChevronsUpDown,
  ArrowDownUp,
  Check,
  X,
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { pickLang } from "@/lib/lang";
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

const getStatusLabels = (language: string): Record<string, string> => ({
  pending: pickLang(language, { ku: "چاوەڕوان", en: "Pending", ar: "قيد الانتظار", zh: "待处理" }),
  approved: pickLang(language, { ku: "پەسەندکراو", en: "Approved", ar: "تمت الموافقة", zh: "已批准" }),
  ordered: pickLang(language, { ku: "کڕدرا", en: "Ordered", ar: "تم الطلب", zh: "已下单" }),
  tracking_added: pickLang(language, { ku: "تراکینگ زیادکرا", en: "Tracking added", ar: "تمت إضافة التتبع", zh: "已添加追踪号" }),
  in_china_warehouse: pickLang(language, { ku: "لە کۆگای چین", en: "In China warehouse", ar: "في مستودع الصين", zh: "在中国仓库" }),
  in_batch: pickLang(language, { ku: "لە باچ", en: "In batch", ar: "في الدفعة", zh: "在批次中" }),
  in_transit: pickLang(language, { ku: "لە ڕێگادا", en: "In transit", ar: "قيد الشحن", zh: "运输中" }),
  arrived: pickLang(language, { ku: "گەیشتووە", en: "Arrived", ar: "وصلت", zh: "已到达" }),
  delivered: pickLang(language, { ku: "گەیەندرا", en: "Delivered", ar: "تم التسليم", zh: "已送达" }),
  cancelled: pickLang(language, { ku: "هەڵوەشاوە", en: "Cancelled", ar: "ملغاة", zh: "已取消" }),
});

const getStatusOptions = (language: string) => [
  { value: "pending", label: pickLang(language, { ku: "چاوەڕوان", en: "Pending", ar: "قيد الانتظار", zh: "待处理" }) },
  { value: "approved", label: pickLang(language, { ku: "پەسەندکراو", en: "Approved", ar: "تمت الموافقة", zh: "已批准" }) },
  { value: "ordered", label: pickLang(language, { ku: "کڕدرا", en: "Ordered", ar: "تم الطلب", zh: "已下单" }) },
  { value: "tracking_added", label: pickLang(language, { ku: "تراکینگ زیادکرا", en: "Tracking added", ar: "تمت إضافة التتبع", zh: "已添加追踪号" }) },
  { value: "in_china_warehouse", label: pickLang(language, { ku: "لە کۆگای چین", en: "In China warehouse", ar: "في مستودع الصين", zh: "在中国仓库" }) },
  { value: "in_batch", label: pickLang(language, { ku: "لە باچ", en: "In batch", ar: "في الدفعة", zh: "在批次中" }) },
  { value: "in_transit", label: pickLang(language, { ku: "لە ڕێگادا", en: "In transit", ar: "قيد الشحن", zh: "运输中" }) },
  { value: "arrived", label: pickLang(language, { ku: "گەیشتووە", en: "Arrived", ar: "وصلت", zh: "已到达" }) },
  { value: "delivered", label: pickLang(language, { ku: "گەیەندرا", en: "Delivered", ar: "تم التسليم", zh: "已送达" }) },
  { value: "cancelled", label: pickLang(language, { ku: "هەڵوەشاوە", en: "Cancelled", ar: "ملغاة", zh: "已取消" }) },
];

export default function CommissionOrders() {
  const { language } = useTranslation();
  const statusLabels = getStatusLabels(language);
  const statusOptions = getStatusOptions(language);
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [shippingFilter, setShippingFilter] = useState<string>("all");
  // New client-side filters + sort
  const [customerFilter, setCustomerFilter] = useState<string>(""); // customerId, "" = all
  const [customerOpen, setCustomerOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [trackingFilter, setTrackingFilter] = useState<"all" | "with" | "without">("all");
  const [batchFilter, setBatchFilter] = useState<string>("all"); // "all" | batchId | "none"
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "value">("newest");


  const { data: orders, isLoading, refetch } = trpc.fullPackage.list.useQuery({
    orderType: "commission",
    search: search || undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
  });

  const { data: batches } = trpc.batches.list.useQuery();
  const { data: customers } = trpc.customers.list.useQuery();

  // batches.list may return a plain array or a paginated { data } shape
  const batchList: any[] = Array.isArray(batches)
    ? batches
    : ((batches as any)?.data ?? []);

  const filteredCustomers = useMemo(
    () =>
      (customers ?? []).filter((customer: any) => {
        if (!customerSearch) return true;
        const q = customerSearch.toLowerCase();
        const name = (customer.fullName || customer.fullNameKurdish || "").toLowerCase();
        const code = (customer.customerCode || "").toLowerCase();
        const phone = (customer.mobileNumber || "").toLowerCase();
        return name.includes(q) || code.includes(q) || phone.includes(q);
      }),
    [customers, customerSearch],
  );
  const selectedCustomer = (customers ?? []).find(
    (c: any) => String(c.id) === customerFilter,
  );

  const hasActiveFilters =
    search !== "" ||
    statusFilter !== "all" ||
    shippingFilter !== "all" ||
    customerFilter !== "" ||
    trackingFilter !== "all" ||
    batchFilter !== "all" ||
    dateFrom !== "" ||
    dateTo !== "" ||
    sortBy !== "newest";

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setShippingFilter("all");
    setCustomerFilter("");
    setCustomerSearch("");
    setTrackingFilter("all");
    setBatchFilter("all");
    setDateFrom("");
    setDateTo("");
    setSortBy("newest");
  };

  const getOrderDate = (o: any): number => {
    const raw = (o as any).createdAt ?? (o as any).orderDate;
    if (!raw) return 0;
    const t = new Date(raw).getTime();
    return isNaN(t) ? 0 : t;
  };

  const getOrderValue = (o: any): number =>
    parseFloat((o as any).totalCostUsd ?? (o as any).totalPrepaidUsd ?? "0") || 0;

  const updateStatusMutation = trpc.fullPackage.updateStatus.useMutation({
    onSuccess: () => {
      toast.success(pickLang(language, { ku: "بارودۆخ نوێکرایەوە", en: "Status updated", ar: "تم تحديث الحالة", zh: "状态已更新" }));
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });



  // Date range bounds (parsed once)
  const dateFromMs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
  const dateToMs = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null;

  // Calculate stats for commission orders only
  const fullPackageOrders = useMemo(
    () =>
      (orders?.filter(o => o.orderType === "commission") || [])
        .filter(o => shippingFilter === "all" || (o as any).shippingType === shippingFilter)
        // Customer filter
        .filter(o => customerFilter === "" || String((o as any).customerId) === customerFilter)
        // Tracking filter
        .filter(o => {
          if (trackingFilter === "all") return true;
          const tn = (o as any).trackingNumber;
          const hasTracking = typeof tn === "string" && tn.trim() !== "";
          return trackingFilter === "with" ? hasTracking : !hasTracking;
        })
        // Batch filter
        .filter(o => {
          if (batchFilter === "all") return true;
          const bid = (o as any).batchId;
          if (batchFilter === "none") return bid == null;
          return String(bid) === batchFilter;
        })
        // Date range filter
        .filter(o => {
          if (dateFromMs === null && dateToMs === null) return true;
          const t = getOrderDate(o);
          if (t === 0) return false;
          if (dateFromMs !== null && t < dateFromMs) return false;
          if (dateToMs !== null && t > dateToMs) return false;
          return true;
        })
        // Sort
        .slice()
        .sort((a, b) => {
          if (sortBy === "value") return getOrderValue(b) - getOrderValue(a);
          const da = getOrderDate(a);
          const db = getOrderDate(b);
          return sortBy === "oldest" ? da - db : db - da;
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orders, shippingFilter, customerFilter, trackingFilter, batchFilter, dateFromMs, dateToMs, sortBy],
  );
  const { totalOrders, pendingOrders, inTransitOrders } = useMemo(
    () => ({
      totalOrders: fullPackageOrders.length,
      pendingOrders: fullPackageOrders.filter(o => ["pending", "ordered", "tracking_added"].includes(o.status)).length,
      inTransitOrders: fullPackageOrders.filter(o => ["in_batch", "in_transit"].includes(o.status)).length,
    }),
    [fullPackageOrders],
  );
  
  const totalGrossProfit = fullPackageOrders.reduce((sum, o) => {
    const profit = parseFloat(o.profitUsd || "0");
    return sum + profit;
  }, 0);
  
  const totalNetProfit = fullPackageOrders.reduce((sum, o) => {
    const profit = parseFloat(o.profitUsd || "0");
    return sum + profit;
  }, 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-l from-emerald-600 to-emerald-700 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl">
                <ShoppingBag className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">{pickLang(language, { ku: "کڕین بە تێچوو", en: "Commission purchasing", ar: "الشراء بالعمولة", zh: "代购订单" })}</h1>
                <p className="text-emerald-100">{pickLang(language, { ku: "کڕین بۆ کڕیار بە عمولە", en: "Purchasing for customers with commission", ar: "الشراء للعملاء مقابل عمولة", zh: "为客户代购并收取佣金" })}</p>
              </div>
            </div>
            <Link href="/commission-orders/new">
              <Button className="bg-white text-emerald-700 hover:bg-emerald-50">
                <Plus className="h-4 w-4 ms-2" />
                {pickLang(language, { ku: "ئۆردەری نوێ", en: "New order", ar: "طلب جديد", zh: "新订单" })}
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-emerald-600 font-medium">{pickLang(language, { ku: "کۆی ئۆردەرەکان", en: "Total orders", ar: "إجمالي الطلبات", zh: "订单总数" })}</p>
                  <p className="text-2xl font-bold text-emerald-700">{totalOrders}</p>
                </div>
                <div className="p-3 bg-emerald-100 rounded-xl">
                  <Package className="h-6 w-6 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-50 to-white border-amber-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-amber-600 font-medium">{pickLang(language, { ku: "چاوەڕوان", en: "Pending", ar: "قيد الانتظار", zh: "待处理" })}</p>
                  <p className="text-2xl font-bold text-amber-700">{pendingOrders}</p>
                </div>
                <div className="p-3 bg-amber-100 rounded-xl">
                  <Clock className="h-6 w-6 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600 font-medium">{pickLang(language, { ku: "لە ڕێگادا", en: "In transit", ar: "قيد الشحن", zh: "运输中" })}</p>
                  <p className="text-2xl font-bold text-blue-700">{inTransitOrders}</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-xl">
                  <Clock className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-white border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-600 font-medium">{pickLang(language, { ku: "قازانجی خاو", en: "Gross profit", ar: "الربح الإجمالي", zh: "毛利润" })}</p>
                  <p className="text-2xl font-bold text-green-700">${totalGrossProfit.toFixed(2)}</p>
                </div>
                <div className="p-3 bg-green-100 rounded-xl">
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-purple-600 font-medium">{pickLang(language, { ku: "قازانجی خاوێن", en: "Net profit", ar: "صافي الربح", zh: "净利润" })}</p>
                  <p className="text-2xl font-bold text-purple-700">${totalNetProfit.toFixed(2)}</p>
                </div>
                <div className="p-3 bg-purple-100 rounded-xl">
                  <TrendingUp className="h-6 w-6 text-purple-600" />
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
                    placeholder={pickLang(language, { ku: "گەڕان بە کۆد، ئۆردەر نەمبەر، تراکینگ، کڕیار...", en: "Search by code, order number, tracking, customer...", ar: "البحث بالكود أو رقم الطلب أو التتبع أو العميل...", zh: "按编码、订单号、追踪号、客户搜索..." })}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pr-10"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-48">
                    <Filter className="h-4 w-4 ms-2" />
                    <SelectValue placeholder={pickLang(language, { ku: "هەموو", en: "All", ar: "الكل", zh: "全部" })} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{pickLang(language, { ku: "هەموو", en: "All", ar: "الكل", zh: "全部" })}</SelectItem>
                    {statusOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {/* Shipping-method filter */}
                <Select value={shippingFilter} onValueChange={setShippingFilter}>
                  <SelectTrigger className="w-full sm:w-44">
                    <Plane className="h-4 w-4 ms-2" />
                    <SelectValue placeholder={pickLang(language, { ku: "هەموو ڕێگاکان", en: "All methods", ar: "كل الطرق", zh: "所有方式" })} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{pickLang(language, { ku: "هەموو ڕێگاکان", en: "All methods", ar: "كل الطرق", zh: "所有方式" })}</SelectItem>
                    <SelectItem value="air_regular">{pickLang(language, { ku: "ئاسمانی ئاسایی", en: "Air regular", ar: "جوي عادي", zh: "普通空运" })}</SelectItem>
                    <SelectItem value="air_irregular">{pickLang(language, { ku: "ئاسمانی مەرسیدار", en: "Air special", ar: "جوي خاص", zh: "特殊空运" })}</SelectItem>
                    <SelectItem value="sea">{pickLang(language, { ku: "دەریایی", en: "Sea", ar: "بحري", zh: "海运" })}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Second filter row */}
              <div className="flex flex-wrap gap-3">
                {/* Customer filter (searchable) */}
                <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={customerOpen}
                      className="w-full sm:w-56 justify-between font-normal"
                    >
                      {selectedCustomer ? (
                        <span className="flex items-center gap-2 truncate">
                          <Badge variant="secondary" className="text-xs">
                            {(selectedCustomer as any).customerCode}
                          </Badge>
                          <span className="truncate">
                            {(selectedCustomer as any).fullName ||
                              (selectedCustomer as any).fullNameKurdish}
                          </span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">{pickLang(language, { ku: "هەموو کریارەکان", en: "All customers", ar: "كل العملاء", zh: "所有客户" })}</span>
                      )}
                      <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent variant="panel" className="w-[320px] p-0" align="start">
                    <Command>
                      <CommandInput
                        placeholder={pickLang(language, { ku: "گەڕان بە کۆد، ناو، یان ژمارە...", en: "Search by code, name, or number...", ar: "البحث بالكود أو الاسم أو الرقم...", zh: "按编码、姓名或号码搜索..." })}
                        value={customerSearch}
                        onValueChange={setCustomerSearch}
                      />
                      <CommandList>
                        <CommandEmpty>{pickLang(language, { ku: "هیچ کڕیارێک نەدۆزرایەوە", en: "No customer found", ar: "لم يتم العثور على عميل", zh: "未找到客户" })}</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="__all__"
                            onSelect={() => {
                              setCustomerFilter("");
                              setCustomerOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "ms-2 h-4 w-4",
                                customerFilter === "" ? "opacity-100" : "opacity-0",
                              )}
                            />
                            <span className="text-muted-foreground">{pickLang(language, { ku: "هەموو کریارەکان", en: "All customers", ar: "كل العملاء", zh: "所有客户" })}</span>
                          </CommandItem>
                          {filteredCustomers.slice(0, 50).map((customer: any) => (
                            <CommandItem
                              key={customer.id}
                              value={`${customer.fullName} ${customer.customerCode} ${customer.mobileNumber}`}
                              onSelect={() => {
                                setCustomerFilter(String(customer.id));
                                setCustomerOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "ms-2 h-4 w-4",
                                  customerFilter === String(customer.id)
                                    ? "opacity-100"
                                    : "opacity-0",
                                )}
                              />
                              <div className="flex flex-col">
                                <span className="font-medium">
                                  {customer.fullName || customer.fullNameKurdish}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {customer.customerCode} • {customer.mobileNumber}
                                </span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>

                {/* Tracking filter */}
                <Select
                  value={trackingFilter}
                  onValueChange={(v) => setTrackingFilter(v as "all" | "with" | "without")}
                >
                  <SelectTrigger className="w-full sm:w-44">
                    <Truck className="h-4 w-4 ms-2" />
                    <SelectValue placeholder={pickLang(language, { ku: "هەموو", en: "All", ar: "الكل", zh: "全部" })} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{pickLang(language, { ku: "هەموو", en: "All", ar: "الكل", zh: "全部" })}</SelectItem>
                    <SelectItem value="with">{pickLang(language, { ku: "بە تراکینگ", en: "With tracking", ar: "مع تتبع", zh: "有追踪号" })}</SelectItem>
                    <SelectItem value="without">{pickLang(language, { ku: "بێ تراکینگ", en: "Without tracking", ar: "بدون تتبع", zh: "无追踪号" })}</SelectItem>
                  </SelectContent>
                </Select>

                {/* Batch filter */}
                <Select value={batchFilter} onValueChange={setBatchFilter}>
                  <SelectTrigger className="w-full sm:w-44">
                    <Layers className="h-4 w-4 ms-2" />
                    <SelectValue placeholder={pickLang(language, { ku: "هەموو", en: "All", ar: "الكل", zh: "全部" })} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{pickLang(language, { ku: "هەموو", en: "All", ar: "الكل", zh: "全部" })}</SelectItem>
                    <SelectItem value="none">{pickLang(language, { ku: "بێ باچ", en: "No batch", ar: "بدون دفعة", zh: "无批次" })}</SelectItem>
                    {batchList.map((batch: any) => (
                      <SelectItem key={batch.id} value={String(batch.id)}>
                        {batch.batchCode}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Date range */}
                <div className="flex items-end gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {pickLang(language, { ku: "لە بەرواری", en: "From date", ar: "من تاريخ", zh: "起始日期" })}
                    </label>
                    <Input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="w-40"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {pickLang(language, { ku: "تا بەرواری", en: "To date", ar: "إلى تاريخ", zh: "结束日期" })}
                    </label>
                    <Input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="w-40"
                    />
                  </div>
                </div>

                {/* Sort */}
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as "newest" | "oldest" | "value")}>
                  <SelectTrigger className="w-full sm:w-44">
                    <ArrowDownUp className="h-4 w-4 ms-2" />
                    <SelectValue placeholder={pickLang(language, { ku: "نوێترین", en: "Newest", ar: "الأحدث", zh: "最新" })} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">{pickLang(language, { ku: "نوێترین", en: "Newest", ar: "الأحدث", zh: "最新" })}</SelectItem>
                    <SelectItem value="oldest">{pickLang(language, { ku: "کۆنترین", en: "Oldest", ar: "الأقدم", zh: "最早" })}</SelectItem>
                    <SelectItem value="value">{pickLang(language, { ku: "بەهادارترین", en: "Highest value", ar: "الأعلى قيمة", zh: "价值最高" })}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Results count + clear filters */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="text-sm text-muted-foreground">
                  {pickLang(language, { ku: `${fullPackageOrders.length} ئۆردەر دۆزرایەوە`, en: `${fullPackageOrders.length} orders found`, ar: `تم العثور على ${fullPackageOrders.length} طلب`, zh: `找到 ${fullPackageOrders.length} 个订单` })}
                </div>
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="text-muted-foreground h-8"
                  >
                    <X className="h-3.5 w-3.5 ms-1" />
                    {pickLang(language, { ku: "پاککردنەوەی فلتەرەکان", en: "Clear filters", ar: "مسح عوامل التصفية", zh: "清除筛选" })}
                  </Button>
                )}
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
            ) : fullPackageOrders.length === 0 ? (
              <div className="text-center py-12">
                <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">{pickLang(language, { ku: "هیچ ئۆردەرێک نییە", en: "No orders", ar: "لا توجد طلبات", zh: "暂无订单" })}</p>
                <Link href="/commission-orders/new">
                  <Button className="mt-4" variant="outline">
                    <Plus className="h-4 w-4 ms-2" />
                    {pickLang(language, { ku: "ئۆردەری نوێ زیاد بکە", en: "Add new order", ar: "إضافة طلب جديد", zh: "添加新订单" })}
                  </Button>
                </Link>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{pickLang(language, { ku: "کۆدی ئۆردەر", en: "Order code", ar: "كود الطلب", zh: "订单编码" })}</TableHead>
                    <TableHead>{pickLang(language, { ku: "کڕیار", en: "Customer", ar: "العميل", zh: "客户" })}</TableHead>
                    <TableHead>{pickLang(language, { ku: "ناوی کاڵا", en: "Product name", ar: "اسم المنتج", zh: "商品名称" })}</TableHead>
                    <TableHead>{pickLang(language, { ku: "باچ", en: "Batch", ar: "الدفعة", zh: "批次" })}</TableHead>
                    <TableHead>{pickLang(language, { ku: "کڕین", en: "Purchase", ar: "الشراء", zh: "采购价" })}</TableHead>
                    <TableHead>{pickLang(language, { ku: "فرۆشتن", en: "Selling", ar: "البيع", zh: "售价" })}</TableHead>
                    <TableHead>{pickLang(language, { ku: "قازانج", en: "Profit", ar: "الربح", zh: "利润" })}</TableHead>
                    <TableHead>{pickLang(language, { ku: "تراکینگ", en: "Tracking", ar: "التتبع", zh: "追踪号" })}</TableHead>
                    <TableHead>{pickLang(language, { ku: "بارودۆخ", en: "Status", ar: "الحالة", zh: "状态" })}</TableHead>
                    <TableHead>{pickLang(language, { ku: "بەروار", en: "Date", ar: "التاريخ", zh: "日期" })}</TableHead>
                    <TableHead className="text-left">{pickLang(language, { ku: "کردارەکان", en: "Actions", ar: "الإجراءات", zh: "操作" })}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fullPackageOrders.map((order) => (
                    <TableRow
                      key={order.id}
                      className="transition-colors hover:bg-blue-50/60 dark:hover:bg-blue-950/30 hover:ring-2 hover:ring-inset hover:ring-blue-400/50"
                    >
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="font-mono text-emerald-600 border-emerald-300">
                            {order.orderCode}
                          </Badge>
                          <CopyButton value={order.orderCode} label={pickLang(language, { ku: "کۆپی کۆدی ئۆردەر", en: "Copy order code", ar: "نسخ كود الطلب", zh: "复制订单编码" })} />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <div>
                            <p className="font-medium">{(order as any).customer?.fullName || pickLang(language, { ku: "کڕیار", en: "Customer", ar: "العميل", zh: "客户" })}</p>
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
                            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                              <Package className="h-5 w-5 text-emerald-600" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-sm">{order.productName}</p>
                            {order.quantity > 1 && (
                              <p className="text-xs text-muted-foreground">{pickLang(language, { ku: `${order.quantity} دانە`, en: `${order.quantity} pcs`, ar: `${order.quantity} قطعة`, zh: `${order.quantity} 件` })}</p>
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
                            <CopyButton value={(order as any).batch.batchCode} label={pickLang(language, { ku: "کۆپی کۆدی باچ", en: "Copy batch code", ar: "نسخ كود الدفعة", zh: "复制批次编码" })} />
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                            {pickLang(language, { ku: "بێ باچ", en: "No batch", ar: "بدون دفعة", zh: "无批次" })}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-mono">${order.purchasePriceUsd || "0.00"}</TableCell>
                      <TableCell className="font-mono text-emerald-600">${order.sellingPriceUsd || "0.00"}</TableCell>
                      <TableCell className="font-mono font-bold text-green-600">
                        ${order.profitUsd || "0.00"}
                      </TableCell>
                      <TableCell>
                        {order.trackingNumber ? (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1">
                              <Badge variant="secondary" className="font-mono text-xs">
                                {order.trackingNumber}
                              </Badge>
                              <CopyButton value={order.trackingNumber} label={pickLang(language, { ku: "کۆپی تراکینگ", en: "Copy tracking", ar: "نسخ التتبع", zh: "复制追踪号" })} />
                            </div>
                            {order.trackingAddedDate && (
                              <p className="text-xs text-muted-foreground">
                                {new Date(order.trackingAddedDate).toLocaleDateString("ku")}
                              </p>
                            )}
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                            {pickLang(language, { ku: "بێ تراکینگ", en: "No tracking", ar: "بدون تتبع", zh: "无追踪号" })}
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
                                <span className={`w-2 h-2 rounded-full me-2 ${statusColors[option.value]?.split(" ")[0] || "bg-gray-300"}`} />
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
                            onClick={() => setLocation(`/commission/${order.id}`)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            /* This table lists commission orders only (see the
                               orderType filter above), so both actions must open
                               the commission screens — the full-package edit form
                               is the wrong shape for these orders. */
                            onClick={() => setLocation(`/commission/${order.id}/edit`)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>


    </DashboardLayout>
  );
}
