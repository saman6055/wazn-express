import { useState } from "react";
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

const statusLabels: Record<string, string> = {
  pending: "چاوەڕوان",
  approved: "پەسەندکراو",
  ordered: "کڕدرا",
  tracking_added: "تراکینگ زیادکرا",
  in_china_warehouse: "لە کۆگای چین",
  in_batch: "لە باچ",
  in_transit: "لە ڕێگادا",
  arrived: "گەیشتووە",
  delivered: "گەیەندرا",
  cancelled: "هەڵوەشاوە",
};

const statusOptions = [
  { value: "pending", label: "چاوەڕوان" },
  { value: "approved", label: "پەسەندکراو" },
  { value: "ordered", label: "کڕدرا" },
  { value: "tracking_added", label: "تراکینگ زیادکرا" },
  { value: "in_china_warehouse", label: "لە کۆگای چین" },
  { value: "in_batch", label: "لە باچ" },
  { value: "in_transit", label: "لە ڕێگادا" },
  { value: "arrived", label: "گەیشتووە" },
  { value: "delivered", label: "گەیەندرا" },
  { value: "cancelled", label: "هەڵوەشاوە" },
];

export default function CommissionOrders() {
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

  const filteredCustomers = (customers ?? []).filter((customer: any) => {
    if (!customerSearch) return true;
    const q = customerSearch.toLowerCase();
    const name = (customer.fullName || customer.fullNameKurdish || "").toLowerCase();
    const code = (customer.customerCode || "").toLowerCase();
    const phone = (customer.mobileNumber || "").toLowerCase();
    return name.includes(q) || code.includes(q) || phone.includes(q);
  });
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
      toast.success("بارودۆخ نوێکرایەوە");
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
  const fullPackageOrders = (orders?.filter(o => o.orderType === "commission") || [])
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
    });
  const totalOrders = fullPackageOrders.length;
  const pendingOrders = fullPackageOrders.filter(o => ["pending", "ordered", "tracking_added"].includes(o.status)).length;
  const inTransitOrders = fullPackageOrders.filter(o => ["in_batch", "in_transit"].includes(o.status)).length;
  
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
                <h1 className="text-2xl font-bold">کڕین بە تێچوو</h1>
                <p className="text-emerald-100">کڕین بۆ کڕیار بە عمولە</p>
              </div>
            </div>
            <Link href="/commission-orders/new">
              <Button className="bg-white text-emerald-700 hover:bg-emerald-50">
                <Plus className="h-4 w-4 ms-2" />
                ئۆردەری نوێ
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
                  <p className="text-sm text-emerald-600 font-medium">کۆی ئۆردەرەکان</p>
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
                  <p className="text-sm text-amber-600 font-medium">چاوەڕوان</p>
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
                  <p className="text-sm text-blue-600 font-medium">لە ڕێگادا</p>
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
                  <p className="text-sm text-green-600 font-medium">قازانجی خاو</p>
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
                  <p className="text-sm text-purple-600 font-medium">قازانجی خاوێن</p>
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
                    placeholder="گەڕان بە کۆد، ئۆردەر نەمبەر، تراکینگ، کڕیار..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pr-10"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-48">
                    <Filter className="h-4 w-4 ms-2" />
                    <SelectValue placeholder="هەموو" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">هەموو</SelectItem>
                    {statusOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {/* Shipping-method filter */}
                <Select value={shippingFilter} onValueChange={setShippingFilter}>
                  <SelectTrigger className="w-full sm:w-44">
                    <Plane className="h-4 w-4 ms-2" />
                    <SelectValue placeholder="هەموو ڕێگاکان" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">هەموو ڕێگاکان</SelectItem>
                    <SelectItem value="air_regular">ئاسمانی ئاسایی</SelectItem>
                    <SelectItem value="air_irregular">ئاسمانی مەرسیدار</SelectItem>
                    <SelectItem value="sea">دەریایی</SelectItem>
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
                        <span className="text-muted-foreground">هەموو کریارەکان</span>
                      )}
                      <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent variant="panel" className="w-[320px] p-0" align="start">
                    <Command>
                      <CommandInput
                        placeholder="گەڕان بە کۆد، ناو، یان ژمارە..."
                        value={customerSearch}
                        onValueChange={setCustomerSearch}
                      />
                      <CommandList>
                        <CommandEmpty>هیچ کڕیارێک نەدۆزرایەوە</CommandEmpty>
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
                            <span className="text-muted-foreground">هەموو کریارەکان</span>
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
                    <SelectValue placeholder="هەموو" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">هەموو</SelectItem>
                    <SelectItem value="with">بە تراکینگ</SelectItem>
                    <SelectItem value="without">بێ تراکینگ</SelectItem>
                  </SelectContent>
                </Select>

                {/* Batch filter */}
                <Select value={batchFilter} onValueChange={setBatchFilter}>
                  <SelectTrigger className="w-full sm:w-44">
                    <Layers className="h-4 w-4 ms-2" />
                    <SelectValue placeholder="هەموو" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">هەموو</SelectItem>
                    <SelectItem value="none">بێ باچ</SelectItem>
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
                      لە بەرواری
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
                      تا بەرواری
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
                    <SelectValue placeholder="نوێترین" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">نوێترین</SelectItem>
                    <SelectItem value="oldest">کۆنترین</SelectItem>
                    <SelectItem value="value">بەهادارترین</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Results count + clear filters */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="text-sm text-muted-foreground">
                  {fullPackageOrders.length} ئۆردەر دۆزرایەوە
                </div>
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="text-muted-foreground h-8"
                  >
                    <X className="h-3.5 w-3.5 ms-1" />
                    پاککردنەوەی فلتەرەکان
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
                <p className="text-muted-foreground">هیچ ئۆردەرێک نییە</p>
                <Link href="/commission-orders/new">
                  <Button className="mt-4" variant="outline">
                    <Plus className="h-4 w-4 ms-2" />
                    ئۆردەری نوێ زیاد بکە
                  </Button>
                </Link>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>کۆدی ئۆردەر</TableHead>
                    <TableHead>کڕیار</TableHead>
                    <TableHead>ناوی کاڵا</TableHead>
                    <TableHead>باچ</TableHead>
                    <TableHead>کڕین</TableHead>
                    <TableHead>فرۆشتن</TableHead>
                    <TableHead>قازانج</TableHead>
                    <TableHead>تراکینگ</TableHead>
                    <TableHead>بارودۆخ</TableHead>
                    <TableHead>بەروار</TableHead>
                    <TableHead className="text-left">کردارەکان</TableHead>
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
                          <CopyButton value={order.orderCode} label="کۆپی کۆدی ئۆردەر" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <div>
                            <p className="font-medium">{(order as any).customer?.fullName || "کڕیار"}</p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {(order as any).customer?.customerCode || ""}
                            </p>
                          </div>
                          <CopyButton value={(order as any).customer?.fullName} label="کۆپی ناوی کڕیار" />
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
                              <p className="text-xs text-muted-foreground">{order.quantity} دانە</p>
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
                            <CopyButton value={(order as any).batch.batchCode} label="کۆپی کۆدی باچ" />
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                            بێ باچ
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
                              <CopyButton value={order.trackingNumber} label="کۆپی تراکینگ" />
                            </div>
                            {order.trackingAddedDate && (
                              <p className="text-xs text-muted-foreground">
                                {new Date(order.trackingAddedDate).toLocaleDateString("ku")}
                              </p>
                            )}
                          </div>
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
                            onClick={() => setLocation(`/full-package/${order.id}`)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => setLocation(`/full-package/${order.id}/edit`)}
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
