import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { OrderNote } from "@/components/scanner/OrderNote";
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
  Plus, Printer, Info, Search, Zap
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useTranslation } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { soundManager } from "@/lib/soundManager";
import { useSystemAlert } from "@/components/SystemAlert";
import { CopyButton } from "@/components/CopyButton";
import { ScanInput } from "@/components/scanner/ScanInput";
import { SessionStats } from "@/components/scanner/SessionStats";

// ==================== TYPES ====================
interface VerifiedPackage {
  id: number;
  trackingNumber: string;
  customerCode: string;
  customerName: string;
  /** What identifies the box to the person holding it. */
  orderCode: string | null;
  photo: string | null;
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
  orderCode: string | null;
  photo: string | null;
  weight: number | null;
  cbm: number | null;
  hasCompleteData: boolean;
  verified: boolean;
}

/**
 * The picture of what should be in the box.
 *
 * A tracking number identifies a parcel to the system; a photograph
 * identifies it to the man holding it. Falls back to a parcel outline rather
 * than a broken image, and never grows past its square — a supplier photo is
 * whatever size the supplier felt like.
 */
function ParcelThumb({ photo, className }: { photo: string | null; className?: string }) {
  return (
    <div
      className={cn(
        "flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted",
        className,
      )}
    >
      {photo ? (
        <img src={photo} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <Package className="h-5 w-5 text-muted-foreground" />
      )}
    </div>
  );
}

// ==================== MAIN COMPONENT ====================
const SESSION_KEY = "scan-session-arrival-verification";

