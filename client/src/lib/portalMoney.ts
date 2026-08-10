/**
 * What the customer's money means, in one place.
 *
 * Three questions get asked on six different portal screens — is this balance
 * a debt, is this ledger line money in or money out, and is this invoice
 * settled — and every screen answered them for itself. They disagreed:
 *
 *   • the modern and skin3 home screens treated a NEGATIVE balance as debt,
 *     so a customer owing $320 saw no warning and a customer $50 in credit was
 *     labelled a debtor and pushed to pay;
 *   • both new skins tested the ledger for `type === "payment"`, a value the
 *     enum has never contained, so every payment a customer made was drawn as
 *     a charge, in red, with an up arrow;
 *   • the classic invoice dialog and the invoice a customer DOWNLOADS branched
 *     on `cancelled` alone, so a draft, issued or partially-paid invoice
 *     printed the word PAID across the top. A customer holding that document
 *     has every reason to stop paying.
 *
 * The rules are small. Keeping them in one file is what stops them drifting
 * again; portal-audit.test.ts fails if a screen re-implements them.
 */
import { isChargeTx, isPaymentTx } from "@shared/ledgerTypes";

/** Positive means the customer owes us. Set by finance.db: a payment does
 *  `currentBalanceUsd - amountUsd`, and the debtors report counts `> 0`. */
export function isDebt(balanceUsd: number | null | undefined): boolean {
  return Number(balanceUsd ?? 0) > 0;
}

/**
 * Negative means we are holding money for them.
 *
 * The counterpart exists so that no screen has to write `balance < 0` by
 * hand — which is both the correct test for credit and the incorrect test for
 * debt, and the portal already shipped the second one twice. With both named,
 * a bare comparison in a portal file is always a mistake, and the test can say
 * so without exceptions.
 */
export function isCredit(balanceUsd: number | null | undefined): boolean {
  return Number(balanceUsd ?? 0) < 0;
}

/**
 * Money moving toward the customer (a payment they made, a refund, a discount).
 *
 * The enum has two shapes — `CREDIT_PAYMENT` and `ADJUSTMENT_CREDIT` — and the
 * classic page only ever tested the first, so a manual credit adjustment was
 * shown to the customer as another charge.
 */
export function isCreditTx(transactionType: string | null | undefined): boolean {
  return isPaymentTx(transactionType);
}

/**
 * Money the customer owes — the other half, which never had a name.
 *
 * Only the credit side was ever given a rule, so every screen that needed the
 * debit side wrote its own. The classic money page wrote `startsWith("DEBIT_")`
 * and lost `ADJUSTMENT_DEBIT`, which begins with neither. Asking "is it a
 * charge" directly is the only version that cannot drift from its opposite.
 */
export function isDebitTx(transactionType: string | null | undefined): boolean {
  return isChargeTx(transactionType);
}

export type InvoiceState = "paid" | "unpaid" | "partial" | "cancelled" | "refunded";

/**
 * Where an invoice actually stands.
 *
 * `draft` and `issued` are both "not paid yet" from the customer's side; the
 * difference is ours, not theirs. `partially_paid` is called out separately
 * because telling someone they owe nothing when they still owe half is the
 * same mistake in a smaller coat.
 */
export function invoiceState(status: string | null | undefined): InvoiceState {
  switch (String(status ?? "").toLowerCase()) {
    case "paid": return "paid";
    case "partially_paid": return "partial";
    case "cancelled": return "cancelled";
    case "refunded": return "refunded";
    // draft, issued, and anything a future migration adds: assume unpaid.
    // The safe default is the one that does not tell a customer to stop paying.
    default: return "unpaid";
  }
}

/** Is there still money to collect on this invoice? */
export function isInvoiceOutstanding(status: string | null | undefined): boolean {
  const state = invoiceState(status);
  return state === "unpaid" || state === "partial";
}

type L = { ku: string; en: string; ar: string; zh: string };

/**
 * What each ledger line is called, in the customer's language.
 *
 * The enum holds fourteen values and the money page knew five of them; the
 * rest fell through to `type.replace(/_/g, " ")` and printed the raw column —
 * "DEBIT FULL PACKAGE", "ADJUSTMENT CREDIT" — in Latin capitals, in the middle
 * of an Arabic or Kurdish statement. The customer's own money, labelled in a
 * language they did not choose, in the internal vocabulary of our database.
 *
 * All fourteen live here now, and portalMoney.test.ts fails if the enum grows
 * a value this map does not know.
 */
