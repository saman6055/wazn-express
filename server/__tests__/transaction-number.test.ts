import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { generateTransactionNumber, generatePaymentNumber } from "./db/utils.db";

/**
 * 2026-09-10: box payments failed with "Duplicate entry 'TXN-20260910-6269'
 * for key ledgerTransactions.transactionNumber" and worked on the second try.
 * Four random digits a day into a unique column. Now twelve, from one
 * generator every ledger insert uses.
 */

describe("ledger and payment numbers do not repeat", () => {
  it("a transaction number is the date and twelve random digits", () => {
    expect(generateTransactionNumber()).toMatch(/^TXN-\d{8}-\d{12}$/);
  });

  it("a payment number is the date and twelve random digits", () => {
    expect(generatePaymentNumber()).toMatch(/^PAY-\d{8}-\d{12}$/);
  });

  it("fits the column", () => {
    expect(generateTransactionNumber().length).toBeLessThanOrEqual(50);
  });

  it("five thousand in a row are all different", () => {
    // With four digits, five thousand draws in a day repeated with near
    // certainty; this is the day that broke, many times over.
    const seen = new Set<string>();
    for (let i = 0; i < 5000; i++) seen.add(generateTransactionNumber());
    expect(seen.size).toBe(5000);
  });

  it("no ledger insert makes its own number any more", () => {
    const offenders: string[] = [];
    for (const sub of ["db", "routers"]) {
      const dir = path.join(__dirname, sub);
      for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))) {
        if (sub === "db" && file === "utils.db.ts") continue;
        const src = fs.readFileSync(path.join(dir, file), "utf8");
        // A display fallback like `PAY-${paymentRecord.id}` is not a new number.
        const ownTxn = src.includes("`TXN-${");
        const ownPay = src.split("`PAY-${").slice(1).some((rest) => !rest.startsWith("paymentRecord."));
        if (ownTxn || ownPay) offenders.push(`${sub}/${file}`);
      }
    }
    expect(offenders, "use generateTransactionNumber / generatePaymentNumber from utils.db").toEqual([]);
  });
});
