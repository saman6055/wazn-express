import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type TrackingStepState = "done" | "active" | "pending";

export interface TrackingStep {
  key: string;
  label: string;
  state: TrackingStepState;
}

interface TrackingTimelineProps {
  steps: TrackingStep[];
  className?: string;
}

/**
 * Presentational stepper for an order's China→Iraq journey.
 * Purely visual — every step's state is computed by the caller from
 * fields already loaded on the order. RTL-aware: it lays the steps out
 * in a logical flex row, so in RTL the first step naturally sits on the
 * start (right) edge. Connector lines are coloured up to the active step.
 */
export default function TrackingTimeline({ steps, className }: TrackingTimelineProps) {
  if (!steps.length) return null;

  return (
    <div className={cn("flex items-start", className)}>
      {steps.map((step, idx) => {
        const isLast = idx === steps.length - 1;
        // The connector that trails this step is "filled" once this step is
        // reached (done) — i.e. the line leading INTO the next dot.
        const connectorDone = step.state === "done";
        return (
          <div key={step.key} className="flex flex-1 flex-col items-center">
            <div className="flex w-full items-center">
              {/* leading spacer keeps the first dot centred over its label */}
              <div className="h-0.5 flex-1" aria-hidden />
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                  step.state === "done" &&
                    "border-emerald-500 bg-emerald-500 text-white",
                  step.state === "active" &&
                    "border-emerald-500 bg-card text-emerald-600 ring-4 ring-emerald-500/20 dark:text-emerald-400",
                  step.state === "pending" &&
                    "border-border bg-muted text-muted-foreground",
                )}
              >
                {step.state === "done" ? (
                  <Check className="h-4 w-4" strokeWidth={3} />
                ) : (
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full",
                      step.state === "active"
                        ? "bg-emerald-500"
                        : "bg-muted-foreground/40",
                    )}
                  />
                )}
              </div>
              {/* trailing connector to the next step */}
              {!isLast ? (
                <div
                  className={cn(
                    "h-0.5 flex-1 transition-colors",
                    connectorDone ? "bg-emerald-500" : "bg-border",
                  )}
                  aria-hidden
                />
              ) : (
                <div className="h-0.5 flex-1" aria-hidden />
              )}
            </div>
            <span
              className={cn(
                "mt-2 px-1 text-center text-xs leading-tight",
                step.state === "pending"
                  ? "text-muted-foreground"
                  : "font-medium text-foreground",
              )}
            >
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
