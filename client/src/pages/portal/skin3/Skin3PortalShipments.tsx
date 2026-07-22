import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import Skin3PortalLayout from "@/components/Skin3PortalLayout";
import {
  Package,
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
  PackageOpen,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { BatchJourneyTimeline } from "@/components/portal/BatchJourneyTimeline";
import { WhatsAppHelpButton } from "@/components/portal/WhatsAppHelpButton";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useSearch } from "wouter";

type StatusFilter = "all" | "in_transit" | "arrived" | "delivered";

export default function Skin3PortalShipments() {
  const { language } = useLanguage();
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

  // tRPC queries - same as ModernPortalShipments
  const { data: batches, isLoading } =
    trpc.customerPortal.getMyBatches.useQuery();
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

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((batch: any) =>
        batch.batchCode?.toLowerCase().includes(query)
      );
    }

    if (statusFilter !== "all") {
      result = result.filter((batch: any) => {
        if (statusFilter === "in_transit") return batch.status === "in_transit";
        if (statusFilter === "arrived")
          return ["arrived", "customs"].includes(batch.status);
        if (statusFilter === "delivered")
          return ["delivered", "closed"].includes(batch.status);
        return true;
      });
    }

    return [...result].sort(
      (a: any, b: any) =>
        new Date(b.createdAt || 0).getTime() -
        new Date(a.createdAt || 0).getTime()
    );
  }, [batches, searchQuery, statusFilter]);

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "delivered":
      case "closed":
        return {
          label: language === "ku" ? "گەیاندرا" : "Delivered",
          color: isDark ? "text-emerald-400" : "text-emerald-700",
          bg: isDark ? "bg-emerald-950/50" : "bg-emerald-100",
          pillBg: isDark
            ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
            : "bg-emerald-100 text-emerald-700 border-emerald-300",
          icon: CheckCircle,
        };
      case "in_transit":
        return {
          label: language === "ku" ? "لەڕێگا" : "In Transit",
          color: isDark ? "text-blue-400" : "text-blue-700",
          bg: isDark ? "bg-blue-950/50" : "bg-blue-100",
          pillBg: isDark
            ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
            : "bg-blue-100 text-blue-700 border-blue-300",
          icon: Truck,
        };
      case "arrived":
        return {
          label: language === "ku" ? "گەیشتوو" : "Arrived",
          color: isDark ? "text-violet-400" : "text-violet-700",
          bg: isDark ? "bg-violet-950/50" : "bg-violet-100",
          pillBg: isDark
            ? "bg-violet-500/20 text-violet-400 border-violet-500/30"
            : "bg-violet-100 text-violet-700 border-violet-300",
          icon: Package,
        };
      case "customs":
        return {
          label: language === "ku" ? "گومرگ" : "Customs",
          color: isDark ? "text-amber-400" : "text-amber-700",
          bg: isDark ? "bg-amber-950/50" : "bg-amber-100",
          pillBg: isDark
            ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
            : "bg-amber-100 text-amber-700 border-amber-300",
          icon: AlertCircle,
        };
      case "preparing":
        return {
          label: language === "ku" ? "ئامادەکاری" : "Preparing",
          color: isDark ? "text-gray-400" : "text-gray-600",
          bg: isDark ? "bg-gray-800/50" : "bg-gray-100",
          pillBg: isDark
            ? "bg-gray-500/20 text-gray-400 border-gray-500/30"
            : "bg-gray-100 text-gray-600 border-gray-300",
          icon: Clock,
        };
      default:
        return {
          label: status?.replace(/_/g, " ") || "Unknown",
          color: isDark ? "text-gray-400" : "text-gray-600",
          bg: isDark ? "bg-gray-800/50" : "bg-gray-100",
          pillBg: isDark
            ? "bg-gray-500/20 text-gray-400 border-gray-500/30"
            : "bg-gray-100 text-gray-600 border-gray-300",
          icon: Clock,
        };
    }
  };

  const getPackageStatusConfig = (status: string) => {
    switch (status) {
      case "delivered":
        return {
          label: language === "ku" ? "گەیاندرا" : "Delivered",
          color: isDark ? "text-emerald-400" : "text-emerald-700",
          bg: isDark ? "bg-emerald-500/20" : "bg-emerald-100",
        };
      case "in_transit":
        return {
          label: language === "ku" ? "لەڕێگا" : "In Transit",
          color: isDark ? "text-blue-400" : "text-blue-700",
          bg: isDark ? "bg-blue-500/20" : "bg-blue-100",
        };
      case "arrived":
        return {
          label: language === "ku" ? "گەیشتوو" : "Arrived",
          color: isDark ? "text-violet-400" : "text-violet-700",
          bg: isDark ? "bg-violet-500/20" : "bg-violet-100",
        };
      case "scanned":
        return {
          label: language === "ku" ? "سکان کراو" : "Scanned",
          color: isDark ? "text-cyan-400" : "text-cyan-700",
          bg: isDark ? "bg-cyan-500/20" : "bg-cyan-100",
        };
      default:
        return {
          label: status?.replace(/_/g, " ") || "---",
          color: isDark ? "text-gray-400" : "text-gray-600",
          bg: isDark ? "bg-gray-500/20" : "bg-gray-100",
        };
    }
  };

  const filterChips: { value: StatusFilter; label: string }[] = [
    { value: "all", label: language === "ku" ? "هەموو" : "All" },
    { value: "in_transit", label: language === "ku" ? "لەڕێگا" : "Transit" },
    { value: "arrived", label: language === "ku" ? "گەیشتوو" : "Arrived" },
    { value: "delivered", label: language === "ku" ? "گەیاندرا" : "Delivered" },
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
    <Skin3PortalLayout>
      <div className={cn("min-h-screen pb-8", isRTL && "rtl")}>
        {/* Header */}
        <div className="px-5 pt-12 pb-2">
          <h1
            className={cn(
              "text-3xl font-black tracking-tight mb-1",
              isDark ? "text-white" : "text-gray-950"
            )}
          >
            {language === "ku" ? "بارەکانم" : "My Shipments"}
          </h1>
          <p
            className={cn(
              "text-sm font-medium",
              isDark ? "text-zinc-500" : "text-gray-500"
            )}
          >
            {language === "ku"
              ? "شوێنکەوتنی هەموو بارەکانت"
              : "Track all your shipments"}
          </p>
        </div>

        {/* Search Bar with thick border */}
        <div className="px-5 py-3">
          <div
            className={cn(
              "relative rounded-xl overflow-hidden border-2 transition-all focus-within:border-indigo-500",
              isDark
                ? "bg-zinc-900 border-zinc-700/60"
                : "bg-white border-black/10 shadow-[4px_4px_0px_rgba(0,0,0,0.06)] focus-within:shadow-[4px_4px_0px_rgba(99,102,241,0.15)]"
            )}
          >
            <Search
              className={cn(
                "absolute top-1/2 -translate-y-1/2 w-5 h-5",
                isRTL ? "end-4" : "start-4",
                isDark ? "text-zinc-500" : "text-gray-400"
              )}
              strokeWidth={2.5}
            />
            <input
              type="text"
              placeholder={
                language === "ku"
                  ? "گەڕان بە ژمارەی تراکینگ..."
                  : "Search by tracking number..."
              }
              value={searchQuery}
              onChange={(e) => handleTrackingSearch(e.target.value)}
              className={cn(
                "w-full bg-transparent py-4 text-sm font-bold",
                isRTL ? "pe-4 ps-12" : "ps-12 pe-10",
                isDark
                  ? "text-white placeholder:text-zinc-600"
                  : "text-gray-900 placeholder:text-gray-400",
                "focus:outline-none"
              )}
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setTrackingSearch("");
                }}
                className={cn(
                  "absolute top-1/2 -translate-y-1/2",
                  isRTL ? "start-3" : "end-3"
                )}
              >
                <X
                  className={cn(
                    "w-5 h-5",
                    isDark ? "text-zinc-500" : "text-gray-400"
                  )}
                  strokeWidth={2.5}
                />
              </button>
            )}
          </div>
        </div>

        {/* Search Result */}
        <AnimatePresence>
          {trackingSearch.length >= 3 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="px-5 mb-3 overflow-hidden"
            >
              {searchLoading ? (
                <Skeleton className="h-20 w-full rounded-xl" />
              ) : searchResult ? (
                <div
                  className={cn(
                    "rounded-xl p-4 border-2",
                    isDark
                      ? "bg-emerald-950/30 border-emerald-500/30"
                      : "bg-emerald-50 border-emerald-300 shadow-[3px_3px_0px_rgba(16,185,129,0.15)]"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center",
                        isDark ? "bg-emerald-900/50" : "bg-emerald-200"
                      )}
                    >
                      <CheckCircle
                        className={cn(
                          "w-5 h-5",
                          isDark ? "text-emerald-400" : "text-emerald-700"
                        )}
                        strokeWidth={2.5}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          "text-sm font-black truncate",
                          isDark ? "text-white" : "text-gray-900"
                        )}
                      >
                        {(searchResult as any).trackingNumber ||
                          (searchResult as any).packageCode}
                      </p>
                      <p
                        className={cn(
                          "text-xs font-bold",
                          isDark ? "text-emerald-400" : "text-emerald-600"
                        )}
                      >
                        {language === "ku" ? "دۆزرایەوە!" : "Found!"}{" "}
                        {"--- "}
                        {getPackageStatusConfig((searchResult as any).status).label}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "text-sm font-black tabular-nums",
                        isDark ? "text-emerald-300" : "text-emerald-700"
                      )}
                    >
                      {Number((searchResult as any).weightKg || 0).toFixed(1)} kg
                    </span>
                  </div>
                </div>
              ) : (
                <div
                  className={cn(
                    "rounded-xl border-2 p-4 text-center",
                    isDark
                      ? "bg-zinc-900 border-zinc-700/60"
                      : "bg-white border-black/10"
                  )}
                >
                  <p
                    className={cn(
                      "text-sm font-bold",
                      isDark ? "text-zinc-500" : "text-gray-400"
                    )}
                  >
                    {language === "ku" ? "هیچ نەدۆزرایەوە" : "No package found"}
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pill-shaped filter chips */}
        <div className="px-5 mb-4">
          <div className="flex gap-2">
            {filterChips.map((chip) => (
              <motion.button
                key={chip.value}
                whileTap={{ scale: 0.95 }}
                onClick={() => setStatusFilter(chip.value)}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-black border-2 transition-all duration-200",
                  statusFilter === chip.value
                    ? isDark
                      ? "bg-indigo-500 text-white border-indigo-400 shadow-[0_0_12px_rgba(99,102,241,0.3)]"
                      : "bg-indigo-500 text-white border-indigo-600 shadow-[3px_3px_0px_rgba(0,0,0,0.1)]"
                    : isDark
                      ? "bg-zinc-900 text-zinc-400 border-zinc-700/60 hover:border-indigo-500/50"
                      : "bg-white text-gray-500 border-black/10 hover:border-indigo-300 shadow-[2px_2px_0px_rgba(0,0,0,0.04)]"
                )}
              >
                {chip.label}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Batch List */}
        <div className="px-5">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-28 w-full rounded-xl" />
              ))}
            </div>
          ) : filteredBatches.length > 0 ? (
            <div className="space-y-3">
              {filteredBatches.map((batch: any, index: number) => {
                const statusConfig = getStatusConfig(batch.status);
                const StatusIcon = statusConfig.icon;
                const isExpanded = expandedBatchId === batch.id;

                return (
                  <motion.div
                    key={batch.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      type: "spring",
                      stiffness: 300,
                      damping: 24,
                      delay: index * 0.05,
                    }}
                  >
                    <div
                      className={cn(
                        "rounded-xl overflow-hidden border-2 transition-all duration-200",
                        isDark
                          ? "bg-zinc-900 border-zinc-700/60"
                          : "bg-white border-black/10 shadow-[4px_4px_0px_rgba(0,0,0,0.06)]",
                        isExpanded &&
                          (isDark
                            ? "border-indigo-500/50 shadow-[0_0_16px_rgba(99,102,241,0.15)]"
                            : "border-indigo-400 shadow-[4px_4px_0px_rgba(99,102,241,0.15)]")
                      )}
                    >
                      {/* Batch Header */}
                      <button
                        onClick={() => handleBatchToggle(batch.id)}
                        className="w-full text-start p-4"
                      >
                        <div className="flex items-start gap-3">
                          {/* Shipping type icon */}
                          <div
                            className={cn(
                              "w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 border-2",
                              statusConfig.bg,
                              isDark ? "border-zinc-700/40" : "border-black/5"
                            )}
                          >
                            {batch.shippingType?.includes("sea") ? (
                              <Ship
                                className={cn("w-5 h-5", statusConfig.color)}
                                strokeWidth={2.5}
                              />
                            ) : (
                              <Plane
                                className={cn("w-5 h-5", statusConfig.color)}
                                strokeWidth={2.5}
                              />
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <h3
                                className={cn(
                                  "font-black text-sm",
                                  isDark ? "text-white" : "text-gray-950"
                                )}
                              >
                                {batch.batchCode || `B-${batch.id}`}
                              </h3>
                              <span
                                className={cn(
                                  "px-2.5 py-1 rounded-full text-[11px] font-black flex items-center gap-1 border",
                                  statusConfig.pillBg
                                )}
                              >
                                <StatusIcon className="w-3 h-3" strokeWidth={2.5} />
                                {statusConfig.label}
                              </span>
                            </div>

                            <div className="flex items-center gap-3 text-xs font-bold">
                              <span
                                className={cn(
                                  "flex items-center gap-1",
                                  isDark ? "text-zinc-500" : "text-gray-500"
                                )}
                              >
                                <Box className="w-3.5 h-3.5" strokeWidth={2.5} />
                                {batch.customerPackageCount || 0}{" "}
                                {language === "ku" ? "بار" : "pkgs"}
                              </span>
                              <span
                                className={cn(
                                  "flex items-center gap-1",
                                  isDark ? "text-zinc-500" : "text-gray-500"
                                )}
                              >
                                <Calendar className="w-3.5 h-3.5" strokeWidth={2.5} />
                                {new Date(batch.createdAt).toLocaleDateString()}
                              </span>
                            </div>

                            {batch.estimatedArrival && (
                              <p
                                className={cn(
                                  "text-[11px] font-bold mt-1.5",
                                  isDark ? "text-zinc-600" : "text-gray-400"
                                )}
                              >
                                {language === "ku"
                                  ? "گەیشتنی چاوەڕوانکراو:"
                                  : "ETA:"}{" "}
                                {new Date(
                                  batch.estimatedArrival
                                ).toLocaleDateString()}
                              </p>
                            )}
                          </div>

                          {/* Expand arrow */}
                          <motion.div
                            animate={{ rotate: isExpanded ? 180 : 0 }}
                            transition={{ type: "spring", stiffness: 400, damping: 25 }}
                            className="mt-1"
                          >
                            <ChevronDown
                              className={cn(
                                "w-5 h-5",
                                isDark ? "text-zinc-600" : "text-gray-400"
                              )}
                              strokeWidth={2.5}
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

                      {/* Expanded: Packages */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{
                              type: "spring",
                              stiffness: 300,
                              damping: 28,
                            }}
                            className="overflow-hidden"
                          >
                            <div
                              className={cn(
                                "border-t-2 px-4 pb-3 pt-2",
                                isDark ? "border-zinc-800" : "border-black/5"
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
                                  {batchPackages.map((pkg: any, pkgIndex: number) => {
                                    const pkgStatus = getPackageStatusConfig(
                                      pkg.status
                                    );
                                    return (
                                      <motion.div
                                        key={pkg.id}
                                        initial={{ opacity: 0, x: isRTL ? 16 : -16 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{
                                          type: "spring",
                                          stiffness: 300,
                                          damping: 24,
                                          delay: pkgIndex * 0.05,
                                        }}
                                        className={cn(
                                          "rounded-xl p-3 border",
                                          isDark
                                            ? "bg-zinc-800/60 border-zinc-700/40"
                                            : "bg-amber-50/80 border-black/5"
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
                                              "text-sm font-mono font-black",
                                              isDark
                                                ? "text-white"
                                                : "text-gray-900"
                                            )}
                                          >
                                            {pkg.trackingNumber ||
                                              pkg.packageCode ||
                                              `PKG-${pkg.id}`}
                                          </span>
                                          <span
                                            className={cn(
                                              "text-[10px] font-black px-2 py-0.5 rounded-full",
                                              pkgStatus.bg,
                                              pkgStatus.color
                                            )}
                                          >
                                            {pkgStatus.label}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-4 text-xs font-bold">
                                          <span
                                            className={cn(
                                              "flex items-center gap-1",
                                              isDark
                                                ? "text-zinc-500"
                                                : "text-gray-500"
                                            )}
                                          >
                                            <Weight
                                              className="w-3 h-3"
                                              strokeWidth={2.5}
                                            />
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
                                              <DollarSign
                                                className="w-3 h-3"
                                                strokeWidth={2.5}
                                              />
                                              $
                                              {Number(
                                                pkg.calculatedCostUsd
                                              ).toFixed(2)}
                                            </span>
                                          )}
                                          {pkg.isFullPackage && (
                                            <span
                                              className={cn(
                                                "text-[10px] font-black px-1.5 py-0.5 rounded-full",
                                                isDark
                                                  ? "bg-violet-500/20 text-violet-400"
                                                  : "bg-violet-100 text-violet-700"
                                              )}
                                            >
                                              {language === "ku"
                                                ? "فول پاکەج"
                                                : "Full Pkg"}
                                            </span>
                                          )}
                                        </div>
                                      </motion.div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <p
                                  className={cn(
                                    "text-sm font-bold text-center py-4",
                                    isDark ? "text-zinc-600" : "text-gray-400"
                                  )}
                                >
                                  {language === "ku"
                                    ? "هیچ بارێک نییە"
                                    : "No packages in this batch"}
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
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 24 }}
              className={cn(
                "rounded-xl border-2 p-12 text-center",
                isDark
                  ? "bg-zinc-900 border-zinc-700/60"
                  : "bg-white border-black/10 shadow-[4px_4px_0px_rgba(0,0,0,0.06)]"
              )}
            >
              <PackageOpen
                className={cn(
                  "w-16 h-16 mx-auto mb-4",
                  isDark ? "text-zinc-700" : "text-gray-300"
                )}
                strokeWidth={1.5}
              />
              <h3
                className={cn(
                  "font-black text-lg mb-2",
                  isDark ? "text-white" : "text-gray-950"
                )}
              >
                {language === "ku"
                  ? "هیچ بارێک نییە!"
                  : "No shipments yet!"}
              </h3>
              <p
                className={cn(
                  "text-sm font-medium max-w-[220px] mx-auto",
                  isDark ? "text-zinc-500" : "text-gray-400"
                )}
              >
                {language === "ku"
                  ? "کاتێک بارت هەبێت لێرە دەردەکەوێت"
                  : "Your shipments will show up here once they are on the way"}
              </p>
            </motion.div>
          )}

          {/* Unbatched Packages Alert */}
          {unbatchedPackages && unbatchedPackages.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 24 }}
              className={cn(
                "mt-4 rounded-xl border-2 p-4",
                isDark
                  ? "bg-amber-950/30 border-amber-500/30"
                  : "bg-amber-50 border-amber-300 shadow-[4px_4px_0px_rgba(245,158,11,0.1)]"
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
                    isDark ? "bg-amber-900/50" : "bg-amber-200"
                  )}
                >
                  <AlertTriangle
                    className={cn(
                      "w-5 h-5",
                      isDark ? "text-amber-400" : "text-amber-700"
                    )}
                    strokeWidth={2.5}
                  />
                </div>
                <div className="flex-1">
                  <p
                    className={cn(
                      "text-sm font-black",
                      isDark ? "text-amber-300" : "text-amber-800"
                    )}
                  >
                    {unbatchedPackages.length}{" "}
                    {language === "ku"
                      ? "پاکەت چاوەڕوانی باچن"
                      : "packages awaiting batch"}
                  </p>
                  <p
                    className={cn(
                      "text-xs font-medium mt-0.5",
                      isDark ? "text-amber-400/70" : "text-amber-600"
                    )}
                  >
                    {language === "ku"
                      ? "بەم زووانە زیاد دەکرێن"
                      : "Will be added to a batch soon"}
                  </p>
                </div>
              </div>

              <div className="mt-3 space-y-2">
                {unbatchedPackages.slice(0, 5).map((pkg: any) => (
                  <div
                    key={pkg.id}
                    className={cn(
                      "flex items-center justify-between rounded-lg px-3 py-2 border",
                      isDark
                        ? "bg-amber-950/40 border-amber-700/30"
                        : "bg-amber-100/60 border-amber-200"
                    )}
                  >
                    <span
                      className={cn(
                        "text-xs font-mono font-black",
                        isDark ? "text-amber-300" : "text-amber-800"
                      )}
                    >
                      {pkg.trackingNumber || pkg.packageCode || `PKG-${pkg.id}`}
                    </span>
                    <span
                      className={cn(
                        "text-xs font-bold tabular-nums",
                        isDark ? "text-amber-400/60" : "text-amber-600"
                      )}
                    >
                      {Number(pkg.weightKg || 0).toFixed(1)} kg
                    </span>
                  </div>
                ))}
                {unbatchedPackages.length > 5 && (
                  <p
                    className={cn(
                      "text-xs font-bold text-center pt-1",
                      isDark ? "text-amber-400/50" : "text-amber-500"
                    )}
                  >
                    +{unbatchedPackages.length - 5}{" "}
                    {language === "ku" ? "زیاتر" : "more"}
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </Skin3PortalLayout>
  );
}
