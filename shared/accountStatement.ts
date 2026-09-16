/**
 * One customer's account, explained so that the parts add up to the balance.
 *
 * The same account was read four ways, and none of them added up:
 *
 *  - the staff profile's "total sales" was every DEBIT_* row and its "total
 *    paid" was every CREDIT_* row — discounts counted as money received, and
 *    every ADJUSTMENT_* row (a price lowered, an order deleted, a payment or a
 *    box receipt undone) left out of both;
 *  - the portal's "total paid" came from the payment records instead, so it
 *    left the discounts out and disagreed with the office by exactly that;
 *  - the statement PDF counted charges without their corrections;
 *  - the balance itself, on every screen, was the account's running figure,
 *    which does include all of it.
 *
 * So "sales − paid" never came to the balance, and the customer and the
 * accountant each had a different "paid".
 *
 * Here every ledger row lands in exactly one line, and the lines are defined
 * so that, cent for cent:
 *
 *     charges − payments − discounts + other adjustments = balance
 *
 *  - charges: DEBIT_* by kind, net of the corrections posted against the same
 *    kind of charge (reverseCharge / adjustCharge carry the charge's own
 *    reference type), so a price lowered or an order deleted is not "sales";
 *  - payments: money received (CREDIT_PAYMENT, CREDIT_DEPOSIT) less what was
 *    handed back or undone — the reversals the payment records carry, plus
 *    box receipts undone before those records were kept up to date;
 *  - discounts: CREDIT_DISCOUNT less the discounts of box receipts undone;
 *  - other adjustments: whatever else moved the balance by hand — manual
 *    corrections, batch re-pricing, balance repairs, old refund rows — signed,
 *    positive when it raised what the customer owes.
 *
 * Nothing here reads or writes the database; the server gathers the sums.
 * Amounts are added in whole cents, so no fraction of a cent can appear or
 * vanish on the way.
 */

export const CHARGE_KINDS = ["package", "fullPackage", "purchaseRequest", "commission", "service"] as const;
export type ChargeKind = (typeof CHARGE_KINDS)[number];

const DEBIT_KIND: Readonly<Record<string, ChargeKind>> = {
  DEBIT_PACKAGE: "package",
  DEBIT_FULL_PACKAGE: "fullPackage",
  DEBIT_PURCHASE_REQUEST: "purchaseRequest",
  DEBIT_COMMISSION: "commission",
  DEBIT_SERVICE: "service",
  DEBIT_PENALTY: "service",
  DEBIT_OTHER: "service",
};

/** A correction belongs to the kind of charge whose reference it carries. */
const REFERENCE_KIND: Readonly<Record<string, ChargeKind>> = {
  package: "package",
  full_package: "fullPackage",
  purchase_request: "purchaseRequest",
  commission: "commission",
  service: "service",
};

/** One ledger row, or the sum of rows sharing a type and a reference type. */
export interface LedgerAmount {
  transactionType: string;
  referenceType: string | null;
  amountUsd: number | string | null;
}

/** A box receipt that was undone. */
export interface ReversedBoxReceipt {
  paidUsd: number | string | null;
  discountUsd: number | string | null;
  /** What the receipt's payment record already shows as reversed. */
  paymentRecordReversedUsd: number | string | null;
}

export interface StatementFacts {
  /** Σ paymentRecords.reversedAmountUsd for the account. */
  recordedPaymentReversalsUsd: number | string | null;
  reversedBoxReceipts: readonly ReversedBoxReceipt[];
}

export interface AccountStatement {
  /** Net of corrections, by kind; `total` is their sum. */
  charges: Record<ChargeKind, number> & { total: number };
  /** Every DEBIT_* row as posted. */
  grossChargesUsd: number;
  /** How much corrections took off the charges (negative if they added). */
  chargeCorrectionsUsd: number;
  /** Money received, net of what was reversed or refunded. */
  paymentsUsd: number;
  grossPaymentsUsd: number;
  paymentReversalsUsd: number;
  /** Discounts given, net of discounts undone. */
  discountsUsd: number;
  /** Everything else, signed: positive raised the balance, negative lowered it. */
  otherAdjustmentsUsd: number;
  /** What the ledger adds up to: charges − payments − discounts + other. */
  balanceUsd: number;
}

