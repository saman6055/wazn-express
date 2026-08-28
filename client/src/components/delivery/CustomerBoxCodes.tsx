import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Users, Search, X, Package, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";

/**
 * Who has goods waiting, answered by customer instead of by box.
 *
 * The table below this is a flat list of boxes, twenty to a page, ordered by
 * when they were made. That is the right shape for auditing the day's work
 * and the wrong shape for the counter, where the question is always the same
 * one: a customer is standing there, they have given their code, and what
 * has to appear is everything of theirs — not one box on page one and
 * another on page three.
 *
 * So the codes come first, each with the number of boxes behind it. Pressing
 * one narrows the table to that customer and nothing else; pressing it again
 * puts the whole list back.
 */

export interface CustomerBoxSummary {
  customerId: number;
  customerCode: string | null;
  fullName: string | null;
  phone: string | null;
  openBoxes: number;
  finishedBoxes: number;
  totalPackages: number;
  totalValueUsd: number;
}

interface Props {
  rows: CustomerBoxSummary[];
  isLoading: boolean;
  /** The code currently drilled into, or null for the whole list. */
  selectedCustomerId: number | null;
  onSelect: (customerId: number | null) => void;
}

/** Above this many codes the grid stops being scannable and needs a filter. */
const SEARCH_THRESHOLD = 12;
/** How many to draw before "show the rest" — a wall of codes is not a card. */
const COLLAPSED_COUNT = 18;

export function CustomerBoxCodes({ rows, isLoading, selectedCustomerId, onSelect }: Props) {
  const { language } = useTranslation();
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(false);

  /**
   * Customers whose boxes are all delivered are dropped, but only when they
   * are not the one being looked at: opening a code and having it disappear
   * from underneath the cursor is worse than one stale tile.
   */
  const waiting = useMemo(
    () => rows.filter((r) => r.openBoxes > 0 || r.customerId === selectedCustomerId),
    [rows, selectedCustomerId],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return waiting;
    return waiting.filter(
      (r) =>
        (r.customerCode ?? "").toLowerCase().includes(q) ||
        (r.fullName ?? "").toLowerCase().includes(q) ||
        (r.phone ?? "").includes(q),
    );
  }, [waiting, search]);

  const shown = expanded || filtered.length <= COLLAPSED_COUNT
    ? filtered
    : filtered.slice(0, COLLAPSED_COUNT);

  const selected = selectedCustomerId
    ? rows.find((r) => r.customerId === selectedCustomerId) ?? null
    : null;

  const label = {
    title: pickLang(language, {
      ku: "کۆدی کڕیارەکان",
      en: "Customer codes",
      ar: "أكواد العملاء",
      zh: "客户代码",
    }),
    subtitle: pickLang(language, {
      ku: "کلیک لەسەر کۆدێک بکە بۆ بینینی هەموو بۆکسەکانی",
      en: "Press a code to see all of that customer's boxes",
      ar: "اضغط على كود لعرض جميع صناديق ذلك العميل",
      zh: "点击代码查看该客户的所有箱子",
    }),
    boxes: pickLang(language, { ku: "بۆکس", en: "boxes", ar: "صندوق", zh: "箱" }),
    search: pickLang(language, {
      ku: "گەڕان بە کۆد، ناو یان ژمارە",
      en: "Search by code, name or phone",
      ar: "البحث بالكود أو الاسم أو الهاتف",
      zh: "按代码、姓名或电话搜索",
    }),
    none: pickLang(language, {
      ku: "هیچ کڕیارێک بۆکسی چاوەڕوانی نییە",
      en: "No customer has a box waiting",
      ar: "لا يوجد عميل لديه صندوق في الانتظار",
      zh: "没有客户有等待中的箱子",
    }),
    noMatch: pickLang(language, {
      ku: "هیچ کۆدێک نەدۆزرایەوە",
      en: "No code found",
      ar: "لم يتم العثور على أي كود",
      zh: "未找到代码",
    }),
    showAll: pickLang(language, {
      ku: "پیشاندانی هەمووی",
      en: "Show all",
      ar: "عرض الكل",
      zh: "显示全部",
    }),
    showLess: pickLang(language, {
      ku: "کەمتر پیشان بدە",
      en: "Show less",
      ar: "عرض أقل",
      zh: "收起",
    }),
    clear: pickLang(language, {
      ku: "گەڕانەوە بۆ هەموو بۆکسەکان",
      en: "Back to all boxes",
      ar: "العودة إلى كل الصناديق",
      zh: "返回全部箱子",
    }),
  };

  return (
    <Card data-testid="customer-box-codes">
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-950/50">
            <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold leading-tight">{label.title}</p>
            <p className="truncate text-sm text-muted-foreground">{label.subtitle}</p>
          </div>

          {waiting.length > SEARCH_THRESHOLD && (
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute inset-inline-start-0 top-1/2 ms-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={label.search}
                className="ps-9"
                data-testid="customer-box-codes-search"
              />
            </div>
          )}
        </div>

        {/* What is currently being looked at, and the way back out. A filter
            with no visible handle is a filter somebody forgets is on. */}
        {selected && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm dark:border-blue-900 dark:bg-blue-950/40">
            <ChevronLeft className="h-4 w-4 shrink-0 text-blue-600 rtl:rotate-180 dark:text-blue-400" />
            <span className="font-medium" dir="ltr">
              {selected.customerCode || selected.fullName}
            </span>
            <span className="text-muted-foreground">
              {selected.openBoxes} {label.boxes}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="ms-auto h-7"
              onClick={() => onSelect(null)}
              data-testid="customer-box-codes-clear"
            >
              <X className="h-4 w-4 me-1" />
              {label.clear}
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {waiting.length === 0 ? label.none : label.noMatch}
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {shown.map((row) => {
                const isSelected = row.customerId === selectedCustomerId;
                return (
                  <button
                    key={row.customerId}
                    type="button"
                    // Pressing the open code closes it: the tile is the
                    // handle both ways, so nobody hunts for how to get back.
                    onClick={() => onSelect(isSelected ? null : row.customerId)}
                    title={row.fullName ?? undefined}
                    data-testid={`customer-box-code-${row.customerId}`}
                    className={cn(
                      "flex flex-col items-start gap-1 rounded-lg border p-3 text-start transition-colors",
                      isSelected
                        ? "border-blue-500 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/50"
                        : "hover:border-blue-300 hover:bg-muted/60 dark:hover:border-blue-800",
                    )}
                  >
                    <span className="w-full truncate font-mono text-sm font-semibold" dir="ltr">
                      {row.customerCode || row.fullName || `#${row.customerId}`}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Badge variant={isSelected ? "default" : "secondary"} className="px-1.5">
                        {row.openBoxes}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{label.boxes}</span>
                    </span>
                    {row.totalPackages > 0 && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Package className="h-3 w-3" />
                        {row.totalPackages}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {filtered.length > COLLAPSED_COUNT && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => setExpanded((v) => !v)}
                data-testid="customer-box-codes-toggle"
              >
                {expanded ? label.showLess : `${label.showAll} (${filtered.length})`}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
