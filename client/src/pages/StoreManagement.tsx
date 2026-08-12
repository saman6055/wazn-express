import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus, Pencil, Trash2, Image as ImageIcon, Store, ShoppingCart,
  Phone, MapPin, ExternalLink, Loader2, Package,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { compressImage } from "@/lib/imageCompression";
import { cn } from "@/lib/utils";

const emptyForm = {
  nameEn: "", nameKu: "", nameAr: "",
  descriptionEn: "", descriptionKu: "", descriptionAr: "",
  price: "", compareAtPrice: "", currency: "USD",
  coverImageUrl: "", category: "", status: "active" as "active" | "hidden" | "out_of_stock",
  stock: "", isFeatured: false, sortOrder: 0,
};

const ORDER_STATUSES = ["new", "confirmed", "preparing", "shipped", "delivered", "cancelled"] as const;
const orderStatusMeta: Record<string, { label: { ku: string; en: string; ar: string; zh: string }; cls: string }> = {
  new:       { label: { ku: "نوێ", en: "New", ar: "جديد", zh: "新" }, cls: "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300" },
  confirmed: { label: { ku: "پەسەندکراو", en: "Confirmed", ar: "مؤكد", zh: "已确认" }, cls: "bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300" },
  preparing: { label: { ku: "ئامادەکردن", en: "Preparing", ar: "قيد التحضير", zh: "备货中" }, cls: "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300" },
  shipped:   { label: { ku: "نێردرا", en: "Shipped", ar: "تم الشحن", zh: "已发货" }, cls: "bg-cyan-100 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300" },
  delivered: { label: { ku: "گەیشت", en: "Delivered", ar: "تم التسليم", zh: "已送达" }, cls: "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300" },
  cancelled: { label: { ku: "هەڵوەشاوە", en: "Cancelled", ar: "ملغى", zh: "已取消" }, cls: "bg-slate-100 dark:bg-slate-950/40 text-slate-600" },
};

