import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");

/**
 * The repair for the credit of 2026-09-10 (shared/bulkReceiptCredit).
 * Proved on a throwaway MySQL with the real ledger functions, and the rule
 * itself was run over the real exported ledger: 76 accounts, $13,039.86.
 */
describe("the 10 September correction", () => {
  const db = read("server/db/bulkReceiptCredit.db.ts");

  it("the finder only reads", () => {
    const finder = db.slice(db.indexOf("async function compute()"), db.indexOf("export async function correctBulkReceiptCredits"));
    for (const verb of [".insert(", ".update(", ".delete(", "adjustCustomerBalance("]) {
      expect(finder, `the finder contains ${verb}`).not.toContain(verb);
    }
  });

  it("the apply recomputes on the server and never trusts an amount from the screen", () => {
    const apply = db.slice(db.indexOf("export async function correctBulkReceiptCredits"));
    expect(apply).toContain("const { byCustomer } = await compute();");
    expect(apply).toContain('row.phantomUsd, "debit", BULK_RECEIPT_FIX_REASON');
    expect(read("server/routers/finance.router.ts")).toContain("customerIds: z.array(z.number().int().positive()).min(1).max(500)");
  });

  it("an account already carrying the mark is left alone", () => {
    expect(db).toContain("if (result.alreadyFixed) { alreadyFixed += 1; continue; }");
  });

  it("is admin-only, audited, and shown in Repairs", () => {
    const router = read("server/routers/finance.router.ts");
    expect(router).toContain("bulkReceiptCredits: adminProcedure.query");
    expect(router).toContain("correctBulkReceiptCredits: adminProcedure");
    expect(router).toContain('action: "correct_bulk_receipt_credits"');
    expect(read("client/src/pages/admin/DataManagement.tsx")).toContain("<BulkReceiptCreditSection language={language} />");
  });

  it("the screen asks before it posts", () => {
    const ui = read("client/src/components/admin/BulkReceiptCreditSection.tsx");
    expect(ui.indexOf("await confirmAction(")).toBeLessThan(ui.indexOf("correct.mutate({ customerIds"));
    expect(ui).toContain("enabled: false");
  });
});
