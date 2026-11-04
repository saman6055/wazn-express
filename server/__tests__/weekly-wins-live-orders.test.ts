import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** The week's wins count live orders only: no cancelled, rejected, refunded or purchase requests (audit 2026-11-05). */
const src = readFileSync(resolve(__dirname, "../db/reports.db.ts"), "utf8");

describe("weekly wins count live orders", () => {
  it("one rule for the count, last week's count, the list and the busiest customer", () => {
    expect(src).toContain("const LIVE_WEEK_ORDER = () => [");
    expect(src).toContain("notInArray(fullPackageOrders.status, ['cancelled', 'rejected', 'refunded'] as any)");
    expect((src.match(/\.\.\.LIVE_WEEK_ORDER\(\)/g) ?? []).length).toBe(4);
  });
});
