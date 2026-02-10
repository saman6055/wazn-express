import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { 
  Package, CheckCircle2, AlertTriangle, XCircle, 
  Scale, Volume2, VolumeX, Zap, Camera, Keyboard,
  User, Wallet, DollarSign, Home, Building2, Truck,
  FileText, Printer, PenTool, History, X, Info,
  Phone, MapPin, Clock, CreditCard, AlertCircle,
  HandCoins, Receipt, Send, Check, Loader2
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
interface DeliveredPackage {
  id: number;
  trackingNumber: string;
  customerCode: string;
  customerName: string;
  customerId: number;
  weight: number | null;
  cost: number | null;
  deliveryType: "home" | "warehouse" | "direct";
  deliveredAt: Date;
  signature?: string;
  notes?: string;
}

interface CustomerInfo {
  id: number;
  customerCode: string;
  fullName: string;
  mobileNumber: string;
  balance: number;
  totalPackages: number;
  pendingPackages: number;
}

// ==================== SIGNATURE PAD ====================
function SignaturePad({ 
  onSave, 
  onClear 
}: { 
  onSave: (signature: string) => void;
  onClear: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    setIsDrawing(true);
    setHasSignature(true);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    
    ctx.lineTo(x, y);
    ctx.strokeStyle = "#1f2937";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    onClear();
  };

  const save = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasSignature) return;
    const dataUrl = canvas.toDataURL("image/png");
    onSave(dataUrl);
  };

  return (
    <div className="space-y-3">
      <div className="border-2 border-dashed border-slate-300 rounded-lg bg-white">
        <canvas
          ref={canvasRef}
          width={400}
          height={150}
          className="w-full touch-none cursor-crosshair"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={clear} className="flex-1">
          <X className="h-4 w-4 mr-1" />
          پاککردنەوە
        </Button>
        <Button size="sm" onClick={save} disabled={!hasSignature} className="flex-1 bg-rose-600 hover:bg-rose-700">
          <Check className="h-4 w-4 mr-1" />
          پەسەندکردن
        </Button>
      </div>
    </div>
  );
}

