import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { confirmAction } from "@/components/ConfirmDialog";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, Loader2, Wallet } from "lucide-react";
import { pickLang } from "@/lib/lang";
import { fmtUsd } from "@/lib/portalFormat";
import { CopyButton } from "@/components/CopyButton";

type Words = { ku: string; en: string; ar: string; zh: string };

/**
 * Customers the books say we owe money to.
 *
 * Owner, 2026-10-01: "no customer has credit — find the ones that do."
 * Nobody prepays here, so a credit is nearly always a debt cleared twice:
 * lowered by hand, then receipted at the box as well (AZ173). The till now
 * refuses that; this lists the ones from before.
 *
 * Read only, and it runs when asked. Putting an account right is done on the
 * customer's own page, by a person who has looked at it.
 */

const CAUSE: Record<string, Words> = {
  double_clearing: {
    ku: "بە دەست کەم کراوەتەوە و وەسڵی بۆکسیشی بۆ کراوە",
    en: "Lowered by hand and receipted at a box too",
    ar: "خُفِّض يدوياً وصدر له إيصال صندوق أيضاً",
    zh: "手工冲减后又在箱子上收过款",
  },
  hand_credit: { ku: "بە دەست کەم کراوەتەوە", en: "Lowered by hand", ar: "خُفِّض يدوياً", zh: "手工冲减" },
  discount: { ku: "داشکاندن", en: "Discounts", ar: "خصومات", zh: "折扣" },
  other: { ku: "هۆکار دیار نییە — کەشفی حیساب ببینە", en: "Unclear — open the statement", ar: "غير واضح — افتح كشف الحساب", zh: "原因不明——请查看对账单" },
};

