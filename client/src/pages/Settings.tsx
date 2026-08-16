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
import { pickLang } from "@/lib/lang";

export default function Settings() {
    const { t, language } = useTranslation();
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
      toast.error(t("settings.logoImageOnly") || pickLang(language, { ku: "تکایە فایلی وێنە هەڵبژێرە (PNG, JPG, ...)", en: "Please select an image file (PNG, JPG, ...)", ar: "الرجاء اختيار ملف صورة (PNG, JPG, ...)", zh: "请选择图片文件 (PNG, JPG, ...)" }));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error(t("settings.logoSizeLimit") || pickLang(language, { ku: "قەبارەی فایل نابێت لە ٢ مێگابایت زیاتر بێت", en: "File size must not exceed 2 MB", ar: "يجب ألا يتجاوز حجم الملف 2 ميغابايت", zh: "文件大小不得超过 2 MB" }));
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
        toast.success(t("settings.logoUploaded") || pickLang(language, { ku: "لۆگۆ ئەپلۆد کرا", en: "Logo uploaded", ar: "تم رفع الشعار", zh: "标志已上传" }));
      } else {
        const msg = "error" in data ? data.error : (t("settings.logoUploadFailed") || pickLang(language, { ku: "ئەپلۆدی لۆگۆ سەرنەگەیشت", en: "Logo upload failed", ar: "فشل رفع الشعار", zh: "标志上传失败" }));
        toast.error(msg);
      }
    } catch {
      toast.error(t("settings.logoUploadFailed") || pickLang(language, { ku: "ئەپلۆدی لۆگۆ سەرنەگەیشت", en: "Logo upload failed", ar: "فشل رفع الشعار", zh: "标志上传失败" }));
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
              {t("settings.portalThemeTab") || pickLang(language, { ku: "ڕووکاری پۆرتاڵ", en: "Portal Theme", ar: "مظهر البوابة", zh: "门户主题" })}
            </TabsTrigger>
            <TabsTrigger value="landing" className="gap-2">
              <Palette className="h-4 w-4" />
              {t("settings.landingThemeTab") || pickLang(language, { ku: "ڕووکاری پەرەی یەکەم", en: "Landing Theme", ar: "مظهر الصفحة الرئيسية", zh: "首页主题" })}
            </TabsTrigger>
            <TabsTrigger value="productAttributes" className="gap-2">
              <Tag className="h-4 w-4" />
              {pickLang(language, { ku: "زانیاری کاڵا", en: "Product Info", ar: "معلومات المنتج", zh: "商品信息" })}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="company" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>{t("settings.companyInfo")}</CardTitle>
                <CardDescription>
                  {pickLang(language, { ku: "ئەم زانیاریانە لە هەموو ڕاپۆرت و پسوڵەکاندا بەکاردێت", en: "This information is used in all reports and invoices", ar: "تُستخدم هذه المعلومات في جميع التقارير والفواتير", zh: "此信息用于所有报告和发票" })}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    {pickLang(language, { ku: "ناوی کۆمپانیا", en: "Company Name", ar: "اسم الشركة", zh: "公司名称" })}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="grid gap-2">
                      <Label>{pickLang(language, { ku: "ئینگلیزی", en: "English", ar: "الإنجليزية", zh: "英语" })}</Label>
                      <Input
                        value={companyData.name}
                        onChange={(e) => setCompanyData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Wazn Express"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>{pickLang(language, { ku: "کوردی", en: "Kurdish", ar: "الكردية", zh: "库尔德语" })}</Label>
                      <Input
                        value={companyData.nameKu}
                        onChange={(e) => setCompanyData(prev => ({ ...prev, nameKu: e.target.value }))}
                        placeholder="وازن ئێکسپرێس"
                        dir="rtl"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>{pickLang(language, { ku: "عەرەبی", en: "Arabic", ar: "العربية", zh: "阿拉伯语" })}</Label>
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
                    {pickLang(language, { ku: "ناونیشان", en: "Address", ar: "العنوان", zh: "地址" })}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="grid gap-2">
                      <Label>{pickLang(language, { ku: "ئینگلیزی", en: "English", ar: "الإنجليزية", zh: "英语" })}</Label>
                      <Input
                        value={companyData.address}
                        onChange={(e) => setCompanyData(prev => ({ ...prev, address: e.target.value }))}
                        placeholder="Company address..."
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>{pickLang(language, { ku: "کوردی", en: "Kurdish", ar: "الكردية", zh: "库尔德语" })}</Label>
                      <Input
                        value={companyData.addressKu}
                        onChange={(e) => setCompanyData(prev => ({ ...prev, addressKu: e.target.value }))}
                        placeholder={pickLang(language, { ku: "ناونیشانی کۆمپانیا...", en: "Company address...", ar: "عنوان الشركة...", zh: "公司地址..." })}
                        dir="rtl"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>{pickLang(language, { ku: "عەرەبی", en: "Arabic", ar: "العربية", zh: "阿拉伯语" })}</Label>
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
                    {pickLang(language, { ku: "زانیاری پەیوەندی", en: "Contact Information", ar: "معلومات الاتصال", zh: "联系信息" })}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>{pickLang(language, { ku: "ژمارەی مۆبایل ١", en: "Mobile number 1", ar: "رقم الجوال ١", zh: "手机号码 1" })}</Label>
                      <Input
                        value={companyData.phone}
                        onChange={(e) => setCompanyData(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="+964 750 123 4567"
                        dir="ltr"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>{pickLang(language, { ku: "ژمارەی مۆبایل ٢", en: "Mobile number 2", ar: "رقم الجوال ٢", zh: "手机号码 2" })}</Label>
                      <Input
                        value={companyData.phone2}
                        onChange={(e) => setCompanyData(prev => ({ ...prev, phone2: e.target.value }))}
                        placeholder="+964 770 123 4567"
                        dir="ltr"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>{pickLang(language, { ku: "ئیمەیڵ", en: "Email", ar: "البريد الإلكتروني", zh: "电子邮件" })}</Label>
                      <Input
                        type="email"
                        value={companyData.email}
                        onChange={(e) => setCompanyData(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="info@wazn.express"
                        dir="ltr"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>{pickLang(language, { ku: "وێبسایت", en: "Website", ar: "الموقع الإلكتروني", zh: "网站" })}</Label>
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
                    {pickLang(language, { ku: "لۆگۆی کۆمپانیا", en: "Company Logo", ar: "شعار الشركة", zh: "公司标志" })}
                  </h3>
                  <div className="grid gap-2">
                    <Label>{pickLang(language, { ku: "ئەپلۆدی لۆگۆ", en: "Upload logo", ar: "رفع الشعار", zh: "上传标志" })}</Label>
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
                        {logoUploading ? pickLang(language, { ku: "چاوەڕوان بە...", en: "Please wait...", ar: "يرجى الانتظار...", zh: "请稍候..." }) : pickLang(language, { ku: "هەڵبژێرە و ئەپلۆد بکە", en: "Select and upload", ar: "اختر وارفع", zh: "选择并上传" })}
                      </Label>
                      <span className="text-xs text-muted-foreground">{pickLang(language, { ku: "PNG, JPG تا ٢MB", en: "PNG, JPG up to 2MB", ar: "PNG, JPG حتى 2MB", zh: "PNG、JPG 最大 2MB" })}</span>
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
                          {t("common.remove") || pickLang(language, { ku: "لابردن", en: "Remove", ar: "إزالة", zh: "移除" })}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                <Button onClick={handleSaveCompany} disabled={updateSettingsMutation.isPending} className="w-full">
                  {updateSettingsMutation.isPending ? pickLang(language, { ku: "چاوەڕوان بە...", en: "Please wait...", ar: "يرجى الانتظار...", zh: "请稍候..." }) : t("common.save")}
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
                  {t("settings.customerCodePrefixes") || pickLang(language, { ku: "پێشگرەکانی کۆدی کڕیار", en: "Customer Code Prefixes", ar: "بادئات رمز العميل", zh: "客户编码前缀" })}
                </CardTitle>
                <CardDescription>{t("settings.customerCodePrefixesDesc") || pickLang(language, { ku: "بەڕێوەبردنی پێشگرەکانی کۆدی کڕیار (AZ, WZ, TR)", en: "Manage customer code prefixes (AZ, WZ, TR)", ar: "إدارة بادئات رمز العميل (AZ, WZ, TR)", zh: "管理客户编码前缀 (AZ, WZ, TR)" })}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {t("settings.customerCodePrefixesLongDesc") || pickLang(language, { ku: "دروستکردن و بەڕێوەبردنی پێشگرەکانی کۆدی کڕیار کە بەکاردێن لە کاتی دروستکردنی کڕیاری نوێ.", en: "Create and manage customer code prefixes used when creating new customers.", ar: "إنشاء وإدارة بادئات رمز العميل المستخدمة عند إنشاء عملاء جدد.", zh: "创建和管理新建客户时使用的客户编码前缀。" })}
                </p>
                <div className="flex gap-2">
                  <Link href="/settings/code-prefixes">
                    <Button className="gap-2">
                      <Code className="h-4 w-4" />
                      {t("settings.manageCodePrefixes") || pickLang(language, { ku: "بەڕێوەبردنی پێشگرەکان", en: "Manage Prefixes", ar: "إدارة البادئات", zh: "管理前缀" })}
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  {t("settings.currencyManagement") || pickLang(language, { ku: "ڕێکخستنی دراو", en: "Currency Management", ar: "إدارة العملات", zh: "货币管理" })}
                </CardTitle>
                <CardDescription>{t("settings.currencyManagementDesc") || pickLang(language, { ku: "بەڕێوەبردنی دراوەکان و نرخی ئاڵووگۆڕ", en: "Manage currencies and exchange rates", ar: "إدارة العملات وأسعار الصرف", zh: "管理货币和汇率" })}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {pickLang(language, { ku: "بەڕێوەبردنی هەموو دراوەکان، نرخی ئاڵووگۆڕ، و دیاریکردنی دراوی بنەڕەت بۆ سیستەم.", en: "Manage all currencies, exchange rates, and set the system's base currency.", ar: "إدارة جميع العملات وأسعار الصرف وتحديد العملة الأساسية للنظام.", zh: "管理所有货币、汇率，并设置系统的基础货币。" })}
                </p>
                <div className="flex gap-2">
                  <Link href="/settings/currencies">
                    <Button className="gap-2">
                      <DollarSign className="h-4 w-4" />
                      {t("settings.manageCurrencies") || pickLang(language, { ku: "بەڕێوەبردنی دراوەکان", en: "Manage Currencies", ar: "إدارة العملات", zh: "管理货币" })}
                    </Button>
                  </Link>
                  <Link href="/settings/tax-rates">
                    <Button variant="outline" className="gap-2">
                      <TrendingUp className="h-4 w-4" />
                      {t("settings.manageTaxRates") || pickLang(language, { ku: "بەڕێوەبردنی نرخی باج", en: "Manage Tax Rates", ar: "إدارة معدلات الضريبة", zh: "管理税率" })}
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  {t("settings.emailTemplates") || pickLang(language, { ku: "قاڵبەکانی ئیمەیڵ", en: "Email Templates", ar: "قوالب البريد الإلكتروني", zh: "电子邮件模板" })}
                </CardTitle>
                <CardDescription>{t("settings.emailTemplatesDesc") || pickLang(language, { ku: "بەڕێوەبردنی قاڵبەکانی ئیمەیڵ بۆ ئۆتۆماتیکی", en: "Manage email templates for automation", ar: "إدارة قوالب البريد الإلكتروني للأتمتة", zh: "管理用于自动化的电子邮件模板" })}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {pickLang(language, { ku: "دروستکردن و دەستکاریکردنی قاڵبەکانی ئیمەیڵ بۆ ئاگادارکردنەوە، وەسڵ، و ڕاپۆرتەکان.", en: "Create and edit email templates for notifications, receipts, and reports.", ar: "إنشاء وتعديل قوالب البريد الإلكتروني للإشعارات والإيصالات والتقارير.", zh: "创建和编辑用于通知、收据和报告的电子邮件模板。" })}
                </p>
                <div className="flex gap-2">
                  <Link href="/settings/email-templates">
                    <Button className="gap-2">
                      <Mail className="h-4 w-4" />
                      {t("settings.manageEmailTemplates") || pickLang(language, { ku: "بەڕێوەبردنی قاڵبەکان", en: "Manage Templates", ar: "إدارة القوالب", zh: "管理模板" })}
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  {t("settings.advancedSettings") || pickLang(language, { ku: "ڕێکخستنە پێشکەوتووەکان", en: "Advanced Settings", ar: "الإعدادات المتقدمة", zh: "高级设置" })}
                </CardTitle>
                <CardDescription>{t("settings.advancedSettingsDesc") || pickLang(language, { ku: "ڕێکخستنەکانی کاروبار، ئاسایش و ئەزموونی بەکارهێنەر", en: "Business, security, and user experience settings", ar: "إعدادات الأعمال والأمان وتجربة المستخدم", zh: "业务、安全和用户体验设置" })}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {pickLang(language, { ku: "دەستگەیشتن بە ڕێکخستنە پێشکەوتووەکان بۆ کاروبار، ئاسایش، IP whitelist، و زیاتر.", en: "Access advanced settings for business, security, IP whitelist, and more.", ar: "الوصول إلى الإعدادات المتقدمة للأعمال والأمان وقائمة IP المسموح بها والمزيد.", zh: "访问业务、安全、IP 白名单等高级设置。" })}
                </p>
                <div className="flex gap-2">
                  <Link href="/settings/advanced">
                    <Button className="gap-2">
                      <SettingsIcon className="h-4 w-4" />
                      {t("settings.openAdvancedSettings") || pickLang(language, { ku: "کردنەوەی ڕێکخستنە پێشکەوتووەکان", en: "Open Advanced Settings", ar: "فتح الإعدادات المتقدمة", zh: "打开高级设置" })}
                    </Button>
                  </Link>
                  <Link href="/settings/ip-whitelist">
                    <Button variant="outline" className="gap-2">
                      <Shield className="h-4 w-4" />
                      {t("settings.ipWhitelist") || pickLang(language, { ku: "لیستی سپی IP", en: "IP Whitelist", ar: "قائمة IP المسموح بها", zh: "IP 白名单" })}
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
                <div className="p-4 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 rounded-lg text-sm text-blue-800 dark:text-blue-200">
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
                  <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-lg text-sm text-amber-800 dark:text-amber-200">
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
                  <DollarSign className="h-5 w-5 text-green-600 dark:text-green-300" />
                  {t("settings.exchangeRates") || "Exchange Rates"}
                </CardTitle>
                <CardDescription>
                  {t("settings.exchangeRatesDesc") || "Set exchange rates for USD to IQD and RMB conversions"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* USD to IQD */}
                <div className="p-4 border rounded-lg bg-gradient-to-r from-green-50 dark:from-green-950/40 to-emerald-50 dark:to-emerald-950/40">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-950/40 flex items-center justify-center">
                      <span className="text-lg">🇺🇸</span>
                    </div>
                    <TrendingUp className="h-5 w-5 text-muted-foreground" />
                    <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-950/40 flex items-center justify-center">
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
                      <p className="text-2xl font-bold text-green-700 dark:text-green-300">
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
                <div className="p-4 border rounded-lg bg-gradient-to-r from-red-50 dark:from-red-950/40 to-orange-50 dark:to-orange-950/40">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/40 flex items-center justify-center">
                      <span className="text-lg">🇺🇸</span>
                    </div>
                    <TrendingUp className="h-5 w-5 text-muted-foreground" />
                    <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/40 flex items-center justify-center">
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
                      <p className="text-2xl font-bold text-red-700 dark:text-red-300">
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
                <div className="p-4 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 rounded-lg">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
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
  const { language } = useTranslation();
  const utils = trpc.useUtils();
  const { data: allAttrs, isLoading } = trpc.productAttributes.list.useQuery();

  const createMutation = trpc.productAttributes.create.useMutation({
    onSuccess: () => {
      toast.success(pickLang(language, { ku: "زیادکرا", en: "Added", ar: "تمت الإضافة", zh: "已添加" }));
      utils.productAttributes.list.invalidate();
      setNewValue("");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.productAttributes.update.useMutation({
    onSuccess: () => {
      toast.success(pickLang(language, { ku: "نوێکرایەوە", en: "Updated", ar: "تم التحديث", zh: "已更新" }));
      utils.productAttributes.list.invalidate();
      setEditingId(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.productAttributes.delete.useMutation({
    onSuccess: () => {
      toast.success(pickLang(language, { ku: "سڕایەوە", en: "Deleted", ar: "تم الحذف", zh: "已删除" }));
      utils.productAttributes.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const [newValue, setNewValue] = useState("");
  const [activeType, setActiveType] = useState<"color" | "size" | "productType">("color");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");

  const typeLabels: Record<string, { ku: string; en: string; ar: string; zh: string }> = {
    color: { ku: "ڕەنگ", en: "Color", ar: "اللون", zh: "颜色" },
    size: { ku: "قەبارە", en: "Size", ar: "الحجم", zh: "尺寸" },
    productType: { ku: "جۆری کاڵا", en: "Product Type", ar: "نوع المنتج", zh: "商品类型" },
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
      <CardHeader className="bg-gradient-to-l from-violet-50 dark:from-violet-950/40 to-purple-50 dark:to-purple-950/40 border-b">
        <CardTitle className="flex items-center gap-2">
          <Tag className="h-5 w-5 text-violet-600 dark:text-violet-300" />
          {pickLang(language, { ku: "زانیاری کاڵا", en: "Product Info", ar: "معلومات المنتج", zh: "商品信息" })}
        </CardTitle>
        <CardDescription>{pickLang(language, { ku: "ڕەنگ، قەبارە و جۆری کاڵا بەڕێوە ببە — لە کاتی دروستکردنی ئۆردەر نیشان دەدرێن", en: "Manage colors, sizes, and product types — shown when creating an order", ar: "إدارة الألوان والأحجام وأنواع المنتجات — تظهر عند إنشاء طلب", zh: "管理颜色、尺寸和商品类型——创建订单时显示" })}</CardDescription>
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
                  ? "border-violet-400 bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 shadow-sm"
                  : "border-gray-200 dark:border-gray-800/60 bg-white text-gray-600 hover:border-violet-200"
              }`}
            >
              <span>{typeIcons[type]}</span>
              {pickLang(language, typeLabels[type])}
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-mono ${activeType === type ? "bg-violet-100 dark:bg-violet-950/40 text-violet-600 dark:text-violet-300" : "bg-gray-100 dark:bg-gray-950/40 text-gray-500 dark:text-gray-400"}`}>
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
            placeholder={pickLang(language, { ku: `${typeLabels[activeType].ku}ێکی نوێ...`, en: `New ${typeLabels[activeType].en.toLowerCase()}...`, ar: `${typeLabels[activeType].ar} جديد...`, zh: `新${typeLabels[activeType].zh}...` })}
            className="flex-1 h-11"
          />
          <Button
            type="button"
            onClick={handleAdd}
            disabled={!newValue.trim() || createMutation.isPending}
            className="bg-violet-600 hover:bg-violet-700 h-11 px-5"
          >
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {pickLang(language, { ku: "زیادکردن", en: "Add", ar: "إضافة", zh: "添加" })}
          </Button>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-violet-500 dark:text-violet-400" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <span className="text-4xl">{typeIcons[activeType]}</span>
            <p className="mt-3 font-medium">{pickLang(language, { ku: `هیچ ${typeLabels[activeType].ku}ێک نییە`, en: `No ${typeLabels[activeType].en.toLowerCase()} yet`, ar: `لا يوجد ${typeLabels[activeType].ar} بعد`, zh: `暂无${typeLabels[activeType].zh}` })}</p>
            <p className="text-sm mt-1">{pickLang(language, { ku: "بە فۆرمی سەرەوە زیادی بکە", en: "Add one using the form above", ar: "أضف واحدًا باستخدام النموذج أعلاه", zh: "使用上方表单添加" })}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(attr => (
              <div
                key={attr.id}
                className="flex items-center gap-3 bg-gray-50 dark:bg-gray-950/40 hover:bg-violet-50/40 border border-gray-200 dark:border-gray-800/60 hover:border-violet-200 rounded-xl px-4 py-3 transition-colors group"
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
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600 dark:text-green-300 hover:bg-green-50"
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
                    <span className="flex-1 font-medium text-gray-800 dark:text-gray-200">{attr.value}</span>
                    <Button size="icon" variant="ghost"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 text-violet-500 dark:text-violet-400 hover:bg-violet-100 transition-opacity"
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
  const { t, language } = useTranslation();
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
    { id: "logistick", name: pickLang(language, { ku: "وەزن (نوێ)", en: "Wazn (New)", ar: "وزن (جديد)", zh: "Wazn（新）" }), nameEn: "Wazn", description: pickLang(language, { ku: "ماڵپەڕی نوێی پڕیمیۆم - سوور و نەیڤی، hero، خزمەتگوزاری، تراکینگ (پێشنیارکراو)", en: "New premium landing - red & navy, hero, services, tracking (recommended)", ar: "صفحة رئيسية بريميوم جديدة - أحمر وكحلي، هيرو، خدمات، تتبع (موصى بها)", zh: "全新高级首页——红与藏青、Hero、服务、追踪（推荐）" }), icon: Building2 },
    { id: "modern", name: pickLang(language, { ku: "مۆدێرن", en: "Modern", ar: "عصري", zh: "现代" }), nameEn: "Modern", description: pickLang(language, { ku: "ڕووکاری شین-مۆری مۆدێرن بە کارتی شووشەیی", en: "Modern sky-blue & violet look with glass cards", ar: "مظهر عصري أزرق سماوي وبنفسجي ببطاقات زجاجية", zh: "现代天蓝与紫色玻璃卡片风格" }), icon: Sparkles },
    { id: "classic", name: t("settings.landingVariantClassic") || pickLang(language, { ku: "پەرەی پڕ (کلاسیک)", en: "Full Page (Classic)", ar: "صفحة كاملة (كلاسيكية)", zh: "完整页面（经典）" }), nameEn: "Classic", description: t("settings.landingVariantClassicDesc") || pickLang(language, { ku: "هەموو بەشەکان - ئامار، خزمەتگوزاری، تایبەتمەندی، پەیوەندی", en: "All sections - stats, services, features, contact", ar: "جميع الأقسام - الإحصائيات والخدمات والميزات والتواصل", zh: "所有版块——统计、服务、功能、联系" }), icon: LayoutGrid },
    { id: "minimal", name: t("settings.landingVariantMinimal") || pickLang(language, { ku: "پەرەی مینیماڵ", en: "Minimal Page", ar: "صفحة مبسطة", zh: "极简页面" }), nameEn: "Minimal", description: t("settings.landingVariantMinimalDesc") || pickLang(language, { ku: "پەرەی سادە و پرۆفیشناڵ - تراکینگ و دووگمەکانی سەرەکی", en: "Simple, professional page - tracking and primary buttons", ar: "صفحة بسيطة واحترافية - التتبع والأزرار الرئيسية", zh: "简洁专业页面——追踪和主要按钮" }), icon: Sparkles },
    { id: "editorial", name: pickLang(language, { ku: "Editorial (کۆن)", en: "Editorial (old)", ar: "تحريري (قديم)", zh: "编辑风（旧）" }), nameEn: "Editorial", description: pickLang(language, { ku: "ڕووکارێکی ڕووناکی editorial بە ڕەنگی ئەمبەر - تایپی گەورە، bento، و بۆشایی زۆر", en: "A light editorial look with amber accents - large type, bento, lots of whitespace", ar: "مظهر تحريري فاتح بلمسات كهرمانية - خط كبير، تصميم بنتو، ومساحات بيضاء واسعة", zh: "明亮的编辑风格，琥珀色点缀——大字体、便当式布局、大量留白" }), icon: Building2 }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LayoutGrid className="h-5 w-5" />
          {t("settings.landingPageVariantTitle") || pickLang(language, { ku: "جۆری پەرەی سەرەکی", en: "Landing Page Type", ar: "نوع الصفحة الرئيسية", zh: "首页类型" })}
        </CardTitle>
        <CardDescription>
          {t("settings.landingPageVariantDesc") || pickLang(language, { ku: "هەڵبژاردنی پەرەی لاندینگ - کلاسیک (پڕ) یان مینیماڵ (سادە)", en: "Choose the landing page - Classic (full) or Minimal (simple)", ar: "اختر الصفحة الرئيسية - كلاسيكية (كاملة) أو مبسطة (بسيطة)", zh: "选择首页——经典（完整）或极简（简单）" })}
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
                    {t("settings.active") || pickLang(language, { ku: "فعاڵ", en: "Active", ar: "نشط", zh: "已启用" })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {updateMutation.isPending && (
          <div className="mt-4 flex items-center justify-center gap-2 text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>{t("settings.applying") || pickLang(language, { ku: "چاوەڕوان بە...", en: "Please wait...", ar: "يرجى الانتظار...", zh: "请稍候..." })}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Website content (hero, about, social) — shown on landing page
function LandingWebsiteContentSettings() {
  const { t, language } = useTranslation();
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
          {t("settings.websiteContentTitle") || pickLang(language, { ku: "ناوەڕۆکی پەرەی سەرەکی", en: "Landing Page Content", ar: "محتوى الصفحة الرئيسية", zh: "首页内容" })}
        </CardTitle>
        <CardDescription>
          {t("settings.websiteContentDesc") || pickLang(language, { ku: "سەردێری هێڵۆ، دەربارەی کۆمپانیا، و لینکە سۆشیالەکان لە پەرەی لاندینگ دەردەکەون", en: "Hero title, about company, and social links shown on the landing page", ar: "عنوان البطل، نبذة عن الشركة، وروابط التواصل الاجتماعي تظهر في الصفحة الرئيسية", zh: "首页显示的主标题、公司简介和社交链接" })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4">
          <Label>{t("settings.heroTitle") || pickLang(language, { ku: "سەردێری هێڵۆ", en: "Hero Title", ar: "العنوان الرئيسي", zh: "主标题" })}</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input value={form.website_hero_title} onChange={(e) => setForm(f => ({ ...f, website_hero_title: e.target.value }))} placeholder="Wazn Express (EN)" />
            <Input value={form.website_hero_title_ku} onChange={(e) => setForm(f => ({ ...f, website_hero_title_ku: e.target.value }))} placeholder={pickLang(language, { ku: "وازن ئێکسپرێس (کوردی)", en: "Wazn Express (Kurdish)", ar: "وزن اكسبرس (الكردية)", zh: "Wazn Express（库尔德语）" })} dir="rtl" />
          </div>
        </div>
        <div className="grid gap-4">
          <Label>{t("settings.heroSubtitle") || pickLang(language, { ku: "ژێرسەردێر", en: "Subtitle", ar: "العنوان الفرعي", zh: "副标题" })}</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input value={form.website_hero_subtitle} onChange={(e) => setForm(f => ({ ...f, website_hero_subtitle: e.target.value }))} placeholder="Fast and reliable shipping (EN)" />
            <Input value={form.website_hero_subtitle_ku} onChange={(e) => setForm(f => ({ ...f, website_hero_subtitle_ku: e.target.value }))} placeholder={pickLang(language, { ku: "گواستنەوەی خێرا و متمانەپێکراو (کوردی)", en: "Fast and reliable shipping (Kurdish)", ar: "شحن سريع وموثوق (الكردية)", zh: "快速可靠的运输（库尔德语）" })} dir="rtl" />
          </div>
        </div>
        <div className="grid gap-4">
          <Label>{t("settings.aboutText") || pickLang(language, { ku: "دەربارەی کۆمپانیا", en: "About Company", ar: "نبذة عن الشركة", zh: "公司简介" })}</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <textarea className="flex min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.website_about} onChange={(e) => setForm(f => ({ ...f, website_about: e.target.value }))} placeholder="About company (EN)" />
            <textarea className="flex min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.website_about_ku} onChange={(e) => setForm(f => ({ ...f, website_about_ku: e.target.value }))} placeholder={pickLang(language, { ku: "دەربارەی کۆمپانیا (کوردی)", en: "About company (Kurdish)", ar: "نبذة عن الشركة (الكردية)", zh: "公司简介（库尔德语）" })} dir="rtl" />
          </div>
        </div>
        <div className="grid gap-4">
          <Label>{t("settings.socialLinks") || pickLang(language, { ku: "لینکە سۆشیالەکان", en: "Social Links", ar: "روابط التواصل الاجتماعي", zh: "社交链接" })}</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input value={form.social_facebook} onChange={(e) => setForm(f => ({ ...f, social_facebook: e.target.value }))} placeholder="https://facebook.com/..." dir="ltr" />
            <Input value={form.social_instagram} onChange={(e) => setForm(f => ({ ...f, social_instagram: e.target.value }))} placeholder="https://instagram.com/..." dir="ltr" />
            <Input value={form.social_whatsapp} onChange={(e) => setForm(f => ({ ...f, social_whatsapp: e.target.value }))} placeholder="+9647501234567 or https://wa.me/..." dir="ltr" />
            <Input value={form.social_tiktok} onChange={(e) => setForm(f => ({ ...f, social_tiktok: e.target.value }))} placeholder="https://tiktok.com/..." dir="ltr" />
            <Input value={form.social_telegram} onChange={(e) => setForm(f => ({ ...f, social_telegram: e.target.value }))} placeholder="https://t.me/..." dir="ltr" />
          </div>
        </div>
        <Button onClick={handleSave} disabled={setMutation.isPending}>
          {setMutation.isPending ? (t("settings.saving") || pickLang(language, { ku: "چاوەڕوان بە...", en: "Please wait...", ar: "يرجى الانتظار...", zh: "请稍候..." })) : t("settings.saveChanges")}
        </Button>
      </CardContent>
    </Card>
  );
}

// Landing team (for "Our Team" section on landing page)
function LandingTeamSettings() {
  const { t, language } = useTranslation();
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
          {t("settings.landingTeamTitle") || pickLang(language, { ku: "ستاف/تیمی پەرەی سەرەکی", en: "Landing Page Staff/Team", ar: "طاقم/فريق الصفحة الرئيسية", zh: "首页员工/团队" })}
        </CardTitle>
        <CardDescription>
          {t("settings.landingTeamDesc") || pickLang(language, { ku: "ئەم کەسانە لە بەشی «تیمی ئێمە» لە پەرەی لاندینگ نیشان دەدرێن", en: "These people are shown in the \"Our Team\" section on the landing page", ar: "يظهر هؤلاء الأشخاص في قسم «فريقنا» على الصفحة الرئيسية", zh: "这些人显示在首页的\"我们的团队\"版块中" })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {editing.map((m, i) => (
          <div key={i} className="flex items-start gap-4 p-4 border rounded-lg">
            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2">
              <Input value={m.name} onChange={(e) => setEditing(editing.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} placeholder={t("settings.teamMemberName") || pickLang(language, { ku: "ناو", en: "Name", ar: "الاسم", zh: "姓名" })} />
              <Input value={m.role} onChange={(e) => setEditing(editing.map((x, j) => j === i ? { ...x, role: e.target.value } : x))} placeholder={t("settings.teamMemberRole") || pickLang(language, { ku: "ڕۆڵ/ناونیشان", en: "Role/Title", ar: "الدور/المسمى", zh: "职位/头衔" })} />
              <Input value={m.imageUrl} onChange={(e) => setEditing(editing.map((x, j) => j === i ? { ...x, imageUrl: e.target.value } : x))} placeholder={t("settings.teamMemberImageUrl") || pickLang(language, { ku: "URL وێنە (ئەگەر هەبێت)", en: "Image URL (if any)", ar: "رابط الصورة (إن وجد)", zh: "图片 URL（如有）" })} />
              <Input className="md:col-span-3" value={m.description} onChange={(e) => setEditing(editing.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} placeholder={t("settings.teamMemberDescription") || pickLang(language, { ku: "دیسکڕیپشن", en: "Description", ar: "الوصف", zh: "描述" })} />
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={() => handleRemove(i)} className="text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2 pt-2">
          <Input className="max-w-[180px]" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t("settings.teamMemberName") || pickLang(language, { ku: "ناو", en: "Name", ar: "الاسم", zh: "姓名" })} />
          <Input className="max-w-[180px]" value={newRole} onChange={(e) => setNewRole(e.target.value)} placeholder={t("settings.teamMemberRole") || pickLang(language, { ku: "ڕۆڵ", en: "Role", ar: "الدور", zh: "职位" })} />
          <Input className="max-w-[200px]" value={newImage} onChange={(e) => setNewImage(e.target.value)} placeholder={pickLang(language, { ku: "URL وێنە", en: "Image URL", ar: "رابط الصورة", zh: "图片 URL" })} />
          <Input className="min-w-[200px] flex-1" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder={t("settings.teamMemberDescription") || pickLang(language, { ku: "دیسکڕیپشن", en: "Description", ar: "الوصف", zh: "描述" })} />
          <Button type="button" size="sm" onClick={handleAdd} disabled={!newName.trim() || updateMutation.isPending}>
            <Plus className="h-4 w-4 me-1" />
            {t("settings.add") || pickLang(language, { ku: "زیادکردن", en: "Add", ar: "إضافة", zh: "添加" })}
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
  const { t, language } = useTranslation();
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
    { id: "dark", name: t("settings.landingThemeDark") || pickLang(language, { ku: "تاریک", en: "Dark", ar: "داكن", zh: "深色" }), nameEn: "Dark", description: t("settings.landingThemeDarkDesc") || pickLang(language, { ku: "ڕووکاری ئێستا - پسپۆڕی تاریک", en: "Current look - dark professional", ar: "المظهر الحالي - احترافي داكن", zh: "当前外观——深色专业" }), preview: "bg-[#0f172a]", accent: "from-amber-500 to-orange-500" },
    { id: "light", name: t("settings.landingThemeLight") || pickLang(language, { ku: "ڕووناک", en: "Light", ar: "فاتح", zh: "浅色" }), nameEn: "Light", description: t("settings.landingThemeLightDesc") || pickLang(language, { ku: "پسپۆڕی ڕووناک - گونجاو بۆ ڕۆژ", en: "Light professional - suited for daytime", ar: "احترافي فاتح - مناسب للنهار", zh: "浅色专业——适合白天" }), preview: "bg-slate-50 dark:bg-slate-950/40", accent: "from-amber-600 to-orange-600" },
    { id: "ocean", name: t("settings.landingThemeOcean") || pickLang(language, { ku: "ئۆشن", en: "Ocean", ar: "محيط", zh: "海洋" }), nameEn: "Ocean", description: t("settings.landingThemeOceanDesc") || pickLang(language, { ku: "شین/تەڵاو - گونجاو بۆ لۆژستیک", en: "Blue/teal - suited for logistics", ar: "أزرق/فيروزي - مناسب للوجستيات", zh: "蓝色/青色——适合物流" }), preview: "bg-[#0c4a6e]", accent: "from-sky-400 to-cyan-500" }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          {t("settings.landingThemeTitle") || pickLang(language, { ku: "ڕووکاری پەرەی یەکەم (لاندینگ)", en: "Landing Page Theme", ar: "مظهر الصفحة الرئيسية", zh: "首页主题" })}
        </CardTitle>
        <CardDescription>
          {t("settings.landingThemeDesc") || pickLang(language, { ku: "هەڵبژاردنی ڕووکار بۆ پەرەی سەرەکی ویبسایت - ئەم ڕووکارە بۆ هەموو سەردانکەران دەردەکەوێت", en: "Choose the theme for the website landing page - this theme is shown to all visitors", ar: "اختر مظهر الصفحة الرئيسية للموقع - يظهر هذا المظهر لجميع الزوار", zh: "选择网站首页的主题——此主题对所有访客显示" })}
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
                    {t("settings.active") || pickLang(language, { ku: "فعاڵ", en: "Active", ar: "نشط", zh: "已启用" })}
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
            <span>{t("settings.applying") || pickLang(language, { ku: "چاوەڕوان بە...", en: "Please wait...", ar: "يرجى الانتظار...", zh: "请稍候..." })}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Portal Theme Settings Component
function PortalThemeSettings() {
  const { t, language } = useTranslation();
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
      name: pickLang(language, { ku: "کلاسیک", en: "Classic", ar: "كلاسيكي", zh: "经典" }),
      nameEn: "Classic",
      description: pickLang(language, { ku: "ڕووکاری ئێستا - دیزاینێکی سادە و ئاسان", en: "Current look - a simple, easy design", ar: "المظهر الحالي - تصميم بسيط وسهل", zh: "当前外观——简单易用的设计" }),
      preview: "bg-gradient-to-br from-slate-900 to-slate-800",
      accent: "from-emerald-500 to-teal-600"
    },
    {
      id: "modern",
      name: pickLang(language, { ku: "مۆدێرن", en: "Modern", ar: "عصري", zh: "现代" }),
      nameEn: "Modern",
      description: pickLang(language, { ku: "ڕووکارێکی نوێ و پڕۆفیشناڵ - بە ئەنیمەیشن و دیزاینی سەرنجڕاکێش", en: "A new, professional look - with animation and eye-catching design", ar: "مظهر جديد واحترافي - مع الحركة والتصميم الجذاب", zh: "全新专业外观——带动画和吸引眼球的设计" }),
      preview: "bg-gradient-to-br from-violet-950 to-slate-950",
      accent: "from-violet-500 to-purple-600"
    },
    {
      id: "skin3",
      name: pickLang(language, { ku: "نیۆبروتاڵیست", en: "Neobrutalist", ar: "نيوبروتاليست", zh: "新粗野主义" }),
      nameEn: "Neobrutalist",
      description: pickLang(language, { ku: "دیزاینێکی تایبەت و جوان - بە بۆردەری ئەستوور و شادۆی بۆڵد و ڕەنگی ئینیدگۆ", en: "A distinctive, attractive design - with thick borders, bold shadows, and indigo color", ar: "تصميم مميز وجذاب - بحدود سميكة وظلال بارزة ولون نيلي", zh: "独特出彩的设计——粗边框、醒目阴影和靛蓝色" }),
      preview: "bg-gradient-to-br from-amber-50 dark:from-amber-950/40 to-indigo-100 dark:to-indigo-900/40",
      accent: "from-indigo-500 to-violet-600"
    }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          {pickLang(language, { ku: "ڕووکاری پۆرتاڵی کڕیار", en: "Customer Portal Theme", ar: "مظهر بوابة العميل", zh: "客户门户主题" })}
        </CardTitle>
        <CardDescription>
          {pickLang(language, { ku: "هەڵبژاردنی ڕووکار بۆ پۆرتاڵی کڕیارەکان - هەموو تایبەتمەندییەکان هەر وەک کاردەکەن", en: "Choose the theme for the customer portal - all features work the same", ar: "اختر مظهر بوابة العملاء - تعمل جميع الميزات بنفس الطريقة", zh: "选择客户门户的主题——所有功能照常运作" })}
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
                    {pickLang(language, { ku: "فعاڵ", en: "Active", ar: "نشط", zh: "已启用" })}
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
            <span>{pickLang(language, { ku: "چاوەڕوان بە...", en: "Please wait...", ar: "يرجى الانتظار...", zh: "请稍候..." })}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
