import { useState, useRef } from "react";
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
  QrCode, 
  Save, 
  RefreshCw,
  Settings,
  Edit,
  Trash2,
  Plus,
  Star,
  Printer,
  Package,
  User,
  Phone,
  MapPin,
  Scale,
  Calendar,
  Hash,
  Truck,
  DollarSign,
  Image
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import DashboardLayout from "@/components/DashboardLayout";
import { useTranslation } from "@/contexts/LanguageContext";
import CompanyLogo from "@/components/CompanyLogo";
import { useCompanyInfo } from "@/hooks/useCompanyInfo";

const sizeOptions = [
  { value: "10x15", label: "10 × 15 cm", width: 100, height: 150 },
  { value: "10x10", label: "10 × 10 cm", width: 100, height: 100 },
  { value: "A6", label: "A6 (10.5 × 14.8 cm)", width: 105, height: 148 },
  { value: "A5", label: "A5 (14.8 × 21 cm)", width: 148, height: 210 },
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
  name: "تێمپلەیتی بنەڕەتی",
  isDefault: true,
  size: "10x15" as const,
  widthMm: 100,
  heightMm: 150,
  showQrCode: true,
  qrCodeSize: 80,
  qrCodePosition: "top-right" as const,
  showBarcode: false,
  barcodeType: "code128" as const,
  showLogo: true,
  logoUrl: "",
  logoWidth: 60,
  showTrackingNumber: true,
  showCustomerName: true,
  showCustomerCode: true,
  showCustomerPhone: true,
  showDestinationCity: true,
  showWeight: true,
  showDimensions: false,
  showShippingType: true,
  showBatchNumber: true,
  showDate: true,
  showPrice: false,
  primaryColor: "#0ea5e9",
  fontFamily: "Arial",
  fontSize: 12,
};

// Sample package data for preview
const samplePackage = {
  trackingNumber: "PKG-2024-001234",
  customerName: "ئەحمەد محمد",
  customerCode: "C-1234",
  customerPhone: "0750 123 4567",
  destinationCity: "سلێمانی",
  weight: "2.5 kg",
  dimensions: "30×20×15 cm",
  shippingType: "هەوایی",
  batchNumber: "B-2024-045",
  date: new Date().toLocaleDateString("ku"),
  price: "$25.00",
};

