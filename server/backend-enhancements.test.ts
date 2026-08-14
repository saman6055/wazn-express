import { describe, it, expect, beforeAll } from "vitest";
import * as db from "./db";
import { hasDb } from "./testEnv";

describe.skipIf(!hasDb())("Backend Enhancements", () => {
  let testCustomerId: number;

  beforeAll(async () => {
    // Get an existing customer for testing
    const customers = await db.getAllCustomers();
    if (customers.length > 0) {
      testCustomerId = customers[0].id;
    } else {
      throw new Error("No customers found for testing");
    }
  });

  describe("QR Code Operations", () => {
    let qrCode: string;

    it("should create a QR code for package", async () => {
      // Get a package to test with
      const packages = await db.getAllPackages();
      if (packages.length === 0) {
        console.log("No packages to test QR codes");
        return;
      }

      const packageId = packages[0].id;
      const qr = await db.createPackageQrCode({
        packageId,
        packageType: "regular",
        qrCode: `WZN-PK-${packageId}-${Date.now().toString(36).toUpperCase()}`,
      });

      expect(qr).toBeDefined();
      expect(qr.qrCode).toContain("WZN-PK");
      qrCode = qr.qrCode;
    });

    it("should get QR code by code", async () => {
      if (!qrCode) return;
      const qr = await db.getQrCodeByCode(qrCode);
      expect(qr).toBeDefined();
      expect(qr?.qrCode).toBe(qrCode);
    });

    it("should update QR code scan", async () => {
      if (!qrCode) return;
      await db.updateQrCodeScan(qrCode, 1);
      const qr = await db.getQrCodeByCode(qrCode);
      expect(qr?.scanCount).toBe(1);
      expect(qr?.lastScannedById).toBe(1);
    });
  });

  describe("Notification Preferences", () => {
    it("should create notification preferences", async () => {
      await db.upsertNotificationPrefs(testCustomerId, {
        emailEnabled: true,
        smsEnabled: true,
        whatsappEnabled: false,
        packageDelivered: true,
      });

      const prefs = await db.getNotificationPrefs(testCustomerId);
      expect(prefs).toBeDefined();
      expect(prefs?.emailEnabled).toBe(true);
    });

    it("should update notification preferences", async () => {
      await db.upsertNotificationPrefs(testCustomerId, {
        whatsappEnabled: true,
      });

      const prefs = await db.getNotificationPrefs(testCustomerId);
      expect(prefs?.whatsappEnabled).toBe(true);
    });
  });

  describe("Scheduled Tasks Log", () => {
    let taskId: number;

    it("should create scheduled task log", async () => {
      const task = await db.createScheduledTaskLog({
        taskName: "test_task",
        taskType: "overdue_check",
        startedAt: new Date(),
        status: "running",
      });

      expect(task).toBeDefined();
      expect(task.id).toBeGreaterThan(0);
      taskId = task.id;
    });

    it("should update scheduled task log", async () => {
      await db.updateScheduledTaskLog(taskId, {
        status: "completed",
        completedAt: new Date(),
        itemsProcessed: 10,
        itemsSucceeded: 8,
        itemsFailed: 2,
      });

      const tasks = await db.getRecentScheduledTasks(1);
      const updated = tasks.find(t => t.id === taskId);
      expect(updated?.status).toBe("completed");
      expect(updated?.itemsProcessed).toBe(10);
    });

    it("should get recent scheduled tasks", async () => {
      const tasks = await db.getRecentScheduledTasks(10);
      expect(Array.isArray(tasks)).toBe(true);
      expect(tasks.length).toBeGreaterThan(0);
    });
  });

  describe("Advanced Reporting", () => {
    it("should get profit report", async () => {
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      const endDate = new Date();
      const report = await db.getProfitReport(startDate, endDate);

      expect(report).toBeDefined();
      expect(typeof report.packageRevenue).toBe("number");
      expect(typeof report.fullPackageProfit).toBe("number");
      expect(typeof report.totalPayments).toBe("number");
    });

    it("should get top customers by revenue", async () => {
      const topCustomers = await db.getTopCustomersByRevenue(5);
      expect(Array.isArray(topCustomers)).toBe(true);
    });

    it("should get customers with debt", async () => {
      const debtors = await db.getCustomersWithDebt();
      expect(Array.isArray(debtors)).toBe(true);
    });

    it("should get package stats by status", async () => {
      const stats = await db.getPackageStatsByStatus();
      expect(Array.isArray(stats)).toBe(true);
    });

    it("should get time period summary", async () => {
      const daily = await db.getTimePeriodSummary("day");
      expect(Array.isArray(daily)).toBe(true);

      const weekly = await db.getTimePeriodSummary("week");
      expect(Array.isArray(weekly)).toBe(true);

      const monthly = await db.getTimePeriodSummary("month");
      expect(Array.isArray(monthly)).toBe(true);
    });

    it("should get batch performance report", async () => {
      const report = await db.getBatchPerformanceReport();
      expect(Array.isArray(report)).toBe(true);
    });
  });
});