const toCents = (value: number | string | null | undefined): number => {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};
const fromCents = (cents: number): number => cents / 100;

export function buildAccountStatement(rows: readonly LedgerAmount[], facts: StatementFacts): AccountStatement {
  const charges: Record<ChargeKind, number> = { package: 0, fullPackage: 0, purchaseRequest: 0, commission: 0, service: 0 };
  let grossCharges = 0;
  let corrections = 0; // cents taken off the charges
  let grossPayments = 0;
  let grossDiscounts = 0;
  let pool = 0; // signed cents from rows that are not tied to a charge

  for (const row of rows) {
    const type = String(row.transactionType ?? "").toUpperCase();
    const cents = toCents(row.amountUsd);
    const debitKind = DEBIT_KIND[type];
    if (debitKind) {
      charges[debitKind] += cents;
      grossCharges += cents;
      continue;
    }
    if (type === "CREDIT_PAYMENT" || type === "CREDIT_DEPOSIT") {
      grossPayments += cents;
      continue;
    }
    if (type === "CREDIT_DISCOUNT") {
      grossDiscounts += cents;
      continue;
    }
    if (type === "CREDIT_REFUND" || type === "CREDIT_OTHER") {
      pool -= cents; // old credit rows: they lowered the balance
      continue;
    }
    if (type === "ADJUSTMENT_DEBIT" || type === "ADJUSTMENT_CREDIT") {
      const sign = type === "ADJUSTMENT_DEBIT" ? 1 : -1;
      const kind = row.referenceType ? REFERENCE_KIND[String(row.referenceType)] : undefined;
      if (kind) {
        charges[kind] += sign * cents;
        corrections -= sign * cents;
      } else {
        pool += sign * cents;
      }
    }
    // Any other value moves nothing — shared/ledgerTypes.test.ts keeps the enum closed.
  }

  const recorded = toCents(facts.recordedPaymentReversalsUsd);
  let boxPaidNotRecorded = 0;
  let boxDiscountsUndone = 0;
  for (const receipt of facts.reversedBoxReceipts) {
    boxPaidNotRecorded += Math.max(0, toCents(receipt.paidUsd) - toCents(receipt.paymentRecordReversedUsd));
    boxDiscountsUndone += toCents(receipt.discountUsd);
  }
  const paymentReversals = recorded + boxPaidNotRecorded;

  const chargesTotal = CHARGE_KINDS.reduce((sum, kind) => sum + charges[kind], 0);
  const payments = grossPayments - paymentReversals;
  const discounts = grossDiscounts - boxDiscountsUndone;
  // The reversal rows sit in the pool; what they undid now lives inside
  // payments and discounts, so it leaves the pool here and the identity stays exact.
  const other = pool - paymentReversals - boxDiscountsUndone;
  const balance = chargesTotal - payments - discounts + other;

  return {
    charges: {
      package: fromCents(charges.package),
      fullPackage: fromCents(charges.fullPackage),
      purchaseRequest: fromCents(charges.purchaseRequest),
      commission: fromCents(charges.commission),
      service: fromCents(charges.service),
      total: fromCents(chargesTotal),
    },
    grossChargesUsd: fromCents(grossCharges),
    chargeCorrectionsUsd: fromCents(corrections),
    paymentsUsd: fromCents(payments),
    grossPaymentsUsd: fromCents(grossPayments),
    paymentReversalsUsd: fromCents(paymentReversals),
    discountsUsd: fromCents(discounts),
    otherAdjustmentsUsd: fromCents(other),
    balanceUsd: fromCents(balance),
  };
}

