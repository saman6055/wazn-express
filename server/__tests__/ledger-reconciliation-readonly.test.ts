import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { cartonOverchargeUsd, judgeBoxReversal } from "@shared/ledgerReconciliation";

/**
 * The whole-system money check reads and never writes (owner's ledger audit,
 * 2026-09-16). Its SQL was run against a scratch MySQL seeded with one of
 * each finding before it shipped; these keep the promises it makes.
 */
const ROOT = path.resolve(__dirname, "../..");
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8").replace(/\r\n/g, "\n");

describe("the reconciliation report only reads", () => {
  const src = read("server/db/ledgerReconciliation.db.ts");

  it("has no statement that changes anything", () => {
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    // The SQL here is written in capitals; a string's .replace() is not a statement.
    expect(code).not.toMatch(/\b(INSERT|UPDATE|DELETE|REPLACE INTO|ALTER|DROP|TRUNCATE)\b/);
    expect(code).not.toMatch(/\.(insert|update|delete)\(/);
  });

  it("is for admins, and nobody else", () => {
    const router = read("server/routers/finance.router.ts");
    expect(router).toContain("reconciliationReport: adminProcedure.query(");
  });

  it("runs when asked, not when the tab opens", () => {
    const screen = read("client/src/components/admin/LedgerReconciliationSection.tsx");
    expect(screen).toContain("trpc.ledger.reconciliationReport.useQuery(undefined, { enabled: false");
    expect(screen).toContain("buildErrorReport");
  });
});

describe("judging a reversed box receipt", () => {
  it("before d38aec5, after $15 was undone from the payments list: still counts $25, $15 went back twice", () => {
    expect(
      judgeBoxReversal({
        paidUsd: 40,
        discountUsd: 0,
        record: { reversedAmountUsd: "15.00", reversalTransactionId: 7 },
        reversalRow: { id: 9, amountUsd: "40.00" },
      }),
    ).toEqual({ stillCountedUsd: 25, doubleReversedUsd: 15 });
  });

  it("since d38aec5, with the same $15 undone first: nothing wrong", () => {
    expect(
      judgeBoxReversal({
        paidUsd: 40,
        discountUsd: 2,
        record: { reversedAmountUsd: "40.00", reversalTransactionId: 9 },
        reversalRow: { id: 9, amountUsd: "27.00" },
      }),
    ).toEqual({ stillCountedUsd: 0, doubleReversedUsd: 0 });
  });

  it("before d38aec5, nothing undone elsewhere: the record still counts the whole payment", () => {
    expect(
      judgeBoxReversal({
        paidUsd: 20,
        discountUsd: 2.24,
        record: { reversedAmountUsd: 0, reversalTransactionId: null },
        reversalRow: { id: 3, amountUsd: 22.24 },
      }),
    ).toEqual({ stillCountedUsd: 20, doubleReversedUsd: 0 });
  });
});

describe("a carton charged twice", () => {
  it("is never more than either charge", () => {
    expect(cartonOverchargeUsd(50, 50)).toBe(50);
    expect(cartonOverchargeUsd(62.5, 50)).toBe(50);
    expect(cartonOverchargeUsd(50, 0)).toBe(0);
  });
});

describe("the report opens on the live database", () => {
  // 2026-10-07: the report failed on production with "Illegal mix of
  // collations (utf8mb4_0900_ai_ci) and (utf8mb4_unicode_ci) for operation
  // 'like'" - a ledger text compared with an order's code, each table made
  // under a different default. Proven on real MySQL: naming one collation on
  // both sides is the cure.
  it("every text compared across two tables names its collation on both sides", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve(__dirname, "..", "db", "ledgerReconciliation.db.ts"), "utf8");
    const likes = src.split("\n").filter((line) => line.includes("LIKE CONCAT("));
    expect(likes.length).toBe(3);
    for (const line of likes) expect(line.match(/COLLATE utf8mb4_unicode_ci/g)?.length, line.trim()).toBe(2);
  });
});
