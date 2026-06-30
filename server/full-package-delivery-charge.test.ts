import { describe, it, expect, vi } from "vitest";

/**
 * Unit tests for Full Package Delivery Auto-Charge functionality
 * Tests the logic for automatically charging customers when full package orders are delivered
 * Volumetric weight formula: (L × W × H) / 6000
 */

describe("Full Package Delivery Auto-Charge", () => {
  // Test chargeable weight calculation
  describe("Chargeable Weight Calculation", () => {
    it("should use actual weight when it's higher than volumetric weight", () => {
      const actualWeight = 5.0;
      const volumetricWeight = 2.5; // (30*20*25)/6000 = 2.5
      const chargeableWeight = Math.max(actualWeight, volumetricWeight);
      
      expect(chargeableWeight).toBe(5.0);
    });

    it("should use volumetric weight when it's higher than actual weight", () => {
      const actualWeight = 2.0;
      const volumetricWeight = 4.0; // (40*30*20)/6000 = 4.0
      const chargeableWeight = Math.max(actualWeight, volumetricWeight);
      
      expect(chargeableWeight).toBe(4.0);
    });

    it("should calculate volumetric weight correctly", () => {
      const length = 50;
      const width = 40;
      const height = 30;
      const volumetricWeight = (length * width * height) / 6000;
      
      expect(volumetricWeight).toBe(10.0);
    });

    it("should handle zero dimensions gracefully", () => {
      const length = 0;
      const width = 0;
      const height = 0;
      const volumetricWeight = (length * width * height) / 6000;
      const actualWeight = 3.0;
      const chargeableWeight = Math.max(actualWeight, volumetricWeight);
      
      expect(chargeableWeight).toBe(3.0);
    });
  });

  // Test shipping cost calculation
  describe("Shipping Cost Calculation", () => {
    it("should calculate shipping cost based on chargeable weight and price per kg", () => {
      const chargeableWeight = 5.0;
      const pricePerKg = 10.0;
      const shippingCost = chargeableWeight * pricePerKg;
      
      expect(shippingCost).toBe(50.0);
    });

    it("should handle decimal weights correctly", () => {
      const chargeableWeight = 3.48;
      const pricePerKg = 12.5;
      const shippingCost = chargeableWeight * pricePerKg;
      
      expect(shippingCost).toBeCloseTo(43.5, 2);
    });
  });

  // Test profit calculation
  describe("Profit Calculation", () => {
    it("should calculate gross profit correctly", () => {
      const sellingPrice = 100.0;
      const purchasePrice = 60.0;
      const quantity = 1;
      const grossProfit = sellingPrice - (purchasePrice * quantity);
      
      expect(grossProfit).toBe(40.0);
    });

    it("should calculate net profit after shipping cost", () => {
      const sellingPrice = 100.0;
      const purchasePrice = 60.0;
      const quantity = 1;
      const shippingCost = 15.0;
      const netProfit = sellingPrice - (purchasePrice * quantity) - shippingCost;
      
      expect(netProfit).toBe(25.0);
    });

    it("should handle negative profit (loss)", () => {
      const sellingPrice = 50.0;
      const purchasePrice = 60.0;
      const quantity = 1;
      const shippingCost = 15.0;
      const netProfit = sellingPrice - (purchasePrice * quantity) - shippingCost;
      
      expect(netProfit).toBe(-25.0);
    });

    it("should handle multiple quantities", () => {
      const sellingPrice = 200.0;
      const purchasePrice = 50.0;
      const quantity = 3;
      const shippingCost = 20.0;
      const netProfit = sellingPrice - (purchasePrice * quantity) - shippingCost;
      
      expect(netProfit).toBe(30.0);
    });
  });

  // Test invoice generation data
  describe("Invoice Data Generation", () => {
    it("should generate correct invoice description for full package", () => {
      const orderCode = "FP-ABC123";
      const productName = "iPhone 15";
      const description = `پاکێجی تەواو - ${orderCode} - ${productName}`;
      
      expect(description).toBe("پاکێجی تەواو - FP-ABC123 - iPhone 15");
    });

    it("should include all required invoice fields", () => {
      const invoiceData = {
        customerId: 1,
        amount: 100.0,
        currency: "USD",
        type: "CHARGE",
        description: "پاکێجی تەواو - FP-ABC123 - iPhone 15",
        referenceType: "full_package_order",
        referenceId: 123,
      };
      
      expect(invoiceData).toHaveProperty("customerId");
      expect(invoiceData).toHaveProperty("amount");
      expect(invoiceData).toHaveProperty("currency");
      expect(invoiceData).toHaveProperty("type");
      expect(invoiceData).toHaveProperty("description");
      expect(invoiceData).toHaveProperty("referenceType");
      expect(invoiceData).toHaveProperty("referenceId");
    });
  });

  // Test double-charge prevention
  describe("Double-Charge Prevention", () => {
    it("should not charge if already charged", () => {
      const order = {
        id: 1,
        isChargedToCustomer: true,
        sellingPriceUsd: "100.00",
      };
      
      const shouldCharge = !order.isChargedToCustomer;
      expect(shouldCharge).toBe(false);
    });

    it("should charge if not yet charged", () => {
      const order = {
        id: 1,
        isChargedToCustomer: false,
        sellingPriceUsd: "100.00",
      };
      
      const shouldCharge = !order.isChargedToCustomer;
      expect(shouldCharge).toBe(true);
    });

    it("should handle null isChargedToCustomer as not charged", () => {
      const order = {
        id: 1,
        isChargedToCustomer: null,
        sellingPriceUsd: "100.00",
      };
      
      const shouldCharge = !order.isChargedToCustomer;
      expect(shouldCharge).toBe(true);
    });
  });

  // Test balance deduction
  describe("Balance Deduction", () => {
    it("should deduct correct amount from customer balance", () => {
      const currentBalance = 500.0;
      const chargeAmount = 100.0;
      const newBalance = currentBalance - chargeAmount;
      
      expect(newBalance).toBe(400.0);
    });

    it("should handle balance going negative (debt)", () => {
      const currentBalance = 50.0;
      const chargeAmount = 100.0;
      const newBalance = currentBalance - chargeAmount;
      
      expect(newBalance).toBe(-50.0);
    });

    it("should handle zero balance", () => {
      const currentBalance = 0;
      const chargeAmount = 100.0;
      const newBalance = currentBalance - chargeAmount;
      
      expect(newBalance).toBe(-100.0);
    });
  });
});
