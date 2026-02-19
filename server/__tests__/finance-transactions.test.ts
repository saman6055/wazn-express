import { describe, it, expect, beforeAll } from "vitest";
import * as db from "../db";

const hasDb = () => !!process.env.DATABASE_URL;

describe.skipIf(!hasDb())("applyCharge - Transaction Integrity", () => {
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

  it("should create invoice, ledger transaction, and update balance in one atomic operation", async () => {
    const balanceBefore = await db.getCustomerBalance(customerId);
    const amount = 100;

    const result = await db.applyCharge(
      customerId,
      customerCode,
      "PACKAGE",
      1,
      amount,
      "Test charge atomic",
      userId
    );

    expect(result.invoice).toBeDefined();
    expect(result.invoice.totalUsd).toBe(amount.toFixed(2));
    expect(result.transaction).toBeDefined();
    expect(parseFloat(result.transaction.balanceAfterUsd ?? "0")).toBe(balanceBefore + amount);
    expect(result.transaction.invoiceId).toBe(result.invoice.id);

    const account = await db.getCustomerAccountByCustomerId(customerId);
    expect(account).toBeDefined();
    expect(parseFloat(account!.currentBalanceUsd ?? "0")).toBe(balanceBefore + amount);

    const { data: transactions } = await db.getAccountLedgerTransactions(accountId, { limit: 10 });
    const txn = transactions.find((t) => t.id === result.transaction.id);
    expect(txn).toBeDefined();
    expect(txn!.accountId).toBe(accountId);
  });

  it("should handle concurrent charges correctly (no race condition)", async () => {
    const accountBefore = await db.getCustomerAccountByCustomerId(customerId);
    const balanceBefore = parseFloat(accountBefore!.currentBalanceUsd ?? "0");

    const [result1, result2] = await Promise.all([
      db.applyCharge(customerId, customerCode, "PACKAGE", 1001, 50, "Concurrent charge 1", userId),
      db.applyCharge(customerId, customerCode, "PACKAGE", 1002, 50, "Concurrent charge 2", userId),
    ]);

    const accountAfter = await db.getCustomerAccountByCustomerId(customerId);
    const balanceAfter = parseFloat(accountAfter!.currentBalanceUsd ?? "0");
    expect(balanceAfter).toBe(balanceBefore + 100);

    const { data: txns } = await db.getAccountLedgerTransactions(accountId, { limit: 100 });
    const relevant = txns.filter(
      (t) => t.id === result1.transaction.id || t.id === result2.transaction.id
    );
    expect(relevant).toHaveLength(2);
    const sorted = [...relevant].sort((a, b) => a.id - b.id);
    expect(parseFloat(sorted[0].balanceAfterUsd ?? "0")).toBe(parseFloat(sorted[1].balanceBeforeUsd ?? "0"));
  });
});

describe.skipIf(!hasDb())("recordPaymentReceived - Transaction Integrity", () => {
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

  it("should create payment record, ledger transaction, and update balance atomically", async () => {
    const balanceBefore = await db.getCustomerBalance(customerId);
    const payAmount = 50;

    const result = await db.recordPaymentReceived(
      customerId,
      customerCode,
      payAmount,
      0,
      "CASH",
      userId,
      "Test payment atomic"
    );

    expect(result.payment).toBeDefined();
    expect(result.payment.amountUsd).toBe(payAmount.toFixed(2));
    expect(result.transaction.transactionType).toBe("CREDIT_PAYMENT");
    expect(parseFloat(result.transaction.balanceBeforeUsd ?? "0")).toBe(balanceBefore);
    expect(parseFloat(result.transaction.balanceAfterUsd ?? "0")).toBe(balanceBefore - payAmount);

    const accountAfter = await db.getCustomerAccountByCustomerId(customerId);
    expect(parseFloat(accountAfter!.currentBalanceUsd ?? "0")).toBe(balanceBefore - payAmount);
  });

  it("should handle concurrent payments correctly", async () => {
    const balanceBefore = await db.getCustomerBalance(customerId);
    const payEach = 25;

    const [pay1, pay2] = await Promise.all([
      db.recordPaymentReceived(customerId, customerCode, payEach, 0, "CASH", userId, "Payment 1"),
      db.recordPaymentReceived(customerId, customerCode, payEach, 0, "CASH", userId, "Payment 2"),
    ]);

    expect(pay1.payment).toBeDefined();
    expect(pay2.payment).toBeDefined();

    const accountAfter = await db.getCustomerAccountByCustomerId(customerId);
    const balanceAfter = parseFloat(accountAfter!.currentBalanceUsd ?? "0");
    expect(balanceAfter).toBe(balanceBefore - payEach * 2);
  });
});

