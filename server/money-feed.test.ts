import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");

describe("the money feed", () => {
  it("reads the ledger itself and nothing else writes it", () => {
    const db = read("server/db/moneyFeed.db.ts");
    expect(db).toContain(".from(ledgerTransactions)");
    expect(db).toContain("groupMovements(rows)");
    for (const verb of [".insert(", ".update(", ".delete("]) expect(db).not.toContain(verb);
  });

  it("is for the main admin only", () => {
    expect(read("server/routers/finance.router.ts")).toContain("moneyFeed: superAdminProcedure.query");
  });
});

describe("a charge put right in place still reaches the bell", () => {
  const db = read("server/db/moneyFeed.db.ts");

  it("its records are read beside the rows, by the name the ledger writes them under", () => {
    expect(db).toContain('.where(and(eq(auditLogs.category, "finance"), eq(auditLogs.action, CHARGE_RESTATED_ACTION)))');
    expect(db).toContain("records.map(restatedCharge)");
    expect(read("server/db/finance.db.ts")).toContain("action: CHARGE_RESTATED_ACTION,");
    expect(read("server/db/finance.db.ts")).toContain("category: 'finance',");
  });

  it("they come back with the movements, with a marker of their own", () => {
    expect(db).toContain("const restated = await getRestatedCharges();");
    expect(db).toContain("return { lines, newestId: lines[0]?.id ?? 0, restated, newestRestatedId: restated[0]?.id ?? 0 };");
  });

  it("each names whose account it was and who did it", () => {
    const start = db.indexOf("async function getRestatedCharges(");
    expect(start).toBeGreaterThan(-1);
    const fn = db.slice(start, db.indexOf("export async function getMoneyFeed("));
    expect(fn).toContain(".innerJoin(customers, eq(customers.id, customerAccounts.customerId))");
    expect(fn).toContain("byName: c.createdById !== null ? nameOf.get(c.createdById)");
  });
});
