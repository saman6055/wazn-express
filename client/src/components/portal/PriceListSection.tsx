import { useMemo, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { pickLang } from "@/lib/lang";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Plane, Ship, Zap, Package, Truck, Sparkles,
  DollarSign, Wrench, Info, TrendingUp,
  Flame, Star, Rocket, Award, ShoppingBag, Globe, Clock, Layers,
  Calculator,
} from "lucide-react";

// ---------------------------------------------------------------------------
// PriceListSection — customer-portal price banner
// ---------------------------------------------------------------------------
// Rendered near the top of every portal home variant (Classic, Modern, Skin3).
// Data comes from `customerPortal.getPriceList` which merges three server
// sources: pricingRules (shipping rates), serviceTypes (services), and the
// single-row portalPriceListSettings (title, toggles, disclaimer, layout).
//
// The admin curates everything from /settings/portal-price-list — this
// component is read-only. When the admin disables the section it collapses
// entirely (returns null) so the layout stays clean.
// ---------------------------------------------------------------------------

// Icon registry — maps the string the admin saves (portalIcon) to a Lucide
// component. Keep in sync with the picker in PortalPriceListSettings.tsx.
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Plane, Ship, Zap, Package, Truck, Sparkles, DollarSign, Wrench,
  TrendingUp, Flame, Star, Rocket, Award, ShoppingBag, Globe, Clock, Layers,
};

// Color palette — each entry pairs the gradient used behind the card and the
// accent color used for the icon chip. The admin picks from this set in the
// settings UI so we don't ship arbitrary hex values in the DB.
const COLOR_MAP: Record<string, { bg: string; ring: string; icon: string; text: string; glow: string }> = {
  sky:     { bg: "from-sky-500 via-sky-600 to-blue-700",          ring: "ring-sky-300/40",      icon: "bg-sky-400/20 text-sky-100",        text: "text-sky-50",     glow: "shadow-sky-500/30" },
  teal:    { bg: "from-teal-500 via-teal-600 to-emerald-700",      ring: "ring-teal-300/40",     icon: "bg-teal-400/20 text-teal-100",      text: "text-teal-50",    glow: "shadow-teal-500/30" },
  amber:   { bg: "from-amber-500 via-orange-500 to-red-600",       ring: "ring-amber-300/40",    icon: "bg-amber-400/20 text-amber-100",    text: "text-amber-50",   glow: "shadow-amber-500/30" },
  purple:  { bg: "from-purple-600 via-fuchsia-600 to-pink-600",    ring: "ring-purple-300/40",   icon: "bg-purple-400/20 text-purple-100",  text: "text-purple-50",  glow: "shadow-purple-500/30" },
  emerald: { bg: "from-emerald-500 via-green-600 to-teal-700",     ring: "ring-emerald-300/40",  icon: "bg-emerald-400/20 text-emerald-100",text: "text-emerald-50", glow: "shadow-emerald-500/30" },
  rose:    { bg: "from-rose-500 via-pink-600 to-fuchsia-700",      ring: "ring-rose-300/40",     icon: "bg-rose-400/20 text-rose-100",      text: "text-rose-50",    glow: "shadow-rose-500/30" },
  indigo:  { bg: "from-indigo-600 via-violet-600 to-purple-700",   ring: "ring-indigo-300/40",   icon: "bg-indigo-400/20 text-indigo-100",  text: "text-indigo-50",  glow: "shadow-indigo-500/30" },
  slate:   { bg: "from-slate-700 via-slate-800 to-slate-900",      ring: "ring-slate-400/40",    icon: "bg-slate-500/20 text-slate-100",    text: "text-slate-50",   glow: "shadow-slate-700/40" },
};

// Pick a sensible default color/icon when the admin has not filled them in,
// derived from the shipping type so the UI is never colorless.
function defaultsForShippingType(type: string): { icon: string; color: string } {
  if (type === "sea") return { icon: "Ship", color: "teal" };
  if (type === "air_irregular") return { icon: "Zap", color: "amber" };
  return { icon: "Plane", color: "sky" };
}

