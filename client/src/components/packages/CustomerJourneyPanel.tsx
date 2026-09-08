import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  buildCustomerJourney,
  type CustomerJourney,
  type JourneyCohort,
  type JourneyItem,
  type JourneyStation,
} from "@/lib/customerJourney";
import { STATUS_LABEL } from "@/lib/shipmentFilters";
import {
  X, Package, Plane, ClockAlert, MapPinCheck, Box, Camera,
  ChevronDown, ChevronUp, CalendarDays, ImageOff, LayoutGrid,
} from "lucide-react";

/**
 * The answer to the commonest phone call: "how many of my pieces are still
 * missing, and where is the rest?" One customer, every record source, five
 * stations — classified by lib/customerJourney.ts, the same stage rules the
 * customer's own portal counts with, so the counter never contradicts the app.
 */

const STATION_META: Record<JourneyStation, {
  icon: typeof Package;
  label: { ku: string; en: string; ar: string; zh: string };
  tile: string;
  value: string;
}> = {
  not_arrived: {
    icon: ClockAlert,
    label: { ku: "نەگەیشتووەتە کۆگا", en: "Not at the depot yet", ar: "لم يصل المستودع", zh: "未到仓库" },
    tile: "border-rose-300 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-950/30",
    value: "text-rose-600 dark:text-rose-400",
  },
  in_china: {
    icon: Package,
    label: STATUS_LABEL.preparing,
    tile: "border-slate-200 dark:border-slate-700 bg-card",
    value: "text-slate-800 dark:text-slate-100",
  },
  on_the_way: {
    icon: Plane,
    label: STATUS_LABEL.in_transit,
    tile: "border-sky-300 dark:border-sky-500/40 bg-sky-50 dark:bg-sky-950/30",
    value: "text-sky-600 dark:text-sky-400",
  },
  in_iraq: {
    icon: MapPinCheck,
    label: STATUS_LABEL.arrived,
    tile: "border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/30",
    value: "text-emerald-600 dark:text-emerald-400",
  },
  delivered: {
    icon: Box,
    label: STATUS_LABEL.delivered,
    tile: "border-violet-300 dark:border-violet-500/40 bg-violet-50 dark:bg-violet-950/30",
    value: "text-violet-600 dark:text-violet-400",
  },
};

const SOURCE_LABEL: Record<string, { ku: string; en: string; ar: string; zh: string }> = {
  full_package: { ku: "پاکێجی تەواو", en: "Full package", ar: "حزمة كاملة", zh: "全包" },
  commission: { ku: "عمولە", en: "Commission", ar: "عمولة", zh: "代购" },
  purchase_request: { ku: "داواکاری کڕین", en: "Purchase request", ar: "طلب شراء", zh: "采购请求" },
  declared: { ku: "پۆرتاڵ — خۆی نووسیوە", en: "Portal — self-declared", ar: "البوابة — سجّله بنفسه", zh: "门户自报" },
  scan: { ku: "سکانی کۆگا", en: "Depot scan", ar: "مسح المستودع", zh: "仓库扫描" },
};

function Thumb({ item, onOpen }: { item: JourneyItem; onOpen: (src: string) => void }) {
  const { language } = useLanguage();
  if (!item.photo) {
    return (
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-muted">
        <ImageOff className="h-4 w-4 text-muted-foreground" />
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onOpen(item.photo!)}
      aria-label={pickLang(language, { ku: "گەورەکردنی وێنە", en: "Enlarge photo", ar: "تكبير الصورة", zh: "放大图片" })}
      className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-border"
    >
      <img src={item.photo} alt="" loading="lazy" className="h-full w-full object-cover" />
      {item.scanPhoto && (
        <span className="absolute bottom-0.5 start-0.5 flex h-4 w-4 items-center justify-center rounded bg-slate-900/75">
          <Camera className="h-2.5 w-2.5 text-sky-300" />
        </span>
      )}
    </button>
  );
}

