import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import { ModernPortalLayout } from "@/components/ModernPortalLayout";
import { 
  Package, ChevronRight, Truck, CheckCircle, Clock, AlertCircle, 
  Plane, Ship, Box, AlertTriangle, Search, Filter, X, Calendar,
  ArrowUpDown, Download, Share2, MapPin, Eye
} from "lucide-react";
import { Link, useSearch } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

type StatusFilter = "all" | "in_transit" | "delivered" | "preparing";
type ShippingFilter = "all" | "air_regular" | "sea" | "air_irregular";
type SortOption = "newest" | "oldest" | "status";

export default function ModernPortalShipments() {
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const isRTL = language === "ku" || language === "ar";
  
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const initialStatus = (urlParams.get("status") as StatusFilter) || "all";
  
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialStatus);
  const [shippingType, setShippingType] = useState<ShippingFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [showFilters, setShowFilters] = useState(false);
  
  const { data: batches, isLoading } = trpc.customerPortal.getMyBatches.useQuery();
  const { data: unbatchedPackages } = trpc.customerPortal.getMyUnbatchedPackages.useQuery();

  const filteredBatches = useMemo(() => {
    let result = batches || [];
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(batch => 
        batch.batchCode?.toLowerCase().includes(query)
      );
    }
    
    if (statusFilter !== "all") {
      result = result.filter(batch => {
        if (statusFilter === "in_transit") return batch.status === "in_transit";
        if (statusFilter === "delivered") return ["delivered", "closed"].includes(batch.status);
        if (statusFilter === "preparing") return ["preparing", "arrived", "customs"].includes(batch.status);
        return true;
      });
    }
    
    if (shippingType !== "all") {
      result = result.filter(batch => batch.shippingType === shippingType);
    }
    
    result = [...result].sort((a, b) => {
      if (sortBy === "newest") {
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      }
      if (sortBy === "oldest") {
        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      }
      const statusPriority: Record<string, number> = {
        in_transit: 1, customs: 2, arrived: 3, preparing: 4, delivered: 5, closed: 6
      };
      return (statusPriority[a.status] || 99) - (statusPriority[b.status] || 99);
    });
    
    return result;
  }, [batches, searchQuery, statusFilter, shippingType, sortBy]);

  const getProgressPercentage = (status: string) => {
    switch (status) {
      case "preparing": return 20;
      case "in_transit": return 50;
      case "arrived": return 70;
      case "customs": return 80;
      case "delivered": case "closed": return 100;
      default: return 10;
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "delivered":
      case "closed":
        return { 
          gradient: "from-emerald-500 to-teal-600",
          bg: "bg-emerald-500/10",
          text: "text-emerald-500",
          icon: CheckCircle
        };
      case "in_transit":
        return { 
          gradient: "from-blue-500 to-cyan-600",
          bg: "bg-blue-500/10",
          text: "text-blue-500",
          icon: Truck
        };
      case "customs":
        return { 
          gradient: "from-amber-500 to-orange-600",
          bg: "bg-amber-500/10",
          text: "text-amber-500",
          icon: AlertCircle
        };
      default:
        return { 
          gradient: "from-slate-500 to-slate-600",
          bg: "bg-slate-500/10",
          text: "text-slate-500",
          icon: Clock
        };
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
    return status.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
  };

  const statusFilters = [
    { value: "all", label: language === "ku" ? "هەموو" : "All" },
    { value: "in_transit", label: language === "ku" ? "لە ڕێگادا" : "In Transit" },
    { value: "preparing", label: language === "ku" ? "چاوەڕوان" : "Pending" },
    { value: "delivered", label: language === "ku" ? "گەیشتووە" : "Delivered" },
  ];

  const shippingFilters = [
    { value: "all", label: language === "ku" ? "هەموو" : "All" },
    { value: "air_regular", label: language === "ku" ? "فڕۆکە" : "Air", icon: Plane },
    { value: "sea", label: language === "ku" ? "دەریا" : "Sea", icon: Ship },
  ];

  return (
    <ModernPortalLayout>
      <div className={cn("min-h-screen pb-8", isRTL && "rtl")}>
        {/* Header */}
        <div className={cn(
          "relative overflow-hidden",
          isDark 
            ? "bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950" 
            : "bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700"
        )}>
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute top-40 -left-20 w-40 h-40 rounded-full bg-emerald-400/20 blur-2xl" />
          </div>

          <div className="relative px-6 pt-12 pb-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-white font-bold text-2xl">
                  {language === "ku" ? "بارەکانم" : "My Shipments"}
                </h1>
                <p className="text-white/70 text-sm mt-1">
                  {language === "ku" ? "شوێنکەوتنی هەموو بارەکانت" : "Track all your shipments"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setShowFilters(!showFilters)}
                  className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                    showFilters 
                      ? "bg-white text-emerald-600" 
                      : "bg-white/20 text-white"
                  )}
                >
                  <Filter className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Search Bar */}
            <div className={cn(
              "relative rounded-2xl overflow-hidden",
              "bg-white/10 backdrop-blur-xl border border-white/20"
            )}>
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
              <input
                type="text"
                placeholder={language === "ku" ? "گەڕان بە کۆدی باچ..." : "Search by batch code..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(
                  "w-full bg-transparent py-4 px-12 text-white placeholder:text-white/50",
                  "focus:outline-none"
                )}
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery("")}
                  className="absolute right-4 top-1/2 -translate-y-1/2"
                >
                  <X className="w-5 h-5 text-white/50" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className={cn(
                "px-6 py-4 border-b",
                isDark ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-200"
              )}>
                {/* Status Filters */}
                <div className="mb-4">
                  <p className={cn(
                    "text-xs font-medium mb-2",
                    isDark ? "text-slate-400" : "text-slate-500"
                  )}>
                    {language === "ku" ? "بارودۆخ" : "Status"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {statusFilters.map((filter) => (
                      <button
                        key={filter.value}
                        onClick={() => setStatusFilter(filter.value as StatusFilter)}
                        className={cn(
                          "px-4 py-2 rounded-xl text-sm font-medium transition-all",
                          statusFilter === filter.value
                            ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30"
                            : isDark 
                              ? "bg-slate-800 text-slate-300 hover:bg-slate-700" 
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        )}
                      >
                        {filter.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Shipping Type Filters */}
                <div>
                  <p className={cn(
                    "text-xs font-medium mb-2",
                    isDark ? "text-slate-400" : "text-slate-500"
                  )}>
                    {language === "ku" ? "جۆری گواستنەوە" : "Shipping Type"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {shippingFilters.map((filter) => (
                      <button
                        key={filter.value}
                        onClick={() => setShippingType(filter.value as ShippingFilter)}
                        className={cn(
                          "px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2",
                          shippingType === filter.value
                            ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30"
                            : isDark 
                              ? "bg-slate-800 text-slate-300 hover:bg-slate-700" 
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        )}
                      >
                        {filter.icon && <filter.icon className="w-4 h-4" />}
                        {filter.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content */}
        <div className="px-6 py-6">
          {/* Stats Summary */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { 
                label: language === "ku" ? "کۆی گشتی" : "Total", 
                value: batches?.length || 0,
                gradient: "from-violet-500 to-purple-600"
              },
              { 
                label: language === "ku" ? "لە ڕێگادا" : "In Transit", 
                value: batches?.filter(b => b.status === "in_transit").length || 0,
                gradient: "from-blue-500 to-cyan-600"
              },
              { 
                label: language === "ku" ? "گەیشتووە" : "Delivered", 
                value: batches?.filter(b => ["delivered", "closed"].includes(b.status)).length || 0,
                gradient: "from-emerald-500 to-teal-600"
              },
            ].map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={cn(
                  "relative overflow-hidden rounded-2xl p-4",
                  isDark 
                    ? "bg-slate-800/50 border border-slate-700/50" 
                    : "bg-white border border-slate-200/50",
                  "backdrop-blur-xl"
                )}
              >
                <div className={cn(
                  "absolute top-0 left-0 right-0 h-1 bg-gradient-to-r",
                  stat.gradient
                )} />
                <p className={cn(
                  "text-2xl font-bold",
                  isDark ? "text-white" : "text-slate-900"
                )}>
                  {stat.value}
                </p>
                <p className={cn(
                  "text-xs",
                  isDark ? "text-slate-400" : "text-slate-500"
                )}>
                  {stat.label}
                </p>
              </motion.div>
            ))}
          </div>

          {/* Batch List */}
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32 w-full rounded-2xl" />
              ))}
            </div>
          ) : filteredBatches.length > 0 ? (
            <div className="space-y-4">
              {filteredBatches.map((batch: any, index) => {
                const statusConfig = getStatusConfig(batch.status);
                const StatusIcon = statusConfig.icon;
                const progress = getProgressPercentage(batch.status);
                
                return (
                  <motion.div
                    key={batch.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Link href={`/portal/shipments/${batch.id}`}>
                      <div className={cn(
                        "relative overflow-hidden rounded-2xl p-4 transition-all duration-300",
                        isDark 
                          ? "bg-slate-800/50 border border-slate-700/50 hover:bg-slate-800/70" 
                          : "bg-white border border-slate-200/50 hover:shadow-lg",
                        "backdrop-blur-xl cursor-pointer"
                      )}>
                        {/* Progress bar at top */}
                        <div className="absolute top-0 left-0 right-0 h-1 bg-slate-200 dark:bg-slate-700">
                          <div 
                            className={cn("h-full bg-gradient-to-r transition-all duration-500", statusConfig.gradient)}
                            style={{ width: `${progress}%` }}
                          />
                        </div>

                        <div className="flex items-start gap-4 mt-2">
                          {/* Icon */}
                          <div className={cn(
                            "w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br",
                            statusConfig.gradient
                          )}>
                            {batch.shippingType?.includes("sea") ? (
                              <Ship className="w-6 h-6 text-white" />
                            ) : (
                              <Plane className="w-6 h-6 text-white" />
                            )}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <h3 className={cn(
                                "font-bold",
                                isDark ? "text-white" : "text-slate-900"
                              )}>
                                {batch.batchCode || `B-${batch.id}`}
                              </h3>
                              <span className={cn(
                                "px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1",
                                statusConfig.bg, statusConfig.text
                              )}>
                                <StatusIcon className="w-3 h-3" />
                                {getStatusText(batch.status)}
                              </span>
                            </div>

                            <div className="flex items-center gap-4 text-sm">
                              <span className={cn(
                                "flex items-center gap-1",
                                isDark ? "text-slate-400" : "text-slate-500"
                              )}>
                                <Package className="w-4 h-4" />
                                {batch.customerPackageCount || 0} {language === "ku" ? "بار" : "pkgs"}
                              </span>
                              <span className={cn(
                                "flex items-center gap-1",
                                isDark ? "text-slate-400" : "text-slate-500"
                              )}>
                                <Calendar className="w-4 h-4" />
                                {new Date(batch.createdAt).toLocaleDateString()}
                              </span>
                            </div>

                            {batch.estimatedArrival && (
                              <p className={cn(
                                "text-xs mt-2",
                                isDark ? "text-slate-500" : "text-slate-400"
                              )}>
                                {language === "ku" ? "گەیشتنی چاوەڕوانکراو:" : "ETA:"} {new Date(batch.estimatedArrival).toLocaleDateString()}
                              </p>
                            )}
                          </div>

                          <ChevronRight className={cn(
                            "w-5 h-5",
                            isDark ? "text-slate-600" : "text-slate-300"
                          )} />
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "rounded-3xl p-8 text-center",
                isDark 
                  ? "bg-slate-800/50 border border-slate-700/50" 
                  : "bg-white border border-slate-200/50"
              )}
            >
              <Package className={cn(
                "w-16 h-16 mx-auto mb-4",
                isDark ? "text-slate-600" : "text-slate-300"
              )} />
              <h3 className={cn(
                "font-bold text-lg mb-2",
                isDark ? "text-white" : "text-slate-900"
              )}>
                {language === "ku" ? "هیچ بارێک نییە" : "No shipments found"}
              </h3>
              <p className={cn(
                "text-sm",
                isDark ? "text-slate-500" : "text-slate-400"
              )}>
                {language === "ku" 
                  ? "کاتێک بارت هەبێت لێرە دەردەکەوێت" 
                  : "Your shipments will appear here"}
              </p>
            </motion.div>
          )}

          {/* Unbatched Packages Alert */}
          {unbatchedPackages && unbatchedPackages.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "mt-6 rounded-2xl p-4",
                isDark 
                  ? "bg-amber-900/20 border border-amber-700/50" 
                  : "bg-amber-50 border border-amber-200"
              )}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className={cn(
                    "font-medium",
                    isDark ? "text-amber-400" : "text-amber-700"
                  )}>
                    {unbatchedPackages.length} {language === "ku" ? "پاکەت چاوەڕوانی باچن" : "packages waiting"}
                  </p>
                  <p className={cn(
                    "text-sm",
                    isDark ? "text-amber-400/70" : "text-amber-600"
                  )}>
                    {language === "ku" ? "بەم زووانە زیاد دەکرێن" : "Will be added to a batch soon"}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </ModernPortalLayout>
  );
}
