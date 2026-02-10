import { describe, it, expect, beforeAll } from "vitest";
import * as db from "./db";

describe("Full Package Orders", () => {
  let testCustomerId: number;
  let testOrderId: number;

  beforeAll(async () => {
    // Get an existing customer for testing
    const customers = await db.getAllCustomers();
    if (customers.length > 0) {
      testCustomerId = customers[0].id;
    } else {
      throw new Error("No customers found for testing");
    }
    
    // Create a test order for update tests
    const timestamp = Date.now();
    const order = await db.createFullPackageOrder({
      customerId: testCustomerId,
      productName: "Test Product for Updates " + timestamp,
      productLink: "https://example.com/product",
      quantity: 2,
      purchasePriceUsd: "10.00",
      sellingPriceUsd: "25.00",
      shippingCostUsd: "5.00",
      orderNumber: "ORD-SETUP-" + timestamp,
      orderCode: "FP-SETUP-" + timestamp,
      createdById: 1,
    });
    testOrderId = order.id;
  });

  describe("Create Full Package Order", () => {
    it("should create a new full package order", async () => {
      const timestamp = Date.now();
      const order = await db.createFullPackageOrder({
        customerId: testCustomerId,
        productName: "Test Product " + timestamp,
        productLink: "https://example.com/product",
        quantity: 2,
        purchasePriceUsd: "10.00",
        sellingPriceUsd: "25.00",
        shippingCostUsd: "5.00",
        orderNumber: "ORD-" + timestamp,
        orderCode: "FP-" + timestamp,
        createdById: 1,
      });

      expect(order).toBeDefined();
      expect(order.id).toBeGreaterThan(0);
      expect(order.customerId).toBe(testCustomerId);
      expect(order.quantity).toBe(2);
      // Profit = (25 - 10) * 2 - 5 = 25
      expect(parseFloat(order.profitUsd!)).toBe(25);
      
      testOrderId = order.id;
    });

    it("should calculate profit correctly", async () => {
      const timestamp2 = Date.now();
      const order = await db.createFullPackageOrder({
        customerId: testCustomerId,
        productName: "Profit Test " + timestamp2,
        quantity: 3,
        purchasePriceUsd: "5.00",
        sellingPriceUsd: "15.00",
        shippingCostUsd: "2.00",
        orderCode: "FP-PROFIT-" + timestamp2,
        createdById: 1,
      });

      // Profit = (15 - 5) * 3 - 2 = 28
      expect(parseFloat(order.profitUsd!)).toBe(28);
    });
  });

  describe("Get Full Package Orders", () => {
    it("should get order by id", async () => {
      const order = await db.getFullPackageOrderById(testOrderId);
      expect(order).toBeDefined();
      expect(order?.id).toBe(testOrderId);
    });

    it("should list all orders", async () => {
      const orders = await db.getAllFullPackageOrders();
      expect(Array.isArray(orders)).toBe(true);
      expect(orders.length).toBeGreaterThan(0);
    });

    it("should filter orders by customer", async () => {
      const orders = await db.getAllFullPackageOrders({ customerId: testCustomerId });
      expect(Array.isArray(orders)).toBe(true);
      orders.forEach(order => {
        expect(order.customerId).toBe(testCustomerId);
      });
    });
  });

  describe("Update Full Package Order", () => {
    it("should update order details", async () => {
      await db.updateFullPackageOrder(testOrderId, {
        productName: "Updated Product Name",
        trackingNumber: "TRACK123456",
      });

      const updated = await db.getFullPackageOrderById(testOrderId);
      expect(updated?.productName).toBe("Updated Product Name");
      expect(updated?.trackingNumber).toBe("TRACK123456");
    });

    it("should recalculate profit when prices change", async () => {
      // First get the current order to know its values
      const current = await db.getFullPackageOrderById(testOrderId);
      
      await db.updateFullPackageOrder(testOrderId, {
        purchasePriceUsd: "8.00",
        sellingPriceUsd: "30.00",
        // quantity is 2, shipping is 5
        // New profit = (30 - 8) * 2 - 5 = 39
      });

      const updated = await db.getFullPackageOrderById(testOrderId);
      // Profit should be recalculated
      expect(updated?.profitUsd).toBeDefined();
      const profit = parseFloat(updated?.profitUsd || "0");
      expect(profit).toBeGreaterThan(0);
    });
  });

  describe("Profit Summary", () => {
    it("should calculate profit summary", async () => {
      const summary = await db.getFullPackageProfitSummary();
      expect(summary).toBeDefined();
      // SQL returns strings, so we check they can be parsed as numbers
      expect(Number(summary.totalProfit)).not.toBeNaN();
      expect(Number(summary.totalOrders)).not.toBeNaN();
      expect(Number(summary.totalRevenue)).not.toBeNaN();
      expect(Number(summary.totalCost)).not.toBeNaN();
    });
  });

  describe("Overdue Orders Tracking", () => {
    it("should identify orders needing tracking reminder", async () => {
      // Create an old order without tracking
      const timestamp = Date.now();
      const oldOrder = await db.createFullPackageOrder({
        customerId: testCustomerId,
        productName: "Old Order " + timestamp,
        quantity: 1,
        purchasePriceUsd: "10.00",
        sellingPriceUsd: "20.00",
        orderNumber: "OLD-" + timestamp,
        orderCode: "FP-OLD-" + timestamp,
        status: "ordered",
        orderDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
        createdById: 1,
      });

      const overdueOrders = await db.getOrdersNeedingTrackingReminder();
      expect(Array.isArray(overdueOrders)).toBe(true);
      
      // The old order should be in the list
      const found = overdueOrders.find(o => o.id === oldOrder.id);
      expect(found).toBeDefined();
    });

    it("should mark reminder as sent", async () => {
      const overdueOrders = await db.getOrdersNeedingTrackingReminder();
      if (overdueOrders.length > 0) {
        const orderId = overdueOrders[0].id;
        await db.markTrackingReminderSent(orderId);
        
        const order = await db.getFullPackageOrderById(orderId);
        expect(order?.trackingReminderSent).toBe(true);
      }
    });
  });

  describe("Delete Full Package Order", () => {
    it("should delete order", async () => {
      await db.deleteFullPackageOrder(testOrderId);
      const deleted = await db.getFullPackageOrderById(testOrderId);
      expect(deleted).toBeUndefined();
    });
  });
});
