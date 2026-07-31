import { CustomerPortalLayout } from "@/components/CustomerPortalLayout";
import { usePortalPalette } from "@/components/portal/PortalHeaderControls";
import { WhatsAppHelpButton } from "@/components/portal/WhatsAppHelpButton";
import { PackageThumb, usePackageImages } from "@/components/portal/PackageThumb";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import { 
  Package, ChevronLeft, Truck, CheckCircle, Clock, AlertCircle, 
  Scale, Ruler, Box, Camera, X, ChevronRight, Plane, Ship,
  MapPin, Calendar, Download, Share2, FileText
} from "lucide-react";
import { Link, useParams } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getBatchEta, formatBatchEta } from "@/lib/batchEta";
import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

// Timeline step type
interface TimelineStep {
  status: string;
  label: string;
  labelKu: string;
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
  const isRTL = language === "ku" || language === "ar";
  const params = useParams<{ id: string }>();
  const batchId = parseInt(params.id || "0");
  
  const { data: batches } = trpc.customerPortal.getMyBatches.useQuery();
  const { data: packages, isLoading } = trpc.customerPortal.getMyPackagesInBatch.useQuery({ batchId });
  const { resolve: resolvePackageImage } = usePackageImages();
  
  const batch = batches?.find(b => b.id === batchId);
  
  // Photo viewer state
  const [selectedPackage, setSelectedPackage] = useState<number | null>(null);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  
  const selectedPkg = packages?.find(p => p.id === selectedPackage);
  const photos = selectedPkg?.photos as string[] | undefined;

  // Generate timeline steps based on batch status
  const getTimelineSteps = (): TimelineStep[] => {
    const statusOrder = ["preparing", "in_transit", "arrived", "customs", "delivered"];
    const currentIndex = statusOrder.indexOf(batch?.status || "preparing");
    
    return [
      { 
        status: "preparing", 
        label: "Preparing", 
        labelKu: "ئامادەکاری",
        icon: Package, 
        completed: currentIndex > 0, 
        current: currentIndex === 0 
      },
      { 
        status: "in_transit", 
        label: "In Transit", 
        labelKu: "لە ڕێگادا",
        icon: Plane, 
        completed: currentIndex > 1, 
        current: currentIndex === 1 
      },
      { 
        status: "arrived", 
        label: "Arrived", 
        labelKu: "گەیشتووە",
        icon: MapPin, 
        completed: currentIndex > 2, 
        current: currentIndex === 2 
      },
      { 
        status: "customs", 
        label: "Customs", 
        labelKu: "گومرگ",
        icon: FileText, 
        completed: currentIndex > 3, 
        current: currentIndex === 3 
      },
      { 
        status: "delivered", 
        label: "Delivered", 
        labelKu: "گەیشتووە",
        icon: CheckCircle, 
        completed: currentIndex >= 4 || batch?.status === "closed", 
        current: currentIndex === 4 || batch?.status === "closed"
      },
    ];
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "delivered":
        return <CheckCircle className="w-4 h-4" />;
      case "in_transit":
      case "out_for_delivery":
        return <Truck className="w-4 h-4" />;
      case "customs_processing":
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getStatusText = (status: string) => {
    if (language === "ku") {
      const statusMap: Record<string, string> = {
        registered: "تۆمارکراوە",
        in_batch: "لە باچدا",
        in_transit: "لە ڕێگادا",
        customs_processing: "گومرگ",
        ready_for_delivery: "ئامادەیە",
        out_for_delivery: "لە ڕێگای گەیاندن",
        delivered: "گەیشتووە",
      };
      return statusMap[status] || status;
    }
    const statusMap: Record<string, string> = {
      registered: "Registered",
      in_batch: "In Batch",
      in_transit: "In Transit",
      customs_processing: "Customs",
      ready_for_delivery: "Ready",
      out_for_delivery: "Out for Delivery",
      delivered: "Delivered",
    };
    return statusMap[status] || status;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "delivered":
        return isDark ? "bg-emerald-900/50 text-emerald-400" : "bg-emerald-100 text-emerald-700";
      case "in_transit":
      case "out_for_delivery":
        return isDark ? "bg-blue-900/50 text-blue-400" : "bg-blue-100 text-blue-700";
      case "customs_processing":
        return isDark ? "bg-amber-900/50 text-amber-400" : "bg-amber-100 text-amber-700";
      default:
        return isDark ? "bg-slate-700 text-slate-300" : "bg-slate-100 text-slate-600";
    }
  };

