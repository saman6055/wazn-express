import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { oldestUnpaidSince, daysSince } from "./debtAge";

/*
 * 2026-10-03: after the credit clean-up touched every account, all 75 debtors
 * read "0–30 days" — debts from May among them. A debt's age is now its oldest
 * unpaid charge; payments clear the oldest charges first.
 */
describe("how old a debt is", () => {
  it("payments clear the oldest charges first", () => {
    const moves = [
      { signedUsd: 100, at: "2026-05-01" },
      { signedUsd: 50, at: "2026-06-01" },
      { signedUsd: -120, at: "2026-07-01" },
      { signedUsd: 30, at: "2026-09-01" },
    ];
    // $120 paid clears May's $100 and $20 of June's $50: June is the oldest still owed.
    expect(oldestUnpaidSince(moves)?.toISOString().slice(0, 10)).toBe("2026-06-01");
  });

  it("a recent correction does not make an old debt young", () => {
    const moves = [{ signedUsd: 300, at: "2026-05-10" }, { signedUsd: -0.5, at: "2026-10-02" }];
    expect(oldestUnpaidSince(moves)?.toISOString().slice(0, 10)).toBe("2026-05-10");
  });

  it("nothing owed, no age", () => {
    expect(oldestUnpaidSince([{ signedUsd: 50, at: "2026-05-01" }, { signedUsd: -50, at: "2026-05-02" }])).toBeNull();
    expect(daysSince(null)).toBeNull();
    expect(daysSince("2026-10-01", new Date("2026-10-04T12:00:00Z"))).toBe(3);
  });

  it("the debtors page ages by it", () => {
    const page = fs.readFileSync(path.resolve(__dirname, "..", "client/src/pages/DebtorsReport.tsx"), "utf8");
    expect(page).toContain("trpc.ledger.debtAges.useQuery()");
    expect(page).toContain("? (daysSince(owedSince) ?? 0)");
  });
});
