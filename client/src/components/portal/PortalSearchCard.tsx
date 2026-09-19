import type { ReactNode } from "react";
import { Boxes, ChevronLeft, ChevronRight, Package, PackagePlus, ShoppingBag, type LucideIcon } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { onImageError } from "@/lib/imageFallback";
import { formatPortalDate } from "@/lib/portalClock";
import { SEARCH_DATE_LABEL, type SearchItem } from "@/lib/portalSearch";
import { PortalChip } from "@/components/portal/PortalStatusChip";

type Words = { ku: string; en: string; ar: string; zh: string };

const KIND_ICON: Record<SearchItem["kind"], LucideIcon> = {
  parcel: Package,
  order: ShoppingBag,
  box: Boxes,
  declared: PackagePlus,
};

/**
 * One parcel, order or box as a compact card: its photo, its number, what it
 * is, where it is, and a date. A tap opens the rest in a sheet from the
 * bottom (components/portal/PortalSearchDetail) — the owner's brief
 * (2026-09-19): the list stays short enough to read, and the weight, the
 * shipment and the journey are one tap away.
 *
 * The search's answers and a shipment's parcels are this same card, so a
 * parcel looks the same wherever the customer meets it.
 */
export function PortalSearchCard({
  item,
  thumb,
  words,
  tone,
  onOpen,
  badge,
}: {
  item: SearchItem;
  /** The photo, when there is one: the parcel's own, else the product's. */
  thumb: string | null;
  words: Words | null;
  tone: string;
  onOpen: () => void;
  /** A small mark after the chip — "your own purchase", say. */
  badge?: ReactNode;
}) {
  const { language } = useLanguage();
  const isRTL = language === "ku" || language === "ar";
  const Icon = KIND_ICON[item.kind];
  const Chevron = isRTL ? ChevronLeft : ChevronRight;
  const L = (w: Words) => pickLang(language, w);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-start shadow-sm transition active:scale-[0.99] dark:border-slate-700 dark:bg-slate-800"
    >
      <span className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-700">
        <Icon className="h-6 w-6 text-slate-400 dark:text-slate-500" />
        {thumb && (
          <img
            src={thumb}
            alt=""
            loading="lazy"
            decoding="async"
            onError={onImageError}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
      </span>
      <span className="min-w-0 flex-1">
        {/* The number reads left to right; the line it sits on keeps the
            page's direction, so it lines up with the words below it. */}
        <span className="block truncate text-[15px] font-semibold text-slate-900 dark:text-slate-50">
          <bdi dir="ltr" className="font-mono tracking-wide">{item.title}</bdi>
        </span>
        {item.subtitle && (
          <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">{item.subtitle}</span>
        )}
        <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <PortalChip tone={tone} className="px-2 py-0.5 text-[11px]">
            {words ? L(words) : "—"}
          </PortalChip>
          {badge}
          {item.date && (
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {L(SEARCH_DATE_LABEL[item.dateKind])}{" "}
              <bdi dir="ltr" className="tabular-nums">
                {formatPortalDate(item.date, language)}
              </bdi>
            </span>
          )}
        </span>
      </span>
      <Chevron className="h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600" />
    </button>
  );
}
