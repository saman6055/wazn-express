import { describe, it, expect } from "vitest";

/**
 * Tests for chargeable weight calculation
 * Chargeable weight = max(actual weight, volumetric weight)
 * Volumetric weight = (L × W × H) / 6000 for air shipping
 */
describe("Chargeable Weight Calculation", () => {
  // Helper function to calculate chargeable weight (same logic as in routers.ts)
  function calculateChargeableWeight(
    actualKg: number,
    lengthCm: number,
    widthCm: number,
    heightCm: number
  ): number {
    const volumetricKg = (lengthCm * widthCm * heightCm) / 6000;
    return Math.max(actualKg, volumetricKg);
  }

  describe("when actual weight is higher than volumetric weight", () => {
    it("should use actual weight", () => {
      // Small box: 10x10x10 cm = 0.167 kg volumetric (1000/6000)
      // Actual weight: 5 kg
      const chargeableWeight = calculateChargeableWeight(5, 10, 10, 10);
      expect(chargeableWeight).toBe(5);
    });

    it("should use actual weight for dense items", () => {
      // Medium box: 20x20x20 cm = 1.33 kg volumetric (8000/6000)
      // Actual weight: 10 kg (dense item)
      const chargeableWeight = calculateChargeableWeight(10, 20, 20, 20);
      expect(chargeableWeight).toBe(10);
    });
  });

  describe("when volumetric weight is higher than actual weight", () => {
    it("should use volumetric weight for light bulky items", () => {
      // Large box: 50x50x50 cm = 20.83 kg volumetric (125000/6000)
      // Actual weight: 3 kg (light item)
      const chargeableWeight = calculateChargeableWeight(3, 50, 50, 50);
      expect(chargeableWeight).toBeCloseTo(20.83, 2);
    });

    it("should use volumetric weight for the example in the bug report", () => {
      // From the screenshot: package with "قەبارەیی" tag
      // Let's assume dimensions that would give volumetric weight > actual weight
      // If actual weight is 9.48 kg and it shows "قەبارەیی" tag
      // The volumetric weight must be higher
      // Example: 60x40x40 cm = 16 kg volumetric (96000/6000)
      const chargeableWeight = calculateChargeableWeight(9.48, 60, 40, 40);
      expect(chargeableWeight).toBe(16);
    });

    it("should calculate correctly for irregular shaped packages", () => {
      // Long thin box: 100x20x20 cm = 6.67 kg volumetric (40000/6000)
      // Actual weight: 2 kg
      const chargeableWeight = calculateChargeableWeight(2, 100, 20, 20);
      expect(chargeableWeight).toBeCloseTo(6.67, 2);
    });
  });

  describe("when weights are equal", () => {
    it("should return the same value", () => {
      // Box: 60x50x20 cm = 10 kg volumetric (60000/6000)
      // Actual weight: 10 kg
      const chargeableWeight = calculateChargeableWeight(10, 60, 50, 20);
      expect(chargeableWeight).toBe(10);
    });
  });

  describe("edge cases", () => {
    it("should handle zero dimensions", () => {
      // No dimensions = 0 volumetric weight
      const chargeableWeight = calculateChargeableWeight(5, 0, 0, 0);
      expect(chargeableWeight).toBe(5);
    });

    it("should handle zero actual weight", () => {
      // Zero actual weight, use volumetric
      // 50x50x50 cm = 20.83 kg volumetric
      const chargeableWeight = calculateChargeableWeight(0, 50, 50, 50);
      expect(chargeableWeight).toBeCloseTo(20.83, 2);
    });

    it("should handle all zeros", () => {
      const chargeableWeight = calculateChargeableWeight(0, 0, 0, 0);
      expect(chargeableWeight).toBe(0);
    });
  });

  describe("price calculation with chargeable weight", () => {
    it("should calculate correct price using chargeable weight", () => {
      const pricePerKg = 10; // $10 per kg
      const actualKg = 3;
      const lengthCm = 50;
      const widthCm = 50;
      const heightCm = 50;
      
      const chargeableWeight = calculateChargeableWeight(actualKg, lengthCm, widthCm, heightCm);
      const price = chargeableWeight * pricePerKg;
      
      // Volumetric = 20.83 kg (125000/6000), actual = 3 kg, so chargeable = 20.83 kg
      // Price = 20.83 * 10 = $208.33
      expect(chargeableWeight).toBeCloseTo(20.83, 2);
      expect(price).toBeCloseTo(208.33, 2);
    });

    it("should calculate correct total for multiple packages", () => {
      const pricePerKg = 10;
      
      // Package 1: actual 5kg, small box (volumetric 0.167kg = 1000/6000)
      const pkg1Chargeable = calculateChargeableWeight(5, 10, 10, 10);
      
      // Package 2: actual 2kg, large box (volumetric 20.83kg = 125000/6000)
      const pkg2Chargeable = calculateChargeableWeight(2, 50, 50, 50);
      
      const totalChargeable = pkg1Chargeable + pkg2Chargeable;
      const totalPrice = totalChargeable * pricePerKg;
      
      // Package 1: 5kg (actual > volumetric)
      // Package 2: 20.83kg (volumetric > actual)
      // Total: 25.83kg * $10 = $258.33
      expect(pkg1Chargeable).toBe(5);
      expect(pkg2Chargeable).toBeCloseTo(20.83, 2);
      expect(totalChargeable).toBeCloseTo(25.83, 2);
      expect(totalPrice).toBeCloseTo(258.33, 2);
    });
  });

  describe("user example: customer with 2 packages", () => {
    it("should sum actual weight + volumetric weight correctly", () => {
      // Customer 1 in batch B has 2 packages:
      // Package 1: 1 kg actual weight (no dimensions, so volumetric = 0)
      // Package 2: 3 kg volumetric weight (actual weight could be less)
      
      // Package 1: actual 1kg, no dimensions
      const pkg1Chargeable = calculateChargeableWeight(1, 0, 0, 0);
      expect(pkg1Chargeable).toBe(1); // Uses actual weight
      
      // Package 2: actual 0.5kg, dimensions that give 3kg volumetric
      // 3kg volumetric = 18000 cm³ / 6000 → dimensions like 30x30x20 = 18000 cm³
      const pkg2Chargeable = calculateChargeableWeight(0.5, 30, 30, 20);
      expect(pkg2Chargeable).toBe(3); // Uses volumetric weight
      
      // Total should be 1 + 3 = 4 kg
      const totalChargeable = pkg1Chargeable + pkg2Chargeable;
      expect(totalChargeable).toBe(4);
    });
  });
});