export function CreditCustomersSection({ language }: { language: string }) {
  const say = (w: Words) => pickLang(language, w);
  const scan = trpc.ledger.customersInCredit.useQuery(undefined, { enabled: false, retry: false });
  const rows = scan.data ?? [];
  const total = rows.reduce((sum, r) => sum + r.creditUsd, 0);

  // The owner may say of a credit "that is not real" and remove it. The
  // server debits exactly what each account holds when it posts.
  const utils = trpc.useUtils();
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const pickedTotal = rows.filter((r) => picked.has(r.customerId)).reduce((sum, r) => sum + r.creditUsd, 0);
  const allPicked = rows.length > 0 && picked.size === rows.length;
  const zero = trpc.ledger.zeroCustomerCredits.useMutation({
    onSuccess: (result) => {
      setPicked(new Set());
      void scan.refetch();
      void utils.ledger.invalidate();
      toast.success(
        `${say({ ku: "سفر کرانەوە", en: "Zeroed", ar: "تم التصفير", zh: "已清零" })}: ${result.zeroed} · ${fmtUsd(result.amountUsd)}`,
        { duration: 15000 },
      );
      if (result.skipped.length > 0) {
        toast.warning(`${say({ ku: "پەڕێنران", en: "Skipped", ar: "تم التخطي", zh: "已跳过" })}: ${result.skipped.length} — ${result.skipped[0].reason}`, { duration: 20000 });
      }
    },
    onError: (err) => toast.error(err.message, { duration: 20000 }),
  });
  const toggle = (id: number) =>
    setPicked((old) => {
      const next = new Set(old);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const applyZero = async () => {
    const yes = await confirmAction({
      title: say({ ku: "سفرکردنەوەی کریدیت", en: "Remove the credit", ar: "تصفير الرصيد الدائن", zh: "清除贷方余额" }),
      message: say({
        ku: `کریدیتی ${picked.size} کڕیار سفر دەکرێتەوە، بە کۆی ${fmtUsd(pickedTotal)}. واتە دەڵێیت ئەم کڕیارانە هیچ پارەیەکی زیادەیان نەداوە. بۆ هەر یەکێک ڕیزێکی نوێ بە هۆکارەوە دەنووسرێت.`,
        en: `The credit of ${picked.size} customers will be removed, ${fmtUsd(pickedTotal)} in all — you are saying these customers paid nothing extra. Each gets one new ledger row with its reason.`,
        ar: `سيُصفَّر رصيد ${picked.size} عميلاً بمجموع ${fmtUsd(pickedTotal)} — أي أنك تؤكد أن هؤلاء لم يدفعوا شيئاً زائداً. يُضاف لكل منهم قيد جديد بسببه.`,
        zh: `将清除 ${picked.size} 位客户的贷方余额，共 ${fmtUsd(pickedTotal)}——即您确认这些客户没有多付款。每位客户新增一条带原因的流水。`,
      }),
      confirmLabel: say({ ku: "بەڵێ، سفریان بکەرەوە", en: "Yes, zero them", ar: "نعم، صفّرها", zh: "是，清零" }),
      danger: true,
    });
    if (yes) zero.mutate({ customerIds: Array.from(picked) });
  };

  return (
    <Card data-testid="credit-customers">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          {say({ ku: "کڕیارانی کریدیتدار", en: "Customers in credit", ar: "عملاء لهم رصيد دائن", zh: "有贷方余额的客户" })}
        </CardTitle>
        <CardDescription>
          {say({
            ku: "هەر کڕیارێک کە حیسابەکەی دەڵێت پارەی لای ئێمەیە. کەس پارەی پێشەکی نادات، بۆیە کریدیت زۆربەی جار قەرزێکە کە دوو جار کەم کراوەتەوە. تەنها دەیخوێنێتەوە — هیچ ناگۆڕێت.",
            en: "Every customer whose account says we hold their money. Nobody prepays, so a credit is usually a debt cleared twice. Read only — nothing changes.",
            ar: "كل عميل يقول حسابه إن له مالاً عندنا. لا أحد يدفع مقدماً، فالرصيد الدائن غالباً دين سُدِّد مرتين. للقراءة فقط — لا شيء يتغير.",
            zh: "账户显示我们欠其款项的每位客户。没有人预付，所以贷方余额通常是同一笔欠款被冲减了两次。只读——不做任何更改。",
          })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button variant="outline" onClick={() => void scan.refetch()} disabled={scan.isFetching} data-testid="credit-scan">
          {scan.isFetching && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
          {say({ ku: "بیاندۆزەوە", en: "Find them", ar: "ابحث عنهم", zh: "查找" })}
        </Button>

        {scan.error && <p className="text-sm text-red-600 dark:text-red-400">{scan.error.message}</p>}

        {scan.data && rows.length === 0 && (
          <p className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            {say({ ku: "هیچ کڕیارێک کریدیتی نییە.", en: "No customer is in credit.", ar: "لا يوجد عميل له رصيد دائن.", zh: "没有客户有贷方余额。" })}
          </p>
        )}

        {rows.length > 0 && (
          <>
            <p className="text-sm font-medium">
              {rows.length} {say({ ku: "کڕیار", en: "customers", ar: "عميل", zh: "位客户" })}
              {" · "}
              <bdi dir="ltr" className="font-mono">{fmtUsd(total)}</bdi>
            </p>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allPicked}
                        onCheckedChange={() => setPicked(allPicked ? new Set() : new Set(rows.map((r) => r.customerId)))}
                        aria-label={say({ ku: "هەموویان", en: "All", ar: "الكل", zh: "全选" })}
                      />
                    </TableHead>
                    <TableHead>{say({ ku: "کڕیار", en: "Customer", ar: "العميل", zh: "客户" })}</TableHead>
                    <TableHead className="text-end">{say({ ku: "کریدیت", en: "Credit", ar: "الرصيد الدائن", zh: "贷方余额" })}</TableHead>
                    <TableHead className="text-end">{say({ ku: "بە دەست کەمکراوە", en: "Lowered by hand", ar: "خُفِّض يدوياً", zh: "手工冲减" })}</TableHead>
                    <TableHead className="text-end">{say({ ku: "وەسڵی بۆکس", en: "Box receipts", ar: "إيصالات الصناديق", zh: "箱子收款" })}</TableHead>
                    <TableHead>{say({ ku: "هۆکاری نزیک", en: "Likely cause", ar: "السبب المرجّح", zh: "可能原因" })}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.customerId}>
                      <TableCell>
                        <Checkbox checked={picked.has(r.customerId)} onCheckedChange={() => toggle(r.customerId)} />
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1">
                          <Link href={`/customers/${r.customerId}`} className="font-mono text-primary hover:underline">
                            <bdi dir="ltr">{r.customerCode}</bdi>
                          </Link>
                          <CopyButton value={r.customerCode} />
                        </span>
                      </TableCell>
                      <TableCell className="text-end font-mono font-semibold"><bdi dir="ltr">{fmtUsd(r.creditUsd)}</bdi></TableCell>
                      <TableCell className="text-end font-mono"><bdi dir="ltr">{r.handCreditUsd > 0 ? fmtUsd(r.handCreditUsd) : "—"}</bdi></TableCell>
                      <TableCell className="text-end font-mono"><bdi dir="ltr">{r.boxReceiptsUsd > 0 ? fmtUsd(r.boxReceiptsUsd) : "—"}</bdi></TableCell>
                      <TableCell className="text-sm">{say(CAUSE[r.likelyCause] ?? CAUSE.other)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="destructive" onClick={() => void applyZero()} disabled={picked.size === 0 || zero.isPending} data-testid="credit-zero">
                {zero.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                {say({ ku: "کریدیتیان سفر بکەرەوە", en: "Zero their credit", ar: "صفّر أرصدتهم", zh: "清零其贷方余额" })}
              </Button>
              <span className="text-sm text-muted-foreground">
                {picked.size} · <bdi dir="ltr">{fmtUsd(pickedTotal)}</bdi>
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
