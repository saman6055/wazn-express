import { usePortalPalette } from "@/components/portal/PortalHeaderControls";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { CustomerPortalLayout } from "@/components/CustomerPortalLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  MapPin, ArrowLeft, Plus, Home, Building2, Store, 
  Phone, User, Edit2, Trash2, Star, Check
} from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { pickLang } from "@/lib/lang";
import { useLanguage } from "@/contexts/LanguageContext";
import { PortalErrorState } from "@/components/portal/PortalErrorState";

export default function PortalAddresses() {
  // Banner colour follows the mode the customer picked, like every other page.
  const { banner: portalBanner } = usePortalPalette();
  // This whole page was English — every label, every placeholder, the delete
  // confirmation — behind a Kurdish-default header.
  const { language } = useLanguage();
const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<any>(null);
  const [formData, setFormData] = useState({
    label: "",
    recipientName: "",
    phone: "",
    city: "",
    district: "",
    street: "",
    building: "",
    floor: "",
    apartment: "",
    landmark: "",
    notes: "",
    isDefault: false,
  });
  
  const { data: addresses, isLoading, isError, isFetching, refetch } = trpc.customerPortal.getMyAddresses.useQuery();
  
  // All four of these used to fail in total silence: no toast, no message, the
  // dialog simply staying open with the button re-enabled. A customer would
  // tap Save again and again with no idea anything was wrong.
  const onError = (e: { message?: string }) =>
    toast.error(e?.message || pickLang(language, {
      ku: "هەڵەیەک ڕوویدا، دووبارە هەوڵ بدەرەوە",
      en: "Something went wrong. Please try again.",
      ar: "حدث خطأ، يرجى المحاولة مرة أخرى.",
      zh: "出错了，请重试。",
    }));

  const savedToast = () =>
    toast.success(pickLang(language, {
      ku: "پاشەکەوت کرا", en: "Saved", ar: "تم الحفظ", zh: "已保存",
    }));

  const createMutation = trpc.customerPortal.createAddress.useMutation({
    onSuccess: () => {
      setIsDialogOpen(false);
      resetForm();
      refetch();
      savedToast();
    },
    onError,
  });

  const updateMutation = trpc.customerPortal.updateAddress.useMutation({
    onSuccess: () => {
      setIsDialogOpen(false);
      setEditingAddress(null);
      resetForm();
      refetch();
      savedToast();
    },
    onError,
  });

  const deleteMutation = trpc.customerPortal.deleteAddress.useMutation({
    onSuccess: () => {
      refetch();
      toast.success(pickLang(language, {
        ku: "ناونیشان سڕایەوە", en: "Address deleted", ar: "تم حذف العنوان", zh: "地址已删除",
      }));
    },
    onError,
  });

  const setDefaultMutation = trpc.customerPortal.setDefaultAddress.useMutation({
    onSuccess: () => {
      refetch();
      toast.success(pickLang(language, {
        ku: "کرا بە ناونیشانی سەرەکی", en: "Set as default", ar: "تم التعيين كافتراضي", zh: "已设为默认",
      }));
    },
    onError,
  });
  
  const resetForm = () => {
    setFormData({
      label: "",
      recipientName: "",
      phone: "",
      city: "",
      district: "",
      street: "",
      building: "",
      floor: "",
      apartment: "",
      landmark: "",
      notes: "",
      isDefault: false,
    });
  };
  
  const openEditDialog = (address: any) => {
    setEditingAddress(address);
    setFormData({
      label: address.label || "",
      recipientName: address.recipientName || "",
      phone: address.phone || "",
      city: address.city || "",
      district: address.district || "",
      street: address.street || "",
      building: address.building || "",
      floor: address.floor || "",
      apartment: address.apartment || "",
      landmark: address.landmark || "",
      notes: address.notes || "",
      isDefault: address.isDefault || false,
    });
    setIsDialogOpen(true);
  };
  
  const openNewDialog = () => {
    setEditingAddress(null);
    resetForm();
    setIsDialogOpen(true);
  };
  
  const handleSubmit = () => {
    if (editingAddress) {
      updateMutation.mutate({
        addressId: editingAddress.id,
        ...formData,
      });
    } else {
      createMutation.mutate(formData);
    }
  };
  
  const getLabelIcon = (label: string) => {
    const lowerLabel = label.toLowerCase();
    if (lowerLabel.includes("home") || lowerLabel.includes("house") || lowerLabel.includes("ماڵ")) {
      return <Home className="h-5 w-5" />;
    }
    if (lowerLabel.includes("office") || lowerLabel.includes("work") || lowerLabel.includes("ئۆفیس")) {
      return <Building2 className="h-5 w-5" />;
    }
    if (lowerLabel.includes("shop") || lowerLabel.includes("store") || lowerLabel.includes("دوکان")) {
      return <Store className="h-5 w-5" />;
    }
    return <MapPin className="h-5 w-5" />;
  };
  
  const getLabelColor = (label: string) => {
    const lowerLabel = label.toLowerCase();
    if (lowerLabel.includes("home") || lowerLabel.includes("house") || lowerLabel.includes("ماڵ")) {
      return "from-blue-400 to-blue-500";
    }
    if (lowerLabel.includes("office") || lowerLabel.includes("work") || lowerLabel.includes("ئۆفیس")) {
      return "from-purple-400 to-purple-500";
    }
    if (lowerLabel.includes("shop") || lowerLabel.includes("store") || lowerLabel.includes("دوکان")) {
      return "from-amber-400 to-amber-500";
    }
    return "from-teal-400 to-teal-500";
  };

  return (
    <CustomerPortalLayout>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950/40">
        {/* Header */}
        <div className="text-white px-4 py-4" style={portalBanner}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/portal/profile">
                <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-400 to-teal-500 flex items-center justify-center">
                  <MapPin className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="font-semibold">{pickLang(language, { ku: "ناونیشانەکانم", en: "My addresses", ar: "عناويني", zh: "我的地址" })}</h1>
                  <p className="text-xs text-gray-300">
                    {addresses?.length || 0} {pickLang(language, { ku: "ناونیشانی پاشەکەوتکراو", en: "saved addresses", ar: "عنوان محفوظ", zh: "个已保存地址" })}
                  </p>
                </div>
              </div>
            </div>
            
            <Button
              onClick={openNewDialog}
              size="sm"
              className="bg-white/10 hover:bg-white/20 text-white"
            >
              <Plus className="h-4 w-4 me-1" />
              {pickLang(language, { ku: "زیادکردن", en: "Add", ar: "إضافة", zh: "添加" })}
            </Button>
          </div>
        </div>
        
        {/* Addresses List */}
        <div className="px-4 py-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="bg-white rounded-xl p-4 animate-pulse">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-full bg-gray-200" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-1/3" />
                      <div className="h-3 bg-gray-200 rounded w-full" />
                      <div className="h-3 bg-gray-200 rounded w-2/3" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : isError ? (
            /* A customer with saved addresses was told they had none. */
            <PortalErrorState onRetry={() => void refetch()} isRetrying={isFetching} />
          ) : addresses?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-teal-100 to-teal-200 flex items-center justify-center mb-4">
                <MapPin className="h-10 w-10 text-teal-500" />
              </div>
              <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">{pickLang(language, { ku: "هێشتا هیچ ناونیشانێک نییە", en: "No addresses yet", ar: "لا توجد عناوين بعد", zh: "暂无地址" })}</h3>
              <p className="text-sm text-gray-500 max-w-xs mb-4">
                {pickLang(language, { ku: "ناونیشانی گەیاندنت زیاد بکە تاکو گەیاندن خێراتر بێت", en: "Add a delivery address so we can reach you faster", ar: "أضف عنوان التسليم لتصلك الشحنات أسرع", zh: "添加配送地址，让我们更快找到您" })}
              </p>
              <Button onClick={openNewDialog} className="bg-teal-500 hover:bg-teal-600">
                <Plus className="h-4 w-4 me-2" />
                {pickLang(language, { ku: "زیادکردنی ناونیشان", en: "Add address", ar: "إضافة عنوان", zh: "添加地址" })}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {addresses?.map((address) => (
                <div
                  key={address.id}
                  className={cn(
                    "bg-white rounded-xl p-4 shadow-sm transition-all duration-200",
                    address.isDefault && "border-2 border-teal-500"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "w-12 h-12 rounded-full bg-gradient-to-br flex items-center justify-center text-white flex-shrink-0",
                      getLabelColor(address.label)
                    )}>
                      {getLabelIcon(address.label)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-800 dark:text-gray-200">{address.label}</h3>
                        {address.isDefault && (
                          <span className="bg-teal-100 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Star className="h-3 w-3 fill-current" />
                            {pickLang(language, { ku: "سەرەکی", en: "Default", ar: "افتراضي", zh: "默认" })}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                        <User className="h-4 w-4 text-gray-400" />
                        {address.recipientName}
                      </div>
                      
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                        <Phone className="h-4 w-4 text-gray-400" />
                        {address.phone}
                      </div>
                      
                      <p className="text-sm text-gray-500">
                        {[address.city, address.district, address.street, address.building]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                      
                      {address.landmark && (
                        <p className="text-xs text-gray-400 mt-1">
                          Near: {address.landmark}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800/60">
                    {!address.isDefault && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-teal-600 hover:text-teal-700 hover:bg-teal-50"
                        onClick={() => setDefaultMutation.mutate({ addressId: address.id })}
                        disabled={setDefaultMutation.isPending}
                      >
                        <Check className="h-4 w-4 me-1" />
                        {pickLang(language, { ku: "بیکە بە سەرەکی", en: "Set as default", ar: "تعيين كافتراضي", zh: "设为默认" })}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-gray-600 hover:text-gray-700"
                      onClick={() => openEditDialog(address)}
                    >
                      <Edit2 className="h-4 w-4 me-1" />
                      {pickLang(language, { ku: "دەستکاری", en: "Edit", ar: "تعديل", zh: "编辑" })}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => {
                        if (confirm(pickLang(language, { ku: "دڵنیایت لە سڕینەوەی ئەم ناونیشانە؟", en: "Delete this address?", ar: "هل تريد حذف هذا العنوان؟", zh: "确定删除此地址吗？" }))) {
                          deleteMutation.mutate({ addressId: address.id });
                        }
                      }}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 me-1" />
                      {pickLang(language, { ku: "سڕینەوە", en: "Delete", ar: "حذف", zh: "删除" })}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Add/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingAddress ? pickLang(language, { ku: "دەستکاری ناونیشان", en: "Edit address", ar: "تعديل العنوان", zh: "编辑地址" }) : pickLang(language, { ku: "زیادکردنی ناونیشان", en: "Add address", ar: "إضافة عنوان", zh: "添加地址" })}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              {/* Label */}
              <div className="space-y-2">
                <Label>{pickLang(language, { ku: "ناوی ناونیشان *", en: "Address label *", ar: "اسم العنوان *", zh: "地址名称 *" })}</Label>
                <div className="flex gap-2">
                  {["Home", "Office", "Shop"].map((label) => (
                    <Button
                      key={label}
                      type="button"
                      variant={formData.label === label ? "default" : "outline"}
                      size="sm"
                      onClick={() => setFormData({ ...formData, label })}
                      className={cn(
                        formData.label === label && "bg-teal-500 hover:bg-teal-600"
                      )}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
                <Input
                  placeholder={pickLang(language, { ku: "یان ناوێکی خۆت بنووسە", en: "Or enter your own", ar: "أو اكتب اسماً خاصاً", zh: "或自定义名称" })}
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                />
              </div>
              
              {/* Recipient Name */}
              <div className="space-y-2">
                <Label>{pickLang(language, { ku: "ناوی وەرگر *", en: "Recipient name *", ar: "اسم المستلم *", zh: "收件人姓名 *" })}</Label>
                <Input
                  placeholder={pickLang(language, { ku: "ناوی تەواوی وەرگر", en: "Recipient's full name", ar: "الاسم الكامل للمستلم", zh: "收件人全名" })}
                  value={formData.recipientName}
                  onChange={(e) => setFormData({ ...formData, recipientName: e.target.value })}
                />
              </div>
              
              {/* Phone */}
              <div className="space-y-2">
                <Label>{pickLang(language, { ku: "ژمارەی مۆبایل *", en: "Phone number *", ar: "رقم الهاتف *", zh: "手机号码 *" })}</Label>
                <Input
                  placeholder="07XX XXX XXXX"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              
              {/* City */}
              <div className="space-y-2">
                <Label>{pickLang(language, { ku: "شار *", en: "City *", ar: "المدينة *", zh: "城市 *" })}</Label>
                <Input
                  placeholder="e.g., Erbil, Sulaymaniyah, Baghdad"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                />
              </div>
              
              {/* District */}
              <div className="space-y-2">
                <Label>{pickLang(language, { ku: "گەڕەک", en: "District", ar: "الحي", zh: "区/街道" })}</Label>
                <Input
                  placeholder="e.g., Ankawa, Ainkawa"
                  value={formData.district}
                  onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                />
              </div>
              
              {/* Street */}
              <div className="space-y-2">
                <Label>{pickLang(language, { ku: "شەقام", en: "Street", ar: "الشارع", zh: "街道" })}</Label>
                <Input
                  placeholder={pickLang(language, { ku: "ناو یان ژمارەی شەقام", en: "Street name or number", ar: "اسم أو رقم الشارع", zh: "街道名称或号码" })}
                  value={formData.street}
                  onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                />
              </div>
              
              {/* Building Details */}
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-2">
                  <Label>{pickLang(language, { ku: "بینا", en: "Building", ar: "المبنى", zh: "楼" })}</Label>
                  <Input
                    placeholder={pickLang(language, { ku: "ژمارە", en: "No.", ar: "رقم", zh: "号" })}
                    value={formData.building}
                    onChange={(e) => setFormData({ ...formData, building: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{pickLang(language, { ku: "نهۆم", en: "Floor", ar: "الطابق", zh: "层" })}</Label>
                  <Input
                    placeholder={pickLang(language, { ku: "نهۆم", en: "Floor", ar: "الطابق", zh: "层" })}
                    value={formData.floor}
                    onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{pickLang(language, { ku: "شوقە", en: "Apt", ar: "الشقة", zh: "单元" })}</Label>
                  <Input
                    placeholder={pickLang(language, { ku: "شوقە", en: "Apt", ar: "الشقة", zh: "单元" })}
                    value={formData.apartment}
                    onChange={(e) => setFormData({ ...formData, apartment: e.target.value })}
                  />
                </div>
              </div>
              
              {/* Landmark */}
              <div className="space-y-2">
                <Label>{pickLang(language, { ku: "نیشانەی نزیک", en: "Landmark", ar: "علامة مميزة", zh: "附近标志" })}</Label>
                <Input
                  placeholder={pickLang(language, { ku: "نزیک لە شوێنێکی ناسراو", en: "Near a well-known place", ar: "بالقرب من مكان معروف", zh: "靠近知名地点" })}
                  value={formData.landmark}
                  onChange={(e) => setFormData({ ...formData, landmark: e.target.value })}
                />
              </div>
              
              {/* Notes */}
              <div className="space-y-2">
                <Label>{pickLang(language, { ku: "تێبینی گەیاندن", en: "Delivery notes", ar: "ملاحظات التسليم", zh: "配送备注" })}</Label>
                <Textarea
                  placeholder={pickLang(language, { ku: "هەر ڕێنماییەکی تایبەت بۆ گەیاندن", en: "Any special delivery instructions", ar: "أي تعليمات خاصة للتسليم", zh: "任何特殊配送说明" })}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                />
              </div>
              
              {/* Default Checkbox */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isDefault"
                  checked={formData.isDefault}
                  onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                  className="rounded border-gray-300 dark:border-gray-800/60 text-teal-500 focus:ring-teal-500"
                />
                <Label htmlFor="isDefault" className="cursor-pointer">
                  {pickLang(language, { ku: "بیکە بە ناونیشانی سەرەکی", en: "Set as my default address", ar: "اجعله عنواني الافتراضي", zh: "设为默认地址" })}
                </Label>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setIsDialogOpen(false)}
              >
                {pickLang(language, { ku: "پاشگەزبوونەوە", en: "Cancel", ar: "إلغاء", zh: "取消" })}
              </Button>
              <Button
                className="flex-1 bg-teal-500 hover:bg-teal-600"
                onClick={handleSubmit}
                disabled={
                  !formData.label || 
                  !formData.recipientName || 
                  !formData.phone || 
                  !formData.city ||
                  createMutation.isPending ||
                  updateMutation.isPending
                }
              >
                {editingAddress ? pickLang(language, { ku: "نوێکردنەوە", en: "Update", ar: "تحديث", zh: "更新" }) : pickLang(language, { ku: "پاشەکەوتکردن", en: "Save", ar: "حفظ", zh: "保存" })}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </CustomerPortalLayout>
  );
}
