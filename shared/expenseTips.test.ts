import { describe, it, expect } from "vitest";
import { expenseTips } from "./expenseTips";

const cat = (categoryId: number, categoryName: string, total: number) => ({ categoryId, categoryName, total });

describe("expenseTips", () => {
  it("names a category that rose a quarter or more by at least $20", () => {
    const tips = expenseTips(
      { totalAmount: 300, byCategory: [cat(1, "Fuel", 200), cat(2, "Rent", 100)] },
      { totalAmount: 250, byCategory: [cat(1, "Fuel", 150), cat(2, "Rent", 100)] },
    );
    expect(tips.find((t) => t.kind === "grew")?.categoryId).toBe(1);
    expect(tips.find((t) => t.kind === "grew")?.ku).toContain("33%");
  });

  it("does not call a small rise news", () => {
    const tips = expenseTips(
      { totalAmount: 110, byCategory: [cat(1, "Fuel", 110)] },
      { totalAmount: 100, byCategory: [cat(1, "Fuel", 100)] },
    );
    expect(tips.some((t) => t.kind === "grew")).toBe(false);
  });

  it("flags a heavy category, a dominant supplier and a new expense", () => {
    const tips = expenseTips(
      { totalAmount: 1000, byCategory: [cat(1, "Rent", 600), cat(3, "Repairs", 400)] },
      { totalAmount: 600, byCategory: [cat(1, "Rent", 600)] },
      [{ vendor: "Ali Garage", total: 400, count: 4 }],
    );
    expect(tips.map((t) => t.kind)).toEqual(expect.arrayContaining(["new", "heavy", "vendor"]));
  });

  it("says so when spending came down", () => {
    const tips = expenseTips({ totalAmount: 80, byCategory: [cat(1, "Fuel", 80)] }, { totalAmount: 100, byCategory: [cat(1, "Fuel", 100)] });
    expect(tips.some((t) => t.kind === "good")).toBe(true);
  });
});
