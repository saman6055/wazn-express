import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { 
  QrCode, 
  Printer,
  Package,
  User,
  Phone,
  MapPin,
  Scale,
  Calendar,
  Hash,
  Truck,
  Search,
  CheckSquare,
  Square,
  Download,
  Eye,
  Layers,
  X
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import QRCode from "qrcode";
import { useTranslation } from "@/contexts/LanguageContext";

export default function LabelPrinting() {
    const { t } = useTranslation();
const [selectedPackages, setSelectedPackages] = useState<number[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [previewPackage, setPreviewPackage] = useState<any>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  
  const { data: templates } = trpc.labelTemplates.list.useQuery();
  const { data: batches } = trpc.batches.list.useQuery();
  const { data: packagesResponse, isLoading } = trpc.packages.list.useQuery({ pageSize: 1000 });
  const packages = packagesResponse?.data;
  
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  
  // Get default template
  useEffect(() => {
    if (templates && templates.length > 0) {
      const defaultTemplate = templates.find(t => t.isDefault) || templates[0];
      setSelectedTemplate(defaultTemplate);
    }
  }, [templates]);

  // Filter packages based on search and batch
  const filteredPackages = packages?.filter(pkg => {
    const matchesSearch = !searchQuery || 
      pkg.trackingNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (pkg as any).customerName?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesBatch = !selectedBatch || selectedBatch === "all" || pkg.batchId?.toString() === selectedBatch;
    return matchesSearch && matchesBatch;
  }) || [];

  const togglePackage = (id: number) => {
    setSelectedPackages(prev => 
      prev.includes(id) 
        ? prev.filter(p => p !== id)
        : [...prev, id]
    );
  };

  const selectAll = () => {
    setSelectedPackages(filteredPackages.map(p => p.id));
  };

  const deselectAll = () => {
    setSelectedPackages([]);
  };

  const handlePrint = async () => {
    if (selectedPackages.length === 0) {
      toast.error(t("auto.text_45b8fc"));
      return;
    }
    
    setIsPrinting(true);
    
    // Generate print content
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error(t("auto.text_2a65c7"));
      setIsPrinting(false);
      return;
    }

    const selectedPkgs = packages?.filter(p => selectedPackages.includes(p.id)) || [];
    
    // Generate QR codes for all packages
    const qrCodes: Record<string, string> = {};
    for (const pkg of selectedPkgs) {
      if (pkg.trackingNumber) {
        qrCodes[pkg.trackingNumber] = await QRCode.toDataURL(pkg.trackingNumber, { width: 200, margin: 1 });
      }
    }

    const template = selectedTemplate || {
      widthMm: 100,
      heightMm: 150,
      primaryColor: "#0ea5e9",
      showQrCode: true,
      qrCodeSize: 80,
      qrCodePosition: "top-right",
      showLogo: true,
      showTrackingNumber: true,
      showCustomerName: true,
      showCustomerCode: true,
      showCustomerPhone: true,
      showDestinationCity: true,
      showWeight: true,
      showShippingType: true,
      showBatchNumber: true,
      showDate: true,
    };

    const labelsHtml = selectedPkgs.map(pkg => `
      <div class="label" style="
        width: ${template.widthMm}mm;
        height: ${template.heightMm}mm;
        border: 1px solid #ccc;
        padding: 4mm;
        margin: 2mm;
        page-break-inside: avoid;
        display: inline-block;
        vertical-align: top;
        box-sizing: border-box;
        font-family: Arial, sans-serif;
        font-size: 10pt;
        position: relative;
      ">
        ${template.showLogo ? `
          <div style="display: flex; align-items: center; gap: 2mm; margin-bottom: 2mm;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${template.primaryColor}" stroke-width="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            </svg>
            <span style="font-weight: bold; color: ${template.primaryColor};">Wazn Express</span>
          </div>
        ` : ''}
        
        ${template.showQrCode && pkg.trackingNumber && qrCodes[pkg.trackingNumber] ? `
          <div style="
            position: absolute;
            ${template.qrCodePosition === 'top-left' ? 'top: 4mm; left: 4mm;' : ''}
            ${template.qrCodePosition === 'top-right' ? 'top: 4mm; right: 4mm;' : ''}
            ${template.qrCodePosition === 'bottom-left' ? 'bottom: 4mm; left: 4mm;' : ''}
            ${template.qrCodePosition === 'bottom-right' ? 'bottom: 4mm; right: 4mm;' : ''}
            ${template.qrCodePosition === 'center' ? 'top: 50%; left: 50%; transform: translate(-50%, -50%);' : ''}
          ">
            <img src="${qrCodes[pkg.trackingNumber]}" style="width: ${template.qrCodeSize}px; height: ${template.qrCodeSize}px;" />
          </div>
        ` : ''}
        
        ${template.showTrackingNumber ? `
          <div style="text-align: center; padding: 2mm 0; border-top: 1px solid #ccc; border-bottom: 1px solid #ccc; margin: 2mm 0;">
            <div style="font-size: 8pt; color: #666;">Tracking Number</div>
            <div style="font-weight: bold; font-size: 12pt; color: ${template.primaryColor};">${pkg.trackingNumber || 'N/A'}</div>
          </div>
        ` : ''}
        
        <div style="margin-top: 2mm;">
          ${template.showCustomerName ? `
            <div style="display: flex; align-items: center; gap: 1mm; margin-bottom: 1mm;">
              <span style="color: #666;">👤</span>
              <span style="font-weight: 500;">${(pkg as any).customerName || 'Unknown'}</span>
            </div>
          ` : ''}
          
          ${template.showCustomerCode ? `
            <div style="display: flex; align-items: center; gap: 1mm; margin-bottom: 1mm;">
              <span style="color: #666;">#</span>
              <span>${pkg.customerId || 'N/A'}</span>
            </div>
          ` : ''}
          
          ${template.showCustomerPhone ? `
            <div style="display: flex; align-items: center; gap: 1mm; margin-bottom: 1mm;">
              <span style="color: #666;">📱</span>
              <span>${(pkg as any).customerPhone || 'N/A'}</span>
            </div>
          ` : ''}
          
          ${template.showDestinationCity ? `
            <div style="display: flex; align-items: center; gap: 1mm; margin-bottom: 1mm;">
              <span style="color: #666;">📍</span>
              <span style="font-weight: 500;">${(pkg as any).destinationCity || 'N/A'}</span>
            </div>
          ` : ''}
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1mm; font-size: 9pt; border-top: 1px solid #eee; padding-top: 2mm; margin-top: 2mm;">
          ${template.showWeight ? `
            <div>⚖️ ${pkg.weightKg || 0} kg</div>
          ` : ''}
          
          ${template.showShippingType ? `
            <div>🚚 ${pkg.shippingType === 'air_regular' ? 'Air' : pkg.shippingType === 'sea' ? 'Sea' : 'Air Irregular'}</div>
          ` : ''}
          
          ${template.showBatchNumber ? `
            <div>📦 ${(pkg as any).batchCode || 'N/A'}</div>
          ` : ''}
          
          ${template.showDate ? `
            <div>📅 ${new Date().toLocaleDateString()}</div>
          ` : ''}
        </div>
      </div>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Print Labels - Wazn Express</title>
        <style>
          @page {
            size: A4;
            margin: 5mm;
          }
          body {
            margin: 0;
            padding: 0;
            font-family: Arial, sans-serif;
          }
          .labels-container {
            display: flex;
            flex-wrap: wrap;
            justify-content: flex-start;
          }
        </style>
      </head>
      <body>
        <div class="labels-container">
          ${labelsHtml}
        </div>
        <script>
          window.onload = function() {
            window.print();
            window.onafterprint = function() {
              window.close();
            };
          };
        </script>
      </body>
      </html>
    `);
    
    printWindow.document.close();
    setIsPrinting(false);
    toast.success(`${selectedPackages.length} لەیبڵ چاپ کرا`);
  };

  const handlePreview = async (pkg: any) => {
    setPreviewPackage(pkg);
    setIsPreviewOpen(true);
  };

  // Label Preview Component
  const LabelPreview = ({ pkg, template }: { pkg: any; template: any }) => {
    const [qrDataUrl, setQrDataUrl] = useState("");
    
    useEffect(() => {
      if (pkg?.trackingNumber) {
        QRCode.toDataURL(pkg.trackingNumber, { width: 200, margin: 1 }).then(setQrDataUrl);
      }
    }, [pkg?.trackingNumber]);

    if (!template) return null;

    const scale = 2;
    const width = template.widthMm * scale;
    const height = template.heightMm * scale;

    return (
      <div 
        className="border-2 border-dashed rounded-lg bg-white p-4 mx-auto"
        style={{ 
          width: `${width}px`, 
          height: `${height}px`,
          fontFamily: template.fontFamily || 'Arial',
          fontSize: `${template.fontSize || 12}px`,
        }}
      >
        <div className="h-full flex flex-col relative">
          {template.showLogo && (
            <div className="flex items-center gap-1 mb-2">
              <Package className="h-6 w-6" style={{ color: template.primaryColor }} />
              <span className="font-bold text-sm" style={{ color: template.primaryColor }}>
                Wazn Express
              </span>
            </div>
          )}
          
          {template.showQrCode && qrDataUrl && (
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
              <img src={qrDataUrl} alt="QR Code" className="w-full h-full" />
            </div>
          )}

          {template.showTrackingNumber && (
            <div className="text-center py-2 border-y border-gray-300 my-2">
              <p className="text-xs text-gray-500">Tracking Number</p>
              <p className="font-bold text-lg" style={{ color: template.primaryColor }}>
                {pkg.trackingNumber || 'N/A'}
              </p>
            </div>
          )}

          <div className="space-y-1 flex-1">
            {template.showCustomerName && (
              <div className="flex items-center gap-1">
                <User className="h-3 w-3 text-gray-400" />
                <span className="font-medium">{(pkg as any).customerName || 'Unknown'}</span>
              </div>
            )}
            
            {template.showCustomerCode && (
              <div className="flex items-center gap-1">
                <Hash className="h-3 w-3 text-gray-400" />
                <span className="text-sm">{pkg.customerId || 'N/A'}</span>
              </div>
            )}
            
            {template.showCustomerPhone && (
              <div className="flex items-center gap-1">
                <Phone className="h-3 w-3 text-gray-400" />
                <span className="text-sm">{(pkg as any).customerPhone || 'N/A'}</span>
              </div>
            )}
            
            {template.showDestinationCity && (
              <div className="flex items-center gap-1">
                <MapPin className="h-3 w-3 text-gray-400" />
                <span className="font-medium">{(pkg as any).destinationCity || 'N/A'}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-1 text-xs border-t border-gray-200 pt-2 mt-2">
            {template.showWeight && (
              <div className="flex items-center gap-1">
                <Scale className="h-3 w-3 text-gray-400" />
                <span>{pkg.weightKg || 0} kg</span>
              </div>
            )}
            
            {template.showShippingType && (
              <div className="flex items-center gap-1">
                <Truck className="h-3 w-3 text-gray-400" />
                <span>{pkg.shippingType === 'air_regular' ? 'Air' : pkg.shippingType === 'sea' ? 'Sea' : 'Air Irregular'}</span>
              </div>
            )}
            
            {template.showBatchNumber && (
              <div className="flex items-center gap-1">
                <Package className="h-3 w-3 text-gray-400" />
                <span>{(pkg as any).batchCode || 'N/A'}</span>
              </div>
            )}
            
            {template.showDate && (
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3 text-gray-400" />
                <span>{new Date().toLocaleDateString()}</span>
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
              <Printer className="h-6 w-6 text-primary" />
              {t("auto.text_51cdbe")}
            </h1>
            <p className="text-muted-foreground">
              {t("auto.text_99ec63")}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={deselectAll}
              disabled={selectedPackages.length === 0}
            >
              <X className="h-4 w-4 mr-2" />
              {t("auto.text_43b85e")}
            </Button>
            <Button
              onClick={handlePrint}
              disabled={selectedPackages.length === 0 || isPrinting}
            >
              <Printer className="h-4 w-4 mr-2" />
              {t("auto.text_681d08")} ({selectedPackages.length})
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>{t("common.search")}</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t("auto.text_19d4c7")}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>{t("batches.title")}</Label>
                <Select value={selectedBatch} onValueChange={setSelectedBatch}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("auto.text_0586c4")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("auto.text_0586c4")} </SelectItem>
                    {batches?.map(batch => (
                      <SelectItem key={batch.id} value={batch.id.toString()}>
                        {batch.batchCode} ({batch.status})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>{t("auto.text_dc1105")} </Label>
                <Select 
                  value={selectedTemplate?.id?.toString() || ""} 
                  onValueChange={(val) => {
                    const template = templates?.find(t => t.id.toString() === val);
                    setSelectedTemplate(template);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("auto.text_a7f73f")} />
                  </SelectTrigger>
                  <SelectContent>
                    {templates?.map(template => (
                      <SelectItem key={template.id} value={template.id.toString()}>
                        {template.name} {template.isDefault && `(${t("auto.text_b254b4")})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2 flex items-end">
                <Button variant="outline" onClick={selectAll} className="w-full">
                  <CheckSquare className="h-4 w-4 mr-2" />
                  {t("auto.text_218203")} ({filteredPackages.length})
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("auto.text_132a2f")} </p>
                <p className="text-xl font-bold">{filteredPackages.length}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-full bg-green-100 dark:bg-green-900">
                <CheckSquare className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("auto.text_cbfa7f")} </p>
                <p className="text-xl font-bold">{selectedPackages.length}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-900">
                <Layers className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("auto.text_97e6c6")} </p>
                <p className="text-xl font-bold">
                  {selectedBatch && selectedBatch !== "all" 
                    ? batches?.find(b => b.id.toString() === selectedBatch)?.batchCode || "-"
                    : t("common.all")
                  }
                </p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-full bg-orange-100 dark:bg-orange-900">
                <QrCode className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("auto.text_dc1105")} </p>
                <p className="text-xl font-bold">{selectedTemplate?.name || t("auto.text_b254b4")}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Packages Table */}
        <Card>
          <CardHeader>
            <CardTitle>{t("packages.title")}</CardTitle>
            <CardDescription>
              {t("auto.text_f802bb")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                {t("auto.text_b6d29c")}
              </div>
            ) : filteredPackages.length === 0 ? (
              <div className="text-center py-8">
                <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">{t("auto.text_af6938")} </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedPackages.length === filteredPackages.length && filteredPackages.length > 0}
                        onCheckedChange={(checked) => {
                          if (checked) selectAll();
                          else deselectAll();
                        }}
                      />
                    </TableHead>
                    <TableHead>{t("auto.text_9cf7c4")} </TableHead>
                    <TableHead>{t("customers.title")}</TableHead>
                    <TableHead>{t("customers.city")}</TableHead>
                    <TableHead>{t("common.weight")}</TableHead>
                    <TableHead>{t("common.type")}</TableHead>
                    <TableHead>{t("batches.title")}</TableHead>
                    <TableHead>{t("auto.text_5ce786")} </TableHead>
                    <TableHead className="w-20">{t("auto.text_534d72")} </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPackages.map((pkg) => (
                    <TableRow 
                      key={pkg.id}
                      className={`cursor-pointer ${selectedPackages.includes(pkg.id) ? 'bg-primary/10' : ''}`}
                      onClick={() => togglePackage(pkg.id)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedPackages.includes(pkg.id)}
                          onCheckedChange={() => togglePackage(pkg.id)}
                        />
                      </TableCell>
                      <TableCell className="font-mono">{pkg.trackingNumber || 'N/A'}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{(pkg as any).customerName || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">{pkg.customerId}</p>
                        </div>
                      </TableCell>
                      <TableCell>{(pkg as any).destinationCity || '-'}</TableCell>
                      <TableCell>{pkg.weightKg || 0} kg</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {pkg.shippingType === 'air_regular' ? 'Air' : pkg.shippingType === 'sea' ? 'Sea' : 'Air Irregular'}
                        </Badge>
                      </TableCell>
                      <TableCell>{(pkg as any).batchCode || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={
                          pkg.status === 'delivered' ? 'default' :
                          pkg.status === 'in_transit' ? 'secondary' :
                          'outline'
                        }>
                          {pkg.status}
                        </Badge>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePreview(pkg)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Preview Dialog */}
        <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                {t("auto.text_8087a5")}
              </DialogTitle>
              <DialogDescription>
                {previewPackage?.trackingNumber}
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex items-center justify-center py-4">
              {previewPackage && selectedTemplate && (
                <LabelPreview pkg={previewPackage} template={selectedTemplate} />
              )}
            </div>
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsPreviewOpen(false)}>{t("common.close")}</Button>
              <Button onClick={() => {
                setSelectedPackages([previewPackage.id]);
                handlePrint();
                setIsPreviewOpen(false);
              }}>
                <Printer className="h-4 w-4 mr-2" />{t("actions.print")}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
