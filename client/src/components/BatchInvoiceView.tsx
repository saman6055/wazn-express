import { Receipt, Image as ImageIcon, AlertTriangle } from "lucide-react";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";
import type { BatchInvoice, InvoiceLine } from "@shared/batchInvoice";

/**
 * One batch, itemised, drawn once.
 *
 * The customer's portal and the office's screen show this. Not two components
 * that agree most of the time — one, because every previous "the same thing on
 * the other screen" in this system drifted, and a customer on the phone
 * reading different figures from the member of staff answering is the worst
 * version of that.
 *
 * What it never renders is what we paid for the goods. That is not a decision
 * taken here: the figure is not in the data. shared/batchInvoice.ts builds a
 * commission line from the item price the customer already knows and the fee
 * we charge for buying it, and a resale line from the one price they were
 * quoted. There is no third number to leave out.
 */

interface Props {
  invoice: BatchInvoice;
  batchCode: string;
  /** "air_regular" | "air_irregular" | "sea" */
  shippingType?: string | null;
  arrivedAt?: Date | string | null;
  language: string;
  /** The office sees the customer's name on it; the customer does not need telling who they are. */
  customerLabel?: string | null;
  onPrint?: () => void;
}

const money = (n: number) => `$${n.toFixed(2)}`;

function shippingLabel(type: string | null | undefined) {
  if (type === "sea") return { ku: "دەریایی", en: "Sea", ar: "بحري", zh: "海运" };
  return { ku: "ئاسمانی", en: "Air", ar: "جوّي", zh: "空运" };
}

