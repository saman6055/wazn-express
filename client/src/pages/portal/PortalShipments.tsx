import { usePortalPalette } from "@/components/portal/PortalHeaderControls";
import { CustomerPortalLayout } from "@/components/CustomerPortalLayout";
import { usePortalTheme } from "@/contexts/PortalThemeContext";
import { lazy } from "react";
// Lazy: only the active skin's chunk is downloaded — the skin is a global
// admin setting, so shipping all three variants to every customer tripled
// the route bundle for nothing.
const ModernPortalShipments = lazy(() => import("./modern/ModernPortalShipments"));
const Skin3PortalShipments = lazy(() => import("./skin3/Skin3PortalShipments"));
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import { 
  Package, ChevronRight, Truck, CheckCircle, Clock, AlertCircle, 
  Plane, Ship, Box, AlertTriangle, Search, Filter, X, Calendar,
  ArrowUpDown, Download, Share2, HelpCircle
} from "lucide-react";
import { Link, useSearch } from "wouter";
import { PortalListSkeleton } from "@/components/portal/PortalListSkeleton";
import { BatchJourneyTimeline } from "@/components/portal/BatchJourneyTimeline";
import { WhatsAppHelpButton } from "@/components/portal/WhatsAppHelpButton";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { getBatchEta, formatBatchEta } from "@/lib/batchEta";
type StatusFilter = "all" | "in_transit" | "delivered" | "preparing";
type ShippingFilter = "all" | "air_regular" | "sea" | "air_irregular";
type SortOption = "newest" | "oldest" | "status";

