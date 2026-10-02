import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  creditAfter, creditVerdict, mayApproveCredit, creditRefusal, creditQuestion, creditHoldQuestion, ASK_ADMIN_MARK,
} from "./creditGuard";
import { guardAgainstCredit } from "../server/lib/creditGuard";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");
const codeOf = (fn: () => unknown): string => {
  try { fn(); return "none"; } catch (e) { return String((e as { code?: string }).code); }
};

/**
 * Owner, 2026-10-01: no customer has credit. 75 accounts did — $13,202 —
 * each made by an ordinary entry nothing questioned.
 * Owner, 2026-10-02: anyone may enter a payment larger than the debt, but
 * the extra reaches the account only once the main admin confirms it.
 * The whole flow was run through the real router on a real MySQL: 19 checks.
 */
describe("how much credit an entry would leave", () => {
  it("none while the account stays at or above zero", () => {
    expect(creditAfter(50, 50)).toBe(0);
    expect(creditAfter(50, 20)).toBe(0);
    expect(creditAfter(50, 50.01), "a cent of rounding is not a credit").toBe(0);
  });

  it("the part of the entry beyond the debt", () => {
    expect(creditAfter(200, 300), "the owner's own example").toBe(100);
    expect(creditAfter(0, 54.5), "AZ173: lowered by hand after the debt was gone").toBe(54.5);
    expect(creditAfter(-10, 5), "already in credit: every cent deepens it").toBe(15);
  });
});

describe("who decides", () => {
  it("only the main admin puts a credit on an account", () => {
    expect(mayApproveCredit("super_admin")).toBe(true);
    for (const role of ["admin", "employee", "accountant", "auditor", null, undefined]) {
      expect(mayApproveCredit(role)).toBe(false);
    }
  });

  it("the main admin is asked, then it posts", () => {
    expect(creditVerdict({ creditUsd: 100, role: "super_admin" })).toBe("ask_main");
    expect(creditVerdict({ creditUsd: 100, role: "super_admin", approved: true })).toBe("post");
  });

  it("everyone else is told it will wait, then it is held", () => {
    for (const role of ["admin", "employee", "accountant"]) {
      expect(creditVerdict({ creditUsd: 100, role })).toBe("ask_hold");
      expect(creditVerdict({ creditUsd: 100, role, approved: true })).toBe("hold");
    }
  });

  it("a hand adjustment is never held — only the main admin may", () => {
    expect(creditVerdict({ creditUsd: 10, role: "accountant", approved: true, canHold: false })).toBe("refuse");
    expect(creditVerdict({ creditUsd: 10, role: "super_admin", approved: true, canHold: false })).toBe("post");
  });

  it("no credit, no question", () => {
    expect(creditVerdict({ creditUsd: 0, role: "employee" })).toBe("none");
  });
});

describe("what the door is told to do", () => {
  const entry = { customerCode: "AZ173", balanceUsd: 200, loweredByUsd: 300 };

  it("asks first, whoever it is", () => {
    expect(codeOf(() => guardAgainstCredit({ ...entry, role: "employee" }))).toBe("PRECONDITION_FAILED");
    expect(codeOf(() => guardAgainstCredit({ ...entry, role: "super_admin" }))).toBe("PRECONDITION_FAILED");
  });

  it("holds the extra for staff, posts it for the main admin", () => {
    expect(guardAgainstCredit({ ...entry, role: "employee", approved: true })).toEqual({ action: "hold", creditUsd: 100 });
    expect(guardAgainstCredit({ ...entry, role: "admin", approved: true })).toEqual({ action: "hold", creditUsd: 100 });
    expect(guardAgainstCredit({ ...entry, role: "super_admin", approved: true })).toEqual({ action: "post", creditUsd: 100 });
  });

  it("an ordinary payment passes untouched", () => {
    expect(guardAgainstCredit({ customerCode: "AZ1", balanceUsd: 200, loweredByUsd: 200, role: "employee" })).toEqual({ action: "post", creditUsd: 0 });
  });

  it("refuses a hand adjustment below zero by anyone else", () => {
    expect(codeOf(() => guardAgainstCredit({ ...entry, role: "accountant", approved: true, canHold: false }))).toBe("CONFLICT");
  });

  it("says it in the owner's words", () => {
    const facts = { customerCode: "AZ173", owesUsd: 200, creditUsd: 100 };
    expect(creditQuestion(facts)).toContain("$100.00 زیادەیە: دەبێتە باڵانس (کریدیت) و دەچێتە سەر حیسابی کڕیار");
    expect(creditHoldQuestion(facts)).toContain("تا ئادمینی سەرەکی پەسەندی نەکات");
    expect(creditHoldQuestion(facts)).toContain("$200.00 ئێستا تۆمار دەکرێت");
    for (const q of [creditQuestion(facts), creditHoldQuestion(facts)]) expect(q.startsWith(ASK_ADMIN_MARK)).toBe(true);
    expect(creditRefusal(facts)).not.toContain(ASK_ADMIN_MARK);
  });
});

describe("every door that takes money asks", () => {
  it("payment holds the extra; a hand adjustment cannot", () => {
    const src = read("server/routers/finance.router.ts");
    expect(src.match(/guardAgainstCredit\(\{/g)?.length).toBe(2);
    expect(src.match(/approveCredit: z\.boolean\(\)\.optional\(\)/g)?.length).toBe(2);
    expect(src).toContain('if (credit.action === "hold") {');
    expect(src).toContain("await db.createPendingCredit({");
    expect(src).toContain("canHold: false,");
    expect(src).toContain('if (input.direction === "credit") {');
  });

  it("the box till takes exactly what is due and holds the rest, in one transaction", () => {
    const db = read("server/db/boxSettlement.db.ts");
    expect(db).toContain('const heldCreditUsd = credit.action === "hold" ? credit.creditUsd : 0;');
    const tx = db.slice(db.indexOf("return await db.transaction(async (tx) => {"));
    expect(tx).toContain("await createPendingCredit({");
    expect(tx.slice(tx.indexOf("await createPendingCredit({"), tx.indexOf("await createPendingCredit({") + 500)).toContain("}, tx);");
    expect(read("server/routers/scanning.router.ts")).toContain("credit: { role: ctx.user.role, approved: approveCredit }");
  });

  it("only the main admin sees and decides what is waiting", () => {
    const src = read("server/routers/finance.router.ts");
    expect(src).toContain("pendingCredits: superAdminProcedure.query");
    expect(src).toContain("decidePendingCredit: superAdminProcedure");
  });

  it("a request already decided cannot be decided again", () => {
    const db = read("server/db/pendingCredits.db.ts");
    expect(db).toContain('if (row.status !== "pending") {');
    expect(db).toContain('.for("update")');
  });

  it("the table is made at boot", () => {
    expect(read("server/_core/migrations.ts")).toContain("CREATE TABLE IF NOT EXISTS pendingCredits (");
  });

  it("the client asks once, for every screen, and says when the extra was held", () => {
    expect(read("client/src/main.tsx")).toMatch(/links: \[\s*\/\/[^\n]*\n\s*creditApprovalLink,\s*httpBatchLink/);
    const link = read("client/src/lib/creditApprovalLink.ts");
    expect(link).toContain("message.startsWith(ASK_ADMIN_MARK)");
    expect(link).toContain("approveCredit: true");
    expect(link).toContain("toast.warning(creditHeldNotice(held)");
  });
});
