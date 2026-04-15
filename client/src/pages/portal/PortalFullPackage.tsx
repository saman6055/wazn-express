import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import { CustomerPortalLayout } from "@/components/CustomerPortalLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  ShoppingBag, Package, Clock, CheckCircle, Truck, AlertCircle,
  Plus, ChevronRight, DollarSign, Calendar, Phone,
  MessageCircle, Search, Eye, X, MapPin, CreditCard,
  ArrowUpRight, Sparkles, TrendingUp, Box, Plane, Home,
  FileText, Wallet, ShoppingCart, Star, Filter, XCircle,
  Loader2, Check, AlertTriangle, Gift, Zap, ThumbsUp, ThumbsDown,
  Image as ImageIcon, ExternalLink, Hash
} from "lucide-react";

// Status configuration with beautiful colors
const statusConfig: Record<string, { label: string; labelKu: string; labelAr: string; color: string; bgColor: string; borderColor: string; icon: any; gradient: string }> = {
  pending: { 
    label: "Pending", 
    labelKu: "چاوەڕوان", 
    labelAr: "قيد الانتظار",
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
    color: "text-indigo-700", 
    bgColor: "bg-indigo-100", 
    borderColor: "border-indigo-200",
    icon: Package,
    gradient: "from-indigo-400 to-indigo-600"
  },
};

