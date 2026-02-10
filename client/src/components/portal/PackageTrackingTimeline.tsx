import { CheckCircle, Circle, Truck, Package, MapPin, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_ORDER = [
  "registered",
  "in_batch",
  "in_transit",
  "customs_processing",
  "ready_for_delivery",
  "out_for_delivery",
  "delivered",
] as const;

const STATUS_CONFIG: Record<string, { labelEn: string; labelKu: string; icon: typeof Package; color: string }> = {
  registered: { labelEn: "Registered", labelKu: "تۆمارکراو", icon: Package, color: "bg-slate-500" },
  in_batch: { labelEn: "In Batch", labelKu: "لە باچەدا", icon: Package, color: "bg-blue-500" },
  in_transit: { labelEn: "In Transit", labelKu: "لە ڕێگادا", icon: Truck, color: "bg-amber-500" },
  customs_processing: { labelEn: "Customs", labelKu: "گومرگ", icon: MapPin, color: "bg-orange-500" },
  ready_for_delivery: { labelEn: "Ready", labelKu: "ئامادە", icon: Truck, color: "bg-cyan-500" },
  out_for_delivery: { labelEn: "Out for Delivery", labelKu: "دەرچوو بۆ گەیاندن", icon: Truck, color: "bg-indigo-500" },
  delivered: { labelEn: "Delivered", labelKu: "گەیەندراو", icon: CheckCircle, color: "bg-emerald-500" },
};

interface PackageTrackingTimelineProps {
  currentStatus: string;
  estimatedDelivery?: string | null;
  language?: string;
  className?: string;
}

export function PackageTrackingTimeline({
  currentStatus,
  estimatedDelivery,
  language = "en",
  className,
}: PackageTrackingTimelineProps) {
  const currentIndex = STATUS_ORDER.indexOf(currentStatus as (typeof STATUS_ORDER)[number]);
  const safeIndex = currentIndex >= 0 ? currentIndex : 0;

  return (
    <div className={cn("space-y-0", className)}>
      {STATUS_ORDER.map((status, index) => {
        const config = STATUS_CONFIG[status] ?? {
          labelEn: status.replace(/_/g, " "),
          labelKu: status,
          icon: Circle,
          color: "bg-gray-400",
        };
        const isDone = index < safeIndex || currentStatus === "delivered";
        const isCurrent = index === safeIndex;
        const Icon = config.icon;
        const label = language === "ku" ? config.labelKu : config.labelEn;

        return (
          <div key={status} className="flex gap-3">
            <div className="flex flex-col items-center shrink-0">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center transition-colors",
                  isDone && "bg-emerald-500 text-white",
                  isCurrent && !isDone && `${config.color} text-white ring-2 ring-offset-2 ring-offset-background`,
                  !isDone && !isCurrent && "bg-muted text-muted-foreground"
                )}
              >
                {isDone ? <CheckCircle className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
              </div>
              {index < STATUS_ORDER.length - 1 && (
                <div
                  className={cn(
                    "w-0.5 min-h-[20px] flex-1",
                    isDone ? "bg-emerald-500" : "bg-muted"
                  )}
                />
              )}
            </div>
            <div className={cn("pb-1", index === STATUS_ORDER.length - 1 && "pb-0")}>
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
              {isCurrent && status === "in_transit" && estimatedDelivery && (
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {language === "ku" ? "چاوەڕوانی گەیشتن: " : "Est. delivery: "}
                  {new Date(estimatedDelivery).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
