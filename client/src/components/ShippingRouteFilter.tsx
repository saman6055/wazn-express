import { useState, useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";
import { LayoutGrid, Plane, Ship } from "lucide-react";

export type ShippingRoute = "air_regular" | "air_irregular" | "sea";
/** null means every route — the state a page always opens in. */
export type RouteFilter = ShippingRoute | null;

type L = { ku: string; en: string; ar: string; zh: string };

const ROUTES: { key: ShippingRoute; label: L; icon: typeof Plane; tone: string; active: string }[] = [
  {
    key: "air_regular",
    label: { ku: "ئاسایی", en: "Regular", ar: "عادي", zh: "普通空运" },
    icon: Plane,
    tone: "text-blue-800 hover:bg-blue-100 dark:text-blue-200 dark:hover:bg-blue-900/40",
    active: "bg-gradient-to-br from-blue-700 to-blue-500 text-white shadow-md shadow-blue-700/25",
  },
  {
    key: "air_irregular",
    // Same aircraft, awkward cargo — a tilted plane rather than a second icon
    // nobody would connect to flying.
    label: { ku: "نائاسایی", en: "Irregular", ar: "غير عادي", zh: "特殊空运" },
    icon: Plane,
    tone: "text-indigo-800 hover:bg-indigo-100 dark:text-indigo-200 dark:hover:bg-indigo-900/40",
    active: "bg-gradient-to-br from-indigo-700 to-violet-600 text-white shadow-md shadow-indigo-700/25",
  },
  {
    key: "sea",
    label: { ku: "دەریایی", en: "Sea", ar: "بحري", zh: "海运" },
    icon: Ship,
    tone: "text-teal-800 hover:bg-teal-100 dark:text-teal-200 dark:hover:bg-teal-900/40",
    active: "bg-gradient-to-br from-teal-700 to-teal-500 text-white shadow-md shadow-teal-700/25",
  },
];

/**
 * Filter a list down to one shipping route.
 *
 * The same control on every page that lists parcels or orders, because the
 * question is the same on all of them: an air shipment and a sea shipment move
 * on different timetables and get worked on separate days, and reading one
 * list to find the other's rows wastes the time it takes to skip them.
 *
 * Deliberately not remembered. It resets to "all" whenever the page is
 * reopened, so nobody inherits yesterday's filter and concludes the parcels
 * have gone missing — the failure mode of a sticky filter is silent, and this
 * one hides rows.
 *
 * Each page keeps its own: the work on complete packages and on markup
 * purchases is different, and carrying a choice across would surprise more
 * often than it would help.
 */
export function ShippingRouteFilter({
  value,
  onChange,
  counts,
  className,
  compact,
}: {
  value: RouteFilter;
  onChange: (next: RouteFilter) => void;
  /** How many rows each route has, before filtering. */
  counts?: Partial<Record<ShippingRoute, number>> & { all?: number };
  className?: string;
  /** Icons only — for a toolbar that has run out of room. */
  compact?: boolean;
}) {
  const { language } = useLanguage();
  const label = (v: L) => pickLang(language, v);

  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-xl border bg-card p-0.5",
        className,
      )}
      role="group"
      aria-label={label({ ku: "ڕێگای ناردن", en: "Shipping route", ar: "مسار الشحن", zh: "运输方式" })}
    >
      <button
        type="button"
        onClick={() => onChange(null)}
        aria-pressed={value === null}
        title={label({ ku: "هەموو ڕێگاکان", en: "All routes", ar: "كل المسارات", zh: "全部方式" })}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium transition-all",
          value === null
            ? "bg-gradient-to-br from-blue-700 to-indigo-700 text-white shadow-md shadow-blue-700/25"
            : "text-foreground/70 hover:bg-muted hover:text-foreground",
        )}
      >
        <LayoutGrid className="h-4 w-4 shrink-0" />
        {!compact && label({ ku: "هەموو", en: "All", ar: "الكل", zh: "全部" })}
        {!compact && counts?.all !== undefined && (
          <Count active={value === null}>{counts.all}</Count>
        )}
      </button>

      {ROUTES.map((r) => {
        const on = value === r.key;
        const Icon = r.icon;
        return (
          <button
            key={r.key}
            type="button"
            // Clicking the active route clears it, so there is a way back to
            // "all" without hunting for the button that means it.
            onClick={() => onChange(on ? null : r.key)}
            aria-pressed={on}
            title={label(r.label)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium transition-all",
              on ? r.active : r.tone,
            )}
          >
            <Icon className={cn("h-4 w-4 shrink-0", r.key === "air_irregular" && "-rotate-45")} />
            {!compact && label(r.label)}
            {!compact && counts?.[r.key] !== undefined && <Count active={on}>{counts[r.key]}</Count>}
          </button>
        );
      })}
    </div>
  );
}

function Count({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "rounded-md px-1.5 text-[11.5px] tabular-nums",
        active ? "bg-white/25" : "bg-black/10 dark:bg-white/15",
      )}
    >
      {children}
    </span>
  );
}

/**
 * The filter, its state and the filtered rows in one call.
 *
 * Every page needs the same three things, and doing the counting by hand at
 * four call sites is how four pages end up counting slightly differently.
 */
export function useShippingRouteFilter<T>(
  rows: T[],
  getRoute: (row: T) => string | null | undefined,
) {
  const [route, setRoute] = useState<RouteFilter>(null);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length };
    for (const row of rows) {
      const r = getRoute(row);
      if (r) c[r] = (c[r] ?? 0) + 1;
    }
    return c as Partial<Record<ShippingRoute, number>> & { all: number };
  }, [rows, getRoute]);

  const filtered = useMemo(
    () => (route ? rows.filter((row) => getRoute(row) === route) : rows),
    [rows, route, getRoute],
  );

  return { route, setRoute, counts, filtered };
}
