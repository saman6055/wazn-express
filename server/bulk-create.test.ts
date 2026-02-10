import { describe, it, expect, beforeAll } from "vitest";
import * as db from "./db";

describe("Bulk Create Orders", () => {
  let testCustomerId: number;

  beforeAll(async () => {
    // Get an existing customer or create one for testing
    const customers = await db.getAllCustomers();
    if (customers.length > 0) {
      testCustomerId = customers[0].id;
    } else {
      // Create a test customer
      const customer = await db.createCustomer({
        fullName: "Bulk Test Customer",
        fullNameKurdish: "کڕیاری تاقیکردنەوە",
        customerCode: "BT-" + Date.now(),
        sequenceNumber: 99999,
        mobileNumber: "07501234567",
      });
      testCustomerId = customer.id;
    }
  });

  describe("Bulk Create Full Package Orders", () => {
    it("should create multiple full package orders at once", async () => {
      const timestamp = Date.now();
      const items = [
        {
          productName: "Bulk Test Product A " + timestamp,
          quantity: 2,
          purchasePriceUsd: "10.00",
          sellingPriceUsd: "25.00",
          orderCode: "FP-BULK-A-" + timestamp,
          createdById: 1,
          customerId: testCustomerId,
        },
        {
          productName: "Bulk Test Product B " + timestamp,
          quantity: 1,
          purchasePriceUsd: "20.00",
          sellingPriceUsd: "40.00",
          orderCode: "FP-BULK-B-" + timestamp,
          createdById: 1,
          customerId: testCustomerId,
        },
        {
          productName: "Bulk Test Product C " + timestamp,
          quantity: 3,
          purchasePriceUsd: "5.00",
          sellingPriceUsd: "12.00",
          orderCode: "FP-BULK-C-" + timestamp,
          createdById: 1,
          customerId: testCustomerId,
        },
      ];

      const results = [];
      for (const item of items) {
        const order = await db.createFullPackageOrder(item);
        results.push(order);
      }

      expect(results).toHaveLength(3);
      
      // Verify each order was created correctly
      expect(results[0].productName).toBe("Bulk Test Product A " + timestamp);
      expect(results[0].quantity).toBe(2);
      expect(results[0].customerId).toBe(testCustomerId);
      
      expect(results[1].productName).toBe("Bulk Test Product B " + timestamp);
      expect(results[1].quantity).toBe(1);
      
      expect(results[2].productName).toBe("Bulk Test Product C " + timestamp);
      expect(results[2].quantity).toBe(3);
    });

    it("should calculate profit correctly for each bulk item", async () => {
      const timestamp = Date.now();
      const items = [
        {
          productName: "Profit Bulk A " + timestamp,
          quantity: 2,
          purchasePriceUsd: "10.00",
          sellingPriceUsd: "25.00",
          shippingCostUsd: "3.00",
          orderCode: "FP-PROFIT-A-" + timestamp,
          createdById: 1,
          customerId: testCustomerId,
        },
        {
          productName: "Profit Bulk B " + timestamp,
          quantity: 5,
          purchasePriceUsd: "8.00",
          sellingPriceUsd: "20.00",
          shippingCostUsd: "10.00",
          orderCode: "FP-PROFIT-B-" + timestamp,
          createdById: 1,
          customerId: testCustomerId,
        },
      ];

      const results = [];
      for (const item of items) {
        const order = await db.createFullPackageOrder(item);
        results.push(order);
      }

      // Item A: profit = (25 - 10) * 2 - 3 = 27
      expect(parseFloat(results[0].profitUsd!)).toBe(27);
      
      // Item B: profit = (20 - 8) * 5 - 10 = 50
      expect(parseFloat(results[1].profitUsd!)).toBe(50);
    });

    it("should assign unique order codes to each bulk item", async () => {
      const timestamp = Date.now();
      const items = [
        {
          productName: "Unique Code A " + timestamp,
          quantity: 1,
          orderCode: "FP-UNIQUE-A-" + timestamp,
          createdById: 1,
          customerId: testCustomerId,
        },
        {
          productName: "Unique Code B " + timestamp,
          quantity: 1,
          orderCode: "FP-UNIQUE-B-" + timestamp,
          createdById: 1,
          customerId: testCustomerId,
        },
      ];

      const results = [];
      for (const item of items) {
        const order = await db.createFullPackageOrder(item);
        results.push(order);
      }

      // Each order should have a unique ID
      expect(results[0].id).not.toBe(results[1].id);
      
      // Each order should have a unique order code
      expect(results[0].orderCode).not.toBe(results[1].orderCode);
    });
  });

  describe("Bulk Create Commission Orders", () => {
    it("should create multiple commission orders with correct pricing", async () => {
      const timestamp = Date.now();
      const items = [
        {
          productName: "Commission Bulk A " + timestamp,
          quantity: 1,
          orderType: "commission" as const,
          orderCode: "CM-BULK-A-" + timestamp,
          createdById: 1,
          customerId: testCustomerId,
          itemPriceUsd: "50.00",
          commissionFeeUsd: "5.00",
          totalPrepaidUsd: "55.00",
          grossProfitUsd: "5.00",
        },
        {
          productName: "Commission Bulk B " + timestamp,
          quantity: 2,
          orderType: "commission" as const,
          orderCode: "CM-BULK-B-" + timestamp,
          createdById: 1,
          customerId: testCustomerId,
          itemPriceUsd: "30.00",
          commissionFeeUsd: "3.00",
          totalPrepaidUsd: "33.00",
          grossProfitUsd: "3.00",
        },
      ];

      const results = [];
      for (const item of items) {
        const order = await db.createFullPackageOrder(item);
        results.push(order);
      }

      expect(results).toHaveLength(2);
      
      // Verify commission pricing
      expect(results[0].orderType).toBe("commission");
      expect(results[0].itemPriceUsd).toBe("50.00");
      expect(results[0].commissionFeeUsd).toBe("5.00");
      expect(results[0].totalPrepaidUsd).toBe("55.00");
      
      expect(results[1].orderType).toBe("commission");
      expect(results[1].itemPriceUsd).toBe("30.00");
      expect(results[1].commissionFeeUsd).toBe("3.00");
    });
  });

  describe("Bulk Create Validation", () => {
    it("should handle items with optional fields", async () => {
      const timestamp = Date.now();
      const order = await db.createFullPackageOrder({
        productName: "Minimal Bulk Item " + timestamp,
        quantity: 1,
        orderCode: "FP-MINIMAL-" + timestamp,
        createdById: 1,
        customerId: testCustomerId,
      });

      expect(order).toBeDefined();
      expect(order.id).toBeGreaterThan(0);
      expect(order.productName).toBe("Minimal Bulk Item " + timestamp);
    });

    it("should create orders with all optional fields populated", async () => {
      const timestamp = Date.now();
      const order = await db.createFullPackageOrder({
        productName: "Full Bulk Item " + timestamp,
        quantity: 3,
        color: "Red",
        size: "XL",
        notes: "Test bulk notes",
        orderNumber: "ORD-FULL-" + timestamp,
        orderCode: "FP-FULL-" + timestamp,
        purchasePriceUsd: "15.00",
        sellingPriceUsd: "35.00",
        shippingCostUsd: "5.00",
        shippingType: "air_regular",
        createdById: 1,
        customerId: testCustomerId,
      });

      expect(order).toBeDefined();
      expect(order.color).toBe("Red");
      expect(order.size).toBe("XL");
      expect(order.notes).toBe("Test bulk notes");
      expect(order.shippingType).toBe("air_regular");
      // Profit = (35 - 15) * 3 - 5 = 55
      expect(parseFloat(order.profitUsd!)).toBe(55);
    });

    it("should handle large batch of items", async () => {
      const timestamp = Date.now();
      const batchSize = 10;
      const results = [];
      
      for (let i = 0; i < batchSize; i++) {
        const order = await db.createFullPackageOrder({
          productName: `Large Batch Item ${i + 1} ${timestamp}`,
          quantity: 1,
          purchasePriceUsd: "5.00",
          sellingPriceUsd: "10.00",
          orderCode: `FP-LARGE-${i}-${timestamp}`,
          createdById: 1,
          customerId: testCustomerId,
        });
        results.push(order);
      }

      expect(results).toHaveLength(batchSize);
      
      // All should have unique IDs
      const ids = results.map(r => r.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(batchSize);
    });
  });
});