export const LEDGER_TYPE_LABEL: Record<string, L> = {
  DEBIT_PACKAGE: { ku: "کرێی گەیاندن", en: "Delivery charge", ar: "رسوم التوصيل", zh: "配送费" },
  DEBIT_FULL_PACKAGE: { ku: "پاکێجی تەواو", en: "Full package order", ar: "طلب الطرد الكامل", zh: "全包订单" },
  DEBIT_PURCHASE_REQUEST: { ku: "داواکاری کڕین", en: "Purchase request", ar: "طلب شراء", zh: "采购请求" },
  DEBIT_COMMISSION: { ku: "کڕین بە تێچوو", en: "Markup purchase", ar: "شراء بهامش", zh: "加价采购" },
  DEBIT_SERVICE: { ku: "کرێی خزمەتگوزاری", en: "Service fee", ar: "رسوم الخدمة", zh: "服务费" },
  DEBIT_PENALTY: { ku: "غەرامەی دواکەوتن", en: "Late fee", ar: "رسوم تأخير", zh: "滞纳金" },
  DEBIT_OTHER: { ku: "کرێیەکی تر", en: "Other charge", ar: "رسوم أخرى", zh: "其他费用" },
  CREDIT_PAYMENT: { ku: "پارەدان", en: "Payment", ar: "دفعة", zh: "付款" },
  CREDIT_DEPOSIT: { ku: "پارەی پێشەکی", en: "Deposit", ar: "إيداع", zh: "预存款" },
  CREDIT_REFUND: { ku: "گەڕاندنەوەی پارە", en: "Refund", ar: "استرداد", zh: "退款" },
  CREDIT_DISCOUNT: { ku: "داشکاندن", en: "Discount", ar: "خصم", zh: "折扣" },
  CREDIT_OTHER: { ku: "بڕێکی تری واردە", en: "Other credit", ar: "دائن آخر", zh: "其他入账" },
  ADJUSTMENT_DEBIT: { ku: "ڕاستکردنەوە (زیادکردن)", en: "Adjustment — added", ar: "تسوية — إضافة", zh: "调整 — 增加" },
  ADJUSTMENT_CREDIT: { ku: "ڕاستکردنەوە (کەمکردنەوە)", en: "Adjustment — deducted", ar: "تسوية — خصم", zh: "调整 — 减少" },
};

export const INVOICE_STATE_LABEL: Record<InvoiceState, L> = {
  paid: { ku: "پارەدراو", en: "Paid", ar: "مدفوعة", zh: "已支付" },
  unpaid: { ku: "نەدراو", en: "Unpaid", ar: "غير مدفوعة", zh: "未支付" },
  partial: { ku: "بەشێکی دراوە", en: "Partially paid", ar: "مدفوعة جزئياً", zh: "部分支付" },
  cancelled: { ku: "هەڵوەشێنراو", en: "Cancelled", ar: "ملغاة", zh: "已取消" },
  refunded: { ku: "گەڕێنراوەتەوە", en: "Refunded", ar: "مُستردة", zh: "已退款" },
};

/** Tailwind classes per state, so the colour agrees with the word everywhere. */
export const INVOICE_STATE_TONE: Record<InvoiceState, { chip: string; dot: string; text: string }> = {
  paid: {
    chip: "bg-emerald-100 dark:bg-emerald-900/30",
    dot: "bg-emerald-500",
    text: "text-emerald-700 dark:text-emerald-400",
  },
  unpaid: {
    chip: "bg-amber-100 dark:bg-amber-900/30",
    dot: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-400",
  },
  partial: {
    chip: "bg-amber-100 dark:bg-amber-900/30",
    dot: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-400",
  },
  cancelled: {
    chip: "bg-red-100 dark:bg-red-900/30",
    dot: "bg-red-500",
    text: "text-red-700 dark:text-red-400",
  },
  refunded: {
    chip: "bg-slate-200 dark:bg-slate-800",
    dot: "bg-slate-500",
    text: "text-slate-700 dark:text-slate-300",
  },
};

/** Plain-English (and Kurdish/Arabic/Chinese) state for the printed invoice,
 *  which the customer keeps and shows to other people. */
