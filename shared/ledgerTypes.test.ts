import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  CHARGE_TX_TYPES,
  PAYMENT_TX_TYPES,
  isChargeTx,
  isPaymentTx,
} from "./ledgerTypes";

/**
 * The failure this exists to stop.
 *
 * `ADJUSTMENT_DEBIT` — a correction an accountant enters by hand — does not
 * begin with `DEBIT_`. The classic money page split the ledger with
 * `startsWith("DEBIT_")`, so that line was counted as neither a charge nor a
 * payment: it vanished from the customer's monthly total and from the
 * six-month chart, while the PDF statement the same customer downloads counted
 * it correctly. Two Wazn documents, the same money, different figures.
 */
describe("every ledger line is either money in or money out", () => {
  const SCHEMA = path.resolve(__dirname, "../drizzle/schema/finance.schema.ts");

  function enumValues(): string[] {
    const src = fs.readFileSync(SCHEMA, "utf8");
    const block = src.slice(src.indexOf('mysqlEnum("transactionType"'));
    return [...block.slice(0, block.indexOf("])")).matchAll(/"([A-Z_]+)"/g)]
      .map(m => m[1])
      .filter(v => v !== "transactionType");
  }

  it("covers every value the database can store, with none left out", () => {
    const values = enumValues();
    expect(values.length, "the enum should have been found").toBeGreaterThan(5);

    const orphans = values.filter(v => !isChargeTx(v) && !isPaymentTx(v));
    expect(
      orphans,
      `these would be counted as neither a charge nor a payment:\n${orphans.join("\n")}`,
    ).toEqual([]);
  });

  it("never counts one line as both", () => {
    for (const v of enumValues()) {
      expect(isChargeTx(v) && isPaymentTx(v), `${v} is in both lists`).toBe(false);
    }
  });

  it("catches the adjustment values that broke it", () => {
    // The exact pair that `startsWith` split wrongly.
    expect(isChargeTx("ADJUSTMENT_DEBIT")).toBe(true);
    expect(isPaymentTx("ADJUSTMENT_CREDIT")).toBe(true);
    expect(isPaymentTx("ADJUSTMENT_DEBIT")).toBe(false);
    expect(isChargeTx("ADJUSTMENT_CREDIT")).toBe(false);
  });

  it("refuses a value it does not know rather than guessing", () => {
    // A future migration's value must not silently become a charge on
    // somebody's statement.
    expect(isChargeTx("DEBIT_SOMETHING_NEW")).toBe(false);
    expect(isPaymentTx("DEBIT_SOMETHING_NEW")).toBe(false);
    expect(isChargeTx(null)).toBe(false);
    expect(isPaymentTx(undefined)).toBe(false);
  });

  it("has no value written into both arrays by hand", () => {
    const all = [...CHARGE_TX_TYPES, ...PAYMENT_TX_TYPES];
    expect(new Set(all).size).toBe(all.length);
  });
});

describe("one list, not four copies of it", () => {
  const read = (p: string) => fs.readFileSync(path.resolve(__dirname, p), "utf8");

  /**
   * The statement PDF and the money screens each carried their own split of
   * the enum. They agreed until they didn't, and the one that drifted was the
   * one a customer reads on screen.
   */
  it("the statement PDF reads the shared list", () => {
    const pdf = read("../server/services/pdfReports.ts");
    expect(pdf).toContain('from "@shared/ledgerTypes"');
    expect(pdf, "must not restate the buckets").not.toMatch(/CHARGE_TX_TYPES\s*=\s*\[/);
  });

  it("portalMoney reads the shared list", () => {
    const money = read("../client/src/lib/portalMoney.ts");
    expect(money).toContain('from "@shared/ledgerTypes"');
  });

  /**
   * `startsWith` is the shape of the bug, so it is the shape that is banned.
   * The credit side was already guarded in portalMoney.test.ts; the debit side
   * had no rule at all, which is why only the debit side broke.
   */
  it("no portal screen splits the ledger by hand", () => {
    const dirs = [
      path.resolve(__dirname, "../client/src/pages/portal"),
      path.resolve(__dirname, "../client/src/components/portal"),
    ];
    const files: string[] = [];
    const walk = (d: string) => {
      if (!fs.existsSync(d)) return;
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (e.name.endsWith(".tsx")) files.push(p);
      }
    };
    dirs.forEach(walk);

    const offenders = files
      .filter(f => /startsWith\(["'](DEBIT|CREDIT)_["']\)/.test(fs.readFileSync(f, "utf8")))
      .map(f => path.basename(f));

    expect(
      offenders,
      `use isDebitTx / isCreditTx from lib/portalMoney — ADJUSTMENT_DEBIT and\n` +
        `ADJUSTMENT_CREDIT begin with neither prefix:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});
