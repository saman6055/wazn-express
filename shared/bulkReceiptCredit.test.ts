import { describe, it, expect } from "vitest";
import { bulkReceiptCredit, balanceSign, BULK_RECEIPT_FIX_MARK, BULK_RECEIPT_FIX_REASON } from "./bulkReceiptCredit";

const row = (transactionType: string, amountUsd: number, createdAt: string, description = "") =>
  ({ transactionType, amountUsd, createdAt, description });

/**
 * The cases are real accounts from the ledger read on 2026-10-02.
 */
describe("the credit one day of box receipts created", () => {
  it("AZ173: 41.47 owed, 67.61 charged and 156.58 receipted that day → 47.50", () => {
    const rows = [
      row("DEBIT_PACKAGE", 54.5, "2026-07-16T10:00:00.000Z"),
      row("ADJUSTMENT_CREDIT", 54.5, "2026-08-14T10:00:00.000Z", "[ڕێکخستنی دەستی] …"),
      row("DEBIT_PACKAGE", 41.47, "2026-09-03T10:00:00.000Z"),
      row("DEBIT_PACKAGE", 67.61, "2026-09-10T12:00:00.000Z"),
      row("CREDIT_PAYMENT", 156.58, "2026-09-10T13:00:00.000Z", "BOX-…"),
      row("DEBIT_PACKAGE", 35.47, "2026-09-19T10:00:00.000Z"),
      row("CREDIT_PAYMENT", 22.21, "2026-09-26T10:00:00.000Z", "BOX-20260919-008"),
    ];
    const r = bulkReceiptCredit(rows);
    expect(r.balanceUsd).toBe(-34.24);
    expect(r.phantomUsd).toBe(47.5);
    expect(r.correctedUsd, "what Sabah really owes: the one unpaid parcel").toBe(13.26);
  });

  it("an account charged $123.54 in its life and receipted $1,190.97 that day", () => {
    const r = bulkReceiptCredit([
      row("DEBIT_PACKAGE", 123.54, "2026-07-08T10:00:00.000Z"),
      row("ADJUSTMENT_CREDIT", 123.54, "2026-08-14T10:00:00.000Z"),
      row("CREDIT_PAYMENT", 1190.97, "2026-09-10T15:00:00.000Z", "BOX-…"),
    ]);
    expect(r.phantomUsd).toBe(1190.97);
    expect(r.correctedUsd).toBe(0);
  });

  it("an account whose receipts only paid what it owed gets no correction", () => {
    const r = bulkReceiptCredit([
      row("DEBIT_PACKAGE", 80, "2026-09-01T10:00:00.000Z"),
      row("CREDIT_PAYMENT", 80, "2026-09-10T15:00:00.000Z", "BOX-…"),
    ]);
    expect(r.phantomUsd).toBe(0);
  });

  it("does not depend on the order the day's rows were written in", () => {
    const a = [row("CREDIT_PAYMENT", 50, "2026-09-10T11:00:00.000Z"), row("DEBIT_PACKAGE", 20, "2026-09-10T12:00:00.000Z")];
    const b = [a[1], a[0]];
    expect(bulkReceiptCredit(a).phantomUsd).toBe(30);
    expect(bulkReceiptCredit(b).phantomUsd).toBe(30);
  });

  it("a debt that later swallowed the credit is still corrected in full", () => {
    // −100 that day, then 150 of new parcels: shows 50 owed, truly owes 150.
    const r = bulkReceiptCredit([
      row("CREDIT_PAYMENT", 100, "2026-09-10T11:00:00.000Z"),
      row("DEBIT_PACKAGE", 150, "2026-09-20T11:00:00.000Z"),
    ]);
    expect(r.balanceUsd).toBe(50);
    expect(r.phantomUsd).toBe(100);
    expect(r.correctedUsd).toBe(150);
  });

  it("credit made on any other day is not this repair's business", () => {
    const r = bulkReceiptCredit([row("CREDIT_PAYMENT", 40.15, "2026-09-25T11:00:00.000Z")]);
    expect(r.phantomUsd).toBe(0);
  });

  it("an account already corrected is never corrected twice", () => {
    const rows = [
      row("CREDIT_PAYMENT", 100, "2026-09-10T11:00:00.000Z"),
      row("ADJUSTMENT_DEBIT", 100, "2026-10-02T11:00:00.000Z", `[ڕێکخستنی دەستی] ${BULK_RECEIPT_FIX_REASON}`),
    ];
    const r = bulkReceiptCredit(rows);
    expect(r.alreadyFixed).toBe(true);
    expect(r.phantomUsd).toBe(0);
    expect(r.correctedUsd).toBe(0);
    expect(BULK_RECEIPT_FIX_REASON).toContain(BULK_RECEIPT_FIX_MARK);
  });

  it("adds in cents and reads the ledger's own signs", () => {
    expect(balanceSign("DEBIT_COMMISSION")).toBe(1);
    expect(balanceSign("ADJUSTMENT_DEBIT")).toBe(1);
    for (const t of ["CREDIT_PAYMENT", "CREDIT_DISCOUNT", "ADJUSTMENT_CREDIT"]) expect(balanceSign(t)).toBe(-1);
    const r = bulkReceiptCredit([row("CREDIT_PAYMENT", 0.1, "2026-09-10T11:00:00.000Z"), row("CREDIT_PAYMENT", 0.2, "2026-09-10T11:00:00.000Z")]);
    expect(r.phantomUsd).toBe(0.3);
  });
});
