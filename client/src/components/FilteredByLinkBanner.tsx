import { Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { pickLang } from "@/lib/lang";
import { useLanguage } from "@/contexts/LanguageContext";
import { FILTERED_BY, SHOW_ALL, type Localised } from "@shared/listLinks";

/**
 * Why this list arrived shorter than usual.
 *
 * A page opened from a dashboard figure shows only the rows behind that
 * figure. Without saying so, a list of six customers where there are normally
 * twelve hundred reads as data loss, and the reader's next move is to report a
 * bug rather than to read the six.
 *
 * So the filter is named, in the reader's own language, with one way out of
 * it. Clearing drops the filter and the query string together, so a refresh
 * does not bring it back.
 */
export function FilteredByLinkBanner({
  filters,
  onClear,
  className,
}: {
  /** One entry per filter that came from the link. Empty renders nothing. */
  filters: Localised[];
  onClear: () => void;
  className?: string;
}) {
  const { language } = useLanguage();
  if (filters.length === 0) return null;

  return (
    <div
      className={cn(
        "mb-4 flex flex-wrap items-center gap-2 rounded-xl px-3 py-2",
        "border border-blue-200 dark:border-blue-900/60 bg-blue-50 dark:bg-blue-950/40",
        className,
      )}
    >
      <Filter className="h-4 w-4 shrink-0 text-blue-700 dark:text-blue-300" />
      <span className="text-sm text-blue-900 dark:text-blue-200">
        {pickLang(language, FILTERED_BY)}:
      </span>
      {filters.map((filter, i) => (
        <span
          key={i}
          className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/60 dark:text-blue-200"
        >
          {pickLang(language, filter)}
        </span>
      ))}
      <button
        type="button"
        onClick={onClear}
        className="ms-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:text-blue-300 dark:hover:bg-blue-900/60"
      >
        <X className="h-3.5 w-3.5" />
        {pickLang(language, SHOW_ALL)}
      </button>
    </div>
  );
}
