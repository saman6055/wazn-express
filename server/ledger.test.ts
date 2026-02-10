import { describe, it, expect, beforeAll } from "vitest";
import * as db from "./db";

describe("Customer Ledger System", () => {
  let testCustomerId: number;
  let testAccountId: number;
  let testCustomerCode: string;

  beforeAll(async () => {
    // Get an existing customer for testing
    const customers = await db.getAllCustomers();
    if (customers.length > 0) {
      testCustomerId = customers[0].id;
      testCustomerCode = customers[0].customerCode || `C${customers[0].id}`;
    } else {
      throw new Error("No customers found for testing");
    }
  });

  describe("Account Management", () => {
    it("should create or get a customer account", async () => {
      const account = await db.getOrCreateCustomerAccount(testCustomerId, testCustomerCode);

      expect(account).toBeDefined();
      expect(account.customerId).toBe(testCustomerId);
      expect(account.accountNumber).toBeDefined();
      expect(account.accountStatus).toBe("active");
      
      testAccountId = account.id;
    });

    it("should get existing account for same customer", async () => {
      const account = await db.getOrCreateCustomerAccount(testCustomerId, testCustomerCode);
      expect(account.id).toBe(testAccountId);
    });

    it("should get account by customer ID", async () => {
      const account = await db.getCustomerAccountByCustomerId(testCustomerId);
      expect(account).toBeDefined();
      expect(account?.id).toBe(testAccountId);
    });

    it("should list all accounts with info", async () => {
      const accounts = await db.getAllCustomerAccountsWithInfo();
      expect(Array.isArray(accounts)).toBe(true);
      expect(accounts.length).toBeGreaterThan(0);
    });
  });

  describe("Payment Recording via positional args", () => {
    it("should record a payment using recordPaymentReceived", async () => {
      const result = await db.recordPaymentReceived(
        testCustomerId,
        testCustomerCode,
        100, // amountUsd
        0,   // amountIqd
        "CASH",
        1,   // receivedById
        "Test payment " + Date.now()
      );

      expect(result.payment).toBeDefined();
      expect(result.transaction).toBeDefined();
      expect(result.payment.amountUsd).toBe("100.00");
      expect(result.payment.paymentMethod).toBe("CASH");
      expect(result.transaction.transactionType).toBe("CREDIT_PAYMENT");
    });

    it("should list payments for account", async () => {
      const payments = await db.getAccountPaymentRecords(testAccountId, 10);
      expect(Array.isArray(payments)).toBe(true);
      expect(payments.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Ledger Transactions", () => {
    it("should create a debit transaction", async () => {
      const account = await db.getCustomerAccountByCustomerId(testCustomerId);
      const balanceBefore = parseFloat(account?.currentBalanceUsd || "0");
      
      const transaction = await db.createLedgerTransaction({
        accountId: testAccountId,
        transactionNumber: db.generateTransactionNumber(),
        transactionType: "DEBIT_PACKAGE",
        amountUsd: "50.00",
        amountIqd: "0",
        balanceBeforeUsd: account?.currentBalanceUsd || "0.00",
        balanceAfterUsd: String(balanceBefore + 50),
        balanceBeforeIqd: account?.currentBalanceIqd || "0",
        balanceAfterIqd: account?.currentBalanceIqd || "0",
        description: "Test package charge",
        createdById: 1,
      });

      expect(transaction).toBeDefined();
      expect(transaction.amountUsd).toBe("50.00");
      expect(transaction.transactionType).toBe("DEBIT_PACKAGE");
    });

    it("should get transactions for account", async () => {
      const transactions = await db.getAccountLedgerTransactions(testAccountId, 50);
      expect(Array.isArray(transactions)).toBe(true);
      expect(transactions.length).toBeGreaterThanOrEqual(1);
    });

    it("should get recent transactions", async () => {
      const transactions = await db.getRecentTransactions(10);
      expect(Array.isArray(transactions)).toBe(true);
    });
  });

  describe("Debtors Report", () => {
    it("should get debtors list", async () => {
      const debtors = await db.getDebtors(0);
      expect(Array.isArray(debtors)).toBe(true);
    });
  });

  describe("Summary Statistics", () => {
    it("should get total debt amount", async () => {
      const totals = await db.getTotalDebtAmount();
      expect(totals).toBeDefined();
      expect(typeof totals.totalUsd).toBe("number");
      expect(typeof totals.totalIqd).toBe("number");
      expect(typeof totals.count).toBe("number");
    });
  });

  describe("Utility Functions", () => {
    it("should generate account number", () => {
      const accountNumber = db.generateAccountNumber("TEST123");
      expect(accountNumber).toBeDefined();
      expect(accountNumber.startsWith("ACC-")).toBe(true);
    });

    it("should generate transaction number", () => {
      const txnNumber = db.generateTransactionNumber();
      expect(txnNumber).toBeDefined();
      expect(txnNumber.startsWith("TXN-")).toBe(true);
    });

    it("should generate payment number", () => {
      const paymentNumber = db.generatePaymentNumber();
      expect(paymentNumber).toBeDefined();
      expect(paymentNumber.startsWith("PAY-")).toBe(true);
    });
  });
});
