import { describe, expect, it } from "vitest";
import {
  balanceDriftUsd,
  buildAccountStatement,
  chargeEffect,
  chargeKindsShown,
  statementTerms,
  type LedgerAmount,
} from "./accountStatement";

/**
 * The account must explain itself: charges − payments − discounts + other
 * adjustments = balance, cent for cent (owner's audit, 2026-09-16, AZ002).
 * Each row below is what one real writer posts; the running balance beside it
 * is what customerAccounts.currentBalanceUsd would read.
 */
const row = (transactionType: string, referenceType: string | null, amountUsd: number): LedgerAmount => ({
  transactionType,
  referenceType,
  amountUsd,
});

const LIFE_OF_AN_ACCOUNT: LedgerAmount[] = [
  row("DEBIT_FULL_PACKAGE", "full_package", 100), //  100  order charged at entry
  row("CREDIT_PAYMENT", "payment", 30), //             70  advance taken
  row("ADJUSTMENT_CREDIT", "full_package", 20), //     50  price lowered (adjustCharge)
  row("ADJUSTMENT_CREDIT", "full_package", 80), //    -30  order deleted (reverseCharge)
  row("ADJUSTMENT_DEBIT", "adjustment", 30), //         0  its advance reversed (reverseAdvancePayment)
  row("DEBIT_PACKAGE", "package", 50), //              50  shipping on a parcel
  row("CREDIT_DISCOUNT", "package", 5), //             45  box receipt: discount
  row("CREDIT_PAYMENT", "payment", 45), //              0  box receipt: payment
  row("ADJUSTMENT_DEBIT", "adjustment", 50), //        50  box receipt undone (paid + discount)
  row("ADJUSTMENT_CREDIT", "adjustment", 7), //        43  manual correction
  row("CREDIT_DISCOUNT", "adjustment", 3), //          40  batch re-priced down
  row("CREDIT_REFUND", null, 2), //                    38  an old refund row
];

describe("an account explains its own balance", () => {
  const statement = buildAccountStatement(LIFE_OF_AN_ACCOUNT, {
    recordedPaymentReversalsUsd: 30, // the advance reversal updated its payment record
    reversedBoxReceipts: [{ paidUsd: 45, discountUsd: 5, paymentRecordReversedUsd: 0 }], // the box one did not
  });

  it("adds up to the running balance", () => {
    expect(statement.balanceUsd).toBe(38);
    expect(balanceDriftUsd(38, statement)).toBe(0);
  });

  it("counts a lowered price and a deleted order against sales, not as money received", () => {
    expect(statement.grossChargesUsd).toBe(150);
    expect(statement.chargeCorrectionsUsd).toBe(100);
    expect(statement.charges).toMatchObject({ fullPackage: 0, package: 50, total: 50 });
  });

  it("does not call a discount a payment, and takes back what was undone", () => {
    expect(statement.grossPaymentsUsd).toBe(75);
    expect(statement.paymentReversalsUsd).toBe(75);
    expect(statement.paymentsUsd).toBe(0);
    expect(statement.discountsUsd).toBe(3);
  });

  it("keeps what was done by hand visible, with its sign", () => {
    expect(statement.otherAdjustmentsUsd).toBe(-9); // −7 manual, −2 old refund row
  });

  it("holds the identity for every line", () => {
    const { charges, paymentsUsd, discountsUsd, otherAdjustmentsUsd, balanceUsd } = statement;
    expect(Math.round((charges.total - paymentsUsd - discountsUsd + otherAdjustmentsUsd) * 100)).toBe(Math.round(balanceUsd * 100));
  });
});

describe("one rule for what counts as a charge", () => {
  it("adds up to the statement's sales, row by row", () => {
    const statement = buildAccountStatement(LIFE_OF_AN_ACCOUNT, {
      recordedPaymentReversalsUsd: 30,
      reversedBoxReceipts: [{ paidUsd: 45, discountUsd: 5, paymentRecordReversedUsd: 0 }],
    });
    const cents = LIFE_OF_AN_ACCOUNT.reduce((sum, r) => sum + chargeEffect(r) * Math.round(Number(r.amountUsd) * 100), 0);
    expect(cents / 100).toBe(statement.charges.total);
  });

  it("a correction counts against its charge; money and hand adjustments do not", () => {
    expect(chargeEffect(row("DEBIT_COMMISSION", "commission", 1))).toBe(1);
    expect(chargeEffect(row("ADJUSTMENT_CREDIT", "full_package", 1))).toBe(-1);
    expect(chargeEffect(row("ADJUSTMENT_DEBIT", "package", 1))).toBe(1);
    expect(chargeEffect(row("ADJUSTMENT_DEBIT", "adjustment", 1))).toBe(0);
    expect(chargeEffect(row("CREDIT_DISCOUNT", "package", 1))).toBe(0);
    expect(chargeEffect(row("CREDIT_PAYMENT", "payment", 1))).toBe(0);
  });
});

