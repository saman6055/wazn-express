/**
 * The customer's advance at the till (owner, 2026-10-24, of AZ234 Sinan's
 * $300): how much there is, how much this box takes, and how much is left for
 * the next box. Office only - the customer's receipt is unchanged.
 */
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { fmtUsd } from "@/lib/portalFormat";
import { advanceSplit } from "@shared/boxSettlement";

export function AdvanceSplitNote(props: { openUsd: number | null | undefined; balanceUsd: number | null | undefined; coveredUsd: number }) {
  const { language } = useTranslation();
  const L = (w: { ku: string; en: string; ar: string; zh: string }) => pickLang(language, w);
  const split = advanceSplit({ openUsd: props.openUsd, balanceUsd: props.balanceUsd ?? 0, coveredUsd: props.coveredUsd });
  if (!split) return null;
  const line = (label: string, usd: number, strong = false) => (
    <div className="flex items-baseline justify-between gap-2">
      <span>{label}</span>
      <bdi dir="ltr" className={strong ? "font-mono font-semibold" : "font-mono"}>{fmtUsd(usd)}</bdi>
    </div>
  );
  return (
    <div className="mt-3 space-y-0.5 rounded-md border border-emerald-300 bg-emerald-50/60 p-2 text-start text-xs text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200" data-testid="advance-split">
      {line(L({ ku: "پێشەکی کڕیار", en: "Customer's advance", ar: "دفعة العميل المقدمة", zh: "客户预付款" }), split.advanceUsd, true)}
      {line(L({ ku: "بۆ ئەم بۆکسە دەڕوات", en: "Goes to this box", ar: "يذهب لهذا الصندوق", zh: "用于本箱" }), split.usedUsd)}
      {line(L({ ku: "دەمێنێتەوە بۆ بۆکسی داهاتوو", en: "Left for the next box", ar: "يبقى للصندوق التالي", zh: "留给下一箱" }), split.leftUsd, true)}
    </div>
  );
}
