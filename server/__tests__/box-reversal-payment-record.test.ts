import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Undoing a box receipt undoes its payment record too (defect 5 of the
 * 2026-09-11 box-money audit; owner's ledger audit, 2026-09-16).
 *
 * The receipt's ADJUSTMENT_DEBIT put the money back on the balance, but the
 * payment record it wrote stayed "confirmed" with nothing reversed. So the
 * portal's "total paid" and every payment report went on counting money that
 * had been handed back — and an accountant could undo the same payment again
 * from the payments list, raising the balance twice for one mistake.
 *
 * Proven against a scratch MySQL with the real writers before this shipped:
 * a $20 receipt reversed now leaves the record reversed $20 and refunded, and
 * a $30 receipt whose $12 was already undone from the payments list puts back
 * $18, not $30 (balance $30, where it used to become $42). Source guards here,
 * like the other box-money tests, because the path needs a live database.
 */

const ROOT = path.resolve(__dirname, "../..");
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8").replace(/\r\n/g, "\n");

function slice(src: string, from: string, to: string): string {
  const start = src.indexOf(from);
  expect(start, `marker not found: ${from}`).toBeGreaterThan(-1);
  const end = src.indexOf(to, start + from.length);
  expect(end, `marker not found: ${to}`).toBeGreaterThan(start);
  const out = src.slice(start, end);
  expect(out.length, "slice is empty").toBeGreaterThan(100);
  return out;
}

describe("a reversed box receipt reverses its payment record", () => {
  const reverse = slice(
    read("server/db/boxSettlement.db.ts"),
    "export async function reverseBoxSettlement",
    "export interface DiscountReportRow",
  );

  it("locks the record the settlement wrote", () => {
    expect(reverse).toContain(".from(paymentRecords)");
    expect(reverse).toContain("eq(paymentRecords.id, settlement.paymentRecordId)");
    expect(reverse).toContain('.for("update")');
  });

  it("puts back only what was not already undone from the payments list", () => {
    expect(reverse).toContain("const alreadyReversed = record ? Math.min(paid, Number(record.reversedAmountUsd || 0)) : 0;");
    expect(reverse).toContain("const putBack = round2(paid - alreadyReversed + Number(settlement.discountUsd || 0));");
  });

  it("marks the record reversed, so 'paid' everywhere stops counting it", () => {
    expect(reverse).toContain("reversedAmountUsd: reversedNow.toFixed(2)");
    expect(reverse).toContain('paymentStatus: whole ? "refunded" : record.paymentStatus');
    expect(reverse).toContain("reversalTransactionId: reversalTransactionId ?? record.reversalTransactionId");
  });

  it("the payments list refuses a record that is already fully reversed", () => {
    const router = read("server/routers/finance.router.ts");
    const reversePayment = slice(router, "reversePayment: accountantProcedure", "refundPayment: accountantProcedure");
    expect(reversePayment).toContain("const remaining = original - alreadyReversed;");
    expect(reversePayment).toContain("if (remaining <= 0.005)");
  });
});
