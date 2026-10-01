import { useMemo, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, Loader2, Receipt } from "lucide-react";
import { toast } from "sonner";
import { pickLang } from "@/lib/lang";
import { fmtUsd } from "@/lib/portalFormat";
import { CopyButton } from "@/components/CopyButton";
import { confirmAction } from "@/components/ConfirmDialog";

type Words = { ku: string; en: string; ar: string; zh: string };

/**
 * The credit that 10 September 2026 created, and the button that removes it.
 *
 * That day 445 old boxes were closed with receipts, for cash taken long
 * before. Many of those debts were no longer on the accounts, so the
 * receipts left 76 customers in credit — $13,039.86 nobody had paid twice
 * (shared/bulkReceiptCredit has the whole story).
 *
 * The list first, then the button: each row says what the account shows
 * now, the correction, and what it will show after. Nothing moves until an
 * admin ticks rows and confirms; the server recomputes every amount and
 * skips an account already corrected.
 */
export function BulkReceiptCreditSection({ language }: { language: string }) {
  const say = (w: Words) => pickLang(language, w);
  const utils = trpc.useUtils();
  const scan = trpc.ledger.bulkReceiptCredits.useQuery(undefined, { enabled: false, retry: false });
  const [picked, setPicked] = useState<Set<number>>(new Set());

  const rows = useMemo(() => scan.data?.rows ?? [], [scan.data]);
  const pickedTotal = useMemo(
    () => rows.filter((r) => picked.has(r.customerId)).reduce((sum, r) => sum + r.phantomUsd, 0),
    [rows, picked],
  );
  const allPicked = rows.length > 0 && picked.size === rows.length;

  const correct = trpc.ledger.correctBulkReceiptCredits.useMutation({
    onSuccess: (result) => {
      setPicked(new Set());
      void scan.refetch();
      void utils.ledger.invalidate();
      toast.success(
        `${say({ ku: "ڕاست کرانەوە", en: "Corrected", ar: "تم التصحيح", zh: "已更正" })}: ${result.corrected} · ${fmtUsd(result.amountUsd)}`,
        { duration: 15000 },
      );
      if (result.skipped.length > 0) {
        toast.warning(
          `${say({ ku: "پەڕێنران", en: "Skipped", ar: "تم التخطي", zh: "已跳过" })}: ${result.skipped.length} — ${result.skipped[0].reason}`,
          { duration: 20000 },
        );
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

  const apply = async () => {
    const yes = await confirmAction({
      title: say({ ku: "ڕاستکردنەوەی کریدیتی 10/09", en: "Correct the 10 September credit", ar: "تصحيح رصيد 10/09", zh: "更正 9 月 10 日的贷方余额" }),
      message: say({
        ku: `${picked.size} حیساب ڕاست دەکرێنەوە، بە کۆی ${fmtUsd(pickedTotal)}. بۆ هەر یەکێک ڕیزێکی نوێ بە هۆکارەوە لە دەفتەری حیسابدا دەنووسرێت؛ هیچ ڕیزێکی کۆن ناسڕدرێتەوە.`,
        en: `${picked.size} accounts will be corrected, ${fmtUsd(pickedTotal)} in all. Each gets one new ledger row with its reason; no existing row is removed.`,
        ar: `سيُصحَّح ${picked.size} حساباً بمجموع ${fmtUsd(pickedTotal)}. يُضاف لكل حساب قيد جديد بسببه؛ لا يُحذف أي قيد سابق.`,
        zh: `将更正 ${picked.size} 个账户，共 ${fmtUsd(pickedTotal)}。每个账户新增一条带原因的流水；不删除任何已有记录。`,
      }),
      confirmLabel: say({ ku: "بەڵێ، ڕاستیان بکەرەوە", en: "Yes, correct them", ar: "نعم، صحّحها", zh: "是，更正" }),
    });
    if (yes) correct.mutate({ customerIds: Array.from(picked) });
  };

  return (
    <Card data-testid="bulk-receipt-credit">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          {say({ ku: "کریدیتی وەسڵی بۆکسە کۆنەکان (10/09)", en: "Credit from the old-box receipts (10 Sep)", ar: "رصيد إيصالات الصناديق القديمة (10/09)", zh: "旧箱收据产生的贷方余额（9 月 10 日）" })}
        </CardTitle>
        <CardDescription>
          {say({
            ku: "ڕۆژی 10/09 بۆکسە کۆنەکان بە وەسڵ داخران، بۆ پارەیەک کە پێشتر بە کاش وەرگیرابوو. زۆربەی ئەو قەرزانە ئیتر لەسەر حیساب نەبوون، بۆیە وەسڵەکان کریدیتی وەهمییان دروست کرد. لێرە لیستەکە دەبینیت، و تا خۆت دوگمەکە دانەگریت هیچ ناگۆڕێت.",
            en: "On 10 September the old boxes were closed with receipts, for cash taken long before. Most of those debts were no longer on the accounts, so the receipts created credit nobody paid for. The list is shown first; nothing changes until you press the button.",
            ar: "في 10/09 أُغلقت الصناديق القديمة بإيصالات عن نقد استُلم سابقاً. معظم تلك الديون لم تعد على الحسابات، فأنشأت الإيصالات رصيداً وهمياً. تُعرض القائمة أولاً ولا يتغير شيء حتى تضغط الزر.",
            zh: "9 月 10 日用收据关闭了旧箱，对应的是早已收取的现金。这些欠款大多已不在账上，于是收据产生了无人支付的贷方余额。先显示清单；在您按下按钮之前不会有任何更改。",
          })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button variant="outline" onClick={() => void scan.refetch()} disabled={scan.isFetching} data-testid="bulk-credit-scan">
          {scan.isFetching && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
          {say({ ku: "لیستەکە نیشان بدە", en: "Show the list", ar: "اعرض القائمة", zh: "显示清单" })}
        </Button>

        {scan.error && <p className="text-sm text-red-600 dark:text-red-400">{scan.error.message}</p>}

        {scan.data && rows.length === 0 && (
          <p className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            {say({ ku: "هیچ حیسابێک نەماوە بۆ ڕاستکردنەوە.", en: "No account is left to correct.", ar: "لم يبقَ حساب للتصحيح.", zh: "没有需要更正的账户。" })}
            {scan.data.alreadyFixed > 0 && <span>({scan.data.alreadyFixed} {say({ ku: "پێشتر ڕاست کراونەتەوە", en: "already corrected", ar: "صُحِّحت سابقاً", zh: "已更正" })})</span>}
          </p>
        )}

        {rows.length > 0 && (
          <>
            <p className="text-sm font-medium">
              {rows.length} {say({ ku: "حیساب", en: "accounts", ar: "حساباً", zh: "个账户" })}
              {" · "}
              <bdi dir="ltr" className="font-mono">{fmtUsd(scan.data?.totalUsd ?? 0)}</bdi>
              {(scan.data?.alreadyFixed ?? 0) > 0 && (
                <span className="ms-2 text-muted-foreground">
                  ({scan.data?.alreadyFixed} {say({ ku: "پێشتر ڕاست کراونەتەوە", en: "already corrected", ar: "صُحِّحت سابقاً", zh: "已更正" })})
                </span>
              )}
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
                    <TableHead className="text-end">{say({ ku: "حیسابی ئێستا", en: "Account now", ar: "الحساب الآن", zh: "当前账户" })}</TableHead>
                    <TableHead className="text-end">{say({ ku: "ڕاستکردنەوە", en: "Correction", ar: "التصحيح", zh: "更正额" })}</TableHead>
                    <TableHead className="text-end">{say({ ku: "دوای ڕاستکردنەوە", en: "After", ar: "بعد التصحيح", zh: "更正后" })}</TableHead>
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
                          <Link href={`/finance/customer/${r.customerId}`} className="font-mono text-primary hover:underline">
                            <bdi dir="ltr">{r.customerCode}</bdi>
                          </Link>
                          <CopyButton value={r.customerCode} />
                        </span>
                      </TableCell>
                      <TableCell className="text-end font-mono"><Money usd={r.balanceUsd} say={say} /></TableCell>
                      <TableCell className="text-end font-mono font-semibold"><bdi dir="ltr">+{fmtUsd(r.phantomUsd)}</bdi></TableCell>
                      <TableCell className="text-end font-mono"><Money usd={r.correctedUsd} say={say} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={() => void apply()} disabled={picked.size === 0 || correct.isPending} data-testid="bulk-credit-apply">
                {correct.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                {say({ ku: "ڕاستیان بکەرەوە", en: "Correct them", ar: "صحّحها", zh: "更正" })}
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

/** A balance said in words: owes, in credit, or square — never a bare sign. */
function Money({ usd, say }: { usd: number; say: (w: Words) => string }) {
  if (usd > 0.005) {
    return <span className="text-red-600 dark:text-red-400"><bdi dir="ltr">{fmtUsd(usd)}</bdi> {say({ ku: "قەرز", en: "owed", ar: "دين", zh: "欠款" })}</span>;
  }
  if (usd < -0.005) {
    return <span className="text-sky-600 dark:text-sky-400"><bdi dir="ltr">{fmtUsd(-usd)}</bdi> {say({ ku: "کریدیت", en: "credit", ar: "رصيد", zh: "贷方" })}</span>;
  }
  return <span className="text-emerald-600 dark:text-emerald-400">{say({ ku: "سفر", en: "zero", ar: "صفر", zh: "零" })}</span>;
}
