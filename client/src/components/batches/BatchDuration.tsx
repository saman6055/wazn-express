import { Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import { pickLang } from "@/lib/lang";
import { useTranslation } from "@/contexts/LanguageContext";
import { batchDuration, durationWords, fillingWords, type BatchJourneyFacts } from "@shared/batchDuration";

type Dated = BatchJourneyFacts & {
  departedAt?: Date | string | null;
  arrivedAt?: Date | string | null;
};

const day = (d: Date): string => d.toLocaleDateString("en-GB");

/**
 * How long the shipment took, said in days (owner, 2026-10-05: «دورەیشنێکیش
 * هەبێ، ماوەکەی بژمێرێت: بە چەند گەیشتووە»).
 *
 * Green once it has arrived — the figure is final. Blue while it is still on
 * the way, because that one is still counting. Nothing at all for a batch
 * that has not left: its age is already on the row, and a duration of a
 * journey that has not begun is not a number.
 *
 * `detailed` adds the two dates and the days it took to fill, for the edit
 * dialog where there is room; the list shows the chip alone and keeps the
 * rest in its title.
 */
export function BatchDurationChip({
  batch,
  detailed = false,
  className,
}: {
  batch: Dated;
  detailed?: boolean;
  className?: string;
}) {
  const { language } = useTranslation();
  const duration = batchDuration(batch);
  if (!duration) return null;

  const arrived = duration.state === "arrived";
  const filling = fillingWords(duration);
  const left = pickLang(language, { ku: "بەڕێکردن", en: "Left", ar: "المغادرة", zh: "发出" });
  const came = pickLang(language, { ku: "گەیشتن", en: "Arrived", ar: "الوصول", zh: "到达" });
  const title = [
    `${left}: ${day(duration.departedAt)}`,
    duration.arrivedAt ? `${came}: ${day(duration.arrivedAt)}` : null,
    filling ? pickLang(language, filling) : null,
  ].filter(Boolean).join(" · ");

  const chip = (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold",
        arrived
          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
          : "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
        !detailed && className,
      )}
      title={title}
      data-testid="batch-duration"
    >
      {/* The clock only where there is room for it: in the list the chip
          must fit under a date without widening the column. */}
      {detailed && <Timer className="h-3 w-3 shrink-0" />}
      {pickLang(language, durationWords(duration))}
    </span>
  );
  if (!detailed) return chip;

  return (
    <div
      // Its own direction: the batch dialog's tabs are a left-to-right
      // island, and inherited from there the line started at the wrong edge.
      dir={language === "en" || language === "zh" ? "ltr" : "rtl"}
      className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground", className)}
      data-testid="batch-duration-detail"
    >
      {chip}
      <span>
        {left}: <bdi dir="ltr" className="font-mono tabular-nums text-foreground">{day(duration.departedAt)}</bdi>
      </span>
      {duration.arrivedAt && (
        <span>
          {came}: <bdi dir="ltr" className="font-mono tabular-nums text-foreground">{day(duration.arrivedAt)}</bdi>
        </span>
      )}
      {filling && <span>{pickLang(language, filling)}</span>}
    </div>
  );
}
