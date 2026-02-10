import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { 
  Package, Layers, Search, CheckCircle2, AlertTriangle, 
  Scale, Ruler, Volume2, VolumeX, Zap, Camera, Keyboard,
  ArrowRight, Activity, Settings2, ScanLine, Target,
  BarChart3, Box, Truck, RefreshCw, ExternalLink, Edit,
  Play, Pause, History, X, Info, AlertCircle
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import BarcodeScanner from "@/components/BarcodeScanner";
import { useTranslation, useLanguage } from "@/contexts/LanguageContext";
import { useLocation } from "wouter";
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
  const { language } = useLanguage();
  const [, setLocation] = useLocation();
  
  // Core state
  const [scanMode, setScanMode] = useState<"manual" | "camera">("manual");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");
  const [isSearching, setIsSearching] = useState(false);
  
  // Continuous mode
  const [continuousMode, setContinuousMode] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  // Scanned packages for this session
  const [scannedPackages, setScannedPackages] = useState<ScannedPackage[]>([]);
  
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
  
  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  const lastScanTime = useRef<number>(0);
  
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
    onSuccess: () => {
      // Will be handled in the scan function
    },
    onError: (error) => {
      soundManager.playError();
      toast.error(`${language === "ku" ? "هەڵە" : "Error"}: ${error.message}`);
    }
  });
  
  // Update sound manager
  useEffect(() => {
    soundManager.setEnabled(soundEnabled);
  }, [soundEnabled]);
  
  // Focus input on mount
  useEffect(() => {
    if (scanMode === "manual") {
      inputRef.current?.focus();
    }
  }, [scanMode, selectedBatchId]);
  
  // Handle scan
  const handleScan = useCallback(async () => {
    if (!trackingNumber.trim()) return;
    if (!selectedBatchId) {
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
      
      // Check if already in this batch
      if (pkg.batchId === parseInt(selectedBatchId)) {
        soundManager.playDuplicate();
        toast.warning(
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            <div>
              <div className="font-medium">{language === "ku" ? "پێشتر لەم باچەدایە!" : "Already in this batch!"}</div>
              <div className="text-sm text-muted-foreground">{trackingNumber}</div>
            </div>
          </div>
        );
        setTrackingNumber("");
        inputRef.current?.focus();
        return;
      }
      
      // Check if package has complete data
      const hasWeight = pkg.weightKg && parseFloat(pkg.weightKg) > 0;
      const hasDimensions = pkg.lengthCm && pkg.widthCm && pkg.heightCm;
      const hasCompleteData: boolean = !!(hasWeight || hasDimensions);
      
      // Check if package is in another batch
      if (pkg.batchId && pkg.batchId !== parseInt(selectedBatchId)) {
        const previousBatch = batches?.find(b => b.id === pkg.batchId);
        setBatchChangeDialog({
          open: true,
          package: {
            id: pkg.id,
            trackingNumber: pkg.trackingNumber || trackingNumber,
            customerCode: customer?.customerCode || "نەناسراو",
            customerName: customer?.fullName || "",
            weight: pkg.weightKg ? parseFloat(pkg.weightKg) : null,
            cbm: pkg.volumeCbm ? parseFloat(pkg.volumeCbm) : null,
            hasCompleteData: hasCompleteData,
            previousBatchId: pkg.batchId,
            previousBatchNumber: previousBatch?.batchCode || `#${pkg.batchId}`,
            scannedAt: new Date(),
          },
          currentBatchNumber: previousBatch?.batchCode || `#${pkg.batchId}`,
          newBatchId: parseInt(selectedBatchId),
        });
        return;
      }
      
      // Check for incomplete data
      if (!hasCompleteData) {
        soundManager.playWarning();
        setIncompleteDataDialog({
          open: true,
          package: pkg,
          trackingNumber: trackingNumber,
        });
        return;
      }
      
      // Assign to batch
      await assignToBatch.mutateAsync({
        packageId: pkg.id,
        batchId: parseInt(selectedBatchId),
      });
      
      // Add to scanned list
      const scannedPkg: ScannedPackage = {
        id: pkg.id,
        trackingNumber: pkg.trackingNumber || trackingNumber,
        customerCode: customer?.customerCode || "نەناسراو",
        customerName: customer?.fullName || "",
        weight: pkg.weightKg ? parseFloat(pkg.weightKg) : null,
        cbm: pkg.volumeCbm ? parseFloat(pkg.volumeCbm) : null,
        hasCompleteData: hasCompleteData,
        previousBatchId: null,
        previousBatchNumber: null,
        scannedAt: new Date(),
      };
      
      setScannedPackages(prev => [scannedPkg, ...prev]);
      soundManager.playSuccess();
      
      toast.success(
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-500" />
          <div>
            <div className="font-medium">{language === "ku" ? "زیادکرا بۆ باچ!" : "Added to batch!"}</div>
            <div className="text-sm text-muted-foreground">{customer?.customerCode} - {trackingNumber}</div>
          </div>
        </div>
      );
      
      setTrackingNumber("");
      inputRef.current?.focus();
      
    } catch (error: any) {
      soundManager.playError();
      toast.error(error?.message || "Search failed");
    } finally {
      setIsSearching(false);
    }
  }, [trackingNumber, selectedBatchId, language, trpcUtils, batches, assignToBatch]);
  
  // Handle batch change confirmation
  const handleBatchChangeConfirm = async () => {
    if (!batchChangeDialog.package) return;
    
    try {
      await assignToBatch.mutateAsync({
        packageId: batchChangeDialog.package.id,
        batchId: batchChangeDialog.newBatchId,
      });
      
      setScannedPackages(prev => [batchChangeDialog.package!, ...prev]);
      soundManager.playSuccess();
      
      toast.success(
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-500" />
          <div>
            <div className="font-medium">{language === "ku" ? "باچ گۆڕدرا!" : "Batch changed!"}</div>
            <div className="text-sm text-muted-foreground">
              {batchChangeDialog.currentBatchNumber} → {selectedBatch?.batchCode}
            </div>
          </div>
        </div>
      );
      
      setBatchChangeDialog({ open: false, package: null, currentBatchNumber: "", newBatchId: 0 });
      setTrackingNumber("");
      inputRef.current?.focus();
      
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
        customerCode: pkg.customer?.customerCode || "نەناسراو",
        customerName: pkg.customer?.fullName || "",
        weight: pkg.weightKg ? parseFloat(pkg.weightKg) : null,
        cbm: pkg.volumeCbm ? parseFloat(pkg.volumeCbm) : null,
        hasCompleteData: false,
        previousBatchId: null,
        previousBatchNumber: null,
        scannedAt: new Date(),
      };
      
      setScannedPackages(prev => [scannedPkg, ...prev]);
      soundManager.playSuccess();
      
      toast.success(language === "ku" ? "زیادکرا (بەبێ زانیاری تەواو)" : "Added (without complete data)");
      
      setIncompleteDataDialog({ open: false, package: null, trackingNumber: "" });
      setTrackingNumber("");
      inputRef.current?.focus();
      
    } catch (error: any) {
      soundManager.playError();
      toast.error(error?.message || "Failed");
    }
  };
  
  // Handle go to quick register
  const handleGoToQuickRegister = () => {
    setLocation(`/quick-register?tracking=${encodeURIComponent(incompleteDataDialog.trackingNumber)}&returnTo=/batch-assignment`);
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
  const getPackageStatusColor = (hasCompleteData: boolean) => {
    return hasCompleteData 
      ? "bg-green-100 text-green-800 border-green-200" 
      : "bg-yellow-100 text-yellow-800 border-yellow-200";
  };

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
                    {language === "ku" ? "خستنە ناو باچ" : "Batch Assignment"}
                    {continuousMode && (
                      <Badge className="bg-white/20 text-white border-white/30 animate-pulse">
                        <Zap className="h-3 w-3 mr-1" />
                        {language === "ku" ? "بەردەوام" : "Continuous"}
                      </Badge>
                    )}
                  </h1>
                  <p className="text-indigo-100 text-sm">
                    {language === "ku" ? "سکانکردن و زیادکردنی پاکەتەکان بۆ باچ" : "Scan and add packages to batch"}
                  </p>
                </div>
              </div>
              
              {/* Session Stats */}
              <div className="hidden md:flex items-center gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold">{batchStats.totalPackages}</div>
                  <div className="text-xs text-indigo-200">{language === "ku" ? "پاکەت" : "Packages"}</div>
                </div>
                <div className="w-px h-10 bg-white/20" />
                <div className="text-center">
                  <div className="text-2xl font-bold">{batchStats.totalWeight.toFixed(1)}</div>
                  <div className="text-xs text-indigo-200">{language === "ku" ? "کیلۆ" : "KG"}</div>
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
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex-1 min-w-[250px]">
                      <Label className="text-sm font-medium mb-2 block">
                        {language === "ku" ? "هەڵبژاردنی باچ" : "Select Batch"}
                      </Label>
                      <Select value={selectedBatchId} onValueChange={setSelectedBatchId}>
                        <SelectTrigger className="h-12 text-base">
                          <SelectValue placeholder={language === "ku" ? "باچێک هەڵبژێرە..." : "Select a batch..."} />
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
                    </div>
                    
                    {/* Quick Controls */}
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Switch
                          id="continuous"
                          checked={continuousMode}
                          onCheckedChange={setContinuousMode}
                          className="data-[state=checked]:bg-indigo-500"
                        />
                        <Label htmlFor="continuous" className="text-sm cursor-pointer">
                          {language === "ku" ? "بەردەوام" : "Continuous"}
                        </Label>
                      </div>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSoundEnabled(!soundEnabled)}
                        className={cn(soundEnabled ? "text-indigo-600" : "text-slate-400")}
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
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Scanner Input */}
              <Card className={cn(
                "border-0 shadow-lg overflow-hidden transition-all",
                !selectedBatchId && "opacity-50 pointer-events-none"
              )}>
                <div className={cn(
                  "h-1 transition-all duration-300",
                  continuousMode && selectedBatchId ? "bg-gradient-to-r from-indigo-500 via-purple-500 to-violet-500 animate-pulse" : "bg-slate-200"
                )} />
                <CardContent className="p-6">
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
                            disabled={!selectedBatchId}
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
                          disabled={isSearching || !trackingNumber || !selectedBatchId}
                          className="h-14 px-8 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                        >
                          {isSearching ? (
                            <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                          ) : (
                            <>
                              <Layers className="h-5 w-5 mr-2" />
                              {language === "ku" ? "زیادکردن" : "Add"}
                            </>
                          )}
                        </Button>
                      </div>
                      
                      {!selectedBatchId && (
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
              
              {/* Scanned Packages List */}
              {scannedPackages.length > 0 && (
                <Card className="border-0 shadow-lg">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                        {language === "ku" ? "پاکەتە سکانکراوەکان" : "Scanned Packages"}
                        <Badge variant="secondary">{scannedPackages.length}</Badge>
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setScannedPackages([])}
                        className="text-xs"
                      >
                        {language === "ku" ? "پاککردنەوە" : "Clear"}
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[300px]">
                      <div className="space-y-2">
                        {scannedPackages.map((pkg, index) => (
                          <div
                            key={`${pkg.id}-${index}`}
                            className={cn(
                              "flex items-center justify-between p-3 rounded-lg border transition-colors",
                              getPackageStatusColor(pkg.hasCompleteData)
                            )}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm font-medium">{pkg.trackingNumber}</span>
                                {!pkg.hasCompleteData && (
                                  <Badge variant="outline" className="text-xs bg-yellow-50 border-yellow-300">
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                    {language === "ku" ? "ناتەواو" : "Incomplete"}
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                <span className="font-medium">{pkg.customerCode}</span>
                                {pkg.weight && <span className="mx-2">•</span>}
                                {pkg.weight && <span>{pkg.weight}kg</span>}
                                {pkg.cbm && <span className="mx-2">•</span>}
                                {pkg.cbm && <span>{pkg.cbm}CBM</span>}
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {pkg.scannedAt.toLocaleTimeString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}
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
                        <span className="text-indigo-100">{language === "ku" ? "جۆر" : "Type"}</span>
                        <Badge className="bg-white/20 text-white border-white/30">
                          {selectedBatch.shippingType.includes("air") ? "هەوایی" : "دەریایی"}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-indigo-100">{language === "ku" ? "دۆخ" : "Status"}</span>
                        <span className="font-medium">{selectedBatch.status}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-indigo-100">{language === "ku" ? "ڕێگا" : "Route"}</span>
                        <span className="font-medium text-sm">
                          {(selectedBatch as any).originWarehouse?.name || "چین"} → {(selectedBatch as any).destinationWarehouse?.name || "هەولێر"}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {/* Session Stats */}
              <Card className="border-0 shadow-lg">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-indigo-600" />
                    {language === "ku" ? "ئاماری دانیشتن" : "Session Stats"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-indigo-600">{batchStats.totalPackages}</div>
                      <div className="text-xs text-muted-foreground">{language === "ku" ? "پاکەت" : "Packages"}</div>
                    </div>
                    <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-purple-600">{batchStats.totalWeight.toFixed(1)}</div>
                      <div className="text-xs text-muted-foreground">{language === "ku" ? "کیلۆ" : "KG"}</div>
                    </div>
                    <div className="bg-violet-50 dark:bg-violet-900/20 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-violet-600">{batchStats.totalCbm.toFixed(3)}</div>
                      <div className="text-xs text-muted-foreground">CBM</div>
                    </div>
                    <div className={cn(
                      "rounded-lg p-3 text-center",
                      batchStats.incompleteCount > 0 ? "bg-yellow-50 dark:bg-yellow-900/20" : "bg-green-50 dark:bg-green-900/20"
                    )}>
                      <div className={cn(
                        "text-2xl font-bold",
                        batchStats.incompleteCount > 0 ? "text-yellow-600" : "text-green-600"
                      )}>
                        {batchStats.incompleteCount}
                      </div>
                      <div className="text-xs text-muted-foreground">{language === "ku" ? "ناتەواو" : "Incomplete"}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Quick Actions */}
              <Card className="border-0 shadow-lg">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">{language === "ku" ? "کردارە خێراکان" : "Quick Actions"}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => setLocation("/quick-register")}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    {language === "ku" ? "تۆماری خێرا" : "Quick Register"}
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
        
        {/* Batch Change Dialog */}
        <Dialog open={batchChangeDialog.open} onOpenChange={(open) => !open && setBatchChangeDialog({ open: false, package: null, currentBatchNumber: "", newBatchId: 0 })}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                {language === "ku" ? "پاکەت لە باچی تردایە!" : "Package in another batch!"}
              </DialogTitle>
              <DialogDescription>
                {language === "ku" 
                  ? `ئەم پاکەتە لە باچی ${batchChangeDialog.currentBatchNumber} دایە. دەتەوێت بیگۆڕیت بۆ ${selectedBatch?.batchCode}؟`
                  : `This package is in batch ${batchChangeDialog.currentBatchNumber}. Do you want to move it to ${selectedBatch?.batchCode}?`}
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
                onClick={() => {
                  setBatchChangeDialog({ open: false, package: null, currentBatchNumber: "", newBatchId: 0 });
                  setTrackingNumber("");
                  inputRef.current?.focus();
                }}
              >
                {language === "ku" ? "نەخێر، وابمێنێتەوە" : "No, keep it"}
              </Button>
              <Button
                onClick={handleBatchChangeConfirm}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                {language === "ku" ? "بەڵێ، بیگۆڕە" : "Yes, move it"}
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
                {language === "ku" ? "زانیاری ناتەواو!" : "Incomplete Data!"}
              </DialogTitle>
              <DialogDescription>
                {language === "ku" 
                  ? "ئەم پاکەتە زانیاری کێش یان قەبارەی نییە. دەتەوێت چی بکەیت؟"
                  : "This package has no weight or dimensions. What would you like to do?"}
              </DialogDescription>
            </DialogHeader>
            
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200">
              <div className="font-mono text-lg">{incompleteDataDialog.trackingNumber}</div>
              <div className="text-sm text-yellow-700 dark:text-yellow-300 mt-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                {language === "ku" ? "کێش و قەبارە دیاری نەکراوە" : "Weight and dimensions not set"}
              </div>
            </div>
            
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIncompleteDataDialog({ open: false, package: null, trackingNumber: "" });
                  setTrackingNumber("");
                  inputRef.current?.focus();
                }}
              >
                {language === "ku" ? "پاشگەزبوونەوە" : "Cancel"}
              </Button>
              <Button
                variant="outline"
                onClick={handleGoToQuickRegister}
                className="border-indigo-300 text-indigo-600 hover:bg-indigo-50"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                {language === "ku" ? "بڕۆ بۆ تۆماری خێرا" : "Go to Quick Register"}
              </Button>
              <Button
                onClick={handleContinueWithIncomplete}
                className="bg-yellow-500 hover:bg-yellow-600"
              >
                {language === "ku" ? "بەردەوام بە (بەبێ زانیاری)" : "Continue anyway"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
