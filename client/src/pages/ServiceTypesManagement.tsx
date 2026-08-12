import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  Settings,
  Plus,
  ArrowRight,
  Edit,
  Trash2,
  DollarSign,
  Palette,
  Tag,
  CheckCircle,
  XCircle,
  Wrench,
  AlertTriangle,
  RotateCcw,
  Home,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";

// Color options for service types
const colorOptions = [
  { value: "blue", label: { ku: "شین", en: "Blue", ar: "أزرق", zh: "蓝色" }, bg: "bg-blue-500", text: "text-blue-500" },
  { value: "green", label: { ku: "سەوز", en: "Green", ar: "أخضر", zh: "绿色" }, bg: "bg-green-500", text: "text-green-500" },
  { value: "red", label: { ku: "سور", en: "Red", ar: "أحمر", zh: "红色" }, bg: "bg-red-500", text: "text-red-500" },
  { value: "yellow", label: { ku: "زەرد", en: "Yellow", ar: "أصفر", zh: "黄色" }, bg: "bg-yellow-500", text: "text-yellow-500" },
  { value: "purple", label: { ku: "مۆر", en: "Purple", ar: "بنفسجي", zh: "紫色" }, bg: "bg-purple-500", text: "text-purple-500" },
  { value: "pink", label: { ku: "پەمبەیی", en: "Pink", ar: "وردي", zh: "粉色" }, bg: "bg-pink-500", text: "text-pink-500" },
  { value: "orange", label: { ku: "پرتەقاڵی", en: "Orange", ar: "برتقالي", zh: "橙色" }, bg: "bg-orange-500", text: "text-orange-500" },
  { value: "teal", label: { ku: "شینی کەمرەنگ", en: "Teal", ar: "أزرق مخضر", zh: "青色" }, bg: "bg-teal-500", text: "text-teal-500" },
];

// Icon options
const iconOptions = [
  { value: "wrench", label: { ku: "کلیل", en: "Wrench", ar: "مفتاح", zh: "扳手" } },
  { value: "truck", label: { ku: "بارهەڵگر", en: "Truck", ar: "شاحنة", zh: "卡车" } },
  { value: "package", label: { ku: "پاکەت", en: "Package", ar: "طرد", zh: "包裹" } },
  { value: "box", label: { ku: "سندوق", en: "Box", ar: "صندوق", zh: "箱子" } },
  { value: "shield", label: { ku: "پاراستن", en: "Shield", ar: "درع", zh: "盾牌" } },
  { value: "star", label: { ku: "ئەستێرە", en: "Star", ar: "نجمة", zh: "星星" } },
  { value: "zap", label: { ku: "خێرا", en: "Fast", ar: "سريع", zh: "快速" } },
  { value: "gift", label: { ku: "دیاری", en: "Gift", ar: "هدية", zh: "礼物" } },
];

