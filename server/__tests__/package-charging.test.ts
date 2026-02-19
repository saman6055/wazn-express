/**
 * Package charging behavior: regular packages are charged ONLY at batch delivery.
 * Registration, scanning, status update, and claim approval must NOT charge.
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as db from "../db";
import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";

const hasDb = () => !!process.env.DATABASE_URL;

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
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {}, cookie: () => {} } as unknown as TrpcContext["res"],
  };
}

describe.skipIf(!hasDb())("Package Registration - No Charge", () => {
  let customerId: number;
  let warehouseId: number;
  let batchId: number;
  let pkgId: number;

  beforeAll(async () => {
    const customers = await db.getAllCustomers();
    const legacy = customers.find((c) => !c.isUserCustomer) || customers[0];
    if (!legacy) throw new Error("No customers for test");
    customerId = legacy.id;
    const code = legacy.customerCode ?? `C${legacy.id}`;
    await db.getOrCreateCustomerAccount(customerId, code);
    const warehouses = await db.getAllWarehouses();
    if (!warehouses.length) throw new Error("No warehouses");
    warehouseId = warehouses[0].id;
    const batchesResult = await db.getAllBatches();
    const batches = batchesResult.data;
    if (!batches.length) {
      const countries = await db.getAllCountries();
      const dest = countries.find((c) => c.isDestination) || countries[0];
      const batch = await db.createBatch({
        batchCode: `CHG-${Date.now()}`,
        originWarehouseId: warehouseId,
        destinationCountryId: dest?.id ?? 1,
        shippingType: "air_regular",
        status: "preparing",
        createdById: 1,
        pricePerKg: "10",
      });
      batchId = batch.id;
    } else {
      batchId = batches[0].id;
    }
  });

  it("should save calculatedCostUsd but NOT create ledger transaction or invoice", async () => {
    const balanceBefore = await db.getCustomerBalance(customerId);
    const ctx = createStaffContext("admin");
    const caller = appRouter.createCaller(ctx);

    const result = await caller.packages.register({
      customerId,
      originWarehouseId: warehouseId,
      shippingType: "air_regular",
      weightKg: "5",
      description: "Charge test package",
      batchId,
    });

    expect(result).toBeDefined();
    expect(result.id).toBeDefined();
    pkgId = result.id;

    const pkg = await db.getPackageById(pkgId);
    expect(pkg).toBeDefined();
    expect(pkg?.calculatedCostUsd).toBeDefined();
    expect(parseFloat(pkg?.calculatedCostUsd ?? "0")).toBeGreaterThan(0);
    expect(pkg?.isCharged).toBe(false);

    const balanceAfter = await db.getCustomerBalance(customerId);
    expect(balanceAfter).toBe(balanceBefore);

    const account = await db.getCustomerAccountByCustomerId(customerId);
    if (account) {
      const { data: txns } = await db.getAccountLedgerTransactions(account.id, { limit: 20 });
      const forThisPackage = txns.filter((t) => t.referenceId === pkgId && t.referenceType === "package");
      expect(forThisPackage.length).toBe(0);
    }
  });
});

describe.skipIf(!hasDb())("Package Scanning - No Charge", () => {
  let customerId: number;
  let warehouseId: number;
  let pkgId: number;

  beforeAll(async () => {
    const customers = await db.getAllCustomers();
    const legacy = customers.find((c) => !c.isUserCustomer) || customers[0];
    if (!legacy) throw new Error("No customers");
    customerId = legacy.id;
    const code = legacy.customerCode ?? `C${legacy.id}`;
    await db.getOrCreateCustomerAccount(customerId, code);
    const warehouses = await db.getAllWarehouses();
    if (!warehouses.length) throw new Error("No warehouses");
    warehouseId = warehouses[0].id;
    const pkg = await db.createPackage({
      packageCode: `SCAN-NC-${Date.now()}`,
      customerId,
      originWarehouseId: warehouseId,
      shippingType: "air_regular",
      weightKg: "2",
      status: "registered",
      registeredById: 1,
    });
    pkgId = pkg.id;
  });

  it("scanning received_local should NOT charge customer", async () => {
    const pkg = await db.getPackageById(pkgId);
    const trackingNumber = pkg?.trackingNumber || pkg?.packageCode || `SCAN-${pkgId}`;
    if (!pkg?.trackingNumber) await db.updatePackage(pkgId, { trackingNumber });
    const balanceBefore = await db.getCustomerBalance(customerId);
    const ctx = createStaffContext("admin");
    const caller = appRouter.createCaller(ctx);

    await caller.scanning.registerScan({
      trackingNumber: pkg?.trackingNumber || trackingNumber,
      scanType: "received_local",
      packageId: pkgId,
    });

    const balanceAfter = await db.getCustomerBalance(customerId);
    expect(balanceAfter).toBe(balanceBefore);
    const updated = await db.getPackageById(pkgId);
    expect(updated?.isCharged).toBe(false);
  });

  it("scanning delivered should NOT charge customer", async () => {
    const pkg2 = await db.createPackage({
      packageCode: `SCAN-DEL-${Date.now()}`,
      trackingNumber: `TRK-DEL-${Date.now()}`,
      customerId,
      originWarehouseId: warehouseId,
      shippingType: "air_regular",
      weightKg: "2",
      status: "registered",
      registeredById: 1,
    });
    const balanceBefore = await db.getCustomerBalance(customerId);
    const ctx = createStaffContext("admin");
    const caller = appRouter.createCaller(ctx);

    await caller.scanning.registerScan({
      trackingNumber: pkg2.trackingNumber!,
      scanType: "delivered",
      packageId: pkg2.id,
    });

    const balanceAfter = await db.getCustomerBalance(customerId);
    expect(balanceAfter).toBe(balanceBefore);
    const updated = await db.getPackageById(pkg2.id);
    expect(updated?.isCharged).toBe(false);
  });
});

describe.skipIf(!hasDb())("Package Status Update - No Charge", () => {
  let customerId: number;
  let warehouseId: number;
  let pkgId: number;

  beforeAll(async () => {
    const customers = await db.getAllCustomers();
    const legacy = customers.find((c) => !c.isUserCustomer) || customers[0];
    if (!legacy) throw new Error("No customers");
    customerId = legacy.id;
    await db.getOrCreateCustomerAccount(customerId, legacy.customerCode ?? `C${legacy.id}`);
    const warehouses = await db.getAllWarehouses();
    if (!warehouses.length) throw new Error("No warehouses");
    warehouseId = warehouses[0].id;
    const pkg = await db.createPackage({
      packageCode: `STATUS-NC-${Date.now()}`,
      customerId,
      originWarehouseId: warehouseId,
      shippingType: "air_regular",
      weightKg: "3",
      status: "in_transit",
      registeredById: 1,
    });
    pkgId = pkg.id;
  });

  it("changing status to ready_for_delivery (or applyCharge) should NOT charge customer", async () => {
    const balanceBefore = await db.getCustomerBalance(customerId);
    const ctx = createStaffContext("admin");
    const caller = appRouter.createCaller(ctx);

    await caller.scanning.updatePackageInline({
      packageId: pkgId,
      status: "Ready for Delivery",
      applyCharge: true,
    });

    const balanceAfter = await db.getCustomerBalance(customerId);
    expect(balanceAfter).toBe(balanceBefore);

    const pkg = await db.getPackageById(pkgId);
    expect(pkg?.isCharged).toBe(false);

    const account = await db.getCustomerAccountByCustomerId(customerId);
    if (account) {
      const { data: txns } = await db.getAccountLedgerTransactions(account.id, { limit: 20 });
      const forPkg = txns.filter((t) => t.referenceId === pkgId && t.referenceType === "package");
      expect(forPkg.length).toBe(0);
    }
  });
});

describe.skipIf(!hasDb())("Claim Package - No Charge", () => {
  let customerId: number;
  let warehouseId: number;
  let batchId: number;
  let unclaimedPkgId: number;

  beforeAll(async () => {
    const customers = await db.getAllCustomers();
    const legacy = customers.find((c) => !c.isUserCustomer) || customers[0];
    if (!legacy) throw new Error("No customers");
    customerId = legacy.id;
    await db.getOrCreateCustomerAccount(customerId, legacy.customerCode ?? `C${legacy.id}`);
    const warehouses = await db.getAllWarehouses();
    if (!warehouses.length) throw new Error("No warehouses");
    warehouseId = warehouses[0].id;
    const batchesResult = await db.getAllBatches();
    const batches = batchesResult.data;
    if (!batches.length) throw new Error("No batches");
    batchId = batches[0].id;
    const pkg = await db.createPackage({
      packageCode: `UNCLAIM-${Date.now()}`,
      customerId: null,
      originWarehouseId: warehouseId,
      shippingType: "air_regular",
      weightKg: "4",
      status: "in_batch",
      batchId,
      isUnclaimed: true,
      registeredById: 1,
    });
    unclaimedPkgId = pkg.id;
  });

  it("claiming an unclaimed package should save cost but NOT charge", async () => {
    const balanceBefore = await db.getCustomerBalance(customerId);
    const ctx = createStaffContext("admin");
    const caller = appRouter.createCaller(ctx);

    await caller.packages.claimPackage({
      packageId: unclaimedPkgId,
      customerId,
    });

    const pkg = await db.getPackageById(unclaimedPkgId);
    expect(pkg?.calculatedCostUsd).toBeDefined();
    expect(pkg?.isCharged).toBe(false);

    const balanceAfter = await db.getCustomerBalance(customerId);
    expect(balanceAfter).toBe(balanceBefore);
  });
});

describe.skipIf(!hasDb())("Batch Delivery - Correct Charge Point", () => {
  let customerAId: number;
  let customerBId: number;
  let warehouseId: number;
  let batchId: number;
  let pkgA1Id: number;
  let pkgA2Id: number;
  let pkgB1Id: number;

  beforeAll(async () => {
    const customers = await db.getAllCustomers();
    const legacy = customers.filter((c) => !c.isUserCustomer);
    const c1 = legacy[0] || customers[0];
    const c2 = legacy[1] || customers[1] || c1;
    if (!c1) throw new Error("No customers");
    customerAId = c1.id;
    customerBId = c2.id;
    await db.getOrCreateCustomerAccount(customerAId, c1.customerCode ?? `C${c1.id}`);
    await db.getOrCreateCustomerAccount(customerBId, c2.customerCode ?? `C${c2.id}`);
    const warehouses = await db.getAllWarehouses();
    if (!warehouses.length) throw new Error("No warehouses");
    warehouseId = warehouses[0].id;
    const countries = await db.getAllCountries();
    const dest = countries.find((c) => c.isDestination) || countries[0];
    const batch = await db.createBatch({
      batchCode: `BATCH-DEL-${Date.now()}`,
      originWarehouseId: warehouseId,
      destinationCountryId: dest?.id ?? 1,
      shippingType: "air_regular",
      status: "in_transit",
      createdById: 1,
      pricePerKg: "10",
    });
    batchId = batch.id;
    const pkgA1 = await db.createPackage({
      packageCode: `BDA1-${Date.now()}`,
      customerId: customerAId,
      originWarehouseId: warehouseId,
      batchId,
      shippingType: "air_regular",
      weightKg: "2",
      status: "in_transit",
      registeredById: 1,
    });
    const pkgA2 = await db.createPackage({
      packageCode: `BDA2-${Date.now()}`,
      customerId: customerAId,
      originWarehouseId: warehouseId,
      batchId,
      shippingType: "air_regular",
      weightKg: "3",
      status: "in_transit",
      registeredById: 1,
    });
    const pkgB1 = await db.createPackage({
      packageCode: `BDB1-${Date.now()}`,
      customerId: customerBId,
      originWarehouseId: warehouseId,
      batchId,
      shippingType: "air_regular",
      weightKg: "5",
      status: "in_transit",
      registeredById: 1,
    });
    pkgA1Id = pkgA1.id;
    pkgA2Id = pkgA2.id;
    pkgB1Id = pkgB1.id;
  });

  it("delivering a batch should charge ALL packages to their customers", async () => {
    const balanceABefore = await db.getCustomerBalance(customerAId);
    const balanceBBefore = await db.getCustomerBalance(customerBId);

    const ctx = createStaffContext("admin");
    const caller = appRouter.createCaller(ctx);

    await caller.batches.updateStatus({
      id: batchId,
      status: "delivered",
    });

    const balanceAAfter = await db.getCustomerBalance(customerAId);
    const balanceBAfter = await db.getCustomerBalance(customerBId);

    expect(balanceAAfter).toBe(balanceABefore + 20 + 30);
    expect(balanceBAfter).toBe(balanceBBefore + 50);

    const pkgA1 = await db.getPackageById(pkgA1Id);
    const pkgA2 = await db.getPackageById(pkgA2Id);
    const pkgB1 = await db.getPackageById(pkgB1Id);
    expect(pkgA1?.isCharged).toBe(true);
    expect(pkgA2?.isCharged).toBe(true);
    expect(pkgB1?.isCharged).toBe(true);

    const invA = await db.getInvoicesByCustomer(customerAId, { limit: 10 });
    const invB = await db.getInvoicesByCustomer(customerBId, { limit: 10 });
    const forBatchA = invA.data.filter((i) => i.batchId === batchId);
    const forBatchB = invB.data.filter((i) => i.batchId === batchId);
    expect(forBatchA.length).toBe(1);
    expect(forBatchB.length).toBe(1);

    const accountA = await db.getCustomerAccountByCustomerId(customerAId);
    const accountB = await db.getCustomerAccountByCustomerId(customerBId);
    if (accountA) {
      const { data: txnsA } = await db.getAccountLedgerTransactions(accountA.id, { limit: 20 });
      const pkgTxnsA = txnsA.filter(
        (t) => (t.referenceId === pkgA1Id || t.referenceId === pkgA2Id) && t.referenceType === "package"
      );
      expect(pkgTxnsA.length).toBe(2);
    }
    if (accountB) {
      const { data: txnsB } = await db.getAccountLedgerTransactions(accountB.id, { limit: 20 });
      const pkgTxnsB = txnsB.filter((t) => t.referenceId === pkgB1Id && t.referenceType === "package");
      expect(pkgTxnsB.length).toBe(1);
    }
  });
});

describe.skipIf(!hasDb())("End-to-End Package Lifecycle", () => {
  it("register → scan → status → batch delivery → correct single charge", async () => {
    const customers = await db.getAllCustomers();
    const legacy = customers.find((c) => !c.isUserCustomer) || customers[0];
    if (!legacy) throw new Error("No customers");
    const customerId = legacy.id;
    await db.getOrCreateCustomerAccount(customerId, legacy.customerCode ?? `C${legacy.id}`);
    const warehouses = await db.getAllWarehouses();
    if (!warehouses.length) throw new Error("No warehouses");
    const warehouseId = warehouses[0].id;
    const countries = await db.getAllCountries();
    const dest = countries.find((c) => c.isDestination) || countries[0];
    const batch = await db.createBatch({
      batchCode: `E2E-${Date.now()}`,
      originWarehouseId: warehouseId,
      destinationCountryId: dest?.id ?? 1,
      shippingType: "air_regular",
      status: "preparing",
      createdById: 1,
      pricePerKg: "10",
    });
    const batchId = batch.id;

    const ctx = createStaffContext("admin");
    const caller = appRouter.createCaller(ctx);

    const reg = await caller.packages.register({
      customerId,
      originWarehouseId: warehouseId,
      shippingType: "air_regular",
      weightKg: "2",
      description: "E2E test",
      batchId,
    });
    const pkgId = reg.id;
    const trackingNumber = reg.trackingNumber || reg.packageCode || `E2E-${pkgId}`;
    if (!reg.trackingNumber) await db.updatePackage(pkgId, { trackingNumber });

    expect(await db.getCustomerBalance(customerId)).toBe(0);

    await caller.scanning.registerScan({
      trackingNumber,
      scanType: "received_local",
      packageId: pkgId,
    });
    expect(await db.getCustomerBalance(customerId)).toBe(0);

    await caller.scanning.updatePackageInline({
      packageId: pkgId,
      status: "Ready for Delivery",
    });
    expect(await db.getCustomerBalance(customerId)).toBe(0);

    await caller.batches.updateStatus({
      id: batchId,
      status: "delivered",
    });

    const balanceAfter = await db.getCustomerBalance(customerId);
    expect(balanceAfter).toBe(20);

    const pkg = await db.getPackageById(pkgId);
    expect(pkg?.isCharged).toBe(true);

    const invoices = await db.getInvoicesByCustomer(customerId, { limit: 5 });
    const forThisBatch = invoices.data.filter((i) => i.batchId === batchId);
    expect(forThisBatch.length).toBe(1);

    const account = await db.getCustomerAccountByCustomerId(customerId);
    if (account) {
      const validation = await db.validateAccountBalance(account.id);
      expect(validation.isValid).toBe(true);
      expect(validation.difference).toBe(0);
    }
  });
});
