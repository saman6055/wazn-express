import { describe, it, expect, beforeAll } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";
import { hasDb } from "./testEnv";

// Create test context
const createTestContext = (role: "admin" | "employee" | "accountant" | "customer" = "admin") => ({
  user: {
    id: 1,
    role,
    openId: "test-open-id",
    name: "Test User",
    email: "test@example.com",
    avatarUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    customerCode: null,
    mobileNumber: null,
    passwordHash: null,
    fullName: null,
    fullNameArabic: null,
    fullNameKurdish: null,
    address: null,
    addressArabic: null,
    addressKurdish: null,
    city: null,
    preferredLanguage: "en",
    notificationPreferences: null,
    isActive: true,
    lastLoginAt: null,
    sequenceNumber: null,
    isUserCustomer: false,
  },
});

describe.skipIf(!hasDb())("Unclaimed Packages System", () => {
  let testWarehouseId: number;
  let testCustomerId: number;
  let unclaimedPackageId: number;

  beforeAll(async () => {
    // Get or create test warehouse
    const warehouses = await db.getAllWarehouses();
    if (warehouses.length > 0) {
      testWarehouseId = warehouses[0].id;
    } else {
      const warehouse = await db.createWarehouse({
        name: "Test Warehouse",
        countryId: 1,
        warehouseType: "air",
        isActive: true,
      });
      testWarehouseId = warehouse.id;
    }

    // Get or create test customer
    const customers = await db.getAllCustomers();
    if (customers.length > 0) {
      testCustomerId = customers[0].id;
    }
  });

  it("should register an unclaimed package without customer", async () => {
    const caller = appRouter.createCaller(createTestContext("employee"));
    
    const trackingNumber = `UNC-TEST-${Date.now()}`;
    const pkg = await caller.packages.register({
      isUnclaimed: true,
      originWarehouseId: testWarehouseId,
      trackingNumber,
      shippingType: "air_regular",
      weightKg: "2.5",
    });

    expect(pkg).toBeDefined();
    expect(pkg.isUnclaimed).toBe(true);
    expect(pkg.customerId).toBeNull();
    expect(pkg.packageCode).toMatch(/^UNC-/);
    
    unclaimedPackageId = pkg.id;
  });

  it("should list unclaimed packages", async () => {
    const caller = appRouter.createCaller(createTestContext("employee"));
    
    const unclaimed = await caller.packages.getUnclaimed();
    
    expect(Array.isArray(unclaimed)).toBe(true);
    expect(unclaimed.length).toBeGreaterThan(0);
    expect(unclaimed.some(p => p.id === unclaimedPackageId)).toBe(true);
  });

  it("should get unclaimed package count", async () => {
    const caller = appRouter.createCaller(createTestContext("employee"));
    
    const count = await caller.packages.getUnclaimedCount();
    
    expect(typeof count).toBe("number");
    expect(count).toBeGreaterThan(0);
  });

  it("should claim a package and assign customer", async () => {
    if (!testCustomerId) {
      console.log("Skipping claim test - no test customer available");
      return;
    }

    const caller = appRouter.createCaller(createTestContext("employee"));
    
    const claimed = await caller.packages.claimPackage({
      packageId: unclaimedPackageId,
      customerId: testCustomerId,
    });

    expect(claimed).toBeDefined();
    expect(claimed?.isUnclaimed).toBe(false);
    expect(claimed?.customerId).toBe(testCustomerId);
    expect(claimed?.claimedAt).toBeDefined();
  });

  it("should not allow claiming already claimed package", async () => {
    if (!testCustomerId) {
      console.log("Skipping test - no test customer available");
      return;
    }

    const caller = appRouter.createCaller(createTestContext("employee"));
    
    await expect(
      caller.packages.claimPackage({
        packageId: unclaimedPackageId,
        customerId: testCustomerId,
      })
    ).rejects.toThrow("Package is already claimed");
  });

  it("should register package with customer (not unclaimed)", async () => {
    if (!testCustomerId) {
      console.log("Skipping test - no test customer available");
      return;
    }

    const caller = appRouter.createCaller(createTestContext("employee"));
    
    const trackingNumber = `REG-TEST-${Date.now()}`;
    const pkg = await caller.packages.register({
      customerId: testCustomerId,
      isUnclaimed: false,
      originWarehouseId: testWarehouseId,
      trackingNumber,
      shippingType: "air_regular",
      weightKg: "1.5",
    });

    expect(pkg).toBeDefined();
    expect(pkg.isUnclaimed).toBe(false);
    expect(pkg.customerId).toBe(testCustomerId);
    expect(pkg.packageCode).not.toMatch(/^UNC-/);
  });

  it("should generate unique UNC codes for unclaimed packages", async () => {
    const caller = appRouter.createCaller(createTestContext("employee"));
    
    const pkg1 = await caller.packages.register({
      isUnclaimed: true,
      originWarehouseId: testWarehouseId,
      trackingNumber: `UNC-UNIQUE-1-${Date.now()}`,
      shippingType: "sea",
      weightKg: "10",
    });

    const pkg2 = await caller.packages.register({
      isUnclaimed: true,
      originWarehouseId: testWarehouseId,
      trackingNumber: `UNC-UNIQUE-2-${Date.now()}`,
      shippingType: "sea",
      weightKg: "15",
    });

    expect(pkg1.packageCode).not.toBe(pkg2.packageCode);
    expect(pkg1.packageCode).toMatch(/^UNC-\d{6}$/);
    expect(pkg2.packageCode).toMatch(/^UNC-\d{6}$/);
  });
});