function ItemRow({ item, onOpenPhoto }: { item: JourneyItem; onOpenPhoto: (src: string) => void }) {
  const { language } = useLanguage();
  const pending = item.station === "not_arrived";
  const sourceKey = item.source === "order" ? (item.orderType ?? "commission") : item.source;
  const stationLabel = pending
    ? null
    : pickLang(language, STATION_META[item.station].label);

  return (
    <div className={cn("flex items-center gap-3 border-t border-border px-3 py-2", pending && "bg-rose-50/50 dark:bg-rose-950/20")}>
      <Thumb item={item} onOpen={onOpenPhoto} />
      <div className="min-w-0 flex-1">
        <p dir="ltr" className="truncate font-mono text-sm font-semibold text-end">
          {item.tracking ?? pickLang(language, { ku: "بێ تراک", en: "No tracking", ar: "بدون تتبع", zh: "无运单号" })}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {item.title || "—"}
          {item.weightKg != null && <span dir="ltr" className="tabular-nums"> · {item.weightKg.toFixed(2)} kg</span>}
          {item.volumeCbm != null && item.weightKg == null && <span dir="ltr" className="tabular-nums"> · {item.volumeCbm.toFixed(3)} m³</span>}
          {item.batchCode && <span dir="ltr"> · {item.batchCode}</span>}
          {item.boxCode && <span dir="ltr"> · {item.boxCode}</span>}
          {pending && (
            <span className="text-rose-600 dark:text-rose-400">
              {" · "}
              {pickLang(language, {
                ku: `${item.waitingDays} ڕۆژە چاوەڕوانە`,
                en: `waiting ${item.waitingDays} days`,
                ar: `بانتظار ${item.waitingDays} يومًا`,
                zh: `已等待 ${item.waitingDays} 天`,
              })}
            </span>
          )}
        </p>
      </div>
      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
        {pickLang(language, SOURCE_LABEL[sourceKey] ?? SOURCE_LABEL.scan)}
      </span>
      {pending ? (
        <span className="shrink-0 rounded-full bg-rose-100 dark:bg-rose-900/40 px-2 py-0.5 text-[10px] font-medium text-rose-700 dark:text-rose-300">
          {pickLang(language, { ku: "لەگەڵ فرۆشیار چێک بکە", en: "Check with the seller", ar: "راجع البائع", zh: "请与卖家核实" })}
        </span>
      ) : (
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          {stationLabel}
        </span>
      )}
    </div>
  );
}