export default function ServiceTypesManagement() {
  const { language } = useTranslation();
  const [, navigate] = useLocation();
  
  // Dialog states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingType, setEditingType] = useState<any>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    nameEn: "",
    nameKu: "",
    nameAr: "",
    icon: "wrench",
    color: "blue",
    defaultCost: "",
    defaultPrice: "",
    isActive: true,
  });
  
  // Queries
  const { data: serviceTypes, isLoading, isError, error, refetch } = trpc.extraServices.getServiceTypes.useQuery();
  
  // Mutations
  const createMutation = trpc.extraServices.createServiceType.useMutation({
    onSuccess: () => {
      toast.success(pickLang(language, { ku: "جۆری خزمەتگوزاری بە سەرکەوتوویی زیادکرا", en: "Service type added successfully", ar: "تمت إضافة نوع الخدمة بنجاح", zh: "服务类型添加成功" }));
      setIsAddOpen(false);
      resetForm();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || pickLang(language, { ku: "هەڵەیەک ڕوویدا", en: "An error occurred", ar: "حدث خطأ", zh: "发生错误" }));
    },
  });

  const updateMutation = trpc.extraServices.updateServiceType.useMutation({
    onSuccess: () => {
      toast.success(pickLang(language, { ku: "جۆری خزمەتگوزاری بە سەرکەوتوویی نوێکرایەوە", en: "Service type updated successfully", ar: "تم تحديث نوع الخدمة بنجاح", zh: "服务类型更新成功" }));
      setIsEditOpen(false);
      setEditingType(null);
      resetForm();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || pickLang(language, { ku: "هەڵەیەک ڕوویدا", en: "An error occurred", ar: "حدث خطأ", zh: "发生错误" }));
    },
  });

  const deleteMutation = trpc.extraServices.deleteServiceType.useMutation({
    onSuccess: () => {
      toast.success(pickLang(language, { ku: "جۆری خزمەتگوزاری سڕایەوە", en: "Service type deleted", ar: "تم حذف نوع الخدمة", zh: "服务类型已删除" }));
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || pickLang(language, { ku: "هەڵەیەک ڕوویدا", en: "An error occurred", ar: "حدث خطأ", zh: "发生错误" }));
    },
  });
  
  const resetForm = () => {
    setFormData({
      nameEn: "",
      nameKu: "",
      nameAr: "",
      icon: "wrench",
      color: "blue",
      defaultCost: "",
      defaultPrice: "",
      isActive: true,
    });
  };
  
  const handleEdit = (type: any) => {
    setEditingType(type);
    setFormData({
      nameEn: type.nameEn || "",
      nameKu: type.nameKu || "",
      nameAr: type.nameAr || "",
      icon: type.icon || "wrench",
      color: type.color || "blue",
      defaultCost: type.defaultCost || "",
      defaultPrice: type.defaultPrice || "",
      isActive: type.isActive ?? true,
    });
    setIsEditOpen(true);
  };
  
  const handleSubmit = () => {
    if (!formData.nameEn && !formData.nameKu) {
      toast.error(pickLang(language, { ku: "تکایە لانیکەم یەک ناو داخڵ بکە", en: "Please enter at least one name", ar: "يرجى إدخال اسم واحد على الأقل", zh: "请至少输入一个名称" }));
      return;
    }
    
    if (editingType) {
      updateMutation.mutate({
        id: editingType.id,
        ...formData,
      });
    } else {
      createMutation.mutate(formData);
    }
  };
  
  const getColorClass = (color: string) => {
    const colorOption = colorOptions.find(c => c.value === color);
    return colorOption?.bg || "bg-gray-500";
  };
  
  const getTextColorClass = (color: string) => {
    const colorOption = colorOptions.find(c => c.value === color);
    return colorOption?.text || "text-gray-500";
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-l from-violet-600 to-purple-600 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20"
                onClick={() => navigate("/services")}
              >
                <ArrowRight className="h-5 w-5" />
              </Button>
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <Settings className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">{pickLang(language, { ku: "جۆرەکانی خزمەتگوزاری", en: "Service Types", ar: "أنواع الخدمات", zh: "服务类型" })}</h1>
                <p className="text-violet-100 mt-1">{pickLang(language, { ku: "بەڕێوەبردنی جۆرەکانی خزمەتگوزاری", en: "Manage service types", ar: "إدارة أنواع الخدمات", zh: "管理服务类型" })}</p>
              </div>
            </div>
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button className="bg-white dark:bg-card text-violet-600 dark:text-violet-300 hover:bg-violet-50">
                  <Plus className="h-4 w-4 ms-2" />
                  {pickLang(language, { ku: "زیادکردنی جۆری نوێ", en: "Add New Type", ar: "إضافة نوع جديد", zh: "添加新类型" })}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>{pickLang(language, { ku: "زیادکردنی جۆری خزمەتگوزاری", en: "Add Service Type", ar: "إضافة نوع خدمة", zh: "添加服务类型" })}</DialogTitle>
                  <DialogDescription>
                    {pickLang(language, { ku: "جۆری نوێی خزمەتگوزاری زیاد بکە", en: "Add a new service type", ar: "أضف نوع خدمة جديد", zh: "添加新的服务类型" })}
                  </DialogDescription>
                </DialogHeader>
                <ServiceTypeForm
                  formData={formData}
                  setFormData={setFormData}
                  onSubmit={handleSubmit}
                  onCancel={() => {
                    setIsAddOpen(false);
                    resetForm();
                  }}
                  isLoading={createMutation.isPending}
                  submitLabel={pickLang(language, { ku: "زیادکردن", en: "Add", ar: "إضافة", zh: "添加" })}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>
        
        {/* API error: show message + retry instead of breaking the whole app */}
        {isError && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="p-6 flex flex-col items-center justify-center text-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{pickLang(language, { ku: "هەڵەیەک ڕوویدا", en: "An error occurred", ar: "حدث خطأ", zh: "发生错误" })}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {error?.message || pickLang(language, { ku: "نەتوانرا زانیاری جۆرەکانی خزمەتگوزاری وەربگیرێت. تکایە دووبارە هەوڵ بدەرەوە.", en: "Could not load service types. Please try again.", ar: "تعذر تحميل أنواع الخدمات. يرجى المحاولة مرة أخرى.", zh: "无法加载服务类型。请重试。" })}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => refetch()} className="gap-2">
                  <RotateCcw size={16} />
                  {pickLang(language, { ku: "دووبارە هەوڵ بدەرەوە", en: "Try Again", ar: "حاول مرة أخرى", zh: "重试" })}
                </Button>
                <Button variant="outline" onClick={() => navigate("/")} className="gap-2">
                  <Home size={16} />
                  {pickLang(language, { ku: "گەڕانەوە بۆ سەرەکی", en: "Back to Home", ar: "العودة إلى الرئيسية", zh: "返回首页" })}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Service Types Grid */}
        {!isError && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="border-0 shadow-lg animate-pulse">
                <CardContent className="p-6">
                  <div className="h-20 bg-muted rounded"></div>
                </CardContent>
              </Card>
            ))
          ) : serviceTypes?.length === 0 ? (
            <Card className="border-0 shadow-lg col-span-full">
              <CardContent className="p-12 text-center">
                <Wrench className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">{pickLang(language, { ku: "هیچ جۆرێکی خزمەتگوزاری نەدۆزرایەوە", en: "No service types found", ar: "لم يتم العثور على أنواع خدمات", zh: "未找到服务类型" })}</p>
                <Button
                  className="mt-4"
                  onClick={() => setIsAddOpen(true)}
                >
                  <Plus className="h-4 w-4 ms-2" />
                  {pickLang(language, { ku: "زیادکردنی جۆری یەکەم", en: "Add First Type", ar: "إضافة أول نوع", zh: "添加第一个类型" })}
                </Button>
              </CardContent>
            </Card>
          ) : (
            serviceTypes?.map((type: any) => (
              <Card 
                key={type.id} 
                className={`border-0 shadow-lg hover:shadow-xl transition-all duration-200 ${
                  !type.isActive ? 'opacity-60' : ''
                }`}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-xl ${getColorClass(type.color)} bg-opacity-20`}>
                        <Wrench className={`h-6 w-6 ${getTextColorClass(type.color)}`} />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg">{type.nameKu || type.nameEn}</h3>
                        {type.nameEn && type.nameKu && (
                          <p className="text-sm text-muted-foreground">{type.nameEn}</p>
                        )}
                      </div>
                    </div>
                    <Badge variant={type.isActive ? "default" : "secondary"} className="text-xs">
                      {type.isActive ? (
                        <>
                          <CheckCircle className="h-3 w-3 ms-1" />
                          {pickLang(language, { ku: "چالاک", en: "Active", ar: "نشط", zh: "启用" })}
                        </>
                      ) : (
                        <>
                          <XCircle className="h-3 w-3 ms-1" />
                          {pickLang(language, { ku: "ناچالاک", en: "Inactive", ar: "غير نشط", zh: "停用" })}
                        </>
                      )}
                    </Badge>
                  </div>
                  
                  {/* Pricing */}
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20">
                      <p className="text-xs text-muted-foreground">{pickLang(language, { ku: "تێچوون", en: "Cost", ar: "التكلفة", zh: "成本" })}</p>
                      <p className="font-bold text-red-600 dark:text-red-300">
                        ${type.defaultCost || "0.00"}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
                      <p className="text-xs text-muted-foreground">{pickLang(language, { ku: "نرخی فرۆشتن", en: "Selling Price", ar: "سعر البيع", zh: "售价" })}</p>
                      <p className="font-bold text-green-600 dark:text-green-300">
                        ${type.defaultPrice || "0.00"}
                      </p>
                    </div>
                  </div>
                  
                  {/* Profit */}
                  {type.defaultCost && type.defaultPrice && (
                    <div className="mt-3 p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">{pickLang(language, { ku: "قازانج:", en: "Profit:", ar: "الربح:", zh: "利润：" })}</span>
                        <span className={`font-bold ${
                          Number(type.defaultPrice) - Number(type.defaultCost) >= 0 
                            ? "text-emerald-600 dark:text-emerald-300" 
                            : "text-red-600 dark:text-red-300"
                        }`}>
                          ${(Number(type.defaultPrice) - Number(type.defaultCost)).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}
                  
                  {/* Actions */}
                  <div className="mt-4 flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(type)}
                    >
                      <Edit className="h-4 w-4 ms-1" />
                      {pickLang(language, { ku: "دەستکاری", en: "Edit", ar: "تعديل", zh: "编辑" })}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="text-red-600 dark:text-red-300 hover:text-red-700">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{pickLang(language, { ku: "دڵنیایت لە سڕینەوە؟", en: "Are you sure you want to delete?", ar: "هل أنت متأكد من الحذف؟", zh: "确定要删除吗？" })}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {pickLang(language, { ku: `ئەم کردارە ناگەڕێتەوە. جۆری خزمەتگوزاری "${type.nameKu || type.nameEn}" دەسڕدرێتەوە.`, en: `This action cannot be undone. The service type "${type.nameKu || type.nameEn}" will be deleted.`, ar: `لا يمكن التراجع عن هذا الإجراء. سيتم حذف نوع الخدمة "${type.nameKu || type.nameEn}".`, zh: `此操作无法撤销。服务类型 "${type.nameKu || type.nameEn}" 将被删除。` })}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{pickLang(language, { ku: "پاشگەزبوونەوە", en: "Cancel", ar: "إلغاء", zh: "取消" })}</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-red-600 hover:bg-red-700"
                            onClick={() => deleteMutation.mutate({ id: type.id })}
                          >
                            {pickLang(language, { ku: "سڕینەوە", en: "Delete", ar: "حذف", zh: "删除" })}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
        )}
        
        {/* Edit Dialog */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{pickLang(language, { ku: "دەستکاری جۆری خزمەتگوزاری", en: "Edit Service Type", ar: "تعديل نوع الخدمة", zh: "编辑服务类型" })}</DialogTitle>
              <DialogDescription>
                {pickLang(language, { ku: "زانیاری جۆری خزمەتگوزاری نوێ بکەوە", en: "Update the service type details", ar: "حدّث بيانات نوع الخدمة", zh: "更新服务类型信息" })}
              </DialogDescription>
            </DialogHeader>
            <ServiceTypeForm
              formData={formData}
              setFormData={setFormData}
              onSubmit={handleSubmit}
              onCancel={() => {
                setIsEditOpen(false);
                setEditingType(null);
                resetForm();
              }}
              isLoading={updateMutation.isPending}
              submitLabel={pickLang(language, { ku: "نوێکردنەوە", en: "Update", ar: "تحديث", zh: "更新" })}
            />
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

// Service Type Form Component
function ServiceTypeForm({
  formData,
  setFormData,
  onSubmit,
  onCancel,
  isLoading,
  submitLabel,
}: {
  formData: any;
  setFormData: (data: any) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isLoading: boolean;
  submitLabel: string;
}) {
  const { language } = useTranslation();
  return (
    <>
      <div className="space-y-4 py-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{pickLang(language, { ku: "ناو (کوردی)", en: "Name (Kurdish)", ar: "الاسم (كردي)", zh: "名称（库尔德语）" })}</Label>
            <Input
              placeholder={pickLang(language, { ku: "ناوی کوردی...", en: "Kurdish name...", ar: "الاسم بالكردية...", zh: "库尔德语名称……" })}
              value={formData.nameKu}
              onChange={(e) => setFormData({ ...formData, nameKu: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>{pickLang(language, { ku: "ناو (ئینگلیزی)", en: "Name (English)", ar: "الاسم (إنجليزي)", zh: "名称（英语）" })}</Label>
            <Input
              placeholder={pickLang(language, { ku: "ناوی ئینگلیزی...", en: "English name...", ar: "الاسم بالإنجليزية...", zh: "英文名称……" })}
              value={formData.nameEn}
              onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
            />
          </div>
        </div>
        
        <div className="space-y-2">
          <Label>{pickLang(language, { ku: "ناو (عەرەبی)", en: "Name (Arabic)", ar: "الاسم (عربي)", zh: "名称（阿拉伯语）" })}</Label>
          <Input
            placeholder={pickLang(language, { ku: "ناوی عەرەبی...", en: "Arabic name...", ar: "الاسم بالعربية...", zh: "阿拉伯语名称……" })}
            value={formData.nameAr}
            onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
          />
        </div>
        
        <div className="space-y-2">
          <Label>{pickLang(language, { ku: "ڕەنگ", en: "Color", ar: "اللون", zh: "颜色" })}</Label>
          <div className="flex flex-wrap gap-2">
            {colorOptions.map((color) => (
              <button
                key={color.value}
                type="button"
                className={`w-8 h-8 rounded-full ${color.bg} ${
                  formData.color === color.value 
                    ? 'ring-2 ring-offset-2 ring-gray-400' 
                    : ''
                }`}
                onClick={() => setFormData({ ...formData, color: color.value })}
                title={pickLang(language, color.label)}
              />
            ))}
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{pickLang(language, { ku: "تێچوونی پێشوەخت", en: "Default Cost", ar: "التكلفة الافتراضية", zh: "默认成本" })}</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                type="number"
                step="0.01"
                className="pl-7"
                placeholder="0.00"
                value={formData.defaultCost}
                onChange={(e) => setFormData({ ...formData, defaultCost: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{pickLang(language, { ku: "نرخی فرۆشتنی پێشوەخت", en: "Default Selling Price", ar: "سعر البيع الافتراضي", zh: "默认售价" })}</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                type="number"
                step="0.01"
                className="pl-7"
                placeholder="0.00"
                value={formData.defaultPrice}
                onChange={(e) => setFormData({ ...formData, defaultPrice: e.target.value })}
              />
            </div>
          </div>
        </div>
        
        {/* Profit Preview */}
        {formData.defaultCost && formData.defaultPrice && (
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{pickLang(language, { ku: "قازانجی پێشبینیکراو:", en: "Estimated Profit:", ar: "الربح المتوقع:", zh: "预计利润：" })}</span>
              <span className={`font-bold ${
                Number(formData.defaultPrice) - Number(formData.defaultCost) >= 0 
                  ? "text-green-600 dark:text-green-300" 
                  : "text-red-600 dark:text-red-300"
              }`}>
                ${(Number(formData.defaultPrice) - Number(formData.defaultCost)).toFixed(2)}
              </span>
            </div>
          </div>
        )}
        
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <div>
            <Label>{pickLang(language, { ku: "چالاک", en: "Active", ar: "نشط", zh: "启用" })}</Label>
            <p className="text-xs text-muted-foreground">{pickLang(language, { ku: "ئایا ئەم جۆرە چالاکە؟", en: "Is this type active?", ar: "هل هذا النوع نشط؟", zh: "此类型是否启用？" })}</p>
          </div>
          <Switch
            checked={formData.isActive}
            onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          {pickLang(language, { ku: "پاشگەزبوونەوە", en: "Cancel", ar: "إلغاء", zh: "取消" })}
        </Button>
        <Button
          onClick={onSubmit}
          disabled={isLoading}
          className="bg-violet-600 hover:bg-violet-700"
        >
          {isLoading ? pickLang(language, { ku: "چاوەڕوان بە...", en: "Please wait...", ar: "يرجى الانتظار...", zh: "请稍候……" }) : submitLabel}
        </Button>
      </DialogFooter>
    </>
  );
}