// Localized picker — falls back through ku → en → ar → zh so we never render
// an empty string even if the admin has only filled one language in so far.
function pickLocalized(
  values: Record<string, string | null | undefined>,
  lang: string,
): string | null {
  const order = [lang, "ku", "en", "ar", "zh"];
  for (const key of order) {
    const v = values[key];
    if (v && v.trim().length > 0) return v;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Shipping rate card
// ---------------------------------------------------------------------------
function ShippingRateCard({
  rate,
  lang,
  t,
  showRmb,
  showIqd,
  rmbRate,
  iqdRate,
  isDark,
}: {
  rate: any;
  lang: string;
  t: (key: string) => string;
  showRmb: boolean;
  showIqd: boolean;
  rmbRate: number | null;
  iqdRate: number | null;
  isDark: boolean;
}) {
  const defaults = defaultsForShippingType(rate.shippingType);
  const Icon = ICON_MAP[rate.portalIcon || defaults.icon] ?? Plane;
  const colorKey = rate.portalColor || defaults.color;
  const palette = COLOR_MAP[colorKey] ?? COLOR_MAP.sky;

  const label = pickLocalized({
    ku: rate.portalLabelKu, en: rate.portalLabelEn,
    ar: rate.portalLabelAr, zh: rate.portalLabelZh,
  }, lang) ?? t(`priceList.shippingTypes.${rate.shippingType}`);

  const price = Number(rate.pricePerUnit ?? 0);
  const unitLabel = rate.unit === "cbm" ? t("priceList.perCbm") : t("priceList.perKg");
  const rmbValue = rmbRate ? (price * rmbRate) : null;
  const iqdValue = iqdRate ? (price * iqdRate) : null;

  return (
    <div className={cn(
      "relative overflow-hidden rounded-2xl bg-gradient-to-br text-white shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl group",
      palette.bg, palette.glow,
    )}>
      {/* Subtle dot pattern overlay */}
      <div className="absolute inset-0 opacity-[0.08] pointer-events-none bg-[radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:16px_16px]" />
      {/* Big decorative orb — positioned outside the text area so it never overlaps the price */}
      <div className="absolute -bottom-16 -end-16 w-40 h-40 rounded-full bg-white/10 group-hover:scale-110 transition-transform duration-500 pointer-events-none" />

      {/* --- Top row: icon + badge --- */}
      <div className="relative flex items-start justify-between p-5 pb-2">
        <div className={cn(
          "p-3 rounded-2xl backdrop-blur-sm ring-1 shadow-sm",
          palette.icon, palette.ring,
        )}>
          <Icon className="w-6 h-6" />
        </div>
        {rate.portalBadge && (
          <Badge className="bg-white/20 backdrop-blur-md text-white border-white/30 text-[10px] font-black tracking-wide shadow-sm">
            {rate.portalBadge === "POPULAR" ? t("priceList.popular") :
              rate.portalBadge === "NEW" ? t("priceList.new") :
              rate.portalBadge === "RECOMMENDED" ? t("priceList.recommended") :
              rate.portalBadge === "FAST" ? t("priceList.fast") :
              rate.portalBadge}
          </Badge>
        )}
      </div>

      {/* --- Label (full width, its own line) --- */}
      <div className="relative px-5 pb-3">
        <h3 className={cn("text-base font-bold leading-tight line-clamp-2", palette.text)}>
          {label}
        </h3>
      </div>

      {/* --- Price block (dominant) --- */}
      <div className="relative px-5 pb-5">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-4xl font-black tracking-tight drop-shadow-sm">
            ${price.toFixed(2)}
          </span>
          <span className="text-sm font-semibold opacity-90">
            {unitLabel}
          </span>
        </div>
        {((showRmb && rmbValue !== null) || (showIqd && iqdValue !== null)) && (
          <div className="mt-2 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] font-semibold opacity-90">
            {showRmb && rmbValue !== null && (
              <span className="inline-flex items-center gap-0.5">
                <span className="opacity-70">≈</span>
                ¥{Math.round(rmbValue).toLocaleString("en-US")}
              </span>
            )}
            {showIqd && iqdValue !== null && (
              <span className="inline-flex items-center gap-0.5">
                <span className="opacity-70">≈</span>
                {Math.round(iqdValue).toLocaleString("en-US")} د.ع
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Service card
// ---------------------------------------------------------------------------
function ServiceCard({
  service,
  lang,
  t,
  showRmb,
  rmbRate,
  isDark,
}: {
  service: any;
  lang: string;
  t: (key: string) => string;
  showRmb: boolean;
  rmbRate: number | null;
  isDark: boolean;
}) {
  const Icon = ICON_MAP[service.icon] ?? Wrench;
  const colorKey = (service.color as string) || "purple";
  const palette = COLOR_MAP[colorKey] ?? COLOR_MAP.purple;

  const name = pickLocalized({
    ku: service.nameKu, en: service.nameEn,
    ar: service.nameAr, zh: service.nameZh,
  }, lang) ?? service.nameEn;

  const description = pickLocalized({
    ku: service.portalDescriptionKu, en: service.portalDescriptionEn,
    ar: service.portalDescriptionAr, zh: service.portalDescriptionZh,
  }, lang);

  const priceLabel = pickLocalized({
    ku: service.portalPriceLabelKu, en: service.portalPriceLabelEn,
    ar: service.portalPriceLabelAr, zh: service.portalPriceLabelZh,
  }, lang) ?? t("priceList.perUnit");

  const price = Number(service.defaultPrice ?? 0);
  const rmbValue = rmbRate ? (price * rmbRate) : null;

  return (
    <div className={cn(
      "relative overflow-hidden rounded-2xl p-5 border transition-all duration-300 hover:-translate-y-1 hover:shadow-xl group",
      isDark
        ? "bg-slate-800 border-slate-700 hover:border-slate-600"
        : "bg-white border-slate-200 hover:border-slate-300 shadow-sm",
    )}>
      {service.portalBadge && (
        <div className="absolute top-3 end-3">
          <Badge className={cn(
            "text-[10px] font-bold tracking-wide border-0",
            service.portalBadge === "POPULAR" && "bg-amber-100 text-amber-800",
            service.portalBadge === "NEW" && "bg-emerald-100 text-emerald-800",
            service.portalBadge === "RECOMMENDED" && "bg-purple-100 text-purple-800",
            service.portalBadge === "FAST" && "bg-rose-100 text-rose-800",
          )}>
            {service.portalBadge === "POPULAR" ? t("priceList.popular") :
              service.portalBadge === "NEW" ? t("priceList.new") :
              service.portalBadge === "RECOMMENDED" ? t("priceList.recommended") :
              service.portalBadge === "FAST" ? t("priceList.fast") :
              service.portalBadge}
          </Badge>
        </div>
      )}

      <div className="flex items-start gap-3 mb-3">
        <div className={cn(
          "p-2.5 rounded-xl bg-gradient-to-br text-white shadow-md flex-shrink-0",
          palette.bg,
        )}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className={cn(
            "text-base font-bold truncate",
            isDark ? "text-white" : "text-slate-900",
          )}>
            {name}
          </h3>
          {description && (
            <p className={cn(
              "text-xs mt-1 line-clamp-2",
              isDark ? "text-slate-400" : "text-slate-500",
            )}>
              {description}
            </p>
          )}
        </div>
      </div>

      <div className={cn(
        "flex items-baseline gap-1.5 pt-3 mt-3 border-t",
        isDark ? "border-slate-700" : "border-slate-100",
      )}>
        {price > 0 ? (
          <>
            <span className={cn(
              "text-2xl font-black tracking-tight",
              isDark ? "text-white" : "text-slate-900",
            )}>
              ${price.toFixed(2)}
            </span>
            <span className={cn(
              "text-[11px] font-medium",
              isDark ? "text-slate-400" : "text-slate-500",
            )}>
              {priceLabel}
            </span>
            {showRmb && rmbValue !== null && (
              <span className="ms-auto text-[11px] text-orange-500 font-mono">
                ≈ ¥{Math.round(rmbValue).toLocaleString("en-US")}
              </span>
            )}
          </>
        ) : (
          <span className={cn(
            "text-xs italic",
            isDark ? "text-slate-400" : "text-slate-500",
          )}>
            {t("priceList.contactForQuote")}
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Price calculator — the customer enters a weight (air) or volume (sea) and
// sees the estimated cost from the same live rates shown above. Estimates
// only; minimums (1 kg air / 0.25 CBM sea) are applied like the real charge.
// ---------------------------------------------------------------------------
function PriceCalculator({
  shipping, lang, isDark, showIqd, iqdRate,
}: {
  shipping: any[];
  lang: string;
  isDark: boolean;
  showIqd: boolean;
  iqdRate: number | null;
}) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [qty, setQty] = useState("");

  if (shipping.length === 0) return null;
  const selected = shipping.find((r) => r.id === selectedId) ?? shipping[0];
  const isCbm = selected.unit === "cbm";
  const minQty = isCbm ? 0.25 : 1;
  const rawQty = parseFloat(qty);
  const effQty = isNaN(rawQty) || rawQty <= 0 ? 0 : Math.max(rawQty, minQty);
  const price = Number(selected.pricePerUnit ?? 0);
  const total = effQty * price;
  const iqdTotal = iqdRate ? total * iqdRate : null;

  const typeLabel = (r: any) =>
    pickLocalized({ ku: r.portalLabelKu, en: r.portalLabelEn, ar: r.portalLabelAr, zh: r.portalLabelZh }, lang)
      ?? r.shippingType;

  return (
    <div className={cn(
      "mt-4 rounded-2xl border p-4",
      isDark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200 shadow-sm",
    )}>
      <div className="flex items-center gap-2 mb-3">
        <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md">
          <Calculator className="w-4 h-4" />
        </div>
        <div>
          <h3 className={cn("text-sm font-bold", isDark ? "text-white" : "text-slate-900")}>
            {pickLang(lang, { ku: "حیسابکەری نرخ", en: "Price calculator", ar: "حاسبة السعر", zh: "价格计算器" })}
          </h3>
          <p className={cn("text-[11px]", isDark ? "text-slate-400" : "text-slate-500")}>
            {pickLang(lang, { ku: "کێش یان قەبارە بنووسە، نرخی خەمڵێنراو ببینە", en: "Enter weight or volume to estimate the cost", ar: "أدخل الوزن أو الحجم لتقدير التكلفة", zh: "输入重量或体积以估算费用" })}
          </p>
        </div>
      </div>

      {/* Shipping type chips */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {shipping.map((r) => {
          const active = r.id === selected.id;
          return (
            <button
              key={r.id}
              onClick={() => setSelectedId(r.id)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-semibold transition-colors",
                active
                  ? "bg-emerald-600 text-white shadow-sm"
                  : isDark ? "bg-slate-700 text-slate-300 hover:bg-slate-600" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
              )}
            >
              {typeLabel(r)}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-[180px]">
          <Input
            type="number"
            inputMode="decimal"
            min="0"
            step={isCbm ? "0.01" : "0.1"}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder={isCbm ? "0.25" : "1.0"}
            className={cn("pe-12 font-mono font-bold", isDark && "bg-slate-900 border-slate-600")}
          />
          <span className={cn("absolute end-3 top-1/2 -translate-y-1/2 text-xs font-semibold", isDark ? "text-slate-400" : "text-slate-500")}>
            {isCbm ? "m³" : "kg"}
          </span>
        </div>
        <div className="flex-1 text-end">
          {effQty > 0 ? (
            <>
              <div className={cn("text-2xl font-black tabular-nums", isDark ? "text-white" : "text-slate-900")}>
                ${total.toFixed(2)}
              </div>
              <div className={cn("text-[10px]", isDark ? "text-slate-400" : "text-slate-500")}>
                {showIqd && iqdTotal !== null && <span className="me-2">≈ {Math.round(iqdTotal).toLocaleString("en-US")} د.ع</span>}
                {rawQty > 0 && rawQty < minQty && (
                  <span>{pickLang(lang, { ku: `کەمترین ${minQty}`, en: `min ${minQty}`, ar: `الحد الأدنى ${minQty}`, zh: `最低 ${minQty}` })} {isCbm ? "m³" : "kg"}</span>
                )}
              </div>
            </>
          ) : (
            <div className={cn("text-sm", isDark ? "text-slate-500" : "text-slate-400")}>
              {pickLang(lang, { ku: "ژمارە بنووسە", en: "Enter a number", ar: "أدخل رقمًا", zh: "输入数字" })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main section
// ---------------------------------------------------------------------------
interface PriceListSectionProps {
  /** "dark" forces the dark theme regardless of the global toggle — used by the
   * skin3 layout which has its own theme. Default: follow ThemeContext. */
  forceDark?: boolean;
  /** Override the default horizontal padding. */
  className?: string;
}

export function PriceListSection({ forceDark, className }: PriceListSectionProps) {
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const isDark = forceDark ?? (theme === "dark");

  const { data, isLoading } = trpc.customerPortal.getPriceList.useQuery(undefined, {
    // The price list is short-lived (admin edits propagate fast) but not
    // latency-critical, so keep it cached for a minute to avoid hammering
    // the server on every nav.
    staleTime: 60_000,
  });

  const [activeTab, setActiveTab] = useState<"shipping" | "services">("shipping");

  const title = useMemo(() => {
    if (!data?.settings) return t("priceList.defaultTitle");
    return pickLocalized({
      ku: data.settings.titleKu, en: data.settings.titleEn,
      ar: data.settings.titleAr, zh: data.settings.titleZh,
    }, language) ?? t("priceList.defaultTitle");
  }, [data, language, t]);

  const subtitle = useMemo(() => {
    if (!data?.settings) return t("priceList.defaultSubtitle");
    return pickLocalized({
      ku: data.settings.subtitleKu, en: data.settings.subtitleEn,
      ar: data.settings.subtitleAr, zh: data.settings.subtitleZh,
    }, language) ?? t("priceList.defaultSubtitle");
  }, [data, language, t]);

  const disclaimer = useMemo(() => {
    if (!data?.settings) return null;
    return pickLocalized({
      ku: data.settings.disclaimerKu, en: data.settings.disclaimerEn,
      ar: data.settings.disclaimerAr, zh: data.settings.disclaimerZh,
    }, language);
  }, [data, language]);

  const rmbRate = data?.rates?.rmb ? parseFloat(data.rates.rmb) : null;
  const iqdRate = data?.rates?.iqd ? parseFloat(data.rates.iqd) : null;
  const showRmb = !!(data?.settings?.showRmbEquivalent) && !!rmbRate;
  const showIqd = !!(data?.settings?.showIqdEquivalent) && !!iqdRate;

  // Loading state — one tall skeleton + 3 card skeletons.
  if (isLoading) {
    return (
      <section className={cn("px-4 my-5", className)}>
        <Skeleton className={cn("h-28 w-full rounded-2xl mb-4", isDark && "bg-slate-800")} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[0, 1, 2].map(i => (
            <Skeleton key={i} className={cn("h-36 w-full rounded-2xl", isDark && "bg-slate-800")} />
          ))}
        </div>
      </section>
    );
  }

  // Disabled, missing, or empty — hide entirely. The portal home has other
  // content so we don't want a ghost section taking space.
  if (!data || !data.settings?.isEnabled) return null;
  const hasShipping = data.shipping.length > 0;
  const hasServices = data.services.length > 0;
  if (!hasShipping && !hasServices) return null;

  const showBothTabs = (data.settings.showShippingRates && hasShipping) && (data.settings.showServices && hasServices);

  // Decide which tab to show if only one category has content.
  const currentTab = !showBothTabs
    ? (data.settings.showShippingRates && hasShipping ? "shipping" : "services")
    : activeTab;

  const layoutVariant = data.settings.layoutVariant;

  return (
    <section className={cn("px-4 my-5", className)}>
      {/* Hero header */}
      <div className={cn(
        "relative overflow-hidden rounded-3xl p-6 mb-4 shadow-lg",
        "bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-800",
      )}>
        <div className="absolute inset-0 opacity-10 bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22><g fill=%22%23fff%22 fill-opacity=%22.3%22><path d=%22M0 0h1v1H0zM40 40h1v1h-1zM80 80h1v1h-1z%22/></g></svg>')]" />
        <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-white/10" />
        <div className="absolute -bottom-12 -left-12 w-40 h-40 rounded-full bg-amber-300/10" />

        <div className="relative flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 mb-3">
              <Sparkles className="w-3 h-3 text-amber-300" />
              <span className="text-[11px] font-bold text-white tracking-wide">{t("priceList.badge")}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white leading-tight">
              {title}
            </h2>
            {subtitle && (
              <p className="text-sm text-purple-100/90 mt-1 line-clamp-2">
                {subtitle}
              </p>
            )}
          </div>
          <div className="hidden sm:flex p-3 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20">
            <DollarSign className="w-6 h-6 text-amber-300" />
          </div>
        </div>
      </div>

      {/* Tabs — shown only when both categories have content and layout is "tabs" */}
      {showBothTabs && layoutVariant === "tabs" && (
        <div className={cn(
          "inline-flex p-1 rounded-xl mb-4",
          isDark ? "bg-slate-800 border border-slate-700" : "bg-slate-100",
        )}>
          <button
            onClick={() => setActiveTab("shipping")}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 inline-flex items-center gap-2",
              currentTab === "shipping"
                ? (isDark ? "bg-slate-700 text-white shadow-sm" : "bg-white text-slate-900 shadow-sm")
                : (isDark ? "text-slate-400 hover:text-slate-200" : "text-slate-600 hover:text-slate-900"),
            )}
          >
            <Plane className="w-4 h-4" />
            {t("priceList.shipping")}
          </button>
          <button
            onClick={() => setActiveTab("services")}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 inline-flex items-center gap-2",
              currentTab === "services"
                ? (isDark ? "bg-slate-700 text-white shadow-sm" : "bg-white text-slate-900 shadow-sm")
                : (isDark ? "text-slate-400 hover:text-slate-200" : "text-slate-600 hover:text-slate-900"),
            )}
          >
            <Wrench className="w-4 h-4" />
            {t("priceList.services")}
          </button>
        </div>
      )}

      {/* Content */}
      {layoutVariant === "stacked" ? (
        // Stacked variant: show both categories one after the other with headers.
        <div className="space-y-6">
          {data.settings.showShippingRates && hasShipping && (
            <div>
              <div className={cn(
                "flex items-center gap-2 mb-3 px-1",
                isDark ? "text-slate-300" : "text-slate-700",
              )}>
                <Plane className="w-4 h-4" />
                <h3 className="text-sm font-bold uppercase tracking-wider">{t("priceList.shipping")}</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {data.shipping.map((rate: any) => (
                  <ShippingRateCard key={rate.id} rate={rate} lang={language} t={t}
                    showRmb={showRmb} showIqd={showIqd} rmbRate={rmbRate} iqdRate={iqdRate} isDark={isDark} />
                ))}
              </div>
            </div>
          )}
          {data.settings.showServices && hasServices && (
            <div>
              <div className={cn(
                "flex items-center gap-2 mb-3 px-1",
                isDark ? "text-slate-300" : "text-slate-700",
              )}>
                <Wrench className="w-4 h-4" />
                <h3 className="text-sm font-bold uppercase tracking-wider">{t("priceList.services")}</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {data.services.map((service: any) => (
                  <ServiceCard key={service.id} service={service} lang={language} t={t}
                    showRmb={showRmb} rmbRate={rmbRate} isDark={isDark} />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        // Tabs or compact — show the active category as a responsive grid.
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {currentTab === "shipping" && data.settings.showShippingRates &&
            data.shipping.map((rate: any) => (
              <ShippingRateCard key={rate.id} rate={rate} lang={language} t={t}
                showRmb={showRmb} showIqd={showIqd} rmbRate={rmbRate} iqdRate={iqdRate} isDark={isDark} />
            ))}
          {currentTab === "services" && data.settings.showServices &&
            data.services.map((service: any) => (
              <ServiceCard key={service.id} service={service} lang={language} t={t}
                showRmb={showRmb} rmbRate={rmbRate} isDark={isDark} />
            ))}
        </div>
      )}

      {/* Price calculator — powered by the same visible shipping rates */}
      {data.settings.showShippingRates && hasShipping && (
        <PriceCalculator
          shipping={data.shipping}
          lang={language}
          isDark={isDark}
          showIqd={showIqd}
          iqdRate={iqdRate}
        />
      )}

      {/* Disclaimer */}
      {disclaimer && (
        <div className={cn(
          "mt-4 flex items-start gap-2 px-3 py-2.5 rounded-xl text-[11px] leading-relaxed",
          isDark ? "bg-slate-800/60 text-slate-400 border border-slate-700/50" : "bg-amber-50 text-amber-800 border border-amber-200/80",
        )}>
          <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <p>{disclaimer}</p>
        </div>
      )}
    </section>
  );
}

export default PriceListSection;
