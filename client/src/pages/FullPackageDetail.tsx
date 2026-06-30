import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import ImageGallery from "@/components/ImageGallery";
import CompressedImageUpload from "@/components/CompressedImageUpload";
import SafeDeleteOrderDialog from "@/components/SafeDeleteOrderDialog";
import OrderAuditHistory from "@/components/OrderAuditHistory";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
// Plan v3: delete confirmation is now handled by SafeDeleteOrderDialog
// (imported below), so the raw AlertDialog primitives are no longer needed here.
import {
  ArrowRight,
  Package,
  DollarSign,
  ShoppingBag,
  Save,
  Loader2,
  Link as LinkIcon,
  Image,
  User,
  TrendingUp,
  Layers,
  Pencil,
  Eye,
  ArrowLeft,
  Calendar,
  Truck,
  Trash2,
  ExternalLink,
  Phone,
  Hash,
  Box,
  Palette,
  Ruler,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Plus,
  X,
  Split,
  Weight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "@/contexts/LanguageContext";
import TrackingTimeline, { type TrackingStep } from "@/components/TrackingTimeline";

// Maps an order's status enum to a 0-based stage index on the
// registered → in-batch/shipped → arrived → delivered journey.
const STATUS_STAGE: Record<string, number> = {
  pending: 0,
  approved: 0,
  ordered: 0,
  tracking_added: 0,
  in_china_warehouse: 0,
  in_batch: 1,
  in_transit: 1,
  arrived: 2,
  delivered: 3,
};

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  approved: "bg-blue-100 text-blue-800 border-blue-200",
  ordered: "bg-indigo-100 text-indigo-800 border-indigo-200",
  tracking_added: "bg-cyan-100 text-cyan-800 border-cyan-200",
  in_china_warehouse: "bg-purple-100 text-purple-800 border-purple-200",
  in_batch: "bg-violet-100 text-violet-800 border-violet-200",
  in_transit: "bg-orange-100 text-orange-800 border-orange-200",
  arrived: "bg-teal-100 text-teal-800 border-teal-200",
  delivered: "bg-green-100 text-green-800 border-green-200",
  cancelled: "bg-red-100 text-red-800 border-red-200",
};

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Clock className="h-4 w-4" />,
  approved: <CheckCircle className="h-4 w-4" />,
  ordered: <ShoppingBag className="h-4 w-4" />,
  tracking_added: <Hash className="h-4 w-4" />,
  in_china_warehouse: <Box className="h-4 w-4" />,
  in_batch: <Layers className="h-4 w-4" />,
  in_transit: <Truck className="h-4 w-4" />,
  arrived: <CheckCircle className="h-4 w-4" />,
  delivered: <CheckCircle className="h-4 w-4" />,
  cancelled: <XCircle className="h-4 w-4" />,
};