describe.skipIf(!hasDb())("transferBetweenAccounts - Atomicity", () => {
  let accountAId: number;
  let accountBId: number;
  const userId = 1;

  beforeAll(async () => {
    const accounts = await db.getActiveCashAccounts();
    if (accounts.length < 2) {
      const created1 = await db.createCashAccount({
        accountName: "Test Transfer A",
        accountType: "cash",
        initialBalance: "1000",
        isActive: true,
      });
      const created2 = await db.createCashAccount({
        accountName: "Test Transfer B",
        accountType: "cash",
        initialBalance: "500",
        isActive: true,
      });
      accountAId = created1.id;
      accountBId = created2.id;
    } else {
      accountAId = accounts[0].id;
      accountBId = accounts[1].id;
    }
  });

  it("should transfer money between two cash accounts atomically", async () => {
    const accountA = await db.getCashAccountById(accountAId);
    const accountB = await db.getCashAccountById(accountBId);
    if (!accountA || !accountB) throw new Error("Cash accounts not found");
    const balanceABefore = Number(accountA.currentBalance);
    const balanceBBefore = Number(accountB.currentBalance);

    const { fromTransaction, toTransaction } = await db.transferBetweenAccounts(
      accountAId,
      accountBId,
      300,
      "Test transfer",
      userId
    );

    expect(fromTransaction.transactionType).toBe("transfer_out");
    expect(toTransaction.transactionType).toBe("transfer_in");
    expect(parseFloat(fromTransaction.amount ?? "0")).toBe(300);
    expect(parseFloat(toTransaction.amount ?? "0")).toBe(300);

    const accountAAfter = await db.getCashAccountById(accountAId);
    const accountBAfter = await db.getCashAccountById(accountBId);
    expect(Number(accountAAfter!.currentBalance)).toBe(balanceABefore - 300);
    expect(Number(accountBAfter!.currentBalance)).toBe(balanceBBefore + 300);
  });

  it("should reject transfer when insufficient balance", async () => {
    const accountA = await db.getCashAccountById(accountAId);
    if (!accountA) throw new Error("Cash account not found");
    const balanceA = Number(accountA.currentBalance);

    await expect(
      db.transferBetweenAccounts(accountAId, accountBId, balanceA + 10000, "Too much", userId)
    ).rejects.toThrow(/Insufficient balance/);

    const after = await db.getCashAccountById(accountAId);
    expect(Number(after!.currentBalance)).toBe(balanceA);
  });
});

describe.skipIf(!hasDb())("createCashTransaction - Transaction Integrity", () => {
  let accountId: number;
  const userId = 1;

  beforeAll(async () => {
    const accounts = await db.getActiveCashAccounts();
    if (accounts.length === 0) {
      const created = await db.createCashAccount({
        accountName: "Test Cash Deposit",
        accountType: "cash",
        initialBalance: "0",
        isActive: true,
      });
      accountId = created.id;
    } else {
      accountId = accounts[0].id;
    }
  });

  it("should update cash account balance correctly for deposits", async () => {
    const accountBefore = await db.getCashAccountById(accountId);
    const balanceBefore = Number(accountBefore!.currentBalance);

    await db.createCashTransaction({
      accountId,
      transactionType: "deposit",
      amount: "500",
      description: "Test deposit",
      transactionDate: new Date(),
      createdById: userId,
    });

    const accountAfter = await db.getCashAccountById(accountId);
    expect(Number(accountAfter!.currentBalance)).toBe(balanceBefore + 500);
  });

  it("should handle concurrent deposits correctly", async () => {
    const accountBefore = await db.getCashAccountById(accountId);
    const balanceBefore = Number(accountBefore!.currentBalance);

    await Promise.all([
      db.createCashTransaction({
        accountId,
        transactionType: "deposit",
        amount: "200",
        description: "Deposit 1",
        transactionDate: new Date(),
        createdById: userId,
      }),
      db.createCashTransaction({
        accountId,
        transactionType: "deposit",
        amount: "200",
        description: "Deposit 2",
        transactionDate: new Date(),
        createdById: userId,
      }),
    ]);

    const accountAfter = await db.getCashAccountById(accountId);
    expect(Number(accountAfter!.currentBalance)).toBe(balanceBefore + 400);
  });
});

describe.skipIf(!hasDb())("End-to-End Financial Flow", () => {
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

  it("should handle full lifecycle: charge → payment → balance check", async () => {
    const balanceStart = await db.getCustomerBalance(customerId);

    const chargeResult = await db.applyCharge(
      customerId,
      customerCode,
      "PACKAGE",
      2001,
      150,
      "E2E charge",
      userId
    );
    expect(chargeResult.invoice).toBeDefined();
    expect(chargeResult.transaction.transactionType).toMatch(/DEBIT/);

    const balanceAfterCharge = await db.getCustomerBalance(customerId);
    expect(balanceAfterCharge).toBe(balanceStart + 150);

    const payResult = await db.recordPaymentReceived(
      customerId,
      customerCode,
      100,
      0,
      "CASH",
      userId,
      "E2E payment"
    );
    expect(payResult.payment).toBeDefined();

    const balanceAfterPayment = await db.getCustomerBalance(customerId);
    expect(balanceAfterPayment).toBe(balanceStart + 50);

    const validation = await db.validateAccountBalance(accountId);
    expect(validation.isValid).toBe(true);
    expect(validation.difference).toBe(0);
  });
});
