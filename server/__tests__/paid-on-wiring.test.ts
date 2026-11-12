/**
 * A payment entered days after it was paid is dated the day paid, and the
 * moment it was typed in is kept beside it (owner, 2026-11-12: «تاریخی پارەدان
 * و تاریخی داخل کردنیش هەبێ»). The date travels by drizzle/moneyClock; these
 * keep each money door and each money table on it.
 */
import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "../..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");
const slice = (src: string, from: string, to: string) => {
  const a = src.indexOf(from);
  expect(a, `marker not found: ${from}`).toBeGreaterThanOrEqual(0);
  const b = src.indexOf(to, a + from.length);
  expect(b, `end marker not found: ${to}`).toBeGreaterThan(a);
  return src.slice(a, b);
};

describe("paid day on a payment", () => {
  const router = read("server/routers/finance.router.ts");

  it("both payment doors take the paid day and run inside it", () => {
    const first = slice(router, "payOpenBoxesFirst: staffProcedure", "recordPayment: staffProcedure");
    expect(first).toContain("paidOn: z.string()");
    expect(first).toContain("withPaidAt(await paidMoment(");
    const pay = slice(router, "recordPayment: staffProcedure", "reversePayment: accountantProcedure");
    expect(pay).toContain("paidOn: z.string()");
    expect(pay).toContain("withPaidAt(await paidMoment(input.paidOn, ctx.user.role)");
  });

  it("a late day is checked, and shut books refuse it", () => {
    const helper = slice(router, "async function paidMoment(", "\n}\n");
    expect(helper).toContain("checkPaidOn(paidOn, role)");
    expect(helper).toContain("db.booksShutOn(check.paidAt)");
    expect(helper).toContain("withFix(");
  });

  it("every money table dates its rows by the paid moment and keeps the entry moment", () => {
    const schema = read("drizzle/schema/finance.schema.ts");
    for (const table of ["ledgerTransactions", "paymentRecords", "boxSettlements"]) {
      const body = slice(schema, `export const ${table} = mysqlTable(`, "}, (table) =>");
      expect(body, table).toContain('createdAt: timestamp("createdAt").defaultNow().notNull().$defaultFn(() => moneyMoment() ?? sql`default`)');
      expect(body, table).toContain('enteredAt: timestamp("enteredAt")');
    }
    const lines = slice(schema, "export const boxSettlementLines = mysqlTable(", "}, (table) =>");
    expect(lines).toContain("moneyMoment() ?? sql`default`");
  });

  it("the box receipt and the cash line use the same clock", () => {
    const box = read("server/db/boxSettlement.db.ts");
    expect(box).toContain("const now = moneyMoment() ?? new Date();");
    const fin = slice(read("server/db/finance.db.ts"), "export async function recordPaymentReceived(", "export async function reverseAdvancePayment(");
    expect(fin).toContain("transactionDate: moneyMoment() ?? new Date(),");
  });

  it("the column exists on a fresh database and on production", () => {
    const mig = read("server/_core/migrations.ts");
    for (const table of ["ledgerTransactions", "paymentRecords", "boxSettlements"]) {
      expect(mig).toContain(`{ name: "${table}.enteredAt", sql: "ALTER TABLE ${table} ADD COLUMN enteredAt TIMESTAMP NULL" }`);
    }
  });

  it("the office shows both dates; the statement's balance reads by date", () => {
    const page = read("client/src/pages/finance/CustomerFinance.tsx");
    expect(page).toContain('id="paid-on"');
    expect(page.match(/<EnteredLater /g)?.length ?? 0).toBeGreaterThanOrEqual(5);
    expect(read("client/src/components/MoneyBell.tsx")).toContain("enteredLater(line.at, line.enteredAt)");
    expect(read("server/services/pdfReports.ts")).toContain("balancesByDate(");
  });
});
