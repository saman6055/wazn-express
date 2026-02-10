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


  const { data: orders, isLoading, refetch } = trpc.fullPackage.list.useQuery({
    orderType: "commission",
    search: search || undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
  });

  const { data: batches } = trpc.batches.list.useQuery();

  const updateStatusMutation = trpc.fullPackage.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("بارودۆخ نوێکرایەوە");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });



  // Calculate stats for commission orders only
  const fullPackageOrders = orders?.filter(o => o.orderType === "commission") || [];
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
                <h1 className="text-2xl font-bold">کڕین بە عمولە</h1>
                <p className="text-emerald-100">کڕین بۆ کڕیار بە عمولە</p>
              </div>
            </div>
            <Link href="/commission-orders/new">
              <Button className="bg-white text-emerald-700 hover:bg-emerald-50">
                <Plus className="h-4 w-4 ml-2" />
                پەتی نوێ
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
                  <p className="text-sm text-emerald-600 font-medium">کۆی پەتەکان</p>
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
              </div>

              {/* Results count */}
              <div className="text-sm text-muted-foreground">
                {fullPackageOrders.length} پەت دۆزرایەوە
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
                <p className="text-muted-foreground">هیچ پەتێک نییە</p>
                <Link href="/commission-orders/new">
                  <Button className="mt-4" variant="outline">
                    <Plus className="h-4 w-4 ml-2" />
                    پەتی نوێ زیاد بکە
                  </Button>
                </Link>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>کۆدی پەت</TableHead>
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
                    <TableRow key={order.id}>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-emerald-600 border-emerald-300">
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
                      <TableCell className="font-mono">${order.purchasePriceUsd || "0.00"}</TableCell>
                      <TableCell className="font-mono text-emerald-600">${order.sellingPriceUsd || "0.00"}</TableCell>
                      <TableCell className="font-mono font-bold text-green-600">
                        ${order.profitUsd || "0.00"}
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
