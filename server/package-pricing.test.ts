import { describe, expect, it, beforeAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createStaffContext(role: "admin" | "employee" | "accountant" = "admin"): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-staff-user",
    email: "staff@example.com",
    name: "Test Staff",
    loginMethod: "manus",
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
      cookie: () => {},
    } as unknown as TrpcContext["res"],
  };
}

describe("Package Registration with Batch", () => {
  let testCustomerId: number;
  let testWarehouseId: number;
  let testBatchId: number;

  beforeAll(async () => {
    // Get existing customer from legacy customers table (what getCustomerById queries)
    const allCustomers = await db.getAllCustomers();
    // Find a legacy customer (not user customer) or use any customer
    const legacyCustomer = allCustomers.find(c => !c.isUserCustomer) || allCustomers[0];
    if (!legacyCustomer) {
      // Create a test customer if none exists
      const newCustomer = await db.createCustomer({
        customerCode: "TEST-PKG-" + Date.now(),
        name: "Test Customer for Pricing",
        phone: "1234567890",
        isUserCustomer: false,
      });
      testCustomerId = newCustomer.id;
    } else {
      testCustomerId = legacyCustomer.id;
    }

    // Get existing warehouse
    const warehouses = await db.getAllWarehouses();
    if (warehouses.length === 0) {
      throw new Error("Test requires at least one warehouse in the database");
    }
    testWarehouseId = warehouses[0].id;

    // Get existing batch or create one
    const batches = await db.getAllBatches();
    if (batches.length > 0) {
      testBatchId = batches[0].id;
    } else {
      // Get destination country for batch
      const countries = await db.getAllCountries();
      const destCountry = countries.find(c => c.isDestination);
      
      const batch = await db.createBatch({
        batchCode: `TEST-${Date.now()}-Air`,
        originWarehouseId: testWarehouseId,
        destinationCountryId: destCountry?.id || 1,
        shippingType: "air_regular",
        status: "preparing",
        createdById: 1,
      });
      testBatchId = batch.id;
    }
  });

  it("should register a package with batch assignment", async () => {
    const ctx = createStaffContext("admin");
    const caller = appRouter.createCaller(ctx);

    const result = await caller.packages.register({
      customerId: testCustomerId,
      originWarehouseId: testWarehouseId,
      shippingType: "air_regular",
      weightKg: "2.5",
      description: "Test package with batch",
      batchId: testBatchId,
    });

    expect(result).toBeDefined();
    expect(result.packageCode).toBeDefined();
    expect(result.batchId).toBe(testBatchId);
    expect(result.customerId).toBe(testCustomerId);
  });

  it("should register a package without batch assignment", async () => {
    const ctx = createStaffContext("admin");
    const caller = appRouter.createCaller(ctx);

    const result = await caller.packages.register({
      customerId: testCustomerId,
      originWarehouseId: testWarehouseId,
      shippingType: "air_regular",
      weightKg: "1.5",
      description: "Test package without batch",
    });

    expect(result).toBeDefined();
    expect(result.packageCode).toBeDefined();
    expect(result.batchId).toBeNull();
  });

  it("should list packages", async () => {
    const ctx = createStaffContext("admin");
    const caller = appRouter.createCaller(ctx);

    const packages = await caller.packages.list({});

    expect(packages).toBeDefined();
    expect(Array.isArray(packages)).toBe(true);
    expect(packages.length).toBeGreaterThan(0);
  });

  it("should list batches", async () => {
    const ctx = createStaffContext("admin");
    const caller = appRouter.createCaller(ctx);

    const batches = await caller.batches.list();

    expect(batches).toBeDefined();
    expect(Array.isArray(batches)).toBe(true);
    expect(batches.length).toBeGreaterThan(0);
  });
});

describe("Automatic Pricing on Delivery", () => {
  let testPackageId: number;
  let testCustomerId: number;
  let testWarehouseId: number;

  beforeAll(async () => {
    // Get existing legacy customer or use any customer
    const allCustomers = await db.getAllCustomers();
    const legacyCustomer = allCustomers.find(c => !c.isUserCustomer) || allCustomers[0];
    if (!legacyCustomer) {
      // Create a test customer if none exists
      const newCustomer = await db.createCustomer({
        customerCode: "TEST-DELIVERY-" + Date.now(),
        name: "Test Customer for Delivery",
        phone: "1234567890",
        isUserCustomer: false,
      });
      testCustomerId = newCustomer.id;
    } else {
      testCustomerId = legacyCustomer.id;
    }

    // Get existing warehouse
    const warehouses = await db.getAllWarehouses();
    if (warehouses.length === 0) {
      throw new Error("Test requires at least one warehouse");
    }
    testWarehouseId = warehouses[0].id;

    // Create a new package for delivery test
    const pkg = await db.createPackage({
      packageCode: `PRICE-TEST-${Date.now()}`,
      customerId: testCustomerId,
      originWarehouseId: testWarehouseId,
      shippingType: "air_regular",
      weightKg: "3.0",
      status: "registered",
      registeredById: 1,
    });
    testPackageId = pkg.id;
  });

  it("should have isCharged field defaulting to false", async () => {
    const pkg = await db.getPackageById(testPackageId);
    
    expect(pkg).toBeDefined();
    expect(pkg?.isCharged).toBe(false);
  });

  it("should update package status to delivered", async () => {
    const ctx = createStaffContext("admin");
    const caller = appRouter.createCaller(ctx);

    // Update package status to delivered
    const result = await caller.packages.updateStatus({
      id: testPackageId,
      status: "delivered",
      recipientName: "Test Recipient",
    });

    expect(result.success).toBe(true);

    // Check package status is updated
    const updatedPkg = await db.getPackageById(testPackageId);
    expect(updatedPkg?.status).toBe("delivered");
    expect(updatedPkg?.deliveredAt).toBeDefined();
  });

  it("should mark package as charged after delivery if pricing rule exists", async () => {
    const pkg = await db.getPackageById(testPackageId);
    
    // If there's a pricing rule and the package was charged
    if (pkg?.calculatedCostUsd) {
      expect(pkg.isCharged).toBe(true);
    }
  });

  it("should not double-charge on subsequent status updates", async () => {
    const ctx = createStaffContext("admin");
    const caller = appRouter.createCaller(ctx);

    // Get balance before second update
    const balanceBefore = await db.getCustomerBalance(testCustomerId);

    // Try to update status again
    await caller.packages.updateStatus({
      id: testPackageId,
      status: "delivered",
      recipientName: "Test Recipient Updated",
    });

    // Balance should remain the same (no double charge)
    const balanceAfter = await db.getCustomerBalance(testCustomerId);
    expect(balanceAfter).toBe(balanceBefore);
  });
});