export default function FullPackageDetail() {
  const { t } = useTranslation();
  const { id, mode } = useParams<{ id: string; mode?: string }>();
  const [, navigate] = useLocation();
  const isEditMode = mode === "edit";
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [splitDialogOpen, setSplitDialogOpen] = useState(false);
  const [splitShippingCost, setSplitShippingCost] = useState("");
  const [splitShippingType, setSplitShippingType] = useState<"air_regular" | "air_irregular" | "sea">("air_regular");
  // Plan v3: reason for financial edits — required by server when money changes.
  const [editReason, setEditReason] = useState("");

  const statusLabels: Record<string, string> = {
    pending: t("fullPackage.status.pending"),
    approved: t("fullPackage.status.approved"),
    ordered: t("fullPackage.status.ordered"),
    tracking_added: t("fullPackage.status.tracking_added"),
    in_china_warehouse: t("fullPackage.status.in_china_warehouse"),
    in_batch: t("fullPackage.status.in_batch"),
    in_transit: t("fullPackage.status.in_transit"),
    arrived: t("fullPackage.status.arrived"),
    delivered: t("fullPackage.status.delivered"),
    cancelled: t("fullPackage.status.cancelled"),
  };

  const statusOptions = [
    { value: "pending", label: t("fullPackage.status.pending") },
    { value: "approved", label: t("fullPackage.status.approved") },
    { value: "ordered", label: t("fullPackage.status.ordered") },
    { value: "tracking_added", label: t("fullPackage.status.tracking_added") },
    { value: "in_china_warehouse", label: t("fullPackage.status.in_china_warehouse") },
    { value: "in_batch", label: t("fullPackage.status.in_batch") },
    { value: "in_transit", label: t("fullPackage.status.in_transit") },
    { value: "arrived", label: t("fullPackage.status.arrived") },
    { value: "delivered", label: t("fullPackage.status.delivered") },
    { value: "cancelled", label: t("fullPackage.status.cancelled") },
  ];
  
  const utils = trpc.useUtils();

  const { data: order, isLoading, refetch } = trpc.fullPackage.getById.useQuery(
    { id: Number(id) },
    { enabled: !!id }
  );

  const [formData, setFormData] = useState({
    customerId: "",
    supplierId: "",
    batchId: "",
    orderNumber: "",
    productName: "",
    productLink: "",
    productImage: "",
    productImages: [] as string[],
    productDescription: "",
    quantity: "1",
    color: "",
    size: "",
    purchasePriceUsd: "",
    sellingPriceUsd: "",
    trackingNumber: "",
    trackingNumbers: [] as string[],
    notes: "",
    status: "pending",
  });

  const { data: customers } = trpc.customers.list.useQuery();
  const { data: suppliers } = trpc.suppliers.list.useQuery();
  const { data: batchesRaw } = trpc.batches.list.useQuery();
  const batches = Array.isArray(batchesRaw) ? batchesRaw : batchesRaw?.data;
  // ¥ exchange rate — MUST be declared before any early returns below
  const { data: rmbRateData } = trpc.exchangeRates.getCurrent.useQuery({ currency: "RMB" });

  useEffect(() => {
    if (order) {
      const existingTrackings = (order as any).trackingNumbers?.length
        ? (order as any).trackingNumbers
        : order.trackingNumber
          ? [order.trackingNumber]
          : [];
      setFormData({
        customerId: order.customerId?.toString() || "",
        supplierId: order.supplierId?.toString() || "",
        batchId: order.batchId?.toString() || "",
        orderNumber: (order as any).orderNumber || "",
        productName: order.productName || "",
        productLink: order.productLink || "",
        productImage: order.productImage || "",
        productImages: (order as any).productImages?.length
          ? (order as any).productImages
          : order.productImage
            ? [order.productImage]
            : [],
        productDescription: order.productDescription || "",
        quantity: order.quantity?.toString() || "1",
        color: order.color || "",
        size: order.size || "",
        purchasePriceUsd: order.purchasePriceUsd?.toString() || "",
        sellingPriceUsd: order.sellingPriceUsd?.toString() || "",
        trackingNumber: order.trackingNumber || "",
        trackingNumbers: existingTrackings,
        notes: order.notes || "",
        status: order.status || "pending",
      });
    }
  }, [order]);

  const updateMutation = trpc.fullPackage.update.useMutation({
    onSuccess: (res) => {
      const delta = (res as any)?.chargeDeltaUsd ?? 0;
      if (Math.abs(delta) > 0.005) {
        toast.success(
          `${t("fullPackage.orderUpdatedSuccess")} · ${
            delta > 0 ? "+" : ""
          }$${delta.toFixed(2)}`
        );
      } else {
        toast.success(t("fullPackage.orderUpdatedSuccess"));
      }
      setEditReason("");
      utils.fullPackage.list.invalidate();
      utils.fullPackage.getCustomerPendingOrders.invalidate();
      refetch();
      navigate(`/full-package/${id}`);
    },
    onError: (error) => {
      // Plan v3: surface OCC conflicts distinctly — user must reload stale data.
      if (error.data?.code === "CONFLICT") {
        toast.error(
          "ئەم ئۆردەرە لەلایەن بەکارهێنەرێکی دیکە گۆڕدراوە. تکایە بیخوێنەرەوە و هەوڵ بدەرەوە. | This order was modified by someone else. Please reload and try again.",
          { duration: 8000 }
        );
        refetch();
        return;
      }
      toast.error(error.message || t("errors.somethingWentWrong"));
    },
  });

  // Shared tracking: get all orders with same tracking number
  const trackingForQuery = order?.trackingNumber || "";
  const { data: sharedOrders } = trpc.fullPackage.getOrdersByTracking.useQuery(
    { trackingNumber: trackingForQuery },
    { enabled: !!trackingForQuery }
  );
  const hasSharedTracking = (sharedOrders?.length ?? 0) > 1;

  const splitMutation = trpc.fullPackage.splitShippingCost.useMutation({
    onSuccess: (result) => {
      toast.success(
        `${t("fullPackage.shippingSplit")} - ${result.orders.length} ${t("fullPackage.orders")}`
      );
      setSplitDialogOpen(false);
      setSplitShippingCost("");
      refetch();
      utils.fullPackage.list.invalidate();
      utils.fullPackage.getCustomerPendingOrders.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || t("errors.somethingWentWrong"));
    },
  });

  const handleSplitShipping = () => {
    if (!trackingForQuery || !splitShippingCost) return;
    splitMutation.mutate({
      trackingNumber: trackingForQuery,
      totalShippingCost: parseFloat(splitShippingCost),
      shippingType: splitShippingType,
    });
  };

  // Preview split calculation (client-side)
  const splitPreview = useMemo(() => {
    if (!sharedOrders || sharedOrders.length <= 1 || !splitShippingCost) return null;
    const total = parseFloat(splitShippingCost) || 0;
    if (total <= 0) return null;

    const isSea = splitShippingType === "sea";
    let totalMeasure = 0;
    const items = sharedOrders.map((o: any) => {
      let measure = 0;
      if (isSea) {
        measure = parseFloat(o.volumeCbm?.toString() || "0") || 0;
      } else {
        const kg = parseFloat(o.weightKg?.toString() || "0") || 0;
        const l = parseFloat(o.dimensionLength?.toString() || "0") || 0;
        const w = parseFloat(o.dimensionWidth?.toString() || "0") || 0;
        const h = parseFloat(o.dimensionHeight?.toString() || "0") || 0;
        const vol = (l * w * h) / 6000;
        measure = Math.max(kg, vol);
      }
      totalMeasure += measure;
      return { order: o, measure };
    });

    const useEqual = totalMeasure === 0;
    return items.map(({ order: o, measure }) => {
      const ratio = useEqual ? (1 / sharedOrders.length) : (measure / totalMeasure);
      return {
        orderCode: o.orderCode,
        productName: o.productName,
        measure: isSea ? measure : measure,
        ratio: Math.round(ratio * 10000) / 100,
        share: Math.round(total * ratio * 100) / 100,
        weightKg: parseFloat(o.weightKg?.toString() || "0") || 0,
      };
    });
  }, [sharedOrders, splitShippingCost, splitShippingType]);

  // Plan v3: the delete mutation is now encapsulated inside
  // <SafeDeleteOrderDialog/>, which enforces the required reason,
  // shows a financial-impact preview, and passes the OCC version.
  // Navigation back to the list is handled via `onDeleted`.

  // Detect whether the order has been charged yet. Uncharged/pending orders
  // can be edited freely without a reason (no ledger impact).
  const isPendingCharge = !(order as any)?.isCharged && !(order as any)?.chargeTransactionId;

  // Plan v3: detect whether any money-affecting field would be changed on save.
  // Mirrors server-side computeOrderChargeAmount — if this says "money changes",
  // the server will require a non-empty reason (ONLY for already-charged orders).
  const moneyChangeDetected = useMemo(() => {
    if (!order) return false;
    // Uncharged orders never need a reason.
    if (isPendingCharge) return false;
    const normalize = (v: string | null | undefined) =>
      parseFloat(String(v ?? "0")) || 0;
    const oldQty = order.quantity ?? 1;
    const newQty = Number(formData.quantity) || 1;
    const qtyChanged = oldQty !== newQty;
    const sellingChanged =
      normalize(order.sellingPriceUsd as any) !== normalize(formData.sellingPriceUsd);
    const purchaseChanged =
      normalize(order.purchasePriceUsd as any) !== normalize(formData.purchasePriceUsd);
    // For this form, the money inputs are purchase/selling × quantity.
    return qtyChanged || sellingChanged || purchaseChanged;
  }, [order, isPendingCharge, formData.quantity, formData.sellingPriceUsd, formData.purchasePriceUsd]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.customerId) {
      toast.error(t("fullPackage.selectCustomerError"));
      return;
    }

    if (!formData.productName) {
      toast.error(t("fullPackage.enterProductNameError"));
      return;
    }

    // Plan v3: require a reason when the edit would shift the customer ledger.
    if (moneyChangeDetected && editReason.trim().length < 3) {
      toast.error(
        "هۆکار پێویستە بۆ گۆڕینی نرخ (بەلایەنی کەم ٣ پیت) | Reason is required when prices change (min 3 chars)"
      );
      return;
    }

    const cleanedTrackings = formData.trackingNumbers.filter((t) => t.trim() !== "");
    updateMutation.mutate({
      id: Number(id),
      // Plan v3 — OCC + reason for audit trail on any money change.
      expectedVersion: (order as any)?.version,
      reason: moneyChangeDetected ? editReason.trim() : undefined,
      customerId: formData.customerId ? Number(formData.customerId) : undefined,
      supplierId: formData.supplierId && formData.supplierId !== "none" ? Number(formData.supplierId) : null,
      productName: formData.productName,
      productLink: formData.productLink || undefined,
      productImage: formData.productImages[0] || formData.productImage || undefined,
      productImages: formData.productImages.length > 0 ? formData.productImages : undefined,
      orderNumber: formData.orderNumber || undefined,
      productDescription: formData.productDescription || undefined,
      quantity: Number(formData.quantity) || 1,
      color: formData.color || undefined,
      size: formData.size || undefined,
      purchasePriceUsd: formData.purchasePriceUsd || undefined,
      sellingPriceUsd: formData.sellingPriceUsd || undefined,
      trackingNumber: cleanedTrackings[0] || undefined,
      trackingNumbers: cleanedTrackings.length > 0 ? cleanedTrackings : undefined,
      notes: formData.notes || undefined,
    });
  };

  // handleDelete removed — SafeDeleteOrderDialog manages its own mutation + nav.

  const profit = (Number(formData.sellingPriceUsd) || 0) - (Number(formData.purchasePriceUsd) || 0);

  // Filter batches to show only preparing status
  const availableBatches = batches?.filter(b => b.status === 'preparing') || [];

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6 p-6">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Skeleton className="h-64 w-full rounded-xl" />
              <Skeleton className="h-48 w-full rounded-xl" />
            </div>
            <div className="space-y-6">
              <Skeleton className="h-80 w-full rounded-xl" />
              <Skeleton className="h-48 w-full rounded-xl" />
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!order) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-96">
          <div className="p-6 bg-gray-100 rounded-full mb-6">
            <Package className="h-16 w-16 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">{t("fullPackage.orderNotFound")}</h2>
          <p className="text-muted-foreground mb-6">{t("fullPackage.orderNotFoundDesc")}</p>
          <Button onClick={() => navigate("/full-package")} size="lg">
            <ArrowRight className="h-4 w-4 ms-2" />
            {t("fullPackage.backToList")}
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const rmbRate = parseFloat(rmbRateData?.rate?.toString() || "0");
  const toRmb = (usd: number) => rmbRate > 0 ? Math.round(usd * rmbRate).toLocaleString("en-US") : null;

  // Visual tracking timeline — derived ONLY from existing order fields.
  // cancelled orders skip the timeline (no linear journey to show).
  const trackingSteps: TrackingStep[] = (() => {
    if (order.status === "cancelled") return [];
    const inBatch = !!order.batchId || !!(order as any).batch;
    let stage = STATUS_STAGE[order.status] ?? 0;
    // If a batch is already assigned but status hasn't advanced, treat as shipped.
    if (stage < 1 && inBatch) stage = 1;
    const stepDefs: { key: string; label: string }[] = [
      { key: "registered", label: t("tracking.registered") || "تۆمارکرا" },
      { key: "in_batch", label: t("tracking.inBatch") || "بارکرا / لە باچ" },
      { key: "arrived", label: t("tracking.arrived") || "گەیشتە بنکە" },
      { key: "delivered", label: t("tracking.delivered") || "گەیەنرا" },
    ];
    return stepDefs.map((s, idx) => ({
      key: s.key,
      label: s.label,
      state: idx < stage ? "done" : idx === stage ? "active" : "pending",
    }));
  })();

  // Calculate totals
  const totalPurchase = (Number(order.purchasePriceUsd) || 0) * (order.quantity || 1);
  const totalSelling = (Number(order.sellingPriceUsd) || 0) * (order.quantity || 1);
  const shippingCost = Number(order.shippingCostUsd) || 0;
  const totalCost = totalPurchase + shippingCost;
  const totalProfit = totalSelling - totalCost;
  const profitMargin = totalSelling > 0 ? ((totalProfit / totalSelling) * 100).toFixed(1) : "0";

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="bg-gradient-to-l from-emerald-600 to-emerald-700 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/full-package")}
                className="text-white hover:bg-white/20 rounded-xl"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <ShoppingBag className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">
                  {isEditMode ? t("fullPackage.editOrder") : t("fullPackage.orderDetails")}
                </h1>
                <p className="text-emerald-100 flex items-center gap-2 mt-1">
                  <Hash className="h-4 w-4" />
                  {t("fullPackage.orderCode")}: <span className="font-mono font-bold">{order.orderCode}</span>
                  {isPendingCharge && (
                    <Badge className="bg-amber-100 text-amber-800 border-amber-200 ms-2">
                      <Clock className="h-3 w-3 me-1" />
                      {t("fullPackage.pendingCharge")}
                    </Badge>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {!isEditMode ? (
                <>
                  <Button
                    onClick={() => navigate(`/full-package/${id}/edit`)}
                    className="bg-white text-emerald-700 hover:bg-emerald-50 shadow-md"
                  >
                    <Pencil className="h-4 w-4 ms-2" />
                    {t("common.edit")}
                  </Button>
                  <Button
                    variant="destructive"
                    className="bg-red-500 hover:bg-red-600 shadow-md"
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    <Trash2 className="h-4 w-4 ms-2" />
                    {t("fullPackage.deleteOrder")}
                  </Button>
                </>
              ) : (
                <Badge className={`${statusColors[order.status]} text-sm px-4 py-2 border`}>
                  {statusIcons[order.status]}
                  <span className="me-2">{statusLabels[order.status]}</span>
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Pending charge banner — shown for both view and edit mode */}
        {isPendingCharge && (
          <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
            <Clock className="h-5 w-5 text-amber-700 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-900">
              <p className="font-semibold mb-1">{t("fullPackage.pendingChargeTitle")}</p>
              <p>{t("fullPackage.pendingChargeDesc")}</p>
            </div>
          </div>
        )}

        {/* Visual tracking timeline — China→Iraq journey, from existing fields */}
        {trackingSteps.length > 0 && (
          <Card className="shadow-sm border-0 bg-white">
            <CardContent className="p-5">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-4 flex items-center gap-1">
                <Truck className="h-3 w-3" /> {t("tracking.title") || "شوێنکەوتنی ئۆردەر"}
              </p>
              <TrackingTimeline steps={trackingSteps} />
            </CardContent>
          </Card>
        )}

        {isEditMode ? (
          /* Edit Form */
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Customer & Supplier */}
            <Card className="shadow-sm border-0 bg-white">
              <CardHeader className="border-b bg-gray-50/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 rounded-lg">
                    <User className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <CardTitle>{t("fullPackage.customer")} & {t("fullPackage.supplier")}</CardTitle>
                    <CardDescription>{t("fullPackage.selectCustomerDescription")}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">{t("fullPackage.customer")} *</Label>
                    <Select
                      value={formData.customerId}
                      onValueChange={(value) => setFormData({ ...formData, customerId: value })}
                    >
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder={t("fullPackage.selectCustomerPlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        {customers?.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id.toString()}>
                            {customer.fullName} ({customer.customerCode})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">{t("fullPackage.supplier")}</Label>
                    <Select
                      value={formData.supplierId}
                      onValueChange={(value) => setFormData({ ...formData, supplierId: value })}
                    >
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder={t("fullPackage.selectSupplierPlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t("fullPackage.noSupplier")}</SelectItem>
                        {suppliers?.map((supplier) => (
                          <SelectItem key={supplier.id} value={supplier.id.toString()}>
                            {supplier.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Product Info */}
            <Card className="shadow-sm border-0 bg-white">
              <CardHeader className="border-b bg-gray-50/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Package className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle>{t("fullPackage.productInfo")}</CardTitle>
                    <CardDescription>{t("fullPackage.productInfoDescription")}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">{t("fullPackage.productName")} *</Label>
                    <Input
                      value={formData.productName}
                      onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                      placeholder={t("fullPackage.productNamePlaceholder")}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">{t("fullPackage.orderNumber") || "ئۆردەر نەمبەر"}</Label>
                    <Input
                      value={formData.orderNumber}
                      onChange={(e) => setFormData({ ...formData, orderNumber: e.target.value })}
                      placeholder={t("fullPackage.orderNumberPlaceholder") || "ژمارەی ئۆردەر"}
                      className="h-11"
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-sm font-medium">{t("fullPackage.trackingNumber")}</Label>
                    <div className="space-y-2">
                      {formData.trackingNumbers.map((tn, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <Input
                            value={tn}
                            onChange={(e) => {
                              const updated = [...formData.trackingNumbers];
                              updated[idx] = e.target.value;
                              setFormData({ ...formData, trackingNumbers: updated });
                            }}
                            placeholder={t("fullPackage.trackingNumberPlaceholder")}
                            className="h-11 font-mono flex-1"
                            dir="ltr"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-11 w-11 shrink-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => {
                              const updated = formData.trackingNumbers.filter((_, i) => i !== idx);
                              setFormData({ ...formData, trackingNumbers: updated });
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        onClick={() => setFormData({ ...formData, trackingNumbers: [...formData.trackingNumbers, ""] })}
                      >
                        <Plus className="h-4 w-4" />
                        {t("fullPackage.addTrackingNumber") || "زیادکردنی ژمارەی شوێنکەوتنەوە"}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">{t("fullPackage.quantity")}</Label>
                    <Input
                      type="number"
                      min="1"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">{t("fullPackage.color")}</Label>
                    <Input
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      placeholder={t("fullPackage.colorPlaceholder")}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">{t("fullPackage.size")}</Label>
                    <Input
                      value={formData.size}
                      onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                      placeholder={t("fullPackage.sizePlaceholder")}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">{t("fullPackage.productLink")}</Label>
                    <Input
                      value={formData.productLink}
                      onChange={(e) => setFormData({ ...formData, productLink: e.target.value })}
                      placeholder="https://..."
                      className="h-11"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{t("fullPackage.productDescription")}</Label>
                  <Textarea
                    value={formData.productDescription}
                    onChange={(e) => setFormData({ ...formData, productDescription: e.target.value })}
                    placeholder={t("fullPackage.productDescriptionPlaceholder")}
                    rows={3}
                  />
                </div>
                {/* Product images — add or replace here when one was missed or
                    wrong at creation time. */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <Image className="h-4 w-4" />
                    {t("fullPackage.productImages") || "وێنەکانی کاڵا"}
                  </Label>
                  <CompressedImageUpload
                    images={formData.productImages}
                    onChange={(imgs) => setFormData({ ...formData, productImages: imgs })}
                    maxImages={5}
                    accentColor="amber"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Pricing */}
            <Card className="shadow-sm border-0 bg-white">
              <CardHeader className="border-b bg-gray-50/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <DollarSign className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <CardTitle>{t("fullPackage.prices")}</CardTitle>
                    <CardDescription>{t("fullPackage.pricingDetails")}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">{t("fullPackage.purchasePriceUsd")}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.purchasePriceUsd}
                      onChange={(e) => setFormData({ ...formData, purchasePriceUsd: e.target.value })}
                      placeholder="0.00"
                      className="h-11 font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">{t("fullPackage.sellingPriceUsd")}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.sellingPriceUsd}
                      onChange={(e) => setFormData({ ...formData, sellingPriceUsd: e.target.value })}
                      placeholder="0.00"
                      className="h-11 font-mono"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Notes */}
            <Card className="shadow-sm border-0 bg-white">
              <CardHeader className="border-b bg-gray-50/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <FileText className="h-5 w-5 text-purple-600" />
                  </div>
                  <CardTitle>{t("fullPackage.notes")}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder={t("fullPackage.notes")}
                  rows={3}
                />
              </CardContent>
            </Card>

            {/* Plan v3: reason card shown ONLY when the edit would shift the customer ledger */}
            {moneyChangeDetected && (
              <Card className="shadow-sm border-2 border-amber-300 bg-amber-50">
                <CardHeader className="border-b border-amber-200 bg-amber-100">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-200 rounded-lg">
                      <AlertCircle className="h-5 w-5 text-amber-800" />
                    </div>
                    <div>
                      <CardTitle className="text-amber-900">
                        هۆکاری گۆڕینی نرخ | Reason for Price Change
                      </CardTitle>
                      <CardDescription className="text-amber-800">
                        گۆڕانکاریت لە نرخ یان ژمارە کردووە، بۆیە پێویستە هۆکارێک بنووسیت بۆ ئەوەی
                        دەفتەری هەژماری کڕیار ڕێکبخرێتەوە. | You changed a price or quantity, so
                        we need a reason to log the customer-ledger adjustment.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <Textarea
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                    placeholder="بۆ نموونە: کڕیار داوای دابەزاندنی ٥٪ی کرد | e.g. Customer requested a 5% discount"
                    rows={2}
                    dir="auto"
                  />
                  <div className="text-xs text-amber-800 mt-2 text-right">
                    {editReason.trim().length < 3
                      ? `بەلایەنی کەم ٣ پیت | Min 3 chars (${editReason.trim().length}/3)`
                      : `${editReason.trim().length} پیت | chars`}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Submit */}
            <div className="flex gap-4 sticky bottom-4 bg-white p-4 rounded-xl shadow-lg border">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(`/full-package/${id}`)}
                size="lg"
              >
                <ArrowRight className="h-4 w-4 ms-2" />
                {t("common.cancel")}
              </Button>
              <Button 
                type="submit" 
                disabled={updateMutation.isPending} 
                className="bg-emerald-600 hover:bg-emerald-700 flex-1"
                size="lg"
              >
                {updateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 ms-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 ms-2" />
                )}
                {t("common.save")}
              </Button>
            </div>
          </form>
        ) : (
          /* View Mode */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Info */}
            <div className="lg:col-span-2 space-y-6">
              {/* Product Info Card */}
              <Card className="shadow-sm border-0 bg-white overflow-hidden">
                <CardHeader className="border-b bg-gradient-to-l from-blue-50 to-white">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Package className="h-5 w-5 text-blue-600" />
                    </div>
                    <CardTitle>زانیاری کاڵا</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">{t("fullPackage.productName")}</p>
                      <p className="font-semibold text-lg">{order.productName}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                        <Hash className="h-3 w-3" /> {t("fullPackage.orderNumber") || "ئۆردەر نەمبەر"}
                      </p>
                      {(order as any).orderNumber ? (
                        <Badge variant="secondary" className="font-mono text-sm px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200">
                          # {(order as any).orderNumber}
                        </Badge>
                      ) : (
                        <p className="font-mono font-medium text-muted-foreground">-</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                        <Hash className="h-3 w-3" /> {t("fullPackage.trackingNumber")}
                      </p>
                      {(() => {
                        const allTrackings = (order as any).trackingNumbers?.length
                          ? (order as any).trackingNumbers as string[]
                          : order.trackingNumber
                            ? [order.trackingNumber]
                            : [];
                        return allTrackings.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {allTrackings.map((tn: string, idx: number) => (
                              <Badge
                                key={idx}
                                variant="secondary"
                                className="font-mono text-sm px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 cursor-default"
                              >
                                {tn}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <p className="font-mono font-medium text-muted-foreground">-</p>
                        );
                      })()}
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                        <Box className="h-3 w-3" /> بڕ
                      </p>
                      <p className="font-semibold">{order.quantity} {t("fullPackage.quantityUnit")}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                        <Palette className="h-3 w-3" /> ڕەنگ
                      </p>
                      <p className="font-medium">{order.color || "-"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                        <Ruler className="h-3 w-3" /> قەبارە
                      </p>
                      <p className="font-medium">{order.size || "-"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                        <Layers className="h-3 w-3" /> باچ
                      </p>
                      <Badge variant="outline" className="font-mono">
                        {(order as any).batch?.batchCode || t("fullPackage.noBatch")}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="mt-6 pt-6 border-t">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                      <FileText className="h-3 w-3" /> {t("fullPackage.productDescription")}
                    </p>
                    <p className={`leading-relaxed ${order.productDescription ? "text-gray-700" : "text-gray-400 italic"}`}>
                      {order.productDescription || "وەسفی کاڵا نییە"}
                    </p>
                  </div>
                  
                  {order.productLink && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">{t("fullPackage.productLink")}</p>
                      <a 
                        href={order.productLink} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 hover:underline"
                      >
                        <ExternalLink className="h-4 w-4" />
                        {order.productLink.length > 50 ? order.productLink.substring(0, 50) + "..." : order.productLink}
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Product Images Gallery */}
              <Card className="shadow-sm border-0 bg-white overflow-hidden">
                <CardHeader className="border-b bg-gradient-to-l from-indigo-50 to-white">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 rounded-lg">
                      <Image className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div>
                      <CardTitle>وێنەکانی کاڵا</CardTitle>
                      <CardDescription>
                        {((order as any).productImages?.length || (order.productImage ? 1 : 0))} وێنە
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  {((order as any).productImages?.length > 0 || order.productImage) ? (
                    <ImageGallery 
                      images={(order as any).productImages || (order.productImage ? [order.productImage] : [])} 
                      accentColor="emerald"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                      <Image className="h-10 w-10 mb-2 opacity-30" />
                      <p className="text-sm">هیچ وێنەیەک نییە</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Customer Info Card */}
              <Card className="shadow-sm border-0 bg-white overflow-hidden">
                <CardHeader className="border-b bg-gradient-to-l from-emerald-50 to-white">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-100 rounded-lg">
                      <User className="h-5 w-5 text-emerald-600" />
                    </div>
                    <CardTitle>{t("fullPackage.customer")}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">{t("common.name")}</p>
                      <p className="font-semibold text-lg">{(order as any).customer?.fullName || "-"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">{t("fullPackage.customerCode")}</p>
                      <Badge variant="secondary" className="font-mono text-sm">
                        {(order as any).customer?.customerCode || "-"}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                        <Phone className="h-3 w-3" /> ژمارەی مۆبایل
                      </p>
                      <p className="font-mono font-medium">{(order as any).customer?.mobileNumber || "-"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">{t("fullPackage.supplier")}</p>
                      <p className="font-medium">{(order as any).supplier?.name || "-"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Pricing Card */}
              <Card className="shadow-sm border-0 bg-white overflow-hidden">
                <CardHeader className="border-b bg-gradient-to-l from-green-50 to-white">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <DollarSign className="h-5 w-5 text-green-600" />
                    </div>
                    <CardTitle>{t("fullPackage.prices")}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  {/* Purchase Price */}
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                    <span className="text-sm text-muted-foreground">{t("fullPackage.purchasePrice")}</span>
                    <div className="text-right">
                      <span className="font-mono font-semibold">${Number(order.purchasePriceUsd || 0).toFixed(2)}</span>
                      {toRmb(Number(order.purchasePriceUsd || 0)) && (
                        <p className="text-[11px] text-orange-500 font-mono">≈ {toRmb(Number(order.purchasePriceUsd || 0))} ¥</p>
                      )}
                    </div>
                  </div>

                  {/* Selling Price */}
                  <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                    <span className="text-sm text-muted-foreground">{t("fullPackage.sellingPrice")}</span>
                    <div className="text-right">
                      <span className="font-mono font-semibold text-emerald-600">${Number(order.sellingPriceUsd || 0).toFixed(2)}</span>
                      {toRmb(Number(order.sellingPriceUsd || 0)) && (
                        <p className="text-[11px] text-orange-500 font-mono">≈ {toRmb(Number(order.sellingPriceUsd || 0))} ¥</p>
                      )}
                    </div>
                  </div>
                  
                  {/* Shipping Cost */}
                  <div className="flex justify-between items-center p-3 bg-orange-50 rounded-xl border border-orange-100">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">{t("fullPackage.shippingCost")}</span>
                      {hasSharedTracking && (
                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                          <Split className="h-3 w-3 me-1" />
                          {sharedOrders?.length} {t("fullPackage.orders")}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-orange-600">${shippingCost.toFixed(2)}</span>
                      {hasSharedTracking && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
                          onClick={() => setSplitDialogOpen(true)}
                        >
                          <Split className="h-3 w-3 me-1" />
                          {t("fullPackage.splitShipping")}
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  {/* Divider */}
                  <div className="border-t border-dashed my-3"></div>
                  
                  {/* Cost Breakdown */}
                  <div className="bg-gray-100 rounded-xl p-4 space-y-2">
                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">{t("fullPackage.costBreakdown")}</p>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t("fullPackage.purchasePrice")} × {t("fullPackage.quantity")}</span>
                      <span className="font-mono">${totalPurchase.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">+ {t("fullPackage.shipping")}</span>
                      <span className="font-mono">${shippingCost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-semibold border-t border-gray-200 pt-2 mt-2">
                      <span>{t("fullPackage.totalCost")}</span>
                      <span className="font-mono">${totalCost.toFixed(2)}</span>
                    </div>
                  </div>
                  
                  {/* Selling Price Total */}
                  <div className="bg-gradient-to-l from-emerald-600 to-emerald-700 rounded-xl p-4 text-white">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-emerald-100">{t("fullPackage.sellingPrice")}</span>
                      <span className="font-mono font-bold text-2xl">
                        ${Number(order.sellingPriceUsd || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Profit */}
                  <div className={`p-4 rounded-xl ${totalProfit >= 0 ? "bg-gradient-to-l from-green-100 to-green-50 border border-green-200" : "bg-gradient-to-l from-red-100 to-red-50 border border-red-200"}`}>
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-semibold block">{t("fullPackage.profit")}</span>
                        <span className="text-xs text-muted-foreground">
                          {profitMargin}% {t("fullPackage.profitMargin")}
                        </span>
                      </div>
                      <span className={`font-mono font-bold text-2xl ${totalProfit >= 0 ? "text-green-700" : "text-red-700"}`}>
                        ${totalProfit.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Payment Summary — advance paid + remaining */}
                  {(() => {
                    const advancePaid = Number((order as any).advancePaidUsd || 0);
                    const remaining = Math.max(0, totalSelling - advancePaid);
                    const isFullyPaid = advancePaid >= totalSelling && totalSelling > 0;
                    if (advancePaid <= 0) return null;
                    return (
                      <div className="rounded-xl border-2 border-teal-200 bg-gradient-to-l from-teal-50 to-emerald-50 p-4 space-y-2">
                        <div className="flex items-center gap-2 mb-1">
                          <DollarSign className="h-4 w-4 text-teal-600" />
                          <span className="text-sm font-bold text-teal-800">پوختەی پارەدان</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">کۆی فرۆشتن</span>
                          <span className="font-mono font-semibold">${totalSelling.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-teal-700">پارەی پێشەکی دراو</span>
                          <span className="font-mono font-semibold text-teal-700">-${advancePaid.toFixed(2)}</span>
                        </div>
                        <div className="h-px bg-teal-200" />
                        <div className="flex justify-between text-base">
                          <span className="font-semibold">{isFullyPaid ? "ڕەوشی پارەدان" : "ماوە بۆ پارەدان"}</span>
                          {isFullyPaid ? (
                            <span className="font-bold text-emerald-700">✓ تەواو پارەدراوە</span>
                          ) : (
                            <span className="font-mono font-bold text-xl text-amber-700">${remaining.toFixed(2)}</span>
                          )}
                        </div>
                        {(order as any).advancePaymentMethod && (
                          <p className="text-xs text-teal-600">شێواز: {(order as any).advancePaymentMethod}</p>
                        )}
                      </div>
                    );
                  })()}

                  {/* Formula Explanation */}
                  <div className="text-xs text-muted-foreground text-center bg-blue-50 p-3 rounded-xl border border-blue-100">
                    <AlertCircle className="h-3 w-3 inline-block ms-1" />
                    {t("fullPackage.profit")} = {t("fullPackage.sellingPrice")} - ({t("fullPackage.purchasePrice")} × {t("fullPackage.quantity")}) - {t("fullPackage.shipping")}
                  </div>
                </CardContent>
              </Card>

              {/* Status & Date Card */}
              <Card className="shadow-sm border-0 bg-white overflow-hidden">
                <CardHeader className="border-b bg-gradient-to-l from-blue-50 to-white">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Calendar className="h-5 w-5 text-blue-600" />
                    </div>
                    <CardTitle>{t("fullPackage.statusColumn")} & {t("fullPackage.dateColumn")}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">{t("fullPackage.statusColumn")}</p>
                    <Badge className={`${statusColors[order.status]} text-sm px-4 py-2 border`}>
                      {statusIcons[order.status]}
                      <span className="me-2">{statusLabels[order.status]}</span>
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">{t("fullPackage.orderDate")}</p>
                      <p className="font-medium mt-1">{new Date(order.createdAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "2-digit", 
                        day: "2-digit"
                      })}</p>
                    </div>
                    {order.updatedAt && (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">{t("common.update")}</p>
                        <p className="font-medium mt-1">{new Date(order.updatedAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "2-digit",
                          day: "2-digit"
                        })}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Notes */}
              <Card className="shadow-sm border-0 bg-white overflow-hidden">
                <CardHeader className="border-b bg-gradient-to-l from-purple-50 to-white">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <FileText className="h-5 w-5 text-purple-600" />
                    </div>
                    <CardTitle>{t("fullPackage.notes")}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  <p className={`leading-relaxed ${order.notes ? "text-gray-700" : "text-gray-400 italic"}`}>
                    {order.notes || "تێبینی نییە"}
                  </p>
                </CardContent>
              </Card>

              {/* Plan v3, Phase 4: audit history — admins only */}
              <OrderAuditHistory entityType="full_package_order" entityId={order.id} />

              {/* Quick Actions */}
              <Card className="shadow-sm border-0 bg-white overflow-hidden">
                <CardHeader className="border-b bg-gradient-to-l from-gray-50 to-white">
                  <CardTitle className="text-sm">{t("fullPackage.actionsColumn")}</CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-2">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => navigate(`/full-package/${id}/edit`)}
                  >
                    <Pencil className="h-4 w-4 ms-2" />
                    {t("fullPackage.editOrder")}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => navigate(`/customers/${order.customerId}`)}
                  >
                    <User className="h-4 w-4 ms-2" />
                    {t("common.view")} {t("fullPackage.customer")}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    <Trash2 className="h-4 w-4 ms-2" />
                    {t("fullPackage.deleteOrder")}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>

      {/* Split Shipping Cost Dialog */}
      <Dialog open={splitDialogOpen} onOpenChange={setSplitDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Split className="h-5 w-5 text-blue-600" />
              {t("fullPackage.splitShipping")}
            </DialogTitle>
            <DialogDescription>
              {t("fullPackage.splitShippingDesc")} ({sharedOrders?.length ?? 0} {t("fullPackage.orders")})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Tracking Number */}
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-muted-foreground">{t("fullPackage.trackingNumber")}</p>
              <p className="font-mono font-semibold">{trackingForQuery}</p>
            </div>

            {/* Shipping Type */}
            <div className="space-y-2">
              <Label>{t("fullPackage.shippingType")}</Label>
              <Select value={splitShippingType} onValueChange={(v) => setSplitShippingType(v as any)}>
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="air_regular">{t("fullPackage.airRegular")} (KG)</SelectItem>
                  <SelectItem value="air_irregular">{t("fullPackage.airIrregular")} (KG)</SelectItem>
                  <SelectItem value="sea">{t("fullPackage.sea")} (CBM)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Total Shipping Cost */}
            <div className="space-y-2">
              <Label>{t("fullPackage.totalShippingCost")} ($)</Label>
              <Input
                type="number"
                step="0.01"
                value={splitShippingCost}
                onChange={(e) => setSplitShippingCost(e.target.value)}
                placeholder="0.00"
                className="h-11 font-mono text-lg"
              />
            </div>

            {/* Preview */}
            {splitPreview && splitPreview.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold">{t("fullPackage.splitPreview")}</Label>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="p-2 text-start text-xs text-muted-foreground">{t("fullPackage.orderCode")}</th>
                        <th className="p-2 text-center text-xs text-muted-foreground">
                          <Weight className="h-3 w-3 inline me-1" />
                          {splitShippingType === "sea" ? "CBM" : "KG"}
                        </th>
                        <th className="p-2 text-center text-xs text-muted-foreground">%</th>
                        <th className="p-2 text-end text-xs text-muted-foreground">$</th>
                      </tr>
                    </thead>
                    <tbody>
                      {splitPreview.map((item) => (
                        <tr key={item.orderCode} className="border-t">
                          <td className="p-2">
                            <p className="font-mono font-medium text-xs">{item.orderCode}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-[150px]">{item.productName}</p>
                          </td>
                          <td className="p-2 text-center font-mono text-xs">
                            {item.measure > 0 ? item.measure.toFixed(2) : "-"}
                          </td>
                          <td className="p-2 text-center">
                            <Badge variant="outline" className="text-xs">{item.ratio}%</Badge>
                          </td>
                          <td className="p-2 text-end font-mono font-semibold text-emerald-700">
                            ${item.share.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t-2">
                      <tr>
                        <td className="p-2 font-semibold" colSpan={2}>{t("common.total")}</td>
                        <td className="p-2 text-center font-semibold">100%</td>
                        <td className="p-2 text-end font-mono font-bold text-emerald-800">
                          ${parseFloat(splitShippingCost || "0").toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                {splitPreview.every(p => p.measure === 0) && (
                  <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                    <AlertCircle className="h-3 w-3 inline me-1" />
                    {t("fullPackage.noWeightData")}
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSplitDialogOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleSplitShipping}
              disabled={!splitShippingCost || parseFloat(splitShippingCost) <= 0 || splitMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {splitMutation.isPending ? (
                <Loader2 className="h-4 w-4 me-2 animate-spin" />
              ) : (
                <Split className="h-4 w-4 me-2" />
              )}
              {t("fullPackage.applySplit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Plan v3, Phase 4: safe delete dialog with reason + financial-impact preview */}
      {order && (
        <SafeDeleteOrderDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          order={{
            id: order.id,
            orderCode: order.orderCode,
            productName: order.productName,
            orderType: order.orderType,
            quantity: order.quantity,
            sellingPriceUsd: order.sellingPriceUsd as any,
            itemPriceUsd: (order as any).itemPriceUsd,
            commissionFeeUsd: (order as any).commissionFeeUsd,
            advancePaidUsd: (order as any).advancePaidUsd,
            chargeTransactionId: (order as any).chargeTransactionId,
            version: (order as any).version,
          }}
          onDeleted={() => navigate("/full-package")}
        />
      )}
    </DashboardLayout>
  );
}
