import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, CheckCircle2, Loader2, PackageSearch } from "lucide-react";
import { toast } from "sonner";
import { pickLang } from "@/lib/lang";
import { fmtUsd } from "@/lib/portalFormat";
import { CopyButton } from "@/components/CopyButton";
import { cn } from "@/lib/utils";

type Words = { ku: string; en: string; ar: string; zh: string };

/**
 * Goods already in a customer's hands that their account never heard about.
 *
 * The owner, 2026-09-26, after the doors were built: "it has to fix the old
 * ones too." The doors only bill what passes through them from now on —
 * every order that arrived before they existed is still unbilled, and a box
 * settled against one of those credits the customer money for goods they
 * were carrying out (AZ295: $211.78 of goods, $40.15 in credit).
 *
 * So: the list first, and only then the button. The scan is read only and
 * runs when asked, not when the tab opens; billing is ticked per row,
 * because a repair that moves money on forty accounts at once should be a
 * decision somebody made, not a page that loaded.
 */

const WHERE_WORDS: Record<string, Words> = {
  box: { ku: "لە بۆکسدایە", en: "In a box", ar: "في صندوق", zh: "在箱中" },
  delivered: { ku: "پاکەتەکە گەیەنراوە", en: "Parcel delivered", ar: "الطرد مُسلَّم", zh: "包裹已送达" },
  order_delivered: { ku: "ئۆردەرەکە گەیەنراوە", en: "Order delivered", ar: "الطلب مُسلَّم", zh: "订单已送达" },
};

