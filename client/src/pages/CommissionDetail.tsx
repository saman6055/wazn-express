import { useState, useEffect } from "react";
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
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-blue-100 text-blue-800",
  ordered: "bg-indigo-100 text-indigo-800",
  tracking_added: "bg-cyan-100 text-cyan-800",
  in_china_warehouse: "bg-purple-100 text-purple-800",
  in_batch: "bg-violet-100 text-violet-800",
  in_transit: "bg-orange-100 text-orange-800",
  arrived: "bg-teal-100 text-teal-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

const statusLabels: Record<string, string> = {
  pending: "چاوەڕوان",
  approved: "پەسەندکراو",
  ordered: "کڕدرا",
  tracking_added: "تراکینگ زیادکرا",
  in_china_warehouse: "لە کۆگای چین",
  in_batch: "لە باچ",
  in_transit: "لە ڕێگادا",
  arrived: "گەیشتووە",
  delivered: "گەیەندرا",
  cancelled: "هەڵوەشاوە",
};

const statusOptions = [
  { value: "pending", label: "چاوەڕوان" },
  { value: "approved", label: "پەسەندکراو" },
  { value: "ordered", label: "کڕدرا" },
  { value: "tracking_added", label: "تراکینگ زیادکرا" },
  { value: "in_china_warehouse", label: "لە کۆگای چین" },
  { value: "in_batch", label: "لە باچ" },
  { value: "in_transit", label: "لە ڕێگادا" },
  { value: "arrived", label: "گەیشتووە" },
  { value: "delivered", label: "گەیەندرا" },
  { value: "cancelled", label: "هەڵوەشاوە" },
];

