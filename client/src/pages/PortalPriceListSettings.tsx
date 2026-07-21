import { useState, useEffect, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Save, Loader2, Eye, Settings, Plane, Wrench, DollarSign, Tag, Info,
  Ship, Zap, Package, Truck, Sparkles, TrendingUp, Flame, Star, Rocket,
  Award, ShoppingBag, Globe, Clock, Layers, Plus,
} from "lucide-react";
import { PriceListSection } from "@/components/portal/PriceListSection";

// ---------------------------------------------------------------------------
// Admin settings page — `/settings/portal-price-list`
// ---------------------------------------------------------------------------
// Three tabs:
//
//   1. General     — enable/disable, 4-language title & subtitle, toggles,
//                    layout variant, accent color, 4-language disclaimer.
//   2. Shipping    — per-row portal toggle + per-language label + icon/color
//                    picker + sort order on existing pricingRules.
//   3. Services    — per-row portal toggle + per-language description + badge
//                    on existing serviceTypes.
//
// A live preview renders at the bottom of General using the same
// <PriceListSection/> the customer actually sees, so admins never save blind.
// ---------------------------------------------------------------------------

const ICON_OPTIONS = [
  "Plane", "Ship", "Zap", "Package", "Truck", "Sparkles",
  "DollarSign", "Wrench", "TrendingUp", "Flame", "Star", "Rocket",
  "Award", "ShoppingBag", "Globe", "Clock", "Layers",
];

const ICON_COMPONENTS: Record<string, React.ComponentType<{ className?: string }>> = {
  Plane, Ship, Zap, Package, Truck, Sparkles, DollarSign, Wrench,
  TrendingUp, Flame, Star, Rocket, Award, ShoppingBag, Globe, Clock, Layers,
};

const COLOR_OPTIONS = [
  { key: "sky",     label: "Sky",     swatch: "bg-sky-500" },
  { key: "teal",    label: "Teal",    swatch: "bg-teal-500" },
  { key: "amber",   label: "Amber",   swatch: "bg-amber-500" },
  { key: "purple",  label: "Purple",  swatch: "bg-purple-500" },
  { key: "emerald", label: "Emerald", swatch: "bg-emerald-500" },
  { key: "rose",    label: "Rose",    swatch: "bg-rose-500" },
  { key: "indigo",  label: "Indigo",  swatch: "bg-indigo-500" },
  { key: "slate",   label: "Slate",   swatch: "bg-slate-700" },
];

const BADGE_OPTIONS = ["", "POPULAR", "NEW", "RECOMMENDED", "FAST"];

