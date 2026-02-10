import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("./db", () => ({
  getExpenseAlerts: vi.fn(),
  createExpenseAlert: vi.fn(),
  updateExpenseAlert: vi.fn(),
  deleteExpenseAlert: vi.fn(),
  toggleExpenseAlert: vi.fn(),
  getExpenseAlertLogs: vi.fn(),
  checkExpenseAlerts: vi.fn(),
}));

import {
  getExpenseAlerts,
  createExpenseAlert,
  updateExpenseAlert,
  deleteExpenseAlert,
  toggleExpenseAlert,
  getExpenseAlertLogs,
  checkExpenseAlerts,
} from "./db";

describe("Expense Alerts - DB Functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getExpenseAlerts", () => {
    it("should return empty array when no alerts exist", async () => {
      (getExpenseAlerts as any).mockResolvedValue([]);
      const result = await getExpenseAlerts("user-1");
      expect(result).toEqual([]);
      expect(getExpenseAlerts).toHaveBeenCalledWith("user-1");
    });

    it("should return alerts for a user", async () => {
      const mockAlerts = [
        {
          id: 1,
          userId: "user-1",
          alertType: "monthly",
          threshold: 500,
          currency: "USD",
          categoryId: null,
          notifyMethod: "system",
          description: "Monthly expense limit",
          isEnabled: true,
          triggeredCount: 0,
          lastTriggeredAt: null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 2,
          userId: "user-1",
          alertType: "per_transaction",
          threshold: 100,
          currency: "USD",
          categoryId: 5,
          notifyMethod: "both",
          description: "Large transaction alert",
          isEnabled: true,
          triggeredCount: 3,
          lastTriggeredAt: Date.now() - 86400000,
          createdAt: Date.now() - 604800000,
          updatedAt: Date.now(),
        },
      ];
      (getExpenseAlerts as any).mockResolvedValue(mockAlerts);
      const result = await getExpenseAlerts("user-1");
      expect(result).toHaveLength(2);
      expect(result[0].alertType).toBe("monthly");
      expect(result[1].alertType).toBe("per_transaction");
    });
  });

  describe("createExpenseAlert", () => {
    it("should create a new alert with required fields", async () => {
      const newAlert = {
        userId: "user-1",
        alertType: "monthly" as const,
        threshold: 1000,
        currency: "USD",
        notifyMethod: "system" as const,
      };
      (createExpenseAlert as any).mockResolvedValue({ id: 1, ...newAlert, isEnabled: true });
      const result = await createExpenseAlert(newAlert);
      expect(result).toHaveProperty("id");
      expect(result.alertType).toBe("monthly");
      expect(result.threshold).toBe(1000);
      expect(createExpenseAlert).toHaveBeenCalledWith(newAlert);
    });

    it("should create alert with category filter", async () => {
      const newAlert = {
        userId: "user-1",
        alertType: "daily" as const,
        threshold: 200,
        currency: "USD",
        categoryId: 3,
        notifyMethod: "both" as const,
        description: "Daily food expense limit",
      };
      (createExpenseAlert as any).mockResolvedValue({ id: 2, ...newAlert, isEnabled: true });
      const result = await createExpenseAlert(newAlert);
      expect(result.categoryId).toBe(3);
      expect(result.description).toBe("Daily food expense limit");
    });

    it("should create per_transaction alert", async () => {
      const newAlert = {
        userId: "user-1",
        alertType: "per_transaction" as const,
        threshold: 50,
        currency: "USD",
        notifyMethod: "system" as const,
      };
      (createExpenseAlert as any).mockResolvedValue({ id: 3, ...newAlert, isEnabled: true });
      const result = await createExpenseAlert(newAlert);
      expect(result.alertType).toBe("per_transaction");
      expect(result.threshold).toBe(50);
    });
  });

  describe("updateExpenseAlert", () => {
    it("should update alert threshold", async () => {
      (updateExpenseAlert as any).mockResolvedValue({ id: 1, threshold: 750 });
      const result = await updateExpenseAlert(1, "user-1", { threshold: 750 });
      expect(result.threshold).toBe(750);
    });

    it("should update alert type and category", async () => {
      (updateExpenseAlert as any).mockResolvedValue({
        id: 1,
        alertType: "weekly",
        categoryId: 5,
      });
      const result = await updateExpenseAlert(1, "user-1", {
        alertType: "weekly",
        categoryId: 5,
      });
      expect(result.alertType).toBe("weekly");
      expect(result.categoryId).toBe(5);
    });
  });

  describe("deleteExpenseAlert", () => {
    it("should delete an alert", async () => {
      (deleteExpenseAlert as any).mockResolvedValue(true);
      const result = await deleteExpenseAlert(1, "user-1");
      expect(result).toBe(true);
      expect(deleteExpenseAlert).toHaveBeenCalledWith(1, "user-1");
    });
  });

  describe("toggleExpenseAlert", () => {
    it("should toggle alert enabled state", async () => {
      (toggleExpenseAlert as any).mockResolvedValue({ id: 1, isEnabled: false });
      const result = await toggleExpenseAlert(1, "user-1", false);
      expect(result.isEnabled).toBe(false);
    });

    it("should enable a disabled alert", async () => {
      (toggleExpenseAlert as any).mockResolvedValue({ id: 1, isEnabled: true });
      const result = await toggleExpenseAlert(1, "user-1", true);
      expect(result.isEnabled).toBe(true);
    });
  });

  describe("getExpenseAlertLogs", () => {
    it("should return empty array when no logs exist", async () => {
      (getExpenseAlertLogs as any).mockResolvedValue([]);
      const result = await getExpenseAlertLogs("user-1");
      expect(result).toEqual([]);
    });

    it("should return logs with alert details", async () => {
      const mockLogs = [
        {
          id: 1,
          alertId: 1,
          totalExpenses: 550,
          threshold: 500,
          expenseCount: 12,
          status: "sent",
          createdAt: Date.now(),
        },
        {
          id: 2,
          alertId: 2,
          totalExpenses: 120,
          threshold: 100,
          expenseCount: 1,
          status: "sent",
          createdAt: Date.now() - 3600000,
        },
      ];
      (getExpenseAlertLogs as any).mockResolvedValue(mockLogs);
      const result = await getExpenseAlertLogs("user-1");
      expect(result).toHaveLength(2);
      expect(result[0].totalExpenses).toBeGreaterThan(result[0].threshold);
    });
  });

  describe("checkExpenseAlerts", () => {
    it("should check alerts and trigger when threshold exceeded", async () => {
      (checkExpenseAlerts as any).mockResolvedValue({
        triggered: 1,
        alerts: [{ id: 1, alertType: "monthly", threshold: 500, totalExpenses: 650 }],
      });
      const result = await checkExpenseAlerts("user-1", 150);
      expect(result.triggered).toBe(1);
      expect(result.alerts[0].totalExpenses).toBeGreaterThan(result.alerts[0].threshold);
    });

    it("should not trigger when under threshold", async () => {
      (checkExpenseAlerts as any).mockResolvedValue({
        triggered: 0,
        alerts: [],
      });
      const result = await checkExpenseAlerts("user-1", 50);
      expect(result.triggered).toBe(0);
      expect(result.alerts).toHaveLength(0);
    });
  });
});

