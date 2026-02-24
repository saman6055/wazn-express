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

// Color options for service types
const colorOptions = [
  { value: "blue", label: "شین", bg: "bg-blue-500", text: "text-blue-500" },
  { value: "green", label: "سەوز", bg: "bg-green-500", text: "text-green-500" },
  { value: "red", label: "سور", bg: "bg-red-500", text: "text-red-500" },
  { value: "yellow", label: "زەرد", bg: "bg-yellow-500", text: "text-yellow-500" },
  { value: "purple", label: "مۆر", bg: "bg-purple-500", text: "text-purple-500" },
  { value: "pink", label: "پەمبەیی", bg: "bg-pink-500", text: "text-pink-500" },
  { value: "orange", label: "پرتەقاڵی", bg: "bg-orange-500", text: "text-orange-500" },
  { value: "teal", label: "شینی کەمرەنگ", bg: "bg-teal-500", text: "text-teal-500" },
];

// Icon options
const iconOptions = [
  { value: "wrench", label: "کلیل" },
  { value: "truck", label: "بارهەڵگر" },
  { value: "package", label: "پاکەت" },
  { value: "box", label: "سندوق" },
  { value: "shield", label: "پاراستن" },
  { value: "star", label: "ئەستێرە" },
  { value: "zap", label: "خێرا" },
  { value: "gift", label: "دیاری" },
];

export default function ServiceTypesManagement() {
  
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
      toast.success("جۆری خزمەتگوزاری بە سەرکەوتوویی زیادکرا");
      setIsAddOpen(false);
      resetForm();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "هەڵەیەک ڕوویدا");
    },
  });
  
  const updateMutation = trpc.extraServices.updateServiceType.useMutation({
    onSuccess: () => {
      toast.success("جۆری خزمەتگوزاری بە سەرکەوتوویی نوێکرایەوە");
      setIsEditOpen(false);
      setEditingType(null);
      resetForm();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "هەڵەیەک ڕوویدا");
    },
  });
  
  const deleteMutation = trpc.extraServices.deleteServiceType.useMutation({
    onSuccess: () => {
      toast.success("جۆری خزمەتگوزاری سڕایەوە");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "هەڵەیەک ڕوویدا");
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
      toast.error("تکایە لانیکەم یەک ناو داخڵ بکە");
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
                <h1 className="text-2xl font-bold">جۆرەکانی خزمەتگوزاری</h1>
                <p className="text-violet-100 mt-1">بەڕێوەبردنی جۆرەکانی خزمەتگوزاری</p>
              </div>
            </div>
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button className="bg-white text-violet-600 hover:bg-violet-50">
                  <Plus className="h-4 w-4 ms-2" />
                  زیادکردنی جۆری نوێ
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>زیادکردنی جۆری خزمەتگوزاری</DialogTitle>
                  <DialogDescription>
                    جۆری نوێی خزمەتگوزاری زیاد بکە
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
                  submitLabel="زیادکردن"
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
                <h3 className="font-semibold text-foreground">هەڵەیەک ڕوویدا</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {error?.message || "نەتوانرا زانیاری جۆرەکانی خزمەتگوزاری وەربگیرێت. تکایە دووبارە هەوڵ بدەرەوە."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => refetch()} className="gap-2">
                  <RotateCcw size={16} />
                  دووبارە هەوڵ بدەرەوە
                </Button>
                <Button variant="outline" onClick={() => navigate("/")} className="gap-2">
                  <Home size={16} />
                  گەڕانەوە بۆ سەرەکی
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
                <p className="text-muted-foreground">هیچ جۆرێکی خزمەتگوزاری نەدۆزرایەوە</p>
                <Button
                  className="mt-4"
                  onClick={() => setIsAddOpen(true)}
                >
                  <Plus className="h-4 w-4 ms-2" />
                  زیادکردنی جۆری یەکەم
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
                          چالاک
                        </>
                      ) : (
                        <>
                          <XCircle className="h-3 w-3 ms-1" />
                          ناچالاک
                        </>
                      )}
                    </Badge>
                  </div>
                  
                  {/* Pricing */}
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20">
                      <p className="text-xs text-muted-foreground">تێچوون</p>
                      <p className="font-bold text-red-600">
                        ${type.defaultCost || "0.00"}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
                      <p className="text-xs text-muted-foreground">نرخی فرۆشتن</p>
                      <p className="font-bold text-green-600">
                        ${type.defaultPrice || "0.00"}
                      </p>
                    </div>
                  </div>
                  
                  {/* Profit */}
                  {type.defaultCost && type.defaultPrice && (
                    <div className="mt-3 p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">قازانج:</span>
                        <span className={`font-bold ${
                          Number(type.defaultPrice) - Number(type.defaultCost) >= 0 
                            ? "text-emerald-600" 
                            : "text-red-600"
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
                      دەستکاری
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>دڵنیایت لە سڕینەوە؟</AlertDialogTitle>
                          <AlertDialogDescription>
                            ئەم کردارە ناگەڕێتەوە. جۆری خزمەتگوزاری "{type.nameKu || type.nameEn}" دەسڕدرێتەوە.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>پاشگەزبوونەوە</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-red-600 hover:bg-red-700"
                            onClick={() => deleteMutation.mutate({ id: type.id })}
                          >
                            سڕینەوە
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
              <DialogTitle>دەستکاری جۆری خزمەتگوزاری</DialogTitle>
              <DialogDescription>
                زانیاری جۆری خزمەتگوزاری نوێ بکەوە
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
              submitLabel="نوێکردنەوە"
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
  return (
    <>
      <div className="space-y-4 py-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>ناو (کوردی)</Label>
            <Input
              placeholder="ناوی کوردی..."
              value={formData.nameKu}
              onChange={(e) => setFormData({ ...formData, nameKu: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>ناو (ئینگلیزی)</Label>
            <Input
              placeholder="English name..."
              value={formData.nameEn}
              onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
            />
          </div>
        </div>
        
        <div className="space-y-2">
          <Label>ناو (عەرەبی)</Label>
          <Input
            placeholder="الاسم بالعربية..."
            value={formData.nameAr}
            onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
          />
        </div>
        
        <div className="space-y-2">
          <Label>ڕەنگ</Label>
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
                title={color.label}
              />
            ))}
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>تێچوونی پێشوەخت</Label>
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
            <Label>نرخی فرۆشتنی پێشوەخت</Label>
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
              <span className="text-sm text-muted-foreground">قازانجی پێشبینیکراو:</span>
              <span className={`font-bold ${
                Number(formData.defaultPrice) - Number(formData.defaultCost) >= 0 
                  ? "text-green-600" 
                  : "text-red-600"
              }`}>
                ${(Number(formData.defaultPrice) - Number(formData.defaultCost)).toFixed(2)}
              </span>
            </div>
          </div>
        )}
        
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <div>
            <Label>چالاک</Label>
            <p className="text-xs text-muted-foreground">ئایا ئەم جۆرە چالاکە؟</p>
          </div>
          <Switch
            checked={formData.isActive}
            onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          پاشگەزبوونەوە
        </Button>
        <Button
          onClick={onSubmit}
          disabled={isLoading}
          className="bg-violet-600 hover:bg-violet-700"
        >
          {isLoading ? "چاوەڕوان بە..." : submitLabel}
        </Button>
      </DialogFooter>
    </>
  );
}
