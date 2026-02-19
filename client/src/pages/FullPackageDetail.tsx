import { useState, useEffect, useCallback } from "react";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "@/contexts/LanguageContext";

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
    productDescription: "",
    quantity: "1",
    color: "",
    size: "",
    purchasePriceUsd: "",
    sellingPriceUsd: "",
    trackingNumber: "",
    notes: "",
    status: "pending",
  });

  const { data: customers } = trpc.customers.list.useQuery();
  const { data: suppliers } = trpc.suppliers.list.useQuery();
  const { data: batches } = trpc.batches.list.useQuery();

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
        purchasePriceUsd: order.purchasePriceUsd?.toString() || "",
        sellingPriceUsd: order.sellingPriceUsd?.toString() || "",
        trackingNumber: order.trackingNumber || "",
        notes: order.notes || "",
        status: order.status || "pending",
      });
    }
  }, [order]);

  const updateMutation = trpc.fullPackage.update.useMutation({
    onSuccess: () => {
      toast.success(t("fullPackage.orderUpdatedSuccess"));
      utils.fullPackage.list.invalidate();
      refetch();
      navigate(`/full-package/${id}`);
    },
    onError: (error) => {
      toast.error(error.message || t("errors.somethingWentWrong"));
    },
  });

  const deleteMutation = trpc.fullPackage.delete.useMutation({
    onSuccess: () => {
      toast.success(t("fullPackage.orderDeleted"));
      utils.fullPackage.list.invalidate();
      navigate("/full-package");
    },
    onError: (error) => {
      toast.error(error.message || t("errors.deleteFailed"));
    },
  });

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

    updateMutation.mutate({
      id: Number(id),
      supplierId: formData.supplierId && formData.supplierId !== "none" ? Number(formData.supplierId) : null,
      productName: formData.productName,
      productLink: formData.productLink || undefined,
      productImage: formData.productImage || undefined,
      orderNumber: formData.orderNumber || undefined,
      productDescription: formData.productDescription || undefined,
      quantity: Number(formData.quantity) || 1,
      color: formData.color || undefined,
      size: formData.size || undefined,
      purchasePriceUsd: formData.purchasePriceUsd || undefined,
      sellingPriceUsd: formData.sellingPriceUsd || undefined,
      trackingNumber: formData.trackingNumber || undefined,
      notes: formData.notes || undefined,
    });
  };

  const handleDelete = () => {
    deleteMutation.mutate({ id: Number(id) });
    setDeleteDialogOpen(false);
  };

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
            <ArrowRight className="h-4 w-4 ml-2" />
            {t("fullPackage.backToList")}
          </Button>
        </div>
      </DashboardLayout>
    );
  }

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
                    <Pencil className="h-4 w-4 ml-2" />
                    {t("common.edit")}
                  </Button>
                  <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        className="bg-red-500 hover:bg-red-600 shadow-md"
                      >
                        <Trash2 className="h-4 w-4 ml-2" />
                        {t("fullPackage.deleteOrder")}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-right">{t("fullPackage.confirmDelete")}</AlertDialogTitle>
                        <AlertDialogDescription className="text-right">
                          {t("fullPackage.deleteOrderDescription")}
                          <br />
                          <span className="font-bold text-red-600">{t("fullPackage.orderCode")}: {order.orderCode}</span>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="flex gap-2">
                        <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDelete}
                          className="bg-red-600 hover:bg-red-700"
                          disabled={deleteMutation.isPending}
                        >
                          {deleteMutation.isPending ? (
                            <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4 ml-2" />
                          )}
                          {t("common.delete")}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              ) : (
                <Badge className={`${statusColors[order.status]} text-sm px-4 py-2 border`}>
                  {statusIcons[order.status]}
                  <span className="mr-2">{statusLabels[order.status]}</span>
                </Badge>
              )}
            </div>
          </div>
        </div>

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
                    <Label className="text-sm font-medium">{t("fullPackage.trackingNumber")}</Label>
                    <Input
                      value={formData.trackingNumber}
                      onChange={(e) => setFormData({ ...formData, trackingNumber: e.target.value })}
                      placeholder={t("fullPackage.trackingNumberPlaceholder")}
                      className="h-11 font-mono"
                    />
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

            {/* Submit */}
            <div className="flex gap-4 sticky bottom-4 bg-white p-4 rounded-xl shadow-lg border">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(`/full-package/${id}`)}
                size="lg"
              >
                <ArrowRight className="h-4 w-4 ml-2" />
                {t("common.cancel")}
              </Button>
              <Button 
                type="submit" 
                disabled={updateMutation.isPending} 
                className="bg-emerald-600 hover:bg-emerald-700 flex-1"
                size="lg"
              >
                {updateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 ml-2" />
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
                        <Hash className="h-3 w-3" /> {t("fullPackage.trackingNumber")}
                      </p>
                      <p className="font-mono font-medium text-blue-600">{order.trackingNumber || "-"}</p>
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
                    <span className="font-mono font-semibold">${Number(order.purchasePriceUsd || 0).toFixed(2)}</span>
                  </div>
                  
                  {/* Selling Price */}
                  <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                    <span className="text-sm text-muted-foreground">{t("fullPackage.sellingPrice")}</span>
                    <span className="font-mono font-semibold text-emerald-600">${Number(order.sellingPriceUsd || 0).toFixed(2)}</span>
                  </div>
                  
                  {/* Shipping Cost */}
                  <div className="flex justify-between items-center p-3 bg-orange-50 rounded-xl border border-orange-100">
                    <span className="text-sm text-muted-foreground">{t("fullPackage.shippingCost")}</span>
                    <span className="font-mono font-semibold text-orange-600">${shippingCost.toFixed(2)}</span>
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
                  
                  {/* Profit */}
                  <div className={`flex justify-between items-center p-4 rounded-xl ${totalProfit >= 0 ? "bg-gradient-to-l from-green-100 to-green-50 border border-green-200" : "bg-gradient-to-l from-red-100 to-red-50 border border-red-200"}`}>
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
                  
                  {/* Formula Explanation */}
                  <div className="text-xs text-muted-foreground text-center bg-blue-50 p-3 rounded-xl border border-blue-100">
                    <AlertCircle className="h-3 w-3 inline-block ml-1" />
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
                      <span className="mr-2">{statusLabels[order.status]}</span>
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
                    <Pencil className="h-4 w-4 ml-2" />
                    {t("fullPackage.editOrder")}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => navigate(`/customers/${order.customerId}`)}
                  >
                    <User className="h-4 w-4 ml-2" />
                    {t("common.view")} {t("fullPackage.customer")}
                  </Button>
                  <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4 ml-2" />
                        {t("fullPackage.deleteOrder")}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-right">{t("fullPackage.confirmDelete")}</AlertDialogTitle>
                        <AlertDialogDescription className="text-right">
                          {t("fullPackage.deleteOrderDescription")}
                          <br />
                          <span className="font-bold text-red-600">{t("fullPackage.orderCode")}: {order.orderCode}</span>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="flex gap-2">
                        <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDelete}
                          className="bg-red-600 hover:bg-red-700"
                          disabled={deleteMutation.isPending}
                        >
                          {deleteMutation.isPending ? (
                            <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4 ml-2" />
                          )}
                          {t("common.delete")}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
