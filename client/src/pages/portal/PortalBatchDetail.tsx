import { PortalLayout } from "@/components/portal/PortalLayout";
import { PORTAL_LIVE_QUERY, PORTAL_SETTINGS_QUERY } from "@/lib/portalQuery";
import { pickLang } from "@/lib/lang";
import { ShareParcelButton } from "@/components/portal/ShareParcelButton";
import { copyText } from "@/lib/copyText";
import { STATUS_LABEL, SHIPPING_TYPE_LABEL, type BatchStatus } from "@/lib/shipmentFilters";
import { usePortalPalette } from "@/components/portal/PortalHeaderControls";
import { WhatsAppHelpButton } from "@/components/portal/WhatsAppHelpButton";
import { usePackageImages } from "@/components/portal/PackageThumb";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import { 
  Package, ChevronLeft, CheckCircle, 
  Scale, Ruler, Box, Camera, X, ChevronRight, Plane, Ship,
  MapPin, Calendar, Download, Share2, FileText, Warehouse
} from "lucide-react";
import { useParams } from "wouter";
import { PortalBackButton, BACK_WORDS } from "@/components/portal/PortalBackButton";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useBackCloses } from "@/hooks/useBackCloses";
import { getBatchEta, formatBatchEta } from "@/lib/batchEta";
import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { PortalErrorState } from "@/components/portal/PortalErrorState";
import { PortalSearchCard } from "@/components/portal/PortalSearchCard";
import { usePortalParcelSheet } from "@/components/portal/PortalParcelSheet";
import { searchStatusTone, searchStatusWords } from "@/components/portal/portalSearchChip";
import { fmtCount, fmtDims, fmtKg } from "@/lib/portalFormat";
import { formatPortalDate } from "@/lib/portalClock";
import { TrackingNumberLink } from "@/components/batches/TrackingNumberLink";

// Timeline step type
interface TimelineStep {
  status: string;
  /** Names come from the shared STATUS_LABEL table, not from this file. */
  stepKey: BatchStatus;
  icon: any;
  completed: boolean;
  current: boolean;
  date?: string;
}

