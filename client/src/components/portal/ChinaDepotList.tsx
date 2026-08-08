import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";
import { PackageThumb, usePackageImages } from "@/components/portal/PackageThumb";
import { STATUS_LABEL, orderStageOf } from "@/lib/shipmentFilters";
import { filterChinaDepot } from "@/lib/chinaDepotFilter";
import { formatClockDate } from "@/lib/portalClock";
import { Package, Warehouse, Copy, CheckCircle } from "lucide-react";
import { copyText } from "@/lib/copyText";

/**
 * What a customer has sitting in the China depot — the first rung of the
 * journey.
 *
 * Shared by all three portal skins. It began as one skin's section, and the
 * other two kept an older card that showed a bare count in amber behind a
 * warning triangle; goods arriving safely is good news, and a customer told
 * they have six packages wants to know which six.
 */

export interface ChinaDepotItem {
  key: string;
  code: string;
  name?: string | null;
  date: Date | null;
  weightKg: number | null;
  image: { url: string | null; source: string | null } | null;
  shippingType: string | null;
}

const asDate = (value: unknown): Date | null => {
  if (!value) return null;
  const d = new Date(value as string);
  return isNaN(d.getTime()) ? null : d;
};

/**
 * Merges the two places a customer's China-depot goods can be recorded: a
 * loose package scanned onto their code, and a full-package or commission
 * order the office bought for them.
 *
 * Two tables with two status vocabularies is how the portal came to
 * contradict itself, an order reading "in China" on one page and missing from
 * another. Both come through here.
 */
export function useChinaDepotItems(): ChinaDepotItem[] {
  const { data: unbatchedPackages } = trpc.customerPortal.getMyUnbatchedPackages.useQuery();
  const { data: myOrders } = trpc.customerPortal.getMyFullPackageOrders.useQuery({});
  const { resolve } = usePackageImages();

  return useMemo(() => {
    // Keyed by tracking number, because one parcel can be recorded in both
    // tables at once: the office buys it (an order), then the depot scans it
    // in (a package). They are the same box on the same shelf, and listing it
    // twice both misleads the customer and inflates the count.
    //
    // Falls back to the row's own id when there is no tracking number, so two
    // untracked parcels never collapse into one.
    const byTracking = new Map<string, ChinaDepotItem>();

    const merge = (key: string, next: ChinaDepotItem) => {
      const existing = byTracking.get(key);
      if (!existing) {
        byTracking.set(key, next);
        return;
      }
      // Keep whichever side actually knows each field. The depot weighs the
      // parcel; the order carries what was bought.
      byTracking.set(key, {
        ...existing,
        name: existing.name ?? next.name,
        weightKg: existing.weightKg ?? next.weightKg,
        image: existing.image ?? next.image,
        shippingType: existing.shippingType ?? next.shippingType,
        date: existing.date ?? next.date,
      });
    };

    for (const pkg of (unbatchedPackages as any[]) ?? []) {
      const code = pkg.trackingNumber || pkg.packageCode || `#${pkg.id}`;
      const image = resolve(pkg);
      merge(pkg.trackingNumber ? String(pkg.trackingNumber) : `pkg-${pkg.id}`, {
        key: `pkg-${pkg.id}`,
        code,
        name: null,
        date: asDate(pkg.registeredAt),
        weightKg: pkg.weightKg != null ? Number(pkg.weightKg) : null,
        image: image.url ? image : null,
        shippingType: pkg.shippingType ?? null,
      });
    }

    for (const order of (myOrders as any[]) ?? []) {
      if (orderStageOf(order.status) !== "in_china") continue;
      const code = order.trackingNumber || order.orderCode || `#${order.id}`;
      const image = resolve({ photos: null, trackingNumber: order.trackingNumber } as any);
      merge(order.trackingNumber ? String(order.trackingNumber) : `order-${order.id}`, {
        key: `order-${order.id}`,
        code,
        name: order.productName ?? null,
        date: asDate(order.updatedAt || order.createdAt),
        weightKg: order.weightKg != null ? Number(order.weightKg) : null,
        image: image.url ? image : null,
        shippingType: order.shippingType ?? null,
      });
    }

    // Newest first, undated last.
    return Array.from(byTracking.values()).sort(
      (a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0),
    );
  }, [unbatchedPackages, myOrders, resolve]);
}

