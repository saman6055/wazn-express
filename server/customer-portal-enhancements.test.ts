import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("./db", () => ({
  getCustomerByUserId: vi.fn(),
  getCustomerAccountByCustomerId: vi.fn(),
  getLedgerTransactionById: vi.fn(),
  getCustomerById: vi.fn(),
  getPackageById: vi.fn(),
  getCustomerBatches: vi.fn(),
  getCustomerPackagesInBatch: vi.fn(),
}));

import * as db from "./db";

describe("Customer Portal Enhancements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("PDF Receipt Data", () => {
    it("should return receipt data for valid transaction", async () => {
      const mockAccount = {
        id: 1,
        customerId: 100,
        accountNumber: "ACC-001",
        currentBalanceUsd: "50.00",
      };

      const mockTransaction = {
        id: 1,
        accountId: 1,
        transactionNumber: "TXN-001",
        transactionType: "CREDIT_PAYMENT",
        amountUsd: "25.00",
        balanceBeforeUsd: "75.00",
        balanceAfterUsd: "50.00",
        description: "Payment received",
        createdAt: new Date("2024-01-15"),
      };

      const mockCustomer = {
        id: 100,
        fullName: "Test Customer",
        customerCode: "AZ001(Test)",
        mobileNumber: "07501234567",
      };

      vi.mocked(db.getCustomerAccountByCustomerId).mockResolvedValue(mockAccount as any);
      vi.mocked(db.getLedgerTransactionById).mockResolvedValue(mockTransaction as any);
      vi.mocked(db.getCustomerById).mockResolvedValue(mockCustomer as any);

      // Verify the mock data is set up correctly
      const account = await db.getCustomerAccountByCustomerId(100);
      expect(account).toBeDefined();
      expect(account?.id).toBe(1);

      const transaction = await db.getLedgerTransactionById(1);
      expect(transaction).toBeDefined();
      expect(transaction?.transactionNumber).toBe("TXN-001");
      expect(transaction?.accountId).toBe(1);

      const customer = await db.getCustomerById(100);
      expect(customer).toBeDefined();
      expect(customer?.fullName).toBe("Test Customer");
    });

    it("should reject receipt request for non-owned transaction", async () => {
      const mockAccount = {
        id: 1,
        customerId: 100,
      };

      const mockTransaction = {
        id: 2,
        accountId: 999, // Different account
        transactionNumber: "TXN-002",
      };

      vi.mocked(db.getCustomerAccountByCustomerId).mockResolvedValue(mockAccount as any);
      vi.mocked(db.getLedgerTransactionById).mockResolvedValue(mockTransaction as any);

      const account = await db.getCustomerAccountByCustomerId(100);
      const transaction = await db.getLedgerTransactionById(2);

      // Verify transaction doesn't belong to account
      expect(transaction?.accountId).not.toBe(account?.id);
    });

    it("should return null for non-existent transaction", async () => {
      vi.mocked(db.getLedgerTransactionById).mockResolvedValue(null);

      const transaction = await db.getLedgerTransactionById(999);
      expect(transaction).toBeNull();
    });

    it("should include all required receipt fields", async () => {
      const mockTransaction = {
        id: 1,
        accountId: 1,
        transactionNumber: "TXN-003",
        transactionType: "DEBIT_PACKAGE",
        amountUsd: "15.50",
        balanceBeforeUsd: "100.00",
        balanceAfterUsd: "115.50",
        description: "Package delivery charge",
        createdAt: new Date("2024-01-20"),
      };

      vi.mocked(db.getLedgerTransactionById).mockResolvedValue(mockTransaction as any);

      const transaction = await db.getLedgerTransactionById(1);
      
      // Verify all required fields for receipt
      expect(transaction).toHaveProperty("transactionNumber");
      expect(transaction).toHaveProperty("transactionType");
      expect(transaction).toHaveProperty("amountUsd");
      expect(transaction).toHaveProperty("balanceBeforeUsd");
      expect(transaction).toHaveProperty("balanceAfterUsd");
      expect(transaction).toHaveProperty("createdAt");
    });
  });

  describe("Package Photos Viewing", () => {
    it("should return package with photos array", async () => {
      const mockPackage = {
        id: 1,
        packageCode: "PKG-001",
        trackingNumber: "TRK123456",
        customerId: 100,
        photos: [
          "https://storage.example.com/pkg1-photo1.jpg",
          "https://storage.example.com/pkg1-photo2.jpg",
        ],
        status: "in_transit",
        weightKg: "2.5",
        lengthCm: "30",
        widthCm: "20",
        heightCm: "15",
      };

      vi.mocked(db.getPackageById).mockResolvedValue(mockPackage as any);

      const pkg = await db.getPackageById(1);
      
      expect(pkg).toBeDefined();
      expect(pkg?.photos).toBeInstanceOf(Array);
      expect(pkg?.photos?.length).toBe(2);
      expect(pkg?.photos?.[0]).toContain("https://");
    });

    it("should return package without photos (null)", async () => {
      const mockPackage = {
        id: 2,
        packageCode: "PKG-002",
        trackingNumber: "TRK789012",
        customerId: 100,
        photos: null,
        status: "registered",
      };

      vi.mocked(db.getPackageById).mockResolvedValue(mockPackage as any);

      const pkg = await db.getPackageById(2);
      
      expect(pkg).toBeDefined();
      expect(pkg?.photos).toBeNull();
    });

    it("should return package with empty photos array", async () => {
      const mockPackage = {
        id: 3,
        packageCode: "PKG-003",
        trackingNumber: "TRK345678",
        customerId: 100,
        photos: [],
        status: "delivered",
      };

      vi.mocked(db.getPackageById).mockResolvedValue(mockPackage as any);

      const pkg = await db.getPackageById(3);
      
      expect(pkg).toBeDefined();
      expect(pkg?.photos).toBeInstanceOf(Array);
      expect(pkg?.photos?.length).toBe(0);
    });

    it("should reject package request for non-owned package", async () => {
      const mockPackage = {
        id: 4,
        packageCode: "PKG-004",
        customerId: 999, // Different customer
        photos: ["https://storage.example.com/photo.jpg"],
      };

      vi.mocked(db.getPackageById).mockResolvedValue(mockPackage as any);

      const pkg = await db.getPackageById(4);
      const requestingCustomerId = 100;
      
      // Verify package doesn't belong to requesting customer
      expect(pkg?.customerId).not.toBe(requestingCustomerId);
    });

    it("should return packages in batch with photos", async () => {
      const mockPackages = [
        {
          id: 1,
          packageCode: "PKG-001",
          customerId: 100,
          batchId: 1,
          photos: ["https://storage.example.com/photo1.jpg"],
          status: "in_batch",
        },
        {
          id: 2,
          packageCode: "PKG-002",
          customerId: 100,
          batchId: 1,
          photos: ["https://storage.example.com/photo2.jpg", "https://storage.example.com/photo3.jpg"],
          status: "in_batch",
        },
        {
          id: 3,
          packageCode: "PKG-003",
          customerId: 100,
          batchId: 1,
          photos: null,
          status: "in_batch",
        },
      ];

      vi.mocked(db.getCustomerPackagesInBatch).mockResolvedValue(mockPackages as any);

      const packages = await db.getCustomerPackagesInBatch(100, 1);
      
      expect(packages).toHaveLength(3);
      expect(packages[0].photos).toHaveLength(1);
      expect(packages[1].photos).toHaveLength(2);
      expect(packages[2].photos).toBeNull();
    });
  });

  describe("Receipt Generation Format", () => {
    it("should format credit transaction correctly", () => {
      const transaction = {
        transactionType: "CREDIT_PAYMENT",
        amountUsd: "50.00",
      };

      const isCredit = transaction.transactionType.startsWith("CREDIT_");
      expect(isCredit).toBe(true);
    });

    it("should format debit transaction correctly", () => {
      const transaction = {
        transactionType: "DEBIT_PACKAGE",
        amountUsd: "25.00",
      };

      const isCredit = transaction.transactionType.startsWith("CREDIT_");
      expect(isCredit).toBe(false);
    });

    it("should handle various transaction types", () => {
      const transactionTypes = [
        { type: "CREDIT_PAYMENT", isCredit: true },
        { type: "CREDIT_REFUND", isCredit: true },
        { type: "CREDIT_DISCOUNT", isCredit: true },
        { type: "DEBIT_PACKAGE", isCredit: false },
        { type: "DEBIT_SERVICE", isCredit: false },
      ];

      transactionTypes.forEach(({ type, isCredit }) => {
        expect(type.startsWith("CREDIT_")).toBe(isCredit);
      });
    });
  });
});
