import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import {
  Package, Clock, CheckCircle, XCircle, User, Calendar,
  MessageSquare, Loader2, Search, Filter, ChevronDown, Image as ImageIcon
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/contexts/LanguageContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type StatusFilter = "all" | "pending" | "approved" | "rejected";

export default function ClaimRequests() {
    const { t } = useTranslation();
const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [adminNote, setAdminNote] = useState("");
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  
  // Queries
  const { data, isLoading, refetch } = trpc.packages.getClaimRequests.useQuery({
    status: statusFilter === "all" ? undefined : statusFilter,
  });
  
  const { data: pendingCount } = trpc.packages.getPendingClaimRequestsCount.useQuery();
  
  // Get customer data for each request
  const customerIds = data?.requests.map(r => r.customerId) || [];
  const { data: customers } = trpc.customers.list.useQuery(undefined, {
    enabled: customerIds.length > 0,
  });
  
  // Mutations
  const approveMutation = trpc.packages.approveClaimRequest.useMutation({
    onSuccess: () => {
      setSelectedRequest(null);
      setAdminNote("");
      setActionType(null);
      refetch();
    },
  });
  
  const rejectMutation = trpc.packages.rejectClaimRequest.useMutation({
    onSuccess: () => {
      setSelectedRequest(null);
      setAdminNote("");
      setActionType(null);
      refetch();
    },
  });

  const handleAction = () => {
    if (!selectedRequest || !actionType) return;
    
    if (actionType === "approve") {
      approveMutation.mutate({
        requestId: selectedRequest.id,
        adminNote: adminNote || undefined,
      });
    } else {
      rejectMutation.mutate({
        requestId: selectedRequest.id,
        adminNote: adminNote || undefined,
      });
    }
  };

  const getCustomerName = (customerId: number) => {
    const customer = customers?.find(c => c.id === customerId);
    return customer?.fullName || customer?.customerCode || `Customer #${customerId}`;
  };

  const getCustomerCode = (customerId: number) => {
    const customer = customers?.find(c => c.id === customerId);
    return customer?.customerCode || "";
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-950/40 text-yellow-700 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800/60">
            <Clock className="w-3.5 h-3.5" />
            {t("common.pending")}
          </span>
        );
      case "approved":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800/60">
            <CheckCircle className="w-3.5 h-3.5" />
            {t("common.approved")}
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/60">
            <XCircle className="w-3.5 h-3.5" />
            {t("common.rejected")}
          </span>
        );
      default:
        return null;
    }
  };

  const filteredRequests = data?.requests.filter(request => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      request.trackingNumber.toLowerCase().includes(searchLower) ||
      request.requestNumber.toLowerCase().includes(searchLower) ||
      getCustomerName(request.customerId).toLowerCase().includes(searchLower) ||
      getCustomerCode(request.customerId).toLowerCase().includes(searchLower)
    );
  }) || [];

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-200 flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center">
                <Package className="w-5 h-5 text-white" />
              </div>
              {t("claimRequests.title")}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              {t("claimRequests.subtitle")}
            </p>
          </div>
          
          {/* Stats */}
          <div className="flex gap-3">
            <Card className="bg-gradient-to-br from-yellow-50 dark:from-yellow-950/40 to-orange-50 dark:to-orange-950/40 border-yellow-200 dark:border-yellow-800/60">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-yellow-100 dark:bg-yellow-950/40 rounded-lg flex items-center justify-center">
                    <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-300" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">{pendingCount || 0}</p>
                    <p className="text-xs text-yellow-600 dark:text-yellow-300">{t("common.pending")}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder={t("claimRequests.searchPlaceholder")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter className="w-4 h-4" />
                {statusFilter === "all" ? "All Status" : 
                 statusFilter === "pending" ? "Pending" :
                 statusFilter === "approved" ? "Approved" : "Rejected"}
                <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setStatusFilter("all")}>
                All Status
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("pending")}>
                <Clock className="w-4 h-4 me-2 text-yellow-500 dark:text-yellow-400" />
                Pending
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("approved")}>
                <CheckCircle className="w-4 h-4 me-2 text-green-500 dark:text-green-400" />
                Approved
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("rejected")}>
                <XCircle className="w-4 h-4 me-2 text-red-500 dark:text-red-400" />
                Rejected
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Requests List */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-32 w-full rounded-xl" />
            ))}
          </div>
        ) : filteredRequests.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-950/40 rounded-full flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">No claim requests found</h3>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              {statusFilter === "pending" 
                ? "There are no pending claim requests at the moment."
                : "No claim requests match your filters."}
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredRequests.map((request) => (
              <Card key={request.id} className="overflow-hidden hover:shadow-md transition-shadow">
                <CardContent className="p-0">
                  <div className="flex flex-col md:flex-row">
                    {/* Main Info */}
                    <div className="flex-1 p-5">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-12 h-12 rounded-xl flex items-center justify-center",
                            request.status === "pending" ? "bg-yellow-100 dark:bg-yellow-950/40" :
                            request.status === "approved" ? "bg-green-100 dark:bg-green-950/40" : "bg-red-100 dark:bg-red-950/40"
                          )}>
                            <Package className={cn(
                              "w-6 h-6",
                              request.status === "pending" ? "text-yellow-600 dark:text-yellow-300" :
                              request.status === "approved" ? "text-green-600 dark:text-green-300" : "text-red-600 dark:text-red-300"
                            )} />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800 dark:text-slate-200">
                              {request.trackingNumber}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {request.requestNumber}
                            </p>
                          </div>
                        </div>
                        {getStatusBadge(request.status)}
                      </div>
                      
                      {/* Customer & Date Info */}
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                          <User className="w-4 h-4 text-gray-400" />
                          <span>
                            {getCustomerName(request.customerId)}
                            {getCustomerCode(request.customerId) && (
                              <span className="text-gray-400 ms-1">
                                ({getCustomerCode(request.customerId)})
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span>{formatDate(request.createdAt)}</span>
                        </div>
                      </div>
                      
                      {/* Customer Note */}
                      {request.customerNote && (
                        <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-950/40 rounded-lg">
                          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
                            <MessageSquare className="w-4 h-4" />
                            Customer Note
                          </div>
                          <p className="text-sm text-gray-700 dark:text-gray-300">{request.customerNote}</p>
                        </div>
                      )}

                      {/* Proof of ownership images */}
                      {request.proofImages && request.proofImages.length > 0 && (
                        <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-950/40 rounded-lg">
                          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-2">
                            <ImageIcon className="w-4 h-4" />
                            {t("claimRequests.proofImages") || "Proof of ownership"} ({request.proofImages.length})
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {request.proofImages.map((img: string, i: number) => (
                              <img
                                key={i}
                                src={img}
                                alt=""
                                onClick={() => window.open(img, "_blank", "noopener,noreferrer")}
                                className="w-20 h-20 rounded-lg object-cover border cursor-zoom-in transition-opacity hover:opacity-90"
                              />
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Admin Note */}
                      {request.adminNote && (
                        <div className={cn(
                          "mt-3 p-3 rounded-lg",
                          request.status === "approved" ? "bg-green-50 dark:bg-green-950/40" : "bg-red-50 dark:bg-red-950/40"
                        )}>
                          <div className={cn(
                            "flex items-center gap-2 text-sm mb-1",
                            request.status === "approved" ? "text-green-600 dark:text-green-300" : "text-red-600 dark:text-red-300"
                          )}>
                            {request.status === "approved" ? (
                              <CheckCircle className="w-4 h-4" />
                            ) : (
                              <XCircle className="w-4 h-4" />
                            )}
                            Admin Response
                          </div>
                          <p className={cn(
                            "text-sm",
                            request.status === "approved" ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"
                          )}>
                            {request.adminNote}
                          </p>
                        </div>
                      )}
                    </div>
                    
                    {/* Actions */}
                    {request.status === "pending" && (
                      <div className="flex md:flex-col gap-2 p-5 bg-gray-50 dark:bg-gray-950/40 border-t md:border-t-0 md:border-l">
                        <Button
                          onClick={() => {
                            setSelectedRequest(request);
                            setActionType("approve");
                          }}
                          className="flex-1 bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="w-4 h-4 me-2" />
                          Approve
                        </Button>
                        <Button
                          onClick={() => {
                            setSelectedRequest(request);
                            setActionType("reject");
                          }}
                          variant="outline"
                          className="flex-1 border-red-200 dark:border-red-800/60 text-red-600 dark:text-red-300 hover:bg-red-50"
                        >
                          <XCircle className="w-4 h-4 me-2" />
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Action Dialog */}
        <Dialog open={!!selectedRequest && !!actionType} onOpenChange={() => {
          setSelectedRequest(null);
          setActionType(null);
          setAdminNote("");
        }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {actionType === "approve" ? (
                  <>
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-300" />
                    Approve Claim Request
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 text-red-600 dark:text-red-300" />
                    Reject Claim Request
                  </>
                )}
              </DialogTitle>
              <DialogDescription>
                {actionType === "approve" 
                  ? "This will assign the package to the customer and notify them."
                  : "This will reject the claim request and notify the customer."}
              </DialogDescription>
            </DialogHeader>
            
            {selectedRequest && (
              <div className="space-y-4">
                {/* Request Info */}
                <div className="bg-gray-50 dark:bg-gray-950/40 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white dark:bg-card rounded-lg flex items-center justify-center shadow-sm">
                      <Package className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-800 dark:text-slate-200">
                        {selectedRequest.trackingNumber}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Requested by: {getCustomerName(selectedRequest.customerId)}
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Admin Note */}
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                    Add a note (optional)
                  </label>
                  <Textarea
                    placeholder={actionType === "approve" 
                      ? "Add any notes about the approval..."
                      : "Explain why the claim was rejected..."}
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    className="min-h-[100px] resize-none"
                  />
                </div>
              </div>
            )}
            
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedRequest(null);
                  setActionType(null);
                  setAdminNote("");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAction}
                disabled={approveMutation.isPending || rejectMutation.isPending}
                className={actionType === "approve" 
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-red-600 hover:bg-red-700"}
              >
                {(approveMutation.isPending || rejectMutation.isPending) ? (
                  <>
                    <Loader2 className="w-4 h-4 me-2 animate-spin" />
                    Processing...
                  </>
                ) : actionType === "approve" ? (
                  <>
                    <CheckCircle className="w-4 h-4 me-2" />
                    Approve
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 me-2" />
                    Reject
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
