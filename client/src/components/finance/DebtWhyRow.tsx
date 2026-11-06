import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { fmtUsd } from "@/lib/portalFormat";

/**
 * Why a customer owes, opened under their row in the debtors report (owner,
 * 2026-11-05, point 12): each order or parcel the debt is made of, where it
 * is, and its amount - read from the same explanation the customer's finance
 * profile uses (ledger.debtExplained), only when the row is opened.
 */
const WHERE: Record<string, { ku: string; en: string; ar: string; zh: string }> = {
  road: { ku: "لە ڕێگایە", en: "On the road", ar: "في الطريق", zh: "在途" },
  arrived: { ku: "گەیشتووە", en: "Arrived", ar: "وصل", zh: "已到" },
  openBox: { ku: "لە بۆکسدایە", en: "In a box", ar: "في صندوق", zh: "在箱中" },
  parcel: { ku: "پاکەت، چاوەڕێی بۆکس", en: "Parcel, waiting for a box", ar: "طرد بانتظار صندوق", zh: "包裹，待装箱" },
};

export function DebtWhyRow({ customerId }: { customerId: number }) {
  const { language } = useTranslation();
  const L = (w: { ku: string; en: string; ar: string; zh: string }) => pickLang(language, w);
  const { data, isLoading } = trpc.ledger.debtExplained.useQuery({ customerId });
  if (isLoading) return <p className="p-3 text-xs text-muted-foreground">…</p>;
  if (!data) return null;
  const items = (data.items ?? []).filter((i) => Number(i.usd) > 0.005);
  const advance = Number(data.advance?.leftUsd ?? 0);
  const falseDebt = Number(data.falseDebtUsd ?? 0);
  return (
    <div className="space-y-1 p-3 text-xs" data-testid="debt-why">
      {items.map((i) => (
        <div key={i.key} className="flex items-center justify-between gap-3 border-b py-1 last:border-0">
          <span className="min-w-0 truncate">
            <bdi dir="ltr" className="font-mono">{i.orderCode || i.tracking}</bdi>
            {i.productName ? <span className="text-muted-foreground"> · {i.productName}</span> : null}
          </span>
          <span className="flex shrink-0 items-center gap-2">
            {i.boxCode && i.boxId
              ? <Link href={`/customer-delivery-scanner?box=${i.boxId}`} className="font-mono text-sky-700 underline dark:text-sky-300">{i.boxCode}</Link>
              : <span className="text-muted-foreground">{L(WHERE[String(i.verdict ?? "")] ?? { ku: String(i.verdict ?? ""), en: String(i.verdict ?? ""), ar: String(i.verdict ?? ""), zh: String(i.verdict ?? "") })}</span>}
            <bdi dir="ltr" className="font-mono font-semibold">{fmtUsd(Number(i.usd))}</bdi>
          </span>
        </div>
      ))}
      {advance > 0.005 && (
        <div className="flex justify-between text-emerald-700 dark:text-emerald-300"><span>{L({ ku: "پێشەکی", en: "Advance", ar: "دفعة مقدمة", zh: "预付" })}</span><bdi dir="ltr" className="font-mono">−{fmtUsd(advance)}</bdi></div>
      )}
      {falseDebt > 0.005 && (
        <div className="flex justify-between text-amber-700 dark:text-amber-300"><span>{L({ ku: "قەرزی درۆ (بۆکسی واصڵکراو)", en: "False debt (receipted box)", ar: "دين وهمي", zh: "虚假欠款" })}</span><bdi dir="ltr" className="font-mono">{fmtUsd(falseDebt)}</bdi></div>
      )}
      <div className="flex justify-between border-t pt-1 font-semibold"><span>{L({ ku: "کۆی ماوە", en: "Balance", ar: "الرصيد", zh: "余额" })}</span><bdi dir="ltr" className="font-mono">{fmtUsd(Number(data.balanceUsd))}</bdi></div>
    </div>
  );
}
