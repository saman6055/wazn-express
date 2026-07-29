import { useState, useEffect, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import ImageGallery from "@/components/ImageGallery";
import CompressedImageUpload from "@/components/CompressedImageUpload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  ArrowRight,
  Package,
  DollarSign,
  Percent,
  Save,
  Loader2,
  Link as LinkIcon,
  User,
  Layers,
  Pencil,
  ArrowLeft,
  Calendar,
  Image as ImageIcon,
  FileText,
  Hash,
  Box,
  Palette,
  Ruler,
  Phone,
  Clock,
  CheckCircle,
  XCircle,
  ShoppingBag,
  Truck,
  ExternalLink,
  AlertCircle,
  Trash2,
} from "lucide-react";
// Plan v3: raw AlertDialog primitives replaced by <SafeDeleteOrderDialog/>.
import SafeDeleteOrderDialog from "@/components/SafeDeleteOrderDialog";
import OrderAuditHistory from "@/components/OrderAuditHistory";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import TrackingTimeline, { type TrackingStep } from "@/components/TrackingTimeline";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

export default function CommissionDetail() {
  const { t, language } = useTranslation();
  const { id, mode } = useParams<{ id: string; mode?: string }>();
  const [, navigate] = useLocation();
  const isEditMode = mode === "edit";
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  // Plan v3: reason is required when prices or quantity change (server
  // enforces it via computeOrderChargeAmount). Kept separate from notes so
  // the audit-log row captures the EXACT operator-given justification.
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
    itemPriceUsd: "",
    commissionFeeUsd: "",
    trackingNumber: "",
    notes: "",
    status: "pending",
  });

  const { data: customers } = trpc.customers.list.useQuery();
  const { data: suppliers } = trpc.suppliers.list.useQuery();
  const { data: batchesRaw } = trpc.batches.list.useQuery();
  const batches = Array.isArray(batchesRaw) ? batchesRaw : batchesRaw?.data;

  useEffect(() => {
    if (order) {
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
        itemPriceUsd: order.itemPriceUsd?.toString() || "",
        commissionFeeUsd: order.commissionFeeUsd?.toString() || "",
        trackingNumber: order.trackingNumber || "",
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
          `${pickLang(language, { ku: "ئۆردەر نوێکرایەوە", en: "Order updated", ar: "تم تحديث الطلب", zh: "订单已更新" })} · ${delta > 0 ? "+" : ""}$${delta.toFixed(2)}`
        );
      } else {
        toast.success(pickLang(language, { ku: "ئۆردەر نوێکرایەوە", en: "Order updated", ar: "تم تحديث الطلب", zh: "订单已更新" }));
      }
      setEditReason("");
      utils.fullPackage.list.invalidate();
      utils.fullPackage.getCustomerPendingOrders.invalidate();
      refetch();
      navigate(`/commission/${id}`);
    },
    onError: (error) => {
      // Always log the full error so the actual root cause lands in the
      // browser DevTools console — critical when the toast UI is hidden
      // or clipped (we've seen Sonner render empty in RTL layouts).
      // eslint-disable-next-line no-console
      console.error("[CommissionDetail] update mutation failed:", {
        message: error.message,
        code: error.data?.code,
        httpStatus: error.data?.httpStatus,
        path: error.data?.path,
        data: error.data,
        shape: error.shape,
      });

      // Plan v3: surface OCC conflicts distinctly so the operator reloads.
      if (error.data?.code === "CONFLICT") {
        toast.error(
          pickLang(language, {
            ku: "ئۆردەرەکە لەلایەن کەسێکی دیکەوە گۆڕدراوە",
            en: "Order changed elsewhere",
            ar: "تم تغيير الطلب من مكان آخر",
            zh: "订单已在别处被更改",
          }),
          {
            description: pickLang(language, {
              ku: "تکایە پەڕەکە نوێ بکەرەوە و هەوڵ بدەرەوە.",
              en: "Please reload the page and try again.",
              ar: "يرجى إعادة تحميل الصفحة والمحاولة مرة أخرى.",
              zh: "请重新加载页面后再试。",
            }),
            duration: 10000,
          }
        );
        refetch();
        return;
      }
      // Non-empty fallback is important — some thrown errors have empty
      // .message (esp. network / zod issues) and Sonner would render a
      // blank toast otherwise.
      const rawMsg =
        typeof error.message === "string" ? error.message.trim() : "";
      const code = error.data?.code ?? "UNKNOWN";
      const title = rawMsg || pickLang(language, {
        ku: "هەڵە لە نوێکردنەوەی ئۆردەر",
        en: "Failed to update order",
        ar: "فشل تحديث الطلب",
        zh: "更新订单失败",
      });
      toast.error(title, {
        description: `${pickLang(language, { ku: "کۆدی هەڵە", en: "Error code", ar: "رمز الخطأ", zh: "错误代码" })}: ${code}`,
        duration: 10000,
      });
    },
  });

  // Plan v3: delete is handled by <SafeDeleteOrderDialog/> (mounted below).
  // It enforces the required reason, previews the financial impact, and
  // navigates on success.

  // Plan v3: detect whether any money-affecting field would be changed on save.
  // Uncharged/pending orders can be edited freely without a reason.
  const isPendingCharge = !(order as any)?.isCharged && !(order as any)?.chargeTransactionId;

  // Mirrors server-side commissionGoodsTotal for commission orders:
  //   charge = (itemPrice + commission) × qty
  // If this says "money changes", the server will require a non-empty reason
  // and will bump the OCC version.
  // NOTE: Only applies to already-charged orders — pending orders skip this check.
  const moneyChangeDetected = useMemo(() => {
    if (!order) return false;
    if (isPendingCharge) return false;
    const normalize = (v: unknown) => parseFloat(String(v ?? "0")) || 0;
    const oldQty = order.quantity ?? 1;
    const newQty = Number(formData.quantity) || 1;
    const qtyChanged = oldQty !== newQty;
    const itemChanged =
      normalize((order as any).itemPriceUsd) !== normalize(formData.itemPriceUsd);
    const commissionChanged =
      normalize((order as any).commissionFeeUsd) !==
      normalize(formData.commissionFeeUsd);
    return qtyChanged || itemChanged || commissionChanged;
  }, [order, isPendingCharge, formData.quantity, formData.itemPriceUsd, formData.commissionFeeUsd]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.productName) {
      toast.error(t("fullPackage.enterProductNameError"));
      return;
    }

    // Plan v3: require a reason when the edit would shift the customer ledger.
    // Without this, the server throws BAD_REQUEST and the toast was coming
    // back blank because some validation errors ship with no .message body.
    if (moneyChangeDetected && editReason.trim().length < 3) {
      toast.error(
        pickLang(language, {
          ku: "هۆکار پێویستە بۆ گۆڕینی نرخ (بەلایەنی کەم ٣ پیت)",
          en: "Reason is required when prices change (min 3 chars)",
          ar: "السبب مطلوب عند تغيير الأسعار (٣ أحرف على الأقل)",
          zh: "更改价格时需填写原因（至少3个字符）",
        })
      );
      return;
    }

    updateMutation.mutate({
      id: Number(id),
      // Plan v3 — OCC + reason for audit trail on any money change.
      expectedVersion: (order as any)?.version,
      reason: moneyChangeDetected ? editReason.trim() : undefined,
      customerId: formData.customerId ? Number(formData.customerId) : undefined,
      supplierId: formData.supplierId ? Number(formData.supplierId) : null,
      productName: formData.productName,
      productLink: formData.productLink || undefined,
      productImage: formData.productImages[0] || formData.productImage || undefined,
      productImages: formData.productImages.length > 0 ? formData.productImages : undefined,
      orderNumber: formData.orderNumber || undefined,
      productDescription: formData.productDescription || undefined,
      quantity: Number(formData.quantity) || 1,
      color: formData.color || undefined,
      size: formData.size || undefined,
      // Plan v3: price fields were omitted before — that's why server
      // thought "nothing changed" on price-only edits and why qty edits
      // raced against the charge-recompute without a reason.
      itemPriceUsd: formData.itemPriceUsd || undefined,
      commissionFeeUsd: formData.commissionFeeUsd || undefined,
      trackingNumber: formData.trackingNumber || undefined,
      notes: formData.notes || undefined,
    });
  };

  // ¥ exchange rate for display
  const { data: rmbRateData } = trpc.exchangeRates.getCurrent.useQuery({ currency: "RMB" });
  const rmbRate = parseFloat(rmbRateData?.rate?.toString() || "0");
  const toRmb = (usd: number) => rmbRate > 0 ? Math.round(usd * rmbRate).toLocaleString("en-US") : null;

  const itemPriceUsd = Number(formData.itemPriceUsd) || 0;
  const quantity = Number(formData.quantity) || 1;
  const commissionFeeUsd = Number(formData.commissionFeeUsd) || 0;
  const itemSubtotal = itemPriceUsd * quantity;
  // Item price AND commission are both PER-UNIT. Matches the server-side
  // formula in server/db/fullPackage.db.ts `commissionGoodsTotal`:
  // `(itemPrice + commission) × qty`.
  const totalCommission = commissionFeeUsd * quantity;
  const totalCost = itemSubtotal + totalCommission;

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
          <div className="p-6 bg-purple-50 rounded-full mb-6">
            <Percent className="h-16 w-16 text-purple-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">{t("commission.orderNotFound") || "ئۆردەر نەدۆزرایەوە"}</h2>
          <p className="text-muted-foreground mb-6">{t("fullPackage.orderNotFoundDesc")}</p>
          <Button onClick={() => navigate("/commission")} size="lg" className="bg-purple-600 hover:bg-purple-700">
            <ArrowRight className="h-4 w-4 ms-2" />
            {pickLang(language, { ku: "گەڕانەوە بۆ لیست", en: "Back to list", ar: "العودة إلى القائمة", zh: "返回列表" })}
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  // Visual tracking timeline — derived ONLY from existing order fields.
  // cancelled orders skip the timeline (no linear journey to show).
  const trackingSteps: TrackingStep[] = (() => {
    if (order.status === "cancelled") return [];
    const inBatch = !!order.batchId || !!(order as any).batch;
    let stage = STATUS_STAGE[order.status] ?? 0;
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

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="bg-gradient-to-l from-purple-600 to-purple-700 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/commission")}
                className="text-white hover:bg-white/20 rounded-xl"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <Percent className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">
                  {isEditMode ? t("commission.editOrder") || "دەستکاری ئۆردەر" : t("commission.orderDetails") || "وردەکاری ئۆردەر"}
                </h1>
                <p className="text-purple-100 flex items-center gap-2 mt-1">
                  <Hash className="h-4 w-4" />
                  {t("commission.orderCode") || "کۆدی ئۆردەر"}: <span className="font-mono font-bold">{order.orderCode}</span>
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
                    onClick={() => navigate(`/commission/${id}/edit`)}
                    className="bg-white text-purple-700 hover:bg-purple-50 shadow-md"
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
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5 text-purple-600" />
                  <CardTitle>{pickLang(language, { ku: "کڕیار", en: "Customer", ar: "العميل", zh: "客户" })}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{pickLang(language, { ku: "کڕیار", en: "Customer", ar: "العميل", zh: "客户" })}</Label>
                    <Select
                      value={formData.customerId}
                      onValueChange={(value) => setFormData({ ...formData, customerId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={pickLang(language, { ku: "کڕیارێک هەڵبژێرە", en: "Select a customer", ar: "اختر عميلاً", zh: "选择客户" })} />
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
                    <Label>{pickLang(language, { ku: "فرۆشیار", en: "Supplier", ar: "المورّد", zh: "供应商" })}</Label>
                    {/* Radix Select forbids value="" on SelectItem — that value
                        is reserved for "cleared selection". Use the sentinel
                        "__none__" for the "no supplier" option and translate
                        back to empty on submit. */}
                    <Select
                      value={formData.supplierId || "__none__"}
                      onValueChange={(value) =>
                        setFormData({
                          ...formData,
                          supplierId: value === "__none__" ? "" : value,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={pickLang(language, { ku: "فرۆشیارێک هەڵبژێرە", en: "Select a supplier", ar: "اختر مورّداً", zh: "选择供应商" })} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">{pickLang(language, { ku: "بێ فرۆشیار", en: "No supplier", ar: "بدون مورّد", zh: "无供应商" })}</SelectItem>
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

            {/* Batch Selection */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Layers className="h-5 w-5 text-purple-600" />
                  <CardTitle>{pickLang(language, { ku: "باچ", en: "Batch", ar: "الدفعة", zh: "批次" })}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label>{pickLang(language, { ku: "باچ", en: "Batch", ar: "الدفعة", zh: "批次" })}</Label>
                  {/* Same sentinel pattern as the supplier select above —
                      Radix Select treats value="" as "clear the selection"
                      and forbids it on SelectItem. */}
                  <Select
                    value={formData.batchId || "__none__"}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        batchId: value === "__none__" ? "" : value,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={pickLang(language, { ku: "باچێک هەڵبژێرە", en: "Select a batch", ar: "اختر دفعة", zh: "选择批次" })} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">{pickLang(language, { ku: "بێ باچ", en: "No batch", ar: "بدون دفعة", zh: "无批次" })}</SelectItem>
                      {availableBatches.map((batch) => (
                        <SelectItem key={batch.id} value={batch.id.toString()}>
                          {batch.batchCode}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Product Info */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-purple-600" />
                  <CardTitle>{pickLang(language, { ku: "زانیاری کاڵا", en: "Product Info", ar: "معلومات المنتج", zh: "商品信息" })}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{pickLang(language, { ku: "ناوی کاڵا *", en: "Product name *", ar: "اسم المنتج *", zh: "商品名称 *" })}</Label>
                    <Input
                      value={formData.productName}
                      onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                      placeholder={pickLang(language, { ku: "ناوی کاڵا", en: "Product name", ar: "اسم المنتج", zh: "商品名称" })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{pickLang(language, { ku: "ئۆردەر نەمبەر", en: "Order number", ar: "رقم الطلب", zh: "订单号" })}</Label>
                    <Input
                      value={formData.orderNumber}
                      onChange={(e) => setFormData({ ...formData, orderNumber: e.target.value })}
                      placeholder={pickLang(language, { ku: "ژمارەی ئۆردەر", en: "Order number", ar: "رقم الطلب", zh: "订单号" })}
                      dir="ltr"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{pickLang(language, { ku: "تراکینگ نەمبەر", en: "Tracking number", ar: "رقم التتبع", zh: "运单号" })}</Label>
                    <Input
                      value={formData.trackingNumber}
                      onChange={(e) => setFormData({ ...formData, trackingNumber: e.target.value })}
                      placeholder={pickLang(language, { ku: "تراکینگ نەمبەر", en: "Tracking number", ar: "رقم التتبع", zh: "运单号" })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{pickLang(language, { ku: "لینکی کاڵا", en: "Product link", ar: "رابط المنتج", zh: "商品链接" })}</Label>
                    <Input
                      value={formData.productLink}
                      onChange={(e) => setFormData({ ...formData, productLink: e.target.value })}
                      placeholder="https://..."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{pickLang(language, { ku: "بڕ", en: "Quantity", ar: "الكمية", zh: "数量" })}</Label>
                    <Input
                      type="number"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                      min="1"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{pickLang(language, { ku: "ڕەنگ", en: "Color", ar: "اللون", zh: "颜色" })}</Label>
                    <Input
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      placeholder={pickLang(language, { ku: "ڕەنگ", en: "Color", ar: "اللون", zh: "颜色" })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{pickLang(language, { ku: "قەبارە", en: "Size", ar: "الحجم", zh: "尺寸" })}</Label>
                    <Input
                      value={formData.size}
                      onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                      placeholder={pickLang(language, { ku: "قەبارە", en: "Size", ar: "الحجم", zh: "尺寸" })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{pickLang(language, { ku: "وەسف", en: "Description", ar: "الوصف", zh: "描述" })}</Label>
                  <Textarea
                    value={formData.productDescription}
                    onChange={(e) => setFormData({ ...formData, productDescription: e.target.value })}
                    placeholder={pickLang(language, { ku: "وەسفی کاڵا...", en: "Product description...", ar: "وصف المنتج...", zh: "商品描述..." })}
                    rows={3}
                  />
                </div>
                {/* Product images — add or replace here when one was missed or
                    wrong at creation time. */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <ImageIcon className="h-4 w-4" />
                    {pickLang(language, { ku: "وێنەکانی کاڵا", en: "Product images", ar: "صور المنتج", zh: "商品图片" })}
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
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-600" />
                  <CardTitle>{pickLang(language, { ku: "نرخەکان", en: "Prices", ar: "الأسعار", zh: "价格" })}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{pickLang(language, { ku: "نرخی کاڵا ($)", en: "Item price ($)", ar: "سعر المنتج ($)", zh: "商品价格 ($)" })}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.itemPriceUsd}
                      onChange={(e) => setFormData({ ...formData, itemPriceUsd: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{pickLang(language, { ku: "عمولە ($)", en: "Commission ($)", ar: "العمولة ($)", zh: "佣金 ($)" })}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.commissionFeeUsd}
                      onChange={(e) => setFormData({ ...formData, commissionFeeUsd: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {quantity > 1 && (
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-muted-foreground">{pickLang(language, { ku: "نرخی کاڵا × بڕ", en: "Item price × quantity", ar: "سعر المنتج × الكمية", zh: "商品价格 × 数量" })}</span>
                    <span className="font-mono font-medium">${itemSubtotal.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-muted-foreground">{pickLang(language, { ku: "عمولە (ڕێگری)", en: "Commission (flat)", ar: "العمولة (ثابتة)", zh: "佣金（固定）" })}</span>
                  <span className="font-mono font-medium text-purple-600">${totalCommission.toFixed(2)}</span>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">{pickLang(language, { ku: "کۆی گشتی", en: "Total", ar: "الإجمالي", zh: "总计" })}</span>
                    <span className="font-mono font-bold text-lg text-purple-700">${totalCost.toFixed(2)}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{pickLang(language, { ku: "تێبینی", en: "Notes", ar: "ملاحظات", zh: "备注" })}</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder={pickLang(language, { ku: "تێبینی...", en: "Notes...", ar: "ملاحظات...", zh: "备注..." })}
                    rows={2}
                  />
                </div>
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
                        {pickLang(language, {
                          ku: "هۆکاری گۆڕینی نرخ",
                          en: "Reason for Price Change",
                          ar: "سبب تغيير السعر",
                          zh: "价格变更原因",
                        })}
                      </CardTitle>
                      <CardDescription className="text-amber-800">
                        {pickLang(language, {
                          ku: "گۆڕانکاریت لە نرخ یان ژمارە کردووە، بۆیە پێویستە هۆکارێک بنووسیت بۆ ئەوەی دەفتەری هەژماری کڕیار ڕێکبخرێتەوە.",
                          en: "You changed a price or quantity, so we need a reason to log the customer-ledger adjustment.",
                          ar: "لقد غيّرت سعراً أو كمية، لذا نحتاج إلى سبب لتسجيل تعديل دفتر حساب العميل.",
                          zh: "您更改了价格或数量，因此需要填写原因以记录客户账目调整。",
                        })}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <Textarea
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                    placeholder={pickLang(language, {
                      ku: "بۆ نموونە: کڕیار داوای دابەزاندنی عمولەی کرد",
                      en: "e.g. Customer requested a commission discount",
                      ar: "مثال: طلب العميل خصماً على العمولة",
                      zh: "例如：客户要求佣金折扣",
                    })}
                    rows={2}
                    dir="auto"
                  />
                  <div className="text-xs text-amber-800 mt-2 text-right">
                    {editReason.trim().length < 3
                      ? `${pickLang(language, { ku: "بەلایەنی کەم ٣ پیت", en: "Min 3 chars", ar: "٣ أحرف على الأقل", zh: "至少3个字符" })} (${editReason.trim().length}/3)`
                      : `${editReason.trim().length} ${pickLang(language, { ku: "پیت", en: "chars", ar: "أحرف", zh: "字符" })}`}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Submit */}
            <div className="flex gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(`/commission/${id}`)}
              >
                <ArrowRight className="h-4 w-4 ms-2" />
                {pickLang(language, { ku: "پاشگەزبوونەوە", en: "Cancel", ar: "إلغاء", zh: "取消" })}
              </Button>
              <Button type="submit" disabled={updateMutation.isPending} className="bg-purple-600 hover:bg-purple-700">
                {updateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 ms-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 ms-2" />
                )}
                {pickLang(language, { ku: "پاشەکەوتکردن", en: "Save", ar: "حفظ", zh: "保存" })}
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
                <CardHeader className="border-b bg-gradient-to-l from-purple-50 to-white">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Package className="h-5 w-5 text-purple-600" />
                    </div>
                    <CardTitle>{t("fullPackage.productInfo")}</CardTitle>
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
                      {order.trackingNumber ? (
                        <Badge variant="secondary" className="font-mono text-sm px-3 py-1 bg-purple-50 text-purple-700 border border-purple-200">
                          {order.trackingNumber}
                        </Badge>
                      ) : (
                        <p className="font-mono font-medium text-muted-foreground">-</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                        <Box className="h-3 w-3" /> {t("fullPackage.quantity")}
                      </p>
                      <p className="font-semibold">{order.quantity} {t("fullPackage.quantityUnit")}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                        <Palette className="h-3 w-3" /> {t("fullPackage.color")}
                      </p>
                      <p className="font-medium">{order.color || "-"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                        <Ruler className="h-3 w-3" /> {t("fullPackage.size")}
                      </p>
                      <p className="font-medium">{order.size || "-"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                        <Layers className="h-3 w-3" /> {t("fullPackage.batch")}
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
                      {order.productDescription || t("fullPackage.noDescription") || "وەسفی کاڵا نییە"}
                    </p>
                  </div>

                  {order.productLink && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">{t("fullPackage.productLink")}</p>
                      <a
                        href={order.productLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-purple-600 hover:text-purple-700 hover:underline"
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
                <CardHeader className="border-b bg-gradient-to-l from-purple-50 to-white">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <ImageIcon className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <CardTitle>{t("fullPackage.productImages") || "وێنەکانی کاڵا"}</CardTitle>
                      <CardDescription>
                        {((order as any).productImages?.length || (order.productImage ? 1 : 0))} {t("fullPackage.imagesCount") || "وێنە"}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  {((order as any).productImages?.length > 0 || order.productImage) ? (
                    <ImageGallery
                      images={(order as any).productImages || (order.productImage ? [order.productImage] : [])}
                      accentColor="amber"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                      <ImageIcon className="h-10 w-10 mb-2 opacity-30" />
                      <p className="text-sm">{t("fullPackage.noImages") || "هیچ وێنەیەک نییە"}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Customer Info Card */}
              <Card className="shadow-sm border-0 bg-white overflow-hidden">
                <CardHeader className="border-b bg-gradient-to-l from-purple-50 to-white">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <User className="h-5 w-5 text-purple-600" />
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
                        <Phone className="h-3 w-3" /> {t("customers.mobileNumber") || "ژمارەی مۆبایل"}
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
                  {/* Item Price */}
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                    <span className="text-sm text-muted-foreground">{t("commission.itemPrice") || "نرخی کاڵا"}</span>
                    <div className="text-right">
                      <span className="font-mono font-semibold">${Number(order.itemPriceUsd || 0).toFixed(2)}</span>
                      {toRmb(Number(order.itemPriceUsd || 0)) && (
                        <p className="text-[11px] text-orange-500 font-mono">≈ {toRmb(Number(order.itemPriceUsd || 0))} ¥</p>
                      )}
                    </div>
                  </div>

                  {/* Commission per item */}
                  <div className="flex justify-between items-center p-3 bg-purple-50 rounded-xl border border-purple-100">
                    <span className="text-sm text-muted-foreground">{t("commission.commissionPerItem") || "عمولەی هەر دانەیەک"}</span>
                    <div className="text-right">
                      <span className="font-mono font-semibold text-purple-600">${Number(order.commissionFeeUsd || 0).toFixed(2)}</span>
                      {toRmb(Number(order.commissionFeeUsd || 0)) && (
                        <p className="text-[11px] text-orange-500 font-mono">≈ {toRmb(Number(order.commissionFeeUsd || 0))} ¥</p>
                      )}
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-dashed my-3"></div>

                  {/* Cost Breakdown. Both the item price and the commission are
                      PER-UNIT, so each is multiplied by quantity. Mirrors
                      server/db/fullPackage.db.ts commissionGoodsTotal:
                        charge = (itemPrice + commissionFee) × qty */}
                  <div className="bg-gray-100 rounded-xl p-4 space-y-2">
                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">{t("fullPackage.costBreakdown")}</p>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t("commission.itemPrice") || "نرخی کاڵا"} × {order.quantity || 1}</span>
                      <span className="font-mono">${((Number(order.itemPriceUsd) || 0) * (order.quantity || 1)).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">+ {t("commission.commission") || "عمولە"} × {order.quantity || 1}</span>
                      <span className="font-mono text-purple-600">${((Number(order.commissionFeeUsd) || 0) * (order.quantity || 1)).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-semibold border-t border-gray-200 pt-2 mt-2">
                      <span>{t("commission.totalCost") || "کۆی گشتی"}</span>
                      <span className="font-mono">${(((Number(order.itemPriceUsd) || 0) + (Number(order.commissionFeeUsd) || 0)) * (order.quantity || 1)).toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Commission Income (Profit equivalent) — per unit */}
                  <div className="flex justify-between items-center p-4 rounded-xl bg-gradient-to-l from-purple-100 to-purple-50 border border-purple-200">
                    <div>
                      <span className="font-semibold block">{t("commission.commissionIncome") || "داهاتی عمولە"}</span>
                      <span className="text-xs text-muted-foreground">
                        {pickLang(language, { ku: `عمولەی ${order.quantity || 1} دانە`, en: `commission for ${order.quantity || 1} units`, ar: `عمولة ${order.quantity || 1} قطعة`, zh: `${order.quantity || 1} 件的佣金` })}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-2xl text-purple-700">
                      ${((Number(order.commissionFeeUsd) || 0) * (order.quantity || 1)).toFixed(2)}
                    </span>
                  </div>

                  {/* Total Cost highlight */}
                  <div className="bg-gradient-to-l from-purple-600 to-purple-700 rounded-xl p-4 text-white">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-purple-100">{t("commission.totalCost") || "کۆی گشتی"}</span>
                      <span className="font-mono font-bold text-2xl">
                        ${(((Number(order.itemPriceUsd) || 0) * (order.quantity || 1)) + (Number(order.commissionFeeUsd) || 0)).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Payment Summary — advance paid + remaining */}
                  {(() => {
                    const totalCost = (((Number(order.itemPriceUsd) || 0) * (order.quantity || 1)) + (Number(order.commissionFeeUsd) || 0));
                    const advancePaid = Number(order.advancePaidUsd || 0);
                    const remaining = Math.max(0, totalCost - advancePaid);
                    const isFullyPaid = advancePaid >= totalCost && totalCost > 0;
                    if (advancePaid <= 0) return null;
                    return (
                      <div className="rounded-xl border-2 border-teal-200 bg-gradient-to-l from-teal-50 to-emerald-50 p-4 space-y-2">
                        <div className="flex items-center gap-2 mb-1">
                          <DollarSign className="h-4 w-4 text-teal-600" />
                          <span className="text-sm font-bold text-teal-800">{pickLang(language, { ku: "پوختەی پارەدان", en: "Payment summary", ar: "ملخص الدفع", zh: "付款摘要" })}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">{pickLang(language, { ku: "کۆی نرخ", en: "Total cost", ar: "إجمالي التكلفة", zh: "总价" })}</span>
                          <span className="font-mono font-semibold">${totalCost.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-teal-700">{pickLang(language, { ku: "پارەی پێشەکی دراو", en: "Advance paid", ar: "الدفعة المقدمة المدفوعة", zh: "已付预付款" })}</span>
                          <span className="font-mono font-semibold text-teal-700">-${advancePaid.toFixed(2)}</span>
                        </div>
                        <div className="h-px bg-teal-200" />
                        <div className="flex justify-between text-base">
                          <span className="font-semibold">{isFullyPaid ? pickLang(language, { ku: "ڕەوشی پارەدان", en: "Payment status", ar: "حالة الدفع", zh: "付款状态" }) : pickLang(language, { ku: "ماوە بۆ پارەدان", en: "Remaining to pay", ar: "المتبقي للدفع", zh: "待付余额" })}</span>
                          {isFullyPaid ? (
                            <span className="font-bold text-emerald-700">{pickLang(language, { ku: "✓ تەواو پارەدراوە", en: "✓ Fully paid", ar: "✓ مدفوع بالكامل", zh: "✓ 已全额付款" })}</span>
                          ) : (
                            <span className="font-mono font-bold text-xl text-amber-700">${remaining.toFixed(2)}</span>
                          )}
                        </div>
                        {order.advancePaymentMethod && (
                          <p className="text-xs text-teal-600">{pickLang(language, { ku: "شێواز", en: "Method", ar: "الطريقة", zh: "方式" })}: {order.advancePaymentMethod}</p>
                        )}
                      </div>
                    );
                  })()}

                  {/* Formula Explanation */}
                  <div className="text-xs text-muted-foreground text-center bg-purple-50 p-3 rounded-xl border border-purple-100">
                    <AlertCircle className="h-3 w-3 inline-block ms-1" />
                    {t("commission.totalCost") || "کۆی گشتی"} = ({t("commission.itemPrice") || "نرخی کاڵا"} + {t("commission.commission") || "عمولە"}) × {t("fullPackage.quantity")}
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
                    {order.notes || t("fullPackage.noNotes") || "تێبینی نییە"}
                  </p>
                </CardContent>
              </Card>

              {/* Plan v3, Phase 4: audit history — admins only */}
              <OrderAuditHistory entityType="full_package_order" entityId={order.id} />
            </div>
          </div>
        )}
      </div>

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
          onDeleted={() => navigate("/commission")}
        />
      )}
    </DashboardLayout>
  );
}
