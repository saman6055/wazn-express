import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * The expenses report has to be a report, not a total.
 *
 * A figure on its own says nothing: $4,280 is either a quiet month or an
 * alarming one, and only the month before it can say which. And a figure the
 * reader cannot open is one they have to take on trust — so every one of them
 * leads to the rows behind it.
 *
 * The trap this guards is the destination, not the panel. A click that lands
 * on an unfiltered list is worse than no click, because it looks like an
 * answer. See client/src/components/FilteredByLinkBanner.tsx.
 */

const ROOT = path.join(__dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8").replace(/\r\n/g, "\n");

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
const screen = read("client/src/pages/Expenses.tsx");
const dashboard = read("client/src/components/expenses/ExpensesDashboard.tsx");

/** A function's closing brace at column 0, spelled once. */
const END_OF_FN = ["", "}", ""].join("\n");

const getDashboard = () =>
  slice(router, "getDashboard: accountantProcedure", "update: accountantProcedure", "expenses.getDashboard");

describe("the expenses report compares against something", () => {
  it("reads the window before the one on screen, at the same length", () => {
    const body = getDashboard();
    expect(body, "no previous window is read").toContain("previousStart");
    // A calendar month would make the first days of a month read as a
    // collapse. Same length, ending the day before this one starts.
    expect(body).toContain("endDate.getTime() - startDate.getTime()");
    expect(body).toContain("startDate.getTime() - DAY");
  });

  it("asks the same function for both windows", () => {
    // Two different totals functions is how the comparison comes to be
    // against something that was never measured the same way.
    const body = getDashboard();
    const calls = body.split("db.getExpensesSummary(").length - 1;
    expect(calls, "the two windows are not summed by the same function").toBe(2);
  });

  it("takes revenue from the finance report rather than recomputing it", () => {
    expect(getDashboard(), "profit must come from the shared calculation")
      .toContain("db.calculateProfitLoss(startDate, endDate)");
  });

  it("subtracts the expenses figure the screen itself shows", () => {
    // calculateProfitLoss counts costs the expenses table knows nothing
    // about. Mixing the two prints a subtraction that does not work out.
    expect(getDashboard()).toContain("expensesInPeriod: current.totalAmount");
  });
});

describe("the report reads, and only reads", () => {
  it("adds no writes to the database", () => {
    const added = [
      "getExpensesDailyTotals",
      "getExpensesByVendor",
      "getExpensesPaymentSplit",
    ];
    for (const fn of added) {
      const body = slice(financeDb, `export async function ${fn}`, "\n}\n", fn);
      for (const write of ["db.insert(", "db.update(", "db.delete("]) {
        expect(body, `${fn} must not ${write}`).not.toContain(write);
      }
    }
  });

  it("counts money out of an account separately from money out of a pocket", () => {
    // Both are spending. Only the first has moved through the Treasury, and
    // the second is owed back to somebody.
    const body = slice(
      financeDb,
      "export async function getExpensesPaymentSplit",
      "\n}\n",
      "getExpensesPaymentSplit",
    );
    expect(body).toContain("IS NOT NULL");
    expect(body).toContain("IS NULL");
  });
});

describe("every figure leads to the rows behind it", () => {
  it("filters the list rather than opening it whole", () => {
    expect(screen, "clicking a category must filter").toContain("onSelectCategory");
    expect(screen, "clicking a supplier must filter").toContain("onSelectVendor");
    const handler = slice(screen, "onSelectCategory={(categoryId)", "onSelectVendor=", "category click");
    expect(handler, "the click must set the list's own filter").toContain("setSelectedCategory");
  });

  it("says so when the list arrived filtered", () => {
    // A list of one row where there are normally thirty reads as data loss,
    // and the reader's next move is to report a bug rather than read the row.
    expect(screen).toContain("FilteredByLinkBanner");
    expect(screen).toContain("clickFilters");
  });

  it("asks for alerts only where they are allowed to be asked for", () => {
    // The alerts endpoints are admin-only. An accountant asking would be
    // refused, and the refusal would surface as an error on a screen they
    // are entitled to use.
    expect(screen).toContain("canSeeAlerts");
    expect(screen).toMatch(/enabled:\s*canSeeAlerts/);
  });

  it("counts alerts that fired inside the window, not alerts that exist", () => {
    const body = slice(screen, "const activeAlertCount", "}, [alertLogs", "activeAlertCount");
    expect(body, "an alert that exists has not necessarily fired").toContain("triggeredAt");
  });
});

describe("the report refuses to state what it cannot know", () => {
  it("does not call a missing account a personal payment", () => {
    // A row with no cashAccountId is not "paid out of pocket" — nobody
    // wrote down where the money came from. Every expense recorded before
    // the screen asked is in that state, and calling it personal spending
    // invents a debt to somebody.
    expect(dashboard).toContain("leftTheAccounts");
    expect(dashboard, "the gap must be named, not interpreted").toContain("unassignedHint");
    expect(dashboard, "and it must open the rows it counted").toContain("onShowUnassigned");
  });

  it("does not report a share of a profit that was never made", () => {
    // Zero revenue does not mean expenses ate 0% of the profit.
    expect(dashboard).toContain("grossProfit > 0 ?");
  });

  it("does not report growth from nothing as a percentage", () => {
    const body = slice(dashboard, "function changePercent", "\n}\n", "changePercent");
    expect(body, "dividing by a previous total of zero").toContain("before <= 0");
  });

  it("reads a rise in spending as bad and a fall as good", () => {
    // The opposite of a revenue figure, and the mistake is invisible: green
    // on a number that went up looks like good news.
    expect(dashboard).toContain("const bad = invert ? !up : up");
  });
});

/**
 * A budget is only worth reading if it can be breached by a decision.
 *
 * Rent, salaries, water and electricity arrive whether anybody watches or
 * not. A budget that counts them is breached on the same day every month by
 * the same amount, and a warning that fires every month is one nobody reads
 * by the third. So the overall budget covers non-recurring spending only —
 * the owner's own words, and the reason the feature exists.
 */
describe("a budget covers what is still a decision", () => {
  const budgetStatus = () =>
    slice(financeDb, "export async function getExpenseBudgetStatus", END_OF_FN, "getExpenseBudgetStatus");

  it("leaves recurring categories out of the overall figure", () => {
    const body = budgetStatus();
    expect(body, "recurring categories are not identified at all").toContain("isRecurring");
    expect(body, "and are not excluded from the overall total").toContain("!recurring.has(categoryId)");
  });

  it("measures a category budget against that category alone", () => {
    // Somebody who set a budget on one category has said which spending
    // they mean, recurring or not.
    expect(budgetStatus()).toContain("spentByCategory.get(b.categoryId!)");
  });

  it("answers for the calendar month, not the window on screen", () => {
    // A monthly promise measured over eleven days reports every month as
    // comfortably under.
    const body = getDashboard();
    expect(body).toContain("monthStart");
    expect(body).toContain("getExpenseBudgetStatus(monthStart, monthEnd, endDate)");
  });

  it("counts the days of the month from the calendar", () => {
    // monthEnd carries the last day's 23:59, so measuring the gap and adding
    // one for "both ends" invents a thirty-second of August.
    const body = budgetStatus();
    expect(body).toContain("monthStart.getMonth() + 1, 0).getDate()");
  });

  it("treats clearing a budget as removing it", () => {
    // "No budget" and "a budget of zero" are different statements, and a
    // budget of zero is breached by the first expense of the month.
    const body = slice(financeDb, "export async function setExpenseBudget", END_OF_FN, "setExpenseBudget");
    expect(body).toContain("monthlyAmountUsd <= 0");
    expect(body).toContain("db.delete(expenseBudgets)");
  });

  it("lets anyone read a budget and only an owner set one", () => {
    expect(router).toContain("listBudgets: accountantProcedure");
    expect(router).toContain("setBudget: adminProcedure");
  });

  it("says on the screen which spending it does not count", () => {
    expect(dashboard, "the exclusion must be stated, or the figure misleads")
      .toContain("budgetExcludesRecurring");
  });
});
