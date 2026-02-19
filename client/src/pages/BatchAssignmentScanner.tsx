import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Package, Layers, CheckCircle2, AlertTriangle,
  BarChart3, RefreshCw, ExternalLink, Edit, AlertCircle
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useTranslation } from "@/contexts/LanguageContext";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { soundManager } from "@/lib/soundManager";
import { ScanInput } from "@/components/scanner/ScanInput";
import { SessionStats } from "@/components/scanner/SessionStats";
import { ScannedList, type ScannedItem } from "@/components/scanner/ScannedList";

// ==================== TYPES ====================
interface ScannedPackage {
  id: number;
  trackingNumber: string;
  customerCode: string;
  customerName: string;
  weight: number | null;
  cbm: number | null;
  hasCompleteData: boolean;
  previousBatchId: number | null;
  previousBatchNumber: string | null;
  scannedAt: Date;
}

interface BatchChangeDialog {
  open: boolean;
  package: ScannedPackage | null;
  currentBatchNumber: string;
  newBatchId: number;
}

// ==================== MAIN COMPONENT ====================
export default function BatchAssignmentScanner() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();

  // Core state
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");
  const [isSearching, setIsSearching] = useState(false);

  // Continuous mode & sound (used by ScanInput)
  const [continuousMode, setContinuousMode] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Scanned packages for this session (persisted to sessionStorage)
  const [scannedPackages, setScannedPackages] = useState<ScannedPackage[]>([]);

  const scannerType = "batch-assignment";

  // Load session on mount
  useEffect(() => {
    const saved = sessionStorage.getItem(`scan-session-${scannerType}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.packages)) {
          setScannedPackages(
            parsed.packages.map((p: any) => ({
              ...p,
              scannedAt: new Date(p.scannedAt),
            }))
          );
        }
      } catch {
        // ignore invalid JSON
      }
    }
  }, []);

  // Save session when scanned packages change
  useEffect(() => {
    if (scannedPackages.length > 0) {
      sessionStorage.setItem(
        `scan-session-${scannerType}`,
        JSON.stringify({
          packages: scannedPackages,
          savedAt: new Date().toISOString(),
        })
      );
    } else {
      sessionStorage.removeItem(`scan-session-${scannerType}`);
    }
  }, [scannedPackages]);

  // Dialogs
  const [batchChangeDialog, setBatchChangeDialog] = useState<BatchChangeDialog>({
    open: false,
    package: null,
    currentBatchNumber: "",
    newBatchId: 0,
  });
  const [incompleteDataDialog, setIncompleteDataDialog] = useState<{
    open: boolean;
    package: any;
    trackingNumber: string;
  }>({ open: false, package: null, trackingNumber: "" });
  
  // Queries
  const { data: batches, refetch: refetchBatches } = trpc.batches.list.useQuery();
  const trpcUtils = trpc.useUtils();
  
  // Get open batches
  const openBatches = useMemo(() => {
    if (!batches) return [];
    return batches.filter(b => b.status === "preparing" || b.status === "in_transit");
  }, [batches]);
  
  // Selected batch info
  const selectedBatch = useMemo(() => {
    if (!selectedBatchId || !batches) return null;
    return batches.find(b => b.id === parseInt(selectedBatchId));
  }, [selectedBatchId, batches]);
  
  // Calculate batch stats from scanned packages
  const batchStats = useMemo(() => {
    const stats = {
      totalPackages: scannedPackages.length,
      totalWeight: 0,
      totalCbm: 0,
      incompleteCount: 0,
    };
    
    scannedPackages.forEach(pkg => {
      if (pkg.weight) stats.totalWeight += pkg.weight;
      if (pkg.cbm) stats.totalCbm += pkg.cbm;
      if (!pkg.hasCompleteData) stats.incompleteCount++;
    });
    
    return stats;
  }, [scannedPackages]);
  
  // Mutations
  const assignToBatch = trpc.packages.assignToBatch.useMutation({
    onSuccess: () => {},
    onError: (error) => {
      soundManager.playError();
      toast.error(`${t("common.error")}: ${error.message}`);
    },
  });

  // Handle scan (value from ScanInput - manual Enter or camera)
  const handleScan = useCallback(
    async (value: string) => {
      const trackingValue = value.trim();
      if (!trackingValue) return;
      if (!selectedBatchId) {
        soundManager.playError();
        toast.error(t("scan.selectBatch"));
        return;
      }

      soundManager.playBeep();
      setIsSearching(true);

      try {
        const result = await trpcUtils.scanning.searchByTracking.fetch({
          trackingNumber: trackingValue,
        });

        if (!result?.found || !result.package) {
          soundManager.playError();
          toast.error(
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <div>
                <div className="font-medium">{t("scan.packageNotFound")}</div>
                <div className="text-sm text-muted-foreground">{trackingValue}</div>
              </div>
            </div>
          );
          return;
        }

        const pkg = result.package;
        const customer = result.customer;

        if (pkg.batchId === parseInt(selectedBatchId)) {
          soundManager.playDuplicate();
          toast.warning(
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              <div>
                <div className="font-medium">{t("scan.alreadyInBatch")}</div>
                <div className="text-sm text-muted-foreground">{trackingValue}</div>
              </div>
            </div>
          );
          return;
        }

        const hasWeight = pkg.weightKg && parseFloat(pkg.weightKg) > 0;
        const hasDimensions = pkg.lengthCm && pkg.widthCm && pkg.heightCm;
        const hasCompleteData: boolean = !!(hasWeight || hasDimensions);

        if (pkg.batchId && pkg.batchId !== parseInt(selectedBatchId)) {
          const previousBatch = batches?.find((b) => b.id === pkg.batchId);
          setBatchChangeDialog({
            open: true,
            package: {
              id: pkg.id,
              trackingNumber: pkg.trackingNumber || trackingValue,
              customerCode: customer?.customerCode || "—",
              customerName: customer?.fullName || "",
              weight: pkg.weightKg ? parseFloat(pkg.weightKg) : null,
              cbm: pkg.volumeCbm ? parseFloat(pkg.volumeCbm) : null,
              hasCompleteData,
              previousBatchId: pkg.batchId,
              previousBatchNumber: previousBatch?.batchCode || `#${pkg.batchId}`,
              scannedAt: new Date(),
            },
            currentBatchNumber: previousBatch?.batchCode || `#${pkg.batchId}`,
            newBatchId: parseInt(selectedBatchId),
          });
          return;
        }

        if (!hasCompleteData) {
          soundManager.playWarning();
          setIncompleteDataDialog({
            open: true,
            package: pkg,
            trackingNumber: trackingValue,
          });
          return;
        }

        await assignToBatch.mutateAsync({
          packageId: pkg.id,
          batchId: parseInt(selectedBatchId),
        });

        const scannedPkg: ScannedPackage = {
          id: pkg.id,
          trackingNumber: pkg.trackingNumber || trackingValue,
          customerCode: customer?.customerCode || "—",
          customerName: customer?.fullName || "",
          weight: pkg.weightKg ? parseFloat(pkg.weightKg) : null,
          cbm: pkg.volumeCbm ? parseFloat(pkg.volumeCbm) : null,
          hasCompleteData,
          previousBatchId: null,
          previousBatchNumber: null,
          scannedAt: new Date(),
        };
        setScannedPackages((prev) => [scannedPkg, ...prev]);
        soundManager.playSuccess();

        toast.success(
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <div>
              <div className="font-medium">{t("scan.addedToBatch")}</div>
              <div className="text-sm text-muted-foreground">
                {customer?.customerCode} - {trackingValue}
              </div>
            </div>
          </div>
        );
      } catch (error: any) {
        soundManager.playError();
        toast.error(error?.message || "Search failed");
      } finally {
        setIsSearching(false);
      }
    },
    [selectedBatchId, t, trpcUtils, batches, assignToBatch]
  );
  
  // Handle batch change confirmation
  const handleBatchChangeConfirm = async () => {
    if (!batchChangeDialog.package) return;
    try {
      await assignToBatch.mutateAsync({
        packageId: batchChangeDialog.package.id,
        batchId: batchChangeDialog.newBatchId,
      });
      setScannedPackages((prev) => [batchChangeDialog.package!, ...prev]);
      soundManager.playSuccess();
      toast.success(
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-500" />
          <div>
            <div className="font-medium">{t("scan.batchChanged")}</div>
            <div className="text-sm text-muted-foreground">
              {batchChangeDialog.currentBatchNumber} → {selectedBatch?.batchCode}
            </div>
          </div>
        </div>
      );
      setBatchChangeDialog({ open: false, package: null, currentBatchNumber: "", newBatchId: 0 });
    } catch (error: any) {
      soundManager.playError();
      toast.error(error?.message || "Failed to change batch");
    }
  };

  // Handle incomplete data - continue anyway
  const handleContinueWithIncomplete = async () => {
    if (!incompleteDataDialog.package) return;
    try {
      await assignToBatch.mutateAsync({
        packageId: incompleteDataDialog.package.id,
        batchId: parseInt(selectedBatchId),
      });
      const pkg = incompleteDataDialog.package;
      const scannedPkg: ScannedPackage = {
        id: pkg.id,
        trackingNumber: pkg.trackingNumber || incompleteDataDialog.trackingNumber,
        customerCode: pkg.customer?.customerCode || "—",
        customerName: pkg.customer?.fullName || "",
        weight: pkg.weightKg ? parseFloat(pkg.weightKg) : null,
        cbm: pkg.volumeCbm ? parseFloat(pkg.volumeCbm) : null,
        hasCompleteData: false,
        previousBatchId: null,
        previousBatchNumber: null,
        scannedAt: new Date(),
      };
      setScannedPackages((prev) => [scannedPkg, ...prev]);
      soundManager.playSuccess();
      toast.success(t("scan.addedToBatch"));
      setIncompleteDataDialog({ open: false, package: null, trackingNumber: "" });
    } catch (error: any) {
      soundManager.playError();
      toast.error(error?.message || "Failed");
    }
  };

  const handleGoToQuickRegister = () => {
    setLocation(
      `/quick-register?tracking=${encodeURIComponent(incompleteDataDialog.trackingNumber)}&returnTo=/batch-assignment`
    );
  };

  // Map ScannedPackage to ScannedItem for list
  const scannedItems: ScannedItem[] = useMemo(
    () =>
      scannedPackages.map((p) => ({
        id: p.id,
        trackingNumber: p.trackingNumber,
        customerCode: p.customerCode,
        customerName: p.customerName,
        weight: p.weight,
        cbm: p.cbm,
        hasCompleteData: p.hasCompleteData,
        scannedAt: p.scannedAt,
      })),
    [scannedPackages]
  );

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        {/* Professional Header */}
        <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-violet-600 text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yIDItNCAyLTRzLTItMi00LTJjMCAwIDAtMiAyLTJzNCAwIDQgMmMwIDAtMiAyLTIgNHMwIDQtMiA0Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
          <div className="container py-6 relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                  <Layers className="h-8 w-8" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold flex items-center gap-2">
                    {t("scanning.batchAssignment")}
                    {continuousMode && (
                      <Badge className="bg-white/20 text-white border-white/30 animate-pulse">
                        {t("scan.continuousMode")}
                      </Badge>
                    )}
                  </h1>
                  <p className="text-indigo-100 text-sm">
                    {t("scan.batchAssignmentDesc")}
                  </p>
                </div>
              </div>
              
              {/* Session Stats */}
              <div className="hidden md:flex items-center gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold">{batchStats.totalPackages}</div>
                  <div className="text-xs text-indigo-200">{t("scan.packages")}</div>
                </div>
                <div className="w-px h-10 bg-white/20" />
                <div className="text-center">
                  <div className="text-2xl font-bold">{batchStats.totalWeight.toFixed(1)}</div>
                  <div className="text-xs text-indigo-200">{t("scan.weight")}</div>
                </div>
                <div className="w-px h-10 bg-white/20" />
                <div className="text-center">
                  <div className="text-2xl font-bold">{batchStats.totalCbm.toFixed(3)}</div>
                  <div className="text-xs text-indigo-200">CBM</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="container py-6">
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Main Scanner Area */}
            <div className="lg:col-span-2 space-y-6">
              {/* Batch Selection */}
              <Card className="border-0 shadow-lg">
                <CardContent className="p-4">
                  <Label className="text-sm font-medium mb-2 block">
                    {t("scanning.selectBatch")}
                  </Label>
                  <Select value={selectedBatchId} onValueChange={setSelectedBatchId}>
                    <SelectTrigger className="h-12 text-base">
                      <SelectValue placeholder={t("scan.selectBatch")} />
                    </SelectTrigger>
                    <SelectContent>
                      {openBatches.map((batch) => (
                        <SelectItem key={batch.id} value={batch.id.toString()}>
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4" />
                            <span className="font-medium">{batch.batchCode}</span>
                            <Badge variant="outline" className="text-xs">
                              {batch.shippingType.includes("air") ? "هەوایی" : "دەریایی"}
                            </Badge>
                            <span className="text-muted-foreground text-xs">
                              ({batch.status})
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              {/* Scanner Input */}
              <Card
                className={cn(
                  "border-0 shadow-lg overflow-hidden transition-all",
                  !selectedBatchId && "opacity-50 pointer-events-none"
                )}
              >
                <div
                  className={cn(
                    "h-1 transition-all duration-300",
                    continuousMode && selectedBatchId
                      ? "bg-gradient-to-r from-indigo-500 via-purple-500 to-violet-500 animate-pulse"
                      : "bg-slate-200"
                  )}
                />
                <CardContent className="p-6">
                  <ScanInput
                    onScan={handleScan}
                    isProcessing={isSearching}
                    placeholder={t("scan.trackingPlaceholder")}
                    autoClear
                    continuousMode={continuousMode}
                    onContinuousModeChange={setContinuousMode}
                    soundEnabled={soundEnabled}
                    onSoundEnabledChange={setSoundEnabled}
                    autoFocus
                    showCameraOption
                    disabled={!selectedBatchId}
                    labels={{
                      manualMode: t("scan.manualMode"),
                      cameraMode: t("scan.cameraMode"),
                      continuousMode: t("scan.continuousMode"),
                      inputPlaceholder: t("scan.trackingPlaceholder"),
                    }}
                  />
                  {!selectedBatchId && (
                    <div className="flex items-center justify-center gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 mt-4">
                      <AlertTriangle className="h-4 w-4" />
                      {t("scan.selectBatch")}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Scanned Packages List */}
              <Card className="border-0 shadow-lg">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      {t("scan.packages")}
                      <Badge variant="secondary">{scannedPackages.length}</Badge>
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setScannedPackages([]);
                        sessionStorage.removeItem(`scan-session-${scannerType}`);
                      }}
                      className="text-xs"
                    >
                      {t("common.clear") || "Clear"}
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScannedList
                    items={scannedItems}
                    title={t("scan.packages")}
                    maxHeight="300px"
                  />
                </CardContent>
              </Card>
            </div>
            
            {/* Sidebar - Batch Info & Stats */}
            <div className="space-y-6">
              {/* Selected Batch Info */}
              {selectedBatch && (
                <Card className="border-0 shadow-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <Package className="h-6 w-6" />
                      <span className="font-semibold text-lg">{selectedBatch.batchCode}</span>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-indigo-100">{t("common.type") || "Type"}</span>
                        <Badge className="bg-white/20 text-white border-white/30">
                          {selectedBatch.shippingType.includes("air") ? "هەوایی" : "دەریایی"}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-indigo-100">{t("common.status") || "Status"}</span>
                        <span className="font-medium">{selectedBatch.status}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-indigo-100">{t("batches.route") || "Route"}</span>
                        <span className="font-medium text-sm">
                          {(selectedBatch as any).originWarehouse?.name || "چین"} → {(selectedBatch as any).destinationWarehouse?.name || "هەولێر"}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {/* Session Stats */}
              <SessionStats
                title={t("scan.sessionStats")}
                stats={[
                  { label: t("scan.packages"), value: batchStats.totalPackages, color: "indigo" },
                  { label: t("scan.weight"), value: batchStats.totalWeight, color: "purple", format: "decimal" },
                  { label: "CBM", value: batchStats.totalCbm, color: "violet", format: "decimal" },
                  { label: t("scan.incomplete"), value: batchStats.incompleteCount, color: batchStats.incompleteCount > 0 ? "yellow" : "green" },
                ]}
              />
              
              {/* Quick Actions */}
              <Card className="border-0 shadow-lg">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">{t("common.quickActions") || "Quick Actions"}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => setLocation("/quick-register")}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    {t("nav.quickRegister")}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => refetchBatches()}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    {t("batches.refresh") || "Refresh Batches"}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
        
        {/* Batch Change Dialog */}
        <Dialog open={batchChangeDialog.open} onOpenChange={(open) => !open && setBatchChangeDialog({ open: false, package: null, currentBatchNumber: "", newBatchId: 0 })}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                {t("scan.packageInAnotherBatch")}
              </DialogTitle>
              <DialogDescription>
                {t("scan.batchChangeConfirmDesc", {
                  current: String(batchChangeDialog.currentBatchNumber),
                  target: selectedBatch?.batchCode ?? "",
                })}
              </DialogDescription>
            </DialogHeader>
            
            {batchChangeDialog.package && (
              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <div className="font-mono text-lg">{batchChangeDialog.package.trackingNumber}</div>
                <div className="text-sm text-muted-foreground mt-1">
                  {batchChangeDialog.package.customerCode} - {batchChangeDialog.package.customerName}
                </div>
              </div>
            )}
            
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() =>
                  setBatchChangeDialog({ open: false, package: null, currentBatchNumber: "", newBatchId: 0 })
                }
              >
                {t("common.cancel")}
              </Button>
              <Button
                onClick={handleBatchChangeConfirm}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                {t("common.confirm") || "Yes, move it"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* Incomplete Data Dialog */}
        <Dialog open={incompleteDataDialog.open} onOpenChange={(open) => !open && setIncompleteDataDialog({ open: false, package: null, trackingNumber: "" })}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-yellow-500" />
                {t("scan.incompleteData")}
              </DialogTitle>
              <DialogDescription>
                {t("scan.noWeightDimensions")}
              </DialogDescription>
            </DialogHeader>
            
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200">
              <div className="font-mono text-lg">{incompleteDataDialog.trackingNumber}</div>
              <div className="text-sm text-yellow-700 dark:text-yellow-300 mt-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                {t("scan.noWeightDimensions")}
              </div>
            </div>
            
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => setIncompleteDataDialog({ open: false, package: null, trackingNumber: "" })}
              >
                {t("common.cancel")}
              </Button>
              <Button
                variant="outline"
                onClick={handleGoToQuickRegister}
                className="border-indigo-300 text-indigo-600 hover:bg-indigo-50"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                {t("scan.goToQuickRegister")}
              </Button>
              <Button
                onClick={handleContinueWithIncomplete}
                className="bg-yellow-500 hover:bg-yellow-600"
              >
                {t("scan.continueAnyway")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
