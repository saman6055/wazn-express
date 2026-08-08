import { Copy, Package as PackageIcon, Plane, Ship, Scale, Box, Calendar, CheckCircle2, Truck } from "lucide-react";
import { toast } from "sonner";
import { PhotoStack } from "@/components/PhotoStack";
import { PACKAGE_STATUS_LABEL } from "@/lib/packageStatus";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";

/**
 * One parcel the customer bought themselves — we only shipped it.
 *
 * Deliberately not the order card. A self order has no purchase behind it, so
 * it has no order code, no product price and no supplier; rendering it through
 * a card built for orders would show a row of empty fields and invite the
 * reader to believe we bought something we did not.
 *
 * A card here is temporary by nature: as soon as an admin enters the purchase
 * order carrying this tracking number, the parcel is linked and moves to its
 * real order. Nothing about this component stores or caches that state.
 */

type L = { ku: string; en: string; ar: string; zh: string };

export interface SelfOrderPackage {
  id: number;
  packageCode: string;
  trackingNumber: string | null;
  description: string | null;
  photos: unknown;
  status: string;
  shippingType: string | null;
  weightKg: string | null;
  volumeCbm: string | null;
  calculatedCostUsd: string | null;
  isCharged: boolean;
  batchCode: string | null;
  createdAt: string | Date;
  deliveredAt: string | Date | null;
}

// Labels come from the shared map (lib/packageStatus); only the colour and
// icon per status are this card's own.
const STATUS: Record<string, { cls: string; icon: typeof Truck }> = {
  registered: { cls: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300", icon: PackageIcon },
  in_batch: { cls: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300", icon: Box },
  in_transit: { cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300", icon: Truck },
  customs_processing: { cls: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300", icon: Truck },
  ready_for_delivery: { cls: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300", icon: CheckCircle2 },
  out_for_delivery: { cls: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300", icon: Truck },
  delivered: { cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300", icon: CheckCircle2 },
  returned: { cls: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300", icon: PackageIcon },
  cancelled: { cls: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300", icon: PackageIcon },
};

const SHIPPING: Record<string, { label: L; icon: typeof Plane }> = {
  air_regular: { label: { ku: "ئاسمانی ئاسایی", en: "Air regular", ar: "جوي عادي", zh: "普通空运" }, icon: Plane },
  air_irregular: { label: { ku: "ئاسمانی مەرسیدار", en: "Air irregular", ar: "جوي خاص", zh: "特殊空运" }, icon: Plane },
  sea: { label: { ku: "دەریایی", en: "Sea freight", ar: "بحري", zh: "海运" }, icon: Ship },
};

function fmtDate(v: string | Date | null): string {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-GB");
}

export function SelfOrderCard({
  pkg,
  language,
  isDark,
}: {
  pkg: SelfOrderPackage;
  language: string;
  isDark: boolean;
}) {
  const pick = (v: L) => pickLang(language, v);
  const status = STATUS[pkg.status] ?? STATUS.registered;
  const statusLabel = PACKAGE_STATUS_LABEL[pkg.status] ?? PACKAGE_STATUS_LABEL.registered;
  const StatusIcon = status.icon;
  const shipping = pkg.shippingType ? SHIPPING[pkg.shippingType] : undefined;
  const ShippingIcon = shipping?.icon;

  // Sea is billed by volume and air by weight, so showing both would put a
  // number on screen that nobody is charged for.
  const isSea = pkg.shippingType === "sea";
  const measure = isSea
    ? { value: pkg.volumeCbm, unit: "CBM", icon: Box }
    : { value: pkg.weightKg, unit: "KG", icon: Scale };
  const measureValue = parseFloat(String(measure.value ?? "0"));

  const cost = parseFloat(String(pkg.calculatedCostUsd ?? "0"));

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(pick({ ku: "کۆپی کرا", en: "Copied", ar: "تم النسخ", zh: "已复制" }));
  };

  return (
    <div
      className={cn(
        "rounded-2xl border p-3.5",
        isDark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-100 dark:border-slate-800/60 shadow-sm",
      )}
    >
      <div className="flex items-start gap-3">
        <PhotoStack
          photos={Array.isArray(pkg.photos) ? (pkg.photos as string[]) : []}
          className="h-16 w-16 rounded-xl"
          fallback={
            <div className={cn(
              "flex h-16 w-16 shrink-0 items-center justify-center rounded-xl",
              isDark ? "bg-slate-700" : "bg-slate-100 dark:bg-slate-950/40",
            )}>
              <PackageIcon className={cn("h-7 w-7", isDark ? "text-slate-500" : "text-slate-400")} />
            </div>
          }
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className={cn("truncate text-sm font-bold", isDark ? "text-white" : "text-slate-800 dark:text-slate-200")}>
              {pkg.description || pkg.packageCode}
            </p>
            <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", status.cls)}>
              <StatusIcon className="h-3 w-3" />
              {pick(statusLabel)}
            </span>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {pkg.trackingNumber && (
              <button
                type="button"
                onClick={() => copy(pkg.trackingNumber!)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[11px] font-bold",
                  isDark ? "border-slate-600 text-slate-300" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300",
                )}
                dir="ltr"
              >
                {pkg.trackingNumber}
                <Copy className="h-3 w-3" />
              </button>
            )}

            {shipping && ShippingIcon && (
              <span className={cn("inline-flex items-center gap-1 text-[11px]", isDark ? "text-slate-400" : "text-slate-500")}>
                <ShippingIcon className="h-3 w-3" />
                {pick(shipping.label)}
              </span>
            )}

            {measureValue > 0 && (
              <span className={cn("inline-flex items-center gap-1 text-[11px] tabular-nums", isDark ? "text-slate-400" : "text-slate-500")} dir="ltr">
                <measure.icon className="h-3 w-3" />
                {measureValue} {measure.unit}
              </span>
            )}

            {pkg.batchCode && (
              <span className={cn("inline-flex items-center gap-1 font-mono text-[11px]", isDark ? "text-slate-400" : "text-slate-500")} dir="ltr">
                <Box className="h-3 w-3" />
                {pkg.batchCode}
              </span>
            )}

            <span className={cn("ms-auto inline-flex items-center gap-1 text-[10px] tabular-nums", isDark ? "text-slate-500" : "text-slate-400")} dir="ltr">
              <Calendar className="h-3 w-3" />
              {fmtDate(pkg.createdAt)}
            </span>
          </div>

          {cost > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <span className={cn("text-base font-black tabular-nums", isDark ? "text-white" : "text-slate-900 dark:text-slate-200")} dir="ltr">
                ${cost.toFixed(2)}
              </span>
              <span className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                pkg.isCharged
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
              )}>
                {pkg.isCharged
                  ? pick({ ku: "خرایە سەر حساب", en: "Charged", ar: "تمت الفوترة", zh: "已计费" })
                  : pick({ ku: "هێشتا نەخراوەتە سەر حساب", en: "Not charged yet", ar: "لم تُفوتر بعد", zh: "尚未计费" })}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