  const openPhotoViewer = (packageId: number) => {
    setSelectedPackage(packageId);
    setCurrentPhotoIndex(0);
  };

  const closePhotoViewer = () => {
    setSelectedPackage(null);
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

  const handleShare = async () => {
    try {
      await navigator.share({
        title: `Batch ${batch?.batchCode}`,
        text: `Track my shipment: ${batch?.batchCode}`,
        url: window.location.href
      });
    } catch {
      // Fallback to copy
      navigator.clipboard.writeText(window.location.href);
      toast.success(language === "ku" ? "لینک کۆپی کرا" : "Link copied!");
    }
  };

  const timelineSteps = getTimelineSteps();

  return (
    <CustomerPortalLayout>
      {/* Header */}
      <div className="text-white px-4 pt-12 pb-8" style={portalBanner}>
        <Link href="/portal/shipments">
          <button className="flex items-center gap-1 text-slate-300 mb-3 hover:text-white transition-colors">
            <ChevronLeft className={cn("w-5 h-5", isRTL && "rotate-180")} />
            <span className="text-sm">{language === "ku" ? "گەڕانەوە" : "Back"}</span>
          </button>
        </Link>
        
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{batch?.batchCode || "..."}</h1>
            {batch && (
              <div className="flex items-center gap-2 mt-2">
                <span className={cn(
                  "px-3 py-1 rounded-full text-xs font-medium",
                  batch.status === "in_transit" ? "bg-blue-500/20 text-blue-300" :
                  batch.status === "delivered" || batch.status === "closed" ? "bg-emerald-500/20 text-emerald-300" :
                  "bg-slate-600 text-slate-200"
                )}>
                  {batch.shippingType === "sea" ? "🚢" : "✈️"} {batch.shippingType?.replace("_", " ")}
                </span>
                <span className="text-slate-400 text-sm">
                  • {packages?.length || 0} {language === "ku" ? "پاکەت" : "packages"}
                </span>
              </div>
            )}
            {batch && (
              <div className="mt-3">
                <WhatsAppHelpButton
                  language={language}
                  section={language === "ku" ? "وردەکاری بار" : language === "ar" ? "تفاصيل الشحنة" : language === "zh" ? "货运详情" : "Batch detail"}
                  topic={`${batch.batchCode} — ${batch.status}`}
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
          "rounded-2xl shadow-lg p-5 transition-colors duration-300",
          isDark ? "bg-slate-800" : "bg-white"
        )}>
          <h3 className={cn("font-semibold mb-4", isDark ? "text-white" : "text-slate-800")}>
            {language === "ku" ? "شوێنکەوتنی بار" : "Shipment Progress"}
          </h3>
          
          <div className="relative">
            {/* Timeline line */}
            <div className={cn(
              "absolute top-5 left-5 right-5 h-1 rounded-full",
              isDark ? "bg-slate-700" : "bg-slate-100"
            )} />
            
            {/* Progress line */}
            <div 
              className="absolute top-5 left-5 h-1 rounded-full bg-gradient-to-r from-emerald-500 to-blue-500 transition-all duration-500"
              style={{ 
                width: `${(timelineSteps.filter(s => s.completed || s.current).length - 1) / (timelineSteps.length - 1) * 100}%` 
              }}
            />
            
            {/* Steps */}
            <div className="relative flex justify-between">
              {timelineSteps.map((step, index) => (
                <div key={step.status} className="flex flex-col items-center">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 z-10",
                    step.completed 
                      ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30" 
                      : step.current 
                        ? "bg-blue-500 text-white shadow-lg shadow-blue-500/30 animate-pulse" 
                        : (isDark ? "bg-slate-700 text-slate-500" : "bg-slate-100 text-slate-400")
                  )}>
                    <step.icon className="w-5 h-5" />
                  </div>
                  <span className={cn(
                    "text-xs font-medium mt-2 text-center max-w-[60px]",
                    step.completed || step.current 
                      ? (isDark ? "text-white" : "text-slate-800")
                      : (isDark ? "text-slate-500" : "text-slate-400")
                  )}>
                    {language === "ku" ? step.labelKu : step.label}
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
                isDark ? "border-slate-700" : "border-slate-100"
              )}>
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center",
                  isDark ? "bg-blue-900/50" : "bg-blue-50"
                )}>
                  <Calendar className={cn("w-5 h-5", isDark ? "text-blue-400" : "text-blue-600")} />
                </div>
                <div>
                  <p className={cn("text-xs", isDark ? "text-slate-400" : "text-slate-500")}>
                    {language === "ku" ? "کاتی گەیشتنی خەمڵێنراو" : language === "ar" ? "الوصول المتوقع" : language === "zh" ? "预计到达" : "Estimated Arrival"}
                  </p>
                  <p className={cn("font-semibold", isDark ? "text-white" : "text-slate-800")}>
                    {eta.kind === "exact"
                      ? eta.date.toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
                      : formatBatchEta(eta)}
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
        isDark ? "bg-slate-900" : "bg-slate-50"
      )}>
        <div className="flex items-center justify-between mb-4">
          <h2 className={cn("font-semibold", isDark ? "text-white" : "text-slate-800")}>
            {language === "ku" ? "پاکەتەکانت" : "Your Packages"}
          </h2>
          <span className={cn(
            "px-3 py-1 rounded-full text-sm font-medium",
            isDark ? "bg-slate-800 text-slate-300" : "bg-white text-slate-600"
          )}>
            {packages?.length || 0}
          </span>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className={cn("h-32 w-full rounded-2xl", isDark && "bg-slate-800")} />
            ))}
          </div>
        ) : packages?.length === 0 ? (
          <div className={cn(
            "rounded-2xl p-10 text-center transition-colors duration-300",
            isDark ? "bg-slate-800" : "bg-white"
          )}>
            <Package className={cn("w-12 h-12 mx-auto mb-3", isDark ? "text-slate-600" : "text-slate-300")} />
            <p className={cn(isDark ? "text-slate-400" : "text-slate-500")}>
              {language === "ku" ? "هیچ پاکەتێک نییە" : "No packages"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {packages?.map((pkg) => {
              const pkgPhotos = pkg.photos as string[] | undefined;
              const hasPhotos = pkgPhotos && pkgPhotos.length > 0;
              const thumb = resolvePackageImage(pkg);

              return (
                <div key={pkg.id} className={cn(
                  "rounded-2xl p-4 shadow-sm transition-all duration-300 border",
                  isDark
                    ? "bg-slate-800 border-slate-700"
                    : "bg-white border-slate-100"
                )}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <PackageThumb
                        resolved={thumb}
                        language={language}
                        isDark={isDark}
                        size={48}
                        onClick={hasPhotos ? () => openPhotoViewer(pkg.id) : undefined}
                      />
                      <div>
                        <p className={cn("font-bold", isDark ? "text-white" : "text-slate-800")}>
                          {pkg.trackingNumber || pkg.packageCode}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={cn(
                            "text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1",
                            getStatusColor(pkg.status)
                          )}>
                            {getStatusIcon(pkg.status)}
                            {getStatusText(pkg.status)}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Photo indicator button */}
                    {hasPhotos && (
                      <button
                        onClick={() => openPhotoViewer(pkg.id)}
                        className={cn(
                          "flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                          isDark 
                            ? "bg-blue-900/50 text-blue-400 hover:bg-blue-900/70" 
                            : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                        )}
                      >
                        <Camera className="w-4 h-4" />
                        <span>{pkgPhotos.length}</span>
                      </button>
                    )}
                  </div>

                  {/* Package Details */}
                  <div className={cn(
                    "mt-4 pt-3 border-t grid grid-cols-2 gap-3",
                    isDark ? "border-slate-700" : "border-slate-100"
                  )}>
                    {pkg.weightKg && (
                      <div className={cn(
                        "flex items-center gap-2 p-2 rounded-lg",
                        isDark ? "bg-slate-700/50" : "bg-slate-50"
                      )}>
                        <Scale className={cn("w-4 h-4", isDark ? "text-slate-400" : "text-slate-500")} />
                        <span className={cn("text-sm font-medium", isDark ? "text-slate-300" : "text-slate-600")}>
                          {pkg.weightKg} kg
                        </span>
                      </div>
                    )}
                    {pkg.lengthCm && pkg.widthCm && pkg.heightCm && (
                      <div className={cn(
                        "flex items-center gap-2 p-2 rounded-lg",
                        isDark ? "bg-slate-700/50" : "bg-slate-50"
                      )}>
                        <Ruler className={cn("w-4 h-4", isDark ? "text-slate-400" : "text-slate-500")} />
                        <span className={cn("text-sm font-medium", isDark ? "text-slate-300" : "text-slate-600")}>
                          {pkg.lengthCm}×{pkg.widthCm}×{pkg.heightCm} cm
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Photo thumbnails preview */}
                  {hasPhotos && (
                    <div className={cn(
                      "mt-3 pt-3 border-t",
                      isDark ? "border-slate-700" : "border-slate-100"
                    )}>
                      <button 
                        onClick={() => openPhotoViewer(pkg.id)}
                        className="flex items-center gap-3 w-full"
                      >
                        <div className="flex -space-x-2">
                          {pkgPhotos.slice(0, 3).map((photo, idx) => (
                            <div 
                              key={idx}
                              className={cn(
                                "w-12 h-12 rounded-xl border-2 shadow-sm overflow-hidden",
                                isDark ? "border-slate-700 bg-slate-700" : "border-white bg-slate-100"
                              )}
                            >
                              <img loading="lazy" decoding="async" 
                                src={photo} 
                                alt={`Package photo ${idx + 1}`}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2'%3E%3Crect x='3' y='3' width='18' height='18' rx='2' ry='2'%3E%3C/rect%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'%3E%3C/circle%3E%3Cpolyline points='21 15 16 10 5 21'%3E%3C/polyline%3E%3C/svg%3E";
                                }}
                              />
                            </div>
                          ))}
                          {pkgPhotos.length > 3 && (
                            <div className={cn(
                              "w-12 h-12 rounded-xl border-2 shadow-sm flex items-center justify-center",
                              isDark ? "border-slate-700 bg-slate-700" : "border-white bg-slate-100"
                            )}>
                              <span className={cn("text-xs font-medium", isDark ? "text-slate-400" : "text-slate-500")}>
                                +{pkgPhotos.length - 3}
                              </span>
                            </div>
                          )}
                        </div>
                        <span className={cn(
                          "text-sm font-medium",
                          isDark ? "text-blue-400" : "text-blue-600"
                        )}>
                          {language === "ku" ? "بینینی وێنەکان" : "View Photos"} →
                        </span>
                      </button>
                    </div>
                  )}

                  {/* Description */}
                  {pkg.description && (
                    <p className={cn(
                      "text-sm mt-3 line-clamp-2",
                      isDark ? "text-slate-400" : "text-slate-500"
                    )}>
                      {pkg.description}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Photo Viewer Dialog */}
      <Dialog open={!!selectedPackage} onOpenChange={closePhotoViewer}>
        <DialogContent className="max-w-lg p-0 overflow-hidden bg-black/95">
          <DialogTitle className="sr-only">
            {language === "ku" ? "وێنەکانی پاکەت" : "Package Photos"}
          </DialogTitle>
          
          {selectedPkg && photos && photos.length > 0 && (
            <div className="relative">
              {/* Header */}
              <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/60 to-transparent p-4">
                <div className="flex items-center justify-between text-white">
                  <div>
                    <p className="font-medium">{selectedPkg.trackingNumber || selectedPkg.packageCode}</p>
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
                  {selectedPkg.weightKg && (
                    <div className="flex items-center gap-1">
                      <Scale className="w-4 h-4 text-gray-400" />
                      <span>{selectedPkg.weightKg} kg</span>
                    </div>
                  )}
                  {selectedPkg.lengthCm && selectedPkg.widthCm && selectedPkg.heightCm && (
                    <div className="flex items-center gap-1">
                      <Ruler className="w-4 h-4 text-gray-400" />
                      <span>{selectedPkg.lengthCm}×{selectedPkg.widthCm}×{selectedPkg.heightCm} cm</span>
                    </div>
                  )}
                </div>
                {selectedPkg.description && (
                  <p className="text-sm text-gray-400 mt-2">{selectedPkg.description}</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </CustomerPortalLayout>
  );
}
