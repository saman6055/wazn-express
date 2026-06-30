import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CopyButton } from "@/components/CopyButton";
import { ZoomImage } from "@/components/ZoomImage";
import { 
  AlertTriangle, AlertCircle, XCircle, Clock, RefreshCw, Package, 
  TrendingUp, Plus, Check, AlertOctagon, BarChart3, Search, Filter,
  Calendar, ChevronRight, Eye, ExternalLink, ShoppingBag, Percent,
  Box, ArrowUpRight, ArrowDownRight, Sparkles, Download
} from "lucide-react";
import * as XLSX from 'xlsx';
import { toast } from "sonner";
import { useTranslation } from "@/contexts/LanguageContext";

interface OrderForTracking {
  id: number;
  orderCode: string;
  productName: string;
  productImage: string | null;
  orderNumber: string | null;
  orderDate: Date | null;
  daysWaiting: number;
  calculatedAlertLevel: string;
  orderType?: "full_package" | "commission" | "purchase_request";
}

// Type configuration
const ORDER_TYPES = [
  { 
    value: "all", 
    labelKu: "هەموو", 
    labelEn: "All",
    icon: Package,
    color: "slate"
  },
  { 
    value: "full_package", 
    labelKu: "پاکێجی تەواو", 
    labelEn: "Full Package",
    icon: Box,
    color: "red"
  },

  { 
    value: "commission", 
    labelKu: "کڕین بە تێچوو", 
    labelEn: "Commission",
    icon: Percent,
    color: "amber"
  },
];

// Days filter options
const DAYS_FILTERS = [
  { value: "all", labelKu: "هەموو ڕۆژەکان", labelEn: "All Days", min: 0, max: 999 },
  { value: "1-2", labelKu: "١-٢ ڕۆژ", labelEn: "1-2 Days", min: 1, max: 2 },
  { value: "3-4", labelKu: "٣-٤ ڕۆژ", labelEn: "3-4 Days", min: 3, max: 4 },
  { value: "5-6", labelKu: "٥-٦ ڕۆژ", labelEn: "5-6 Days", min: 5, max: 6 },
  { value: "7+", labelKu: "٧+ ڕۆژ (فریاکەوتن)", labelEn: "7+ Days (Critical)", min: 7, max: 999 },
];

