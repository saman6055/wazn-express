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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Mail, Plus, Pencil, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";

export default function EmailTemplatesManagement() {
  const { language } = useTranslation();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    subject: "",
    body: "",
    variables: "",
    category: "notification" as "notification" | "invoice" | "report" | "alert",
    isActive: true,
  });

  // Queries
  const { data: templates, refetch } = trpc.advancedSettings.getAllEmailTemplates.useQuery();

  // Mutations
  const createMutation = trpc.advancedSettings.createEmailTemplate.useMutation({
    onSuccess: () => {
      toast.success(pickLang(language, { ku: "قاڵبی ئیمەیڵ زیادکرا", en: "Email template added", ar: "تمت إضافة قالب البريد الإلكتروني", zh: "已添加邮件模板" }));
      refetch();
      setIsCreateDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = trpc.advancedSettings.updateEmailTemplate.useMutation({
    onSuccess: () => {
      toast.success(pickLang(language, { ku: "قاڵبی ئیمەیڵ نوێکرایەوە", en: "Email template updated", ar: "تم تحديث قالب البريد الإلكتروني", zh: "已更新邮件模板" }));
      refetch();
      setIsEditDialogOpen(false);
      setSelectedTemplate(null);
      resetForm();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = trpc.advancedSettings.deleteEmailTemplate.useMutation({
    onSuccess: () => {
      toast.success(pickLang(language, { ku: "قاڵبی ئیمەیڵ سڕایەوە", en: "Email template deleted", ar: "تم حذف قالب البريد الإلكتروني", zh: "已删除邮件模板" }));
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      subject: "",
      body: "",
      variables: "",
      category: "notification",
      isActive: true,
    });
  };

  const handleCreate = () => {
    createMutation.mutate(formData);
  };

  const handleEdit = (template: any) => {
    setSelectedTemplate(template);
    setFormData({
      name: template.name,
      subject: template.subject,
      body: template.body,
      variables: template.variables || "",
      category: template.category,
      isActive: template.isActive,
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdate = () => {
    if (!selectedTemplate) return;
    updateMutation.mutate({
      id: selectedTemplate.id,
      subject: formData.subject,
      body: formData.body,
      variables: formData.variables,
      isActive: formData.isActive,
    });
  };

  const handleDelete = (id: number) => {
    if (confirm(pickLang(language, { ku: "ئایا دڵنیایت لە سڕینەوەی ئەم قاڵبە؟", en: "Are you sure you want to delete this template?", ar: "هل أنت متأكد من حذف هذا القالب؟", zh: "确定要删除此模板吗？" }))) {
      deleteMutation.mutate({ id });
    }
  };

  const handlePreview = (template: any) => {
    setSelectedTemplate(template);
    setIsPreviewDialogOpen(true);
  };

  const getCategoryBadge = (category: string) => {
    const badges: Record<string, { label: string; variant: any }> = {
      notification: { label: pickLang(language, { ku: "ئاگادارکردنەوە", en: "Notification", ar: "إشعار", zh: "通知" }), variant: "default" },
      invoice: { label: pickLang(language, { ku: "وەسڵ", en: "Invoice", ar: "فاتورة", zh: "发票" }), variant: "secondary" },
      report: { label: pickLang(language, { ku: "ڕاپۆرت", en: "Report", ar: "تقرير", zh: "报告" }), variant: "outline" },
      alert: { label: pickLang(language, { ku: "ئاگاداری", en: "Alert", ar: "تنبيه", zh: "警报" }), variant: "destructive" },
    };
    const badge = badges[category] || { label: category, variant: "default" };
    return <Badge variant={badge.variant}>{badge.label}</Badge>;
  };

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl">{pickLang(language, { ku: "بەڕێوەبردنی قاڵبی ئیمەیڵ", en: "Email Template Management", ar: "إدارة قوالب البريد الإلكتروني", zh: "邮件模板管理" })}</CardTitle>
                <CardDescription>
                  {pickLang(language, { ku: "بەڕێوەبردنی قاڵبەکانی ئیمەیڵ و ئۆتۆماتیکی", en: "Manage email and automation templates", ar: "إدارة قوالب البريد الإلكتروني والأتمتة", zh: "管理邮件和自动化模板" })}
                </CardDescription>
              </div>
            </div>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 ms-2" />
              {pickLang(language, { ku: "قاڵبی نوێ", en: "New template", ar: "قالب جديد", zh: "新建模板" })}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{pickLang(language, { ku: "ناو", en: "Name", ar: "الاسم", zh: "名称" })}</TableHead>
                <TableHead>{pickLang(language, { ku: "بابەت", en: "Subject", ar: "الموضوع", zh: "主题" })}</TableHead>
                <TableHead>{pickLang(language, { ku: "جۆر", en: "Type", ar: "النوع", zh: "类型" })}</TableHead>
                <TableHead>{pickLang(language, { ku: "دۆخ", en: "Status", ar: "الحالة", zh: "状态" })}</TableHead>
                <TableHead>{pickLang(language, { ku: "کردارەکان", en: "Actions", ar: "الإجراءات", zh: "操作" })}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates?.map((template) => (
                <TableRow key={template.id}>
                  <TableCell className="font-semibold font-mono">
                    {template.name}
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {template.subject}
                  </TableCell>
                  <TableCell>
                    {getCategoryBadge(template.category)}
                  </TableCell>
                  <TableCell>
                    {template.isActive ? (
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
                        onClick={() => handlePreview(template)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(template)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(template.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {!templates || templates.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              {pickLang(language, { ku: "هیچ قاڵبێکی ئیمەیڵ نییە", en: "No email templates", ar: "لا توجد قوالب بريد إلكتروني", zh: "暂无邮件模板" })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{pickLang(language, { ku: "قاڵبی ئیمەیڵی نوێ زیاد بکە", en: "Add new email template", ar: "إضافة قالب بريد إلكتروني جديد", zh: "添加新邮件模板" })}</DialogTitle>
            <DialogDescription>
              {pickLang(language, { ku: "زانیاریەکانی قاڵبە نوێیەکە پڕ بکەرەوە", en: "Fill in the new template details", ar: "أدخل بيانات القالب الجديد", zh: "填写新模板信息" })}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">{pickLang(language, { ku: "ناوی قاڵب (کۆد)", en: "Template name (code)", ar: "اسم القالب (الرمز)", zh: "模板名称（代码）" })}</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value.toLowerCase().replace(/\s/g, '_') })}
                placeholder="low_stock_alert"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="category">{pickLang(language, { ku: "جۆر", en: "Type", ar: "النوع", zh: "类型" })}</Label>
              <Select
                value={formData.category}
                onValueChange={(value: any) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="notification">{pickLang(language, { ku: "ئاگادارکردنەوە", en: "Notification", ar: "إشعار", zh: "通知" })}</SelectItem>
                  <SelectItem value="invoice">{pickLang(language, { ku: "وەسڵ", en: "Invoice", ar: "فاتورة", zh: "发票" })}</SelectItem>
                  <SelectItem value="report">{pickLang(language, { ku: "ڕاپۆرت", en: "Report", ar: "تقرير", zh: "报告" })}</SelectItem>
                  <SelectItem value="alert">{pickLang(language, { ku: "ئاگاداری", en: "Alert", ar: "تنبيه", zh: "警报" })}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="subject">{pickLang(language, { ku: "بابەت", en: "Subject", ar: "الموضوع", zh: "主题" })}</Label>
              <Input
                id="subject"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                placeholder={pickLang(language, { ku: "{{customerName}} - ئاگاداری کەمی کاڵا", en: "{{customerName}} - Low stock alert", ar: "{{customerName}} - تنبيه انخفاض المخزون", zh: "{{customerName}} - 库存不足提醒" })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="body">{pickLang(language, { ku: "ناوەڕۆک (HTML)", en: "Content (HTML)", ar: "المحتوى (HTML)", zh: "内容 (HTML)" })}</Label>
              <Textarea
                id="body"
                value={formData.body}
                onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                placeholder={pickLang(language, { ku: "<p>بەڕێز {{customerName}},</p><p>کاڵای {{productName}} کەم بووەتەوە.</p>", en: "<p>Dear {{customerName}},</p><p>The product {{productName}} is low in stock.</p>", ar: "<p>عزيزي {{customerName}}،</p><p>المنتج {{productName}} منخفض في المخزون.</p>", zh: "<p>尊敬的 {{customerName}}，</p><p>产品 {{productName}} 库存不足。</p>" })}
                rows={10}
                className="font-mono text-sm"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="variables">{pickLang(language, { ku: "گۆڕاوەکان (JSON)", en: "Variables (JSON)", ar: "المتغيرات (JSON)", zh: "变量 (JSON)" })}</Label>
              <Textarea
                id="variables"
                value={formData.variables}
                onChange={(e) => setFormData({ ...formData, variables: e.target.value })}
                placeholder='["customerName", "productName", "quantity"]'
                rows={3}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                {pickLang(language, { ku: "لیستی گۆڕاوەکان بە فۆرماتی JSON بنووسە", en: "Write the list of variables in JSON format", ar: "اكتب قائمة المتغيرات بتنسيق JSON", zh: "以 JSON 格式编写变量列表" })}
              </p>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{pickLang(language, { ku: "دەستکاری قاڵبی ئیمەیڵ", en: "Edit email template", ar: "تعديل قالب البريد الإلكتروني", zh: "编辑邮件模板" })}</DialogTitle>
            <DialogDescription>
              {pickLang(language, { ku: "زانیاریەکانی قاڵبەکە نوێ بکەرەوە", en: "Update the template details", ar: "حدّث بيانات القالب", zh: "更新模板信息" })}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>{pickLang(language, { ku: "ناوی قاڵب", en: "Template name", ar: "اسم القالب", zh: "模板名称" })}</Label>
              <Input value={formData.name} disabled className="bg-muted" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-subject">{pickLang(language, { ku: "بابەت", en: "Subject", ar: "الموضوع", zh: "主题" })}</Label>
              <Input
                id="edit-subject"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-body">{pickLang(language, { ku: "ناوەڕۆک (HTML)", en: "Content (HTML)", ar: "المحتوى (HTML)", zh: "内容 (HTML)" })}</Label>
              <Textarea
                id="edit-body"
                value={formData.body}
                onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                rows={10}
                className="font-mono text-sm"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-variables">{pickLang(language, { ku: "گۆڕاوەکان (JSON)", en: "Variables (JSON)", ar: "المتغيرات (JSON)", zh: "变量 (JSON)" })}</Label>
              <Textarea
                id="edit-variables"
                value={formData.variables}
                onChange={(e) => setFormData({ ...formData, variables: e.target.value })}
                rows={3}
                className="font-mono text-sm"
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

      {/* Preview Dialog */}
      <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{pickLang(language, { ku: "پێشبینینی قاڵب", en: "Template preview", ar: "معاينة القالب", zh: "模板预览" })}: {selectedTemplate?.name}</DialogTitle>
            <DialogDescription>
              {getCategoryBadge(selectedTemplate?.category)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-semibold">{pickLang(language, { ku: "بابەت:", en: "Subject:", ar: "الموضوع:", zh: "主题：" })}</Label>
              <p className="mt-1 p-3 bg-muted rounded-md">{selectedTemplate?.subject}</p>
            </div>
            <div>
              <Label className="text-sm font-semibold">{pickLang(language, { ku: "ناوەڕۆک:", en: "Content:", ar: "المحتوى:", zh: "内容：" })}</Label>
              <div
                className="mt-1 p-4 bg-muted rounded-md prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: selectedTemplate?.body || "" }}
              />
            </div>
            {selectedTemplate?.variables && (
              <div>
                <Label className="text-sm font-semibold">{pickLang(language, { ku: "گۆڕاوەکان:", en: "Variables:", ar: "المتغيرات:", zh: "变量：" })}</Label>
                <pre className="mt-1 p-3 bg-muted rounded-md text-xs font-mono overflow-x-auto">
                  {selectedTemplate.variables}
                </pre>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setIsPreviewDialogOpen(false)}>
              {pickLang(language, { ku: "داخستن", en: "Close", ar: "إغلاق", zh: "关闭" })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