function ClassicPortalShipments() {
  // Banner colour follows the mode the customer picked, like every other page.
  const { banner: portalBanner } = usePortalPalette();
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const isRTL = language === "ku" || language === "ar";
  
  // Get URL params for initial filter
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const initialStatus = (urlParams.get("status") as StatusFilter) || "all";
  
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialStatus);
  const [shippingType, setShippingType] = useState<ShippingFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [showFilters, setShowFilters] = useState(false);
  
  const { data: batches, isLoading, refetch } = trpc.customerPortal.getMyBatches.useQuery();
  const { data: unbatchedPackages, refetch: refetchUnbatched } = trpc.customerPortal.getMyUnbatchedPackages.useQuery();
  const handleRefresh = async () => {
    await Promise.all([refetch(), refetchUnbatched()]);
  };
  const { pullToRefreshProps, pullDistance } = usePullToRefresh(handleRefresh);

  // Filter and sort batches
  const filteredBatches = useMemo(() => {
    let result = batches || [];
    
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(batch => 
        batch.batchCode?.toLowerCase().includes(query)
      );
    }
    
    // Status filter
    if (statusFilter !== "all") {
      result = result.filter(batch => {
        if (statusFilter === "in_transit") return batch.status === "in_transit";
        if (statusFilter === "delivered") return ["delivered", "closed"].includes(batch.status);
        if (statusFilter === "preparing") return ["preparing", "arrived", "customs"].includes(batch.status);
        return true;
      });
    }
    
    // Shipping type filter
    if (shippingType !== "all") {
      result = result.filter(batch => batch.shippingType === shippingType);
    }
    
    // Sort
    result = [...result].sort((a, b) => {
      if (sortBy === "newest") {
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      }
      if (sortBy === "oldest") {
        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      }
      // Sort by status priority
      const statusPriority: Record<string, number> = {
        in_transit: 1,
        customs: 2,
        arrived: 3,
        preparing: 4,
        delivered: 5,
        closed: 6
      };
      return (statusPriority[a.status] || 99) - (statusPriority[b.status] || 99);
    });
    
    return result;
  }, [batches, searchQuery, statusFilter, shippingType, sortBy]);

  // Calculate progress percentage based on status
  const getProgressPercentage = (status: string) => {
    switch (status) {
      case "preparing": return 20;
      case "in_transit": return 50;
      case "arrived": return 70;
      case "customs": return 80;
      case "delivered": return 100;
      case "closed": return 100;
      default: return 10;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "delivered":
      case "closed":
        return { 
          bg: isDark ? "bg-emerald-900/50" : "bg-emerald-100", 
          text: isDark ? "text-emerald-400" : "text-emerald-700", 
          icon: isDark ? "text-emerald-400" : "text-emerald-500",
          progress: "bg-emerald-500"
        };
      case "in_transit":
        return { 
          bg: isDark ? "bg-blue-900/50" : "bg-blue-100", 
          text: isDark ? "text-blue-400" : "text-blue-700", 
          icon: isDark ? "text-blue-400" : "text-blue-500",
          progress: "bg-blue-500"
        };
      case "customs":
        return { 
          bg: isDark ? "bg-amber-900/50" : "bg-amber-100", 
          text: isDark ? "text-amber-400" : "text-amber-700", 
          icon: isDark ? "text-amber-400" : "text-amber-500",
          progress: "bg-amber-500"
        };
      default:
        return { 
          bg: isDark ? "bg-slate-700" : "bg-slate-100", 
          text: isDark ? "text-slate-300" : "text-slate-600", 
          icon: isDark ? "text-slate-400" : "text-slate-400",
          progress: "bg-slate-400"
        };
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "delivered":
      case "closed":
        return <CheckCircle className="w-4 h-4" />;
      case "in_transit":
        return <Truck className="w-4 h-4" />;
      case "customs":
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getStatusText = (status: string) => {
    if (language === "ku") {
      const statusMap: Record<string, string> = {
        preparing: "ئامادەکاری",
        in_transit: "لە ڕێگادا",
        arrived: "گەیشتووە",
        customs: "گومرگ",
        delivered: "گەیشتووە",
        closed: "داخراوە",
      };
      return statusMap[status] || status;
    }
    if (language === "ar") {
      const statusMap: Record<string, string> = {
        preparing: "جاري التحضير",
        in_transit: "في الطريق",
        arrived: "وصلت",
        customs: "الجمارك",
        delivered: "تم التسليم",
        closed: "مغلق",
      };
      return statusMap[status] || status;
    }
    const statusMap: Record<string, string> = {
      preparing: "Preparing",
      in_transit: "In Transit",
      arrived: "Arrived",
      customs: "Customs",
      delivered: "Delivered",
      closed: "Closed",
    };
    return statusMap[status] || status;
  };

  const getShippingIcon = (type: string) => {
    if (type === "sea") return <Ship className="w-5 h-5" />;
    if (type === "air_irregular") return <AlertTriangle className="w-5 h-5" />;
    return <Plane className="w-5 h-5" />;
  };

  const getShippingColor = (type: string) => {
    if (type === "sea") return isDark ? "bg-cyan-900/50 text-cyan-400" : "bg-cyan-100 text-cyan-600";
    if (type === "air_irregular") return isDark ? "bg-amber-900/50 text-amber-400" : "bg-amber-100 text-amber-600";
    return isDark ? "bg-blue-900/50 text-blue-400" : "bg-blue-100 text-blue-600";
  };

  // Shipping type tabs
  const shippingTabs: { value: ShippingFilter; label: string; labelKu: string; labelAr: string; icon: any }[] = [
    { value: "all", label: "All", labelKu: "هەموو", labelAr: "الكل", icon: Package },
    { value: "air_regular", label: "Air", labelKu: "ئاسمانی", labelAr: "جوي", icon: Plane },
    { value: "sea", label: "Sea", labelKu: "دەریایی", labelAr: "بحري", icon: Ship },
    { value: "air_irregular", label: "Irregular", labelKu: "نائاسایی", labelAr: "غير منتظم", icon: AlertTriangle },
  ];

  // Status filter pills
  const statusFilters: { value: StatusFilter; label: string; labelKu: string; labelAr: string; count: number }[] = [
    { value: "all", label: "All", labelKu: "هەموو", labelAr: "الكل", count: batches?.length || 0 },
    { value: "in_transit", label: "In Transit", labelKu: "لە ڕێگادا", labelAr: "في الطريق", count: batches?.filter(b => b.status === "in_transit").length || 0 },
    { value: "preparing", label: "Preparing", labelKu: "ئامادەکاری", labelAr: "قيد الانتظار", count: batches?.filter(b => ["preparing", "arrived", "customs"].includes(b.status)).length || 0 },
    { value: "delivered", label: "Delivered", labelKu: "گەیشتوو", labelAr: "تم التسليم", count: batches?.filter(b => ["delivered", "closed"].includes(b.status)).length || 0 },
  ];

  return (
    <CustomerPortalLayout>
      {/* Premium Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0" style={portalBanner} />
        <div className="relative px-5 pt-14 pb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">
                {language === "ku" ? "بارەکان" : language === "ar" ? "الشحنات" : "Shipments"}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-slate-400 text-sm">
                  {language === "ku" ? "شوێنکەوتنی پاکەتەکانت" : language === "ar" ? "تتبع شحناتك" : "Track your packages"}
                </p>
                <Link href="/portal/guide#shipments">
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-white/80 hover:bg-white/20 transition cursor-pointer">
                    <HelpCircle className="w-3 h-3" />
                    {language === "ku" ? "ئەمە چییە؟" : language === "ar" ? "ما هذا؟" : language === "zh" ? "这是什么？" : "What's this?"}
                  </span>
                </Link>
              </div>
            </div>
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "p-3 rounded-xl transition-all duration-300",
                showFilters 
                  ? "bg-white text-slate-800" 
                  : "bg-white/10 text-white hover:bg-white/20"
              )}
            >
              <Filter className="w-5 h-5" />
            </button>
          </div>

          {/* Search Bar */}
          <div className="mt-4 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={language === "ku" ? "گەڕان بە کۆدی باچ..." : language === "ar" ? "البحث برمز الدفعة..." : "Search by batch code..."}
              className={cn(
                "w-full pl-12 pr-4 py-3.5 rounded-xl text-sm transition-all duration-300",
                isDark 
                  ? "bg-slate-800 text-white placeholder-slate-500 focus:bg-slate-700" 
                  : "bg-white/10 text-white placeholder-slate-400 focus:bg-white/20"
              )}
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full bg-slate-600 hover:bg-slate-500"
              >
                <X className="w-3 h-3 text-white" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Shipping Type Tabs */}
      <div className={cn(
        // Sticky was a no-op while the list scrolled inside its own box — the
        // page never moved. Now that it does, these keep the air/sea filter in
        // reach, offset to clear the portal's own sticky search bar above.
        "px-4 py-3 border-b sticky top-14 z-10 transition-colors duration-300",
        isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
      )}>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {shippingTabs.map((tab) => {
            const isActive = shippingType === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => setShippingType(tab.value)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-300",
                  isActive 
                    ? (isDark ? "bg-white text-slate-900" : "bg-slate-800 text-white shadow-lg shadow-slate-300")
                    : (isDark ? "bg-slate-800 text-slate-400 hover:bg-slate-700" : "bg-slate-50 text-slate-600 hover:bg-slate-100")
                )}
              >
                <tab.icon className="w-4 h-4" />
                {language === "ku" ? tab.labelKu : language === "ar" ? tab.labelAr : tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Status Filter Pills */}
      <div className={cn(
        "px-4 py-3 transition-colors duration-300",
        isDark ? "bg-slate-900/50" : "bg-slate-50/50"
      )}>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {statusFilters.map((filter) => {
            const isActive = statusFilter === filter.value;
            return (
              <button
                key={filter.value}
                onClick={() => setStatusFilter(filter.value)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-300",
                  isActive 
                    ? (isDark ? "bg-white text-slate-900" : "bg-slate-800 text-white")
                    : (isDark ? "bg-slate-800 text-slate-400 border border-slate-700" : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300")
                )}
              >
                {language === "ku" ? filter.labelKu : language === "ar" ? filter.labelAr : filter.label}
                <span className={cn(
                  "px-1.5 py-0.5 rounded-full text-xs",
                  isActive 
                    ? (isDark ? "bg-slate-200 text-slate-800" : "bg-white/20 text-white")
                    : (isDark ? "bg-slate-700 text-slate-400" : "bg-slate-100 text-slate-500")
                )}>
                  {filter.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sort Options (shown when filters expanded) */}
      {showFilters && (
        <div className={cn(
          "px-4 py-3 border-b transition-colors duration-300",
          isDark ? "bg-slate-800/50 border-slate-700" : "bg-white border-slate-100"
        )}>
          <div className="flex items-center gap-2">
            <ArrowUpDown className={cn("w-4 h-4", isDark ? "text-slate-400" : "text-slate-500")} />
            <span className={cn("text-sm font-medium", isDark ? "text-slate-300" : "text-slate-600")}>
              {language === "ku" ? "ڕیزکردن:" : language === "ar" ? "الترتيب:" : "Sort by:"}
            </span>
            <div className="flex gap-2">
              {[
                { value: "newest" as SortOption, label: language === "ku" ? "نوێترین" : language === "ar" ? "الأحدث" : "Newest" },
                { value: "oldest" as SortOption, label: language === "ku" ? "کۆنترین" : language === "ar" ? "الأقدم" : "Oldest" },
                { value: "status" as SortOption, label: language === "ku" ? "بارودۆخ" : language === "ar" ? "الحالة" : "Status" },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setSortBy(option.value)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                    sortBy === option.value
                      ? (isDark ? "bg-white text-slate-900" : "bg-slate-800 text-white")
                      : (isDark ? "bg-slate-700 text-slate-400" : "bg-slate-100 text-slate-600")
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* The list flows in the page rather than scrolling inside a fixed-height
          box. That box was why the news strip looked pinned: the page itself
          never scrolled, so the strip sat below the box, permanently on screen
          and never scrolled past. Pull-to-refresh still works — the hook now
          reads the page's scroll position when its container isn't the thing
          scrolling. */}
      <div
        className={cn("transition-colors duration-300", isDark ? "bg-slate-900" : "bg-slate-50")}
        {...pullToRefreshProps}
      >
        {/* Pull indicator */}
        {pullDistance > 0 && (
          <div className={cn(
            "sticky top-0 z-10 flex items-center justify-center py-2 text-sm font-medium",
            isDark ? "text-slate-400" : "text-slate-500"
          )}>
            {pullDistance >= 80
              ? (language === "ku" ? "فڕێبدە بۆ نوێکردنەوە" : "Release to refresh")
              : (language === "ku" ? "بڕێوە بۆ نوێکردنەوە" : "Pull to refresh")}
          </div>
        )}
        {/* Results Count */}
        <div className={cn(
          "px-4 py-2 transition-colors duration-300",
          isDark ? "bg-slate-900" : "bg-white"
        )}>
          <p className={cn("text-sm", isDark ? "text-slate-400" : "text-slate-500")}>
            {language === "ku" 
              ? `${filteredBatches.length} ئەنجام دۆزرایەوە` 
              : language === "ar"
              ? `${filteredBatches.length} نتيجة`
              : `${filteredBatches.length} results found`}
          </p>
        </div>

        {/* Batches List */}
        <div className={cn(
          "px-4 py-4 pb-24 transition-colors duration-300",
          isDark ? "bg-slate-900" : "bg-slate-50"
        )}>
          {isLoading ? (
          <PortalListSkeleton rows={4} />
        ) : filteredBatches.length === 0 ? (
          <div className={cn(
            "rounded-2xl p-10 text-center shadow-sm transition-colors duration-300",
            isDark ? "bg-slate-800" : "bg-white"
          )}>
            <div className={cn(
              "w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4",
              isDark ? "bg-slate-700" : "bg-slate-100"
            )}>
              <Package className={cn("w-8 h-8", isDark ? "text-slate-500" : "text-slate-400")} />
            </div>
            <p className={cn("font-medium", isDark ? "text-slate-300" : "text-slate-600")}>
              {language === "ku" ? "هیچ بارێک نەدۆزرایەوە" : language === "ar" ? "لا توجد شحنات" : "No shipments found"}
            </p>
            <p className={cn("text-sm mt-1", isDark ? "text-slate-500" : "text-slate-400")}>
              {language === "ku" ? "فلتەرێکی تر تاقی بکەرەوە" : language === "ar" ? "جرب فلتر مختلف" : "Try a different filter"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredBatches.map((batch) => {
              const statusColors = getStatusColor(batch.status);

              return (
                <Link key={batch.id} href={`/portal/shipments/${batch.id}`}>
                  <div className={cn(
                    "rounded-2xl p-4 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 border",
                    isDark 
                      ? "bg-slate-800 border-slate-700 hover:bg-slate-750" 
                      : "bg-white border-slate-100"
                  )}>
                    {/* Top Row */}
                    <div className="flex items-start gap-4">
                      {/* Shipping Type Icon */}
                      <div className={cn(
                        "w-14 h-14 rounded-xl flex items-center justify-center shrink-0",
                        getShippingColor(batch.shippingType || "air_regular")
                      )}>
                        {getShippingIcon(batch.shippingType || "air_regular")}
                      </div>
                      
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className={cn("font-bold text-lg", isDark ? "text-white" : "text-slate-800")}>
                            {batch.batchCode}
                          </p>
                          <ChevronRight className={cn(
                            "w-5 h-5 shrink-0",
                            isDark ? "text-slate-500" : "text-slate-400",
                            isRTL && "rotate-180"
                          )} />
                        </div>
                        
                        {/* Status Badge */}
                        <div className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                          statusColors.bg, statusColors.text
                        )}>
                          <span className={statusColors.icon}>{getStatusIcon(batch.status)}</span>
                          {getStatusText(batch.status)}
                        </div>
                      </div>
                    </div>

                    {/* Journey timeline — the batch's stages at a glance */}
                    <div className="mt-4">
                      <BatchJourneyTimeline
                        status={batch.status}
                        shippingType={batch.shippingType}
                        createdAt={batch.createdAt}
                        departureDate={batch.departureDate}
                        estimatedArrival={batch.estimatedArrival}
                        actualArrival={batch.actualArrival}
                        language={language}
                        isDark={isDark}
                      />
                      <div className="mt-2 flex justify-end">
                        <WhatsAppHelpButton
                          language={language}
                          section={language === "ku" ? "بارەکان" : language === "ar" ? "الشحنات" : language === "zh" ? "货运" : "Shipments"}
                          topic={`${batch.batchCode} — ${getStatusText(batch.status)}`}
                        />
                      </div>
                    </div>

                    {/* Route Indicator */}
                    <div className="flex items-center gap-2 mt-4 px-2">
                      <div className={cn("flex items-center gap-1 text-sm", isDark ? "text-slate-400" : "text-slate-500")}>
                        <span className="text-lg">🇨🇳</span>
                        <span>{language === "ku" ? "چین" : language === "ar" ? "الصين" : "China"}</span>
                      </div>
                      <div className={cn(
                        "flex-1 border-t-2 border-dashed relative",
                        isDark ? "border-slate-600" : "border-slate-200"
                      )}>
                        <div className={cn(
                          "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center",
                          batch.status === "in_transit" 
                            ? "bg-blue-500 text-white animate-pulse" 
                            : batch.status === "delivered" || batch.status === "closed"
                              ? "bg-emerald-500 text-white"
                              : (isDark ? "bg-slate-600 text-slate-400" : "bg-slate-200 text-slate-500")
                        )}>
                          {batch.status === "in_transit" ? (
                            <Plane className="w-3 h-3" />
                          ) : batch.status === "delivered" || batch.status === "closed" ? (
                            <CheckCircle className="w-3 h-3" />
                          ) : (
                            <Clock className="w-3 h-3" />
                          )}
                        </div>
                      </div>
                      <div className={cn("flex items-center gap-1 text-sm", isDark ? "text-slate-400" : "text-slate-500")}>
                        <span className="text-lg">🇮🇶</span>
                        <span>{language === "ku" ? "عێراق" : language === "ar" ? "العراق" : "Iraq"}</span>
                      </div>
                    </div>

                    {/* Bottom Stats */}
                    <div className={cn(
                      "flex items-center justify-between mt-4 pt-3 border-t",
                      isDark ? "border-slate-700" : "border-slate-100"
                    )}>
                      <div className="flex items-center gap-4">
                        <div className={cn("flex items-center gap-1.5 text-sm", isDark ? "text-slate-400" : "text-slate-500")}>
                          <Package className="w-4 h-4" />
                          <span>{batch.customerPackageCount} {language === "ku" ? "پاکەت" : language === "ar" ? "طرد" : "pkgs"}</span>
                        </div>
                        {batch.totalWeight && (
                          <div className={cn("flex items-center gap-1.5 text-sm", isDark ? "text-slate-400" : "text-slate-500")}>
                            <span>⚖️</span>
                            <span>{batch.totalWeight} kg</span>
                          </div>
                        )}
                      </div>
                      
                      {(() => {
                        // Staff-set ETA, or a derived range from departure +
                        // shipping type (air 7–14d, sea 30–45d) when unset.
                        const eta = getBatchEta(batch);
                        if (eta) {
                          return (
                            <div className={cn(
                              "text-xs font-medium px-2 py-1 rounded-full",
                              isDark ? "bg-blue-900/50 text-blue-400" : "bg-blue-50 text-blue-600"
                            )}>
                              {language === "ku" ? "گەیشتن: " : language === "ar" ? "الوصول: " : language === "zh" ? "预计: " : "ETA: "}
                              {formatBatchEta(eta)}
                            </div>
                          );
                        }
                        return batch.createdAt ? (
                          <div className={cn("text-xs", isDark ? "text-slate-500" : "text-slate-400")}>
                            {new Date(batch.createdAt).toLocaleDateString()}
                          </div>
                        ) : null;
                      })()}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Unbatched Packages Section */}
        {unbatchedPackages && unbatchedPackages.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center gap-2 mb-3">
              <Box className={cn("w-5 h-5", isDark ? "text-amber-400" : "text-amber-600")} />
              <h3 className={cn("font-bold", isDark ? "text-white" : "text-slate-800")}>
                {language === "ku" ? "پاکەتە چاوەڕوانەکان" : language === "ar" ? "الطرود المعلقة" : "Pending Packages"}
              </h3>
            </div>
            <div className={cn(
              "rounded-2xl p-4 border",
              isDark 
                ? "bg-gradient-to-r from-amber-900/30 to-yellow-900/30 border-amber-800" 
                : "bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200"
            )}>
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center",
                  isDark ? "bg-amber-900/50" : "bg-amber-100"
                )}>
                  <AlertTriangle className={cn("w-5 h-5", isDark ? "text-amber-400" : "text-amber-600")} />
                </div>
                <div>
                  <p className={cn("font-medium", isDark ? "text-amber-300" : "text-amber-800")}>
                    {unbatchedPackages.length} {language === "ku" ? "پاکەت چاوەڕوانی باچن" : language === "ar" ? "طرد بانتظار التجميع" : "packages waiting to be batched"}
                  </p>
                  <p className={cn("text-sm", isDark ? "text-amber-400/70" : "text-amber-600")}>
                    {language === "ku" ? "بەم زووانە زیاد دەکرێن" : language === "ar" ? "سيتم إضافتها إلى دفعة قريباً" : "Will be added to a batch soon"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </CustomerPortalLayout>
  );
}

export default function PortalShipments() {
  const { portalTheme } = usePortalTheme();
  
  if (portalTheme === "skin3") return <Skin3PortalShipments />;
  if (portalTheme === "modern") return <ModernPortalShipments />;
  return <ClassicPortalShipments />;
}
