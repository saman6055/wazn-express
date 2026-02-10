import { describe, it, expect, beforeAll } from "vitest";
import * as db from "./db";

describe("Service Types", () => {
  describe("getAllServiceTypes", () => {
    it("should return all service types", async () => {
      const types = await db.getAllServiceTypes();
      expect(Array.isArray(types)).toBe(true);
      // We seeded 9 default service types
      expect(types.length).toBeGreaterThanOrEqual(9);
    });

    it("should include required fields", async () => {
      const types = await db.getAllServiceTypes();
      if (types.length > 0) {
        const type = types[0];
        expect(type).toHaveProperty("id");
        expect(type).toHaveProperty("nameEn");
        expect(type).toHaveProperty("isActive");
      }
    });
  });

  describe("getActiveServiceTypes", () => {
    it("should return only active service types", async () => {
      const types = await db.getActiveServiceTypes();
      expect(Array.isArray(types)).toBe(true);
      types.forEach((type) => {
        expect(type.isActive).toBe(true);
      });
    });
  });

  describe("getServiceTypeById", () => {
    it("should return a service type by id", async () => {
      const types = await db.getAllServiceTypes();
      if (types.length > 0) {
        const type = await db.getServiceTypeById(types[0].id);
        expect(type).not.toBeNull();
        expect(type?.id).toBe(types[0].id);
      }
    });

    it("should return null for non-existent id", async () => {
      const type = await db.getServiceTypeById(999999);
      expect(type).toBeNull();
    });
  });

  describe("createServiceType", () => {
    it("should create a new service type", async () => {
      const newType = await db.createServiceType({
        nameEn: "Test Service Type",
        nameKu: "تاقیکردنەوەی جۆر",
        nameAr: "نوع اختبار",
        icon: "🧪",
        color: "#9333ea",
        sortOrder: 100,
        isActive: true,
      });
      
      expect(newType).not.toBeNull();
      expect(newType.nameEn).toBe("Test Service Type");
      expect(newType.icon).toBe("🧪");
      expect(newType.color).toBe("#9333ea");
      
      // Clean up
      await db.deleteServiceType(newType.id);
    });
  });

  describe("updateServiceType", () => {
    it("should update an existing service type", async () => {
      // Create a test type first
      const newType = await db.createServiceType({
        nameEn: "Update Test Type",
        sortOrder: 101,
        isActive: true,
      });
      
      // Update it
      const updated = await db.updateServiceType(newType.id, {
        nameEn: "Updated Type Name",
        icon: "✅",
      });
      
      expect(updated).not.toBeNull();
      expect(updated?.nameEn).toBe("Updated Type Name");
      expect(updated?.icon).toBe("✅");
      
      // Clean up
      await db.deleteServiceType(newType.id);
    });
  });

  describe("deleteServiceType", () => {
    it("should delete a service type", async () => {
      // Create a test type first
      const newType = await db.createServiceType({
        nameEn: "Delete Test Type",
        sortOrder: 102,
        isActive: true,
      });
      
      // Delete it
      await db.deleteServiceType(newType.id);
      
      // Verify it's deleted
      const deleted = await db.getServiceTypeById(newType.id);
      expect(deleted).toBeNull();
    });
  });
});

describe("Extra Services", () => {
  let testServiceTypeId: number;
  let testCustomerId: number;
  
  beforeAll(async () => {
    // Get a service type for testing
    const types = await db.getAllServiceTypes();
    if (types.length > 0) {
      testServiceTypeId = types[0].id;
    }
    
    // Get a customer for testing
    const customers = await db.getAllCustomers();
    if (customers.length > 0) {
      testCustomerId = customers[0].id;
    }
  });

  describe("createExtraService", () => {
    it("should create an extra service with profit calculation", async () => {
      if (!testServiceTypeId || !testCustomerId) {
        console.log("Skipping test: no service type or customer available");
        return;
      }
      
      const service = await db.createExtraService({
        serviceTypeId: testServiceTypeId,
        customerId: testCustomerId,
        description: "Test service for vitest",
        costAmount: "10.00",
        priceAmount: "15.00",
        currency: "USD",
        createdById: 1,
      });
      
      expect(service).not.toBeNull();
      expect(service.serviceNumber).toMatch(/^SRV-/);
      expect(Number(service.costAmount)).toBe(10);
      expect(Number(service.priceAmount)).toBe(15);
      expect(Number(service.profitAmount)).toBe(5); // 15 - 10 = 5
      
      // Clean up
      await db.deleteExtraService(service.id);
    });
  });

  describe("getExtraServicesByCustomer", () => {
    it("should return services for a specific customer", async () => {
      if (!testCustomerId) {
        console.log("Skipping test: no customer available");
        return;
      }
      
      const services = await db.getExtraServicesByCustomer(testCustomerId);
      expect(Array.isArray(services)).toBe(true);
    });
  });

  describe("getExtraServicesWithDetails", () => {
    it("should return services with service type details", async () => {
      const services = await db.getExtraServicesWithDetails();
      expect(Array.isArray(services)).toBe(true);
    });
  });

  describe("getAllExtraServices", () => {
    it("should return paginated services with total count", async () => {
      const result = await db.getAllExtraServices({ limit: 10, offset: 0 });
      expect(result).toHaveProperty("services");
      expect(result).toHaveProperty("total");
      expect(Array.isArray(result.services)).toBe(true);
    });

    it("should filter by service type", async () => {
      if (!testServiceTypeId) {
        console.log("Skipping test: no service type available");
        return;
      }
      
      const result = await db.getAllExtraServices({ serviceTypeId: testServiceTypeId });
      expect(Array.isArray(result.services)).toBe(true);
      result.services.forEach((service) => {
        expect(service.serviceTypeId).toBe(testServiceTypeId);
      });
    });
  });

  // Note: getServiceProfitSummary is calculated on the frontend from getAllExtraServices data
});
