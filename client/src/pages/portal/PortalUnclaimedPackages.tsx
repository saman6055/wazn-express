import { CustomerPortalLayout } from "@/components/CustomerPortalLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import { 
  Package, Search, AlertTriangle, Clock, CheckCircle, XCircle, 
  ChevronRight, Send, Loader2, PackageSearch, Scale, Calendar
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
export default function PortalUnclaimedPackages() {
  const { t, language } = useLanguage();
  const isRTL = language === "ku" || language === "ar";
  
  
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPackage, setSelectedPackage] = useState<any>(null);
  const [claimNote, setClaimNote] = useState("");
  const [isClaimDialogOpen, setIsClaimDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("unclaimed");
  
  // Queries
  const { data: unclaimedData, isLoading: unclaimedLoading, refetch: refetchUnclaimed } = 
    trpc.customerPortal.getUnclaimedPackages.useQuery({ search: searchTerm || undefined });
  
  const { data: myClaimRequests, isLoading: claimsLoading, refetch: refetchClaims } = 
    trpc.customerPortal.getMyClaimRequests.useQuery();
  
  // Mutations
  const createClaimMutation = trpc.customerPortal.createClaimRequest.useMutation({
    onSuccess: () => {
      alert(t("claimRequestSent") || "Claim request submitted successfully!");
      setIsClaimDialogOpen(false);
      setSelectedPackage(null);
      setClaimNote("");
      refetchUnclaimed();
      refetchClaims();
    },
    onError: (error) => {
      alert(error.message);
    },
  });

  const handleClaimSubmit = () => {
    if (!selectedPackage) return;
    createClaimMutation.mutate({
      packageId: selectedPackage.id,
      trackingNumber: selectedPackage.trackingNumber || selectedPackage.packageCode,
      customerNote: claimNote || undefined,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
            <Clock className="w-3 h-3" />
            {t("pending") || "Pending"}
          </span>
        );
      case "approved":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
            <CheckCircle className="w-3 h-3" />
            {t("approved") || "Approved"}
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
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
    <CustomerPortalLayout>
      {/* Header */}
      <div className="bg-gradient-to-br from-slate-800 via-slate-800 to-slate-700 text-white px-4 pt-12 pb-8">
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
                "pl-10 h-12 bg-gray-50 border-0 rounded-xl text-base",
                isRTL && "pr-10 pl-4 text-right"
              )}
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 mt-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full bg-gray-100 p-1 rounded-xl h-auto">
            <TabsTrigger 
              value="unclaimed" 
              className="flex-1 py-2.5 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              <PackageSearch className="w-4 h-4 mr-2" />
              {t("availablePackages") || "Available"}
              {unclaimedData?.total ? (
                <span className="ml-2 px-2 py-0.5 bg-slate-800 text-white text-xs rounded-full">
                  {unclaimedData.total}
                </span>
              ) : null}
            </TabsTrigger>
            <TabsTrigger 
              value="myClaims" 
              className="flex-1 py-2.5 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              <Send className="w-4 h-4 mr-2" />
              {t("myRequests") || "My Requests"}
              {myClaimRequests?.length ? (
                <span className="ml-2 px-2 py-0.5 bg-yellow-500 text-white text-xs rounded-full">
                  {myClaimRequests.filter(r => r.status === "pending").length || ""}
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
            ) : !unclaimedData?.packages.length ? (
              <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
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
                        <div className="w-12 h-12 bg-gradient-to-br from-orange-100 to-yellow-100 rounded-xl flex items-center justify-center">
                          <Package className="w-6 h-6 text-orange-600" />
                        </div>
                        <div className="flex-1">
                          {/* Tracking Number - Main Display */}
                          {pkg.trackingNumber && (
                            <div className="flex items-center gap-2 mb-1">
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                                {t("trackingNumber") || "Tracking"}
                              </span>
                              <p className="font-bold text-slate-800 text-base font-mono">
                                {pkg.trackingNumber}
                              </p>
                            </div>
                          )}
                          {/* Package Code */}
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded">
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
                        setSelectedPackage(pkg);
                        setIsClaimDialogOpen(true);
                      }}
                      className="w-full mt-3 bg-gradient-to-r from-slate-800 to-slate-700 hover:from-slate-700 hover:to-slate-600 text-white rounded-xl h-11"
                    >
                      <Send className="w-4 h-4 mr-2" />
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
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
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
                          request.status === "pending" ? "bg-yellow-100" :
                          request.status === "approved" ? "bg-green-100" : "bg-red-100"
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
                          <p className="font-semibold text-slate-800 text-sm">
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
                        request.status === "approved" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                      )}>
                        <p className="font-medium mb-1">
                          {t("adminResponse") || "Admin Response"}:
                        </p>
                        <p>{request.adminNote}</p>
                      </div>
                    )}
                    
                    {/* Customer Note */}
                    {request.customerNote && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-xl text-sm text-gray-600">
                        <p className="font-medium mb-1 text-gray-700">
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
              <Package className="w-5 h-5 text-slate-800" />
              {t("claimPackage") || "Claim Package"}
            </DialogTitle>
            <DialogDescription>
              {t("claimPackageDesc") || "Submit a request to claim this package as yours."}
            </DialogDescription>
          </DialogHeader>
          
          {selectedPackage && (
            <div className="space-y-4">
              {/* Package Info */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm">
                    <Package className="w-6 h-6 text-slate-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">
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
              
              {/* Note Input */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  {t("addNote") || "Add a note"} ({t("optional") || "optional"})
                </label>
                <Textarea
                  placeholder={t("claimNotePlaceholder") || "Explain why this package belongs to you..."}
                  value={claimNote}
                  onChange={(e) => setClaimNote(e.target.value)}
                  className="min-h-[100px] resize-none rounded-xl"
                />
              </div>
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
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t("submitting") || "Submitting..."}
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  {t("submitClaim") || "Submit Claim"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CustomerPortalLayout>
  );
}
