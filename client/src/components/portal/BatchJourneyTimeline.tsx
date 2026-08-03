import { pickLang, type Lang } from "@/lib/lang";
import { cn } from "@/lib/utils";
import { STATUS_LABEL } from "@/lib/shipmentFilters";
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

function fmtDate(d?: string | Date | null): string | null {
  if (!d) return null;
  const date = new Date(d);
  if (isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit" });
}

export function BatchJourneyTimeline({
  status,
  shippingType,
  createdAt,
  departureDate,
  estimatedArrival,
  actualArrival,
  language,
  isDark = false,
  className,
}: BatchJourneyTimelineProps) {
  const pick = (v: L10n) => pickLang(language as Lang, v);
  const current = STAGE_INDEX[status] ?? 0;
  const TransitIcon: LucideIcon = shippingType === "sea" ? Ship : Plane;

  const stages: { icon: LucideIcon; label: L10n; date: string | null }[] = [
    {
      icon: Warehouse,
      label: STATUS_LABEL.preparing,
      date: fmtDate(createdAt),
    },
    {
      icon: TransitIcon,
      label: STATUS_LABEL.in_transit,
      date: fmtDate(departureDate),
    },
    {
      icon: PackageCheck,
      label: STATUS_LABEL.arrived,
      date: fmtDate(actualArrival),
    },
    {
      icon: Landmark,
      label: STATUS_LABEL.customs,
      date: null,
    },
    {
      icon: Warehouse,
      label: STATUS_LABEL.at_depot,
      date: null,
    },
    {
      icon: CheckCircle2,
      label: STATUS_LABEL.delivered,
      date: null,
    },
  ];

  const eta = fmtDate(estimatedArrival);
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
