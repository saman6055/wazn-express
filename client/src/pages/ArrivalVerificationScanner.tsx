import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { 
  Package, CheckCircle2, AlertTriangle, XCircle, 
  Scale, Volume2, VolumeX, Zap, Camera, Keyboard,
  Target, BarChart3, Box, RefreshCw, FileText,
  Play, Pause, History, X, Info, AlertCircle,
  TrendingUp, Clock, MapPin, Truck, Search,
  Plus, Download, Printer, Eye, ChevronDown
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import BarcodeScanner from "@/components/BarcodeScanner";
import { useTranslation, useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

// ==================== SOUND MANAGER ====================
class SoundManager {
  private audioContext: AudioContext | null = null;
  private enabled: boolean = true;

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  private getContext(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return this.audioContext;
  }

  playBeep() {
    const ctx = this.getContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 1800;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  }

  playSuccess() {
    const ctx = this.getContext();
    if (!ctx) return;
    [523, 659, 784].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.08 + 0.12);
      osc.start(ctx.currentTime + i * 0.08);
      osc.stop(ctx.currentTime + i * 0.08 + 0.12);
    });
  }

  playWarning() {
    const ctx = this.getContext();
    if (!ctx) return;
    [440, 440].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = "triangle";
      gain.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.15 + 0.1);
      osc.start(ctx.currentTime + i * 0.15);
      osc.stop(ctx.currentTime + i * 0.15 + 0.1);
    });
  }

  playError() {
    const ctx = this.getContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 300;
    osc.type = "sawtooth";
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  }

  playComplete() {
    const ctx = this.getContext();
    if (!ctx) return;
    // Victory sound - ascending notes
    [523, 659, 784, 1047].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.12 + 0.2);
      osc.start(ctx.currentTime + i * 0.12);
      osc.stop(ctx.currentTime + i * 0.12 + 0.2);
    });
  }

  playDuplicate() {
    const ctx = this.getContext();
    if (!ctx) return;
    [330, 330, 330].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = "square";
      gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.1 + 0.06);
      osc.start(ctx.currentTime + i * 0.1);
      osc.stop(ctx.currentTime + i * 0.1 + 0.06);
    });
  }
}

