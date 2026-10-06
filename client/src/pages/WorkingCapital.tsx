import { useState } from "react";
import { Link } from "wouter";
import { Banknote, Ship, TriangleAlert, Users } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { fmtUsd } from "@/lib/portalFormat";
import { cn } from "@/lib/utils";
import { WORKING_CAPITAL_ALERT_USD, cashCheck } from "@shared/workingCapital";

type Words = { ku: string; en: string; ar: string; zh: string };

/** A signed dollar figure that reads left to right inside a Kurdish line. */
function Money({ value, signed, className }: { value: number; signed?: boolean; className?: string }) {
  const sign = value < 0 ? "−" : signed ? "+" : "";
  return (
    <bdi dir="ltr" className={cn("tabular-nums", className)}>
      {sign}{fmtUsd(Math.abs(value))}
    </bdi>
  );
}

function Line({ label, children, tone }: { label: React.ReactNode; children: React.ReactNode; tone?: "good" | "bad" | "quiet" }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 border-b py-2 last:border-b-0",
        tone === "good" && "text-emerald-700 dark:text-emerald-400",
        tone === "bad" && "text-red-700 dark:text-red-400",
        tone === "quiet" && "text-muted-foreground",
      )}
    >
      <span className="min-w-0">{label}</span>
      <span className="shrink-0 font-medium">{children}</span>
    </div>
  );
}

/**
 * Where the company's money is (owner, 2026-10-05). Every figure is read from
 * the records; nothing on this page is typed except the optional count, which
 * is a test and never part of a total (shared/workingCapital).
 */
