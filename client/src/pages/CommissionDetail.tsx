import { useState, useEffect, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import ImageGallery from "@/components/ImageGallery";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  const { t } = useTranslation();
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
          `پەت نوێکرایەوە · ${delta > 0 ? "+" : ""}$${delta.toFixed(2)}`
        );
      } else {
        toast.success("پەت نوێکرایەوە");
      }
      setEditReason("");
      utils.fullPackage.list.invalidate();
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
          "ئۆردەرەکە لەلایەن کەسێکی دیکەوە گۆڕدراوە | Order changed elsewhere",
          {
            description:
              "تکایە پەڕەکە نوێ بکەرەوە و هەوڵ بدەرەوە. | Please reload the page and try again.",
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
      const title = rawMsg || `هەڵە لە نوێکردنەوەی پەت | Failed to update order`;
      toast.error(title, {
        description: `کۆدی هەڵە | Error code: ${code}`,
        duration: 10000,
      });
    },
  });

  // Plan v3: delete is handled by <SafeDeleteOrderDialog/> (mounted below).
  // It enforces the required reason, previews the financial impact, and
  // navigates on success.

  // Plan v3: detect whether any money-affecting field would be changed on save.
  // Mirrors server-side computeOrderChargeAmount for commission orders:
  //   charge = itemPrice * qty + commission
  // If this says "money changes", the server will require a non-empty reason
  // and will bump the OCC version.
  const moneyChangeDetected = useMemo(() => {
    if (!order) return false;
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
  }, [order, formData.quantity, formData.itemPriceUsd, formData.commissionFeeUsd]);

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
        "هۆکار پێویستە بۆ گۆڕینی نرخ (بەلایەنی کەم ٣ پیت) | Reason is required when prices change (min 3 chars)"
      );
      return;
    }

    updateMutation.mutate({
      id: Number(id),
      // Plan v3 — OCC + reason for audit trail on any money change.
      expectedVersion: (order as any)?.version,
      reason: moneyChangeDetected ? editReason.trim() : undefined,
      supplierId: formData.supplierId ? Number(formData.supplierId) : null,
      productName: formData.productName,
      productLink: formData.productLink || undefined,
      productImage: formData.productImage || undefined,
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
  // Commission is FLAT (once per order), not per-unit. This matches the
  // server-side formula in server/db/fullPackage.db.ts
  // computeOrderChargeAmount: `itemPrice * qty + commission`.
  const totalCommission = commissionFeeUsd;
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
          <h2 className="text-2xl font-bold text-gray-800 mb-2">{t("commission.orderNotFound") || "پەت نەدۆزرایەوە"}</h2>
          <p className="text-muted-foreground mb-6">{t("fullPackage.orderNotFoundDesc")}</p>
          <Button onClick={() => navigate("/commission")} size="lg" className="bg-purple-600 hover:bg-purple-700">
            <ArrowRight className="h-4 w-4 ms-2" />
            گەڕانەوە بۆ لیست
          </Button>
        </div>
      </DashboardLayout>
    );
  }

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
                  {isEditMode ? t("commission.editOrder") || "دەستکاری پەت" : t("commission.orderDetails") || "وردەکاری پەت"}
                </h1>
                <p className="text-purple-100 flex items-center gap-2 mt-1">
                  <Hash className="h-4 w-4" />
                  {t("commission.orderCode") || "کۆدی پەت"}: <span className="font-mono font-bold">{order.orderCode}</span>
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

        {isEditMode ? (
          /* Edit Form */
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Customer & Supplier */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5 text-purple-600" />
                  <CardTitle>کڕیار</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>کڕیار</Label>
                    <Select
                      value={formData.customerId}
                      onValueChange={(value) => setFormData({ ...formData, customerId: value })}
                      disabled
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="کڕیارێک هەڵبژێرە" />
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
                    <Label>فرۆشیار</Label>
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
                        <SelectValue placeholder="فرۆشیارێک هەڵبژێرە" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">بێ فرۆشیار</SelectItem>
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
                  <CardTitle>باچ</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label>باچ</Label>
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
                      <SelectValue placeholder="باچێک هەڵبژێرە" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">بێ باچ</SelectItem>
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
                  <CardTitle>زانیاری کاڵا</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>ناوی کاڵا *</Label>
                    <Input
                      value={formData.productName}
                      onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                      placeholder="ناوی کاڵا"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>ئۆردەر نەمبەر</Label>
                    <Input
                      value={formData.orderNumber}
                      onChange={(e) => setFormData({ ...formData, orderNumber: e.target.value })}
                      placeholder="ژمارەی ئۆردەر"
                      dir="ltr"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>تراکینگ نەمبەر</Label>
                    <Input
                      value={formData.trackingNumber}
                      onChange={(e) => setFormData({ ...formData, trackingNumber: e.target.value })}
                      placeholder="تراکینگ نەمبەر"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>لینکی کاڵا</Label>
                    <Input
                      value={formData.productLink}
                      onChange={(e) => setFormData({ ...formData, productLink: e.target.value })}
                      placeholder="https://..."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>بڕ</Label>
                    <Input
                      type="number"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                      min="1"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>ڕەنگ</Label>
                    <Input
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      placeholder="ڕەنگ"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>قەبارە</Label>
                    <Input
                      value={formData.size}
                      onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                      placeholder="قەبارە"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>وەسف</Label>
                  <Textarea
                    value={formData.productDescription}
                    onChange={(e) => setFormData({ ...formData, productDescription: e.target.value })}
                    placeholder="وەسفی کاڵا..."
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Pricing */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-600" />
                  <CardTitle>نرخەکان</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>نرخی کاڵا ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.itemPriceUsd}
                      onChange={(e) => setFormData({ ...formData, itemPriceUsd: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>عمولە ($)</Label>
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
                    <span className="text-muted-foreground">نرخی کاڵا × بڕ</span>
                    <span className="font-mono font-medium">${itemSubtotal.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-muted-foreground">عمولە (ڕێگری)</span>
                  <span className="font-mono font-medium text-purple-600">${totalCommission.toFixed(2)}</span>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">کۆی گشتی</span>
                    <span className="font-mono font-bold text-lg text-purple-700">${totalCost.toFixed(2)}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>تێبینی</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="تێبینی..."
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
                    placeholder="بۆ نموونە: کڕیار داوای دابەزاندنی عمولەی کرد | e.g. Customer requested a commission discount"
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
            <div className="flex gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(`/commission/${id}`)}
              >
                <ArrowRight className="h-4 w-4 ms-2" />
                پاشگەزبوونەوە
              </Button>
              <Button type="submit" disabled={updateMutation.isPending} className="bg-purple-600 hover:bg-purple-700">
                {updateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 ms-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 ms-2" />
                )}
                پاشەکەوتکردن
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

                  {/* Cost Breakdown — commission is FLAT (once per order), NOT per-unit.
                      This mirrors server/db/fullPackage.db.ts computeOrderChargeAmount:
                        charge = (itemPrice * qty) + commissionFee
                      Showing it per-unit here (which the page used to do) caused the
                      displayed "total" to exceed the actual customer debit by
                      commission × (qty − 1), confusing operators on multi-unit orders. */}
                  <div className="bg-gray-100 rounded-xl p-4 space-y-2">
                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">{t("fullPackage.costBreakdown")}</p>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t("commission.itemPrice") || "نرخی کاڵا"} × {order.quantity || 1}</span>
                      <span className="font-mono">${((Number(order.itemPriceUsd) || 0) * (order.quantity || 1)).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">+ {t("commission.commission") || "عمولە"}</span>
                      <span className="font-mono text-purple-600">${(Number(order.commissionFeeUsd) || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-semibold border-t border-gray-200 pt-2 mt-2">
                      <span>{t("commission.totalCost") || "کۆی گشتی"}</span>
                      <span className="font-mono">${(((Number(order.itemPriceUsd) || 0) * (order.quantity || 1)) + (Number(order.commissionFeeUsd) || 0)).toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Commission Income (Profit equivalent) — flat per order */}
                  <div className="flex justify-between items-center p-4 rounded-xl bg-gradient-to-l from-purple-100 to-purple-50 border border-purple-200">
                    <div>
                      <span className="font-semibold block">{t("commission.commissionIncome") || "داهاتی عمولە"}</span>
                      <span className="text-xs text-muted-foreground">
                        فلاتە بۆ هەر ئۆردەرێک | flat per order
                      </span>
                    </div>
                    <span className="font-mono font-bold text-2xl text-purple-700">
                      ${(Number(order.commissionFeeUsd) || 0).toFixed(2)}
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
                          <span className="text-sm font-bold text-teal-800">پوختەی پارەدان</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">کۆی نرخ</span>
                          <span className="font-mono font-semibold">${totalCost.toFixed(2)}</span>
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
                        {order.advancePaymentMethod && (
                          <p className="text-xs text-teal-600">شێواز: {order.advancePaymentMethod}</p>
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
