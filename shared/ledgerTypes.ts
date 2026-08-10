/**
 * Which ledger lines are money in, and which are money out.
 *
 * This question was answered in four places and one of them was wrong.
 *
 *  - the classic money page asked `startsWith("DEBIT_")`
 *  - the modern and skin3 pages asked `!isCreditTx(...)`
 *  - the PDF statement carried its own two hand-written lists
 *
 * `ADJUSTMENT_DEBIT` — a correction an accountant enters by hand — does not
 * begin with `DEBIT_`. So the classic page counted it as neither a charge nor
 * a payment: it vanished from the monthly total and from the six-month chart,
 * while the PDF statement the same customer downloads counted it correctly.
 * Two Wazn documents, the same money, different figures. That is a phone call
 * to the office, and the office has no way to see which number is right.
 *
 * So the enum is split once, here, and everything else asks this. Anything
 * server-side that needs it for a SQL `IN (...)` uses the arrays; anything
 * rendering a row uses the predicates. `ledgerTypes.test.ts` fails if the
 * database enum ever grows a value that lands in neither list.
 */

/** Money the customer owes us: charges, fees, and manual debit corrections. */
export const CHARGE_TX_TYPES = [
  "DEBIT_PACKAGE",
  "DEBIT_FULL_PACKAGE",
  "DEBIT_PURCHASE_REQUEST",
  "DEBIT_COMMISSION",
  "DEBIT_SERVICE",
  "DEBIT_PENALTY",
  "DEBIT_OTHER",
  "ADJUSTMENT_DEBIT",
] as const;

/** Money moving toward the customer: payments, deposits, refunds, discounts. */
export const PAYMENT_TX_TYPES = [
  "CREDIT_PAYMENT",
  "CREDIT_DEPOSIT",
  "CREDIT_REFUND",
  "CREDIT_DISCOUNT",
  "CREDIT_OTHER",
  "ADJUSTMENT_CREDIT",
] as const;

export type ChargeTxType = (typeof CHARGE_TX_TYPES)[number];
export type PaymentTxType = (typeof PAYMENT_TX_TYPES)[number];

const CHARGES: ReadonlySet<string> = new Set(CHARGE_TX_TYPES);
const PAYMENTS: ReadonlySet<string> = new Set(PAYMENT_TX_TYPES);

/** Money moving toward the customer (a payment, a refund, a discount). */
export function isPaymentTx(transactionType: string | null | undefined): boolean {
  return PAYMENTS.has(String(transactionType ?? "").toUpperCase());
}

/**
 * Money the customer owes.
 *
 * Named rather than derived as "not a payment": an unrecognised value must not
 * silently become a charge on somebody's statement. A value in neither list is
 * neither, and the test above makes that impossible for values we ship.
 */
export function isChargeTx(transactionType: string | null | undefined): boolean {
  return CHARGES.has(String(transactionType ?? "").toUpperCase());
}
