import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { trpc } from "@/lib/trpc";
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { toast } from "sonner";
import {
  Package, Plane, Ship, Search, User, Loader2, CheckCircle2, Plus, Trash2,
  Layers, Calculator, AlertTriangle, Tags, ChevronDown, ChevronUp,
  Scale, Ruler, Box, Settings2, ArrowRightLeft, Info, Zap, ShoppingBag
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/contexts/LanguageContext";

interface TrackingLookupResult {
  found: boolean;
  type: 'regular' | 'full_package' | 'commission' | 'duplicate';
  orderId?: number;
  orderCode?: string;
  productName?: string;
  status?: string;
  customerId?: number;
  customerCode?: string;
  customerName?: string;
  existingPackageCode?: string;
}

interface PackageRow {
  id: string;
  trackingNumber: string;
  weightKg: string;
  lengthCm: string;
  widthCm: string;
  heightCm: string;
  trackingLookup?: TrackingLookupResult | null;
  isLookingUp?: boolean;
}

const createEmptyRow = (): PackageRow => ({
  id: crypto.randomUUID(),
  trackingNumber: "",
  weightKg: "",
  lengthCm: "",
  widthCm: "",
  heightCm: "",
  trackingLookup: null,
  isLookingUp: false,
});

// Package type badge component
function PackageTypeBadge({ lookup }: { lookup: TrackingLookupResult | null | undefined }) {
  if (!lookup || !lookup.found) {
    return (
      <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal bg-slate-50 dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700">
        📋 ئاسایی
      </Badge>
    );
  }
  
  if (lookup.type === 'duplicate') {
    return (
      <Badge variant="destructive" className="text-[10px] px-1.5 py-0 font-normal">
        ⚠️ دووبارە ({lookup.existingPackageCode})
      </Badge>
    );
  }
  
  if (lookup.type === 'commission') {
    return (
      <Badge className="text-[10px] px-1.5 py-0 font-normal bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border-amber-300">
        💰 کڕین بە عمولە
      </Badge>
    );
  }
  
  if (lookup.type === 'full_package') {
    return (
      <Badge className="text-[10px] px-1.5 py-0 font-normal bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 border-purple-300">
        📦 فول پاکێج
      </Badge>
    );
  }
  
  return null;
}

export default function BulkRegister() {
  const { t } = useTranslation();
  
  // Form state
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [shippingType, setShippingType] = useState<"air_regular" | "air_irregular" | "sea">("air_regular");
  const [batchId, setBatchId] = useState<string>("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [packages, setPackages] = useState<PackageRow[]>([createEmptyRow(), createEmptyRow(), createEmptyRow()]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registeredCount, setRegisteredCount] = useState(0);
  const [isUnclaimed, setIsUnclaimed] = useState(false);
  const [categoryId, setCategoryId] = useState<string>("");
  const [showOptional, setShowOptional] = useState(false);
  const [showCbmSettings, setShowCbmSettings] = useState(false);
  const [newDivisor, setNewDivisor] = useState("");
  
  // Refs for tracking lookup debounce
  const lookupTimers = useRef<Record<string, NodeJS.Timeout>>({});
  
  // Queries
  const { data: customers } = trpc.customers.list.useQuery();
  const { data: batches } = trpc.batches.list.useQuery();
  const { data: warehouses } = trpc.warehouses.list.useQuery();
  const { data: categories } = trpc.productCategories.list.useQuery();
  const { data: cbmDivisorData } = trpc.packages.getCbmDivisor.useQuery();
  
  const cbmDivisor = cbmDivisorData?.divisor || 6000;
  const defaultWarehouse = warehouses?.[0];
  
  // Mutations
  const registerMutation = trpc.packages.register.useMutation();
  const setCbmDivisorMutation = trpc.packages.setCbmDivisor.useMutation();
  const utils = trpc.useUtils();
  
  // Filter batches by shipping type
  const filteredBatches = useMemo(() => {
    if (!batches) return [];
    return batches.filter(b => {
      const batchType = b.shippingType as string;
      if (shippingType === "air_regular" || shippingType === "air_irregular") {
        return batchType === "air" || batchType.startsWith("air");
      }
      return batchType === "sea";
    }).filter(b => b.status === "preparing" || b.status === "in_transit");
  }, [batches, shippingType]);
  
  // Filter customers by search
  const filteredCustomers = useMemo(() => {
    if (!customers || !customerSearch) return [];
    const search = customerSearch.toLowerCase();
    return customers.filter(c => 
      c.customerCode?.toLowerCase().includes(search) ||
      c.fullName?.toLowerCase().includes(search) ||
      c.mobileNumber?.includes(search)
    ).slice(0, 10);
  }, [customers, customerSearch]);
  
  // Get selected batch for pricing
  const selectedBatch = batches?.find(b => b.id === parseInt(batchId));
  
  // Calculate chargeable weight for a package (max of actual vs volumetric)
  const getChargeableWeight = useCallback((pkg: PackageRow) => {
    const actualKg = parseFloat(pkg.weightKg) || 0;
    const l = parseFloat(pkg.lengthCm) || 0;
    const w = parseFloat(pkg.widthCm) || 0;
    const h = parseFloat(pkg.heightCm) || 0;
    const volumetricKg = (l * w * h) / cbmDivisor;
    return Math.max(actualKg, volumetricKg);
  }, [cbmDivisor]);
  
  // Calculate totals with chargeable weight
  const totals = useMemo(() => {
    let totalActualWeight = 0;
    let totalVolumetricWeight = 0;
    let totalChargeableWeight = 0;
    let totalCbm = 0;
    let totalCost = 0;
    let validPackages = 0;
    
    packages.forEach(pkg => {
      const hasData = pkg.weightKg || pkg.trackingNumber;
      if (!hasData) return;
      
      const actualKg = parseFloat(pkg.weightKg) || 0;
      const l = parseFloat(pkg.lengthCm) || 0;
      const w = parseFloat(pkg.widthCm) || 0;
      const h = parseFloat(pkg.heightCm) || 0;
      const volumetricKg = (l > 0 && w > 0 && h > 0) ? (l * w * h) / cbmDivisor : 0;
      const chargeableKg = Math.max(actualKg, volumetricKg);
      const cbm = (l > 0 && w > 0 && h > 0) ? (l * w * h) / 1000000 : 0;
      
      totalActualWeight += actualKg;
      totalVolumetricWeight += volumetricKg;
      totalChargeableWeight += chargeableKg;
      totalCbm += cbm;
      
      if (actualKg > 0 || pkg.trackingNumber) validPackages++;
    });
    
    if (selectedBatch) {
      if ((shippingType === "air_regular" || shippingType === "air_irregular") && selectedBatch.pricePerKg) {
        totalCost = totalChargeableWeight * parseFloat(selectedBatch.pricePerKg);
      } else if (shippingType === "sea" && selectedBatch.pricePerCbm) {
        totalCost = totalCbm * parseFloat(selectedBatch.pricePerCbm);
      }
    }
    
    return { totalActualWeight, totalVolumetricWeight, totalChargeableWeight, totalCbm, totalCost, validPackages };
  }, [packages, selectedBatch, shippingType, cbmDivisor]);
  
  // Tracking number lookup with debounce
  const lookupTracking = useCallback(async (pkgId: string, trackingNumber: string) => {
    if (!trackingNumber || trackingNumber.length < 2) {
      setPackages(prev => prev.map(p => 
        p.id === pkgId ? { ...p, trackingLookup: null, isLookingUp: false } : p
      ));
      return;
    }
    
    setPackages(prev => prev.map(p => 
      p.id === pkgId ? { ...p, isLookingUp: true } : p
    ));
    
    try {
      const result = await utils.packages.lookupTracking.fetch({ trackingNumber });
      setPackages(prev => prev.map(p => 
        p.id === pkgId ? { ...p, trackingLookup: result as TrackingLookupResult, isLookingUp: false } : p
      ));
      
      // Auto-set customer if found from order
      if (result.found && result.customerId && !customerId && !isUnclaimed) {
        setCustomerId(result.customerId);
        const customer = customers?.find(c => c.id === result.customerId);
        if (customer) {
          setCustomerSearch(customer.customerCode || customer.fullName || "");
        }
      }
    } catch {
      setPackages(prev => prev.map(p => 
        p.id === pkgId ? { ...p, trackingLookup: null, isLookingUp: false } : p
      ));
    }
  }, [utils, customerId, isUnclaimed, customers]);
  
  const selectCustomer = (customer: NonNullable<typeof customers>[0]) => {
    setCustomerId(customer.id);
    setCustomerSearch(customer.customerCode || customer.fullName || "");
    setShowCustomerDropdown(false);
  };
  
  const updatePackage = (id: string, field: keyof PackageRow, value: string) => {
    setPackages(prev => prev.map(pkg => 
      pkg.id === id ? { ...pkg, [field]: value } : pkg
    ));
    
    // Debounced tracking lookup
    if (field === 'trackingNumber') {
      if (lookupTimers.current[id]) {
        clearTimeout(lookupTimers.current[id]);
      }
      lookupTimers.current[id] = setTimeout(() => {
        lookupTracking(id, value);
      }, 800); // 800ms delay for tracking lookup
    }
  };
  
  const addRow = () => {
    setPackages(prev => [...prev, createEmptyRow()]);
  };
  
  const removeRow = (id: string) => {
    if (packages.length > 1) {
      setPackages(prev => prev.filter(pkg => pkg.id !== id));
      if (lookupTimers.current[id]) {
        clearTimeout(lookupTimers.current[id]);
        delete lookupTimers.current[id];
      }
    }
  };
  
  const handleSaveCbmDivisor = async () => {
    const val = parseInt(newDivisor);
    if (!val || val < 1) {
      toast.error("ژمارەیەکی دروست بنووسە");
      return;
    }
    try {
      await setCbmDivisorMutation.mutateAsync({ divisor: val });
      utils.packages.getCbmDivisor.invalidate();
      toast.success(`CBM divisor گۆڕدرا بۆ ${val}`);
      setShowCbmSettings(false);
    } catch {
      toast.error("هەڵە لە گۆڕینی CBM divisor");
    }
  };
  
  const handleSubmit = async () => {
    if (!defaultWarehouse) {
      toast.error("هیچ کۆگایەک ڕێکنەخراوە");
      return;
    }
    
    if (!isUnclaimed && !customerId) {
      toast.error("تکایە کڕیارێک هەڵبژێرە یان وەک بێ خاوەن دیاری بکە");
      return;
    }
    
    // Check for duplicates
    const hasDuplicates = packages.some(p => p.trackingLookup?.type === 'duplicate');
    if (hasDuplicates) {
      toast.error("تراکینگ نەمبەری دووبارە هەیە، تکایە چاکی بکەرەوە");
      return;
    }
    
    const validPackages = packages.filter(pkg => pkg.weightKg || pkg.trackingNumber);
    if (validPackages.length === 0) {
      toast.error("تکایە لانیکەم یەک پاکەت زیاد بکە");
      return;
    }
    
    setIsSubmitting(true);
    setRegisteredCount(0);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const pkg of validPackages) {
      try {
        // Determine customer from tracking lookup or manual selection
        const effectiveCustomerId = pkg.trackingLookup?.found && pkg.trackingLookup.customerId
          ? pkg.trackingLookup.customerId
          : (isUnclaimed ? undefined : customerId!);
        
        await registerMutation.mutateAsync({
          customerId: effectiveCustomerId,
          isUnclaimed: !effectiveCustomerId ? true : isUnclaimed,
          originWarehouseId: defaultWarehouse.id,
          trackingNumber: pkg.trackingNumber || undefined,
          shippingType,
          weightKg: pkg.weightKg || undefined,
          lengthCm: pkg.lengthCm || undefined,
          widthCm: pkg.widthCm || undefined,
          heightCm: pkg.heightCm || undefined,
          batchId: batchId && batchId !== "none" ? parseInt(batchId) : undefined,
          categoryId: categoryId && categoryId !== "none" ? parseInt(categoryId) : undefined,
          fullPackageOrderId: pkg.trackingLookup?.found ? pkg.trackingLookup.orderId : undefined,
        });
        successCount++;
        setRegisteredCount(successCount);
      } catch (error: any) {
        errorCount++;
        toast.error(`هەڵە لە تۆمارکردنی پاکەت: ${error.message}`);
      }
    }
    
    setIsSubmitting(false);
    
    if (successCount > 0) {
      toast.success(`${successCount} پاکەت بە سەرکەوتوویی تۆمار کرا!`);
      // Reset packages but keep customer and settings
      setPackages([createEmptyRow(), createEmptyRow(), createEmptyRow()]);
      setRegisteredCount(0);
    }
  };

  // Cleanup timers
  useEffect(() => {
    return () => {
      Object.values(lookupTimers.current).forEach(clearTimeout);
    };
  }, []);

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
                <Layers className="h-5 w-5" />
              </div>
              {t('packages.bulkRegister')}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t('packages.bulkRegisterDesc')}
            </p>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    setNewDivisor(cbmDivisor.toString());
                    setShowCbmSettings(true);
                  }}
                >
                  <Settings2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>ڕێکخستنی CBM Divisor (ئێستا: {cbmDivisor})</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Settings Panel - Left Side */}
          <div className="lg:col-span-1 space-y-3">
            {/* Customer Selection */}
            <Card className="border-2 border-dashed border-primary/20">
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <User className="h-3.5 w-3.5 text-primary" />
                  {t('packages.customer')}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder={t('packages.searchCustomer')}
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setShowCustomerDropdown(true);
                      if (e.target.value === "") setCustomerId(null);
                    }}
                    onFocus={() => setShowCustomerDropdown(true)}
                    className="pl-8 h-8 text-sm"
                    disabled={isUnclaimed}
                  />
                  {showCustomerDropdown && filteredCustomers.length > 0 && !isUnclaimed && (
                    <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-auto">
                      {filteredCustomers.map((customer) => (
                        <button
                          key={customer.id}
                          type="button"
                          className="w-full px-2.5 py-1.5 text-left hover:bg-accent transition-colors"
                          onClick={() => selectCustomer(customer)}
                        >
                          <div className="font-medium text-xs">{customer.customerCode}</div>
                          <div className="text-[10px] text-muted-foreground">{customer.fullName}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                
                <Button
                  type="button"
                  variant={isUnclaimed ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setIsUnclaimed(!isUnclaimed);
                    if (!isUnclaimed) {
                      setCustomerId(null);
                      setCustomerSearch("");
                    }
                  }}
                  className="w-full mt-2 h-7 text-xs"
                >
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {isUnclaimed ? t('packages.unclaimed') : t('packages.unclaimed')}
                </Button>
                
                {customerId && !isUnclaimed && (
                  <div className="mt-2 flex items-center gap-1.5 p-1.5 bg-green-50 dark:bg-green-950 rounded-md">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                    <span className="text-[11px] text-green-700 dark:text-green-400 font-medium truncate">
                      {customers?.find(c => c.id === customerId)?.customerCode} - {customers?.find(c => c.id === customerId)?.fullName}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Shipping Type */}
            <Card>
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Package className="h-3.5 w-3.5 text-primary" />
                  {t('packages.shippingType')}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3 space-y-2">
                <div className="grid grid-cols-1 gap-1.5">
                  {[
                    { value: "air_regular", label: t('packages.airRegular'), icon: Plane, color: "text-blue-500" },
                    { value: "air_irregular", label: t('packages.airIrregular'), icon: Plane, color: "text-orange-500" },
                    { value: "sea", label: t('packages.sea'), icon: Ship, color: "text-cyan-600" },
                  ].map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => {
                        setShippingType(type.value as any);
                        setBatchId("");
                      }}
                      className={cn(
                        "p-2 rounded-lg border transition-all flex items-center gap-2",
                        shippingType === type.value
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-transparent bg-muted/40 hover:bg-muted/70"
                      )}
                    >
                      <type.icon className={cn("h-3.5 w-3.5", type.color)} />
                      <span className="text-xs font-medium">{type.label}</span>
                    </button>
                  ))}
                </div>
                
                <div>
                  <Label className="text-[10px] text-muted-foreground">{t('packages.batch')}</Label>
                  <Select value={batchId} onValueChange={setBatchId}>
                    <SelectTrigger className="mt-0.5 h-8 text-xs">
                      <SelectValue placeholder={t('packages.selectBatch')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('packages.noBatch')}</SelectItem>
                      {filteredBatches.map((batch) => (
                        <SelectItem key={batch.id} value={batch.id.toString()}>
                          {batch.batchCode}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Optional Fields */}
                <button
                  type="button"
                  onClick={() => setShowOptional(!showOptional)}
                  className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showOptional ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  {showOptional ? t('packages.hideOptions') : t('packages.showOptions')}
                </button>
                
                {showOptional && (
                  <div>
                    <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Tags className="h-3 w-3" />
                      {t('packages.productCategory')}
                    </Label>
                    <Select value={categoryId} onValueChange={setCategoryId}>
                      <SelectTrigger className="mt-0.5 h-8 text-xs">
                        <SelectValue placeholder={t('packages.selectCategory')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t('packages.noCategory')}</SelectItem>
                        {categories?.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id.toString()}>
                            {cat.icon} {cat.nameEn}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Summary Card */}
            <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Calculator className="h-3.5 w-3.5 text-primary" />
                  {t('packages.summary')}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3 space-y-1.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">{t('packages.title')}</span>
                  <span className="font-bold text-sm">{totals.validPackages}</span>
                </div>
                <div className="h-px bg-border/50" />
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Scale className="h-3 w-3" /> {t('packages.actualWeight')}
                  </span>
                  <span className="font-medium">{totals.totalActualWeight.toFixed(2)} kg</span>
                </div>
                {totals.totalVolumetricWeight > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Box className="h-3 w-3" /> {t('packages.volumetricWeight')}
                    </span>
                    <span className="font-medium">{totals.totalVolumetricWeight.toFixed(2)} kg</span>
                  </div>
                )}
                <div className="flex justify-between items-center bg-primary/10 rounded-md p-1.5 -mx-1.5">
                  <span className="text-primary font-medium flex items-center gap-1">
                    <ArrowRightLeft className="h-3 w-3" /> {t('packages.chargeableWeight')}
                  </span>
                  <span className="font-bold text-primary">{totals.totalChargeableWeight.toFixed(2)} kg</span>
                </div>
                {totals.totalCbm > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Ruler className="h-3 w-3" /> CBM
                    </span>
                    <span className="font-medium">{totals.totalCbm.toFixed(4)} m³</span>
                  </div>
                )}
                {totals.totalCost > 0 && (
                  <>
                    <div className="h-px bg-border/50" />
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">{t('packages.estimatedPrice')}</span>
                      <span className="text-base font-bold text-green-600">${totals.totalCost.toFixed(2)}</span>
                    </div>
                  </>
                )}
                
                {/* CBM Formula Info */}
                <div className="mt-2 p-1.5 bg-muted/50 rounded-md">
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Info className="h-3 w-3 shrink-0" />
                    <span>کێشی ئەقدی = (L×W×H) ÷ {cbmDivisor}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    کێشی حسابکراو = max(ڕاستەقینە, ئەقدی)
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Packages Table - Right Side */}
          <div className="lg:col-span-4">
            <Card>
              <CardHeader className="pb-2 pt-3 px-4 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm">{t('packages.title')}</CardTitle>
                  <Badge variant="secondary" className="text-[10px]">{packages.length} {t('packages.row')}</Badge>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addRow} className="h-7 text-xs">
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  {t('packages.addRow')}
                </Button>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <div className="border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/50 border-b">
                          <th className="w-[35px] px-2 py-2 text-center text-[10px] font-medium text-muted-foreground">#</th>
                          <th className="min-w-[180px] px-2 py-2 text-right text-[10px] font-medium text-muted-foreground">
                            {t('packages.trackingNumber')}
                          </th>
                          <th className="w-[70px] px-2 py-2 text-center text-[10px] font-medium text-muted-foreground">
                            {t('packages.type')}
                          </th>
                          <th className="w-[90px] px-2 py-2 text-center text-[10px] font-medium text-muted-foreground">
                            <span className="flex items-center justify-center gap-1">
                              <Scale className="h-3 w-3" /> {t('packages.weight')} (kg)
                            </span>
                          </th>
                          <th className="w-[70px] px-2 py-2 text-center text-[10px] font-medium text-muted-foreground">
                            L (cm)
                          </th>
                          <th className="w-[70px] px-2 py-2 text-center text-[10px] font-medium text-muted-foreground">
                            W (cm)
                          </th>
                          <th className="w-[70px] px-2 py-2 text-center text-[10px] font-medium text-muted-foreground">
                            H (cm)
                          </th>
                          <th className="w-[85px] px-2 py-2 text-center text-[10px] font-medium text-muted-foreground">
                            <span className="flex items-center justify-center gap-1">
                              <Zap className="h-3 w-3" /> {t('packages.chargeableWeight')}
                            </span>
                          </th>
                          <th className="w-[35px] px-2 py-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {packages.map((pkg, index) => {
                          const actualKg = parseFloat(pkg.weightKg) || 0;
                          const l = parseFloat(pkg.lengthCm) || 0;
                          const w = parseFloat(pkg.widthCm) || 0;
                          const h = parseFloat(pkg.heightCm) || 0;
                          const volumetricKg = (l > 0 && w > 0 && h > 0) ? (l * w * h) / cbmDivisor : 0;
                          const chargeableKg = Math.max(actualKg, volumetricKg);
                          const isVolumetricHigher = volumetricKg > actualKg && volumetricKg > 0;
                          const isDuplicate = pkg.trackingLookup?.type === 'duplicate';
                          
                          return (
                            <tr key={pkg.id} className={cn(
                              "border-b last:border-b-0 transition-colors",
                              isDuplicate && "bg-red-50 dark:bg-red-950/30",
                              pkg.trackingLookup?.found && pkg.trackingLookup.type === 'commission' && "bg-amber-50/50 dark:bg-amber-950/20",
                              pkg.trackingLookup?.found && pkg.trackingLookup.type === 'full_package' && "bg-purple-50/50 dark:bg-purple-950/20",
                            )}>
                              <td className="px-2 py-1.5 text-center text-xs text-muted-foreground font-mono">
                                {index + 1}
                              </td>
                              <td className="px-2 py-1.5">
                                <div className="relative">
                                  <Input
                                    placeholder={t('packages.trackingPlaceholder')}
                                    value={pkg.trackingNumber}
                                    onChange={(e) => updatePackage(pkg.id, "trackingNumber", e.target.value)}
                                    className={cn(
                                      "h-7 text-xs",
                                      isDuplicate && "border-red-400 focus-visible:ring-red-400",
                                      pkg.trackingLookup?.found && "border-green-400 focus-visible:ring-green-400"
                                    )}
                                  />
                                  {pkg.isLookingUp && (
                                    <Loader2 className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 animate-spin text-muted-foreground" />
                                  )}
                                </div>
                                {/* Show tracking info below */}
                                {pkg.trackingLookup?.found && (
                                  <div className="mt-0.5 text-[10px] text-muted-foreground flex items-center gap-1">
                                    <ShoppingBag className="h-3 w-3" />
                                    <span className="truncate">{pkg.trackingLookup.productName}</span>
                                    <span className="text-primary font-medium">({pkg.trackingLookup.customerCode})</span>
                                  </div>
                                )}
                                {isDuplicate && (
                                  <div className="mt-0.5 text-[10px] text-red-600 font-medium">
                                    ⚠️ ئەم تراکینگە پێشتر تۆمار کراوە ({pkg.trackingLookup?.existingPackageCode})
                                  </div>
                                )}
                              </td>
                              <td className="px-2 py-1.5 text-center">
                                <PackageTypeBadge lookup={pkg.trackingLookup} />
                              </td>
                              <td className="px-2 py-1.5">
                                <Input
                                  type="number"
                                  step="0.001"
                                  placeholder="0.000"
                                  value={pkg.weightKg}
                                  onChange={(e) => updatePackage(pkg.id, "weightKg", e.target.value)}
                                  className="h-7 text-xs text-center"
                                />
                              </td>
                              <td className="px-2 py-1.5">
                                <Input
                                  type="number"
                                  placeholder="0"
                                  value={pkg.lengthCm}
                                  onChange={(e) => updatePackage(pkg.id, "lengthCm", e.target.value)}
                                  className="h-7 text-xs text-center"
                                />
                              </td>
                              <td className="px-2 py-1.5">
                                <Input
                                  type="number"
                                  placeholder="0"
                                  value={pkg.widthCm}
                                  onChange={(e) => updatePackage(pkg.id, "widthCm", e.target.value)}
                                  className="h-7 text-xs text-center"
                                />
                              </td>
                              <td className="px-2 py-1.5">
                                <Input
                                  type="number"
                                  placeholder="0"
                                  value={pkg.heightCm}
                                  onChange={(e) => updatePackage(pkg.id, "heightCm", e.target.value)}
                                  className="h-7 text-xs text-center"
                                />
                              </td>
                              <td className="px-2 py-1.5 text-center">
                                {chargeableKg > 0 ? (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className={cn(
                                          "text-xs font-bold cursor-help",
                                          isVolumetricHigher ? "text-orange-600" : "text-foreground"
                                        )}>
                                          {chargeableKg.toFixed(2)}
                                          {isVolumetricHigher && <span className="text-[8px] ml-0.5">📐</span>}
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="text-xs">
                                        <div className="space-y-1">
                                          <div>کێشی ڕاستەقینە: {actualKg.toFixed(3)} kg</div>
                                          <div>کێشی ئەقدی: {volumetricKg.toFixed(3)} kg</div>
                                          <div className="font-bold border-t pt-1">
                                            حسابکراو: {chargeableKg.toFixed(3)} kg
                                            {isVolumetricHigher ? " (ئەقدی)" : " (ڕاستەقینە)"}
                                          </div>
                                        </div>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                ) : (
                                  <span className="text-xs text-muted-foreground">-</span>
                                )}
                              </td>
                              <td className="px-1 py-1.5">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => removeRow(pkg.id)}
                                  disabled={packages.length <= 1}
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-red-500" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
                
                {/* Footer with register button */}
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{totals.validPackages} {t('packages.packagesReady')}</span>
                    {totals.totalChargeableWeight > 0 && (
                      <span className="flex items-center gap-1">
                        <Scale className="h-3 w-3" />
                        {totals.totalChargeableWeight.toFixed(2)} kg
                      </span>
                    )}
                  </div>
                  <Button 
                    onClick={handleSubmit}
                    disabled={isSubmitting || (!isUnclaimed && !customerId) || totals.validPackages === 0}
                    size="lg"
                    className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-md"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {t('packages.registering')} {registeredCount}/{totals.validPackages}...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        {t('packages.registerAll')} ({totals.validPackages})
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* CBM Divisor Settings Dialog */}
      <Dialog open={showCbmSettings} onOpenChange={setShowCbmSettings}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-primary" />
              ڕێکخستنی CBM Divisor
            </DialogTitle>
            <DialogDescription>
              ئەم ژمارەیە بۆ حسابکردنی کێشی ئەقدی بەکاردێت. فۆرمولا: (L×W×H) ÷ Divisor
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm">CBM Divisor</Label>
              <Input
                type="number"
                value={newDivisor}
                onChange={(e) => setNewDivisor(e.target.value)}
                placeholder="6000"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                ژمارەی ئێستا: <span className="font-bold">{cbmDivisor}</span> | بنەڕەت: 6000
              </p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg text-xs space-y-1">
              <p className="font-medium">نموونە:</p>
              <p>پاکەتێک بە قەبارەی 50×40×30 سم</p>
              <p>کێشی ئەقدی = (50×40×30) ÷ {newDivisor || cbmDivisor} = <span className="font-bold">{((50*40*30) / (parseInt(newDivisor) || cbmDivisor)).toFixed(2)} kg</span></p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCbmSettings(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSaveCbmDivisor} disabled={setCbmDivisorMutation.isPending}>
              {setCbmDivisorMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
