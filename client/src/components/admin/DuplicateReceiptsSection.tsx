import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { pickLang } from "@/lib/lang";
import { fmtUsd } from "@/lib/portalFormat";
import { confirmAction } from "@/components/ConfirmDialog";

type Words = { ku: string; en: string; ar: string; zh: string };

/**
 * The receipts 10 September wrote more than once (db/duplicateReceipts):
 * the same box, the same amount, again and again. Voiding one changes its
 * status only — the customer's account was corrected long ago and does not
 * move. Main admin only.
 */
export function DuplicateReceiptsSection({ language }: { language: string }) {
  const say = (w: Words) => pickLang(language, w);
  const scan = trpc.ledger.duplicateReceipts.useQuery(undefined, { enabled: false, retry: false });
  const voidIt = trpc.ledger.voidDuplicateReceipts.useMutation();
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const rows = useMemo(() => scan.data ?? [], [scan.data]);
  const pickedUsd = rows.filter((r) => picked.has(r.settlementId)).reduce((s, r) => s + r.paidUsd, 0);

  const run = async () => {
    const ok = await confirmAction({
      title: say({ ku: "وەسڵە دووبارەکان هەڵبوەشێنرێنەوە؟", en: "Void the duplicate receipts?", ar: "إلغاء الإيصالات المكررة؟", zh: "作废重复收据？" }),
      message: say({
        ku: `${picked.size} وەسڵ — ${fmtUsd(pickedUsd)} لە ڕاپۆرتی پارەی وەرگیراو لادەچێت. حیسابی هیچ کڕیارێک ناجووڵێت؛ پێشتر ڕاست کراوەتەوە.`,
        en: `${picked.size} receipts — ${fmtUsd(pickedUsd)} leaves the cash-received reports. No account moves; they were corrected already.`,
        ar: `${picked.size} إيصالات — يُزال ${fmtUsd(pickedUsd)} من تقارير النقد. لا يتغير أي حساب.`,
        zh: `${picked.size} 张收据 — 现金报表移除 ${fmtUsd(pickedUsd)}。账户不变。`,
      }),
      confirmLabel: say({ ku: "بەڵێ، هەڵیانبوەشێنەوە", en: "Yes, void them", ar: "نعم", zh: "是" }),
      danger: true,
    });
    if (!ok) return;
    try {
      const res = await voidIt.mutateAsync({ settlementIds: Array.from(picked) });
      toast.success(say({
        ku: `${res.voided} وەسڵی دووبارە هەڵوەشێنرایەوە — ${fmtUsd(res.amountUsd)}`,
        en: `${res.voided} duplicate receipts voided — ${fmtUsd(res.amountUsd)}`,
        ar: `أُلغي ${res.voided} إيصالًا`,
        zh: `已作废 ${res.voided} 张`,
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
          <Copy className="h-5 w-5 text-red-600 dark:text-red-400" />
          {say({ ku: "وەسڵی دووبارەی 10/09", en: "Duplicate receipts of 10 September", ar: "إيصالات مكررة 10/09", zh: "9月10日重复收据" })}
        </CardTitle>
        <CardDescription>
          {say({
            ku: "لە 10/09 هەندێک بۆکس چەند جار وەسڵ کران (BOX-20260705-004: 22 جار). جاری دووەم بەدواوە پارەیەک دەژمێرێت کە نەهاتووە. حیسابەکان پێشتر ڕاست کراونەتەوە؛ ئەمە تەنها ڕاپۆرتی پارەی وەرگیراو ڕاست دەکاتەوە.",
            en: "On 10 September some boxes were receipted many times (BOX-20260705-004: 22 times). Every receipt after the first counts money that never came in. The accounts were corrected already; this fixes the cash-received reports only.",
            ar: "في 10/09 أُصدرت إيصالات متكررة لبعض الصناديق.",
            zh: "9月10日部分箱子被多次开具收据。",
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
              <Button type="button" variant="ghost" onClick={() => setPicked(new Set(rows.map((r) => r.settlementId)))}>
                {say({ ku: "هەمووی هەڵبژێرە", en: "Select all", ar: "اختر الكل", zh: "全选" })}
              </Button>
              <Button type="button" onClick={run} disabled={picked.size === 0 || voidIt.isPending}>
                {say({ ku: `هەڵوەشاندنەوە (${picked.size})`, en: `Void (${picked.size})`, ar: `إلغاء (${picked.size})`, zh: `作废 (${picked.size})` })}
              </Button>
            </>
          )}
        </div>
        {scan.isSuccess && rows.length === 0 && (
          <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4" />
            {say({ ku: "هیچ وەسڵێکی دووبارە نەماوە", en: "No duplicates left", ar: "لا يوجد", zh: "没有了" })}
          </p>
        )}
        {rows.length > 0 && (
          <Table mobileCards>
            <TableHeader>
              <TableRow>
                <TableHead />
                <TableHead>{say({ ku: "وەسڵی دووبارە", en: "Duplicate", ar: "المكرر", zh: "重复" })}</TableHead>
                <TableHead>{say({ ku: "بۆکس · کڕیار", en: "Box · customer", ar: "الصندوق · العميل", zh: "箱 · 客户" })}</TableHead>
                <TableHead>{say({ ku: "وەسڵی ڕاست", en: "Kept", ar: "المحفوظ", zh: "保留" })}</TableHead>
                <TableHead className="text-end">{say({ ku: "بڕ", en: "Amount", ar: "المبلغ", zh: "金额" })}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.settlementId}>
                  <TableCell>
                    <Checkbox
                      checked={picked.has(r.settlementId)}
                      onCheckedChange={(v) => setPicked((s) => { const n = new Set(s); if (v === true) n.add(r.settlementId); else n.delete(r.settlementId); return n; })}
                    />
                  </TableCell>
                  <TableCell><bdi dir="ltr">{r.number}</bdi></TableCell>
                  <TableCell><bdi dir="ltr">{r.boxCode}</bdi> · {r.customerCode}</TableCell>
                  <TableCell><bdi dir="ltr">{r.keptNumber}</bdi></TableCell>
                  <TableCell className="text-end tabular-nums" dir="ltr">{fmtUsd(r.paidUsd)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
