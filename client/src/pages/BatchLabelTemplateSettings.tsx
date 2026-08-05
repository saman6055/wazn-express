import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Package,
  User,
  Hash,
  Scale,
  DollarSign,
  Calendar,
  QrCode,
  Save,
  RefreshCw,
  Plus,
  Star,
  Edit,
  Trash2,
  Layers,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DashboardLayout from "@/components/DashboardLayout";
import { useTranslation } from "@/contexts/LanguageContext";
import { useCompanyInfo } from "@/hooks/useCompanyInfo";
import { pickLang } from "@/lib/lang";

const sizeOptions = [
  { value: "10x15", label: { ku: "10 × 15 cm", en: "10 × 15 cm", ar: "10 × 15 سم", zh: "10 × 15 厘米" }, width: 100, height: 150 },
  { value: "10x10", label: { ku: "10 × 10 cm", en: "10 × 10 cm", ar: "10 × 10 سم", zh: "10 × 10 厘米" }, width: 100, height: 100 },
  { value: "A6", label: { ku: "A6", en: "A6", ar: "A6", zh: "A6" }, width: 105, height: 148 },
  { value: "A5", label: { ku: "A5", en: "A5", ar: "A5", zh: "A5" }, width: 148, height: 210 },
  { value: "custom", label: { ku: "قەبارەی تایبەت", en: "Custom size", ar: "حجم مخصص", zh: "自定义尺寸" }, width: 100, height: 100 },
];

const qrPositions = [
  { value: "top-left", label: { ku: "سەرەوە چەپ", en: "Top left", ar: "أعلى اليسار", zh: "左上" } },
  { value: "top-right", label: { ku: "سەرەوە ڕاست", en: "Top right", ar: "أعلى اليمين", zh: "右上" } },
  { value: "bottom-left", label: { ku: "خوارەوە چەپ", en: "Bottom left", ar: "أسفل اليسار", zh: "左下" } },
  { value: "bottom-right", label: { ku: "خوارەوە ڕاست", en: "Bottom right", ar: "أسفل اليمين", zh: "右下" } },
  { value: "center", label: { ku: "ناوەڕاست", en: "Center", ar: "الوسط", zh: "居中" } },
];

const defaultTemplate = {
  name: "تێمپلەیتی بنەڕەتی لەیبڵی باچ",
  isDefault: true,
  size: "10x15" as const,
  widthMm: 100,
  heightMm: 150,
  showQrCode: true,
  qrCodeSize: 80,
  qrCodePosition: "top-right" as const,
  showBarcode: true,
  barcodeType: "code128" as const,
  showLogo: true,
  logoUrl: "",
  logoWidth: 60,
  showCustomerName: true,
  showCustomerCode: true,
  showTotalPackages: true,
  showTotalWeight: true,
  showTotalVolume: true,
  showTotalPrice: true,
  showBatchNumber: true,
  showDate: true,
  primaryColor: "#059669",
  fontFamily: "Arial",
  fontSize: 12,
};

const sampleBatchLabel = {
  customerName: "ئەحمەد محمد",
  customerCode: "C-1234",
  totalPackages: 3,
  totalWeight: "15.50",
  totalVolume: "0.250",
  totalPrice: "$120.00",
  batchCode: "B-2024-045",
  date: new Date().toLocaleDateString("ku-IQ"),
};

