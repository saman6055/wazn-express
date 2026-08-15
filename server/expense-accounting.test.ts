import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { SCHEMA_PATCHES } from "./_core/migrations";

/**
 * An expense has to affect three things, and used to affect one.
 *
 *   the expense list      — it always did
 *   the daily summary     — only ever went up; editing and deleting were silent
 *   the cash balance      — never, though the screen asked which account paid
 *
 * The last one is the one that matters most: the Treasury went on showing
 * money that had already left the building. Everything needed was present —
 * a cash transaction type of `expense`, a relatedEntityType/Id pair to tie it
 * back, a balance update that locks the account row — and none of it was
 * called.
 *
 * Source-text assertions rather than a live DB, because this repo's tests run
 * without one. Each slice is checked to be non-empty first — an unmatched
 * marker must fail loudly rather than silently assert against "".
 */

const ROOT = path.join(__dirname, "..");

/**
 * Line endings normalised on the way in.
 *
 * The markers below span lines — `"\n}\n"` closes a function. On a checkout
 * with CRLF endings that is `"\n}\r\n"`, the marker matches nothing, and the
 * guard fails for a reason that has nothing to do with the code it guards.
 */
const read = (p: string) =>
  fs.readFileSync(path.join(ROOT, p), "utf8").replace(/\r\n/g, "\n");

function slice(src: string, startMarker: string, endMarker: string, label: string): string {
  const start = src.indexOf(startMarker);
  expect(start, `${label}: start marker "${startMarker}" not found`).toBeGreaterThan(-1);
  const end = src.indexOf(endMarker, start + startMarker.length);
  expect(end, `${label}: end marker "${endMarker}" not found after start`).toBeGreaterThan(start);
  const body = src.slice(start, end);
  expect(body.length, `${label}: slice is empty`).toBeGreaterThan(50);
  return body;
}

const router = read("server/routers/finance.router.ts");
const financeDb = read("server/db/finance.db.ts");
const migrations = read("server/_core/migrations.ts");

const expensesRouter = () =>
  slice(router, "export const expensesRouter", "export const expenseAlertsRouter", "expensesRouter");

/** The delete procedure is the last one, so it runs to the end of the router. */
function deleteProcedure(): string {
  const body = expensesRouter();
  const at = body.indexOf("delete: adminProcedure");
  expect(at, "expenses.delete not found").toBeGreaterThan(-1);
  const tail = body.slice(at);
  expect(tail.length, "expenses.delete slice is empty").toBeGreaterThan(200);
  return tail;
}

