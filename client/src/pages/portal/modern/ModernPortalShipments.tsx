import { ChinaDepotList, useChinaDepotItems } from "@/components/portal/ChinaDepotList";
import { STATUS_LABEL, matchesStage, type ShipmentStage } from "@/lib/shipmentFilters";
import { pickLang } from "@/lib/lang";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import { ModernPortalLayout } from "@/components/ModernPortalLayout";
import {
  Package,
  ChevronRight,
  ChevronDown,
  Truck,
  CheckCircle,
  Clock,
  AlertCircle,
  Plane,
  Ship,
  AlertTriangle,
  Search,
  X,
  Calendar,
  Weight,
  DollarSign,
  Box,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { BatchJourneyTimeline } from "@/components/portal/BatchJourneyTimeline";
import { WhatsAppHelpButton } from "@/components/portal/WhatsAppHelpButton";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useSearch } from "wouter";
import { formatPortalDate } from "@/lib/portalClock";
import { PortalErrorState } from "@/components/portal/PortalErrorState";

type StatusFilter = "all" | ShipmentStage;

export default function ModernPortalShipments() {
  const { language } = useLanguage();

  const chinaDepotItems = useChinaDepotItems();

  // Shared wording, so this skin cannot drift from the others.

  const statusLabel = (status: string) => {

    const label = STATUS_LABEL[status as keyof typeof STATUS_LABEL];

    return label ? pickLang(language, label) : (status?.replace(/_/g, " ") || "—");

  };
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const isRTL = language === "ku" || language === "ar";

  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const initialStatus = (urlParams.get("status") as StatusFilter) || "all";

  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialStatus);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedBatchId, setExpandedBatchId] = useState<number | null>(null);
  const [trackingSearch, setTrackingSearch] = useState("");

  // tRPC queries
  const batchesQuery = trpc.customerPortal.getMyBatches.useQuery();
  const { data: batches, isLoading } = batchesQuery;
  const { data: unbatchedPackages } =
    trpc.customerPortal.getMyUnbatchedPackages.useQuery();
  const { data: batchPackages, isLoading: batchPackagesLoading } =
    trpc.customerPortal.getMyPackagesInBatch.useQuery(
      { batchId: expandedBatchId! },
      { enabled: expandedBatchId !== null }
    );
  const { data: searchResult, isLoading: searchLoading } =
    trpc.customerPortal.searchPackage.useQuery(
      { trackingNumber: trackingSearch },
      { enabled: trackingSearch.length >= 3 }
    );

  // Filter batches
  const filteredBatches = useMemo(() => {
    let result = batches || [];

    // One box searches two things: a batch code, and a tracking number looked
    // up as a package. It only matched batch codes, so typing a tracking
    // number emptied the list — the customer saw the green "found" card and,
    // directly beneath it, "no shipments". Matching the found package's own
    // batch shows the shipment it is travelling in.
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const foundBatchId = (searchResult as any)?.batchId ?? null;
      result = result.filter((batch: any) =>
        batch.batchCode?.toLowerCase().includes(query) ||
        (foundBatchId !== null && batch.id === foundBatchId)
      );
    }

    if (statusFilter !== "all") {
      result = result.filter((batch: any) => matchesStage(batch.status, statusFilter));
    }

    return [...result].sort(
      (a: any, b: any) =>
        new Date(b.createdAt || 0).getTime() -
        new Date(a.createdAt || 0).getTime()
    );
  }, [batches, searchQuery, statusFilter, searchResult]);

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "delivered":
      case "closed":
        return {
          label: statusLabel("delivered"),
          color: "text-emerald-600 dark:text-emerald-400",
          bg: "bg-emerald-50 dark:bg-emerald-950/40",
          border: "border-emerald-200 dark:border-emerald-800",
          icon: CheckCircle,
        };
      case "in_transit":
        return {
          label: statusLabel("in_transit"),
          color: "text-blue-600 dark:text-blue-400",
          bg: "bg-blue-50 dark:bg-blue-950/40",
          border: "border-blue-200 dark:border-blue-800",
          icon: Truck,
        };
      case "arrived":
        return {
          label: statusLabel("arrived"),
          color: "text-violet-600 dark:text-violet-400",
          bg: "bg-violet-50 dark:bg-violet-950/40",
          border: "border-violet-200 dark:border-violet-800",
          icon: Package,
        };
      case "customs":
        return {
          label: statusLabel("customs"),
          color: "text-amber-600 dark:text-amber-400",
          bg: "bg-amber-50 dark:bg-amber-950/40",
          border: "border-amber-200 dark:border-amber-800",
          icon: AlertCircle,
        };
      case "preparing":
        return {
          label: statusLabel("preparing"),
          color: "text-gray-600 dark:text-gray-400",
          bg: "bg-gray-50 dark:bg-gray-950/40",
          border: "border-gray-200 dark:border-gray-800",
          icon: Clock,
        };
      default:
        return {
          label: statusLabel(status),
          color: "text-gray-600 dark:text-gray-400",
          bg: "bg-gray-50 dark:bg-gray-950/40",
          border: "border-gray-200 dark:border-gray-800",
          icon: Clock,
        };
    }
  };

  const getPackageStatusConfig = (status: string) => {
    switch (status) {
      case "delivered":
        return {
          label: statusLabel("delivered"),
          color: "text-emerald-600 dark:text-emerald-400",
          bg: "bg-emerald-50 dark:bg-emerald-950/40",
        };
      case "in_transit":
        return {
          label: statusLabel("in_transit"),
          color: "text-blue-600 dark:text-blue-400",
          bg: "bg-blue-50 dark:bg-blue-950/40",
        };
      case "arrived":
        return {
          label: statusLabel("arrived"),
          color: "text-violet-600 dark:text-violet-400",
          bg: "bg-violet-50 dark:bg-violet-950/40",
        };
      case "scanned":
        return {
          label: pickLang(language, { ku: "سکان کراو", en: "Scanned", ar: "تم المسح", zh: "已扫描" }),
          color: "text-cyan-600 dark:text-cyan-400",
          bg: "bg-cyan-50 dark:bg-cyan-950/40",
        };
      default:
        return {
          label: statusLabel(status),
          color: "text-gray-600 dark:text-gray-400",
          bg: "bg-gray-50 dark:bg-gray-950/40",
        };
    }
  };

  const segmentedTabs: { value: StatusFilter; label: string }[] = [
    { value: "all", label: pickLang(language, { ku: "هەموو", en: "All", ar: "الكل", zh: "全部" }) },
    { value: "in_china", label: pickLang(language, { ku: "لە چین", en: "In China", ar: "في الصين", zh: "在中国" }) },
    { value: "in_transit", label: pickLang(language, { ku: "لەڕێگا", en: "On the way", ar: "في الطريق", zh: "运输中" }) },
    { value: "delivered", label: pickLang(language, { ku: "گەیاندرا", en: "Delivered", ar: "تم التسليم", zh: "已送达" }) },
  ];

  const handleBatchToggle = (batchId: number) => {
    setExpandedBatchId(expandedBatchId === batchId ? null : batchId);
  };

  const handleTrackingSearch = (value: string) => {
    setSearchQuery(value);
    if (value.length >= 3) {
      setTrackingSearch(value);
    } else {
      setTrackingSearch("");
    }
  };

  return (
    <ModernPortalLayout>
      <div className={cn("min-h-screen pb-8", isRTL && "rtl")}>
        {/* Header */}
        <div className="px-5 pt-12 pb-2">
          <h1
            className={cn(
              "text-2xl font-bold tracking-tight mb-1",
              isDark ? "text-white" : "text-gray-900 dark:text-gray-200"
            )}
          >
            {pickLang(language, { ku: "بارەکانم", en: "My Shipments", ar: "شحناتي", zh: "我的运单" })}
          </h1>
          <p className={cn("text-sm", isDark ? "text-zinc-500" : "text-gray-500")}>
            {pickLang(language, { ku: "شوێنکەوتنی هەموو بارەکانت", en: "Track all your shipments", ar: "تتبّع كل شحناتك", zh: "追踪您的所有运单" })}
          </p>
        </div>

        {/* Search Bar */}
        <div className="px-5 py-3">
          <div
            className={cn(
              "relative rounded-2xl overflow-hidden shadow-sm",
              isDark
                ? "bg-zinc-900 border border-zinc-800"
                : "bg-white border border-gray-200 dark:border-gray-800/60"
            )}
          >
            <Search
              className={cn(
                "absolute start-4 top-1/2 -translate-y-1/2 w-5 h-5",
                isDark ? "text-zinc-500" : "text-gray-400"
              )}
            />
            <input
              type="text"
              placeholder={
                pickLang(language, { ku: "گەڕان بە ژمارەی تراکینگ...", en: "Search by tracking number...", ar: "ابحث برقم التتبع...", zh: "按运单号搜索..." })
              }
              value={searchQuery}
              onChange={(e) => handleTrackingSearch(e.target.value)}
              className={cn(
                "w-full bg-transparent py-3.5 text-sm",
                isRTL ? "pe-4 ps-12" : "ps-12 pe-10",
                isDark
                  ? "text-white placeholder:text-zinc-500"
                  : "text-gray-900 dark:text-gray-200 placeholder:text-gray-400",
                "focus:outline-none"
              )}
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setTrackingSearch("");
                }}
                className="absolute end-3 top-1/2 -translate-y-1/2"
              >
                <X
                  className={cn(
                    "w-5 h-5",
                    isDark ? "text-zinc-500" : "text-gray-400"
                  )}
                />
              </button>
            )}
          </div>
        </div>

        {/* Search Result (when searching by tracking number) */}
        <AnimatePresence>
          {trackingSearch.length >= 3 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="px-5 mb-3 overflow-hidden"
            >
              {searchLoading ? (
                <Skeleton className="h-20 w-full rounded-2xl" />
              ) : searchResult ? (
                <div
                  className={cn(
                    "rounded-2xl p-4 shadow-sm",
                    isDark
                      ? "bg-emerald-950/30 border border-emerald-800/50"
                      : "bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          "text-sm font-semibold truncate",
                          isDark ? "text-white" : "text-gray-900 dark:text-gray-200"
                        )}
                      >
                        {(searchResult as any).trackingNumber || (searchResult as any).packageCode}
                      </p>
                      <p className="text-xs text-emerald-600 dark:text-emerald-400">
                        {pickLang(language, { ku: "دۆزرایەوە!", en: "Found!", ar: "تم العثور عليه!", zh: "已找到！" })}
                        {" — "}
                        {getPackageStatusConfig((searchResult as any).status).label}
                      </p>
                    </div>
                    <span className="text-sm font-mono font-semibold text-emerald-700 dark:text-emerald-300">
                      {Number((searchResult as any).weightKg || 0).toFixed(1)} kg
                    </span>
                  </div>
                </div>
              ) : (
                <div
                  className={cn(
                    "rounded-2xl p-4 text-center",
                    isDark
                      ? "bg-zinc-900 border border-zinc-800"
                      : "bg-gray-50 dark:bg-gray-950/40 border border-gray-200 dark:border-gray-800/60"
                  )}
                >
                  <p
                    className={cn(
                      "text-sm",
                      isDark ? "text-zinc-500" : "text-gray-400"
                    )}
                  >
                    {pickLang(language, { ku: "هیچ نەدۆزرایەوە", en: "No package found", ar: "لم يُعثر على طرد", zh: "未找到包裹" })}
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Segmented Control Tabs */}
        <div className="px-5 mb-4">
          <div
            className={cn(
              "flex rounded-2xl p-1 shadow-sm",
              isDark
                ? "bg-zinc-900 border border-zinc-800"
                : "bg-gray-100 dark:bg-gray-950/40"
            )}
          >
            {segmentedTabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={cn(
                  "flex-1 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                  statusFilter === tab.value
                    ? cn(
                        "shadow-sm",
                        isDark
                          ? "bg-emerald-600 text-white"
                          : "bg-white text-emerald-700 dark:text-emerald-300 shadow-sm"
                      )
                    : isDark
                      ? "text-zinc-400 hover:text-zinc-300"
                      : "text-gray-500 hover:text-gray-700"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Batch List */}
        <div className="px-5">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-28 w-full rounded-2xl" />
              ))}
            </div>
          ) : batchesQuery.isError ? (
            /* A failed request used to fall through to the empty state, so a
               dropped connection told the customer they had nothing. */
            <PortalErrorState onRetry={() => void batchesQuery.refetch()} isRetrying={batchesQuery.isFetching} />
          ) : filteredBatches.length > 0 ? (
            <div className="space-y-3">
              {filteredBatches.map((batch: any, index: number) => {
                const statusConfig = getStatusConfig(batch.status);
                const StatusIcon = statusConfig.icon;
                const isExpanded = expandedBatchId === batch.id;

                return (
                  <motion.div
                    key={batch.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.04, duration: 0.3 }}
                  >
                    {/* Batch Card */}
                    <div
                      className={cn(
                        "rounded-2xl overflow-hidden shadow-sm transition-all duration-200",
                        isDark
                          ? "bg-zinc-900 border border-zinc-800"
                          : "bg-white border border-gray-100 dark:border-gray-800/60",
                        isExpanded && (isDark ? "ring-1 ring-emerald-800" : "ring-1 ring-emerald-200")
                      )}
                    >
                      {/* Batch Header - clickable */}
                      <button
                        onClick={() => handleBatchToggle(batch.id)}
                        className="w-full text-start p-4"
                      >
                        <div className="flex items-start gap-3">
                          {/* Shipping type icon */}
                          <div
                            className={cn(
                              "w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0",
                              statusConfig.bg
                            )}
                          >
                            {batch.shippingType?.includes("sea") ? (
                              <Ship className={cn("w-5 h-5", statusConfig.color)} />
                            ) : (
                              <Plane className={cn("w-5 h-5", statusConfig.color)} />
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <h3
                                className={cn(
                                  "font-bold text-sm",
                                  isDark ? "text-white" : "text-gray-900 dark:text-gray-200"
                                )}
                              >
                                {batch.batchCode || `B-${batch.id}`}
                              </h3>
                              <span
                                className={cn(
                                  "px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1",
                                  statusConfig.bg,
                                  statusConfig.color
                                )}
                              >
                                <StatusIcon className="w-3 h-3" />
                                {statusConfig.label}
                              </span>
                            </div>

                            <div className="flex items-center gap-3 text-xs">
                              <span
                                className={cn(
                                  "flex items-center gap-1",
                                  isDark ? "text-zinc-500" : "text-gray-500"
                                )}
                              >
                                <Box className="w-3.5 h-3.5" />
                                {batch.customerPackageCount || 0}{" "}
                                {pickLang(language, { ku: "بار", en: "pkgs", ar: "طرود", zh: "件" })}
                              </span>
                              <span
                                className={cn(
                                  "flex items-center gap-1",
                                  isDark ? "text-zinc-500" : "text-gray-500"
                                )}
                              >
                                <Calendar className="w-3.5 h-3.5" />
                                {formatPortalDate(batch.createdAt, language)}
                              </span>
                            </div>

                            {batch.estimatedArrival && (
                              <p
                                className={cn(
                                  "text-[11px] mt-1.5",
                                  isDark ? "text-zinc-600" : "text-gray-400"
                                )}
                              >
                                {pickLang(language, { ku: "گەیشتنی چاوەڕوانکراو:", en: "ETA:", ar: "الوصول المتوقع:", zh: "预计到达：" })}{" "}
                                {formatPortalDate(batch.estimatedArrival, language)}
                              </p>
                            )}
                          </div>

                          {/* Expand arrow */}
                          <motion.div
                            animate={{ rotate: isExpanded ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                            className="mt-1"
                          >
                            <ChevronDown
                              className={cn(
                                "w-5 h-5",
                                isDark ? "text-zinc-600" : "text-gray-400"
                              )}
                            />
                          </motion.div>
                        </div>
                      </button>

                      {/* Journey timeline — the batch's stages at a glance */}
                      <div className="px-4 pb-3">
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
                            topic={`${batch.batchCode || `B-${batch.id}`} — ${statusConfig.label}`}
                          />
                        </div>
                      </div>

                      {/* Expanded: Packages inside this batch */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className="overflow-hidden"
                          >
                            <div
                              className={cn(
                                "border-t px-4 pb-3 pt-2",
                                isDark ? "border-zinc-800" : "border-gray-100 dark:border-gray-800/60"
                              )}
                            >
                              {batchPackagesLoading ? (
                                <div className="space-y-2 py-2">
                                  {[1, 2].map((i) => (
                                    <Skeleton
                                      key={i}
                                      className="h-16 w-full rounded-xl"
                                    />
                                  ))}
                                </div>
                              ) : batchPackages && batchPackages.length > 0 ? (
                                <div className="space-y-2 pt-1">
                                  {batchPackages.map((pkg: any) => {
                                    const pkgStatus = getPackageStatusConfig(
                                      pkg.status
                                    );
                                    return (
                                      <div
                                        key={pkg.id}
                                        className={cn(
                                          "rounded-xl p-3",
                                          isDark
                                            ? "bg-zinc-800/60"
                                            : "bg-gray-50 dark:bg-gray-950/40"
                                        )}
                                      >
                                        {/* Warehouse photos taken at registration */}
                                        {Array.isArray(pkg.photos) && pkg.photos.length > 0 && (
                                          <div className="flex gap-1.5 mb-2 overflow-x-auto">
                                            {pkg.photos.slice(0, 4).map((photo: string, pi: number) => (
                                              <a key={pi} href={photo} target="_blank" rel="noopener noreferrer" className="shrink-0">
                                                <img
                                                  src={photo}
                                                  alt=""
                                                  loading="lazy"
                                                  className="h-14 w-14 rounded-lg object-cover ring-1 ring-black/5 dark:ring-white/10"
                                                />
                                              </a>
                                            ))}
                                          </div>
                                        )}
                                        <div className="flex items-center justify-between mb-1.5">
                                          <span
                                            className={cn(
                                              "text-sm font-mono font-semibold",
                                              isDark
                                                ? "text-white"
                                                : "text-gray-900 dark:text-gray-200"
                                            )}
                                          >
                                            {pkg.trackingNumber ||
                                              pkg.packageCode ||
                                              `PKG-${pkg.id}`}
                                          </span>
                                          <span
                                            className={cn(
                                              "text-[10px] font-semibold px-2 py-0.5 rounded-md",
                                              pkgStatus.bg,
                                              pkgStatus.color
                                            )}
                                          >
                                            {pkgStatus.label}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-4 text-xs">
                                          <span
                                            className={cn(
                                              "flex items-center gap-1",
                                              isDark
                                                ? "text-zinc-500"
                                                : "text-gray-500"
                                            )}
                                          >
                                            <Weight className="w-3 h-3" />
                                            {Number(
                                              pkg.weightKg || 0
                                            ).toFixed(1)}{" "}
                                            kg
                                          </span>
                                          {pkg.calculatedCostUsd > 0 && (
                                            <span
                                              className={cn(
                                                "flex items-center gap-1",
                                                isDark
                                                  ? "text-zinc-500"
                                                  : "text-gray-500"
                                              )}
                                            >
                                              <DollarSign className="w-3 h-3" />
                                              $
                                              {Number(
                                                pkg.calculatedCostUsd
                                              ).toFixed(2)}
                                            </span>
                                          )}
                                          {pkg.isFullPackage && (
                                            <span className="text-[10px] font-medium text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40 px-1.5 py-0.5 rounded">
                                              {pickLang(language, { ku: "فول پاکەج", en: "Full Pkg", ar: "الطلب الكامل", zh: "整包代购" })}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <p
                                  className={cn(
                                    "text-sm text-center py-4",
                                    isDark ? "text-zinc-600" : "text-gray-400"
                                  )}
                                >
                                  {pickLang(language, { ku: "هیچ بارێک نییە", en: "No packages in this batch", ar: "لا توجد طرود في هذه الدفعة", zh: "此批次没有包裹" })}
                                </p>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "rounded-2xl p-10 text-center shadow-sm",
                isDark
                  ? "bg-zinc-900 border border-zinc-800"
                  : "bg-white border border-gray-100 dark:border-gray-800/60"
              )}
            >
              <Package
                className={cn(
                  "w-14 h-14 mx-auto mb-3",
                  isDark ? "text-zinc-700 dark:text-zinc-300" : "text-gray-300"
                )}
              />
              <h3
                className={cn(
                  "font-bold text-base mb-1",
                  isDark ? "text-white" : "text-gray-900 dark:text-gray-200"
                )}
              >
                {pickLang(language, { ku: "هیچ بارێک نییە", en: "No shipments found", ar: "لا توجد شحنات", zh: "没有运单" })}
              </h3>
              <p
                className={cn(
                  "text-sm",
                  isDark ? "text-zinc-500" : "text-gray-400"
                )}
              >
                {pickLang(language, { ku: "کاتێک بارت هەبێت لێرە دەردەکەوێت", en: "Your shipments will appear here", ar: "ستظهر شحناتك هنا", zh: "您的运单将显示在这里" })}
              </p>
            </motion.div>
          )}

          {/* Unbatched Packages Alert */}
          {/* The same China-depot list every skin shows: each parcel with
              its photo, tracking number and weight, rather than the bare
              amber count this used to be. */}
          <ChinaDepotList items={chinaDepotItems} isDark={isDark} />
        </div>
      </div>
    </ModernPortalLayout>
  );
}
