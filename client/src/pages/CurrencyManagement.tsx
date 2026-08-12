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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Plus, Pencil, Trash2, Star } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";

export default function CurrencyManagement() {
  const { language } = useTranslation();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState<any>(null);

  // Form state
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    symbol: "",
    exchangeRate: "",
    isBaseCurrency: false,
    isActive: true,
  });

  // Queries
  const { data: currencies, refetch } = trpc.advancedSettings.getAllCurrencies.useQuery();

  // Mutations
  const createMutation = trpc.advancedSettings.createCurrency.useMutation({
    onSuccess: () => {
      toast.success(pickLang(language, { ku: "دراوە زیادکرا", en: "Currency added", ar: "تمت إضافة العملة", zh: "已添加货币" }));
      refetch();
      setIsCreateDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = trpc.advancedSettings.updateCurrency.useMutation({
    onSuccess: () => {
      toast.success(pickLang(language, { ku: "دراوە نوێکرایەوە", en: "Currency updated", ar: "تم تحديث العملة", zh: "已更新货币" }));
      refetch();
      setIsEditDialogOpen(false);
      setSelectedCurrency(null);
      resetForm();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = trpc.advancedSettings.deleteCurrency.useMutation({
    onSuccess: () => {
      toast.success(pickLang(language, { ku: "دراوە سڕایەوە", en: "Currency deleted", ar: "تم حذف العملة", zh: "已删除货币" }));
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      code: "",
      name: "",
      symbol: "",
      exchangeRate: "",
      isBaseCurrency: false,
      isActive: true,
    });
  };

  const handleCreate = () => {
    createMutation.mutate(formData);
  };

  const handleEdit = (currency: any) => {
    setSelectedCurrency(currency);
    setFormData({
      code: currency.code,
      name: currency.name,
      symbol: currency.symbol,
      exchangeRate: currency.exchangeRate,
      isBaseCurrency: currency.isBaseCurrency,
      isActive: currency.isActive,
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdate = () => {
    if (!selectedCurrency) return;
    updateMutation.mutate({
      id: selectedCurrency.id,
      name: formData.name,
      symbol: formData.symbol,
      exchangeRate: formData.exchangeRate,
      isBaseCurrency: formData.isBaseCurrency,
      isActive: formData.isActive,
    });
  };

  const handleDelete = (id: number) => {
    if (confirm(pickLang(language, { ku: "ئایا دڵنیایت لە سڕینەوەی ئەم دراوە؟", en: "Are you sure you want to delete this currency?", ar: "هل أنت متأكد من حذف هذه العملة؟", zh: "确定要删除此货币吗？" }))) {
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
                <DollarSign className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl">{pickLang(language, { ku: "بەڕێوەبردنی دراو", en: "Currency Management", ar: "إدارة العملات", zh: "货币管理" })}</CardTitle>
                <CardDescription>
                  {pickLang(language, { ku: "بەڕێوەبردنی دراوەکان و نرخی ئاڵووگۆڕ", en: "Manage currencies and exchange rates", ar: "إدارة العملات وأسعار الصرف", zh: "管理货币和汇率" })}
                </CardDescription>
              </div>
            </div>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 ms-2" />
              {pickLang(language, { ku: "دراوی نوێ", en: "New Currency", ar: "عملة جديدة", zh: "新货币" })}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{pickLang(language, { ku: "کۆد", en: "Code", ar: "الرمز", zh: "代码" })}</TableHead>
                <TableHead>{pickLang(language, { ku: "ناو", en: "Name", ar: "الاسم", zh: "名称" })}</TableHead>
                <TableHead>{pickLang(language, { ku: "هێما", en: "Symbol", ar: "الرمز", zh: "符号" })}</TableHead>
                <TableHead>{pickLang(language, { ku: "نرخی ئاڵووگۆڕ", en: "Exchange Rate", ar: "سعر الصرف", zh: "汇率" })}</TableHead>
                <TableHead>{pickLang(language, { ku: "دۆخ", en: "Status", ar: "الحالة", zh: "状态" })}</TableHead>
                <TableHead>{pickLang(language, { ku: "کردارەکان", en: "Actions", ar: "الإجراءات", zh: "操作" })}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currencies?.map((currency) => (
                <TableRow key={currency.id}>
                  <TableCell className="font-mono font-semibold">
                    {currency.code}
                    {currency.isBaseCurrency && (
                      <Star className="inline h-4 w-4 me-1 text-yellow-500 dark:text-yellow-400 fill-yellow-500" />
                    )}
                  </TableCell>
                  <TableCell>{currency.name}</TableCell>
                  <TableCell className="text-lg">{currency.symbol}</TableCell>
                  <TableCell className="font-mono">{currency.exchangeRate}</TableCell>
                  <TableCell>
                    {currency.isActive ? (
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
                        onClick={() => handleEdit(currency)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(currency.id)}
                        disabled={currency.isBaseCurrency}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {!currencies || currencies.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              {pickLang(language, { ku: "هیچ دراوێک نییە", en: "No currencies", ar: "لا توجد عملات", zh: "暂无货币" })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pickLang(language, { ku: "دراوی نوێ زیاد بکە", en: "Add New Currency", ar: "إضافة عملة جديدة", zh: "添加新货币" })}</DialogTitle>
            <DialogDescription>
              {pickLang(language, { ku: "زانیاریەکانی دراوە نوێیەکە پڕ بکەرەوە", en: "Fill in the details of the new currency", ar: "املأ بيانات العملة الجديدة", zh: "填写新货币的信息" })}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="code">{pickLang(language, { ku: "کۆدی دراو (USD, EUR, IQD)", en: "Currency Code (USD, EUR, IQD)", ar: "رمز العملة (USD, EUR, IQD)", zh: "货币代码 (USD, EUR, IQD)" })}</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="USD"
                maxLength={10}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="name">{pickLang(language, { ku: "ناوی دراو", en: "Currency Name", ar: "اسم العملة", zh: "货币名称" })}</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="US Dollar"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="symbol">{pickLang(language, { ku: "هێما", en: "Symbol", ar: "الرمز", zh: "符号" })}</Label>
              <Input
                id="symbol"
                value={formData.symbol}
                onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
                placeholder="$"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="exchangeRate">{pickLang(language, { ku: "نرخی ئاڵووگۆڕ", en: "Exchange Rate", ar: "سعر الصرف", zh: "汇率" })}</Label>
              <Input
                id="exchangeRate"
                type="number"
                step="0.000001"
                value={formData.exchangeRate}
                onChange={(e) => setFormData({ ...formData, exchangeRate: e.target.value })}
                placeholder="1.0"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="isBaseCurrency">{pickLang(language, { ku: "دراوی بنەڕەت", en: "Base Currency", ar: "العملة الأساسية", zh: "基础货币" })}</Label>
              <Switch
                id="isBaseCurrency"
                checked={formData.isBaseCurrency}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isBaseCurrency: checked })
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
            <DialogTitle>{pickLang(language, { ku: "دەستکاری دراو", en: "Edit Currency", ar: "تعديل العملة", zh: "编辑货币" })}</DialogTitle>
            <DialogDescription>
              {pickLang(language, { ku: "زانیاریەکانی دراوەکە نوێ بکەرەوە", en: "Update the currency details", ar: "حدّث بيانات العملة", zh: "更新货币信息" })}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>{pickLang(language, { ku: "کۆدی دراو", en: "Currency Code", ar: "رمز العملة", zh: "货币代码" })}</Label>
              <Input value={formData.code} disabled className="bg-muted" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-name">{pickLang(language, { ku: "ناوی دراو", en: "Currency Name", ar: "اسم العملة", zh: "货币名称" })}</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-symbol">{pickLang(language, { ku: "هێما", en: "Symbol", ar: "الرمز", zh: "符号" })}</Label>
              <Input
                id="edit-symbol"
                value={formData.symbol}
                onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-exchangeRate">{pickLang(language, { ku: "نرخی ئاڵووگۆڕ", en: "Exchange Rate", ar: "سعر الصرف", zh: "汇率" })}</Label>
              <Input
                id="edit-exchangeRate"
                type="number"
                step="0.000001"
                value={formData.exchangeRate}
                onChange={(e) => setFormData({ ...formData, exchangeRate: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-isBaseCurrency">{pickLang(language, { ku: "دراوی بنەڕەت", en: "Base Currency", ar: "العملة الأساسية", zh: "基础货币" })}</Label>
              <Switch
                id="edit-isBaseCurrency"
                checked={formData.isBaseCurrency}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isBaseCurrency: checked })
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