export function ChinaDepotList({
  items,
  stage,
  shippingType,
  search,
  isDark = false,
  className,
}: {
  items: ChinaDepotItem[];
  stage?: string;
  shippingType?: string;
  search?: string;
  isDark?: boolean;
  className?: string;
}) {
  const { language } = useLanguage();
  const [copied, setCopied] = useState<string | null>(null);

  const visible = useMemo(
    () => filterChinaDepot(items, { stage, shippingType, search }),
    [items, stage, shippingType, search],
  );

  const copy = async (code: string) => {
    try {
      await copyText(code);
      setCopied(code);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      // Blocked on insecure origins; the number is still on screen to read.
    }
  };

  if (visible.length === 0) return null;

  return (
    <div className={cn("mt-6", className)}>
      <div className="mb-3 flex items-center gap-2">
        <Warehouse className={cn("h-5 w-5", isDark ? "text-emerald-400" : "text-emerald-600")} />
        <h3 className={cn("font-bold", isDark ? "text-white" : "text-slate-800 dark:text-slate-200")}>
          {pickLang(language, STATUS_LABEL.preparing)}
        </h3>
        <span className={cn(
          "rounded-full px-2 py-0.5 text-xs font-bold tabular-nums",
          isDark ? "bg-emerald-900/50 text-emerald-300" : "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
        )}>
          {visible.length}
        </span>
      </div>

      <div className={cn(
        "divide-y overflow-hidden rounded-2xl border",
        isDark ? "divide-slate-700 border-slate-700 bg-slate-800/50" : "divide-slate-100 border-slate-200 dark:border-slate-800/60 bg-white",
      )}>
        {visible.map((item) => (
          <div key={item.key} className="flex items-center gap-3 p-3">
            {/* The photo taken when the parcel was checked in. Seeing their own
                goods on our shelf is the reassurance this list exists to give. */}
            {item.image ? (
              <PackageThumb
                resolved={item.image as any}
                language={language}
                size={44}
                isDark={isDark}
                showBadge={false}
                className="shrink-0"
              />
            ) : (
              <div className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                isDark ? "bg-emerald-900/40" : "bg-emerald-50 dark:bg-emerald-950/40",
              )}>
                <Package className={cn("h-4 w-4", isDark ? "text-emerald-400" : "text-emerald-600")} />
              </div>
            )}

            <div className="min-w-0 flex-1">
              {/* Tap to copy: a tracking number exists to be pasted into a
                  courier's site, and typing one off a screen transposes digits. */}
              <button
                type="button"
                onClick={() => copy(item.code)}
                className={cn(
                  "-mx-1 flex max-w-full items-center gap-1.5 rounded-md px-1 py-0.5 transition active:scale-[0.98]",
                  isDark ? "hover:bg-white/5" : "hover:bg-black/5",
                )}
              >
                <span
                  // Needs a colour of its own, or it inherits the page's body
                  // text and disappears in dark mode.
                  className={cn(
                    "truncate font-mono text-sm font-semibold",
                    isDark ? "text-slate-100" : "text-slate-800 dark:text-slate-200",
                  )}
                  dir="ltr"
                >
                  {item.code}
                </span>
                {copied === item.code
                  ? <CheckCircle className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  : <Copy className={cn("h-3.5 w-3.5 shrink-0", isDark ? "text-slate-500" : "text-slate-400")} />}
              </button>

              <div className="flex items-center gap-2 px-1">
                {item.date && (
                  <p className="text-[11px] text-muted-foreground">
                    {formatClockDate(item.date, language)}
                  </p>
                )}
                {item.name && <p className="truncate text-[11px] text-muted-foreground">{item.name}</p>}
              </div>
            </div>

            {Number.isFinite(Number(item.weightKg)) && Number(item.weightKg) > 0 && (
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums" dir="ltr">
                {Number(item.weightKg).toFixed(2)} kg
              </span>
            )}
          </div>
        ))}
      </div>

      <p className="mt-2 px-1 text-[11px] text-muted-foreground">
        {pickLang(language, {
          ku: "بە سەلامەتی گەیشتوونەتە کۆگاکەمان لە چین. کاتێک باچێک پڕ بوو، بەڕێ دەکەون.",
          en: "Safely at our China depot. They ship once a batch is full.",
          ar: "وصلت بأمان إلى مستودعنا في الصين. وستُشحن حين تكتمل الدفعة.",
          zh: "已安全抵达我们的中国仓库，凑够一批后即发运。",
        })}
      </p>
    </div>
  );
}