export default function WorkingCapital() {
  const { language } = useTranslation();
  const L = (w: Words) => pickLang(language, w);
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.ledger.workingCapital.useQuery();
  const [have, setHave] = useState("");
  const [owe, setOwe] = useState("");
  const [fault, setFault] = useState("");
  const check = trpc.ledger.checkWorkingCapital.useMutation({
    onSuccess: () => {
      void utils.ledger.workingCapital.invalidate();
      setHave("");
      setOwe("");
      toast.success(L({ ku: "پشکنینەکە هەڵگیرا", en: "Check saved", ar: "تم حفظ الفحص", zh: "已保存核对" }));
    },
    onError: (e) => toast.error(e.message),
  });

  const submitCheck = () => {
    const h = Number(have);
    const o = owe.trim() === "" ? 0 : Number(owe);
    if (have.trim() === "" || !Number.isFinite(h) || h < 0 || !Number.isFinite(o) || o < 0) {
      setFault(L({ ku: "بڕی ئەو پارەیەی ئێستا هەتە بنووسە", en: "Enter the money you hold now", ar: "أدخل المبلغ الذي لديك الآن", zh: "请输入现有金额" }));
      return;
    }
    check.mutate({ haveUsd: h, oweUsd: o });
  };

  const f = data?.facts;
  const holding = f && data ? f.debtUsd + f.goodsOnRoadUsd + data.netCashUsd - f.creditUsd : 0;
  const preview = data && have.trim() !== "" && Number.isFinite(Number(have))
    ? cashCheck(data.netCashUsd, Number(have), Number(owe) || 0)
    : null;
  const last = data?.lastCheck ?? null;
  const lastIsLoud = !!last && Math.abs(last.unwrittenUsd) >= WORKING_CAPITAL_ALERT_USD;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl space-y-4 p-3 sm:p-6" data-testid="working-capital">
        <div>
          <h1 className="text-xl font-semibold">{L({ ku: "سەرمایەی کار", en: "Working capital", ar: "رأس المال العامل", zh: "营运资金" })}</h1>
          <p className="text-sm text-muted-foreground">
            {L({
              ku: "پارەی شەریکە لە کوێیە. هەموو ژمارەکان لە تۆمارەکانەوە دێن، هیچیان نانووسرێت.",
              en: "Where the company's money is. Every figure comes from the records; none is typed.",
              ar: "أين أموال الشركة. كل الأرقام من السجلات.",
              zh: "公司资金所在。所有数字均来自记录。",
            })}
          </p>
        </div>

        {isLoading || !data || !f ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-muted/50 p-4">
                <div className="text-xs text-muted-foreground">{L({ ku: "سەرمایەی هێنراو", en: "Capital brought in", ar: "رأس المال", zh: "投入资本" })}</div>
                <div className="text-2xl font-semibold"><Money value={f.capitalUsd} /></div>
              </div>
              <div className="rounded-lg bg-muted/50 p-4">
                <div className="text-xs text-muted-foreground">{L({ ku: "ئێستا لە ناو ئیشە", en: "In the work now", ar: "في العمل الآن", zh: "现在在业务中" })}</div>
                <div className="text-2xl font-semibold"><Money value={data.shouldHoldUsd} /></div>
              </div>
              <div className="rounded-lg bg-muted/50 p-4">
                <div className="text-xs text-muted-foreground">{L({ ku: "لە سەرمایە زیاد / کەم", en: "Above / below capital", ar: "أعلى / أقل من رأس المال", zh: "高于/低于资本" })}</div>
                <div className={cn("text-2xl font-semibold", data.shouldHoldUsd - f.capitalUsd < 0 ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400")}>
                  <Money value={data.shouldHoldUsd - f.capitalUsd} signed />
                </div>
              </div>
            </div>

            {f.capitalUsd <= 0 && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {L({
                    ku: "هێشتا هیچ سەرمایەیەک بۆ شەریکەکان تۆمار نەکراوە، بۆیە ژمارەکانی خوارەوە بەبێ سەرمایە ژمێردراون. لە بەشی «هاوبەشەکان» سەرمایەکە تۆمار بکە.",
                    en: "No partner capital is recorded yet, so the figures below are counted without it. Record it under Partners.",
                    ar: "لم يُسجَّل رأس مال الشركاء بعد.",
                    zh: "尚未记录合伙人资本。",
                  })}{" "}
                  <Link href="/company/partners" className="underline">{L({ ku: "هاوبەشەکان", en: "Partners", ar: "الشركاء", zh: "合伙人" })}</Link>
                </span>
              </div>
            )}

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{L({ ku: "پارەکە ئێستا لە کوێیە", en: "Where the money is now", ar: "أين المال الآن", zh: "资金现在何处" })}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <Line
                  label={
                    <span className="flex flex-wrap items-center gap-x-2">
                      <Users className="h-4 w-4 shrink-0" />
                      {L({ ku: `لای کڕیارانە — ${f.debtors} کڕیار`, en: `With customers — ${f.debtors}`, ar: `عند العملاء — ${f.debtors}`, zh: `客户欠款 — ${f.debtors}` })}
                      <Link href="/finance/debtors" className="text-xs text-primary underline">{L({ ku: "بیانبینە", en: "See them", ar: "اعرض", zh: "查看" })}</Link>
                    </span>
                  }
                >
                  <Money value={f.debtUsd} />
                </Line>
                <Line
                  label={
                    <span className="flex flex-wrap items-center gap-x-2">
                      <Ship className="h-4 w-4 shrink-0" />
                      {L({ ku: `کاڵای ڕێگا — ${f.goodsOnRoadCount} داواکاری`, en: `Goods on the road — ${f.goodsOnRoadCount} orders`, ar: `بضائع في الطريق — ${f.goodsOnRoadCount}`, zh: `在途货物 — ${f.goodsOnRoadCount}` })}
                      <Link href="/finance/goods-on-road" className="text-xs text-primary underline">{L({ ku: "بیانبینە", en: "See them", ar: "اعرض", zh: "查看" })}</Link>
                      <span className="text-xs text-muted-foreground">
                        {L({ ku: "کڕدراوە، هێشتا لەسەر کڕیار نەنووسراوە · تێچووی کڕین", en: "bought, not yet on the customer · cost", ar: "مشتراة، لم تُقيَّد بعد · التكلفة", zh: "已购，未记账 · 成本" })}{" "}
                        <Money value={f.goodsOnRoadCostUsd} />
                      </span>
                    </span>
                  }
                >
                  <Money value={f.goodsOnRoadUsd} />
                </Line>
                {f.creditUsd > 0 && (
                  <Line tone="bad" label={L({ ku: "پارەی کڕیاران لای ئێمە", en: "Customers' money with us", ar: "أموال العملاء عندنا", zh: "客户预存款" })}>
                    <Money value={-f.creditUsd} />
                  </Line>
                )}
                <Line
                  tone={data.netCashUsd < 0 ? "bad" : undefined}
                  label={
                    <span className="flex flex-wrap items-center gap-x-2">
                      <Banknote className="h-4 w-4 shrink-0" />
                      {data.netCashUsd < 0
                        ? L({ ku: "قەرزاریت (نەقدی پاک)", en: "You owe (net cash)", ar: "عليك (صافي النقد)", zh: "欠款（净现金）" })
                        : L({ ku: "نەقدی پاک — ئەوەی هەتە، کەم ئەوەی قەرزاریت", en: "Net cash — what you hold less what you owe", ar: "صافي النقد", zh: "净现金" })}
                    </span>
                  }
                >
                  <Money value={data.netCashUsd} />
                </Line>
                <div className="flex items-center justify-between gap-3 border-t pt-2 font-semibold">
                  <span>{L({ ku: "کۆ", en: "Total", ar: "المجموع", zh: "合计" })}</span>
                  <Money value={holding} />
                </div>
                {f.stockCount > 0 && (
                  <div className="mt-2 flex items-center justify-between gap-3 border-t pt-2 text-red-700 dark:text-red-400">
                    <span className="flex flex-wrap items-center gap-x-2">
                      {L({ ku: `کاڵای خەسارە — ${f.stockCount} دانە`, en: `Loss goods — ${f.stockCount}`, ar: `بضائع خاسرة — ${f.stockCount}`, zh: `亏损货物 — ${f.stockCount}` })}
                      <span className="text-xs text-muted-foreground">{L({ ku: "ڕەتکراوەتەوە و نەفرۆشراوە · وەک خەسارە ژمێردراوە، لە کۆکەدا نییە", en: "refused and unsold · already counted as a loss, not in the total", ar: "مرفوضة ولم تُبع · محسوبة كخسارة", zh: "被拒收未售出 · 已计为亏损" })}</span>
                      <Link href="/finance/company-stock" className="text-xs text-primary underline">{L({ ku: "بیانبینە", en: "See them", ar: "اعرض", zh: "查看" })}</Link>
                    </span>
                    <Money value={f.stockUsd} />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card data-testid="money-received">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-base">{L({ ku: "پارەی هاتوو", en: "Money received", ar: "المبالغ المستلمة", zh: "已收款项" })}</CardTitle>
                <Link href="/payments" className="text-xs text-primary underline">{L({ ku: "هەموو وەسڵەکان", en: "All receipts", ar: "كل الإيصالات", zh: "全部收据" })}</Link>
              </CardHeader>
              <CardContent className="text-sm">
                {([
                  ["today", { ku: "ئەمڕۆ", en: "Today", ar: "اليوم", zh: "今天" }],
                  ["week", { ku: "ئەم هەفتەیە (لە شەممەوە)", en: "This week (from Saturday)", ar: "هذا الأسبوع (من السبت)", zh: "本周（周六起）" }],
                  ["month", { ku: "ئەم مانگە", en: "This month", ar: "هذا الشهر", zh: "本月" }],
                ] as const).map(([key, words]) => (
                  <Line
                    key={key}
                    tone={data.received[key].usd > 0 ? "good" : "quiet"}
                    label={
                      <span className="flex flex-wrap items-center gap-x-2">
                        {L(words)}
                        <span className="text-xs text-muted-foreground">
                          {L({ ku: `${data.received[key].count} وەسڵ`, en: `${data.received[key].count} receipts`, ar: `${data.received[key].count} إيصال`, zh: `${data.received[key].count} 张` })}
                        </span>
                      </span>
                    }
                  >
                    <Money value={data.received[key].usd} />
                  </Line>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{L({ ku: "چۆن گەیشتینە ئێرە", en: "How we got here", ar: "كيف وصلنا", zh: "如何得出" })}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <Line label={L({ ku: "سەرمایەی هێنراو", en: "Capital brought in", ar: "رأس المال", zh: "投入资本" })}><Money value={f.capitalUsd} /></Line>
                <Line tone="good" label={L({ ku: "قازانجی کار", en: "Work profit", ar: "ربح العمل", zh: "经营利润" })}><Money value={f.profitUsd} signed /></Line>
                <Line
                  tone="bad"
                  label={
                    <span className="flex flex-wrap items-center gap-x-2">
                      {L({ ku: "مەسارف", en: "Expenses", ar: "المصاريف", zh: "费用" })}
                      <Link href="/company/expenses" className="text-xs text-primary underline">{L({ ku: "بیانبینە", en: "See them", ar: "اعرض", zh: "查看" })}</Link>
                    </span>
                  }
                >
                  <Money value={-f.expensesUsd} />
                </Line>
                {f.withdrawals.length === 0 ? (
                  <Line tone="quiet" label={L({ ku: "بردنی شەریکەکان", en: "Partners' withdrawals", ar: "سحوبات الشركاء", zh: "合伙人提款" })}><Money value={0} /></Line>
                ) : (
                  f.withdrawals.map((w) => (
                    <Line key={w.name} tone="bad" label={L({ ku: `بردنی ${w.name}`, en: `${w.name} took out`, ar: `سحب ${w.name}`, zh: `${w.name} 提款` })}>
                      <Money value={-w.usd} />
                    </Line>
                  ))
                )}
                <div className="flex items-center justify-between gap-3 border-t pt-2 font-semibold">
                  <span>{L({ ku: "دەبێت هەبێت", en: "Should hold", ar: "يجب أن يكون", zh: "应有" })}</span>
                  <Money value={data.shouldHoldUsd} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{L({ ku: "پشکنین (ئارەزوومەندانە)", en: "Check (optional)", ar: "فحص (اختياري)", zh: "核对（可选）" })}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-muted-foreground">
                  {L({
                    ku: "هەر کاتێک ویستت بزانیت حیسابەکە ڕاستە: بنووسە ئێستا چەندت هەیە و چەند قەرزاریت. ئەم ژمارانە تەنها بەراورد دەکرێن و ناچنە ناو هیچ کۆیەک.",
                    en: "Whenever you want to test the books: enter what you hold and what you owe right now. These are only compared, never added to a total.",
                    ar: "اكتب ما لديك وما عليك الآن. تُقارن فقط ولا تُضاف.",
                    zh: "输入现有与所欠金额，仅用于比较。",
                  })}
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-xs text-muted-foreground">{L({ ku: "ئێستا هەمە ($)", en: "I hold now ($)", ar: "لدي الآن ($)", zh: "现有 ($)" })}</span>
                    <Input dir="ltr" inputMode="decimal" value={have} onChange={(e) => { setHave(e.target.value); setFault(""); }} placeholder="494" />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-muted-foreground">{L({ ku: "ئێستا قەرزارم ($)", en: "I owe now ($)", ar: "علي الآن ($)", zh: "现欠 ($)" })}</span>
                    <Input dir="ltr" inputMode="decimal" value={owe} onChange={(e) => { setOwe(e.target.value); setFault(""); }} placeholder="374" />
                  </label>
                </div>
                {fault && <p className="text-sm text-red-700 dark:text-red-400">{fault}</p>}
                {preview && (
                  <div className="rounded-lg bg-muted/50 p-3">
                    <Line label={L({ ku: "سیستەم دەڵێت", en: "The books say", ar: "السجلات تقول", zh: "账面" })}><Money value={data.netCashUsd} /></Line>
                    <Line label={L({ ku: "تۆ ژماردت", en: "You counted", ar: "عددت", zh: "实点" })}><Money value={preview.countedNetUsd} /></Line>
                    <Line tone={Math.abs(preview.unwrittenUsd) >= WORKING_CAPITAL_ALERT_USD ? "bad" : undefined} label={preview.unwrittenUsd >= 0
                      ? L({ ku: "خەرج کراوە و نەنووسراوە", en: "Spent and not written", ar: "صُرف ولم يُسجَّل", zh: "已支出未记录" })
                      : L({ ku: "لە حیساب زیاترت هەیە", en: "More than the books say", ar: "أكثر من السجلات", zh: "多于账面" })}
                    >
                      <Money value={Math.abs(preview.unwrittenUsd)} />
                    </Line>
                  </div>
                )}
                <Button onClick={submitCheck} disabled={check.isPending}>
                  {L({ ku: "پشکنینەکە هەڵبگرە", en: "Save this check", ar: "احفظ الفحص", zh: "保存核对" })}
                </Button>
                {last && (
                  <div className={cn("rounded-lg border p-3", lastIsLoud ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200" : "text-muted-foreground")}>
                    {L({ ku: "دوا پشکنین", en: "Last check", ar: "آخر فحص", zh: "上次核对" })}{" "}
                    <bdi dir="ltr">{new Date(last.at).toLocaleDateString("en-GB")}</bdi>:{" "}
                    {L({ ku: "هەتبوو", en: "held", ar: "لديك", zh: "持有" })} <Money value={last.haveUsd} />،{" "}
                    {L({ ku: "قەرزار بوویت", en: "owed", ar: "عليك", zh: "欠" })} <Money value={last.oweUsd} />،{" "}
                    {last.unwrittenUsd >= 0
                      ? L({ ku: "نەنووسراو", en: "unwritten", ar: "غير مسجَّل", zh: "未记录" })
                      : L({ ku: "زیادە", en: "extra", ar: "زيادة", zh: "多出" })}{" "}
                    <Money value={Math.abs(last.unwrittenUsd)} />
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
