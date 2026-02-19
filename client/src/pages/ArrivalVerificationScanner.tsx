import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Package, CheckCircle2, AlertTriangle, XCircle,
  Target, BarChart3, RefreshCw, FileText,
  Plus, Printer, Info, AlertCircle, Search, Zap
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useTranslation } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { soundManager } from "@/lib/soundManager";
import { ScanInput } from "@/components/scanner/ScanInput";
import { SessionStats } from "@/components/scanner/SessionStats";

// ==================== TYPES ====================
interface VerifiedPackage {
  id: number;
  trackingNumber: string;
  customerCode: string;
  customerName: string;
  weight: number | null;
  cbm: number | null;
  hasCompleteData: boolean;
  batchId: number;
  batchNumber: string;
  verifiedAt: Date;
  isExtra: boolean; // Package not originally in selected batches
}

interface BatchPackage {
  id: number;
  trackingNumber: string;
  customerCode: string;
  customerName: string;
  weight: number | null;
  cbm: number | null;
  hasCompleteData: boolean;
  verified: boolean;
}

// ==================== MAIN COMPONENT ====================
const SESSION_KEY = "scan-session-arrival-verification";

export default function ArrivalVerificationScanner() {
  const { t } = useTranslation();

  // Core state
  const [selectedBatchIds, setSelectedBatchIds] = useState<number[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [continuousMode, setContinuousMode] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [verifiedPackages, setVerifiedPackages] = useState<VerifiedPackage[]>([]);
  const [batchPackages, setBatchPackages] = useState<Map<number, BatchPackage[]>>(new Map());

  // Dialogs
  const [extraPackageDialog, setExtraPackageDialog] = useState<{
    open: boolean;
    package: any;
    trackingNumber: string;
  }>({ open: false, package: null, trackingNumber: "" });
  const [reportDialog, setReportDialog] = useState(false);

  // Session persistence: load on mount
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const restored = Array.isArray(parsed) ? parsed : parsed.packages || [];
        setVerifiedPackages(
          restored.map((p: any) => ({ ...p, verifiedAt: new Date(p.verifiedAt) }))
        );
      }
    } catch {
      // ignore
    }
  }, []);

  // Session persistence: save when verified packages change
  useEffect(() => {
    if (verifiedPackages.length > 0) {
      try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(verifiedPackages));
      } catch {
        // ignore
      }
    } else {
      sessionStorage.removeItem(SESSION_KEY);
    }
  }, [verifiedPackages]);

  const clearSession = () => {
    setVerifiedPackages([]);
    setBatchPackages(new Map());
    setSelectedBatchIds([]);
    sessionStorage.removeItem(SESSION_KEY);
  };

  // Queries
  const { data: batches, refetch: refetchBatches } = trpc.batches.list.useQuery();
  const trpcUtils = trpc.useUtils();
  
  // Get batches that are in transit (ready for arrival verification)
  const availableBatches = useMemo(() => {
    if (!batches) return [];
    return batches.filter(b => b.status === "in_transit" || b.status === "preparing");
  }, [batches]);
  
  // Selected batches info
  const selectedBatches = useMemo(() => {
    if (!batches) return [];
    return batches.filter(b => selectedBatchIds.includes(b.id));
  }, [selectedBatchIds, batches]);
  
  // Calculate verification stats
  const verificationStats = useMemo(() => {
    let totalExpected = 0;
    let totalVerified = 0;
    let totalMissing = 0;
    let totalExtra = 0;
    let incompleteData = 0;
    
    batchPackages.forEach((packages) => {
      totalExpected += packages.length;
      packages.forEach(pkg => {
        if (pkg.verified) totalVerified++;
        if (!pkg.hasCompleteData && pkg.verified) incompleteData++;
      });
    });
    
    totalMissing = totalExpected - totalVerified;
    totalExtra = verifiedPackages.filter(p => p.isExtra).length;
    
    const percentage = totalExpected > 0 ? Math.round((totalVerified / totalExpected) * 100) : 0;
    
    return {
      totalExpected,
      totalVerified,
      totalMissing,
      totalExtra,
      incompleteData,
      percentage,
      isComplete: totalMissing === 0 && totalExpected > 0,
    };
  }, [batchPackages, verifiedPackages]);
  
  // Get unverified packages
  const unverifiedPackages = useMemo(() => {
    const unverified: (BatchPackage & { batchNumber: string })[] = [];
    batchPackages.forEach((packages, batchId) => {
      const batch = batches?.find(b => b.id === batchId);
      packages.forEach(pkg => {
        if (!pkg.verified) {
          unverified.push({ ...pkg, batchNumber: batch?.batchCode || `#${batchId}` });
        }
      });
    });
    return unverified;
  }, [batchPackages, batches]);
  
  // Load batch packages when batches are selected
  useEffect(() => {
    const loadBatchPackages = async () => {
      const newBatchPackages = new Map<number, BatchPackage[]>();
      
      for (const batchId of selectedBatchIds) {
        try {
          const result = await trpcUtils.packages.list.fetch({ batchId, pageSize: 1000 });
          const packages = result.data || [];
          const batchPkgs: BatchPackage[] = packages.map((pkg: any) => ({
            id: pkg.id,
            trackingNumber: pkg.trackingNumber || "",
            customerCode: pkg.customer?.customerCode || "نەناسراو",
            customerName: pkg.customer?.fullName || "",
            weight: pkg.weightKg ? parseFloat(pkg.weightKg) : null,
            cbm: pkg.volumeCbm ? parseFloat(pkg.volumeCbm) : null,
            hasCompleteData: !!(pkg.weightKg || (pkg.lengthCm && pkg.widthCm && pkg.heightCm)),
            verified: verifiedPackages.some(v => v.id === pkg.id),
          }));
          newBatchPackages.set(batchId, batchPkgs);
        } catch (error) {
          console.error(`Failed to load packages for batch ${batchId}:`, error);
        }
      }
      
      setBatchPackages(newBatchPackages);
    };
    
    if (selectedBatchIds.length > 0) {
      loadBatchPackages();
    } else {
      setBatchPackages(new Map());
    }
  }, [selectedBatchIds, trpcUtils]);
  
  // Update batch packages verification status when verified packages change
  useEffect(() => {
    setBatchPackages(prev => {
      const updated = new Map(prev);
      updated.forEach((packages, batchId) => {
        const updatedPkgs = packages.map(pkg => ({
          ...pkg,
          verified: verifiedPackages.some(v => v.id === pkg.id),
        }));
        updated.set(batchId, updatedPkgs);
      });
      return updated;
    });
  }, [verifiedPackages]);
  
  useEffect(() => {
    soundManager.setEnabled(soundEnabled);
  }, [soundEnabled]);

  // Check for completion
  useEffect(() => {
    if (verificationStats.isComplete && verificationStats.totalExpected > 0) {
      soundManager.playComplete();
      toast.success(
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-500" />
          <div>
            <div className="font-medium">{t("scan.allPackagesArrived")}</div>
            <div className="text-sm text-muted-foreground">
              {verificationStats.totalVerified} / {verificationStats.totalExpected}
            </div>
          </div>
        </div>
      );
    }
  }, [verificationStats.isComplete, verificationStats.totalExpected]);
  
  // Handle batch selection
  const toggleBatchSelection = (batchId: number) => {
    setSelectedBatchIds(prev => {
      if (prev.includes(batchId)) {
        return prev.filter(id => id !== batchId);
      }
      return [...prev, batchId];
    });
  };
  
  const handleScan = useCallback(
    async (scannedValue: string) => {
      if (!scannedValue.trim()) return;
      if (selectedBatchIds.length === 0) {
        soundManager.playError();
        toast.error(t("scan.selectBatchFirst"));
        return;
      }
      soundManager.playBeep();
      setIsSearching(true);
      try {
        const result = await trpcUtils.scanning.searchByTracking.fetch({
          trackingNumber: scannedValue.trim(),
        });
        if (!result?.found || !result.package) {
          soundManager.playError();
          toast.error(
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <div>
                <div className="font-medium">{t("scan.packageNotFoundExcl")}</div>
                <div className="text-sm text-muted-foreground">{scannedValue}</div>
              </div>
            </div>
          );
          return;
        }
        const pkg = result.package;
        const customer = result.customer;
        if (verifiedPackages.some((v) => v.id === pkg.id)) {
          soundManager.playDuplicate();
          toast.warning(
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              <div>
                <div className="font-medium">{t("scan.alreadyVerified")}</div>
                <div className="text-sm text-muted-foreground">{scannedValue}</div>
              </div>
            </div>
          );
          return;
        }
        const isInSelectedBatches = pkg.batchId ? selectedBatchIds.includes(pkg.batchId) : false;
        if (!isInSelectedBatches) {
          soundManager.playWarning();
          setExtraPackageDialog({
            open: true,
            package: pkg,
            trackingNumber: scannedValue,
          });
          return;
        }
        const batch = batches?.find((b) => b.id === pkg.batchId);
        const hasCompleteData = !!(pkg.weightKg || (pkg.lengthCm && pkg.widthCm && pkg.heightCm));
        const verifiedPkg: VerifiedPackage = {
          id: pkg.id,
          trackingNumber: pkg.trackingNumber || scannedValue,
          customerCode: customer?.customerCode || "—",
          customerName: customer?.fullName || "",
          weight: pkg.weightKg ? parseFloat(pkg.weightKg) : null,
          cbm: pkg.volumeCbm ? parseFloat(pkg.volumeCbm) : null,
          hasCompleteData,
          batchId: pkg.batchId || 0,
          batchNumber: batch?.batchCode || `#${pkg.batchId || 0}`,
          verifiedAt: new Date(),
          isExtra: false,
        };
        setVerifiedPackages((prev) => [verifiedPkg, ...prev]);
        soundManager.playSuccess();
        if (!hasCompleteData) {
          toast.warning(
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              <div>
                <div className="font-medium">{t("scan.verifiedIncomplete")}</div>
                <div className="text-sm text-muted-foreground">{customer?.customerCode} - {scannedValue}</div>
              </div>
            </div>
          );
        } else {
          toast.success(
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <div>
                <div className="font-medium">{t("scan.verifiedExcl")}</div>
                <div className="text-sm text-muted-foreground">{customer?.customerCode} - {scannedValue}</div>
              </div>
            </div>
          );
        }
      } catch (error: any) {
        soundManager.playError();
        toast.error(error?.message || "Search failed");
      } finally {
        setIsSearching(false);
      }
    },
    [selectedBatchIds, t, trpcUtils, batches, verifiedPackages]
  );

  const handleAddExtraPackage = async () => {
    if (!extraPackageDialog.package) return;
    
    const pkg = extraPackageDialog.package;
    const batch = batches?.find(b => b.id === selectedBatchIds[0]);
    const hasCompleteData = !!(pkg.weightKg || (pkg.lengthCm && pkg.widthCm && pkg.heightCm));
    
    // Just verify it as extra - don't actually move it
    const verifiedPkg: VerifiedPackage = {
      id: pkg.id,
      trackingNumber: pkg.trackingNumber || extraPackageDialog.trackingNumber,
      customerCode: pkg.customer?.customerCode || "نەناسراو",
      customerName: pkg.customer?.fullName || "",
      weight: pkg.weightKg ? parseFloat(pkg.weightKg) : null,
      cbm: pkg.volumeCbm ? parseFloat(pkg.volumeCbm) : null,
      hasCompleteData,
      batchId: pkg.batchId || selectedBatchIds[0],
      batchNumber: batch?.batchCode || "زیادە",
      verifiedAt: new Date(),
      isExtra: true,
    };
    
    setVerifiedPackages(prev => [verifiedPkg, ...prev]);
    soundManager.playSuccess();
    
    toast.info(
      <div className="flex items-center gap-2">
        <Plus className="h-5 w-5 text-blue-500" />
        <div>
          <div className="font-medium">{t("scan.extraPackageRecorded")}</div>
          <div className="text-sm text-muted-foreground">{extraPackageDialog.trackingNumber}</div>
        </div>
      </div>
    );
    setExtraPackageDialog({ open: false, package: null, trackingNumber: "" });
  };

  // Get status color
  const getProgressColor = (percentage: number) => {
    if (percentage === 100) return "bg-green-500";
    if (percentage >= 90) return "bg-emerald-500";
    if (percentage >= 70) return "bg-yellow-500";
    return "bg-orange-500";
  };

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        {/* Professional Header */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yIDItNCAyLTRzLTItMi00LTJjMCAwIDAtMiAyLTJzNCAwIDQgMmMwIDAtMiAyLTIgNHMwIDQtMiA0Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
          <div className="container py-6 relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                  <Target className="h-8 w-8" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold flex items-center gap-2">
                    {t("scan.arrivalVerification")}
                    {continuousMode && (
                      <Badge className="bg-white/20 text-white border-white/30 animate-pulse">
                        <Zap className="h-3 w-3 mr-1" />
                        {t("scan.continuousMode")}
                      </Badge>
                    )}
                  </h1>
                  <p className="text-emerald-100 text-sm">
                    {t("scan.arrivalVerificationSubtitle")}
                  </p>
                </div>
              </div>
              
              {/* Progress Overview */}
              {selectedBatchIds.length > 0 && (
                <div className="hidden md:flex items-center gap-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold">{verificationStats.percentage}%</div>
                    <div className="text-xs text-emerald-200">{t("scan.percentage")}</div>
                  </div>
                  <div className="w-px h-12 bg-white/20" />
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-300">{verificationStats.totalVerified}</div>
                    <div className="text-xs text-emerald-200">{t("scan.verified")}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-300">{verificationStats.totalMissing}</div>
                    <div className="text-xs text-emerald-200">{t("scan.missing")}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-300">{verificationStats.totalExtra}</div>
                    <div className="text-xs text-emerald-200">{t("scan.extra")}</div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Progress Bar */}
            {selectedBatchIds.length > 0 && (
              <div className="mt-4">
                <div className="flex justify-between text-sm mb-1">
                  <span>{verificationStats.totalVerified} / {verificationStats.totalExpected}</span>
                  <span>{verificationStats.percentage}%</span>
                </div>
                <div className="h-3 bg-white/20 rounded-full overflow-hidden">
                  <div 
                    className={cn("h-full transition-all duration-500", getProgressColor(verificationStats.percentage))}
                    style={{ width: `${verificationStats.percentage}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="container py-6">
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Main Scanner Area */}
            <div className="lg:col-span-2 space-y-6">
              {/* Batch Selection */}
              <Card className="border-0 shadow-lg">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-emerald-600" />
                    {t("scan.selectBatches")}
                    {selectedBatchIds.length > 0 && (
                      <Badge variant="secondary">{selectedBatchIds.length} {t("scan.selected")}</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {availableBatches.map((batch) => (
                      <div
                        key={batch.id}
                        onClick={() => toggleBatchSelection(batch.id)}
                        className={cn(
                          "p-3 rounded-lg border-2 cursor-pointer transition-all",
                          selectedBatchIds.includes(batch.id)
                            ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
                            : "border-slate-200 hover:border-slate-300"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <Checkbox 
                            checked={selectedBatchIds.includes(batch.id)}
                            className="data-[state=checked]:bg-emerald-500"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">{batch.batchCode}</div>
                            <div className="text-xs text-muted-foreground">
                              {batch.shippingType.includes("air") ? t("scan.air") : t("scan.sea")}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {availableBatches.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>{t("scan.noBatchesAvailable")}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
              
              {/* Scanner Input */}
              <Card className={cn(
                "border-0 shadow-lg overflow-hidden transition-all",
                selectedBatchIds.length === 0 && "opacity-50 pointer-events-none"
              )}>
                <div className={cn(
                  "h-1 transition-all duration-300",
                  continuousMode && selectedBatchIds.length > 0 ? "bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 animate-pulse" : "bg-slate-200"
                )} />
                <CardContent className="p-6">
                  <div className={cn("transition-all", selectedBatchIds.length === 0 && "pointer-events-none")}>
                    <ScanInput
                      onScan={handleScan}
                      isProcessing={isSearching}
                      continuousMode={continuousMode}
                      onContinuousModeChange={setContinuousMode}
                      soundEnabled={soundEnabled}
                      onSoundEnabledChange={setSoundEnabled}
                      disabled={selectedBatchIds.length === 0}
                      placeholder={t("scan.trackingPlaceholder")}
                      labels={{
                        manualMode: t("scan.manualMode"),
                        cameraMode: t("scan.cameraMode"),
                        continuousMode: t("scan.continuousMode"),
                        inputPlaceholder: t("scan.trackingPlaceholder"),
                      }}
                    />
                  </div>
                  {selectedBatchIds.length === 0 && (
                    <div className="flex items-center justify-center gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 mt-3">
                      <AlertTriangle className="h-4 w-4" />
                      {t("scan.selectBatchFirst")}
                    </div>
                  )}
                  <div className="mt-3 flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setReportDialog(true)}
                      disabled={verifiedPackages.length === 0}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      {t("scan.report")}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Tabs for Verified and Unverified */}
              {selectedBatchIds.length > 0 && (
                <Card className="border-0 shadow-lg">
                  <Tabs defaultValue="unverified">
                    <CardHeader className="pb-0">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="unverified" className="gap-2">
                          <AlertTriangle className="h-4 w-4" />
                          {t("scan.missing")} ({unverifiedPackages.length})
                        </TabsTrigger>
                        <TabsTrigger value="verified" className="gap-2">
                          <CheckCircle2 className="h-4 w-4" />
                          {t("scan.verified")} ({verifiedPackages.length})
                        </TabsTrigger>
                      </TabsList>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <TabsContent value="unverified" className="mt-0">
                        <ScrollArea className="h-[300px]">
                          {unverifiedPackages.length > 0 ? (
                            <div className="space-y-2">
                              {unverifiedPackages.map((pkg, index) => (
                                <div
                                  key={`${pkg.id}-${index}`}
                                  className="flex items-center justify-between p-3 rounded-lg border bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200"
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono text-sm font-medium">{pkg.trackingNumber}</span>
                                      <Badge variant="outline" className="text-xs">{pkg.batchNumber}</Badge>
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                      <span className="font-medium">{pkg.customerCode}</span>
                                      {pkg.weight && <span className="mx-2">•</span>}
                                      {pkg.weight && <span>{pkg.weight}kg</span>}
                                    </div>
                                  </div>
                                  <XCircle className="h-5 w-5 text-yellow-500" />
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-8 text-muted-foreground">
                              <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-500" />
                              <p>{t("scan.allPackagesVerified")}</p>
                            </div>
                          )}
                        </ScrollArea>
                      </TabsContent>
                      
                      <TabsContent value="verified" className="mt-0">
                        <ScrollArea className="h-[300px]">
                          {verifiedPackages.length > 0 ? (
                            <div className="space-y-2">
                              {verifiedPackages.map((pkg, index) => (
                                <div
                                  key={`${pkg.id}-${index}`}
                                  className={cn(
                                    "flex items-center justify-between p-3 rounded-lg border",
                                    pkg.isExtra 
                                      ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200"
                                      : pkg.hasCompleteData
                                        ? "bg-green-50 dark:bg-green-900/20 border-green-200"
                                        : "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200"
                                  )}
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono text-sm font-medium">{pkg.trackingNumber}</span>
                                      {pkg.isExtra && (
                                        <Badge className="text-xs bg-blue-100 text-blue-700">
                                          {t("scan.extra")}
                                        </Badge>
                                      )}
                                      {!pkg.hasCompleteData && (
                                        <Badge variant="outline" className="text-xs bg-yellow-50 border-yellow-300">
                                          <AlertTriangle className="h-3 w-3 mr-1" />
                                          {t("scan.incomplete")}
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                      <span className="font-medium">{pkg.customerCode}</span>
                                      <span className="mx-2">•</span>
                                      <span>{pkg.batchNumber}</span>
                                    </div>
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {pkg.verifiedAt.toLocaleTimeString()}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-8 text-muted-foreground">
                              <Search className="h-12 w-12 mx-auto mb-3 opacity-50" />
                              <p>{t("scan.noPackagesVerifiedYet")}</p>
                            </div>
                          )}
                        </ScrollArea>
                      </TabsContent>
                    </CardContent>
                  </Tabs>
                </Card>
              )}
            </div>
            
            {/* Sidebar - Stats & Info */}
            <div className="space-y-6">
              {/* Verification Stats */}
              <Card className={cn(
                "border-0 shadow-lg",
                verificationStats.isComplete && "bg-gradient-to-br from-green-500 to-emerald-600 text-white"
              )}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className={cn("h-5 w-5", verificationStats.isComplete ? "text-white" : "text-emerald-600")} />
                    {t("scan.verificationStats")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className={cn(
                      "rounded-lg p-3 text-center",
                      verificationStats.isComplete ? "bg-white/20" : "bg-slate-50 dark:bg-slate-800"
                    )}>
                      <div className={cn(
                        "text-2xl font-bold",
                        verificationStats.isComplete ? "text-white" : "text-slate-700 dark:text-slate-200"
                      )}>
                        {verificationStats.totalExpected}
                      </div>
                      <div className={cn(
                        "text-xs",
                        verificationStats.isComplete ? "text-white/80" : "text-muted-foreground"
                      )}>
                        {t("scan.total")}
                      </div>
                    </div>
                    <div className={cn(
                      "rounded-lg p-3 text-center",
                      verificationStats.isComplete ? "bg-white/20" : "bg-green-50 dark:bg-green-900/20"
                    )}>
                      <div className={cn(
                        "text-2xl font-bold",
                        verificationStats.isComplete ? "text-white" : "text-green-600"
                      )}>
                        {verificationStats.totalVerified}
                      </div>
                      <div className={cn(
                        "text-xs",
                        verificationStats.isComplete ? "text-white/80" : "text-muted-foreground"
                      )}>
                        {t("scan.verified")}
                      </div>
                    </div>
                    <div className={cn(
                      "rounded-lg p-3 text-center",
                      verificationStats.isComplete ? "bg-white/20" : "bg-yellow-50 dark:bg-yellow-900/20"
                    )}>
                      <div className={cn(
                        "text-2xl font-bold",
                        verificationStats.isComplete ? "text-white" : "text-yellow-600"
                      )}>
                        {verificationStats.totalMissing}
                      </div>
                      <div className={cn(
                        "text-xs",
                        verificationStats.isComplete ? "text-white/80" : "text-muted-foreground"
                      )}>
                        {t("scan.missing")}
                      </div>
                    </div>
                    <div className={cn(
                      "rounded-lg p-3 text-center",
                      verificationStats.isComplete ? "bg-white/20" : "bg-blue-50 dark:bg-blue-900/20"
                    )}>
                      <div className={cn(
                        "text-2xl font-bold",
                        verificationStats.isComplete ? "text-white" : "text-blue-600"
                      )}>
                        {verificationStats.totalExtra}
                      </div>
                      <div className={cn(
                        "text-xs",
                        verificationStats.isComplete ? "text-white/80" : "text-muted-foreground"
                      )}>
                        {t("scan.extra")}
                      </div>
                    </div>
                  </div>
                  
                  {verificationStats.isComplete && (
                    <div className="mt-4 p-3 bg-white/20 rounded-lg text-center">
                      <CheckCircle2 className="h-8 w-8 mx-auto mb-2" />
                      <div className="font-bold">{t("scan.complete")}</div>
                      <div className="text-sm opacity-80">{t("scan.allPackagesArrived")}</div>
                    </div>
                  )}
                </CardContent>
              </Card>
              
              {/* Selected Batches Summary */}
              {selectedBatches.length > 0 && (
                <Card className="border-0 shadow-lg">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">{t("scan.selectedBatches")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {selectedBatches.map((batch) => {
                        const batchPkgs = batchPackages.get(batch.id) || [];
                        const verified = batchPkgs.filter(p => p.verified).length;
                        const total = batchPkgs.length;
                        const pct = total > 0 ? Math.round((verified / total) * 100) : 0;
                        
                        return (
                          <div key={batch.id} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-sm">{batch.batchCode}</span>
                              <span className="text-xs text-muted-foreground">{verified}/{total}</span>
                            </div>
                            <Progress value={pct} className="h-2" />
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {/* Quick Actions */}
              <Card className="border-0 shadow-lg">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">{t("scan.quickActions")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={clearSession}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    {t("scan.resetSession")}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => refetchBatches()}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    {t("scan.refreshBatches")}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
        
        {/* Extra Package Dialog */}
        <Dialog open={extraPackageDialog.open} onOpenChange={(open) => !open && setExtraPackageDialog({ open: false, package: null, trackingNumber: "" })}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-blue-500" />
                {t("scan.extraPackage")}
              </DialogTitle>
              <DialogDescription>
                {t("scan.extraPackageDesc")}
              </DialogDescription>
            </DialogHeader>
            
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200">
              <div className="font-mono text-lg">{extraPackageDialog.trackingNumber}</div>
              <div className="text-sm text-blue-700 dark:text-blue-300 mt-2 flex items-center gap-2">
                <Info className="h-4 w-4" />
                {t("scan.packageInAnotherBatch")}
              </div>
            </div>
            
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setExtraPackageDialog({ open: false, package: null, trackingNumber: "" })}
              >
                {t("scan.cancel")}
              </Button>
              <Button
                onClick={handleAddExtraPackage}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                {t("scan.recordAsExtra")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* Report Dialog */}
        <Dialog open={reportDialog} onOpenChange={setReportDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-emerald-600" />
                {t("scan.verificationReport")}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-4 gap-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg text-center">
                  <div className="text-2xl font-bold">{verificationStats.totalExpected}</div>
                  <div className="text-xs text-muted-foreground">{t("scan.total")}</div>
                </div>
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
                  <div className="text-2xl font-bold text-green-600">{verificationStats.totalVerified}</div>
                  <div className="text-xs text-muted-foreground">{t("scan.verified")}</div>
                </div>
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-center">
                  <div className="text-2xl font-bold text-yellow-600">{verificationStats.totalMissing}</div>
                  <div className="text-xs text-muted-foreground">{t("scan.missing")}</div>
                </div>
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center">
                  <div className="text-2xl font-bold text-blue-600">{verificationStats.totalExtra}</div>
                  <div className="text-xs text-muted-foreground">{t("scan.extra")}</div>
                </div>
              </div>
              
              {/* Status */}
              <div className={cn(
                "p-4 rounded-lg text-center",
                verificationStats.isComplete 
                  ? "bg-green-100 dark:bg-green-900/30 border border-green-200"
                  : "bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-200"
              )}>
                {verificationStats.isComplete ? (
                  <div className="flex items-center justify-center gap-2 text-green-700">
                    <CheckCircle2 className="h-6 w-6" />
                    <span className="font-bold text-lg">{t("scan.allPackagesArrived")}</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 text-yellow-700">
                    <AlertTriangle className="h-6 w-6" />
                    <span className="font-bold text-lg">
                      {`${verificationStats.totalMissing} ${t("scan.packagesRemaining")}`}
                    </span>
                  </div>
                )}
              </div>
              
              {/* Missing Packages */}
              {unverifiedPackages.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-yellow-500" />
                    {t("scan.missingPackages")}
                  </h4>
                  <ScrollArea className="h-[150px] border rounded-lg p-2">
                    <div className="space-y-1">
                      {unverifiedPackages.map((pkg, i) => (
                        <div key={i} className="text-sm flex justify-between p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                          <span className="font-mono">{pkg.trackingNumber}</span>
                          <span className="text-muted-foreground">{pkg.customerCode}</span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
              
              {/* Extra Packages */}
              {verificationStats.totalExtra > 0 && (
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Plus className="h-4 w-4 text-blue-500" />
                    {t("scan.extraPackages")}
                  </h4>
                  <ScrollArea className="h-[100px] border rounded-lg p-2">
                    <div className="space-y-1">
                      {verifiedPackages.filter(p => p.isExtra).map((pkg, i) => (
                        <div key={i} className="text-sm flex justify-between p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                          <span className="font-mono">{pkg.trackingNumber}</span>
                          <span className="text-muted-foreground">{pkg.customerCode}</span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setReportDialog(false)}>
                {t("scan.close")}
              </Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700">
                <Printer className="h-4 w-4 mr-2" />
                {t("scan.print")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
