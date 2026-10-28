import { Plane, Ship } from "lucide-react";
import { cn } from "@/lib/utils";
import { pickLang } from "@/lib/lang";
import { batchTypeMark } from "@shared/batchJourney";
import { BATCH_STAGE_LABEL, stagesForBatch, type BatchStage } from "@shared/batchStage";

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

/** One colour per stage: China blue, the road amber, customs violet, Erbil rose, ready green. */
const STAGE_DOT: Record<BatchStage, string> = {
  china_depot: "bg-sky-500",
  packed: "bg-sky-600",
  on_road: "bg-amber-500",
  customs: "bg-violet-500",
  erbil_depot: "bg-rose-500",
  ready: "bg-emerald-500",
  closed: "bg-emerald-500",
};
const STAGE_RING: Record<BatchStage, string> = {
  china_depot: "bg-sky-400",
  packed: "bg-sky-400",
  on_road: "bg-amber-400",
  customs: "bg-violet-400",
  erbil_depot: "bg-rose-400",
  ready: "bg-emerald-400",
  closed: "bg-emerald-400",
};
const STAGE_CHIP: Record<BatchStage, string> = {
  china_depot: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  packed: "bg-sky-500/15 text-sky-800 dark:text-sky-200",
  on_road: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  customs: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  erbil_depot: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  ready: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  closed: "bg-muted text-muted-foreground",
};

/**
 * The batch's own stages (shared/batchStage, owner 2026-10-28), the one it
 * is on breathing softly. An Erbil batch starts in Erbil; customs shows only
 * when the batch was held there. A closed batch is all green and still.
 */
export function BatchJourney({ stage, china, language, caption }: { stage: BatchStage; china: boolean; language: string; caption?: React.ReactNode }) {
  const steps = stagesForBatch(china, stage).filter((s) => s !== "closed");
  const done = stage === "closed";
  const at = done ? steps.length - 1 : Math.max(0, steps.indexOf(stage));
  const fill = done ? "bg-emerald-500" : STAGE_DOT[stage];
  return (
    <div className="min-w-[150px]" data-testid="batch-journey" data-stage={stage}>
      <div className="flex items-center" dir="rtl" aria-label={pickLang(language, BATCH_STAGE_LABEL[stage])}>
        {steps.map((s, i) => (
          <div key={s} className="flex flex-1 items-center last:flex-none">
            <span className="relative flex h-2.5 w-2.5 shrink-0" title={pickLang(language, BATCH_STAGE_LABEL[s])}>
              {i === at && !done && (
                <span className={cn("absolute inline-flex h-full w-full rounded-full opacity-60 motion-safe:animate-ping", STAGE_RING[stage])} />
              )}
              <span className={cn("relative inline-flex h-2.5 w-2.5 rounded-full transition-colors duration-500", i <= at ? fill : "bg-muted-foreground/25")} />
            </span>
            {i < steps.length - 1 && <span className={cn("h-0.5 flex-1 rounded transition-colors duration-500", i < at ? fill : "bg-muted-foreground/15")} />}
          </div>
        ))}
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">{caption ?? pickLang(language, BATCH_STAGE_LABEL[stage])}</p>
    </div>
  );
}

/** The stage in words, where the status badge used to be. */
export function BatchStageChip({ stage, language }: { stage: BatchStage; language: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", STAGE_CHIP[stage])} data-testid="batch-stage-chip" data-stage={stage}>
      {pickLang(language, BATCH_STAGE_LABEL[stage])}
    </span>
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
