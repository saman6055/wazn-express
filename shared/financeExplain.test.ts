import { describe, expect, it } from "vitest";
import {
  EXPLAINABLE_FIGURES,
  explainAll,
  explainFigure,
  explainNetProfit,
  explainTotalExpenses,
  explainTotalRevenue,
  sameMoney,
  type DashboardStatsLike,
} from "./financeExplain";

/**
 * The drill-down is only worth having if it reconciles.
 *
 * A breakdown whose parts do not add up to the headline is worse than no
 * breakdown: it looks like an answer. So the parts summing to the whole is
 * asserted here, and when it fails it means the arithmetic is genuinely
 * wrong somewhere — the explanation is a bug detector as much as a feature.
 */

/** Shaped like getComprehensiveDashboardStats, with figures that add up. */
function stats(over: Partial<DashboardStatsLike> = {}): DashboardStatsLike {
  const base: DashboardStatsLike = {
    revenueBySource: {
      batchProfit: {
        air_regular: { revenue: 5000, cost: 3000, profit: 2000, count: 40 },
        air_irregular: { revenue: 2000, cost: 1200, profit: 800, count: 12 },
        sea: { revenue: 4000, cost: 2500, profit: 1500, count: 25 },
        total: 4300,
      },
      fullPackage: { revenue: 3000, cost: 2100, profit: 900, count: 6 },
      commission: { totalCommission: 450, count: 9 },
      service: { revenue: 800, cost: 300, profit: 500, count: 11 },
      deliveryBox: { totalCharge: 700, totalCost: 400, totalProfit: 300, boxCount: 14 },
      totalRevenue: 6450,
    },
    expenseBreakdown: {
      total: 2100,
      categories: [
        { id: 1, nameEn: "Fuel", nameKu: "بەنزین", amount: 600, count: 12 },
        { id: 2, nameEn: "Rent", nameKu: "کرێی بینا", amount: 1000, count: 1 },
        { id: 3, nameEn: "Salaries", nameKu: "موچە", amount: 500, count: 4 },
      ],
    },
    profitLoss: { totalRevenue: 6450, totalExpenses: 2100, netProfit: 4350 },
  };
  return { ...base, ...over };
}

describe("every figure adds up to its parts", () => {
  it("explains all the figures it claims to", () => {
    // Guard the guard: an empty list would make the reconciliation loop
    // below pass by checking nothing.
    expect(EXPLAINABLE_FIGURES.length).toBeGreaterThan(2);
    expect(explainAll(stats())).toHaveLength(EXPLAINABLE_FIGURES.length);
  });

  it("reconciles on a normal period", () => {
    for (const explanation of explainAll(stats())) {
      expect(
        explanation.reconciles,
        `${explanation.figure}: parts total ${explanation.componentTotal}, headline ${explanation.value}`
      ).toBe(true);
    }
  });

  it("reconciles when there has been no activity at all", () => {
    // A brand-new install, or a period before the company existed. Zero must
    // not look like a mismatch.
    for (const explanation of explainAll({})) {
      expect(explanation.reconciles, explanation.figure).toBe(true);
      expect(explanation.value).toBe(0);
    }
  });

  it("reconciles when the company lost money", () => {
    const losing = stats({
      expenseBreakdown: {
        total: 9000,
        categories: [{ id: 1, nameEn: "Rent", nameKu: "کرێ", amount: 9000, count: 1 }],
      },
      profitLoss: { totalRevenue: 6450, totalExpenses: 9000, netProfit: -2550 },
    });
    const net = explainNetProfit(losing);
    expect(net.value).toBe(-2550);
    expect(net.reconciles).toBe(true);
  });

  it("notices when the parts stop adding up", () => {
    // The whole point. If the headline is computed one way and the parts
    // another, this must go red rather than quietly showing both.
    const broken = stats({
      profitLoss: { totalRevenue: 9999, totalExpenses: 2100, netProfit: 7899 },
    });
    expect(explainTotalRevenue(broken).reconciles).toBe(false);
  });

  it("compares money at the cent, not by exact equality", () => {
    // Sums of floats do not land on equality; a tenth of a cent apart is the
    // same money and must not be reported as a discrepancy.
    expect(sameMoney(0.1 + 0.2, 0.3)).toBe(true);
    expect(sameMoney(100, 100.004)).toBe(true);
    expect(sameMoney(100, 100.02)).toBe(false);
  });
});

describe("total revenue", () => {
  const explanation = explainTotalRevenue(stats());

  it("names every source that contributed", () => {
    expect(explanation.components.map((c) => c.key)).toEqual([
      "air_regular", "air_irregular", "sea", "fullPackage", "commission", "service", "deliveryBox",
    ]);
  });

  it("carries how many records are behind each source", () => {
    const air = explanation.components.find((c) => c.key === "air_regular");
    expect(air?.count).toBe(40);
    expect(air?.href).toBeTruthy();
  });

  it("says plainly that it is not really revenue", () => {
    // Every part of this figure is a profit — each source's own cost is
    // already deducted. The card calls it revenue, and a reader comparing it
    // against sales would be confused for a long time before finding out why.
    expect(explanation.caveat).toBeTruthy();
    expect(explanation.caveat!.en).toContain("gross profit");
  });
});

describe("total expenses", () => {
  it("breaks down by the categories the money was filed under", () => {
    const explanation = explainTotalExpenses(stats());
    expect(explanation.components.map((c) => c.label.ku)).toEqual(["بەنزین", "کرێی بینا", "موچە"]);
    expect(explanation.componentTotal).toBe(2100);
  });

  it("falls back to whatever name a category has", () => {
    const partial = explainTotalExpenses(stats({
      expenseBreakdown: { total: 50, categories: [{ id: 9, nameEn: "Misc", nameKu: null, amount: 50, count: 1 }] },
    }));
    expect(partial.components[0].label.ku).toBe("Misc");
  });

  it("does not invent categories when there were no expenses", () => {
    const none = explainTotalExpenses(stats({ expenseBreakdown: { total: 0, categories: [] }, profitLoss: { totalRevenue: 6450, totalExpenses: 0, netProfit: 6450 } }));
    expect(none.components).toEqual([]);
    expect(none.reconciles).toBe(true);
  });
});

describe("net profit", () => {
  const explanation = explainNetProfit(stats());

  it("shows the subtraction as a subtraction", () => {
    // Expenses appear negative so the column adds up on the page the same way
    // it does in the arithmetic.
    const expenses = explanation.components.find((c) => c.key === "expenses");
    expect(expenses?.value).toBe(-2100);
    expect(explanation.componentTotal).toBe(explanation.value);
  });

  it("is reachable through the same entry point as the others", () => {
    expect(explainFigure("netProfit", stats())).toEqual(explanation);
  });
});
