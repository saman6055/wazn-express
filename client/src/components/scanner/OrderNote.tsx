import { StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";

/**
 * The note somebody wrote on an order, shown wherever that order is met.
 *
 * A note is written at the moment somebody knows something the system does
 * not — this one is fragile, this one belongs with another, this customer
 * asked for it a particular way. It is written once and needed later, by
 * whoever has the parcel in their hands.
 *
 * It was reaching the scanning screens already and none of them drew it. So
 * the person who wrote it was the only person who ever saw it, which makes
 * writing one pointless.
 *
 * Yellow on purpose, and never dismissible: this is somebody's instruction,
 * not a status. It renders nothing when there is no note, which is most
 * parcels.
 */
export function OrderNote({
  note,
  className,
  compact = false,
}: {
  note?: string | null;
  className?: string;
  compact?: boolean;
}) {
  const { language } = useTranslation();
  const text = (note ?? "").trim();
  if (!text) return null;

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40",
        compact ? "px-2.5 py-1.5" : "px-3 py-2",
        className,
      )}
      data-testid="order-note"
    >
      <StickyNote
        className={cn(
          "shrink-0 text-amber-600 dark:text-amber-400",
          compact ? "h-3.5 w-3.5 mt-0.5" : "h-4 w-4 mt-0.5",
        )}
      />
      <div className="min-w-0">
        {!compact && (
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
            {pickLang(language, {
              ku: "تێبینی", en: "Note", ar: "ملاحظة", zh: "备注",
            })}
          </p>
        )}
        {/* Wrapped, not truncated: a note cut in half is worse than none —
            the half that matters is as likely to be the second one. */}
        <p
          className={cn(
            "whitespace-pre-wrap break-words leading-relaxed text-amber-900 dark:text-amber-100",
            compact ? "text-xs" : "text-sm",
          )}
        >
          {text}
        </p>
      </div>
    </div>
  );
}
