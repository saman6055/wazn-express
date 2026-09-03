import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CopyButton } from "@/components/CopyButton";
import { StatusBadge } from "@/components/ui/status-badge";
import { ZoomImage } from "@/components/ZoomImage";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { useBatches, useBatchPackages, useBatchPricingTiers, useBatchCustomerPricing, useBatchFinancialSummary } from "@/hooks/useBatches";
import { BatchShipmentInfo } from "@/components/batches/BatchShipmentInfo";
import { TrackingNumberLink } from "@/components/batches/TrackingNumberLink";
import { Plus, Layers, Plane, Ship, Eye, DollarSign, Edit, Trash2, TrendingUp, Package, Users, Calculator, BarChart3, ExternalLink, FileDown, Loader2, AlertTriangle, ShieldCheck, ChevronsUpDown, ScanLine, Archive, MapPin, Search, X, MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Link, useLocation } from "wouter";
import { partitionArchived, FINISHED_BATCH_STATUSES } from "@shared/archive";
import { BAND_CLASS, BAND_MEANING, ageLabel, batchAge } from "@shared/batchAge";
import { watchDecision, watchExplain } from "@shared/flightWatch";
import { cn } from "@/lib/utils";
import { FilteredByLinkBanner } from "@/components/FilteredByLinkBanner";
import {
  FILTER_LABEL,
  batchMatchesStatus,
  readBatchesLink,
  type Localised,
} from "@shared/listLinks";
import { batchesAwaitingShippingNumber } from "@shared/batchReminders";
import { MIN_BATCH_SEARCH_LENGTH } from "@shared/batchSearch";
import { canDeleteBatch } from "@shared/batchDeletion";
import { keepPreviousData } from "@tanstack/react-query";
import { useAuth } from "@/_core/hooks/useAuth";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";

const statusColors: Record<string, string> = {
  preparing: "bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200",
  in_transit: "bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200",
  arrived: "bg-green-100 dark:bg-green-950/40 text-green-800 dark:text-green-200",
  customs: "bg-purple-100 dark:bg-purple-950/40 text-purple-800 dark:text-purple-200",
  at_depot: "bg-teal-100 dark:bg-teal-950/40 text-teal-800 dark:text-teal-200",
  delivered: "bg-green-200 text-green-900 dark:text-green-200",
  closed: "bg-gray-100 dark:bg-gray-950/40 text-gray-800 dark:text-gray-200",
};

/**
 * Chip label for a search hit whose matching number is not visible on the
 * row. Batch code, container and AWB already show in the first cell, so a
 * match on those needs no explanation — every other kind of match does,
 * or a batch surfaced by a parcel deep inside it looks like a wrong answer.
 */
