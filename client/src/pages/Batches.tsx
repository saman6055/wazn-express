import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { Plus, Layers, Plane, Ship, Eye, DollarSign, Edit, Trash2, TrendingUp, Package, Users, Calculator, BarChart3, ExternalLink, FileDown, Loader2 } from "lucide-react";
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
  const [useTieredPricing, setUseTieredPricing] = useState(false);
  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>([]);
  const [customerPricing, setCustomerPricing] = useState<CustomerPricing[]>([]);
  const [exportingBatchId, setExportingBatchId] = useState<number | null>(null);

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
  
  const { data: batches, refetch } = trpc.batches.list.useQuery();
  const { data: warehouses } = trpc.warehouses.list.useQuery({ activeOnly: true });
  const { data: countries } = trpc.countries.list.useQuery({ activeOnly: true });
  const { data: batchPackages } = trpc.batches.getPackages.useQuery(
    { batchId: selectedBatch! },
    { enabled: !!selectedBatch }
  );
  const { data: existingTiers } = trpc.batches.getPricingTiers.useQuery(
    { batchId: editingBatch?.id },
    { enabled: !!editingBatch?.id }
  );
  const { data: existingCustomerPricing } = trpc.batches.getCustomerPricing.useQuery(
    { batchId: editingBatch?.id },
    { enabled: !!editingBatch?.id }
  );
  const { data: financialSummary } = trpc.batches.getFinancialSummary.useQuery(
    { batchId: financialBatchId! },
    { enabled: !!financialBatchId }
  );
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
  
  const createMutation = trpc.batches.create.useMutation({
    onSuccess: () => {
      toast.success(t("batches.batchCreated"));
      setIsCreateOpen(false);
      resetForm();
      refetch();
    },
    onError: (error) => toast.error(error.message)
  });

  const updateMutation = trpc.batches.update.useMutation({
    onSuccess: () => {
      toast.success(t("batches.batchUpdated"));
      setIsEditOpen(false);
      setEditingBatch(null);
      resetForm();
      refetch();
    },
    onError: (error) => toast.error(error.message)
  });

  const updateStatusMutation = trpc.batches.updateStatus.useMutation({
    onSuccess: () => {
      toast.success(t("batches.statusUpdated"));
      refetch();
    },
    onError: (error) => toast.error(error.message)
  });

  const resetForm = () => {
    setShippingType("");
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
    const shippingTypeVal = formData.get("shippingType") as string;
    
    createMutation.mutate({
      batchCode: formData.get("batchCode") as string,
      originWarehouseId: parseInt(formData.get("originWarehouseId") as string),
      destinationCountryId: parseInt(formData.get("destinationCountryId") as string),
      shippingType: shippingTypeVal as "air_regular" | "air_irregular" | "sea",
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
    });
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
    });
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
              <Button><Plus className="h-4 w-4 mr-2" />{t("batches.newBatch")}</Button>
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
                        <Select name="originWarehouseId" required>
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
                        <Select name="destinationCountryId" required>
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
                      <Select name="shippingType" required onValueChange={setShippingType}>
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
                            زانیاریی فڕۆکە
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="grid gap-1.5">
                              <Label className="text-xs">ناوی خەتی تەیارە</Label>
                              <Input name="airlineName" placeholder="e.g., Turkish Airlines" className="h-9" />
                            </div>
                            <div className="grid gap-1.5">
                              <Label className="text-xs">ژمارەی گەشت</Label>
                              <Input name="flightNumber" placeholder="e.g., TK123" className="h-9" />
                            </div>
                          </div>
                          <div className="grid gap-1.5">
                            <Label className="text-xs">کۆمپانیای گەیاندن</Label>
                            <Input name="shippingCompany" placeholder="ناوی کۆمپانیا" className="h-9" />
                          </div>
                        </CardContent>
                      </Card>
                    )}
                    
                    {shippingType === "sea" && (
                      <Card className="border-cyan-100 bg-cyan-50/30">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Ship className="h-4 w-4 text-cyan-600" />
                            زانیاریی کەشتی
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="grid gap-1.5">
                              <Label className="text-xs">ناوی کەشتی</Label>
                              <Input name="vesselName" placeholder="e.g., MSC Oscar" className="h-9" />
                            </div>
                            <div className="grid gap-1.5">
                              <Label className="text-xs">ژمارەی کۆنتێنەر</Label>
                              <Input name="containerNumber" placeholder="e.g., MSCU1234567" className="h-9" />
                            </div>
                          </div>
                          <div className="grid gap-1.5">
                            <Label className="text-xs">کۆمپانیای گەیاندن</Label>
                            <Input name="shippingCompany" placeholder="ناوی کۆمپانیا" className="h-9" />
                          </div>
                        </CardContent>
                      </Card>
                    )}
                    
                    {/* Shipping Cost */}
                    {shippingType && (
                      <div className="grid gap-2">
                        <Label>کۆی کرێی گەیاندن (USD)</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                          <Input name="shippingCost" type="number" step="0.01" className="pl-7" placeholder="کۆی پارەی دەدەین بە کۆمپانیا" />
                        </div>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="departureDate">بەرواری بەڕێکەوتن</Label>
                        <Input id="departureDate" name="departureDate" type="date" />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="estimatedArrival">بەرواری گەیشتنی چاوەڕوانکراو</Label>
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
                                <Plus className="h-4 w-4 mr-2" />Add Tier
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
                            {/* Customer selector */}
                            <div className="flex gap-2">
                              <Select onValueChange={(val) => addCustomerPricing(parseInt(val))}>
                                <SelectTrigger className="flex-1">
                                  <SelectValue placeholder={t("auto.text_229840")} />
                                </SelectTrigger>
                                <SelectContent>
                                  {customers?.filter(c => !customerPricing.find(cp => cp.customerId === c.id)).map(c => (
                                    <SelectItem key={c.id} value={c.id.toString()}>
                                      {c.customerCode} - {c.fullName}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            
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
                  <TableRow key={batch.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {batch.shippingType === "sea" ? (
                          <Ship className="h-4 w-4 text-blue-600" />
                        ) : (
                          <Plane className="h-4 w-4 text-amber-600" />
                        )}
                        <span className="font-mono font-medium">{batch.batchCode}</span>
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
                            onValueChange={(value) => updateStatusMutation.mutate({ id: batch.id, status: value as any })}
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
                                  قەبارەیی
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
                ڕاپۆرتی دارایی
              </DialogTitle>
              <DialogDescription>
                شیکاریی قازانج و زیان بۆ باچ {batches?.find(b => b.id === financialBatchId)?.batchCode}
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
                        {financialSummary.shippingType === 'sea' ? 'دەریایی' : 'ئاسمانی'} • {financialSummary.totalPackages} پاکەت
                      </p>
                    </div>
                  </div>
                  <Badge variant={financialSummary.profit >= 0 ? "default" : "destructive"} className="text-lg px-4 py-2">
                    {financialSummary.profit >= 0 ? 'قازانج' : 'زیان'}: ${Math.abs(financialSummary.profit).toFixed(2)}
                  </Badge>
                </div>
                
                {/* Summary Cards */}
                <div className="grid grid-cols-4 gap-4">
                  <Card className="border-red-200 bg-gradient-to-br from-red-50 to-red-100">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-red-700 flex items-center gap-1">
                        <DollarSign className="h-4 w-4" />
                        کۆی تێچوون
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
                        کۆی داهات
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold text-green-700">${financialSummary.totalRevenue.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground mt-1">لە {financialSummary.totalPackages} پاکەت</p>
                    </CardContent>
                  </Card>
                  <Card className={`border-2 ${financialSummary.profit >= 0 ? 'border-green-500 bg-gradient-to-br from-green-100 to-emerald-100' : 'border-red-500 bg-gradient-to-br from-red-100 to-rose-100'}`}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-1">
                        <BarChart3 className="h-4 w-4" />
                        {financialSummary.profit >= 0 ? 'قازانج' : 'زیان'}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className={`text-2xl font-bold ${financialSummary.profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        ${Math.abs(financialSummary.profit).toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {financialSummary.profitMargin.toFixed(1)}% ڕێژەی قازانج
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-blue-700 flex items-center gap-1">
                        <Package className="h-4 w-4" />
                        {financialSummary.shippingType === 'sea' ? 'CBM' : 'کێش'}
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
                        {financialSummary.shippingType === 'sea' ? 'مەتری مکعەب' : 'کێشی کۆی'}
                      </p>
                    </CardContent>
                  </Card>
                </div>
                
                {/* Customer Breakdown */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      شیکاری بەپێی کڕیار
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>کڕیار</TableHead>
                          <TableHead>پاکەت</TableHead>
                          <TableHead>{financialSummary.shippingType === 'sea' ? 'CBM' : 'کێش'}</TableHead>
                          <TableHead>داهات</TableHead>
                          <TableHead className="text-right">ڕێژە</TableHead>
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
                              هیچ زانیارییەک بەردەست نییە
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
                            <Plus className="h-4 w-4 mr-2" />Add Tier
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
      </div>
    </DashboardLayout>
  );
}
