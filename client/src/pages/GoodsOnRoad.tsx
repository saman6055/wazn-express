import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Ship } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { fmtUsd } from "@/lib/portalFormat";
import { cn } from "@/lib/utils";
import { roadAgeKey, roadByAge, roadTotals, type RoadAgeKey, type RoadPaid, type RoadRow } from "@shared/goodsOnRoad";

type Words = { ku: string; en: string; ar: string; zh: string };

const AGE_WORDS: Record<RoadAgeKey, Words> = {
  week: { ku: "0 تا 7 ڕۆژ", en: "0 to 7 days", ar: "0 إلى 7 أيام", zh: "0–7 天" },
  month: { ku: "8 تا 30 ڕۆژ", en: "8 to 30 days", ar: "8 إلى 30 يوماً", zh: "8–30 天" },
  quarter: { ku: "31 تا 90 ڕۆژ", en: "31 to 90 days", ar: "31 إلى 90 يوماً", zh: "31–90 天" },
  older: { ku: "زیاتر لە 90 ڕۆژ", en: "Over 90 days", ar: "أكثر من 90 يوماً", zh: "超过 90 天" },
};

const STATUS_WORDS: Record<string, Words> = {
  pending: { ku: "چاوەڕێی پەسەند", en: "Pending", ar: "قيد الانتظار", zh: "待处理" },
  approved: { ku: "پەسەندکراو", en: "Approved", ar: "موافق عليه", zh: "已批准" },
  ordered: { ku: "داواکراو", en: "Ordered", ar: "تم الطلب", zh: "已下单" },
  tracking_added: { ku: "تراکینگی هەیە", en: "Has tracking", ar: "له رقم تتبع", zh: "已有单号" },
  in_china_warehouse: { ku: "لە کۆگای چین", en: "In China depot", ar: "في مستودع الصين", zh: "在中国仓" },
  in_transit: { ku: "لە ڕێگا", en: "In transit", ar: "في الطريق", zh: "运输中" },
  arrived: { ku: "گەیشت", en: "Arrived", ar: "وصل", zh: "已到达" },
  delivered: { ku: "گەیەنرا", en: "Delivered", ar: "تم التسليم", zh: "已交付" },
};

function Money({ value, className }: { value: number; className?: string }) {
  return <bdi dir="ltr" className={cn("tabular-nums", className)}>{fmtUsd(value)}</bdi>;
}

/**
 * Goods on the road (owner, 2026-10-07): every order not yet finished, by
 * when it was entered, with what it is worth — the list behind the figure on
 * the working-capital page. Closing one asks whether it was paid, because an
 * old parcel in the customer's hands was almost always paid for long ago.
 */
