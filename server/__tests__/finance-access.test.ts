import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { TRPCError } from "@trpc/server";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { DASHBOARD_FIGURE_IDS } from "../shared/dashboardExplain";
import { ALL_ACCOUNTS_ROLES, canSeeAllAccounts, isAllAccountsPath } from "../shared/financeAccess";

/**
 * The owner's decision (2026-09-11): an employee takes a payment at the
 * counter and reads the account in front of them, and that is all. Every
 * account at once, a manual charge, a debt reminder and the company's money
 * are for the admins and the accountant (and the auditor, who only reads).
 *
 * The refusals are checked by calling the procedures as an employee: the role
 * check runs before any query, so this needs no database. What must stay
 * open to employees is checked in the source, because calling it would.
 */

function contextFor(role: string): TrpcContext {
  return {
    user: {
      id: 42,
      openId: `finance-access-${role}`,
      email: null,
      name: role,
      loginMethod: "password",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as unknown as TrpcContext["user"],
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

async function codeOf(call: () => Promise<unknown>): Promise<string> {
  try {
    await call();
    return "OK";
  } catch (error) {
    return error instanceof TRPCError ? error.code : "OTHER";
  }
}

const employee = appRouter.createCaller(contextFor("employee"));

const BOOKS_ONLY: Array<[string, () => Promise<unknown>]> = [
  ["ledger.getAllAccounts", () => employee.ledger.getAllAccounts()],
  ["ledger.getSummary", () => employee.ledger.getSummary()],
  ["ledger.getDebtors", () => employee.ledger.getDebtors({ minBalanceUsd: 0 })],
  ["ledger.getTotalDebt", () => employee.ledger.getTotalDebt()],
  ["ledger.getRecentTransactions", () => employee.ledger.getRecentTransactions({ limit: 5 })],
  ["ledger.recordCharge", () => employee.ledger.recordCharge({
    customerId: 1, customerCode: "WZ-1", packageId: 1, amountUsd: 1, description: "manual charge",
  })],
  ["ledger.createReminder", () => employee.ledger.createReminder({
    accountId: 1, reminderType: "call", scheduledAt: new Date(),
  })],
  ["ledger.getPendingReminders", () => employee.ledger.getPendingReminders()],
  ["customers.getBalances", () => employee.customers.getBalances({ customerIds: [1, 2] })],
  ["dashboard.financialStats", () => employee.dashboard.financialStats()],
  ["dashboard.figureParts", () => employee.dashboard.figureParts({ figure: DASHBOARD_FIGURE_IDS[0] })],
  ["dashboard.revenueChart", () => employee.dashboard.revenueChart({ days: 7 })],
  ["dashboard.profitLossChart", () => employee.dashboard.profitLossChart({ days: 7 })],
  ["dashboard.topDebtors", () => employee.dashboard.topDebtors({ limit: 5 })],
  ["dashboard.weeklyHighlights", () => employee.dashboard.weeklyHighlights()],
  ["dashboard.exportPDF", () => employee.dashboard.exportPDF()],
  ["dashboard.exportFilteredPDF", () => employee.dashboard.exportFilteredPDF({ period: "week" })],
];

describe("an employee cannot read or change the books", () => {
  it.each(BOOKS_ONLY)("%s is refused", async (_name, call) => {
    expect(await codeOf(call)).toBe("FORBIDDEN");
  });
});

function read(relative: string): string {
  return fs.readFileSync(path.resolve(__dirname, relative), "utf8");
}

function between(source: string, start: string, end: string): string {
  const from = source.indexOf(start);
  expect(from, `"${start}" is gone — update this test, do not delete it`).toBeGreaterThan(-1);
  const to = source.indexOf(end, from + start.length);
  expect(to, `nothing after "${start}"`).toBeGreaterThan(from);
  return source.slice(from, to);
}

function builderOf(source: string, name: string): string {
  const match = new RegExp(`\\n\\s+${name}: (\\w+Procedure)`).exec(source);
  expect(match, `${name} is gone — update this test, do not delete it`).not.toBeNull();
  return match![1];
}

describe("the counter still works for an employee", () => {
  const FINANCE = read("routers/finance.router.ts");
  const LEDGER = between(FINANCE, "export const ledgerRouter", "\nexport const ");
  const DASHBOARD = between(read("routers/admin.router.ts"), "export const dashboardRouter", "\nexport const ");

  it.each(["recordPayment", "getAccountByCustomer", "getOrCreateAccount", "getTransactions", "getPayments"])(
    "ledger.%s stays open to all staff",
    (name) => {
      expect(builderOf(LEDGER, name)).toBe("staffProcedure");
    },
  );

  it.each(["forCustomer", "boxesForCustomer", "boxForCustomer", "batchesForCustomer"])(
    "the delivery screen's %s stays open to all staff",
    (name) => {
      expect(builderOf(FINANCE, name)).toBe("staffProcedure");
    },
  );

  it("the staff dashboard gets today's parcel count and nothing else", () => {
    expect(builderOf(DASHBOARD, "todayPackages")).toBe("staffProcedure");
    const body = between(DASHBOARD, "todayPackages: staffProcedure", "}),");
    expect(body).toContain("return { todayPackages: stats.todayPackages };");

    const screen = read("../client/src/pages/StaffDashboard.tsx");
    expect(screen).toContain("trpc.dashboard.todayPackages.useQuery()");
    expect(screen).not.toContain("trpc.dashboard.financialStats");
  });

  it("the payments page asks for the history only when the role may see it", () => {
    const page = read("../client/src/pages/Payments.tsx");
    expect(page).toContain("{ enabled: seesHistory }");
    expect(page).toContain("if (seesHistory) refetch();");
  });
});

describe("one list of roles for the books", () => {
  it("is the list accountantProcedure lets through", () => {
    const block = between(read("middleware/auth.ts"), "export const accountantProcedure", "});");
    const list = /\[([^\]]+)\]/.exec(block);
    expect(list, "accountantProcedure no longer names its roles in one list").not.toBeNull();
    const roles = list![1].split(",").map((r) => r.trim().replace(/^["']|["']$/g, ""));
    expect([...roles].sort()).toEqual([...ALL_ACCOUNTS_ROLES].sort());
  });

  it("lets the right people in", () => {
    expect(canSeeAllAccounts("employee")).toBe(false);
    expect(canSeeAllAccounts(undefined)).toBe(false);
    expect(canSeeAllAccounts("accountant")).toBe(true);
    expect(canSeeAllAccounts("admin")).toBe(true);
    expect(canSeeAllAccounts("auditor")).toBe(true);
    expect(canSeeAllAccounts("super_admin")).toBe(true);
  });

  it("knows which screens are built from every account", () => {
    expect(isAllAccountsPath("/finance")).toBe(true);
    expect(isAllAccountsPath("/finance/")).toBe(true);
    expect(isAllAccountsPath("/finance/debtors?sort=amount")).toBe(true);
    expect(isAllAccountsPath("/accounting")).toBe(true);
    // One customer's account, and the counter, are not.
    expect(isAllAccountsPath("/finance/customer/12")).toBe(false);
    expect(isAllAccountsPath("/payments")).toBe(false);
    expect(isAllAccountsPath("/customer-delivery-scanner")).toBe(false);
  });

  it("the layout refuses those screens to an employee", () => {
    const hook = read("../client/src/hooks/usePermissions.ts");
    expect(hook).toContain("isAllAccountsPath(path) && !canSeeAllAccounts(userRole)");
  });
});
