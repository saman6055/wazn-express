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
import { useState, useMemo, useCallback, useRef, useEffect, Fragment } from "react";
import { toast } from "sonner";
import {
  Package, Plane, Ship, Search, User, Loader2, CheckCircle2, Plus, Trash2,
  Layers, Calculator, AlertTriangle, Tags, ChevronDown, ChevronUp,
  Scale, Ruler, Box, Settings2, ArrowRightLeft, Info, Zap, ShoppingBag, Warehouse
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";

// Legacy shape consumed by the existing badge / inline hint UI. We keep it
// stable so the rest of the page renders unchanged for the "normal" case;
// the new shared / multi-tracking surfaces are rendered separately from
// `expandedLookup` below.
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

// Expanded result (Phase 1 procedure). The UI uses this to render badges and
// inline panels for shared / multi-tracking situations and to compute which
// order IDs go in linkedOrderIds[] at submit time.
interface ExpandedLookup {
  case: 'single' | 'shared' | 'multi' | 'duplicate' | 'regular';
  orders: Array<{
    order: {
      id: number;
      orderCode: string;
      orderType: 'full_package' | 'commission' | 'purchase_request' | string;
      orderNumber: string | null;
      productName: string;
      productImage: string | null;
      quantity: number;
      status: string;
      customerId: number | null;
      batchId: number | null;
      trackingNumber: string | null;
    };
    customer: { id: number; customerCode: string | null; fullName: string | null } | null;
    batch: { id: number; batchCode: string | null; status: string } | null;
    trackings: Array<{ id: number; trackingNumber: string; cartonIndex: number }>;
  }>;
  existingPackages: Array<{ trackingNumber: string; id: number; packageCode: string; status: string; registeredAt: string | Date }>;
  flags: {
    customerMismatch: boolean;
    batchConflict: boolean;
    cartonsRegistered: number | null;
    cartonsTotal: number | null;
  };
}

interface PackageRow {
  id: string;
  trackingNumber: string;
  weightKg: string;
  lengthCm: string;
  widthCm: string;
  heightCm: string;
  trackingLookup?: TrackingLookupResult | null;
  expandedLookup?: ExpandedLookup | null;
  // For "shared" rows: should this package link to ALL sharing orders, or
  // only the primary one? Defaults to true (link all) — that's the safe path
  // for the same-carton scenario the feature was built for.
  linkAllSharingOrders?: boolean;
  // Inline detail panel toggle.
  expanded?: boolean;
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
  expandedLookup: null,
  linkAllSharingOrders: true,
  expanded: false,
  isLookingUp: false,
});

// Map the expanded server response back to the legacy lookup shape so the
// existing PackageTypeBadge and inline-hint UI keep rendering without churn.
function deriveLegacyLookup(exp: ExpandedLookup | null | undefined): TrackingLookupResult | null {
  if (!exp) return null;
  if (exp.case === 'duplicate') {
    return { found: false, type: 'duplicate', existingPackageCode: undefined };
  }
  if (exp.case === 'regular') {
    return { found: false, type: 'regular' };
  }
  // single / shared / multi all surface the primary order in legacy fields.
  const primary = exp.orders[0];
  if (!primary) return { found: false, type: 'regular' };
  const t = (primary.order.orderType === 'commission') ? 'commission' as const : 'full_package' as const;
  return {
    found: true,
    type: t,
    orderId: primary.order.id,
    orderCode: primary.order.orderCode,
    productName: primary.order.productName,
    status: primary.order.status,
    customerId: primary.customer?.id,
    customerCode: primary.customer?.customerCode ?? undefined,
    customerName: primary.customer?.fullName ?? undefined,
  };
}