export default function TrackingAlerts() {
  const { t, language } = useTranslation();
  const isKurdish = language === "ku" || language === "ar";
  
  // State
  const [trackingDialogOpen, setTrackingDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderForTracking | null>(null);
  const [selectedOrders, setSelectedOrders] = useState<OrderForTracking[]>([]); // Multi-select for shared tracking
  const [trackingNumbers, setTrackingNumbers] = useState<string[]>([""]);
  const [activeTab, setActiveTab] = useState("alerts");
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  
  // Filter states
  const [typeFilter, setTypeFilter] = useState("all");
  const [daysFilter, setDaysFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  
  // Data fetching
  const { data: alertStats, refetch: refetchStats } = trpc.fullPackage.getTrackingAlertStats.useQuery();
  const { data: pendingOrders, refetch: refetchOrders, isLoading } = trpc.fullPackage.getOrdersPendingTracking.useQuery();
  
  // Track how many multi-order saves remain
  const multiSaveCountRef = { current: 0, total: 0 };

  const addOrderTrackings = trpc.fullPackage.addOrderTrackings.useMutation({
    onSuccess: (result) => {
      // If multi-order mode, wait for all to complete
      if (multiSaveCountRef.current > 0) {
        multiSaveCountRef.current--;
        if (multiSaveCountRef.current === 0) {
          toast.success(isKurdish
            ? `تراکینگ بۆ ${multiSaveCountRef.total} ئۆردەر زیاد کرا`
            : `Tracking added to ${multiSaveCountRef.total} orders`);
          setTrackingDialogOpen(false);
          setSelectedOrder(null);
          setSelectedOrders([]);
          setMultiSelectMode(false);
          setTrackingNumbers([""]);
          refetchStats();
          refetchOrders();
        }
        return;
      }
      const msg = result.added === 1
        ? (isKurdish ? "تراکینگ نەمبەر زیاد کرا" : "Tracking number added")
        : (isKurdish ? `${result.added} تراکینگ زیاد کرا` : `${result.added} tracking numbers added`);
      toast.success(msg);
      if (result.duplicates.length > 0) {
        toast.warning(isKurdish ? `دووبارە یان پێشتر بەکارهاتوو: ${result.duplicates.join(", ")}` : `Duplicate/skip: ${result.duplicates.join(", ")}`);
      }
      setTrackingDialogOpen(false);
      setSelectedOrder(null);
      setTrackingNumbers([""]);
      refetchStats();
      refetchOrders();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleAddTracking = (order: OrderForTracking) => {
    setSelectedOrder(order);
    setSelectedOrders([]);
    setTrackingNumbers([""]);
    setTrackingDialogOpen(true);
  };

  // Multi-select: open dialog for all selected orders
  const handleAddTrackingToSelected = () => {
    if (selectedOrders.length === 0) return;
    setSelectedOrder(null); // Not single mode
    setTrackingNumbers([""]);
    setTrackingDialogOpen(true);
  };

  // Toggle order selection for multi-select
  const toggleOrderSelection = (order: OrderForTracking) => {
    setSelectedOrders((prev) => {
      const exists = prev.find((o) => o.id === order.id);
      if (exists) return prev.filter((o) => o.id !== order.id);
      return [...prev, order];
    });
  };

  const isOrderSelected = (id: number) => selectedOrders.some((o) => o.id === id);

  const setTrackingAt = (index: number, value: string) => {
    setTrackingNumbers((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };
  const addTrackingField = () => setTrackingNumbers((prev) => [...prev, ""]);
  const removeTrackingField = (index: number) => {
    if (trackingNumbers.length <= 1) return;
    setTrackingNumbers((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveTracking = () => {
    const list = trackingNumbers.map((s) => s.trim()).filter(Boolean);
    if (list.length === 0) {
      toast.error(isKurdish ? "هەر شتێک یەک تراکینگ نەمبەر داخڵ بکە" : "Enter at least one tracking number");
      return;
    }

    // Multi-order mode: same tracking for all selected orders
    if (!selectedOrder && selectedOrders.length > 0) {
      multiSaveCountRef.current = selectedOrders.length;
      multiSaveCountRef.total = selectedOrders.length;
      for (const order of selectedOrders) {
        addOrderTrackings.mutate({
          fullPackageOrderId: order.id,
          trackingNumbers: list,
        });
      }
      return;
    }

    // Single order mode
    if (!selectedOrder) return;
    addOrderTrackings.mutate({
      fullPackageOrderId: selectedOrder.id,
      trackingNumbers: list,
    });
  };

  // Get alert badge based on days waiting
  const getAlertBadge = (daysWaiting: number) => {
    if (daysWaiting >= 7) {
      return (
        <Badge variant="destructive" className="gap-1 bg-red-600">
          <XCircle className="h-3 w-3" />
          {isKurdish ? `فریاکەوتن (${daysWaiting} ڕۆژ)` : `Critical (${daysWaiting} days)`}
        </Badge>
      );
    }
    if (daysWaiting >= 5) {
      return (
        <Badge className="gap-1 bg-orange-500 hover:bg-orange-600">
          <AlertCircle className="h-3 w-3" />
          {isKurdish ? `گرنگ (${daysWaiting} ڕۆژ)` : `Urgent (${daysWaiting} days)`}
        </Badge>
      );
    }
    if (daysWaiting >= 3) {
      return (
        <Badge variant="secondary" className="gap-1 bg-yellow-500 text-black hover:bg-yellow-600">
          <AlertTriangle className="h-3 w-3" />
          {isKurdish ? `ئاگاداری (${daysWaiting} ڕۆژ)` : `Warning (${daysWaiting} days)`}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="gap-1 bg-blue-50 text-blue-700 border-blue-200">
        <Clock className="h-3 w-3" />
        {isKurdish ? `نوێ (${daysWaiting} ڕۆژ)` : `New (${daysWaiting} days)`}
      </Badge>
    );
  };

  // Get type badge
  const getTypeBadge = (orderType: string) => {
    const config = ORDER_TYPES.find(t => t.value === orderType);
    if (!config) return null;
    
    const colorClasses: Record<string, string> = {
      red: "bg-red-100 text-red-700 border-red-200",
      purple: "bg-purple-100 text-purple-700 border-purple-200",
      amber: "bg-amber-100 text-amber-700 border-amber-200",
    };
    
    const Icon = config.icon;
    return (
      <Badge variant="outline" className={`gap-1 ${colorClasses[config.color] || ""}`}>
        <Icon className="h-3 w-3" />
        {isKurdish ? config.labelKu : config.labelEn}
      </Badge>
    );
  };

  // Filter orders
  const filteredOrders = useMemo(() => {
    if (!pendingOrders) return [];
    
    return pendingOrders.filter((order: OrderForTracking) => {
      // Type filter
      if (typeFilter !== "all" && order.orderType !== typeFilter) return false;
      
      // Days filter
      const daysConfig = DAYS_FILTERS.find(d => d.value === daysFilter);
      if (daysConfig && daysFilter !== "all") {
        if (order.daysWaiting < daysConfig.min || order.daysWaiting > daysConfig.max) return false;
      }
      
      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchesName = order.productName?.toLowerCase().includes(search);
        const matchesCode = order.orderCode?.toLowerCase().includes(search);
        const matchesOrderNumber = order.orderNumber?.toLowerCase().includes(search);
        if (!matchesName && !matchesCode && !matchesOrderNumber) return false;
      }
      
      return true;
    });
  }, [pendingOrders, typeFilter, daysFilter, searchTerm]);

  // Group by type for stats
  const typeStats = useMemo(() => {
    if (!pendingOrders) return { full_package: 0, commission: 0 };
    
    return {
      full_package: pendingOrders.filter((o: OrderForTracking) => o.orderType === "full_package").length,
      commission: pendingOrders.filter((o: OrderForTracking) => o.orderType === "commission").length,
    };
  }, [pendingOrders]);

  // Days stats
  const daysStats = useMemo(() => {
    if (!pendingOrders) return { critical: 0, urgent: 0, warning: 0, new: 0 };
    
    return {
      critical: pendingOrders.filter((o: OrderForTracking) => o.daysWaiting >= 7).length,
      urgent: pendingOrders.filter((o: OrderForTracking) => o.daysWaiting >= 5 && o.daysWaiting < 7).length,
      warning: pendingOrders.filter((o: OrderForTracking) => o.daysWaiting >= 3 && o.daysWaiting < 5).length,
      new: pendingOrders.filter((o: OrderForTracking) => o.daysWaiting < 3).length,
    };
  }, [pendingOrders]);

  // Excel export function
  const exportToExcel = () => {
    if (!filteredOrders.length) return;
    
    const data = filteredOrders.map((order: OrderForTracking) => ({
      'کۆدی ئۆردەر': order.orderCode,
      'ناوی بەرهەم': order.productName,
      'ژمارەی ئۆردەر': order.orderNumber || '-',
      'ژمارەی ڕۆژ': order.daysWaiting,
      'جۆر': order.orderType === 'full_package' ? 'پاکێجی تەواو' : 'کۆمیشن',
      'ئاستی ئاگاداری': order.daysWaiting >= 7 ? 'فریاکەوتن' : order.daysWaiting >= 5 ? 'گرنگ' : order.daysWaiting >= 3 ? 'ئاگاداری' : 'نوێ',
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ئاگادارکردنەوەی تراکینگ');
    XLSX.writeFile(wb, `tracking-alerts-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
        {/* Professional Header */}
        <div className="bg-gradient-to-r from-red-600 via-rose-600 to-orange-600 text-white relative overflow-hidden">
          <div className="absolute inset-0 opacity-20" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }} />
          
          <div className="container py-8 relative">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-white/20 backdrop-blur-sm rounded-2xl shadow-lg">
                  <AlertCircle className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold">
                    {isKurdish ? "ئاگادارکردنەوەی تراکینگ" : "Tracking Alerts"}
                  </h1>
                  <p className="text-red-100 mt-1">
                    {isKurdish 
                      ? `پاکەتەکان بێ تراکینگ نەمبەر - ${pendingOrders?.length || 0} پاکەت`
                      : `Packages without tracking - ${pendingOrders?.length || 0} packages`
                    }
                  </p>
                </div>
              </div>
              
              {/* Stats Summary */}
              <div className="flex items-center gap-4">
                <Button
                  onClick={exportToExcel}
                  variant="outline"
                  className="bg-white/20 border-white/30 text-white hover:bg-white/30"
                >
                  <Download className="h-4 w-4 ms-2" />
                  Excel
                </Button>
                <div className="flex items-center gap-6 bg-white/10 backdrop-blur-sm rounded-2xl px-6 py-4">
                  <div className="text-center">
                    <p className="text-red-200 text-sm">{isKurdish ? "کۆی گشتی" : "Total"}</p>
                    <p className="text-3xl font-bold">{pendingOrders?.length || 0}</p>
                  </div>
                  <div className="h-12 w-px bg-white/20" />
                  <div className="text-center">
                    <p className="text-red-200 text-sm">{isKurdish ? "فریاکەوتن" : "Critical"}</p>
                    <p className="text-3xl font-bold text-yellow-300">{daysStats.critical}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="container py-8">
          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="alerts" className="gap-2">
                <AlertCircle className="h-4 w-4" />
                {isKurdish ? "ئاگادارکردنەوەکان" : "Alerts"}
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-2">
                <TrendingUp className="h-4 w-4" />
                {isKurdish ? "رابردوو" : "History"}
              </TabsTrigger>
            </TabsList>

            {/* Alerts Tab */}
            <TabsContent value="alerts" className="space-y-6">
              {/* Type Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Full Package */}
                <Card 
                  className={`cursor-pointer transition-all duration-300 hover:shadow-lg border-2 ${
                    typeFilter === "full_package" 
                      ? "border-red-500 bg-red-50" 
                      : "border-red-200 hover:border-red-300"
                  }`}
                  onClick={() => setTypeFilter(typeFilter === "full_package" ? "all" : "full_package")}
                >
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-lg">
                        <Box className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-red-600">
                          {isKurdish ? "پاکێجی تەواو" : "Full Package"}
                        </p>
                        <p className="text-3xl font-bold text-red-700">{typeStats.full_package}</p>
                      </div>
                      {typeFilter === "full_package" && (
                        <Check className="h-5 w-5 text-red-600" />
                      )}
                    </div>
                  </CardContent>
                </Card>
                
                
                {/* Commission */}
                <Card 
                  className={`cursor-pointer transition-all duration-300 hover:shadow-lg border-2 ${
                    typeFilter === "commission" 
                      ? "border-amber-500 bg-amber-50" 
                      : "border-amber-200 hover:border-amber-300"
                  }`}
                  onClick={() => setTypeFilter(typeFilter === "commission" ? "all" : "commission")}
                >
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl shadow-lg">
                        <Percent className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-amber-600">
                          {isKurdish ? "کڕین بە تێچوو" : "Commission"}
                        </p>
                        <p className="text-3xl font-bold text-amber-700">{typeStats.commission}</p>
                      </div>
                      {typeFilter === "commission" && (
                        <Check className="h-5 w-5 text-amber-600" />
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Filters & Search */}
              <Card className="border-0 shadow-lg">
                <CardHeader className="border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-slate-600 to-slate-700 rounded-lg">
                      <Filter className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">
                        {isKurdish ? "فلتەر و گەڕان" : "Filter & Search"}
                      </CardTitle>
                      <CardDescription>
                        {isKurdish 
                          ? `${filteredOrders.length} ئەنجام لە ${pendingOrders?.length || 0}`
                          : `${filteredOrders.length} results from ${pendingOrders?.length || 0}`
                        }
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Search */}
                    <div className="md:col-span-1">
                      <Label className="text-sm font-medium mb-2 block">
                        {isKurdish ? "گەڕان" : "Search"}
                      </Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          placeholder={isKurdish ? "ناوی ئایتم یان ئۆردەر نەمبەر..." : "Item name or order number..."}
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>
                    
                    {/* Type Filter */}
                    <div>
                      <Label className="text-sm font-medium mb-2 block">
                        {isKurdish ? "جۆر" : "Type"}
                      </Label>
                      <Select value={typeFilter} onValueChange={setTypeFilter}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ORDER_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              <div className="flex items-center gap-2">
                                <type.icon className="h-4 w-4" />
                                {isKurdish ? type.labelKu : type.labelEn}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Days Filter */}
                    <div>
                      <Label className="text-sm font-medium mb-2 block">
                        {isKurdish ? "ژمارەی ڕۆژ" : "Days Waiting"}
                      </Label>
                      <Select value={daysFilter} onValueChange={setDaysFilter}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DAYS_FILTERS.map((filter) => (
                            <SelectItem key={filter.value} value={filter.value}>
                              {isKurdish ? filter.labelKu : filter.labelEn}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  {/* Quick Days Filters */}
                  <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-100">
                    <Button
                      size="sm"
                      variant={daysStats.critical > 0 && daysFilter === "7+" ? "default" : "outline"}
                      onClick={() => setDaysFilter(daysFilter === "7+" ? "all" : "7+")}
                      className={`gap-1 ${daysStats.critical > 0 ? "border-red-300 text-red-700 hover:bg-red-50" : ""}`}
                      disabled={daysStats.critical === 0}
                    >
                      <XCircle className="h-3 w-3" />
                      {isKurdish ? "فریاکەوتن" : "Critical"} ({daysStats.critical})
                    </Button>
                    <Button
                      size="sm"
                      variant={daysStats.urgent > 0 && daysFilter === "5-6" ? "default" : "outline"}
                      onClick={() => setDaysFilter(daysFilter === "5-6" ? "all" : "5-6")}
                      className={`gap-1 ${daysStats.urgent > 0 ? "border-orange-300 text-orange-700 hover:bg-orange-50" : ""}`}
                      disabled={daysStats.urgent === 0}
                    >
                      <AlertCircle className="h-3 w-3" />
                      {isKurdish ? "گرنگ" : "Urgent"} ({daysStats.urgent})
                    </Button>
                    <Button
                      size="sm"
                      variant={daysStats.warning > 0 && daysFilter === "3-4" ? "default" : "outline"}
                      onClick={() => setDaysFilter(daysFilter === "3-4" ? "all" : "3-4")}
                      className={`gap-1 ${daysStats.warning > 0 ? "border-yellow-400 text-yellow-700 hover:bg-yellow-50" : ""}`}
                      disabled={daysStats.warning === 0}
                    >
                      <AlertTriangle className="h-3 w-3" />
                      {isKurdish ? "ئاگاداری" : "Warning"} ({daysStats.warning})
                    </Button>
                    <Button
                      size="sm"
                      variant={daysStats.new > 0 && daysFilter === "1-2" ? "default" : "outline"}
                      onClick={() => setDaysFilter(daysFilter === "1-2" ? "all" : "1-2")}
                      className={`gap-1 ${daysStats.new > 0 ? "border-blue-300 text-blue-700 hover:bg-blue-50" : ""}`}
                      disabled={daysStats.new === 0}
                    >
                      <Clock className="h-3 w-3" />
                      {isKurdish ? "نوێ" : "New"} ({daysStats.new})
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Results Table */}
              <Card className="border-0 shadow-xl">
                <CardHeader className="border-b border-slate-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-br from-red-500 to-orange-500 rounded-lg">
                        <AlertTriangle className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">
                          {isKurdish ? "لیستی پاکەتەکان" : "Package List"}
                        </CardTitle>
                        <CardDescription>
                          {isKurdish 
                            ? `${filteredOrders.length} پاکەت بێ تراکینگ نەمبەر`
                            : `${filteredOrders.length} packages without tracking`
                          }
                        </CardDescription>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => { refetchOrders(); refetchStats(); }}
                      className="gap-2"
                    >
                      <RefreshCw className="h-4 w-4" />
                      {isKurdish ? "نوێکردنەوە" : "Refresh"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {isLoading ? (
                    <div className="p-8 text-center">
                      <RefreshCw className="h-8 w-8 mx-auto animate-spin text-slate-400" />
                      <p className="mt-2 text-slate-500">
                        {isKurdish ? "چاوەڕوان بە..." : "Loading..."}
                      </p>
                    </div>
                  ) : filteredOrders.length === 0 ? (
                    <div className="p-12 text-center">
                      <div className="inline-flex p-4 bg-green-100 rounded-full mb-4">
                        <Check className="h-8 w-8 text-green-600" />
                      </div>
                      <p className="text-xl font-bold text-green-700">
                        {isKurdish ? "هیچ ئەنجامێک نییە" : "No results found"}
                      </p>
                      <p className="text-sm text-slate-500 mt-2">
                        {searchTerm || typeFilter !== "all" || daysFilter !== "all"
                          ? (isKurdish ? "فلتەرەکان بگۆڕە" : "Try changing filters")
                          : (isKurdish ? "تەمامی پاکەتەکان تراکینگ نەمبەری تێدایە" : "All packages have tracking numbers")
                        }
                      </p>
                    </div>
                  ) : (
                    <Table pageSticky>
                      {/* Multi-select toolbar */}
                      {selectedOrders.length > 0 && (
                        <div className="mb-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between gap-3">
                          <span className="text-sm font-medium text-emerald-800">
                            {isKurdish
                              ? `${selectedOrders.length} ئۆردەر هەڵبژاردراوە — یەک تراک بۆ هەمووی`
                              : `${selectedOrders.length} orders selected — assign same tracking to all`}
                          </span>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => { setSelectedOrders([]); setMultiSelectMode(false); }}>
                              {isKurdish ? "هەڵوەشاندنەوە" : "Cancel"}
                            </Button>
                            <Button size="sm" onClick={handleAddTrackingToSelected} className="gap-1 bg-gradient-to-r from-emerald-500 to-teal-500">
                              <Plus className="h-4 w-4" />
                              {isKurdish ? "تراک زیاد بکە" : "Add Tracking"}
                            </Button>
                          </div>
                        </div>
                      )}
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead className="w-10">
                            <input
                              type="checkbox"
                              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                              checked={filteredOrders.length > 0 && selectedOrders.length === filteredOrders.length}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedOrders(filteredOrders);
                                  setMultiSelectMode(true);
                                } else {
                                  setSelectedOrders([]);
                                  setMultiSelectMode(false);
                                }
                              }}
                            />
                          </TableHead>
                          <TableHead className="w-12">#</TableHead>
                          <TableHead>{isKurdish ? "وێنە" : "Image"}</TableHead>
                          <TableHead>{isKurdish ? "کۆد" : "Code"}</TableHead>
                          <TableHead>{isKurdish ? "ناوی ئایتم" : "Item Name"}</TableHead>
                          <TableHead>{isKurdish ? "جۆر" : "Type"}</TableHead>
                          <TableHead>{isKurdish ? "بەروار" : "Date"}</TableHead>
                          <TableHead>{isKurdish ? "چاوەڕوانی" : "Waiting"}</TableHead>
                          <TableHead className="text-center">{isKurdish ? "کردار" : "Action"}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredOrders.map((order: OrderForTracking, index: number) => (
                          <TableRow
                            key={`${order.orderType}-${order.id}`}
                            className={`transition-colors hover:bg-blue-50/60 dark:hover:bg-blue-950/30 hover:ring-2 hover:ring-inset hover:ring-blue-400/50 ${
                              order.daysWaiting >= 7 ? "bg-red-50/50" :
                              order.daysWaiting >= 5 ? "bg-orange-50/50" :
                              order.daysWaiting >= 3 ? "bg-yellow-50/50" : ""
                            }`}
                          >
                            <TableCell>
                              <input
                                type="checkbox"
                                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                checked={isOrderSelected(order.id)}
                                onChange={() => { toggleOrderSelection(order); setMultiSelectMode(true); }}
                              />
                            </TableCell>
                            <TableCell className="font-medium text-slate-500">
                              {index + 1}
                            </TableCell>
                            <TableCell>
                              {order.productImage ? (
                                <ZoomImage
                                  src={order.productImage}
                                  alt={order.productName}
                                  className="w-12 h-12 border border-slate-200"
                                />
                              ) : (
                                <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center">
                                  <Package className="h-5 w-5 text-slate-400" />
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <p className="font-mono text-sm font-medium">{order.orderCode}</p>
                                <CopyButton value={order.orderCode} label="کۆپی کۆدی ئۆردەر" />
                              </div>
                              {order.orderNumber && (
                                <div className="flex items-center gap-1">
                                  <p className="text-xs text-slate-500 mt-0.5">#{order.orderNumber}</p>
                                  <CopyButton value={order.orderNumber} label="کۆپی ئۆردەر نەمبەر" />
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <p className="font-medium text-sm truncate max-w-[200px]">
                                {order.productName}
                              </p>
                            </TableCell>
                            <TableCell>
                              {getTypeBadge(order.orderType || "")}
                            </TableCell>
                            <TableCell className="text-sm text-slate-600">
                              {order.orderDate 
                                ? new Date(order.orderDate).toLocaleDateString(isKurdish ? "ku" : "en")
                                : "-"
                              }
                            </TableCell>
                            <TableCell>
                              {getAlertBadge(order.daysWaiting)}
                            </TableCell>
                            <TableCell className="text-center">
                              <Button
                                size="sm"
                                onClick={() => handleAddTracking(order)}
                                className="gap-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
                              >
                                <Plus className="h-4 w-4" />
                                {isKurdish ? "زیادکردن" : "Add"}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="history" className="space-y-6">
              <Card className="border-0 shadow-xl">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg">
                      <BarChart3 className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle>{isKurdish ? "مێژووی تراکینگ" : "Tracking History"}</CardTitle>
                      <CardDescription>
                        {isKurdish ? "ئاماری تراکینگە زیادکراوەکان" : "Statistics of added tracking numbers"}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12 text-slate-500">
                    <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>{isKurdish ? "بەزووی دێت..." : "Coming soon..."}</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Add Tracking Dialog - multiple trackings per order */}
        <Dialog open={trackingDialogOpen} onOpenChange={setTrackingDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-emerald-600" />
                {isKurdish ? "زیادکردنی تراکینگ نەمبەر" : "Add Tracking Number(s)"}
              </DialogTitle>
              <DialogDescription>
                {selectedOrder && (
                  <span className="font-medium">{selectedOrder.orderCode} - {selectedOrder.productName}</span>
                )}
                {!selectedOrder && selectedOrders.length > 0 && (
                  <div className="space-y-1 mt-1">
                    <span className="block text-emerald-700 font-semibold text-sm">
                      {isKurdish
                        ? `🔗 یەک تراک بۆ ${selectedOrders.length} ئۆردەر (هەمان کارتۆن)`
                        : `🔗 Same tracking for ${selectedOrders.length} orders (same carton)`}
                    </span>
                    {selectedOrders.map((o) => (
                      <span key={o.id} className="block text-xs text-muted-foreground">
                        • {o.orderCode} — {o.productName}
                      </span>
                    ))}
                  </div>
                )}
                <span className="block mt-1 text-muted-foreground text-xs">
                  {!selectedOrder && selectedOrders.length > 0
                    ? (isKurdish ? "ئەم تراکینگە بۆ هەموو ئۆردەرە هەڵبژاردراوەکان زیاد دەکرێت" : "This tracking will be added to all selected orders")
                    : (isKurdish ? "دەتوانیت چەند تراکینگ زیاد بکەیت (وەک کارتۆنە جیاکان)" : "You can add multiple trackings (e.g. different cartons)")
                  }
                </span>
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {trackingNumbers.map((value, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <div className="flex-1 space-y-1">
                    <Label className="sr-only">
                      {isKurdish ? `تراکینگ ${index + 1}` : `Tracking ${index + 1}`}
                    </Label>
                    <Input
                      value={value}
                      onChange={(e) => setTrackingAt(index, e.target.value)}
                      placeholder={isKurdish ? `تراکینگ نەمبەر ${index + 1}...` : `Tracking number ${index + 1}...`}
                      className="font-mono"
                    />
                  </div>
                  {trackingNumbers.length > 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeTrackingField(index)}
                      title={isKurdish ? "سڕینەوە" : "Remove"}
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full gap-2 border-dashed"
                onClick={addTrackingField}
              >
                <Plus className="h-4 w-4" />
                {isKurdish ? "تراکینگ زیاد بکە" : "Add another tracking"}
              </Button>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTrackingDialogOpen(false)}>
                {isKurdish ? "پاشگەزبوونەوە" : "Cancel"}
              </Button>
              <Button 
                onClick={handleSaveTracking}
                disabled={!trackingNumbers.some((s) => s.trim()) || addOrderTrackings.isPending}
                className="gap-2 bg-gradient-to-r from-emerald-500 to-teal-500"
              >
                {addOrderTrackings.isPending ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                {isKurdish ? "پاشەکەوتکردن" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
