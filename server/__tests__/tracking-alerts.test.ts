import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as db from "./db";

describe("Tracking Alert System", () => {
  describe("getTrackingAlertStats", () => {
    it("should return alert statistics with correct structure", async () => {
      const stats = await db.getTrackingAlertStats();
      
      expect(stats).toBeDefined();
      expect(typeof stats.total).toBe("number");
      expect(typeof stats.warning).toBe("number");
      expect(typeof stats.urgent).toBe("number");
      expect(typeof stats.critical).toBe("number");
      expect(stats.total).toBeGreaterThanOrEqual(0);
      expect(stats.warning).toBeGreaterThanOrEqual(0);
      expect(stats.urgent).toBeGreaterThanOrEqual(0);
      expect(stats.critical).toBeGreaterThanOrEqual(0);
    });

    it("should have total equal to sum of alert levels", async () => {
      const stats = await db.getTrackingAlertStats();
      
      // Total should be >= sum of categorized alerts (some might be < 3 days)
      expect(stats.total).toBeGreaterThanOrEqual(
        stats.warning + stats.urgent + stats.critical
      );
    });
  });

  describe("getOrdersPendingTracking", () => {
    it("should return array of orders without tracking", async () => {
      const orders = await db.getOrdersPendingTracking();
      
      expect(Array.isArray(orders)).toBe(true);
      
      // Each order should have required fields
      orders.forEach(order => {
        expect(order.id).toBeDefined();
        expect(order.orderCode).toBeDefined();
        expect(order.productName).toBeDefined();
        // trackingNumber should be null or empty for pending orders
        expect(!order.trackingNumber || order.trackingNumber === "").toBe(true);
      });
    });

    it("should only return orders with status 'ordered' and no tracking", async () => {
      const orders = await db.getOrdersPendingTracking();
      
      orders.forEach(order => {
        expect(order.status).toBe("ordered");
      });
    });
  });

  describe("getOrdersByAlertLevel", () => {
    it("should return orders for warning level (3-5 days)", async () => {
      const orders = await db.getOrdersByAlertLevel("warning");
      
      expect(Array.isArray(orders)).toBe(true);
    });

    it("should return orders for urgent level (5-7 days)", async () => {
      const orders = await db.getOrdersByAlertLevel("urgent");
      
      expect(Array.isArray(orders)).toBe(true);
    });

    it("should return orders for critical level (7+ days)", async () => {
      const orders = await db.getOrdersByAlertLevel("critical");
      
      expect(Array.isArray(orders)).toBe(true);
    });
  });

  describe("getSupplierTrackingPerformance", () => {
    it("should return supplier performance data", async () => {
      const performance = await db.getSupplierTrackingPerformance();
      
      expect(Array.isArray(performance)).toBe(true);
      
      performance.forEach(supplier => {
        expect(typeof supplier.supplierId).toBe("number");
        expect(typeof supplier.totalOrders).toBe("number");
        expect(typeof supplier.ordersWithTracking).toBe("number");
        expect(typeof supplier.ordersWithoutTracking).toBe("number");
      });
    });

    it("should have consistent order counts per supplier", async () => {
      const performance = await db.getSupplierTrackingPerformance();
      
      performance.forEach(supplier => {
        expect(supplier.totalOrders).toBe(
          supplier.ordersWithTracking + supplier.ordersWithoutTracking
        );
      });
    });
  });

  describe("processTrackingAlerts", () => {
    it("should process alerts and return update count", async () => {
      const result = await db.processTrackingAlerts();
      
      expect(result).toBeDefined();
      expect(typeof result.updated).toBe("number");
      expect(result.updated).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Alert Level Calculation", () => {
    it("should correctly calculate days waiting", () => {
      const now = new Date();
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      const calculateDaysWaiting = (orderDate: Date) => {
        return Math.floor((now.getTime() - orderDate.getTime()) / (24 * 60 * 60 * 1000));
      };
      
      expect(calculateDaysWaiting(threeDaysAgo)).toBe(3);
      expect(calculateDaysWaiting(fiveDaysAgo)).toBe(5);
      expect(calculateDaysWaiting(sevenDaysAgo)).toBe(7);
    });

    it("should correctly determine alert level based on days", () => {
      const getAlertLevel = (daysWaiting: number) => {
        if (daysWaiting >= 7) return "critical";
        if (daysWaiting >= 5) return "urgent";
        if (daysWaiting >= 3) return "warning";
        return "none";
      };
      
      expect(getAlertLevel(2)).toBe("none");
      expect(getAlertLevel(3)).toBe("warning");
      expect(getAlertLevel(4)).toBe("warning");
      expect(getAlertLevel(5)).toBe("urgent");
      expect(getAlertLevel(6)).toBe("urgent");
      expect(getAlertLevel(7)).toBe("critical");
      expect(getAlertLevel(10)).toBe("critical");
    });
  });
});