export default function ArrivalVerificationScanner() {
  const systemAlert = useSystemAlert();
  const { t } = useTranslation();

  // Core state
  const [selectedBatchIds, setSelectedBatchIds] = useState<number[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [continuousMode, setContinuousMode] = useState(true);
  /**
   * How the verified list is arranged.
   *
   * "scan" is the order things actually happened, which is what somebody
   * reconciling a session wants. "customer" gathers a customer's parcels
   * together with a rule under each group — that is the arrangement for
   * building boxes, where the question is not "what did I scan" but "what
   * belongs to AZ112".
   */
  const [verifiedOrder, setVerifiedOrder] = useState<"scan" | "customer">("scan");
  /** The batch whose last parcel has just been checked off. */
  const [completedBatch, setCompletedBatch] = useState<{ id: number; code: string; count: number } | null>(null);
  /** Batches already announced, so a later scan does not announce them again. */
  const announcedBatches = useRef<Set<number>>(new Set());
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
  const { data: batchesRaw, refetch: refetchBatches } = trpc.batches.list.useQuery();
  const batches = Array.isArray(batchesRaw) ? batchesRaw : batchesRaw?.data;
  const trpcUtils = trpc.useUtils();
  // Writes the arrival scan. See the call site for why this screen needs it.
  const recordArrival = trpc.scanning.registerScan.useMutation();
  
  // Get batches that are in transit (ready for arrival verification)
  const availableBatches = useMemo(() => {
    if (!batches) return [];
    return batches.filter((b: any) => b.status === "in_transit" || b.status === "preparing");
  }, [batches]);
  
  // Selected batches info
  const selectedBatches = useMemo(() => {
    if (!batches) return [];
    return batches.filter((b: any) => selectedBatchIds.includes(b.id));
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
      const batch = batches?.find((b: any) => b.id === batchId);
      packages.forEach(pkg => {
        if (!pkg.verified) {
          unverified.push({ ...pkg, batchNumber: batch?.batchCode || `#${batchId}` });
        }
      });
    });
    return unverified;
  }, [batchPackages, batches]);
  
  /**
   * The verified list in the chosen arrangement.
   *
   * Grouping by customer sorts by code and keeps the newest scan first
   * inside each group, so a code scanned again half an hour later joins its
   * own parcels rather than starting a second group further down.
   */
  const arrangedVerified = useMemo(() => {
    if (verifiedOrder === "scan") return verifiedPackages;
    return [...verifiedPackages].sort((a, b) => {
      const byCode = a.customerCode.localeCompare(b.customerCode, undefined, { numeric: true });
      if (byCode !== 0) return byCode;
      return b.verifiedAt.getTime() - a.verifiedAt.getTime();
    });
  }, [verifiedPackages, verifiedOrder]);

  /**
   * The moment a batch is finished.
   *
   * Somebody working a container has no way of knowing they have reached the
   * end except by counting, and counting is what they were trying to avoid.
   * When the last parcel of a batch is checked off, the screen says so and
   * takes the batch out of the selection — because leaving a finished batch
   * on screen is how the next container gets scanned into the wrong list.
   *
   * Announced once per batch: a parcel from outside, scanned afterwards,
   * must not raise it a second time.
   */
  useEffect(() => {
    for (const batchId of selectedBatchIds) {
      if (announcedBatches.current.has(batchId)) continue;
      const packages = batchPackages.get(batchId);
      // An empty map means the manifest has not arrived yet, not that the
      // batch is done.
      if (!packages || packages.length === 0) continue;
      const allIn = packages.every((p) => verifiedPackages.some((v) => v.id === p.id));
      if (!allIn) continue;

      announcedBatches.current.add(batchId);
      const batch = batches?.find((b: any) => b.id === batchId);
      setCompletedBatch({
        id: batchId,
        code: batch?.batchCode || `#${batchId}`,
        count: packages.length,
      });
      soundManager.playSuccess();
      break;
    }
  }, [batchPackages, verifiedPackages, selectedBatchIds, batches]);

  /** The manifest row for a parcel, from whichever batch it is on. */
  const manifestRowFor = useCallback(
    (packageId: number): BatchPackage | undefined => {
      for (const packages of Array.from(batchPackages.values())) {
        const found = packages.find((p) => p.id === packageId);
        if (found) return found;
      }
      return undefined;
    },
    [batchPackages],
  );

  // Load batch packages when batches are selected
  useEffect(() => {
    const loadBatchPackages = async () => {
      const newBatchPackages = new Map<number, BatchPackage[]>();
      
      for (const batchId of selectedBatchIds) {
        try {
          // One query per batch, joined server-side. A container is two
          // hundred boxes and this screen opens with it already on the floor.
          const packages = await trpcUtils.packages.batchManifest.fetch({ batchId });
          const batchPkgs: BatchPackage[] = packages.map((pkg) => ({
            id: pkg.id,
            trackingNumber: pkg.trackingNumber || "",
            customerCode: pkg.customerCode || "نەناسراو",
            customerName: pkg.customerName || "",
            orderCode: pkg.orderCode,
            // Carried through the session so the verified list can show it too.
            note: (pkg as any).note ?? null,
            photo: pkg.photo,
            weight: pkg.weightKg ? parseFloat(pkg.weightKg) : null,
            cbm: pkg.volumeCbm ? parseFloat(pkg.volumeCbm) : null,
            hasCompleteData: !!(pkg.weightKg || pkg.volumeCbm),
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
          <CheckCircle2 className="h-5 w-5 text-green-500 dark:text-green-400" />
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
      // No batch chosen is no longer a refusal. The parcel knows which batch
      // it is on; asking the operator to say it first is asking them to look
      // it up on the box before scanning the box.
      soundManager.playBeep();
      setIsSearching(true);
      try {
        const result = await trpcUtils.scanning.searchByTracking.fetch({
          trackingNumber: scannedValue.trim(),
        });
        if (!result?.found || !result.package) {
          // A box on the floor that the system has never heard of. Somebody
          // has to decide what it is before it goes on a shelf.
          systemAlert({
            kind: "error",
            title: t("scan.packageNotFoundExcl"),
            detail: scannedValue,
          });
          return;
        }
        const pkg = result.package;
        const customer = result.customer;
        if (verifiedPackages.some((v) => v.id === pkg.id)) {
          // The operator thinks they have just checked a parcel off and they
          // have not — from here their count and the list disagree.
          systemAlert({
            kind: "warning",
            title: t("scan.alreadyVerified"),
            detail: scannedValue,
          });
          return;
        }
        // A parcel that belongs to a batch nobody has selected selects it —
        // once, and only when it is the first parcel of the session. After
        // that a parcel from elsewhere is genuinely an extra and still asks.
        if (pkg.batchId && selectedBatchIds.length === 0) {
          setSelectedBatchIds([pkg.batchId]);
          const found = batches?.find((b: any) => b.id === pkg.batchId);
          toast.info(
            t("scan.batchPickedFromParcel", { batch: found?.batchCode || `#${pkg.batchId}` }),
          );
        }

        const isInSelectedBatches = pkg.batchId
          ? selectedBatchIds.includes(pkg.batchId) || selectedBatchIds.length === 0
          : false;
        if (!isInSelectedBatches) {
          soundManager.playWarning();
          setExtraPackageDialog({
            open: true,
            package: pkg,
            trackingNumber: scannedValue,
          });
          return;
        }
        const batch = batches?.find((b: any) => b.id === pkg.batchId);
        const hasCompleteData = !!(pkg.weightKg || (pkg.lengthCm && pkg.widthCm && pkg.heightCm));
        const verifiedPkg: VerifiedPackage = {
          id: pkg.id,
          trackingNumber: pkg.trackingNumber || scannedValue,
          customerCode: customer?.customerCode || "—",
          customerName: customer?.fullName || "",
          // The manifest already resolved the order and the picture for this
          // batch; a lookup on the scanned parcel would ask the same question
          // a second time, once per box.
          orderCode: manifestRowFor(pkg.id)?.orderCode ?? null,
          photo: manifestRowFor(pkg.id)?.photo ?? null,
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

        // Record the arrival. Until now this screen only looked packages up:
        // staff scanned a whole container and the result lived in this tab's
        // localStorage until they closed it. The scan is the moment we learn
        // the goods reached Erbil, and it is the only such moment the system
        // ever sees — so it has to be written down.
        //
        // Fire-and-forget: a failed write must not stop the person scanning.
        // The list on screen is unaffected either way.
        recordArrival.mutate(
          {
            trackingNumber: verifiedPkg.trackingNumber,
            packageId: pkg.id,
            scanType: "received_local",
          },
          {
            // The parcel is on the list on screen but the arrival never
            // reached the database. Left as a toast, the operator carries on
            // and the parcel is still "in China" tomorrow.
            onError: (e) =>
              systemAlert({
                kind: "error",
                title: t("scan.arrivalNotSaved"),
                message: e.message,
                detail: verifiedPkg.trackingNumber,
              }),
          },
        );
        if (!hasCompleteData) {
          toast.warning(
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500 dark:text-yellow-400" />
              <div>
                <div className="font-medium">{t("scan.verifiedIncomplete")}</div>
                <div className="text-sm text-muted-foreground">{customer?.customerCode} - {scannedValue}</div>
              </div>
            </div>
          );
        } else {
          toast.success(
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500 dark:text-green-400" />
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
    const batch = batches?.find((b: any) => b.id === selectedBatchIds[0]);
    const hasCompleteData = !!(pkg.weightKg || (pkg.lengthCm && pkg.widthCm && pkg.heightCm));
    
    // Just verify it as extra - don't actually move it
    const verifiedPkg: VerifiedPackage = {
      id: pkg.id,
      trackingNumber: pkg.trackingNumber || extraPackageDialog.trackingNumber,
      customerCode: pkg.customer?.customerCode || "نەناسراو",
      customerName: pkg.customer?.fullName || "",
      // A parcel from outside the chosen batches, so no manifest to ask.
      orderCode: manifestRowFor(pkg.id)?.orderCode ?? null,
      photo: manifestRowFor(pkg.id)?.photo ?? null,
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
        <Plus className="h-5 w-5 text-blue-500 dark:text-blue-400" />
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
                        <Zap className="h-3 w-3 me-1" />
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
                    <Package className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
                    {t("scan.selectBatches")}
                    {selectedBatchIds.length > 0 && (
                      <Badge variant="secondary">{selectedBatchIds.length} {t("scan.selected")}</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {availableBatches.map((batch: any) => (
                      <div
                        key={batch.id}
                        onClick={() => toggleBatchSelection(batch.id)}
                        className={cn(
                          "p-3 rounded-lg border-2 cursor-pointer transition-all",
                          selectedBatchIds.includes(batch.id)
                            ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
                            : "border-slate-200 dark:border-slate-800/60 hover:border-slate-300"
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
                // Never locked: a parcel names its own batch.
              )}>
                <div className={cn(
                  "h-1 transition-all duration-300",
                  continuousMode && selectedBatchIds.length > 0 ? "bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 animate-pulse" : "bg-slate-200 dark:bg-slate-800/50"
                )} />
                <CardContent className="p-6">
                  <div className="transition-all">
                    <ScanInput
                      onScan={handleScan}
                      isProcessing={isSearching}
                      continuousMode={continuousMode}
                      onContinuousModeChange={setContinuousMode}
                      soundEnabled={soundEnabled}
                      onSoundEnabledChange={setSoundEnabled}

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
                    <div className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                      <Search className="h-4 w-4 shrink-0" />
                      {t("scan.batchOptionalHint")}
                    </div>
                  )}
                  <div className="mt-3 flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setReportDialog(true)}
                      disabled={verifiedPackages.length === 0}
                    >
                      <FileText className="h-4 w-4 me-2" />
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
                                  className="flex items-center justify-between p-3 rounded-lg border bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800/60"
                                >
                                  <ParcelThumb photo={pkg.photo} />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="font-mono text-sm font-medium">{pkg.trackingNumber}</span>
                                      <CopyButton value={pkg.trackingNumber} />
                                      <Badge variant="outline" className="text-xs">{pkg.batchNumber}</Badge>
                                      {pkg.orderCode && (
                                        <Badge variant="secondary" className="text-xs font-mono">
                                          {pkg.orderCode}
                                        </Badge>
                                      )}
                                      {pkg.orderCode && <CopyButton value={pkg.orderCode} />}
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-1 truncate">
                                      <span className="font-medium">{pkg.customerCode}</span>
                                      {pkg.customerName && <span className="mx-1">—</span>}
                                      {pkg.customerName && <span>{pkg.customerName}</span>}
                                      {pkg.weight && <span className="mx-2">•</span>}
                                      {pkg.weight && <span>{pkg.weight}kg</span>}
                                    </div>
                                    {/* These are the boxes somebody has to go
                                        and find. A note about one matters
                                        more here than anywhere. */}
                                    <OrderNote note={(pkg as any).note} compact className="mt-1.5" />
                                  </div>
                                  <XCircle className="h-5 w-5 shrink-0 text-yellow-500 dark:text-yellow-400" />
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-8 text-muted-foreground">
                              <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-500 dark:text-green-400" />
                              <p>{t("scan.allPackagesVerified")}</p>
                            </div>
                          )}
                        </ScrollArea>
                      </TabsContent>
                      
                      <TabsContent value="verified" className="mt-0">
                        {/* Two ways to read the same session. By scan is what
                            happened; by customer is what belongs to whom,
                            which is the question when boxes are being built. */}
                        {verifiedPackages.length > 1 && (
                          <div className="mb-2 flex items-center gap-1">
                            {(["scan", "customer"] as const).map((mode) => (
                              <Button
                                key={mode}
                                type="button"
                                size="sm"
                                variant={verifiedOrder === mode ? "secondary" : "ghost"}
                                className="h-7 text-xs"
                                data-testid={`arrange-${mode}`}
                                onClick={() => setVerifiedOrder(mode)}
                              >
                                {mode === "scan" ? t("scan.arrangeByScan") : t("scan.arrangeByCustomer")}
                              </Button>
                            ))}
                          </div>
                        )}
                        <ScrollArea className="h-[300px]">
                          {verifiedPackages.length > 0 ? (
                            <div className="space-y-2">
                              {arrangedVerified.map((pkg, index) => {
                                // A rule and a code above the first parcel of
                                // each customer. Without it a sorted list is
                                // just a list that happens to be in order.
                                const startsGroup =
                                  verifiedOrder === "customer" &&
                                  (index === 0 || arrangedVerified[index - 1]!.customerCode !== pkg.customerCode);
                                return (
                                <div key={`g-${pkg.id}-${index}`}>
                                {startsGroup && (
                                  <div className="mb-1 mt-3 flex items-center gap-2 first:mt-0">
                                    <span className="font-mono text-xs font-semibold text-muted-foreground">
                                      {pkg.customerCode}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {arrangedVerified.filter((p) => p.customerCode === pkg.customerCode).length}
                                    </span>
                                    <span className="h-px flex-1 bg-border" />
                                  </div>
                                )}
                                <div
                                  key={`${pkg.id}-${index}`}
                                  className={cn(
                                    "flex items-center justify-between p-3 rounded-lg border",
                                    pkg.isExtra 
                                      ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/60"
                                      : pkg.hasCompleteData
                                        ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/60"
                                        : "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800/60"
                                  )}
                                >
                                  <ParcelThumb photo={pkg.photo} />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="font-mono text-sm font-medium">{pkg.trackingNumber}</span>
                                      <CopyButton value={pkg.trackingNumber} />
                                      {pkg.orderCode && (
                                        <Badge variant="secondary" className="text-xs font-mono">
                                          {pkg.orderCode}
                                        </Badge>
                                      )}
                                      {pkg.orderCode && <CopyButton value={pkg.orderCode} />}
                                      {pkg.isExtra && (
                                        <Badge className="text-xs bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300">
                                          {t("scan.extra")}
                                        </Badge>
                                      )}
                                      {!pkg.hasCompleteData && (
                                        <Badge variant="outline" className="text-xs bg-yellow-50 dark:bg-yellow-950/40 border-yellow-300 dark:border-yellow-800/60">
                                          <AlertTriangle className="h-3 w-3 me-1" />
                                          {t("scan.incomplete")}
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-1 truncate">
                                      <span className="font-medium">{pkg.customerCode}</span>
                                      {pkg.customerName && <span className="mx-1">—</span>}
                                      {pkg.customerName && <span>{pkg.customerName}</span>}
                                      <span className="mx-2">•</span>
                                      <span>{pkg.batchNumber}</span>
                                    </div>
                                  </div>
                                  <div className="shrink-0 text-xs text-muted-foreground">
                                    {pkg.verifiedAt.toLocaleTimeString()}
                                  </div>
                                </div>
                                </div>
                                );
                              })}
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
                    <BarChart3 className={cn("h-5 w-5", verificationStats.isComplete ? "text-white" : "text-emerald-600 dark:text-emerald-300")} />
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
                        verificationStats.isComplete ? "text-white" : "text-green-600 dark:text-green-300"
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
                        verificationStats.isComplete ? "text-white" : "text-yellow-600 dark:text-yellow-300"
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
                        verificationStats.isComplete ? "text-white" : "text-blue-600 dark:text-blue-300"
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
                      {selectedBatches.map((batch: any) => {
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
                    <RefreshCw className="h-4 w-4 me-2" />
                    {t("scan.resetSession")}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => refetchBatches()}
                  >
                    <RefreshCw className="h-4 w-4 me-2" />
                    {t("scan.refreshBatches")}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
        
        {/* Extra Package Dialog */}
        {/* A batch finished. Said once, acknowledged once, and then the
            batch leaves the selection so the next container cannot be
            scanned into it. */}
        <Dialog
          open={!!completedBatch}
          onOpenChange={(open) => {
            if (!open) setCompletedBatch(null);
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                {t("scan.batchFullyVerified")}
              </DialogTitle>
              <DialogDescription>
                {t("scan.batchFullyVerifiedDesc", {
                  count: completedBatch?.count ?? 0,
                  batch: completedBatch?.code ?? "",
                })}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                autoFocus
                data-testid="batch-complete-ok"
                onClick={() => {
                  if (completedBatch) {
                    // Off the selection, not out of the session: the parcels
                    // stay in the verified list and on the report.
                    setSelectedBatchIds((ids) => ids.filter((id) => id !== completedBatch.id));
                  }
                  setCompletedBatch(null);
                }}
                className="px-10"
              >
                OK
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={extraPackageDialog.open} onOpenChange={(open) => !open && setExtraPackageDialog({ open: false, package: null, trackingNumber: "" })}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-blue-500 dark:text-blue-400" />
                {t("scan.extraPackage")}
              </DialogTitle>
              <DialogDescription>
                {t("scan.extraPackageDesc")}
              </DialogDescription>
            </DialogHeader>
            
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800/60">
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
                <Plus className="h-4 w-4 me-2" />
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
                <FileText className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
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
                  <div className="text-2xl font-bold text-green-600 dark:text-green-300">{verificationStats.totalVerified}</div>
                  <div className="text-xs text-muted-foreground">{t("scan.verified")}</div>
                </div>
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-center">
                  <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-300">{verificationStats.totalMissing}</div>
                  <div className="text-xs text-muted-foreground">{t("scan.missing")}</div>
                </div>
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-300">{verificationStats.totalExtra}</div>
                  <div className="text-xs text-muted-foreground">{t("scan.extra")}</div>
                </div>
              </div>
              
              {/* Status */}
              <div className={cn(
                "p-4 rounded-lg text-center",
                verificationStats.isComplete 
                  ? "bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800/60"
                  : "bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800/60"
              )}>
                {verificationStats.isComplete ? (
                  <div className="flex items-center justify-center gap-2 text-green-700 dark:text-green-300">
                    <CheckCircle2 className="h-6 w-6" />
                    <span className="font-bold text-lg">{t("scan.allPackagesArrived")}</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 text-yellow-700 dark:text-yellow-300">
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
                    <XCircle className="h-4 w-4 text-yellow-500 dark:text-yellow-400" />
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
                    <Plus className="h-4 w-4 text-blue-500 dark:text-blue-400" />
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
                <Printer className="h-4 w-4 me-2" />
                {t("scan.print")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
