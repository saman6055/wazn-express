import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as db from "./db";

describe("Product Categories", () => {
  let createdCategoryId: number;
  let secondCategoryId: number;

  describe("Database Operations", () => {
    it("should create a product category", async () => {
      const result = await db.createProductCategory({
        nameEn: "Test Clothing",
        nameAr: "ملابس اختبار",
        nameKu: "جل و بەرگی تاقیکردنەوە",
        icon: "👔",
        color: "#3B82F6",
        sortOrder: 100,
      });

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.nameEn).toBe("Test Clothing");
      expect(result.nameAr).toBe("ملابس اختبار");
      expect(result.icon).toBe("👔");
      expect(result.color).toBe("#3B82F6");
      expect(result.isActive).toBe(true);
      
      createdCategoryId = result.id;
    });

    it("should list all product categories", async () => {
      const categories = await db.getAllProductCategories();
      
      expect(Array.isArray(categories)).toBe(true);
      expect(categories.length).toBeGreaterThan(0);
      
      const testCategory = categories.find(c => c.id === createdCategoryId);
      expect(testCategory).toBeDefined();
      expect(testCategory?.nameEn).toBe("Test Clothing");
    });

    it("should list only active product categories", async () => {
      const categories = await db.getActiveProductCategories();
      
      expect(Array.isArray(categories)).toBe(true);
      // All returned categories should be active
      categories.forEach(cat => {
        expect(cat.isActive).toBe(true);
      });
    });

    it("should get a product category by ID", async () => {
      const category = await db.getProductCategoryById(createdCategoryId);
      
      expect(category).toBeDefined();
      expect(category?.nameEn).toBe("Test Clothing");
      expect(category?.icon).toBe("👔");
    });

    it("should update a product category", async () => {
      const result = await db.updateProductCategory(createdCategoryId, {
        nameEn: "Updated Clothing",
        icon: "👗",
        color: "#EC4899",
      });

      expect(result.nameEn).toBe("Updated Clothing");
      expect(result.icon).toBe("👗");
      expect(result.color).toBe("#EC4899");
      // Original fields should remain
      expect(result.nameAr).toBe("ملابس اختبار");
    });

    it("should toggle category active status", async () => {
      // Deactivate
      const deactivated = await db.updateProductCategory(createdCategoryId, {
        isActive: false,
      });
      expect(deactivated.isActive).toBe(false);

      // Verify it's not in active list
      const activeCategories = await db.getActiveProductCategories();
      const found = activeCategories.find(c => c.id === createdCategoryId);
      expect(found).toBeUndefined();

      // Reactivate
      const reactivated = await db.updateProductCategory(createdCategoryId, {
        isActive: true,
      });
      expect(reactivated.isActive).toBe(true);
    });

    it("should create a second category for deletion test", async () => {
      const result = await db.createProductCategory({
        nameEn: "To Delete",
        icon: "🗑️",
        color: "#EF4444",
        sortOrder: 999,
      });
      
      expect(result).toBeDefined();
      secondCategoryId = result.id;
    });

    it("should delete a product category", async () => {
      await db.deleteProductCategory(secondCategoryId);

      // Verify it's gone
      const categories = await db.getAllProductCategories();
      const deleted = categories.find(c => c.id === secondCategoryId);
      expect(deleted).toBeUndefined();
    });
  });

  describe("Category Sorting", () => {
    it("should return categories sorted by sortOrder", async () => {
      const categories = await db.getActiveProductCategories();
      
      // Verify sorted by sortOrder
      for (let i = 1; i < categories.length; i++) {
        expect(categories[i].sortOrder).toBeGreaterThanOrEqual(categories[i - 1].sortOrder);
      }
    });
  });

  afterAll(async () => {
    // Clean up test category
    if (createdCategoryId) {
      try {
        await db.deleteProductCategory(createdCategoryId);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  });
});
