import { PortalLayout } from "@/components/portal/PortalLayout";
import { usePortalPalette } from "@/components/portal/PortalHeaderControls";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import {
  Package, Search, AlertTriangle, Clock, CheckCircle, XCircle,
  ChevronRight, Send, Loader2, PackageSearch, Scale, Calendar, MessageCircle
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import CompressedImageUpload from "@/components/CompressedImageUpload";
import { PhotoStack } from "@/components/PhotoStack";
import { pickLang } from "@/lib/lang";
import { toast } from "sonner";
import { PortalErrorState } from "@/components/portal/PortalErrorState";

// Company WhatsApp for extra proof / questions when claiming a package.
import { TERMS_WHATSAPP_NUMBER as SUPPORT_WHATSAPP } from "@/constants/portalTerms";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
export default function PortalUnclaimedPackages() {
  const { t, language } = useLanguage();

  // Banner colour follows the mode the customer picked, like every other page.

  const { banner: portalBanner } = usePortalPalette();
  const isRTL = language === "ku" || language === "ar";
  
  
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPackage, setSelectedPackage] = useState<any>(null);
  const [claimNote, setClaimNote] = useState("");
  const [proofImages, setProofImages] = useState<string[]>([]);
  const [isClaimDialogOpen, setIsClaimDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("unclaimed");
  
  // Queries
  const { data: unclaimedData, isLoading: unclaimedLoading, isError: unclaimedError, isFetching: unclaimedFetching, refetch: refetchUnclaimed } = 
    trpc.customerPortal.getUnclaimedPackages.useQuery({ search: searchTerm || undefined });
  
  const { data: myClaimRequests, isLoading: claimsLoading, refetch: refetchClaims } = 
    trpc.customerPortal.getMyClaimRequests.useQuery();
  
  // Mutations
  const createClaimMutation = trpc.customerPortal.createClaimRequest.useMutation({
    onSuccess: () => {
      toast.success(pickLang(language, { ku: "داواکارییەکەت نێردرا", en: "Claim submitted", ar: "تم إرسال الطلب", zh: "申请已提交" }));
      setIsClaimDialogOpen(false);
      setSelectedPackage(null);
      setClaimNote("");
      setProofImages([]);
      refetchUnclaimed();
      refetchClaims();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleClaimSubmit = () => {
    if (!selectedPackage) return;
    // Proof is mandatory: a written reason AND at least one evidence image.
    if (!claimNote.trim()) {
      toast.error(pickLang(language, { ku: "تکایە هۆکاری خاوەندارییەکە بنووسە", en: "Please write why this package is yours", ar: "يرجى كتابة سبب ملكيتك للطرد", zh: "请说明此包裹归属您的原因" }));
      return;
    }
    if (proofImages.length === 0) {
      toast.error(pickLang(language, { ku: "تکایە لانیکەم یەک وێنەی بەڵگە/سکرینشۆتی کڕین دابنێ", en: "Please attach at least one proof/purchase screenshot", ar: "يرجى إرفاق صورة إثبات/لقطة شراء واحدة على الأقل", zh: "请至少附上一张购买凭证/截图" }));
      return;
    }
    createClaimMutation.mutate({
      packageId: selectedPackage.id,
      trackingNumber: selectedPackage.trackingNumber || selectedPackage.packageCode,
      customerNote: claimNote.trim(),
      proofImages,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-950/40 text-yellow-700 dark:text-yellow-300">
            <Clock className="w-3 h-3" />
            {t("pending") || "Pending"}
          </span>
        );
      case "approved":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300">
            <CheckCircle className="w-3 h-3" />
            {t("approved") || "Approved"}
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300">
            <XCircle className="w-3 h-3" />
            {t("rejected") || "Rejected"}
          </span>
        );
      default:
        return null;
    }
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString(language === "ku" ? "ckb-IQ" : language === "ar" ? "ar-IQ" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <PortalLayout>
      {/* Header */}
      <div className="text-white px-4 pt-12 pb-8" style={portalBanner}>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold">{t("unclaimedPackages") || "Unclaimed Packages"}</h1>
            <p className="text-slate-300 text-sm">
              {t("findYourPackage") || "Find and claim your package"}
            </p>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="px-4 -mt-4">
        <div className="bg-white rounded-2xl shadow-lg p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              type="text"
              placeholder={t("searchByTrackingNumber") || "Search by tracking number..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={cn(
                "pl-10 h-12 bg-gray-50 dark:bg-gray-950/40 border-0 rounded-xl text-base",
                isRTL && "pr-10 pl-4 text-right"
              )}
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 mt-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full bg-gray-100 dark:bg-gray-950/40 p-1 rounded-xl h-auto">
            <TabsTrigger 
              value="unclaimed" 
              className="flex-1 py-2.5 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              <PackageSearch className="w-4 h-4 me-2" />
              {t("availablePackages") || "Available"}
              {unclaimedData?.total ? (
                <span className="ms-2 px-2 py-0.5 bg-slate-800 text-white text-xs rounded-full">
                  {unclaimedData.total}
                </span>
              ) : null}
            </TabsTrigger>
            <TabsTrigger 
              value="myClaims" 
              className="flex-1 py-2.5 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              <Send className="w-4 h-4 me-2" />
              {t("myRequests") || "My Requests"}
              {/* Was gated on having any requests at all, then printed
                  `length || ""` — an empty yellow pill whenever none were
                  pending. Gate on the number actually being shown. */}
              {(myClaimRequests?.filter(r => r.status === "pending").length ?? 0) > 0 ? (
                <span className="ms-2 px-2 py-0.5 bg-yellow-500 text-white text-xs rounded-full">
                  {myClaimRequests!.filter(r => r.status === "pending").length}
                </span>
              ) : null}
            </TabsTrigger>
          </TabsList>

          {/* Unclaimed Packages Tab */}
          <TabsContent value="unclaimed" className="mt-4">
            {unclaimedLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map(i => (
                  <Skeleton key={i} className="h-28 w-full rounded-xl" />
                ))}
              </div>
            ) : unclaimedError ? (
              /* The pool a customer searches for their own missing parcel. Saying
                 it is empty when the request failed sends them away. */
              <PortalErrorState onRetry={() => void refetchUnclaimed()} isRetrying={unclaimedFetching} />
            ) : !unclaimedData?.packages.length ? (
              <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-950/40 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Package className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-600 font-medium">
                  {searchTerm 
                    ? (t("noPackagesFound") || "No packages found") 
                    : (t("noUnclaimedPackages") || "No unclaimed packages")}
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  {searchTerm 
                    ? (t("tryDifferentSearch") || "Try a different tracking number")
                    : (t("allPackagesClaimed") || "All packages have been claimed")}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {unclaimedData.packages.map((pkg) => (
                  <div 
                    key={pkg.id}
                    className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        {/* An unclaimed parcel is identified by its photos, so
                            all of them matter — this used to open only the
                            first one, in a new browser tab. */}
                        <PhotoStack
                          photos={pkg.photos ?? []}
                          className="w-12 h-12 rounded-xl border border-orange-100 dark:border-orange-800/60"
                          fallback={
                            <div className="w-12 h-12 bg-gradient-to-br from-orange-100 to-yellow-100 rounded-xl flex items-center justify-center shrink-0">
                              <Package className="w-6 h-6 text-orange-600" />
                            </div>
                          }
                        />
                        <div className="flex-1">
                          {/* Tracking Number - Main Display */}
                          {pkg.trackingNumber && (
                            <div className="flex items-center gap-2 mb-1">
                              <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs font-medium rounded">
                                {t("trackingNumber") || "Tracking"}
                              </span>
                              <p className="font-bold text-slate-800 dark:text-slate-200 text-base font-mono">
                                {pkg.trackingNumber}
                              </p>
                            </div>
                          )}
                          {/* Package Code */}
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-950/40 text-gray-600 text-xs font-medium rounded">
                              {t("packageCode") || "Code"}
                            </span>
                            <p className="text-sm text-gray-600 font-mono">
                              {pkg.packageCode}
                            </p>
                          </div>
                          
                          {/* Package Details */}
                          <div className="flex flex-wrap gap-3 mt-2">
                            {pkg.weightKg && (
                              <div className="flex items-center gap-1 text-xs text-gray-500">
                                <Scale className="w-3 h-3" />
                                <span>{pkg.weightKg} kg</span>
                              </div>
                            )}
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                              <Calendar className="w-3 h-3" />
                              <span>{formatDate(pkg.createdAt)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Claim Button */}
                    <Button
                      onClick={() => {
                        // Clear the previous package's evidence. These were
                        // reset only on a successful submit, so writing a
                        // reason and attaching photos for one parcel, backing
                        // out, then opening another claimed the second parcel
                        // using the first one's proof of ownership.
                        setClaimNote("");
                        setProofImages([]);
                        setSelectedPackage(pkg);
                        setIsClaimDialogOpen(true);
                      }}
                      className="w-full mt-3 bg-gradient-to-r from-slate-800 to-slate-700 hover:from-slate-700 hover:to-slate-600 text-white rounded-xl h-11"
                    >
                      <Send className="w-4 h-4 me-2" />
                      {t("claimThisPackage") || "Claim This Package"}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* My Claims Tab */}
          <TabsContent value="myClaims" className="mt-4">
            {claimsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-24 w-full rounded-xl" />
                ))}
              </div>
            ) : !myClaimRequests?.length ? (
              <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-950/40 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Send className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-600 font-medium">
                  {t("noClaimRequests") || "No claim requests yet"}
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  {t("claimRequestsWillAppearHere") || "Your claim requests will appear here"}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {myClaimRequests.map((request) => (
                  <div 
                    key={request.id}
                    className="bg-white rounded-2xl p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center",
                          request.status === "pending" ? "bg-yellow-100 dark:bg-yellow-950/40" :
                          request.status === "approved" ? "bg-green-100 dark:bg-green-950/40" : "bg-red-100 dark:bg-red-950/40"
                        )}>
                          {request.status === "pending" ? (
                            <Clock className="w-6 h-6 text-yellow-600" />
                          ) : request.status === "approved" ? (
                            <CheckCircle className="w-6 h-6 text-green-600" />
                          ) : (
                            <XCircle className="w-6 h-6 text-red-600" />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                            {request.trackingNumber}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {request.requestNumber}
                          </p>
                          <div className="mt-2">
                            {getStatusBadge(request.status)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-400">
                          {formatDate(request.createdAt)}
                        </p>
                      </div>
                    </div>
                    
                    {/* Admin Note */}
                    {request.adminNote && (
                      <div className={cn(
                        "mt-3 p-3 rounded-xl text-sm",
                        request.status === "approved" ? "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300" : "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300"
                      )}>
                        <p className="font-medium mb-1">
                          {t("adminResponse") || "Admin Response"}:
                        </p>
                        <p>{request.adminNote}</p>
                      </div>
                    )}
                    
                    {/* Customer Note */}
                    {request.customerNote && (
                      <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-950/40 rounded-xl text-sm text-gray-600">
                        <p className="font-medium mb-1 text-gray-700 dark:text-gray-300">
                          {t("yourNote") || "Your Note"}:
                        </p>
                        <p>{request.customerNote}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Claim Dialog */}
      <Dialog open={isClaimDialogOpen} onOpenChange={setIsClaimDialogOpen}>
        <DialogContent className="sm:max-w-md mx-4 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-slate-800 dark:text-slate-200" />
              {t("claimPackage") || "Claim Package"}
            </DialogTitle>
            <DialogDescription>
              {t("claimPackageDesc") || "Submit a request to claim this package as yours."}
            </DialogDescription>
          </DialogHeader>
          
          {selectedPackage && (
            <div className="space-y-4">
              {/* Package Info */}
              <div className="bg-gray-50 dark:bg-gray-950/40 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <PhotoStack
                    photos={selectedPackage.photos ?? []}
                    className="w-12 h-12 rounded-xl shadow-sm"
                    fallback={
                      <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm shrink-0">
                        <Package className="w-6 h-6 text-slate-600" />
                      </div>
                    }
                  />
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                      {selectedPackage.trackingNumber || selectedPackage.packageCode}
                    </p>
                    <p className="text-sm text-gray-500">
                      {selectedPackage.weightKg && `${selectedPackage.weightKg} kg`}
                      {selectedPackage.weightKg && selectedPackage.createdAt && " • "}
                      {selectedPackage.createdAt && formatDate(selectedPackage.createdAt)}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Note Input (required) */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                  {pickLang(language, { ku: "هۆکاری خاوەنداری", en: "Reason for ownership", ar: "سبب الملكية", zh: "归属原因" })}
                  <span className="text-red-500"> *</span>
                </label>
                <Textarea
                  placeholder={pickLang(language, { ku: "بۆ نموونە: لە عەلی بابا کڕیم، لەگەڵ سەپلایەر قسەم کرد...", en: "e.g. I bought it on Alibaba, spoke with the supplier...", ar: "مثال: اشتريته من علي بابا، تحدثت مع المورد...", zh: "例如：我在阿里巴巴购买，与供应商沟通过……" })}
                  value={claimNote}
                  onChange={(e) => setClaimNote(e.target.value)}
                  className="min-h-[90px] resize-none rounded-xl"
                />
              </div>

              {/* Proof images (required) */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                  {pickLang(language, { ku: "بەڵگە / سکرینشۆتی کڕین", en: "Proof / purchase screenshot", ar: "الإثبات / لقطة الشراء", zh: "凭证 / 购买截图" })}
                  <span className="text-red-500"> *</span>
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  {pickLang(language, { ku: "سکرینشۆتی کڕین، وێنەی سەپلایەر، یان وێنەی ویچات دابنێ", en: "Attach a purchase screenshot, supplier photo, or WeChat image", ar: "أرفق لقطة شراء أو صورة المورد أو صورة من WeChat", zh: "附上购买截图、供应商照片或微信图片" })}
                </p>
                <CompressedImageUpload images={proofImages} onChange={setProofImages} maxImages={5} />
              </div>

              {/* WhatsApp — extra proof / questions */}
              <a
                href={`https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(
                  pickLang(language, {
                    ku: `سڵاو، دەربارەی داواکاری خاوەنداری پاکەتی تراکینگ ${selectedPackage.trackingNumber || selectedPackage.packageCode}`,
                    en: `Hello, regarding my claim for package tracking ${selectedPackage.trackingNumber || selectedPackage.packageCode}`,
                    ar: `مرحباً، بخصوص مطالبتي بالطرد رقم التتبع ${selectedPackage.trackingNumber || selectedPackage.packageCode}`,
                    zh: `您好，关于我认领运单号 ${selectedPackage.trackingNumber || selectedPackage.packageCode} 的包裹`,
                  })
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl border border-green-500 bg-green-50 dark:bg-green-950/40 px-4 py-2.5 text-sm font-semibold text-green-700 dark:text-green-300 transition-colors hover:bg-green-100"
              >
                <MessageCircle className="w-4 h-4" />
                {pickLang(language, { ku: "بەڵگەی زیاتر بنێرە بە واتساپ", en: "Send more proof via WhatsApp", ar: "أرسل إثباتاً إضافياً عبر واتساب", zh: "通过 WhatsApp 发送更多凭证" })}
              </a>
            </div>
          )}
          
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsClaimDialogOpen(false)}
              className="rounded-xl"
            >
              {t("cancel") || "Cancel"}
            </Button>
            <Button
              onClick={handleClaimSubmit}
              disabled={createClaimMutation.isPending}
              className="bg-gradient-to-r from-slate-800 to-slate-700 hover:from-slate-700 hover:to-slate-600 rounded-xl"
            >
              {createClaimMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 me-2 animate-spin" />
                  {t("submitting") || "Submitting..."}
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 me-2" />
                  {t("submitClaim") || "Submit Claim"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}
