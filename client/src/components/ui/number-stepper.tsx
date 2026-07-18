import { ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Step a numeric-string field up/down with a mouse click, clamped at `min` and
 * rounded to `decimals` so float noise (0.1 + 0.2…) never lands in the input.
 * Returns the new value as a string, ready to feed back into form state.
 */
export const stepValue = (raw: string, delta: number, decimals = 2, min = 0) => {
  const next = Math.max(min, (parseFloat(raw) || 0) + delta);
  return String(Number(next.toFixed(decimals)));
};

/**
 * Mouse-friendly ▲/▼ stepper rendered inside a numeric input's relative
 * wrapper. The wrapper must be `dir="ltr"` (numbers are LTR) so `side` maps to
 * a deterministic edge — place it on whichever side the ¥/$/kg suffix doesn't
 * use, and give the input matching `ps-9`/`pe-9` padding so text never sits
 * under the buttons. `tabIndex={-1}` keeps them out of the keyboard tab order.
 */
export const StepBtns = ({ onStep, side }: { onStep: (dir: 1 | -1) => void; side: "start" | "end" }) => (
  <div className={cn("absolute top-1/2 -translate-y-1/2 flex flex-col gap-[2px]", side === "end" ? "end-1" : "start-1")}>
    <button
      type="button"
      tabIndex={-1}
      aria-label="+"
      onClick={() => onStep(1)}
      className="flex h-[17px] w-6 items-center justify-center rounded border bg-muted/60 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground"
    >
      <ChevronUp className="h-3 w-3" />
    </button>
    <button
      type="button"
      tabIndex={-1}
      aria-label="−"
      onClick={() => onStep(-1)}
      className="flex h-[17px] w-6 items-center justify-center rounded border bg-muted/60 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground"
    >
      <ChevronDown className="h-3 w-3" />
    </button>
  </div>
);