export const INVOICE_STATE_PRINT: Record<InvoiceState, string> = {
  paid: "PAID",
  unpaid: "UNPAID",
  partial: "PARTIALLY PAID",
  cancelled: "CANCELLED",
  refunded: "REFUNDED",
};

/**
 * There is no dinar formatter here any more, on purpose.
 *
 * The books do carry IQD — invoices have totalIqd, ledger lines have
 * amountIqd — and the portal briefly showed both currencies side by side.
 * The office's call was that one currency is clearer: two figures against
 * one charge is a question a customer asks support rather than an answer
 * they read. The portal quotes, charges and settles in USD.
 *
 * The public price list is the exception and keeps its own IQD line, behind
 * the showIqdEquivalent setting the office controls — there a customer is
 * deciding whether to buy, not reconciling what they were charged.
 */

/**
 * A ledger line's description, in the customer's language.
 *
 * The description is written in Kurdish when the charge is posted and stored
 * as a sentence — `پاکەت YT8845140653126 - باچ SEA-2026-004`. That is
 * accounting data, already written on rows going back years, and the posting
 * side is not something to reach into. But a Chinese customer opening their
 * statement was reading a Chinese page with a Kurdish sentence in the middle
 * of every row, which is worse than it sounds: it is the row that tells them
 * *which parcel* a charge was for.
 *
 * The sentence has no prose in it. Everything that carries meaning is a code —
 * a tracking number and a batch code — so the stored shapes are recognised
 * here and written out again around the same codes in the language being read.
 *
 * Anything that does not match a known shape is returned exactly as stored. A
 * description we cannot parse is still the only record of what a charge was
 * for, and dropping it to avoid showing Kurdish would be the worse trade.
 */
export function describeLedgerRef(
  description: string | null | undefined,
  language: string,
): string {
  const raw = (description ?? "").trim();
  if (!raw) return "";

  const PARCEL: L = { ku: "پاکەت", en: "Parcel", ar: "طرد", zh: "包裹" };
  const BATCH: L = { ku: "باچ", en: "Shipment", ar: "شحنة", zh: "批次" };
  const LATE: L = {
    ku: "چارجی دواکەوتوو",
    en: "late charge",
    ar: "رسم متأخر",
    zh: "补收费用",
  };
  const pick = (l: L) => l[(["ku", "en", "ar", "zh"].includes(language) ? language : "en") as keyof L];

  // `پاکەت <tracking> - باچ <batch>`, optionally trailed by `(چارجی دواکەوتوو)`.
  const both = raw.match(/^پاکەت\s+(\S+)\s*-\s*باچ\s*(\S*)\s*(\(چارجی دواکەوتوو\))?$/);
  if (both) {
    const [, tracking, batch, late] = both;
    const parts = [`${pick(PARCEL)} ${tracking}`];
    if (batch) parts.push(`${pick(BATCH)} ${batch}`);
    const text = parts.join(" · ");
    return late ? `${text} (${pick(LATE)})` : text;
  }

  // `باچ <batch>` on its own, and the no-batch case it is paired with.
  const only = raw.match(/^باچ\s+(\S+)$/);
  if (only) return `${pick(BATCH)} ${only[1]}`;
  if (raw === "بێ باچ") {
    return pick({ ku: "بێ باچ", en: "No shipment", ar: "بدون شحنة", zh: "无批次" });
  }

  return raw;
}

/**
 * The sign in front of an amount on the customer's statement.
 *
 * Money the customer paid us is `+`; money we charged them is `-`. That is
 * the customer's own point of view — a delivery fee is money leaving their
 * pocket — and it is what the two newer skins already did.
 *
 * The classic page did the opposite: `isCreditTx ? "-" : "+"`, following the
 * balance rather than the customer, so a delivery fee read `+$2.29` in red.
 * A plus sign beside money someone owes reads as money arriving. The same
 * transaction carried the opposite sign depending on which skin the office
 * had switched on.
 *
 * Note this is deliberately NOT the sign of the balance. A positive balance
 * means the customer owes us and a negative one means we owe them, which is
 * the ordinary receivables convention and is correct — but the balance says
 * so in words ("قەرزت هەیە"), so nothing has to be inferred from a sign.
 */
export function txSign(transactionType: string | null | undefined): "+" | "-" {
  return isCreditTx(transactionType) ? "+" : "-";
}