// ==================== MAIN COMPONENT ====================
export default function CustomerDeliveryScanner() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  
  // Core state
  const [scanMode, setScanMode] = useState<"manual" | "camera">("manual");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  
  // Continuous mode
  const [continuousMode, setContinuousMode] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  // Current package being processed
  const [currentPackage, setCurrentPackage] = useState<any>(null);
  const [currentCustomer, setCurrentCustomer] = useState<CustomerInfo | null>(null);
  
  // Delivery options
  const [deliveryType, setDeliveryType] = useState<"home" | "warehouse" | "direct">("warehouse");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [signature, setSignature] = useState<string | null>(null);
  
  // Delivered packages
  const [deliveredPackages, setDeliveredPackages] = useState<DeliveredPackage[]>([]);
  
  // Dialogs
  const [balanceWarningDialog, setBalanceWarningDialog] = useState<{
    open: boolean;
    customer: CustomerInfo | null;
    packageCost: number;
  }>({ open: false, customer: null, packageCost: 0 });
  const [deliveryConfirmDialog, setDeliveryConfirmDialog] = useState(false);
  const [receiptDialog, setReceiptDialog] = useState<{
    open: boolean;
    package: DeliveredPackage | null;
  }>({ open: false, package: null });
  
  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  const lastScanTime = useRef<number>(0);
  
  // Mutations
  const updateStatusMutation = trpc.packages.updateStatus.useMutation();
  const trpcUtils = trpc.useUtils();
  
  // Stats
  const deliveryStats = useMemo(() => {
    const totalDelivered = deliveredPackages.length;
    const totalValue = deliveredPackages.reduce((sum, pkg) => sum + (pkg.cost || 0), 0);
    const byType = {
      home: deliveredPackages.filter(p => p.deliveryType === "home").length,
      warehouse: deliveredPackages.filter(p => p.deliveryType === "warehouse").length,
      direct: deliveredPackages.filter(p => p.deliveryType === "direct").length,
    };
    return { totalDelivered, totalValue, byType };
  }, [deliveredPackages]);
  
  // Update sound manager
  useEffect(() => {
    soundManager.setEnabled(soundEnabled);
  }, [soundEnabled]);
  
  // Focus input on mount
  useEffect(() => {
    if (scanMode === "manual") {
      inputRef.current?.focus();
    }
  }, [scanMode]);
  
  // Handle scan
  const handleScan = useCallback(async () => {
    if (!trackingNumber.trim()) return;
    
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
      
      // Check if already delivered
      if (pkg.status === "delivered") {
        soundManager.playDuplicate();
        toast.warning(
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            <div>
              <div className="font-medium">{language === "ku" ? "پێشتر گەیەندراوە!" : "Already delivered!"}</div>
              <div className="text-sm text-muted-foreground">{trackingNumber}</div>
            </div>
          </div>
        );
        setTrackingNumber("");
        inputRef.current?.focus();
        return;
      }
      
      // Check if already in this session
      if (deliveredPackages.some(p => p.id === pkg.id)) {
        soundManager.playDuplicate();
        toast.warning(
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            <div>
              <div className="font-medium">{language === "ku" ? "پێشتر لەم دانیشتنە گەیەندراوە!" : "Already delivered in this session!"}</div>
              <div className="text-sm text-muted-foreground">{trackingNumber}</div>
            </div>
          </div>
        );
        setTrackingNumber("");
        inputRef.current?.focus();
        return;
      }
      
      // Get customer balance info
      let customerInfo: CustomerInfo | null = null;
      if (customer) {
        try {
          const balanceResult = await trpcUtils.customers.getBalance.fetch({ customerId: customer.id });
          const balance = typeof balanceResult === 'number' ? balanceResult : (balanceResult as any)?.balance || 0;
          customerInfo = {
            id: customer.id,
            customerCode: customer.customerCode,
            fullName: customer.fullName,
            mobileNumber: customer.mobileNumber,
            balance: balance,
            totalPackages: 0,
            pendingPackages: 0,
          };
        } catch (e) {
          customerInfo = {
            id: customer.id,
            customerCode: customer.customerCode,
            fullName: customer.fullName,
            mobileNumber: customer.mobileNumber,
            balance: 0,
            totalPackages: 0,
            pendingPackages: 0,
          };
        }
      }
      
      const packageCost = (pkg as any).costUsd ? parseFloat((pkg as any).costUsd) : 0;
      
      // Check balance
      if (customerInfo && customerInfo.balance < packageCost) {
        soundManager.playWarning();
        setBalanceWarningDialog({
          open: true,
          customer: customerInfo,
          packageCost,
        });
      }
      
      // Set current package and customer
      setCurrentPackage(pkg);
      setCurrentCustomer(customerInfo);
      soundManager.playSuccess();
      
      toast.success(
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-500" />
          <div>
            <div className="font-medium">{language === "ku" ? "پاکەت دۆزرایەوە!" : "Package found!"}</div>
            <div className="text-sm text-muted-foreground">{customer?.customerCode} - {trackingNumber}</div>
          </div>
        </div>
      );
      
      setTrackingNumber("");
      
    } catch (error: any) {
      soundManager.playError();
      toast.error(error?.message || "Search failed");
    } finally {
      setIsSearching(false);
    }
  }, [trackingNumber, language, trpcUtils, deliveredPackages]);
  
  // Handle delivery confirmation
  const handleDeliveryConfirm = async () => {
    if (!currentPackage || !currentCustomer) return;
    
    try {
      // Call update status mutation to mark as delivered
      await updateStatusMutation.mutateAsync({
        id: currentPackage.id,
        status: "delivered",
        recipientSignature: signature || undefined,
        deliveryType: deliveryType === "home" ? "direct_delivery" : deliveryType === "warehouse" ? "warehouse_pickup" : "air_transit",
      });
      
      // Add to delivered list
      const deliveredPkg: DeliveredPackage = {
        id: currentPackage.id,
        trackingNumber: currentPackage.trackingNumber || "",
        customerCode: currentCustomer.customerCode,
        customerName: currentCustomer.fullName,
        customerId: currentCustomer.id,
        weight: currentPackage.weightKg ? parseFloat(currentPackage.weightKg) : null,
        cost: currentPackage.costUsd ? parseFloat(currentPackage.costUsd) : null,
        deliveryType,
        deliveredAt: new Date(),
        signature: signature || undefined,
        notes: deliveryNotes || undefined,
      };
      
      setDeliveredPackages(prev => [deliveredPkg, ...prev]);
      soundManager.playComplete();
      
      toast.success(
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-500" />
          <div>
            <div className="font-medium">{language === "ku" ? "گەیەندرا!" : "Delivered!"}</div>
            <div className="text-sm text-muted-foreground">{currentCustomer.customerCode}</div>
          </div>
        </div>
      );
      
      // Show receipt dialog
      setReceiptDialog({ open: true, package: deliveredPkg });
      
      // Reset state
      setCurrentPackage(null);
      setCurrentCustomer(null);
      setDeliveryType("warehouse");
      setDeliveryNotes("");
      setSignature(null);
      setDeliveryConfirmDialog(false);
      
      // Invalidate queries
      trpcUtils.packages.list.invalidate();
      trpcUtils.customers.getBalance.invalidate();
      
      // Focus input for next scan
      if (continuousMode) {
        inputRef.current?.focus();
      }
      
    } catch (error: any) {
      soundManager.playError();
      toast.error(error?.message || "Delivery failed");
    }
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
  
  // Cancel current package
  const handleCancel = () => {
    setCurrentPackage(null);
    setCurrentCustomer(null);
    setDeliveryType("warehouse");
    setDeliveryNotes("");
    setSignature(null);
    inputRef.current?.focus();
  };

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        {/* Professional Header */}
        <div className="bg-gradient-to-r from-rose-600 via-pink-600 to-fuchsia-600 text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yIDItNCAyLTRzLTItMi00LTJjMCAwIDAtMiAyLTJzNCAwIDQgMmMwIDAtMiAyLTIgNHMwIDQtMiA0Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
          <div className="container py-6 relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                  <HandCoins className="h-8 w-8" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold flex items-center gap-2">
                    {language === "ku" ? "گەیاندن بە کڕیار" : "Customer Delivery"}
                    {continuousMode && (
                      <Badge className="bg-white/20 text-white border-white/30 animate-pulse">
                        <Zap className="h-3 w-3 mr-1" />
                        {language === "ku" ? "بەردەوام" : "Continuous"}
                      </Badge>
                    )}
                  </h1>
                  <p className="text-rose-100 text-sm">
                    {language === "ku" ? "گەیاندنی پاکەت بە کڕیار و وەرگرتنی واژوو" : "Deliver packages to customers and collect signatures"}
                  </p>
                </div>
              </div>
              
              {/* Stats Overview */}
              <div className="hidden md:flex items-center gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold">{deliveryStats.totalDelivered}</div>
                  <div className="text-xs text-rose-200">{language === "ku" ? "گەیەندراو" : "Delivered"}</div>
                </div>
                <div className="w-px h-12 bg-white/20" />
                <div className="text-center">
                  <div className="text-2xl font-bold">${deliveryStats.totalValue.toFixed(0)}</div>
                  <div className="text-xs text-rose-200">{language === "ku" ? "کۆی بەها" : "Total Value"}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="container py-6">
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Main Area */}
            <div className="lg:col-span-2 space-y-6">
              {/* Scanner Input */}
              <Card className="border-0 shadow-lg overflow-hidden">
                <div className={cn(
                  "h-1 transition-all duration-300",
                  continuousMode ? "bg-gradient-to-r from-rose-500 via-pink-500 to-fuchsia-500 animate-pulse" : "bg-slate-200"
                )} />
                <CardContent className="p-6">
                  <div className="flex flex-wrap items-center gap-4 mb-4">
                    <div className="flex items-center gap-2">
                      <Switch
                        id="continuous"
                        checked={continuousMode}
                        onCheckedChange={setContinuousMode}
                        className="data-[state=checked]:bg-rose-500"
                      />
                      <Label htmlFor="continuous" className="text-sm cursor-pointer">
                        {language === "ku" ? "بەردەوام" : "Continuous"}
                      </Label>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSoundEnabled(!soundEnabled)}
                      className={cn(soundEnabled ? "text-rose-600" : "text-slate-400")}
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
                            disabled={!!currentPackage}
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
                          disabled={isSearching || !trackingNumber || !!currentPackage}
                          className="h-14 px-8 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700"
                        >
                          {isSearching ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : (
                            <>
                              <Package className="h-5 w-5 mr-2" />
                              {language === "ku" ? "گەڕان" : "Search"}
                            </>
                          )}
                        </Button>
                      </div>
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
              
              {/* Current Package Details */}
              {currentPackage && currentCustomer && (
                <Card className="border-0 shadow-lg border-l-4 border-l-rose-500">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5 text-rose-600" />
                        {language === "ku" ? "زانیاری پاکەت" : "Package Details"}
                      </CardTitle>
                      <Button variant="ghost" size="sm" onClick={handleCancel}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Package Info */}
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        <div className="text-sm text-muted-foreground mb-1">{language === "ku" ? "تراکینگ" : "Tracking"}</div>
                        <div className="font-mono text-lg font-bold">{currentPackage.trackingNumber}</div>
                      </div>
                      <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        <div className="text-sm text-muted-foreground mb-1">{language === "ku" ? "کێش" : "Weight"}</div>
                        <div className="font-bold text-lg">
                          {currentPackage.weightKg ? `${currentPackage.weightKg} kg` : "-"}
                        </div>
                      </div>
                    </div>
                    
                    {/* Customer Info */}
                    <div className="p-4 bg-gradient-to-r from-rose-50 to-pink-50 dark:from-rose-900/20 dark:to-pink-900/20 rounded-lg border border-rose-200">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-rose-100 dark:bg-rose-800 rounded-full">
                          <User className="h-5 w-5 text-rose-600" />
                        </div>
                        <div>
                          <div className="font-bold text-lg">{currentCustomer.fullName}</div>
                          <div className="text-sm text-muted-foreground">{currentCustomer.customerCode}</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mt-4">
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{currentCustomer.mobileNumber}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Wallet className="h-4 w-4 text-muted-foreground" />
                          <span className={cn(
                            "text-sm font-medium",
                            currentCustomer.balance < 0 ? "text-red-600" : "text-green-600"
                          )}>
                            ${currentCustomer.balance.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Cost Info */}
                    <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-5 w-5 text-amber-600" />
                          <span className="font-medium">{language === "ku" ? "تێچووی پاکەت" : "Package Cost"}</span>
                        </div>
                        <span className="text-2xl font-bold text-amber-700">
                          ${currentPackage.costUsd ? parseFloat(currentPackage.costUsd).toFixed(2) : "0.00"}
                        </span>
                      </div>
                    </div>
                    
                    {/* Delivery Type Selection */}
                    <div className="space-y-3">
                      <Label>{language === "ku" ? "جۆری گەیاندن" : "Delivery Type"}</Label>
                      <div className="grid grid-cols-3 gap-3">
                        <Button
                          variant={deliveryType === "warehouse" ? "default" : "outline"}
                          className={cn(
                            "h-20 flex-col gap-2",
                            deliveryType === "warehouse" && "bg-rose-600 hover:bg-rose-700"
                          )}
                          onClick={() => setDeliveryType("warehouse")}
                        >
                          <Building2 className="h-6 w-6" />
                          <span className="text-xs">{language === "ku" ? "کۆگا" : "Warehouse"}</span>
                        </Button>
                        <Button
                          variant={deliveryType === "home" ? "default" : "outline"}
                          className={cn(
                            "h-20 flex-col gap-2",
                            deliveryType === "home" && "bg-rose-600 hover:bg-rose-700"
                          )}
                          onClick={() => setDeliveryType("home")}
                        >
                          <Home className="h-6 w-6" />
                          <span className="text-xs">{language === "ku" ? "ماڵەوە" : "Home"}</span>
                        </Button>
                        <Button
                          variant={deliveryType === "direct" ? "default" : "outline"}
                          className={cn(
                            "h-20 flex-col gap-2",
                            deliveryType === "direct" && "bg-rose-600 hover:bg-rose-700"
                          )}
                          onClick={() => setDeliveryType("direct")}
                        >
                          <Truck className="h-6 w-6" />
                          <span className="text-xs">{language === "ku" ? "ڕاستەوخۆ" : "Direct"}</span>
                        </Button>
                      </div>
                    </div>
                    
                    {/* Signature */}
                    <div className="space-y-3">
                      <Label className="flex items-center gap-2">
                        <PenTool className="h-4 w-4" />
                        {language === "ku" ? "واژووی کڕیار" : "Customer Signature"}
                      </Label>
                      {signature ? (
                        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-green-700">
                              <CheckCircle2 className="h-5 w-5" />
                              <span className="font-medium">{language === "ku" ? "واژوو وەرگیرا" : "Signature captured"}</span>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => setSignature(null)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <SignaturePad 
                          onSave={setSignature} 
                          onClear={() => setSignature(null)} 
                        />
                      )}
                    </div>
                    
                    {/* Notes */}
                    <div className="space-y-3">
                      <Label>{language === "ku" ? "تێبینی" : "Notes"}</Label>
                      <Textarea
                        placeholder={language === "ku" ? "تێبینی ئارەزوومەندانە..." : "Optional notes..."}
                        value={deliveryNotes}
                        onChange={(e) => setDeliveryNotes(e.target.value)}
                        rows={2}
                      />
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-4">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={handleCancel}
                      >
                        <X className="h-4 w-4 mr-2" />
                        {language === "ku" ? "هەڵوەشاندنەوە" : "Cancel"}
                      </Button>
                      <Button
                        className="flex-1 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700"
                        onClick={() => setDeliveryConfirmDialog(true)}
                        disabled={updateStatusMutation.isPending}
                      >
                        {updateStatusMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4 mr-2" />
                        )}
                        {language === "ku" ? "گەیاندن" : "Deliver"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {/* Delivered Packages History */}
              <Card className="border-0 shadow-lg">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <History className="h-5 w-5 text-rose-600" />
                    {language === "ku" ? "مێژووی گەیاندن" : "Delivery History"}
                    <Badge variant="secondary">{deliveredPackages.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    {deliveredPackages.length > 0 ? (
                      <div className="space-y-2">
                        {deliveredPackages.map((pkg, index) => (
                          <div
                            key={`${pkg.id}-${index}`}
                            className="flex items-center justify-between p-3 rounded-lg border bg-green-50 dark:bg-green-900/20 border-green-200"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm font-medium">{pkg.trackingNumber}</span>
                                <Badge variant="outline" className="text-xs">
                                  {pkg.deliveryType === "home" ? "ماڵەوە" : pkg.deliveryType === "warehouse" ? "کۆگا" : "ڕاستەوخۆ"}
                                </Badge>
                                {pkg.signature && (
                                  <Badge className="text-xs bg-green-100 text-green-700">
                                    <PenTool className="h-3 w-3 mr-1" />
                                    واژوو
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                <span className="font-medium">{pkg.customerCode}</span>
                                <span className="mx-2">•</span>
                                <span>${pkg.cost?.toFixed(2) || "0.00"}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">
                                {pkg.deliveredAt.toLocaleTimeString()}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setReceiptDialog({ open: true, package: pkg })}
                              >
                                <Receipt className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>{language === "ku" ? "هیچ پاکەتێک گەیەندرانەوە" : "No packages delivered yet"}</p>
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
            
            {/* Sidebar - Stats */}
            <div className="space-y-6">
              {/* Delivery Stats */}
              <Card className="border-0 shadow-lg bg-gradient-to-br from-rose-500 to-pink-600 text-white">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-white">
                    <HandCoins className="h-5 w-5" />
                    {language === "ku" ? "ئاماری گەیاندن" : "Delivery Stats"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/20 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold">{deliveryStats.totalDelivered}</div>
                      <div className="text-xs text-white/80">{language === "ku" ? "گەیەندراو" : "Delivered"}</div>
                    </div>
                    <div className="bg-white/20 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold">${deliveryStats.totalValue.toFixed(0)}</div>
                      <div className="text-xs text-white/80">{language === "ku" ? "کۆی بەها" : "Total Value"}</div>
                    </div>
                  </div>
                  
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-white/80 flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {language === "ku" ? "کۆگا" : "Warehouse"}
                      </span>
                      <span className="font-medium">{deliveryStats.byType.warehouse}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-white/80 flex items-center gap-1">
                        <Home className="h-3 w-3" />
                        {language === "ku" ? "ماڵەوە" : "Home"}
                      </span>
                      <span className="font-medium">{deliveryStats.byType.home}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-white/80 flex items-center gap-1">
                        <Truck className="h-3 w-3" />
                        {language === "ku" ? "ڕاستەوخۆ" : "Direct"}
                      </span>
                      <span className="font-medium">{deliveryStats.byType.direct}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Quick Tips */}
              <Card className="border-0 shadow-lg">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Info className="h-4 w-4 text-rose-600" />
                    {language === "ku" ? "ڕێنمایی" : "Tips"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-2">
                  <p>• {language === "ku" ? "پاکەت سکان بکە بۆ دەستپێکردن" : "Scan package to start"}</p>
                  <p>• {language === "ku" ? "واژووی کڕیار وەربگرە" : "Collect customer signature"}</p>
                  <p>• {language === "ku" ? "جۆری گەیاندن دیاری بکە" : "Select delivery type"}</p>
                  <p>• {language === "ku" ? "پسووڵە چاپ بکە" : "Print receipt"}</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
        
        {/* Balance Warning Dialog */}
        <Dialog open={balanceWarningDialog.open} onOpenChange={(open) => !open && setBalanceWarningDialog({ open: false, customer: null, packageCost: 0 })}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="h-5 w-5" />
                {language === "ku" ? "ئاگاداری باڵانس!" : "Balance Warning!"}
              </DialogTitle>
              <DialogDescription>
                {language === "ku" 
                  ? "باڵانسی کڕیار کەمتر لە تێچووی پاکەتەکەیە"
                  : "Customer balance is less than package cost"}
              </DialogDescription>
            </DialogHeader>
            
            {balanceWarningDialog.customer && (
              <div className="space-y-4">
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200">
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-muted-foreground">{language === "ku" ? "کڕیار" : "Customer"}</span>
                    <span className="font-medium">{balanceWarningDialog.customer.customerCode}</span>
                  </div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-muted-foreground">{language === "ku" ? "باڵانس" : "Balance"}</span>
                    <span className={cn(
                      "font-medium",
                      balanceWarningDialog.customer.balance < 0 ? "text-red-600" : "text-green-600"
                    )}>
                      ${balanceWarningDialog.customer.balance.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">{language === "ku" ? "تێچووی پاکەت" : "Package Cost"}</span>
                    <span className="font-medium text-amber-700">${balanceWarningDialog.packageCost.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setBalanceWarningDialog({ open: false, customer: null, packageCost: 0 })}>
                {language === "ku" ? "تێگەیشتم" : "Understood"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* Delivery Confirmation Dialog */}
        <Dialog open={deliveryConfirmDialog} onOpenChange={setDeliveryConfirmDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Send className="h-5 w-5 text-rose-600" />
                {language === "ku" ? "دڵنیاکردنەوەی گەیاندن" : "Confirm Delivery"}
              </DialogTitle>
              <DialogDescription>
                {language === "ku" 
                  ? "دڵنیای لە گەیاندنی ئەم پاکەتە؟"
                  : "Are you sure you want to deliver this package?"}
              </DialogDescription>
            </DialogHeader>
            
            {currentPackage && currentCustomer && (
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-muted-foreground">{language === "ku" ? "تراکینگ" : "Tracking"}</span>
                    <span className="font-mono font-medium">{currentPackage.trackingNumber}</span>
                  </div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-muted-foreground">{language === "ku" ? "کڕیار" : "Customer"}</span>
                    <span className="font-medium">{currentCustomer.customerCode}</span>
                  </div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-muted-foreground">{language === "ku" ? "جۆری گەیاندن" : "Delivery Type"}</span>
                    <span className="font-medium">
                      {deliveryType === "home" ? "ماڵەوە" : deliveryType === "warehouse" ? "کۆگا" : "ڕاستەوخۆ"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">{language === "ku" ? "واژوو" : "Signature"}</span>
                    <span className={cn("font-medium", signature ? "text-green-600" : "text-amber-600")}>
                      {signature ? "✓ هەیە" : "✗ نییە"}
                    </span>
                  </div>
                </div>
              </div>
            )}
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeliveryConfirmDialog(false)}>
                {language === "ku" ? "پاشگەزبوونەوە" : "Cancel"}
              </Button>
              <Button
                onClick={handleDeliveryConfirm}
                disabled={updateStatusMutation.isPending}
                className="bg-rose-600 hover:bg-rose-700"
              >
                {updateStatusMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                {language === "ku" ? "دڵنیاکردنەوە" : "Confirm"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* Receipt Dialog */}
        <Dialog open={receiptDialog.open} onOpenChange={(open) => !open && setReceiptDialog({ open: false, package: null })}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-rose-600" />
                {language === "ku" ? "پسووڵەی گەیاندن" : "Delivery Receipt"}
              </DialogTitle>
            </DialogHeader>
            
            {receiptDialog.package && (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-slate-200 rounded-lg p-4">
                  <div className="text-center mb-4">
                    <h3 className="font-bold text-lg">Wazn Express</h3>
                    <p className="text-sm text-muted-foreground">{language === "ku" ? "پسووڵەی گەیاندن" : "Delivery Receipt"}</p>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{language === "ku" ? "تراکینگ" : "Tracking"}:</span>
                      <span className="font-mono font-medium">{receiptDialog.package.trackingNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{language === "ku" ? "کڕیار" : "Customer"}:</span>
                      <span className="font-medium">{receiptDialog.package.customerCode}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{language === "ku" ? "ناو" : "Name"}:</span>
                      <span className="font-medium">{receiptDialog.package.customerName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{language === "ku" ? "کێش" : "Weight"}:</span>
                      <span className="font-medium">{receiptDialog.package.weight ? `${receiptDialog.package.weight} kg` : "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{language === "ku" ? "تێچوو" : "Cost"}:</span>
                      <span className="font-bold text-lg">${receiptDialog.package.cost?.toFixed(2) || "0.00"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{language === "ku" ? "جۆر" : "Type"}:</span>
                      <span className="font-medium">
                        {receiptDialog.package.deliveryType === "home" ? "ماڵەوە" : receiptDialog.package.deliveryType === "warehouse" ? "کۆگا" : "ڕاستەوخۆ"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{language === "ku" ? "کات" : "Time"}:</span>
                      <span className="font-medium">{receiptDialog.package.deliveredAt.toLocaleString()}</span>
                    </div>
                  </div>
                  
                  {receiptDialog.package.signature && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-xs text-muted-foreground mb-2">{language === "ku" ? "واژووی کڕیار" : "Customer Signature"}:</p>
                      <img src={receiptDialog.package.signature} alt="Signature" className="h-16 mx-auto" />
                    </div>
                  )}
                  
                  <div className="mt-4 pt-4 border-t text-center text-xs text-muted-foreground">
                    <p>{language === "ku" ? "سوپاس بۆ متمانەکەتان" : "Thank you for your trust"}</p>
                  </div>
                </div>
              </div>
            )}
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setReceiptDialog({ open: false, package: null })}>
                {language === "ku" ? "داخستن" : "Close"}
              </Button>
              <Button className="bg-rose-600 hover:bg-rose-700">
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
