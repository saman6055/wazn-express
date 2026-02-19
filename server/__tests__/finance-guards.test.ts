import { describe, it, expect, beforeAll } from "vitest";
import * as db from "../db";

const hasDb = () => !!process.env.DATABASE_URL;

describe.skipIf(!hasDb())("Amount Validation Guards", () => {
  let customerId: number;
  let customerCode: string;
  let accountId: number;
  const userId = 1;

  beforeAll(async () => {
    const customers = await db.getAllCustomers();
    if (customers.length === 0) throw new Error("No customers found for testing");
    customerId = customers[0].id;
    customerCode = customers[0].customerCode ?? `C${customers[0].id}`;
    const account = await db.getOrCreateCustomerAccount(customerId, customerCode);
    accountId = account.id;
  });

  it("applyCharge should reject negative amounts", async () => {
    await expect(
      db.applyCharge(customerId, customerCode, "PACKAGE", 1, -50, "Negative test", userId)
    ).rejects.toThrow("Amount cannot be negative");
  });

  it("applyCharge should reject zero amount", async () => {
    await expect(
      db.applyCharge(customerId, customerCode, "PACKAGE", 1, 0, "Zero test", userId)
    ).rejects.toThrow("Amount must be greater than zero");
  });

  it("recordPaymentReceived should reject zero USD and zero IQD", async () => {
    await expect(
      db.recordPaymentReceived(customerId, customerCode, 0, 0, "CASH", userId)
    ).rejects.toThrow("Amount must be greater than zero");
  });

  it("recordPaymentReceived should accept zero USD if IQD is positive", async () => {
    const result = await db.recordPaymentReceived(
      customerId,
      customerCode,
      0,
      50000,
      "CASH",
      userId,
      "IQD only payment"
    );
    expect(result.payment).toBeDefined();
    expect(result.transaction).toBeDefined();
  });
});

describe.skipIf(!hasDb())("Insufficient Balance Guards", () => {
  let accountId: number;
  const userId = 1;

  beforeAll(async () => {
    const accounts = await db.getActiveCashAccounts();
    if (accounts.length === 0) {
      const created = await db.createCashAccount({
        accountName: "Test Insufficient",
        accountType: "cash",
        initialBalance: "100",
        isActive: true,
      });
      accountId = created.id;
    } else {
      await db.createCashAccount({
        accountName: "Test Insufficient " + Date.now(),
        accountType: "cash",
        initialBalance: "100",
        isActive: true,
      });
      const list = await db.getActiveCashAccounts();
      accountId = list[list.length - 1].id;
    }
  });

  it("cash withdrawal should fail when insufficient balance", async () => {
    await expect(
      db.createCashTransaction({
        accountId,
        transactionType: "withdrawal",
        amount: "500",
        description: "Too much",
        transactionDate: new Date(),
        createdById: userId,
      })
    ).rejects.toThrow(/Insufficient balance/);

    const account = await db.getCashAccountById(accountId);
    expect(Number(account!.currentBalance)).toBe(100);
  });

  it("cash expense should fail when insufficient balance", async () => {
    await expect(
      db.createCashTransaction({
        accountId,
        transactionType: "expense",
        amount: "9999",
        description: "Huge expense",
        transactionDate: new Date(),
        createdById: userId,
      })
    ).rejects.toThrow(/Insufficient balance/);
  });
});

describe.skipIf(!hasDb())("Safe Delete Guards", () => {
  it("deleteCashAccount should fail when transactions exist", async () => {
    const accounts = await db.getActiveCashAccounts();
    if (accounts.length === 0) return;
    for (const a of accounts) {
      const txns = await db.getCashTransactions(a.id, 1);
      if (txns.length > 0) {
        await expect(db.deleteCashAccount(a.id)).rejects.toThrow(/Cannot delete.*transactions/);
        const account = await db.getCashAccountById(a.id);
        expect(account).not.toBeNull();
        return;
      }
    }
  });

  it("deleteExpenseCategory should fail when expenses exist in that category", async () => {
    const categories = await db.getAllExpenseCategories();
    const expenses = await db.getAllExpenses({ limit: 100 });
    if (categories.length === 0 || expenses.length === 0) return;
    const categoryId = expenses[0].categoryId;
    await expect(db.deleteExpenseCategory(categoryId)).rejects.toThrow(/Cannot delete.*expenses/);
  });

  it("deletePartner should fail when partner has transactions", async () => {
    const partners = await db.getAllPartners();
    if (partners.length === 0) return;
    for (const p of partners) {
      const txns = await db.getPartnerTransactions(p.id, 1);
      if (txns.length > 0) {
        await expect(db.deletePartner(p.id)).rejects.toThrow(/Cannot delete.*transactions/);
        return;
      }
    }
  });

  it("deleteCompanyDebt should fail when debt has payments", async () => {
    const debts = await db.getAllCompanyDebts();
    if (debts.length === 0) return;
    for (const d of debts) {
      const payments = await db.getDebtPayments(d.id);
      if (payments.length > 0) {
        await expect(db.deleteCompanyDebt(d.id)).rejects.toThrow(/Cannot delete.*payments/);
        return;
      }
    }
  });
});

describe.skipIf(!hasDb())("Balance Repair Audit Trail", () => {
  let customerId: number;
  let customerCode: string;
  let accountId: number;
  const userId = 1;

  beforeAll(async () => {
    const customers = await db.getAllCustomers();
    if (customers.length === 0) throw new Error("No customers found for testing");
    customerId = customers[0].id;
    customerCode = customers[0].customerCode ?? `C${customers[0].id}`;
    const account = await db.getOrCreateCustomerAccount(customerId, customerCode);
    accountId = account.id;
  });

  it("repairAccountBalance should do nothing if balance is already correct", async () => {
    const result = await db.repairAccountBalance(accountId);
    expect(result.success).toBe(true);
    expect(result.difference).toBe(0);
  });
});