/** The account's own running figure against what its ledger adds up to. */
export function balanceDriftUsd(storedBalanceUsd: number | string | null, statement: AccountStatement): number {
  return fromCents(toCents(storedBalanceUsd) - toCents(statement.balanceUsd));
}

/** What each kind of charge is called, in the reader's language. */
export const CHARGE_KIND_LABELS: Readonly<Record<ChargeKind, { ku: string; en: string; ar: string; zh: string }>> = {
  package: { ku: "نرخی پاکەتەکان", en: "Package charges", ar: "رسوم الطرود", zh: "包裹费用" },
  fullPackage: { ku: "نرخی پاکێجی تەواو", en: "Full package charges", ar: "رسوم الحزمة الكاملة", zh: "完整套餐费用" },
  purchaseRequest: { ku: "نرخی داواکاری کڕین", en: "Purchase request charges", ar: "رسوم طلبات الشراء", zh: "采购申请费用" },
  commission: { ku: "نرخی عموڵە", en: "Commission charges", ar: "رسوم العمولة", zh: "佣金费用" },
  service: { ku: "نرخی خزمەتگوزاری", en: "Service charges", ar: "رسوم الخدمة", zh: "服务费用" },
};

export type StatementTermKey = "sales" | "payments" | "discounts" | "otherAdjustments" | "balance";

export const STATEMENT_TERM_LABELS: Readonly<Record<StatementTermKey, { ku: string; en: string; ar: string; zh: string }>> = {
  sales: { ku: "کۆی فرۆشتن", en: "Total sales", ar: "إجمالي المبيعات", zh: "销售总额" },
  payments: { ku: "کۆی پارەدان", en: "Total paid", ar: "إجمالي المدفوع", zh: "已付总额" },
  discounts: { ku: "داشکاندن", en: "Discounts", ar: "الخصومات", zh: "折扣" },
  otherAdjustments: { ku: "ڕێکخستنی تر", en: "Other adjustments", ar: "تسويات أخرى", zh: "其他调整" },
  balance: { ku: "باڵانس", en: "Balance", ar: "الرصيد", zh: "余额" },
};

export interface StatementTerm {
  key: StatementTermKey;
  /** How the term joins the one before it; empty for the first. */
  operator: "" | "+" | "-" | "=";
  /** As printed after the operator — the operator carries the sign. */
  amountUsd: number;
  /** The same amount with its own sign, for a spreadsheet cell. */
  signedUsd: number;
}

/**
 * The statement as one line a person can check with a calculator:
 *
 *     sales − paid − discounts ± other adjustments = balance
 *
 * Discounts and other adjustments are left out when they are zero, so an
 * ordinary account reads "sales − paid = balance". Every screen and document
 * that prints the line takes it from here, so they print the same line.
 */
export function statementTerms(statement: AccountStatement): StatementTerm[] {
  const terms: StatementTerm[] = [
    { key: "sales", operator: "", amountUsd: statement.charges.total, signedUsd: statement.charges.total },
    { key: "payments", operator: "-", amountUsd: statement.paymentsUsd, signedUsd: statement.paymentsUsd },
  ];
  if (statement.discountsUsd !== 0) {
    terms.push({ key: "discounts", operator: "-", amountUsd: statement.discountsUsd, signedUsd: statement.discountsUsd });
  }
  if (statement.otherAdjustmentsUsd !== 0) {
    terms.push({
      key: "otherAdjustments",
      operator: statement.otherAdjustmentsUsd < 0 ? "-" : "+",
      amountUsd: Math.abs(statement.otherAdjustmentsUsd),
      signedUsd: statement.otherAdjustmentsUsd,
    });
  }
  terms.push({ key: "balance", operator: "=", amountUsd: statement.balanceUsd, signedUsd: statement.balanceUsd });
  return terms;
}

/** The kinds of charge a screen shows: the usual four always, purchase requests when there are any. */
export function chargeKindsShown(statement: AccountStatement): ChargeKind[] {
  return CHARGE_KINDS.filter((kind) => kind !== "purchaseRequest" || statement.charges[kind] !== 0);
}
