import { Link } from "wouter";
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
          </>
        )}
      </CardContent>
    </Card>
  );
}