function CohortCard({ cohort, stationFilter, onOpenPhoto }: {
  cohort: JourneyCohort;
  stationFilter: JourneyStation | null;
  onOpenPhoto: (src: string) => void;
}) {
  const { language } = useLanguage();
  // A day with something missing opens itself: that is the day being asked
  // about. Under a station filter every shown day opens — the reader picked
  // exactly what they want to see.
  const [open, setOpen] = useState(stationFilter !== null || cohort.pending > 0);

  const visible = stationFilter
    ? cohort.items.filter(i => i.station === stationFilter)
    : cohort.items;
  if (visible.length === 0) return null;

  const date = new Date(`${cohort.date}T12:00:00`);
  const dateLabel = new Intl.DateTimeFormat(language === "ku" || language === "ar" ? "ar" : language, {
    day: "numeric", month: "long", year: "numeric",
  }).format(date);
  const pct = cohort.items.length > 0 ? Math.round((cohort.arrived / cohort.items.length) * 100) : 0;
  const flagged = stationFilter === null && cohort.pending > 0;

  return (
    <div className={cn("overflow-hidden rounded-xl border", flagged ? "border-rose-300 dark:border-rose-500/40" : "border-border")}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className={cn("flex w-full items-center gap-3 px-3 py-2.5 text-start", flagged && "bg-rose-50/60 dark:bg-rose-950/20")}
      >
        {open ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">
            {dateLabel} · <span className="tabular-nums">{visible.length}</span>
          </p>
          {/* The arrival bar describes the whole day; under a station filter
              it would describe rows that are not on screen, so it rests. */}
          {stationFilter === null && (
            <div className="mt-1 h-1.5 max-w-[220px] overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full", cohort.pending > 0 ? "bg-blue-500" : "bg-emerald-500")}
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
        </div>
        {stationFilter !== null ? (
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
            {pickLang(language, STATION_META[stationFilter].label)}
          </span>
        ) : cohort.pending > 0 ? (
          <>
            <span className="shrink-0 rounded-full bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-300 tabular-nums">
              {cohort.arrived} {pickLang(language, { ku: "گەیشتووە", en: "arrived", ar: "وصلت", zh: "已到" })}
            </span>
            <span className="shrink-0 rounded-full bg-rose-100 dark:bg-rose-900/40 px-2 py-0.5 text-[10px] font-semibold text-rose-700 dark:text-rose-300 tabular-nums">
              {cohort.pending} {pickLang(language, { ku: "نەگەیشتووە", en: "missing", ar: "لم تصل", zh: "未到" })}
            </span>
          </>
        ) : (
          <span className="shrink-0 rounded-full bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
            {pickLang(language, { ku: "هەموو گەیشتوون ✓", en: "All arrived ✓", ar: "وصلت كلها ✓", zh: "全部到达 ✓" })}
          </span>
        )}
      </button>
      {open && visible.map(item => <ItemRow key={item.key} item={item} onOpenPhoto={onOpenPhoto} />)}
    </div>
  );
}

export function CustomerJourneyPanel({
  customerId,
  customerCode,
  customerName,
  onClose,
}: {
  customerId: number;
  customerCode: string | null;
  customerName: string | null;
  onClose: () => void;
}) {
  const { language } = useLanguage();
  const query = trpc.packages.customerJourney.useQuery({ customerId });
  const [photoOpen, setPhotoOpen] = useState<string | null>(null);
  const [showAllCohorts, setShowAllCohorts] = useState(false);
  // Tapping a station shows only that station's rows; «هەموو» clears it.
  const [stationFilter, setStationFilter] = useState<JourneyStation | null>(null);

  const journey: CustomerJourney | null = useMemo(
    () => (query.data ? buildCustomerJourney(query.data) : null),
    [query.data],
  );

  const cohorts = journey ? (showAllCohorts ? journey.orderCohorts : journey.orderCohorts.slice(0, 8)) : [];

  return (
    <Card className="border-blue-300 dark:border-blue-500/40">
      <CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold">
              {pickLang(language, { ku: "بارودۆخی پاکەتەکان", en: "Package status", ar: "حالة الطرود", zh: "包裹状态" })}
              {" — "}
              <span dir="ltr" className="font-mono">{customerCode}</span>
              {customerName && <span className="text-muted-foreground"> · {customerName}</span>}
            </p>
            <p className="text-xs text-muted-foreground">
              {pickLang(language, {
                ku: "ئۆردەر + تۆماری پۆرتاڵ + سکانی کۆگا + بۆکس — هەموو سەرچاوەکان بە تراک لێکدراونەتەوە",
                en: "Orders + portal declarations + depot scans + boxes, matched by tracking",
                ar: "الطلبات + تسجيلات البوابة + مسح المستودع + الصناديق، مطابقة برقم التتبع",
                zh: "订单 + 门户登记 + 仓库扫描 + 箱子，按运单号匹配",
              })}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label={pickLang(language, { ku: "داخستن", en: "Close", ar: "إغلاق", zh: "关闭" })}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {query.isLoading ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
            </div>
            <Skeleton className="h-16 rounded-xl" />
          </div>
        ) : query.isError ? (
          <div className="rounded-xl border border-border p-4 text-center">
            <p className="text-sm text-muted-foreground">
              {pickLang(language, { ku: "نەگەیشت — دووبارە هەوڵ بدەرەوە", en: "Failed to load — try again", ar: "فشل التحميل — أعد المحاولة", zh: "加载失败——请重试" })}
            </p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => query.refetch()}>
              {pickLang(language, { ku: "هەوڵدانەوە", en: "Retry", ar: "إعادة المحاولة", zh: "重试" })}
            </Button>
          </div>
        ) : journey && (
          <>
            <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
              <button
                type="button"
                onClick={() => setStationFilter(null)}
                aria-pressed={stationFilter === null}
                className={cn(
                  "rounded-xl border border-blue-300 dark:border-blue-500/40 bg-blue-50 dark:bg-blue-950/30 p-3 text-center transition-all active:scale-[0.98]",
                  stationFilter === null && "ring-2 ring-blue-500",
                )}
              >
                <LayoutGrid className="mx-auto h-4 w-4 text-blue-600 dark:text-blue-400" />
                <p className="mt-1 text-xl font-bold tabular-nums text-blue-600 dark:text-blue-400">
                  {(Object.values(journey.counts) as number[]).reduce((a, b) => a + b, 0)}
                </p>
                <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">
                  {pickLang(language, { ku: "هەموو", en: "All", ar: "الكل", zh: "全部" })}
                </p>
              </button>
              {(Object.keys(STATION_META) as JourneyStation[]).map(st => {
                const meta = STATION_META[st];
                const Icon = meta.icon;
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStationFilter(prev => (prev === st ? null : st))}
                    aria-pressed={stationFilter === st}
                    className={cn(
                      "rounded-xl border p-3 text-center transition-all active:scale-[0.98]",
                      meta.tile,
                      stationFilter === st && "ring-2 ring-blue-500",
                    )}
                  >
                    <Icon className={cn("mx-auto h-4 w-4", meta.value)} />
                    <p className={cn("mt-1 text-xl font-bold tabular-nums", meta.value)}>{journey.counts[st]}</p>
                    <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">{pickLang(language, meta.label)}</p>
                  </button>
                );
              })}
            </div>

            {stationFilter !== null && journey.counts[stationFilter] === 0 && (
              <p className="mt-3 rounded-xl border border-border p-3 text-center text-xs text-muted-foreground">
                {pickLang(language, { ku: "لەم وێستگەیەدا هیچ نییە", en: "Nothing in this station", ar: "لا يوجد شيء في هذه المحطة", zh: "此站没有任何内容" })}
              </p>
            )}

            {journey.orderCohorts.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {pickLang(language, { ku: "ئۆردەرەکان بە بەرواری تۆمارکردن", en: "Orders by entry date", ar: "الطلبات حسب تاريخ التسجيل", zh: "按登记日期分组的订单" })}
                </p>
                <div className="space-y-2">
                  {cohorts.map(c => (
                    <CohortCard
                      key={`${c.date}-${stationFilter ?? "all"}`}
                      cohort={c}
                      stationFilter={stationFilter}
                      onOpenPhoto={setPhotoOpen}
                    />
                  ))}
                </div>
                {!showAllCohorts && journey.orderCohorts.length > 8 && (
                  <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => setShowAllCohorts(true)}>
                    {pickLang(language, {
                      ku: `${journey.orderCohorts.length - 8} پۆلی کۆنتر ببینە`,
                      en: `Show ${journey.orderCohorts.length - 8} older days`,
                      ar: `عرض ${journey.orderCohorts.length - 8} أيام أقدم`,
                      zh: `查看更早的 ${journey.orderCohorts.length - 8} 天`,
                    })}
                  </Button>
                )}
              </div>
            )}

            {journey.scanCohorts.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-bold text-muted-foreground">
                  {pickLang(language, { ku: "سکانی ڕاستەوخۆ — بێ ئۆردەر (بە بەرواری سکان)", en: "Direct scans — no order behind them (by scan date)", ar: "مسح مباشر — بدون طلب (حسب تاريخ المسح)", zh: "直接扫描——无订单（按扫描日期）" })}
                </p>
                <div className="space-y-2">
                  {journey.scanCohorts.slice(0, showAllCohorts ? undefined : 4).map(c => (
                    <CohortCard
                      key={`${c.date}-${stationFilter ?? "all"}`}
                      cohort={c}
                      stationFilter={stationFilter}
                      onOpenPhoto={setPhotoOpen}
                    />
                  ))}
                </div>
              </div>
            )}

            {journey.orderCohorts.length === 0 && journey.scanCohorts.length === 0 && (
              <p className="mt-4 rounded-xl border border-border p-4 text-center text-sm text-muted-foreground">
                {pickLang(language, { ku: "ئەم کڕیارە هیچ تۆمارێکی نییە", en: "This customer has no records", ar: "لا توجد سجلات لهذا العميل", zh: "该客户没有任何记录" })}
              </p>
            )}
          </>
        )}

        {photoOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
            onClick={() => setPhotoOpen(null)}
            role="dialog"
            aria-label={pickLang(language, { ku: "وێنە", en: "Photo", ar: "صورة", zh: "图片" })}
          >
            <img src={photoOpen} alt="" className="max-h-full max-w-full rounded-xl object-contain" />
            <button
              type="button"
              className="absolute top-4 end-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white"
              onClick={() => setPhotoOpen(null)}
              aria-label={pickLang(language, { ku: "داخستن", en: "Close", ar: "إغلاق", zh: "关闭" })}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
