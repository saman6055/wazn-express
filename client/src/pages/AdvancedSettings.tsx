import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Settings2, Building2, Shield, Palette, Save } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { DeadPhotoCleanupCard } from "@/components/settings/DeadPhotoCleanupCard";

export default function AdvancedSettings() {
  const { language } = useTranslation();

  // State for all settings
  const [businessConfig, setBusinessConfig] = useState({
    fiscalYearStart: "01-01",
    businessHoursStart: "09:00",
    businessHoursEnd: "17:00",
    defaultTaxRate: "15",
    autoNumberingFormat: "INV-{YYYY}-{####}",
    lowStockThreshold: "10",
  });

  const [securityConfig, setSecurityConfig] = useState({
    enable2FA: false,
    sessionTimeout: "60",
    auditRetentionDays: "365",
    passwordMinLength: "8",
    requirePasswordChange: false,
  });

  const [uxConfig, setUxConfig] = useState({
    defaultLanguage: "ku",
    dateFormat: "YYYY-MM-DD",
    timeFormat: "24h",
    theme: "light",
    itemsPerPage: "20",
  });

  // Queries
  const { data: allSettings, refetch } = trpc.advancedSettings.getAllSettings.useQuery();

  // Mutation
  const setSetting = trpc.advancedSettings.setSetting.useMutation({
    onSuccess: () => {
      toast.success(pickLang(language, { ku: "ڕێکخستنەکان پاشەکەوت کران", en: "Settings saved", ar: "تم حفظ الإعدادات", zh: "设置已保存" }));
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Load settings from server
  useEffect(() => {
    if (allSettings) {
      const settingsMap = new Map(allSettings.map(s => [s.settingKey, s.settingValue]));
      
      setBusinessConfig({
        fiscalYearStart: settingsMap.get("fiscal_year_start") || "01-01",
        businessHoursStart: settingsMap.get("business_hours_start") || "09:00",
        businessHoursEnd: settingsMap.get("business_hours_end") || "17:00",
        defaultTaxRate: settingsMap.get("default_tax_rate") || "15",
        autoNumberingFormat: settingsMap.get("auto_numbering_format") || "INV-{YYYY}-{####}",
        lowStockThreshold: settingsMap.get("low_stock_threshold") || "10",
      });

      setSecurityConfig({
        enable2FA: settingsMap.get("enable_2fa") === "true",
        sessionTimeout: settingsMap.get("session_timeout") || "60",
        auditRetentionDays: settingsMap.get("audit_retention_days") || "365",
        passwordMinLength: settingsMap.get("password_min_length") || "8",
        requirePasswordChange: settingsMap.get("require_password_change") === "true",
      });

      setUxConfig({
        defaultLanguage: settingsMap.get("default_language") || "ku",
        dateFormat: settingsMap.get("date_format") || "YYYY-MM-DD",
        timeFormat: settingsMap.get("time_format") || "24h",
        theme: settingsMap.get("theme") || "light",
        itemsPerPage: settingsMap.get("items_per_page") || "20",
      });
    }
  }, [allSettings]);

  const handleSaveBusinessConfig = async () => {
    const settings = [
      { key: "fiscal_year_start", value: businessConfig.fiscalYearStart, type: "string" },
      { key: "business_hours_start", value: businessConfig.businessHoursStart, type: "string" },
      { key: "business_hours_end", value: businessConfig.businessHoursEnd, type: "string" },
      { key: "default_tax_rate", value: businessConfig.defaultTaxRate, type: "number" },
      { key: "auto_numbering_format", value: businessConfig.autoNumberingFormat, type: "string" },
      { key: "low_stock_threshold", value: businessConfig.lowStockThreshold, type: "number" },
    ];

    for (const setting of settings) {
      await setSetting.mutateAsync(setting);
    }
  };

  const handleSaveSecurityConfig = async () => {
    const settings = [
      { key: "enable_2fa", value: String(securityConfig.enable2FA), type: "boolean" },
      { key: "session_timeout", value: securityConfig.sessionTimeout, type: "number" },
      { key: "audit_retention_days", value: securityConfig.auditRetentionDays, type: "number" },
      { key: "password_min_length", value: securityConfig.passwordMinLength, type: "number" },
      { key: "require_password_change", value: String(securityConfig.requirePasswordChange), type: "boolean" },
    ];

    for (const setting of settings) {
      await setSetting.mutateAsync(setting);
    }
  };

  const handleSaveUxConfig = async () => {
    const settings = [
      { key: "default_language", value: uxConfig.defaultLanguage, type: "string" },
      { key: "date_format", value: uxConfig.dateFormat, type: "string" },
      { key: "time_format", value: uxConfig.timeFormat, type: "string" },
      { key: "theme", value: uxConfig.theme, type: "string" },
      { key: "items_per_page", value: uxConfig.itemsPerPage, type: "number" },
    ];

    for (const setting of settings) {
      await setSetting.mutateAsync(setting);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Settings2 className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">{pickLang(language, { ku: "ڕێکخستنە پێشکەوتووەکان", en: "Advanced Settings", ar: "الإعدادات المتقدمة", zh: "高级设置" })}</h1>
          <p className="text-muted-foreground">
            {pickLang(language, { ku: "بەڕێوەبردنی ڕێکخستنەکانی کاروبار، ئاسایش و ئەزموونی بەکارهێنەر", en: "Manage business, security and user experience settings", ar: "إدارة إعدادات الأعمال والأمان وتجربة المستخدم", zh: "管理业务、安全和用户体验设置" })}
          </p>
        </div>
      </div>

      <Tabs defaultValue="business" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="business" className="gap-2">
            <Building2 className="h-4 w-4" />
            {pickLang(language, { ku: "کاروبار", en: "Business", ar: "الأعمال", zh: "业务" })}
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Shield className="h-4 w-4" />
            {pickLang(language, { ku: "ئاسایش", en: "Security", ar: "الأمان", zh: "安全" })}
          </TabsTrigger>
          <TabsTrigger value="ux" className="gap-2">
            <Palette className="h-4 w-4" />
            {pickLang(language, { ku: "ئەزموونی بەکارهێنەر", en: "User Experience", ar: "تجربة المستخدم", zh: "用户体验" })}
          </TabsTrigger>
        </TabsList>

        {/* Business Configuration */}
        <TabsContent value="business">
          <Card>
            <CardHeader>
              <CardTitle>{pickLang(language, { ku: "ڕێکخستنەکانی کاروبار", en: "Business Settings", ar: "إعدادات الأعمال", zh: "业务设置" })}</CardTitle>
              <CardDescription>
                {pickLang(language, { ku: "ڕێکخستنەکانی گشتی کاروبار و ئۆتۆماتیکی", en: "General business and automation settings", ar: "إعدادات الأعمال العامة والأتمتة", zh: "通用业务与自动化设置" })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="fiscalYearStart">{pickLang(language, { ku: "دەستپێکی ساڵی دارایی", en: "Fiscal Year Start", ar: "بداية السنة المالية", zh: "财年开始" })}</Label>
                  <Input
                    id="fiscalYearStart"
                    type="text"
                    value={businessConfig.fiscalYearStart}
                    onChange={(e) => setBusinessConfig({ ...businessConfig, fiscalYearStart: e.target.value })}
                    placeholder="01-01"
                  />
                  <p className="text-xs text-muted-foreground">{pickLang(language, { ku: "فۆرمات: MM-DD", en: "Format: MM-DD", ar: "التنسيق: MM-DD", zh: "格式：MM-DD" })}</p>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="businessHoursStart">{pickLang(language, { ku: "دەستپێکی کاتی کار", en: "Business Hours Start", ar: "بداية ساعات العمل", zh: "营业开始时间" })}</Label>
                    <Input
                      id="businessHoursStart"
                      type="time"
                      value={businessConfig.businessHoursStart}
                      onChange={(e) => setBusinessConfig({ ...businessConfig, businessHoursStart: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="businessHoursEnd">{pickLang(language, { ku: "کۆتایی کاتی کار", en: "Business Hours End", ar: "نهاية ساعات العمل", zh: "营业结束时间" })}</Label>
                    <Input
                      id="businessHoursEnd"
                      type="time"
                      value={businessConfig.businessHoursEnd}
                      onChange={(e) => setBusinessConfig({ ...businessConfig, businessHoursEnd: e.target.value })}
                    />
                  </div>
                </div>

                <Separator />

                <div className="grid gap-2">
                  <Label htmlFor="defaultTaxRate">{pickLang(language, { ku: "نرخی باجی بنەڕەت (%)", en: "Default Tax Rate (%)", ar: "نسبة الضريبة الافتراضية (%)", zh: "默认税率 (%)" })}</Label>
                  <Input
                    id="defaultTaxRate"
                    type="number"
                    step="0.01"
                    value={businessConfig.defaultTaxRate}
                    onChange={(e) => setBusinessConfig({ ...businessConfig, defaultTaxRate: e.target.value })}
                  />
                </div>

                <Separator />

                <div className="grid gap-2">
                  <Label htmlFor="autoNumberingFormat">{pickLang(language, { ku: "فۆرماتی ژمارەی ئۆتۆماتیکی", en: "Auto Numbering Format", ar: "تنسيق الترقيم التلقائي", zh: "自动编号格式" })}</Label>
                  <Input
                    id="autoNumberingFormat"
                    value={businessConfig.autoNumberingFormat}
                    onChange={(e) => setBusinessConfig({ ...businessConfig, autoNumberingFormat: e.target.value })}
                    placeholder="INV-{YYYY}-{####}"
                  />
                  <p className="text-xs text-muted-foreground">
                    {pickLang(language, { ku: "گۆڕاوەکان:", en: "Variables:", ar: "المتغيرات:", zh: "变量：" })} {"{YYYY}"} ({pickLang(language, { ku: "ساڵ", en: "year", ar: "سنة", zh: "年" })}), {"{MM}"} ({pickLang(language, { ku: "مانگ", en: "month", ar: "شهر", zh: "月" })}), {"{####}"} ({pickLang(language, { ku: "ژمارە", en: "number", ar: "رقم", zh: "编号" })})
                  </p>
                </div>

                <Separator />

                <div className="grid gap-2">
                  <Label htmlFor="lowStockThreshold">{pickLang(language, { ku: "سنووری کەمی کاڵا", en: "Low Stock Threshold", ar: "حد المخزون المنخفض", zh: "低库存阈值" })}</Label>
                  <Input
                    id="lowStockThreshold"
                    type="number"
                    value={businessConfig.lowStockThreshold}
                    onChange={(e) => setBusinessConfig({ ...businessConfig, lowStockThreshold: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    {pickLang(language, { ku: "ئاگاداری دەنێردرێت کاتێک کاڵا لەم ژمارەیە کەمتر دەبێت", en: "An alert is sent when stock falls below this number", ar: "يُرسل تنبيه عندما ينخفض المخزون عن هذا الرقم", zh: "当库存低于此数量时发送提醒" })}
                  </p>
                </div>
              </div>

              <Button onClick={handleSaveBusinessConfig} disabled={setSetting.isPending} className="w-full">
                <Save className="h-4 w-4 ms-2" />
                {setSetting.isPending ? pickLang(language, { ku: "چاوەڕێ بە...", en: "Please wait...", ar: "يرجى الانتظار...", zh: "请稍候..." }) : pickLang(language, { ku: "پاشەکەوتکردن", en: "Save", ar: "حفظ", zh: "保存" })}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Configuration */}
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>{pickLang(language, { ku: "ڕێکخستنەکانی ئاسایش", en: "Security Settings", ar: "إعدادات الأمان", zh: "安全设置" })}</CardTitle>
              <CardDescription>
                {pickLang(language, { ku: "بەڕێوەبردنی ئاسایش و دەستگەیشتن", en: "Manage security and access", ar: "إدارة الأمان والوصول", zh: "管理安全与访问" })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="enable2FA">{pickLang(language, { ku: "چالاککردنی 2FA", en: "Enable 2FA", ar: "تفعيل المصادقة الثنائية", zh: "启用 2FA" })}</Label>
                    <p className="text-sm text-muted-foreground">
                      {pickLang(language, { ku: "پشتڕاستکردنەوەی دوو هێڵی بۆ بەکارهێنەران", en: "Two-factor authentication for users", ar: "المصادقة الثنائية للمستخدمين", zh: "为用户启用双重认证" })}
                    </p>
                  </div>
                  <Switch
                    id="enable2FA"
                    checked={securityConfig.enable2FA}
                    onCheckedChange={(checked) =>
                      setSecurityConfig({ ...securityConfig, enable2FA: checked })
                    }
                  />
                </div>

                <Separator />

                <div className="grid gap-2">
                  <Label htmlFor="sessionTimeout">{pickLang(language, { ku: "کاتی بەسەرچوونی دانیشتن (خولەک)", en: "Session Timeout (minutes)", ar: "مهلة انتهاء الجلسة (دقائق)", zh: "会话超时（分钟）" })}</Label>
                  <Input
                    id="sessionTimeout"
                    type="number"
                    value={securityConfig.sessionTimeout}
                    onChange={(e) => setSecurityConfig({ ...securityConfig, sessionTimeout: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    {pickLang(language, { ku: "بەکارهێنەر دەرکراوە دوای ئەم کاتە بێ چالاکی", en: "User is logged out after this period of inactivity", ar: "يتم تسجيل خروج المستخدم بعد هذه المدة من عدم النشاط", zh: "用户在此段时间无活动后将被登出" })}
                  </p>
                </div>

                <Separator />

                <div className="grid gap-2">
                  <Label htmlFor="auditRetentionDays">{pickLang(language, { ku: "ماوەی هێشتنەوەی لۆگی چاودێری (ڕۆژ)", en: "Audit Log Retention (days)", ar: "مدة الاحتفاظ بسجل التدقيق (أيام)", zh: "审计日志保留（天）" })}</Label>
                  <Input
                    id="auditRetentionDays"
                    type="number"
                    value={securityConfig.auditRetentionDays}
                    onChange={(e) => setSecurityConfig({ ...securityConfig, auditRetentionDays: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    {pickLang(language, { ku: "لۆگەکانی چاودێری دوای ئەم ماوەیە دەسڕێنەوە", en: "Audit logs are deleted after this period", ar: "تُحذف سجلات التدقيق بعد هذه المدة", zh: "审计日志在此期限后将被删除" })}
                  </p>
                </div>

                <Separator />

                <div className="grid gap-2">
                  <Label htmlFor="passwordMinLength">{pickLang(language, { ku: "کەمترین درێژی وشەی نهێنی", en: "Minimum Password Length", ar: "الحد الأدنى لطول كلمة المرور", zh: "密码最小长度" })}</Label>
                  <Input
                    id="passwordMinLength"
                    type="number"
                    value={securityConfig.passwordMinLength}
                    onChange={(e) => setSecurityConfig({ ...securityConfig, passwordMinLength: e.target.value })}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="requirePasswordChange">{pickLang(language, { ku: "پێویستی بە گۆڕینی وشەی نهێنی", en: "Require Password Change", ar: "إلزام تغيير كلمة المرور", zh: "要求更改密码" })}</Label>
                    <p className="text-sm text-muted-foreground">
                      {pickLang(language, { ku: "بەکارهێنەران پێویستە وشەی نهێنی بگۆڕن هەر 90 ڕۆژ", en: "Users must change their password every 90 days", ar: "يجب على المستخدمين تغيير كلمة المرور كل 90 يومًا", zh: "用户必须每 90 天更改一次密码" })}
                    </p>
                  </div>
                  <Switch
                    id="requirePasswordChange"
                    checked={securityConfig.requirePasswordChange}
                    onCheckedChange={(checked) =>
                      setSecurityConfig({ ...securityConfig, requirePasswordChange: checked })
                    }
                  />
                </div>
              </div>

              <Button onClick={handleSaveSecurityConfig} disabled={setSetting.isPending} className="w-full">
                <Save className="h-4 w-4 ms-2" />
                {setSetting.isPending ? pickLang(language, { ku: "چاوەڕێ بە...", en: "Please wait...", ar: "يرجى الانتظار...", zh: "请稍候..." }) : pickLang(language, { ku: "پاشەکەوتکردن", en: "Save", ar: "حفظ", zh: "保存" })}
              </Button>
            </CardContent>
          </Card>

          <div className="mt-6">
            <DeadPhotoCleanupCard />
          </div>
        </TabsContent>

        {/* User Experience Configuration */}
        <TabsContent value="ux">
          <Card>
            <CardHeader>
              <CardTitle>{pickLang(language, { ku: "ڕێکخستنەکانی ئەزموونی بەکارهێنەر", en: "User Experience Settings", ar: "إعدادات تجربة المستخدم", zh: "用户体验设置" })}</CardTitle>
              <CardDescription>
                {pickLang(language, { ku: "دەستکاری زمان، ڕووکار و فۆرماتەکان", en: "Customize language, theme and formats", ar: "تخصيص اللغة والمظهر والتنسيقات", zh: "自定义语言、主题和格式" })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="defaultLanguage">{pickLang(language, { ku: "زمانی بنەڕەت", en: "Default Language", ar: "اللغة الافتراضية", zh: "默认语言" })}</Label>
                  <Select
                    value={uxConfig.defaultLanguage}
                    onValueChange={(value) => setUxConfig({ ...uxConfig, defaultLanguage: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ku">{pickLang(language, { ku: "کوردی", en: "Kurdish", ar: "الكردية", zh: "库尔德语" })}</SelectItem>
                      <SelectItem value="ar">{pickLang(language, { ku: "عەرەبی", en: "Arabic", ar: "العربية", zh: "阿拉伯语" })}</SelectItem>
                      <SelectItem value="en">{pickLang(language, { ku: "ئینگلیزی", en: "English", ar: "الإنجليزية", zh: "英语" })}</SelectItem>
                      <SelectItem value="tr">{pickLang(language, { ku: "تورکی", en: "Turkish", ar: "التركية", zh: "土耳其语" })}</SelectItem>
                      <SelectItem value="fa">{pickLang(language, { ku: "فارسی", en: "Persian", ar: "الفارسية", zh: "波斯语" })}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="grid gap-2">
                  <Label htmlFor="dateFormat">{pickLang(language, { ku: "فۆرماتی بەروار", en: "Date Format", ar: "تنسيق التاريخ", zh: "日期格式" })}</Label>
                  <Select
                    value={uxConfig.dateFormat}
                    onValueChange={(value) => setUxConfig({ ...uxConfig, dateFormat: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                      <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                      <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                      <SelectItem value="DD-MM-YYYY">DD-MM-YYYY</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="grid gap-2">
                  <Label htmlFor="timeFormat">{pickLang(language, { ku: "فۆرماتی کات", en: "Time Format", ar: "تنسيق الوقت", zh: "时间格式" })}</Label>
                  <Select
                    value={uxConfig.timeFormat}
                    onValueChange={(value) => setUxConfig({ ...uxConfig, timeFormat: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="24h">{pickLang(language, { ku: "24 کاتژمێر", en: "24 hour", ar: "24 ساعة", zh: "24 小时制" })}</SelectItem>
                      <SelectItem value="12h">{pickLang(language, { ku: "12 کاتژمێر (AM/PM)", en: "12 hour (AM/PM)", ar: "12 ساعة (ص/م)", zh: "12 小时制 (AM/PM)" })}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="grid gap-2">
                  <Label htmlFor="theme">{pickLang(language, { ku: "ڕووکار", en: "Theme", ar: "المظهر", zh: "主题" })}</Label>
                  <Select
                    value={uxConfig.theme}
                    onValueChange={(value) => setUxConfig({ ...uxConfig, theme: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">{pickLang(language, { ku: "ڕووناک", en: "Light", ar: "فاتح", zh: "浅色" })}</SelectItem>
                      <SelectItem value="dark">{pickLang(language, { ku: "تاریک", en: "Dark", ar: "داكن", zh: "深色" })}</SelectItem>
                      <SelectItem value="auto">{pickLang(language, { ku: "ئۆتۆماتیک", en: "Auto", ar: "تلقائي", zh: "自动" })}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="grid gap-2">
                  <Label htmlFor="itemsPerPage">{pickLang(language, { ku: "ژمارەی بڕگە بۆ هەر پەڕەیەک", en: "Items Per Page", ar: "عدد العناصر في كل صفحة", zh: "每页条目数" })}</Label>
                  <Select
                    value={uxConfig.itemsPerPage}
                    onValueChange={(value) => setUxConfig({ ...uxConfig, itemsPerPage: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button onClick={handleSaveUxConfig} disabled={setSetting.isPending} className="w-full">
                <Save className="h-4 w-4 ms-2" />
                {setSetting.isPending ? pickLang(language, { ku: "چاوەڕێ بە...", en: "Please wait...", ar: "يرجى الانتظار...", zh: "请稍候..." }) : pickLang(language, { ku: "پاشەکەوتکردن", en: "Save", ar: "حفظ", zh: "保存" })}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