export default function BatchLabelTemplateSettings() {
  const company = useCompanyInfo();
  const { t, language } = useTranslation();
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const { data: templates, isLoading, refetch } = trpc.batchLabelTemplates.list.useQuery();
  const ensureDefaultMutation = trpc.batchLabelTemplates.ensureDefault.useMutation({
    onSuccess: () => {
      toast.success(pickLang(language, { ku: "تێمپلەیتی بنەڕەتی لەیبڵی باچ ئامادەکرا", en: "Default batch label template ready", ar: "تم تجهيز قالب ملصق الدفعة الافتراضي", zh: "默认批次标签模板已准备" }));
      refetch();
    },
  });
  const createMutation = trpc.batchLabelTemplates.create.useMutation({
    onSuccess: () => {
      toast.success(pickLang(language, { ku: "تێمپلەیت دروستکرا", en: "Template created", ar: "تم إنشاء القالب", zh: "模板已创建" }));
      refetch();
      setIsDialogOpen(false);
      setIsCreating(false);
    },
  });
  const updateMutation = trpc.batchLabelTemplates.update.useMutation({
    onSuccess: () => {
      toast.success(pickLang(language, { ku: "تێمپلەیت نوێکرایەوە", en: "Template updated", ar: "تم تحديث القالب", zh: "模板已更新" }));
      refetch();
      setIsDialogOpen(false);
    },
  });
  const deleteMutation = trpc.batchLabelTemplates.delete.useMutation({
    onSuccess: () => {
      toast.success(pickLang(language, { ku: "تێمپلەیت سڕایەوە", en: "Template deleted", ar: "تم حذف القالب", zh: "模板已删除" }));
      refetch();
    },
  });
  const setDefaultMutation = trpc.batchLabelTemplates.setDefault.useMutation({
    onSuccess: () => {
      toast.success(pickLang(language, { ku: "تێمپلەیتی بنەڕەتی گۆڕدرا", en: "Default template changed", ar: "تم تغيير القالب الافتراضي", zh: "默认模板已更改" }));
      refetch();
    },
  });

  const handleSave = () => {
    if (!editingTemplate) return;
    if (isCreating) createMutation.mutate(editingTemplate);
    else updateMutation.mutate({ id: editingTemplate.id, ...editingTemplate });
  };

  const handleCreate = () => {
    setEditingTemplate({ ...defaultTemplate, name: pickLang(language, { ku: "تێمپلەیتی نوێ", en: "New template", ar: "قالب جديد", zh: "新模板" }), isDefault: false });
    setIsCreating(true);
    setIsDialogOpen(true);
  };

  const handleEdit = (template: any) => {
    setEditingTemplate({ ...template });
    setIsCreating(false);
    setIsDialogOpen(true);
  };

  const handleSizeChange = (size: string) => {
    const opt = sizeOptions.find((s) => s.value === size);
    if (opt) setEditingTemplate({ ...editingTemplate, size, widthMm: opt.width, heightMm: opt.height });
  };

  const BatchLabelPreview = ({ template }: { template: any }) => {
    const scale = 2;
    return (
      <div
        /* wazn-paper: this is a preview of a printed label, so its white and
           its dark ink are the real thing — the dark-mode readability net in
           index.css must leave both alone. */
        className="wazn-paper border-2 rounded-lg bg-white p-3 mx-auto"
        style={{
          width: `${(template.widthMm || 100) * scale}px`,
          height: `${(template.heightMm || 150) * scale}px`,
          fontFamily: template.fontFamily || "Arial",
          fontSize: `${template.fontSize || 12}px`,
          borderColor: template.primaryColor || "#059669",
        }}
      >
        <div className="h-full flex flex-col relative">
          {template.showLogo && (
            <div className="font-bold text-sm mb-2" style={{ color: template.primaryColor }}>
              {company.name}
            </div>
          )}
          {template.showQrCode && (
            <div className="absolute top-0 right-0 w-12 h-12 bg-slate-200 rounded flex items-center justify-center">
              <QrCode className="h-6 w-6 text-slate-500" />
            </div>
          )}
          <div className="mt-2 space-y-1">
            {template.showCustomerName && (
              <div>
                <p className="text-[10px] text-gray-500">{pickLang(language, { ku: "ناوی کڕیار", en: "Customer name", ar: "اسم العميل", zh: "客户名称" })}</p>
                <p className="font-bold" style={{ color: template.primaryColor }}>{sampleBatchLabel.customerName}</p>
              </div>
            )}
            {template.showCustomerCode && (
              <div>
                <p className="text-[10px] text-gray-500">{pickLang(language, { ku: "کۆد", en: "Code", ar: "الرمز", zh: "代码" })}</p>
                <p className="font-medium">{sampleBatchLabel.customerCode}</p>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-1 text-[10px] border-t border-gray-200 dark:border-gray-800/60 pt-2 mt-2">
            {template.showTotalPackages && <div>📦 {pickLang(language, { ku: "پاکەت", en: "Packages", ar: "طرود", zh: "包裹" })}: <strong>{sampleBatchLabel.totalPackages}</strong></div>}
            {template.showTotalWeight && <div>⚖️ {pickLang(language, { ku: "کیلۆ", en: "Weight", ar: "الوزن", zh: "重量" })}: <strong>{sampleBatchLabel.totalWeight}</strong></div>}
            {template.showTotalVolume && <div>📐 CBM: <strong>{sampleBatchLabel.totalVolume}</strong></div>}
            {template.showTotalPrice && <div>💰 {pickLang(language, { ku: "نرخ", en: "Price", ar: "السعر", zh: "价格" })}: <strong>{sampleBatchLabel.totalPrice}</strong></div>}
            {template.showBatchNumber && <div>📋 {pickLang(language, { ku: "باچ", en: "Batch", ar: "الدفعة", zh: "批次" })}: <strong>{sampleBatchLabel.batchCode}</strong></div>}
            {template.showDate && <div>📅 {sampleBatchLabel.date}</div>}
          </div>
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="container py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Layers className="h-6 w-6 text-primary" />
              {pickLang(language, { ku: "داڕشتەی تێمپلەیتی لەیبڵی باچ", en: "Batch label template designer", ar: "مصمم قالب ملصق الدفعة", zh: "批次标签模板设计器" })}
            </h1>
            <p className="text-muted-foreground">
              {pickLang(language, { ku: "یەک لەیبڵ بۆ هەر کڕیار — کۆی پاکەت، حەجم، کیلۆ، بارکۆد/QR، نرخ و ناوی کڕیار", en: "One label per customer — total packages, volume, weight, barcode/QR, price and customer name", ar: "ملصق واحد لكل عميل — إجمالي الطرود والحجم والوزن والباركود/QR والسعر واسم العميل", zh: "每位客户一个标签 — 总包裹数、体积、重量、条码/二维码、价格和客户名称" })}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => ensureDefaultMutation.mutate()} disabled={ensureDefaultMutation.isPending}>
              <RefreshCw className={`h-4 w-4 me-2 ${ensureDefaultMutation.isPending ? "animate-spin" : ""}`} />
              {pickLang(language, { ku: "ئامادەکردنی بنەڕەت", en: "Prepare default", ar: "تجهيز الافتراضي", zh: "准备默认" })}
            </Button>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 me-2" />
              {pickLang(language, { ku: "تێمپلەیتی نوێ", en: "New template", ar: "قالب جديد", zh: "新模板" })}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            <div className="col-span-full text-center py-8 text-muted-foreground">{pickLang(language, { ku: "بارکردن...", en: "Loading...", ar: "جارٍ التحميل...", zh: "加载中..." })}</div>
          ) : !templates || templates.length === 0 ? (
            <div className="col-span-full text-center py-8">
              <Layers className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">{pickLang(language, { ku: "هیچ تێمپلەیتێکی لەیبڵی باچ نییە", en: "No batch label templates", ar: "لا توجد قوالب ملصقات الدفعات", zh: "没有批次标签模板" })}</p>
              <Button onClick={() => ensureDefaultMutation.mutate()}>{pickLang(language, { ku: "دروستکردنی بنەڕەت", en: "Create default", ar: "إنشاء الافتراضي", zh: "创建默认" })}</Button>
            </div>
          ) : (
            templates.map((template) => (
              <Card key={template.id} className={template.isDefault ? "border-primary" : ""}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {template.name}
                    {template.isDefault && (
                      <Badge variant="default" className="text-xs">
                        <Star className="h-3 w-3 me-1" />
                        {pickLang(language, { ku: "بنەڕەت", en: "Default", ar: "افتراضي", zh: "默认" })}
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    {template.size === "custom"
                      ? `${template.widthMm} × ${template.heightMm} mm`
                      : (() => { const lbl = sizeOptions.find((s) => s.value === template.size)?.label; return lbl ? pickLang(language, lbl) : undefined; })()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted rounded-lg p-4 mb-4 flex items-center justify-center min-h-[100px]">
                    <Package className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => handleEdit(template)}>
                      <Edit className="h-4 w-4 me-1" />
                      {t("common.edit")}
                    </Button>
                    {!template.isDefault && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => setDefaultMutation.mutate({ id: template.id })}>
                          <Star className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (confirm(pickLang(language, { ku: "دڵنیایت لە سڕینەوە؟", en: "Are you sure you want to delete?", ar: "هل أنت متأكد من الحذف؟", zh: "确定要删除吗？" }))) deleteMutation.mutate({ id: template.id });
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <Dialog open={isDialogOpen} onOpenChange={(o) => { setIsDialogOpen(o); if (!o) setEditingTemplate(null); setIsCreating(false); }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5" />
                {isCreating ? pickLang(language, { ku: "تێمپلەیتی نوێ", en: "New template", ar: "قالب جديد", zh: "新模板" }) : pickLang(language, { ku: "دەسکاری تێمپلەیت", en: "Edit template", ar: "تعديل القالب", zh: "编辑模板" })}
              </DialogTitle>
              <DialogDescription>{pickLang(language, { ku: "ڕێکخستنەکانی لەیبڵی باچ — ناوی کڕیار، کۆی پاکەت، حەجم، کیلۆ، بارکۆد، نرخ", en: "Batch label settings — customer name, total packages, volume, weight, barcode, price", ar: "إعدادات ملصق الدفعة — اسم العميل، إجمالي الطرود، الحجم، الوزن، الباركود، السعر", zh: "批次标签设置 — 客户名称、总包裹数、体积、重量、条码、价格" })}</DialogDescription>
            </DialogHeader>

            {editingTemplate && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
                <div className="space-y-6">
                  <Tabs defaultValue="general">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="general">{pickLang(language, { ku: "گشتی", en: "General", ar: "عام", zh: "通用" })}</TabsTrigger>
                      <TabsTrigger value="content">{pickLang(language, { ku: "ناوەڕۆک", en: "Content", ar: "المحتوى", zh: "内容" })}</TabsTrigger>
                      <TabsTrigger value="style">{pickLang(language, { ku: "ستایل", en: "Style", ar: "النمط", zh: "样式" })}</TabsTrigger>
                    </TabsList>
                    <TabsContent value="general" className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <Label>{pickLang(language, { ku: "ناوی تێمپلەیت", en: "Template name", ar: "اسم القالب", zh: "模板名称" })}</Label>
                        <Input
                          value={editingTemplate.name}
                          onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                          placeholder={pickLang(language, { ku: "ناوی تێمپلەیت", en: "Template name", ar: "اسم القالب", zh: "模板名称" })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{pickLang(language, { ku: "قەبارە", en: "Size", ar: "الحجم", zh: "尺寸" })}</Label>
                        <Select value={editingTemplate.size} onValueChange={handleSizeChange}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {sizeOptions.map((s) => (
                              <SelectItem key={s.value} value={s.value}>{pickLang(language, s.label)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {editingTemplate.size === "custom" && (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>{pickLang(language, { ku: "پانی (mm)", en: "Width (mm)", ar: "العرض (مم)", zh: "宽度 (mm)" })}</Label>
                            <Input type="number" value={editingTemplate.widthMm} onChange={(e) => setEditingTemplate({ ...editingTemplate, widthMm: parseInt(e.target.value) || 100 })} />
                          </div>
                          <div className="space-y-2">
                            <Label>{pickLang(language, { ku: "بەرزی (mm)", en: "Height (mm)", ar: "الارتفاع (مم)", zh: "高度 (mm)" })}</Label>
                            <Input type="number" value={editingTemplate.heightMm} onChange={(e) => setEditingTemplate({ ...editingTemplate, heightMm: parseInt(e.target.value) || 150 })} />
                          </div>
                        </div>
                      )}
                      <Separator />
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2"><QrCode className="h-4 w-4" /><Label>{pickLang(language, { ku: "QR / بارکۆد", en: "QR / Barcode", ar: "QR / باركود", zh: "二维码 / 条码" })}</Label></div>
                        <Switch checked={editingTemplate.showQrCode} onCheckedChange={(c) => setEditingTemplate({ ...editingTemplate, showQrCode: c })} />
                      </div>
                      {editingTemplate.showQrCode && (
                        <>
                          <div className="space-y-2">
                            <Label>{pickLang(language, { ku: "قەبارەی QR", en: "QR size", ar: "حجم QR", zh: "二维码尺寸" })}</Label>
                            <Input type="number" value={editingTemplate.qrCodeSize} onChange={(e) => setEditingTemplate({ ...editingTemplate, qrCodeSize: parseInt(e.target.value) || 80 })} />
                          </div>
                          <div className="space-y-2">
                            <Label>{pickLang(language, { ku: "شوێنی QR", en: "QR position", ar: "موضع QR", zh: "二维码位置" })}</Label>
                            <Select value={editingTemplate.qrCodePosition} onValueChange={(v) => setEditingTemplate({ ...editingTemplate, qrCodePosition: v })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {qrPositions.map((p) => (
                                  <SelectItem key={p.value} value={p.value}>{pickLang(language, p.label)}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      )}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2"><Label>{pickLang(language, { ku: "لۆگۆ", en: "Logo", ar: "الشعار", zh: "标志" })}</Label></div>
                        <Switch checked={editingTemplate.showLogo} onCheckedChange={(c) => setEditingTemplate({ ...editingTemplate, showLogo: c })} />
                      </div>
                    </TabsContent>
                    <TabsContent value="content" className="space-y-3 mt-4">
                      {[
                        { key: "showCustomerName", label: { ku: "ناوی کڕیار", en: "Customer name", ar: "اسم العميل", zh: "客户名称" }, Icon: User },
                        { key: "showCustomerCode", label: { ku: "کۆدی کڕیار", en: "Customer code", ar: "رمز العميل", zh: "客户代码" }, Icon: Hash },
                        { key: "showTotalPackages", label: { ku: "کۆی پاکەت", en: "Total packages", ar: "إجمالي الطرود", zh: "总包裹数" }, Icon: Package },
                        { key: "showTotalWeight", label: { ku: "کۆی کیلۆ", en: "Total weight", ar: "إجمالي الوزن", zh: "总重量" }, Icon: Scale },
                        { key: "showTotalVolume", label: { ku: "کۆی حەجم (CBM)", en: "Total volume (CBM)", ar: "إجمالي الحجم (CBM)", zh: "总体积 (CBM)" }, Icon: Package },
                        { key: "showTotalPrice", label: { ku: "کۆی نرخ", en: "Total price", ar: "إجمالي السعر", zh: "总价格" }, Icon: DollarSign },
                        { key: "showBatchNumber", label: { ku: "کۆدی باچ", en: "Batch code", ar: "رمز الدفعة", zh: "批次代码" }, Icon: Package },
                        { key: "showDate", label: { ku: "بەروار", en: "Date", ar: "التاريخ", zh: "日期" }, Icon: Calendar },
                      ].map(({ key, label, Icon }) => (
                        <div key={key} className="flex items-center justify-between">
                          <div className="flex items-center gap-2"><Icon className="h-4 w-4 text-muted-foreground" /><Label>{pickLang(language, label)}</Label></div>
                          <Switch
                            checked={!!editingTemplate[key]}
                            onCheckedChange={(c) => setEditingTemplate({ ...editingTemplate, [key]: c })}
                          />
                        </div>
                      ))}
                    </TabsContent>
                    <TabsContent value="style" className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <Label>{pickLang(language, { ku: "رەنگی سەرەکی", en: "Primary color", ar: "اللون الأساسي", zh: "主色" })}</Label>
                        <div className="flex gap-2">
                          <Input type="color" value={editingTemplate.primaryColor || "#059669"} onChange={(e) => setEditingTemplate({ ...editingTemplate, primaryColor: e.target.value })} className="w-16 h-10 p-1" />
                          <Input value={editingTemplate.primaryColor} onChange={(e) => setEditingTemplate({ ...editingTemplate, primaryColor: e.target.value })} placeholder="#059669" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>{pickLang(language, { ku: "فۆنت", en: "Font", ar: "الخط", zh: "字体" })}</Label>
                        <Select value={editingTemplate.fontFamily} onValueChange={(v) => setEditingTemplate({ ...editingTemplate, fontFamily: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Arial">Arial</SelectItem>
                            <SelectItem value="Tahoma">Tahoma</SelectItem>
                            <SelectItem value="Verdana">Verdana</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>{pickLang(language, { ku: "قەبارەی فۆنت", en: "Font size", ar: "حجم الخط", zh: "字号" })}</Label>
                        <Input type="number" value={editingTemplate.fontSize} onChange={(e) => setEditingTemplate({ ...editingTemplate, fontSize: parseInt(e.target.value) || 12 })} />
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
                <div className="space-y-4">
                  <Label className="text-lg font-medium">{pickLang(language, { ku: "پێشبینین", en: "Preview", ar: "معاينة", zh: "预览" })}</Label>
                  <div className="bg-muted rounded-lg p-6 flex items-center justify-center min-h-[320px]">
                    <BatchLabelPreview template={editingTemplate} />
                  </div>
                </div>
              </div>
            )}

            <DialogFooter className="mt-6">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>{t("common.cancel")}</Button>
              <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
                <Save className="h-4 w-4 me-2" />
                {createMutation.isPending || updateMutation.isPending ? "..." : t("common.save")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
