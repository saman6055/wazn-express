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

const sizeOptions = [
  { value: "10x15", label: "10 × 15 cm", width: 100, height: 150 },
  { value: "10x10", label: "10 × 10 cm", width: 100, height: 100 },
  { value: "A6", label: "A6", width: 105, height: 148 },
  { value: "A5", label: "A5", width: 148, height: 210 },
  { value: "custom", label: "قەبارەی تایبەت", width: 100, height: 100 },
];

const qrPositions = [
  { value: "top-left", label: "سەرەوە چەپ" },
  { value: "top-right", label: "سەرەوە ڕاست" },
  { value: "bottom-left", label: "خوارەوە چەپ" },
  { value: "bottom-right", label: "خوارەوە ڕاست" },
  { value: "center", label: "ناوەڕاست" },
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
  const { t } = useTranslation();
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const { data: templates, isLoading, refetch } = trpc.batchLabelTemplates.list.useQuery();
  const ensureDefaultMutation = trpc.batchLabelTemplates.ensureDefault.useMutation({
    onSuccess: () => {
      toast.success("تێمپلەیتی بنەڕەتی لەیبڵی باچ ئامادەکرا");
      refetch();
    },
  });
  const createMutation = trpc.batchLabelTemplates.create.useMutation({
    onSuccess: () => {
      toast.success("تێمپلەیت دروستکرا");
      refetch();
      setIsDialogOpen(false);
      setIsCreating(false);
    },
  });
  const updateMutation = trpc.batchLabelTemplates.update.useMutation({
    onSuccess: () => {
      toast.success("تێمپلەیت نوێکرایەوە");
      refetch();
      setIsDialogOpen(false);
    },
  });
  const deleteMutation = trpc.batchLabelTemplates.delete.useMutation({
    onSuccess: () => {
      toast.success("تێمپلەیت سڕایەوە");
      refetch();
    },
  });
  const setDefaultMutation = trpc.batchLabelTemplates.setDefault.useMutation({
    onSuccess: () => {
      toast.success("تێمپلەیتی بنەڕەتی گۆڕدرا");
      refetch();
    },
  });

  const handleSave = () => {
    if (!editingTemplate) return;
    if (isCreating) createMutation.mutate(editingTemplate);
    else updateMutation.mutate({ id: editingTemplate.id, ...editingTemplate });
  };

  const handleCreate = () => {
    setEditingTemplate({ ...defaultTemplate, name: "تێمپلەیتی نوێ", isDefault: false });
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
        className="border-2 rounded-lg bg-white p-3 mx-auto"
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
                <p className="text-[10px] text-gray-500">ناوی کڕیار</p>
                <p className="font-bold" style={{ color: template.primaryColor }}>{sampleBatchLabel.customerName}</p>
              </div>
            )}
            {template.showCustomerCode && (
              <div>
                <p className="text-[10px] text-gray-500">کۆد</p>
                <p className="font-medium">{sampleBatchLabel.customerCode}</p>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-1 text-[10px] border-t border-gray-200 pt-2 mt-2">
            {template.showTotalPackages && <div>📦 پاکەت: <strong>{sampleBatchLabel.totalPackages}</strong></div>}
            {template.showTotalWeight && <div>⚖️ کیلۆ: <strong>{sampleBatchLabel.totalWeight}</strong></div>}
            {template.showTotalVolume && <div>📐 CBM: <strong>{sampleBatchLabel.totalVolume}</strong></div>}
            {template.showTotalPrice && <div>💰 نرخ: <strong>{sampleBatchLabel.totalPrice}</strong></div>}
            {template.showBatchNumber && <div>📋 باچ: <strong>{sampleBatchLabel.batchCode}</strong></div>}
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
              داڕشتەی تێمپلەیتی لەیبڵی باچ
            </h1>
            <p className="text-muted-foreground">
              یەک لەیبڵ بۆ هەر کڕیار — کۆی پاکەت، حەجم، کیلۆ، بارکۆد/QR، نرخ و ناوی کڕیار
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => ensureDefaultMutation.mutate()} disabled={ensureDefaultMutation.isPending}>
              <RefreshCw className={`h-4 w-4 mr-2 ${ensureDefaultMutation.isPending ? "animate-spin" : ""}`} />
              ئامادەکردنی بنەڕەت
            </Button>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              تێمپلەیتی نوێ
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            <div className="col-span-full text-center py-8 text-muted-foreground">بارکردن...</div>
          ) : !templates || templates.length === 0 ? (
            <div className="col-span-full text-center py-8">
              <Layers className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">هیچ تێمپلەیتێکی لەیبڵی باچ نییە</p>
              <Button onClick={() => ensureDefaultMutation.mutate()}>دروستکردنی بنەڕەت</Button>
            </div>
          ) : (
            templates.map((template) => (
              <Card key={template.id} className={template.isDefault ? "border-primary" : ""}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {template.name}
                    {template.isDefault && (
                      <Badge variant="default" className="text-xs">
                        <Star className="h-3 w-3 mr-1" />
                        بنەڕەت
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    {template.size === "custom"
                      ? `${template.widthMm} × ${template.heightMm} mm`
                      : sizeOptions.find((s) => s.value === template.size)?.label}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted rounded-lg p-4 mb-4 flex items-center justify-center min-h-[100px]">
                    <Package className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => handleEdit(template)}>
                      <Edit className="h-4 w-4 mr-1" />
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
                            if (confirm("دڵنیایت لە سڕینەوە؟")) deleteMutation.mutate({ id: template.id });
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
                {isCreating ? "تێمپلەیتی نوێ" : "دەسکاری تێمپلەیت"}
              </DialogTitle>
              <DialogDescription>ڕێکخستنەکانی لەیبڵی باچ — ناوی کڕیار، کۆی پاکەت، حەجم، کیلۆ، بارکۆد، نرخ</DialogDescription>
            </DialogHeader>

            {editingTemplate && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
                <div className="space-y-6">
                  <Tabs defaultValue="general">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="general">گشتی</TabsTrigger>
                      <TabsTrigger value="content">ناوەڕۆک</TabsTrigger>
                      <TabsTrigger value="style">ستایل</TabsTrigger>
                    </TabsList>
                    <TabsContent value="general" className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <Label>ناوی تێمپلەیت</Label>
                        <Input
                          value={editingTemplate.name}
                          onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                          placeholder="ناوی تێمپلەیت"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>قەبارە</Label>
                        <Select value={editingTemplate.size} onValueChange={handleSizeChange}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {sizeOptions.map((s) => (
                              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {editingTemplate.size === "custom" && (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>پانی (mm)</Label>
                            <Input type="number" value={editingTemplate.widthMm} onChange={(e) => setEditingTemplate({ ...editingTemplate, widthMm: parseInt(e.target.value) || 100 })} />
                          </div>
                          <div className="space-y-2">
                            <Label>بەرزی (mm)</Label>
                            <Input type="number" value={editingTemplate.heightMm} onChange={(e) => setEditingTemplate({ ...editingTemplate, heightMm: parseInt(e.target.value) || 150 })} />
                          </div>
                        </div>
                      )}
                      <Separator />
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2"><QrCode className="h-4 w-4" /><Label>QR / بارکۆد</Label></div>
                        <Switch checked={editingTemplate.showQrCode} onCheckedChange={(c) => setEditingTemplate({ ...editingTemplate, showQrCode: c })} />
                      </div>
                      {editingTemplate.showQrCode && (
                        <>
                          <div className="space-y-2">
                            <Label>قەبارەی QR</Label>
                            <Input type="number" value={editingTemplate.qrCodeSize} onChange={(e) => setEditingTemplate({ ...editingTemplate, qrCodeSize: parseInt(e.target.value) || 80 })} />
                          </div>
                          <div className="space-y-2">
                            <Label>شوێنی QR</Label>
                            <Select value={editingTemplate.qrCodePosition} onValueChange={(v) => setEditingTemplate({ ...editingTemplate, qrCodePosition: v })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {qrPositions.map((p) => (
                                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      )}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2"><Label>لۆگۆ</Label></div>
                        <Switch checked={editingTemplate.showLogo} onCheckedChange={(c) => setEditingTemplate({ ...editingTemplate, showLogo: c })} />
                      </div>
                    </TabsContent>
                    <TabsContent value="content" className="space-y-3 mt-4">
                      {[
                        { key: "showCustomerName", label: "ناوی کڕیار", Icon: User },
                        { key: "showCustomerCode", label: "کۆدی کڕیار", Icon: Hash },
                        { key: "showTotalPackages", label: "کۆی پاکەت", Icon: Package },
                        { key: "showTotalWeight", label: "کۆی کیلۆ", Icon: Scale },
                        { key: "showTotalVolume", label: "کۆی حەجم (CBM)", Icon: Package },
                        { key: "showTotalPrice", label: "کۆی نرخ", Icon: DollarSign },
                        { key: "showBatchNumber", label: "کۆدی باچ", Icon: Package },
                        { key: "showDate", label: "بەروار", Icon: Calendar },
                      ].map(({ key, label, Icon }) => (
                        <div key={key} className="flex items-center justify-between">
                          <div className="flex items-center gap-2"><Icon className="h-4 w-4 text-muted-foreground" /><Label>{label}</Label></div>
                          <Switch
                            checked={!!editingTemplate[key]}
                            onCheckedChange={(c) => setEditingTemplate({ ...editingTemplate, [key]: c })}
                          />
                        </div>
                      ))}
                    </TabsContent>
                    <TabsContent value="style" className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <Label>رەنگی سەرەکی</Label>
                        <div className="flex gap-2">
                          <Input type="color" value={editingTemplate.primaryColor || "#059669"} onChange={(e) => setEditingTemplate({ ...editingTemplate, primaryColor: e.target.value })} className="w-16 h-10 p-1" />
                          <Input value={editingTemplate.primaryColor} onChange={(e) => setEditingTemplate({ ...editingTemplate, primaryColor: e.target.value })} placeholder="#059669" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>فۆنت</Label>
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
                        <Label>قەبارەی فۆنت</Label>
                        <Input type="number" value={editingTemplate.fontSize} onChange={(e) => setEditingTemplate({ ...editingTemplate, fontSize: parseInt(e.target.value) || 12 })} />
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
                <div className="space-y-4">
                  <Label className="text-lg font-medium">پێشبینین</Label>
                  <div className="bg-muted rounded-lg p-6 flex items-center justify-center min-h-[320px]">
                    <BatchLabelPreview template={editingTemplate} />
                  </div>
                </div>
              </div>
            )}

            <DialogFooter className="mt-6">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>{t("common.cancel")}</Button>
              <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
                <Save className="h-4 w-4 mr-2" />
                {createMutation.isPending || updateMutation.isPending ? "..." : t("common.save")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
