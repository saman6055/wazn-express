import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CopyButton } from "@/components/CopyButton";
import { ZoomImage } from "@/components/ZoomImage";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { useBatches, useBatchPackages, useBatchPricingTiers, useBatchCustomerPricing, useBatchFinancialSummary } from "@/hooks/useBatches";
import { Plus, Layers, Plane, Ship, Eye, DollarSign, Edit, Trash2, TrendingUp, Package, Users, Calculator, BarChart3, ExternalLink, FileDown, Loader2, AlertTriangle, ShieldCheck, ChevronsUpDown } from "lucide-react";
import { Link } from "wouter";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useTranslation } from "@/contexts/LanguageContext";

const statusColors: Record<string, string> = {
  preparing: "bg-blue-100 text-blue-800",
  in_transit: "bg-amber-100 text-amber-800",
  arrived: "bg-green-100 text-green-800",
  customs: "bg-purple-100 text-purple-800",
  delivered: "bg-green-200 text-green-900",
  closed: "bg-gray-100 text-gray-800",
};

interface PricingTier {
  minValue: string;
  maxValue: string | null;
  pricePerUnit: string;
}

interface CustomerPricing {
  customerId: number;
  pricePerKg?: string;
  pricePerCbm?: string;
  notes?: string;
}

export default function Batches() {
    const { t } = useTranslation();
const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isFinancialOpen, setIsFinancialOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<any>(null);
  const [selectedBatch, setSelectedBatch] = useState<number | null>(null);
  const [financialBatchId, setFinancialBatchId] = useState<number | null>(null);
  const [shippingType, setShippingType] = useState<string>("");
  const [createOriginWarehouseId, setCreateOriginWarehouseId] = useState<string>("");
  const [createDestinationCountryId, setCreateDestinationCountryId] = useState<string>("");
  const [useTieredPricing, setUseTieredPricing] = useState(false);
  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>([]);
  const [customerPricing, setCustomerPricing] = useState<CustomerPricing[]>([]);
  const [custPriceOpen, setCustPriceOpen] = useState(false);
  const [exportingBatchId, setExportingBatchId] = useState<number | null>(null);

  // Pre-delivery audit dialog state. Holds the batchId+target status the
  // operator is trying to switch to, plus the audit findings the server
  // returned. The actual status update is deferred until the operator
  // confirms inside the dialog.
  const [pendingDeliveryConfirm, setPendingDeliveryConfirm] = useState<{
    batchId: number;
    targetStatus: string;
  } | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const trpcUtilsForAudit = trpc.useUtils();
  const [auditData, setAuditData] = useState<any>(null);

  // PDF Export mutation
  const exportBatchPDF = trpc.dashboard.exportBatchPDF.useMutation({
    onSuccess: (data) => {
      const byteCharacters = atob(data.pdf);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = data.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success(t('batches.reportDownloaded'));
      setExportingBatchId(null);
    },
    onError: (error) => {
      toast.error(t('common.error') + ': ' + error.message);
      setExportingBatchId(null);
    }
  });

  const handleExportBatchPDF = (batchId: number) => {
    setExportingBatchId(batchId);
    exportBatchPDF.mutate({ batchId });
  };
  
  const { batches, refetch, createMutation, updateMutation, updateStatusMutation } = useBatches();
  const { data: warehouses } = trpc.warehouses.list.useQuery({ activeOnly: true });
  const { data: countries } = trpc.countries.list.useQuery({ activeOnly: true });
  const { packages: batchPackages } = useBatchPackages(selectedBatch);
  const { tiers: existingTiers } = useBatchPricingTiers(editingBatch?.id ?? null);
  const { customerPricing: existingCustomerPricing } = useBatchCustomerPricing(editingBatch?.id ?? null);
  const { financialSummary } = useBatchFinancialSummary(financialBatchId);
  const { data: customers } = trpc.customers.list.useQuery();
  
  // Load existing tiers when editing
  useEffect(() => {
    if (existingTiers && existingTiers.length > 0) {
      setPricingTiers(existingTiers.map(t => ({
        minValue: String(t.minValue),
        maxValue: t.maxValue ? String(t.maxValue) : null,
        pricePerUnit: String(t.pricePerUnit),
      })));
      setUseTieredPricing(true);
    } else if (editingBatch) {
      setUseTieredPricing(editingBatch.useTieredPricing || false);
      if (!editingBatch.useTieredPricing) {
        setPricingTiers([]);
      }
    }
  }, [existingTiers, editingBatch]);
  
  // Load existing customer pricing when editing
  useEffect(() => {
    if (existingCustomerPricing && existingCustomerPricing.length > 0) {
      setCustomerPricing(existingCustomerPricing.map(cp => ({
        customerId: cp.customerId,
        pricePerKg: cp.pricePerKg ? String(cp.pricePerKg) : undefined,
        pricePerCbm: cp.pricePerCbm ? String(cp.pricePerCbm) : undefined,
        notes: cp.notes || undefined,
      })));
    } else {
      setCustomerPricing([]);
    }
  }, [existingCustomerPricing]);
  
  const onBatchCreateSuccess = () => {
    toast.success(t("batches.batchCreated"));
    setIsCreateOpen(false);
    resetForm();
    refetch();
  };
  const onBatchUpdateSuccess = () => {
    toast.success(t("batches.batchUpdated"));
    setIsEditOpen(false);
    setEditingBatch(null);
    resetForm();
    refetch();
  };
  const onMutationErrorEarly = (error: unknown) => {
    const err = error as { message?: string; data?: { zodError?: { errors?: { message: string }[] } } };
    const msg = err.data?.zodError?.errors?.[0]?.message || err.message || t("common.error");
    toast.error(msg);
  };
  const onBatchStatusSuccess = (data?: any) => {
    const diag = data?.diagnostics;

    // Critical-error path: the server caught an unhandled exception during
    // the delivered/closed flow. Surface it as a long red toast so the
    // operator doesn't think it succeeded.
    if (diag?.error) {
      toast.error(
        `❌ هەڵە لە چاکسازی باچ\nVersion: ${diag.version || 'unknown'}\n${diag.note || ''}\nError: ${diag.error}`,
        { duration: 30000 }
      );
      refetch();
      return;
    }

    toast.success(t("batches.statusUpdated"));

    // If the batch just transitioned to delivered/closed, the server returns
    // a diagnostic report describing exactly what the consolidated invoice
    // flow did. Surface it as a longer-duration toast so the operator can
    // immediately see how many orders were charged + invoices created
    // without needing server logs.
    if (diag) {
      const totalNew =
        (diag.phase2?.fpInvoicesCreated || 0) +
        (diag.phase2?.cmInvoicesCreated || 0) +
        (diag.phase2?.pkgInvoicesCreated || 0) +
        (diag.phase3?.recoveryFpInvoices || 0) +
        (diag.phase3?.recoveryCmInvoices || 0);
      const totalCharged =
        (diag.phase2?.fpOrdersCharged || 0) +
        (diag.phase2?.cmOrdersCharged || 0) +
        (diag.phase3?.stragglersFound || 0);
      const summary = [
        `🏷️ Version: ${diag.version || 'unknown'}`,
        `📦 پاکەت: ${diag.packageCount} (${diag.packagesWithOrderId} لینک کراون، ${diag.packagesUnlinked} بێ لینک)`,
        `📥 کۆکراوە: ${diag.phase1?.fpOrdersCollected || 0} FP, ${diag.phase1?.cmOrdersCollected || 0} CM, ${diag.phase1?.normalPkgsCollected || 0} پاکەت`,
        `🧾 پسوڵەی نوێ: ~${totalNew}`,
        `💰 ئۆردەری چارجکراو: ~${totalCharged}`,
      ];
      if (diag.phase3?.stragglersFound > 0) {
        summary.push(`⚠️ ${diag.phase3.stragglersFound} ئۆردەر لە Phase 3 (recovery) چاکراون`);
      }
      // Surface Phase-2 errors as a separate toast so they don't get lost
      const phase2Errors: string[] = diag.phase2?.errors || [];
      if (phase2Errors.length > 0) {
        summary.push(`❌ ${phase2Errors.length} هەڵە لە Phase 2`);
        toast.error(`Phase 2 Errors:\n${phase2Errors.join('\n')}`, { duration: 30000 });
      }
      toast.info(summary.join('\n'), { duration: 15000 });
    }
    refetch();
  };

  const reprocessMutation = trpc.batches.reprocessInvoicing.useMutation({
    onSuccess: (data) => {
      const d = data?.diagnostics;
      const msg = d
        ? `✅ پشکنی تەواو بوو\n📦 پاکەت: ${d.packageCount}\n🔍 ئۆردەری پشکنیکراو: ${d.ordersChecked}\n✓ پێشتر چارجکراو: ${d.alreadyCharged}\n⚠️ ماوە بۆ چارج: ${d.stragglersFound}\n🧾 پسوڵەی نوێ: ${(d.recoveryFpInvoices || 0) + (d.recoveryCmInvoices || 0)}`
        : `پشکنی تەواو بوو`;
      toast.success(msg, { duration: 12000 });
      refetch();
    },
    onError: onMutationErrorEarly,
  });
  const onMutationError = (error: unknown) => {
    const err = error as { message?: string; data?: { zodError?: { errors?: { message: string }[] } } };
    const msg = err.data?.zodError?.errors?.[0]?.message || err.message || t("common.error");
    toast.error(msg);
  };

  const resetForm = () => {
    setShippingType("");
    setCreateOriginWarehouseId("");
    setCreateDestinationCountryId("");
    setUseTieredPricing(false);
    setPricingTiers([]);
    setCustomerPricing([]);
  };

  const addTier = () => {
    const lastTier = pricingTiers[pricingTiers.length - 1];
    const newMin = lastTier ? (lastTier.maxValue || "0") : "0";
    setPricingTiers([...pricingTiers, { minValue: newMin, maxValue: null, pricePerUnit: "" }]);
  };

  const removeTier = (index: number) => {
    setPricingTiers(pricingTiers.filter((_, i) => i !== index));
  };

  const updateTier = (index: number, field: keyof PricingTier, value: string | null) => {
    const updated = [...pricingTiers];
    updated[index] = { ...updated[index], [field]: value };
    setPricingTiers(updated);
  };

  // Customer pricing functions
  const addCustomerPricing = (customerId: number) => {
    if (customerPricing.find(cp => cp.customerId === customerId)) {
      toast.error(t("batches.customerAlreadyHasPricing"));
      return;
    }
    setCustomerPricing([...customerPricing, { customerId }]);
  };

  const removeCustomerPricing = (customerId: number) => {
    setCustomerPricing(customerPricing.filter(cp => cp.customerId !== customerId));
  };

  const updateCustomerPricing = (customerId: number, field: keyof CustomerPricing, value: string | undefined) => {
    const updated = customerPricing.map(cp => 
      cp.customerId === customerId ? { ...cp, [field]: value } : cp
    );
    setCustomerPricing(updated);
  };

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const originWarehouseId = parseInt(createOriginWarehouseId, 10);
    const destinationCountryId = parseInt(createDestinationCountryId, 10);
    if (!createOriginWarehouseId || isNaN(originWarehouseId)) {
      toast.error(t("batches.selectWarehouse") || "Please select origin warehouse");
      return;
    }
    if (!createDestinationCountryId || isNaN(destinationCountryId)) {
      toast.error(t("batches.selectDestination") || "Please select destination country");
      return;
    }
    if (!shippingType || !["air_regular", "air_irregular", "sea"].includes(shippingType)) {
      toast.error(t("batches.selectType") || "Please select shipping type");
      return;
    }
    const rawBatchCode = (formData.get("batchCode") as string)?.trim() || "";
    const batchCodeRe = /^(SEA|AIR)-\d+(-\d+)*$/;
    if (!rawBatchCode) {
      toast.error(t("batches.batchCodeRequired") || "Batch code is required");
      return;
    }
    if (!batchCodeRe.test(rawBatchCode)) {
      toast.error(t("batches.batchCodeFormat") || "Batch code must be like SEA-123 or AIR-2024-001");
      return;
    }
    createMutation.mutate({
      batchCode: rawBatchCode,
      originWarehouseId,
      destinationCountryId,
      shippingType: shippingType as "air_regular" | "air_irregular" | "sea",
      carrierInfo: formData.get("carrierInfo") as string || undefined,
      // Detailed shipping info
      airlineName: formData.get("airlineName") as string || undefined,
      flightNumber: formData.get("flightNumber") as string || undefined,
      shippingCompany: formData.get("shippingCompany") as string || undefined,
      containerNumber: formData.get("containerNumber") as string || undefined,
      vesselName: formData.get("vesselName") as string || undefined,
      shippingCost: formData.get("shippingCost") as string || undefined,
      departureDate: formData.get("departureDate") ? new Date(formData.get("departureDate") as string) : undefined,
      estimatedArrival: formData.get("estimatedArrival") ? new Date(formData.get("estimatedArrival") as string) : undefined,
      // Actual measurements
      actualWeightKg: formData.get("actualWeightKg") as string || undefined,
      actualCbm: formData.get("actualCbm") as string || undefined,
      // Charged measurements
      chargedWeightKg: formData.get("chargedWeightKg") as string || undefined,
      chargedCbm: formData.get("chargedCbm") as string || undefined,
      // Cost
      costPerKg: formData.get("costPerKg") as string || undefined,
      costPerCbm: formData.get("costPerCbm") as string || undefined,
      // Selling price
      pricePerKg: formData.get("pricePerKg") as string || undefined,
      pricePerCbm: formData.get("pricePerCbm") as string || undefined,
      // Tiered pricing
      useTieredPricing: useTieredPricing,
      pricingTiers: useTieredPricing ? pricingTiers : undefined,
      // Customer-specific pricing
      customerPricing: customerPricing.length > 0 ? customerPricing : undefined,
      notes: formData.get("notes") as string || undefined,
    }, { onSuccess: onBatchCreateSuccess, onError: onMutationError });
  };

  const handleEdit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingBatch) return;
    
    const formData = new FormData(e.currentTarget);
    
    updateMutation.mutate({
      id: editingBatch.id,
      batchCode: formData.get("batchCode") as string || undefined,
      carrierInfo: formData.get("carrierInfo") as string || undefined,
      // Detailed shipping info
      airlineName: formData.get("airlineName") as string || undefined,
      flightNumber: formData.get("flightNumber") as string || undefined,
      shippingCompany: formData.get("shippingCompany") as string || undefined,
      containerNumber: formData.get("containerNumber") as string || undefined,
      vesselName: formData.get("vesselName") as string || undefined,
      shippingCost: formData.get("shippingCost") as string || undefined,
      departureDate: formData.get("departureDate") ? new Date(formData.get("departureDate") as string) : undefined,
      estimatedArrival: formData.get("estimatedArrival") ? new Date(formData.get("estimatedArrival") as string) : undefined,
      // Actual measurements
      actualWeightKg: formData.get("actualWeightKg") as string || undefined,
      actualCbm: formData.get("actualCbm") as string || undefined,
      // Charged measurements
      chargedWeightKg: formData.get("chargedWeightKg") as string || undefined,
      chargedCbm: formData.get("chargedCbm") as string || undefined,
      // Cost
      costPerKg: formData.get("costPerKg") as string || undefined,
      costPerCbm: formData.get("costPerCbm") as string || undefined,
      // Selling price
      pricePerKg: formData.get("pricePerKg") as string || undefined,
      pricePerCbm: formData.get("pricePerCbm") as string || undefined,
      // Tiered pricing
      useTieredPricing: useTieredPricing,
      pricingTiers: pricingTiers,
      // Customer-specific pricing
      customerPricing: customerPricing,
      notes: formData.get("notes") as string || undefined,
    }, { onSuccess: onBatchUpdateSuccess, onError: onMutationError });
  };

  const openEditDialog = (batch: any) => {
    setEditingBatch(batch);
    setShippingType(batch.shippingType);
    setUseTieredPricing(batch.useTieredPricing || false);
    setIsEditOpen(true);
  };

  const openFinancialDialog = (batchId: number) => {
    setFinancialBatchId(batchId);
    setIsFinancialOpen(true);
  };

  const getWarehouseName = (id: number) => warehouses?.find(w => w.id === id)?.nameEn || t("common.unknown");
  const getCountryName = (id: number) => countries?.find(c => c.id === id)?.nameEn || t("common.unknown");
  const getCustomerName = (id: number) => {
    const customer = customers?.find(c => c.id === id);
    return customer ? `${customer.customerCode} (${customer.fullName})` : `Customer #${id}`;
  };

  const formatPrice = (batch: any) => {
    const priceText = batch.useTieredPricing 
      ? <Badge variant="secondary">Tiered</Badge>
      : batch.shippingType === "sea" && batch.pricePerCbm
        ? `$${batch.pricePerCbm}/CBM`
        : batch.pricePerKg
          ? `$${batch.pricePerKg}/KG`
          : "-";
    
    return (
      <div className="flex items-center gap-1">
        {priceText}
        {batch.hasCustomerPricing && (
          <span title={`${batch.customerPricingCount} ${t('batches.vipCustomers')}`} className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-purple-600 bg-purple-100 rounded-full">
            <Users className="h-3 w-3" />
          </span>
        )}
      </div>
    );
  };

  const getUnit = (type: string) => type === "sea" ? "CBM" : "KG";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("batches.title")}</h1>
            <p className="text-muted-foreground">{t("batches.subtitle")}</p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 me-2" />{t("batches.newBatch")}</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t("batches.newBatch")}</DialogTitle>
                <DialogDescription>{t("batches.createBatchDesc")}</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreate}>
                <Tabs defaultValue="basic" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="basic">{t("batches.basicInfo")}</TabsTrigger>
                    <TabsTrigger value="volume">{t("batches.volumeCost")}</TabsTrigger>
                    <TabsTrigger value="pricing">{t("batches.sellingPrice")}</TabsTrigger>
                  </TabsList>
                  
                  {/* Tab 1: Basic Info */}
                  <TabsContent value="basic" forceMount className="data-[state=inactive]:hidden space-y-4 mt-4">
                    <div className="grid gap-2">
                      <Label htmlFor="batchCode">{t("batches.batchCode")} *</Label>
                      <Input id="batchCode" name="batchCode" required placeholder="e.g., AIR-2024-001" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="originWarehouseId">Origin Warehouse *</Label>
                        <Select value={createOriginWarehouseId} onValueChange={setCreateOriginWarehouseId}>
                          <SelectTrigger><SelectValue placeholder={t("batches.selectWarehouse")} /></SelectTrigger>
                          <SelectContent>
                            {warehouses?.map(w => (
                              <SelectItem key={w.id} value={w.id.toString()}>
                                {w.codePrefix} - {w.nameEn}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="destinationCountryId">Destination *</Label>
                        <Select value={createDestinationCountryId} onValueChange={setCreateDestinationCountryId}>
                          <SelectTrigger><SelectValue placeholder={t("batches.selectDestination")} /></SelectTrigger>
                          <SelectContent>
                            {countries?.filter(c => c.isDestination).map(c => (
                              <SelectItem key={c.id} value={c.id.toString()}>{c.nameEn}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="shippingType">{t("batches.shippingType")} *</Label>
                      <Select value={shippingType} onValueChange={setShippingType}>
                        <SelectTrigger><SelectValue placeholder={t("batches.selectType")} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="air_regular">{t("batches.airRegular")}</SelectItem>
                          <SelectItem value="air_irregular">{t("batches.airIrregular")}</SelectItem>
                          <SelectItem value="sea">{t("batches.seaFreight")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {/* Shipping Details - Dynamic based on type */}
                    {shippingType && shippingType !== "sea" && (
                      <Card className="border-blue-100 bg-blue-50/30">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Plane className="h-4 w-4 text-blue-600" />
                            {t('batches.flightInfo')}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="grid gap-1.5">
                              <Label className="text-xs">{t('batches.flightName')}</Label>
                              <Input name="airlineName" placeholder="e.g., Turkish Airlines" className="h-9" />
                            </div>
                            <div className="grid gap-1.5">
                              <Label className="text-xs">{t('batches.flightNumber')}</Label>
                              <Input name="flightNumber" placeholder="e.g., TK123" className="h-9" />
                            </div>
                          </div>
                          <div className="grid gap-1.5">
                            <Label className="text-xs">{t('batches.shippingCompany')}</Label>
                            <Input name="shippingCompany" placeholder={t('batches.companyName')} className="h-9" />
                          </div>
                        </CardContent>
                      </Card>
                    )}
                    
                    {shippingType === "sea" && (
                      <Card className="border-cyan-100 bg-cyan-50/30">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Ship className="h-4 w-4 text-cyan-600" />
                            {t('batches.seaInfo')}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="grid gap-1.5">
                              <Label className="text-xs">{t('batches.shipName')}</Label>
                              <Input name="vesselName" placeholder="e.g., MSC Oscar" className="h-9" />
                            </div>
                            <div className="grid gap-1.5">
                              <Label className="text-xs">{t('batches.containerNumber')}</Label>
                              <Input name="containerNumber" placeholder="e.g., MSCU1234567" className="h-9" />
                            </div>
                          </div>
                          <div className="grid gap-1.5">
                            <Label className="text-xs">{t('batches.shippingCompany')}</Label>
                            <Input name="shippingCompany" placeholder={t('batches.companyName')} className="h-9" />
                          </div>
                        </CardContent>
                      </Card>
                    )}
                    
                    {/* Shipping Cost */}
                    {shippingType && (
                      <div className="grid gap-2">
                        <Label>{t('batches.totalShippingCost')}</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                          <Input name="shippingCost" type="number" step="0.01" className="pl-7" placeholder={t('batches.totalAmountToCompany')} />
                        </div>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="departureDate">{t('batches.departureDate')}</Label>
                        <Input id="departureDate" name="departureDate" type="date" />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="estimatedArrival">{t('batches.estimatedArrival')}</Label>
                        <Input id="estimatedArrival" name="estimatedArrival" type="date" />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="notes">Notes</Label>
                      <Input id="notes" name="notes" placeholder={t("common.notes")} />
                    </div>
                  </TabsContent>
                  
                  {/* Tab 2: Volume & Cost */}
                  <TabsContent value="volume" forceMount className="data-[state=inactive]:hidden space-y-4 mt-4">
                    {shippingType ? (
                      <>
                        <Card className="border-blue-200 bg-blue-50/50">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Package className="h-4 w-4" />
                              Actual Measurements
                            </CardTitle>
                            <CardDescription>Real weight/volume of the batch</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-2 gap-4">
                              {shippingType !== "sea" && (
                                <div className="grid gap-2">
                                  <Label>Actual Weight (KG)</Label>
                                  <Input name="actualWeightKg" type="number" step="0.01" placeholder="e.g., 17.00" />
                                </div>
                              )}
                              {shippingType === "sea" && (
                                <div className="grid gap-2">
                                  <Label>Actual CBM</Label>
                                  <Input name="actualCbm" type="number" step="0.0001" placeholder="e.g., 18.0000" />
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                        
                        <Card className="border-amber-200 bg-amber-50/50">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Calculator className="h-4 w-4" />
                              Charged Measurements
                            </CardTitle>
                            <CardDescription>What we pay for (may differ from actual)</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-2 gap-4">
                              {shippingType !== "sea" && (
                                <div className="grid gap-2">
                                  <Label>Charged Weight (KG)</Label>
                                  <Input name="chargedWeightKg" type="number" step="0.01" placeholder="e.g., 20.00" />
                                </div>
                              )}
                              {shippingType === "sea" && (
                                <div className="grid gap-2">
                                  <Label>Charged CBM</Label>
                                  <Input name="chargedCbm" type="number" step="0.0001" placeholder="e.g., 20.0000" />
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                        
                        <Card className="border-red-200 bg-red-50/50">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <DollarSign className="h-4 w-4" />
                              Our Cost ({t("auto.text_080d04")})
                            </CardTitle>
                            <CardDescription>What we pay per unit</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="grid gap-2">
                              {shippingType !== "sea" ? (
                                <>
                                  <Label>Cost per KG (USD)</Label>
                                  <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                    <Input name="costPerKg" type="number" step="0.01" className="pl-7" placeholder="e.g., 7.00" />
                                  </div>
                                </>
                              ) : (
                                <>
                                  <Label>Cost per CBM (USD)</Label>
                                  <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                    <Input name="costPerCbm" type="number" step="0.01" className="pl-7" placeholder="e.g., 110.00" />
                                  </div>
                                </>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        Please select a shipping type first
                      </div>
                    )}
                  </TabsContent>
                  
                  {/* Tab 3: Selling Price */}
                  <TabsContent value="pricing" forceMount className="data-[state=inactive]:hidden space-y-4 mt-4">
                    {shippingType ? (
                      <>
                        {/* Tiered pricing toggle for Sea and Air Irregular */}
                        {(shippingType === "sea" || shippingType === "air_irregular") && (
                          <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                            <div>
                              <Label className="font-semibold">Use Tiered Pricing</Label>
                              <p className="text-sm text-muted-foreground">
                                Different prices based on customer's total {getUnit(shippingType)}
                              </p>
                            </div>
                            <Switch checked={useTieredPricing} onCheckedChange={setUseTieredPricing} />
                          </div>
                        )}
                        
                        {!useTieredPricing ? (
                          <Card className="border-green-200 bg-green-50/50">
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm flex items-center gap-2">
                                <DollarSign className="h-4 w-4 text-green-600" />
                                Default Selling Price
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="grid gap-2">
                                {shippingType !== "sea" ? (
                                  <>
                                    <Label>Price per KG (USD)</Label>
                                    <div className="relative">
                                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                      <Input name="pricePerKg" type="number" step="0.01" className="pl-7" placeholder="e.g., 11.00" />
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <Label>Price per CBM (USD)</Label>
                                    <div className="relative">
                                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                      <Input name="pricePerCbm" type="number" step="0.01" className="pl-7" placeholder="e.g., 150.00" />
                                    </div>
                                  </>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        ) : (
                          <Card className="border-green-200 bg-green-50/50">
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm flex items-center gap-2">
                                <Layers className="h-4 w-4 text-green-600" />
                                Tiered Pricing Rules
                              </CardTitle>
                              <CardDescription>
                                Set different prices based on customer's total {getUnit(shippingType)} in this batch
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              {pricingTiers.map((tier, index) => (
                                <div key={index} className="flex items-center gap-2 p-3 border rounded-lg bg-white">
                                  <div className="flex-1 grid grid-cols-3 gap-2">
                                    <div>
                                      <Label className="text-xs">From {getUnit(shippingType)}</Label>
                                      <Input
                                        type="number"
                                        step="0.01"
                                        value={tier.minValue}
                                        onChange={(e) => updateTier(index, 'minValue', e.target.value)}
                                        placeholder="0"
                                      />
                                    </div>
                                    <div>
                                      <Label className="text-xs">To {getUnit(shippingType)}</Label>
                                      <Input
                                        type="number"
                                        step="0.01"
                                        value={tier.maxValue || ""}
                                        onChange={(e) => updateTier(index, 'maxValue', e.target.value || null)}
                                        placeholder="∞"
                                      />
                                    </div>
                                    <div>
                                      <Label className="text-xs">Price (USD)</Label>
                                      <div className="relative">
                                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                                        <Input
                                          type="number"
                                          step="0.01"
                                          className="pl-6"
                                          value={tier.pricePerUnit}
                                          onChange={(e) => updateTier(index, 'pricePerUnit', e.target.value)}
                                          placeholder="0.00"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                  <Button type="button" variant="ghost" size="icon" onClick={() => removeTier(index)}>
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                  </Button>
                                </div>
                              ))}
                              <Button type="button" variant="outline" className="w-full" onClick={addTier}>
                                <Plus className="h-4 w-4 me-2" />Add Tier
                              </Button>
                              
                              {pricingTiers.length > 0 && (
                                <div className="mt-4 p-3 bg-muted rounded-lg">
                                  <p className="text-sm font-medium mb-2">Preview:</p>
                                  <div className="space-y-1 text-sm">
                                    {pricingTiers.map((tier, i) => (
                                      <div key={i} className="flex justify-between">
                                        <span>
                                          {tier.minValue} - {tier.maxValue || "∞"} {getUnit(shippingType)}
                                        </span>
                                        <span className="font-medium text-green-600">
                                          ${tier.pricePerUnit}/{getUnit(shippingType)}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        )}
                        
                        {/* Customer-Specific Pricing Section */}
                        <Card className="border-purple-200 bg-purple-50/50 mt-4">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Users className="h-4 w-4 text-purple-600" />
                              {t("auto.text_21ba20")} (Customer-Specific Pricing)
                            </CardTitle>
                            <CardDescription>
                              {t("auto.text_16b5c1")}
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {/* Customer selector — searchable (find by name/code, not a long dropdown) */}
                            <Popover open={custPriceOpen} onOpenChange={setCustPriceOpen}>
                              <PopoverTrigger asChild>
                                <Button type="button" variant="outline" role="combobox" aria-expanded={custPriceOpen} className="w-full justify-between font-normal">
                                  <span className="text-muted-foreground">{t("auto.text_229840")}</span>
                                  <ChevronsUpDown className="h-4 w-4 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent variant="panel" className="w-[--radix-popover-trigger-width] p-0" align="start">
                                <Command>
                                  <CommandInput placeholder={t("auto.text_229840")} />
                                  <CommandList>
                                    <CommandEmpty>هیچ کڕیارێک نەدۆزرایەوە</CommandEmpty>
                                    <CommandGroup>
                                      {customers?.filter(c => !customerPricing.find(cp => cp.customerId === c.id)).map(c => (
                                        <CommandItem
                                          key={c.id}
                                          value={`${c.customerCode} ${c.fullName} ${(c as any).mobileNumber || ""}`}
                                          onSelect={() => { addCustomerPricing(c.id); setCustPriceOpen(false); }}
                                        >
                                          <span className="font-medium">{c.customerCode}</span>
                                          <span className="ms-2 text-muted-foreground truncate">{c.fullName}</span>
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                            
                            {/* Customer pricing list */}
                            {customerPricing.map((cp) => {
                              const customer = customers?.find(c => c.id === cp.customerId);
                              return (
                                <div key={cp.customerId} className="flex items-center gap-2 p-3 border rounded-lg bg-white">
                                  <div className="flex-1">
                                    <div className="font-medium text-sm mb-2">
                                      {customer?.customerCode} - {customer?.fullName}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                      {shippingType !== "sea" ? (
                                        <div>
                                          <Label className="text-xs">{t("auto.text_dc2a9a")} </Label>
                                          <Input
                                            type="number"
                                            step="0.01"
                                            value={cp.pricePerKg || ""}
                                            onChange={(e) => updateCustomerPricing(cp.customerId, 'pricePerKg', e.target.value || undefined)}
                                            placeholder="e.g., 10.00"
                                          />
                                        </div>
                                      ) : (
                                        <div>
                                          <Label className="text-xs">{t("auto.text_675fe6")} </Label>
                                          <Input
                                            type="number"
                                            step="0.01"
                                            value={cp.pricePerCbm || ""}
                                            onChange={(e) => updateCustomerPricing(cp.customerId, 'pricePerCbm', e.target.value || undefined)}
                                            placeholder="e.g., 140.00"
                                          />
                                        </div>
                                      )}
                                      <div>
                                        <Label className="text-xs">{t("common.notes")}</Label>
                                        <Input
                                          value={cp.notes || ""}
                                          onChange={(e) => updateCustomerPricing(cp.customerId, 'notes', e.target.value || undefined)}
                                          placeholder={t("batches.optionalNote")}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                  <Button type="button" variant="ghost" size="icon" onClick={() => removeCustomerPricing(cp.customerId)}>
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                  </Button>
                                </div>
                              );
                            })}
                            
                            {customerPricing.length === 0 && (
                              <p className="text-sm text-muted-foreground text-center py-2">
                                {t("auto.text_143ec0")}.
                              </p>
                            )}
                          </CardContent>
                        </Card>
                      </>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        Please select a shipping type first
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
                
                <DialogFooter className="mt-6">
                  <Button type="button" variant="outline" onClick={() => { setIsCreateOpen(false); resetForm(); }}>Cancel</Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? t("common.creating") : t("batches.createBatch")}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Preparing</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{batches?.filter(b => b.status === "preparing").length || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">In Transit</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{batches?.filter(b => b.status === "in_transit").length || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">At Customs</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{batches?.filter(b => b.status === "customs").length || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Delivered</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{batches?.filter(b => b.status === "delivered").length || 0}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("batches.batchCode")}</TableHead>
                  <TableHead>{t("batches.origin")} → {t("batches.destination")}</TableHead>
                  <TableHead>{t("batches.shippingType")}</TableHead>
                  <TableHead>{t("common.price")}</TableHead>
                  <TableHead>{t("batches.packages")}</TableHead>
                  <TableHead>{t("batches.departureDate")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                  <TableHead>{t("common.alert")}</TableHead>
                  <TableHead className="text-right">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches?.map((batch) => (
                  <TableRow
                    key={batch.id}
                    className="transition-colors hover:bg-blue-50/60 dark:hover:bg-blue-950/30 hover:ring-2 hover:ring-inset hover:ring-blue-400/50"
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {batch.shippingType === "sea" ? (
                          <Ship className="h-4 w-4 text-blue-600" />
                        ) : (
                          <Plane className="h-4 w-4 text-amber-600" />
                        )}
                        <span className="font-mono font-medium">{batch.batchCode}</span>
                        <CopyButton value={batch.batchCode} label="کۆپی کۆدی باچ" />
                      </div>
                    </TableCell>
                    <TableCell>
                      {getWarehouseName(batch.originWarehouseId)} → {getCountryName(batch.destinationCountryId)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {batch.shippingType.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-green-600">{formatPrice(batch)}</span>
                    </TableCell>
                    <TableCell>{batch.totalPackages || 0}</TableCell>
                    <TableCell>
                      {batch.departureDate ? new Date(batch.departureDate).toLocaleDateString() : "-"}
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[batch.status] || "bg-gray-100"}`}>
                        {batch.status.replace(/_/g, " ")}
                      </span>
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const isCompleted = batch.status === "arrived" || batch.status === "delivered" || batch.status === "closed";
                        if (isCompleted) {
                          return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">{t("auto.text_4c0d23")} </Badge>;
                        }
                        
                        if (batch.estimatedArrival) {
                          const eta = new Date(batch.estimatedArrival);
                          const now = new Date();
                          const daysOverdue = Math.floor((now.getTime() - eta.getTime()) / (1000 * 60 * 60 * 24));
                          const daysUntil = Math.floor((eta.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                          
                          if (daysOverdue > 5) {
                            return <Badge variant="destructive" className="animate-pulse">🔴 {daysOverdue} ڕ{t("auto.text_d4f9af")}</Badge>;
                          } else if (daysOverdue > 0) {
                            return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">⚠️ {daysOverdue} ڕ{t("auto.text_d4f9af")}</Badge>;
                          } else if (daysUntil <= 2) {
                            return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">⏰ {daysUntil} ڕ{t("auto.text_60c814")}</Badge>;
                          }
                        }
                        
                        if (batch.departureDate) {
                          const departure = new Date(batch.departureDate);
                          const now = new Date();
                          const daysSince = Math.floor((now.getTime() - departure.getTime()) / (1000 * 60 * 60 * 24));
                          
                          if (daysSince > 30) {
                            return <Badge variant="destructive" className="animate-pulse">🔴 {daysSince} ڕ{t("auto.text_0145a3")}</Badge>;
                          } else if (daysSince > 15) {
                            return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">⚠️ {daysSince} ڕ{t("auto.text_0145a3")}</Badge>;
                          }
                          return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">✅ {daysSince} ڕ{t("auto.text_0145a3")}</Badge>;
                        }
                        
                        return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">{t("auto.text_ed2a98")} </Badge>;
                      })()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setSelectedBatch(batch.id)} title={t("batches.viewPackages")}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Link href={`/batches/${batch.id}/financial`}>
                          <Button variant="ghost" size="icon" title={t("batches.financialReport")}>
                            <BarChart3 className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleExportBatchPDF(batch.id)} 
                          title={t("common.exportPdf")}
                          disabled={exportingBatchId === batch.id}
                        >
                          {exportingBatchId === batch.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <FileDown className="h-4 w-4" />
                          )}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(batch)} title={t("batches.editBatch")}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        {batch.status !== "closed" && (
                          <Select
                            value={batch.status}
                            onValueChange={async (value) => {
                              // For "delivered" / "closed" — run the pre-delivery
                              // audit first and let the operator confirm. For
                              // other transitions, fire directly.
                              if (value === "delivered" || value === "closed") {
                                setPendingDeliveryConfirm({ batchId: batch.id, targetStatus: value });
                                setAuditLoading(true);
                                setAuditData(null);
                                try {
                                  const data = await trpcUtilsForAudit.batches.getPreDeliveryAudit.fetch({ batchId: batch.id });
                                  setAuditData(data);
                                } catch (e: any) {
                                  toast.error(e?.message || "هەڵە لە audit");
                                  setPendingDeliveryConfirm(null);
                                } finally {
                                  setAuditLoading(false);
                                }
                                return;
                              }
                              updateStatusMutation.mutate(
                                { id: batch.id, status: value as any },
                                { onSuccess: (data) => onBatchStatusSuccess(data), onError: onMutationError },
                              );
                            }}
                          >
                            <SelectTrigger className="w-[110px] h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="preparing">Preparing</SelectItem>
                              <SelectItem value="in_transit">In Transit</SelectItem>
                              <SelectItem value="arrived">Arrived</SelectItem>
                              <SelectItem value="customs">Customs</SelectItem>
                              <SelectItem value="delivered">Delivered</SelectItem>
                              <SelectItem value="closed">Closed</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                        {(batch.status === "delivered" || batch.status === "closed") && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs"
                            disabled={reprocessMutation.isPending}
                            onClick={() => {
                              if (window.confirm("دووبارە چارجکردنی ئۆردەرە چارج نەکراوەکانی ئەم باچە؟ (Idempotent)")) {
                                reprocessMutation.mutate({ batchId: batch.id });
                              }
                            }}
                            title="دووبارە پرۆسێسکردنی پسوڵەی ئۆردەرە چارجنەکراوەکان"
                          >
                            {reprocessMutation.isPending ? "..." : "🧾 Reprocess"}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {(!batches || batches.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No batches created yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Batch Packages Dialog */}
        <Dialog open={!!selectedBatch} onOpenChange={(open) => !open && setSelectedBatch(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Batch Packages</DialogTitle>
              <DialogDescription>
                Packages in batch {batches?.find(b => b.id === selectedBatch)?.batchCode}
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("batches.packageCode")}</TableHead>
                    <TableHead>{t("batches.customer")}</TableHead>
                    <TableHead>{t("batches.weight")}</TableHead>
                    <TableHead>{t("common.status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batchPackages?.map((pkg) => (
                    <TableRow key={pkg.id}>
                      <TableCell className="font-mono">{pkg.packageCode}</TableCell>
                      <TableCell>{pkg.customerId ? getCustomerName(pkg.customerId) : t("packages.unclaimed")}</TableCell>
                      <TableCell>
                        {(() => {
                          const actualWeight = Number(pkg.weightKg) || 0;
                          const volumetricWeight = (pkg.lengthCm && pkg.widthCm && pkg.heightCm) 
                            ? (Number(pkg.lengthCm) * Number(pkg.widthCm) * Number(pkg.heightCm)) / 6000 
                            : 0;
                          const chargeableWeight = Math.max(actualWeight, volumetricWeight);
                          const isVolumetric = volumetricWeight > actualWeight && volumetricWeight > 0;
                          
                          if (chargeableWeight === 0) return "-";
                          
                          return (
                            <div className="flex items-center gap-1">
                              <span>{chargeableWeight.toFixed(2)} kg</span>
                              {isVolumetric && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0 bg-purple-50 text-purple-600 border-purple-200">
                                  {t('batches.volumetric')}
                                </Badge>
                              )}
                            </div>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {pkg.status.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!batchPackages || batchPackages.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                        No packages in this batch
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </DialogContent>
        </Dialog>

        {/* Financial Report Dialog */}
        <Dialog open={isFinancialOpen} onOpenChange={(open) => { setIsFinancialOpen(open); if (!open) setFinancialBatchId(null); }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                {t('batches.financialReport')}
              </DialogTitle>
              <DialogDescription>
                {t('batches.profitLossAnalysis')} {batches?.find(b => b.id === financialBatchId)?.batchCode}
              </DialogDescription>
            </DialogHeader>
            {financialSummary && (
              <div className="space-y-6">
                {/* Batch Info Header */}
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-full">
                      {financialSummary.shippingType === 'sea' ? <Ship className="h-6 w-6 text-cyan-600" /> : <Plane className="h-6 w-6 text-blue-600" />}
                    </div>
                    <div>
                      <p className="font-semibold">{batches?.find(b => b.id === financialBatchId)?.batchCode}</p>
                      <p className="text-sm text-muted-foreground">
                        {financialSummary.shippingType === 'sea' ? t('batches.sea') : t('batches.air')} • {financialSummary.totalPackages} {t('common.package')}
                      </p>
                    </div>
                  </div>
                  <Badge variant={financialSummary.profit >= 0 ? "default" : "destructive"} className="text-lg px-4 py-2">
                    {financialSummary.profit >= 0 ? t('batches.profit') : t('batches.loss')}: ${Math.abs(financialSummary.profit).toFixed(2)}
                  </Badge>
                </div>
                
                {/* Summary Cards */}
                <div className="grid grid-cols-4 gap-4">
                  <Card className="border-red-200 bg-gradient-to-br from-red-50 to-red-100">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-red-700 flex items-center gap-1">
                        <DollarSign className="h-4 w-4" />
                        {t('batches.totalCost')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold text-red-700">${financialSummary.totalCost.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {financialSummary.shippingType === 'sea' 
                          ? `${financialSummary.chargedCbm} CBM × $${financialSummary.costPerCbm}`
                          : `${financialSummary.chargedWeight} KG × $${financialSummary.costPerKg}`
                        }
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border-green-200 bg-gradient-to-br from-green-50 to-green-100">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-green-700 flex items-center gap-1">
                        <TrendingUp className="h-4 w-4" />
                        {t('batches.totalRevenue')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold text-green-700">${financialSummary.totalRevenue.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground mt-1">{t('batches.fromPackages', { count: financialSummary.totalPackages })}</p>
                    </CardContent>
                  </Card>
                  <Card className={`border-2 ${financialSummary.profit >= 0 ? 'border-green-500 bg-gradient-to-br from-green-100 to-emerald-100' : 'border-red-500 bg-gradient-to-br from-red-100 to-rose-100'}`}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-1">
                        <BarChart3 className="h-4 w-4" />
                        {financialSummary.profit >= 0 ? t('batches.profit') : t('batches.loss')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className={`text-2xl font-bold ${financialSummary.profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        ${Math.abs(financialSummary.profit).toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {financialSummary.profitMargin.toFixed(1)}% {t('batches.profitMargin')}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-blue-700 flex items-center gap-1">
                        <Package className="h-4 w-4" />
                        {financialSummary.shippingType === 'sea' ? t('batches.cbm') : t('batches.weight')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold text-blue-700">
                        {financialSummary.shippingType === 'sea' 
                          ? `${financialSummary.chargedCbm}`
                          : `${financialSummary.chargedWeight} KG`
                        }
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {financialSummary.shippingType === 'sea' ? t('batches.cubicMeters') : t('batches.totalWeight')}
                      </p>
                    </CardContent>
                  </Card>
                </div>
                
                {/* Customer Breakdown */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      {t('batches.analysisByCustomer')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('batches.customer')}</TableHead>
                          <TableHead>{t('batches.packages')}</TableHead>
                          <TableHead>{financialSummary.shippingType === 'sea' ? t('batches.cbm') : t('batches.weight')}</TableHead>
                          <TableHead>{t('batches.revenue')}</TableHead>
                          <TableHead className="text-right">{t('batches.profitMargin')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {financialSummary.customerBreakdown.map((cb) => {
                          const customerRevenue = cb.revenue;
                          const avgPricePerUnit = financialSummary.shippingType === 'sea' 
                            ? (cb.cbm > 0 ? customerRevenue / cb.cbm : 0)
                            : (cb.weight > 0 ? customerRevenue / cb.weight : 0);
                          return (
                            <TableRow key={cb.customerId}>
                              <TableCell className="font-medium">{getCustomerName(cb.customerId)}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{cb.packages}</Badge>
                              </TableCell>
                              <TableCell>
                                {financialSummary.shippingType === 'sea' 
                                  ? `${cb.cbm.toFixed(4)} CBM`
                                  : `${cb.weight.toFixed(2)} KG`
                                }
                              </TableCell>
                              <TableCell className="font-medium text-green-600">
                                ${cb.revenue.toFixed(2)}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                ${avgPricePerUnit.toFixed(2)}/{financialSummary.shippingType === 'sea' ? 'CBM' : 'KG'}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        {financialSummary.customerBreakdown.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                              <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                              {t('common.noData')}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Batch Dialog */}
        <Dialog open={isEditOpen} onOpenChange={(open) => { setIsEditOpen(open); if (!open) { setEditingBatch(null); resetForm(); } }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Batch</DialogTitle>
              <DialogDescription>
                Update batch details and pricing for {editingBatch?.batchCode}
              </DialogDescription>
            </DialogHeader>
            {editingBatch && (
              <form onSubmit={handleEdit}>
                <Tabs defaultValue="basic" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="basic">{t("batches.basicInfo")}</TabsTrigger>
                    <TabsTrigger value="volume">{t("batches.volumeCost")}</TabsTrigger>
                    <TabsTrigger value="pricing">{t("batches.sellingPrice")}</TabsTrigger>
                  </TabsList>
                  
                  {/* Tab 1: Basic Info */}
                  <TabsContent value="basic" forceMount className="data-[state=inactive]:hidden space-y-4 mt-4">
                    <div className="grid gap-2">
                      <Label>Batch Code</Label>
                      <Input name="batchCode" defaultValue={editingBatch.batchCode} />
                    </div>
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize">
                          {editingBatch.shippingType.replace(/_/g, " ")}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {getWarehouseName(editingBatch.originWarehouseId)} → {getCountryName(editingBatch.destinationCountryId)}
                        </span>
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label>Carrier Information</Label>
                      <Input name="carrierInfo" defaultValue={editingBatch.carrierInfo || ""} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>Departure Date</Label>
                        <Input name="departureDate" type="date" defaultValue={editingBatch.departureDate ? new Date(editingBatch.departureDate).toISOString().split('T')[0] : ""} />
                      </div>
                      <div className="grid gap-2">
                        <Label>Est. Arrival</Label>
                        <Input name="estimatedArrival" type="date" defaultValue={editingBatch.estimatedArrival ? new Date(editingBatch.estimatedArrival).toISOString().split('T')[0] : ""} />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label>Notes</Label>
                      <Input name="notes" defaultValue={editingBatch.notes || ""} />
                    </div>
                  </TabsContent>
                  
                  {/* Tab 2: Volume & Cost */}
                  <TabsContent value="volume" forceMount className="data-[state=inactive]:hidden space-y-4 mt-4">
                    <Card className="border-blue-200 bg-blue-50/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Package className="h-4 w-4" />
                          Actual Measurements
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4">
                          {editingBatch.shippingType !== "sea" && (
                            <div className="grid gap-2">
                              <Label>Actual Weight (KG)</Label>
                              <Input name="actualWeightKg" type="number" step="0.01" defaultValue={editingBatch.actualWeightKg || ""} />
                            </div>
                          )}
                          {editingBatch.shippingType === "sea" && (
                            <div className="grid gap-2">
                              <Label>Actual CBM</Label>
                              <Input name="actualCbm" type="number" step="0.0001" defaultValue={editingBatch.actualCbm || ""} />
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card className="border-amber-200 bg-amber-50/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Calculator className="h-4 w-4" />
                          Charged Measurements
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4">
                          {editingBatch.shippingType !== "sea" && (
                            <div className="grid gap-2">
                              <Label>Charged Weight (KG)</Label>
                              <Input name="chargedWeightKg" type="number" step="0.01" defaultValue={editingBatch.chargedWeightKg || ""} />
                            </div>
                          )}
                          {editingBatch.shippingType === "sea" && (
                            <div className="grid gap-2">
                              <Label>Charged CBM</Label>
                              <Input name="chargedCbm" type="number" step="0.0001" defaultValue={editingBatch.chargedCbm || ""} />
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card className="border-red-200 bg-red-50/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <DollarSign className="h-4 w-4" />
                          Our Cost ({t("auto.text_080d04")})
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-2">
                          {editingBatch.shippingType !== "sea" ? (
                            <>
                              <Label>Cost per KG (USD)</Label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                <Input name="costPerKg" type="number" step="0.01" className="pl-7" defaultValue={editingBatch.costPerKg || ""} />
                              </div>
                            </>
                          ) : (
                            <>
                              <Label>Cost per CBM (USD)</Label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                <Input name="costPerCbm" type="number" step="0.01" className="pl-7" defaultValue={editingBatch.costPerCbm || ""} />
                              </div>
                            </>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                  
                  {/* Tab 3: Selling Price */}
                  <TabsContent value="pricing" forceMount className="data-[state=inactive]:hidden space-y-4 mt-4">
                    {/* Tiered pricing toggle */}
                    {(editingBatch.shippingType === "sea" || editingBatch.shippingType === "air_irregular") && (
                      <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                        <div>
                          <Label className="font-semibold">Use Tiered Pricing</Label>
                          <p className="text-sm text-muted-foreground">
                            Different prices based on customer's total {getUnit(editingBatch.shippingType)}
                          </p>
                        </div>
                        <Switch checked={useTieredPricing} onCheckedChange={setUseTieredPricing} />
                      </div>
                    )}
                    
                    {!useTieredPricing ? (
                      <Card className="border-green-200 bg-green-50/50">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-green-600" />
                            Default Selling Price
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid gap-2">
                            {editingBatch.shippingType !== "sea" ? (
                              <>
                                <Label>Price per KG (USD)</Label>
                                <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                  <Input name="pricePerKg" type="number" step="0.01" className="pl-7" defaultValue={editingBatch.pricePerKg || ""} />
                                </div>
                              </>
                            ) : (
                              <>
                                <Label>Price per CBM (USD)</Label>
                                <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                  <Input name="pricePerCbm" type="number" step="0.01" className="pl-7" defaultValue={editingBatch.pricePerCbm || ""} />
                                </div>
                              </>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ) : (
                      <Card className="border-green-200 bg-green-50/50">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Layers className="h-4 w-4 text-green-600" />
                            Tiered Pricing Rules
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {pricingTiers.map((tier, index) => (
                            <div key={index} className="flex items-center gap-2 p-3 border rounded-lg bg-white">
                              <div className="flex-1 grid grid-cols-3 gap-2">
                                <div>
                                  <Label className="text-xs">From {getUnit(editingBatch.shippingType)}</Label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={tier.minValue}
                                    onChange={(e) => updateTier(index, 'minValue', e.target.value)}
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">To {getUnit(editingBatch.shippingType)}</Label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={tier.maxValue || ""}
                                    onChange={(e) => updateTier(index, 'maxValue', e.target.value || null)}
                                    placeholder="∞"
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">Price (USD)</Label>
                                  <div className="relative">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      className="pl-6"
                                      value={tier.pricePerUnit}
                                      onChange={(e) => updateTier(index, 'pricePerUnit', e.target.value)}
                                    />
                                  </div>
                                </div>
                              </div>
                              <Button type="button" variant="ghost" size="icon" onClick={() => removeTier(index)}>
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          ))}
                          <Button type="button" variant="outline" className="w-full" onClick={addTier}>
                            <Plus className="h-4 w-4 me-2" />Add Tier
                          </Button>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>
                </Tabs>
                
                <DialogFooter className="mt-6">
                  <Button type="button" variant="outline" onClick={() => { setIsEditOpen(false); setEditingBatch(null); resetForm(); }}>Cancel</Button>
                  <Button type="submit" disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? t("common.saving") : t("common.saveChanges")}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>

        {/* Pre-delivery audit dialog (Phase 7).
            Surfaces shared-tracking siblings outside this batch, multi-carton
            orders with cartons still pending, and any (defensive) customer
            mismatches before the operator marks the batch as delivered. */}
        <Dialog
          open={pendingDeliveryConfirm !== null}
          onOpenChange={(open) => {
            if (!open) {
              setPendingDeliveryConfirm(null);
              setAuditData(null);
            }
          }}
        >
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {auditData?.summary?.blocking ? (
                  <AlertTriangle className="h-5 w-5 text-rose-600" />
                ) : auditData?.summary?.warning ? (
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                ) : (
                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                )}
                پێش-پشکنینی گەیاندن
                {auditData && <Badge variant="outline" className="font-mono">{auditData.batchCode}</Badge>}
              </DialogTitle>
              <DialogDescription>
                {pendingDeliveryConfirm?.targetStatus === "delivered"
                  ? "پێش گۆڕینی دۆخی کۆمەڵە بۆ Delivered، تکایە ئەم پشکنینە سەیر بکە."
                  : "پێش داخستنی کۆمەڵە، تکایە ئەم پشکنینە سەیر بکە."}
              </DialogDescription>
            </DialogHeader>

            {auditLoading || !auditData ? (
              <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">پشکنین جێبەجێ دەکرێ...</span>
              </div>
            ) : (
              <div className="space-y-4 text-sm">
                {/* Summary tile */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded border bg-muted/30">
                    <div className="text-[11px] text-muted-foreground">پاکەت لە کۆمەڵە</div>
                    <div className="font-bold text-lg">{auditData.packageCount}</div>
                  </div>
                  <div className="p-2 rounded border bg-muted/30">
                    <div className="text-[11px] text-muted-foreground">ئۆردەری گرێدراو</div>
                    <div className="font-bold text-lg">{auditData.orderCount}</div>
                  </div>
                </div>

                {/* No findings — green light */}
                {!auditData.summary.blocking && !auditData.summary.warning && (
                  <div className="p-3 rounded-lg border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 flex items-center gap-2 text-emerald-800 dark:text-emerald-200">
                    <ShieldCheck className="h-4 w-4" />
                    <span className="font-semibold">هیچ هەشداریەک نییە — کۆمەڵە ئامادەیە</span>
                  </div>
                )}

                {/* Blocking: customer mismatch */}
                {auditData.findings.customerMismatch?.length > 0 && (
                  <div className="p-3 rounded-lg border-2 border-rose-300 bg-rose-50 dark:bg-rose-950/30">
                    <div className="font-bold text-rose-900 dark:text-rose-200 mb-2 flex items-center gap-1">
                      <AlertTriangle className="h-4 w-4" />
                      هەڵەی کڕیار ({auditData.findings.customerMismatch.length}) — submit بەردەست نییە
                    </div>
                    <div className="space-y-1.5">
                      {auditData.findings.customerMismatch.map((f: any) => (
                        <div key={f.packageId} className="text-xs p-2 rounded bg-white/60 dark:bg-black/30">
                          <div className="font-mono font-medium mb-1">{f.packageCode}</div>
                          <div className="space-y-0.5">
                            {f.orders.map((o: any) => (
                              <div key={o.id} className="flex items-center gap-2">
                                <span className="font-mono">{o.orderCode}</span>
                                <span className="text-muted-foreground">→</span>
                                <span className="text-primary">{o.customerCode ?? '?'}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Warning: shared-tracking siblings outside batch */}
                {auditData.findings.sharedSiblingNotInBatch?.length > 0 && (
                  <div className="p-3 rounded-lg border-2 border-orange-300 bg-orange-50 dark:bg-orange-950/30">
                    <div className="font-bold text-orange-900 dark:text-orange-200 mb-2 flex items-center gap-1">
                      🔗 ئۆردەری هاوبەش لە دەرەوەی کۆمەڵە ({auditData.findings.sharedSiblingNotInBatch.length})
                    </div>
                    <div className="text-[11px] text-orange-800/80 dark:text-orange-300/80 mb-2">
                      ئەم ئۆردەرانە تراکینگیان لەگەڵ ئۆردەرەکانی ئەم کۆمەڵە هاوبەشە بەڵام لە کۆمەڵە نین. ئەگەر گەیاندن ئەنجام بدرێ بەبێ یەکخستنیان، پسوڵەیان دەرناچێ.
                    </div>
                    <div className="space-y-1.5">
                      {auditData.findings.sharedSiblingNotInBatch.map((f: any, i: number) => (
                        <div key={i} className="text-xs p-2 rounded bg-white/60 dark:bg-black/30">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="font-mono text-[10px]">{f.packageCode}</Badge>
                            <span className="text-[10px] text-muted-foreground">لە کۆمەڵە:</span>
                            <span className="font-mono">{f.orderInBatch.orderCode}</span>
                            <span className="text-primary">{f.orderInBatch.customerCode}</span>
                          </div>
                          <div className="ms-4 flex items-center gap-2">
                            <span className="text-[10px] text-muted-foreground">↳ خوشک:</span>
                            <span className="font-mono">{f.siblingOutsideBatch.orderCode}</span>
                            <span>{f.siblingOutsideBatch.productName}</span>
                            {f.siblingOutsideBatch.batchCode ? (
                              <Badge variant="secondary" className="text-[9px]">لە کۆمەڵەی {f.siblingOutsideBatch.batchCode}</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[9px]">بێ کۆمەڵە</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Warning: incomplete multi-carton orders */}
                {auditData.findings.multiCartonIncomplete?.length > 0 && (
                  <div className="p-3 rounded-lg border-2 border-blue-300 bg-blue-50 dark:bg-blue-950/30">
                    <div className="font-bold text-blue-900 dark:text-blue-200 mb-2 flex items-center gap-1">
                      📦 ئۆردەری چەند-کارتۆن کە کارتۆنی چاوەڕیی ماوە ({auditData.findings.multiCartonIncomplete.length})
                    </div>
                    <div className="text-[11px] text-blue-800/80 dark:text-blue-300/80 mb-2">
                      ئەم ئۆردەرانە ٢ کارتۆن یان زیاتر هەن، بەڵام هەموویان هێشتا تۆمار نەکراون. ڕەنگە کارتۆن لە ڕێگە بێت.
                    </div>
                    <div className="space-y-1.5">
                      {auditData.findings.multiCartonIncomplete.map((f: any) => (
                        <div key={f.orderId} className="text-xs p-2 rounded bg-white/60 dark:bg-black/30">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="font-mono text-[10px]">{f.orderCode}</Badge>
                            <span>{f.productName}</span>
                            <span className="text-primary text-[10px]">{f.customerCode}</span>
                            <span className="ms-auto font-bold">{f.cartonsRegistered}/{f.cartonsTotal}</span>
                          </div>
                          <div className="ms-4 flex flex-wrap gap-1">
                            {f.pendingTrackings.map((tn: string) => (
                              <span key={tn} className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-blue-200/60 dark:bg-blue-900/40">
                                ⏳ {tn}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <DialogFooter className="gap-2 mt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setPendingDeliveryConfirm(null);
                  setAuditData(null);
                }}
              >
                وازهێنان
              </Button>
              <Button
                disabled={auditLoading || !auditData || auditData.summary?.blocking || updateStatusMutation.isPending}
                onClick={() => {
                  if (!pendingDeliveryConfirm || !auditData) return;
                  updateStatusMutation.mutate(
                    { id: pendingDeliveryConfirm.batchId, status: pendingDeliveryConfirm.targetStatus as any },
                    {
                      onSuccess: (data) => {
                        setPendingDeliveryConfirm(null);
                        setAuditData(null);
                        onBatchStatusSuccess(data);
                      },
                      onError: (err) => {
                        setPendingDeliveryConfirm(null);
                        setAuditData(null);
                        onMutationError(err);
                      },
                    },
                  );
                }}
                className={
                  auditData?.summary?.warning && !auditData?.summary?.blocking
                    ? "bg-amber-600 hover:bg-amber-700 text-white"
                    : "bg-emerald-600 hover:bg-emerald-700 text-white"
                }
              >
                {auditData?.summary?.blocking
                  ? "پاش چاکی هەڵەی کڕیار، دووبارە هەوڵ بدە"
                  : auditData?.summary?.warning
                    ? "بەردەوام بە، دەزانم"
                    : "بەردەوام بە بۆ گەیاندن"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
