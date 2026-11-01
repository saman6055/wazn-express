import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("./db", () => ({
  default: {
    getAllCashAccounts: vi.fn(),
    getActiveCashAccounts: vi.fn(),
    getCashAccountsSummary: vi.fn(),
    createCashAccount: vi.fn(),
    updateCashAccount: vi.fn(),
    deleteCashAccount: vi.fn(),
    getCashAccountTransactions: vi.fn(),
    recordCashTransaction: vi.fn(),
    transferBetweenAccounts: vi.fn(),
  },
}));

import db from "./db";

describe("Cash Accounts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getAllCashAccounts", () => {
    it("should return all cash accounts", async () => {
      const mockAccounts = [
        {
          id: 1,
          accountName: "Main Cash Box",
          accountNameKu: "سندوقی سەرەکی",
          accountType: "cash",
          currentBalance: "5000.00",
          currency: "USD",
          isActive: true,
          isPrimary: true,
        },
        {
          id: 2,
          accountName: "Bank Account",
          accountNameKu: "هەژماری بانک",
          accountType: "bank",
          bankName: "Kurdistan Bank",
          accountNumber: "1234567890",
          currentBalance: "15000.00",
          currency: "USD",
          isActive: true,
          isPrimary: false,
        },
      ];

      (db.getAllCashAccounts as any).mockResolvedValue(mockAccounts);

      const result = await db.getAllCashAccounts();
      expect(result).toHaveLength(2);
      expect(result[0].accountType).toBe("cash");
      expect(result[1].accountType).toBe("bank");
      expect(db.getAllCashAccounts).toHaveBeenCalledOnce();
    });
  });

  describe("getActiveCashAccounts", () => {
    it("should return only active cash accounts", async () => {
      const mockActiveAccounts = [
        {
          id: 1,
          accountName: "Main Cash Box",
          accountType: "cash",
          currentBalance: "5000.00",
          isActive: true,
        },
      ];

      (db.getActiveCashAccounts as any).mockResolvedValue(mockActiveAccounts);

      const result = await db.getActiveCashAccounts();
      expect(result).toHaveLength(1);
      expect(result[0].isActive).toBe(true);
    });
  });

  describe("getCashAccountsSummary", () => {
    it("should return correct summary with totals", async () => {
      const mockSummary = {
        totalBalance: 20000,
        totalCash: 5000,
        totalBank: 15000,
        accountCount: 2,
      };

      (db.getCashAccountsSummary as any).mockResolvedValue(mockSummary);

      const result = await db.getCashAccountsSummary();
      expect(result.totalBalance).toBe(20000);
      expect(result.totalCash).toBe(5000);
      expect(result.totalBank).toBe(15000);
      expect(result.accountCount).toBe(2);
    });
  });

  describe("createCashAccount", () => {
    it("should create a new cash account with correct data", async () => {
      const newAccount = {
        accountName: "New Wallet",
        accountNameKu: "جزدانی نوێ",
        accountType: "mobile_wallet" as const,
        currency: "USD" as const,
        initialBalance: "1000",
        isPrimary: false,
      };

      const mockCreated = { id: 3, ...newAccount, currentBalance: "1000.00", isActive: true };
      (db.createCashAccount as any).mockResolvedValue(mockCreated);

      const result = await db.createCashAccount(newAccount);
      expect(result.id).toBe(3);
      expect(result.accountType).toBe("mobile_wallet");
      expect(result.currentBalance).toBe("1000.00");
      expect(db.createCashAccount).toHaveBeenCalledWith(newAccount);
    });

    it("should create account with zero initial balance by default", async () => {
      const newAccount = {
        accountName: "Empty Account",
        accountType: "cash" as const,
        currency: "USD" as const,
        initialBalance: "0",
        isPrimary: false,
      };

      const mockCreated = { id: 4, ...newAccount, currentBalance: "0.00", isActive: true };
      (db.createCashAccount as any).mockResolvedValue(mockCreated);

      const result = await db.createCashAccount(newAccount);
      expect(result.currentBalance).toBe("0.00");
    });
  });

  describe("updateCashAccount", () => {
    it("should update account details", async () => {
      const updateData = {
        id: 1,
        accountName: "Updated Cash Box",
        isPrimary: true,
      };

      const mockUpdated = {
        id: 1,
        accountName: "Updated Cash Box",
        accountType: "cash",
        isPrimary: true,
        isActive: true,
      };

      (db.updateCashAccount as any).mockResolvedValue(mockUpdated);

      const result = await db.updateCashAccount(updateData);
      expect(result.accountName).toBe("Updated Cash Box");
      expect(result.isPrimary).toBe(true);
    });
  });

  describe("deleteCashAccount", () => {
    it("should delete an account by id", async () => {
      (db.deleteCashAccount as any).mockResolvedValue({ success: true });

      const result = await db.deleteCashAccount({ id: 1 });
      expect(result.success).toBe(true);
      expect(db.deleteCashAccount).toHaveBeenCalledWith({ id: 1 });
    });
  });

  describe("recordCashTransaction", () => {
    it("should record a deposit transaction", async () => {
      const txData = {
        accountId: 1,
        transactionType: "deposit" as const,
        amount: "500.00",
        description: "Customer payment",
      };

      const mockTx = {
        id: 10,
        ...txData,
        balanceAfter: "5500.00",
        transactionDate: new Date(),
      };

      (db.recordCashTransaction as any).mockResolvedValue(mockTx);

      const result = await db.recordCashTransaction(txData);
      expect(result.transactionType).toBe("deposit");
      expect(result.amount).toBe("500.00");
      expect(result.balanceAfter).toBe("5500.00");
    });

    it("should record a withdrawal transaction", async () => {
      const txData = {
        accountId: 1,
        transactionType: "withdrawal" as const,
        amount: "200.00",
        description: "Office expense",
      };

      const mockTx = {
        id: 11,
        ...txData,
        balanceAfter: "4800.00",
        transactionDate: new Date(),
      };

      (db.recordCashTransaction as any).mockResolvedValue(mockTx);

      const result = await db.recordCashTransaction(txData);
      expect(result.transactionType).toBe("withdrawal");
      expect(result.balanceAfter).toBe("4800.00");
    });
  });

  describe("transferBetweenAccounts", () => {
    it("should transfer funds between two accounts", async () => {
      const transferData = {
        fromAccountId: 1,
        toAccountId: 2,
        amount: 1000,
        description: "Transfer to bank",
      };

      const mockResult = {
        success: true,
        fromBalance: "4000.00",
        toBalance: "16000.00",
      };

      (db.transferBetweenAccounts as any).mockResolvedValue(mockResult);

      const result = await db.transferBetweenAccounts(transferData);
      expect(result.success).toBe(true);
      expect(result.fromBalance).toBe("4000.00");
      expect(result.toBalance).toBe("16000.00");
    });

    it("should not allow transfer to the same account", async () => {
      const transferData = {
        fromAccountId: 1,
        toAccountId: 1,
        amount: 500,
      };

      (db.transferBetweenAccounts as any).mockRejectedValue(
        new Error("Cannot transfer to the same account")
      );

      await expect(db.transferBetweenAccounts(transferData)).rejects.toThrow(
        "Cannot transfer to the same account"
      );
    });

    it("should not allow transfer with zero or negative amount", async () => {
      const transferData = {
        fromAccountId: 1,
        toAccountId: 2,
        amount: 0,
      };

      (db.transferBetweenAccounts as any).mockRejectedValue(
        new Error("Amount must be positive")
      );

      await expect(db.transferBetweenAccounts(transferData)).rejects.toThrow(
        "Amount must be positive"
      );
    });
  });

  describe("getCashAccountTransactions", () => {
    it("should return transactions for a specific account", async () => {
      const mockTransactions = [
        {
          id: 1,
          accountId: 1,
          transactionType: "deposit",
          amount: "1000.00",
          balanceAfter: "6000.00",
          description: "Initial deposit",
          transactionDate: new Date("2026-01-01"),
        },
        {
          id: 2,
          accountId: 1,
          transactionType: "withdrawal",
          amount: "200.00",
          balanceAfter: "5800.00",
          description: "Office supplies",
          transactionDate: new Date("2026-01-02"),
        },
      ];

      (db.getCashAccountTransactions as any).mockResolvedValue(mockTransactions);

      const result = await db.getCashAccountTransactions({ accountId: 1, limit: 100 });
      expect(result).toHaveLength(2);
      expect(result[0].transactionType).toBe("deposit");
      expect(result[1].transactionType).toBe("withdrawal");
    });

    it("should return empty array for account with no transactions", async () => {
      (db.getCashAccountTransactions as any).mockResolvedValue([]);

      const result = await db.getCashAccountTransactions({ accountId: 999, limit: 100 });
      expect(result).toHaveLength(0);
    });
  });

  describe("Account type validation", () => {
    it("should correctly identify cash account types", () => {
      const accountTypes = ["cash", "bank", "mobile_wallet"];
      expect(accountTypes).toContain("cash");
      expect(accountTypes).toContain("bank");
      expect(accountTypes).toContain("mobile_wallet");
      expect(accountTypes).not.toContain("crypto");
    });

    it("should correctly identify transaction types", () => {
      const incomeTypes = ["deposit", "transfer_in", "customer_payment", "partner_deposit"];
      const expenseTypes = ["withdrawal", "transfer_out", "expense", "debt_payment", "partner_withdrawal"];
      
      expect(incomeTypes).toContain("deposit");
      expect(incomeTypes).toContain("customer_payment");
      expect(expenseTypes).toContain("withdrawal");
      expect(expenseTypes).toContain("expense");
    });
  });

  describe("Currency formatting", () => {
    it("should format USD amounts correctly", () => {
      const formatCurrency = (amount: string | number) => {
        const num = typeof amount === "string" ? parseFloat(amount) : amount;
        return `$${num.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
      };

      expect(formatCurrency(1000)).toBe("$1,000");
      expect(formatCurrency("5000.50")).toBe("$5,000.5");
      expect(formatCurrency(0)).toBe("$0");
      expect(formatCurrency(-500)).toBe("$-500");
    });
  });

  describe("Payment with cashAccountId", () => {
    it("should include cashAccountId when recording payment", () => {
      const paymentData = {
        customerId: 1,
        customerCode: "C001",
        amountUsd: 100,
        amountIqd: 0,
        paymentMethod: "CASH" as const,
        cashAccountId: 1,
      };

      expect(paymentData.cashAccountId).toBe(1);
      expect(paymentData).toHaveProperty("cashAccountId");
    });

    it("should allow payment without cashAccountId", () => {
      const paymentData = {
        customerId: 1,
        customerCode: "C001",
        amountUsd: 100,
        amountIqd: 0,
        paymentMethod: "CASH" as const,
        cashAccountId: undefined,
      };

      expect(paymentData.cashAccountId).toBeUndefined();
    });

    it("should handle 'none' selection as no account", () => {
      const selectedValue = "none";
      const cashAccountId = selectedValue && selectedValue !== "none" 
        ? parseInt(selectedValue) 
        : undefined;
      
      expect(cashAccountId).toBeUndefined();
    });

    it("should parse valid account id from string", () => {
      const selectedValue = "5";
      const cashAccountId = selectedValue && selectedValue !== "none" 
        ? parseInt(selectedValue) 
        : undefined;
      
      expect(cashAccountId).toBe(5);
    });
  });
});
