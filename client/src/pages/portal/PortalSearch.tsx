import { CustomerPortalLayout } from "@/components/CustomerPortalLayout";
import { PackageTrackingTimeline } from "@/components/portal/PackageTrackingTimeline";
import { PortalSearchSkeleton } from "@/components/portal/PortalListSkeleton";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import { Search, Package, X, CheckCircle, Truck, Clock, AlertCircle, Scale, Ruler, Camera, ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

function getInitialSearchQuery(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("q") ?? "";
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

  const photos = result?.photos as string[] | undefined;

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setHasSearched(true);
    await refetch();
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
        <h1 className="text-xl font-bold mb-4">{t("trackPackage") || "Track Package"}</h1>
        
        {/* Search Input */}
        <div className="relative">
          <Input
            type="text"
            placeholder={t("enterTrackingNumber") || "Enter tracking number..."}
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
      </div>

      {/* Search Results */}
      <div className="px-4 py-6">
        {!hasSearched ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-10 h-10 text-gray-300" />
            </div>
            <p className="text-gray-500">{t("enterTrackingToSearch") || "Enter a tracking number to search"}</p>
          </div>
        ) : isLoading ? (
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
                        <img 
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
        ) : (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Package className="w-10 h-10 text-red-300" />
            </div>
            <p className="text-gray-800 font-medium">{t("packageNotFound") || "Package not found"}</p>
            <p className="text-sm text-gray-500 mt-1">
              {t("checkTrackingNumber") || "Please check the tracking number and try again"}
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
                <img
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
                        <img
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
