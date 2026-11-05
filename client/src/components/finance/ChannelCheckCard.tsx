import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GroupedNumberInput } from "@/components/expenses/GroupedNumberInput";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { fmtUsd } from "@/lib/portalFormat";
import type { ChannelCheck } from "@shared/channelCheck";

/**
 * Once a week: the two balances the FIB and Qi Card apps show, in dinars
 * (owner, 2026-11-05). What went out since the week before is worked out
 * (shared/channelCheck); nothing is typed spending by spending.
 */
export function ChannelCheckCard({ checks, rate }: { checks: ChannelCheck[]; rate: number }) {
  const { language } = useTranslation();
  const L = (w: { ku: string; en: string; ar: string; zh: string }) => pickLang(language, w);
  const utils = trpc.useUtils();
  const [fib, setFib] = useState("");
  const [qi, setQi] = useState("");
  const save = trpc.ledger.checkChannels.useMutation({
    onSuccess: () => { setFib(""); setQi(""); void utils.ledger.workingCapital.invalidate(); toast.success(L({ ku: "تۆمار کرا", en: "Recorded", ar: "تم التسجيل", zh: "已记录" })); },
    onError: (e) => toast.error(e.message),
  });
  const n = (s: string) => Number(String(s).replace(/[^\d.]/g, ""));
  const ready = fib.trim() !== "" && qi.trim() !== "" && Number.isFinite(n(fib)) && Number.isFinite(n(qi));
  const out = (v: number | null) => (v === null ? "—" : fmtUsd(v));

  return (
    <Card data-testid="channel-check">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{L({ ku: "پشکنینی هەفتانەی FIB و Qi Card", en: "Weekly FIB and Qi Card check", ar: "فحص أسبوعي لـ FIB و Qi Card", zh: "FIB 与 Qi 卡每周核对" })}</CardTitle>
        <p className="text-xs text-muted-foreground">
          {L({
            ku: `باڵانسی ئەپەکان بە دینار بنووسە. بە نرخی دوایین وەسڵی بۆکس (${rate ? rate.toLocaleString("en-US") : "—"}) دەکرێت بە دۆلار، و ئەوەی لە هەفتەی پێشووەوە دەرچووە خۆی دەژمێردرێت.`,
            en: `Type the app balances in dinars. Converted at the last box receipt's rate (${rate || "—"}); what went out since last week is worked out.`,
            ar: `اكتب رصيد التطبيقين بالدينار. يُحوَّل بسعر آخر إيصال صندوق (${rate || "—"})، ويُحسب ما خرج منذ الأسبوع الماضي.`,
            zh: `以第纳尔输入应用余额。按最近一张箱收据汇率（${rate || "—"}）折算，自动算出上周以来的支出。`,
          })}
        </p>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">{L({ ku: "باڵانسی FIB (دینار)", en: "FIB balance (IQD)", ar: "رصيد FIB (دينار)", zh: "FIB 余额（第纳尔）" })}</span>
            <GroupedNumberInput value={fib} onValueChange={setFib} className="h-9" data-testid="channel-fib" />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">{L({ ku: "باڵانسی Qi Card (دینار)", en: "Qi Card balance (IQD)", ar: "رصيد Qi Card (دينار)", zh: "Qi 卡余额（第纳尔）" })}</span>
            <GroupedNumberInput value={qi} onValueChange={setQi} className="h-9" data-testid="channel-qi" />
          </label>
          <Button type="button" disabled={!ready || save.isPending} onClick={() => save.mutate({ fibIqd: n(fib), qiIqd: n(qi) })} data-testid="channel-save">
            {L({ ku: "تۆمارکردن", en: "Record", ar: "تسجيل", zh: "记录" })}
          </Button>
        </div>

        {checks.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs tabular-nums">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="py-1 text-start font-normal">{L({ ku: "ڕۆژ", en: "Date", ar: "التاريخ", zh: "日期" })}</th>
                  <th className="py-1 text-start font-normal">FIB</th>
                  <th className="py-1 text-start font-normal">{L({ ku: "هاتوو / دەرچوو", en: "In / out", ar: "داخل / خارج", zh: "入 / 出" })}</th>
                  <th className="py-1 text-start font-normal">Qi Card</th>
                  <th className="py-1 text-start font-normal">{L({ ku: "هاتوو / دەرچوو", en: "In / out", ar: "داخل / خارج", zh: "入 / 出" })}</th>
                </tr>
              </thead>
              <tbody>
                {checks.slice(0, 8).map((c) => (
                  <tr key={c.at} className="border-t">
                    <td className="py-1"><bdi dir="ltr">{new Date(c.at).toLocaleDateString("en-GB")}</bdi></td>
                    <td className="py-1 font-mono"><bdi dir="ltr">{fmtUsd(c.fibUsd)}</bdi></td>
                    <td className="py-1 font-mono"><bdi dir="ltr">{out(c.fibInUsd)} / <span className="text-red-700 dark:text-red-400">{out(c.fibOutUsd)}</span></bdi></td>
                    <td className="py-1 font-mono"><bdi dir="ltr">{fmtUsd(c.qiUsd)}</bdi></td>
                    <td className="py-1 font-mono"><bdi dir="ltr">{out(c.qiInUsd)} / <span className="text-red-700 dark:text-red-400">{out(c.qiOutUsd)}</span></bdi></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