export default function StoreManagement() {
  const { t, language } = useTranslation();
  const label = (v: { ku: string; en: string; ar: string; zh: string }) => pickLang(language, v);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [uploading, setUploading] = useState(false);

  const productsQ = trpc.store.listAllProducts.useQuery();
  const ordersQ = trpc.store.listOrders.useQuery();

  const invalidate = () => { productsQ.refetch(); };
  const createMutation = trpc.store.createProduct.useMutation({ onSuccess: () => { toast.success(label({ ku: "کاڵا زیادکرا", en: "Product added", ar: "تمت الإضافة", zh: "已添加" })); setDialogOpen(false); invalidate(); }, onError: (e) => toast.error(e.message) });
  const updateMutation = trpc.store.updateProduct.useMutation({ onSuccess: () => { toast.success(label({ ku: "نوێکرایەوە", en: "Updated", ar: "تم التحديث", zh: "已更新" })); setDialogOpen(false); invalidate(); }, onError: (e) => toast.error(e.message) });
  const deleteMutation = trpc.store.deleteProduct.useMutation({ onSuccess: () => { toast.success(label({ ku: "سڕایەوە", en: "Deleted", ar: "تم الحذف", zh: "已删除" })); invalidate(); }, onError: (e) => toast.error(e.message) });
  const uploadMutation = trpc.store.uploadImage.useMutation({
    onSuccess: (res) => { if (res.success && res.url) { setForm((f) => ({ ...f, coverImageUrl: res.url! })); toast.success(label({ ku: "وێنە بارکرا", en: "Image uploaded", ar: "تم رفع الصورة", zh: "图片已上传" })); } else { toast.error(res.error || "upload failed"); } setUploading(false); },
    onError: (e) => { toast.error(e.message); setUploading(false); },
  });
  const orderStatusMutation = trpc.store.updateOrderStatus.useMutation({ onSuccess: () => { ordersQ.refetch(); }, onError: (e) => toast.error(e.message) });

  const openCreate = () => { setEditingId(null); setForm({ ...emptyForm }); setDialogOpen(true); };
  const openEdit = (p: any) => {
    setEditingId(p.id);
    setForm({
      nameEn: p.nameEn || "", nameKu: p.nameKu || "", nameAr: p.nameAr || "",
      descriptionEn: p.descriptionEn || "", descriptionKu: p.descriptionKu || "", descriptionAr: p.descriptionAr || "",
      price: String(p.price ?? ""), compareAtPrice: p.compareAtPrice != null ? String(p.compareAtPrice) : "",
      currency: p.currency || "USD", coverImageUrl: p.coverImageUrl || "", category: p.category || "",
      status: p.status || "active", stock: p.stock != null ? String(p.stock) : "", isFeatured: !!p.isFeatured, sortOrder: p.sortOrder || 0,
    });
    setDialogOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const compressed = await compressImage(file, { maxWidth: 1200, maxHeight: 1200, quality: 0.8 });
      const bytes = new Uint8Array(await compressed.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      uploadMutation.mutate({ fileName: compressed.name, contentType: compressed.type, base64Data: btoa(binary) });
    } catch {
      toast.error(label({ ku: "بارکردن سەرکەوتوو نەبوو", en: "Upload failed", ar: "فشل الرفع", zh: "上传失败" }));
      setUploading(false);
    }
  };

  const save = () => {
    if (!form.nameEn && !form.nameKu && !form.nameAr) { toast.error(label({ ku: "ناوی کاڵا پێویستە", en: "Product name is required", ar: "اسم المنتج مطلوب", zh: "需要产品名称" })); return; }
    if (!form.price || parseFloat(form.price) < 0) { toast.error(label({ ku: "نرخ پێویستە", en: "Price is required", ar: "السعر مطلوب", zh: "需要价格" })); return; }
    const payload = {
      nameEn: form.nameEn || undefined, nameKu: form.nameKu || undefined, nameAr: form.nameAr || undefined,
      descriptionEn: form.descriptionEn || undefined, descriptionKu: form.descriptionKu || undefined, descriptionAr: form.descriptionAr || undefined,
      price: parseFloat(form.price),
      compareAtPrice: form.compareAtPrice ? parseFloat(form.compareAtPrice) : undefined,
      currency: form.currency,
      coverImageUrl: form.coverImageUrl || undefined,
      category: form.category || undefined,
      status: form.status,
      stock: form.stock !== "" ? parseInt(form.stock) : null,
      isFeatured: form.isFeatured,
      sortOrder: Number(form.sortOrder) || 0,
    };
    if (editingId) updateMutation.mutate({ id: editingId, ...payload });
    else createMutation.mutate(payload);
  };

  const products = productsQ.data || [];
  const orders = ordersQ.data || [];
  const money = (v: any, c: string) => `${Number(v).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${c}`;

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white shadow-lg">
              <Store className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">{label({ ku: "وەزن ستۆر", en: "Wazn Store", ar: "متجر وزن", zh: "Wazn 商店" })}</h1>
              <p className="text-sm text-muted-foreground">{label({ ku: "بەڕێوەبردنی کاڵا و داواکارییەکان", en: "Manage products and orders", ar: "إدارة المنتجات والطلبات", zh: "管理产品和订单" })}</p>
            </div>
          </div>
          <a href="/store" target="_blank" rel="noreferrer">
            <Button variant="outline" size="sm" className="gap-1.5"><ExternalLink className="w-4 h-4" />{label({ ku: "بینینی ستۆر", en: "View store", ar: "عرض المتجر", zh: "查看商店" })}</Button>
          </a>
        </div>

        <Tabs defaultValue="products">
          <TabsList className="mb-4">
            <TabsTrigger value="products" className="gap-1.5"><Package className="w-4 h-4" />{label({ ku: "کاڵاکان", en: "Products", ar: "المنتجات", zh: "产品" })} ({products.length})</TabsTrigger>
            <TabsTrigger value="orders" className="gap-1.5"><ShoppingCart className="w-4 h-4" />{label({ ku: "داواکارییەکان", en: "Orders", ar: "الطلبات", zh: "订单" })} ({orders.length})</TabsTrigger>
          </TabsList>

          {/* PRODUCTS */}
          <TabsContent value="products">
            <div className="flex justify-end mb-4">
              <Button onClick={openCreate} className="gap-1.5"><Plus className="w-4 h-4" />{label({ ku: "کاڵای نوێ", en: "New product", ar: "منتج جديد", zh: "新产品" })}</Button>
            </div>
            {productsQ.isLoading ? (
              <div className="text-center py-16 text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
            ) : products.length === 0 ? (
              <Card><CardContent className="py-16 text-center text-muted-foreground">{label({ ku: "هێشتا هیچ کاڵایەک نییە", en: "No products yet", ar: "لا توجد منتجات", zh: "暂无产品" })}</CardContent></Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {products.map((p: any) => (
                  <Card key={p.id} className="overflow-hidden">
                    <div className="aspect-video bg-muted relative">
                      {p.coverImageUrl ? <img src={p.coverImageUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-8 h-8 text-muted-foreground/40" /></div>}
                      <div className="absolute top-2 end-2 flex gap-1">
                        {p.isFeatured && <Badge className="bg-amber-500">★</Badge>}
                        <Badge variant={p.status === "active" ? "default" : "secondary"} className={cn(p.status === "hidden" && "bg-slate-400", p.status === "out_of_stock" && "bg-red-500")}>
                          {label(p.status === "active" ? { ku: "چالاک", en: "Active", ar: "نشط", zh: "上架" } : p.status === "hidden" ? { ku: "شاراوە", en: "Hidden", ar: "مخفي", zh: "隐藏" } : { ku: "نەماوە", en: "Sold out", ar: "نفد", zh: "售罄" })}
                        </Badge>
                      </div>
                    </div>
                    <CardContent className="p-3">
                      <p className="font-medium text-sm line-clamp-1">{p.nameKu || p.nameEn || p.nameAr}</p>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="font-bold text-violet-600 dark:text-violet-300">{money(p.price, p.currency)}</span>
                        <span className="text-xs text-muted-foreground">{p.orderCount} {label({ ku: "ئۆردەر", en: "orders", ar: "طلب", zh: "订单" })}</span>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={() => openEdit(p)}><Pencil className="w-3.5 h-3.5" />{label({ ku: "دەستکاری", en: "Edit", ar: "تعديل", zh: "编辑" })}</Button>
                        <Button variant="outline" size="sm" className="text-red-600 dark:text-red-300 hover:text-red-700" onClick={() => { if (confirm(label({ ku: "دڵنیایت؟", en: "Delete this product?", ar: "حذف؟", zh: "删除？" }))) deleteMutation.mutate({ id: p.id }); }}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ORDERS */}
          <TabsContent value="orders">
            {ordersQ.isLoading ? (
              <div className="text-center py-16 text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
            ) : orders.length === 0 ? (
              <Card><CardContent className="py-16 text-center text-muted-foreground">{label({ ku: "هێشتا هیچ داواکارییەک نییە", en: "No orders yet", ar: "لا توجد طلبات", zh: "暂无订单" })}</CardContent></Card>
            ) : (
              <div className="space-y-3">
                {orders.map((o: any) => (
                  <Card key={o.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex items-start gap-3">
                          {o.productImageUrl ? <img src={o.productImageUrl} alt="" className="w-14 h-14 rounded-xl object-cover" /> : <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center"><ImageIcon className="w-6 h-6 text-muted-foreground/40" /></div>}
                          <div>
                            <p className="font-medium text-sm">{o.productName} <span className="text-muted-foreground">× {o.quantity}</span></p>
                            <p className="text-xs font-mono text-muted-foreground">{o.orderCode} · {money(o.totalPrice, o.currency)}</p>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">{o.customerName}</span>
                              <a href={`https://wa.me/${o.customerPhone.replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-300"><Phone className="w-3 h-3" />{o.customerPhone}</a>
                              {(o.customerCity || o.customerAddress) && <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" />{[o.customerCity, o.customerAddress].filter(Boolean).join("، ")}</span>}
                            </div>
                            {o.note && <p className="text-xs text-muted-foreground mt-1 italic">“{o.note}”</p>}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <Badge className={orderStatusMeta[o.status]?.cls}>{label(orderStatusMeta[o.status]?.label || orderStatusMeta.new.label)}</Badge>
                          <Select value={o.status} onValueChange={(v) => orderStatusMutation.mutate({ id: o.id, status: v as any })}>
                            <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {ORDER_STATUSES.map((s) => <SelectItem key={s} value={s}>{label(orderStatusMeta[s].label)}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Product create/edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? label({ ku: "دەستکاری کاڵا", en: "Edit product", ar: "تعديل المنتج", zh: "编辑产品" }) : label({ ku: "کاڵای نوێ", en: "New product", ar: "منتج جديد", zh: "新产品" })}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Image */}
            <div>
              <Label>{label({ ku: "وێنە", en: "Cover image", ar: "الصورة", zh: "封面图" })}</Label>
              <div className="mt-1.5 flex items-center gap-3">
                <div className="w-20 h-20 rounded-xl bg-muted overflow-hidden flex items-center justify-center shrink-0">
                  {form.coverImageUrl ? <img src={form.coverImageUrl} alt="" className="w-full h-full object-cover" /> : <ImageIcon className="w-7 h-7 text-muted-foreground/40" />}
                </div>
                <label className="cursor-pointer">
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                  <span className={cn("inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm hover:bg-muted", uploading && "opacity-60 pointer-events-none")}>
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                    {label({ ku: "بارکردنی وێنە", en: "Upload image", ar: "رفع صورة", zh: "上传图片" })}
                  </span>
                </label>
              </div>
            </div>

            {/* Names */}
            <div>
              <Label>{label({ ku: "ناو (کوردی)", en: "Name (Kurdish)", ar: "الاسم (كردي)", zh: "名称（库尔德语）" })}</Label>
              <Input value={form.nameKu} onChange={(e) => setForm({ ...form, nameKu: e.target.value })} className="mt-1.5" dir="rtl" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{label({ ku: "ناو (عەرەبی)", en: "Name (Arabic)", ar: "الاسم (عربي)", zh: "名称（阿拉伯语）" })}</Label><Input value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} className="mt-1.5" dir="rtl" /></div>
              <div><Label>{label({ ku: "ناو (ئینگلیزی)", en: "Name (English)", ar: "الاسم (إنجليزي)", zh: "名称（英语）" })}</Label><Input value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} className="mt-1.5" /></div>
            </div>

            {/* Description (Kurdish primary) */}
            <div>
              <Label>{label({ ku: "وەسف (کوردی)", en: "Description (Kurdish)", ar: "الوصف (كردي)", zh: "描述（库尔德语）" })}</Label>
              <Textarea value={form.descriptionKu} onChange={(e) => setForm({ ...form, descriptionKu: e.target.value })} rows={3} className="mt-1.5" dir="rtl" />
            </div>

            {/* Price row */}
            <div className="grid grid-cols-3 gap-3">
              <div><Label>{label({ ku: "نرخ", en: "Price", ar: "السعر", zh: "价格" })} *</Label><Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="mt-1.5" /></div>
              <div><Label>{label({ ku: "نرخی کۆن", en: "Was price", ar: "السعر قبل", zh: "原价" })}</Label><Input type="number" value={form.compareAtPrice} onChange={(e) => setForm({ ...form, compareAtPrice: e.target.value })} className="mt-1.5" /></div>
              <div><Label>{label({ ku: "دراو", en: "Currency", ar: "العملة", zh: "货币" })}</Label>
                <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}><SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="IQD">IQD</SelectItem></SelectContent></Select>
              </div>
            </div>

            {/* Category + status */}
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{label({ ku: "جۆر", en: "Category", ar: "الفئة", zh: "分类" })}</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="mt-1.5" /></div>
              <div><Label>{label({ ku: "دۆخ", en: "Status", ar: "الحالة", zh: "状态" })}</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as any })}><SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger><SelectContent>
                  <SelectItem value="active">{label({ ku: "چالاک", en: "Active", ar: "نشط", zh: "上架" })}</SelectItem>
                  <SelectItem value="hidden">{label({ ku: "شاراوە", en: "Hidden", ar: "مخفي", zh: "隐藏" })}</SelectItem>
                  <SelectItem value="out_of_stock">{label({ ku: "نەماوە", en: "Out of stock", ar: "نفد", zh: "售罄" })}</SelectItem>
                </SelectContent></Select>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label className="cursor-pointer">{label({ ku: "کاڵای هەڵبژێردراو (Featured)", en: "Featured product", ar: "منتج مميز", zh: "精选产品" })}</Label>
              <Switch checked={form.isFeatured} onCheckedChange={(v) => setForm({ ...form, isFeatured: v })} />
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>{label({ ku: "پاشگەزبوونەوە", en: "Cancel", ar: "إلغاء", zh: "取消" })}</Button>
              <Button className="flex-1" onClick={save} disabled={createMutation.isPending || updateMutation.isPending}>
                {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 animate-spin me-1.5" />}
                {label({ ku: "پاشەکەوتکردن", en: "Save", ar: "حفظ", zh: "保存" })}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
