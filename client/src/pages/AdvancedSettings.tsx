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

export default function AdvancedSettings() {
  
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
      toast.success("ڕێکخستنەکان پاشەکەوت کران");
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
          <h1 className="text-3xl font-bold">ڕێکخستنە پێشکەوتووەکان</h1>
          <p className="text-muted-foreground">
            بەڕێوەبردنی ڕێکخستنەکانی کاروبار، ئاسایش و ئەزموونی بەکارهێنەر
          </p>
        </div>
      </div>

      <Tabs defaultValue="business" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="business" className="gap-2">
            <Building2 className="h-4 w-4" />
            کاروبار
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Shield className="h-4 w-4" />
            ئاسایش
          </TabsTrigger>
          <TabsTrigger value="ux" className="gap-2">
            <Palette className="h-4 w-4" />
            ئەزموونی بەکارهێنەر
          </TabsTrigger>
        </TabsList>

        {/* Business Configuration */}
        <TabsContent value="business">
          <Card>
            <CardHeader>
              <CardTitle>ڕێکخستنەکانی کاروبار</CardTitle>
              <CardDescription>
                ڕێکخستنەکانی گشتی کاروبار و ئۆتۆماتیکی
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="fiscalYearStart">دەستپێکی ساڵی دارایی</Label>
                  <Input
                    id="fiscalYearStart"
                    type="text"
                    value={businessConfig.fiscalYearStart}
                    onChange={(e) => setBusinessConfig({ ...businessConfig, fiscalYearStart: e.target.value })}
                    placeholder="01-01"
                  />
                  <p className="text-xs text-muted-foreground">فۆرمات: MM-DD</p>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="businessHoursStart">دەستپێکی کاتی کار</Label>
                    <Input
                      id="businessHoursStart"
                      type="time"
                      value={businessConfig.businessHoursStart}
                      onChange={(e) => setBusinessConfig({ ...businessConfig, businessHoursStart: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="businessHoursEnd">کۆتایی کاتی کار</Label>
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
                  <Label htmlFor="defaultTaxRate">نرخی باجی بنەڕەت (%)</Label>
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
                  <Label htmlFor="autoNumberingFormat">فۆرماتی ژمارەی ئۆتۆماتیکی</Label>
                  <Input
                    id="autoNumberingFormat"
                    value={businessConfig.autoNumberingFormat}
                    onChange={(e) => setBusinessConfig({ ...businessConfig, autoNumberingFormat: e.target.value })}
                    placeholder="INV-{YYYY}-{####}"
                  />
                  <p className="text-xs text-muted-foreground">
                    گۆڕاوەکان: {"{YYYY}"} (ساڵ), {"{MM}"} (مانگ), {"{####}"} (ژمارە)
                  </p>
                </div>

                <Separator />

                <div className="grid gap-2">
                  <Label htmlFor="lowStockThreshold">سنووری کەمی کاڵا</Label>
                  <Input
                    id="lowStockThreshold"
                    type="number"
                    value={businessConfig.lowStockThreshold}
                    onChange={(e) => setBusinessConfig({ ...businessConfig, lowStockThreshold: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    ئاگاداری دەنێردرێت کاتێک کاڵا لەم ژمارەیە کەمتر دەبێت
                  </p>
                </div>
              </div>

              <Button onClick={handleSaveBusinessConfig} disabled={setSetting.isPending} className="w-full">
                <Save className="h-4 w-4 ml-2" />
                {setSetting.isPending ? "چاوەڕێ بە..." : "پاشەکەوتکردن"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Configuration */}
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>ڕێکخستنەکانی ئاسایش</CardTitle>
              <CardDescription>
                بەڕێوەبردنی ئاسایش و دەستگەیشتن
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="enable2FA">چالاککردنی 2FA</Label>
                    <p className="text-sm text-muted-foreground">
                      پشتڕاستکردنەوەی دوو هێڵی بۆ بەکارهێنەران
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
                  <Label htmlFor="sessionTimeout">کاتی بەسەرچوونی دانیشتن (خولەک)</Label>
                  <Input
                    id="sessionTimeout"
                    type="number"
                    value={securityConfig.sessionTimeout}
                    onChange={(e) => setSecurityConfig({ ...securityConfig, sessionTimeout: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    بەکارهێنەر دەرکراوە دوای ئەم کاتە بێ چالاکی
                  </p>
                </div>

                <Separator />

                <div className="grid gap-2">
                  <Label htmlFor="auditRetentionDays">ماوەی هێشتنەوەی لۆگی چاودێری (ڕۆژ)</Label>
                  <Input
                    id="auditRetentionDays"
                    type="number"
                    value={securityConfig.auditRetentionDays}
                    onChange={(e) => setSecurityConfig({ ...securityConfig, auditRetentionDays: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    لۆگەکانی چاودێری دوای ئەم ماوەیە دەسڕێنەوە
                  </p>
                </div>

                <Separator />

                <div className="grid gap-2">
                  <Label htmlFor="passwordMinLength">کەمترین درێژی وشەی نهێنی</Label>
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
                    <Label htmlFor="requirePasswordChange">پێویستی بە گۆڕینی وشەی نهێنی</Label>
                    <p className="text-sm text-muted-foreground">
                      بەکارهێنەران پێویستە وشەی نهێنی بگۆڕن هەر 90 ڕۆژ
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
                <Save className="h-4 w-4 ml-2" />
                {setSetting.isPending ? "چاوەڕێ بە..." : "پاشەکەوتکردن"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* User Experience Configuration */}
        <TabsContent value="ux">
          <Card>
            <CardHeader>
              <CardTitle>ڕێکخستنەکانی ئەزموونی بەکارهێنەر</CardTitle>
              <CardDescription>
                دەستکاری زمان، ڕووکار و فۆرماتەکان
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="defaultLanguage">زمانی بنەڕەت</Label>
                  <Select
                    value={uxConfig.defaultLanguage}
                    onValueChange={(value) => setUxConfig({ ...uxConfig, defaultLanguage: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ku">کوردی</SelectItem>
                      <SelectItem value="ar">عەرەبی</SelectItem>
                      <SelectItem value="en">ئینگلیزی</SelectItem>
                      <SelectItem value="tr">تورکی</SelectItem>
                      <SelectItem value="fa">فارسی</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="grid gap-2">
                  <Label htmlFor="dateFormat">فۆرماتی بەروار</Label>
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
                  <Label htmlFor="timeFormat">فۆرماتی کات</Label>
                  <Select
                    value={uxConfig.timeFormat}
                    onValueChange={(value) => setUxConfig({ ...uxConfig, timeFormat: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="24h">24 کاتژمێر</SelectItem>
                      <SelectItem value="12h">12 کاتژمێر (AM/PM)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="grid gap-2">
                  <Label htmlFor="theme">ڕووکار</Label>
                  <Select
                    value={uxConfig.theme}
                    onValueChange={(value) => setUxConfig({ ...uxConfig, theme: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">ڕووناک</SelectItem>
                      <SelectItem value="dark">تاریک</SelectItem>
                      <SelectItem value="auto">ئۆتۆماتیک</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="grid gap-2">
                  <Label htmlFor="itemsPerPage">ژمارەی بڕگە بۆ هەر پەڕەیەک</Label>
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
                <Save className="h-4 w-4 ml-2" />
                {setSetting.isPending ? "چاوەڕێ بە..." : "پاشەکەوتکردن"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