export function UnbilledGoodsSection({ language }: { language: string }) {
  const say = (w: Words) => pickLang(language, w);
  const utils = trpc.useUtils();
  const scan = trpc.ledger.unbilledGoods.useQuery(undefined, { enabled: false, retry: false });
  const [picked, setPicked] = useState<Set<number>>(new Set());

  const rows = useMemo(() => scan.data ?? [], [scan.data]);
  const total = useMemo(
    () => rows.reduce((sum, r) => sum + Number(r.amountUsd || 0), 0),
    [rows],
  );
  const pickedTotal = useMemo(
    () => rows.filter((r) => picked.has(r.orderId)).reduce((sum, r) => sum + Number(r.amountUsd || 0), 0),
    [rows, picked],
  );

  const bill = trpc.ledger.billUnbilledGoods.useMutation({
    onSuccess: (result) => {
      setPicked(new Set());
      void scan.refetch();
      void utils.ledger.invalidate();
      toast.success(
        `${say({ ku: "خرانە سەر حیساب", en: "Billed", ar: "تمت المحاسبة", zh: "已入账" })}: ${result.charged} · ${fmtUsd(result.amountUsd)}`,
      );
      if (result.skipped.length > 0) {
        toast.warning(
          `${say({ ku: "نەخرانە سەر حیساب", en: "Skipped", ar: "تم التخطي", zh: "已跳过" })}: ` +
            result.skipped.map((s) => `${s.orderCode} (${s.reason})`).join(", "),
        );
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const toggle = (id: number) => {
    setPicked((old) => {
      const next = new Set(old);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allPicked = rows.length > 0 && picked.size === rows.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PackageSearch className="h-5 w-5" />
          {say({
            ku: "کاڵای گەیشتوو کە لەسەر حیساب نییە",
            en: "Goods delivered but never billed",
            ar: "بضائع سُلِّمت ولم تُحاسَب",
            zh: "已交付但未入账的货物",
          })}
        </CardTitle>
        <CardDescription>
          {say({
            ku: "ئەو ئۆردەرانەی کڕین بە تێچوو و پاکێجی تەواو کە کڕیار وەریگرتووە بەڵام نرخەکەیان نەچووەتە سەر حیسابی. خوێندنەوەیە — هیچ ناجوڵێت تا دوگمەکە دانەگریت.",
            en: "Commission and full-package orders the customer already has, whose price never reached their account. Read only until you press the button.",
            ar: "طلبات العمولة والباقة الكاملة التي استلمها الزبون ولم يصل سعرها إلى حسابه. قراءة فقط حتى تضغط الزر.",
            zh: "客户已收到但价格从未记入其账户的代购与全包订单。按下按钮前只做读取。",
          })}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => void scan.refetch()} disabled={scan.isFetching} data-testid="unbilled-scan">
            {scan.isFetching && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {say({ ku: "پشکنین", en: "Scan", ar: "فحص", zh: "扫描" })}
          </Button>
          {scan.data && (
            <span className="text-sm text-muted-foreground">
              {rows.length}{" "}
              {say({ ku: "ئۆردەر", en: "orders", ar: "طلب", zh: "订单" })} ·{" "}
              <bdi dir="ltr" className="font-mono">{fmtUsd(total)}</bdi>
            </span>
          )}
        </div>

        {scan.error && (
          <p className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
            <AlertTriangle className="h-4 w-4" />
            {scan.error.message}
          </p>
        )}

        {scan.data && rows.length === 0 && (
          <p className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            {say({
              ku: "هیچ کاڵایەکی گەیشتوو نییە کە لەسەر حیساب نەبێت",
              en: "Nothing delivered is left unbilled",
              ar: "لا توجد بضائع مُسلَّمة غير محاسَبة",
              zh: "没有已交付却未入账的货物",
            })}
          </p>
        )}

        {rows.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allPicked}
                        onCheckedChange={() =>
                          setPicked(allPicked ? new Set() : new Set(rows.map((r) => r.orderId)))
                        }
                        aria-label={say({ ku: "هەموو", en: "All", ar: "الكل", zh: "全部" })}
                        data-testid="unbilled-all"
                      />
                    </TableHead>
                    <TableHead>{say({ ku: "کڕیار", en: "Customer", ar: "الزبون", zh: "客户" })}</TableHead>
                    <TableHead>{say({ ku: "ئۆردەر", en: "Order", ar: "الطلب", zh: "订单" })}</TableHead>
                    <TableHead>{say({ ku: "کوا", en: "Where", ar: "أين", zh: "位置" })}</TableHead>
                    <TableHead className="text-end">{say({ ku: "بڕ", en: "Amount", ar: "المبلغ", zh: "金额" })}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow
                      key={r.orderId}
                      className={cn(picked.has(r.orderId) && "bg-muted/50")}
                      data-testid={`unbilled-${r.orderId}`}
                    >
                      <TableCell>
                        <Checkbox
                          checked={picked.has(r.orderId)}
                          onCheckedChange={() => toggle(r.orderId)}
                          aria-label={r.orderCode}
                        />
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <span className="block text-sm">{r.customerName}</span>
                        <span className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
                          <bdi dir="ltr">{r.customerCode}</bdi>
                          <CopyButton value={r.customerCode} />
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <span className="flex items-center gap-1 font-mono text-xs">
                          <bdi dir="ltr">{r.orderCode}</bdi>
                          <CopyButton value={r.orderCode} />
                        </span>
                        {r.productName && (
                          <span className="block max-w-[14rem] truncate text-xs text-muted-foreground">
                            {r.productName}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {say(WHERE_WORDS[r.where] ?? WHERE_WORDS.delivered)}
                        {r.boxCode && (
                          <span className="ms-1 font-mono">
                            <bdi dir="ltr">{r.boxCode}</bdi>
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-end font-mono tabular-nums text-red-600 dark:text-red-400">
                        <bdi dir="ltr">{fmtUsd(Number(r.amountUsd || 0))}</bdi>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t pt-3">
              <Button
                disabled={picked.size === 0 || bill.isPending}
                onClick={() => bill.mutate({ orderIds: Array.from(picked) })}
                data-testid="unbilled-bill"
              >
                {bill.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                {say({ ku: "بیانخە سەر حیساب", en: "Put on the accounts", ar: "إضافة إلى الحسابات", zh: "记入账户" })}
                {picked.size > 0 && (
                  <span className="ms-2 font-mono">
                    {picked.size} · <bdi dir="ltr">{fmtUsd(pickedTotal)}</bdi>
                  </span>
                )}
              </Button>
              <p className="text-xs text-muted-foreground">
                {say({
                  ku: "قەرزی ئەو کڕیارانە بەم بڕە زیاد دەکات. ئۆردەرێک کە لەم نێوەندەدا حیساب کرابێت، پەڕاندنی دەکرێت — دوو جار حیساب ناکرێت.",
                  en: "This raises those customers' debt by that amount. An order billed in the meantime is skipped — nothing is billed twice.",
                  ar: "هذا يزيد دين هؤلاء الزبائن بهذا المبلغ. الطلب الذي حوسب في الأثناء يُتخطى — لا شيء يُحاسب مرتين.",
                  zh: "这会将这些客户的欠款增加相应金额。期间已入账的订单会被跳过——不会重复入账。",
                })}
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