export default function PortalPriceListSettings() {
  const { t } = useTranslation();
  const utils = trpc.useUtils();

  const { data: settings, isLoading: settingsLoading } =
    trpc.portalPriceList.getSettings.useQuery();

  const { data: shippingRates, isLoading: shippingLoading } =
    trpc.portalPriceList.listShippingRatesWithMeta.useQuery();

  const { data: services, isLoading: servicesLoading } =
    trpc.portalPriceList.listServicesWithMeta.useQuery();

  const updateSettings = trpc.portalPriceList.updateSettings.useMutation({
    onSuccess: () => {
      toast.success(t("priceList.admin.saved"));
      utils.portalPriceList.getSettings.invalidate();
      utils.customerPortal.getPriceList.invalidate();
    },
    onError: (err) => {
      // eslint-disable-next-line no-console
      console.error("[PortalPriceList] save settings failed:", err);
      toast.error(t("priceList.admin.saveFailed"), { description: err.message });
    },
  });

  const updatePricingRulePortal = trpc.portalPriceList.updatePricingRulePortalFields.useMutation({
    onSuccess: () => {
      toast.success(t("priceList.admin.saved"));
      utils.portalPriceList.listShippingRatesWithMeta.invalidate();
      utils.customerPortal.getPriceList.invalidate();
    },
    onError: (err) => toast.error(t("priceList.admin.saveFailed"), { description: err.message }),
  });

  const updateServiceTypePortal = trpc.portalPriceList.updateServiceTypePortalFields.useMutation({
    onSuccess: () => {
      toast.success(t("priceList.admin.saved"));
      utils.portalPriceList.listServicesWithMeta.invalidate();
      utils.customerPortal.getPriceList.invalidate();
    },
    onError: (err) => toast.error(t("priceList.admin.saveFailed"), { description: err.message }),
  });

  // ---- Local editable state for the general-settings form ----
  const [form, setForm] = useState({
    isEnabled: true,
    titleKu: "", titleEn: "", titleAr: "", titleZh: "",
    subtitleKu: "", subtitleEn: "", subtitleAr: "", subtitleZh: "",
    showShippingRates: true,
    showServices: true,
    showRmbEquivalent: true,
    showIqdEquivalent: false,
    layoutVariant: "tabs" as "tabs" | "stacked" | "compact",
    position: "belowHeader" as "top" | "belowHeader" | "belowStats",
    accentColor: "purple",
    disclaimerKu: "", disclaimerEn: "", disclaimerAr: "", disclaimerZh: "",
  });

  useEffect(() => {
    if (!settings) return;
    setForm({
      isEnabled: settings.isEnabled,
      titleKu: settings.titleKu ?? "", titleEn: settings.titleEn ?? "",
      titleAr: settings.titleAr ?? "", titleZh: settings.titleZh ?? "",
      subtitleKu: settings.subtitleKu ?? "", subtitleEn: settings.subtitleEn ?? "",
      subtitleAr: settings.subtitleAr ?? "", subtitleZh: settings.subtitleZh ?? "",
      showShippingRates: settings.showShippingRates,
      showServices: settings.showServices,
      showRmbEquivalent: settings.showRmbEquivalent,
      showIqdEquivalent: settings.showIqdEquivalent,
      layoutVariant: settings.layoutVariant,
      position: settings.position,
      accentColor: settings.accentColor,
      disclaimerKu: settings.disclaimerKu ?? "", disclaimerEn: settings.disclaimerEn ?? "",
      disclaimerAr: settings.disclaimerAr ?? "", disclaimerZh: settings.disclaimerZh ?? "",
    });
  }, [settings]);

  function handleSaveGeneral() {
    updateSettings.mutate(form);
  }

  const isSaving = updateSettings.isPending;

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-800 p-6 shadow-lg">
          <div className="absolute inset-0 opacity-10 bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22><g fill=%22%23fff%22 fill-opacity=%22.3%22><path d=%22M0 0h1v1H0zM40 40h1v1h-1zM80 80h1v1h-1z%22/></g></svg>')]" />
          <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-white/10" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-white/15 rounded-2xl backdrop-blur-sm">
                <DollarSign className="h-7 w-7 text-amber-300" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-white">{t("priceList.admin.pageTitle")}</h1>
                <p className="text-sm text-purple-100/90 mt-1">{t("priceList.admin.pageSubtitle")}</p>
              </div>
            </div>
            {settings && (
              <Badge className={
                settings.isEnabled
                  ? "bg-emerald-500/20 text-emerald-100 border-emerald-300/30"
                  : "bg-slate-500/20 text-slate-100 border-slate-300/30"
              }>
                {settings.isEnabled ? "● Live" : "○ Hidden"}
              </Badge>
            )}
          </div>
        </div>

        <Tabs defaultValue="general" className="space-y-4">
          <TabsList className="grid grid-cols-3 w-full max-w-2xl">
            <TabsTrigger value="general" className="gap-2">
              <Settings className="h-4 w-4" /> {t("priceList.admin.tabGeneral")}
            </TabsTrigger>
            <TabsTrigger value="shipping" className="gap-2">
              <Plane className="h-4 w-4" /> {t("priceList.admin.tabShipping")}
            </TabsTrigger>
            <TabsTrigger value="services" className="gap-2">
              <Wrench className="h-4 w-4" /> {t("priceList.admin.tabServices")}
            </TabsTrigger>
          </TabsList>

          {/* ===== Tab 1: General ===== */}
          <TabsContent value="general" className="space-y-4">
            {settingsLoading ? (
              <Skeleton className="h-96 w-full rounded-2xl" />
            ) : (
              <>
                {/* Master toggle + layout */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Eye className="h-5 w-5 text-purple-600" />
                      {t("priceList.admin.enableSection")}
                    </CardTitle>
                    <CardDescription>{t("priceList.admin.enableSectionDesc")}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                      <Label className="text-base font-semibold">{t("priceList.admin.enableSection")}</Label>
                      <Switch
                        checked={form.isEnabled}
                        onCheckedChange={(v) => setForm({ ...form, isEnabled: v })}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <ToggleRow
                        label={t("priceList.admin.showShippingRates")}
                        checked={form.showShippingRates}
                        onChange={(v) => setForm({ ...form, showShippingRates: v })}
                      />
                      <ToggleRow
                        label={t("priceList.admin.showServices")}
                        checked={form.showServices}
                        onChange={(v) => setForm({ ...form, showServices: v })}
                      />
                      <ToggleRow
                        label={t("priceList.admin.showRmbEquivalent")}
                        checked={form.showRmbEquivalent}
                        onChange={(v) => setForm({ ...form, showRmbEquivalent: v })}
                      />
                      <ToggleRow
                        label={t("priceList.admin.showIqdEquivalent")}
                        checked={form.showIqdEquivalent}
                        onChange={(v) => setForm({ ...form, showIqdEquivalent: v })}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>{t("priceList.admin.layoutLabel")}</Label>
                        <Select
                          value={form.layoutVariant}
                          onValueChange={(v: any) => setForm({ ...form, layoutVariant: v })}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="tabs">{t("priceList.admin.layoutTabs")}</SelectItem>
                            <SelectItem value="stacked">{t("priceList.admin.layoutStacked")}</SelectItem>
                            <SelectItem value="compact">{t("priceList.admin.layoutCompact")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>{t("priceList.admin.positionLabel")}</Label>
                        <Select
                          value={form.position}
                          onValueChange={(v: any) => setForm({ ...form, position: v })}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="top">{t("priceList.admin.positionTop")}</SelectItem>
                            <SelectItem value="belowHeader">{t("priceList.admin.positionBelowHeader")}</SelectItem>
                            <SelectItem value="belowStats">{t("priceList.admin.positionBelowStats")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Title & subtitle in 4 langs */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Tag className="h-5 w-5 text-purple-600" />
                      {t("priceList.admin.titleLabel")} & {t("priceList.admin.subtitleLabel")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <LanguageFourField
                      label={t("priceList.admin.titleLabel")}
                      values={{ ku: form.titleKu, en: form.titleEn, ar: form.titleAr, zh: form.titleZh }}
                      onChange={(lang, v) => setForm({ ...form, [`title${lang}`]: v })}
                      t={t}
                    />
                    <LanguageFourField
                      label={t("priceList.admin.subtitleLabel")}
                      values={{ ku: form.subtitleKu, en: form.subtitleEn, ar: form.subtitleAr, zh: form.subtitleZh }}
                      onChange={(lang, v) => setForm({ ...form, [`subtitle${lang}`]: v })}
                      t={t}
                    />
                  </CardContent>
                </Card>

                {/* Disclaimer */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Info className="h-5 w-5 text-amber-600" />
                      {t("priceList.admin.disclaimerLabel")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <LanguageFourTextarea
                      values={{ ku: form.disclaimerKu, en: form.disclaimerEn, ar: form.disclaimerAr, zh: form.disclaimerZh }}
                      onChange={(lang, v) => setForm({ ...form, [`disclaimer${lang}`]: v })}
                      t={t}
                    />
                  </CardContent>
                </Card>

                {/* Save */}
                <div className="sticky bottom-4 z-10">
                  <div className="flex justify-end gap-2 p-4 rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-md shadow-lg border border-slate-200 dark:border-slate-700">
                    <Button
                      onClick={handleSaveGeneral}
                      disabled={isSaving}
                      size="lg"
                      className="bg-purple-600 hover:bg-purple-700 text-white shadow-md"
                    >
                      {isSaving ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Save className="h-4 w-4 me-2" />}
                      {isSaving ? t("priceList.admin.saving") : t("priceList.admin.save")}
                    </Button>
                  </div>
                </div>

                {/* Live preview */}
                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Eye className="h-5 w-5 text-indigo-600" />
                      {t("priceList.admin.preview")}
                    </CardTitle>
                    <CardDescription>
                      {t("priceList.admin.pageSubtitle")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="border-t bg-slate-50 dark:bg-slate-900/30 rounded-b-xl">
                      <PriceListSection />
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* ===== Tab 2: Shipping ===== */}
          <TabsContent value="shipping" className="space-y-4">
            <QuickPriceCard />
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Plane className="h-5 w-5 text-purple-600" />
                      {t("priceList.admin.tabShipping")}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {t("priceList.admin.shippingTabHint") || "نرخە گواستنەوەکان لێرە دادەنرێن و ڕێکدەخرێن بۆ نیشاندان لە پۆرتاڵ."}
                    </CardDescription>
                  </div>
                  <AddShippingRateDialog t={t} onCreated={() => {
                    utils.portalPriceList.listShippingRatesWithMeta.invalidate();
                    utils.customerPortal.getPriceList.invalidate();
                  }} />
                </div>
              </CardHeader>
              <CardContent>
                {shippingLoading ? (
                  <div className="space-y-3">
                    {[0, 1, 2].map(i => <Skeleton key={i} className="h-48 w-full rounded-xl" />)}
                  </div>
                ) : shippingRates && shippingRates.length > 0 ? (
                  <div className="space-y-4">
                    {shippingRates.map((rate) => (
                      <ShippingRateEditor
                        key={rate.id}
                        rate={rate}
                        onSave={(fields) => updatePricingRulePortal.mutate({ id: rate.id, ...fields })}
                        isSaving={updatePricingRulePortal.isPending}
                        t={t}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 px-6 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30">
                    <div className="inline-flex p-4 rounded-2xl bg-purple-100 dark:bg-purple-900/30 mb-4">
                      <Plane className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                    </div>
                    <h3 className="text-base font-bold mb-1">{t("priceList.noRates")}</h3>
                    <p className="text-sm text-muted-foreground mb-5 max-w-md mx-auto">
                      {t("priceList.admin.noRatesHint") || "هێشتا نرخێکت زیاد نەکردووە. کرتە لە دوگمەی خوارەوە بکە بۆ دانانی یەکەم نرخ."}
                    </p>
                    <AddShippingRateDialog t={t} onCreated={() => {
                      utils.portalPriceList.listShippingRatesWithMeta.invalidate();
                      utils.customerPortal.getPriceList.invalidate();
                    }} />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== Tab 3: Services ===== */}
          <TabsContent value="services">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Wrench className="h-5 w-5 text-purple-600" />
                      {t("priceList.admin.tabServices")}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {t("priceList.admin.servicesTabHint") || "خزمەتگوزاریەکان لێرە دادەنرێن و ڕێکدەخرێن بۆ نیشاندان لە پۆرتاڵ."}
                    </CardDescription>
                  </div>
                  <AddServiceTypeDialog t={t} onCreated={() => {
                    utils.portalPriceList.listServicesWithMeta.invalidate();
                    utils.customerPortal.getPriceList.invalidate();
                  }} />
                </div>
              </CardHeader>
              <CardContent>
                {servicesLoading ? (
                  <div className="space-y-3">
                    {[0, 1, 2].map(i => <Skeleton key={i} className="h-48 w-full rounded-xl" />)}
                  </div>
                ) : services && services.length > 0 ? (
                  <div className="space-y-4">
                    {services.map((service) => (
                      <ServiceTypeEditor
                        key={service.id}
                        service={service}
                        onSave={(fields) => updateServiceTypePortal.mutate({ id: service.id, ...fields })}
                        isSaving={updateServiceTypePortal.isPending}
                        t={t}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 px-6 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30">
                    <div className="inline-flex p-4 rounded-2xl bg-purple-100 dark:bg-purple-900/30 mb-4">
                      <Wrench className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                    </div>
                    <h3 className="text-base font-bold mb-1">{t("priceList.noServices")}</h3>
                    <p className="text-sm text-muted-foreground mb-5 max-w-md mx-auto">
                      {t("priceList.admin.noServicesHint") || "هێشتا خزمەتگوزاریت زیاد نەکردووە."}
                    </p>
                    <AddServiceTypeDialog t={t} onCreated={() => {
                      utils.portalPriceList.listServicesWithMeta.invalidate();
                      utils.customerPortal.getPriceList.invalidate();
                    }} />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

// Quick price update — the three portal shipping prices in three fields plus
// one Save. Auto-creates the third card (air_irregular) when its price is
// filled and forces all three visible on the portal. For fast daily edits.
function QuickPriceCard() {
  const { t, language } = useTranslation();
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.portalPriceList.getQuickPrices.useQuery();

  const [form, setForm] = useState({ air_regular: "", air_irregular: "", sea: "" });
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (data && !touched) {
      setForm({
        air_regular: data.air_regular ?? "",
        air_irregular: data.air_irregular ?? "",
        sea: data.sea ?? "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const save = trpc.portalPriceList.quickUpdatePrices.useMutation({
    onSuccess: () => {
      toast.success(t("priceList.admin.saved"));
      utils.portalPriceList.getQuickPrices.invalidate();
      utils.portalPriceList.listShippingRatesWithMeta.invalidate();
      utils.customerPortal.getPriceList.invalidate();
      setTouched(false);
    },
    onError: (err) => toast.error(t("priceList.admin.saveFailed"), { description: err.message }),
  });

  const fields: { key: "air_regular" | "air_irregular" | "sea"; icon: React.ComponentType<{ className?: string }>; label: string; unit: string }[] = [
    { key: "air_regular", icon: Plane, label: pickLang(language, { ku: "ئاسمانی ئاسایی", en: "Air (regular)", ar: "جوي عادي", zh: "空运（常规）" }), unit: "kg" },
    { key: "air_irregular", icon: Zap, label: pickLang(language, { ku: "ئاسمانی نائاسایی", en: "Air (irregular)", ar: "جوي غير عادي", zh: "空运（非常规）" }), unit: "kg" },
    { key: "sea", icon: Ship, label: pickLang(language, { ku: "دەریایی", en: "Sea", ar: "بحري", zh: "海运" }), unit: "m³" },
  ];

  return (
    <Card className="border-purple-200 dark:border-purple-900/50 bg-gradient-to-br from-purple-50/60 to-indigo-50/40 dark:from-purple-950/20 dark:to-indigo-950/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-purple-600" />
          {pickLang(language, { ku: "نوێکردنەوەی خێرای نرخ", en: "Quick price update", ar: "تحديث سريع للأسعار", zh: "快速更新价格" })}
        </CardTitle>
        <CardDescription>
          {pickLang(language, {
            ku: "نرخی هەر سێ جۆرەکە لێرە بنووسە و پاشەکەوتی بکە. کارتی سێیەم خۆکارانە زیاد دەبێت و لە پۆرتاڵ دەردەکەوێت.",
            en: "Set all three prices here and save. The third card is added automatically and shown on the portal.",
            ar: "أدخل الأسعار الثلاثة هنا واحفظ. تُضاف البطاقة الثالثة تلقائيًا وتظهر في البوابة.",
            zh: "在此设置三种价格并保存。第三张卡片会自动添加并显示在门户中。",
          })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Skeleton className="h-24 w-full rounded-xl" />
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {fields.map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <f.icon className="h-3.5 w-3.5" /> {f.label}
                  </Label>
                  <div className="relative">
                    <DollarSign className="absolute start-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      inputMode="decimal"
                      value={form[f.key]}
                      onChange={(e) => { setForm({ ...form, [f.key]: e.target.value }); setTouched(true); }}
                      className="ps-7 pe-10 font-mono font-bold text-lg"
                      placeholder="0.00"
                    />
                    <span className="absolute end-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">/ {f.unit}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <Button
                onClick={() => save.mutate(form)}
                disabled={save.isPending || !touched}
                className="bg-purple-600 hover:bg-purple-700 text-white shadow-md"
              >
                {save.isPending ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Save className="h-4 w-4 me-2" />}
                {save.isPending ? t("priceList.admin.saving") : t("priceList.admin.save")}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ToggleRow({
  label, checked, onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
      <Label className="text-sm font-medium">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function LanguageFourField({
  label, values, onChange, t,
}: {
  label: string;
  values: { ku: string; en: string; ar: string; zh: string };
  onChange: (lang: "Ku" | "En" | "Ar" | "Zh", v: string) => void;
  t: (k: string) => string;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {(["Ku", "En", "Ar", "Zh"] as const).map((lang) => (
        <div key={lang} className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground">
            {label} — {t(`priceList.admin.${lang.toLowerCase()}Label`)}
          </Label>
          <Input
            value={values[lang.toLowerCase() as keyof typeof values]}
            onChange={(e) => onChange(lang, e.target.value)}
            dir={lang === "Ku" || lang === "Ar" ? "rtl" : "ltr"}
            placeholder={label}
          />
        </div>
      ))}
    </div>
  );
}

function LanguageFourTextarea({
  values, onChange, t,
}: {
  values: { ku: string; en: string; ar: string; zh: string };
  onChange: (lang: "Ku" | "En" | "Ar" | "Zh", v: string) => void;
  t: (k: string) => string;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {(["Ku", "En", "Ar", "Zh"] as const).map((lang) => (
        <div key={lang} className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground">
            {t(`priceList.admin.${lang.toLowerCase()}Label`)}
          </Label>
          <Textarea
            rows={3}
            value={values[lang.toLowerCase() as keyof typeof values]}
            onChange={(e) => onChange(lang, e.target.value)}
            dir={lang === "Ku" || lang === "Ar" ? "rtl" : "ltr"}
          />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-row editors (shipping rate, service type)
// ---------------------------------------------------------------------------

function ShippingRateEditor({
  rate, onSave, isSaving, t,
}: {
  rate: any;
  onSave: (fields: any) => void;
  isSaving: boolean;
  t: (k: string) => string;
}) {
  const utils = trpc.useUtils();
  // Also edit base pricingRule fields — price and isActive — inline so the
  // admin doesn't need to navigate to /settings/pricing.
  const updateBase = trpc.pricing.update.useMutation({
    onSuccess: () => {
      toast.success(t("priceList.admin.saved"));
      utils.portalPriceList.listShippingRatesWithMeta.invalidate();
      utils.customerPortal.getPriceList.invalidate();
    },
    onError: (err) => toast.error(t("priceList.admin.saveFailed"), { description: err.message }),
  });

  const [local, setLocal] = useState({
    // Base fields (price + active state)
    pricePerUnit: rate.pricePerUnit?.toString() ?? "0",
    isActive: rate.isActive ?? true,
    // Portal display fields
    showOnPortal: rate.showOnPortal ?? false,
    portalLabelKu: rate.portalLabelKu ?? "",
    portalLabelEn: rate.portalLabelEn ?? "",
    portalLabelAr: rate.portalLabelAr ?? "",
    portalLabelZh: rate.portalLabelZh ?? "",
    portalIcon: rate.portalIcon ?? "",
    portalColor: rate.portalColor ?? "",
    portalBadge: rate.portalBadge ?? "",
    portalSortOrder: rate.portalSortOrder ?? 0,
  });

  const PreviewIcon = useMemo(() => ICON_COMPONENTS[local.portalIcon] ?? Plane, [local.portalIcon]);
  const baseDirty = useMemo(() => {
    const pricesDiffer = (parseFloat(local.pricePerUnit) || 0) !== (parseFloat(rate.pricePerUnit?.toString() ?? "0") || 0);
    return pricesDiffer || local.isActive !== (rate.isActive ?? true);
  }, [local, rate]);

  const portalDirty = useMemo(() => {
    return (
      local.showOnPortal !== (rate.showOnPortal ?? false) ||
      (local.portalLabelKu || "") !== (rate.portalLabelKu || "") ||
      (local.portalLabelEn || "") !== (rate.portalLabelEn || "") ||
      (local.portalLabelAr || "") !== (rate.portalLabelAr || "") ||
      (local.portalLabelZh || "") !== (rate.portalLabelZh || "") ||
      (local.portalIcon || "") !== (rate.portalIcon || "") ||
      (local.portalColor || "") !== (rate.portalColor || "") ||
      (local.portalBadge || "") !== (rate.portalBadge || "") ||
      local.portalSortOrder !== (rate.portalSortOrder ?? 0)
    );
  }, [local, rate]);

  const isDirty = baseDirty || portalDirty;

  async function handleSave() {
    try {
      // Save base fields first (if dirty) via pricing.update, then portal fields
      // (if dirty) via the existing onSave callback. Two separate mutations so
      // audit logs cleanly split "price change" from "portal display change".
      if (baseDirty) {
        await updateBase.mutateAsync({
          id: rate.id,
          pricePerUnit: local.pricePerUnit,
          isActive: local.isActive,
        });
      }
      if (portalDirty) {
        onSave({
          showOnPortal: local.showOnPortal,
          portalLabelKu: local.portalLabelKu || null,
          portalLabelEn: local.portalLabelEn || null,
          portalLabelAr: local.portalLabelAr || null,
          portalLabelZh: local.portalLabelZh || null,
          portalIcon: local.portalIcon || null,
          portalColor: local.portalColor || null,
          portalBadge: local.portalBadge || null,
          portalSortOrder: local.portalSortOrder,
        });
      }
    } catch (err) {
      // Errors are surfaced by the mutation's onError; swallow here so the UI
      // doesn't blow up on a rejected promise.
    }
  }

  return (
    <div className={`rounded-2xl border overflow-hidden transition-colors ${
      local.isActive
        ? "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
        : "border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 opacity-70"
    }`}>
      {/* Header row — price + isActive + showOnPortal */}
      <div className="flex items-center justify-between gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 flex-wrap">
        <div className="flex items-center gap-3 flex-1 min-w-[180px]">
          <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
            <PreviewIcon className="h-5 w-5 text-slate-700 dark:text-slate-300" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate">
              {t(`priceList.shippingTypes.${rate.shippingType}`)}
            </p>
            <p className="text-[11px] text-muted-foreground">#{rate.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Inline price editor */}
          <div className="relative">
            <DollarSign className="absolute start-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              type="number"
              step="0.01"
              min="0"
              value={local.pricePerUnit}
              onChange={(e) => setLocal({ ...local, pricePerUnit: e.target.value })}
              className="ps-7 w-28 font-mono font-bold"
            />
          </div>
          <span className="text-xs font-medium text-muted-foreground">
            / {rate.unit === "cbm" ? "m³" : "kg"}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">
              {local.isActive ? t("priceList.admin.active") : t("priceList.admin.inactive")}
            </Label>
            <Switch
              checked={local.isActive}
              onCheckedChange={(v) => setLocal({ ...local, isActive: v })}
            />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">{t("priceList.admin.showOnPortal")}</Label>
            <Switch
              checked={local.showOnPortal}
              onCheckedChange={(v) => setLocal({ ...local, showOnPortal: v })}
            />
          </div>
        </div>
      </div>

      {/* Body — labels/icon/color */}
      <div className="p-4 space-y-4">
        {/* 4-language labels */}
        <LanguageFourField
          label={t("priceList.admin.portalLabel")}
          values={{
            ku: local.portalLabelKu, en: local.portalLabelEn,
            ar: local.portalLabelAr, zh: local.portalLabelZh,
          }}
          onChange={(lang, v) => setLocal({ ...local, [`portalLabel${lang}`]: v })}
          t={t}
        />

        {/* Icon picker */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-muted-foreground">{t("priceList.admin.portalIcon")}</Label>
          <div className="flex flex-wrap gap-2">
            {ICON_OPTIONS.map((name) => {
              const I = ICON_COMPONENTS[name];
              const active = local.portalIcon === name;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => setLocal({ ...local, portalIcon: active ? "" : name })}
                  className={`p-2 rounded-lg border transition-all ${
                    active
                      ? "border-purple-500 bg-purple-50 dark:bg-purple-950 ring-2 ring-purple-200 dark:ring-purple-800"
                      : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                  }`}
                  title={name}
                >
                  <I className="h-4 w-4" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Color + Badge + Sort order */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground">{t("priceList.admin.portalColor")}</Label>
            <div className="flex flex-wrap gap-2">
              {COLOR_OPTIONS.map((c) => {
                const active = local.portalColor === c.key;
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setLocal({ ...local, portalColor: active ? "" : c.key })}
                    className={`w-7 h-7 rounded-lg transition-all ${c.swatch} ${
                      active ? "ring-2 ring-offset-2 ring-slate-900 dark:ring-white scale-110" : "hover:scale-110"
                    }`}
                    title={c.label}
                  />
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground">{t("priceList.admin.portalBadge")}</Label>
            <Select
              value={local.portalBadge || "__none__"}
              onValueChange={(v) => setLocal({ ...local, portalBadge: v === "__none__" ? "" : v })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t("priceList.admin.noneBadge")}</SelectItem>
                <SelectItem value="POPULAR">🔥 {t("priceList.admin.badgePopular")}</SelectItem>
                <SelectItem value="NEW">✨ {t("priceList.admin.badgeNew")}</SelectItem>
                <SelectItem value="RECOMMENDED">⭐ {t("priceList.admin.badgeRecommended")}</SelectItem>
                <SelectItem value="FAST">⚡ {t("priceList.admin.badgeFast")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground">{t("priceList.admin.sortOrder")}</Label>
            <Input
              type="number"
              value={local.portalSortOrder}
              onChange={(e) => setLocal({ ...local, portalSortOrder: parseInt(e.target.value) || 0 })}
            />
          </div>
        </div>

        {/* Save row */}
        <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!isDirty || isSaving || updateBase.isPending}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            {(isSaving || updateBase.isPending) ? <Loader2 className="h-3.5 w-3.5 me-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 me-1.5" />}
            {(isSaving || updateBase.isPending) ? t("priceList.admin.saving") : t("priceList.admin.save")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ServiceTypeEditor({
  service, onSave, isSaving, t,
}: {
  service: any;
  onSave: (fields: any) => void;
  isSaving: boolean;
  t: (k: string) => string;
}) {
  const utils = trpc.useUtils();
  // Admins edit the service's name, price and active flag inline; chained
  // with portal fields so the save button updates both at once.
  const updateBase = trpc.extraServices.updateServiceType.useMutation({
    onSuccess: () => {
      toast.success(t("priceList.admin.saved"));
      utils.portalPriceList.listServicesWithMeta.invalidate();
      utils.customerPortal.getPriceList.invalidate();
    },
    onError: (err) => toast.error(t("priceList.admin.saveFailed"), { description: err.message }),
  });

  const [local, setLocal] = useState({
    // Base fields
    nameKu: service.nameKu ?? "",
    nameEn: service.nameEn ?? "",
    nameAr: service.nameAr ?? "",
    defaultPrice: service.defaultPrice?.toString() ?? "",
    isActive: service.isActive ?? true,
    // Portal display fields
    showOnPortal: service.showOnPortal ?? false,
    portalDescriptionKu: service.portalDescriptionKu ?? "",
    portalDescriptionEn: service.portalDescriptionEn ?? "",
    portalDescriptionAr: service.portalDescriptionAr ?? "",
    portalDescriptionZh: service.portalDescriptionZh ?? "",
    portalBadge: service.portalBadge ?? "",
    portalPriceLabelKu: service.portalPriceLabelKu ?? "",
    portalPriceLabelEn: service.portalPriceLabelEn ?? "",
    portalPriceLabelAr: service.portalPriceLabelAr ?? "",
    portalPriceLabelZh: service.portalPriceLabelZh ?? "",
  });

  const ServiceIcon = useMemo(() => ICON_COMPONENTS[service.icon] ?? Wrench, [service.icon]);

  const baseDirty = useMemo(() => {
    const priceDiffers = (parseFloat(local.defaultPrice) || 0) !== (parseFloat(service.defaultPrice?.toString() ?? "0") || 0);
    return (
      priceDiffers ||
      local.isActive !== (service.isActive ?? true) ||
      (local.nameKu || "") !== (service.nameKu || "") ||
      (local.nameEn || "") !== (service.nameEn || "") ||
      (local.nameAr || "") !== (service.nameAr || "")
    );
  }, [local, service]);

  const portalDirty = useMemo(() => {
    return (
      local.showOnPortal !== (service.showOnPortal ?? false) ||
      (local.portalDescriptionKu || "") !== (service.portalDescriptionKu || "") ||
      (local.portalDescriptionEn || "") !== (service.portalDescriptionEn || "") ||
      (local.portalDescriptionAr || "") !== (service.portalDescriptionAr || "") ||
      (local.portalDescriptionZh || "") !== (service.portalDescriptionZh || "") ||
      (local.portalBadge || "") !== (service.portalBadge || "") ||
      (local.portalPriceLabelKu || "") !== (service.portalPriceLabelKu || "") ||
      (local.portalPriceLabelEn || "") !== (service.portalPriceLabelEn || "") ||
      (local.portalPriceLabelAr || "") !== (service.portalPriceLabelAr || "") ||
      (local.portalPriceLabelZh || "") !== (service.portalPriceLabelZh || "")
    );
  }, [local, service]);

  const isDirty = baseDirty || portalDirty;

  async function handleSave() {
    try {
      if (baseDirty) {
        await updateBase.mutateAsync({
          id: service.id,
          nameEn: local.nameEn || local.nameKu || local.nameAr,
          nameKu: local.nameKu || undefined,
          nameAr: local.nameAr || undefined,
          defaultPrice: local.defaultPrice || undefined,
          isActive: local.isActive,
        });
      }
      if (portalDirty) {
        onSave({
          showOnPortal: local.showOnPortal,
          portalDescriptionKu: local.portalDescriptionKu || null,
          portalDescriptionEn: local.portalDescriptionEn || null,
          portalDescriptionAr: local.portalDescriptionAr || null,
          portalDescriptionZh: local.portalDescriptionZh || null,
          portalBadge: local.portalBadge || null,
          portalPriceLabelKu: local.portalPriceLabelKu || null,
          portalPriceLabelEn: local.portalPriceLabelEn || null,
          portalPriceLabelAr: local.portalPriceLabelAr || null,
          portalPriceLabelZh: local.portalPriceLabelZh || null,
        });
      }
    } catch {
      // mutation onError already surfaces to the user via toast
    }
  }

  return (
    <div className={`rounded-2xl border overflow-hidden transition-colors ${
      local.isActive
        ? "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
        : "border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 opacity-70"
    }`}>
      {/* Header — price + isActive + showOnPortal */}
      <div className="flex items-center justify-between gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 flex-wrap">
        <div className="flex items-center gap-3 flex-1 min-w-[180px]">
          <div
            className="p-2 rounded-lg text-white shadow-md flex-shrink-0"
            style={{ backgroundColor: service.color || "#7c3aed" }}
          >
            <ServiceIcon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate">
              {local.nameKu || local.nameEn || local.nameAr}
            </p>
            <p className="text-[11px] text-muted-foreground truncate">
              {local.nameEn !== (local.nameKu || local.nameAr) ? local.nameEn + " · " : ""}#{service.id}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <DollarSign className="absolute start-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              type="number"
              step="0.01"
              min="0"
              value={local.defaultPrice}
              onChange={(e) => setLocal({ ...local, defaultPrice: e.target.value })}
              className="ps-7 w-28 font-mono font-bold"
              placeholder="0.00"
            />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">
              {local.isActive ? t("priceList.admin.active") : t("priceList.admin.inactive")}
            </Label>
            <Switch
              checked={local.isActive}
              onCheckedChange={(v) => setLocal({ ...local, isActive: v })}
            />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">{t("priceList.admin.showOnPortal")}</Label>
            <Switch
              checked={local.showOnPortal}
              onCheckedChange={(v) => setLocal({ ...local, showOnPortal: v })}
            />
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Editable names */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground">
            {t("priceList.admin.serviceName") || "ناوی خزمەتگوزاری"}
          </Label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <Input placeholder="کوردی" dir="rtl" value={local.nameKu}
              onChange={(e) => setLocal({ ...local, nameKu: e.target.value })} />
            <Input placeholder="English" value={local.nameEn}
              onChange={(e) => setLocal({ ...local, nameEn: e.target.value })} />
            <Input placeholder="عربي" dir="rtl" value={local.nameAr}
              onChange={(e) => setLocal({ ...local, nameAr: e.target.value })} />
          </div>
        </div>

        <LanguageFourTextarea
          values={{
            ku: local.portalDescriptionKu, en: local.portalDescriptionEn,
            ar: local.portalDescriptionAr, zh: local.portalDescriptionZh,
          }}
          onChange={(lang, v) => setLocal({ ...local, [`portalDescription${lang}`]: v })}
          t={t}
        />

        <LanguageFourField
          label={t("priceList.admin.portalLabel") + " (/kg, /item, etc.)"}
          values={{
            ku: local.portalPriceLabelKu, en: local.portalPriceLabelEn,
            ar: local.portalPriceLabelAr, zh: local.portalPriceLabelZh,
          }}
          onChange={(lang, v) => setLocal({ ...local, [`portalPriceLabel${lang}`]: v })}
          t={t}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground">{t("priceList.admin.portalBadge")}</Label>
            <Select
              value={local.portalBadge || "__none__"}
              onValueChange={(v) => setLocal({ ...local, portalBadge: v === "__none__" ? "" : v })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t("priceList.admin.noneBadge")}</SelectItem>
                <SelectItem value="POPULAR">🔥 {t("priceList.admin.badgePopular")}</SelectItem>
                <SelectItem value="NEW">✨ {t("priceList.admin.badgeNew")}</SelectItem>
                <SelectItem value="RECOMMENDED">⭐ {t("priceList.admin.badgeRecommended")}</SelectItem>
                <SelectItem value="FAST">⚡ {t("priceList.admin.badgeFast")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!isDirty || isSaving || updateBase.isPending}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            {(isSaving || updateBase.isPending) ? <Loader2 className="h-3.5 w-3.5 me-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 me-1.5" />}
            {(isSaving || updateBase.isPending) ? t("priceList.admin.saving") : t("priceList.admin.save")}
          </Button>
        </div>
      </div>
    </div>
  );
}


// ---------------------------------------------------------------------------
// Create dialogs — admins add new shipping rates and services directly from
// this page; no need to navigate to /settings/pricing or /service-types.
// Each dialog chains two mutations:
//   1. Creates the base record (pricingRule or serviceType) via existing API.
//   2. Saves portal-display fields (showOnPortal, label/icon/color/badge).
// Then invalidates caches so both admin list and portal page refresh.
// ---------------------------------------------------------------------------

function AddShippingRateDialog({ t, onCreated }: { t: (k: string) => string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const { data: countries } = trpc.countries.list.useQuery({ activeOnly: true });

  const [form, setForm] = useState({
    originCountryId: "",
    destinationCountryId: "",
    shippingType: "air_regular" as "air_regular" | "air_irregular" | "sea",
    pricePerUnit: "",
    effectiveFrom: new Date().toISOString().split("T")[0],
    showOnPortal: true,
    portalLabelKu: "",
    portalLabelEn: "",
    portalLabelAr: "",
    portalLabelZh: "",
    portalIcon: "",
    portalColor: "",
    portalBadge: "",
    notes: "",
  });

  // Suggest sensible icon/color defaults based on shipping type so admins
  // don't start from a blank picker. Only fills when empty.
  useEffect(() => {
    setForm(f => {
      if (f.portalIcon) return f;
      if (f.shippingType === "sea") return { ...f, portalIcon: "Ship", portalColor: "teal" };
      if (f.shippingType === "air_irregular") return { ...f, portalIcon: "Zap", portalColor: "amber" };
      return { ...f, portalIcon: "Plane", portalColor: "sky" };
    });
  }, [form.shippingType]);

  const createRule = trpc.pricing.create.useMutation();
  const updatePortalFields = trpc.portalPriceList.updatePricingRulePortalFields.useMutation();
  const isSaving = createRule.isPending || updatePortalFields.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.originCountryId || !form.destinationCountryId || !form.pricePerUnit) {
      toast.error(t("priceList.admin.fillAllRequired") || "هەموو خانە پێویستییەکان پڕ بکەرەوە");
      return;
    }
    try {
      const unit = form.shippingType === "sea" ? ("cbm" as const) : ("kg" as const);
      const rule = await createRule.mutateAsync({
        originCountryId: parseInt(form.originCountryId),
        destinationCountryId: parseInt(form.destinationCountryId),
        shippingType: form.shippingType,
        pricePerUnit: form.pricePerUnit,
        unit,
        effectiveFrom: new Date(form.effectiveFrom),
        notes: form.notes || undefined,
      });
      await updatePortalFields.mutateAsync({
        id: rule.id,
        showOnPortal: form.showOnPortal,
        portalLabelKu: form.portalLabelKu || null,
        portalLabelEn: form.portalLabelEn || null,
        portalLabelAr: form.portalLabelAr || null,
        portalLabelZh: form.portalLabelZh || null,
        portalIcon: form.portalIcon || null,
        portalColor: form.portalColor || null,
        portalBadge: form.portalBadge || null,
        portalSortOrder: 0,
      });
      toast.success(t("priceList.admin.saved"));
      setOpen(false);
      onCreated();
      setForm({
        originCountryId: "", destinationCountryId: "", shippingType: "air_regular",
        pricePerUnit: "", effectiveFrom: new Date().toISOString().split("T")[0],
        showOnPortal: true, portalLabelKu: "", portalLabelEn: "", portalLabelAr: "",
        portalLabelZh: "", portalIcon: "", portalColor: "", portalBadge: "", notes: "",
      });
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error("[AddShippingRateDialog] save failed:", err);
      toast.error(t("priceList.admin.saveFailed"), { description: err?.message });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-purple-600 hover:bg-purple-700 text-white shadow-md">
          <Plus className="h-4 w-4 me-2" />
          {t("priceList.admin.addRate") || "زیادکردنی نرخی نوێ"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plane className="h-5 w-5 text-purple-600" />
            {t("priceList.admin.addRate") || "زیادکردنی نرخی گواستنەوە"}
          </DialogTitle>
          <DialogDescription>
            {t("priceList.admin.addRateDesc") || "نرخی نوێ بۆ ڕێگایەک دابنێ. ئەگەر خوازیاربیت ڕاستەوخۆ لە پۆرتاڵ نیشانی بدەیت، توگڵی \"نیشاندان لە پۆرتاڵ\" هەڵبکە."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 py-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("priceList.admin.originCountry") || "وڵاتی سەرچاوە"} *</Label>
              <Select value={form.originCountryId} onValueChange={(v) => setForm({ ...form, originCountryId: v })}>
                <SelectTrigger><SelectValue placeholder="وڵاتێک هەڵبژێرە" /></SelectTrigger>
                <SelectContent>
                  {countries?.filter(c => c.isOrigin).map(c => (
                    <SelectItem key={c.id} value={c.id.toString()}>{c.nameKu || c.nameEn}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("priceList.admin.destinationCountry") || "وڵاتی مەبەست"} *</Label>
              <Select value={form.destinationCountryId} onValueChange={(v) => setForm({ ...form, destinationCountryId: v })}>
                <SelectTrigger><SelectValue placeholder="وڵاتێک هەڵبژێرە" /></SelectTrigger>
                <SelectContent>
                  {countries?.filter(c => c.isDestination).map(c => (
                    <SelectItem key={c.id} value={c.id.toString()}>{c.nameKu || c.nameEn}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>{t("priceList.admin.shippingType") || "جۆری گواستنەوە"} *</Label>
              <Select value={form.shippingType} onValueChange={(v: any) => setForm({ ...form, shippingType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="air_regular">{t("priceList.shippingTypes.air_regular")} ($/kg)</SelectItem>
                  <SelectItem value="air_irregular">{t("priceList.shippingTypes.air_irregular")} ($/kg)</SelectItem>
                  <SelectItem value="sea">{t("priceList.shippingTypes.sea")} ($/m³)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("priceList.admin.price") || "نرخ"} (USD) *</Label>
              <div className="relative">
                <DollarSign className="absolute start-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input type="number" step="0.01" min="0" required
                  className="ps-8" placeholder="0.00"
                  value={form.pricePerUnit}
                  onChange={(e) => setForm({ ...form, pricePerUnit: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t("priceList.admin.effectiveFrom") || "دەستپێک"} *</Label>
              <Input type="date" required
                value={form.effectiveFrom}
                onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })}
              />
            </div>
          </div>

          <div className="flex items-center gap-3 py-1">
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t("priceList.admin.portalDisplay") || "نیشاندانی پۆرتاڵ"}
            </span>
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-800/40">
            <Label className="text-sm font-semibold">{t("priceList.admin.showOnPortal")}</Label>
            <Switch checked={form.showOnPortal} onCheckedChange={(v) => setForm({ ...form, showOnPortal: v })} />
          </div>

          <LanguageFourField
            label={t("priceList.admin.portalLabel")}
            values={{ ku: form.portalLabelKu, en: form.portalLabelEn, ar: form.portalLabelAr, zh: form.portalLabelZh }}
            onChange={(lang, v) => setForm({ ...form, [`portalLabel${lang}`]: v })}
            t={t}
          />

          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">{t("priceList.admin.portalIcon")}</Label>
              <div className="flex flex-wrap gap-1.5">
                {ICON_OPTIONS.map((name) => {
                  const I = ICON_COMPONENTS[name];
                  const active = form.portalIcon === name;
                  return (
                    <button key={name} type="button"
                      onClick={() => setForm({ ...form, portalIcon: active ? "" : name })}
                      className={`p-1.5 rounded-lg border transition-all ${
                        active ? "border-purple-500 bg-purple-50 dark:bg-purple-950 ring-2 ring-purple-200 dark:ring-purple-800"
                          : "border-slate-200 dark:border-slate-700 hover:border-slate-300"
                      }`}
                    ><I className="h-4 w-4" /></button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">{t("priceList.admin.portalColor")}</Label>
                <div className="flex flex-wrap gap-1.5">
                  {COLOR_OPTIONS.map((c) => {
                    const active = form.portalColor === c.key;
                    return (
                      <button key={c.key} type="button"
                        onClick={() => setForm({ ...form, portalColor: active ? "" : c.key })}
                        className={`w-7 h-7 rounded-lg transition-all ${c.swatch} ${
                          active ? "ring-2 ring-offset-2 ring-slate-900 dark:ring-white scale-110" : "hover:scale-110"
                        }`}
                        title={c.label}
                      />
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">{t("priceList.admin.portalBadge")}</Label>
                <Select value={form.portalBadge || "__none__"}
                  onValueChange={(v) => setForm({ ...form, portalBadge: v === "__none__" ? "" : v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{t("priceList.admin.noneBadge")}</SelectItem>
                    <SelectItem value="POPULAR">🔥 {t("priceList.admin.badgePopular")}</SelectItem>
                    <SelectItem value="NEW">✨ {t("priceList.admin.badgeNew")}</SelectItem>
                    <SelectItem value="RECOMMENDED">⭐ {t("priceList.admin.badgeRecommended")}</SelectItem>
                    <SelectItem value="FAST">⚡ {t("priceList.admin.badgeFast")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("common.cancel") || "پاشگەزبوونەوە"}
            </Button>
            <Button type="submit" disabled={isSaving} className="bg-purple-600 hover:bg-purple-700 text-white">
              {isSaving ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Save className="h-4 w-4 me-2" />}
              {isSaving ? t("priceList.admin.saving") : t("priceList.admin.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


function AddServiceTypeDialog({ t, onCreated }: { t: (k: string) => string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);

  const [form, setForm] = useState({
    nameEn: "",
    nameKu: "",
    nameAr: "",
    icon: "Wrench",
    color: "#7c3aed",
    defaultCost: "",
    defaultPrice: "",
    requiresCustomer: true,
    addToCustomerBalance: true,
    sortOrder: 0,
    isActive: true,
    showOnPortal: true,
    portalDescriptionKu: "",
    portalDescriptionEn: "",
    portalDescriptionAr: "",
    portalDescriptionZh: "",
    portalBadge: "",
    portalPriceLabelKu: "",
    portalPriceLabelEn: "",
    portalPriceLabelAr: "",
    portalPriceLabelZh: "",
  });

  const createServiceType = trpc.extraServices.createServiceType.useMutation();
  const updatePortalFields = trpc.portalPriceList.updateServiceTypePortalFields.useMutation();
  const isSaving = createServiceType.isPending || updatePortalFields.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nameEn && !form.nameKu && !form.nameAr) {
      toast.error(t("priceList.admin.nameRequired") || "ناوی خزمەتگوزاری پێویستە (بە هەر زمانێک)");
      return;
    }
    try {
      const service = await createServiceType.mutateAsync({
        // nameEn is required server-side; fall back to any filled language so
        // admins can type Kurdish-only if they want.
        nameEn: form.nameEn || form.nameKu || form.nameAr,
        nameKu: form.nameKu || undefined,
        nameAr: form.nameAr || undefined,
        icon: form.icon || undefined,
        color: form.color || undefined,
        defaultCost: form.defaultCost || undefined,
        defaultPrice: form.defaultPrice || undefined,
        requiresCustomer: form.requiresCustomer,
        addToCustomerBalance: form.addToCustomerBalance,
        sortOrder: form.sortOrder,
        isActive: form.isActive,
      });
      await updatePortalFields.mutateAsync({
        id: service.id,
        showOnPortal: form.showOnPortal,
        portalDescriptionKu: form.portalDescriptionKu || null,
        portalDescriptionEn: form.portalDescriptionEn || null,
        portalDescriptionAr: form.portalDescriptionAr || null,
        portalDescriptionZh: form.portalDescriptionZh || null,
        portalBadge: form.portalBadge || null,
        portalPriceLabelKu: form.portalPriceLabelKu || null,
        portalPriceLabelEn: form.portalPriceLabelEn || null,
        portalPriceLabelAr: form.portalPriceLabelAr || null,
        portalPriceLabelZh: form.portalPriceLabelZh || null,
      });
      toast.success(t("priceList.admin.saved"));
      setOpen(false);
      onCreated();
      setForm({
        nameEn: "", nameKu: "", nameAr: "", icon: "Wrench", color: "#7c3aed",
        defaultCost: "", defaultPrice: "", requiresCustomer: true, addToCustomerBalance: true,
        sortOrder: 0, isActive: true,
        showOnPortal: true, portalDescriptionKu: "", portalDescriptionEn: "",
        portalDescriptionAr: "", portalDescriptionZh: "", portalBadge: "",
        portalPriceLabelKu: "", portalPriceLabelEn: "", portalPriceLabelAr: "", portalPriceLabelZh: "",
      });
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error("[AddServiceTypeDialog] save failed:", err);
      toast.error(t("priceList.admin.saveFailed"), { description: err?.message });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-purple-600 hover:bg-purple-700 text-white shadow-md">
          <Plus className="h-4 w-4 me-2" />
          {t("priceList.admin.addService") || "زیادکردنی خزمەتگوزاری"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-purple-600" />
            {t("priceList.admin.addService") || "زیادکردنی خزمەتگوزاری"}
          </DialogTitle>
          <DialogDescription>
            {t("priceList.admin.addServiceDesc") || "خزمەتگوزاری نوێ دابنێ بە نرخی پێشبڕکێ. ئەگەر خوازیاربیت ڕاستەوخۆ لە پۆرتاڵ نیشانی بدەیت، توگڵی \"نیشاندان لە پۆرتاڵ\" هەڵبکە."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">
              {t("priceList.admin.serviceName") || "ناوی خزمەتگوزاری"} *
            </Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Input placeholder="کوردی" dir="rtl"
                value={form.nameKu} onChange={(e) => setForm({ ...form, nameKu: e.target.value })} />
              <Input placeholder="English"
                value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} />
              <Input placeholder="عربي" dir="rtl"
                value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("priceList.admin.defaultCost") || "تێچووی بنەڕەتی"} (USD)</Label>
              <div className="relative">
                <DollarSign className="absolute start-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input type="number" step="0.01" className="ps-8" placeholder="0.00"
                  value={form.defaultCost} onChange={(e) => setForm({ ...form, defaultCost: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t("priceList.admin.defaultPrice") || "نرخی بنەڕەتی"} (USD)</Label>
              <div className="relative">
                <DollarSign className="absolute start-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input type="number" step="0.01" className="ps-8" placeholder="0.00"
                  value={form.defaultPrice} onChange={(e) => setForm({ ...form, defaultPrice: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">{t("priceList.admin.portalIcon")}</Label>
              <div className="flex flex-wrap gap-1.5">
                {ICON_OPTIONS.map((name) => {
                  const I = ICON_COMPONENTS[name];
                  const active = form.icon === name;
                  return (
                    <button key={name} type="button"
                      onClick={() => setForm({ ...form, icon: active ? "" : name })}
                      className={`p-1.5 rounded-lg border transition-all ${
                        active ? "border-purple-500 bg-purple-50 dark:bg-purple-950 ring-2 ring-purple-200 dark:ring-purple-800"
                          : "border-slate-200 dark:border-slate-700 hover:border-slate-300"
                      }`}
                    ><I className="h-4 w-4" /></button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">{t("priceList.admin.portalColor")}</Label>
              <div className="flex items-center gap-2">
                <Input type="color" className="w-12 h-10 p-1 cursor-pointer"
                  value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })}
                />
                <Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })}
                  placeholder="#7c3aed" className="font-mono" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 py-1">
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t("priceList.admin.portalDisplay") || "نیشاندانی پۆرتاڵ"}
            </span>
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-800/40">
            <Label className="text-sm font-semibold">{t("priceList.admin.showOnPortal")}</Label>
            <Switch checked={form.showOnPortal} onCheckedChange={(v) => setForm({ ...form, showOnPortal: v })} />
          </div>

          <LanguageFourTextarea
            values={{
              ku: form.portalDescriptionKu, en: form.portalDescriptionEn,
              ar: form.portalDescriptionAr, zh: form.portalDescriptionZh,
            }}
            onChange={(lang, v) => setForm({ ...form, [`portalDescription${lang}`]: v })}
            t={t}
          />

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">{t("priceList.admin.portalBadge")}</Label>
            <Select value={form.portalBadge || "__none__"}
              onValueChange={(v) => setForm({ ...form, portalBadge: v === "__none__" ? "" : v })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t("priceList.admin.noneBadge")}</SelectItem>
                <SelectItem value="POPULAR">🔥 {t("priceList.admin.badgePopular")}</SelectItem>
                <SelectItem value="NEW">✨ {t("priceList.admin.badgeNew")}</SelectItem>
                <SelectItem value="RECOMMENDED">⭐ {t("priceList.admin.badgeRecommended")}</SelectItem>
                <SelectItem value="FAST">⚡ {t("priceList.admin.badgeFast")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("common.cancel") || "پاشگەزبوونەوە"}
            </Button>
            <Button type="submit" disabled={isSaving} className="bg-purple-600 hover:bg-purple-700 text-white">
              {isSaving ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Save className="h-4 w-4 me-2" />}
              {isSaving ? t("priceList.admin.saving") : t("priceList.admin.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