export default function LabelTemplateSettings() {
  const company = useCompanyInfo();
    const { t } = useTranslation();
const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  
  const { data: templates, isLoading, refetch } = trpc.labelTemplates.list.useQuery();
  
  const ensureDefaultMutation = trpc.labelTemplates.ensureDefault.useMutation({
    onSuccess: () => {
      toast.success(t("auto.text_6cf793"));
      refetch();
    },
  });
  
  const createMutation = trpc.labelTemplates.create.useMutation({
    onSuccess: () => {
      toast.success(t("auto.text_46341f"));
      refetch();
      setIsDialogOpen(false);
      setIsCreating(false);
    },
  });
  
  const updateMutation = trpc.labelTemplates.update.useMutation({
    onSuccess: () => {
      toast.success(t("auto.text_24ea79"));
      refetch();
      setIsDialogOpen(false);
    },
  });
  
  const deleteMutation = trpc.labelTemplates.delete.useMutation({
    onSuccess: () => {
      toast.success(t("auto.text_8139a8"));
      refetch();
    },
  });
  
  const setDefaultMutation = trpc.labelTemplates.setDefault.useMutation({
    onSuccess: () => {
      toast.success(t("auto.text_48a3fd"));
      refetch();
    },
  });

  const handleSave = () => {
    if (!editingTemplate) return;
    
    if (isCreating) {
      createMutation.mutate(editingTemplate);
    } else {
      updateMutation.mutate(editingTemplate);
    }
  };

  const handleCreate = () => {
    setEditingTemplate({ ...defaultTemplate, name: t("auto.text_26b39c"), isDefault: false });
    setIsCreating(true);
    setIsDialogOpen(true);
  };

  const handleEdit = (template: any) => {
    setEditingTemplate({ ...template });
    setIsCreating(false);
    setIsDialogOpen(true);
  };

  const handleSizeChange = (size: string) => {
    const sizeOption = sizeOptions.find(s => s.value === size);
    if (sizeOption) {
      setEditingTemplate({
        ...editingTemplate,
        size,
        widthMm: sizeOption.width,
        heightMm: sizeOption.height,
      });
    }
  };

  // Generate QR code data URL
  const generateQRCode = async (data: string): Promise<string> => {
    try {
      // Loaded on demand so the qrcode bundle stays out of the page chunk.
      const QRCode = (await import("qrcode")).default;
      return await QRCode.toDataURL(data, { width: 200, margin: 1 });
    } catch {
      return "";
    }
  };

  // Label Preview Component
  const LabelPreview = ({ template }: { template: any }) => {
    const [qrDataUrl, setQrDataUrl] = useState("");
    
    // Generate QR code on mount
    useState(() => {
      generateQRCode(samplePackage.trackingNumber).then(setQrDataUrl);
    });

    const scale = 2; // Scale for preview
    const width = template.widthMm * scale;
    const height = template.heightMm * scale;

    return (
      <div 
        ref={previewRef}
        /* wazn-paper: a preview of a printed label — white paper and dark ink
           are correct in both themes, so the readability net skips it. */
        className="wazn-paper border-2 border-dashed rounded-lg bg-white p-4 mx-auto"
        style={{ 
          width: `${width}px`, 
          height: `${height}px`,
          fontFamily: template.fontFamily,
          fontSize: `${template.fontSize}px`,
        }}
      >
        <div className="h-full flex flex-col relative">
          {/* Header with Logo and QR */}
          <div className="flex justify-between items-start mb-2">
            {template.showLogo && (
              <div className="flex items-center gap-1">
                <CompanyLogo
                  size={24}
                  iconClassName="h-4 w-4 text-white"
                />
                <span className="font-bold text-sm" style={{ color: template.primaryColor }}>
                  {company.name}
                </span>
              </div>
            )}
            
            {template.showQrCode && (
              <div 
                className={`absolute ${
                  template.qrCodePosition === "top-left" ? "top-0 left-0" :
                  template.qrCodePosition === "top-right" ? "top-0 right-0" :
                  template.qrCodePosition === "bottom-left" ? "bottom-0 left-0" :
                  template.qrCodePosition === "bottom-right" ? "bottom-0 right-0" :
                  "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                }`}
                style={{ width: `${template.qrCodeSize}px`, height: `${template.qrCodeSize}px` }}
              >
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="QR Code" className="w-full h-full" />
                ) : (
                  <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                    <QrCode className="h-8 w-8 text-gray-400" />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Tracking Number */}
          {template.showTrackingNumber && (
            <div className="text-center py-2 border-y border-gray-300 dark:border-gray-800/60 my-2">
              <p className="text-xs text-gray-500">Tracking Number</p>
              <p className="font-bold text-lg" style={{ color: template.primaryColor }}>
                {samplePackage.trackingNumber}
              </p>
            </div>
          )}

          {/* Customer Info */}
          <div className="space-y-1 flex-1">
            {template.showCustomerName && (
              <div className="flex items-center gap-1">
                <User className="h-3 w-3 text-gray-400" />
                <span className="font-medium">{samplePackage.customerName}</span>
              </div>
            )}
            
            {template.showCustomerCode && (
              <div className="flex items-center gap-1">
                <Hash className="h-3 w-3 text-gray-400" />
                <span className="text-sm">{samplePackage.customerCode}</span>
              </div>
            )}
            
            {template.showCustomerPhone && (
              <div className="flex items-center gap-1">
                <Phone className="h-3 w-3 text-gray-400" />
                <span className="text-sm">{samplePackage.customerPhone}</span>
              </div>
            )}
            
            {template.showDestinationCity && (
              <div className="flex items-center gap-1">
                <MapPin className="h-3 w-3 text-gray-400" />
                <span className="font-medium">{samplePackage.destinationCity}</span>
              </div>
            )}
          </div>

          {/* Package Details */}
          <div className="grid grid-cols-2 gap-1 text-xs border-t border-gray-200 dark:border-gray-800/60 pt-2 mt-2">
            {template.showWeight && (
              <div className="flex items-center gap-1">
                <Scale className="h-3 w-3 text-gray-400" />
                <span>{samplePackage.weight}</span>
              </div>
            )}
            
            {template.showShippingType && (
              <div className="flex items-center gap-1">
                <Truck className="h-3 w-3 text-gray-400" />
                <span>{samplePackage.shippingType}</span>
              </div>
            )}
            
            {template.showBatchNumber && (
              <div className="flex items-center gap-1">
                <Package className="h-3 w-3 text-gray-400" />
                <span>{samplePackage.batchNumber}</span>
              </div>
            )}
            
            {template.showDate && (
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3 text-gray-400" />
                <span>{samplePackage.date}</span>
              </div>
            )}
            
            {template.showPrice && (
              <div className="flex items-center gap-1">
                <DollarSign className="h-3 w-3 text-gray-400" />
                <span>{samplePackage.price}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout>
    <div className="container py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <QrCode className="h-6 w-6 text-primary" />
            {t("auto.text_2c8fd6")}
          </h1>
          <p className="text-muted-foreground">
            {t("auto.text_8b02d9")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => ensureDefaultMutation.mutate()}
            disabled={ensureDefaultMutation.isPending}
          >
            <RefreshCw className={`h-4 w-4 me-2 ${ensureDefaultMutation.isPending ? 'animate-spin' : ''}`} />
            {t("auto.text_30d6a9")}
          </Button>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 me-2" />
            {t("auto.text_26b39c")}
          </Button>
        </div>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full text-center py-8 text-muted-foreground">
            {t("auto.text_b6d29c")}
          </div>
        ) : !templates || templates.length === 0 ? (
          <div className="col-span-full text-center py-8">
            <QrCode className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">{t("auto.text_c98a6e")} </p>
            <Button onClick={() => ensureDefaultMutation.mutate()}>
              {t("auto.text_c68dfd")}
            </Button>
          </div>
        ) : (
          templates.map((template) => (
            <Card key={template.id} className={template.isDefault ? "border-primary" : ""}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {template.name}
                    {template.isDefault && (
                      <Badge variant="default" className="text-xs">
                        <Star className="h-3 w-3 me-1" />
                        {t("auto.text_b254b4")}
                      </Badge>
                    )}
                  </CardTitle>
                </div>
                <CardDescription>
                  {template.size === "custom" 
                    ? `${template.widthMm} × ${template.heightMm} mm`
                    : sizeOptions.find(s => s.value === template.size)?.label
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Mini Preview */}
                <div className="bg-muted rounded-lg p-4 mb-4 flex items-center justify-center min-h-[120px]">
                  <div className="text-center">
                    <QrCode className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">
                      {template.showQrCode && "QR"} 
                     {template.showTrackingNumber && ` + ${t("auto.text_c8ae46")}`}
                      {template.showCustomerName && ` + ${t("auto.text_5cb9ee")}`}
                    </p>
                  </div>
                </div>
                
                {/* Actions */}
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => handleEdit(template)}
                  >
                    <Edit className="h-4 w-4 me-1" />{t("common.edit")}</Button>
                  {!template.isDefault && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDefaultMutation.mutate({ id: template.id })}
                      >
                        <Star className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (confirm("دڵنیایت لە سڕینەوە؟")) {
                            deleteMutation.mutate({ id: template.id });
                          }
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

      {/* Edit/Create Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) {
          setEditingTemplate(null);
          setIsCreating(false);
        }
      }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              {isCreating ? t("auto.text_92328a") : t("common.create")}
            </DialogTitle>
            <DialogDescription>
              ڕ{t("auto.text_7fed9f")}
            </DialogDescription>
          </DialogHeader>

          {editingTemplate && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
              {/* Settings */}
              <div className="space-y-6">
                <Tabs defaultValue="general">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="general">{t("auto.text_fd3327")} </TabsTrigger>
                    <TabsTrigger value="content">{t("auto.text_d47786")} </TabsTrigger>
                    <TabsTrigger value="style">{t("finance.method")}</TabsTrigger>
                  </TabsList>

                  <TabsContent value="general" className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label>{t("auto.text_321f7e")} </Label>
                      <Input
                        value={editingTemplate.name}
                        onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                        placeholder={t("auto.text_0797cf")}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>{t("auto.text_56d984")} </Label>
                      <Select
                        value={editingTemplate.size}
                        onValueChange={handleSizeChange}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {sizeOptions.map((size) => (
                            <SelectItem key={size.value} value={size.value}>
                              {size.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {editingTemplate.size === "custom" && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>{t("auto.text_7492fe")} </Label>
                          <Input
                            type="number"
                            value={editingTemplate.widthMm}
                            onChange={(e) => setEditingTemplate({ ...editingTemplate, widthMm: parseInt(e.target.value) })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>{t("auto.text_a0a3bf")} </Label>
                          <Input
                            type="number"
                            value={editingTemplate.heightMm}
                            onChange={(e) => setEditingTemplate({ ...editingTemplate, heightMm: parseInt(e.target.value) })}
                          />
                        </div>
                      </div>
                    )}

                    <Separator />

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <QrCode className="h-4 w-4" />
                          <Label>QR Code</Label>
                        </div>
                        <Switch
                          checked={editingTemplate.showQrCode}
                          onCheckedChange={(checked) => setEditingTemplate({ ...editingTemplate, showQrCode: checked })}
                        />
                      </div>

                      {editingTemplate.showQrCode && (
                        <>
                          <div className="space-y-2">
                            <Label>{t("auto.text_23b280")} </Label>
                            <Input
                              type="number"
                              value={editingTemplate.qrCodeSize}
                              onChange={(e) => setEditingTemplate({ ...editingTemplate, qrCodeSize: parseInt(e.target.value) })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>{t("auto.text_3b6b98")} </Label>
                            <Select
                              value={editingTemplate.qrCodePosition}
                              onValueChange={(value) => setEditingTemplate({ ...editingTemplate, qrCodePosition: value })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {qrPositions.map((pos) => (
                                  <SelectItem key={pos.value} value={pos.value}>
                                    {pos.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      )}

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Image className="h-4 w-4" />
                          <Label>{t("auto.text_97a8db")} </Label>
                        </div>
                        <Switch
                          checked={editingTemplate.showLogo}
                          onCheckedChange={(checked) => setEditingTemplate({ ...editingTemplate, showLogo: checked })}
                        />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="content" className="space-y-4 mt-4">
                    <p className="text-sm text-muted-foreground mb-4">
                      {t("auto.text_6fe827")}
                    </p>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Hash className="h-4 w-4 text-muted-foreground" />
                          <Label>{t("auto.text_9cf7c4")} </Label>
                        </div>
                        <Switch
                          checked={editingTemplate.showTrackingNumber}
                          onCheckedChange={(checked) => setEditingTemplate({ ...editingTemplate, showTrackingNumber: checked })}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <Label>{t("customers.customerName")}</Label>
                        </div>
                        <Switch
                          checked={editingTemplate.showCustomerName}
                          onCheckedChange={(checked) => setEditingTemplate({ ...editingTemplate, showCustomerName: checked })}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Hash className="h-4 w-4 text-muted-foreground" />
                          <Label>{t("customers.customerCode")}</Label>
                        </div>
                        <Switch
                          checked={editingTemplate.showCustomerCode}
                          onCheckedChange={(checked) => setEditingTemplate({ ...editingTemplate, showCustomerCode: checked })}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <Label>{t("customers.phone")}</Label>
                        </div>
                        <Switch
                          checked={editingTemplate.showCustomerPhone}
                          onCheckedChange={(checked) => setEditingTemplate({ ...editingTemplate, showCustomerPhone: checked })}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <Label>{t("auto.text_ec889a")} </Label>
                        </div>
                        <Switch
                          checked={editingTemplate.showDestinationCity}
                          onCheckedChange={(checked) => setEditingTemplate({ ...editingTemplate, showDestinationCity: checked })}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Scale className="h-4 w-4 text-muted-foreground" />
                          <Label>{t("common.weight")}</Label>
                        </div>
                        <Switch
                          checked={editingTemplate.showWeight}
                          onCheckedChange={(checked) => setEditingTemplate({ ...editingTemplate, showWeight: checked })}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Truck className="h-4 w-4 text-muted-foreground" />
                          <Label>{t("packages.shippingType")}</Label>
                        </div>
                        <Switch
                          checked={editingTemplate.showShippingType}
                          onCheckedChange={(checked) => setEditingTemplate({ ...editingTemplate, showShippingType: checked })}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          <Label>{t("auto.text_d9ae24")} </Label>
                        </div>
                        <Switch
                          checked={editingTemplate.showBatchNumber}
                          onCheckedChange={(checked) => setEditingTemplate({ ...editingTemplate, showBatchNumber: checked })}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <Label>{t("common.date")}</Label>
                        </div>
                        <Switch
                          checked={editingTemplate.showDate}
                          onCheckedChange={(checked) => setEditingTemplate({ ...editingTemplate, showDate: checked })}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <Label>{t("common.price")}</Label>
                        </div>
                        <Switch
                          checked={editingTemplate.showPrice}
                          onCheckedChange={(checked) => setEditingTemplate({ ...editingTemplate, showPrice: checked })}
                        />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="style" className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label>{t("auto.text_bc0c0d")} </Label>
                      <div className="flex gap-2">
                        <Input
                          type="color"
                          value={editingTemplate.primaryColor}
                          onChange={(e) => setEditingTemplate({ ...editingTemplate, primaryColor: e.target.value })}
                          className="w-16 h-10 p-1"
                        />
                        <Input
                          value={editingTemplate.primaryColor}
                          onChange={(e) => setEditingTemplate({ ...editingTemplate, primaryColor: e.target.value })}
                          placeholder="#0ea5e9"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>{t("auto.text_5ebca1")} </Label>
                      <Select
                        value={editingTemplate.fontFamily}
                        onValueChange={(value) => setEditingTemplate({ ...editingTemplate, fontFamily: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Arial">Arial</SelectItem>
                          <SelectItem value="Tahoma">Tahoma</SelectItem>
                          <SelectItem value="Verdana">Verdana</SelectItem>
                          <SelectItem value="Georgia">Georgia</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>{t("auto.text_f21891")} </Label>
                      <Input
                        type="number"
                        value={editingTemplate.fontSize}
                        onChange={(e) => setEditingTemplate({ ...editingTemplate, fontSize: parseInt(e.target.value) })}
                      />
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

              {/* Preview */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-lg font-medium">{t("auto.text_534d72")} </Label>
                  <Badge variant="outline">
                    {editingTemplate.widthMm} × {editingTemplate.heightMm} mm
                  </Badge>
                </div>
                <div className="bg-muted rounded-lg p-6 flex items-center justify-center min-h-[400px]">
                  <LabelPreview template={editingTemplate} />
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
              <Save className="h-4 w-4 me-2" />
              {createMutation.isPending || updateMutation.isPending ? t("auto.text_f7ce12") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </DashboardLayout>
  );
}
