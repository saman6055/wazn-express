import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Receipt, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { pickLang } from "@/lib/lang";

/**
 * The orders entered before charging-at-entry shipped, and the one button
 * that brings them into line.
 *
 * Read first, decide second: the list names every customer whose balance
 * would move and by how much, and nothing is written until somebody presses
 * the button and confirms it. Running it twice is harmless — the second run
 * finds nothing, because an order already charged is refused.
 */
export function EntryChargeBackfillSection({ language }: { language: string }) {
  // The rule shipped mid-September; 1 September is what the owner asked for.
  const [since, setSince] = useState("2026-09-01");
  const sinceDate = new Date(since + "T00:00:00");
  const validDate = !Number.isNaN(sinceDate.getTime());
  const [confirmOpen, setConfirmOpen] = useState(false);

  const utils = trpc.useUtils();
  const preview = trpc.fullPackage.previewEntryChargeBackfill.useQuery(
    { since: sinceDate },
    { enabled: validDate },
  );
  const apply = trpc.fullPackage.applyEntryChargeBackfill.useMutation({
    onSuccess: (r) => {
      toast.success(
        pickLang(language, {
          ku: r.charged + " ئۆردەر حیساب کرا — کۆی $" + r.totalUsd.toFixed(2),
          en: r.charged + " orders charged — $" + r.totalUsd.toFixed(2) + " in total",
          ar: "تمت محاسبة " + r.charged + " طلباً — بإجمالي $" + r.totalUsd.toFixed(2),
          zh: "已计费 " + r.charged + " 个订单 — 合计 $" + r.totalUsd.toFixed(2),
        }),
        { duration: 12000 },
      );
      if (r.failed > 0) {
        toast.error(
          r.failed + " " +
            pickLang(language, { ku: "سەرکەوتوو نەبوون", en: "failed", ar: "فشلت", zh: "失败" }) +
            ": " + r.failures.map((f) => f.orderCode).join(", "),
          { duration: 20000 },
        );
      }
      preview.refetch();
      utils.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const money = (n: number) => "$" + n.toFixed(2);
  const data = preview.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          {pickLang(language, {
            ku: "قەرزی ئۆردەرە کۆنەکان",
            en: "Debt for orders entered earlier",
            ar: "ديون الطلبات المُدخلة سابقاً",
            zh: "此前录入订单的欠款",
          })}
        </CardTitle>
        <CardDescription>
          {pickLang(language, {
            ku: "ئۆردەری کرین بە تێچوو و پاکێجی تەواو کە پێش ئەم ڕێسایە داخڵ کراون و هێشتا نەبوونەتە قەرز. سەرەتا لیستەکە ببینە — هیچ شتێک نانووسرێت تا دوگمەکە دانەگریت.",
            en: "Cost-purchase and full-package orders entered before this rule, still owing nothing. Read the list first — nothing is written until you press the button.",
            ar: "طلبات الشراء بالتكلفة والحزمة الكاملة المُدخلة قبل هذه القاعدة ولم تُسجَّل كديون. اقرأ القائمة أولاً — لا يُكتب شيء حتى تضغط الزر.",
            zh: "本规则生效前录入、尚未计入欠款的成本代购与完整套餐订单。请先查看列表——按下按钮前不会写入任何内容。",
          })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <Label className="text-xs">
              {pickLang(language, { ku: "لە ئەم بەروارەوە", en: "From this date", ar: "من هذا التاريخ", zh: "自此日期起" })}
            </Label>
            <Input type="date" value={since} onChange={(e) => setSince(e.target.value)} className="w-44" />
          </div>
          <Button
            variant="outline"
            onClick={() => preview.refetch()}
            disabled={!validDate || preview.isFetching}
          >
            {preview.isFetching && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
            {pickLang(language, { ku: "پیشاندانەوە", en: "Refresh", ar: "تحديث", zh: "刷新" })}
          </Button>
          <Button
            onClick={() => setConfirmOpen(true)}
            disabled={!validDate || apply.isPending || !data || data.totalOrders === 0}
          >
            {apply.isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
            {pickLang(language, {
              ku: "قەرزەکان تۆمار بکە", en: "Post the charges",
              ar: "تسجيل الديون", zh: "记入欠款",
            })}
          </Button>
        </div>

        {data && (
          <>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="outline">
                {data.totalOrders} {pickLang(language, { ku: "ئۆردەر", en: "orders", ar: "طلب", zh: "订单" })}
              </Badge>
              <Badge variant="outline">
                {data.customers.length} {pickLang(language, { ku: "کڕیار", en: "customers", ar: "عميل", zh: "客户" })}
              </Badge>
              <Badge className="bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-300" dir="ltr">
                {money(data.totalUsd)}
              </Badge>
            </div>

            {data.totalOrders === 0 ? (
              <p className="text-sm text-muted-foreground">
                {pickLang(language, {
                  ku: "هیچ ئۆردەرێک نەماوە — هەموویان پێشتر حیساب کراون.",
                  en: "Nothing left — every order is already charged.",
                  ar: "لم يتبقَّ شيء — كل الطلبات مُحاسَبة بالفعل.",
                  zh: "没有剩余——所有订单均已计费。",
                })}
              </p>
            ) : (
              <div className="max-h-80 overflow-y-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{pickLang(language, { ku: "کڕیار", en: "Customer", ar: "العميل", zh: "客户" })}</TableHead>
                      <TableHead>{pickLang(language, { ku: "ئۆردەر", en: "Orders", ar: "الطلبات", zh: "订单" })}</TableHead>
                      <TableHead className="text-end">{pickLang(language, { ku: "بڕ", en: "Amount", ar: "المبلغ", zh: "金额" })}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.customers.map((c) => (
                      <TableRow key={c.customerId}>
                        <TableCell>
                          <span className="font-medium">{c.customerName || "-"}</span>
                          <span dir="ltr" className="ms-2 font-mono text-xs text-muted-foreground">{c.customerCode}</span>
                        </TableCell>
                        <TableCell className="tabular-nums">{c.orders}</TableCell>
                        <TableCell dir="ltr" className="text-end font-semibold tabular-nums">{money(c.totalUsd)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </>
        )}
      </CardContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <TriangleAlert className="h-5 w-5 text-amber-600" />
              {pickLang(language, {
                ku: "قەرز دەچێتە سەر حساباتی کڕیارەکان",
                en: "This puts debt on customer accounts",
                ar: "سيُسجَّل دين على حسابات العملاء",
                zh: "这会在客户账户上记入欠款",
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {data
                ? pickLang(language, {
                    ku: data.totalOrders + " ئۆردەر بۆ " + data.customers.length + " کڕیار، بە کۆی " + money(data.totalUsd) + ". ئەگەر کڕیارێک کڕەدیتی هەبێت، لێی دەردەچێت. هەر تۆمارێک دەگەڕێندرێتەوە بە دەستکاری یان سڕینەوەی ئۆردەرەکەی.",
                    en: data.totalOrders + " orders for " + data.customers.length + " customers, " + money(data.totalUsd) + " in total. Any credit a customer holds is spent against it. Each charge can be undone by editing or deleting its order.",
                    ar: data.totalOrders + " طلباً لـ " + data.customers.length + " عميلاً، بإجمالي " + money(data.totalUsd) + ". أي رصيد للعميل سيُخصم منه. يمكن التراجع عن كل قيد بتعديل طلبه أو حذفه.",
                    zh: data.totalOrders + " 个订单，" + data.customers.length + " 位客户，合计 " + money(data.totalUsd) + "。客户的余额会被抵扣。每笔计费都可通过编辑或删除其订单撤销。",
                  })
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {pickLang(language, { ku: "پاشگەزبوونەوە", en: "Cancel", ar: "إلغاء", zh: "取消" })}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOpen(false);
                apply.mutate({ since: sinceDate });
              }}
            >
              {pickLang(language, { ku: "بەڵێ، تۆماری بکە", en: "Yes, post them", ar: "نعم، سجّلها", zh: "是，记入" })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
