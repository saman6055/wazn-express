import { CustomerPortalLayout } from "@/components/CustomerPortalLayout";
import { PackageTrackingTimeline } from "@/components/portal/PackageTrackingTimeline";
import { PortalSearchSkeleton } from "@/components/portal/PortalListSkeleton";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import { Search, Package, X, CheckCircle, Truck, Clock, AlertCircle, Scale, Ruler, Camera, ChevronLeft, ChevronRight, Calendar, PackagePlus, AlertTriangle } from "lucide-react";
import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TutorialHint } from "@/components/TutorialHint";
import { pickLang } from "@/lib/lang";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

function getInitialSearchQuery(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("q") ?? "";
}

// Recent searches live in localStorage so the customer can re-run them with
// one tap — survives reloads and app restarts on the same device.
const RECENT_SEARCHES_KEY = "wazn_portal_recent_searches";
const RECENT_SEARCHES_MAX = 8;

function loadRecentSearches(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || "[]");
    return Array.isArray(raw) ? raw.filter((s) => typeof s === "string").slice(0, RECENT_SEARCHES_MAX) : [];
  } catch {
    return [];
  }
}

export default function PortalSearch() {
  const { t, language } = useLanguage();
  const isRTL = language === "ku" || language === "ar";
  const [searchQuery, setSearchQuery] = useState(getInitialSearchQuery);
  const initialQ = getInitialSearchQuery();
  const [hasSearched, setHasSearched] = useState(!!initialQ);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  const { data: result, isLoading, refetch } = trpc.customerPortal.searchPackage.useQuery(
    { trackingNumber: searchQuery },
    { enabled: hasSearched && !!searchQuery.trim() }
  );

  // Unified-search fallback: when the tracking isn't one of the customer's own
  // packages, surface whether it's unclaimed (claimable) or pre-declared.
  const { data: extra, isLoading: extraLoading } = trpc.customerPortal.searchTrackingExtra.useQuery(
    { trackingNumber: searchQuery.trim() },
    { enabled: hasSearched && !!searchQuery.trim() && !result }
  );

  // Order-number search: the same box also finds the customer's own
  // full-package/commission orders by order code (FP-...) or tracking.
  const { data: orderResult } = trpc.customerPortal.searchOrder.useQuery(
    { query: searchQuery.trim() },
    { enabled: hasSearched && !!searchQuery.trim() && !result, retry: false }
  );

  // Real movement events for the found package — feeds actual dates into the
  // tracking timeline instead of the synthetic status-only view.
  const { data: timelineEvents } = trpc.customerPortal.getPackageTimeline.useQuery(
    { packageId: (result as any)?.id ?? 0 },
    { enabled: !!(result as any)?.id }
  );

  const photos = result?.photos as string[] | undefined;

  const [recentSearches, setRecentSearches] = useState<string[]>(loadRecentSearches);

  const rememberSearch = (q: string) => {
    const next = [q, ...recentSearches.filter((r) => r !== q)].slice(0, RECENT_SEARCHES_MAX);
    setRecentSearches(next);
    try {
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
    } catch {
      // Storage full/blocked — history is a convenience, never an error.
    }
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    try {
      localStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch {
      // ignore
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    rememberSearch(searchQuery.trim());
    setHasSearched(true);
    await refetch();
  };

  // Tapping a recent chip re-runs that search instantly (the query key change
  // triggers the fetch on its own).
  const searchRecent = (q: string) => {
    setSearchQuery(q);
    rememberSearch(q);
    setHasSearched(true);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "delivered":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "in_transit":
      case "out_for_delivery":
        return <Truck className="w-5 h-5 text-blue-500" />;
      case "customs_processing":
        return <AlertCircle className="w-5 h-5 text-orange-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      registered: t("registered") || "Registered",
      in_batch: t("inBatch") || "In Batch",
      in_transit: t("inTransit") || "In Transit",
      customs_processing: t("customsProcessing") || "Customs",
      ready_for_delivery: t("readyForDelivery") || "Ready",
      out_for_delivery: t("outForDelivery") || "Out for Delivery",
      delivered: t("delivered") || "Delivered",
    };
    return statusMap[status] || status;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "delivered":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300";
      case "out_for_delivery":
        return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300";
      case "ready_for_delivery":
        return "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300";
      case "in_transit":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300";
      case "customs_processing":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
      case "in_batch":
        return "bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  const openPhotoViewer = () => {
    setCurrentPhotoIndex(0);
    setShowPhotoViewer(true);
  };

  const closePhotoViewer = () => {
    setShowPhotoViewer(false);
    setCurrentPhotoIndex(0);
  };

  const nextPhoto = () => {
    if (photos && currentPhotoIndex < photos.length - 1) {
      setCurrentPhotoIndex(currentPhotoIndex + 1);
    }
  };

  const prevPhoto = () => {
    if (currentPhotoIndex > 0) {
      setCurrentPhotoIndex(currentPhotoIndex - 1);
    }
  };

  return (
    <CustomerPortalLayout>
      {/* Header */}
      <div className="bg-slate-800 text-white px-4 pt-12 pb-8">
        <h1 className="text-xl font-bold mb-2">{t("trackPackage") || "Track Package"}</h1>
        <TutorialHint section="شوێنکەوتن" className="mb-4" />
        
        {/* Search Input */}
        <div className="relative">
          <Input
            type="text"
            placeholder={pickLang(language, {
              ku: "تراکینگ یان ئۆردەر نەمبەر بنووسە...",
              en: "Enter tracking or order number...",
              ar: "أدخل رقم التتبع أو رقم الطلب...",
              zh: "输入运单号或订单号...",
            })}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            className="w-full h-12 pl-12 pr-12 rounded-xl bg-white text-slate-800 placeholder:text-gray-400 border-0"
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery("");
                setHasSearched(false);
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          )}
        </div>
        
        <Button
          onClick={handleSearch}
          disabled={!searchQuery.trim() || isLoading}
          className="w-full mt-3 h-12 bg-white text-slate-800 hover:bg-gray-100 font-medium rounded-xl"
        >
          {isLoading ? t("searching") || "Searching..." : t("search") || "Search"}
        </Button>

        {/* Recent searches — one tap re-runs the search */}
        {recentSearches.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-white/60">
                {pickLang(language, { ku: "دواین گەڕانەکان", en: "Recent searches", ar: "عمليات البحث الأخيرة", zh: "最近搜索" })}
              </span>
              <button
                type="button"
                onClick={clearRecentSearches}
                className="text-[11px] text-white/50 hover:text-white/80 transition"
              >
                {pickLang(language, { ku: "سڕینەوە", en: "Clear", ar: "مسح", zh: "清除" })}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {recentSearches.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => searchRecent(q)}
                  className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-xs font-mono text-white/85 transition hover:bg-white/20 active:scale-95"
                  dir="ltr"
                >
                  <Clock className="h-3 w-3 opacity-60" />
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Search Results */}
      <div className="px-4 py-6">
        {!hasSearched ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-10 h-10 text-gray-300" />
            </div>
            <p className="text-gray-500">
              {pickLang(language, {
                ku: "تراکینگ نەمبەر یان ئۆردەر نەمبەر (FP-...) بنووسە بۆ گەڕان",
                en: "Enter a tracking number or order number (FP-...) to search",
                ar: "أدخل رقم التتبع أو رقم الطلب (FP-...) للبحث",
                zh: "输入运单号或订单号（FP-...）进行搜索",
              })}
            </p>
          </div>
        ) : (isLoading || extraLoading) ? (
          <PortalSearchSkeleton />
        ) : result ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden">
            {/* Package Header with color-coded status */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center shrink-0">
                  <Package className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 dark:text-slate-100">{result.trackingNumber || result.packageCode}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {getStatusIcon(result.status)}
                    <span className={cn(
                      "text-xs px-2.5 py-1 rounded-full font-medium border-0",
                      getStatusColor(result.status)
                    )}>
                      {getStatusText(result.status)}
                    </span>
                  </div>
                </div>
                
                {/* Photo indicator */}
                {photos && photos.length > 0 && (
                  <button
                    onClick={openPhotoViewer}
                    className="flex items-center gap-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors"
                  >
                    <Camera className="w-4 h-4" />
                    <span>{photos.length}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Package Photos Preview */}
            {photos && photos.length > 0 && (
              <div className="p-4 border-b bg-gray-50">
                <button 
                  onClick={openPhotoViewer}
                  className="flex items-center gap-3 w-full"
                >
                  <div className="flex -space-x-2">
                    {photos.slice(0, 4).map((photo, idx) => (
                      <div 
                        key={idx}
                        className="w-12 h-12 rounded-lg border-2 border-white shadow-sm overflow-hidden bg-gray-100"
                      >
                        <img loading="lazy" decoding="async" 
                          src={photo} 
                          alt={`Package photo ${idx + 1}`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2'%3E%3Crect x='3' y='3' width='18' height='18' rx='2' ry='2'%3E%3C/rect%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'%3E%3C/circle%3E%3Cpolyline points='21 15 16 10 5 21'%3E%3C/polyline%3E%3C/svg%3E";
                          }}
                        />
                      </div>
                    ))}
                    {photos.length > 4 && (
                      <div className="w-12 h-12 rounded-lg border-2 border-white shadow-sm bg-gray-200 flex items-center justify-center">
                        <span className="text-xs text-gray-600 font-medium">+{photos.length - 4}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-slate-800">{t("packagePhotos") || "Package Photos"}</p>
                    <p className="text-xs text-gray-500">{photos.length} {t("photos") || "photos"}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            )}

            {/* Status Timeline */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-3">
                {language === "ku" ? "شوێنکەوتنی بار" : "Tracking progress"}
              </p>
              <PackageTrackingTimeline
                currentStatus={result.status}
                events={timelineEvents as any}
                estimatedDelivery={(result as any).estimatedArrival ?? (result as any).batchEstimatedArrival ?? null}
                language={language}
              />
            </div>

            {/* Estimated delivery badge when in transit */}
            {["in_transit", "customs_processing", "ready_for_delivery", "out_for_delivery"].includes(result.status) && (result as any).estimatedArrival && (
              <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
                <Calendar className="w-4 h-4 shrink-0" />
                <span>{language === "ku" ? "بەرواری چاوەڕوانکراوی گەیشتن: " : "Estimated delivery: "}
                  {new Date((result as any).estimatedArrival).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                </span>
              </div>
            )}

            {/* Package Details */}
            <div className="p-4 space-y-4">
              {/* Dimensions */}
              <div className="grid grid-cols-2 gap-4">
                {result.weightKg && (
                  <div className="flex items-center gap-2">
                    <Scale className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">{t("weight") || "Weight"}</p>
                      <p className="font-medium text-slate-800">{result.weightKg} kg</p>
                    </div>
                  </div>
                )}
                {result.lengthCm && result.widthCm && result.heightCm && (
                  <div className="flex items-center gap-2">
                    <Ruler className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">{t("dimensions") || "Dimensions"}</p>
                      <p className="font-medium text-slate-800">{result.lengthCm}×{result.widthCm}×{result.heightCm} cm</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Shipping Type */}
              <div>
                <p className="text-xs text-gray-500">{t("shippingType") || "Shipping Type"}</p>
                <p className="font-medium text-slate-800 capitalize">{result.shippingType.replace("_", " ")}</p>
              </div>

              {/* Description */}
              {result.description && (
                <div>
                  <p className="text-xs text-gray-500">{t("description") || "Description"}</p>
                  <p className="text-slate-800">{result.description}</p>
                </div>
              )}

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4 pt-3 border-t">
                <div>
                  <p className="text-xs text-gray-500">{t("registered") || "Registered"}</p>
                  <p className="text-sm text-slate-800">
                    {new Date(result.registeredAt).toLocaleDateString()}
                  </p>
                </div>
                {result.deliveredAt && (
                  <div>
                    <p className="text-xs text-gray-500">{t("delivered") || "Delivered"}</p>
                    <p className="text-sm text-slate-800">
                      {new Date(result.deliveredAt).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : orderResult ? (
          /* Order-number match: a full-package/commission order (FP-...) */
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-5 space-y-3">
            <div className="flex items-center gap-3">
              {orderResult.productImage ? (
                <img loading="lazy" decoding="async" src={orderResult.productImage} alt="" className="w-14 h-14 rounded-xl object-cover" />
              ) : (
                <div className="w-14 h-14 bg-violet-100 dark:bg-violet-950/40 rounded-xl flex items-center justify-center">
                  <Package className="w-7 h-7 text-violet-500" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-bold text-slate-800 dark:text-slate-100 truncate">
                  {orderResult.productName}
                </p>
                <p className="font-mono text-sm text-violet-600 dark:text-violet-400" dir="ltr">
                  {orderResult.orderCode}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-violet-100 px-2.5 py-1 text-xs font-bold text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
                {pickLang(language, { ku: "ئۆردەر", en: "Order", ar: "طلب", zh: "订单" })}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-xs text-gray-500">{pickLang(language, { ku: "دۆخ", en: "Status", ar: "الحالة", zh: "状态" })}</p>
                <p className="font-semibold text-slate-800 dark:text-slate-100">{orderResult.status}</p>
              </div>
              {orderResult.trackingNumber && (
                <div>
                  <p className="text-xs text-gray-500">{pickLang(language, { ku: "تراک", en: "Tracking", ar: "التتبع", zh: "运单号" })}</p>
                  <p className="font-mono font-semibold text-slate-800 dark:text-slate-100" dir="ltr">{orderResult.trackingNumber}</p>
                </div>
              )}
            </div>
            <Link href="/portal/full-package">
              <Button className="w-full rounded-xl bg-violet-600 hover:bg-violet-700 text-white">
                {pickLang(language, { ku: "بینینی وردەکاری لە ئۆردەرەکانم", en: "View details in My Orders", ar: "عرض التفاصيل في طلباتي", zh: "在我的订单中查看详情" })}
              </Button>
            </Link>
          </div>
        ) : extra?.unclaimed ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-5 text-center space-y-3">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8 text-orange-500" />
            </div>
            <div>
              <p className="font-bold text-slate-800 dark:text-slate-100">
                {pickLang(language, { ku: "ئەم پاکەتە بێ‌خاوەنە", en: "This package is unclaimed", ar: "هذا الطرد بلا صاحب", zh: "此包裹无主" })}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {pickLang(language, { ku: "ئەگەر هی تۆیە، داوای خاوەنداری بکە و بەڵگە بنێرە", en: "If it's yours, submit a claim with proof", ar: "إذا كان لك، قدّم مطالبة مع الإثبات", zh: "如果是您的，请提交认领并附凭证" })}
              </p>
              <p className="font-mono text-sm mt-2" dir="ltr">{extra.unclaimed.trackingNumber || extra.unclaimed.packageCode}</p>
            </div>
            <Link href="/portal/no-mark">
              <Button className="w-full rounded-xl bg-orange-500 hover:bg-orange-600 text-white">
                <AlertTriangle className="w-4 h-4 me-2" />
                {pickLang(language, { ku: "داواکاری خاوەنداری", en: "Claim ownership", ar: "المطالبة بالملكية", zh: "认领所有权" })}
              </Button>
            </Link>
          </div>
        ) : extra?.declared ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-5 text-center space-y-3">
            <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto">
              <PackagePlus className="w-8 h-8 text-teal-500" />
            </div>
            <div>
              <p className="font-bold text-slate-800 dark:text-slate-100">
                {pickLang(language, { ku: "تۆ پێشوەخت ئەم تراکەت داخڵ کردووە", en: "You pre-declared this tracking", ar: "لقد سجّلت هذا التتبع مسبقاً", zh: "您已预先登记此运单号" })}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {pickLang(language, { ku: "چاوەڕوانی گەیشتنە — کاتێک بگات ئاگادار دەکرێیتەوە", en: "Awaiting arrival — you'll be notified when it arrives", ar: "بانتظار الوصول — سيتم إعلامك عند وصوله", zh: "等待到货 — 到货后将通知您" })}
              </p>
              <p className="font-mono text-sm mt-2" dir="ltr">{extra.declared.trackingNumber}</p>
            </div>
            <Link href="/portal/declare">
              <Button variant="outline" className="w-full rounded-xl">
                {pickLang(language, { ku: "بینینی تۆمارکراوەکانم", en: "View my registrations", ar: "عرض تسجيلاتي", zh: "查看我的登记" })}
              </Button>
            </Link>
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Package className="w-10 h-10 text-red-300" />
            </div>
            <p className="text-gray-800 font-medium">
              {pickLang(language, { ku: "هیچ نەدۆزرایەوە", en: "Nothing found", ar: "لم يتم العثور على شيء", zh: "未找到任何结果" })}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {pickLang(language, {
                ku: "تراکینگ یان ئۆردەر نەمبەرەکە بپشکنە و دووبارە هەوڵبدەرەوە",
                en: "Check the tracking or order number and try again",
                ar: "تحقق من رقم التتبع أو رقم الطلب وحاول مجدداً",
                zh: "请检查运单号或订单号后重试",
              })}
            </p>
          </div>
        )}
      </div>

      {/* Photo Viewer Dialog */}
      <Dialog open={showPhotoViewer} onOpenChange={closePhotoViewer}>
        <DialogContent className="max-w-lg p-0 overflow-hidden bg-black/95">
          <DialogTitle className="sr-only">
            {t("packagePhotos") || "Package Photos"}
          </DialogTitle>
          
          {result && photos && photos.length > 0 && (
            <div className="relative">
              {/* Header */}
              <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/60 to-transparent p-4">
                <div className="flex items-center justify-between text-white">
                  <div>
                    <p className="font-medium">{result.trackingNumber || result.packageCode}</p>
                    <p className="text-sm text-white/70">
                      {currentPhotoIndex + 1} / {photos.length}
                    </p>
                  </div>
                  <button 
                    onClick={closePhotoViewer}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Main Image */}
              <div className="relative aspect-square bg-black flex items-center justify-center">
                <img loading="lazy" decoding="async"
                  src={photos[currentPhotoIndex]}
                  alt={`Package photo ${currentPhotoIndex + 1}`}
                  className="max-w-full max-h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='1'%3E%3Crect x='3' y='3' width='18' height='18' rx='2' ry='2'%3E%3C/rect%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'%3E%3C/circle%3E%3Cpolyline points='21 15 16 10 5 21'%3E%3C/polyline%3E%3C/svg%3E";
                  }}
                />

                {/* Navigation arrows */}
                {photos.length > 1 && (
                  <>
                    <button
                      onClick={prevPhoto}
                      disabled={currentPhotoIndex === 0}
                      className={cn(
                        "absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white transition-all",
                        currentPhotoIndex === 0 ? "opacity-30 cursor-not-allowed" : "hover:bg-black/70"
                      )}
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </button>
                    <button
                      onClick={nextPhoto}
                      disabled={currentPhotoIndex === photos.length - 1}
                      className={cn(
                        "absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white transition-all",
                        currentPhotoIndex === photos.length - 1 ? "opacity-30 cursor-not-allowed" : "hover:bg-black/70"
                      )}
                    >
                      <ChevronRight className="w-6 h-6" />
                    </button>
                  </>
                )}
              </div>

              {/* Thumbnail strip */}
              {photos.length > 1 && (
                <div className="bg-black p-3">
                  <div className="flex gap-2 overflow-x-auto">
                    {photos.map((photo, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentPhotoIndex(idx)}
                        className={cn(
                          "flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all",
                          idx === currentPhotoIndex 
                            ? "border-blue-500 ring-2 ring-blue-500/50" 
                            : "border-transparent opacity-60 hover:opacity-100"
                        )}
                      >
                        <img loading="lazy" decoding="async"
                          src={photo}
                          alt={`Thumbnail ${idx + 1}`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='56' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='1'%3E%3Crect x='3' y='3' width='18' height='18' rx='2' ry='2'%3E%3C/rect%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'%3E%3C/circle%3E%3Cpolyline points='21 15 16 10 5 21'%3E%3C/polyline%3E%3C/svg%3E";
                          }}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Package info footer */}
              <div className="bg-slate-900 p-4 text-white">
                <div className="flex items-center gap-4 text-sm">
                  {result.weightKg && (
                    <div className="flex items-center gap-1">
                      <Scale className="w-4 h-4 text-gray-400" />
                      <span>{result.weightKg} kg</span>
                    </div>
                  )}
                  {result.lengthCm && result.widthCm && result.heightCm && (
                    <div className="flex items-center gap-1">
                      <Ruler className="w-4 h-4 text-gray-400" />
                      <span>{result.lengthCm}×{result.widthCm}×{result.heightCm} cm</span>
                    </div>
                  )}
                </div>
                {result.description && (
                  <p className="text-sm text-gray-400 mt-2">{result.description}</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </CustomerPortalLayout>
  );
}
