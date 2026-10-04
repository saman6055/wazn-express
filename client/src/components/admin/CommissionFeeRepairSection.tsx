import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, Loader2, Percent } from "lucide-react";
import { toast } from "sonner";
import { pickLang } from "@/lib/lang";
import { fmtUsd } from "@/lib/portalFormat";
import { confirmAction } from "@/components/ConfirmDialog";

type Words = { ku: string; en: string; ar: string; zh: string };

/**
 * Commission orders whose fee was written for the whole order (May–July 2026)
 * while everything reads it per unit (db/commissionFeeRepair). Each row is
 * proved against the customer's own charge. Fixing stores the fee per unit;
 * no account moves. Main admin only.
 */
export function CommissionFeeRepairSection({ language }: { language: string }) {
  const say = (w: Words) => pickLang(language, w);
  const scan = trpc.ledger.commissionFeeAsTotal.useQuery(undefined, { enabled: false, retry: false });
  const fix = trpc.ledger.fixCommissionFeeAsTotal.useMutation();
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const rows = useMemo(() => scan.data ?? [], [scan.data]);
  const pickedRemoved = rows.filter((r) => picked.has(r.orderId)).reduce((s, r) => s + (r.profitShownUsd - r.profitRealUsd), 0);

  const run = async () => {
    const ok = await confirmAction({
      title: say({ ku: "عمولە بۆ یەک دانە ڕاست بکرێتەوە؟", en: "Store these fees per unit?", ar: "تخزين العمولة للوحدة؟", zh: "按单件保存佣金？" }),
      message: say({
        ku: `${picked.size} ئۆردەر — قازانجی درۆی ${fmtUsd(pickedRemoved)} لە ڕاپۆرتەکان لادەچێت. هیچ پارەیەک لە حیسابی کڕیار ناگۆڕێت.`,
        en: `${picked.size} orders — ${fmtUsd(pickedRemoved)} of profit that never existed leaves the reports. No account moves.`,
        ar: `${picked.size} طلبات — يُزال ${fmtUsd(pickedRemoved)} من الربح الوهمي. لا يتغير أي حساب.`,
        zh: `${picked.size} 个订单 — 报表中移除 ${fmtUsd(pickedRemoved)} 虚假利润。账户不变。`,
      }),
      confirmLabel: say({ ku: "بەڵێ، ڕاستی بکەرەوە", en: "Yes, fix", ar: "نعم", zh: "是" }),
    });
    if (!ok) return;
    try {
      const res = await fix.mutateAsync({ orderIds: Array.from(picked) });
      toast.success(say({
        ku: `${res.fixed} ئۆردەر ڕاست کرایەوە — ${fmtUsd(res.profitRemovedUsd)} قازانجی درۆ لابرا`,
        en: `${res.fixed} orders fixed — ${fmtUsd(res.profitRemovedUsd)} of false profit removed`,
        ar: `أُصلح ${res.fixed} طلبًا`,
        zh: `已修复 ${res.fixed} 个订单`,
      }));
      setPicked(new Set());
      void scan.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Percent className="h-5 w-5 text-purple-600 dark:text-purple-300" />
          {say({ ku: "عمولەی کۆی ئۆردەر وەک عمولەی یەک دانە", en: "Commission written for the whole order", ar: "عمولة الطلب كله كعمولة وحدة", zh: "整单佣金误作单件" })}
        </CardTitle>
        <CardDescription>
          {say({
            ku: "مایس–تەمموز: عمولەی هەندێک ئۆردەری چەند دانەیی بۆ هەموو ئۆردەرەکە نووسرابوو، بەڵام ڕاپۆرتەکان بە ژمارەی دانە لێکیان دەدا (نموونە: 100 دانە، عمولە $19 → قازانجی $1,900 پیشان دەدرا). پارەی کڕیار ڕاستە؛ تەنها عمولەکە بۆ یەک دانە دەگۆڕدرێت.",
            en: "May–July: some multi-unit orders had the fee for the whole order, but reports multiplied it by the quantity (100 units, fee $19 → $1,900 profit shown). The customer's charge is right; only the fee is stored per unit.",
            ar: "مايو–يوليو: بعض الطلبات سُجلت عمولتها للطلب كله.",
            zh: "5–7月：部分多件订单的佣金按整单记录。",
          })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={() => void scan.refetch()} disabled={scan.isFetching}>
            {scan.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : say({ ku: "بیپشکنە", en: "Check", ar: "افحص", zh: "检查" })}
          </Button>
          {rows.length > 0 && (
            <>
              <Button type="button" variant="ghost" onClick={() => setPicked(new Set(rows.map((r) => r.orderId)))}>
                {say({ ku: "هەمووی هەڵبژێرە", en: "Select all", ar: "اختر الكل", zh: "全选" })}
              </Button>
              <Button type="button" onClick={run} disabled={picked.size === 0 || fix.isPending}>
                {say({ ku: `ڕاستکردنەوە (${picked.size})`, en: `Fix (${picked.size})`, ar: `إصلاح (${picked.size})`, zh: `修复 (${picked.size})` })}
              </Button>
            </>
          )}
        </div>
        {scan.isSuccess && rows.length === 0 && (
          <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4" />
            {say({ ku: "هیچ ئۆردەرێک نەماوە", en: "Nothing left", ar: "لا شيء", zh: "没有了" })}
          </p>
        )}
        {rows.length > 0 && (
          <Table mobileCards>
            <TableHeader>
              <TableRow>
                <TableHead />
                <TableHead>{say({ ku: "ئۆردەر", en: "Order", ar: "الطلب", zh: "订单" })}</TableHead>
                <TableHead>{say({ ku: "دانە", en: "Qty", ar: "الكمية", zh: "数量" })}</TableHead>
                <TableHead>{say({ ku: "عمولە ← بۆ یەک دانە", en: "Fee → per unit", ar: "العمولة ← للوحدة", zh: "佣金 → 单件" })}</TableHead>
                <TableHead>{say({ ku: "قازانج: ئێستا ← ڕاست", en: "Profit: shown → real", ar: "الربح", zh: "利润" })}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.orderId}>
                  <TableCell>
                    <Checkbox
                      checked={picked.has(r.orderId)}
                      onCheckedChange={(v) => setPicked((s) => { const n = new Set(s); if (v === true) n.add(r.orderId); else n.delete(r.orderId); return n; })}
                    />
                  </TableCell>
                  <TableCell><bdi dir="ltr">{r.orderCode}</bdi> · {r.customerCode}</TableCell>
                  <TableCell className="tabular-nums">{r.quantity}</TableCell>
                  <TableCell className="tabular-nums" dir="ltr">{fmtUsd(r.feeUsd)} → ${r.feePerUnitUsd}</TableCell>
                  <TableCell className="tabular-nums" dir="ltr">{fmtUsd(r.profitShownUsd)} → <b>{fmtUsd(r.profitRealUsd)}</b></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