export default function GoodsOnRoad() {
  const { language } = useTranslation();
  const L = (w: Words) => pickLang(language, w);
  const { user } = useAuth();
  const isMainAdmin = user?.role === "super_admin";
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.ledger.goodsOnRoad.useQuery();
  const [scope, setScope] = useState<"notOnAccount" | "all">("notOnAccount");
  const [age, setAge] = useState<RoadAgeKey | null>(null);
  const [closing, setClosing] = useState<{ row: RoadRow; paid: RoadPaid | null } | null>(null);

  const close = trpc.ledger.closeOrderOnRoad.useMutation({
    onSuccess: (res, vars) => {
      void utils.ledger.goodsOnRoad.invalidate();
      void utils.ledger.workingCapital.invalidate();
      void utils.ledger.financeDashboard.invalidate();
      setClosing(null);
      toast.success(
        vars.paid === "before"
          ? L({ ku: `${res.orderCode} داخرا — حیسابی کڕیار نەگۆڕا`, en: `${res.orderCode} closed — the customer's balance did not move`, ar: `أُغلق ${res.orderCode} — لم يتغير رصيد العميل`, zh: `${res.orderCode} 已关闭 — 客户余额未变` })
          : L({ ku: `${res.orderCode} لەسەر کڕیار نووسرا`, en: `${res.orderCode} is on the customer's account`, ar: `قُيِّد ${res.orderCode} على العميل`, zh: `${res.orderCode} 已记入客户账户` }),
      );
    },
    onError: (e) => toast.error(e.message, { duration: 15_000 }),
  });

  const all = data ?? [];
  const inScope = useMemo(() => (scope === "all" ? all : all.filter((r) => !r.onAccount)), [all, scope]);
  const shown = useMemo(() => (age ? inScope.filter((r) => roadAgeKey(r.days) === age) : inScope), [inScope, age]);
  const totals = roadTotals(inScope);
  const buckets = roadByAge(inScope);

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-4xl space-y-4 p-3 sm:p-6" data-testid="goods-on-road">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-semibold">
              <Ship className="h-5 w-5" />
              {L({ ku: "کاڵای ڕێگا", en: "Goods on the road", ar: "بضائع في الطريق", zh: "在途货物" })}
            </h1>
            <p className="text-sm text-muted-foreground">
              {L({
                ku: "ئەو داواکارییانەی کڕدراون و هێشتا تەواو نەبوون، بە پێی بەرواری تۆمارکردنیان.",
                en: "Orders bought and not yet finished, by the date they were entered.",
                ar: "الطلبات المشتراة التي لم تكتمل بعد، حسب تاريخ إدخالها.",
                zh: "已购买但尚未完成的订单，按录入日期排列。",
              })}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-1">
            <Button size="sm" variant={scope === "notOnAccount" ? "default" : "outline"} onClick={() => setScope("notOnAccount")}>
              {L({ ku: "لەسەر کڕیار نەنووسراوە", en: "Not on an account", ar: "غير مقيَّد على العميل", zh: "未记账" })}
            </Button>
            <Button size="sm" variant={scope === "all" ? "default" : "outline"} onClick={() => setScope("all")}>
              {L({ ku: "هەموو نەگەیشتووەکان", en: "Everything unfinished", ar: "كل ما لم يكتمل", zh: "全部未完成" })}
            </Button>
          </div>
        </div>

        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-muted/50 p-4">
                <div className="text-xs text-muted-foreground">{L({ ku: "داواکاری", en: "Orders", ar: "الطلبات", zh: "订单" })}</div>
                <div className="text-2xl font-semibold"><bdi dir="ltr">{totals.count}</bdi></div>
              </div>
              <div className="rounded-lg bg-muted/50 p-4">
                <div className="text-xs text-muted-foreground">{L({ ku: "تێچووی کڕین", en: "Buy cost", ar: "تكلفة الشراء", zh: "采购成本" })}</div>
                <div className="text-2xl font-semibold"><Money value={totals.buyUsd} /></div>
              </div>
              <div className="rounded-lg bg-muted/50 p-4">
                <div className="text-xs text-muted-foreground">{L({ ku: "نرخی فرۆشتن", en: "Sell value", ar: "قيمة البيع", zh: "销售额" })}</div>
                <div className="text-2xl font-semibold"><Money value={totals.sellUsd} /></div>
              </div>
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{L({ ku: "بە پێی تەمەن", en: "By age", ar: "حسب المدة", zh: "按时长" })}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                {buckets.map((b) => (
                  <button
                    key={b.key}
                    type="button"
                    onClick={() => setAge(age === b.key ? null : b.key)}
                    className={cn("flex w-full items-center justify-between gap-3 border-b px-2 py-2 text-start last:border-b-0 hover:bg-muted/50", age === b.key && "bg-muted")}
                  >
                    <span className={cn(b.key === "older" && b.count > 0 && "text-red-700 dark:text-red-400")}>
                      {L(AGE_WORDS[b.key])} <span className="text-xs text-muted-foreground">· {L({ ku: `${b.count} داواکاری`, en: `${b.count} orders`, ar: `${b.count} طلب`, zh: `${b.count} 单` })}</span>
                    </span>
                    <span className="flex shrink-0 gap-3">
                      <Money value={b.buyUsd} className="text-muted-foreground" />
                      <Money value={b.sellUsd} className="font-medium" />
                    </span>
                  </button>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {age ? L(AGE_WORDS[age]) : L({ ku: "هەمووی، کۆنترین لە سەرەوە", en: "All, oldest first", ar: "الكل، الأقدم أولاً", zh: "全部，最早的在前" })}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                {shown.length === 0 ? (
                  <p className="py-2 text-muted-foreground">{L({ ku: "هیچ داواکارییەک نییە.", en: "No orders.", ar: "لا توجد طلبات.", zh: "没有订单。" })}</p>
                ) : (
                  <ul className="divide-y">
                    {shown.map((r) => (
                      <li key={r.orderId} className="py-2">
                        <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                          <span className="min-w-0 flex-1">
                            <span className="block font-medium">
                              {r.customerName ?? r.customerCode ?? "—"}{" "}
                              <span className="text-xs font-normal text-muted-foreground"><bdi dir="ltr">{r.customerCode}</bdi></span>
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              <Link href={`/full-package/${r.orderId}`} className="underline"><bdi dir="ltr">{r.orderCode}</bdi></Link> ·{" "}
                              {r.productName ?? "—"} × <bdi dir="ltr">{r.quantity}</bdi> ·{" "}
                              {L(STATUS_WORDS[r.status] ?? { ku: r.status, en: r.status, ar: r.status, zh: r.status })} ·{" "}
                              <bdi dir="ltr">{r.createdAt ? new Date(r.createdAt).toLocaleDateString("en-GB") : "—"}</bdi> ·{" "}
                              <span className={cn(r.days > 90 && "text-red-700 dark:text-red-400")}>{L({ ku: `${r.days} ڕۆژ`, en: `${r.days} days`, ar: `${r.days} يوماً`, zh: `${r.days} 天` })}</span>
                              {r.onAccount && <> · {L({ ku: "لەسەر کڕیار نووسراوە", en: "on the account", ar: "مقيَّد على العميل", zh: "已记账" })}</>}
                            </span>
                          </span>
                          <span className="flex shrink-0 flex-col items-end">
                            <Money value={r.sellUsd} className="font-medium" />
                            <span className="text-xs text-muted-foreground">{L({ ku: "تێچوو", en: "cost", ar: "التكلفة", zh: "成本" })} <Money value={r.buyUsd} /></span>
                          </span>
                        </div>

                        {isMainAdmin && !r.onAccount && closing?.row.orderId !== r.orderId && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" className="h-8" onClick={() => setClosing({ row: r, paid: null })}>
                              {L({ ku: "گەیشتووە و دراوەتە کڕیار", en: "Arrived and with the customer", ar: "وصل وهو مع العميل", zh: "已到并已交给客户" })}
                            </Button>
                            <Link href={`/full-package/${r.orderId}`}>
                              <Button size="sm" variant="ghost" className="h-8">{L({ ku: "داواکارییەکە بکەوە", en: "Open the order", ar: "افتح الطلب", zh: "打开订单" })}</Button>
                            </Link>
                          </div>
                        )}

                        {closing?.row.orderId === r.orderId && (
                          <div className="mt-2 space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200" data-testid="close-order">
                            <div className="font-medium">
                              {L({ ku: "پارەکەی دراوە؟", en: "Was it paid?", ar: "هل دُفع؟", zh: "是否已付款？" })}{" "}
                              <span className="font-normal">{r.customerName ?? r.customerCode} · <Money value={r.sellUsd} /></span>
                            </div>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                              <Button size="sm" variant={closing.paid === "before" ? "default" : "outline"} className="h-auto min-h-9 whitespace-normal py-1.5" onClick={() => setClosing({ row: r, paid: "before" })}>
                                {L({ ku: "بەڵێ، پێشتر دراوە", en: "Yes, paid before", ar: "نعم، دُفع سابقاً", zh: "是，之前已付" })}
                              </Button>
                              <Button size="sm" variant={closing.paid === "no" ? "default" : "outline"} className="h-auto min-h-9 whitespace-normal py-1.5" onClick={() => setClosing({ row: r, paid: "no" })}>
                                {L({ ku: "نەخێر، هێشتا نەیداوە", en: "No, not paid yet", ar: "لا، لم يدفع بعد", zh: "否，尚未付款" })}
                              </Button>
                            </div>
                            {closing.paid && (
                              <p className="text-sm">
                                {closing.paid === "before"
                                  ? L({
                                      ku: `دوو دێڕ لە حیسابی کڕیار دەنووسرێت کە یەکتر دەسڕنەوە: کاڵا +${fmtUsd(r.sellUsd)} و «پێشتر دراوە» −${fmtUsd(r.sellUsd)}. حیسابەکەی ناگۆڕێت.`,
                                      en: `Two lines go on the customer's account and cancel: goods +${fmtUsd(r.sellUsd)} and "paid before" −${fmtUsd(r.sellUsd)}. The balance does not move.`,
                                      ar: `يُقيَّد سطران يلغي أحدهما الآخر: البضاعة +${fmtUsd(r.sellUsd)} و«دُفع سابقاً» −${fmtUsd(r.sellUsd)}. الرصيد لا يتغير.`,
                                      zh: `客户账户记两行并相互抵销：货款 +${fmtUsd(r.sellUsd)}，“之前已付” −${fmtUsd(r.sellUsd)}。余额不变。`,
                                    })
                                  : L({
                                      ku: `${fmtUsd(r.sellUsd)} دەبێتە قەرز لەسەر ${r.customerName ?? r.customerCode ?? ""}.`,
                                      en: `${fmtUsd(r.sellUsd)} becomes a debt on ${r.customerName ?? r.customerCode ?? ""}.`,
                                      ar: `يصبح ${fmtUsd(r.sellUsd)} ديناً على ${r.customerName ?? r.customerCode ?? ""}.`,
                                      zh: `${fmtUsd(r.sellUsd)} 将成为 ${r.customerName ?? r.customerCode ?? ""} 的欠款。`,
                                    })}
                              </p>
                            )}
                            <div className="flex flex-wrap justify-end gap-2">
                              <Button size="sm" variant="ghost" onClick={() => setClosing(null)}>
                                {L({ ku: "نازانم — هیچ مەگۆڕە", en: "I don't know — change nothing", ar: "لا أعلم — لا تغيّر شيئاً", zh: "不确定 — 不作更改" })}
                              </Button>
                              <Button size="sm" disabled={!closing.paid || close.isPending} onClick={() => closing.paid && close.mutate({ orderId: r.orderId, paid: closing.paid })}>
                                {L({ ku: "بەڵێ، دایبخە", en: "Yes, close it", ar: "نعم، أغلقه", zh: "是，关闭" })}
                              </Button>
                            </div>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
