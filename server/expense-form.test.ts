import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Two things the form used to make somebody do by hand, and one number it
 * used to invent.
 *
 * The dinar rate was written into the middle of the create call as 1480. An
 * expense paid at 1,510 was stored as though it had been paid at 1,480, and
 * nothing on the screen said so — the difference simply became a rounding
 * error in the month's profit. It is now on the form, editable, and kept
 * with the row it converted.
 *
 * The receipt number was a blank box. A blank box on a form gets filled in
 * differently by every person who meets it, and then nothing can be searched.
 */

const ROOT = path.join(__dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8").replace(/\r\n/g, "\n");
const END_OF_FN = ["", "}", ""].join("\n");

const screen = read("client/src/pages/Expenses.tsx");
const financeDb = read("server/db/finance.db.ts");
const router = read("server/routers/finance.router.ts");

function slice(src: string, startMarker: string, endMarker: string, label: string): string {
  const start = src.indexOf(startMarker);
  expect(start, `${label}: start marker "${startMarker}" not found`).toBeGreaterThan(-1);
  const end = src.indexOf(endMarker, start + startMarker.length);
  expect(end, `${label}: end marker "${endMarker}" not found after start`).toBeGreaterThan(start);
  const body = src.slice(start, end);
  expect(body.length, `${label}: slice is empty`).toBeGreaterThan(50);
  return body;
}

describe("a dinar expense is converted at a rate somebody chose", () => {
  it("puts the rate on the form", () => {
    expect(screen, "no rate field").toContain("expenses.dollarRate");
    expect(screen, "the form does not carry a rate").toContain("activeIqdRate");
  });

  it("starts from the rate the company recorded, not a number in the code", () => {
    expect(screen).toContain("trpc.exchangeRates.list.useQuery");
    expect(screen, "the hard-coded rate may only be the last resort").toContain("defaultIqdRate");
  });

  it("shows and saves the same figure", () => {
    // Two conversions is how the preview comes to disagree with what was
    // stored, and the reader believes the one they saw.
    const conversions = screen.split("amountUsd: amountInUsd.toFixed(2)").length - 1;
    expect(conversions, "the saved figure must come from the previewed one").toBe(1);
    expect(screen, "the preview must use the same value").toContain("${amountInUsd.toFixed(2)}");
  });

  it("keeps the rate with the expense it converted", () => {
    // Editing a March expense must not restate it at August's dinar.
    expect(screen).toContain("exchangeRate: expenseForm.currency === \"IQD\"");
    expect(screen, "editing must load the rate that was used").toContain("expense.exchangeRate");
  });
});

describe("a receipt number fills itself in", () => {
  const nextReference = () =>
    slice(financeDb, "export async function getNextExpenseReference", END_OF_FN, "getNextExpenseReference");

  it("uses the prefix somebody set, and the English name only as a fallback", () => {
    // "Fuel" is a poor label for a category everybody calls بەنزین.
    expect(nextReference()).toContain("category.code || category.nameEn");
  });

  it("counts past the highest used, not the number of rows", () => {
    // With three rows numbered 001, 002 and 007, a count hands out 004 —
    // fine — but with rows 001, 002 and 003 where 002 was later deleted, a
    // count hands out 003 again, onto a row that already has it. Max plus
    // one never collides with a number still in the table. A number whose
    // row was deleted can come round again, which is why this is a
    // suggestion in an editable field rather than an identity.
    const body = nextReference();
    expect(body).toContain("highest");
    expect(body, "a count would reissue a deleted number").not.toContain("COUNT(*)");
  });

  it("never overwrites a number somebody typed", () => {
    const body = slice(screen, "const suggestReference", "const handleSaveExpense", "suggestReference");
    expect(body).toContain("lastSuggestedReference.current");
    expect(body, "a hand-typed number must survive changing the category")
      .toContain('current !== ""');
  });

  it("does not stop an expense being recorded when it cannot suggest one", () => {
    const body = slice(screen, "const suggestReference", "const handleSaveExpense", "suggestReference");
    expect(body, "a suggestion is a convenience, not a precondition").toContain("catch");
  });

  it("is a suggestion, not a reservation", () => {
    expect(router).toContain("nextReference: accountantProcedure");
    // A query, not a mutation: nothing is written when one is asked for.
    const body = slice(router, "nextReference: accountantProcedure", "listBudgets", "nextReference");
    expect(body).toContain(".query(");
    expect(body).not.toContain(".mutation(");
  });
});
