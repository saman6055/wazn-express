import { pickLang, type Lang } from "@/lib/lang";
import { cn } from "@/lib/utils";
import { STATUS_LABEL } from "@/lib/shipmentFilters";
import { formatPortalDate } from "@/lib/portalClock";
import {
  Warehouse,
  Landmark,
  Plane,
  Ship,  PackageCheck,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";

// ---------------------------------------------------------------------------
// BatchJourneyTimeline — the batch's journey as a horizontal stepper:
//   preparing → in_transit → arrived → customs → delivered/closed
// Order follows the app's progress model (arrived 70% < customs 80%).
// Pure presentation over the existing batch fields — no new data needed.
// ---------------------------------------------------------------------------

type L10n = { ku: string; en: string; ar: string; zh: string };

export interface BatchJourneyTimelineProps {
  status: string;
  shippingType?: string | null;
  createdAt?: string | Date | null;
  departureDate?: string | Date | null;
  estimatedArrival?: string | Date | null;
  actualArrival?: string | Date | null;
  /**
   * When the batch first reached each status, keyed by the status name —
   * `preparing`, `in_transit`, `arrived`, `customs`, `at_depot`, `delivered`.
   *
   * A batch only carries three timestamps of its own, so the last three steps
   * could never be dated: a shipment that had reached the customer showed six
   * green steps and one date, the oldest of them. These come from
   * batchStatusHistory, which starts from the day it was switched on — an
   * older batch has none and falls back to the three columns exactly as
   * before.
   */
  statusDates?: Record<string, string | Date | null | undefined>;
  language: string;
  isDark?: boolean;
  className?: string;
}

const STAGE_INDEX: Record<string, number> = {
  preparing: 0,
  in_transit: 1,
  arrived: 2,
  customs: 3,
  at_depot: 4,
  delivered: 5,
  closed: 5,
};

function fmtDate(d: string | Date | null | undefined, language: string): string | null {
  if (!d) return null;
  const date = new Date(d);
  if (isNaN(date.getTime())) return null;
  // "05/03" meant two different days to two different readers.
  return formatPortalDate(date, language);
}

function toTime(d: string | Date | null | undefined): number | null {
  if (!d) return null;
  const t = new Date(d).getTime();
  return isNaN(t) ? null : t;
}

/**
 * A journey cannot run backwards.
 *
 * Two of these dates come from different places: `createdAt` is stamped by
 * the system when the batch row is made, `departureDate` and `actualArrival`
 * are typed in by staff afterwards. When they disagree the timeline said, on
 * every card on the shipments page, "in China warehouse — 28 July" followed
 * by "in transit — 1 February": a shipment that left six months before it was
 * packed.
 *
 * Whose mistake it is does not matter to the customer reading it. A stage
 * whose date precedes the stage before it is not shown — the step still
 * appears, with its label and its tick, and only the impossible date is
 * withheld. A missing date reads as "we have not recorded this yet", which is
 * honest. A date going backwards reads as "this company does not know where
 * your goods are".
 */
function dropBackwardsDates<T extends { date: string | null; at: number | null }>(stages: T[]): T[] {
  let last: number | null = null;
  return stages.map((s) => {
    if (s.at === null) return s;
    if (last !== null && s.at < last) return { ...s, date: null };
    last = s.at;
    return s;
  });
}

export function BatchJourneyTimeline({
  status,
  shippingType,
  createdAt,
  departureDate,
  estimatedArrival,
  actualArrival,
  statusDates,
  language,
  isDark = false,
  className,
}: BatchJourneyTimelineProps) {
  const pick = (v: L10n) => pickLang(language as Lang, v);
  const current = STAGE_INDEX[status] ?? 0;
  const TransitIcon: LucideIcon = shippingType === "sea" ? Ship : Plane;

  /**
   * The recorded move first, the batch's own column second.
   *
   * batchStatusHistory says when the shipment actually reached a stage, and
   * covers all six. The three columns — created, departed, arrived — are what
   * existed before it, and they stay as the fallback so a batch from before
   * the history started looks exactly as it did.
   */
  const dateFor = (
    statusKey: string,
    fallback?: string | Date | null,
  ): { date: string | null; at: number | null } => {
    const value = statusDates?.[statusKey] ?? fallback ?? null;
    return { date: fmtDate(value, language), at: toTime(value) };
  };

  const stages: { icon: LucideIcon; label: L10n; date: string | null; at: number | null }[] =
    dropBackwardsDates([
      {
        icon: Warehouse,
        label: STATUS_LABEL.preparing,
        ...dateFor("preparing", createdAt),
      },
      {
        icon: TransitIcon,
        label: STATUS_LABEL.in_transit,
        // departureDate is typed by staff and createdAt is stamped by the
        // system, which is how the stepper came to read "in China warehouse,
        // 28 July → in transit, 1 February". A recorded move beats both: it is
        // the moment the status actually changed.
        ...dateFor("in_transit", departureDate),
      },
      {
        icon: PackageCheck,
        label: STATUS_LABEL.arrived,
        ...dateFor("arrived", actualArrival),
      },
      {
        icon: Landmark,
        label: STATUS_LABEL.customs,
        // No column ever held these three. Before the history they were blank
        // on every shipment, including ones already in the customer's hands.
        ...dateFor("customs"),
      },
      {
        icon: Warehouse,
        label: STATUS_LABEL.at_depot,
        ...dateFor("at_depot"),
      },
      {
        icon: CheckCircle2,
        label: STATUS_LABEL.delivered,
        // `closed` is the same end of the road as `delivered`; whichever was
        // recorded is when the customer got their goods.
        ...dateFor("delivered", statusDates?.closed),
      },
    ]);

  const eta = fmtDate(estimatedArrival, language);
  const showEta = eta && current < 2;

  return (
    <div className={cn("select-none", className)}>
      <div className="flex items-start">
        {stages.map((stage, i) => {
          const state = i < current ? "done" : i === current ? "active" : "pending";
          const isLast = i === stages.length - 1;
          return (
            <div key={i} className={cn("flex items-start", !isLast && "flex-1")}>
              {/* Node */}
              <div className="flex flex-col items-center w-12 shrink-0">
                <div
                  className={cn(
                    "relative flex h-8 w-8 items-center justify-center rounded-full ring-2 transition-colors",
                    state === "done" &&
                      "bg-emerald-500 text-white ring-emerald-500",
                    state === "active" &&
                      (shippingType === "sea"
                        ? "bg-cyan-500 text-white ring-cyan-500"
                        : "bg-blue-500 text-white ring-blue-500"),
                    state === "pending" &&
                      (isDark
                        ? "bg-slate-800 text-slate-500 ring-slate-700"
                        : "bg-slate-100 dark:bg-slate-950/40 text-slate-400 ring-slate-200"),
                  )}
                >
                  {state === "active" && (
                    <span
                      className={cn(
                        "absolute inset-0 rounded-full animate-ping opacity-30",
                        shippingType === "sea" ? "bg-cyan-500" : "bg-blue-500",
                      )}
                    />
                  )}
                  <stage.icon className="relative h-4 w-4" />
                </div>
                <span
                  className={cn(
                    "mt-1.5 text-center text-[10px] font-semibold leading-tight",
                    state === "done" && "text-emerald-600 dark:text-emerald-400",
                    state === "active" &&
                      (shippingType === "sea"
                        ? "text-cyan-600 dark:text-cyan-400"
                        : "text-blue-600 dark:text-blue-400"),
                    state === "pending" && (isDark ? "text-slate-500" : "text-slate-400"),
                  )}
                >
                  {pick(stage.label)}
                </span>
                {stage.date && state !== "pending" && (
                  <span
                    className={cn(
                      "mt-0.5 text-[9px] font-mono tabular-nums",
                      isDark ? "text-slate-500" : "text-slate-400",
                    )}
                    dir="ltr"
                  >
                    {stage.date}
                  </span>
                )}
              </div>
              {/* Connector */}
              {!isLast && (
                <div className="flex-1 pt-4 px-0.5 min-w-2">
                  <div
                    className={cn(
                      "h-1 rounded-full",
                      isDark ? "bg-slate-700" : "bg-slate-200",
                    )}
                  >
                    <div
                      className={cn(
                        "h-1 rounded-full transition-all duration-700",
                        i < current
                          ? "w-full bg-emerald-500"
                          : i === current
                            ? cn("w-1/2", shippingType === "sea" ? "bg-cyan-500" : "bg-blue-500")
                            : "w-0",
                      )}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showEta && (
        <p
          className={cn(
            "mt-2 text-center text-[11px] font-medium",
            isDark ? "text-slate-400" : "text-slate-500",
          )}
        >
          {pick({
            ku: "گەیشتنی خەمڵێنراو",
            en: "Estimated arrival",
            ar: "الوصول المتوقع",
            zh: "预计到达",
          })}
          : <span className="font-mono tabular-nums" dir="ltr">{eta}</span>
        </p>
      )}
    </div>
  );
}
