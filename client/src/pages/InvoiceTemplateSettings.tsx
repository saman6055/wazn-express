import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";
import { 
  FileText, Building, Palette, CreditCard, Image, Settings, 
  Save, Loader2, Eye, Plus, Trash2, Check, Upload
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useTranslation } from "@/contexts/LanguageContext";


export default function InvoiceTemplateSettings() {
    const { t } = useTranslation();
const [activeTab, setActiveTab] = useState("company");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: "Default",
    style: "modern" as "modern" | "classic" | "minimal",
    // Company Info
    companyName: "",
    companyNameAr: "",
    companyNameKu: "",
    companyAddress: "",
    companyAddressAr: "",
    companyAddressKu: "",
    companyPhone: "",
    companyPhone2: "",
    companyEmail: "",
    companyWebsite: "",
    // Logo
    logoUrl: "",
    logoWidth: 150,
    logoPosition: "left" as "left" | "center" | "right",
    // Colors
    primaryColor: "#3b82f6",
    secondaryColor: "#10b981",
    accentColor: "#f59e0b",
    textColor: "#1f2937",
    backgroundColor: "#ffffff",
    // Font
    fontFamily: "Arial",
    fontSize: 10,
    // Bank Details
    bankName: "",
    bankAccountName: "",
    bankAccountNumber: "",
    bankIban: "",
    bankSwift: "",
    bank2Name: "",
    bank2AccountName: "",
    bank2AccountNumber: "",
    bank2Currency: "",
    // Footer
    footerText: "",
    footerTextAr: "",
    footerTextKu: "",
    termsText: "",
    termsTextAr: "",
    termsTextKu: "",
    // Options
    showQrCode: true,
    showWatermark: false,
    watermarkText: "",
    invoicePrefix: "INV",
    invoiceNumberDigits: 6,
  });

  const { data: templates, refetch } = trpc.invoiceTemplates.list.useQuery();
  const { data: defaultTemplate, refetch: refetchDefault } = trpc.invoiceTemplates.getDefault.useQuery();
  
  const createMutation = trpc.invoiceTemplates.create.useMutation({
    onSuccess: () => {
      toast.success(t("auto.text_46341f"));
      refetch();
      refetchDefault();
      setIsSaving(false);
    },
    onError: (error) => {
      toast.error("هەڵە: " + error.message);
      setIsSaving(false);
    }
  });

  const updateMutation = trpc.invoiceTemplates.update.useMutation({
    onSuccess: () => {
      toast.success(t("auto.text_24ea79"));
      refetch();
      refetchDefault();
      setIsSaving(false);
    },
    onError: (error) => {
      toast.error("هەڵە: " + error.message);
      setIsSaving(false);
    }
  });

  const ensureDefaultMutation = trpc.invoiceTemplates.ensureDefault.useMutation({
    onSuccess: () => {
      refetch();
      refetchDefault();
    }
  });

  // Load default template on mount
  useEffect(() => {
    if (defaultTemplate) {
      setFormData({
        name: defaultTemplate.name || "Default",
        style: defaultTemplate.style || "modern",
        companyName: defaultTemplate.companyName || "",
        companyNameAr: defaultTemplate.companyNameAr || "",
        companyNameKu: defaultTemplate.companyNameKu || "",
        companyAddress: defaultTemplate.companyAddress || "",
        companyAddressAr: defaultTemplate.companyAddressAr || "",
        companyAddressKu: defaultTemplate.companyAddressKu || "",
        companyPhone: defaultTemplate.companyPhone || "",
        companyPhone2: defaultTemplate.companyPhone2 || "",
        companyEmail: defaultTemplate.companyEmail || "",
        companyWebsite: defaultTemplate.companyWebsite || "",
        logoUrl: defaultTemplate.logoUrl || "",
        logoWidth: defaultTemplate.logoWidth || 150,
        logoPosition: defaultTemplate.logoPosition || "left",
        primaryColor: defaultTemplate.primaryColor || "#3b82f6",
        secondaryColor: defaultTemplate.secondaryColor || "#10b981",
        accentColor: defaultTemplate.accentColor || "#f59e0b",
        textColor: defaultTemplate.textColor || "#1f2937",
        backgroundColor: defaultTemplate.backgroundColor || "#ffffff",
        fontFamily: defaultTemplate.fontFamily || "Arial",
        fontSize: defaultTemplate.fontSize || 10,
        bankName: defaultTemplate.bankName || "",
        bankAccountName: defaultTemplate.bankAccountName || "",
        bankAccountNumber: defaultTemplate.bankAccountNumber || "",
        bankIban: defaultTemplate.bankIban || "",
        bankSwift: defaultTemplate.bankSwift || "",
        bank2Name: defaultTemplate.bank2Name || "",
        bank2AccountName: defaultTemplate.bank2AccountName || "",
        bank2AccountNumber: defaultTemplate.bank2AccountNumber || "",
        bank2Currency: defaultTemplate.bank2Currency || "",
        footerText: defaultTemplate.footerText || "",
        footerTextAr: defaultTemplate.footerTextAr || "",
        footerTextKu: defaultTemplate.footerTextKu || "",
        termsText: defaultTemplate.termsText || "",
        termsTextAr: defaultTemplate.termsTextAr || "",
        termsTextKu: defaultTemplate.termsTextKu || "",
        showQrCode: defaultTemplate.showQrCode ?? true,
        showWatermark: defaultTemplate.showWatermark ?? false,
        watermarkText: defaultTemplate.watermarkText || "",
        invoicePrefix: defaultTemplate.invoicePrefix || "INV",
        invoiceNumberDigits: defaultTemplate.invoiceNumberDigits || 6,
      });
    } else if (templates?.length === 0) {
      // Create default template if none exists
      ensureDefaultMutation.mutate();
    }
  }, [defaultTemplate, templates]);

  const handleSave = () => {
    setIsSaving(true);
    if (defaultTemplate) {
      updateMutation.mutate({
        id: defaultTemplate.id,
        ...formData,
      });
    } else {
      createMutation.mutate({
        ...formData,
        isDefault: true,
      });
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error(t("auto.text_d874aa"));
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error(t("auto.text_2f43fb"));
      return;
    }

    setIsUploading(true);
    try {
      const buffer = await file.arrayBuffer();
      const response = await fetch('/api/upload-logo', {
        method: 'POST',
        headers: {
          'Content-Type': file.type,
          'X-Filename': file.name,
        },
        body: buffer,
      });
      
      if (response.ok) {
        const { url } = await response.json();
        setFormData(prev => ({ ...prev, logoUrl: url }));
        toast.success(t("auto.text_162193"));
      } else {
        toast.error(t("auto.text_44dad8"));
      }
    } catch (error) {
      toast.error(t("auto.text_44dad8"));
    } finally {
      setIsUploading(false);
    }
  };

  const updateField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              {t("auto.text_9fd3f7")}
            </h1>
            <p className="text-muted-foreground">
              {t("auto.text_fb01f2")}
            </p>
          </div>
          <Button onClick={handleSave} disabled={isSaving} className="gap-2">
            {isSaving ? (
              <><Loader2 className="h-4 w-4 animate-spin" />{t("auto.text_21e623")} </>
            ) : (
              <><Save className="h-4 w-4" />{t("auto.text_234c63")} </>
            )}
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Settings Panel */}
          <div className="lg:col-span-2">
            <Card>
              <CardContent className="pt-6">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="company" className="gap-1">
                      <Building className="h-4 w-4" />
                      <span className="hidden sm:inline">{t("auto.text_42a50d")} </span>
                    </TabsTrigger>
                    <TabsTrigger value="logo" className="gap-1">
                      <Image className="h-4 w-4" />
                      <span className="hidden sm:inline">{t("auto.text_97a8db")} </span>
                    </TabsTrigger>
                    <TabsTrigger value="colors" className="gap-1">
                      <Palette className="h-4 w-4" />
                      <span className="hidden sm:inline">{t("fullPackage.color")}</span>
                    </TabsTrigger>
                    <TabsTrigger value="bank" className="gap-1">
                      <CreditCard className="h-4 w-4" />
                      <span className="hidden sm:inline">{t("finance.bank")}</span>
                    </TabsTrigger>
                    <TabsTrigger value="options" className="gap-1">
                      <Settings className="h-4 w-4" />
                      <span className="hidden sm:inline">{t("common.select")}</span>
                    </TabsTrigger>
                  </TabsList>

                  {/* Company Info Tab */}
                  <TabsContent value="company" className="space-y-4 mt-4">
                    <div className="grid gap-4">
                      <div className="grid gap-2">
                        <Label>{t("auto.text_904d26")} </Label>
                        <Input 
                          value={formData.companyName}
                          onChange={(e) => updateField("companyName", e.target.value)}
                          placeholder="Wazn Express"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label>{t("auto.text_541644")} </Label>
                          <Input 
                            value={formData.companyNameKu}
                            onChange={(e) => updateField("companyNameKu", e.target.value)}
                            placeholder={t("auto.text_6fcd11")}
                            dir="rtl"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>{t("auto.text_4a3c16")} </Label>
                          <Input 
                            value={formData.companyNameAr}
                            onChange={(e) => updateField("companyNameAr", e.target.value)}
                            placeholder={t("auto.text_e85527")}
                            dir="rtl"
                          />
                        </div>
                      </div>
                      
                      <Separator />
                      
                      <div className="grid gap-2">
                        <Label>{t("auto.text_da124e")} </Label>
                        <Textarea 
                          value={formData.companyAddress}
                          onChange={(e) => updateField("companyAddress", e.target.value)}
                          placeholder="Company address..."
                          rows={2}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label>{t("auto.text_25fb66")} </Label>
                          <Textarea 
                            value={formData.companyAddressKu}
                            onChange={(e) => updateField("companyAddressKu", e.target.value)}
                            placeholder={t("auto.text_afaaa6")}
                            rows={2}
                            dir="rtl"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>{t("auto.text_0f8953")} </Label>
                          <Textarea 
                            value={formData.companyAddressAr}
                            onChange={(e) => updateField("companyAddressAr", e.target.value)}
                            placeholder={t("auto.text_ea22c1")}
                            rows={2}
                            dir="rtl"
                          />
                        </div>
                      </div>
                      
                      <Separator />
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label>{t("auto.text_9451a3")} </Label>
                          <Input 
                            value={formData.companyPhone}
                            onChange={(e) => updateField("companyPhone", e.target.value)}
                            placeholder="+964 750 000 0000"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>{t("auto.text_22c30f")} </Label>
                          <Input 
                            value={formData.companyPhone2}
                            onChange={(e) => updateField("companyPhone2", e.target.value)}
                            placeholder="+964 770 000 0000"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label>{t("auto.text_fd1453")} </Label>
                          <Input 
                            type="email"
                            value={formData.companyEmail}
                            onChange={(e) => updateField("companyEmail", e.target.value)}
                            placeholder="info@company.com"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>{t("auto.text_aef166")} </Label>
                          <Input 
                            value={formData.companyWebsite}
                            onChange={(e) => updateField("companyWebsite", e.target.value)}
                            placeholder="www.company.com"
                          />
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  {/* Logo Tab */}
                  <TabsContent value="logo" className="space-y-4 mt-4">
                    <div className="grid gap-4">
                      <div className="grid gap-2">
                        <Label>{t("auto.text_071f43")} </Label>
                        <div className="flex items-center gap-4">
                          {formData.logoUrl ? (
                            <div className="relative">
                              <img 
                                src={formData.logoUrl} 
                                alt="Logo" 
                                className="h-20 w-auto border rounded-lg"
                              />
                              <Button
                                variant="destructive"
                                size="icon"
                                className="absolute -top-2 -right-2 h-6 w-6"
                                onClick={() => updateField("logoUrl", "")}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <div className="h-20 w-32 border-2 border-dashed rounded-lg flex items-center justify-center text-muted-foreground">
                              <Image className="h-8 w-8" />
                            </div>
                          )}
                          <div>
                            <Input
                              type="file"
                              accept="image/*"
                              onChange={handleLogoUpload}
                              className="hidden"
                              id="logo-upload"
                            />
                            <Label htmlFor="logo-upload" className="cursor-pointer">
                              <Button variant="outline" asChild disabled={isUploading}>
                                <span className="gap-2">
                                  {isUploading ? (
                                    <><Loader2 className="h-4 w-4 animate-spin" />{t("auto.text_a282f0")} </>
                                  ) : (
                                    <><Upload className="h-4 w-4" />{t("auto.text_22ea98")} </>
                                  )}
                                </span>
                              </Button>
                            </Label>
                            <p className="text-xs text-muted-foreground mt-1">{t("auto.text_c3db1d")} </p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label>{t("auto.text_19e9f3")} </Label>
                          <Input 
                            type="number"
                            value={formData.logoWidth}
                            onChange={(e) => updateField("logoWidth", parseInt(e.target.value) || 150)}
                            min={50}
                            max={300}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>{t("auto.text_a29b97")} </Label>
                          <Select 
                            value={formData.logoPosition}
                            onValueChange={(v: "left" | "center" | "right") => updateField("logoPosition", v)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="left">{t("auto.text_b207fc")} </SelectItem>
                              <SelectItem value="center">{t("auto.text_0c7f15")} </SelectItem>
                              <SelectItem value="right">{t("auto.text_5224e6")} </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  {/* Colors Tab */}
                  <TabsContent value="colors" className="space-y-4 mt-4">
                    <div className="grid gap-4">
                      <div className="grid gap-2">
                        <Label>{t("auto.text_b1de44")} </Label>
                        <Select 
                          value={formData.style}
                          onValueChange={(v: "modern" | "classic" | "minimal") => updateField("style", v)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="modern">{t("auto.text_d73f10")} </SelectItem>
                            <SelectItem value="classic">{t("auto.text_7553c0")} </SelectItem>
                            <SelectItem value="minimal">{t("auto.text_c15e83")} </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <Separator />
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label>{t("auto.text_bc0c0d")} </Label>
                          <div className="flex gap-2">
                            <Input 
                              type="color"
                              value={formData.primaryColor}
                              onChange={(e) => updateField("primaryColor", e.target.value)}
                              className="w-12 h-10 p-1 cursor-pointer"
                            />
                            <Input 
                              value={formData.primaryColor}
                              onChange={(e) => updateField("primaryColor", e.target.value)}
                              placeholder="#3b82f6"
                            />
                          </div>
                        </div>
                        <div className="grid gap-2">
                          <Label>{t("auto.text_acf0fc")} </Label>
                          <div className="flex gap-2">
                            <Input 
                              type="color"
                              value={formData.secondaryColor}
                              onChange={(e) => updateField("secondaryColor", e.target.value)}
                              className="w-12 h-10 p-1 cursor-pointer"
                            />
                            <Input 
                              value={formData.secondaryColor}
                              onChange={(e) => updateField("secondaryColor", e.target.value)}
                              placeholder="#10b981"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label>{t("auto.text_dc440a")} </Label>
                          <div className="flex gap-2">
                            <Input 
                              type="color"
                              value={formData.accentColor}
                              onChange={(e) => updateField("accentColor", e.target.value)}
                              className="w-12 h-10 p-1 cursor-pointer"
                            />
                            <Input 
                              value={formData.accentColor}
                              onChange={(e) => updateField("accentColor", e.target.value)}
                              placeholder="#f59e0b"
                            />
                          </div>
                        </div>
                        <div className="grid gap-2">
                          <Label>{t("auto.text_83d16e")} </Label>
                          <div className="flex gap-2">
                            <Input 
                              type="color"
                              value={formData.textColor}
                              onChange={(e) => updateField("textColor", e.target.value)}
                              className="w-12 h-10 p-1 cursor-pointer"
                            />
                            <Input 
                              value={formData.textColor}
                              onChange={(e) => updateField("textColor", e.target.value)}
                              placeholder="#1f2937"
                            />
                          </div>
                        </div>
                      </div>
                      
                      <Separator />
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label>{t("auto.text_5ebca1")} </Label>
                          <Select 
                            value={formData.fontFamily}
                            onValueChange={(v) => updateField("fontFamily", v)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Arial">Arial</SelectItem>
                              <SelectItem value="Helvetica">Helvetica</SelectItem>
                              <SelectItem value="Times New Roman">Times New Roman</SelectItem>
                              <SelectItem value="Courier New">Courier New</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label>{t("auto.text_48805d")} </Label>
                          <Input 
                            type="number"
                            value={formData.fontSize}
                            onChange={(e) => updateField("fontSize", parseInt(e.target.value) || 10)}
                            min={8}
                            max={14}
                          />
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  {/* Bank Tab */}
                  <TabsContent value="bank" className="space-y-4 mt-4">
                    <div className="grid gap-4">
                      <h3 className="font-semibold">{t("auto.text_bf255e")} </h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label>{t("auto.text_2c8376")} </Label>
                          <Input 
                            value={formData.bankName}
                            onChange={(e) => updateField("bankName", e.target.value)}
                            placeholder="Bank name"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>{t("auto.text_ea366a")} </Label>
                          <Input 
                            value={formData.bankAccountName}
                            onChange={(e) => updateField("bankAccountName", e.target.value)}
                            placeholder="Account holder name"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label>{t("auto.text_8d4bc7")} </Label>
                          <Input 
                            value={formData.bankAccountNumber}
                            onChange={(e) => updateField("bankAccountNumber", e.target.value)}
                            placeholder="Account number"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>IBAN</Label>
                          <Input 
                            value={formData.bankIban}
                            onChange={(e) => updateField("bankIban", e.target.value)}
                            placeholder="IBAN"
                          />
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label>SWIFT Code</Label>
                        <Input 
                          value={formData.bankSwift}
                          onChange={(e) => updateField("bankSwift", e.target.value)}
                          placeholder="SWIFT/BIC code"
                        />
                      </div>
                      
                      <Separator />
                      
                      <h3 className="font-semibold">{t("auto.text_2fe799")} </h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label>{t("auto.text_2c8376")} </Label>
                          <Input 
                            value={formData.bank2Name}
                            onChange={(e) => updateField("bank2Name", e.target.value)}
                            placeholder="Bank name"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>{t("auto.text_ea366a")} </Label>
                          <Input 
                            value={formData.bank2AccountName}
                            onChange={(e) => updateField("bank2AccountName", e.target.value)}
                            placeholder="Account holder name"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label>{t("auto.text_8d4bc7")} </Label>
                          <Input 
                            value={formData.bank2AccountNumber}
                            onChange={(e) => updateField("bank2AccountNumber", e.target.value)}
                            placeholder="Account number"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>{t("finance.currency")}</Label>
                          <Input 
                            value={formData.bank2Currency}
                            onChange={(e) => updateField("bank2Currency", e.target.value)}
                            placeholder="IQD"
                          />
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  {/* Options Tab */}
                  <TabsContent value="options" className="space-y-4 mt-4">
                    <div className="grid gap-4">
                      <div className="grid gap-2">
                        <Label>{t("auto.text_97f215")} </Label>
                        <Textarea 
                          value={formData.footerText}
                          onChange={(e) => updateField("footerText", e.target.value)}
                          placeholder="Thank you for your business!"
                          rows={2}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label>{t("auto.text_237d56")} </Label>
                          <Textarea 
                            value={formData.footerTextKu}
                            onChange={(e) => updateField("footerTextKu", e.target.value)}
                            placeholder={t("auto.text_081e55")}
                            rows={2}
                            dir="rtl"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>{t("auto.text_12852b")} </Label>
                          <Textarea 
                            value={formData.footerTextAr}
                            onChange={(e) => updateField("footerTextAr", e.target.value)}
                            placeholder={t("auto.text_d1d86a")}
                            rows={2}
                            dir="rtl"
                          />
                        </div>
                      </div>
                      
                      <Separator />
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label>{t("auto.text_814981")} </Label>
                          <Input 
                            value={formData.invoicePrefix}
                            onChange={(e) => updateField("invoicePrefix", e.target.value)}
                            placeholder="INV"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>{t("auto.text_3d8966")} </Label>
                          <Input 
                            type="number"
                            value={formData.invoiceNumberDigits}
                            onChange={(e) => updateField("invoiceNumberDigits", parseInt(e.target.value) || 6)}
                            min={4}
                            max={10}
                          />
                        </div>
                      </div>
                      
                      <Separator />
                      
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <Label>{t("auto.text_85ffc6")} </Label>
                            <p className="text-sm text-muted-foreground">{t("auto.text_09700e")} </p>
                          </div>
                          <Switch 
                            checked={formData.showQrCode}
                            onCheckedChange={(v) => updateField("showQrCode", v)}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <Label>Watermark</Label>
                            <p className="text-sm text-muted-foreground">{t("auto.text_cb8a1e")} </p>
                          </div>
                          <Switch 
                            checked={formData.showWatermark}
                            onCheckedChange={(v) => updateField("showWatermark", v)}
                          />
                        </div>
                        {formData.showWatermark && (
                          <div className="grid gap-2">
                            <Label>{t("auto.text_e20ff2")} </Label>
                            <Input 
                              value={formData.watermarkText}
                              onChange={(e) => updateField("watermarkText", e.target.value)}
                              placeholder="PAID / DRAFT / COPY"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* Preview Panel */}
          <div className="lg:col-span-1">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  {t("auto.text_534d72")}
                </CardTitle>
                <CardDescription>{t("auto.text_17991c")} </CardDescription>
              </CardHeader>
              <CardContent>
                <div 
                  className="border rounded-lg p-4 text-xs space-y-3"
                  style={{ backgroundColor: formData.backgroundColor }}
                >
                  {/* Header */}
                  <div 
                    className={`flex items-center ${
                      formData.logoPosition === 'center' ? 'justify-center' : 
                      formData.logoPosition === 'right' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {formData.logoUrl ? (
                      <img 
                        src={formData.logoUrl} 
                        alt="Logo" 
                        style={{ width: `${formData.logoWidth / 3}px` }}
                      />
                    ) : (
                      <div 
                        className="font-bold text-lg"
                        style={{ color: formData.primaryColor }}
                      >
                        {formData.companyName || "Company Name"}
                      </div>
                    )}
                  </div>
                  
                  {/* Style-specific header bar */}
                  {formData.style === 'modern' && (
                    <div 
                      className="h-1 rounded-full"
                      style={{ backgroundColor: formData.primaryColor }}
                    />
                  )}
                  {formData.style === 'classic' && (
                    <div 
                      className="border-t-2 border-b-2 py-1 text-center"
                      style={{ borderColor: formData.primaryColor, color: formData.textColor }}
                    >
                      INVOICE
                    </div>
                  )}
                  
                  {/* Invoice Info */}
                  <div className="flex justify-between" style={{ color: formData.textColor }}>
                    <div>
                      <div className="font-semibold">Invoice #</div>
                      <div>{formData.invoicePrefix}-000001</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">Date</div>
                      <div>{new Date().toLocaleDateString()}</div>
                    </div>
                  </div>
                  
                  {/* Table Preview */}
                  <div className="border rounded overflow-hidden" style={{ borderColor: formData.primaryColor }}>
                    <div 
                      className="p-1 text-white text-center font-semibold"
                      style={{ backgroundColor: formData.primaryColor }}
                    >
                      Items
                    </div>
                    <div className="p-2 space-y-1" style={{ color: formData.textColor }}>
                      <div className="flex justify-between">
                        <span>Package #1</span>
                        <span>$25.00</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Package #2</span>
                        <span>$30.00</span>
                      </div>
                      <div 
                        className="flex justify-between font-bold border-t pt-1"
                        style={{ borderColor: formData.secondaryColor }}
                      >
                        <span>Total</span>
                        <span style={{ color: formData.accentColor }}>$55.00</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Footer */}
                  <div 
                    className="text-center text-[10px] pt-2 border-t"
                    style={{ color: formData.textColor, borderColor: formData.secondaryColor }}
                  >
                    {formData.footerText || "Thank you for your business!"}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
