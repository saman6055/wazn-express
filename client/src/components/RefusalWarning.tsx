import { TriangleAlert } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { pickLang } from "@/lib/lang";
import { fmtUsd } from "@/lib/portalFormat";
import { useTranslation } from "@/contexts/LanguageContext";

/**
 * Shown where a customer's next order is typed, when that customer has
 * refused goods before (owner, 2026-10-07: fake customers and people who
 * change their mind leave the company holding goods it paid for). It does not
 * stop the order — it says to take the money first.
 */
export function RefusalWarning({ customerId }: { customerId: number | null | undefined }) {
  const { language } = useTranslation();
  const id = Number(customerId) || 0;
  const { data } = trpc.ledger.customerRefusals.useQuery({ customerId: id }, { enabled: id > 0, staleTime: 60_000 });
  if (!data || data.times <= 0) return null;
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200" data-testid="refusal-warning">
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        {pickLang(language, {
          ku: `ئەم کڕیارە ${data.times} جار کاڵای ڕەت کردۆتەوە (بە تێچووی ${fmtUsd(data.costUsd)}). پێش داواکردن، پێشەکی پارەی لێ وەربگرە.`,
          en: `This customer has refused goods ${data.times} time(s) (cost ${fmtUsd(data.costUsd)}). Take money in advance before ordering.`,
          ar: `رفض هذا العميل البضاعة ${data.times} مرة (بتكلفة ${fmtUsd(data.costUsd)}). خذ دفعة مقدمة قبل الطلب.`,
          zh: `该客户已拒收 ${data.times} 次（成本 ${fmtUsd(data.costUsd)}）。下单前请先收款。`,
        })}
      </span>
    </div>
  );
}
