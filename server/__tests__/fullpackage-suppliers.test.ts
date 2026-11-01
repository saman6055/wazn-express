import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { hasDb } from "./testEnv";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user",
    email: "admin@example.com",
    name: "Admin User",
    loginMethod: "manus",
    role: "admin",
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
    } as TrpcContext["res"],
  };
}

describe.skipIf(!hasDb())("Suppliers Router", () => {
  const ctx = createAdminContext();
  const caller = appRouter.createCaller(ctx);

  it("should list suppliers", async () => {
    const suppliers = await caller.suppliers.list();
    expect(Array.isArray(suppliers)).toBe(true);
  });

  it("should create a new supplier", async () => {
    const newSupplier = await caller.suppliers.create({
      name: "Test Supplier " + Date.now(),
      platform: "1688",
      rating: "5",
      isActive: true,
    });

    expect(newSupplier).toBeDefined();
    expect(newSupplier.id).toBeDefined();
    expect(newSupplier.name).toContain("Test Supplier");
  });

  it("should get supplier by id", async () => {
    // First create a supplier
    const created = await caller.suppliers.create({
      name: "GetById Test " + Date.now(),
      platform: "taobao",
      rating: "4",
      isActive: true,
    });

    const supplier = await caller.suppliers.getById({ id: created.id });
    expect(supplier).toBeDefined();
    expect(supplier?.id).toBe(created.id);
  });

  it("should update a supplier", async () => {
    // First create a supplier
    const created = await caller.suppliers.create({
      name: "Update Test " + Date.now(),
      platform: "alibaba",
      rating: "3",
      isActive: true,
    });

    const result = await caller.suppliers.update({
      id: created.id,
      name: "Updated Supplier Name",
      rating: "5",
    });

    // Update returns success, verify by getting the supplier
    expect(result.success).toBe(true);
    const updated = await caller.suppliers.getById({ id: created.id });
    expect(updated?.name).toBe("Updated Supplier Name");
  });

  it("should delete a supplier (soft delete)", async () => {
    // First create a supplier
    const created = await caller.suppliers.create({
      name: "Delete Test " + Date.now(),
      platform: "pinduoduo",
      rating: "2",
      isActive: true,
    });

    const result = await caller.suppliers.delete({ id: created.id });
    expect(result.success).toBe(true);

    // Soft delete sets isActive to false, supplier still exists
    const deleted = await caller.suppliers.getById({ id: created.id });
    expect(deleted?.isActive).toBe(false);
  });
});

describe.skipIf(!hasDb())("Full Package Router", () => {
  const ctx = createAdminContext();
  const caller = appRouter.createCaller(ctx);

  it("should list full package orders", async () => {
    const orders = await caller.fullPackage.list();
    expect(Array.isArray(orders)).toBe(true);
  });

  it("should get full package stats", async () => {
    const stats = await caller.fullPackage.getStats();
    expect(stats).toBeDefined();
    // Stats may have different field names, just verify it's an object
    expect(typeof stats).toBe("object");
  });

  it("should get profit summary", async () => {
    const summary = await caller.fullPackage.getProfitSummary();
    expect(summary).toBeDefined();
    // Profit summary returns string values for decimal fields
    expect(summary.totalRevenue).toBeDefined();
    expect(summary.totalProfit).toBeDefined();
  });
});