describe("an expense moves the money it spent", () => {
  it("takes it out of the account that paid", () => {
    const create = slice(expensesRouter(), "create: accountantProcedure", "update: accountantProcedure", "expenses.create");
    expect(create, "the chosen account must actually be charged")
      .toContain("recordExpenseCashMovement");
    expect(create, "only when an account was chosen — some expenses are paid personally")
      .toContain("if (input.cashAccountId)");
  });

  it("records it even when the account goes negative", () => {
    // The money is already gone. Refusing to write it down does not bring it
    // back; it only leaves the books wrong in a way nobody can see. A
    // negative balance is visible and can be investigated.
    const helper = slice(
      financeDb,
      "export async function recordExpenseCashMovement",
      "export async function getExpenseCashMovements",
      "recordExpenseCashMovement"
    );
    expect(helper).toContain("allowOverdraft: true");

    const create = slice(expensesRouter(), "create: accountantProcedure", "update: accountantProcedure", "expenses.create");
    expect(create, "going negative must be reported, not hidden").toContain("wentNegative");
  });

  it("still refuses an overdraft on money somebody is instructing", () => {
    // A withdrawal or a transfer is an instruction — the money is not there,
    // so refusing is right. Only an already-spent expense may overdraw.
    const cashTxn = slice(
      financeDb,
      "export async function createCashTransaction",
      "// Transfer between accounts",
      "createCashTransaction"
    );
    expect(cashTxn, "the balance check must survive").toContain("Insufficient balance");
    expect(cashTxn, "and must only be skipped when explicitly allowed")
      .toContain("!options.allowOverdraft");
  });

  it("puts the money back when the expense is deleted", () => {
    const del = deleteProcedure();
    const reverseAt = del.indexOf("reverseExpenseCashMovement");
    const deleteAt = del.indexOf("db.deleteExpense");
    expect(reverseAt, "deleting must return the money").toBeGreaterThan(-1);
    expect(reverseAt, "after the row is gone there is nothing left to reverse")
      .toBeLessThan(deleteAt);
  });

  it("moves the money when the amount, date or account changes", () => {
    const update = slice(expensesRouter(), "update: accountantProcedure", "delete: adminProcedure", "expenses.update");
    expect(update).toContain("reverseExpenseCashMovement");
    expect(update).toContain("recordExpenseCashMovement");
    for (const trigger of ["amountChanged", "accountChanged", "dateChanged"]) {
      expect(update, `${trigger} must move the cash with it`).toContain(trigger);
    }
  });

  it("reverses by opposing entry, never by deleting history", () => {
    // Every later statement line carries a balanceBefore/balanceAfter
    // computed against the original. Removing it would leave them all
    // describing a balance the account never had.
    // "\n}" alone matches the closing brace of the params object type, which
    // sits at column 0 as well — and that slice was long enough to pass the
    // non-empty guard while being entirely the wrong text.
    const reverse = slice(
      financeDb,
      "export async function reverseExpenseCashMovement",
      "\n}\n",
      "reverseExpenseCashMovement"
    );
    expect(reverse, "sliced the signature instead of the body").toContain("netByAccount");
    expect(reverse).toContain("'adjustment'");
    expect(reverse, "history must not be deleted").not.toContain("db.delete(cashTransactions)");
    expect(reverse, "reversing twice must post nothing the second time").toContain("net === 0");
  });
});

describe("the daily summary comes back down", () => {
  it("is reduced when an expense is deleted", () => {
    const del = deleteProcedure();
    expect(del).toMatch(/addExpense:\s*-/);
  });

  it("is corrected when an expense is edited", () => {
    const update = slice(expensesRouter(), "update: accountantProcedure", "delete: adminProcedure", "expenses.update");
    expect(update, "a changed amount must adjust the day").toContain("addExpense");
    expect(update, "moving to another day must come off the old one").toMatch(/addExpense:\s*-oldAmount/);
  });

  it("records who removed money from the books", () => {
    const del = deleteProcedure();
    expect(del).toContain("delete_expense");
  });
});

describe("expense categories exist and match the code", () => {
  it("the columns the code writes are all added", () => {
    // The CREATE TABLE makes name/nameKu/description/isActive; the code
    // inserts nameEn, nameAr, icon, color, isRecurring, sortOrder. Every
    // insert wrote columns that did not exist.
    for (const column of ["nameEn", "nameAr", "icon", "color", "isRecurring", "sortOrder"]) {
      expect(migrations, `expenseCategories.${column} must be patched in`)
        .toContain(`expenseCategories.${column}`);
    }
  });

  it("the legacy NOT NULL column no longer blocks an insert", () => {
    expect(migrations).toContain("expenseCategories.name.nullable");
  });

  it("ships the categories this company actually spends on", () => {
    // An empty table means the first job is inventing categories by hand.
    const seeded = SCHEMA_PATCHES.map((p) => p.name).filter((n) => n.startsWith("seed.expenseCategory."));
    expect(seeded.length, "no categories are seeded at all").toBeGreaterThan(10);
    for (const category of ["fuel", "meals", "rent", "salaries", "supplies"]) {
      expect(seeded, `no seed for ${category}`).toContain(`seed.expenseCategory.${category}`);
    }
  });

  it("seeds without duplicating on the next deploy", () => {
    // Migrations run every deploy; an unguarded insert would add the whole
    // list again each time.
    expect(migrations).toContain("WHERE NOT EXISTS");
  });

  it("quotes its seed values in a way MySQL always reads as text", () => {
    // Under ANSI_QUOTES a double-quoted literal is read as an identifier and
    // the statement fails.
    const seed = slice(migrations, "// ---- the categories this company", "].map(", "category seed rows");
    expect(seed).not.toMatch(/SELECT\s+"/);
  });
});
