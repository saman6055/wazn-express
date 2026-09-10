import type { ReactNode } from "react";
import { Link } from "wouter";
import { Receipt, ArrowUp, ArrowDown, ArrowUpRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fmtDateTime } from "@/lib/numericDate";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";

/**
 * One ledger line, opened: what it was, how much, what it did to the
 * balance, what it refers to, and the way to the customer's whole account.
 *
 * The finance page listed transactions and payments that opened nothing
 * (owner, 2026-09-10: "I want to click anything and get its details, not
 * just see it"). Same facts as the customer page's own detail window.
 */

export interface TransactionLike {
  id: number;
  transactionNumber?: string | null;
  transactionType?: string | null;
  amountUsd?: string | number | null;
  balanceBeforeUsd?: string | number | null;
  balanceAfterUsd?: string | number | null;
  createdAt?: string | Date | null;
  description?: string | null;
  referenceType?: string | null;
  referenceId?: number | null;
}

export interface TransactionCustomer {
  id?: number | null;
  customerCode?: string | null;
  fullName?: string | null;
}

type Words = { ku: string; en: string; ar: string; zh: string };

const REFERENCE: Record<string, Words> = {
  package: { ku: "پاکەت", en: "Parcel", ar: "طرد", zh: "包裹" },
  invoice: { ku: "پسوولە", en: "Invoice", ar: "فاتورة", zh: "发票" },
  full_package: { ku: "فوڵ پاکێج", en: "Full package", ar: "طلب كامل", zh: "整单" },
  commission: { ku: "کۆمیشن", en: "Commission", ar: "عمولة", zh: "代购" },
  payment: { ku: "پارەدان", en: "Payment", ar: "دفعة", zh: "付款" },
  delivery_box: { ku: "بۆکس", en: "Box", ar: "صندوق", zh: "箱子" },
  box: { ku: "بۆکس", en: "Box", ar: "صندوق", zh: "箱子" },
  batch: { ku: "باچ", en: "Batch", ar: "دفعة شحن", zh: "批次" },
  service: { ku: "خزمەتگوزاری", en: "Service", ar: "خدمة", zh: "服务" },
};

const signed = (v: string | number | null | undefined) => `$${Number(v || 0).toFixed(2)}`;

export function TransactionDetailDialog({ tx, customer, typeLabel, onClose }: {
  tx: TransactionLike | null;
  customer?: TransactionCustomer | null;
  /** The page's own words for the transaction type. */
  typeLabel: string;
  onClose: () => void;
}) {
  const { language } = useTranslation();
  const t = (k: Words) => pickLang(language, k);
  const isDebit = (tx?.transactionType ?? "").startsWith("DEBIT");
  const amount = Math.abs(Number(tx?.amountUsd || 0)).toFixed(2);
  const ref = tx?.referenceType ? (REFERENCE[tx.referenceType] ? t(REFERENCE[tx.referenceType]) : tx.referenceType) : null;

  const row = (label: Words, value: ReactNode) => (
    <div className="flex items-center justify-between gap-4 border-b py-2 last:border-0">
      <span className="text-muted-foreground">{t(label)}</span>
      <span className="text-end font-semibold">{value}</span>
    </div>
  );

  return (
    <Dialog open={tx !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg" data-testid="transaction-detail">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
            {t({ ku: "وردەکاری جوڵە", en: "Transaction details", ar: "تفاصيل الحركة", zh: "交易详情" })}
          </DialogTitle>
        </DialogHeader>
        {tx && (
          <div className="mt-2 space-y-4">
            <div className={cn(
              "rounded-xl border p-4",
              isDebit ? "border-red-200 bg-red-50 dark:border-red-800/60 dark:bg-red-950/30" : "border-emerald-200 bg-emerald-50 dark:border-emerald-800/60 dark:bg-emerald-950/30",
            )}>
              <div className="mb-3 flex items-center justify-between gap-2">
                <Badge variant="outline" className="gap-1">
                  {isDebit ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                  {typeLabel}
                </Badge>
                {tx.transactionNumber && (
                  <span className="font-mono text-xs text-muted-foreground" dir="ltr">{tx.transactionNumber}</span>
                )}
              </div>
              <p className={cn("text-center text-4xl font-bold tabular-nums", isDebit ? "text-red-600 dark:text-red-300" : "text-emerald-600 dark:text-emerald-300")} dir="ltr">
                {isDebit ? "+" : "-"}${amount}
              </p>
              <p className="mt-1 text-center text-xs text-muted-foreground">
                {isDebit
                  ? t({ ku: "چووە سەر قەرزی کڕیار", en: "Added to what the customer owes", ar: "أُضيف إلى دين العميل", zh: "计入客户欠款" })
                  : t({ ku: "لە قەرزی کڕیار کەمکرایەوە", en: "Taken off what the customer owes", ar: "خُصم من دين العميل", zh: "从客户欠款中扣除" })}
              </p>
            </div>

            <div className="text-sm">
              {customer && row(
                { ku: "کڕیار", en: "Customer", ar: "العميل", zh: "客户" },
                <span>
                  <span className="font-mono" dir="ltr">{customer.customerCode}</span>
                  {customer.fullName ? ` · ${customer.fullName}` : ""}
                </span>,
              )}
              {row({ ku: "باڵانس پێش", en: "Balance before", ar: "الرصيد قبل", zh: "之前余额" }, <span dir="ltr">{signed(tx.balanceBeforeUsd)}</span>)}
              {row({ ku: "باڵانس دوای", en: "Balance after", ar: "الرصيد بعد", zh: "之后余额" }, <span dir="ltr">{signed(tx.balanceAfterUsd)}</span>)}
              {tx.createdAt && row({ ku: "بەروار", en: "Date", ar: "التاريخ", zh: "日期" }, fmtDateTime(new Date(tx.createdAt)))}
              {ref && row(
                { ku: "پەیوەندیدار بە", en: "Refers to", ar: "مرتبط بـ", zh: "关联" },
                <span>{ref}{tx.referenceId ? <span className="font-mono" dir="ltr"> #{tx.referenceId}</span> : null}</span>,
              )}
            </div>

            {tx.description && (
              <div className="text-sm">
                <span className="mb-1 block text-muted-foreground">{t({ ku: "وەسف", en: "Description", ar: "الوصف", zh: "描述" })}</span>
                <p className="rounded-lg bg-muted/50 p-3">{tx.description}</p>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {customer?.id && (
                <Link href={`/finance/customer/${customer.id}`} className="flex-1">
                  <Button className="w-full gap-1" onClick={onClose}>
                    {t({ ku: "حسابی تەواوی کڕیار", en: "The customer's whole account", ar: "حساب العميل كاملاً", zh: "客户完整账户" })}
                    <ArrowUpRight className="h-4 w-4" />
                  </Button>
                </Link>
              )}
              <Button variant="outline" className="flex-1" onClick={onClose}>
                {t({ ku: "داخستن", en: "Close", ar: "إغلاق", zh: "关闭" })}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