export default function CommissionDetail() {
  const { id, mode } = useParams<{ id: string; mode?: string }>();
  const [, navigate] = useLocation();
  const isEditMode = mode === "edit";
  
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
        itemPriceUsd: order.itemPriceUsd?.toString() || "",
        commissionFeeUsd: order.commissionFeeUsd?.toString() || "",
        trackingNumber: order.trackingNumber || "",
        notes: order.notes || "",
        status: order.status || "pending",
      });
    }
  }, [order]);

  const updateMutation = trpc.fullPackage.update.useMutation({
    onSuccess: () => {
      toast.success("پەت نوێکرایەوە");
      utils.fullPackage.list.invalidate();
      refetch();
      navigate(`/commission/${id}`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.productName) {
      toast.error("تکایە ناوی کاڵا داخڵ بکە");
      return;
    }

    updateMutation.mutate({
      id: Number(id),
      supplierId: formData.supplierId ? Number(formData.supplierId) : null,
      productName: formData.productName,
      productLink: formData.productLink || undefined,
      productImage: formData.productImage || undefined,
      orderNumber: formData.orderNumber || undefined,
      productDescription: formData.productDescription || undefined,
      quantity: Number(formData.quantity) || 1,
      color: formData.color || undefined,
      size: formData.size || undefined,
      trackingNumber: formData.trackingNumber || undefined,
      notes: formData.notes || undefined,
    });
  };

  const totalCost = (Number(formData.itemPriceUsd) || 0) + (Number(formData.commissionFeeUsd) || 0);

  // Filter batches to show only preparing status
  const availableBatches = batches?.filter(b => b.status === 'preparing') || [];

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6 p-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  if (!order) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-96">
          <Package className="h-16 w-16 text-muted-foreground mb-4" />
          <p className="text-xl text-muted-foreground">پەت نەدۆزرایەوە</p>
          <Button onClick={() => navigate("/commission")} className="mt-4">
            <ArrowRight className="h-4 w-4 ml-2" />
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
        <div className="bg-gradient-to-l from-purple-600 to-purple-700 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/commission")}
                className="text-white hover:bg-white/20"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="p-3 bg-white/20 rounded-xl">
                <Percent className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">
                  {isEditMode ? "دەستکاری پەت" : "وردەکاری پەت"}
                </h1>
                <p className="text-purple-100">
                  کۆدی پەت: {order.orderCode}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!isEditMode && (
                <Button
                  onClick={() => navigate(`/commission/${id}/edit`)}
                  className="bg-white text-purple-700 hover:bg-purple-50"
                >
                  <Pencil className="h-4 w-4 ml-2" />
                  دەستکاری
                </Button>
              )}
              <Badge className={`${statusColors[order.status]} text-sm px-3 py-1`}>
                {statusLabels[order.status]}
              </Badge>
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
                    <Select
                      value={formData.supplierId}
                      onValueChange={(value) => setFormData({ ...formData, supplierId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="فرۆشیارێک هەڵبژێرە" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">بێ فرۆشیار</SelectItem>
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
                  <Select
                    value={formData.batchId}
                    onValueChange={(value) => setFormData({ ...formData, batchId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="باچێک هەڵبژێرە" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">بێ باچ</SelectItem>
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

            {/* Submit */}
            <div className="flex gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(`/commission/${id}`)}
              >
                <ArrowRight className="h-4 w-4 ml-2" />
                پاشگەزبوونەوە
              </Button>
              <Button type="submit" disabled={updateMutation.isPending} className="bg-purple-600 hover:bg-purple-700">
                {updateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 ml-2" />
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
              {/* Product Info */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-purple-600" />
                    <CardTitle>زانیاری کاڵا</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">ناوی کاڵا</p>
                      <p className="font-medium">{order.productName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">تراکینگ نەمبەر</p>
                      <p className="font-medium font-mono">{order.trackingNumber || "-"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">بڕ</p>
                      <p className="font-medium">{order.quantity}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">ڕەنگ</p>
                      <p className="font-medium">{order.color || "-"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">قەبارە</p>
                      <p className="font-medium">{order.size || "-"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">باچ</p>
                      <p className="font-medium">{(order as any).batch?.batchCode || "بێ باچ"}</p>
                    </div>
                  </div>
                  {order.productDescription && (
                    <div>
                      <p className="text-sm text-muted-foreground">وەسف</p>
                      <p className="font-medium">{order.productDescription}</p>
                    </div>
                  )}
                  {order.productLink && (
                    <div>
                      <p className="text-sm text-muted-foreground">لینکی کاڵا</p>
                      <a href={order.productLink} target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">
                        {order.productLink}
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Product Images Gallery */}
              {((order as any).productImages?.length > 0 || order.productImage) && (
                <Card className="shadow-sm border-0 bg-white overflow-hidden">
                  <CardHeader className="border-b bg-gradient-to-l from-purple-50 to-white">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <ImageIcon className="h-5 w-5 text-purple-600" />
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
                    <ImageGallery 
                      images={(order as any).productImages || (order.productImage ? [order.productImage] : [])} 
                      accentColor="amber"
                    />
                  </CardContent>
                </Card>
              )}

              {/* Customer Info */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <User className="h-5 w-5 text-purple-600" />
                    <CardTitle>زانیاری کڕیار</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">ناو</p>
                      <p className="font-medium">{(order as any).customer?.fullName || "-"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">کۆد</p>
                      <p className="font-medium font-mono">{(order as any).customer?.customerCode || "-"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">ژمارەی مۆبایل</p>
                      <p className="font-medium">{(order as any).customer?.mobileNumber || "-"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">فرۆشیار</p>
                      <p className="font-medium">{(order as any).supplier?.name || "-"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Pricing Card */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-green-600" />
                    <CardTitle>نرخەکان</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-muted-foreground">نرخی کاڵا</span>
                    <span className="font-mono font-medium">${order.itemPriceUsd || "0.00"}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-muted-foreground">عمولە</span>
                    <span className="font-mono font-medium text-purple-600">${order.commissionFeeUsd || "0.00"}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-purple-100 rounded-lg">
                    <span className="font-medium">کۆی گشتی</span>
                    <span className="font-mono font-bold text-lg text-purple-700">
                      ${((Number(order.itemPriceUsd) || 0) + (Number(order.commissionFeeUsd) || 0)).toFixed(2)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Status & Date Card */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-purple-600" />
                    <CardTitle>بارودۆخ و بەروار</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">بارودۆخ</p>
                    <Badge className={`${statusColors[order.status]} text-sm px-3 py-1`}>
                      {statusLabels[order.status]}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">بەرواری دروستکردن</p>
                    <p className="font-medium">{new Date(order.createdAt).toLocaleDateString("ku-IQ")}</p>
                  </div>
                  {order.updatedAt && (
                    <div>
                      <p className="text-sm text-muted-foreground">دوایین نوێکردنەوە</p>
                      <p className="font-medium">{new Date(order.updatedAt).toLocaleDateString("ku-IQ")}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Notes */}
              {order.notes && (
                <Card>
                  <CardHeader>
                    <CardTitle>تێبینی</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{order.notes}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
