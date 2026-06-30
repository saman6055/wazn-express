import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/contexts/LanguageContext";

export interface FilterChip {
  id: string;
  label: string;
  onRemove: () => void;
}

export interface FilterChipsProps {
  chips: FilterChip[];
  onClearAll?: () => void;
  className?: string;
}

/**
 * Presentational row of active-filter pills. Each pill shows a label and a
 * removable X button. Renders nothing when there are no chips.
 */
export function FilterChips({ chips, onClearAll, className }: FilterChipsProps) {
  const { t } = useTranslation();

  if (!chips.length) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {chips.map((chip) => (
        <span
          key={chip.id}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 ps-2.5 pe-1 py-0.5 text-xs font-medium text-foreground"
        >
          <span className="truncate max-w-[12rem]">{chip.label}</span>
          <button
            type="button"
            onClick={chip.onRemove}
            aria-label={t("filterChips.remove") || "لابردن"}
            className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}

      {onClearAll && chips.length > 1 && (
        <button
          type="button"
          onClick={onClearAll}
          className="text-xs font-medium text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          {t("filterChips.clearAll") || "سڕینەوەی هەموو"}
        </button>
      )}
    </div>
  );
}
