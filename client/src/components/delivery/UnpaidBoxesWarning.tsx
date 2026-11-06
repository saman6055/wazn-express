import { Link } from "wouter";
import { TriangleAlert } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { fmtUsd } from "@/lib/portalFormat";

/**
 * Shown as soon as a customer is chosen for a new box (owner, 2026-11-06,
 * point 41.1): «ئەم کڕیارە بۆکسی پێشووی وەسڵ نەکردووە». A warning, not a
 * lock - the office decides - so debt is never piled on debt unseen.
 */
export function UnpaidBoxesWarning({ customerId }: { customerId: number }) {
  const { language } = useLanguage();
  const L = (w: { ku: string; en: string; ar: string; zh: string }) => pickLang(language, w);
  const { data } = trpc.deliveryBox.unreceiptedOf.useQuery({ customerId }, { enabled: customerId > 0 });
  const boxes = data ?? [];
  if (boxes.length === 0) return null;
  const total = boxes.reduce((t, b) => t + b.valueUsd, 0);
  return (
    <div className="rounded-lg border-2 border-red-400 bg-red-50 p-3 text-sm text-red-900 dark:border-red-700 dark:bg-red-950/40 dark:text-red-100" role="alert" data-testid="unpaid-boxes-warning">
      <div className="flex items-center gap-2 font-semibold">
        <TriangleAlert className="h-4 w-4" />
        {L({ ku: "ئاگاداربە! ئەم کڕیارە بۆکسی پێشووی وەسڵ نەکردووە", en: "Careful: this customer has an earlier box with no receipt", ar: "انتبه! لهذا العميل صندوق سابق بلا إيصال", zh: "注意：该客户有未付款的旧箱子" })}
      </div>
      <p className="mt-1 text-xs">
        {L({ ku: "باشترە سەرەتا حیسابی بۆکسی پێشوو ساف بکات، ئینجا بۆکسی نوێی بۆ بنێردرێت.", en: "Better to settle the earlier box first, then send the new one.", ar: "الأفضل تسوية الصندوق السابق أولاً.", zh: "最好先结清旧箱，再发新箱。" })}
      </p>
      <ul className="mt-2 space-y-1 text-xs">
        {boxes.map((b) => (
          <li key={b.boxId} className="flex items-center justify-between gap-2">
            <Link href={`/customer-delivery-scanner?box=${b.boxId}`} className="font-mono underline">{b.boxCode}</Link>
            <span>{L({ ku: `${b.days} ڕۆژ`, en: `${b.days} days`, ar: `${b.days} يوم`, zh: `${b.days} 天` })} · <bdi dir="ltr" className="font-mono font-semibold">{fmtUsd(b.valueUsd)}</bdi></span>
          </li>
        ))}
      </ul>
      {boxes.length > 1 && <div className="mt-1 border-t border-red-300 pt-1 text-xs font-semibold dark:border-red-800">{L({ ku: "کۆ", en: "Total", ar: "المجموع", zh: "合计" })}: <bdi dir="ltr" className="font-mono">{fmtUsd(total)}</bdi></div>}
    </div>
  );
}