// Package type badge component. Reads both legacy and expanded shapes so we
// can render the new "shared / multi" badges without disturbing existing
// "regular / commission / full_package / duplicate" rendering.
function PackageTypeBadge({
  lookup,
  expanded,
  language,
}: {
  lookup: TrackingLookupResult | null | undefined;
  expanded?: ExpandedLookup | null;
  language: string;
}) {
  // Shared tracking takes priority over the per-type badge — staff needs to
  // see "this carton has 3 orders" before seeing "it's a full-package order".
  if (expanded?.case === 'shared') {
    return (
      <Badge className="text-[10px] px-1.5 py-0 font-normal bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 border-orange-300">
        🔗 {pickLang(language, { ku: "هاوبەش", en: "Shared", ar: "مشترك", zh: "共享" })} • {expanded.orders.length} {pickLang(language, { ku: "ئۆردەر", en: "orders", ar: "طلبات", zh: "订单" })}
      </Badge>
    );
  }
  if (expanded?.case === 'multi' && expanded.flags.cartonsTotal) {
    const got = expanded.flags.cartonsRegistered ?? 0;
    return (
      <Badge className="text-[10px] px-1.5 py-0 font-normal bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-300">
        📦 {pickLang(language, { ku: "کارتۆن", en: "Carton", ar: "كرتون", zh: "纸箱" })} {got + 1}/{expanded.flags.cartonsTotal}
      </Badge>
    );
  }

  if (!lookup || !lookup.found) {
    return (
      <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal bg-slate-50 dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700">
        📋 {pickLang(language, { ku: "ئاسایی", en: "Regular", ar: "عادي", zh: "普通" })}
      </Badge>
    );
  }

  if (lookup.type === 'duplicate') {
    return (
      <Badge variant="destructive" className="text-[10px] px-1.5 py-0 font-normal">
        ⚠️ {pickLang(language, { ku: "دووبارە", en: "Duplicate", ar: "مكرر", zh: "重复" })} ({lookup.existingPackageCode})
      </Badge>
    );
  }

  if (lookup.type === 'commission') {
    return (
      <Badge className="text-[10px] px-1.5 py-0 font-normal bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border-amber-300">
        💰 {pickLang(language, { ku: "کڕین بە تێچوو", en: "Purchase by cost", ar: "شراء بالتكلفة", zh: "代购" })}
      </Badge>
    );
  }

  if (lookup.type === 'full_package') {
    return (
      <Badge className="text-[10px] px-1.5 py-0 font-normal bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 border-purple-300">
        📦 {pickLang(language, { ku: "پاکێجی تەواو", en: "Full package", ar: "حزمة كاملة", zh: "全包" })}
      </Badge>
    );
  }

  return null;
}

