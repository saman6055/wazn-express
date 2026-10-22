/**
 * The yuan rate's history (owner, 2026-10-22): every RMB rate set in Settings,
 * from when to when, who set it, and the orders entered at it - how many, their
 * dollars and their yuan. Type the yuan's real buying rate for a period to see
 * what it earned or lost on the rate. Read-only (shared/yuanRateHistory).
 */
import { useState } from "react";
import { Link } from "wouter";
import { TrendingUp } from "lucide-react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";
import { fmtUsd } from "@/lib/portalFormat";
import { fmtWhen } from "@/lib/numericDate";
import { rateGainUsd } from "@shared/yuanRateHistory";

const fmtYuan = (n: number) => `${n.toLocaleString("en-US", { maximumFractionDigits: 0 })} ¥`;

export default function YuanRateHistory() {
  const { language } = useTranslation();
  const L = (w: { ku: string; en: string; ar: string; zh: string }) => pickLang(language, w);
  const { data, isLoading } = trpc.ledger.yuanRateHistory.useQuery();
  const periods = data ?? [];
  const [real, setReal] = useState<Record<string, string>>({});

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl space-y-4 p-3 sm:p-6" data-testid="yuan-rate-history-page">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold"><TrendingUp className="h-5 w-5" />{L({ ku: "مێژووی نرخی یوان", en: "Yuan rate history", ar: "سجل سعر اليوان", zh: "人民币汇率历史" })}</h1>
          <p className="text-sm text-muted-foreground">
            {L({
              ku: "هەر نرخێک لە ڕێکخستنەکان دانرا، لە کەیەوە تا کەی، کێ دایناوە، و ئەو داواکارییانەی بەو نرخە تۆمارکران. هیچ نرخێکی کۆن ناگۆڕدرێت.",
              en: "Every rate set in Settings, from when to when, who set it, and the orders entered at it. No old price is ever changed.",
              ar: "كل سعر حُدّد في الإعدادات، من متى إلى متى، ومن حدّده، والطلبات المسجلة به. لا يتغيّر أي سعر قديم.",
              zh: "设置中设定的每个汇率、起止时间、设定人，以及按该汇率录入的订单。旧价格从不更改。",
            })}
          </p>
          <Link href="/settings" className="text-xs text-primary underline">{L({ ku: "گۆڕینی نرخ لە ڕێکخستنەکان", en: "Change the rate in Settings", ar: "تغيير السعر في الإعدادات", zh: "在设置中修改汇率" })}</Link>
        </div>

        {isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : periods.length === 0 ? (
          <Card><CardContent className="py-6 text-sm text-muted-foreground">{L({ ku: "هێشتا هیچ نرخێکی یوان دانەنراوە.", en: "No yuan rate has been set yet.", ar: "لم يُحدَّد سعر لليوان بعد.", zh: "尚未设定人民币汇率。" })}</CardContent></Card>
        ) : (
          <div className="space-y-3">
            {periods.map((p, i) => {
              const key = String(p.rateId ?? "before");
              const realRate = parseFloat(real[key] ?? "");
              const gain = rateGainUsd(p, realRate);
              return (
                <Card key={key} className={cn(i === 0 && p.to === null && "border-primary")}>
                  <CardContent className="space-y-2 p-3 text-sm">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-lg font-semibold">
                        {p.rateId === null
                          ? L({ ku: "پێش یەکەم نرخ", en: "Before the first rate", ar: "قبل أول سعر", zh: "首个汇率之前" })
                          : <bdi dir="ltr">1 $ = {p.rate.toLocaleString("en-US", { maximumFractionDigits: 4 })} ¥</bdi>}
                        {i === 0 && p.to === null ? <span className="ms-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{L({ ku: "ئێستا", en: "Now", ar: "الآن", zh: "当前" })}</span> : null}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        <bdi dir="ltr">{p.from ? fmtWhen(p.from, true) : "…"}</bdi>
                        {" ← "}
                        <bdi dir="ltr">{p.to ? fmtWhen(p.to, true) : L({ ku: "ئێستا", en: "now", ar: "الآن", zh: "现在" })}</bdi>
                        {p.setBy ? <> · {p.setBy}</> : null}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-lg bg-muted/50 p-2">
                        <div className="text-xs text-muted-foreground">{L({ ku: "داواکاری", en: "Orders", ar: "الطلبات", zh: "订单" })}</div>
                        <div className="font-semibold">{p.orders}</div>
                      </div>
                      <div className="rounded-lg bg-muted/50 p-2">
                        <div className="text-xs text-muted-foreground">{L({ ku: "دۆلار", en: "Dollars", ar: "دولار", zh: "美元" })}</div>
                        <div className="font-semibold"><bdi dir="ltr">{fmtUsd(p.usd)}</bdi></div>
                      </div>
                      <div className="rounded-lg bg-muted/50 p-2">
                        <div className="text-xs text-muted-foreground">{L({ ku: "یوان", en: "Yuan", ar: "يوان", zh: "人民币" })}</div>
                        <div className="font-semibold"><bdi dir="ltr">{fmtYuan(p.yuan)}</bdi></div>
                      </div>
                    </div>
                    {p.estimatedOrders > 0 ? (
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        {L({
                          ku: `یوانی ${p.estimatedOrders} داواکاری بە خەمڵاندنە (پێش ئەوەی سیستەم یوان هەڵبگرێت، بە نرخی ئەو ماوەیە حسابکراوە).`,
                          en: `The yuan of ${p.estimatedOrders} orders is estimated (entered before the system kept the yuan; counted at this period's rate).`,
                          ar: `يوان ${p.estimatedOrders} طلباً تقديري (سُجّلت قبل أن يحفظ النظام اليوان؛ حُسب بسعر هذه الفترة).`,
                          zh: `${p.estimatedOrders} 个订单的人民币为估算（系统保存人民币之前录入，按本期汇率计算）。`,
                        })}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="text-xs text-muted-foreground" htmlFor={`real-${key}`}>
                        {L({ ku: "نرخی ڕاستەقینەی کڕینی یوان (ئارەزوومەندانە):", en: "Real yuan buying rate (optional):", ar: "سعر الشراء الحقيقي لليوان (اختياري):", zh: "实际购汇汇率（可选）：" })}
                      </label>
                      <Input
                        id={`real-${key}`}
                        type="number"
                        step="0.01"
                        inputMode="decimal"
                        className="h-8 w-24"
                        value={real[key] ?? ""}
                        onChange={(e) => setReal((r) => ({ ...r, [key]: e.target.value }))}
                      />
                      {gain !== null ? (
                        <span className={cn("text-sm font-semibold", gain < 0 ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400")}>
                          {gain < 0 ? L({ ku: "زیان", en: "Loss", ar: "خسارة", zh: "亏损" }) : L({ ku: "قازانج", en: "Gain", ar: "ربح", zh: "收益" })}{" "}
                          <bdi dir="ltr">{fmtUsd(Math.abs(gain))}</bdi>
                        </span>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
