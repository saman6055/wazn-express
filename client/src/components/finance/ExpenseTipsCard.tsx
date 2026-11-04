import { Lightbulb, TrendingDown, TrendingUp, Sparkles, Store, PieChart as PieIcon } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { expenseTips, type CategoryTotal, type VendorTotal } from "@shared/expenseTips";

const ICON = { grew: TrendingUp, new: Sparkles, heavy: PieIcon, vendor: Store, good: TrendingDown } as const;
const TONE = {
  grew: "border-rose-200 bg-rose-50/60 text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-100",
  new: "border-violet-200 bg-violet-50/60 text-violet-900 dark:border-violet-900/60 dark:bg-violet-950/30 dark:text-violet-100",
  heavy: "border-sky-200 bg-sky-50/60 text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-100",
  vendor: "border-blue-200 bg-blue-50/60 text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-100",
  good: "border-emerald-200 bg-emerald-50/60 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100",
} as const;

/**
 * Where the expenses could come down, from the period's own figures (owner,
 * 2026-11-05). Each tip about a category opens that category's expenses.
 */
export function ExpenseTipsCard({
  current,
  previous,
  byVendor,
  onSelectCategory,
}: {
  current?: { totalAmount: number; byCategory: CategoryTotal[] } | null;
  previous?: { totalAmount: number; byCategory: CategoryTotal[] } | null;
  byVendor?: VendorTotal[] | null;
  onSelectCategory: (categoryId: number) => void;
}) {
  const { language } = useLanguage();
  if (!current || !previous) return null;
  const tips = expenseTips(current, previous, byVendor ?? []);
  if (tips.length === 0) return null;
  return (
    <Card data-testid="expense-tips">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Lightbulb className="h-5 w-5 text-amber-500 dark:text-amber-300" />
          {pickLang(language, { ku: "پێشنیار بۆ کەمکردنەوەی خەرجی", en: "Where spending could come down", ar: "أين يمكن خفض المصاريف", zh: "可削减支出之处" })}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 md:grid-cols-2">
        {tips.map((tip, i) => {
          const Icon = ICON[tip.kind];
          const clickable = tip.categoryId != null;
          return (
            <button
              key={i}
              type="button"
              disabled={!clickable}
              onClick={() => tip.categoryId != null && onSelectCategory(tip.categoryId)}
              className={cn("flex items-start gap-2 rounded-xl border p-3 text-start text-sm transition-transform", TONE[tip.kind], clickable && "hover:-translate-y-0.5")}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{language === "ku" ? tip.ku : tip.en}</span>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}