const SEARCH_MATCH_LABEL_KEYS: Record<string, string> = {
  flightNumber: "batches.matchFlight",
  vesselName: "batches.matchVessel",
  shipmentTracking: "batches.matchBatchTracking",
  parcelTracking: "batches.matchParcelTracking",
  orderTracking: "batches.matchOrderTracking",
  customer: "batches.matchCustomer",
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
    const { t, language } = useTranslation();
const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isFinancialOpen, setIsFinancialOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<any>(null);
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const userRole = user?.role;
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
  // Shipment trackings and carton count live in state rather than the form,
  // because the trackings are a growing list of chips, not one input.
  const [shipmentTrackings, setShipmentTrackings] = useState<string[]>([]);
  const [cartonCount, setCartonCount] = useState<string>("");

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
  
  const { batches, refetch, createMutation, updateMutation, updateStatusMutation, deleteMutation } = useBatches();
  const [deletingBatch, setDeletingBatch] = useState<any>(null);
  const [showArchived, setShowArchived] = useState(false);
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
  
  /**
   * After any change to a batch, refresh BOTH reads of it.
   *
   * The table has two sources now: the list, and the search. `refetch()`
   * only renews the list — so a batch found through search, edited, and
   * reopened came back from the STALE search cache, and the note (or AWB,
   * or anything) just typed looked like it had never been saved. The save
   * was fine; the row the dialog was refilled from was old.
   */
  const refreshBatchLists = () => {
    refetch();
    trpcUtilsForAudit.batches.search.invalidate();
  };

  const onBatchCreateSuccess = () => {
    toast.success(t("batches.batchCreated"));
    setIsCreateOpen(false);
    resetForm();
    refreshBatchLists();
  };
  const onBatchUpdateSuccess = () => {
    toast.success(t("batches.batchUpdated"));
    setIsEditOpen(false);
    setEditingBatch(null);
    resetForm();
    refreshBatchLists();
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
        `❌ ${pickLang(language, { ku: "هەڵە لە چاکسازی باچ", en: "Error fixing batch", ar: "خطأ في معالجة الدفعة", zh: "批次处理出错" })}\nVersion: ${diag.version || 'unknown'}\n${diag.note || ''}\nError: ${diag.error}`,
        { duration: 30000 }
      );
      refreshBatchLists();
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
        `📦 ${pickLang(language, { ku: "پاکەت", en: "Packages", ar: "الطرود", zh: "包裹" })}: ${diag.packageCount} (${diag.packagesWithOrderId} ${pickLang(language, { ku: "لینک کراون", en: "linked", ar: "مرتبطة", zh: "已关联" })}، ${diag.packagesUnlinked} ${pickLang(language, { ku: "بێ لینک", en: "unlinked", ar: "غير مرتبطة", zh: "未关联" })})`,
        `📥 ${pickLang(language, { ku: "کۆکراوە", en: "Collected", ar: "تم جمعها", zh: "已收集" })}: ${diag.phase1?.fpOrdersCollected || 0} FP, ${diag.phase1?.cmOrdersCollected || 0} CM, ${diag.phase1?.normalPkgsCollected || 0} ${pickLang(language, { ku: "پاکەت", en: "packages", ar: "طرد", zh: "包裹" })}`,
        `🧾 ${pickLang(language, { ku: "پسوڵەی نوێ", en: "New invoices", ar: "فواتير جديدة", zh: "新发票" })}: ~${totalNew}`,
        `💰 ${pickLang(language, { ku: "ئۆردەری چارجکراو", en: "Orders charged", ar: "طلبات محاسَبة", zh: "已计费订单" })}: ~${totalCharged}`,
      ];
      if (diag.phase3?.stragglersFound > 0) {
        summary.push(`⚠️ ${diag.phase3.stragglersFound} ${pickLang(language, { ku: "ئۆردەر لە Phase 3 (recovery) چاکراون", en: "orders fixed in Phase 3 (recovery)", ar: "طلبات تمت معالجتها في المرحلة 3 (الاسترداد)", zh: "订单已在第 3 阶段（恢复）处理" })}`);
      }
      // Surface Phase-2 errors as a separate toast so they don't get lost
      const phase2Errors: string[] = diag.phase2?.errors || [];
      if (phase2Errors.length > 0) {
        summary.push(`❌ ${phase2Errors.length} ${pickLang(language, { ku: "هەڵە لە Phase 2", en: "errors in Phase 2", ar: "أخطاء في المرحلة 2", zh: "第 2 阶段错误" })}`);
        toast.error(`Phase 2 Errors:\n${phase2Errors.join('\n')}`, { duration: 30000 });
      }
      toast.info(summary.join('\n'), { duration: 15000 });
    }
    refreshBatchLists();
  };

  const reprocessMutation = trpc.batches.reprocessInvoicing.useMutation({
    onSuccess: (data) => {
      const d = data?.diagnostics;
      const msg = d
        ? `✅ ${pickLang(language, { ku: "پشکنی تەواو بوو", en: "Check complete", ar: "اكتمل الفحص", zh: "检查完成" })}
📦 ${pickLang(language, { ku: "پاکەت", en: "Packages", ar: "الطرود", zh: "包裹" })}: ${d.packageCount}
🔍 ${pickLang(language, { ku: "ئۆردەری پشکنیکراو", en: "Orders checked", ar: "الطلبات المفحوصة", zh: "已检查订单" })}: ${d.ordersChecked}
✓ ${pickLang(language, { ku: "پێشتر چارجکراو", en: "Already charged", ar: "محاسَبة مسبقاً", zh: "已计费" })}: ${d.alreadyCharged}
⚠️ ${pickLang(language, { ku: "ماوە بۆ چارج", en: "Remaining to charge", ar: "متبقٍ للمحاسبة", zh: "待计费" })}: ${d.stragglersFound}
🧾 ${pickLang(language, { ku: "پسوڵەی نوێ", en: "New invoices", ar: "فواتير جديدة", zh: "新发票" })}: ${(d.recoveryFpInvoices || 0) + (d.recoveryCmInvoices || 0)}`
        : pickLang(language, { ku: "پشکنی تەواو بوو", en: "Check complete", ar: "اكتمل الفحص", zh: "检查完成" });
      toast.success(msg, { duration: 12000 });
      refreshBatchLists();
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
    setShipmentTrackings([]);
    setCartonCount("");
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
    // Batch code is optional and free-form: any code the user types is kept
    // as-is (no forced SEA/AIR format); leaving it blank lets the server
    // auto-generate one. Empty string → undefined so the server mints a code.
    const rawBatchCode = (formData.get("batchCode") as string)?.trim() || "";
    createMutation.mutate({
      batchCode: rawBatchCode || undefined,
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
      awbNumber: formData.get("awbNumber") as string || undefined,
      shipmentTrackings,
      cartonCount: cartonCount.trim() ? Number(cartonCount) : undefined,
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
      awbNumber: formData.get("awbNumber") as string || undefined,
      shipmentTrackings,
      // null clears a count that was entered and is now known to be wrong;
      // undefined would leave the old value in place.
      cartonCount: cartonCount.trim() ? Number(cartonCount) : null,
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
      // "" is a decision (the note was deleted on purpose) and must clear;
      // null means the field never reached the form, and must not touch
      // what is stored. `|| undefined` treated both as "keep", so a note
      // somebody had deliberately erased kept coming back.
      notes: formData.get("notes") === null ? undefined : (formData.get("notes") as string),
    }, { onSuccess: onBatchUpdateSuccess, onError: onMutationError });
  };

  const openEditDialog = (batch: any) => {
    setEditingBatch(batch);
    setShippingType(batch.shippingType);
    setUseTieredPricing(batch.useTieredPricing || false);
    setShipmentTrackings(Array.isArray(batch.shipmentTrackings) ? batch.shipmentTrackings : []);
    setCartonCount(batch.cartonCount != null ? String(batch.cartonCount) : "");
    setIsEditOpen(true);
  };

  /**
   * Arriving from the dashboard's reminder as /batches?edit=<id>.
   *
   * Waits for the list, because the dialog is filled from the row rather than
   * from a fetch of its own. Runs once: the id is cleared from the URL after
   * opening, so closing the dialog and refreshing does not reopen it.
   */
  useEffect(() => {
    if (!batches?.length) return;
    const asked = new URLSearchParams(window.location.search).get("edit");
    if (!asked) return;
    const batch = batches.find((b: any) => String(b.id) === asked);
    if (batch) openEditDialog(batch);
    window.history.replaceState({}, "", window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batches]);

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
      <div className="flex items-center justify-center gap-1">
        {priceText}
        {batch.hasCustomerPricing && (
          <span title={`${batch.customerPricingCount} ${t('batches.vipCustomers')}`} className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-purple-600 dark:text-purple-300 bg-purple-100 dark:bg-purple-950/40 rounded-full">
            <Users className="h-3 w-3" />
          </span>
        )}
      </div>
    );
  };

  const getUnit = (type: string) => type === "sea" ? "CBM" : "KG";

  // Split rather than filter: the summary counts above the table are taken
  // from the whole set, so hiding a delivered batch must not make the
  // "Delivered" figure drop. One shared rule, so the next section to adopt
  // this cannot answer "how old is old" differently.
  const { current: currentBatches, archived: archivedBatches } = useMemo(
    () => partitionArchived(batches ?? [], FINISHED_BATCH_STATUSES),
    [batches]
  );
  const shownBatches = showArchived ? (batches ?? []) : currentBatches;

  /**
   * A filter carried in from a dashboard figure — /batches?status=active.
   *
   * Read once, on mount, and cleared by the banner rather than by a control:
   * there is no status picker on this page, so without the banner a reader
   * would see a short list and no way back to the whole one.
   */
  const [linkFilters, setLinkFilters] = useState(() =>
    typeof window === "undefined" ? {} : readBatchesLink(window.location.search),
  );

  const visibleBatches = useMemo(
    () => shownBatches.filter((b: any) =>
      batchMatchesStatus(b.status, linkFilters.status)
      && (!linkFilters.type || linkFilters.type === "all" || b.shippingType === linkFilters.type)
    ),
    [shownBatches, linkFilters.status, linkFilters.type],
  );

  /**
   * Search, answered by the server rather than filtered here: the list this
   * page holds is one page of the newest batches, and search exists for the
   * shipment that is NOT in front of you — an older page, the archive, or a
   * batch reachable only through a parcel tracking or a customer code the
   * list rows don't carry. Debounced so typing (or a barcode scanner) does
   * not fire a query per keystroke.
   */
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(searchText.trim()), 300);
    return () => clearTimeout(handle);
  }, [searchText]);
  const searchActive = debouncedSearch.length >= MIN_BATCH_SEARCH_LENGTH;
  const searchQuery = trpc.batches.search.useQuery(
    { query: debouncedSearch },
    { enabled: searchActive, placeholderData: keepPreviousData }
  );
  // While searching, the server's answer replaces the local list. The link
  // filter and the archive split describe the unsearched list, so they stand
  // aside rather than silently hiding a hit the search just found.
  const rowsToRender: any[] = searchActive ? (searchQuery.data ?? []) : visibleBatches;

  const linkFilterLabels: Localised[] = [
    linkFilters.status && linkFilters.status !== "all"
      ? (FILTER_LABEL[linkFilters.status] ?? { ku: linkFilters.status, en: linkFilters.status, ar: linkFilters.status, zh: linkFilters.status })
      : null,
    linkFilters.type && linkFilters.type !== "all" ? FILTER_LABEL[linkFilters.type] : null,
  ].filter((v): v is Localised => Boolean(v));

  const clearLinkFilters = () => {
    setLinkFilters({});
    if (typeof window !== "undefined") history.replaceState(null, "", window.location.pathname);
  };

  // Batches that have been travelling for days with no waybill or container
  // number recorded. Nothing used to ask for these, so a shipment could reach
  // Erbil with the field still blank — staff unable to look it up with the
  // carrier, and the customer's portal page showing nothing to click.
  const awaitingNumber = useMemo(
    () => batchesAwaitingShippingNumber(batches ?? []),
    [batches]
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("batches.title")}</h1>
            <p className="text-muted-foreground">{t("batches.subtitle")}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* The two halves of the same job: you make a batch here, then you
                scan into it. The scanner already points back here when there
                is no batch yet; this is the other direction. */}
            <Button variant="outline" onClick={() => setLocation("/batch-assignment-scanner")}>
              <ScanLine className="h-4 w-4 me-2" />
              {t("batches.scanIntoBatch")}
            </Button>
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
                      <Label htmlFor="batchCode">{t("batches.batchCode")}</Label>
                      <Input id="batchCode" name="batchCode" placeholder={pickLang(language, { ku: "ئارەزوومەندانە — بەتاڵی جێبهێڵە بۆ دروستبوونی خۆکار", en: "Optional — leave blank to auto-generate", ar: "اختياري — اتركه فارغًا للتوليد التلقائي", zh: "可选 — 留空则自动生成" })} />
                      <p className="text-[11px] text-muted-foreground">{pickLang(language, { ku: "دەتوانیت کۆدی خۆت بنووسیت (بە هەر شێوەیەک) یان بەتاڵی بهێڵیت", en: "Enter your own code (any format) or leave it blank", ar: "أدخل رمزك الخاص (بأي تنسيق) أو اتركه فارغًا", zh: "可输入自己的代码（任意格式）或留空" })}</p>
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
                      <Card className="border-blue-200 dark:border-blue-800/60 bg-blue-50/50 dark:bg-blue-950/40">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Plane className="h-4 w-4 text-blue-600 dark:text-blue-400" />
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
                          <div className="grid grid-cols-2 gap-3">
                            <div className="grid gap-1.5">
                              <Label className="text-xs">{t('batches.awbNumber')}</Label>
                              <Input name="awbNumber" placeholder="176-48293011" className="h-9 font-mono" />
                            </div>
                            <div className="grid gap-1.5">
                              <Label className="text-xs">{t('batches.shippingCompany')}</Label>
                              <Input name="shippingCompany" placeholder={t('batches.companyName')} className="h-9" />
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">{t('batches.fillLaterHint')}</p>
                        </CardContent>
                      </Card>
                    )}

                    {shippingType === "sea" && (
                      <Card className="border-blue-200 dark:border-blue-800/60 bg-blue-50/50 dark:bg-blue-950/40">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Ship className="h-4 w-4 text-blue-600 dark:text-blue-400" />
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
                          <p className="text-xs text-muted-foreground">{t('batches.fillLaterHint')}</p>
                        </CardContent>
                      </Card>
                    )}

                    {shippingType && (
                      <BatchShipmentInfo
                        trackings={shipmentTrackings}
                        onTrackingsChange={setShipmentTrackings}
                        cartonCount={cartonCount}
                        onCartonCountChange={setCartonCount}
                      />
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
                      <Label htmlFor="notes">{t("batches.notes")}</Label>
                      <Input id="notes" name="notes" placeholder={t("common.notes")} />
                    </div>
                  </TabsContent>
                  
                  {/* Tab 2: Volume & Cost */}
                  <TabsContent value="volume" forceMount className="data-[state=inactive]:hidden space-y-4 mt-4">
                    {shippingType ? (
                      <>
                        <Card className="border-blue-200 dark:border-blue-800/60 bg-blue-50/50 dark:bg-blue-950/40">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Package className="h-4 w-4" />
                              {t("batches.actualMeasurements")}
                            </CardTitle>
                            <CardDescription>{t("batches.realWeightVolume")}</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-2 gap-4">
                              {shippingType !== "sea" && (
                                <div className="grid gap-2">
                                  <Label>{t("batches.actualWeight")}</Label>
                                  <Input name="actualWeightKg" type="number" step="0.01" placeholder="e.g., 17.00" />
                                </div>
                              )}
                              {shippingType === "sea" && (
                                <div className="grid gap-2">
                                  <Label>{t("batches.actualCbm")}</Label>
                                  <Input name="actualCbm" type="number" step="0.0001" placeholder="e.g., 18.0000" />
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                        
                        <Card className="border-blue-200 dark:border-blue-800/60 bg-blue-50/50 dark:bg-blue-950/40">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Calculator className="h-4 w-4" />
                              {t("batches.chargedMeasurements")}
                            </CardTitle>
                            <CardDescription>{t("batches.whatWePayFor")}</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-2 gap-4">
                              {shippingType !== "sea" && (
                                <div className="grid gap-2">
                                  <Label>{t("batches.chargedWeight")}</Label>
                                  <Input name="chargedWeightKg" type="number" step="0.01" placeholder="e.g., 20.00" />
                                </div>
                              )}
                              {shippingType === "sea" && (
                                <div className="grid gap-2">
                                  <Label>{t("batches.chargedCbm")}</Label>
                                  <Input name="chargedCbm" type="number" step="0.0001" placeholder="e.g., 20.0000" />
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                        
                        <Card className="border-blue-200 dark:border-blue-800/60 bg-blue-50/50 dark:bg-blue-950/40">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <DollarSign className="h-4 w-4" />
                              Our Cost ({t("auto.text_080d04")})
                            </CardTitle>
                            <CardDescription>{t("batches.whatWePayPerUnit")}</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="grid gap-2">
                              {shippingType !== "sea" ? (
                                <>
                                  <Label>{t("batches.costPerKg")}</Label>
                                  <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                    <Input name="costPerKg" type="number" step="0.01" className="pl-7" placeholder="e.g., 7.00" />
                                  </div>
                                </>
                              ) : (
                                <>
                                  <Label>{t("batches.costPerCbm")}</Label>
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
                              <Label className="font-semibold">{t("batches.useTieredPricing")}</Label>
                              <p className="text-sm text-muted-foreground">
                                Different prices based on customer's total {getUnit(shippingType)}
                              </p>
                            </div>
                            <Switch checked={useTieredPricing} onCheckedChange={setUseTieredPricing} />
                          </div>
                        )}
                        
                        {!useTieredPricing ? (
                          <Card className="border-blue-200 dark:border-blue-800/60 bg-blue-50/50 dark:bg-blue-950/40">
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm flex items-center gap-2">
                                <DollarSign className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                {t("batches.defaultSellingPrice")}
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="grid gap-2">
                                {shippingType !== "sea" ? (
                                  <>
                                    <Label>{t("batches.pricePerKg")}</Label>
                                    <div className="relative">
                                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                      <Input name="pricePerKg" type="number" step="0.01" className="pl-7" placeholder="e.g., 11.00" />
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <Label>{t("batches.pricePerCbm")}</Label>
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
                          <Card className="border-blue-200 dark:border-blue-800/60 bg-blue-50/50 dark:bg-blue-950/40">
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm flex items-center gap-2">
                                <Layers className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                Tiered Pricing Rules
                              </CardTitle>
                              <CardDescription>
                                Set different prices based on customer's total {getUnit(shippingType)} in this batch
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              {pricingTiers.map((tier, index) => (
                                <div key={index} className="flex items-center gap-2 p-3 border rounded-lg bg-white dark:bg-card">
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
                                      <Label className="text-xs">{t("batches.priceUsd")}</Label>
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
                                    <Trash2 className="h-4 w-4 text-red-500 dark:text-red-400" />
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
                                        <span className="font-medium text-green-600 dark:text-green-300">
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
                        <Card className="border-blue-200 dark:border-blue-800/60 bg-blue-50/50 dark:bg-blue-950/40 mt-4">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
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
                                    <CommandEmpty>{pickLang(language, { ku: "هیچ کڕیارێک نەدۆزرایەوە", en: "No customer found", ar: "لم يتم العثور على عميل", zh: "未找到客户" })}</CommandEmpty>
                                    <CommandGroup>
                                      {customers?.filter(c => !customerPricing.find(cp => cp.customerId === c.id))
                                        .slice()
                                        .sort((a, b) => (a.customerCode || "").localeCompare(b.customerCode || "", undefined, { numeric: true, sensitivity: "base" }))
                                        .map(c => (
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
                                <div key={cp.customerId} className="flex items-center gap-2 p-3 border rounded-lg bg-white dark:bg-card">
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
                                    <Trash2 className="h-4 w-4 text-red-500 dark:text-red-400" />
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
                  <Button type="button" variant="outline" onClick={() => { setIsCreateOpen(false); resetForm(); }}>{t("common.cancel")}</Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? t("common.creating") : t("batches.createBatch")}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t("batches.preparing")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{batches?.filter(b => b.status === "preparing").length || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t("batches.inTransit")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{batches?.filter(b => b.status === "in_transit").length || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t("batches.customs")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{batches?.filter(b => b.status === "customs").length || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t("batches.delivered")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{batches?.filter(b => b.status === "delivered").length || 0}</p>
            </CardContent>
          </Card>
        </div>

        {awaitingNumber.length > 0 && (
          <Card className="border-amber-200 dark:border-amber-800/60 bg-amber-50/50 dark:bg-amber-950/40">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {t("batches.awaitingNumberTitle", { count: awaitingNumber.length })}
                  </p>
                  <p className="text-sm text-muted-foreground mb-3">
                    {t("batches.awaitingNumberDesc")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {awaitingNumber.slice(0, 8).map((batch: any) => (
                      <Button
                        key={batch.id}
                        size="sm"
                        variant={batch.severity === "urgent" ? "default" : "outline"}
                        className={batch.severity === "urgent" ? "bg-amber-600 hover:bg-amber-700" : ""}
                        onClick={() => openEditDialog(batch)}
                      >
                        <span className="font-mono">{batch.batchCode}</span>
                        <Badge variant="secondary" className="ms-2">
                          {t("batches.daysWaiting", { count: batch.daysWaiting })}
                        </Badge>
                      </Button>
                    ))}
                    {awaitingNumber.length > 8 && (
                      <span className="self-center text-sm text-muted-foreground">
                        {t("batches.andMore", { count: awaitingNumber.length - 8 })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="pt-6">
            {/* One box for whichever number the phone call gave you: batch
                code, container, AWB, flight, vessel, the batch's own courier
                trackings, a parcel's tracking, an order's tracking, or a
                customer code. */}
            <div className="mb-4 space-y-2">
              <div className="relative max-w-xl">
                <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder={t("batches.searchPlaceholder")}
                  className="ps-9 pe-9"
                />
                {searchText && (
                  <button
                    type="button"
                    onClick={() => setSearchText("")}
                    className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={t("common.cancel")}
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              {searchActive && searchQuery.error && (
                <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span className="break-all">{t("batches.searchFailed")}: {searchQuery.error.message}</span>
                  <CopyButton value={searchQuery.error.message} label={t("batches.searchFailed")} />
                </div>
              )}
              {searchActive && !searchQuery.error && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  {searchQuery.isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {searchQuery.data !== undefined && (
                    <span>{t("batches.searchResultsCount", { count: rowsToRender.length })}</span>
                  )}
                </p>
              )}
            </div>

            {/* The link filter and the archive split describe the unsearched
                list; while a search is typed they stand aside. */}
            {!searchActive && (
              <>
                {/* Why the table arrived short, when it came from a dashboard figure */}
                <FilteredByLinkBanner filters={linkFilterLabels} onClear={clearLinkFilters} />

                {/* Finished shipments drop out of the table but stay in the counts
                    above — sixteen delivered batches were burying the four that
                    anyone was actually working on. */}
                {archivedBatches.length > 0 && (
                  <div className="flex items-center justify-between gap-2 mb-4 text-sm">
                    <span className="text-muted-foreground">
                      {t("batches.archivedHidden", { count: archivedBatches.length })}
                    </span>
                    <Button variant="outline" size="sm" onClick={() => setShowArchived((v) => !v)}>
                      <Archive className="h-4 w-4 me-2" />
                      {showArchived ? t("batches.hideArchived") : t("batches.showArchived")}
                    </Button>
                  </div>
                )}
              </>
            )}
            <Table pageSticky>
              {/* Header and cell share one alignment per column: text columns
                  start-aligned, everything numeric or badge-shaped centered —
                  a header pointing one way over content pointing another was
                  half of what made the table look crooked. Status and alert
                  are one column now; they were always read together. */}
              <TableHeader>
                <TableRow>
                  <TableHead>{t("batches.batchCode")}</TableHead>
                  <TableHead>{t("batches.origin")} → {t("batches.destination")}</TableHead>
                  <TableHead className="text-center">{t("batches.shippingType")}</TableHead>
                  <TableHead className="text-center">{t("common.price")}</TableHead>
                  <TableHead className="text-center">{t("batches.packages")}</TableHead>
                  <TableHead className="text-center">{t("batches.departureDate")}</TableHead>
                  <TableHead className="text-center">{t("common.status")}</TableHead>
                  <TableHead className="text-center">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rowsToRender.map((batch) => (
                  <TableRow
                    key={batch.id}
                    className="transition-colors hover:bg-blue-50/60 dark:hover:bg-blue-950/30 hover:ring-2 hover:ring-inset hover:ring-blue-400/50"
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {batch.shippingType === "sea" ? (
                          <Ship className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-300" />
                        ) : (
                          <Plane className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" />
                        )}
                        <span className="font-mono font-medium whitespace-nowrap">{batch.batchCode}</span>
                        <CopyButton value={batch.batchCode} label={pickLang(language, { ku: "کۆپی کۆدی باچ", en: "Copy batch code", ar: "نسخ رمز الدفعة", zh: "复制批次代码" })} />
                      </div>
                      {/* Everything else about the shipment sits on ONE
                          wrapping chip line. Stacked one-per-line, five short
                          facts made every row five lines tall and the rest of
                          the table was mostly empty space. */}
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        {/* Why this row is in the search results, when the
                            matching number is nowhere on it. */}
                        {(() => {
                          const match = batch.matchedBy;
                          if (!match) return null;
                          const labelKey = SEARCH_MATCH_LABEL_KEYS[match.kind === "field" ? match.field : match.kind];
                          if (!labelKey) return null;
                          return (
                            <Badge variant="secondary" className="max-w-[260px] px-1.5 py-0 text-[10px] font-normal">
                              <span className="shrink-0">{t(labelKey)}:</span>
                              <span className="ms-1 truncate font-mono" dir="ltr">{match.value}</span>
                            </Badge>
                          );
                        })()}
                        {/* Where the work was done — Guangzhou or Erbil. */}
                        {batch.createdInCity && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
                            <MapPin className="h-3 w-3 me-1" />
                            {batch.createdInCity}
                          </Badge>
                        )}
                        {/* How long this one has been open. */}
                        {(() => {
                          const age = batchAge(batch as never);
                          if (age.band === "settled") return null;
                          return (
                            <span
                              className={cn("inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap", BAND_CLASS[age.band])}
                              title={pickLang(language, BAND_MEANING[age.band])}
                            >
                              {pickLang(language, ageLabel(age.days))}
                            </span>
                          );
                        })()}
                        {/* Whether the airport is being checked for this
                            batch, and if not, why not. Quiet reasons stay
                            grey; the two that need somebody stay loud. */}
                        {(() => {
                          const decision = watchDecision(batch as never, new Date());
                          const explain = watchExplain(decision);
                          if (!explain.needsAction && !decision.watch) {
                            return (
                              <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                {pickLang(language, explain.text)}
                              </span>
                            );
                          }
                          return (
                            <span
                              className={cn(
                                "inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap",
                                explain.needsAction
                                  ? "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200"
                                  : "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200"
                              )}
                            >
                              {pickLang(language, explain.text)}
                            </span>
                          );
                        })()}
                        {/* One click from the list to wherever the carrier
                            says the shipment is. */}
                        {(batch.awbNumber || batch.containerNumber) && (
                          <span className="text-xs">
                            <TrackingNumberLink
                              kind={batch.containerNumber ? "container" : "awb"}
                              value={batch.containerNumber || batch.awbNumber}
                              shippingCompany={batch.shippingCompany}
                            />
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {/* Isolated LTR so "A → B" keeps its direction inside
                          an RTL row instead of reading back to front. */}
                      <span dir="ltr" className="whitespace-nowrap [unicode-bidi:isolate]">
                        {getWarehouseName(batch.originWarehouseId)} → {getCountryName(batch.destinationCountryId)}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="capitalize">
                        {batch.shippingType.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="font-medium text-green-600 dark:text-green-300">{formatPrice(batch)}</span>
                    </TableCell>
                    <TableCell className="text-center font-mono tabular-nums" dir="ltr">{batch.packageCount ?? 0}</TableCell>
                    <TableCell className="text-center font-mono tabular-nums whitespace-nowrap" dir="ltr">
                      {batch.departureDate ? new Date(batch.departureDate).toLocaleDateString() : "-"}
                    </TableCell>
                    {/* Status and its alert in one column — the two badges
                        are one piece of news and were always read together. */}
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        <StatusBadge status={batch.status} kind="batch" />
                      {(() => {
                        const isCompleted = batch.status === "arrived" || batch.status === "delivered" || batch.status === "closed";
                        if (isCompleted) {
                          return <Badge variant="outline" className="bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800/60">{t("auto.text_4c0d23")} </Badge>;
                        }
                        
                        if (batch.estimatedArrival) {
                          const eta = new Date(batch.estimatedArrival);
                          const now = new Date();
                          const daysOverdue = Math.floor((now.getTime() - eta.getTime()) / (1000 * 60 * 60 * 24));
                          const daysUntil = Math.floor((eta.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                          
                          if (daysOverdue > 5) {
                            return <Badge variant="destructive" className="animate-pulse">🔴 {daysOverdue} ڕ{t("auto.text_d4f9af")}</Badge>;
                          } else if (daysOverdue > 0) {
                            return <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60">⚠️ {daysOverdue} ڕ{t("auto.text_d4f9af")}</Badge>;
                          } else if (daysUntil <= 2) {
                            return <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/60">⏰ {daysUntil} ڕ{t("auto.text_60c814")}</Badge>;
                          }
                        }
                        
                        if (batch.departureDate) {
                          const departure = new Date(batch.departureDate);
                          const now = new Date();
                          const daysSince = Math.floor((now.getTime() - departure.getTime()) / (1000 * 60 * 60 * 24));
                          
                          if (daysSince > 30) {
                            return <Badge variant="destructive" className="animate-pulse">🔴 {daysSince} ڕ{t("auto.text_0145a3")}</Badge>;
                          } else if (daysSince > 15) {
                            return <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60">⚠️ {daysSince} ڕ{t("auto.text_0145a3")}</Badge>;
                          }
                          return <Badge variant="outline" className="bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800/60">✅ {daysSince} ڕ{t("auto.text_0145a3")}</Badge>;
                        }
                        
                        return <Badge variant="outline" className="bg-gray-50 dark:bg-gray-950/40 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-800/60">{t("auto.text_ed2a98")} </Badge>;
                      })()}
                      </div>
                    </TableCell>
                    {/* Daily actions stay visible: see the parcels, edit,
                        move the status. Everything occasional lives in one
                        ⋯ menu — eight buttons per row were what pushed the
                        table past the edge of the screen. */}
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setSelectedBatch(batch.id)} title={t("batches.viewPackages")}>
                          <Eye className="h-4 w-4" />
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
                                  toast.error(e?.message || pickLang(language, { ku: "هەڵە لە audit", en: "Audit error", ar: "خطأ في التدقيق", zh: "审计错误" }));
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
                              <SelectItem value="preparing">{t("batches.preparing")}</SelectItem>
                              <SelectItem value="in_transit">{t("batches.inTransit")}</SelectItem>
                              <SelectItem value="arrived">{t("batches.arrived")}</SelectItem>
                              <SelectItem value="customs">{t("batches.customs")}</SelectItem>
                              <SelectItem value="at_depot">{t("batches.atDepot")}</SelectItem>
                              <SelectItem value="delivered">{t("batches.delivered")}</SelectItem>
                              <SelectItem value="closed">{t("batches.closed")}</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" title={t("common.actions")}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {/* Straight to the scanner with this batch already
                                chosen — picking it again from a long dropdown
                                is the step people get wrong. Only while it is
                                still open. */}
                            {(batch.status === "preparing" || batch.status === "in_transit") && (
                              <DropdownMenuItem onClick={() => setLocation(`/batch-assignment-scanner?batch=${batch.id}`)}>
                                <ScanLine className="h-4 w-4 me-2" />
                                {t("batches.scanIntoThisBatch")}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => setLocation(`/batches/${batch.id}/financial`)}>
                              <BarChart3 className="h-4 w-4 me-2" />
                              {t("batches.financialReport")}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={exportingBatchId === batch.id}
                              onClick={() => handleExportBatchPDF(batch.id)}
                            >
                              {exportingBatchId === batch.id ? (
                                <Loader2 className="h-4 w-4 me-2 animate-spin" />
                              ) : (
                                <FileDown className="h-4 w-4 me-2" />
                              )}
                              {t("common.exportPdf")}
                            </DropdownMenuItem>
                            {(batch.status === "delivered" || batch.status === "closed") && (
                              <DropdownMenuItem
                                disabled={reprocessMutation.isPending}
                                onClick={() => {
                                  if (window.confirm(pickLang(language, { ku: "دووبارە چارجکردنی ئۆردەرە چارج نەکراوەکانی ئەم باچە؟ (Idempotent)", en: "Re-charge the uncharged orders of this batch? (Idempotent)", ar: "إعادة محاسبة الطلبات غير المحاسَبة في هذه الدفعة؟ (عملية متكررة آمنة)", zh: "重新对该批次未计费的订单计费？（幂等）" }))) {
                                    reprocessMutation.mutate({ batchId: batch.id });
                                  }
                                }}
                              >
                                <ShieldCheck className="h-4 w-4 me-2" />
                                {pickLang(language, { ku: "دووبارە پرۆسێسکردنی پسوڵەکان", en: "Reprocess invoices", ar: "إعادة معالجة الفواتير", zh: "重新处理发票" })}
                              </DropdownMenuItem>
                            )}
                            {/* Only offered for an empty batch — the server
                                counts the rows itself and refuses if anything
                                at all is attached. */}
                            {canDeleteBatch({
                              role: userRole,
                              status: batch.status,
                              createdAt: batch.createdAt,
                              ties: { invoices: 0, deliveryBoxes: 0, fullPackageOrders: 0 },
                            }).allowed && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
                                  onClick={() => setDeletingBatch(batch)}
                                >
                                  <Trash2 className="h-4 w-4 me-2" />
                                  {t("batches.deleteBatch")}
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {searchActive && !searchQuery.isFetching && !searchQuery.error && rowsToRender.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      {t("batches.searchNoResults", { query: debouncedSearch })}
                    </TableCell>
                  </TableRow>
                )}
                {!searchActive && (!batches || batches.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No batches created yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <AlertDialog open={!!deletingBatch} onOpenChange={(open) => !open && setDeletingBatch(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500 dark:text-red-400" />
                {t("batches.deleteBatch")}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t("batches.deleteBatchWarning", { code: deletingBatch?.batchCode ?? "" })}
                {deletingBatch?.packageCount ? (
                  <span className="mt-2 block font-medium">
                    {t("batches.deleteReleasesPackages", { count: deletingBatch.packageCount })}
                  </span>
                ) : null}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700"
                disabled={deleteMutation.isPending}
                onClick={async (e) => {
                  // The dialog must survive a refusal: the server rejects a
                  // batch that has anything attached, and naming what is in
                  // the way is the whole point of asking.
                  e.preventDefault();
                  if (!deletingBatch) return;
                  try {
                    await deleteMutation.mutateAsync({ id: deletingBatch.id });
                    toast.success(t("batches.batchDeleted", { code: deletingBatch.batchCode }));
                    setDeletingBatch(null);
                    refreshBatchLists();
                  } catch (error: any) {
                    toast.error(error?.message || t("common.error"));
                  }
                }}
              >
                {deleteMutation.isPending ? "..." : t("forms.delete")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Batch Packages Dialog. Wide on purpose: at 2xl the table was cut
            off sideways and read through a scrollbar; every column the row
            has must be visible at once. */}
        <Dialog open={!!selectedBatch} onOpenChange={(open) => !open && setSelectedBatch(null)}>
          <DialogContent className="max-w-5xl">
            <DialogHeader>
              <DialogTitle>{t("batches.batchPackages")}</DialogTitle>
              <DialogDescription>
                {/* A batch opened from a search hit may not be in the list
                    page at all, so look in what the table is showing too. */}
                Packages in batch {(batches?.find(b => b.id === selectedBatch) ?? rowsToRender.find((b: any) => b.id === selectedBatch))?.batchCode}
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[70vh] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("batches.packageCode")}</TableHead>
                    <TableHead>{t("packages.trackingNumber")}</TableHead>
                    <TableHead>{t("batches.customer")}</TableHead>
                    <TableHead>{t("batches.weight")}</TableHead>
                    <TableHead>{t("common.status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batchPackages?.map((pkg) => (
                    <TableRow key={pkg.id}>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <span className="font-mono">{pkg.packageCode}</span>
                          <CopyButton value={pkg.packageCode} label={t("common.copy")} />
                        </div>
                      </TableCell>
                      {/* The number the customer and the courier both quote —
                          it was reachable only by opening the parcel itself,
                          and it is copied constantly, so the icon sits here. */}
                      <TableCell>
                        {pkg.trackingNumber ? (
                          <div className="flex items-center gap-1">
                            <span className="font-mono" dir="ltr">{pkg.trackingNumber}</span>
                            <CopyButton value={pkg.trackingNumber} label={t("common.copy")} />
                          </div>
                        ) : (
                          "-"
                        )}
                      </TableCell>
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
                                <Badge variant="outline" className="text-[10px] px-1 py-0 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300 border-purple-200 dark:border-purple-800/60">
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
                      <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
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
                      {financialSummary.shippingType === 'sea' ? <Ship className="h-6 w-6 text-cyan-600 dark:text-cyan-300" /> : <Plane className="h-6 w-6 text-blue-600 dark:text-blue-300" />}
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
                  <Card className="border-red-200 dark:border-red-800/60 bg-gradient-to-br from-red-50 dark:from-red-950/40 to-red-100 dark:to-red-900/40">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-red-700 dark:text-red-300 flex items-center gap-1">
                        <DollarSign className="h-4 w-4" />
                        {t('batches.totalCost')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold text-red-700 dark:text-red-300">${financialSummary.totalCost.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {financialSummary.shippingType === 'sea' 
                          ? `${financialSummary.chargedCbm} CBM × $${financialSummary.costPerCbm}`
                          : `${financialSummary.chargedWeight} KG × $${financialSummary.costPerKg}`
                        }
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border-green-200 dark:border-green-800/60 bg-gradient-to-br from-green-50 dark:from-green-950/40 to-green-100 dark:to-green-900/40">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-green-700 dark:text-green-300 flex items-center gap-1">
                        <TrendingUp className="h-4 w-4" />
                        {t('batches.totalRevenue')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold text-green-700 dark:text-green-300">${financialSummary.totalRevenue.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground mt-1">{t('batches.fromPackages', { count: financialSummary.totalPackages })}</p>
                    </CardContent>
                  </Card>
                  <Card className={`border-2 ${financialSummary.profit >= 0 ? 'border-green-500 bg-gradient-to-br from-green-100 dark:from-green-900/40 to-emerald-100 dark:to-emerald-900/40' : 'border-red-500 bg-gradient-to-br from-red-100 dark:from-red-900/40 to-rose-100 dark:to-rose-900/40'}`}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-1">
                        <BarChart3 className="h-4 w-4" />
                        {financialSummary.profit >= 0 ? t('batches.profit') : t('batches.loss')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className={`text-2xl font-bold ${financialSummary.profit >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                        ${Math.abs(financialSummary.profit).toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {financialSummary.profitMargin.toFixed(1)}% {t('batches.profitMargin')}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border-blue-200 dark:border-blue-800/60 bg-gradient-to-br from-blue-50 dark:from-blue-950/40 to-blue-100 dark:to-blue-900/40">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-blue-700 dark:text-blue-300 flex items-center gap-1">
                        <Package className="h-4 w-4" />
                        {financialSummary.shippingType === 'sea' ? t('batches.cbm') : t('batches.weight')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
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
                              <TableCell className="font-medium text-green-600 dark:text-green-300">
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
              <DialogTitle>{t("batches.editBatch")}</DialogTitle>
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
                      <Label>{t("batches.batchCode")}</Label>
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
                      <Label>{t("batches.carrierInfo")}</Label>
                      <Input name="carrierInfo" defaultValue={editingBatch.carrierInfo || ""} />
                    </div>

                    {/*
                      The air waybill / container number and the flight or
                      vessel are almost never known when a batch is created —
                      the cartons are still being filled. They were only ever
                      offered on the create form, so once a batch existed
                      there was no way to record them at all.
                    */}
                    {editingBatch.shippingType !== "sea" ? (
                      <Card className="border-blue-200 dark:border-blue-800/60 bg-blue-50/50 dark:bg-blue-950/40">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Plane className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            {t("batches.flightInfo")}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="grid gap-1.5">
                              <Label className="text-xs">{t("batches.flightName")}</Label>
                              <Input name="airlineName" defaultValue={editingBatch.airlineName || ""} className="h-9" />
                            </div>
                            <div className="grid gap-1.5">
                              <Label className="text-xs">{t("batches.flightNumber")}</Label>
                              <Input name="flightNumber" defaultValue={editingBatch.flightNumber || ""} className="h-9" />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="grid gap-1.5">
                              <Label className="text-xs">{t("batches.awbNumber")}</Label>
                              <Input name="awbNumber" defaultValue={editingBatch.awbNumber || ""} placeholder="176-48293011" className="h-9 font-mono" />
                            </div>
                            <div className="grid gap-1.5">
                              <Label className="text-xs">{t("batches.shippingCompany")}</Label>
                              <Input name="shippingCompany" defaultValue={editingBatch.shippingCompany || ""} className="h-9" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ) : (
                      <Card className="border-blue-200 dark:border-blue-800/60 bg-blue-50/50 dark:bg-blue-950/40">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Ship className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            {t("batches.seaInfo")}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="grid gap-1.5">
                              <Label className="text-xs">{t("batches.shipName")}</Label>
                              <Input name="vesselName" defaultValue={editingBatch.vesselName || ""} className="h-9" />
                            </div>
                            <div className="grid gap-1.5">
                              <Label className="text-xs">{t("batches.containerNumber")}</Label>
                              <Input name="containerNumber" defaultValue={editingBatch.containerNumber || ""} placeholder="MSCU1234567" className="h-9 font-mono" />
                            </div>
                          </div>
                          <div className="grid gap-1.5">
                            <Label className="text-xs">{t("batches.shippingCompany")}</Label>
                            <Input name="shippingCompany" defaultValue={editingBatch.shippingCompany || ""} className="h-9" />
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    <BatchShipmentInfo
                      trackings={shipmentTrackings}
                      onTrackingsChange={setShipmentTrackings}
                      cartonCount={cartonCount}
                      onCartonCountChange={setCartonCount}
                      pieceCount={editingBatch.totalPackages ?? 0}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>{t("batches.departureDate")}</Label>
                        <Input name="departureDate" type="date" defaultValue={editingBatch.departureDate ? new Date(editingBatch.departureDate).toISOString().split('T')[0] : ""} />
                      </div>
                      <div className="grid gap-2">
                        <Label>{t("batches.estimatedArrival")}</Label>
                        <Input name="estimatedArrival" type="date" defaultValue={editingBatch.estimatedArrival ? new Date(editingBatch.estimatedArrival).toISOString().split('T')[0] : ""} />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label>{t("batches.notes")}</Label>
                      <Input name="notes" defaultValue={editingBatch.notes || ""} />
                    </div>
                  </TabsContent>
                  
                  {/* Tab 2: Volume & Cost */}
                  <TabsContent value="volume" forceMount className="data-[state=inactive]:hidden space-y-4 mt-4">
                    <Card className="border-blue-200 dark:border-blue-800/60 bg-blue-50/50 dark:bg-blue-950/40">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Package className="h-4 w-4" />
                          {t("batches.actualMeasurements")}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4">
                          {editingBatch.shippingType !== "sea" && (
                            <div className="grid gap-2">
                              <Label>{t("batches.actualWeight")}</Label>
                              <Input name="actualWeightKg" type="number" step="0.01" defaultValue={editingBatch.actualWeightKg || ""} />
                            </div>
                          )}
                          {editingBatch.shippingType === "sea" && (
                            <div className="grid gap-2">
                              <Label>{t("batches.actualCbm")}</Label>
                              <Input name="actualCbm" type="number" step="0.0001" defaultValue={editingBatch.actualCbm || ""} />
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card className="border-blue-200 dark:border-blue-800/60 bg-blue-50/50 dark:bg-blue-950/40">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Calculator className="h-4 w-4" />
                          {t("batches.chargedMeasurements")}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4">
                          {editingBatch.shippingType !== "sea" && (
                            <div className="grid gap-2">
                              <Label>{t("batches.chargedWeight")}</Label>
                              <Input name="chargedWeightKg" type="number" step="0.01" defaultValue={editingBatch.chargedWeightKg || ""} />
                            </div>
                          )}
                          {editingBatch.shippingType === "sea" && (
                            <div className="grid gap-2">
                              <Label>{t("batches.chargedCbm")}</Label>
                              <Input name="chargedCbm" type="number" step="0.0001" defaultValue={editingBatch.chargedCbm || ""} />
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card className="border-blue-200 dark:border-blue-800/60 bg-blue-50/50 dark:bg-blue-950/40">
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
                              <Label>{t("batches.costPerKg")}</Label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                <Input name="costPerKg" type="number" step="0.01" className="pl-7" defaultValue={editingBatch.costPerKg || ""} />
                              </div>
                            </>
                          ) : (
                            <>
                              <Label>{t("batches.costPerCbm")}</Label>
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
                          <Label className="font-semibold">{t("batches.useTieredPricing")}</Label>
                          <p className="text-sm text-muted-foreground">
                            Different prices based on customer's total {getUnit(editingBatch.shippingType)}
                          </p>
                        </div>
                        <Switch checked={useTieredPricing} onCheckedChange={setUseTieredPricing} />
                      </div>
                    )}
                    
                    {!useTieredPricing ? (
                      <Card className="border-blue-200 dark:border-blue-800/60 bg-blue-50/50 dark:bg-blue-950/40">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            {t("batches.defaultSellingPrice")}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid gap-2">
                            {editingBatch.shippingType !== "sea" ? (
                              <>
                                <Label>{t("batches.pricePerKg")}</Label>
                                <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                  <Input name="pricePerKg" type="number" step="0.01" className="pl-7" defaultValue={editingBatch.pricePerKg || ""} />
                                </div>
                              </>
                            ) : (
                              <>
                                <Label>{t("batches.pricePerCbm")}</Label>
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
                      <Card className="border-blue-200 dark:border-blue-800/60 bg-blue-50/50 dark:bg-blue-950/40">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Layers className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            Tiered Pricing Rules
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {pricingTiers.map((tier, index) => (
                            <div key={index} className="flex items-center gap-2 p-3 border rounded-lg bg-white dark:bg-card">
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
                                  <Label className="text-xs">{t("batches.priceUsd")}</Label>
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
                                <Trash2 className="h-4 w-4 text-red-500 dark:text-red-400" />
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
                  <Button type="button" variant="outline" onClick={() => { setIsEditOpen(false); setEditingBatch(null); resetForm(); }}>{t("common.cancel")}</Button>
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
                  <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-300" />
                ) : auditData?.summary?.warning ? (
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-300" />
                ) : (
                  <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
                )}
                {pickLang(language, { ku: "پێش-پشکنینی گەیاندن", en: "Pre-delivery audit", ar: "تدقيق ما قبل التسليم", zh: "交付前审核" })}
                {auditData && <Badge variant="outline" className="font-mono">{auditData.batchCode}</Badge>}
              </DialogTitle>
              <DialogDescription>
                {pendingDeliveryConfirm?.targetStatus === "delivered"
                  ? pickLang(language, { ku: "پێش گۆڕینی دۆخی کۆمەڵە بۆ Delivered، تکایە ئەم پشکنینە سەیر بکە.", en: "Before changing the batch status to Delivered, please review this audit.", ar: "قبل تغيير حالة الدفعة إلى تم التسليم، يرجى مراجعة هذا التدقيق.", zh: "在将批次状态更改为“已交付”之前，请查看此审核。" })
                  : pickLang(language, { ku: "پێش داخستنی کۆمەڵە، تکایە ئەم پشکنینە سەیر بکە.", en: "Before closing the batch, please review this audit.", ar: "قبل إغلاق الدفعة، يرجى مراجعة هذا التدقيق.", zh: "在关闭批次之前，请查看此审核。" })}
              </DialogDescription>
            </DialogHeader>

            {auditLoading || !auditData ? (
              <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">{pickLang(language, { ku: "پشکنین جێبەجێ دەکرێ...", en: "Running audit...", ar: "جارٍ تنفيذ التدقيق...", zh: "正在执行审核..." })}</span>
              </div>
            ) : (
              <div className="space-y-4 text-sm">
                {/* Summary tile */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded border bg-muted/30">
                    <div className="text-[11px] text-muted-foreground">{pickLang(language, { ku: "پاکەت لە کۆمەڵە", en: "Packages in batch", ar: "الطرود في الدفعة", zh: "批次中的包裹" })}</div>
                    <div className="font-bold text-lg">{auditData.packageCount}</div>
                  </div>
                  <div className="p-2 rounded border bg-muted/30">
                    <div className="text-[11px] text-muted-foreground">{pickLang(language, { ku: "ئۆردەری گرێدراو", en: "Linked orders", ar: "الطلبات المرتبطة", zh: "已关联订单" })}</div>
                    <div className="font-bold text-lg">{auditData.orderCount}</div>
                  </div>
                </div>

                {/* No findings — green light */}
                {!auditData.summary.blocking && !auditData.summary.warning && (
                  <div className="p-3 rounded-lg border border-emerald-300 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/30 flex items-center gap-2 text-emerald-800 dark:text-emerald-200">
                    <ShieldCheck className="h-4 w-4" />
                    <span className="font-semibold">{pickLang(language, { ku: "هیچ هەشداریەک نییە — کۆمەڵە ئامادەیە", en: "No warnings — batch is ready", ar: "لا توجد تحذيرات — الدفعة جاهزة", zh: "无警告 — 批次已就绪" })}</span>
                  </div>
                )}

                {/* Blocking: customer mismatch */}
                {auditData.findings.customerMismatch?.length > 0 && (
                  <div className="p-3 rounded-lg border-2 border-rose-300 dark:border-rose-800/60 bg-rose-50 dark:bg-rose-950/30">
                    <div className="font-bold text-rose-900 dark:text-rose-200 mb-2 flex items-center gap-1">
                      <AlertTriangle className="h-4 w-4" />
                      {pickLang(language, { ku: "هەڵەی کڕیار", en: "Customer mismatch", ar: "عدم تطابق العميل", zh: "客户不匹配" })} ({auditData.findings.customerMismatch.length}) — {pickLang(language, { ku: "submit بەردەست نییە", en: "submit unavailable", ar: "الإرسال غير متاح", zh: "无法提交" })}
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
                  <div className="p-3 rounded-lg border-2 border-orange-300 dark:border-orange-800/60 bg-orange-50 dark:bg-orange-950/30">
                    <div className="font-bold text-orange-900 dark:text-orange-200 mb-2 flex items-center gap-1">
                      🔗 {pickLang(language, { ku: "ئۆردەری هاوبەش لە دەرەوەی کۆمەڵە", en: "Shared orders outside the batch", ar: "طلبات مشتركة خارج الدفعة", zh: "批次外的共享订单" })} ({auditData.findings.sharedSiblingNotInBatch.length})
                    </div>
                    <div className="text-[11px] text-orange-800/80 dark:text-orange-300/80 mb-2">
                      {pickLang(language, { ku: "ئەم ئۆردەرانە تراکینگیان لەگەڵ ئۆردەرەکانی ئەم کۆمەڵە هاوبەشە بەڵام لە کۆمەڵە نین. ئەگەر گەیاندن ئەنجام بدرێ بەبێ یەکخستنیان، پسوڵەیان دەرناچێ.", en: "These orders share tracking with orders in this batch but are not in the batch. If delivery is done without consolidating them, no invoice will be issued for them.", ar: "تشترك هذه الطلبات في التتبع مع طلبات هذه الدفعة لكنها ليست ضمنها. إذا تم التسليم دون دمجها، فلن تصدر لها فاتورة.", zh: "这些订单与本批次的订单共享物流单号，但不在批次内。若未合并即交付，将不会为其开具发票。" })}
                    </div>
                    <div className="space-y-1.5">
                      {auditData.findings.sharedSiblingNotInBatch.map((f: any, i: number) => (
                        <div key={i} className="text-xs p-2 rounded bg-white/60 dark:bg-black/30">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="font-mono text-[10px]">{f.packageCode}</Badge>
                            <span className="text-[10px] text-muted-foreground">{pickLang(language, { ku: "لە کۆمەڵە:", en: "In batch:", ar: "في الدفعة:", zh: "批次内：" })}</span>
                            <span className="font-mono">{f.orderInBatch.orderCode}</span>
                            <span className="text-primary">{f.orderInBatch.customerCode}</span>
                          </div>
                          <div className="ms-4 flex items-center gap-2">
                            <span className="text-[10px] text-muted-foreground">↳ {pickLang(language, { ku: "خوشک:", en: "Sibling:", ar: "شقيق:", zh: "同组：" })}</span>
                            <span className="font-mono">{f.siblingOutsideBatch.orderCode}</span>
                            <span>{f.siblingOutsideBatch.productName}</span>
                            {f.siblingOutsideBatch.batchCode ? (
                              <Badge variant="secondary" className="text-[9px]">{pickLang(language, { ku: "لە کۆمەڵەی", en: "In batch", ar: "في الدفعة", zh: "在批次" })} {f.siblingOutsideBatch.batchCode}</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[9px]">{pickLang(language, { ku: "بێ کۆمەڵە", en: "No batch", ar: "بدون دفعة", zh: "无批次" })}</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Warning: incomplete multi-carton orders */}
                {auditData.findings.multiCartonIncomplete?.length > 0 && (
                  <div className="p-3 rounded-lg border-2 border-blue-300 dark:border-blue-800/60 bg-blue-50 dark:bg-blue-950/30">
                    <div className="font-bold text-blue-900 dark:text-blue-200 mb-2 flex items-center gap-1">
                      📦 {pickLang(language, { ku: "ئۆردەری چەند-کارتۆن کە کارتۆنی چاوەڕیی ماوە", en: "Multi-carton orders with cartons still pending", ar: "طلبات متعددة الكراتين لا تزال بعض كراتينها معلّقة", zh: "仍有纸箱待处理的多箱订单" })} ({auditData.findings.multiCartonIncomplete.length})
                    </div>
                    <div className="text-[11px] text-blue-800/80 dark:text-blue-300/80 mb-2">
                      {pickLang(language, { ku: "ئەم ئۆردەرانە ٢ کارتۆن یان زیاتر هەن، بەڵام هەموویان هێشتا تۆمار نەکراون. ڕەنگە کارتۆن لە ڕێگە بێت.", en: "These orders have 2 or more cartons, but not all of them have been registered yet. A carton may still be in transit.", ar: "تحتوي هذه الطلبات على كرتونين أو أكثر، لكن لم يتم تسجيلها جميعاً بعد. قد يكون أحد الكراتين لا يزال في الطريق.", zh: "这些订单有 2 个或更多纸箱，但尚未全部登记。可能仍有纸箱在途中。" })}
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
                {pickLang(language, { ku: "وازهێنان", en: "Cancel", ar: "إلغاء", zh: "取消" })}
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
                  ? pickLang(language, { ku: "پاش چاکی هەڵەی کڕیار، دووبارە هەوڵ بدە", en: "Fix the customer mismatch, then try again", ar: "صحّح عدم تطابق العميل ثم حاول مرة أخرى", zh: "请先修正客户不匹配，然后重试" })
                  : auditData?.summary?.warning
                    ? pickLang(language, { ku: "بەردەوام بە، دەزانم", en: "Continue, I understand", ar: "متابعة، أنا أدرك ذلك", zh: "继续，我知道了" })
                    : pickLang(language, { ku: "بەردەوام بە بۆ گەیاندن", en: "Continue to delivery", ar: "متابعة إلى التسليم", zh: "继续交付" })}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