const soundManager = new SoundManager();

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
export default function ArrivalVerificationScanner() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  
  // Core state
  const [scanMode, setScanMode] = useState<"manual" | "camera">("manual");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [selectedBatchIds, setSelectedBatchIds] = useState<number[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // Continuous mode
  const [continuousMode, setContinuousMode] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  // Verification tracking
  const [verifiedPackages, setVerifiedPackages] = useState<VerifiedPackage[]>([]);
  const [batchPackages, setBatchPackages] = useState<Map<number, BatchPackage[]>>(new Map());
  
  // Dialogs
  const [extraPackageDialog, setExtraPackageDialog] = useState<{
    open: boolean;
    package: any;
    trackingNumber: string;
  }>({ open: false, package: null, trackingNumber: "" });
  const [reportDialog, setReportDialog] = useState(false);
  
  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  const lastScanTime = useRef<number>(0);
  
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
  
  // Update sound manager
  useEffect(() => {
    soundManager.setEnabled(soundEnabled);
  }, [soundEnabled]);
  
  // Focus input on mount
  useEffect(() => {
    if (scanMode === "manual") {
      inputRef.current?.focus();
    }
  }, [scanMode, selectedBatchIds]);
  
  // Check for completion
  useEffect(() => {
    if (verificationStats.isComplete && verificationStats.totalExpected > 0) {
      soundManager.playComplete();
      toast.success(
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-500" />
          <div>
            <div className="font-medium">{language === "ku" ? "هەموو پاکەتەکان گەیشتن!" : "All packages arrived!"}</div>
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
  
  // Handle scan
  const handleScan = useCallback(async () => {
    if (!trackingNumber.trim()) return;
    if (selectedBatchIds.length === 0) {
      soundManager.playError();
      toast.error(language === "ku" ? "تکایە باچێک هەڵبژێرە" : "Please select a batch");
      return;
    }
    
    // Debounce rapid scans
    const now = Date.now();
    if (now - lastScanTime.current < 500) return;
    lastScanTime.current = now;
    
    soundManager.playBeep();
    setIsSearching(true);
    
    try {
      // Search for the package
      const result = await trpcUtils.scanning.searchByTracking.fetch({ 
        trackingNumber: trackingNumber.trim() 
      });
      
      if (!result?.found || !result.package) {
        soundManager.playError();
        toast.error(
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <div>
              <div className="font-medium">{language === "ku" ? "پاکەت نەدۆزرایەوە!" : "Package not found!"}</div>
              <div className="text-sm text-muted-foreground">{trackingNumber}</div>
            </div>
          </div>
        );
        setTrackingNumber("");
        inputRef.current?.focus();
        return;
      }
      
      const pkg = result.package;
      const customer = result.customer;
      
      // Check if already verified in this session
      if (verifiedPackages.some(v => v.id === pkg.id)) {
        soundManager.playDuplicate();
        toast.warning(
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            <div>
              <div className="font-medium">{language === "ku" ? "پێشتر پشکنینکراوە!" : "Already verified!"}</div>
              <div className="text-sm text-muted-foreground">{trackingNumber}</div>
            </div>
          </div>
        );
        setTrackingNumber("");
        inputRef.current?.focus();
        return;
      }
      
      // Check if package is in selected batches
      const isInSelectedBatches = pkg.batchId ? selectedBatchIds.includes(pkg.batchId) : false;
      
      if (!isInSelectedBatches) {
        // Package is not in selected batches - show dialog
        soundManager.playWarning();
        setExtraPackageDialog({
          open: true,
          package: pkg,
          trackingNumber: trackingNumber,
        });
        return;
      }
      
      // Package is in selected batches - verify it
      const batch = batches?.find(b => b.id === pkg.batchId);
      const hasCompleteData = !!(pkg.weightKg || (pkg.lengthCm && pkg.widthCm && pkg.heightCm));
      
      const verifiedPkg: VerifiedPackage = {
        id: pkg.id,
        trackingNumber: pkg.trackingNumber || trackingNumber,
        customerCode: customer?.customerCode || "نەناسراو",
        customerName: customer?.fullName || "",
        weight: pkg.weightKg ? parseFloat(pkg.weightKg) : null,
        cbm: pkg.volumeCbm ? parseFloat(pkg.volumeCbm) : null,
        hasCompleteData,
        batchId: pkg.batchId || 0,
        batchNumber: batch?.batchCode || `#${pkg.batchId || 0}`,
        verifiedAt: new Date(),
        isExtra: false,
      };
      
      setVerifiedPackages(prev => [verifiedPkg, ...prev]);
      soundManager.playSuccess();
      
      // Show warning if incomplete data
      if (!hasCompleteData) {
        toast.warning(
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            <div>
              <div className="font-medium">{language === "ku" ? "پشکنینکرا (زانیاری ناتەواو)" : "Verified (incomplete data)"}</div>
              <div className="text-sm text-muted-foreground">{customer?.customerCode} - {trackingNumber}</div>
            </div>
          </div>
        );
      } else {
        toast.success(
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <div>
              <div className="font-medium">{language === "ku" ? "پشکنینکرا!" : "Verified!"}</div>
              <div className="text-sm text-muted-foreground">{customer?.customerCode} - {trackingNumber}</div>
            </div>
          </div>
        );
      }
      
      setTrackingNumber("");
      inputRef.current?.focus();
      
    } catch (error: any) {
      soundManager.playError();
      toast.error(error?.message || "Search failed");
    } finally {
      setIsSearching(false);
    }
  }, [trackingNumber, selectedBatchIds, language, trpcUtils, batches, verifiedPackages]);
  
  // Handle extra package - add to batch
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
          <div className="font-medium">{language === "ku" ? "پاکەتی زیادە تۆمارکرا!" : "Extra package recorded!"}</div>
          <div className="text-sm text-muted-foreground">{extraPackageDialog.trackingNumber}</div>
        </div>
      </div>
    );
    
    setExtraPackageDialog({ open: false, package: null, trackingNumber: "" });
    setTrackingNumber("");
    inputRef.current?.focus();
  };
  
  // Handle keyboard
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && trackingNumber) {
      e.preventDefault();
      handleScan();
    }
  }, [trackingNumber, handleScan]);
  
  // Handle camera scan
  const handleCameraScan = useCallback((result: string) => {
    setTrackingNumber(result);
    setTimeout(() => handleScan(), 100);
  }, [handleScan]);
  
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
                    {language === "ku" ? "پشکنینی گەیشتن" : "Arrival Verification"}
                    {continuousMode && (
                      <Badge className="bg-white/20 text-white border-white/30 animate-pulse">
                        <Zap className="h-3 w-3 mr-1" />
                        {language === "ku" ? "بەردەوام" : "Continuous"}
                      </Badge>
                    )}
                  </h1>
                  <p className="text-emerald-100 text-sm">
                    {language === "ku" ? "پشکنینی گەیشتنی پاکەتەکان بە شوێنی مەبەست" : "Verify package arrival at destination"}
                  </p>
                </div>
              </div>
              
              {/* Progress Overview */}
              {selectedBatchIds.length > 0 && (
                <div className="hidden md:flex items-center gap-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold">{verificationStats.percentage}%</div>
                    <div className="text-xs text-emerald-200">{language === "ku" ? "تەواوبوون" : "Complete"}</div>
                  </div>
                  <div className="w-px h-12 bg-white/20" />
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-300">{verificationStats.totalVerified}</div>
                    <div className="text-xs text-emerald-200">{language === "ku" ? "پشکنینکراو" : "Verified"}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-300">{verificationStats.totalMissing}</div>
                    <div className="text-xs text-emerald-200">{language === "ku" ? "ماوە" : "Missing"}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-300">{verificationStats.totalExtra}</div>
                    <div className="text-xs text-emerald-200">{language === "ku" ? "زیادە" : "Extra"}</div>
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
                    {language === "ku" ? "هەڵبژاردنی باچەکان" : "Select Batches"}
                    {selectedBatchIds.length > 0 && (
                      <Badge variant="secondary">{selectedBatchIds.length} {language === "ku" ? "هەڵبژێردراو" : "selected"}</Badge>
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
                              {batch.shippingType.includes("air") ? "هەوایی" : "دەریایی"}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {availableBatches.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>{language === "ku" ? "هیچ باچێکی ئامادە نییە" : "No batches available"}</p>
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
                  <div className="flex flex-wrap items-center gap-4 mb-4">
                    <div className="flex items-center gap-2">
                      <Switch
                        id="continuous"
                        checked={continuousMode}
                        onCheckedChange={setContinuousMode}
                        className="data-[state=checked]:bg-emerald-500"
                      />
                      <Label htmlFor="continuous" className="text-sm cursor-pointer">
                        {language === "ku" ? "بەردەوام" : "Continuous"}
                      </Label>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSoundEnabled(!soundEnabled)}
                      className={cn(soundEnabled ? "text-emerald-600" : "text-slate-400")}
                    >
                      {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setScanMode(scanMode === "manual" ? "camera" : "manual")}
                    >
                      {scanMode === "manual" ? <Camera className="h-4 w-4" /> : <Keyboard className="h-4 w-4" />}
                    </Button>
                    
                    <div className="flex-1" />
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setReportDialog(true)}
                      disabled={verifiedPackages.length === 0}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      {language === "ku" ? "ڕاپۆرت" : "Report"}
                    </Button>
                  </div>
                  
                  {scanMode === "manual" ? (
                    <div className="space-y-4">
                      <div className="flex gap-3">
                        <div className="flex-1 relative">
                          <Input
                            ref={inputRef}
                            placeholder={language === "ku" ? "ژمارەی تراکینگ بنووسە یان سکان بکە..." : "Type or scan tracking number..."}
                            value={trackingNumber}
                            onChange={(e) => setTrackingNumber(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="text-lg h-14 pr-12 font-mono"
                            disabled={selectedBatchIds.length === 0}
                            autoFocus
                          />
                          {trackingNumber && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="absolute right-2 top-1/2 -translate-y-1/2"
                              onClick={() => { setTrackingNumber(""); inputRef.current?.focus(); }}
                            >
                              ✕
                            </Button>
                          )}
                        </div>
                        <Button 
                          onClick={handleScan}
                          disabled={isSearching || !trackingNumber || selectedBatchIds.length === 0}
                          className="h-14 px-8 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
                        >
                          {isSearching ? (
                            <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                          ) : (
                            <>
                              <Target className="h-5 w-5 mr-2" />
                              {language === "ku" ? "پشکنین" : "Verify"}
                            </>
                          )}
                        </Button>
                      </div>
                      
                      {selectedBatchIds.length === 0 && (
                        <div className="flex items-center justify-center gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3">
                          <AlertTriangle className="h-4 w-4" />
                          {language === "ku" ? "تکایە سەرەتا باچێک هەڵبژێرە" : "Please select a batch first"}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <BarcodeScanner onScan={handleCameraScan} />
                      <p className="text-center text-sm text-muted-foreground">
                        {language === "ku" ? "بارکۆدەکە ببە بەرەو کامێرا" : "Point barcode at camera"}
                      </p>
                    </div>
                  )}
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
                          {language === "ku" ? "ماوە" : "Missing"} ({unverifiedPackages.length})
                        </TabsTrigger>
                        <TabsTrigger value="verified" className="gap-2">
                          <CheckCircle2 className="h-4 w-4" />
                          {language === "ku" ? "پشکنینکراو" : "Verified"} ({verifiedPackages.length})
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
                              <p>{language === "ku" ? "هەموو پاکەتەکان پشکنینکراون!" : "All packages verified!"}</p>
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
                                          {language === "ku" ? "زیادە" : "Extra"}
                                        </Badge>
                                      )}
                                      {!pkg.hasCompleteData && (
                                        <Badge variant="outline" className="text-xs bg-yellow-50 border-yellow-300">
                                          <AlertTriangle className="h-3 w-3 mr-1" />
                                          {language === "ku" ? "ناتەواو" : "Incomplete"}
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
                              <p>{language === "ku" ? "هیچ پاکەتێک پشکنین نەکراوە" : "No packages verified yet"}</p>
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
                    {language === "ku" ? "ئاماری پشکنین" : "Verification Stats"}
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
                        {language === "ku" ? "کۆی گشتی" : "Total"}
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
                        {language === "ku" ? "پشکنینکراو" : "Verified"}
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
                        {language === "ku" ? "ماوە" : "Missing"}
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
                        {language === "ku" ? "زیادە" : "Extra"}
                      </div>
                    </div>
                  </div>
                  
                  {verificationStats.isComplete && (
                    <div className="mt-4 p-3 bg-white/20 rounded-lg text-center">
                      <CheckCircle2 className="h-8 w-8 mx-auto mb-2" />
                      <div className="font-bold">{language === "ku" ? "تەواو بوو!" : "Complete!"}</div>
                      <div className="text-sm opacity-80">{language === "ku" ? "هەموو پاکەتەکان گەیشتن" : "All packages arrived"}</div>
                    </div>
                  )}
                </CardContent>
              </Card>
              
              {/* Selected Batches Summary */}
              {selectedBatches.length > 0 && (
                <Card className="border-0 shadow-lg">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">{language === "ku" ? "باچە هەڵبژێردراوەکان" : "Selected Batches"}</CardTitle>
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
                  <CardTitle className="text-sm">{language === "ku" ? "کردارە خێراکان" : "Quick Actions"}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => {
                      setVerifiedPackages([]);
                      setBatchPackages(new Map());
                      setSelectedBatchIds([]);
                    }}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    {language === "ku" ? "دەستپێکردنەوە" : "Reset Session"}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => refetchBatches()}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    {language === "ku" ? "نوێکردنەوەی باچەکان" : "Refresh Batches"}
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
                {language === "ku" ? "پاکەتی زیادە!" : "Extra Package!"}
              </DialogTitle>
              <DialogDescription>
                {language === "ku" 
                  ? "ئەم پاکەتە لە باچە هەڵبژێردراوەکان نییە. دەتەوێت وەک زیادە تۆماری بکەیت؟"
                  : "This package is not in the selected batches. Do you want to record it as extra?"}
              </DialogDescription>
            </DialogHeader>
            
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200">
              <div className="font-mono text-lg">{extraPackageDialog.trackingNumber}</div>
              <div className="text-sm text-blue-700 dark:text-blue-300 mt-2 flex items-center gap-2">
                <Info className="h-4 w-4" />
                {language === "ku" ? "ئەم پاکەتە لە باچی تردایە یان تۆمار نەکراوە" : "This package is in another batch or not registered"}
              </div>
            </div>
            
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setExtraPackageDialog({ open: false, package: null, trackingNumber: "" });
                  setTrackingNumber("");
                  inputRef.current?.focus();
                }}
              >
                {language === "ku" ? "پاشگەزبوونەوە" : "Cancel"}
              </Button>
              <Button
                onClick={handleAddExtraPackage}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                {language === "ku" ? "تۆمارکردن وەک زیادە" : "Record as Extra"}
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
                {language === "ku" ? "ڕاپۆرتی پشکنین" : "Verification Report"}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-4 gap-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg text-center">
                  <div className="text-2xl font-bold">{verificationStats.totalExpected}</div>
                  <div className="text-xs text-muted-foreground">{language === "ku" ? "کۆی گشتی" : "Total"}</div>
                </div>
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
                  <div className="text-2xl font-bold text-green-600">{verificationStats.totalVerified}</div>
                  <div className="text-xs text-muted-foreground">{language === "ku" ? "پشکنینکراو" : "Verified"}</div>
                </div>
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-center">
                  <div className="text-2xl font-bold text-yellow-600">{verificationStats.totalMissing}</div>
                  <div className="text-xs text-muted-foreground">{language === "ku" ? "ماوە" : "Missing"}</div>
                </div>
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center">
                  <div className="text-2xl font-bold text-blue-600">{verificationStats.totalExtra}</div>
                  <div className="text-xs text-muted-foreground">{language === "ku" ? "زیادە" : "Extra"}</div>
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
                    <span className="font-bold text-lg">{language === "ku" ? "هەموو پاکەتەکان گەیشتن!" : "All packages arrived!"}</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 text-yellow-700">
                    <AlertTriangle className="h-6 w-6" />
                    <span className="font-bold text-lg">
                      {language === "ku" ? `${verificationStats.totalMissing} پاکەت ماوە!` : `${verificationStats.totalMissing} packages missing!`}
                    </span>
                  </div>
                )}
              </div>
              
              {/* Missing Packages */}
              {unverifiedPackages.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-yellow-500" />
                    {language === "ku" ? "پاکەتە ماوەکان" : "Missing Packages"}
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
                    {language === "ku" ? "پاکەتە زیادەکان" : "Extra Packages"}
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
                {language === "ku" ? "داخستن" : "Close"}
              </Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700">
                <Printer className="h-4 w-4 mr-2" />
                {language === "ku" ? "چاپکردن" : "Print"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
