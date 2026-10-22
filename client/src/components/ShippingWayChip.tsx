import { Plane, Ship } from "lucide-react";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";

type Words = { ku: string; en: string; ar: string; zh: string };
export type ShippingWay = "air_regular" | "air_irregular" | "sea";

/**
 * How a parcel or an order comes: air regular, air irregular or sea (owner,
 * 2026-10-22: "so it is known how each one comes"). One chip, read by the
 * commission table, the full-package table and All Packages.
 */
export const SHIPPING_WAY: Record<ShippingWay, { words: Words; icon: typeof Plane; tone: string }> = {
  air_regular: {
    words: { ku: "ئاسمانی ئاسایی", en: "Air regular", ar: "جوي عادي", zh: "普通空运" },
    icon: Plane,
    tone: "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-800/60 dark:bg-sky-950/40 dark:text-sky-200",
  },
  air_irregular: {
    words: { ku: "ئاسمانی نائاسایی", en: "Air irregular", ar: "جوي غير عادي", zh: "特殊空运" },
    icon: Plane,
    tone: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200",
  },
  sea: {
    words: { ku: "دەریایی", en: "Sea", ar: "بحري", zh: "海运" },
    icon: Ship,
    tone: "border-teal-300 bg-teal-50 text-teal-800 dark:border-teal-800/60 dark:bg-teal-950/40 dark:text-teal-200",
  },
};

/**
 * The way it travels: the batch it is on decides, since that is the plane or
 * ship it actually goes on; before it has a batch, its own choice.
 */
export function shippingWayOf(batchType?: string | null, ownType?: string | null): ShippingWay | null {
  for (const t of [batchType, ownType]) {
    if (t === "air_regular" || t === "air_irregular" || t === "sea") return t;
  }
  return null;
}

export function ShippingWayChip({
  batchType,
  ownType,
  language,
  className,
}: {
  batchType?: string | null;
  ownType?: string | null;
  language: string;
  className?: string;
}) {
  const way = shippingWayOf(batchType, ownType);
  if (!way) return null;
  const { words, icon: Icon, tone } = SHIPPING_WAY[way];
  return (
    <span
      className={cn("inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[11px] font-medium", tone, className)}
      data-testid="shipping-way"
      data-way={way}
    >
      <Icon className="h-3 w-3" />
      {pickLang(language, words)}
    </span>
  );
}
