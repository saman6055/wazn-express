import { Plane, Ship } from "lucide-react";
import { cn } from "@/lib/utils";
import { pickLang } from "@/lib/lang";
import { JOURNEY_STEPS, batchTypeMark, journeyStep } from "@shared/batchJourney";

/**
 * The small pieces of the batches list (owner, 2026-10-27: "beautiful,
 * delicate, modern - a little motion, icons that mean something, the stage
 * flashing gently"). Motion only where the viewer has not asked for less.
 */

type Words = { ku: string; en: string; ar: string; zh: string };

/** Ship for sea, plane for air, a red plane for an irregular flight. */
export function BatchTypeIcon({ shippingType, language }: { shippingType: string; language: string }) {
  const mark = batchTypeMark(shippingType);
  const label: Words = mark === "sea"
    ? { ku: "بەحری", en: "Sea", ar: "بحري", zh: "海运" }
    : mark === "air_irregular"
      ? { ku: "ئاسمانی نائاسایی", en: "Air irregular", ar: "جوي غير منتظم", zh: "非常规空运" }
      : { ku: "ئاسمانی", en: "Air", ar: "جوي", zh: "空运" };
  const Icon = mark === "sea" ? Ship : Plane;
  return (
    <span
      className={cn(
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-transform duration-300 group-hover:scale-110",
        mark === "sea" && "bg-sky-500/15 text-sky-600 dark:text-sky-300",
        mark === "air" && "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
        mark === "air_irregular" && "bg-rose-500/15 text-rose-600 dark:text-rose-300",
      )}
      title={pickLang(language, label)}
      aria-label={pickLang(language, label)}
      data-testid="batch-type-icon"
      data-mark={mark}
    >
      <Icon className="h-4 w-4" />
    </span>
  );
}

/** Where the batch was made: China or Erbil. */
export function BatchOriginChip({ china, language }: { china: boolean; language: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded px-1.5 py-px text-[10px] font-semibold tracking-wide",
        china ? "bg-rose-500/15 text-rose-700 dark:text-rose-300" : "bg-sky-500/15 text-sky-700 dark:text-sky-300",
      )}
      title={china
        ? pickLang(language, { ku: "باچی چین — ئادمینی چین دروستی کردووە", en: "Made in China", ar: "صُنعت في الصين", zh: "中国创建的批次" })
        : pickLang(language, { ku: "باچی هەولێر", en: "Made in Erbil", ar: "صُنعت في أربيل", zh: "埃尔比勒创建的批次" })}
      data-testid="batch-origin-chip"
    >
      {china ? "CN" : "IQ"}
    </span>
  );
}

const STEP_COLOR = ["bg-sky-500", "bg-amber-500", "bg-rose-500", "bg-emerald-500"] as const;
const STEP_RING = ["bg-sky-400", "bg-amber-400", "bg-rose-400", "bg-emerald-400"] as const;

/**
 * China → road → Erbil → delivered, the step it is on breathing softly. The
 * line fills up to it in that step's colour; a delivered batch is all green
 * and still.
 */
export function BatchJourney({ status, language, caption }: { status: string; language: string; caption?: React.ReactNode }) {
  const step = journeyStep(status);
  const done = step === 3;
  const fill = done ? "bg-emerald-500" : STEP_COLOR[step];
  return (
    <div className="min-w-[150px]" data-testid="batch-journey" data-step={step}>
      <div className="flex items-center" dir="rtl" aria-label={pickLang(language, JOURNEY_STEPS[step])}>
        {JOURNEY_STEPS.map((w, i) => (
          <div key={i} className="flex flex-1 items-center last:flex-none">
            <span className="relative flex h-2.5 w-2.5 shrink-0" title={pickLang(language, w)}>
              {i === step && !done && (
                <span className={cn("absolute inline-flex h-full w-full rounded-full opacity-60 motion-safe:animate-ping", STEP_RING[step])} />
              )}
              <span className={cn("relative inline-flex h-2.5 w-2.5 rounded-full transition-colors duration-500", i <= step ? fill : "bg-muted-foreground/25")} />
            </span>
            {i < 3 && <span className={cn("h-0.5 flex-1 rounded transition-colors duration-500", i < step ? fill : "bg-muted-foreground/15")} />}
          </div>
        ))}
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">{caption ?? pickLang(language, JOURNEY_STEPS[step])}</p>
    </div>
  );
}

/**
 * What a batch is still missing (price, cost, AWB…), as quiet grey dots with
 * the words on hover - four red badges on a new batch read as four faults
 * when they are only "not yet". A missing cost stays red (owner, 2026-10-04):
 * the batch's profit waits for it. The words are kept for screen readers.
 */
export function MissingDots({ items }: { items: Array<{ label: string; testId?: string; red?: boolean }> }) {
  if (items.length === 0) return null;
  const words = items.map((i) => i.label).join(" · ");
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-1.5 py-1" title={words} data-testid="batch-missing-dots">
      {items.map((i) => (
        <span key={i.label} className={i.red ? "h-1.5 w-1.5 rounded-full bg-rose-500 motion-safe:animate-pulse" : "h-1.5 w-1.5 rounded-full bg-muted-foreground/50"} data-testid={i.testId} />
      ))}
      <span className="sr-only">{words}</span>
    </span>
  );
}
