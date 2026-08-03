/**
 * How much money a customer has actually handed over against one order,
 * before the goods are delivered.
 *
 * This is subtracted from what they owe at the delivery box, so getting it
 * wrong short-changes the company by exactly the mistake. It has been got
 * wrong twice, both times the same way, and both times only for one order
 * type — so the rule now lives in one place with the reasoning attached.
 *
 * The trap is a column called `paidFromBalanceUsd`. The name reads like money
 * received. It is not: every writer of it sits immediately after a charge and
 * records the amount BILLED.
 *
 *   batches.router.ts:185   applyChargeToInvoice → DEBIT_FULL_PACKAGE
 *   batches.router.ts:469   applyChargeToInvoice → DEBIT_COMMISSION
 *   fullPackage.router.ts:1561  applyCharge     → DEBIT_FULL_PACKAGE
 *
 * Crediting it turns what the customer owes into what they have supposedly
 * already paid. Reported from production twice:
 *
 *   - commission: an order's full goods value counted as prepaid.
 *   - full_package: a customer who had never paid an advance in their life
 *     showed "−$374.65 advance paid" against a $649.64 box, leaving $274.99
 *     to collect. The whole $649.64 was owed.
 *
 * The only genuine prepayment is `advancePaidUsd` — a real CREDIT_PAYMENT
 * written by the create / bulk-create / edit flows, and precisely what the
 * batch-delivery invoice credits. Matching it keeps the box and the invoice
 * telling the customer the same number.
 */

export type AdvanceSource = {
  orderType: string;
  /** A real payment taken at order time. The only trustworthy figure here. */
  advancePaidUsd?: string | number | null;
  /** Amount BILLED, despite the name. Never a payment on the modern paths. */
  paidFromBalanceUsd?: string | number | null;
  /**
   * Set only by the legacy `createCommissionOrder`, which charged the wallet
   * at creation. For those historical rows the goods really were paid for up
   * front, and `paidFromBalanceUsd` is the amount taken.
   */
  isPrepaid?: boolean | null;
};

const money = (v: unknown): number => {
  if (v === null || v === undefined || v === '') return 0;
  const n = parseFloat(String(v));
  // Negatives would credit the customer for money nobody received.
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** What this one order has genuinely been paid, in USD. */
export function orderAdvancePaidUsd(order: AdvanceSource): number {
  const advance = money(order.advancePaidUsd);

  if (order.orderType === 'commission') {
    // Legacy prepaid commissions took the money from the wallet at creation,
    // so for those rows — and only those — the billed column is a payment.
    // Modern orders never set isPrepaid, so this cannot reintroduce the
    // over-credit it is carved out for.
    const legacyPrepaid = order.isPrepaid ? money(order.paidFromBalanceUsd) : 0;
    return Math.max(advance, legacyPrepaid);
  }

  if (order.orderType === 'full_package' || order.orderType === 'purchase_request') {
    return advance;
  }

  return 0;
}
