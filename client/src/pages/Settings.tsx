// Invoice Template Settings - v2
import DashboardLayout from "@/components/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { Settings as SettingsIcon, Building2, Bell, Globe, Mail, Shield, FileText, DollarSign, RefreshCw, TrendingUp, Palette, Code, Upload, Loader2, LayoutGrid, Sparkles, Users, Plus, Trash2, Tag, Pencil, Check, X } from "lucide-react";
import { Link } from "wouter";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useTranslation } from "@/contexts/LanguageContext";

export default function Settings() {
    const { t } = useTranslation();
const [companyData, setCompanyData] = useState({
    name: "Wazn Express",
    nameKu: "وازن ئێکسپرێس",
    nameAr: "وزن اكسبرس",
    address: "",
    addressKu: "",
    addressAr: "",
    phone: "",
    phone2: "",
    email: "",
    website: "",
    logoUrl: "",
  });
  const [logoUploading, setLogoUploading] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [whatsappNotifications, setWhatsappNotifications] = useState(false);
  const [iqdRate, setIqdRate] = useState("");
  const [rmbRate, setRmbRate] = useState("");

  const utils = trpc.useUtils();
  const { data: settings, refetch } = trpc.settings.list.useQuery();
  const { data: exchangeRates, refetch: refetchRates } = trpc.exchangeRates.list.useQuery();

  useEffect(() => {
    if (settings) {
      const companySetting = settings.find((s: any) => s.settingKey === "company_info");
      if (companySetting?.settingValue) {
        try {
          const parsed = JSON.parse(companySetting.settingValue);
          setCompanyData(prev => ({ ...prev, ...parsed }));
        } catch (e) {
          console.error("Failed to parse company_info:", e);
        }
      }
    }
  }, [settings]);

  // Get current rates
  const currentIqdRate = exchangeRates?.find(r => r.targetCurrency === "IQD");
  const currentRmbRate = exchangeRates?.find(r => r.targetCurrency === "RMB");
  
  const createExchangeRateMutation = trpc.exchangeRates.create.useMutation({
    onSuccess: () => {
      toast.success(t("settings.exchangeRateUpdated") || "Exchange rate updated");
      refetchRates();
      setIqdRate("");
      setRmbRate("");
    },
    onError: (error) => toast.error(error.message)
  });
  
  const handleSaveIqdRate = () => {
    if (!iqdRate) return;
    createExchangeRateMutation.mutate({
      targetCurrency: "IQD",
      rate: iqdRate,
      isManualOverride: true
    });
  };
  
  const handleSaveRmbRate = () => {
    if (!rmbRate) return;
    createExchangeRateMutation.mutate({
      targetCurrency: "RMB",
      rate: rmbRate,
      isManualOverride: true
    });
  };
  
  const updateSettingsMutation = trpc.settings.set.useMutation({
    onSuccess: (_data, variables) => {
      toast.success(t("toast.settingsUpdated"));
      refetch();
      if (variables.key === "company_info") {
        void utils.settings.getCompanyInfo.invalidate();
      }
    },
    onError: (error) => toast.error(error.message)
  });

  const handleSaveCompany = () => {
    updateSettingsMutation.mutate({
      key: "company_info",
      value: JSON.stringify(companyData)
    });
  };

  const logoUploadMutation = trpc.storage.upload.useMutation();

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error(t("settings.logoImageOnly") || "تکایە فایلی وێنە هەڵبژێرە (PNG, JPG, ...)");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error(t("settings.logoSizeLimit") || "قەبارەی فایل نابێت لە ٢ مێگابایت زیاتر بێت");
      return;
    }
    setLogoUploading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          const base64Data = dataUrl.includes(",") ? dataUrl.split(",")[1] : "";
          resolve(base64Data || "");
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      if (!base64) throw new Error("Failed to read file");
      const data = await logoUploadMutation.mutateAsync({
        fileName: file.name,
        contentType: file.type,
        base64Data: base64,
      });
      if (data.success && data.url) {
        setCompanyData((prev) => ({ ...prev, logoUrl: data.url! }));
        toast.success(t("settings.logoUploaded") || "لۆگۆ ئەپلۆد کرا");
      } else {
        const msg = "error" in data ? data.error : (t("settings.logoUploadFailed") || "ئەپلۆدی لۆگۆ سەرنەگەیشت");
        toast.error(msg);
      }
    } catch {
      toast.error(t("settings.logoUploadFailed") || "ئەپلۆدی لۆگۆ سەرنەگەیشت");
    } finally {
      setLogoUploading(false);
      e.target.value = "";
    }
  };

  const handleSaveNotifications = () => {
    updateSettingsMutation.mutate({
      key: "notifications",
      value: JSON.stringify({ email: emailNotifications, whatsapp: whatsappNotifications })
    });
  };

  return (
    <DashboardLayout>
      <div className="pro-page space-y-6">
        <PageHeader
          icon={SettingsIcon}
          title={t("settings.title")}
          subtitle={t("settings.subtitle")}
          variant="solid"
        />

        <Tabs defaultValue="company">
          <TabsList>
            <TabsTrigger value="company" className="gap-2">
              <Building2 className="h-4 w-4" />
              {t("settings.companyInfo")}
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="h-4 w-4" />
              {t("settings.notifications")}
            </TabsTrigger>
            <TabsTrigger value="localization" className="gap-2">
              <Globe className="h-4 w-4" />
              {t("settings.localization") || "Localization"}
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <Shield className="h-4 w-4" />
              {t("settings.security") || "Security"}
            </TabsTrigger>
            <TabsTrigger value="currency" className="gap-2">
              <DollarSign className="h-4 w-4" />
              {t("settings.currency") || "Currency"}
            </TabsTrigger>
            <TabsTrigger value="portal" className="gap-2">
              <Palette className="h-4 w-4" />
              {t("settings.portalThemeTab") || "ڕووکاری پۆرتاڵ"}
            </TabsTrigger>
            <TabsTrigger value="landing" className="gap-2">
              <Palette className="h-4 w-4" />
              {t("settings.landingThemeTab") || "ڕووکاری پەرەی یەکەم"}
            </TabsTrigger>
            <TabsTrigger value="productAttributes" className="gap-2">
              <Tag className="h-4 w-4" />
              زانیاری کاڵا
            </TabsTrigger>
          </TabsList>

          <TabsContent value="company" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>{t("settings.companyInfo")}</CardTitle>
                <CardDescription>
                  ئەم زانیاریانە لە هەموو ڕاپۆرت و ئینڤۆیسەکاندا بەکاردێت
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    ناوی کۆمپانیا
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="grid gap-2">
                      <Label>ئینگلیزی</Label>
                      <Input
                        value={companyData.name}
                        onChange={(e) => setCompanyData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Wazn Express"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>کوردی</Label>
                      <Input
                        value={companyData.nameKu}
                        onChange={(e) => setCompanyData(prev => ({ ...prev, nameKu: e.target.value }))}
                        placeholder="وازن ئێکسپرێس"
                        dir="rtl"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>عەرەبی</Label>
                      <Input
                        value={companyData.nameAr}
                        onChange={(e) => setCompanyData(prev => ({ ...prev, nameAr: e.target.value }))}
                        placeholder="وزن اكسبرس"
                        dir="rtl"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    ناونیشان
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="grid gap-2">
                      <Label>ئینگلیزی</Label>
                      <Input
                        value={companyData.address}
                        onChange={(e) => setCompanyData(prev => ({ ...prev, address: e.target.value }))}
                        placeholder="Company address..."
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>کوردی</Label>
                      <Input
                        value={companyData.addressKu}
                        onChange={(e) => setCompanyData(prev => ({ ...prev, addressKu: e.target.value }))}
                        placeholder="ناونیشانی کۆمپانیا..."
                        dir="rtl"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>عەرەبی</Label>
                      <Input
                        value={companyData.addressAr}
                        onChange={(e) => setCompanyData(prev => ({ ...prev, addressAr: e.target.value }))}
                        placeholder="عنوان الشركة..."
                        dir="rtl"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    زانیاری پەیوەندی
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>ژمارەی مۆبایل ١</Label>
                      <Input
                        value={companyData.phone}
                        onChange={(e) => setCompanyData(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="+964 750 123 4567"
                        dir="ltr"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>ژمارەی مۆبایل ٢</Label>
                      <Input
                        value={companyData.phone2}
                        onChange={(e) => setCompanyData(prev => ({ ...prev, phone2: e.target.value }))}
                        placeholder="+964 770 123 4567"
                        dir="ltr"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>ئیمەیڵ</Label>
                      <Input
                        type="email"
                        value={companyData.email}
                        onChange={(e) => setCompanyData(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="info@wazn.express"
                        dir="ltr"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>وێبسایت</Label>
                      <Input
                        value={companyData.website}
                        onChange={(e) => setCompanyData(prev => ({ ...prev, website: e.target.value }))}
                        placeholder="https://wazn.express"
                        dir="ltr"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    لۆگۆی کۆمپانیا
                  </h3>
                  <div className="grid gap-2">
                    <Label>ئەپلۆدی لۆگۆ</Label>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      id="company-logo-upload"
                      onChange={handleLogoUpload}
                      disabled={logoUploading}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <Label
                        htmlFor="company-logo-upload"
                        className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 border rounded-lg bg-muted hover:bg-muted/80 text-sm font-medium"
                      >
                        {logoUploading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4" />
                        )}
                        {logoUploading ? "چاوەڕوان بە..." : "هەڵبژێرە و ئەپلۆد بکە"}
                      </Label>
                      <span className="text-xs text-muted-foreground">PNG, JPG تا ٢MB</span>
                    </div>
                    {companyData.logoUrl && (
                      <div className="mt-2 p-4 border rounded-lg bg-gray-50 dark:bg-gray-900/50 flex items-center justify-center gap-4">
                        <img
                          src={companyData.logoUrl}
                          alt="Company Logo"
                          className="max-h-20 object-contain"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setCompanyData((prev) => ({ ...prev, logoUrl: "" }))}
                        >
                          {t("common.remove") || "لابردن"}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                <Button onClick={handleSaveCompany} disabled={updateSettingsMutation.isPending} className="w-full">
                  {updateSettingsMutation.isPending ? "چاوەڕوان بە..." : t("common.save")}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {t("settings.invoiceTemplate")}
                </CardTitle>
                <CardDescription>{t("settings.invoiceTemplateDesc") || "Customize invoice design, colors, logo, and company information"}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Design professional invoices with your company branding. Customize colors, add your logo, 
                  and configure bank details for multiple currencies.
                </p>
                <div className="flex gap-2">
                  <Link href="/settings/invoice-template">
                    <Button className="gap-2">
                      <FileText className="h-4 w-4" />
                      {t("settings.openInvoiceEditor") || "Open Invoice Template Editor"}
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Code className="h-5 w-5" />
                  {t("settings.customerCodePrefixes") || "پێشگرەکانی کۆدی کڕیار"}
                </CardTitle>
                <CardDescription>{t("settings.customerCodePrefixesDesc") || "بەڕێوەبردنی پێشگرەکانی کۆدی کڕیار (AZ, WZ, TR)"}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {t("settings.customerCodePrefixesLongDesc") || "دروستکردن و بەڕێوەبردنی پێشگرەکانی کۆدی کڕیار کە بەکاردێن لە کاتی دروستکردنی کڕیاری نوێ."}
                </p>
                <div className="flex gap-2">
                  <Link href="/settings/code-prefixes">
                    <Button className="gap-2">
                      <Code className="h-4 w-4" />
                      {t("settings.manageCodePrefixes") || "بەڕێوەبردنی پێشگرەکان"}
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  {t("settings.currencyManagement") || "ڕێکخستنی دراو"}
                </CardTitle>
                <CardDescription>{t("settings.currencyManagementDesc") || "بەڕێوەبردنی دراوەکان و نرخی ئاڵووگۆڕ"}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  بەڕێوەبردنی هەموو دراوەکان، نرخی ئاڵووگۆڕ، و دیاریکردنی دراوی بنەڕەت بۆ سیستەم.
                </p>
                <div className="flex gap-2">
                  <Link href="/settings/currencies">
                    <Button className="gap-2">
                      <DollarSign className="h-4 w-4" />
                      {t("settings.manageCurrencies") || "بەڕێوەبردنی دراوەکان"}
                    </Button>
                  </Link>
                  <Link href="/settings/tax-rates">
                    <Button variant="outline" className="gap-2">
                      <TrendingUp className="h-4 w-4" />
                      {t("settings.manageTaxRates") || "بەڕێوەبردنی نرخی باج"}
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  {t("settings.emailTemplates") || "قاڵبەکانی ئیمەیڵ"}
                </CardTitle>
                <CardDescription>{t("settings.emailTemplatesDesc") || "بەڕێوەبردنی قاڵبەکانی ئیمەیڵ بۆ ئۆتۆماتیکی"}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  دروستکردن و دەستکاریکردنی قاڵبەکانی ئیمەیڵ بۆ ئاگادارکردنەوە، وەسڵ، و ڕاپۆرتەکان.
                </p>
                <div className="flex gap-2">
                  <Link href="/settings/email-templates">
                    <Button className="gap-2">
                      <Mail className="h-4 w-4" />
                      {t("settings.manageEmailTemplates") || "بەڕێوەبردنی قاڵبەکان"}
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  {t("settings.advancedSettings") || "ڕێکخستنە پێشکەوتووەکان"}
                </CardTitle>
                <CardDescription>{t("settings.advancedSettingsDesc") || "ڕێکخستنەکانی کاروبار، ئاسایش و ئەزموونی بەکارهێنەر"}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  دەستگەیشتن بە ڕێکخستنە پێشکەوتووەکان بۆ کاروبار، ئاسایش، IP whitelist، و زیاتر.
                </p>
                <div className="flex gap-2">
                  <Link href="/settings/advanced">
                    <Button className="gap-2">
                      <SettingsIcon className="h-4 w-4" />
                      {t("settings.openAdvancedSettings") || "کردنەوەی ڕێکخستنە پێشکەوتووەکان"}
                    </Button>
                  </Link>
                  <Link href="/settings/ip-whitelist">
                    <Button variant="outline" className="gap-2">
                      <Shield className="h-4 w-4" />
                      {t("settings.ipWhitelist") || "لیستی سپی IP"}
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>{t("settings.emailNotifications")}</CardTitle>
                <CardDescription>{t("settings.emailNotificationsDesc") || "Configure email notifications for customers and staff"}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{t("settings.enableEmailNotifications") || "Enable Email Notifications"}</p>
                    <p className="text-sm text-muted-foreground">{t("settings.enableEmailNotificationsDesc") || "Send emails for package updates, invoices, etc."}</p>
                  </div>
                  <Switch 
                    checked={emailNotifications} 
                    onCheckedChange={setEmailNotifications}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{t("settings.welcomeEmail") || "New Customer Welcome Email"}</p>
                    <p className="text-sm text-muted-foreground">{t("settings.welcomeEmailDesc") || "Send welcome email with login credentials"}</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{t("settings.packageStatusUpdates") || "Package Status Updates"}</p>
                    <p className="text-sm text-muted-foreground">{t("settings.packageStatusUpdatesDesc") || "Notify customers of status changes"}</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{t("settings.invoicePaymentNotifications") || "Invoice & Payment Notifications"}</p>
                    <p className="text-sm text-muted-foreground">{t("settings.invoicePaymentNotificationsDesc") || "Send invoices and payment confirmations"}</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("settings.smsNotifications")}</CardTitle>
                <CardDescription>{t("settings.smsNotificationsDesc") || "Configure SMS notifications for customers"}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{t("settings.enableSmsNotifications") || "Enable SMS Notifications"}</p>
                    <p className="text-sm text-muted-foreground">{t("settings.enableSmsNotificationsDesc") || "Send SMS for package updates and alerts"}</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{t("settings.packageStatusSms") || "Package Status SMS"}</p>
                    <p className="text-sm text-muted-foreground">{t("settings.packageStatusSmsDesc") || "Notify customers via SMS when status changes"}</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{t("settings.deliveryAlertSms") || "Delivery Alert SMS"}</p>
                    <p className="text-sm text-muted-foreground">{t("settings.deliveryAlertSmsDesc") || "Send SMS when package is out for delivery"}</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                  <p className="font-medium">SMS Provider Configuration</p>
                  <p className="mt-1">SMS notifications are sent to customer mobile numbers. Configure SMS provider in system settings for production use.</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("settings.whatsappIntegration") || "WhatsApp Integration"}</CardTitle>
                <CardDescription>{t("settings.whatsappIntegrationDesc") || "Optional WhatsApp notifications (requires setup)"}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{t("settings.enableWhatsappNotifications") || "Enable WhatsApp Notifications"}</p>
                    <p className="text-sm text-muted-foreground">{t("settings.enableWhatsappNotificationsDesc") || "Send notifications via WhatsApp Business API"}</p>
                  </div>
                  <Switch 
                    checked={whatsappNotifications} 
                    onCheckedChange={setWhatsappNotifications}
                  />
                </div>
                {whatsappNotifications && (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                    <p className="font-medium">WhatsApp Business API Required</p>
                    <p className="mt-1">Contact support to configure WhatsApp integration.</p>
                  </div>
                )}
                <Button onClick={handleSaveNotifications} disabled={updateSettingsMutation.isPending}>
                  {t("settings.saveNotificationSettings") || "Save Notification Settings"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="localization" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>{t("settings.languageSettings") || "Language Settings"}</CardTitle>
                <CardDescription>{t("settings.languageSettingsDesc") || "Configure supported languages for the system"}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">🇬🇧</span>
                      <div>
                        <p className="font-medium">English</p>
                        <p className="text-xs text-muted-foreground">LTR</p>
                      </div>
                    </div>
                    <Switch defaultChecked disabled />
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">🇮🇶</span>
                      <div>
                        <p className="font-medium">Kurdish Sorani</p>
                        <p className="text-xs text-muted-foreground">RTL</p>
                      </div>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">🇸🇦</span>
                      <div>
                        <p className="font-medium">Arabic</p>
                        <p className="text-xs text-muted-foreground">RTL</p>
                      </div>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">🇨🇳</span>
                      <div>
                        <p className="font-medium">Chinese</p>
                        <p className="text-xs text-muted-foreground">LTR</p>
                      </div>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">🇹🇷</span>
                      <div>
                        <p className="font-medium">Turkish</p>
                        <p className="text-xs text-muted-foreground">LTR</p>
                      </div>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">🇮🇷</span>
                      <div>
                        <p className="font-medium">Persian (Farsi)</p>
                        <p className="text-xs text-muted-foreground">RTL</p>
                      </div>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("settings.currencySettings") || "Currency Settings"}</CardTitle>
                <CardDescription>{t("settings.currencySettingsDesc") || "Configure supported currencies for transactions"}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">USD - US Dollar</p>
                      <p className="text-xs text-muted-foreground">Primary currency</p>
                    </div>
                    <Switch defaultChecked disabled />
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">IQD - Iraqi Dinar</p>
                      <p className="text-xs text-muted-foreground">Local currency</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">RMB - Chinese Yuan</p>
                      <p className="text-xs text-muted-foreground">China operations</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>{t("settings.securitySettings") || "Security Settings"}</CardTitle>
                <CardDescription>{t("settings.securitySettingsDesc") || "Configure security and access controls"}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{t("settings.twoFactorAuth") || "Two-Factor Authentication"}</p>
                    <p className="text-sm text-muted-foreground">{t("settings.twoFactorAuthDesc") || "Require 2FA for admin accounts"}</p>
                  </div>
                  <Switch />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{t("settings.sessionTimeout") || "Session Timeout"}</p>
                    <p className="text-sm text-muted-foreground">{t("settings.sessionTimeoutDesc") || "Auto-logout after inactivity"}</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{t("settings.ipWhitelisting") || "IP Whitelisting"}</p>
                    <p className="text-sm text-muted-foreground">{t("settings.ipWhitelistingDesc") || "Restrict access to specific IPs"}</p>
                  </div>
                  <Switch />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("settings.auditSettings") || "Audit Settings"}</CardTitle>
                <CardDescription>{t("settings.auditSettingsDesc") || "Configure audit logging behavior"}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{t("settings.logAllActions") || "Log All Actions"}</p>
                    <p className="text-sm text-muted-foreground">{t("settings.logAllActionsDesc") || "Record all user actions in audit log"}</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{t("settings.logFinancialActions") || "Log Financial Actions"}</p>
                    <p className="text-sm text-muted-foreground">{t("settings.logFinancialActionsDesc") || "Detailed logging for payments and invoices"}</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="retentionDays">{t("settings.logRetention") || "Log Retention (days)"}</Label>
                  <Input id="retentionDays" type="number" defaultValue="365" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="currency" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-600" />
                  {t("settings.exchangeRates") || "Exchange Rates"}
                </CardTitle>
                <CardDescription>
                  {t("settings.exchangeRatesDesc") || "Set exchange rates for USD to IQD and RMB conversions"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* USD to IQD */}
                <div className="p-4 border rounded-lg bg-gradient-to-r from-green-50 to-emerald-50">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                      <span className="text-lg">🇺🇸</span>
                    </div>
                    <TrendingUp className="h-5 w-5 text-muted-foreground" />
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                      <span className="text-lg">🇮🇶</span>
                    </div>
                    <div>
                      <p className="font-semibold">USD → IQD</p>
                      <p className="text-sm text-muted-foreground">
                        {t("settings.usdToIqd") || "US Dollar to Iraqi Dinar"}
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-muted-foreground">
                        {t("settings.currentRate") || "Current Rate"}
                      </Label>
                      <p className="text-2xl font-bold text-green-700">
                        {currentIqdRate ? `1 USD = ${Number(currentIqdRate.rate).toLocaleString()} IQD` : "Not set"}
                      </p>
                      {currentIqdRate && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {t("settings.lastUpdated") || "Last updated"}: {new Date(currentIqdRate.createdAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="iqdRate">{t("settings.newRate") || "New Rate"}</Label>
                      <div className="flex gap-2">
                        <Input
                          id="iqdRate"
                          type="number"
                          placeholder="1480"
                          value={iqdRate}
                          onChange={(e) => setIqdRate(e.target.value)}
                        />
                        <Button 
                          onClick={handleSaveIqdRate}
                          disabled={!iqdRate || createExchangeRateMutation.isPending}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* USD to RMB */}
                <div className="p-4 border rounded-lg bg-gradient-to-r from-red-50 to-orange-50">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                      <span className="text-lg">🇺🇸</span>
                    </div>
                    <TrendingUp className="h-5 w-5 text-muted-foreground" />
                    <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                      <span className="text-lg">🇨🇳</span>
                    </div>
                    <div>
                      <p className="font-semibold">USD → RMB</p>
                      <p className="text-sm text-muted-foreground">
                        {t("settings.usdToRmb") || "US Dollar to Chinese Yuan"}
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-muted-foreground">
                        {t("settings.currentRate") || "Current Rate"}
                      </Label>
                      <p className="text-2xl font-bold text-red-700">
                        {currentRmbRate ? `1 USD = ${Number(currentRmbRate.rate).toFixed(2)} RMB` : "Not set"}
                      </p>
                      {currentRmbRate && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {t("settings.lastUpdated") || "Last updated"}: {new Date(currentRmbRate.createdAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rmbRate">{t("settings.newRate") || "New Rate"}</Label>
                      <div className="flex gap-2">
                        <Input
                          id="rmbRate"
                          type="number"
                          step="0.01"
                          placeholder="7.25"
                          value={rmbRate}
                          onChange={(e) => setRmbRate(e.target.value)}
                        />
                        <Button 
                          onClick={handleSaveRmbRate}
                          disabled={!rmbRate || createExchangeRateMutation.isPending}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Info box */}
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>{t("settings.note") || "Note"}:</strong> {t("settings.exchangeRateNote") || "Exchange rates are used to display prices in multiple currencies throughout the system. The primary currency is USD."}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Exchange Rate History */}
            <Card>
              <CardHeader>
                <CardTitle>{t("settings.rateHistory") || "Rate History"}</CardTitle>
                <CardDescription>
                  {t("settings.rateHistoryDesc") || "Recent exchange rate changes"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {exchangeRates && exchangeRates.length > 0 ? (
                    exchangeRates.slice(0, 10).map((rate) => (
                      <div key={rate.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{rate.targetCurrency === "IQD" ? "🇮🇶" : "🇨🇳"}</span>
                          <div>
                            <p className="font-medium">USD → {rate.targetCurrency}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(rate.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">{Number(rate.rate).toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">
                            {rate.source === "manual" ? t("settings.manual") || "Manual" : t("settings.api") || "API"}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-muted-foreground py-4">
                      {t("settings.noRatesYet") || "No exchange rates set yet"}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="portal" className="space-y-4 mt-4">
            <PortalThemeSettings />
          </TabsContent>
          <TabsContent value="landing" className="space-y-4 mt-4">
            <LandingPageVariantSettings />
            <LandingWebsiteContentSettings />
            <LandingThemeSettings />
            <LandingTeamSettings />
          </TabsContent>
          <TabsContent value="productAttributes" className="space-y-4 mt-4">
            <ProductAttributesSettings />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

// ============ Product Attributes Settings ============
function ProductAttributesSettings() {
  const utils = trpc.useUtils();
  const { data: allAttrs, isLoading } = trpc.productAttributes.list.useQuery();

  const createMutation = trpc.productAttributes.create.useMutation({
    onSuccess: () => {
      toast.success("زیادکرا");
      utils.productAttributes.list.invalidate();
      setNewValue("");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.productAttributes.update.useMutation({
    onSuccess: () => {
      toast.success("نوێکرایەوە");
      utils.productAttributes.list.invalidate();
      setEditingId(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.productAttributes.delete.useMutation({
    onSuccess: () => {
      toast.success("سڕایەوە");
      utils.productAttributes.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const [newValue, setNewValue] = useState("");
  const [activeType, setActiveType] = useState<"color" | "size" | "productType">("color");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");

  const typeLabels: Record<string, string> = {
    color: "ڕەنگ",
    size: "قەبارە",
    productType: "جۆری کاڵا",
  };

  const typeIcons: Record<string, string> = {
    color: "🎨",
    size: "📐",
    productType: "📦",
  };

  const filtered = allAttrs?.filter(a => a.type === activeType) ?? [];

  const handleAdd = () => {
    if (!newValue.trim()) return;
    createMutation.mutate({ type: activeType, value: newValue.trim(), sortOrder: filtered.length });
  };

  const handleEdit = (id: number, val: string) => {
    setEditingId(id);
    setEditingValue(val);
  };

  const handleSaveEdit = (id: number) => {
    if (!editingValue.trim()) return;
    updateMutation.mutate({ id, value: editingValue.trim() });
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-l from-violet-50 to-purple-50 border-b">
        <CardTitle className="flex items-center gap-2">
          <Tag className="h-5 w-5 text-violet-600" />
          زانیاری کاڵا
        </CardTitle>
        <CardDescription>ڕەنگ، قەبارە و جۆری کاڵا بەڕێوە ببە — لە کاتی دروستکردنی ئۆردەر نیشان دەدرێن</CardDescription>
      </CardHeader>
      <CardContent className="p-6 space-y-6">

        {/* Type Selector */}
        <div className="flex gap-3">
          {(["color", "size", "productType"] as const).map(type => (
            <button
              key={type}
              type="button"
              onClick={() => { setActiveType(type); setNewValue(""); setEditingId(null); }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 font-bold text-sm transition-all ${
                activeType === type
                  ? "border-violet-400 bg-violet-50 text-violet-700 shadow-sm"
                  : "border-gray-200 bg-white text-gray-600 hover:border-violet-200"
              }`}
            >
              <span>{typeIcons[type]}</span>
              {typeLabels[type]}
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-mono ${activeType === type ? "bg-violet-100 text-violet-600" : "bg-gray-100 text-gray-500"}`}>
                {allAttrs?.filter(a => a.type === type).length ?? 0}
              </span>
            </button>
          ))}
        </div>

        {/* Add New */}
        <div className="flex gap-3">
          <Input
            value={newValue}
            onChange={e => setNewValue(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAdd()}
            placeholder={`${typeLabels[activeType]}ێکی نوێ...`}
            className="flex-1 h-11"
          />
          <Button
            type="button"
            onClick={handleAdd}
            disabled={!newValue.trim() || createMutation.isPending}
            className="bg-violet-600 hover:bg-violet-700 h-11 px-5"
          >
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            زیادکردن
          </Button>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-violet-500" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <span className="text-4xl">{typeIcons[activeType]}</span>
            <p className="mt-3 font-medium">هیچ {typeLabels[activeType]}ێک نییە</p>
            <p className="text-sm mt-1">بە فۆرمی سەرەوە زیادی بکە</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(attr => (
              <div
                key={attr.id}
                className="flex items-center gap-3 bg-gray-50 hover:bg-violet-50/40 border border-gray-200 hover:border-violet-200 rounded-xl px-4 py-3 transition-colors group"
              >
                <span className="text-lg">{typeIcons[attr.type]}</span>

                {editingId === attr.id ? (
                  <>
                    <Input
                      value={editingValue}
                      onChange={e => setEditingValue(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") handleSaveEdit(attr.id); if (e.key === "Escape") setEditingId(null); }}
                      className="flex-1 h-9"
                      autoFocus
                    />
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600 hover:bg-green-50"
                      onClick={() => handleSaveEdit(attr.id)} disabled={updateMutation.isPending}>
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-400 hover:bg-gray-100"
                      onClick={() => setEditingId(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 font-medium text-gray-800">{attr.value}</span>
                    <Button size="icon" variant="ghost"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 text-violet-500 hover:bg-violet-100 transition-opacity"
                      onClick={() => handleEdit(attr.id, attr.value)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 text-red-400 hover:bg-red-50 transition-opacity"
                      onClick={() => deleteMutation.mutate({ id: attr.id })}
                      disabled={deleteMutation.isPending}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Landing page variant (Classic vs Minimal)
function LandingPageVariantSettings() {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const { data: currentVariant } = trpc.public.getLandingPageVariant.useQuery();
  const updateMutation = trpc.settings.set.useMutation({
    onSuccess: () => {
      toast.success(t("toast.settingsUpdated"));
      void utils.public.getLandingPageVariant.invalidate();
      window.location.reload();
    },
    onError: (error) => toast.error(error.message)
  });

  const variants = [
    { id: "classic", name: t("settings.landingVariantClassic") || "پەرەی پڕ (کلاسیک)", nameEn: "Classic", description: t("settings.landingVariantClassicDesc") || "هەموو بەشەکان - ئامار، خزمەتگوزاری، تایبەتمەندی، پەیوەندی", icon: LayoutGrid },
    { id: "minimal", name: t("settings.landingVariantMinimal") || "پەرەی مینیماڵ", nameEn: "Minimal", description: t("settings.landingVariantMinimalDesc") || "پەرەی سادە و پرۆفیشناڵ - تراکینگ و دووگمەکانی سەرەکی", icon: Sparkles },
    { id: "professional", name: t("settings.landingVariantProfessional") || "پەرەی پڕۆفیشناڵ", nameEn: "Professional", description: t("settings.landingVariantProfessionalDesc") || "ڕووکارێکی ڕووناکی editorial بە ڕەنگی ئەمبەر - تایپی گەورە، bento، و بۆشایی زۆر", icon: Building2 }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LayoutGrid className="h-5 w-5" />
          {t("settings.landingPageVariantTitle") || "جۆری پەرەی سەرەکی"}
        </CardTitle>
        <CardDescription>
          {t("settings.landingPageVariantDesc") || "هەڵبژاردنی پەرەی لاندینگ - کلاسیک (پڕ) یان مینیماڵ (سادە)"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {variants.map((v) => {
            const Icon = v.icon;
            return (
              <div
                key={v.id}
                onClick={() => updateMutation.mutate({ key: "landingPageVariant", value: v.id })}
                className={`relative cursor-pointer rounded-xl border-2 transition-all duration-300 overflow-hidden ${
                  currentVariant === v.id ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/50"
                }`}
              >
                <div className="p-5 flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                    <Icon className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{v.name}</h3>
                    <span className="text-sm text-muted-foreground">{v.nameEn}</span>
                    <p className="text-sm text-muted-foreground mt-1">{v.description}</p>
                  </div>
                </div>
                {currentVariant === v.id && (
                  <div className="absolute top-3 left-3 bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full font-medium">
                    {t("settings.active") || "فعاڵ"}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {updateMutation.isPending && (
          <div className="mt-4 flex items-center justify-center gap-2 text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>{t("settings.applying") || "چاوەڕوان بە..."}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Website content (hero, about, social) — shown on landing page
function LandingWebsiteContentSettings() {
  const { t } = useTranslation();
  const { data: siteInfo = {}, refetch } = trpc.settings.getPublicWebsiteInfo.useQuery();
  const setMutation = trpc.settings.set.useMutation({
    onSuccess: () => { toast.success(t("toast.settingsUpdated")); refetch(); },
    onError: (e) => toast.error(e.message)
  });
  const [form, setForm] = useState({
    website_hero_title: "",
    website_hero_title_ku: "",
    website_hero_subtitle: "",
    website_hero_subtitle_ku: "",
    website_about: "",
    website_about_ku: "",
    social_facebook: "",
    social_instagram: "",
    social_whatsapp: "",
    social_tiktok: "",
    social_telegram: "",
  });

  useEffect(() => {
    if (typeof siteInfo === "object" && siteInfo !== null) {
      const s = siteInfo as Record<string, string>;
      setForm(prev => ({
        ...prev,
        website_hero_title: s.website_hero_title ?? "",
        website_hero_title_ku: s.website_hero_title_ku ?? "",
        website_hero_subtitle: s.website_hero_subtitle ?? "",
        website_hero_subtitle_ku: s.website_hero_subtitle_ku ?? "",
        website_about: s.website_about ?? "",
        website_about_ku: s.website_about_ku ?? "",
        social_facebook: s.social_facebook ?? "",
        social_instagram: s.social_instagram ?? "",
        social_whatsapp: s.social_whatsapp ?? "",
        social_tiktok: s.social_tiktok ?? "",
        social_telegram: s.social_telegram ?? "",
      }));
    }
  }, [siteInfo]);

  const handleSave = async () => {
    const keys = Object.keys(form) as (keyof typeof form)[];
    for (const key of keys) {
      await setMutation.mutateAsync({ key, value: form[key] || "" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          {t("settings.websiteContentTitle") || "ناوەڕۆکی پەرەی سەرەکی"}
        </CardTitle>
        <CardDescription>
          {t("settings.websiteContentDesc") || "سەردێری هێڵۆ، دەربارەی کۆمپانیا، و لینکە سۆشیالەکان لە پەرەی لاندینگ دەردەکەون"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4">
          <Label>{t("settings.heroTitle") || "سەردێری هێڵۆ"}</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input value={form.website_hero_title} onChange={(e) => setForm(f => ({ ...f, website_hero_title: e.target.value }))} placeholder="Wazn Express (EN)" />
            <Input value={form.website_hero_title_ku} onChange={(e) => setForm(f => ({ ...f, website_hero_title_ku: e.target.value }))} placeholder="وازن ئێکسپرێس (کوردی)" dir="rtl" />
          </div>
        </div>
        <div className="grid gap-4">
          <Label>{t("settings.heroSubtitle") || "ژێرسەردێر"}</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input value={form.website_hero_subtitle} onChange={(e) => setForm(f => ({ ...f, website_hero_subtitle: e.target.value }))} placeholder="Fast and reliable shipping (EN)" />
            <Input value={form.website_hero_subtitle_ku} onChange={(e) => setForm(f => ({ ...f, website_hero_subtitle_ku: e.target.value }))} placeholder="گواستنەوەی خێرا و متمانەپێکراو (کوردی)" dir="rtl" />
          </div>
        </div>
        <div className="grid gap-4">
          <Label>{t("settings.aboutText") || "دەربارەی کۆمپانیا"}</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <textarea className="flex min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.website_about} onChange={(e) => setForm(f => ({ ...f, website_about: e.target.value }))} placeholder="About company (EN)" />
            <textarea className="flex min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.website_about_ku} onChange={(e) => setForm(f => ({ ...f, website_about_ku: e.target.value }))} placeholder="دەربارەی کۆمپانیا (کوردی)" dir="rtl" />
          </div>
        </div>
        <div className="grid gap-4">
          <Label>{t("settings.socialLinks") || "لینکە سۆشیالەکان"}</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input value={form.social_facebook} onChange={(e) => setForm(f => ({ ...f, social_facebook: e.target.value }))} placeholder="https://facebook.com/..." dir="ltr" />
            <Input value={form.social_instagram} onChange={(e) => setForm(f => ({ ...f, social_instagram: e.target.value }))} placeholder="https://instagram.com/..." dir="ltr" />
            <Input value={form.social_whatsapp} onChange={(e) => setForm(f => ({ ...f, social_whatsapp: e.target.value }))} placeholder="+9647501234567 or https://wa.me/..." dir="ltr" />
            <Input value={form.social_tiktok} onChange={(e) => setForm(f => ({ ...f, social_tiktok: e.target.value }))} placeholder="https://tiktok.com/..." dir="ltr" />
            <Input value={form.social_telegram} onChange={(e) => setForm(f => ({ ...f, social_telegram: e.target.value }))} placeholder="https://t.me/..." dir="ltr" />
          </div>
        </div>
        <Button onClick={handleSave} disabled={setMutation.isPending}>
          {setMutation.isPending ? (t("settings.saving") || "چاوەڕوان بە...") : t("settings.saveChanges")}
        </Button>
      </CardContent>
    </Card>
  );
}

// Landing team (for "Our Team" section on landing page)
function LandingTeamSettings() {
  const { t } = useTranslation();
  const { data: team = [], refetch } = trpc.public.getLandingTeam.useQuery();
  const updateMutation = trpc.settings.set.useMutation({
    onSuccess: () => { toast.success(t("toast.settingsUpdated")); refetch(); },
    onError: (error) => toast.error(error.message)
  });
  const [editing, setEditing] = useState<{ name: string; role: string; description: string; imageUrl: string }[]>([]);
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newImage, setNewImage] = useState("");

  useEffect(() => {
    setEditing(team.map((m: { name: string; role: string; description: string; imageUrl: string | null }) => ({
      name: m.name,
      role: m.role,
      description: m.description,
      imageUrl: m.imageUrl || ""
    })));
  }, [team]);

  const handleSave = () => {
    const list = editing.map((e, i) => ({ id: `m-${i}`, name: e.name, role: e.role, description: e.description, imageUrl: e.imageUrl || undefined, order: i }));
    updateMutation.mutate({ key: "landingTeamMembers", value: JSON.stringify(list) });
  };

  const handleAdd = () => {
    if (!newName.trim()) return;
    const next = [...editing, { name: newName.trim(), role: newRole.trim(), description: newDesc.trim(), imageUrl: newImage.trim() }];
    setEditing(next);
    setNewName(""); setNewRole(""); setNewDesc(""); setNewImage("");
    updateMutation.mutate({ key: "landingTeamMembers", value: JSON.stringify(next.map((e, i) => ({ id: `m-${i}`, ...e, order: i }))) });
  };

  const handleRemove = (index: number) => {
    const next = editing.filter((_, i) => i !== index);
    setEditing(next);
    updateMutation.mutate({ key: "landingTeamMembers", value: JSON.stringify(next.map((e, i) => ({ id: `m-${i}`, ...e, order: i }))) });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          {t("settings.landingTeamTitle") || "ستاف/تیمی پەرەی سەرەکی"}
        </CardTitle>
        <CardDescription>
          {t("settings.landingTeamDesc") || "ئەم کەسانە لە بەشی «تیمی ئێمە» لە پەرەی لاندینگ نیشان دەدرێن"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {editing.map((m, i) => (
          <div key={i} className="flex items-start gap-4 p-4 border rounded-lg">
            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2">
              <Input value={m.name} onChange={(e) => setEditing(editing.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} placeholder={t("settings.teamMemberName") || "ناو"} />
              <Input value={m.role} onChange={(e) => setEditing(editing.map((x, j) => j === i ? { ...x, role: e.target.value } : x))} placeholder={t("settings.teamMemberRole") || "ڕۆڵ/ناونیشان"} />
              <Input value={m.imageUrl} onChange={(e) => setEditing(editing.map((x, j) => j === i ? { ...x, imageUrl: e.target.value } : x))} placeholder={t("settings.teamMemberImageUrl") || "URL وێنە (ئەگەر هەبێت)"} />
              <Input className="md:col-span-3" value={m.description} onChange={(e) => setEditing(editing.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} placeholder={t("settings.teamMemberDescription") || "دیسکڕیپشن"} />
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={() => handleRemove(i)} className="text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2 pt-2">
          <Input className="max-w-[180px]" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t("settings.teamMemberName") || "ناو"} />
          <Input className="max-w-[180px]" value={newRole} onChange={(e) => setNewRole(e.target.value)} placeholder={t("settings.teamMemberRole") || "ڕۆڵ"} />
          <Input className="max-w-[200px]" value={newImage} onChange={(e) => setNewImage(e.target.value)} placeholder="URL وێنە" />
          <Input className="min-w-[200px] flex-1" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder={t("settings.teamMemberDescription") || "دیسکڕیپشن"} />
          <Button type="button" size="sm" onClick={handleAdd} disabled={!newName.trim() || updateMutation.isPending}>
            <Plus className="h-4 w-4 me-1" />
            {t("settings.add") || "زیادکردن"}
          </Button>
        </div>
        {editing.length > 0 && (
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            {t("settings.saveChanges")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// Landing (first) page theme settings
function LandingThemeSettings() {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const { data: currentTheme, isLoading } = trpc.public.getLandingTheme.useQuery();
  const updateThemeMutation = trpc.settings.set.useMutation({
    onSuccess: () => {
      toast.success(t("toast.themeChangedSuccessfully"));
      void utils.public.getLandingTheme.invalidate();
      window.location.reload();
    },
    onError: (error) => toast.error(error.message)
  });

  const handleThemeChange = (theme: string) => {
    updateThemeMutation.mutate({ key: "landingTheme", value: theme });
  };

  const themes = [
    { id: "dark", name: t("settings.landingThemeDark") || "تاریک", nameEn: "Dark", description: t("settings.landingThemeDarkDesc") || "ڕووکاری ئێستا - پسپۆڕی تاریک", preview: "bg-[#0f172a]", accent: "from-amber-500 to-orange-500" },
    { id: "light", name: t("settings.landingThemeLight") || "ڕووناک", nameEn: "Light", description: t("settings.landingThemeLightDesc") || "پسپۆڕی ڕووناک - گونجاو بۆ ڕۆژ", preview: "bg-slate-50", accent: "from-amber-600 to-orange-600" },
    { id: "ocean", name: t("settings.landingThemeOcean") || "ئۆشن", nameEn: "Ocean", description: t("settings.landingThemeOceanDesc") || "شین/تەڵاو - گونجاو بۆ لۆژستیک", preview: "bg-[#0c4a6e]", accent: "from-sky-400 to-cyan-500" }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          {t("settings.landingThemeTitle") || "ڕووکاری پەرەی یەکەم (لاندینگ)"}
        </CardTitle>
        <CardDescription>
          {t("settings.landingThemeDesc") || "هەڵبژاردنی ڕووکار بۆ پەرەی سەرەکی ویبسایت - ئەم ڕووکارە بۆ هەموو سەردانکەران دەردەکەوێت"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {themes.map((theme) => (
            <div
              key={theme.id}
              onClick={() => handleThemeChange(theme.id)}
              className={`relative cursor-pointer rounded-xl border-2 transition-all duration-300 overflow-hidden ${
                currentTheme === theme.id ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/50"
              }`}
            >
              <div className={`h-32 ${theme.preview} p-4 relative`}>
                <div className="absolute bottom-3 left-3 right-3">
                  <div className={`h-10 rounded-xl bg-gradient-to-r ${theme.accent} opacity-80`} />
                </div>
                {currentTheme === theme.id && (
                  <div className="absolute top-3 left-3 bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full font-medium">
                    {t("settings.active") || "فعاڵ"}
                  </div>
                )}
              </div>
              <div className="p-4 bg-card">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-bold text-lg">{theme.name}</h3>
                  <span className="text-sm text-muted-foreground">{theme.nameEn}</span>
                </div>
                <p className="text-sm text-muted-foreground">{theme.description}</p>
              </div>
            </div>
          ))}
        </div>
        {updateThemeMutation.isPending && (
          <div className="mt-4 flex items-center justify-center gap-2 text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>{t("settings.applying") || "چاوەڕوان بە..."}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Portal Theme Settings Component
function PortalThemeSettings() {
  const { t } = useTranslation();
  const { data: currentTheme, isLoading } = trpc.public.getPortalTheme.useQuery();
  const updateThemeMutation = trpc.settings.set.useMutation({
    onSuccess: () => {
      toast.success(t("toast.themeChangedSuccessfully"));
      window.location.reload(); // Reload to apply theme
    },
    onError: (error) => toast.error(error.message)
  });

  const handleThemeChange = (theme: string) => {
    updateThemeMutation.mutate({
      key: "portalTheme",
      value: theme
    });
  };

  const themes = [
    {
      id: "classic",
      name: "کلاسیک",
      nameEn: "Classic",
      description: "ڕووکاری ئێستا - دیزاینێکی سادە و ئاسان",
      preview: "bg-gradient-to-br from-slate-900 to-slate-800",
      accent: "from-emerald-500 to-teal-600"
    },
    {
      id: "modern",
      name: "مۆدێرن",
      nameEn: "Modern",
      description: "ڕووکارێکی نوێ و پڕۆفیشناڵ - بە ئەنیمەیشن و دیزاینی سەرنجڕاکێش",
      preview: "bg-gradient-to-br from-violet-950 to-slate-950",
      accent: "from-violet-500 to-purple-600"
    },
    {
      id: "skin3",
      name: "نیۆبروتاڵیست",
      nameEn: "Neobrutalist",
      description: "دیزاینێکی تایبەت و جوان - بە بۆردەری ئەستوور و شادۆی بۆڵد و ڕەنگی ئینیدگۆ",
      preview: "bg-gradient-to-br from-amber-50 to-indigo-100",
      accent: "from-indigo-500 to-violet-600"
    }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          ڕووکاری پۆرتاڵی کڕیار
        </CardTitle>
        <CardDescription>
          هەڵبژاردنی ڕووکار بۆ پۆرتاڵی کڕیارەکان - هەموو تایبەتمەندییەکان هەر وەک کاردەکەن
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {themes.map((theme) => (
            <div
              key={theme.id}
              onClick={() => handleThemeChange(theme.id)}
              className={`relative cursor-pointer rounded-xl border-2 transition-all duration-300 overflow-hidden ${
                currentTheme === theme.id
                  ? "border-primary ring-2 ring-primary/20"
                  : "border-border hover:border-primary/50"
              }`}
            >
              {/* Preview */}
              <div className={`h-32 ${theme.preview} p-4 relative`}>
                {/* Mock UI elements */}
                <div className="absolute top-3 right-3 flex gap-2">
                  <div className="w-6 h-6 rounded-full bg-white/20" />
                  <div className="w-6 h-6 rounded-full bg-white/20" />
                </div>
                <div className="absolute bottom-3 left-3 right-3">
                  <div className={`h-12 rounded-xl bg-gradient-to-r ${theme.accent} opacity-80`} />
                </div>
                {/* Selected badge */}
                {currentTheme === theme.id && (
                  <div className="absolute top-3 left-3 bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full font-medium">
                    فعاڵ
                  </div>
                )}
              </div>
              {/* Info */}
              <div className="p-4 bg-card">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-bold text-lg">{theme.name}</h3>
                  <span className="text-sm text-muted-foreground">{theme.nameEn}</span>
                </div>
                <p className="text-sm text-muted-foreground">{theme.description}</p>
              </div>
            </div>
          ))}
        </div>

        {updateThemeMutation.isPending && (
          <div className="mt-4 flex items-center justify-center gap-2 text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>چاوەڕوان بە...</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
