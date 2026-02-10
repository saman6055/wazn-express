// Invoice Template Settings - v2
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { Settings as SettingsIcon, Building2, Bell, Globe, Mail, Shield, FileText, DollarSign, RefreshCw, TrendingUp, Palette, Code } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "@/contexts/LanguageContext";

export default function Settings() {
    const { t } = useTranslation();
const [companyName, setCompanyName] = useState("Wazn Express");
  const [companyEmail, setCompanyEmail] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [whatsappNotifications, setWhatsappNotifications] = useState(false);
  const [iqdRate, setIqdRate] = useState("");
  const [rmbRate, setRmbRate] = useState("");

  const { data: settings, refetch } = trpc.settings.list.useQuery();
  const { data: exchangeRates, refetch: refetchRates } = trpc.exchangeRates.list.useQuery();
  
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
    onSuccess: () => {
      toast.success("Settings updated");
      refetch();
    },
    onError: (error) => toast.error(error.message)
  });

  const handleSaveCompany = () => {
    updateSettingsMutation.mutate({
      key: "company_info",
      value: JSON.stringify({ name: companyName, email: companyEmail, phone: companyPhone })
    });
  };

  const handleSaveNotifications = () => {
    updateSettingsMutation.mutate({
      key: "notifications",
      value: JSON.stringify({ email: emailNotifications, whatsapp: whatsappNotifications })
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("settings.title")}</h1>
            <p className="text-muted-foreground">{t("settings.subtitle")}</p>
          </div>
        </div>

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
              {"ڕووکاری پۆرتاڵ"}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="company" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>{t("settings.companyInfo")}</CardTitle>
                <CardDescription>{t("settings.companyInfoDesc") || "Basic information displayed on invoices and communications"}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="companyName">{t("settings.companyName")}</Label>
                  <Input 
                    id="companyName" 
                    value={companyName} 
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Your company name"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="companyEmail">{t("settings.companyEmail")}</Label>
                    <Input 
                      id="companyEmail" 
                      type="email"
                      value={companyEmail} 
                      onChange={(e) => setCompanyEmail(e.target.value)}
                      placeholder="contact@company.com"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="companyPhone">{t("settings.companyPhone")}</Label>
                    <Input 
                      id="companyPhone" 
                      value={companyPhone} 
                      onChange={(e) => setCompanyPhone(e.target.value)}
                      placeholder="+1 234 567 890"
                    />
                  </div>
                </div>
                <Button onClick={handleSaveCompany} disabled={updateSettingsMutation.isPending}>
                  {t("common.save")}
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
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

// Portal Theme Settings Component
function PortalThemeSettings() {
  const { t } = useTranslation();
  const { data: currentTheme, isLoading } = trpc.public.getPortalTheme.useQuery();
  const updateThemeMutation = trpc.settings.set.useMutation({
    onSuccess: () => {
      toast.success("ڕووکار بە سەرکەوتوویی گۆڕا");
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
