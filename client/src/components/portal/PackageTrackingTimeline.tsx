import { CheckCircle, Truck, Package, MapPin, Clock, Warehouse, Ship, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { pickLang } from "@/lib/lang";

// ---------------------------------------------------------------------------
// PackageTrackingTimeline — the customer-facing movement timeline.
// Renders the canonical journey China → batch → transit → Erbil → delivery.
// When real `events` (from customerPortal.getPackageTimeline) are provided,
// each completed stage shows its actual date; otherwise it falls back to a
// synthetic view derived from `currentStatus` alone.
// ---------------------------------------------------------------------------

type L10n = { ku: string; en: string; ar: string; zh: string };

const STAGES: { key: string; label: L10n; icon: typeof Package; color: string }[] = [
  { key: "registered",       label: { ku: "تۆمارکرا",            en: "Registered",          ar: "تم التسجيل",        zh: "已登记" },   icon: Package,   color: "bg-slate-500" },
  { key: "received_china",   label: { ku: "گەیشتە کۆگای چین",     en: "At China warehouse",  ar: "في مستودع الصين",   zh: "到达中国仓库" }, icon: Warehouse, color: "bg-violet-500" },
  { key: "in_batch",         label: { ku: "خرایە ناو باچ",        en: "Added to shipment",   ar: "أُضيف إلى الشحنة",  zh: "已加入批次" },  icon: Package,   color: "bg-blue-500" },
  { key: "in_transit",       label: { ku: "لە ڕێگادایە",          en: "In transit",          ar: "قيد الشحن",         zh: "运输中" },    icon: Ship,      color: "bg-amber-500" },
  { key: "received_local",   label: { ku: "گەیشتە کۆگای هەولێر",  en: "At Erbil warehouse",  ar: "في مستودع أربيل",   zh: "到达埃尔比勒仓库" }, icon: MapPin, color: "bg-cyan-500" },
  { key: "out_for_delivery", label: { ku: "لە ڕێی گەیاندنە",      en: "Out for delivery",    ar: "خرج للتسليم",       zh: "派送中" },    icon: Truck,     color: "bg-indigo-500" },
  { key: "delivered",        label: { ku: "گەیێنرا",             en: "Delivered",           ar: "تم التسليم",        zh: "已送达" },    icon: CheckCircle, color: "bg-emerald-500" },
];

// Normalize the many raw status spellings stored by different flows (enum
// keys, scanTypes, human-readable strings) onto the canonical stage keys.
const RAW_TO_STAGE: Record<string, string> = {
  registered: "registered", Registered: "registered",
  received_china: "received_china", "In China Warehouse": "received_china",
  in_batch: "in_batch", "In Batch": "in_batch",
  in_transit: "in_transit", "In Transit": "in_transit",
  customs_processing: "in_transit", customs_hold: "in_transit", "Customs Hold": "in_transit",
  received_local: "received_local", "In Local Warehouse": "received_local",
  ready_for_delivery: "received_local",
  out_for_delivery: "out_for_delivery", "Out for Delivery": "out_for_delivery",
  delivered: "delivered", Delivered: "delivered",
};

export interface TimelineEvent {
  status: string;
  at: string | Date;
}

interface PackageTrackingTimelineProps {
  currentStatus: string;
  /** Real movement events (customerPortal.getPackageTimeline). Optional. */
  events?: TimelineEvent[];
  estimatedDelivery?: string | null;
  language?: string;
  className?: string;
}

function fmtDate(d: string | Date, language: string): string {
  const date = new Date(d);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleString(language === "zh" ? "zh-CN" : "en-GB", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export function PackageTrackingTimeline({
  currentStatus,
  events,
  estimatedDelivery,
  language = "en",
  className,
}: PackageTrackingTimelineProps) {
  // First timestamp per canonical stage, from real events.
  const stageDates = new Map<string, string | Date>();
  for (const e of events ?? []) {
    const stage = RAW_TO_STAGE[e.status];
    if (stage && !stageDates.has(stage)) stageDates.set(stage, e.at);
  }

  const normalizedCurrent = RAW_TO_STAGE[currentStatus] ?? currentStatus;
  // The furthest stage reached: prefer real events, fall back to currentStatus.
  let currentIndex = STAGES.findIndex((s) => s.key === normalizedCurrent);
  for (let i = STAGES.length - 1; i >= 0; i--) {
    if (stageDates.has(STAGES[i].key)) { currentIndex = Math.max(currentIndex, i); break; }
  }
  const safeIndex = currentIndex >= 0 ? currentIndex : 0;
  const isDeliveredAll = normalizedCurrent === "delivered" || stageDates.has("delivered");

  /**
   * A parcel that was returned or cancelled is not on this road at all.
   *
   * Neither status is in RAW_TO_STAGE, so findIndex returned -1, safeIndex
   * fell back to 0, and the timeline showed a cancelled parcel sitting
   * cheerfully at step 1 of 5 — "Registered", as if it were on its way.
   */
  const terminal = currentStatus === "returned" || currentStatus === "cancelled";
  if (terminal) {
    const isReturned = currentStatus === "returned";
    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-xl border p-4",
          isReturned
            ? "border-rose-200 bg-rose-50 dark:border-rose-900/60 dark:bg-rose-950/30"
            : "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40",
          className,
        )}
      >
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white",
            isReturned ? "bg-rose-500" : "bg-slate-500",
          )}
        >
          <AlertCircle className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground">
            {isReturned
              ? pickLang(language, { ku: "گەڕێندراوەتەوە", en: "Returned", ar: "مُرتجع", zh: "已退回" })
              : pickLang(language, { ku: "هەڵوەشێنراوەتەوە", en: "Cancelled", ar: "ملغى", zh: "已取消" })}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {isReturned
              ? pickLang(language, {
                  ku: "ئەم پاکەتە گەڕێندراوەتەوە. بۆ وردەکاری پەیوەندیمان پێوە بکە.",
                  en: "This parcel was returned. Contact us for details.",
                  ar: "تم إرجاع هذا الطرد. تواصل معنا للتفاصيل.",
                  zh: "该包裹已退回，详情请联系我们。",
                })
              : pickLang(language, {
                  ku: "ئەم پاکەتە هەڵوەشێنراوەتەوە.",
                  en: "This parcel was cancelled.",
                  ar: "تم إلغاء هذا الطرد.",
                  zh: "该包裹已取消。",
                })}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-0", className)}>
      {STAGES.map((stage, index) => {
        const isDone = index < safeIndex || isDeliveredAll;
        const isCurrent = index === safeIndex && !isDeliveredAll;
        const Icon = stage.icon;
        const label = pickLang(language, stage.label);
        const date = stageDates.get(stage.key);

        return (
          <div key={stage.key} className="flex gap-3">
            <div className="flex flex-col items-center shrink-0">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center transition-colors",
                  isDone && "bg-emerald-500 text-white",
                  isCurrent && !isDone && `${stage.color} text-white ring-2 ring-offset-2 ring-offset-background`,
                  !isDone && !isCurrent && "bg-muted text-muted-foreground"
                )}
              >
                {isDone ? <CheckCircle className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
              </div>
              {index < STAGES.length - 1 && (
                <div className={cn("w-0.5 min-h-[20px] flex-1", isDone ? "bg-emerald-500" : "bg-muted")} />
              )}
            </div>
            <div className={cn("pb-1", index === STAGES.length - 1 && "pb-0")}>
              <p
                className={cn(
                  "text-sm font-medium",
                  isCurrent && "text-foreground",
                  isDone && "text-emerald-600",
                  !isDone && !isCurrent && "text-muted-foreground"
                )}
              >
                {label}
              </p>
              {date && (isDone || isCurrent) && (
                <p className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">
                  {fmtDate(date, language)}
                </p>
              )}
              {isCurrent && stage.key === "in_transit" && estimatedDelivery && (
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {pickLang(language, { ku: "چاوەڕوانی گەیشتن: ", en: "Est. arrival: ", ar: "الوصول المتوقع: ", zh: "预计到达：" })}
                  {new Date(estimatedDelivery).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