export default function BulkRegister() {
  const { t, language } = useTranslation();

  // Form state
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [shippingType, setShippingType] = useState<"air_regular" | "air_irregular" | "sea">("air_regular");
  const [batchId, setBatchId] = useState<string>("");
  // Explicit warehouse selection (was silently using warehouses[0]). null
  // until the list loads; the useEffect below picks the first available
  // warehouse as a sensible default while letting the user override it.
  const [originWarehouseId, setOriginWarehouseId] = useState<number | null>(null);
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
  const { data: batchesResponse } = trpc.batches.list.useQuery();
  const batches = Array.isArray(batchesResponse) ? batchesResponse : batchesResponse?.data;
  const { data: warehouses } = trpc.warehouses.list.useQuery();
  const { data: categories } = trpc.productCategories.list.useQuery();
  const { data: cbmDivisorData } = trpc.packages.getCbmDivisor.useQuery();

  const cbmDivisor = cbmDivisorData?.divisor || 6000;
  // Auto-select first warehouse once list loads; preserve manual selection
  // if user already picked one. This stops the silent failure where
  // defaultWarehouse was undefined for the first render(s) after mount.
  useEffect(() => {
    if (warehouses?.length && originWarehouseId === null) {
      setOriginWarehouseId(warehouses[0].id);
    }
  }, [warehouses, originWarehouseId]);
  const selectedWarehouse = useMemo(
    () => (warehouses?.find((w) => w.id === originWarehouseId) ?? warehouses?.[0]) ?? null,
    [warehouses, originWarehouseId]
  );

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

  // Tracking number lookup with debounce. Uses the expanded procedure so we
  // get shared/multi context in one round-trip; the legacy lookup shape is
  // derived for the existing badge / inline-hint code paths.
  const lookupTracking = useCallback(async (pkgId: string, trackingNumber: string) => {
    if (!trackingNumber || trackingNumber.length < 2) {
      setPackages(prev => prev.map(p =>
        p.id === pkgId ? { ...p, trackingLookup: null, expandedLookup: null, isLookingUp: false } : p
      ));
      return;
    }

    setPackages(prev => prev.map(p =>
      p.id === pkgId ? { ...p, isLookingUp: true } : p
    ));

    try {
      const expanded = await utils.packages.lookupTrackingExpanded.fetch({ trackingNumber });
      const exp = expanded as ExpandedLookup;
      const legacy = deriveLegacyLookup(exp);

      // Auto-expand the inline panel when there's something staff really
      // needs to see (shared, multi, customer mismatch, batch conflict).
      const shouldAutoExpand = exp.case === 'shared'
        || exp.case === 'multi'
        || exp.flags?.customerMismatch === true
        || exp.flags?.batchConflict === true;

      setPackages(prev => prev.map(p =>
        p.id === pkgId
          ? { ...p, trackingLookup: legacy, expandedLookup: exp, isLookingUp: false, expanded: shouldAutoExpand || p.expanded }
          : p
      ));

      // Auto-set customer when found, only if staff hasn't already chosen.
      // Single-customer rule guarantees every linked order shares one customer
      // so picking the primary one is safe.
      if (legacy?.found && legacy.customerId && !customerId && !isUnclaimed) {
        setCustomerId(legacy.customerId);
        const customer = customers?.find(c => c.id === legacy.customerId);
        if (customer) {
          setCustomerSearch(customer.customerCode || customer.fullName || "");
        }
      }
    } catch {
      setPackages(prev => prev.map(p =>
        p.id === pkgId ? { ...p, trackingLookup: null, expandedLookup: null, isLookingUp: false } : p
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
      toast.error(pickLang(language, { ku: "ژمارەیەکی دروست بنووسە", en: "Enter a valid number", ar: "أدخل رقماً صحيحاً", zh: "请输入有效数字" }));
      return;
    }
    try {
      await setCbmDivisorMutation.mutateAsync({ divisor: val });
      utils.packages.getCbmDivisor.invalidate();
      toast.success(pickLang(language, { ku: `CBM divisor گۆڕدرا بۆ ${val}`, en: `CBM divisor changed to ${val}`, ar: `تم تغيير قاسم CBM إلى ${val}`, zh: `CBM 除数已改为 ${val}` }));
      setShowCbmSettings(false);
    } catch {
      toast.error(pickLang(language, { ku: "هەڵە لە گۆڕینی CBM divisor", en: "Error changing CBM divisor", ar: "خطأ في تغيير قاسم CBM", zh: "更改 CBM 除数出错" }));
    }
  };

  const handleSubmit = async () => {
    if (!selectedWarehouse) {
      toast.error(pickLang(language, { ku: "هیچ کۆگایەک ڕێکنەخراوە", en: "No warehouse is configured", ar: "لم يتم إعداد أي مستودع", zh: "未配置任何仓库" }));
      return;
    }

    if (!isUnclaimed && !customerId) {
      toast.error(pickLang(language, { ku: "تکایە کڕیارێک هەڵبژێرە یان وەک بێ خاوەن دیاری بکە", en: "Please select a customer or mark as unclaimed", ar: "الرجاء اختيار عميل أو تحديده كغير مطالب به", zh: "请选择客户或标记为无主" }));
      return;
    }

    // Check for duplicates
    const hasDuplicates = packages.some(p => p.trackingLookup?.type === 'duplicate');
    if (hasDuplicates) {
      toast.error(pickLang(language, { ku: "تراکینگ نەمبەری دووبارە هەیە، تکایە چاکی بکەرەوە", en: "There is a duplicate tracking number, please fix it", ar: "يوجد رقم تتبع مكرر، الرجاء تصحيحه", zh: "存在重复的运单号，请修正" }));
      return;
    }

    // Block submit if any row has a customer-mismatch flag — the single-
    // customer rule is enforced server-side too, but failing here is a much
    // friendlier UX than letting the request go and rolling back.
    const mismatchRow = packages.find(p => p.expandedLookup?.flags?.customerMismatch);
    if (mismatchRow) {
      toast.error(pickLang(language, { ku: "تراکینگێک هەیە کە بۆ کڕیاری جیاوازە. تکایە لە سەرچاوە چاکی بکەرەوە.", en: "There is a tracking number belonging to a different customer. Please fix it at the source.", ar: "يوجد رقم تتبع يخص عميلاً مختلفاً. الرجاء تصحيحه من المصدر.", zh: "存在属于不同客户的运单号。请从源头修正。" }));
      return;
    }

    const validPackages = packages.filter(pkg => pkg.weightKg || pkg.trackingNumber);
    if (validPackages.length === 0) {
      toast.error(pickLang(language, { ku: "تکایە لانیکەم یەک پاکەت زیاد بکە", en: "Please add at least one package", ar: "الرجاء إضافة طرد واحد على الأقل", zh: "请至少添加一个包裹" }));
      return;
    }

    setIsSubmitting(true);
    setRegisteredCount(0);

    let successCount = 0;
    let errorCount = 0;

    for (const pkg of validPackages) {
      try {
        // Build linkedOrderIds[] from the expanded lookup. For shared rows,
        // honor staff's per-row "link all" toggle (default true). For multi
        // and single, only the primary order is the right link for THIS
        // tracking — other cartons get linked when their packages register.
        const exp = pkg.expandedLookup;
        let linkedOrderIds: number[] | undefined;
        if (exp && (exp.case === 'shared' || exp.case === 'multi' || exp.case === 'single')) {
          if (exp.case === 'shared' && pkg.linkAllSharingOrders !== false) {
            linkedOrderIds = exp.orders.map(o => o.order.id);
          } else if (exp.orders[0]) {
            linkedOrderIds = [exp.orders[0].order.id];
          }
        }

        // Determine customer: tracking lookup wins (single-customer rule
        // guarantees every linked order shares one customerId).
        const effectiveCustomerId = pkg.trackingLookup?.found && pkg.trackingLookup.customerId
          ? pkg.trackingLookup.customerId
          : (isUnclaimed ? undefined : customerId!);

        await registerMutation.mutateAsync({
          customerId: effectiveCustomerId,
          isUnclaimed: !effectiveCustomerId ? true : isUnclaimed,
          originWarehouseId: selectedWarehouse.id,
          trackingNumber: pkg.trackingNumber || undefined,
          shippingType,
          weightKg: pkg.weightKg || undefined,
          lengthCm: pkg.lengthCm || undefined,
          widthCm: pkg.widthCm || undefined,
          heightCm: pkg.heightCm || undefined,
          batchId: batchId && batchId !== "none" ? parseInt(batchId) : undefined,
          categoryId: categoryId && categoryId !== "none" ? parseInt(categoryId) : undefined,
          // Send the new array; legacy field remains accepted server-side.
          linkedOrderIds,
        });
        successCount++;
        setRegisteredCount(successCount);
      } catch (error: any) {
        errorCount++;
        toast.error(pickLang(language, { ku: `هەڵە لە تۆمارکردنی پاکەت: ${error.message}`, en: `Error registering package: ${error.message}`, ar: `خطأ في تسجيل الطرد: ${error.message}`, zh: `登记包裹出错：${error.message}` }));
      }
    }

    setIsSubmitting(false);

    if (successCount > 0) {
      toast.success(pickLang(language, { ku: `${successCount} پاکەت بە سەرکەوتوویی تۆمار کرا!`, en: `${successCount} packages registered successfully!`, ar: `تم تسجيل ${successCount} طرد بنجاح!`, zh: `${successCount} 个包裹登记成功！` }));
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
                <p>{pickLang(language, { ku: "ڕێکخستنی CBM Divisor", en: "Configure CBM Divisor", ar: "إعداد قاسم CBM", zh: "设置 CBM 除数" })} ({pickLang(language, { ku: "ئێستا", en: "current", ar: "الحالي", zh: "当前" })}: {cbmDivisor})</p>
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
                  <AlertTriangle className="h-3 w-3 me-1" />
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

            {/* Warehouse Selection — explicit picker so the user always
                knows which origin warehouse the bulk batch will be tagged
                to, instead of silently consuming warehouses[0] (which
                produced the "no warehouse" error when the list was empty
                or still loading). */}
            <Card>
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Warehouse className="h-3.5 w-3.5 text-primary" />
                  {pickLang(language, { ku: "کۆگا", en: "Warehouse", ar: "المستودع", zh: "仓库" })}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <Select
                  value={originWarehouseId != null ? String(originWarehouseId) : ""}
                  onValueChange={(v) => setOriginWarehouseId(v ? parseInt(v, 10) : null)}
                  disabled={!warehouses?.length}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder={warehouses?.length ? pickLang(language, { ku: "کۆگا هەڵبژێرە...", en: "Select warehouse...", ar: "اختر المستودع...", zh: "选择仓库..." }) : pickLang(language, { ku: "هیچ کۆگایەک نییە", en: "No warehouse available", ar: "لا يوجد مستودع", zh: "没有可用仓库" })} />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses?.map((w) => (
                      <SelectItem key={w.id} value={String(w.id)}>
                        <span className="font-medium">{w.nameEn ?? w.nameKu ?? `${pickLang(language, { ku: "کۆگا", en: "Warehouse", ar: "مستودع", zh: "仓库" })} ${w.id}`}</span>
                        {w.codePrefix && <span className="text-muted-foreground me-2">({w.codePrefix})</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedWarehouse && (
                  <div className="mt-2 flex items-center gap-1.5 p-1.5 bg-slate-50 dark:bg-slate-900 rounded-md">
                    <CheckCircle2 className="h-3.5 w-3.5 text-slate-600 shrink-0" />
                    <span className="text-[11px] text-slate-700 dark:text-slate-300 font-medium truncate">
                      {selectedWarehouse.nameEn ?? selectedWarehouse.nameKu ?? `${pickLang(language, { ku: "کۆگا", en: "Warehouse", ar: "مستودع", zh: "仓库" })} ${selectedWarehouse.id}`}
                    </span>
                  </div>
                )}
                {!warehouses?.length && (
                  <p className="mt-2 text-[10px] text-amber-600">
                    {pickLang(language, { ku: "تکایە لە ڕێکخستنەکان کۆگا زیاد بکە.", en: "Please add a warehouse in settings.", ar: "الرجاء إضافة مستودع في الإعدادات.", zh: "请在设置中添加仓库。" })}
                  </p>
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
                    <span>{pickLang(language, { ku: "کێشی ئەقدی", en: "Volumetric weight", ar: "الوزن الحجمي", zh: "体积重" })} = (L×W×H) ÷ {cbmDivisor}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {pickLang(language, { ku: "کێشی حسابکراو = max(ڕاستەقینە, ئەقدی)", en: "Chargeable weight = max(actual, volumetric)", ar: "الوزن المحتسب = max(الفعلي، الحجمي)", zh: "计费重 = max(实重, 体积重)" })}
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
                  <Plus className="h-3.5 w-3.5 me-1" />
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

                          const exp = pkg.expandedLookup;
                          const isShared = exp?.case === 'shared';
                          const isMulti = exp?.case === 'multi';
                          const customerMismatch = exp?.flags?.customerMismatch === true;
                          const batchConflict = exp?.flags?.batchConflict === true;
                          const hasInlinePanel = isShared || isMulti || customerMismatch || batchConflict;

                          return (
                            <Fragment key={pkg.id}>
                            <tr className={cn(
                              "border-b last:border-b-0 transition-colors",
                              isDuplicate && "bg-red-50 dark:bg-red-950/30",
                              customerMismatch && "bg-rose-50 dark:bg-rose-950/30",
                              !customerMismatch && isShared && "bg-orange-50/60 dark:bg-orange-950/20",
                              !customerMismatch && isMulti && "bg-blue-50/60 dark:bg-blue-950/20",
                              !customerMismatch && !isShared && !isMulti && pkg.trackingLookup?.found && pkg.trackingLookup.type === 'commission' && "bg-amber-50/50 dark:bg-amber-950/20",
                              !customerMismatch && !isShared && !isMulti && pkg.trackingLookup?.found && pkg.trackingLookup.type === 'full_package' && "bg-purple-50/50 dark:bg-purple-950/20",
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
                                {/* Show tracking info below. For FP / commission lookups
                                    we additionally surface a "🔒 لۆککراو" hint so the
                                    staff knows this row is forced under the order's
                                    customer regardless of the page-level customer
                                    selection (the submit handler enforces this; the UI
                                    just makes it visible). */}
                                {pkg.trackingLookup?.found && (
                                  <div className="mt-0.5 text-[10px] text-muted-foreground flex items-center gap-1 flex-wrap">
                                    <ShoppingBag className="h-3 w-3" />
                                    <span className="truncate">{pkg.trackingLookup.productName}</span>
                                    <span className="text-primary font-medium">({pkg.trackingLookup.customerCode})</span>
                                    {(pkg.trackingLookup.type === 'full_package' || pkg.trackingLookup.type === 'commission') && (
                                      <span className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-1.5 py-0.5 rounded-full font-semibold">
                                        🔒 {pickLang(language, { ku: "لۆککراو لەسەر کریاری ئۆردەر", en: "Locked to the order's customer", ar: "مقفل على عميل الطلب", zh: "锁定为订单客户" })}
                                      </span>
                                    )}
                                  </div>
                                )}
                                {isDuplicate && (
                                  <div className="mt-0.5 text-[10px] text-red-600 font-medium">
                                    ⚠️ {pickLang(language, { ku: "ئەم تراکینگە پێشتر تۆمار کراوە", en: "This tracking number is already registered", ar: "رقم التتبع هذا مسجل مسبقاً", zh: "此运单号已登记" })} ({pkg.trackingLookup?.existingPackageCode})
                                  </div>
                                )}
                              </td>
                              <td className="px-2 py-1.5 text-center">
                                {hasInlinePanel ? (
                                  <button
                                    type="button"
                                    onClick={() => setPackages(prev => prev.map(p => p.id === pkg.id ? { ...p, expanded: !p.expanded } : p))}
                                    className="inline-flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity"
                                    title={pkg.expanded ? pickLang(language, { ku: "بشاردنەوە", en: "Hide", ar: "إخفاء", zh: "隐藏" }) : pickLang(language, { ku: "وردەکارییەکان نیشان بدە", en: "Show details", ar: "عرض التفاصيل", zh: "显示详情" })}
                                  >
                                    <PackageTypeBadge lookup={pkg.trackingLookup} expanded={pkg.expandedLookup} language={language} />
                                    {pkg.expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                  </button>
                                ) : (
                                  <PackageTypeBadge lookup={pkg.trackingLookup} expanded={pkg.expandedLookup} language={language} />
                                )}
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
                                          {isVolumetricHigher && <span className="text-[8px] ms-0.5">📐</span>}
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="text-xs">
                                        <div className="space-y-1">
                                          <div>{pickLang(language, { ku: "کێشی ڕاستەقینە", en: "Actual weight", ar: "الوزن الفعلي", zh: "实重" })}: {actualKg.toFixed(3)} kg</div>
                                          <div>{pickLang(language, { ku: "کێشی ئەقدی", en: "Volumetric weight", ar: "الوزن الحجمي", zh: "体积重" })}: {volumetricKg.toFixed(3)} kg</div>
                                          <div className="font-bold border-t pt-1">
                                            {pickLang(language, { ku: "حسابکراو", en: "Chargeable", ar: "المحتسب", zh: "计费" })}: {chargeableKg.toFixed(3)} kg
                                            {isVolumetricHigher ? ` (${pickLang(language, { ku: "ئەقدی", en: "volumetric", ar: "الحجمي", zh: "体积" })})` : ` (${pickLang(language, { ku: "ڕاستەقینە", en: "actual", ar: "الفعلي", zh: "实重" })})`}
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
                            {hasInlinePanel && pkg.expanded && exp && (
                              <tr className={cn(
                                "border-b",
                                customerMismatch ? "bg-rose-50/80 dark:bg-rose-950/40"
                                  : isShared ? "bg-orange-50/80 dark:bg-orange-950/30"
                                  : isMulti ? "bg-blue-50/80 dark:bg-blue-950/30"
                                  : "bg-muted/30",
                              )}>
                                <td colSpan={9} className="px-3 py-2 text-xs">
                                  {customerMismatch && (
                                    <div className="mb-2 p-2 rounded border border-rose-300 bg-rose-100/80 text-rose-900 dark:bg-rose-900/40 dark:text-rose-100 flex items-start gap-2">
                                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                                      <div>
                                        <div className="font-bold">{pickLang(language, { ku: "تراکینگی هاوبەش بۆ کڕیاری جیاواز", en: "Shared tracking for different customers", ar: "تتبع مشترك لعملاء مختلفين", zh: "不同客户共享的运单号" })}</div>
                                        <div className="text-[11px] opacity-90">{pickLang(language, { ku: "ئەم تراکینگە بۆ ئۆردەری چەند کڕیاری جیایە. یاسای کاری ڕێگری دەکات لە تۆمارکردنی پاکەتێکی هاوبەش بۆ کڕیاری جیاواز. تکایە لە سەرچاوە چاکی بکەرەوە.", en: "This tracking number belongs to orders of several different customers. Business rules prevent registering a shared package for different customers. Please fix it at the source.", ar: "رقم التتبع هذا يخص طلبات عملاء مختلفين. تمنع قواعد العمل تسجيل طرد مشترك لعملاء مختلفين. الرجاء تصحيحه من المصدر.", zh: "此运单号属于多个不同客户的订单。业务规则禁止为不同客户登记共享包裹。请从源头修正。" })}</div>
                                      </div>
                                    </div>
                                  )}
                                  {batchConflict && !customerMismatch && (
                                    <div className="mb-2 p-2 rounded border border-amber-300 bg-amber-100/80 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100 flex items-start gap-2">
                                      <Info className="h-4 w-4 shrink-0 mt-0.5" />
                                      <div>
                                        <div className="font-bold">{pickLang(language, { ku: "کۆمەڵەی جیاواز", en: "Different batch", ar: "دفعة مختلفة", zh: "不同批次" })}</div>
                                        <div className="text-[11px] opacity-90">{pickLang(language, { ku: "ئۆردەرە گرێدراوەکان لە کۆمەڵەی جیاوازدان. ئەگەر ئەم پاکەتە دەخەیتە کۆمەڵە، ئۆردەرەکان لە کۆمەڵەی نوێ یەکدەگرتنەوە.", en: "The linked orders are in different batches. If you add this package to a batch, the orders will be merged into the new batch.", ar: "الطلبات المرتبطة في دفعات مختلفة. إذا أضفت هذا الطرد إلى دفعة، سيتم دمج الطلبات في الدفعة الجديدة.", zh: "关联订单分属不同批次。如果将此包裹加入某批次，订单将合并到新批次。" })}</div>
                                      </div>
                                    </div>
                                  )}
                                  {isShared && (
                                    <>
                                      <div className="font-semibold text-orange-900 dark:text-orange-200 mb-1">
                                        🔗 {pickLang(language, { ku: `ئەم تراکینگە بۆ ${exp.orders.length} ئۆردەرە:`, en: `This tracking number belongs to ${exp.orders.length} orders:`, ar: `رقم التتبع هذا يخص ${exp.orders.length} طلبات:`, zh: `此运单号属于 ${exp.orders.length} 个订单：` })}
                                      </div>
                                      <div className="space-y-1 mb-2">
                                        {exp.orders.map((od) => {
                                          const alreadyRegistered = exp.existingPackages.some(p => p.trackingNumber === pkg.trackingNumber);
                                          return (
                                            <div key={od.order.id} className="flex items-center gap-2 p-1.5 rounded bg-white/60 dark:bg-black/20 border border-orange-200/60 dark:border-orange-800/40">
                                              <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0">{od.order.orderCode}</Badge>
                                              <span className="text-[11px]">{od.order.productName}</span>
                                              {od.order.quantity > 1 && <span className="text-[10px] text-muted-foreground">×{od.order.quantity}</span>}
                                              <span className="text-[10px] text-muted-foreground">•</span>
                                              <span className="text-[11px] text-primary font-medium">{od.customer?.customerCode ?? '?'}</span>
                                              <span className="text-[10px] text-muted-foreground ms-auto">
                                                {od.batch ? <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">{pickLang(language, { ku: "کۆمەڵە", en: "Batch", ar: "الدفعة", zh: "批次" })}: {od.batch.batchCode}</span> : <span>{pickLang(language, { ku: "بێ کۆمەڵە", en: "No batch", ar: "بدون دفعة", zh: "无批次" })}</span>}
                                              </span>
                                              {alreadyRegistered && (
                                                <Badge variant="secondary" className="text-[9px] px-1 py-0">{pickLang(language, { ku: "پاکەتی هاوبەش هەیە", en: "Shared package exists", ar: "يوجد طرد مشترك", zh: "已有共享包裹" })}</Badge>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                      <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={pkg.linkAllSharingOrders !== false}
                                          onChange={(e) => setPackages(prev => prev.map(p => p.id === pkg.id ? { ...p, linkAllSharingOrders: e.target.checked } : p))}
                                          className="h-3.5 w-3.5 cursor-pointer"
                                        />
                                        <span className="text-[11px]">
                                          {pkg.linkAllSharingOrders !== false
                                            ? pickLang(language, { ku: `هەموو ${exp.orders.length} ئۆردەرەکە بە ئەم پاکەتە گرێ بدە (پێشنیار)`, en: `Link all ${exp.orders.length} orders to this package (recommended)`, ar: `اربط جميع الطلبات الـ ${exp.orders.length} بهذا الطرد (موصى به)`, zh: `将全部 ${exp.orders.length} 个订单关联到此包裹（推荐）` })
                                            : pickLang(language, { ku: `تەنها ئۆردەری سەرەکی (${exp.orders[0]?.order.orderCode})`, en: `Only the primary order (${exp.orders[0]?.order.orderCode})`, ar: `الطلب الرئيسي فقط (${exp.orders[0]?.order.orderCode})`, zh: `仅主订单 (${exp.orders[0]?.order.orderCode})` })}
                                        </span>
                                      </label>
                                    </>
                                  )}
                                  {isMulti && exp.orders[0] && (
                                    <>
                                      <div className="font-semibold text-blue-900 dark:text-blue-200 mb-1">
                                        📦 {pickLang(language, { ku: `ئۆردەری ${exp.orders[0].order.orderCode} بە ${exp.orders[0].trackings.length} کارتۆن:`, en: `Order ${exp.orders[0].order.orderCode} with ${exp.orders[0].trackings.length} cartons:`, ar: `الطلب ${exp.orders[0].order.orderCode} مع ${exp.orders[0].trackings.length} كرتون:`, zh: `订单 ${exp.orders[0].order.orderCode} 含 ${exp.orders[0].trackings.length} 个纸箱：` })}
                                      </div>
                                      <div className="space-y-1">
                                        {exp.orders[0].trackings.map((tr) => {
                                          const reg = exp.existingPackages.find(p => p.trackingNumber === tr.trackingNumber);
                                          const isThis = tr.trackingNumber === pkg.trackingNumber;
                                          return (
                                            <div key={tr.id} className="flex items-center gap-2 p-1.5 rounded bg-white/60 dark:bg-black/20 border border-blue-200/60 dark:border-blue-800/40">
                                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">{pickLang(language, { ku: "کارتۆن", en: "Carton", ar: "كرتون", zh: "纸箱" })} {tr.cartonIndex}</Badge>
                                              <span className="text-[11px] font-mono">{tr.trackingNumber}</span>
                                              <span className="ms-auto">
                                                {isThis ? (
                                                  <Badge className="text-[9px] bg-emerald-100 text-emerald-800 border-emerald-300">{pickLang(language, { ku: "ئێستا تۆمار دەکرێ", en: "Registering now", ar: "يتم التسجيل الآن", zh: "正在登记" })}</Badge>
                                                ) : reg ? (
                                                  <Badge variant="secondary" className="text-[9px]">✅ {pickLang(language, { ku: "تۆمار کراوە", en: "Registered", ar: "تم التسجيل", zh: "已登记" })} ({reg.packageCode})</Badge>
                                                ) : (
                                                  <Badge variant="outline" className="text-[9px] text-muted-foreground">⏳ {pickLang(language, { ku: "چاوەڕێ", en: "Pending", ar: "قيد الانتظار", zh: "待处理" })}</Badge>
                                                )}
                                              </span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </>
                                  )}
                                </td>
                              </tr>
                            )}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Pre-submit advisory banner: surface counts of shared / multi
                    rows and any blocking issues so staff scans them before the
                    button click instead of clicking and reading toasts. */}
                {(() => {
                  const sharedCount = packages.filter(p => p.expandedLookup?.case === 'shared').length;
                  const multiCount = packages.filter(p => p.expandedLookup?.case === 'multi').length;
                  const mismatchCount = packages.filter(p => p.expandedLookup?.flags?.customerMismatch).length;
                  if (sharedCount === 0 && multiCount === 0 && mismatchCount === 0) return null;
                  return (
                    <div className="mt-3 mb-1 p-2.5 rounded-lg border bg-muted/40 text-xs space-y-1">
                      {mismatchCount > 0 && (
                        <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300 font-semibold">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          {pickLang(language, { ku: `${mismatchCount} ڕیز کێشەی کڕیاری جیاوازی هەیە — submit بەردەست نییە`, en: `${mismatchCount} rows have a different-customer issue — submit unavailable`, ar: `${mismatchCount} صفوف بها مشكلة عميل مختلف — الإرسال غير متاح`, zh: `${mismatchCount} 行存在客户不一致问题 — 无法提交` })}
                        </div>
                      )}
                      {sharedCount > 0 && (
                        <div className="flex items-center gap-2 text-orange-700 dark:text-orange-300">
                          <span>🔗</span>
                          <span>{pickLang(language, { ku: `${sharedCount} ڕیز تراکی هاوبەشە — لە پانێڵی هەر ڕیزدا checkbox-ەکە پشکنە پێش submit`, en: `${sharedCount} rows have a shared tracking — check the checkbox in each row's panel before submit`, ar: `${sharedCount} صفوف بها تتبع مشترك — راجع مربع الاختيار في لوحة كل صف قبل الإرسال`, zh: `${sharedCount} 行为共享运单 — 提交前请检查每行面板中的复选框` })}</span>
                        </div>
                      )}
                      {multiCount > 0 && (
                        <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                          <span>📦</span>
                          <span>{pickLang(language, { ku: `${multiCount} ڕیز کارتۆنێکە لە ئۆردەرێکی چەند-کارتۆنە`, en: `${multiCount} rows are a carton of a multi-carton order`, ar: `${multiCount} صفوف هي كرتون من طلب متعدد الكراتين`, zh: `${multiCount} 行是多纸箱订单中的一个纸箱` })}</span>
                        </div>
                      )}
                    </div>
                  );
                })()}

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
                    disabled={
                      isSubmitting
                      || (!isUnclaimed && !customerId)
                      || totals.validPackages === 0
                      || !selectedWarehouse
                      || packages.some(p => p.expandedLookup?.flags?.customerMismatch)
                    }
                    size="lg"
                    className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-md"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 me-2 animate-spin" />
                        {t('packages.registering')} {registeredCount}/{totals.validPackages}...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 me-2" />
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
              {pickLang(language, { ku: "ڕێکخستنی CBM Divisor", en: "Configure CBM Divisor", ar: "إعداد قاسم CBM", zh: "设置 CBM 除数" })}
            </DialogTitle>
            <DialogDescription>
              {pickLang(language, { ku: "ئەم ژمارەیە بۆ حسابکردنی کێشی ئەقدی بەکاردێت. فۆرمولا: (L×W×H) ÷ Divisor", en: "This number is used to calculate volumetric weight. Formula: (L×W×H) ÷ Divisor", ar: "يُستخدم هذا الرقم لحساب الوزن الحجمي. الصيغة: (L×W×H) ÷ Divisor", zh: "此数字用于计算体积重。公式：(L×W×H) ÷ Divisor" })}
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
                {pickLang(language, { ku: "ژمارەی ئێستا", en: "Current value", ar: "القيمة الحالية", zh: "当前值" })}: <span className="font-bold">{cbmDivisor}</span> | {pickLang(language, { ku: "بنەڕەت", en: "default", ar: "الافتراضي", zh: "默认" })}: 6000
              </p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg text-xs space-y-1">
              <p className="font-medium">{pickLang(language, { ku: "نموونە", en: "Example", ar: "مثال", zh: "示例" })}:</p>
              <p>{pickLang(language, { ku: "پاکەتێک بە قەبارەی 50×40×30 سم", en: "A package sized 50×40×30 cm", ar: "طرد بأبعاد 50×40×30 سم", zh: "一个 50×40×30 厘米的包裹" })}</p>
              <p>{pickLang(language, { ku: "کێشی ئەقدی", en: "Volumetric weight", ar: "الوزن الحجمي", zh: "体积重" })} = (50×40×30) ÷ {newDivisor || cbmDivisor} = <span className="font-bold">{((50*40*30) / (parseInt(newDivisor) || cbmDivisor)).toFixed(2)} kg</span></p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCbmSettings(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSaveCbmDivisor} disabled={setCbmDivisorMutation.isPending}>
              {setCbmDivisorMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : null}
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
