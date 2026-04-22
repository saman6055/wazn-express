import { useState, useEffect, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useTranslation } from "@/contexts/LanguageContext";
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
import { toast } from "sonner";
import {
  Save, Loader2, Eye, Settings, Plane, Wrench, DollarSign, Tag, Info,
  Ship, Zap, Package, Truck, Sparkles, TrendingUp, Flame, Star, Rocket,
  Award, ShoppingBag, Globe, Clock, Layers,
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
          <TabsContent value="shipping">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plane className="h-5 w-5 text-purple-600" />
                  {t("priceList.admin.tabShipping")}
                </CardTitle>
                <CardDescription>{t("priceList.admin.pageSubtitle")}</CardDescription>
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
                  <p className="text-sm text-muted-foreground text-center py-8">{t("priceList.noRates")}</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== Tab 3: Services ===== */}
          <TabsContent value="services">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-5 w-5 text-purple-600" />
                  {t("priceList.admin.tabServices")}
                </CardTitle>
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
                  <p className="text-sm text-muted-foreground text-center py-8">{t("priceList.noServices")}</p>
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
  const [local, setLocal] = useState({
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
  const isDirty = useMemo(() => {
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

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-900">
      {/* Header row */}
      <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
            <PreviewIcon className="h-5 w-5 text-slate-700 dark:text-slate-300" />
          </div>
          <div>
            <p className="text-sm font-bold">
              {t(`priceList.shippingTypes.${rate.shippingType}`)}
              {" · "}
              <span className="font-mono text-purple-600">${Number(rate.pricePerUnit).toFixed(2)}</span>
              <span className="text-xs text-muted-foreground ms-1">
                / {rate.unit === "cbm" ? "m³" : "kg"}
              </span>
            </p>
            <p className="text-[11px] text-muted-foreground">#{rate.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Label className="text-sm">{t("priceList.admin.showOnPortal")}</Label>
          <Switch
            checked={local.showOnPortal}
            onCheckedChange={(v) => setLocal({ ...local, showOnPortal: v })}
          />
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
            onClick={() => onSave(local)}
            disabled={!isDirty || isSaving}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 me-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 me-1.5" />}
            {isSaving ? t("priceList.admin.saving") : t("priceList.admin.save")}
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
  const [local, setLocal] = useState({
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

  const isDirty = useMemo(() => {
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

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <div
            className="p-2 rounded-lg text-white shadow-md"
            style={{ backgroundColor: service.color || "#7c3aed" }}
          >
            <ServiceIcon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold">
              {service.nameKu || service.nameEn || service.nameAr}
              {service.defaultPrice && (
                <>
                  {" · "}
                  <span className="font-mono text-purple-600">${Number(service.defaultPrice).toFixed(2)}</span>
                </>
              )}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {service.nameEn} · #{service.id}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Label className="text-sm">{t("priceList.admin.showOnPortal")}</Label>
          <Switch
            checked={local.showOnPortal}
            onCheckedChange={(v) => setLocal({ ...local, showOnPortal: v })}
          />
        </div>
      </div>

      <div className="p-4 space-y-4">
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
            onClick={() => onSave(local)}
            disabled={!isDirty || isSaving}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 me-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 me-1.5" />}
            {isSaving ? t("priceList.admin.saving") : t("priceList.admin.save")}
          </Button>
        </div>
      </div>
    </div>
  );
}
