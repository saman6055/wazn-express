import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { creditAfter, mayApproveCredit, creditRefusal, creditQuestion, ASK_ADMIN_MARK } from "./creditGuard";
import { guardAgainstCredit } from "../server/lib/creditGuard";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");
const codeOf = (fn: () => unknown): string => {
  try { fn(); return "none"; } catch (e) { return String((e as { code?: string }).code); }
};

/**
 * Owner, 2026-10-01: no customer has credit. 75 accounts did — $13,202 —
 * each made by an ordinary entry nothing questioned.
 */
describe("how much credit an entry would leave", () => {
  it("none while the account stays at or above zero", () => {
    expect(creditAfter(50, 50)).toBe(0);
    expect(creditAfter(50, 20)).toBe(0);
    expect(creditAfter(50, 50.01), "a cent of rounding is not a credit").toBe(0);
  });

  it("the part of the entry beyond the debt", () => {
    expect(creditAfter(50, 80)).toBe(30);
    expect(creditAfter(0, 54.5), "AZ173: lowered by hand after the debt was gone").toBe(54.5);
    expect(creditAfter(-10, 5), "already in credit: every cent deepens it").toBe(15);
  });
});

describe("who may say yes", () => {
  it("only an admin", () => {
    expect(mayApproveCredit("admin")).toBe(true);
    expect(mayApproveCredit("super_admin")).toBe(true);
    for (const role of ["staff", "accountant", "auditor", null, undefined]) expect(mayApproveCredit(role)).toBe(false);
  });

  it("staff are refused, an admin is asked, an approved admin passes", () => {
    const entry = { customerCode: "AZ173", balanceUsd: 0, loweredByUsd: 54.5 };
    expect(codeOf(() => guardAgainstCredit({ ...entry, role: "staff" }))).toBe("CONFLICT");
    expect(codeOf(() => guardAgainstCredit({ ...entry, role: "accountant", approved: true })), "a yes from staff is not a yes").toBe("CONFLICT");
    expect(codeOf(() => guardAgainstCredit({ ...entry, role: "admin" }))).toBe("PRECONDITION_FAILED");
    expect(guardAgainstCredit({ ...entry, role: "admin", approved: true })).toBe(54.5);
    expect(guardAgainstCredit({ customerCode: "AZ1", balanceUsd: 60, loweredByUsd: 54.5, role: "staff" })).toBe(0);
  });

  it("says the cause and the cure, and marks only the admin's question", () => {
    const facts = { customerCode: "AZ173", owesUsd: 0, creditUsd: 54.5 };
    expect(creditRefusal(facts)).toContain("$54.50");
    expect(creditRefusal(facts)).toContain("بەڕێوەبەر");
    expect(creditRefusal(facts)).not.toContain(ASK_ADMIN_MARK);
    expect(creditQuestion(facts).startsWith(ASK_ADMIN_MARK)).toBe(true);
  });
});

describe("every door that lowers a balance asks", () => {
  it("payment and hand adjustment", () => {
    const src = read("server/routers/finance.router.ts");
    expect(src.match(/guardAgainstCredit\(\{/g)?.length).toBe(2);
    expect(src.match(/approveCredit: z\.boolean\(\)\.optional\(\)/g)?.length).toBe(2);
    expect(src).toContain('if (input.direction === "credit") {');
  });

  it("the box till, when more is handed over than is due", () => {
    const db = read("server/db/boxSettlement.db.ts");
    expect(db).toContain('const approvedCreditUsd = difference.kind === "credit"');
    expect(read("server/routers/scanning.router.ts")).toContain("credit: { role: ctx.user.role, approved: approveCredit }");
  });

  it("the client asks an admin once, for every screen at once", () => {
    expect(read("client/src/main.tsx")).toMatch(/links: \[\s*\/\/[^\n]*\n\s*creditApprovalLink,\s*httpBatchLink/);
    const link = read("client/src/lib/creditApprovalLink.ts");
    expect(link).toContain("message.startsWith(ASK_ADMIN_MARK)");
    expect(link).toContain("approveCredit: true");
  });
});
