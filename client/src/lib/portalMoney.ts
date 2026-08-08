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

/** Positive means the customer owes us. Set by finance.db: a payment does
 *  `currentBalanceUsd - amountUsd`, and the debtors report counts `> 0`. */
export function isDebt(balanceUsd: number | null | undefined): boolean {
  return Number(balanceUsd ?? 0) > 0;
}

/**
 * Money moving toward the customer (a payment they made, a refund, a discount).
 *
 * The enum has two shapes — `CREDIT_PAYMENT` and `ADJUSTMENT_CREDIT` — and the
 * classic page only ever tested the first, so a manual credit adjustment was
 * shown to the customer as another charge.
 */
export function isCreditTx(transactionType: string | null | undefined): boolean {
  const t = String(transactionType ?? "").toUpperCase();
  return t.startsWith("CREDIT_") || t.endsWith("_CREDIT");
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
