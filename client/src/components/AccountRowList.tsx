import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown, Search, type LucideIcon } from "lucide-react";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";

/**
 * A list of things a customer is billed for, each opening underneath itself.
 *
 * This replaced a grid of thirty buttons reading AIR-2026-041, AIR-2026-042
 * and so on. The grid filled the screen, and worse, a bare code tells the
 * reader nothing: to find the shipment they meant, they had to open every one
 * in turn. A dropdown would have solved the space and none of the rest — the
 * codes would simply be hidden behind a click instead of spread across a page.
 *
 * So each row carries what makes it recognisable — when it arrived, how many
 * parcels of theirs are in it, what it came to — and opens in place. The
 * newest is open on arrival, because that is the one being asked about almost
 * every time.
 *
 * Written once and used for batches and for delivery boxes, in the portal and
 * in the office. Four screens showing the same shape, drawn by the same file.
 */

export interface AccountRow {
  key: number;
  code: string;
  icon?: LucideIcon;
  /** Date, count, weight — whatever makes this row recognisable at a glance. */
  meta: string;
  amount?: number | null;
}

interface Props {
  rows: AccountRow[];
  openKey: number | null;
  onToggle: (key: number | null) => void;
  renderExpanded: (row: AccountRow) => ReactNode;
  language: string;
  /** How many to show before "show the rest". The office usually wants a search instead. */
  initialVisible?: number;
  searchable?: boolean;
  emptyText?: string;
}

export function AccountRowList({
  rows,
  openKey,
  onToggle,
  renderExpanded,
  language,
  initialVisible = 3,
  searchable = false,
  emptyText,
}: Props) {
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.code.toLowerCase().includes(q) || r.meta.toLowerCase().includes(q));
  }, [rows, query]);

  // Searching means the reader has a specific one in mind, so the ceiling is
  // lifted — hiding matches behind "show more" would be answering a question
  // with half an answer.
  const visible = showAll || query.trim() ? filtered : filtered.slice(0, initialVisible);
  const hidden = filtered.length - visible.length;

  if (rows.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        {emptyText ?? pickLang(language, { ku: "هیچ نییە", en: "Nothing here", ar: "لا يوجد شيء", zh: "暂无内容" })}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {searchable && (
        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={pickLang(language, {
              ku: "گەڕان بە کۆد...",
              en: "Search by code...",
              ar: "بحث بالرمز...",
              zh: "按编号搜索…",
            })}
            className="w-full rounded-lg border border-border bg-card py-2 ps-9 pe-3 text-sm outline-none focus:border-emerald-500"
          />
        </div>
      )}

      {visible.map((row) => {
        const open = openKey === row.key;
        const Icon = row.icon;

        return (
          <div
            key={row.key}
            className={cn(
              "overflow-hidden rounded-xl border bg-card transition-colors",
              open ? "border-emerald-400 dark:border-emerald-700" : "border-border",
            )}
          >
            <button
              onClick={() => onToggle(open ? null : row.key)}
              aria-expanded={open}
              className="flex w-full items-center gap-3 p-3 text-start hover:bg-muted/50"
            >
              {Icon && (
                <Icon
                  className={cn(
                    "h-5 w-5 shrink-0",
                    open ? "text-emerald-600 dark:text-emerald-300" : "text-muted-foreground",
                  )}
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-sm font-medium">{row.code}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{row.meta}</p>
              </div>
              {row.amount != null && (
                <p className="shrink-0 font-mono text-sm font-semibold">${row.amount.toFixed(2)}</p>
              )}
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                  open && "rotate-180",
                )}
              />
            </button>

            {open && <div className="border-t border-border bg-muted/20 p-3">{renderExpanded(row)}</div>}
          </div>
        );
      })}

      {hidden > 0 && (
        <button
          onClick={() => setShowAll(true)}
          className="w-full rounded-lg border border-border py-2 text-sm text-muted-foreground hover:bg-muted"
        >
          {pickLang(language, {
            ku: `پیشاندانی ${hidden}ی تر`,
            en: `Show ${hidden} more`,
            ar: `عرض ${hidden} أخرى`,
            zh: `显示其余 ${hidden} 条`,
          })}
        </button>
      )}

      {searchable && query.trim() && filtered.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {pickLang(language, { ku: "هیچ نەدۆزرایەوە", en: "No matches", ar: "لا نتائج", zh: "无匹配结果" })}
        </p>
      )}
    </div>
  );
}

export default AccountRowList;
