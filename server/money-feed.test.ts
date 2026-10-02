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
