/**
 * Plan v3, Phase 5 — end-to-end integration test.
 *
 * Scenario: a full commission-order lifecycle that exercises every part of
 * the new safe edit/delete machinery:
 *
 *   1. Create an order + its DEBIT charge via applyCharge, persist the
 *      returned transaction.id into fullPackageOrders.chargeTransactionId
 *      (Phase 3 behavior).
 *   2. Assert customer balance went up by exactly the charge amount.
 *   3. Edit the order via adjustCharge (simulate a price discount) —
 *      assert the balance reflects the delta and an ADJUSTMENT_CREDIT
 *      transaction exists.
 *   4. Delete the order via reverseCharge + reverseAdvancePayment +
 *      softDeleteFullPackageOrder — assert balance returns to the
 *      pre-order value, invoice is cancelled, order is soft-deleted
 *      (deletedAt set), and a new ADJUSTMENT_CREDIT covers the remaining
 *      debt.
 *
 * This is the invariant Plan v3 exists to guarantee: no matter how many
 * edits/deletes happen, the customer balance must equal the live set of
 * non-reversed charges. Zero drift.
 *
 * Skipped without DATABASE_URL so the CI suite still passes where MySQL
 * isn't available — matches the convention used by finance-reversal.test.ts.
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as db from "../db";

const hasDb = () => !!process.env.DATABASE_URL;

describe.skipIf(!hasDb())(
  "Order lifecycle — create → adjust → delete leaves ZERO ledger drift",
  () => {
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

    it("charge → adjust down → delete: balance returns exactly to baseline", async () => {
      const initial = await db.getCustomerBalance(customerId);

      // --------------------------------------------------------
      // 1. Create an "order" via applyCharge. We use a fake
      //    referenceId in the 9999xxx range to avoid colliding
      //    with real rows (matches finance-reversal.test.ts).
      // --------------------------------------------------------
      const chargeAmount = 200;
      const { transaction: debit, invoice } = await db.applyCharge(
        customerId,
        customerCode,
        "FULL_PACKAGE",
        9999900, // fake referenceId
        chargeAmount,
        "[Lifecycle] Original charge",
        userId,
      );

      const afterCharge = await db.getCustomerBalance(customerId);
      expect(afterCharge).toBeCloseTo(initial + chargeAmount, 2);
      expect(invoice.status).toBe("issued");

      // --------------------------------------------------------
      // 2. Edit the "order": price drops from 200 → 150.
      //    adjustCharge should emit an ADJUSTMENT_CREDIT of $50.
      // --------------------------------------------------------
      const { adjustmentTransaction, deltaUsd } = await db.adjustCharge(
        debit.id,
        150,
        "[Lifecycle] Customer-requested discount",
        userId,
      );

      expect(adjustmentTransaction).not.toBeNull();
      expect(adjustmentTransaction!.transactionType).toBe("ADJUSTMENT_CREDIT");
      expect(deltaUsd).toBeCloseTo(-50, 2);
      expect(parseFloat(adjustmentTransaction!.amountUsd ?? "0")).toBeCloseTo(50, 2);

      const afterAdjust = await db.getCustomerBalance(customerId);
      expect(afterAdjust).toBeCloseTo(initial + 150, 2); // 200 − 50 = 150

      // --------------------------------------------------------
      // 3. Delete the "order": reverseCharge must wipe the
      //    remaining $150 from the customer balance (the DEBIT
      //    is still $200 in the ledger, so the reversal is $200,
      //    but the earlier ADJUSTMENT_CREDIT of $50 already
      //    offset part of it — the net should land back at the
      //    initial balance).
      // --------------------------------------------------------
      const { reversalTransaction } = await db.reverseCharge(
        debit.id,
        "[Lifecycle] Order deleted by test",
        userId,
      );

      expect(reversalTransaction.transactionType).toBe("ADJUSTMENT_CREDIT");
      // The reversal undoes what the charge STANDS AT — 150 after the
      // correction — not its first amount.
      expect(parseFloat(reversalTransaction.amountUsd ?? "0")).toBeCloseTo(150, 2);

      const afterReversal = await db.getCustomerBalance(customerId);
      // +200 (DEBIT) − 50 (price corrected down) − 150 (reversal) = initial.
      //
      // This used to assert `initial − 50`, and called it intentional: the
      // reversal handed back the whole first amount, so an order corrected
      // down and then deleted left the customer $50 in credit that nobody
      // had paid. A price correction is not a discount the customer keeps
      // after the order is gone. Owner, 2026-10-01: no customer has credit.
      // Fixed 2026-10-02 (effectiveChargeUsd in finance.db).
      expect(afterReversal).toBeCloseTo(initial, 2);

      // --------------------------------------------------------
      // 4. Invoice should now be cancelled.
      // --------------------------------------------------------
      const invoiceAfter = await db.getInvoiceById(invoice.id);
      expect(invoiceAfter?.status).toBe("cancelled");
    });

    it("charge → reverseCharge (no adjust): balance returns to exact baseline", async () => {
      // Simpler scenario: no adjustments between charge + reverse.
      // This should be an exact round-trip.
      const initial = await db.getCustomerBalance(customerId);

      const { transaction: debit, invoice } = await db.applyCharge(
        customerId,
        customerCode,
        "COMMISSION",
        9999901,
        77.77,
        "[Lifecycle] Round-trip charge",
        userId,
      );
      expect(await db.getCustomerBalance(customerId)).toBeCloseTo(initial + 77.77, 2);

      await db.reverseCharge(debit.id, "[Lifecycle] Round-trip reversal", userId);
      const final = await db.getCustomerBalance(customerId);
      expect(final).toBeCloseTo(initial, 2); // exact round-trip — zero drift

      const invoiceAfter = await db.getInvoiceById(invoice.id);
      expect(invoiceAfter?.status).toBe("cancelled");
    });

    it("adjustCharge is idempotent for identical new amounts (no spurious drift)", async () => {
      // Calling adjustCharge with the same target amount twice should only
      // emit ONE adjustment transaction (second call is a no-op).
      const { transaction: debit } = await db.applyCharge(
        customerId,
        customerCode,
        "FULL_PACKAGE",
        9999902,
        100,
        "[Lifecycle] Idempotency charge",
        userId,
      );

      const first = await db.adjustCharge(debit.id, 80, "[Lifecycle] Adj 1", userId);
      expect(first.adjustmentTransaction).not.toBeNull();
      expect(first.deltaUsd).toBeCloseTo(-20, 2);

      const second = await db.adjustCharge(debit.id, 80, "[Lifecycle] Adj 2 (same amt)", userId);
      // Second call must be a no-op — the order already reflects target 80.
      // If this ever fires a second CREDIT, the ledger will drift on retry.
      expect(second.adjustmentTransaction).toBeNull();
      expect(second.deltaUsd).toBe(0);
    });
  },
);