export default function PortalBatchDetail() {
  // Banner colour follows the mode the customer picked, like every other page.
  const { banner: portalBanner } = usePortalPalette();
const { t, language } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const params = useParams<{ id: string }>();
  // A non-numeric id in the URL produced NaN, which the query happily sent
  // and which matched nothing — and the empty branch below tested
  // `length === 0`, false while data is undefined, so the page rendered a
  // header and then nothing at all.
  const parsedId = Number.parseInt(params.id ?? "", 10);
  const batchId = Number.isFinite(parsedId) ? parsedId : 0;
  
  const batchesQuery = trpc.customerPortal.getMyBatches.useQuery(undefined, PORTAL_LIVE_QUERY);
  const { data: batches } = batchesQuery;
  const { data: packages, isLoading, isError, isFetching, refetch } = trpc.customerPortal.getMyPackagesInBatch.useQuery(
    { batchId },
    { ...PORTAL_LIVE_QUERY, enabled: batchId > 0 },
  );
  const { resolve: resolvePackageImage } = usePackageImages();
  // A parcel's sheet — the one the search opens — from this list's cards.
  const parcelSheet = usePortalParcelSheet();

  // Which of these parcels are the customer's own buying. Derived server-side
  // from the one self-order rule, so this badge and the orders page can never
  // disagree, and both stop showing it the moment the parcel is linked to an
  // order that was entered late.
  const { data: selfOrderPackages } = trpc.customerPortal.getMySelfOrderPackages.useQuery(undefined, {
    staleTime: 60_000,
    retry: false,
  });
  const selfOrderIds = new Set((selfOrderPackages ?? []).map((p) => p.id));


  const batch = batches?.find(b => b.id === batchId);
  
  // Photo viewer state
  const [selectedPackage, setSelectedPackage] = useState<number | null>(null);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  
  const selectedPkg = packages?.find(p => p.id === selectedPackage);
  const photos = selectedPkg?.photos as string[] | undefined;

  // Generate timeline steps based on batch status
  const getTimelineSteps = (): TimelineStep[] => {
    const statusOrder = ["preparing", "in_transit", "arrived", "customs", "at_depot", "delivered"];
    const currentIndex = statusOrder.indexOf(batch?.status || "preparing");
    
    return [
      { 
        status: "preparing", 
        stepKey: "preparing" as const,
        icon: Package, 
        completed: currentIndex > 0, 
        current: currentIndex === 0 
      },
      { 
        status: "in_transit", 
        stepKey: "in_transit" as const,
        icon: Plane, 
        completed: currentIndex > 1, 
        current: currentIndex === 1 
      },
      { 
        status: "arrived", 
        stepKey: "arrived" as const,
        icon: MapPin, 
        completed: currentIndex > 2, 
        current: currentIndex === 2 
      },
      { 
        status: "customs", 
        stepKey: "customs" as const,
        icon: FileText, 
        completed: currentIndex > 3, 
        current: currentIndex === 3 
      },
      { 
        status: "at_depot", 
        stepKey: "at_depot" as const,
        icon: Warehouse, 
        completed: currentIndex > 4, 
        current: currentIndex === 4 
      },
      { 
        status: "delivered", 
        stepKey: "delivered" as const,
        icon: CheckCircle, 
        completed: currentIndex >= 5 || batch?.status === "closed", 
        current: currentIndex === 5 || batch?.status === "closed"
      },
    ];
  };

  const openPhotoViewer = (packageId: number) => {
    setSelectedPackage(packageId);
    setCurrentPhotoIndex(0);
  };

  const closePhotoViewer = () => {
    setSelectedPackage(null);
    setCurrentPhotoIndex(0);
  };
  // The photos cover the page: the phone's Back closes them, not the shipment.
  useBackCloses(!!selectedPackage, closePhotoViewer);

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

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${batch?.batchCode ?? ""}`,
          text: pickLang(language, {
            ku: "شوێنی بارەکەم بکەرەوە",
            en: "Track my shipment",
            ar: "تتبّع شحنتي",
            zh: "追踪我的货物",
          }),
          url: window.location.href,
        });
        return;
      }
    } catch (err) {
      // Dismissing the share sheet rejects with AbortError. Treating that as
      // a failure meant a customer who changed their mind got the link copied
      // and a toast telling them so.
      if ((err as { name?: string })?.name === "AbortError") return;
    }
    const ok = await copyText(window.location.href);
    if (ok) {
      toast.success(pickLang(language, { ku: "لینک کۆپی کرا", en: "Link copied", ar: "تم نسخ الرابط", zh: "链接已复制" }));
    } else {
      toast.error(pickLang(language, { ku: "نەتوانرا کۆپی بکرێت", en: "Could not copy", ar: "تعذّر النسخ", zh: "复制失败" }));
    }
  };

  const timelineSteps = getTimelineSteps();

  return (
    <PortalLayout>
      {batchesQuery.isError && !batch && (
        <div className="px-4 pt-4">
          <PortalErrorState compact onRetry={() => void batchesQuery.refetch()} isRetrying={batchesQuery.isFetching} />
        </div>
      )}
      {/* Header */}
      <div className="text-white px-4 pt-12 pb-8" style={portalBanner}>
        <PortalBackButton icon="chevron" className="gap-1 text-slate-300 mb-3 hover:text-white transition-colors">
          <span className="text-sm">{pickLang(language, BACK_WORDS)}</span>
        </PortalBackButton>
        
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold"><bdi dir="ltr">{batch?.batchCode || "..."}</bdi></h1>
            {batch && (
              <div className="flex items-center gap-2 mt-2">
                <span className={cn(
                  "px-3 py-1 rounded-full text-xs font-medium",
                  "bg-white/15 text-white"
                )}>
                  {batch.shippingType === "sea" ? "🚢" : "✈️"}{" "}
                  {batch.shippingType && SHIPPING_TYPE_LABEL[batch.shippingType]
                    ? pickLang(language, SHIPPING_TYPE_LABEL[batch.shippingType])
                    : batch.shippingType?.replace("_", " ")}
                </span>
                <span className="text-slate-400 text-sm">
                  • {isLoading ? "…" : fmtCount(packages?.length)} {pickLang(language, { ku: "پاکەت", en: "packages", ar: "طرود", zh: "件包裹" })}
                </span>
              </div>
            )}
            {/*
              The carrier's own reference for this shipment: the container
              number by sea, the air waybill by air. Shown only once it is
              known — it is blank while the cartons are still being filled.
              These two are the customer's half of the shipping detail; the
              courier trackings the cartons travelled under stay internal.
            */}
            {batch && (batch.containerNumber || batch.awbNumber) && (
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {batch.containerNumber && (
                  <span className="px-2.5 py-1 rounded-lg bg-white/10 text-xs">
                    <span className="text-slate-400">
                      {pickLang(language, { ku: "کۆنتەینەر", en: "Container", ar: "الحاوية", zh: "集装箱" })}:
                    </span>{" "}
                    <TrackingNumberLink
                      kind="container"
                      value={batch.containerNumber}
                      shippingCompany={batch.shippingCompany}
                      showCarrier={false}
                      className="text-white"
                    />
                  </span>
                )}
                {batch.awbNumber && (
                  <span className="px-2.5 py-1 rounded-lg bg-white/10 text-xs">
                    <span className="text-slate-400">
                      {pickLang(language, { ku: "بارنامەی ئاسمانی", en: "Air waybill", ar: "بوليصة الشحن الجوي", zh: "空运提单" })}:
                    </span>{" "}
                    <TrackingNumberLink
                      kind="awb"
                      value={batch.awbNumber}
                      showCarrier={false}
                      className="text-white"
                    />
                  </span>
                )}
              </div>
            )}
            {batch && (
              <div className="mt-3">
                <WhatsAppHelpButton
                  language={language}
                  section={language === "ku" ? "وردەکاری بار" : language === "ar" ? "تفاصيل الشحنة" : language === "zh" ? "货运详情" : "Batch detail"}
                  topic={`${batch.batchCode} — ${STATUS_LABEL[batch.status as BatchStatus] ? pickLang(language, STATUS_LABEL[batch.status as BatchStatus]) : batch.status}`}
                />
              </div>
            )}
          </div>
          
          <button 
            onClick={handleShare}
            className="p-3 bg-white/10 rounded-xl hover:bg-white/20 transition-colors"
          >
            <Share2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Timeline Card */}
      <div className="px-4 -mt-4">
        <div className={cn(
          "rounded-2xl shadow-lg p-4 transition-colors duration-300",
          isDark ? "bg-slate-800" : "bg-white"
        )}>
          <h3 className={cn("font-semibold mb-4", isDark ? "text-white" : "text-slate-800 dark:text-slate-200")}>
            {pickLang(language, { ku: "شوێنکەوتنی بار", en: "Shipment Progress", ar: "تقدّم الشحنة", zh: "运输进度" })}
          </h3>
          
          <div className="relative">
            {/* Timeline line */}
            <div className={cn(
              "absolute top-5 start-[8.33%] end-[8.33%] h-1 rounded-full",
              isDark ? "bg-slate-700" : "bg-slate-100 dark:bg-slate-950/40"
            )} />
            
            {/* Progress line */}
            <div 
              className="absolute top-5 start-[8.33%] h-1 rounded-full bg-emerald-500 transition-all duration-500"
              style={{
                // A status outside statusOrder — `cancelled` — put indexOf at
                // -1, so nothing was completed or current and this computed
                // "-20%", which is not a width a browser accepts.
                width: `${Math.max(
                  0,
                  ((timelineSteps.filter(s => s.completed || s.current).length - 1) /
                    Math.max(1, timelineSteps.length - 1)) * 83.34,
                )}%`
              }}
            />
            
            {/* Steps */}
            <div className="relative flex justify-between">
              {timelineSteps.map((step, index) => (
                <div key={step.status} className="flex min-w-0 flex-1 flex-col items-center">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 z-10",
                    step.completed 
                      ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30" 
                      : step.current 
                        ? "bg-blue-500 text-white shadow-lg shadow-blue-500/30 animate-pulse" 
                        : (isDark ? "bg-slate-700 text-slate-500" : "bg-slate-100 dark:bg-slate-950/40 text-slate-400")
                  )}>
                    <step.icon className="w-5 h-5" />
                  </div>
                  <span className={cn(
                    "text-[11px] leading-tight font-medium mt-2 w-full break-words text-center",
                    step.completed || step.current 
                      ? (isDark ? "text-white" : "text-slate-800 dark:text-slate-200")
                      : (isDark ? "text-slate-500" : "text-slate-400")
                  )}>
                    {pickLang(language, STATUS_LABEL[step.stepKey])}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ETA — staff-set date, or a range derived from departure +
              shipping type (air 7–14d, sea 30–45d) when unset. */}
          {(() => {
            if (!batch) return null;
            const eta = getBatchEta(batch);
            if (!eta) return null;
            return (
              <div className={cn(
                "mt-5 pt-4 border-t flex items-center gap-3",
                isDark ? "border-slate-700" : "border-slate-100 dark:border-slate-800/60"
              )}>
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center",
                  isDark ? "bg-blue-900/50" : "bg-blue-50 dark:bg-blue-950/40"
                )}>
                  <Calendar className={cn("w-5 h-5", isDark ? "text-blue-400" : "text-blue-600")} />
                </div>
                <div>
                  <p className={cn("text-xs", isDark ? "text-slate-400" : "text-slate-500")}>
                    {language === "ku" ? "کاتی گەیشتنی خەمڵێنراو" : language === "ar" ? "الوصول المتوقع" : language === "zh" ? "预计到达" : "Estimated Arrival"}
                  </p>
                  <p className={cn("font-semibold", isDark ? "text-white" : "text-slate-800 dark:text-slate-200")}>
                    {eta.kind === "exact"
                      ? formatPortalDate(eta.date, language)
                      : formatBatchEta(eta, language)}
                  </p>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Packages List */}
      <div className={cn(
        "px-4 py-6 transition-colors duration-300",
        isDark ? "bg-slate-900" : "bg-slate-50 dark:bg-slate-950/40"
      )}>
        <div className="flex items-center justify-between mb-4">
          <h2 className={cn("font-semibold", isDark ? "text-white" : "text-slate-800 dark:text-slate-200")}>
            {pickLang(language, { ku: "پاکەتەکانت", en: "Your Packages", ar: "طرودك", zh: "您的包裹" })}
          </h2>
          <span className={cn(
            "px-3 py-1 rounded-full text-sm font-medium",
            isDark ? "bg-slate-800 text-slate-300" : "bg-white text-slate-600"
          )}>
            {isLoading ? "…" : fmtCount(packages?.length)}
          </span>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className={cn("h-32 w-full rounded-2xl", isDark && "bg-slate-800")} />
            ))}
          </div>
        ) : isError ? (
          <PortalErrorState onRetry={() => void refetch()} isRetrying={isFetching} />
        ) : !packages || packages.length === 0 ? (
          <div className={cn(
            "rounded-2xl p-10 text-center transition-colors duration-300",
            isDark ? "bg-slate-800" : "bg-white"
          )}>
            <Package className={cn("w-12 h-12 mx-auto mb-3", isDark ? "text-slate-600" : "text-slate-300")} />
            <p className={cn(isDark ? "text-slate-400" : "text-slate-500")}>
              {pickLang(language, { ku: "هیچ پاکەتێک نییە", en: "No packages", ar: "لا توجد طرود", zh: "暂无包裹" })}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {packages?.map((pkg) => {
              // The compact card the search draws (owner's brief, 2026-09-19):
              // photo, number, where it is, a date. Weight, size, the journey,
              // the photos and the share link are in the sheet a tap opens.
              const item = parcelSheet.itemFor(pkg as any);
              if (!item) return null;
              const pkgPhotos = (pkg.photos as string[] | undefined) ?? [];
              return (
                <li key={pkg.id}>
                  <PortalSearchCard
                    item={item}
                    thumb={resolvePackageImage(pkg).url ?? null}
                    words={searchStatusWords(item, parcelSheet.origins)}
                    tone={searchStatusTone(item)}
                    badge={
                      // Says plainly which parcels are the customer's own
                      // buying rather than an order of ours — the same
                      // distinction the orders page draws. It disappears by
                      // itself once an admin links the parcel to its order.
                      selfOrderIds.has(pkg.id) ? (
                        <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                          {pickLang(language, { ku: "کڕینی خۆت", en: "Your own purchase", ar: "شراؤك الخاص", zh: "自购" })}
                        </span>
                      ) : undefined
                    }
                    onOpen={() =>
                      parcelSheet.openParcel(pkg as any, {
                        actions:
                          pkgPhotos.length > 0
                            ? [
                                {
                                  key: "photos",
                                  icon: Camera,
                                  label: {
                                    ku: `وێنەکان (${pkgPhotos.length})`,
                                    en: `Photos (${pkgPhotos.length})`,
                                    ar: `الصور (${pkgPhotos.length})`,
                                    zh: `照片（${pkgPhotos.length}）`,
                                  },
                                  onClick: () => openPhotoViewer(pkg.id),
                                },
                              ]
                            : undefined,
                        // Send this one parcel to whoever is receiving it. They
                        // need no account: the link shows that parcel alone.
                        content: <ShareParcelButton packageId={pkg.id} className="w-full" />,
                      })
                    }
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Photo Viewer Dialog */}
      <Dialog open={!!selectedPackage} onOpenChange={closePhotoViewer}>
        <DialogContent className="max-w-lg p-0 overflow-hidden bg-black/95">
          <DialogTitle className="sr-only">
            {pickLang(language, { ku: "وێنەکانی پاکەت", en: "Package Photos", ar: "صور الطرد", zh: "包裹照片" })}
          </DialogTitle>
          
          {selectedPkg && photos && photos.length > 0 && (
            <div className="relative">
              {/* Header */}
              <div className="absolute top-0 inset-x-0 z-10 bg-gradient-to-b from-black/60 to-transparent p-4">
                <div className="flex items-center justify-between text-white">
                  <div>
                    <p className="font-medium"><bdi dir="ltr">{selectedPkg.trackingNumber || selectedPkg.packageCode}</bdi></p>
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
                        "tap-44 absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white transition-all",
                        currentPhotoIndex === 0 ? "opacity-30 cursor-not-allowed" : "hover:bg-black/70"
                      )}
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </button>
                    <button
                      onClick={nextPhoto}
                      disabled={currentPhotoIndex === photos.length - 1}
                      className={cn(
                        "tap-44 absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white transition-all",
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
                  {Number(selectedPkg.weightKg) > 0 && (
                    <div className="flex items-center gap-1">
                      <Scale className="w-4 h-4 text-slate-400" />
                      <bdi dir="ltr">{fmtKg(selectedPkg.weightKg)}</bdi>
                    </div>
                  )}
                  {selectedPkg.lengthCm && selectedPkg.widthCm && selectedPkg.heightCm && (
                    <div className="flex items-center gap-1">
                      <Ruler className="w-4 h-4 text-slate-400" />
                      <bdi dir="ltr">{fmtDims(selectedPkg.lengthCm, selectedPkg.widthCm, selectedPkg.heightCm)}</bdi>
                    </div>
                  )}
                </div>
                {selectedPkg.description && (
                  <p className="text-sm text-slate-400 mt-2">{selectedPkg.description}</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {parcelSheet.sheet}
    </PortalLayout>
  );
}
