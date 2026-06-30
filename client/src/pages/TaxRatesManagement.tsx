import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Percent, Plus, Pencil, Trash2, Star } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";

export default function TaxRatesManagement() {
  const { t, language } = useTranslation();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedTaxRate, setSelectedTaxRate] = useState<any>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    rate: "",
    description: "",
    isDefault: false,
    isActive: true,
  });

  // Queries
  const { data: taxRates, refetch } = trpc.advancedSettings.getAllTaxRates.useQuery();

  // Mutations
  const createMutation = trpc.advancedSettings.createTaxRate.useMutation({
    onSuccess: () => {
      toast.success(t("toast.taxRateAdded"));
      refetch();
      setIsCreateDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = trpc.advancedSettings.updateTaxRate.useMutation({
    onSuccess: () => {
      toast.success(t("toast.taxRateUpdated"));
      refetch();
      setIsEditDialogOpen(false);
      setSelectedTaxRate(null);
      resetForm();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = trpc.advancedSettings.deleteTaxRate.useMutation({
    onSuccess: () => {
      toast.success(t("toast.taxRateDeleted"));
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      rate: "",
      description: "",
      isDefault: false,
      isActive: true,
    });
  };

  const handleCreate = () => {
    createMutation.mutate(formData);
  };

  const handleEdit = (taxRate: any) => {
    setSelectedTaxRate(taxRate);
    setFormData({
      name: taxRate.name,
      rate: taxRate.rate,
      description: taxRate.description || "",
      isDefault: taxRate.isDefault,
      isActive: taxRate.isActive,
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdate = () => {
    if (!selectedTaxRate) return;
    updateMutation.mutate({
      id: selectedTaxRate.id,
      name: formData.name,
      rate: formData.rate,
      description: formData.description,
      isDefault: formData.isDefault,
      isActive: formData.isActive,
    });
  };

  const handleDelete = (id: number) => {
    if (confirm(pickLang(language, { ku: "ئایا دڵنیایت لە سڕینەوەی ئەم نرخی باجە؟", en: "Are you sure you want to delete this tax rate?", ar: "هل أنت متأكد من حذف نسبة الضريبة هذه؟", zh: "确定要删除此税率吗？" }))) {
      deleteMutation.mutate({ id });
    }
  };

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Percent className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl">{pickLang(language, { ku: "بەڕێوەبردنی نرخی باج", en: "Tax Rates Management", ar: "إدارة نسب الضرائب", zh: "税率管理" })}</CardTitle>
                <CardDescription>
                  {pickLang(language, { ku: "بەڕێوەبردنی نرخەکانی باج و VAT", en: "Manage tax and VAT rates", ar: "إدارة نسب الضرائب وضريبة القيمة المضافة", zh: "管理税率和增值税率" })}
                </CardDescription>
              </div>
            </div>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 ms-2" />
              {pickLang(language, { ku: "نرخی نوێ", en: "New Rate", ar: "نسبة جديدة", zh: "新税率" })}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{pickLang(language, { ku: "ناو", en: "Name", ar: "الاسم", zh: "名称" })}</TableHead>
                <TableHead>{pickLang(language, { ku: "نرخ (%)", en: "Rate (%)", ar: "النسبة (%)", zh: "税率 (%)" })}</TableHead>
                <TableHead>{pickLang(language, { ku: "وەسف", en: "Description", ar: "الوصف", zh: "描述" })}</TableHead>
                <TableHead>{pickLang(language, { ku: "دۆخ", en: "Status", ar: "الحالة", zh: "状态" })}</TableHead>
                <TableHead>{pickLang(language, { ku: "کردارەکان", en: "Actions", ar: "الإجراءات", zh: "操作" })}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {taxRates?.map((taxRate) => (
                <TableRow key={taxRate.id}>
                  <TableCell className="font-semibold">
                    {taxRate.name}
                    {taxRate.isDefault && (
                      <Star className="inline h-4 w-4 me-1 text-yellow-500 fill-yellow-500" />
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-lg">{taxRate.rate}%</TableCell>
                  <TableCell className="text-muted-foreground max-w-xs truncate">
                    {taxRate.description || "-"}
                  </TableCell>
                  <TableCell>
                    {taxRate.isActive ? (
                      <Badge variant="default">{pickLang(language, { ku: "چالاک", en: "Active", ar: "نشط", zh: "启用" })}</Badge>
                    ) : (
                      <Badge variant="secondary">{pickLang(language, { ku: "ناچالاک", en: "Inactive", ar: "غير نشط", zh: "停用" })}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(taxRate)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(taxRate.id)}
                        disabled={taxRate.isDefault}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {!taxRates || taxRates.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              {pickLang(language, { ku: "هیچ نرخی باجێک نییە", en: "No tax rates", ar: "لا توجد نسب ضرائب", zh: "暂无税率" })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pickLang(language, { ku: "نرخی باجی نوێ زیاد بکە", en: "Add New Tax Rate", ar: "إضافة نسبة ضريبة جديدة", zh: "添加新税率" })}</DialogTitle>
            <DialogDescription>
              {pickLang(language, { ku: "زانیاریەکانی نرخی باجە نوێیەکە پڕ بکەرەوە", en: "Fill in the new tax rate details", ar: "املأ بيانات نسبة الضريبة الجديدة", zh: "填写新税率信息" })}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">{pickLang(language, { ku: "ناوی نرخی باج", en: "Tax Rate Name", ar: "اسم نسبة الضريبة", zh: "税率名称" })}</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="VAT, Sales Tax, etc."
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="rate">{pickLang(language, { ku: "نرخ (%)", en: "Rate (%)", ar: "النسبة (%)", zh: "税率 (%)" })}</Label>
              <Input
                id="rate"
                type="number"
                step="0.01"
                value={formData.rate}
                onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                placeholder="15.00"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">{pickLang(language, { ku: "وەسف (ئیختیاری)", en: "Description (optional)", ar: "الوصف (اختياري)", zh: "描述（可选）" })}</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={pickLang(language, { ku: "وەسفی نرخی باجەکە...", en: "Tax rate description...", ar: "وصف نسبة الضريبة...", zh: "税率描述..." })}
                rows={3}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="isDefault">{pickLang(language, { ku: "نرخی بنەڕەت", en: "Default Rate", ar: "النسبة الافتراضية", zh: "默认税率" })}</Label>
              <Switch
                id="isDefault"
                checked={formData.isDefault}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isDefault: checked })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="isActive">{pickLang(language, { ku: "چالاک", en: "Active", ar: "نشط", zh: "启用" })}</Label>
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isActive: checked })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              {pickLang(language, { ku: "پاشگەزبوونەوە", en: "Cancel", ar: "إلغاء", zh: "取消" })}
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? pickLang(language, { ku: "چاوەڕێ بە...", en: "Please wait...", ar: "يرجى الانتظار...", zh: "请稍候..." }) : pickLang(language, { ku: "زیادکردن", en: "Add", ar: "إضافة", zh: "添加" })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pickLang(language, { ku: "دەستکاری نرخی باج", en: "Edit Tax Rate", ar: "تعديل نسبة الضريبة", zh: "编辑税率" })}</DialogTitle>
            <DialogDescription>
              {pickLang(language, { ku: "زانیاریەکانی نرخی باجەکە نوێ بکەرەوە", en: "Update the tax rate details", ar: "حدّث بيانات نسبة الضريبة", zh: "更新税率信息" })}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">{pickLang(language, { ku: "ناوی نرخی باج", en: "Tax Rate Name", ar: "اسم نسبة الضريبة", zh: "税率名称" })}</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-rate">{pickLang(language, { ku: "نرخ (%)", en: "Rate (%)", ar: "النسبة (%)", zh: "税率 (%)" })}</Label>
              <Input
                id="edit-rate"
                type="number"
                step="0.01"
                value={formData.rate}
                onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-description">{pickLang(language, { ku: "وەسف (ئیختیاری)", en: "Description (optional)", ar: "الوصف (اختياري)", zh: "描述（可选）" })}</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-isDefault">{pickLang(language, { ku: "نرخی بنەڕەت", en: "Default Rate", ar: "النسبة الافتراضية", zh: "默认税率" })}</Label>
              <Switch
                id="edit-isDefault"
                checked={formData.isDefault}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isDefault: checked })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-isActive">{pickLang(language, { ku: "چالاک", en: "Active", ar: "نشط", zh: "启用" })}</Label>
              <Switch
                id="edit-isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isActive: checked })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              {pickLang(language, { ku: "پاشگەزبوونەوە", en: "Cancel", ar: "إلغاء", zh: "取消" })}
            </Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? pickLang(language, { ku: "چاوەڕێ بە...", en: "Please wait...", ar: "يرجى الانتظار...", zh: "请稍候..." }) : pickLang(language, { ku: "نوێکردنەوە", en: "Update", ar: "تحديث", zh: "更新" })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
