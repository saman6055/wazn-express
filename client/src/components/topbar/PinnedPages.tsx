import { Link, useLocation } from "wouter";
import { Box, Layers, Package, ShoppingCart, Zap, type LucideIcon } from "lucide-react";
import { useTranslation } from "@/contexts/LanguageContext";
import { usePermissions } from "@/hooks/usePermissions";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";

type Words = { ku: string; en: string; ar: string; zh: string };

/**
 * The owner's five daily pages, pinned to the top bar the way apps sit on the
 * Windows 11 taskbar — each with its name.
 *
 * Owner, 2026-09-17: the four orange icons that were here were no use to
 * anyone, "because nothing is written on them". He named the pages used most:
 * batches, buying at cost, boxes, all parcels, quick register. They are laid
 * out in the order a parcel travels — registered, listed, batched, boxed —
 * with buying at cost last, its own road.
 *
 * The page you are on carries the taskbar's line under it. Only the pages this
 * person may open are shown.
 */
export const PINNED_PAGES: { path: string; icon: LucideIcon; label: Words }[] = [
  { path: "/packages/quick-register", icon: Zap, label: { ku: "تۆماری خێرا", en: "Quick register", ar: "تسجيل سريع", zh: "快速登记" } },
  { path: "/packages/all", icon: Package, label: { ku: "هەموو پاکەتەکان", en: "All parcels", ar: "كل الطرود", zh: "全部包裹" } },
  { path: "/batches", icon: Layers, label: { ku: "باچەکان", en: "Batches", ar: "الدفعات", zh: "批次" } },
  { path: "/customer-delivery-scanner", icon: Box, label: { ku: "بۆکس", en: "Boxes", ar: "الصناديق", zh: "箱子" } },
  { path: "/commission", icon: ShoppingCart, label: { ku: "کڕین بە تێچوو", en: "Buy at cost", ar: "الشراء بالتكلفة", zh: "按成本代购" } },
];

/** The page itself, or anything under it: /commission/new is still buying at cost. */
export function isPinActive(location: string, path: string): boolean {
  return location === path || location.startsWith(`${path}/`);
}

export function PinnedPages({ className }: { className?: string }) {
  const [location] = useLocation();
  const { language } = useTranslation();
  const { canViewPath } = usePermissions();

  const pins = PINNED_PAGES.filter((p) => canViewPath(p.path));
  if (pins.length === 0) return null;

  return (
    <nav
      aria-label={pickLang(language, { ku: "بەشە سەرەکییەکان", en: "Main pages", ar: "الصفحات الرئيسية", zh: "主要页面" })}
      // On a narrow window the names step aside and the icons stay: the
      // owner wants these pages a tap away on a small screen too
      // (2026-09-21). Below a phone's width the menu carries them.
      className={cn("hidden items-center gap-0.5 sm:flex", className)}
    >
      {pins.map((pin) => {
        const active = isPinActive(location, pin.path);
        return (
          <Link
            key={pin.path}
            href={pin.path}
            aria-current={active ? "page" : undefined}
            title={pickLang(language, pin.label)}
            aria-label={pickLang(language, pin.label)}
            className={cn(
              // Narrower than a laptop the pills tighten — smaller name, less
              // padding — rather than dropping their names: an icon with
              // nothing written on it is no use to anyone (owner, 2026-09-17).
              "group relative flex h-9 items-center gap-1 rounded-lg px-1.5 text-[11px] font-semibold transition-colors lg:gap-1.5 lg:px-2 lg:text-[13px] xl:px-2.5",
              active
                ? "bg-background text-foreground shadow-sm ring-1 ring-border dark:bg-white/10"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <pin.icon className={cn("h-3.5 w-3.5 shrink-0 transition-colors lg:h-4 lg:w-4", active ? "text-primary" : "group-hover:text-primary")} />
            <span className="whitespace-nowrap">{pickLang(language, pin.label)}</span>
            {/* The taskbar's line: long under the page you are on, a hint of it on hover. */}
            <span
              aria-hidden
              className={cn(
                "absolute bottom-0.5 left-1/2 h-[3px] -translate-x-1/2 rounded-full bg-primary transition-all duration-200",
                active ? "w-5 opacity-100" : "w-0 opacity-0 group-hover:w-2.5 group-hover:opacity-60",
              )}
            />
          </Link>
        );
      })}
    </nav>
  );
}