// Order type configuration
const orderTypeConfig: Record<string, { label: string; labelKu: string; labelAr: string; color: string; bgColor: string; textColor: string; icon: any }> = {
  full_package: { 
    label: "Full Package", 
    labelKu: "فول پاکێج", 
    labelAr: "الباقة الكاملة",
    color: "bg-emerald-500", 
    bgColor: "bg-emerald-50",
    textColor: "text-emerald-700",
    icon: Package
  },
  commission: { 
    label: "Commission", 
    labelKu: "عمولە", 
    labelAr: "عمولة",
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
  const isKurdish = language === "ku";
  
  const [activeTab, setActiveTab] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  
  // Fetch full package orders for this customer (using customer portal endpoint)
  const { data: fullPackageOrders, isLoading } = trpc.customerPortal.getMyFullPackageOrders.useQuery({
    orderType: activeTab === "all" ? undefined : activeTab as "full_package" | "commission",
  });
  
  // Combine and filter orders
  const allOrders = [
    ...(fullPackageOrders || []).map(o => ({ ...o, source: 'full_package' as const })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  
  // Filter by tab
  const filteredOrders = allOrders.filter(order => {
    if (activeTab === "all") return true;
    if (activeTab === "full_package") return order.orderType === "full_package";
    if (activeTab === "commission") return order.orderType === "commission";
    return true;
  }).filter(order => {
    if (!searchQuery) return true;
    return order.productName?.toLowerCase().includes(searchQuery.toLowerCase());
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
                  {isKurdish ? "پەتەکانم" : language === "ar" ? "طلباتي" : "My Orders"}
                </h1>
                <p className="text-white/70 text-sm">
                  {isKurdish ? "بەڕێوەبردنی پەتەکانت" : language === "ar" ? "إدارة طلباتك" : "Manage your orders"}
                </p>
              </div>
            </div>
            <Link href="/portal/create-full-package">
              <Button 
                size="sm"
                className="bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm rounded-xl shadow-lg transition-all hover:scale-105"
              >
                <Plus className="w-4 h-4 ms-1" />
{isKurdish ? "داواکاری نوێ" : language === "ar" ? "طلب جديد" : "New Order"}
              </Button>
            </Link>
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
                <p className="text-white/70 text-sm mt-1">{isKurdish ? "کۆی گشتی" : language === "ar" ? "الإجمالي" : "Total"}</p>
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
                <p className="text-amber-200/70 text-sm mt-1">{isKurdish ? "چاوەڕوان" : language === "ar" ? "قيد الانتظار" : "Pending"}</p>
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
                <p className="text-emerald-200/70 text-sm mt-1">{isKurdish ? "گەیەندراو" : language === "ar" ? "تم التسليم" : "Delivered"}</p>
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
{isKurdish ? "هەموو" : language === "ar" ? "الكل" : "All"}
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
{isKurdish ? "فول پاکێج" : language === "ar" ? "الباقة الكاملة" : "Full Package"}
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
{isKurdish ? "عمولە" : language === "ar" ? "عمولة" : "Commission"}
          </button>
        </div>
        
        {/* Search Bar */}
        <div className="relative mb-6">
          <Search className={cn(
            "absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5",
            isDark ? "text-slate-500" : "text-slate-400"
          )} />
          <input
            type="text"
placeholder={isKurdish ? "گەڕان بە ناوی کاڵا..." : language === "ar" ? "البحث باسم المنتج..." : "Search by product name..."}
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
{isKurdish ? "هیچ داواکارییەک نییە" : language === "ar" ? "لا توجد طلبات بعد" : "No orders yet"}
            </h3>
            <p className={cn(
              "mb-6",
              isDark ? "text-slate-400" : "text-slate-500"
            )}>
{isKurdish ? "دەستپێبکە بە داواکاری نوێ" : language === "ar" ? "ابدأ بإنشاء طلب جديد" : "Start by creating a new request"}
            </p>
            <Link href="/portal/create-full-package">
              <Button className="bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl px-6 py-3 shadow-lg hover:shadow-xl transition-all hover:scale-105">
                <Plus className="w-5 h-5 ms-2" />
{isKurdish ? "داواکاری نوێ" : language === "ar" ? "طلب جديد" : "New Order"}
              </Button>
            </Link>
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
                              <img 
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
{isKurdish ? orderTypeInfo.labelKu : language === "ar" ? orderTypeInfo.labelAr : orderTypeInfo.label}
                              </span>
                              <span className={cn(
                                "inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium",
                                statusInfo.bgColor,
                                statusInfo.color
                              )}>
                                <StatusIcon className="w-3 h-3" />
{isKurdish ? statusInfo.labelKu : language === "ar" ? statusInfo.labelAr : statusInfo.label}
                              </span>
                            </div>
                            
                            {/* Product Name */}
                            <h3 className={cn(
                              "font-semibold text-base mb-1 truncate",
                              isDark ? "text-white" : "text-slate-800"
                            )}>
                              {order.productName}
                            </h3>
                            
                            {/* Order Code */}
                            <div className="flex items-center gap-1 mb-2">
                              <Hash className={cn(
                                "w-3 h-3",
                                isDark ? "text-slate-500" : "text-slate-400"
                              )} />
                              <span className={cn(
                                "text-xs font-mono",
                                isDark ? "text-slate-400" : "text-slate-500"
                              )}>
                                {order.orderCode}
                              </span>
                            </div>
                            
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
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
        
        {/* Floating Action Button */}
        <Link href="/portal/create-full-package">
          <button className="fixed bottom-24 left-6 w-14 h-14 bg-gradient-to-r from-violet-500 to-purple-600 rounded-full shadow-lg flex items-center justify-center text-white hover:shadow-xl transition-all hover:scale-110 z-50">
            <MessageCircle className="w-6 h-6" />
          </button>
        </Link>
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
                      <img 
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
                  <DialogDescription className={cn(
                    "text-sm",
                    isDark ? "text-slate-400" : "text-slate-500"
                  )}>
                    {selectedOrder.orderCode}
                  </DialogDescription>
                </DialogHeader>
                
                {/* Status and Type Badges */}
                <div className="flex items-center gap-2 mb-6">
                  <span className={cn(
                    "inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-sm font-medium",
                    getOrderTypeInfo(selectedOrder.orderType).bgColor,
                    getOrderTypeInfo(selectedOrder.orderType).textColor
                  )}>
{isKurdish ? getOrderTypeInfo(selectedOrder.orderType).labelKu : language === "ar" ? getOrderTypeInfo(selectedOrder.orderType).labelAr : getOrderTypeInfo(selectedOrder.orderType).label}
                  </span>
                  <span className={cn(
                    "inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-sm font-medium",
                    getStatusInfo(selectedOrder.status).bgColor,
                    getStatusInfo(selectedOrder.status).color
                  )}>
{isKurdish ? getStatusInfo(selectedOrder.status).labelKu : language === "ar" ? getStatusInfo(selectedOrder.status).labelAr : getStatusInfo(selectedOrder.status).label}
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
{isKurdish ? "نرخی کڕین" : language === "ar" ? "سعر الشراء" : "Purchase Price"}
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
{isKurdish ? "ژمارە" : language === "ar" ? "الكمية" : "Quantity"}
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
{isKurdish ? "نرخی گەیاندن" : language === "ar" ? "تكلفة الشحن" : "Shipping Cost"}
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
{isKurdish ? "تراکینگ نەمبەر" : language === "ar" ? "رقم التتبع" : "Tracking Number"}
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
{isKurdish ? "لینکی کاڵا" : language === "ar" ? "رابط المنتج" : "Product Link"}
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
{isKurdish ? "بەرواری دروستکردن" : language === "ar" ? "تاريخ الإنشاء" : "Created Date"}
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
{isKurdish ? "تێبینی" : language === "ar" ? "ملاحظات" : "Notes"}
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
{isKurdish ? "داخستن" : language === "ar" ? "إغلاق" : "Close"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </CustomerPortalLayout>
  );
}
