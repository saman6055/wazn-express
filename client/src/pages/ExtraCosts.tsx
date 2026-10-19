/**
 * Every other cost written on a box - the main admin's watch (owner,
 * 2026-10-19: "anybody may write one, but there must be a notification and
 * oversight"). Who wrote it, when, on whose box, what the company paid and
 * what the customer is charged, and what it did to the profit. The bell's
 * "other costs" item opens here.
 */
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Receipt } from "lucide-react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";
import { fmtUsd } from "@/lib/portalFormat";
import { fmtWhen } from "@/lib/numericDate";
import { EXTRA_COST_REASON_LABELS, extraCostProfitUsd } from "@shared/extraCosts";

const WINDOWS = [7, 30, 90, 365] as const;

export default function ExtraCosts() {
  const { language } = useTranslation();
  const L = (w: { ku: string; en: string; ar: string; zh: string }) => pickLang(language, w);
  const [days, setDays] = useState<(typeof WINDOWS)[number]>(30);
  const { data, isLoading } = trpc.ledger.extraCosts.useQuery({ sinceDays: days });
  const rows = data ?? [];
  const live = rows.filter((r) => r.status === "active");
  const sums = useMemo(() => {
    const c = (n: number) => Math.round(n * 100) / 100;
    return {
      cost: c(live.reduce((s, r) => s + r.costUsd, 0)),
      price: c(live.reduce((s, r) => s + r.priceUsd, 0)),
      profit: c(live.reduce((s, r) => s + extraCostProfitUsd(r), 0)),
    };
  }, [live]);

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl space-y-4 p-3 sm:p-6" data-testid="extra-costs-page">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold"><Receipt className="h-5 w-5" />{L({ ku: "تێچووی تر", en: "Other costs", ar: "تكاليف أخرى", zh: "其他费用" })}</h1>
          <p className="text-sm text-muted-foreground">
            {L({
              ku: "گومرگ، پشکنین، پێچانەوە و هەر تێچوویەکی تر کە لەسەر بۆکس نووسراوە — کێ نووسیویەتی، چەند، و بۆچی.",
              en: "Customs, inspections, repacking and any other cost written on a box — who wrote it, how much, and why.",
              ar: "الجمرك والفحص وإعادة التغليف وأي تكلفة أخرى سُجّلت على صندوق — من سجّلها، وكم، ولماذا.",
              zh: "海关、验货、重新包装及其他记在箱子上的费用 — 谁记录的、金额和原因。",
            })}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {WINDOWS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={cn("rounded-full border px-3 py-1 text-sm", days === d ? "border-primary bg-primary/10" : "hover:bg-muted")}
            >
              {L({ ku: `${d} ڕۆژ`, en: `${d} days`, ar: `${d} يوماً`, zh: `${d} 天` })}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-muted/50 p-4">
            <div className="text-xs text-muted-foreground">{L({ ku: "کۆمپانیا دای", en: "The company paid", ar: "دفعت الشركة", zh: "公司支付" })}</div>
            <div className="text-2xl font-semibold"><bdi dir="ltr">{fmtUsd(sums.cost)}</bdi></div>
          </div>
          <div className="rounded-lg bg-muted/50 p-4">
            <div className="text-xs text-muted-foreground">{L({ ku: "لە کڕیاران نووسرا", en: "Charged to customers", ar: "حُمّل على العملاء", zh: "向客户收取" })}</div>
            <div className="text-2xl font-semibold"><bdi dir="ltr">{fmtUsd(sums.price)}</bdi></div>
          </div>
          <div className="rounded-lg bg-muted/50 p-4">
            <div className="text-xs text-muted-foreground">{L({ ku: "کاریگەری لەسەر قازانج", en: "Effect on profit", ar: "الأثر على الربح", zh: "对利润的影响" })}</div>
            <div className={cn("text-2xl font-semibold", sums.profit < 0 ? "text-red-700 dark:text-red-400" : sums.profit > 0 ? "text-emerald-700 dark:text-emerald-400" : "")}><bdi dir="ltr">{fmtUsd(sums.profit)}</bdi></div>
          </div>
        </div>

        {isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : rows.length === 0 ? (
          <Card><CardContent className="py-6 text-sm text-muted-foreground">{L({ ku: "لەم ماوەیەدا هیچ تێچوویەکی تر نەنووسراوە.", en: "No other costs were written in this period.", ar: "لم تُسجّل تكاليف أخرى في هذه الفترة.", zh: "此期间没有记录其他费用。" })}</CardContent></Card>
        ) : (
          <Card>
            <CardContent className="p-0 text-sm">
              <ul className="divide-y">
                {rows.map((r) => {
                  const profit = extraCostProfitUsd(r);
                  const removed = r.status !== "active";
                  return (
                    <li key={r.id} className={cn("flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-3 py-2.5", removed && "opacity-60")}>
                      <span className="min-w-0 space-y-0.5">
                        <span className="font-medium">{L(EXTRA_COST_REASON_LABELS[r.reason])}</span>
                        {r.note ? <span className="text-muted-foreground"> — {r.note}</span> : null}
                        <span className="block text-xs text-muted-foreground">
                          <Link href={`/finance/customer/${r.customerId}`} className="underline"><bdi dir="ltr">{r.customerCode ?? r.customerId}</bdi></Link>
                          {r.boxCode ? <> · <bdi dir="ltr">{r.boxCode}</bdi></> : null}
                          {r.trackingNumber ? <> · <bdi dir="ltr" className="font-mono">{r.trackingNumber}</bdi></> : null}
                          {" · "}{r.createdByName ?? "—"}{" · "}<bdi dir="ltr">{fmtWhen(r.createdAt, true)}</bdi>
                        </span>
                        {removed ? (
                          <span className="block text-xs text-red-700 dark:text-red-300">{L({ ku: "لابراوە", en: "Removed", ar: "أُزيلت", zh: "已删除" })}{r.removeReason ? ` — ${r.removeReason}` : ""}</span>
                        ) : r.settlementId !== null ? (
                          <span className="block text-xs text-emerald-700 dark:text-emerald-300">{L({ ku: "پارەکەی وەرگیراوە", en: "Paid", ar: "مدفوع", zh: "已收款" })}</span>
                        ) : null}
                      </span>
                      <span className="shrink-0 text-end text-xs">
                        <span className="block">{L({ ku: "تێچوو", en: "Cost", ar: "التكلفة", zh: "成本" })} <bdi dir="ltr">{fmtUsd(r.costUsd)}</bdi></span>
                        <span className="block">{r.priceUsd > 0 ? <>{L({ ku: "لە کڕیار", en: "Customer", ar: "العميل", zh: "客户" })} <bdi dir="ltr">{fmtUsd(r.priceUsd)}</bdi></> : L({ ku: "لەسەر کۆمپانیا", en: "On the company", ar: "على الشركة", zh: "公司承担" })}</span>
                        {!removed && profit !== 0 ? (
                          <span className={cn("block font-medium", profit < 0 ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400")}><bdi dir="ltr">{profit > 0 ? "+" : ""}{fmtUsd(profit)}</bdi></span>
                        ) : null}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