function Line({ line, language }: { line: InvoiceLine; language: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
      <div className="flex items-start gap-3">
        {line.image ? (
          <img
            src={line.image}
            alt=""
            className="h-14 w-14 shrink-0 rounded-lg object-cover border border-border"
            loading="lazy"
          />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
            <ImageIcon className="h-5 w-5 text-muted-foreground" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{line.productName}</p>
          <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
            {line.orderCode}
            {line.trackingNumber ? ` · ${line.trackingNumber}` : ""}
          </p>
        </div>
      </div>

      <dl className="mt-3 space-y-1.5 border-t border-border pt-3 text-sm">
        {/* A commission line shows both halves, because the customer chose the
            item and knows what it cost. A resale line has one figure and no
            second number they are entitled to see. */}
        {line.basis === "item_plus_commission" ? (
          <>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">
                {pickLang(language, { ku: "نرخی کاڵا", en: "Item price", ar: "سعر السلعة", zh: "商品价格" })}
              </dt>
              <dd className="font-mono">{money(line.itemPrice ?? 0)}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">
                {pickLang(language, { ku: "کرێی کڕین", en: "Purchase fee", ar: "أجرة الشراء", zh: "代购费" })}
              </dt>
              <dd className="font-mono">{money(line.commissionFee ?? 0)}</dd>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">
              {pickLang(language, { ku: "تێچووی کڕین", en: "Goods", ar: "قيمة البضاعة", zh: "货款" })}
            </dt>
            <dd className="font-mono">{money(line.goods)}</dd>
          </div>
        )}

        {/* A concealed (full-package) line has no shipping row at all: the
            agreed price is the whole story, and a $0.00 carriage row would
            only invite the question it exists to close. */}
        {!line.sizeConcealed && (
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">
              {pickLang(language, { ku: "تێچووی گواستنەوە", en: "Shipping", ar: "أجرة الشحن", zh: "运费" })}
              {/* The weight beside the figure, because otherwise the carriage
                  charge is a number the customer simply has to accept. */}
              {line.weightKg > 0 && (
                <span className="ms-1 font-mono text-xs opacity-70">
                  · {line.weightKg} kg ({line.weightShare}%)
                </span>
              )}
            </dt>
            <dd className="font-mono">{money(line.shipping)}</dd>
          </div>
        )}

        {line.advancePaid > 0 && (
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">
              {pickLang(language, { ku: "پارەی پێشەکی", en: "Paid in advance", ar: "مدفوع مقدماً", zh: "已预付" })}
            </dt>
            <dd className="font-mono text-emerald-600 dark:text-emerald-300">−{money(line.advancePaid)}</dd>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
          <dt className="font-semibold">
            {pickLang(language, { ku: "کۆی ئەم بەریدە", en: "Parcel total", ar: "إجمالي هذا الطرد", zh: "本件合计" })}
          </dt>
          <dd className="font-mono text-base font-bold">{money(line.total)}</dd>
        </div>
      </dl>
    </div>
  );
}

export function BatchInvoiceView({
  invoice,
  batchCode,
  shippingType,
  arrivedAt,
  language,
  customerLabel,
  onPrint,
}: Props) {
  const { lines, totals, unpriced } = invoice;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 font-semibold">
              <Receipt className="h-4 w-4 text-muted-foreground" />
              {pickLang(language, { ku: "پسووڵەی باچ", en: "Batch invoice", ar: "فاتورة الدفعة", zh: "批次账单" })}
              <span className="font-mono">{batchCode}</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {pickLang(language, shippingLabel(shippingType))}
              {" · "}
              {lines.length}{" "}
              {pickLang(language, { ku: "بەرید", en: "parcels", ar: "طرود", zh: "件" })}
              {arrivedAt ? ` · ${new Date(arrivedAt).toLocaleDateString()}` : ""}
              {customerLabel ? ` · ${customerLabel}` : ""}
            </p>
          </div>
          {onPrint && (
            <button
              onClick={onPrint}
              className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted"
            >
              PDF
            </button>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4">
          <div className="bg-card p-3">
            <p className="text-xs text-muted-foreground">
              {pickLang(language, { ku: "کۆی کڕین", en: "Goods", ar: "البضاعة", zh: "货款" })}
            </p>
            <p className="mt-0.5 font-mono text-lg font-bold">{money(totals.goods)}</p>
          </div>
          <div className="bg-card p-3">
            <p className="text-xs text-muted-foreground">
              {pickLang(language, { ku: "کۆی گواستنەوە", en: "Shipping", ar: "الشحن", zh: "运费" })}
            </p>
            <p className="mt-0.5 font-mono text-lg font-bold">{money(totals.shipping)}</p>
          </div>
          {/* Skipped when nothing on the invoice carries a visible weight —
              an all-full-package invoice would otherwise print "0 kg". */}
          {totals.weightKg > 0 && (
            <div className="bg-card p-3">
              <p className="text-xs text-muted-foreground">
                {pickLang(language, { ku: "کێشی گشتی", en: "Total weight", ar: "الوزن الكلي", zh: "总重量" })}
              </p>
              <p className="mt-0.5 font-mono text-lg font-bold">{totals.weightKg} kg</p>
            </div>
          )}
          <div className="bg-emerald-50 p-3 dark:bg-emerald-950/40">
            <p className="text-xs text-emerald-700 dark:text-emerald-300">
              {pickLang(language, { ku: "کۆی گشتی", en: "Total", ar: "الإجمالي", zh: "合计" })}
            </p>
            <p className="mt-0.5 font-mono text-lg font-bold text-emerald-700 dark:text-emerald-200">
              {money(totals.grand)}
            </p>
          </div>
        </div>
      </div>

      {/* Said out loud rather than absorbed into the total. A parcel with no
          price is not a parcel that cost nothing. */}
      {unpriced > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            {pickLang(language, {
              ku: "بەرید هەیە هێشتا نرخی بۆ دانەنراوە",
              en: "Some parcels have no price recorded yet",
              ar: "بعض الطرود لم يُسجَّل لها سعر بعد",
              zh: "部分包裹尚未记录价格",
            })}
            : {unpriced}
          </span>
        </div>
      )}

      <div className="space-y-2">
        {lines.map((line) => (
          <Line key={line.orderId} line={line} language={language} />
        ))}
      </div>

      <div className="rounded-xl border border-emerald-300 bg-card p-4 dark:border-emerald-900/60">
        <dl className="space-y-1.5 text-sm">
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">
              {pickLang(language, { ku: "کۆی کڕین", en: "Goods", ar: "البضاعة", zh: "货款" })}
            </dt>
            <dd className="font-mono">{money(totals.goods)}</dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">
              {pickLang(language, { ku: "کۆی گواستنەوە", en: "Shipping", ar: "الشحن", zh: "运费" })}
            </dt>
            <dd className="font-mono">{money(totals.shipping)}</dd>
          </div>
          {totals.advancePaid > 0 && (
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">
                {pickLang(language, { ku: "پارەی پێشەکی دراو", en: "Already paid", ar: "المدفوع مقدماً", zh: "已预付" })}
              </dt>
              <dd className="font-mono text-emerald-600 dark:text-emerald-300">−{money(totals.advancePaid)}</dd>
            </div>
          )}
          <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
            <dt className="text-base font-semibold">
              {pickLang(language, { ku: "ماوە بۆ دان", en: "Amount due", ar: "المبلغ المستحق", zh: "应付金额" })}
            </dt>
            <dd className={cn("font-mono text-xl font-bold", "text-emerald-700 dark:text-emerald-200")}>
              {money(totals.due)}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

export default BatchInvoiceView;
