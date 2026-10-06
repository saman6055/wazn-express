import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CreditWouldBeMadeError } from "./db/finance.db";
import { undoCreditRefusal } from "./lib/creditGuard";
import { ASK_ADMIN_MARK } from "@shared/creditGuard";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");
const body = (src: string, name: string) => {
  const start = src.indexOf(`export async function ${name}(`);
  expect(start, `${name} not found`).toBeGreaterThan(-1);
  const end = src.indexOf("\nexport async function ", start + 10);
  return src.slice(start, end === -1 ? undefined : end);
};

/**
 * Owner, 2026-10-02: "everything done for a customer is done with the
 * company's money. It makes no sense that deleting it turns into credit for
 * a customer who officially had none."
 *
 * Undoing puts the account back where it was. A reversal or a lowered price
 * that would leave the account further below zero is refused at the ledger —
 * the one place every door passes through. Proved on a real MySQL with the
 * real functions: 16 checks.
 */
describe("the ledger refuses an undo that would leave a credit", () => {
  const ledger = read("server/db/finance.db.ts");

  it("every reversal is checked", () => {
    expect(body(ledger, "reverseCharge")).toContain("refuseSilentCredit(currentBalanceUsd, newBalanceUsd, opts);");
  });

  it("every lowered price is checked, and a raised one is not", () => {
    expect(body(ledger, "adjustCharge")).toContain("if (delta < 0) refuseSilentCredit(currentBalanceUsd, newBalanceUsd, opts);");
  });

  it("only two things let it through: the payment undone with it, or the main admin's yes", () => {
    const guard = ledger.slice(ledger.indexOf("function refuseSilentCredit("), ledger.indexOf("function refuseSilentCredit(") + 600);
    expect(guard).toContain("if (opts?.allowCredit) return;");
    expect(guard).toContain("opts?.paymentBeingUndoneUsd");
    expect(guard).toContain("if (madeCents > 1) throw new CreditWouldBeMadeError(");
  });

  it("the refusal says the cure", () => {
    const err = new CreditWouldBeMadeError(50);
    expect(err.creditUsd).toBe(50);
    expect(err.message).toContain("$50.00");
    expect(err.message).toContain("وەسڵ");
    expect(err.message).toContain("ئادمینی سەرەکی");
  });
});

describe("what each person is told", () => {
  const err = new CreditWouldBeMadeError(60);

  it("staff and other admins get the cure, not a question", () => {
    for (const role of ["employee", "accountant", "admin"]) {
      const refusal = undoCreditRefusal(err, role);
      expect(refusal?.code).toBe("CONFLICT");
      expect(refusal?.message).not.toContain(ASK_ADMIN_MARK);
    }
  });

  it("the main admin is asked whether it came out of the customer's own credit", () => {
    const question = undoCreditRefusal(err, "super_admin");
    expect(question?.code).toBe("PRECONDITION_FAILED");
    expect(question?.message.startsWith(ASK_ADMIN_MARK)).toBe(true);
    expect(question?.message).toContain("$60.00");
    expect(question?.message).toContain("کریدیتی ڕەسمیی کڕیار");
  });

  it("any other failure is left alone", () => {
    expect(undoCreditRefusal(new Error("boom"), "super_admin")).toBeNull();
  });
});

describe("the order doors", () => {
  const router = read("server/routers/fullPackage.router.ts");

  it("an order whose money is on a standing box receipt is not deleted", () => {
    const del = router.slice(router.indexOf("    delete: adminProcedure"));
    expect(del.indexOf("await db.standingReceiptForOrder(input.id)")).toBeGreaterThan(-1);
    expect(del.indexOf("await db.standingReceiptForOrder(input.id)")).toBeLessThan(del.indexOf("await db.reverseCharge("));
  });

  it("delete counts the advance it undoes in the same act", () => {
    expect(router).toContain("{ allowCredit, paymentBeingUndoneUsd: advanceToUndo },");
  });

  it("delete, price edit and move all translate the refusal instead of hiding it", () => {
    expect(router.match(/const refusal = undoCreditRefusal\(err, ctx\.user\.role\);\s*if \(refusal\) throw refusal;/g)?.length).toBe(3);
    expect(router.match(/approveCredit: z\.boolean\(\)\.optional\(\)/g)?.length).toBe(2);
  });

  it("the standing receipt is found whether the order sits in the box as itself or as its parcel", () => {
    const fn = body(read("server/db/boxSettlement.db.ts"), "standingReceiptForOrder");
    expect(fn).toContain("eq(boxSettlementLines.fullPackageOrderId, orderId)");
    expect(fn).toContain("inArray(boxSettlementLines.packageId, parcelIds)");
    expect(fn).toContain('eq(boxSettlements.status, "confirmed")');
  });
});

describe("a charge lowered in place is still a lowering", () => {
  it("is checked at the ledger like every other one", () => {
    expect(body(read("server/db/finance.db.ts"), "restateCharge"))
      .toContain("if (deltaCents < 0) refuseSilentCredit(currentBalanceUsd, newBalanceUsd, opts);");
  });

  it("before anything is written", () => {
    const fn = body(read("server/db/finance.db.ts"), "restateCharge");
    const guard = fn.indexOf("refuseSilentCredit(currentBalanceUsd, newBalanceUsd, opts);");
    expect(guard).toBeGreaterThan(-1);
    for (const write of ["await tx.update(ledgerTransactions)", "await tx.update(customerAccounts)", "await tx.insert(auditLogs)"]) {
      expect(fn.indexOf(write), write).toBeGreaterThan(guard);
    }
  });
});
