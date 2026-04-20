/**
 * Plan v3, Phase 2 — unit tests for reverseCharge and adjustCharge.
 *
 * Every test creates its own DEBIT via applyCharge first, then exercises the
 * helper under test and asserts on the exact resulting ledger/account state.
 *
 * The tests are skipped automatically when DATABASE_URL is unset so the suite
 * still passes in CI environments that don't run MySQL. Existing
 * finance-transactions.test.ts and finance-precision.test.ts follow the same
 * convention.
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as db from "../db";

const hasDb = () => !!process.env.DATABASE_URL;

describe.skipIf(!hasDb())("reverseCharge — full reversal of a DEBIT", () => {
  let customerId: number;
  let customerCode: string;
  const userId = 1;

  beforeAll(async () => {
    const customers = await db.getAllCustomers();
    if (customers.length === 0) throw new Error("No customers found for testing");
    customerId = customers[0].id;
    customerCode = customers[0].customerCode ?? `C${customers[0].id}`;
    await db.getOrCreateCustomerAccount(customerId, customerCode);
  });

  it("should undo the exact DEBIT amount and leave balance unchanged", async () => {
    const balanceBefore = await db.getCustomerBalance(customerId);
    const amount = 137.5;

    const { transaction, invoice } = await db.applyCharge(
      customerId, customerCode, "FULL_PACKAGE", 9999001, amount,
      "Test charge for reversal", userId,
    );
    const balanceAfterCharge = await db.getCustomerBalance(customerId);
    expect(balanceAfterCharge).toBeCloseTo(balanceBefore + amount, 2);

    // Reverse it.
    const { reversalTransaction } = await db.reverseCharge(
      transaction.id, "Order deleted by test", userId,
    );

    expect(reversalTransaction.transactionType).toBe("ADJUSTMENT_CREDIT");
    expect(parseFloat(reversalTransaction.amountUsd ?? "0")).toBeCloseTo(amount, 2);
    expect(parseFloat(reversalTransaction.balanceAfterUsd ?? "0"))
      .toBeCloseTo(balanceBefore, 2);

    const balanceFinal = await db.getCustomerBalance(customerId);
    expect(balanceFinal).toBeCloseTo(balanceBefore, 2);

    // Linked invoice must now be cancelled.
    const invoiceNow = await db.getInvoiceById(invoice.id);
    expect(invoiceNow?.status).toBe("cancelled");
  });

  it("should be idempotent — calling reverseCharge twice returns the same reversal", async () => {
    const { transaction } = await db.applyCharge(
      customerId, customerCode, "FULL_PACKAGE", 9999002, 40,
      "Test charge for idempotency", userId,
    );
    const first = await db.reverseCharge(transaction.id, "Idempotent test", userId);
    const second = await db.reverseCharge(transaction.id, "Idempotent test (second call)", userId);
    expect(second.reversalTransaction.id).toBe(first.reversalTransaction.id);
  });

  it("should refuse to reverse non-DEBIT transactions", async () => {
    // recordPaymentReceived produces a CREDIT_PAYMENT, which must not be
    // reversible via reverseCharge (you'd use reverseAdvancePayment for that).
    const { transaction } = await db.recordPaymentReceived(
      customerId, customerCode, 20, 0, "CASH", userId, "Payment for guard test",
    );
    await expect(db.reverseCharge(transaction.id, "Should fail", userId))
      .rejects.toThrow(/cannot be reversed/);
  });

  it("should reject missing/short reason", async () => {
    const { transaction } = await db.applyCharge(
      customerId, customerCode, "FULL_PACKAGE", 9999003, 10,
      "Test charge", userId,
    );
    await expect(db.reverseCharge(transaction.id, "", userId)).rejects.toThrow();
    await expect(db.reverseCharge(transaction.id, "xx", userId)).rejects.toThrow();
  });
});

describe.skipIf(!hasDb())("adjustCharge — delta-based edit of a DEBIT", () => {
  let customerId: number;
  let customerCode: string;
  const userId = 1;

  beforeAll(async () => {
    const customers = await db.getAllCustomers();
    if (customers.length === 0) throw new Error("No customers found for testing");
    customerId = customers[0].id;
    customerCode = customers[0].customerCode ?? `C${customers[0].id}`;
    await db.getOrCreateCustomerAccount(customerId, customerCode);
  });

  it("should emit ADJUSTMENT_DEBIT when new amount is higher", async () => {
    const balanceBefore = await db.getCustomerBalance(customerId);
    const { transaction } = await db.applyCharge(
      customerId, customerCode, "FULL_PACKAGE", 9999101, 80,
      "Test charge for upward adjust", userId,
    );

    const { adjustmentTransaction, deltaUsd } = await db.adjustCharge(
      transaction.id, 100, "Price increased by customer request", userId,
    );

    expect(adjustmentTransaction).not.toBeNull();
    expect(adjustmentTransaction!.transactionType).toBe("ADJUSTMENT_DEBIT");
    expect(parseFloat(adjustmentTransaction!.amountUsd ?? "0")).toBeCloseTo(20, 2);
    expect(deltaUsd).toBeCloseTo(20, 2);

    const balanceFinal = await db.getCustomerBalance(customerId);
    expect(balanceFinal).toBeCloseTo(balanceBefore + 100, 2); // 80 + 20 = 100 total debt
  });

  it("should emit ADJUSTMENT_CREDIT when new amount is lower", async () => {
    const balanceBefore = await db.getCustomerBalance(customerId);
    const { transaction } = await db.applyCharge(
      customerId, customerCode, "FULL_PACKAGE", 9999102, 100,
      "Test charge for downward adjust", userId,
    );

    const { adjustmentTransaction, deltaUsd } = await db.adjustCharge(
      transaction.id, 60, "Price discount applied", userId,
    );

    expect(adjustmentTransaction).not.toBeNull();
    expect(adjustmentTransaction!.transactionType).toBe("ADJUSTMENT_CREDIT");
    expect(parseFloat(adjustmentTransaction!.amountUsd ?? "0")).toBeCloseTo(40, 2);
    expect(deltaUsd).toBeCloseTo(-40, 2);

    const balanceFinal = await db.getCustomerBalance(customerId);
    expect(balanceFinal).toBeCloseTo(balanceBefore + 60, 2);
  });

  it("should be a no-op when the amount is unchanged", async () => {
    const { transaction } = await db.applyCharge(
      customerId, customerCode, "FULL_PACKAGE", 9999103, 55,
      "Test charge for no-op adjust", userId,
    );
    const { adjustmentTransaction, deltaUsd } = await db.adjustCharge(
      transaction.id, 55, "No real change, form saved anyway", userId,
    );
    expect(adjustmentTransaction).toBeNull();
    expect(deltaUsd).toBe(0);
  });

  it("should treat sub-cent diffs as no-op (float tolerance)", async () => {
    const { transaction } = await db.applyCharge(
      customerId, customerCode, "FULL_PACKAGE", 9999104, 33.33,
      "Test charge for tolerance adjust", userId,
    );
    const { adjustmentTransaction } = await db.adjustCharge(
      transaction.id, 33.331, "Float jitter", userId,
    );
    expect(adjustmentTransaction).toBeNull();
  });

  it("should reject negative new amount", async () => {
    const { transaction } = await db.applyCharge(
      customerId, customerCode, "FULL_PACKAGE", 9999105, 10,
      "Test charge", userId,
    );
    await expect(db.adjustCharge(transaction.id, -5, "bad", userId)).rejects.toThrow(/negative/);
  });
});
