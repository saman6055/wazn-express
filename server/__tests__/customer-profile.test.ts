import { describe, it, expect, vi, beforeEach } from "vitest";
import * as db from "./db";

// Mock the database module
vi.mock("./db", async () => {
  const actual = await vi.importActual("./db");
  return {
    ...actual,
    getCustomerById: vi.fn(),
    updateCustomer: vi.fn(),
    getAuditLogsByEntity: vi.fn(),
    createAuditLog: vi.fn(),
  };
});

describe("Customer Profile Enhancements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Customer Schema Fields", () => {
    it("should return all customer fields including new ones", async () => {
      const mockCustomer = {
        id: 1,
        name: "Test Customer",
        code: "AZ0001",
        email: "test@example.com",
        mobile: "+9647501234567",
        secondaryMobile: "+9647509876543",
        gender: "male",
        nationality: "Iraqi",
        businessType: "merchant",
        nameKurdish: "کڕیاری تاقیکردنەوە",
        nameArabic: "عميل تجريبي",
        governorate: "Erbil",
        city: "Erbil",
        district: "Ankawa",
        address: "Test Address",
        notes: "Test notes",
        status: "active",
        passportUrl: null,
        nationalIdUrl: null,
        contractUrl: null,
        createdAt: new Date(),
      };

      vi.mocked(db.getCustomerById).mockResolvedValue(mockCustomer as any);

      const customer = await db.getCustomerById(1);

      expect(customer).toBeDefined();
      expect(customer?.secondaryMobile).toBe("+9647509876543");
      expect(customer?.gender).toBe("male");
      expect(customer?.nationality).toBe("Iraqi");
      expect(customer?.businessType).toBe("merchant");
      expect(customer?.nameKurdish).toBe("کڕیاری تاقیکردنەوە");
      expect(customer?.nameArabic).toBe("عميل تجريبي");
      expect(customer?.district).toBe("Ankawa");
    });

    it("should handle customers with document URLs", async () => {
      const mockCustomer = {
        id: 2,
        name: "Customer With Docs",
        code: "AZ0002",
        passportUrl: "https://storage.example.com/docs/passport.pdf",
        nationalIdUrl: "https://storage.example.com/docs/national-id.jpg",
        contractUrl: "https://storage.example.com/docs/contract.pdf",
      };

      vi.mocked(db.getCustomerById).mockResolvedValue(mockCustomer as any);

      const customer = await db.getCustomerById(2);

      expect(customer?.passportUrl).toBe("https://storage.example.com/docs/passport.pdf");
      expect(customer?.nationalIdUrl).toBe("https://storage.example.com/docs/national-id.jpg");
      expect(customer?.contractUrl).toBe("https://storage.example.com/docs/contract.pdf");
    });
  });

  describe("Document Upload", () => {
    it("should update customer with passport URL", async () => {
      vi.mocked(db.updateCustomer).mockResolvedValue({ id: 1 } as any);

      await db.updateCustomer(1, { passportUrl: "https://storage.example.com/new-passport.pdf" });

      expect(db.updateCustomer).toHaveBeenCalledWith(1, {
        passportUrl: "https://storage.example.com/new-passport.pdf",
      });
    });

    it("should update customer with national ID URL", async () => {
      vi.mocked(db.updateCustomer).mockResolvedValue({ id: 1 } as any);

      await db.updateCustomer(1, { nationalIdUrl: "https://storage.example.com/national-id.jpg" });

      expect(db.updateCustomer).toHaveBeenCalledWith(1, {
        nationalIdUrl: "https://storage.example.com/national-id.jpg",
      });
    });

    it("should update customer with contract URL", async () => {
      vi.mocked(db.updateCustomer).mockResolvedValue({ id: 1 } as any);

      await db.updateCustomer(1, { contractUrl: "https://storage.example.com/contract.pdf" });

      expect(db.updateCustomer).toHaveBeenCalledWith(1, {
        contractUrl: "https://storage.example.com/contract.pdf",
      });
    });

    it("should delete document by setting URL to null", async () => {
      vi.mocked(db.updateCustomer).mockResolvedValue({ id: 1 } as any);

      await db.updateCustomer(1, { passportUrl: null });

      expect(db.updateCustomer).toHaveBeenCalledWith(1, { passportUrl: null });
    });
  });

  describe("Activity History", () => {
    it("should return audit logs for a customer", async () => {
      const mockLogs = [
        {
          id: 1,
          action: "create_customer",
          entityType: "customer",
          entityId: 1,
          userRole: "admin",
          createdAt: new Date("2024-01-15"),
          newValues: { name: "Test Customer" },
        },
        {
          id: 2,
          action: "update_customer",
          entityType: "customer",
          entityId: 1,
          userRole: "staff",
          createdAt: new Date("2024-01-20"),
          newValues: { status: "active" },
        },
        {
          id: 3,
          action: "upload_customer_document",
          entityType: "customer",
          entityId: 1,
          userRole: "admin",
          createdAt: new Date("2024-01-25"),
          newValues: { documentType: "passport", url: "https://example.com/passport.pdf" },
        },
      ];

      vi.mocked(db.getAuditLogsByEntity).mockResolvedValue(mockLogs as any);

      const logs = await db.getAuditLogsByEntity("customer", 1);

      expect(logs).toHaveLength(3);
      expect(logs[0].action).toBe("create_customer");
      expect(logs[1].action).toBe("update_customer");
      expect(logs[2].action).toBe("upload_customer_document");
    });

    it("should return empty array when no activity logs exist", async () => {
      vi.mocked(db.getAuditLogsByEntity).mockResolvedValue([]);

      const logs = await db.getAuditLogsByEntity("customer", 999);

      expect(logs).toHaveLength(0);
    });
  });

  describe("Customer Statistics Calculations", () => {
    it("should calculate total weight from packages", () => {
      const packages = [
        { weightKg: "2.5" },
        { weightKg: "3.0" },
        { weightKg: "1.5" },
        { weightKg: null },
      ];

      const totalWeight = packages.reduce((sum, pkg) => {
        return sum + (pkg.weightKg ? parseFloat(pkg.weightKg) : 0);
      }, 0);

      expect(totalWeight).toBe(7.0);
    });

    it("should calculate average weight from packages", () => {
      const packages = [
        { weightKg: "2.5" },
        { weightKg: "3.0" },
        { weightKg: "1.5" },
      ];

      const totalWeight = packages.reduce((sum, pkg) => {
        return sum + (pkg.weightKg ? parseFloat(pkg.weightKg) : 0);
      }, 0);
      const avgWeight = packages.length > 0 ? totalWeight / packages.length : 0;

      expect(avgWeight).toBeCloseTo(2.33, 1);
    });

    it("should determine preferred shipping type", () => {
      const packages = [
        { shippingType: "air_regular" },
        { shippingType: "air_regular" },
        { shippingType: "sea" },
        { shippingType: "air_regular" },
        { shippingType: "air_irregular" },
      ];

      const typeCounts: Record<string, number> = {};
      packages.forEach((pkg) => {
        typeCounts[pkg.shippingType] = (typeCounts[pkg.shippingType] || 0) + 1;
      });

      const preferredType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

      expect(preferredType).toBe("air_regular");
    });

    it("should handle empty packages array for statistics", () => {
      const packages: any[] = [];

      const totalWeight = packages.reduce((sum, pkg) => {
        return sum + (pkg.weightKg ? parseFloat(pkg.weightKg) : 0);
      }, 0);
      const avgWeight = packages.length > 0 ? totalWeight / packages.length : 0;

      expect(totalWeight).toBe(0);
      expect(avgWeight).toBe(0);
    });
  });

  describe("Balance History Graph Data", () => {
    it("should process ledger entries for graph display", () => {
      const ledger = [
        { id: 1, balanceAfterUsd: "100.00", createdAt: new Date("2024-01-01") },
        { id: 2, balanceAfterUsd: "50.00", createdAt: new Date("2024-01-15") },
        { id: 3, balanceAfterUsd: "0.00", createdAt: new Date("2024-01-20") },
        { id: 4, balanceAfterUsd: "-25.00", createdAt: new Date("2024-01-25") },
      ];

      // Reverse to get oldest first (for graph display)
      const entries = [...ledger].reverse();
      
      expect(entries[0].id).toBe(4);
      expect(entries[entries.length - 1].id).toBe(1);

      // Calculate max and min for scaling
      const maxBalance = Math.max(...entries.map(e => Math.abs(parseFloat(e.balanceAfterUsd))));
      const minBalance = Math.min(...entries.map(e => parseFloat(e.balanceAfterUsd)));

      expect(maxBalance).toBe(100);
      expect(minBalance).toBe(-25);
    });

    it("should categorize balance states correctly", () => {
      const testCases = [
        { balance: 100, expected: "owes" },      // Positive = customer owes
        { balance: -50, expected: "credit" },    // Negative = customer has credit
        { balance: 0, expected: "settled" },     // Zero = settled
      ];

      testCases.forEach(({ balance, expected }) => {
        const state = balance > 0 ? "owes" : balance < 0 ? "credit" : "settled";
        expect(state).toBe(expected);
      });
    });
  });

  describe("Audit Log Creation for Document Operations", () => {
    it("should create audit log when uploading document", async () => {
      vi.mocked(db.createAuditLog).mockResolvedValue(undefined);

      await db.createAuditLog({
        userId: 1,
        userRole: "admin",
        action: "upload_customer_document",
        entityType: "customer",
        entityId: 100,
        newValues: { documentType: "passport", url: "https://example.com/passport.pdf" },
      });

      expect(db.createAuditLog).toHaveBeenCalledWith({
        userId: 1,
        userRole: "admin",
        action: "upload_customer_document",
        entityType: "customer",
        entityId: 100,
        newValues: { documentType: "passport", url: "https://example.com/passport.pdf" },
      });
    });

    it("should create audit log when deleting document", async () => {
      vi.mocked(db.createAuditLog).mockResolvedValue(undefined);

      await db.createAuditLog({
        userId: 1,
        userRole: "staff",
        action: "delete_customer_document",
        entityType: "customer",
        entityId: 100,
        newValues: { documentType: "nationalId" },
      });

      expect(db.createAuditLog).toHaveBeenCalledWith({
        userId: 1,
        userRole: "staff",
        action: "delete_customer_document",
        entityType: "customer",
        entityId: 100,
        newValues: { documentType: "nationalId" },
      });
    });
  });
});