describe("the same undone box receipt is never taken back twice", () => {
  it("once its payment record carries the reversal", () => {
    const statement = buildAccountStatement(
      [row("DEBIT_PACKAGE", "package", 50), row("CREDIT_PAYMENT", "payment", 50), row("ADJUSTMENT_DEBIT", "adjustment", 50)],
      { recordedPaymentReversalsUsd: 50, reversedBoxReceipts: [{ paidUsd: 50, discountUsd: 0, paymentRecordReversedUsd: 50 }] },
    );
    expect(statement.paymentsUsd).toBe(0);
    expect(statement.otherAdjustmentsUsd).toBe(0);
    expect(statement.balanceUsd).toBe(50);
  });
});

describe("cents", () => {
  it("are added whole, so none appear or vanish", () => {
    const statement = buildAccountStatement(
      [row("DEBIT_PACKAGE", "package", 0.1), row("DEBIT_PACKAGE", "package", 0.2), row("CREDIT_PAYMENT", "payment", 0.3)],
      { recordedPaymentReversalsUsd: 0, reversedBoxReceipts: [] },
    );
    expect(statement.charges.package).toBe(0.3);
    expect(statement.balanceUsd).toBe(0);
  });

  it("a stored balance a cent away from its ledger shows as drift", () => {
    const statement = buildAccountStatement([row("DEBIT_SERVICE", "service", 12)], {
      recordedPaymentReversalsUsd: 0,
      reversedBoxReceipts: [],
    });
    expect(balanceDriftUsd("12.01", statement)).toBe(0.01);
  });
});

describe("the AZ002 shape the owner saw", () => {
  it("sales minus paid is not the balance when adjustments exist — the statement says why", () => {
    // Sales $390.49 and "paid" $112.39 on the old cards, balance $130.09.
    // The $148.01 between them is corrections the old cards never read.
    const statement = buildAccountStatement(
      [
        row("DEBIT_PACKAGE", "package", 175.27),
        row("DEBIT_FULL_PACKAGE", "full_package", 133.81),
        row("DEBIT_COMMISSION", "commission", 69.41),
        row("DEBIT_SERVICE", "service", 12),
        row("CREDIT_PAYMENT", "payment", 87.19),
        row("CREDIT_DISCOUNT", "package", 25.2),
        row("ADJUSTMENT_CREDIT", "full_package", 148.01),
      ],
      { recordedPaymentReversalsUsd: 0, reversedBoxReceipts: [] },
    );
    expect(statement.balanceUsd).toBe(130.09);
    expect(statement.paymentsUsd).toBe(87.19); // what the portal shows
    expect(statement.discountsUsd).toBe(25.2);
    expect(statement.charges.total).toBe(242.48);
  });
});

describe("the line a person can check with a calculator", () => {
  const empty = { recordedPaymentReversalsUsd: 0, reversedBoxReceipts: [] };

  it("an ordinary account reads sales − paid = balance", () => {
    const statement = buildAccountStatement(
      [row("DEBIT_PACKAGE", "package", 40), row("CREDIT_PAYMENT", "payment", 15)],
      empty,
    );
    expect(statementTerms(statement).map((t) => `${t.operator}${t.key}:${t.amountUsd}`)).toEqual([
      "sales:40",
      "-payments:15",
      "=balance:25",
    ]);
  });

  it("discounts and adjustments join the line only when there are any, each with its sign", () => {
    const statement = buildAccountStatement(
      [
        row("DEBIT_PACKAGE", "package", 100),
        row("CREDIT_PAYMENT", "payment", 50),
        row("CREDIT_DISCOUNT", "package", 10),
        row("ADJUSTMENT_CREDIT", "adjustment", 7),
      ],
      empty,
    );
    const terms = statementTerms(statement);
    expect(terms.map((t) => `${t.operator}${t.key}:${t.amountUsd}`)).toEqual([
      "sales:100",
      "-payments:50",
      "-discounts:10",
      "-otherAdjustments:7",
      "=balance:33",
    ]);
    expect(terms.find((t) => t.key === "otherAdjustments")?.signedUsd).toBe(-7);
  });

  it("the line always comes to its own last term", () => {
    for (const rows of [LIFE_OF_AN_ACCOUNT, [row("ADJUSTMENT_DEBIT", "adjustment", 12.34)]]) {
      const terms = statementTerms(buildAccountStatement(rows, empty));
      const cents = terms
        .filter((t) => t.key !== "balance")
        .reduce((sum, t) => sum + (t.operator === "-" ? -1 : 1) * Math.round(t.amountUsd * 100), 0);
      expect(cents).toBe(Math.round(terms[terms.length - 1].amountUsd * 100));
    }
  });

  it("purchase requests get a tile only when the customer has one", () => {
    expect(chargeKindsShown(buildAccountStatement([row("DEBIT_PACKAGE", "package", 1)], empty))).toEqual([
      "package",
      "fullPackage",
      "commission",
      "service",
    ]);
    expect(
      chargeKindsShown(buildAccountStatement([row("DEBIT_PURCHASE_REQUEST", "purchase_request", 5)], empty)),
    ).toContain("purchaseRequest");
  });
});
