import { useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { SHIPPING_TYPE_LABEL } from "@/lib/shipmentFilters";
import {
  ClipboardList, LayoutGrid, Table2, CameraOff, Copy, Search, ImageOff,
  Plane, Ship, AlertTriangle, Users, Package as PackageIcon, DollarSign,
  ExternalLink, Warehouse, ShoppingBag, UserCircle, Layers, ChevronLeft, ChevronRight, ShieldAlert,
  Scale, MessageCircle, CheckCircle2, Grid2x2, Grid3x3,
} from "lucide-react";
import { buildVolumetricMessage, buildWhatsAppLink } from "@shared/volumetricAlert";
import { VolumetricWatchCard } from "@/components/registrations/VolumetricWatchCard";
import { StaleDepotCard } from "@/components/registrations/StaleDepotCard";

type L = { ku: string; en: string; ar: string; zh: string };

type PhotoSource = "warehouse" | "order" | "customer";
type Photo = { url: string; source: PhotoSource };

type Registration = {
  id: number;
  packageCode: string;
  trackingNumber: string | null;
  customerId: number | null;
  customerName: string | null;
  customerCode: string | null;
  isUnclaimed: boolean;
  weightKg: string | null;
  lengthCm: string | null;
  widthCm: string | null;
  heightCm: string | null;
  volumeCbm: string | null;
  shippingType: "air_regular" | "air_irregular" | "sea";
  description: string | null;
  categoryName: string | null;
  calculatedCostUsd: string | null;
  status: string;
  batchId: number | null;
  registeredAt: string | Date | null;
  registeredByName: string | null;
  photos: Photo[];
  order: {
    id: number;
    orderCode: string;
    orderType: "full_package" | "commission" | "purchase_request";
    productName: string | null;
    status: string;
  } | null;
  declaredByCustomer: boolean;
  needsReview: boolean;
  customerOpenOrders: number;
  volumetric: {
    actualKg: number;
    volumetricKg: number;
    chargeableKg: number;
    extraKg: number;
    ratio: number;
    divisor: number;
    alert: boolean;
  } | null;
  volumetricAckAt: string | Date | null;
  customerMobile: string | null;
};

const num = (v: unknown): number => {
  const n = parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
};

/**
 * Order wording and destination, taken from the pages that own them:
 * /full-package is پاکێجی تەواو and /commission is کڕین بە تێچوو. Getting these
 * the wrong way round put a purchase type on screen that this business does
 * not have.
 */
const ORDER_TYPE: Record<string, { label: L; path: string }> = {
  full_package: {
    label: { ku: "پاکێجی تەواو", en: "Complete package", ar: "الحزمة الكاملة", zh: "完整包裹" },
    path: "/full-package",
  },
  commission: {
    label: { ku: "کڕین بە تێچوو", en: "Markup purchase", ar: "شراء بهامش", zh: "加价采购" },
    path: "/commission",
  },
  purchase_request: {
    label: { ku: "داواکاری کڕین", en: "Purchase request", ar: "طلب شراء", zh: "采购请求" },
    path: "/full-package",
  },
};

/**
 * Everything about a parcel that somebody has to deal with before it leaves
 * China. These were scattered — some on the dashboard, some only visible by
 * reading each card — so the office had no single place to ask "what still
 * needs work today". Each one is a filter here.
 */
type Flag = "volumetric" | "review" | "noWeight" | "stale" | "noBatch" | "noPhoto" | "unclaimed";

/** A parcel is expected to join a batch within this many days of arriving. */
const STALE_DAYS = 15;

function flagsFor(r: Registration): Flag[] {
  const flags: Flag[] = [];
  // Money the customer has not agreed to yet.
  if (r.volumetric?.alert && !r.volumetricAckAt) flags.push("volumetric");
  // A self order from a customer who has open orders — probably a forgotten one.
  if (r.needsReview) flags.push("review");
  // Cannot be priced, so cannot be invoiced.
  if (num(r.weightKg) <= 0) flags.push("noWeight");
  if (!r.customerId || r.isUnclaimed) flags.push("unclaimed");
  if (r.photos.length === 0) flags.push("noPhoto");
  // No batch means it is not going anywhere, whatever else is right about it.
  if (!r.batchId) {
    flags.push("noBatch");
    const days = r.registeredAt
      ? Math.floor((Date.now() - new Date(r.registeredAt).getTime()) / 86_400_000)
      : 0;
    if (days >= STALE_DAYS) flags.push("stale");
  }
  return flags;
}

const FLAG_META: Record<Flag, { label: L; tone: "red" | "indigo" | "blue" }> = {
  volumetric: { label: { ku: "قەبارەیی", en: "Volumetric", ar: "حجمي", zh: "体积重" }, tone: "red" },
  review: { label: { ku: "پێویستی پشکنین", en: "Needs review", ar: "يحتاج مراجعة", zh: "待核查" }, tone: "red" },
  noWeight: { label: { ku: "بێ کێش", en: "No weight", ar: "بلا وزن", zh: "无重量" }, tone: "indigo" },
  stale: { label: { ku: "لە کۆگا ماوە", en: "Stuck in depot", ar: "عالق بالمستودع", zh: "滞留仓库" }, tone: "red" },
  noBatch: { label: { ku: "لە باچ نییە", en: "No batch", ar: "بلا دفعة", zh: "未入批次" }, tone: "indigo" },
  noPhoto: { label: { ku: "بێ وێنە", en: "No photo", ar: "بلا صورة", zh: "无照片" }, tone: "indigo" },
  unclaimed: { label: { ku: "بێ خاوەن", en: "Unclaimed", ar: "بلا مالك", zh: "无主" }, tone: "indigo" },
};

/** Loudest first: money, then a missing decision, then ordinary gaps. */
const FLAG_ORDER: Flag[] = ["volumetric", "review", "stale", "noWeight", "noBatch", "unclaimed", "noPhoto"];

type ViewSize = "xl" | "large" | "medium" | "list";

/** How many cards fit across, per density. */
const VIEW_GRID: Record<Exclude<ViewSize, "list">, string> = {
  xl: "grid gap-3",
  large: "grid gap-3 2xl:grid-cols-2",
  medium: "grid gap-2.5 xl:grid-cols-2 2xl:grid-cols-3",
};

const VIEW_LABEL: Record<ViewSize, L> = {
  xl: { ku: "زۆر گەورە", en: "Extra large", ar: "كبير جداً", zh: "超大" },
  large: { ku: "گەورە", en: "Large", ar: "كبير", zh: "大" },
  medium: { ku: "ناوەند", en: "Medium", ar: "متوسط", zh: "中" },
  list: { ku: "لیست", en: "List", ar: "قائمة", zh: "列表" },
};

const SELF_ORDER: L = { ku: "سێلف ئۆردەر", en: "Self order", ar: "طلب ذاتي", zh: "自购订单" };

const PHOTO_SOURCE: Record<PhotoSource, { label: L; icon: typeof Warehouse }> = {
  warehouse: { label: { ku: "کۆگا", en: "Warehouse", ar: "المستودع", zh: "仓库" }, icon: Warehouse },
  order: { label: { ku: "ئۆردەر", en: "Order", ar: "الطلب", zh: "订单" }, icon: ShoppingBag },
  customer: { label: { ku: "کڕیار", en: "Customer", ar: "العميل", zh: "客户" }, icon: UserCircle },
};

/** Local midnight, not UTC — "today" has to mean today in Erbil. */
function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}
function toInputDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function shortDateTime(v: string | Date | null): string {
  if (!v) return "—";
  const d = new Date(v);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} · ${d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`;
}

type RangeKey = "today" | "yesterday" | "week" | "month" | "custom";

function rangeFor(key: Exclude<RangeKey, "custom">): { from: Date; to: Date } {
  const today = startOfDay(new Date());
  switch (key) {
    case "today": return { from: today, to: addDays(today, 1) };
    case "yesterday": return { from: addDays(today, -1), to: today };
    case "week": return { from: addDays(today, -6), to: addDays(today, 1) };
    case "month": return { from: new Date(today.getFullYear(), today.getMonth(), 1), to: addDays(today, 1) };
  }
}

/**
 * Everything Quick Register took in, shown as the parcel rather than as a row
 * of codes: the pictures first, then who it belongs to and what was bought.
 *
 * A parcel can be pictured three times over — at the warehouse when it landed,
 * on the purchase order when it was bought, and by the customer declaring the
 * tracking in the portal. All three are shown, tagged with where each came
 * from, so a parcel still shows what it looks like when one source is missing.
 */
export default function Registrations() {
  const { language } = useLanguage();
  const label = (v: L) => pickLang(language, v);
  const [, setLocation] = useLocation();

  // Four densities, the way a file manager offers them: the same rows, more
  // or fewer per screen. "list" is the compact table; the other three are
  // cards at three widths.
  const [view, setView] = useState<ViewSize>("medium");
  const [groupByCustomer, setGroupByCustomer] = useState(false);
  const [rangeKey, setRangeKey] = useState<RangeKey>("today");
  const [customFrom, setCustomFrom] = useState(toInputDate(startOfDay(new Date())));
  const [customTo, setCustomTo] = useState(toInputDate(startOfDay(new Date())));
  const [search, setSearch] = useState("");
  const [gallery, setGallery] = useState<{ photos: Photo[]; index: number } | null>(null);
  const [flag, setFlag] = useState<Flag | null>(null);

  const { from, to } = useMemo(() => {
    if (rangeKey !== "custom") return rangeFor(rangeKey);
    // A half-typed or cleared date field yields an Invalid Date, and
    // toISOString() on one throws — which took the whole page down while
    // somebody was still picking the day. Fall back to today until both ends
    // are real dates.
    const today = rangeFor("today");
    const f = startOfDay(new Date(customFrom));
    const t = startOfDay(new Date(customTo));
    if (Number.isNaN(f.getTime()) || Number.isNaN(t.getTime())) return today;
    // Typing the end before the start is normal; read the pair either way
    // round rather than returning nothing.
    const [lo, hi] = f <= t ? [f, t] : [t, f];
    // The picker's end date is inclusive; the query bound is exclusive.
    return { from: lo, to: addDays(hi, 1) };
  }, [rangeKey, customFrom, customTo]);

  const { data, isLoading } = trpc.packages.registrations.useQuery({
    dateFrom: from.toISOString(),
    dateTo: to.toISOString(),
    search: search.trim() || undefined,
  });

  // Review cases float to the top. The office opens this page to prepare for
  // goods that have not landed yet; a parcel needing a decision must not be
  // three screens down. Everything else stays newest-first.
  const allRows = useMemo(() => {
    const list = (data ?? []) as Registration[];
    return [...list].sort((a, b) => Number(b.needsReview) - Number(a.needsReview));
  }, [data]);

  /** How many parcels carry each flag, over the whole period, not the filtered view. */
  const flagCounts = useMemo(() => {
    const counts = {} as Record<Flag, number>;
    for (const f of FLAG_ORDER) counts[f] = 0;
    for (const r of allRows) for (const f of flagsFor(r)) counts[f]++;
    return counts;
  }, [allRows]);

  const rows = useMemo(
    () => (flag ? allRows.filter((r) => flagsFor(r).includes(flag)) : allRows),
    [allRows, flag],
  );

  const totals = useMemo(() => {
    let airKg = 0, seaCbm = 0, value = 0, noPhoto = 0, noWeight = 0, unclaimed = 0, review = 0;
    const custs = new Set<number>();
    for (const r of rows) {
      if (r.shippingType === "sea") seaCbm += num(r.volumeCbm);
      else airKg += num(r.weightKg);
      value += num(r.calculatedCostUsd);
      if (r.photos.length === 0) noPhoto++;
      if (num(r.weightKg) <= 0) noWeight++;
      if (r.needsReview) review++;
      if (r.isUnclaimed || !r.customerId) unclaimed++;
      else custs.add(r.customerId);
    }
    return { pieces: rows.length, customers: custs.size, airKg, seaCbm, value, noPhoto, noWeight, unclaimed, review };
  }, [rows]);

  const groups = useMemo(() => {
    if (!groupByCustomer) return null;
    const m = new Map<string, { key: string; code: string; name: string; items: Registration[] }>();
    for (const r of rows) {
      const key = r.customerId ? String(r.customerId) : "unclaimed";
      if (!m.has(key)) {
        m.set(key, {
          key,
          code: r.customerCode || label({ ku: "بێ خاوەن", en: "Unclaimed", ar: "بلا مالك", zh: "无主" }),
          name: r.customerName || "—",
          items: [],
        });
      }
      m.get(key)!.items.push(r);
    }
    return Array.from(m.values()).sort((a, b) => b.items.length - a.items.length);
  }, [rows, groupByCustomer, language]);

  const utils = trpc.useUtils();
  const ackMutation = trpc.packages.acknowledgeVolumetric.useMutation({
    onSuccess: () => {
      toast.success(label({
        ku: "تۆمار کرا کە لەگەڵ کڕیار چێک کراوەتەوە",
        en: "Recorded as checked with the customer",
        ar: "تم تسجيلها كمراجَعة مع العميل",
        zh: "已记录为与客户核实",
      }));
      utils.packages.registrations.invalidate();
      utils.packages.volumetricParcels.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const copyTracking = (tn: string) => {
    navigator.clipboard.writeText(tn);
    toast.success(label({ ku: "تراک کۆپی کرا", en: "Tracking copied", ar: "تم نسخ التتبّع", zh: "已复制追踪号" }));
  };

  /** Card click opens the purchase order this parcel belongs to. */
  const openOrder = (r: Registration) => {
    if (!r.order) return;
    setLocation(`${ORDER_TYPE[r.order.orderType]?.path ?? "/full-package"}/${r.order.id}`);
  };

  const rangeButtons: { key: RangeKey; text: L }[] = [
    { key: "today", text: { ku: "ئەمڕۆ", en: "Today", ar: "اليوم", zh: "今天" } },
    { key: "yesterday", text: { ku: "دوێنێ", en: "Yesterday", ar: "أمس", zh: "昨天" } },
    { key: "week", text: { ku: "٧ ڕۆژ", en: "7 days", ar: "٧ أيام", zh: "7 天" } },
    { key: "month", text: { ku: "ئەم مانگە", en: "This month", ar: "هذا الشهر", zh: "本月" } },
    { key: "custom", text: { ku: "دیاریکراو", en: "Custom", ar: "مخصّص", zh: "自定义" } },
  ];

  const incomplete = totals.noPhoto + totals.noWeight + totals.unclaimed;
  const cardProps = {
    language,
    onCopy: copyTracking,
    onGallery: setGallery,
    onOpenOrder: openOrder,
    onAck: (packageId: number) => ackMutation.mutate({ packageId }),
    ackPending: ackMutation.isPending,
  };

  return (
    <DashboardLayout>
    <div className="space-y-5 p-4 md:p-6">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-sky-600 via-blue-600 to-cyan-500 p-5 text-white shadow-xl ring-1 ring-white/20 md:p-6">
        <div className="pointer-events-none absolute -end-16 -top-20 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-24 -start-10 h-56 w-56 rounded-full bg-cyan-300/20 blur-3xl" />

        <div className="relative flex flex-wrap items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight md:text-2xl">
              {label({ ku: "تۆمارەکان", en: "Registrations", ar: "التسجيلات", zh: "登记记录" })}
            </h1>
            <p className="text-xs text-white/75">
              {label({
                ku: "هەرچی بە تۆماری خێرا داخڵ کراوە — بە وێنە و زانیاری تەواو",
                en: "Everything entered through Quick Register — with photos and full detail",
                ar: "كل ما أُدخل عبر التسجيل السريع — بالصور والتفاصيل الكاملة",
                zh: "通过快速登记录入的全部记录 — 含照片与完整信息",
              })}
            </p>
          </div>

          <div className="ms-auto flex flex-wrap gap-1.5">
            <Toggle active={groupByCustomer} onClick={() => setGroupByCustomer((v) => !v)} icon={Users}>
              {label({ ku: "بە کڕیار", en: "By customer", ar: "حسب العميل", zh: "按客户" })}
            </Toggle>
            {/* Four sizes, like a file manager's view menu. */}
            <Toggle active={view === "xl"} onClick={() => setView("xl")} icon={Grid2x2}>
              {label(VIEW_LABEL.xl)}
            </Toggle>
            <Toggle active={view === "large"} onClick={() => setView("large")} icon={LayoutGrid}>
              {label(VIEW_LABEL.large)}
            </Toggle>
            <Toggle active={view === "medium"} onClick={() => setView("medium")} icon={Grid3x3}>
              {label(VIEW_LABEL.medium)}
            </Toggle>
            <Toggle active={view === "list"} onClick={() => setView("list")} icon={Table2}>
              {label(VIEW_LABEL.list)}
            </Toggle>
          </div>
        </div>

        <div className="relative mt-5 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          <Stat value={String(totals.pieces)} caption={label({ ku: "پارچە", en: "pieces", ar: "قطعة", zh: "件" })} icon={PackageIcon} />
          <Stat value={String(totals.customers)} caption={label({ ku: "کڕیار", en: "customers", ar: "عميل", zh: "客户" })} icon={Users} />
          <Stat value={totals.airKg.toFixed(1)} caption={label({ ku: "کیلۆ · ئاسمانی", en: "kg · air", ar: "كغ · جوي", zh: "公斤 · 空运" })} icon={Plane} />
          <Stat value={totals.seaCbm.toFixed(2)} caption={label({ ku: "CBM · دەریایی", en: "CBM · sea", ar: "م³ · بحري", zh: "立方米 · 海运" })} icon={Ship} />
          <Stat value={`$${Math.round(totals.value)}`} caption={label({ ku: "بڕی گشتی", en: "total value", ar: "القيمة", zh: "总额" })} icon={DollarSign} />
          <Stat value={String(incomplete)} caption={label({ ku: "کەموکوڕی", en: "incomplete", ar: "ناقص", zh: "不完整" })} icon={AlertTriangle} warn={incomplete > 0} />
          <Stat value={String(totals.review)} caption={label({ ku: "پێویستی پشکنین", en: "needs review", ar: "يحتاج مراجعة", zh: "待核查" })} icon={ShieldAlert} warn={totals.review > 0} />
        </div>
      </div>

      {/* Everything that still needs work, in one row. These used to be spread
          between the dashboard and the individual cards, so there was nowhere
          to ask "what is outstanding today" and get an answer. */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setFlag(null)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-[13px] font-semibold transition-all",
            flag === null
              ? "bg-gradient-to-br from-blue-700 to-indigo-700 text-white shadow-md shadow-blue-700/25"
              : "border bg-card text-foreground/80 hover:bg-muted",
          )}
        >
          {label({ ku: "هەمووی", en: "All", ar: "الكل", zh: "全部" })}
          <span className={cn("rounded-md px-1.5 text-[12px] tabular-nums", flag === null ? "bg-white/25" : "bg-muted")}>
            {allRows.length}
          </span>
        </button>

        {FLAG_ORDER.filter((f) => flagCounts[f] > 0).map((f) => {
          const meta = FLAG_META[f];
          const on = flag === f;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFlag(on ? null : f)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-[13px] font-semibold ring-1 transition-all",
                on && meta.tone === "red" && "bg-red-600 text-white ring-red-500 shadow-md shadow-red-600/30",
                on && meta.tone !== "red" && "bg-indigo-600 text-white ring-indigo-500 shadow-md shadow-indigo-600/30",
                !on && meta.tone === "red" &&
                  "bg-red-100 text-red-900 ring-red-300 hover:bg-red-200 dark:bg-red-950/50 dark:text-red-100 dark:ring-red-800/70 dark:hover:bg-red-900/50",
                !on && meta.tone !== "red" &&
                  "bg-indigo-100 text-indigo-900 ring-indigo-300 hover:bg-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-100 dark:ring-indigo-800/70 dark:hover:bg-indigo-900/50",
              )}
            >
              {meta.tone === "red" && !on && (
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                </span>
              )}
              {label(meta.label)}
              <span className={cn("rounded-md px-1.5 text-[12px] tabular-nums", on ? "bg-white/25" : "bg-black/10 dark:bg-white/15")}>
                {flagCounts[f]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5 rounded-2xl border bg-muted/40 p-1">
          {rangeButtons.map((b) => (
            <button
              key={b.key}
              type="button"
              onClick={() => setRangeKey(b.key)}
              className={cn(
                "rounded-xl px-3.5 py-1.5 text-[13px] font-medium transition-all duration-200",
                rangeKey === b.key
                  ? "bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/30"
                  : "text-muted-foreground hover:bg-background hover:text-foreground",
              )}
            >
              {label(b.text)}
            </button>
          ))}
        </div>
        {rangeKey === "custom" && (
          <div className="flex items-center gap-1.5" dir="ltr">
            <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="h-9 w-[9.5rem] rounded-xl" />
            <span className="text-muted-foreground">→</span>
            <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="h-9 w-[9.5rem] rounded-xl" />
          </div>
        )}
        <div className="relative ms-auto min-w-[13rem] flex-1 sm:max-w-xs">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={label({ ku: "تراک، کۆد، کڕیار، ئۆردەر…", en: "Tracking, code, customer, order…", ar: "تتبّع، كود، عميل، طلب…", zh: "追踪号、编号、客户、订单…" })}
            className="h-10 rounded-xl ps-9"
          />
        </div>
      </div>

      {/* Standing problems, not today's intake.
          These two do not belong under a date filter: a parcel billed on
          volume that nobody has settled with the customer, or one that has sat
          fifteen days without a batch, is outstanding whatever day it arrived.
          Under "today" they would simply vanish. They lived on the dashboard,
          which meant leaving this page to see them and coming back to act. */}
      <div className="grid gap-2.5 2xl:grid-cols-2">
        <VolumetricWatchCard />
        <StaleDepotCard />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
        </div>
      ) : rows.length === 0 ? (
        <Card className="rounded-2xl">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-100 to-blue-100 dark:from-sky-950/50 dark:to-blue-950/50">
              <PackageIcon className="h-7 w-7 text-sky-500" />
            </div>
            <p className="text-sm text-muted-foreground">
              {label({
                ku: "لەم ماوەیەدا هیچ تۆمارێک نەکراوە",
                en: "Nothing was registered in this period",
                ar: "لم يُسجَّل شيء في هذه الفترة",
                zh: "此期间没有登记记录",
              })}
            </p>
            <Link href="/quick-register">
              <Button size="sm" variant="outline">
                {label({ ku: "تۆماری خێرا", en: "Quick Register", ar: "تسجيل سريع", zh: "快速登记" })}
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : groups ? (
        <div className="space-y-4">
          {groups.map((g) => {
            const kg = g.items.filter((r) => r.shippingType !== "sea").reduce((s, r) => s + num(r.weightKg), 0);
            const cbm = g.items.filter((r) => r.shippingType === "sea").reduce((s, r) => s + num(r.volumeCbm), 0);
            const value = g.items.reduce((s, r) => s + num(r.calculatedCostUsd), 0);
            return (
              <div key={g.key} className="space-y-2">
                <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-sky-200/60 bg-gradient-to-r from-sky-50 to-transparent px-3 py-2.5 dark:border-sky-900/50 dark:from-sky-950/30">
                  <span className="rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 px-2.5 py-1 font-mono text-xs font-medium text-white shadow-sm shadow-blue-500/25">
                    {g.code}
                  </span>
                  <span className="text-sm font-medium">{g.name}</span>
                  <span className="ms-auto rounded-lg bg-background/70 px-2 py-0.5 font-mono text-xs text-muted-foreground" dir="ltr">
                    {g.items.length} · {cbm > 0 ? `${cbm.toFixed(2)} CBM` : `${kg.toFixed(2)} kg`} · ${Math.round(value)}
                  </span>
                </div>
                {view !== "list"
                  ? (
                    <div className={VIEW_GRID[view]}>
                      {g.items.map((r) => <RegistrationCard key={r.id} row={r} {...cardProps} />)}
                    </div>
                  )
                  : <RegistrationTable rows={g.items} language={language} onCopy={copyTracking} onOpenOrder={openOrder} />}
              </div>
            );
          })}
        </div>
      ) : view !== "list" ? (
        <div>
          {/* A grid, not a stack: one card per full-width row left the middle of
              every card empty on a desktop screen, which is what made the page
              look unfinished. The column count follows the chosen density. */}
          <div className={VIEW_GRID[view]}>
            {rows.map((r) => <RegistrationCard key={r.id} row={r} {...cardProps} />)}
          </div>
        </div>
      ) : (
        <RegistrationTable rows={rows} language={language} onCopy={copyTracking} onOpenOrder={openOrder} />
      )}

      <PhotoGallery gallery={gallery} onChange={setGallery} language={language} />
    </div>
    </DashboardLayout>
  );
}

function Stat({
  value, caption, icon: Icon, warn,
}: {
  value: string; caption: string; icon: React.ComponentType<{ className?: string }>; warn?: boolean;
}) {
  return (
    <div className={cn(
      "rounded-2xl px-3 py-2.5 ring-1 backdrop-blur transition-colors",
      warn ? "bg-amber-400/25 ring-amber-200/40" : "bg-white/10 ring-white/15",
    )}>
      <div className="mb-0.5 flex items-center gap-1.5">
        <Icon className={cn("h-3.5 w-3.5", warn ? "text-amber-100" : "text-white/60")} />
        <p className="truncate text-[10.5px] text-white/70">{caption}</p>
      </div>
      <p className={cn("text-xl font-bold tabular-nums", warn && "text-amber-50")} dir="ltr">{value}</p>
    </div>
  );
}

function Toggle({
  active, onClick, icon: Icon, children,
}: {
  active: boolean; onClick: () => void; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[13px] font-medium ring-1 transition-all duration-200",
        active ? "bg-white text-blue-700 dark:text-blue-300 shadow-lg ring-white/40" : "bg-white/10 text-white/85 ring-white/20 hover:bg-white/20",
      )}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}

/**
 * A thumbnail that admits when its file is gone.
 *
 * Warehouse photos were stored in the container and lost on redeploy, so a
 * plain <img> renders the browser's broken-image glyph — which looks like the
 * page is broken rather than the picture being missing. Say which it is.
 */
function Thumb({
  photo, onClick, className, language,
}: {
  photo: Photo; onClick: () => void; className?: string; language: string;
}) {
  const [broken, setBroken] = useState(false);
  const Icon = PHOTO_SOURCE[photo.source].icon;

  if (broken) {
    return (
      <div className={cn(
        "flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-indigo-300 bg-indigo-50/60 text-indigo-800 dark:border-indigo-700/70 dark:bg-indigo-950/30 dark:text-indigo-200",
        className,
      )}>
        <ImageOff className="h-5 w-5" />
        <span className="text-[9.5px] font-medium">
          {pickLang(language, { ku: "وێنە نەماوە", en: "file gone", ar: "الملف مفقود", zh: "文件丢失" })}
        </span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("group/th relative overflow-hidden rounded-xl ring-1 ring-border transition-all duration-300 hover:ring-2 hover:ring-sky-400", className)}
      aria-label={pickLang(language, { ku: "گەورەکردنی وێنە", en: "Enlarge photo", ar: "تكبير الصورة", zh: "放大照片" })}
    >
      <img
        src={photo.url}
        alt=""
        loading="lazy"
        onError={() => setBroken(true)}
        className="h-full w-full object-cover transition-transform duration-500 group-hover/th:scale-110"
      />
      <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-0.5 bg-black/55 py-0.5 text-[9px] font-medium text-white">
        <Icon className="h-2.5 w-2.5" />
        {pickLang(language, PHOTO_SOURCE[photo.source].label)}
      </span>
    </button>
  );
}

function RegistrationCard({
  row, language, onCopy, onGallery, onOpenOrder, onAck, ackPending,
}: {
  row: Registration;
  language: string;
  onCopy: (tn: string) => void;
  onGallery: (g: { photos: Photo[]; index: number }) => void;
  onOpenOrder: (r: Registration) => void;
  onAck: (packageId: number) => void;
  ackPending: boolean;
}) {
  const label = (v: L) => pickLang(language, v);
  const unclaimed = row.isUnclaimed || !row.customerId;
  const noWeight = num(row.weightKg) <= 0;
  const needsAttention = unclaimed || noWeight;
  const Icon = row.shippingType === "sea" ? Ship : Plane;
  const dims = [row.lengthCm, row.widthCm, row.heightCm].every((v) => num(v) > 0)
    ? `${num(row.lengthCm)}×${num(row.widthCm)}×${num(row.heightCm)}`
    : null;
  const orderType = row.order ? ORDER_TYPE[row.order.orderType] : null;
  const staleDays = !row.batchId && row.registeredAt
    ? Math.floor((Date.now() - new Date(row.registeredAt).getTime()) / 86_400_000)
    : 0;

  // Blue for the ordinary routes, indigo for the irregular one — the palette
  // stays blue-to-purple rather than picking a new hue per route.
  const accent = row.shippingType === "sea"
    ? "from-blue-500 to-blue-700"
    : row.shippingType === "air_irregular"
      ? "from-indigo-400 to-violet-600"
      : "from-sky-400 to-blue-600";

  return (
    <Card className={cn(
      "group relative overflow-hidden rounded-2xl border-border/60 transition-all duration-300",
      "hover:-translate-y-0.5 hover:border-sky-300/70 hover:shadow-lg hover:shadow-sky-500/10 dark:hover:border-sky-700/60",
      // A gap is ordinary work, not an emergency: purple, not alarm colour.
      needsAttention && !row.needsReview && "border-indigo-300 bg-indigo-50/50 dark:border-indigo-800/70 dark:bg-indigo-950/25",
      // A possible forgotten order glows, because it is the one thing on this
      // page a person has to act on before the goods land.
      row.needsReview && "border-2 border-rose-400/90 bg-rose-50/40 shadow-lg shadow-rose-500/20 dark:border-rose-600/80 dark:bg-rose-950/20 dark:shadow-rose-900/30",
      // Money the customer has not agreed to yet. Loudest thing on the card.
      row.volumetric?.alert && !row.volumetricAckAt &&
        "border-2 border-red-500 bg-red-50/50 shadow-lg shadow-red-500/25 dark:border-red-600 dark:bg-red-950/25 dark:shadow-red-900/40",
    )}>
      <div className={cn("absolute inset-y-0 start-0 w-1 bg-gradient-to-b", accent)} />
      <CardContent className="flex gap-3 p-3 ps-4">
        <div className="flex shrink-0 gap-1">
          {row.photos.length > 0 ? (
            <>
              {/* Four side by side, then a count. One thumbnail plus "+N" hid
                  how much had actually been photographed; four is enough to
                  see the parcel from every side without the card growing. */}
              {row.photos.slice(0, 4).map((photo, i) => (
                <Thumb
                  key={`${photo.url}-${i}`}
                  photo={photo}
                  language={language}
                  className="h-[4.75rem] w-[4.75rem]"
                  onClick={() => onGallery({ photos: row.photos, index: i })}
                />
              ))}
              {row.photos.length > 4 && (
                <button
                  type="button"
                  onClick={() => onGallery({ photos: row.photos, index: 4 })}
                  className="flex h-[4.75rem] w-10 items-center justify-center rounded-xl bg-blue-50 text-sm font-semibold text-blue-800 ring-1 ring-blue-200 transition-colors hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-200 dark:ring-blue-800/60 dark:hover:bg-blue-900/50"
                >
                  +{row.photos.length - 4}
                </button>
              )}
            </>
          ) : (
            <div className="flex h-[4.75rem] w-[4.75rem] flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-indigo-300 bg-indigo-50/60 text-indigo-800 dark:border-indigo-700/70 dark:bg-indigo-950/30 dark:text-indigo-200">
              <CameraOff className="h-5 w-5" />
              <span className="text-[10px] font-medium">{label({ ku: "بێ وێنە", en: "no photo", ar: "بلا صورة", zh: "无照片" })}</span>
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn(
              "rounded-lg px-2.5 py-1 font-mono text-xs font-medium tracking-wide text-white shadow-sm",
              unclaimed
                ? "bg-gradient-to-br from-indigo-500 to-violet-600 shadow-indigo-500/25"
                : "bg-gradient-to-br from-blue-600 to-blue-800 shadow-blue-600/25",
            )}>
              {unclaimed ? label({ ku: "بێ خاوەن", en: "Unclaimed", ar: "بلا مالك", zh: "无主" }) : row.customerCode || "—"}
            </span>
            {/* The badge to the left already says "unclaimed"; repeating it
                here as the customer name just filled the row with the same
                word twice. Name the parcel instead. */}
            <span className={cn("truncate text-sm", unclaimed ? "font-mono text-muted-foreground" : "font-medium")}>
              {unclaimed ? row.packageCode : row.customerName || "—"}
            </span>
            <span className="ms-auto shrink-0 rounded-md bg-muted/60 px-2 py-0.5 font-mono text-[12px] text-muted-foreground" dir="ltr">
              {shortDateTime(row.registeredAt)}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5" dir="ltr">
            <button
              type="button"
              onClick={() => row.trackingNumber && onCopy(row.trackingNumber)}
              className="group/tn inline-flex items-center gap-1.5 rounded-lg border border-transparent bg-muted/50 px-2 py-1 font-mono text-[14px] tracking-wide transition-all duration-200 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 dark:hover:border-sky-800 dark:hover:bg-sky-950/30 dark:hover:text-sky-300"
            >
              {row.trackingNumber || "—"}
              <Copy className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover/tn:text-sky-500" />
            </button>
            {!unclaimed && (
              <span className="font-mono text-[12px] text-muted-foreground">{row.packageCode}</span>
            )}
          </div>

          {row.needsReview && (
            <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-rose-300 bg-rose-100/70 px-2.5 py-1.5 dark:border-rose-800 dark:bg-rose-950/40">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
              </span>
              <ShieldAlert className="h-4 w-4 shrink-0 text-rose-700 dark:text-rose-300" />
              <p className="text-[12px] font-medium text-rose-800 dark:text-rose-200">
                {label({
                  ku: `ئەم کڕیارە ${row.customerOpenOrders} ئۆردەری کراوەی هەیە بەڵام ئەم پارچەیە بە هیچیانەوە نەبەستراوە — ئۆفیس پشکنینی بۆ بکات`,
                  en: `This customer has ${row.customerOpenOrders} open order(s) but this parcel is attached to none — the office should check`,
                  ar: `لدى هذا العميل ${row.customerOpenOrders} طلباً مفتوحاً لكن هذا الطرد غير مرتبط بأي منها — على المكتب المراجعة`,
                  zh: `该客户有 ${row.customerOpenOrders} 个未完成订单，但此包裹未关联任何订单 — 请办公室核查`,
                })}
              </p>
            </div>
          )}

          {row.volumetric?.alert && (
            <VolumetricBanner row={row} language={language} onAck={onAck} ackPending={ackPending} />
          )}

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Chip tone="sky"><Icon className="h-3 w-3" />{pickLang(language, SHIPPING_TYPE_LABEL[row.shippingType])}</Chip>
            {row.categoryName && <Chip tone="slate">{row.categoryName}</Chip>}

            {/* The order is a link, not a label: this is how you get to it. */}
            {row.order && orderType ? (
              <button
                type="button"
                onClick={() => onOpenOrder(row)}
                className="inline-flex items-center gap-1 rounded-lg bg-violet-100 px-2.5 py-0.5 text-[11.5px] font-medium text-violet-800 ring-1 ring-violet-300/70 transition-colors hover:bg-violet-200 dark:bg-violet-950/50 dark:text-violet-200 dark:ring-violet-800/70 dark:hover:bg-violet-900/60"
              >
                {label(orderType.label)}
                <span className="font-mono text-[10.5px] opacity-75">{row.order.orderCode}</span>
                <ExternalLink className="h-3 w-3" />
              </button>
            ) : (
              <Chip tone="slate">{label(SELF_ORDER)}</Chip>
            )}

            {row.declaredByCustomer && (
              <Chip tone="emerald"><UserCircle className="h-3 w-3" />{label({ ku: "کڕیار ئاگاداری کردبووین", en: "pre-declared", ar: "أُبلغ مسبقاً", zh: "已预报" })}</Chip>
            )}
            {row.batchId ? (
              <Chip tone="sky"><Layers className="h-3.5 w-3.5" />{label({ ku: "لە باچ", en: "in batch", ar: "في دفعة", zh: "已入批次" })}</Chip>
            ) : (
              // Not in a batch means it is not going anywhere, however complete
              // the rest of the record is. Past fifteen days it is forgotten.
              <Chip tone={staleDays >= STALE_DAYS ? "red" : "amber"}>
                <Layers className="h-3.5 w-3.5" />
                {staleDays >= STALE_DAYS
                  ? label({
                      ku: `${staleDays} ڕۆژە لە کۆگا`,
                      en: `${staleDays} days in depot`,
                      ar: `${staleDays} يوماً بالمستودع`,
                      zh: `已在仓库 ${staleDays} 天`,
                    })
                  : label({ ku: "لە باچ نییە", en: "no batch", ar: "بلا دفعة", zh: "未入批次" })}
              </Chip>
            )}
            {noWeight && (
              <Chip tone="amber"><AlertTriangle className="h-3 w-3" />{label({ ku: "کێش نەنووسراوە", en: "no weight", ar: "بلا وزن", zh: "无重量" })}</Chip>
            )}
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-dashed pt-2.5 text-[13.5px]" dir="ltr">
            {noWeight ? (
              <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-100 px-2.5 py-0.5 text-[12.5px] font-medium text-indigo-900 ring-1 ring-indigo-300/70 dark:bg-indigo-950/50 dark:text-indigo-100 dark:ring-indigo-800/70">
                <Scale className="h-3.5 w-3.5" />
                {label({ ku: "بێ کێش", en: "no weight", ar: "بلا وزن", zh: "无重量" })}
              </span>
            ) : (
              <Metric unit="kg" value={num(row.weightKg).toFixed(2)} />
            )}
            {dims && <Metric unit="cm" value={dims} />}
            {num(row.volumeCbm) > 0 && <Metric unit="CBM" value={num(row.volumeCbm).toFixed(3)} />}
            {num(row.calculatedCostUsd) > 0 ? (
              <span className="rounded-lg bg-blue-700 px-2.5 py-0.5 font-mono text-[13px] font-semibold text-white shadow-sm dark:bg-blue-600">
                ${num(row.calculatedCostUsd).toFixed(2)}
              </span>
            ) : (
              <span className="rounded-lg bg-indigo-100 px-2.5 py-0.5 text-[12.5px] font-medium text-indigo-900 ring-1 ring-indigo-300/70 dark:bg-indigo-950/50 dark:text-indigo-100 dark:ring-indigo-800/70">
                {label({ ku: "نرخ دانەنراوە", en: "not priced", ar: "بلا سعر", zh: "未计价" })}
              </span>
            )}
            {row.registeredByName && (
              <span className="ms-auto inline-flex items-center gap-1.5 text-muted-foreground">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-medium uppercase">
                  {row.registeredByName.trim().charAt(0)}
                </span>
                {row.registeredByName}
              </span>
            )}
          </div>

          {(row.order?.productName || row.description) && (
            <p className="mt-1.5 truncate text-xs text-muted-foreground">
              {row.order?.productName || row.description}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * A parcel billed on its size, and the two things a person must do about it:
 * tell the customer, then record that they did.
 *
 * The WhatsApp button opens the chat with the message already written. It
 * never sends — the admin reads what is there and presses send. No message
 * about somebody's bill leaves this system without a person having looked at
 * it.
 */
function VolumetricBanner({
  row, language, onAck, ackPending,
}: {
  row: Registration;
  language: string;
  onAck: (packageId: number) => void;
  ackPending: boolean;
}) {
  const label = (v: L) => pickLang(language, v);
  const v = row.volumetric!;
  const acknowledged = Boolean(row.volumetricAckAt);
  const kg = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, ""));

  const waLink = buildWhatsAppLink(
    row.customerMobile,
    buildVolumetricMessage({
      customerName: row.customerName || "",
      trackingNumber: row.trackingNumber || row.packageCode,
      lengthCm: row.lengthCm,
      widthCm: row.widthCm,
      heightCm: row.heightCm,
      assessment: { ...v, billedOnVolume: true, alert: true },
    }),
  );

  return (
    <div className={cn(
      "mt-2 rounded-xl border px-2.5 py-2",
      acknowledged
        ? "border-emerald-300 bg-emerald-50/70 dark:border-emerald-800 dark:bg-emerald-950/30"
        : "border-red-400 bg-red-100/70 dark:border-red-700 dark:bg-red-950/40",
    )}>
      <div className="flex flex-wrap items-center gap-2">
        {!acknowledged && (
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
          </span>
        )}
        <Scale className={cn("h-4 w-4 shrink-0", acknowledged ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300")} />
        <p className={cn("text-[12px] font-medium", acknowledged ? "text-emerald-800 dark:text-emerald-200" : "text-red-800 dark:text-red-200")}>
          {label({
            ku: `کێشی قەبارەیی — حساب لەسەر ${kg(v.chargeableKg)} کیلۆ دەکرێت نەک ${kg(v.actualKg)}`,
            en: `Volumetric weight — billed at ${kg(v.chargeableKg)} kg, not ${kg(v.actualKg)}`,
            ar: `الوزن الحجمي — يُحتسب ${kg(v.chargeableKg)} كغ بدل ${kg(v.actualKg)}`,
            zh: `体积重 — 按 ${kg(v.chargeableKg)} 公斤计费，而非 ${kg(v.actualKg)}`,
          })}
        </p>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11.5px]" dir="ltr">
        <span><span className="text-muted-foreground">actual</span> {kg(v.actualKg)}</span>
        <span><span className="text-muted-foreground">volumetric</span> {kg(v.volumetricKg)}</span>
        <span className="font-medium"><span className="text-muted-foreground">charged</span> {kg(v.chargeableKg)}</span>
        <span className="text-red-700 dark:text-red-300">+{kg(v.extraKg)} kg</span>
        <span className="text-muted-foreground">×{v.ratio.toFixed(2)} · ÷{v.divisor}</span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {waLink ? (
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-2.5 py-1 text-[12px] font-medium text-white shadow-sm transition-opacity hover:opacity-90"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            {label({ ku: "ئامادەکردنی پەیام", en: "Draft WhatsApp", ar: "تحضير الرسالة", zh: "准备消息" })}
          </a>
        ) : (
          <span className="text-[11px] text-muted-foreground">
            {label({ ku: "ژمارەی مۆبایل نییە", en: "no mobile number", ar: "لا يوجد رقم", zh: "无手机号" })}
          </span>
        )}

        {acknowledged ? (
          <span className="inline-flex items-center gap-1 text-[11.5px] font-medium text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {label({ ku: "چێک کراوەتەوە", en: "checked", ar: "تمت المراجعة", zh: "已核查" })}
          </span>
        ) : (
          <button
            type="button"
            disabled={ackPending}
            onClick={() => onAck(row.id)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-400 px-2.5 py-1 text-[12px] font-medium text-red-800 transition-colors hover:bg-red-200/60 disabled:opacity-50 dark:border-red-700 dark:text-red-200 dark:hover:bg-red-900/40"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {label({ ku: "چێک کرایەوە لەگەڵ کڕیار", en: "Checked with customer", ar: "تمت المراجعة مع العميل", zh: "已与客户核实" })}
          </button>
        )}
      </div>
    </div>
  );
}

function Chip({ tone, children }: { tone: "sky" | "slate" | "violet" | "amber" | "emerald" | "red"; children: React.ReactNode }) {
  // Every tone carries an explicit dark-mode pair: inheriting the light text
  // colour left several of these unreadable on the dark theme.
  const tones = {
    // Blue carries information, indigo carries "something is missing", and
    // each tone declares both themes so neither inherits the other's text.
    sky: "bg-blue-100 text-blue-900 ring-blue-300/70 dark:bg-blue-950/50 dark:text-blue-100 dark:ring-blue-800/70",
    slate: "bg-slate-100 text-slate-800 ring-slate-300/70 dark:bg-slate-800/60 dark:text-slate-100 dark:ring-slate-700",
    violet: "bg-violet-100 text-violet-900 ring-violet-300/70 dark:bg-violet-950/50 dark:text-violet-100 dark:ring-violet-800/70",
    amber: "bg-indigo-100 text-indigo-900 ring-indigo-300/70 dark:bg-indigo-950/50 dark:text-indigo-100 dark:ring-indigo-800/70",
    emerald: "bg-blue-100 text-blue-900 ring-blue-300/70 dark:bg-blue-950/50 dark:text-blue-100 dark:ring-blue-800/70",
    red: "bg-red-100 text-red-900 ring-red-300/70 dark:bg-red-950/50 dark:text-red-100 dark:ring-red-800/70",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-lg px-2.5 py-0.5 text-[12.5px] font-medium ring-1", tones[tone])}>
      {children}
    </span>
  );
}

function Metric({ unit, value, muted }: { unit: string; value: string; muted?: boolean }) {
  return (
    <span className="inline-flex items-baseline gap-1 font-mono">
      <span className={cn("font-medium", muted && "text-muted-foreground")}>{value}</span>
      <span className="text-[11.5px] text-muted-foreground">{unit}</span>
    </span>
  );
}

/** Full-size viewer that can step through every picture of one parcel. */
function PhotoGallery({
  gallery, onChange, language,
}: {
  gallery: { photos: Photo[]; index: number } | null;
  onChange: (g: { photos: Photo[]; index: number } | null) => void;
  language: string;
}) {
  const [broken, setBroken] = useState(false);
  const current = gallery?.photos[gallery.index];

  const step = (delta: number) => {
    if (!gallery) return;
    const next = (gallery.index + delta + gallery.photos.length) % gallery.photos.length;
    setBroken(false);
    onChange({ ...gallery, index: next });
  };

  return (
    <Dialog open={Boolean(gallery)} onOpenChange={(o) => { if (!o) { setBroken(false); onChange(null); } }}>
      <DialogContent className="max-w-3xl p-3">
        {current && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Chip tone="sky">
                {pickLang(language, PHOTO_SOURCE[current.source].label)}
              </Chip>
              <span className="font-mono text-xs text-muted-foreground" dir="ltr">
                {gallery!.index + 1} / {gallery!.photos.length}
              </span>
            </div>

            {broken ? (
              <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed py-20 text-muted-foreground">
                <ImageOff className="h-8 w-8" />
                <p className="text-sm">
                  {pickLang(language, {
                    ku: "پەڕگەی ئەم وێنەیە لەسەر سێرڤەر نەماوە",
                    en: "This photo's file is no longer on the server",
                    ar: "لم يعد ملف هذه الصورة على الخادم",
                    zh: "该照片的文件已不在服务器上",
                  })}
                </p>
              </div>
            ) : (
              <img
                src={current.url}
                alt=""
                onError={() => setBroken(true)}
                className="max-h-[70vh] w-full rounded-xl object-contain"
              />
            )}

            {gallery!.photos.length > 1 && (
              <div className="flex justify-center gap-2">
                <Button size="sm" variant="outline" onClick={() => step(-1)}><ChevronRight className="h-4 w-4 rtl:hidden" /><ChevronLeft className="hidden h-4 w-4 rtl:block" /></Button>
                <Button size="sm" variant="outline" onClick={() => step(1)}><ChevronLeft className="h-4 w-4 rtl:hidden" /><ChevronRight className="hidden h-4 w-4 rtl:block" /></Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RegistrationTable({
  rows, language, onCopy, onOpenOrder,
}: {
  rows: Registration[];
  language: string;
  onCopy: (tn: string) => void;
  onOpenOrder: (r: Registration) => void;
}) {
  const label = (v: L) => pickLang(language, v);
  return (
    <div className="overflow-x-auto rounded-2xl border shadow-sm">
      <table className="w-full text-[13.5px]">
        <thead className="bg-blue-100/70 text-[12.5px] font-semibold text-blue-900 dark:bg-blue-950/60 dark:text-blue-100">
          <tr>
            <th className="px-3 py-2.5 text-start font-semibold">{label({ ku: "وێنە", en: "Photo", ar: "صورة", zh: "照片" })}</th>
            <th className="px-3 py-2.5 text-start font-semibold">{label({ ku: "کڕیار", en: "Customer", ar: "العميل", zh: "客户" })}</th>
            <th className="px-3 py-2.5 text-start font-semibold">{label({ ku: "تراک", en: "Tracking", ar: "التتبّع", zh: "追踪号" })}</th>
            <th className="px-3 py-2.5 text-start font-semibold">{label({ ku: "ئۆردەر", en: "Order", ar: "الطلب", zh: "订单" })}</th>
            <th className="px-3 py-2.5 text-start font-semibold">{label({ ku: "ڕێگا", en: "Route", ar: "المسار", zh: "路线" })}</th>
            <th className="px-3 py-2.5 text-end font-semibold">{label({ ku: "کێش", en: "Weight", ar: "الوزن", zh: "重量" })}</th>
            <th className="px-3 py-2.5 text-end font-semibold">CBM</th>
            <th className="px-3 py-2.5 text-end font-semibold">{label({ ku: "نرخ", en: "Price", ar: "السعر", zh: "价格" })}</th>
            <th className="px-3 py-2.5 text-start font-semibold">{label({ ku: "تۆمارکەر", en: "By", ar: "بواسطة", zh: "登记人" })}</th>
            <th className="px-3 py-2.5 text-start font-semibold">{label({ ku: "کات", en: "Time", ar: "الوقت", zh: "时间" })}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const orderType = r.order ? ORDER_TYPE[r.order.orderType] : null;
            return (
              <tr key={r.id} className="border-t border-blue-100 text-foreground transition-colors hover:bg-blue-50/70 dark:border-blue-950/60 dark:hover:bg-blue-950/30">
                <td className="px-3 py-2">
                  {r.photos[0]
                    ? <Thumb photo={r.photos[0]} language={language} className="h-9 w-9" onClick={() => { /* table view keeps it compact */ }} />
                    : <CameraOff className="h-4 w-4 text-muted-foreground" />}
                </td>
                <td className="px-3 py-2">
                  <div className="font-mono text-[13px] font-medium text-foreground">{r.customerCode || label({ ku: "بێ خاوەن", en: "Unclaimed", ar: "بلا مالك", zh: "无主" })}</div>
                  <div className="truncate text-[12.5px] text-foreground/70">{r.customerName || "—"}</div>
                </td>
                <td className="px-3 py-2">
                  <button type="button" onClick={() => r.trackingNumber && onCopy(r.trackingNumber)} className="font-mono text-[13px] text-foreground hover:text-blue-700 dark:hover:text-blue-300" dir="ltr">
                    {r.trackingNumber || "—"}
                  </button>
                </td>
                <td className="px-3 py-2.5 text-[12.5px]">
                  {r.order && orderType ? (
                    <button type="button" onClick={() => onOpenOrder(r)} className="inline-flex items-center gap-1 font-medium text-violet-800 hover:underline dark:text-violet-200">
                      {label(orderType.label)}
                      <ExternalLink className="h-3 w-3" />
                    </button>
                  ) : r.needsReview ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-rose-100 px-1.5 py-0.5 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200">
                      <ShieldAlert className="h-3 w-3" />
                      {label(SELF_ORDER)}
                    </span>
                  ) : (
                    <span className="text-foreground/70">{label(SELF_ORDER)}</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-[12.5px] text-foreground/85">{pickLang(language, SHIPPING_TYPE_LABEL[r.shippingType])}</td>
                <td className="px-3 py-2.5 text-end font-mono text-[13px] text-foreground" dir="ltr">{num(r.weightKg) > 0 ? num(r.weightKg).toFixed(2) : "—"}</td>
                <td className="px-3 py-2.5 text-end font-mono text-[13px] text-foreground" dir="ltr">{num(r.volumeCbm) > 0 ? num(r.volumeCbm).toFixed(3) : "—"}</td>
                <td className="px-3 py-2.5 text-end font-mono text-[13px] font-semibold text-blue-800 dark:text-blue-200" dir="ltr">{num(r.calculatedCostUsd) > 0 ? `$${num(r.calculatedCostUsd).toFixed(2)}` : "—"}</td>
                <td className="px-3 py-2.5 text-[12.5px] text-foreground/75">{r.registeredByName || "—"}</td>
                <td className="px-3 py-2.5 font-mono text-[12.5px] text-foreground/75" dir="ltr">{shortDateTime(r.registeredAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
