import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Package, Search, User, Loader2, CheckCircle2, AlertTriangle, UserPlus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useTranslation } from "@/contexts/LanguageContext";

export default function UnclaimedPackages() {
    const { t } = useTranslation();
const [search, setSearch] = useState("");
  const [claimDialogOpen, setClaimDialogOpen] = useState(false);
  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  
  // Queries
  const { data: unclaimedPackages, refetch } = trpc.packages.getUnclaimed.useQuery();
  const { data: customers } = trpc.customers.list.useQuery();
  const { data: batchesRaw } = trpc.batches.list.useQuery();
  const batches = Array.isArray(batchesRaw) ? batchesRaw : batchesRaw?.data;
  
  // Mutation
  const claimMutation = trpc.packages.claimPackage.useMutation({
    onSuccess: () => {
      toast.success(t("toast.packageClaimedSuccessfully"));
      setClaimDialogOpen(false);
      setSelectedPackageId(null);
      setSelectedCustomerId(null);
      setCustomerSearch("");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
  
  // Filter packages by search
  const filteredPackages = useMemo(() => {
    if (!unclaimedPackages) return [];
    if (!search) return unclaimedPackages;
    
    const searchLower = search.toLowerCase();
    return unclaimedPackages.filter(pkg =>
      pkg.packageCode.toLowerCase().includes(searchLower) ||
      pkg.trackingNumber?.toLowerCase().includes(searchLower)
    );
  }, [unclaimedPackages, search]);
  
  // Filter customers by search
  const filteredCustomers = useMemo(() => {
    if (!customers || !customerSearch) return [];
    const searchLower = customerSearch.toLowerCase();
    return customers.filter(c =>
      c.customerCode?.toLowerCase().includes(searchLower) ||
      c.fullName?.toLowerCase().includes(searchLower) ||
      c.mobileNumber?.includes(searchLower)
    ).slice(0, 10);
  }, [customers, customerSearch]);
  
  const getBatchCode = (batchId: number | null) => {
    if (!batchId) return "-";
    return batches?.find((b: any) => b.id === batchId)?.batchCode || "-";
  };
  
  const openClaimDialog = (packageId: number) => {
    setSelectedPackageId(packageId);
    setClaimDialogOpen(true);
  };
  
  const selectCustomer = (customer: NonNullable<typeof customers>[0]) => {
    setSelectedCustomerId(customer.id);
    setCustomerSearch(customer.customerCode || customer.fullName || "");
    setShowCustomerDropdown(false);
  };
  
  const handleClaim = () => {
    if (!selectedPackageId || !selectedCustomerId) return;
    claimMutation.mutate({
      packageId: selectedPackageId,
      customerId: selectedCustomerId,
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-amber-500" />
              {t("packages.unclaimedPackages")}
            </h1>
            <p className="text-muted-foreground">{t("packages.unclaimedDesc")}</p>
          </div>
          <Badge variant="outline" className="text-lg px-4 py-2">
            {unclaimedPackages?.length || 0} packages
          </Badge>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t("packages.totalUnclaimed")}</p>
                  <p className="text-3xl font-bold">{unclaimedPackages?.length || 0}</p>
                </div>
                <Package className="h-10 w-10 text-amber-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t("packages.airShipments")}</p>
                  <p className="text-3xl font-bold">
                    {unclaimedPackages?.filter(p => p.shippingType.startsWith("air")).length || 0}
                  </p>
                </div>
                <Package className="h-10 w-10 text-blue-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t("packages.seaShipments")}</p>
                  <p className="text-3xl font-bold">
                    {unclaimedPackages?.filter(p => p.shippingType === "sea").length || 0}
                  </p>
                </div>
                <Package className="h-10 w-10 text-cyan-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Table */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{t("packages.unclaimedList")}</CardTitle>
              <div className="relative w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by code or tracking..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredPackages.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
                <h3 className="text-lg font-medium">{t("packages.noUnclaimed")}</h3>
                <p className="text-muted-foreground">{t("packages.allAssigned")}</p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Package Code</TableHead>
                      <TableHead>Tracking Number</TableHead>
                      <TableHead>Shipping Type</TableHead>
                      <TableHead>Weight</TableHead>
                      <TableHead>Batch</TableHead>
                      <TableHead>Registered</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPackages.map((pkg) => (
                      <TableRow key={pkg.id}>
                        <TableCell className="font-mono font-medium">{pkg.packageCode}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {pkg.trackingNumber || "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {pkg.shippingType.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>{pkg.weightKg ? `${pkg.weightKg} kg` : "-"}</TableCell>
                        <TableCell>{getBatchCode(pkg.batchId)}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {formatDistanceToNow(new Date(pkg.createdAt), { addSuffix: true })}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            onClick={() => openClaimDialog(pkg.id)}
                          >
                            <UserPlus className="h-4 w-4 me-1" />
                            Claim
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Claim Dialog */}
        <Dialog open={claimDialogOpen} onOpenChange={setClaimDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Claim Package
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div>
                <Label>Select Customer</Label>
                <div className="relative mt-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by code, name, or phone..."
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setShowCustomerDropdown(true);
                      if (e.target.value === "") setSelectedCustomerId(null);
                    }}
                    onFocus={() => setShowCustomerDropdown(true)}
                    className="pl-9"
                  />
                  {showCustomerDropdown && filteredCustomers.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-auto">
                      {filteredCustomers.map((customer) => (
                        <button
                          key={customer.id}
                          type="button"
                          className="w-full px-3 py-2 text-left hover:bg-accent flex items-center justify-between"
                          onClick={() => selectCustomer(customer)}
                        >
                          <div>
                            <div className="font-medium">{customer.customerCode}</div>
                            <div className="text-sm text-muted-foreground">{customer.fullName}</div>
                          </div>
                          <div className="text-xs text-muted-foreground">{customer.mobileNumber}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              {selectedCustomerId && (
                <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950 rounded-md">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <div>
                    <div className="font-medium text-green-700 dark:text-green-400">
                      {customers?.find(c => c.id === selectedCustomerId)?.customerCode}
                    </div>
                    <div className="text-sm text-green-600 dark:text-green-500">
                      {customers?.find(c => c.id === selectedCustomerId)?.fullName}
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setClaimDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleClaim}
                disabled={!selectedCustomerId || claimMutation.isPending}
              >
                {claimMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 me-2 animate-spin" />
                    Claiming...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 me-2" />
                    Confirm Claim
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
