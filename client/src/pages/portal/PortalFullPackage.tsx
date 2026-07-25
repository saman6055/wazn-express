import { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import { CustomerPortalLayout } from "@/components/CustomerPortalLayout";
import { WhatsAppHelpButton } from "@/components/portal/WhatsAppHelpButton";
import { TERMS_WHATSAPP_NUMBER } from "@/constants/portalTerms";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { pickLang } from "@/lib/lang";
import { Link, useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  ShoppingBag, Package, Clock, CheckCircle, Truck, AlertCircle,
  Plus, ChevronRight, DollarSign, Calendar, Phone,
  MessageCircle, Search, Eye, X, MapPin, CreditCard,
  ArrowUpRight, Sparkles, TrendingUp, Box, Plane, Home,
  FileText, Wallet, ShoppingCart, Star, Filter, XCircle,
  Loader2, Check, AlertTriangle, Gift, Zap, ThumbsUp, ThumbsDown,
  Image as ImageIcon, ExternalLink, Hash, SlidersHorizontal, ArrowUpDown, Copy, HelpCircle
} from "lucide-react";

// Status configuration with beautiful colors
const statusConfig: Record<string, { label: string; labelKu: string; labelAr: string; labelZh: string; color: string; bgColor: string; borderColor: string; icon: any; gradient: string }> = {
  pending: {
    label: "Pending",
    labelKu: "چاوەڕوان",
    labelAr: "قيد الانتظار",
    labelZh: "待处理",
    color: "text-amber-700", 
    bgColor: "bg-amber-100", 
    borderColor: "border-amber-200",
    icon: Clock,
    gradient: "from-amber-400 to-orange-500"
  },
  ordered: { 
    label: "Ordered",
    labelKu: "داواکراو",
    labelAr: "تم الطلب",
    labelZh: "已下单",
    color: "text-blue-700", 
    bgColor: "bg-blue-100", 
    borderColor: "border-blue-200",
    icon: ShoppingCart,
    gradient: "from-blue-400 to-blue-600"
  },
  tracking_added: { 
    label: "Tracking Added",
    labelKu: "تراکینگ زیادکرا",
    labelAr: "تمت إضافة التتبع",
    labelZh: "已添加物流单号",
    color: "text-indigo-700", 
    bgColor: "bg-indigo-100", 
    borderColor: "border-indigo-200",
    icon: FileText,
    gradient: "from-indigo-400 to-indigo-600"
  },
  in_china_warehouse: { 
    label: "In China",
    labelKu: "لە چین",
    labelAr: "في الصين",
    labelZh: "在中国仓库",
    color: "text-purple-700", 
    bgColor: "bg-purple-100", 
    borderColor: "border-purple-200",
    icon: Box,
    gradient: "from-purple-400 to-purple-600"
  },
  in_batch: { 
    label: "In Batch",
    labelKu: "لە باچ",
    labelAr: "في الدفعة",
    labelZh: "已组批",
    color: "text-cyan-700", 
    bgColor: "bg-cyan-100", 
    borderColor: "border-cyan-200",
    icon: Package,
    gradient: "from-cyan-400 to-cyan-600"
  },
  in_transit: { 
    label: "In Transit",
    labelKu: "لە ڕێگادایە",
    labelAr: "في الطريق",
    labelZh: "运输中",
    color: "text-orange-700", 
    bgColor: "bg-orange-100", 
    borderColor: "border-orange-200",
    icon: Plane,
    gradient: "from-orange-400 to-orange-600"
  },
  delivered: { 
    label: "Delivered",
    labelKu: "گەیەندراوە",
    labelAr: "تم التسليم",
    labelZh: "已送达",
    color: "text-emerald-700", 
    bgColor: "bg-emerald-100", 
    borderColor: "border-emerald-200",
    icon: CheckCircle,
    gradient: "from-emerald-400 to-emerald-600"
  },
  cancelled: { 
    label: "Cancelled",
    labelKu: "هەڵوەشاوەتەوە",
    labelAr: "ملغى",
    labelZh: "已取消",
    color: "text-red-700", 
    bgColor: "bg-red-100", 
    borderColor: "border-red-200",
    icon: AlertCircle,
    gradient: "from-red-400 to-red-600"
  },
  completed: { 
    label: "Completed",
    labelKu: "تەواوبوو",
    labelAr: "مكتمل",
    labelZh: "已完成",
    color: "text-emerald-700", 
    bgColor: "bg-emerald-100", 
    borderColor: "border-emerald-200",
    icon: CheckCircle,
    gradient: "from-emerald-400 to-emerald-600"
  },
  arrived: { 
    label: "Arrived",
    labelKu: "گەیشت",
    labelAr: "وصلت",
    labelZh: "已到达",
    color: "text-emerald-700", 
    bgColor: "bg-emerald-100", 
    borderColor: "border-emerald-200",
    icon: CheckCircle,
    gradient: "from-emerald-400 to-emerald-600"
  },
  purchasing: { 
    label: "Purchasing",
    labelKu: "لە کڕیندایە",
    labelAr: "جاري الشراء",
    labelZh: "采购中",
    color: "text-blue-700", 
    bgColor: "bg-blue-100", 
    borderColor: "border-blue-200",
    icon: ShoppingCart,
    gradient: "from-blue-400 to-blue-600"
  },
  purchased: { 
    label: "Purchased",
    labelKu: "کڕدرا",
    labelAr: "تم الشراء",
    labelZh: "已采购",
    color: "text-indigo-700", 
    bgColor: "bg-indigo-100", 
    borderColor: "border-indigo-200",
    icon: Package,
    gradient: "from-indigo-400 to-indigo-600"
  },
};

// Order type configuration
const orderTypeConfig: Record<string, { label: string; labelKu: string; labelAr: string; labelZh: string; color: string; bgColor: string; textColor: string; icon: any }> = {
  full_package: {
    label: "Full Package",
    labelKu: "پاکێجی تەواو",
    labelAr: "الباقة الكاملة",
    labelZh: "全包套餐",
    color: "bg-emerald-500", 
    bgColor: "bg-emerald-50",
    textColor: "text-emerald-700",
    icon: Package
  },
  commission: { 
    label: "Commission",
    labelKu: "عمولە",
    labelAr: "عمولة",
    labelZh: "代购佣金",
    color: "bg-amber-500", 
    bgColor: "bg-amber-50",
    textColor: "text-amber-700",
    icon: DollarSign
  },
};

export default function PortalFullPackage() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [activeTab, setActiveTab] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "price_high" | "price_low">("newest");
  const [showFilters, setShowFilters] = useState(false);
  
  // Fetch full package orders for this customer (using customer portal endpoint)
  const { data: fullPackageOrders, isLoading } = trpc.customerPortal.getMyFullPackageOrders.useQuery({
    orderType: activeTab === "all" ? undefined : activeTab as "full_package" | "commission",
  });

  // Full-package orders can't be self-created in the portal — staff place them
  // on the customer's behalf. So "New Order" opens WhatsApp with a pre-filled
  // request that already says WHO is asking (name + code) and WHAT for.
  const { data: account } = trpc.customerPortal.getMyAccount.useQuery(undefined, {
    staleTime: 5 * 60_000,
    retry: false,
  });
  const requestNewOrder = () => {
    const who = account?.fullName || account?.customerCode
      ? `${pickLang(language, { ku: "کڕیار", en: "Customer", ar: "العميل", zh: "客户" })}: ${account?.fullName ?? ""}${account?.customerCode ? ` (${account.customerCode})` : ""}`.trim()
      : null;
    const message = [
      pickLang(language, {
        ku: "سڵاو، دەمەوێت داواکاری نوێی پاکێجی تەواو تۆمار بکەم",
        en: "Hello, I'd like to place a new full-package order",
        ar: "مرحباً، أود تقديم طلب طرد كامل جديد",
        zh: "您好，我想下一个新的全包裹订单",
      }),
      who,
    ].filter(Boolean).join("\n");
    window.open(
      `https://wa.me/${TERMS_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };
  
  // Combine and filter orders
  const allOrders = [
    ...(fullPackageOrders || []).map(o => ({ ...o, source: 'full_package' as const })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  
  // Active filter count for badge
  const activeFilterCount = (statusFilter !== "all" ? 1 : 0) + (sortBy !== "newest" ? 1 : 0);

  // Filter by tab, status, search, then sort
  const filteredOrders = allOrders.filter(order => {
    if (activeTab === "all") return true;
    if (activeTab === "full_package") return order.orderType === "full_package";
    if (activeTab === "commission") return order.orderType === "commission";
    return true;
  }).filter(order => {
    if (statusFilter === "all") return true;
    if (statusFilter === "pending") return ["pending", "purchasing", "purchased", "ordered"].includes(order.status);
    if (statusFilter === "in_transit") return ["tracking_added", "in_china_warehouse", "in_batch", "in_transit"].includes(order.status);
    if (statusFilter === "delivered") return ["delivered", "completed", "arrived"].includes(order.status);
    if (statusFilter === "cancelled") return order.status === "cancelled";
    return true;
  }).filter(order => {
    if (!searchQuery) return true;
    return order.productName?.toLowerCase().includes(searchQuery.toLowerCase());
  }).sort((a, b) => {
    if (sortBy === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (sortBy === "price_high") {
      const pa = parseFloat(a.totalPrepaidUsd || a.sellingPriceUsd || "0");
      const pb = parseFloat(b.totalPrepaidUsd || b.sellingPriceUsd || "0");
      return pb - pa;
    }
    if (sortBy === "price_low") {
      const pa = parseFloat(a.totalPrepaidUsd || a.sellingPriceUsd || "0");
      const pb = parseFloat(b.totalPrepaidUsd || b.sellingPriceUsd || "0");
      return pa - pb;
    }
    // default: newest
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  
  // Calculate stats
  const stats = {
    total: allOrders.length,
    pending: allOrders.filter(o => ["pending", "ordered", "purchasing", "tracking_added", "in_china_warehouse", "in_batch", "in_transit"].includes(o.status)).length,
    delivered: allOrders.filter(o => ["delivered", "completed", "arrived"].includes(o.status)).length,
  };
  
  const getStatusInfo = (status: string) => {
    return statusConfig[status] || {
      label: status,
      labelKu: status,
      labelAr: status,
      labelZh: status,
      color: "text-gray-600",
      bgColor: "bg-gray-100", 
      borderColor: "border-gray-200",
      icon: Package,
      gradient: "from-gray-400 to-gray-600"
    };
  };
  
  const getOrderTypeInfo = (orderType: string) => {
    return orderTypeConfig[orderType] || orderTypeConfig.full_package;
  };
  
  const openOrderDetail = (order: any) => {
    setSelectedOrder(order);
    setShowDetailDialog(true);
  };

  // Deep-link support: /portal/full-package?order=<id> auto-opens that order's
  // detail dialog (used when tapping a fee in the financial/transactions page).
  const searchString = useSearch();
  const deepLinkOrderId = new URLSearchParams(searchString).get("order");
  useEffect(() => {
    if (!deepLinkOrderId || !fullPackageOrders?.length) return;
    const match = fullPackageOrders.find((o: any) => String(o.id) === deepLinkOrderId);
    if (match) openOrderDetail(match);
    // Only react to the initial deep-link + data arrival, not to later re-opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkOrderId, fullPackageOrders]);
  
  const formatPrice = (price: string | number | null | undefined) => {
    if (!price) return "$0";
    const num = typeof price === 'string' ? parseFloat(price) : price;
    return `$${num.toFixed(2)}`;
  };

  return (
    <CustomerPortalLayout>
      {/* Beautiful Gradient Header */}
      <div className="relative overflow-hidden">
        {/* Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700" />
        
        {/* Decorative Circles */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-400/20 rounded-full translate-y-1/2 -translate-x-1/2 blur-2xl" />
        <div className="absolute top-1/2 left-1/2 w-32 h-32 bg-indigo-400/20 rounded-full -translate-x-1/2 -translate-y-1/2 blur-xl" />
        
        {/* Content */}
        <div className="relative px-5 pt-12 pb-8">
          {/* Title Row */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/20 shadow-lg">
                <ShoppingBag className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">
                  {pickLang(language, { ku: "ئۆردەرەکانم", en: "My Orders", ar: "طلباتي", zh: "我的订单" })}
                </h1>
                <div className="flex items-center gap-2">
                  <p className="text-white/70 text-sm">
                    {pickLang(language, { ku: "بەڕێوەبردنی ئۆردەرەکانت", en: "Manage your orders", ar: "إدارة طلباتك", zh: "管理您的订单" })}
                  </p>
                  <Link href="/portal/guide#orders">
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-medium text-white/90 hover:bg-white/25 transition cursor-pointer">
                      <HelpCircle className="w-3 h-3" />
                      {pickLang(language, { ku: "ئەمە چییە؟", en: "What's this?", ar: "ما هذا؟", zh: "这是什么？" })}
                    </span>
                  </Link>
                </div>
              </div>
            </div>
            <Button
              size="sm"
              onClick={requestNewOrder}
              className="bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm rounded-xl shadow-lg transition-all hover:scale-105"
            >
              <Plus className="w-4 h-4 ms-1" />
{pickLang(language, { ku: "داواکاری نوێ", en: "New Order", ar: "طلب جديد", zh: "新订单" })}
            </Button>
          </div>
          
          {/* Stats Cards */}
          <div className="grid grid-cols-3 gap-3">
            {/* Total */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500/40 to-purple-600/40 backdrop-blur-sm border border-white/20 p-4">
              <div className="absolute top-2 right-2">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <Package className="w-5 h-5 text-white" />
                </div>
              </div>
              <div className="pt-6">
                <p className="text-4xl font-bold text-white">{stats.total}</p>
                <p className="text-white/70 text-sm mt-1">{pickLang(language, { ku: "کۆی گشتی", en: "Total", ar: "الإجمالي", zh: "总计" })}</p>
              </div>
            </div>
            
            {/* Pending */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500/40 to-orange-600/40 backdrop-blur-sm border border-amber-400/30 p-4">
              <div className="absolute top-2 right-2">
                <div className="w-10 h-10 rounded-xl bg-amber-400/30 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-amber-200" />
                </div>
              </div>
              <div className="pt-6">
                <p className="text-4xl font-bold text-amber-100">{stats.pending}</p>
                <p className="text-amber-200/70 text-sm mt-1">{pickLang(language, { ku: "چاوەڕوان", en: "Pending", ar: "قيد الانتظار", zh: "待处理" })}</p>
              </div>
            </div>
            
            {/* Delivered */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500/40 to-teal-600/40 backdrop-blur-sm border border-emerald-400/30 p-4">
              <div className="absolute top-2 right-2">
                <div className="w-10 h-10 rounded-xl bg-emerald-400/30 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-emerald-200" />
                </div>
              </div>
              <div className="pt-6">
                <p className="text-4xl font-bold text-emerald-100">{stats.delivered}</p>
                <p className="text-emerald-200/70 text-sm mt-1">{pickLang(language, { ku: "گەیەندراو", en: "Delivered", ar: "تم التسليم", zh: "已送达" })}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Content Area */}
      <div className={cn(
        "px-4 py-6 min-h-screen",
        isDark ? "bg-slate-900" : "bg-gray-50"
      )}>
        {/* Tab Filters */}
        <div className={cn(
          "flex gap-2 p-1.5 rounded-2xl mb-5",
          isDark ? "bg-slate-800" : "bg-white shadow-sm"
        )}>
          <button
            onClick={() => setActiveTab("all")}
            className={cn(
              "flex-1 py-3 px-4 rounded-xl text-sm font-semibold transition-all",
              activeTab === "all"
                ? "bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg"
                : isDark ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-900"
            )}
          >
{pickLang(language, { ku: "هەموو", en: "All", ar: "الكل", zh: "全部" })}
          </button>
          <button
            onClick={() => setActiveTab("full_package")}
            className={cn(
              "flex-1 py-3 px-4 rounded-xl text-sm font-semibold transition-all",
              activeTab === "full_package"
                ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg"
                : isDark ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-900"
            )}
          >
{pickLang(language, { ku: "پاکێجی تەواو", en: "Full Package", ar: "الباقة الكاملة", zh: "全包套餐" })}
          </button>
          <button
            onClick={() => setActiveTab("commission")}
            className={cn(
              "flex-1 py-3 px-4 rounded-xl text-sm font-semibold transition-all",
              activeTab === "commission"
                ? "bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg"
                : isDark ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-900"
            )}
          >
{pickLang(language, { ku: "عمولە", en: "Commission", ar: "عمولة", zh: "代购佣金" })}
          </button>
        </div>
        
        {/* Search Bar + Filter Toggle */}
        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1">
            <Search className={cn(
              "absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5",
              isDark ? "text-slate-500" : "text-slate-400"
            )} />
            <input
              type="text"
              placeholder={pickLang(language, { ku: "گەڕان بە ناوی کاڵا...", en: "Search by product name...", ar: "البحث باسم المنتج...", zh: "按产品名称搜索..." })}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                "w-full pr-12 pl-4 py-4 rounded-2xl border-2 transition-all text-right",
                isDark
                  ? "bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-purple-500"
                  : "bg-white border-slate-200 focus:border-purple-500 shadow-sm"
              )}
            />
          </div>
          <button
            onClick={() => setShowFilters(v => !v)}
            className={cn(
              "relative flex items-center justify-center w-14 h-14 rounded-2xl border-2 transition-all shrink-0",
              showFilters
                ? "bg-gradient-to-r from-violet-500 to-purple-600 border-purple-500 text-white shadow-lg"
                : isDark
                  ? "bg-slate-800 border-slate-700 text-slate-400 hover:border-purple-500"
                  : "bg-white border-slate-200 text-slate-500 hover:border-purple-500 shadow-sm"
            )}
          >
            <SlidersHorizontal className="w-5 h-5" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center shadow">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Advanced Filter Panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden mb-4"
            >
              <div className={cn(
                "p-4 rounded-2xl space-y-4",
                isDark ? "bg-slate-800 border border-slate-700" : "bg-white border border-slate-200 shadow-sm"
              )}>
                {/* Status Filter */}
                <div>
                  <p className={cn(
                    "text-xs font-semibold mb-2.5 flex items-center gap-1.5",
                    isDark ? "text-slate-400" : "text-slate-500"
                  )}>
                    <Filter className="w-3.5 h-3.5" />
                    {pickLang(language, { ku: "بارودۆخ", en: "Status", ar: "الحالة", zh: "状态" })}
                  </p>
                  <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                    {[
                      { key: "all", ku: "هەموو", ar: "الكل", en: "All", zh: "全部", gradient: "from-violet-500 to-purple-600" },
                      { key: "pending", ku: "چاوەڕوان", ar: "قيد الانتظار", en: "Pending", zh: "待处理", gradient: "from-amber-500 to-orange-500" },
                      { key: "in_transit", ku: "لە ڕێگادایە", ar: "في الطريق", en: "In Transit", zh: "运输中", gradient: "from-blue-500 to-cyan-500" },
                      { key: "delivered", ku: "گەیشت", ar: "تم التسليم", en: "Delivered", zh: "已送达", gradient: "from-emerald-500 to-teal-500" },
                      { key: "cancelled", ku: "هەڵوەشاوە", ar: "ملغى", en: "Cancelled", zh: "已取消", gradient: "from-red-500 to-rose-500" },
                    ].map(s => (
                      <button
                        key={s.key}
                        onClick={() => setStatusFilter(s.key)}
                        className={cn(
                          "shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all",
                          statusFilter === s.key
                            ? `bg-gradient-to-r ${s.gradient} text-white shadow-md`
                            : isDark
                              ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        )}
                      >
                        {pickLang(language, { ku: s.ku, en: s.en, ar: s.ar, zh: s.zh })}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sort */}
                <div>
                  <p className={cn(
                    "text-xs font-semibold mb-2.5 flex items-center gap-1.5",
                    isDark ? "text-slate-400" : "text-slate-500"
                  )}>
                    <ArrowUpDown className="w-3.5 h-3.5" />
                    {pickLang(language, { ku: "ڕیزکردن", en: "Sort", ar: "الترتيب", zh: "排序" })}
                  </p>
                  <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                    {[
                      { key: "newest" as const, ku: "نوێترین", ar: "الأحدث", en: "Newest", zh: "最新" },
                      { key: "oldest" as const, ku: "کۆنترین", ar: "الأقدم", en: "Oldest", zh: "最早" },
                      { key: "price_high" as const, ku: "گرانترین", ar: "الأغلى", en: "Highest", zh: "价格最高" },
                      { key: "price_low" as const, ku: "هەرزانترین", ar: "الأرخص", en: "Lowest", zh: "价格最低" },
                    ].map(s => (
                      <button
                        key={s.key}
                        onClick={() => setSortBy(s.key)}
                        className={cn(
                          "shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all",
                          sortBy === s.key
                            ? "bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-md"
                            : isDark
                              ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        )}
                      >
                        {pickLang(language, { ku: s.ku, en: s.en, ar: s.ar, zh: s.zh })}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Clear Filters */}
                {activeFilterCount > 0 && (
                  <button
                    onClick={() => { setStatusFilter("all"); setSortBy("newest"); }}
                    className={cn(
                      "w-full py-2.5 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2",
                      isDark
                        ? "bg-red-900/30 text-red-400 hover:bg-red-900/50"
                        : "bg-red-50 text-red-600 hover:bg-red-100"
                    )}
                  >
                    <XCircle className="w-4 h-4" />
                    {pickLang(language, { ku: "سڕینەوەی فلتەرەکان", en: "Clear Filters", ar: "مسح الفلاتر", zh: "清除筛选" })}
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results count */}
        {(statusFilter !== "all" || sortBy !== "newest" || searchQuery) && !isLoading && (
          <p className={cn(
            "text-sm mb-3",
            isDark ? "text-slate-400" : "text-slate-500"
          )}>
            {filteredOrders.length} {pickLang(language, { ku: "ئەنجام", en: "results", ar: "نتيجة", zh: "条结果" })}
          </p>
        )}

        {/* Orders List */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-36 rounded-2xl" />
            ))}
          </div>
        ) : filteredOrders.length === 0 ? (
          /* Empty State */
          <div className={cn(
            "text-center py-16 rounded-3xl",
            isDark ? "bg-slate-800/50" : "bg-white shadow-sm"
          )}>
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900/30 dark:to-indigo-900/30 flex items-center justify-center mx-auto mb-6">
              <ShoppingBag className="w-12 h-12 text-purple-400" />
            </div>
            <h3 className={cn(
              "text-xl font-bold mb-2",
              isDark ? "text-white" : "text-slate-800"
            )}>
{pickLang(language, { ku: "هیچ داواکارییەک نییە", en: "No orders yet", ar: "لا توجد طلبات بعد", zh: "暂无订单" })}
            </h3>
            <p className={cn(
              "mb-6",
              isDark ? "text-slate-400" : "text-slate-500"
            )}>
{pickLang(language, { ku: "دەستپێبکە بە داواکاری نوێ", en: "Start by creating a new request", ar: "ابدأ بإنشاء طلب جديد", zh: "从创建新订单开始" })}
            </p>
            <Button
              onClick={requestNewOrder}
              className="bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl px-6 py-3 shadow-lg hover:shadow-xl transition-all hover:scale-105"
            >
              <Plus className="w-5 h-5 ms-2" />
{pickLang(language, { ku: "داواکاری نوێ", en: "New Order", ar: "طلب جديد", zh: "新订单" })}
            </Button>
          </div>
        ) : (
          /* Orders Grid */
          <div className="space-y-4">
            <AnimatePresence>
              {filteredOrders.map((order, index) => {
                const statusInfo = getStatusInfo(order.status);
                const orderTypeInfo = getOrderTypeInfo(order.orderType);
                const StatusIcon = statusInfo.icon;
                const TypeIcon = orderTypeInfo.icon;
                
                return (
                  <motion.div
                    key={`${order.source}-${order.id}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => openOrderDetail(order)}
                    className="cursor-pointer"
                  >
                    <div className={cn(
                      "rounded-2xl overflow-hidden transition-all hover:shadow-lg border",
                      isDark 
                        ? "bg-slate-800 border-slate-700 hover:border-slate-600" 
                        : "bg-white border-slate-200 hover:shadow-purple-100/50"
                    )}>
                      <div className="p-4">
                        <div className="flex gap-4">
                          {/* Product Image */}
                          <div className={cn(
                            "w-20 h-20 rounded-xl flex-shrink-0 overflow-hidden",
                            isDark ? "bg-slate-700" : "bg-slate-100"
                          )}>
                            {order.productImage ? (
                              <img loading="lazy" decoding="async" 
                                src={order.productImage} 
                                alt={order.productName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <ImageIcon className={cn(
                                  "w-8 h-8",
                                  isDark ? "text-slate-600" : "text-slate-300"
                                )} />
                              </div>
                            )}
                          </div>
                          
                          {/* Order Info */}
                          <div className="flex-1 min-w-0">
                            {/* Order Type Badge */}
                            <div className="flex items-center gap-2 mb-2">
                              <span className={cn(
                                "inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium",
                                orderTypeInfo.bgColor,
                                orderTypeInfo.textColor
                              )}>
                                <TypeIcon className="w-3 h-3" />
{pickLang(language, { ku: orderTypeInfo.labelKu, en: orderTypeInfo.label, ar: orderTypeInfo.labelAr, zh: orderTypeInfo.labelZh })}
                              </span>
                              <span className={cn(
                                "inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium",
                                statusInfo.bgColor,
                                statusInfo.color
                              )}>
                                <StatusIcon className="w-3 h-3" />
{pickLang(language, { ku: statusInfo.labelKu, en: statusInfo.label, ar: statusInfo.labelAr, zh: statusInfo.labelZh })}
                              </span>
                            </div>
                            
                            {/* Product Name */}
                            <h3 className={cn(
                              "font-semibold text-base mb-1 truncate",
                              isDark ? "text-white" : "text-slate-800"
                            )}>
                              {order.productName}
                            </h3>
                            
                            {/* Order Code — prominent and tap-to-copy so the
                                customer can quote it to staff instantly */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard?.writeText(order.orderCode).then(() =>
                                  toast.success(pickLang(language, { ku: "ئۆردەر نەمبەر کۆپی کرا", en: "Order number copied", ar: "تم نسخ رقم الطلب", zh: "订单号已复制" }))
                                );
                              }}
                              className={cn(
                                "mb-2 inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-sm font-mono font-bold transition active:scale-95",
                                isDark
                                  ? "border-violet-800 bg-violet-950/40 text-violet-300 hover:bg-violet-900/40"
                                  : "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100"
                              )}
                              dir="ltr"
                            >
                              <Hash className="w-3.5 h-3.5" />
                              {order.orderCode}
                              <Copy className="w-3 h-3 opacity-60" />
                            </button>
                            
                            {/* Price and Quantity */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                {order.orderType === 'commission' ? (
                                  <span className={cn(
                                    "text-lg font-bold",
                                    isDark ? "text-amber-400" : "text-amber-600"
                                  )}>
                                    {formatPrice(order.totalPrepaidUsd)}
                                  </span>
                                ) : (
                                  <span className={cn(
                                    "text-lg font-bold",
                                    isDark ? "text-emerald-400" : "text-emerald-600"
                                  )}>
                                    {formatPrice(order.sellingPriceUsd || order.totalPrepaidUsd)}
                                  </span>
                                )}
                                {order.shippingChargedUsd && parseFloat(order.shippingChargedUsd) > 0 && (
                                  <span className={cn(
                                    "text-sm font-medium flex items-center gap-1",
                                    isDark ? "text-blue-400" : "text-blue-600"
                                  )}>
                                    + {formatPrice(order.shippingChargedUsd)} <Truck className="w-3.5 h-3.5" />
                                  </span>
                                )}
                                {order.quantity > 1 && (
                                  <span className={cn(
                                    "text-sm",
                                    isDark ? "text-slate-400" : "text-slate-500"
                                  )}>
                                    × {order.quantity}
                                  </span>
                                )}
                              </div>
                              <ChevronRight className={cn(
                                "w-5 h-5",
                                isDark ? "text-slate-600" : "text-slate-300"
                              )} />
                            </div>
                          </div>
                        </div>
                        
                        {/* Date Footer */}
                        <div className={cn(
                          "mt-3 pt-3 border-t flex items-center justify-between",
                          isDark ? "border-slate-700" : "border-slate-100"
                        )}>
                          <div className="flex items-center gap-2">
                            <Calendar className={cn(
                              "w-4 h-4",
                              isDark ? "text-slate-500" : "text-slate-400"
                            )} />
                            <span className={cn(
                              "text-sm",
                              isDark ? "text-slate-400" : "text-slate-500"
                            )}>
                              {new Date(order.createdAt).toLocaleDateString('ku-IQ')}
                            </span>
                          </div>
                          {order.trackingNumber && (
                            <div className="flex items-center gap-1">
                              <Truck className={cn(
                                "w-4 h-4",
                                isDark ? "text-slate-500" : "text-slate-400"
                              )} />
                              <span className={cn(
                                "text-xs font-mono",
                                isDark ? "text-slate-400" : "text-slate-500"
                              )}>
                                {order.trackingNumber}
                              </span>
                            </div>
                          )}
                          <WhatsAppHelpButton
                            language={language}
                            section={language === "ku" ? "پاکێجی تەواو / عمولە" : language === "ar" ? "الطرد الكامل / العمولة" : language === "zh" ? "全包裹/佣金" : "Full package / commission"}
                            topic={[
                              `${order.orderCode}${order.status ? ` — ${order.status}` : ""}`,
                              order.trackingNumber
                                ? `${language === "ku" ? "تراک" : language === "ar" ? "التتبع" : language === "zh" ? "运单号" : "Tracking"}: ${order.trackingNumber}`
                                : null,
                            ].filter(Boolean).join("\n")}
                          />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
        
        {/* Floating Action Button — request a new order via WhatsApp */}
        <button
          type="button"
          onClick={requestNewOrder}
          aria-label={pickLang(language, { ku: "داواکاری نوێ", en: "New Order", ar: "طلب جديد", zh: "新订单" })}
          className="fixed bottom-24 left-6 w-14 h-14 bg-gradient-to-r from-violet-500 to-purple-600 rounded-full shadow-lg flex items-center justify-center text-white hover:shadow-xl transition-all hover:scale-110 z-50"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      </div>
      
      {/* Order Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className={cn(
          "max-w-md mx-auto rounded-3xl p-0 overflow-hidden",
          isDark ? "bg-slate-900 border-slate-800" : "bg-white"
        )}>
          {selectedOrder && (
            <>
              {/* Dialog Header with Gradient */}
              <div className="relative">
                <div className={cn(
                  "h-32",
                  `bg-gradient-to-r ${getStatusInfo(selectedOrder.status).gradient}`
                )} />
                <button
                  onClick={() => setShowDetailDialog(false)}
                  className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
                
                {/* Product Image Overlay */}
                <div className="absolute -bottom-10 right-6">
                  <div className={cn(
                    "w-20 h-20 rounded-2xl overflow-hidden border-4 shadow-lg",
                    isDark ? "border-slate-900 bg-slate-800" : "border-white bg-slate-100"
                  )}>
                    {selectedOrder.productImage ? (
                      <img loading="lazy" decoding="async" 
                        src={selectedOrder.productImage} 
                        alt={selectedOrder.productName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className={cn(
                          "w-8 h-8",
                          isDark ? "text-slate-600" : "text-slate-300"
                        )} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Dialog Content */}
              <div className="p-6 pt-14">
                <DialogHeader className="text-right mb-6">
                  <DialogTitle className={cn(
                    "text-xl font-bold",
                    isDark ? "text-white" : "text-slate-800"
                  )}>
                    {selectedOrder.productName}
                  </DialogTitle>
                  <DialogDescription asChild>
                    <button
                      type="button"
                      onClick={() =>
                        navigator.clipboard?.writeText(selectedOrder.orderCode).then(() =>
                          toast.success(pickLang(language, { ku: "ئۆردەر نەمبەر کۆپی کرا", en: "Order number copied", ar: "تم نسخ رقم الطلب", zh: "订单号已复制" }))
                        )
                      }
                      className={cn(
                        "inline-flex w-fit items-center gap-1.5 rounded-lg border px-2 py-1 text-sm font-mono font-bold transition active:scale-95",
                        isDark
                          ? "border-violet-800 bg-violet-950/40 text-violet-300 hover:bg-violet-900/40"
                          : "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100"
                      )}
                      dir="ltr"
                    >
                      <Hash className="w-3.5 h-3.5" />
                      {selectedOrder.orderCode}
                      <Copy className="w-3 h-3 opacity-60" />
                    </button>
                  </DialogDescription>
                </DialogHeader>
                
                {/* Status and Type Badges */}
                <div className="flex items-center gap-2 mb-6">
                  <span className={cn(
                    "inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-sm font-medium",
                    getOrderTypeInfo(selectedOrder.orderType).bgColor,
                    getOrderTypeInfo(selectedOrder.orderType).textColor
                  )}>
{pickLang(language, { ku: getOrderTypeInfo(selectedOrder.orderType).labelKu, en: getOrderTypeInfo(selectedOrder.orderType).label, ar: getOrderTypeInfo(selectedOrder.orderType).labelAr, zh: getOrderTypeInfo(selectedOrder.orderType).labelZh })}
                  </span>
                  <span className={cn(
                    "inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-sm font-medium",
                    getStatusInfo(selectedOrder.status).bgColor,
                    getStatusInfo(selectedOrder.status).color
                  )}>
{pickLang(language, { ku: getStatusInfo(selectedOrder.status).labelKu, en: getStatusInfo(selectedOrder.status).label, ar: getStatusInfo(selectedOrder.status).labelAr, zh: getStatusInfo(selectedOrder.status).labelZh })}
                  </span>
                </div>
                
                {/* Order Details */}
                <div className="space-y-4">
                  {/* Price Info */}
                  <div className={cn(
                    "p-4 rounded-2xl",
                    isDark ? "bg-slate-800" : "bg-slate-50"
                  )}>
                    <div className="flex items-center justify-between mb-3">
                      <span className={isDark ? "text-slate-400" : "text-slate-500"}>
{pickLang(language, { ku: "نرخی کڕین", en: "Purchase Price", ar: "سعر الشراء", zh: "采购价格" })}
                      </span>
                      <span className={cn(
                        "text-xl font-bold",
                        isDark ? "text-white" : "text-slate-800"
                      )}>
                        {selectedOrder.orderType === 'commission'
                          ? formatPrice(selectedOrder.totalPrepaidUsd)
                          : formatPrice(selectedOrder.sellingPriceUsd || selectedOrder.totalPrepaidUsd)
                        }
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm mt-1">
                      <span className={isDark ? "text-slate-500" : "text-slate-400"}>
{pickLang(language, { ku: "ژمارە", en: "Quantity", ar: "الكمية", zh: "数量" })}
                      </span>
                      <span className={isDark ? "text-slate-300" : "text-slate-600"}>
                        {selectedOrder.quantity}
                      </span>
                    </div>
                  </div>

                  {/* Shipping Cost Info */}
                  {selectedOrder.shippingChargedUsd && parseFloat(selectedOrder.shippingChargedUsd) > 0 && (
                    <div className={cn(
                      "p-4 rounded-2xl",
                      isDark ? "bg-blue-900/30" : "bg-blue-50"
                    )}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Truck className={cn(
                            "w-4 h-4",
                            isDark ? "text-blue-400" : "text-blue-500"
                          )} />
                          <span className={isDark ? "text-blue-300" : "text-blue-600"}>
{pickLang(language, { ku: "نرخی گەیاندن", en: "Shipping Cost", ar: "تكلفة الشحن", zh: "运费" })}
                          </span>
                        </div>
                        <span className={cn(
                          "text-lg font-bold",
                          isDark ? "text-blue-300" : "text-blue-700"
                        )}>
                          {formatPrice(selectedOrder.shippingChargedUsd)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Advance Payment + Remaining */}
                  {(() => {
                    const advance = parseFloat(selectedOrder.advancePaidUsd || "0");
                    if (advance <= 0) return null;
                    const totalPrice = selectedOrder.orderType === "commission"
                      ? parseFloat(selectedOrder.totalPrepaidUsd || "0")
                      : parseFloat(selectedOrder.sellingPriceUsd || "0") * (selectedOrder.quantity || 1);
                    const remaining = Math.max(0, totalPrice - advance);
                    const isFullyPaid = advance >= totalPrice && totalPrice > 0;
                    return (
                      <div className={cn(
                        "p-4 rounded-2xl space-y-2",
                        isDark ? "bg-emerald-900/30" : "bg-emerald-50"
                      )}>
                        <div className="flex items-center gap-2 mb-1">
                          <DollarSign className={cn("w-4 h-4", isDark ? "text-emerald-400" : "text-emerald-600")} />
                          <span className={cn("font-semibold", isDark ? "text-emerald-300" : "text-emerald-700")}>
                            {pickLang(language, { ku: "پوختەی پارەدان", en: "Payment Summary", ar: "ملخص الدفع", zh: "付款摘要" })}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className={isDark ? "text-slate-400" : "text-slate-500"}>
                            {pickLang(language, { ku: "کۆی نرخ", en: "Total", ar: "السعر الإجمالي", zh: "总价" })}
                          </span>
                          <span className="font-mono font-semibold">{formatPrice(totalPrice)}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className={isDark ? "text-emerald-400" : "text-emerald-600"}>
                            {pickLang(language, { ku: "پێشەکی دراو", en: "Advance Paid", ar: "مدفوع مقدماً", zh: "已付预付款" })}
                          </span>
                          <span className={cn("font-mono font-semibold", isDark ? "text-emerald-400" : "text-emerald-600")}>-{formatPrice(advance)}</span>
                        </div>
                        <div className={cn("h-px", isDark ? "bg-emerald-800" : "bg-emerald-200")} />
                        <div className="flex items-center justify-between">
                          <span className={cn("font-semibold", isDark ? "text-white" : "text-slate-800")}>
                            {isFullyPaid
                              ? pickLang(language, { ku: "ڕەوش", en: "Status", ar: "الحالة", zh: "状态" })
                              : pickLang(language, { ku: "ماوە بۆ پارەدان", en: "Remaining", ar: "المتبقي", zh: "剩余应付" })}
                          </span>
                          {isFullyPaid ? (
                            <span className={cn("font-bold", isDark ? "text-emerald-300" : "text-emerald-700")}>
                              ✓ {pickLang(language, { ku: "تەواو پارەدراوە", en: "Fully Paid", ar: "مدفوع بالكامل", zh: "已全额付款" })}
                            </span>
                          ) : (
                            <span className={cn("font-mono font-bold text-lg", isDark ? "text-amber-300" : "text-amber-700")}>
                              {formatPrice(remaining)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                  
                  {/* Tracking Info */}
                  {selectedOrder.trackingNumber && (
                    <div className={cn(
                      "p-4 rounded-2xl",
                      isDark ? "bg-slate-800" : "bg-slate-50"
                    )}>
                      <div className="flex items-center gap-2 mb-2">
                        <Truck className={cn(
                          "w-4 h-4",
                          isDark ? "text-slate-400" : "text-slate-500"
                        )} />
                        <span className={isDark ? "text-slate-400" : "text-slate-500"}>
{pickLang(language, { ku: "تراکینگ نەمبەر", en: "Tracking Number", ar: "رقم التتبع", zh: "物流单号" })}
                        </span>
                      </div>
                      <p className={cn(
                        "font-mono text-sm",
                        isDark ? "text-white" : "text-slate-800"
                      )}>
                        {selectedOrder.trackingNumber}
                      </p>
                    </div>
                  )}
                  
                  {/* Product Link */}
                  {selectedOrder.productLink && (
                    <a 
                      href={selectedOrder.productLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "flex items-center justify-between p-4 rounded-2xl transition-colors",
                        isDark 
                          ? "bg-slate-800 hover:bg-slate-700" 
                          : "bg-slate-50 hover:bg-slate-100"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <ExternalLink className={cn(
                          "w-4 h-4",
                          isDark ? "text-slate-400" : "text-slate-500"
                        )} />
                        <span className={isDark ? "text-slate-400" : "text-slate-500"}>
{pickLang(language, { ku: "لینکی کاڵا", en: "Product Link", ar: "رابط المنتج", zh: "产品链接" })}
                        </span>
                      </div>
                      <ChevronRight className={cn(
                        "w-5 h-5",
                        isDark ? "text-slate-600" : "text-slate-300"
                      )} />
                    </a>
                  )}
                  
                  {/* Date Info */}
                  <div className={cn(
                    "p-4 rounded-2xl",
                    isDark ? "bg-slate-800" : "bg-slate-50"
                  )}>
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className={cn(
                        "w-4 h-4",
                        isDark ? "text-slate-400" : "text-slate-500"
                      )} />
                      <span className={isDark ? "text-slate-400" : "text-slate-500"}>
{pickLang(language, { ku: "بەرواری دروستکردن", en: "Created Date", ar: "تاريخ الإنشاء", zh: "创建日期" })}
                      </span>
                    </div>
                    <p className={cn(
                      "text-sm",
                      isDark ? "text-white" : "text-slate-800"
                    )}>
                      {new Date(selectedOrder.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                      }).replace(/\//g, '/')}
                    </p>
                  </div>
                  
                  {/* Notes */}
                  {selectedOrder.productDescription && (
                    <div className={cn(
                      "p-4 rounded-2xl",
                      isDark ? "bg-slate-800" : "bg-slate-50"
                    )}>
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className={cn(
                          "w-4 h-4",
                          isDark ? "text-slate-400" : "text-slate-500"
                        )} />
                        <span className={isDark ? "text-slate-400" : "text-slate-500"}>
{pickLang(language, { ku: "تێبینی", en: "Notes", ar: "ملاحظات", zh: "备注" })}
                        </span>
                      </div>
                      <p className={cn(
                        "text-sm",
                        isDark ? "text-white" : "text-slate-800"
                      )}>
                        {selectedOrder.productDescription}
                      </p>
                    </div>
                  )}
                </div>
                
                {/* Close Button */}
                <Button
                  onClick={() => setShowDetailDialog(false)}
                  className={cn(
                    "w-full mt-6 rounded-xl py-3",
                    "bg-gradient-to-r from-violet-500 to-purple-600 text-white hover:opacity-90"
                  )}
                >
{pickLang(language, { ku: "داخستن", en: "Close", ar: "إغلاق", zh: "关闭" })}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </CustomerPortalLayout>
  );
}