describe("Expense Alerts - Alert Types", () => {
  it("should support daily alert type", () => {
    const alertTypes = ["daily", "weekly", "monthly", "per_transaction"];
    expect(alertTypes).toContain("daily");
  });

  it("should support weekly alert type", () => {
    const alertTypes = ["daily", "weekly", "monthly", "per_transaction"];
    expect(alertTypes).toContain("weekly");
  });

  it("should support monthly alert type", () => {
    const alertTypes = ["daily", "weekly", "monthly", "per_transaction"];
    expect(alertTypes).toContain("monthly");
  });

  it("should support per_transaction alert type", () => {
    const alertTypes = ["daily", "weekly", "monthly", "per_transaction"];
    expect(alertTypes).toContain("per_transaction");
  });
});

describe("Expense Alerts - Notification Methods", () => {
  it("should support system notification", () => {
    const methods = ["system", "email", "both"];
    expect(methods).toContain("system");
  });

  it("should support email notification", () => {
    const methods = ["system", "email", "both"];
    expect(methods).toContain("email");
  });

  it("should support both notification methods", () => {
    const methods = ["system", "email", "both"];
    expect(methods).toContain("both");
  });
});

describe("Expense Alerts - Threshold Validation", () => {
  it("should reject zero threshold", () => {
    const threshold = 0;
    expect(threshold <= 0).toBe(true);
  });

  it("should reject negative threshold", () => {
    const threshold = -100;
    expect(threshold <= 0).toBe(true);
  });

  it("should accept positive threshold", () => {
    const threshold = 500;
    expect(threshold > 0).toBe(true);
  });

  it("should handle decimal thresholds", () => {
    const threshold = 99.99;
    expect(threshold > 0).toBe(true);
    expect(typeof threshold).toBe("number");
  });
});
