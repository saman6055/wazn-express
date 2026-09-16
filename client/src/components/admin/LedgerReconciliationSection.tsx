import { useState, type ReactNode } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Check, CheckCircle2, Copy, Loader2, Scale } from "lucide-react";
import { toast } from "sonner";
import { pickLang } from "@/lib/lang";
import { fmtUsd } from "@/lib/portalFormat";
import { copyText } from "@/lib/copyText";
import { cn } from "@/lib/utils";
import { buildErrorReport, getErrorBoundaryStrings } from "@/components/ErrorBoundary";
import { reconciliationText } from "@shared/ledgerReconciliation";

type Words = { ku: string; en: string; ar: string; zh: string };

/**
 * Every customer's account checked at once (owner's ledger audit, 2026-09-16).
 *
 * Read only, and only when asked: the check reads the whole ledger, so it
 * runs when somebody presses the button, not when the tab opens. Nothing on
 * any account moves because of it. Each finding says what is wrong, for whom
 * and by how much; putting it right is a separate decision.
 */
export function LedgerReconciliationSection({ language }: { language: string }) {
  const say = (w: Words) => pickLang(language, w);
  const report = trpc.ledger.reconciliationReport.useQuery(undefined, { enabled: false, retry: false });
  const [copied, setCopied] = useState(false);
  const data = report.data;

  const copyReport = () => {
    if (!data) return;
    void copyText(reconciliationText(data), say({ ku: "ڕاپۆرت", en: "Report", ar: "التقرير", zh: "报告" })).then((ok) => {
      if (!ok) return;
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const copyError = () => {
    if (!report.error) return;
    const error = Object.assign(new Error(report.error.message), { data: report.error.data });
    void copyText(buildErrorReport(error), getErrorBoundaryStrings().copyDetails).then((ok) => {
      if (ok) toast.success(getErrorBoundaryStrings().copied);
    });
  };

  const t = data?.totals;
  const findings: Array<{ key: string; label: Words; count: number; usd: number | null }> = t
    ? [
        { key: "drift", label: { ku: "باڵانسی جیاواز لە مامەڵەکان", en: "Balance differs from its rows", ar: "رصيد يختلف عن حركاته", zh: "余额与交易不符" }, count: t.driftAccounts, usd: t.driftUsd },
        { key: "cartons", label: { ku: "کارتۆنی ئۆردەر دوو جار حیسابکراو", en: "Order cartons charged twice", ar: "كراتين طلبات محسوبة مرتين", zh: "订单箱重复计费" }, count: t.doubleChargedCartons, usd: t.overchargeUsd },
        { key: "stillCounted", label: { ku: "وەسڵی هەڵوەشاوە هێشتا بە پارەدراو دەژمێردرێت", en: "Reversed receipts still counted as paid", ar: "إيصالات ملغاة ما زالت تُحسب مدفوعة", zh: "已撤销收据仍计为已付" }, count: t.stillCountedReceipts, usd: t.stillCountedUsd },
        { key: "doubleReversed", label: { ku: "پارەدان دوو جار گەڕاوەتەوە", en: "Payments put back twice", ar: "دفعات أعيدت مرتين", zh: "付款被退回两次" }, count: t.doubleReversedReceipts, usd: t.doubleReversedUsd },
        { key: "freight", label: { ku: "کرێی گواستنەوە بە ژمارەی ئۆردەر، تێکەڵ بە پارسێلی کڕیارێکی تر", en: "Freight rows tangled with another customer's parcel", ar: "أجور شحن متشابكة مع طرد عميل آخر", zh: "运费记录与其他客户包裹混淆" }, count: t.freightCollisions, usd: null },
        { key: "notOnAccount", label: { ku: "پارسێلی ناو بۆکس کە هێشتا نەچووەتە سەر حیساب", en: "Boxed parcels not on the account yet", ar: "طرود في صناديق لم تُسجَّل على الحساب", zh: "箱内包裹尚未入账" }, count: t.notOnAccountParcels, usd: t.notOnAccountUsd },
        { key: "price", label: { ku: "نرخی بۆکس جیاوازە لە نرخی حیساب", en: "Box price differs from the account's charge", ar: "سعر الصندوق يختلف عن قيد الحساب", zh: "箱内价格与账户计费不同" }, count: t.priceMismatches, usd: null },
      ]
    : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Scale className="h-5 w-5" />
          {say({ ku: "پشکنینی هاوسەنگی حیسابەکان", en: "Ledger reconciliation", ar: "مطابقة الحسابات", zh: "账户对账" })}
        </CardTitle>
        <CardDescription>
          {say({
            ku: "حیسابی هەموو کڕیارەکان یەکجار دەپشکنێت: کێ حیسابی هەڵەیە، بۆچی و بە چەند. تەنها دەخوێنێتەوە — هیچ شتێک لە هیچ حیسابێک ناگۆڕێت.",
            en: "Checks every customer's account at once: whose is wrong, why, and by how much. It only reads — nothing on any account changes.",
            ar: "يفحص حسابات جميع العملاء دفعة واحدة: أيها خاطئ ولماذا وبكم. للقراءة فقط — لا يتغير شيء في أي حساب.",
            zh: "一次检查所有客户账户：哪个有误、原因及金额。仅读取——不会更改任何账户。",
          })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => report.refetch()} disabled={report.isFetching} className="gap-2">
            {report.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scale className="h-4 w-4" />}
            {data
              ? say({ ku: "دووبارە بپشکنە", en: "Check again", ar: "افحص مجدداً", zh: "重新检查" })
              : say({ ku: "پشکنین", en: "Run the check", ar: "ابدأ الفحص", zh: "开始检查" })}
          </Button>
          {data && (
            <Button variant="outline" onClick={copyReport} className="gap-2">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {say({ ku: "کۆپیکردنی ڕاپۆرت", en: "Copy the report", ar: "نسخ التقرير", zh: "复制报告" })}
            </Button>
          )}
          {data && (
            <span className="text-xs text-muted-foreground tabular-nums" dir="ltr">
              {data.generatedAt} · {data.accountsChecked} {say({ ku: "حیساب", en: "accounts", ar: "حساب", zh: "个账户" })}
            </span>
          )}
        </div>

        {report.error && (
          <div className="flex flex-wrap items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-300" role="alert">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1 break-words">{report.error.message}</span>
            <Button size="sm" variant="outline" onClick={copyError} className="gap-1">
              <Copy className="h-3.5 w-3.5" />
              {getErrorBoundaryStrings().copyDetails}
            </Button>
          </div>
        )}

        {data && (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {findings.map((f) => (
              <div
                key={f.key}
                className={cn(
                  "rounded-lg border p-3",
                  f.count > 0
                    ? "border-red-200 bg-red-50 dark:border-red-800/60 dark:bg-red-950/30"
                    : "border-emerald-200 bg-emerald-50 dark:border-emerald-800/60 dark:bg-emerald-950/30",
                )}
              >
                <p className="text-xs text-muted-foreground">{say(f.label)}</p>
                <p
                  className={cn(
                    "mt-1 flex items-center gap-1.5 text-lg font-bold tabular-nums",
                    f.count > 0 ? "text-red-700 dark:text-red-300" : "text-emerald-700 dark:text-emerald-300",
                  )}
                  dir="ltr"
                >
                  {f.count === 0 && <CheckCircle2 className="h-4 w-4" />}
                  {f.count}
                  {f.usd !== null && f.count > 0 && <span className="text-sm font-semibold">· {fmtUsd(f.usd)}</span>}
                </p>
              </div>
            ))}
          </div>
        )}

        {data && data.drift.length > 0 && (
          <Finding title={say(findings[0].label)}>
            <Head cols={[say(CUSTOMER), say({ ku: "باڵانسی تۆمارکراو", en: "Stored balance", ar: "الرصيد المسجل", zh: "记录余额" }), say({ ku: "کۆی مامەڵەکان", en: "Rows add up to", ar: "مجموع الحركات", zh: "交易合计" }), say(DIFFERENCE)]} />
            <TableBody>
              {data.drift.map((r) => (
                <TableRow key={r.customerId}>
                  <Who code={r.customerCode} name={r.customerName} />
                  <Money value={r.storedBalanceUsd} />
                  <Money value={r.ledgerBalanceUsd} />
                  <Money value={r.driftUsd} strong />
                </TableRow>
              ))}
            </TableBody>
          </Finding>
        )}

        {data && data.doubleChargedCartons.length > 0 && (
          <Finding
            title={say(findings[1].label)}
            note={say({
              ku: "کاڵای ئەم کارتۆنانە لەسەر ئۆردەرەکەی حیسابکراوە، و وەسڵی بۆکسەکە جارێکی تر وەک پارسێل حیسابی کردووە.",
              en: "The goods in these cartons are charged on their order, and the box receipt charged them again as a parcel.",
              ar: "بضاعة هذه الكراتين محسوبة على طلبها، ثم حسبها إيصال الصندوق مرة أخرى كطرد.",
              zh: "这些箱内货物已在订单上计费，箱收据又按包裹再次计费。",
            })}
          >
            <Head cols={[say(CUSTOMER), say(BOX), say({ ku: "بۆکس حیسابی کرد", en: "Box charged", ar: "حسبه الصندوق", zh: "箱计费" }), say({ ku: "ئۆردەر", en: "Orders", ar: "الطلبات", zh: "订单" }), say({ ku: "دوو جار", en: "Twice", ar: "مكرر", zh: "重复" })]} />
            <TableBody>
              {data.doubleChargedCartons.map((r) => (
                <TableRow key={`${r.boxCode}-${r.packageId}`}>
                  <Who code={r.customerCode} name={r.customerName} />
                  <TableCell className="font-mono text-xs" dir="ltr">{r.boxCode}<br />{r.trackingNumber ?? r.packageId}</TableCell>
                  <Money value={r.boxChargeUsd} />
                  <TableCell className="text-xs" dir="ltr">{r.orderCodes} · {fmtUsd(r.orderChargesUsd)}</TableCell>
                  <Money value={r.overchargeUsd} strong />
                </TableRow>
              ))}
            </TableBody>
          </Finding>
        )}

        {data && data.boxReversals.length > 0 && (
          <Finding title={say({ ku: "وەسڵە هەڵوەشاوەکانی بۆکس", en: "Reversed box receipts", ar: "إيصالات صناديق ملغاة", zh: "已撤销的箱收据" })}>
            <Head cols={[say(CUSTOMER), say({ ku: "وەسڵ", en: "Receipt", ar: "الإيصال", zh: "收据" }), say({ ku: "پارەی دراو", en: "Paid", ar: "المدفوع", zh: "已付" }), say(findings[2].label), say(findings[3].label)]} />
            <TableBody>
              {data.boxReversals.map((r) => (
                <TableRow key={r.settlementNumber}>
                  <Who code={r.customerCode} name={r.customerName} />
                  <TableCell className="font-mono text-xs" dir="ltr">{r.settlementNumber}<br />{r.boxCode ?? ""}</TableCell>
                  <Money value={r.paidUsd} />
                  <Money value={r.stillCountedUsd} strong={r.stillCountedUsd > 0} />
                  <Money value={r.doubleReversedUsd} strong={r.doubleReversedUsd > 0} />
                </TableRow>
              ))}
            </TableBody>
          </Finding>
        )}

        {data && data.freightCollisions.length > 0 && (
          <Finding
            title={say(findings[4].label)}
            note={say({
              ku: "کرێی گواستنەوەی ئۆردەرێک بە ژمارەی ئۆردەرەکە تۆمارکراوە، کە هەمان ژمارەی پارسێلێکی کڕیارێکی ترە لە بۆکسدا — شاشەی پارەدانی ئەو بۆکسە ئەم بڕە بە هی خۆی دەزانێت.",
              en: "An order's freight was recorded under the order's number, which is also another customer's parcel number in a box — that box's payment screen counts this amount as its own.",
              ar: "سُجّلت أجرة شحن طلب برقم الطلب، وهو رقم طرد عميل آخر في صندوق — فتحسبها شاشة دفع ذلك الصندوق لها.",
              zh: "订单运费按订单号记录，而该号码恰为另一客户箱内包裹号——该箱付款界面会把这笔金额算作自己的。",
            })}
          >
            <Head cols={[say(CUSTOMER), say({ ku: "ئۆردەر", en: "Order", ar: "الطلب", zh: "订单" }), say({ ku: "بڕ", en: "Amount", ar: "المبلغ", zh: "金额" }), say({ ku: "بۆکسی تێکەڵبوو", en: "Tangled box", ar: "الصندوق المتأثر", zh: "受影响的箱" })]} />
            <TableBody>
              {data.freightCollisions.map((r) => (
                <TableRow key={`${r.ledgerTransactionId}-${r.otherBoxCode}`}>
                  <TableCell className="font-mono text-xs" dir="ltr">{r.customerCode}</TableCell>
                  <TableCell className="font-mono text-xs" dir="ltr">{r.orderCode ?? r.referenceId}</TableCell>
                  <Money value={r.amountUsd} />
                  <TableCell className="font-mono text-xs" dir="ltr">{r.otherCustomerCode} · {r.otherBoxCode}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Finding>
        )}

        {data && data.notOnAccount.length > 0 && (
          <Finding
            title={say(findings[5].label)}
            note={say({
              ku: "بۆکسەکە ئەم بڕە پیشان دەدات، بەڵام هێشتا نەبووەتە قەرز لەسەر حیسابی کڕیار — زۆرجار چونکە نرخی باچەکە هێشتا دانەنراوە.",
              en: "The box shows these amounts, but they are not yet a debt on the customer's account — usually because the batch has no price yet.",
              ar: "يعرض الصندوق هذه المبالغ لكنها ليست ديناً على حساب العميل بعد — غالباً لأن الدفعة بلا سعر بعد.",
              zh: "箱子显示这些金额，但尚未计入客户账户——通常因为批次尚未定价。",
            })}
          >
            <Head cols={[say(CUSTOMER), say({ ku: "بۆکس", en: "Boxes", ar: "الصناديق", zh: "箱数" }), say({ ku: "پارسێل", en: "Parcels", ar: "الطرود", zh: "包裹数" }), say({ ku: "کۆ", en: "Total", ar: "المجموع", zh: "合计" })]} />
            <TableBody>
              {data.notOnAccount.map((r) => (
                <TableRow key={r.customerId}>
                  <Who code={r.customerCode} name={r.customerName} />
                  <TableCell className="tabular-nums" dir="ltr">{r.boxes}</TableCell>
                  <TableCell className="tabular-nums" dir="ltr">{r.parcels}</TableCell>
                  <Money value={r.totalUsd} strong />
                </TableRow>
              ))}
            </TableBody>
          </Finding>
        )}

        {data && data.priceMismatches.length > 0 && (
          <Finding title={say(findings[6].label)}>
            <Head cols={[say(CUSTOMER), say(BOX), say({ ku: "نرخی بۆکس", en: "Box price", ar: "سعر الصندوق", zh: "箱内价格" }), say({ ku: "لەسەر حیساب", en: "On the account", ar: "على الحساب", zh: "账户计费" }), say(DIFFERENCE)]} />
            <TableBody>
              {data.priceMismatches.map((r) => (
                <TableRow key={`${r.boxCode}-${r.packageId}`}>
                  <TableCell className="font-mono text-xs" dir="ltr">{r.customerCode}</TableCell>
                  <TableCell className="font-mono text-xs" dir="ltr">{r.boxCode}<br />{r.trackingNumber ?? r.packageId}</TableCell>
                  <Money value={r.boxPriceUsd} />
                  <Money value={r.ledgerChargeUsd} />
                  <Money value={r.differenceUsd} strong />
                </TableRow>
              ))}
            </TableBody>
          </Finding>
        )}

        {data?.truncated && (
          <p className="text-xs text-muted-foreground">
            {say({
              ku: "هەر لیستێک تەنها 300 ڕیزی یەکەم پیشان دەدات؛ ژمارەکانی سەرەوە هەموویان دەژمێرن.",
              en: "Each list shows its first 300 rows; the figures above count all of them.",
              ar: "تعرض كل قائمة أول 300 صف؛ الأرقام أعلاه تحسب الجميع.",
              zh: "每个列表仅显示前 300 行；上方数字统计全部。",
            })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

const CUSTOMER: Words = { ku: "کڕیار", en: "Customer", ar: "العميل", zh: "客户" };
const BOX: Words = { ku: "بۆکس", en: "Box", ar: "الصندوق", zh: "箱" };
const DIFFERENCE: Words = { ku: "جیاوازی", en: "Difference", ar: "الفرق", zh: "差额" };

function Finding({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h4 className="text-sm font-semibold">{title}</h4>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
      <div className="max-h-96 overflow-auto rounded-lg border">
        <Table>{children}</Table>
      </div>
    </section>
  );
}

function Head({ cols }: { cols: string[] }) {
  return (
    <TableHeader>
      <TableRow>
        {cols.map((c) => (
          <TableHead key={c} className="whitespace-nowrap text-xs">{c}</TableHead>
        ))}
      </TableRow>
    </TableHeader>
  );
}

function Who({ code, name }: { code: string; name: string | null }) {
  return (
    <TableCell className="text-xs">
      <span className="font-mono font-semibold" dir="ltr">{code}</span>
      {name ? <span className="block text-muted-foreground">{name}</span> : null}
    </TableCell>
  );
}

function Money({ value, strong = false }: { value: number; strong?: boolean }) {
  return (
    <TableCell className={cn("whitespace-nowrap tabular-nums text-xs", strong && "font-bold")} dir="ltr">
      {fmtUsd(value)}
    </TableCell>
  );
}
