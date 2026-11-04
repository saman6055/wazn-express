import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The strip subtracts our other batches' late cartons from what is still to
 * come (2026-11-03); the group's verdict and the bell must count them too, or
 * the bell says "short" where the strip says nothing is (audit 2026-11-05).
 */
const src = readFileSync(resolve(__dirname, "../db/carrierGroup.db.ts"), "utf8");

describe("carrier group verdict counts the other batches' cartons", () => {
  it("verdict and difference read ours plus the others", () => {
    expect(src).toContain("const others = await arrivedWithLoad(members.map((m) => m.batchId));");
    expect(src).toContain("verdict: groupVerdict({ billedKg, oursKg: withOthersKg, stillComing })");
    expect(src).toContain("oursKg: withOthersKg }) : 0");
  });

  it("the bell's missing kilos are the same figure", () => {
    expect(src).toContain("(g.invoice?.billedKg ?? 0) - g.withOthersKg");
  });
});

describe("a late carton counts in one load only", () => {
  it("takes the load of its first arrival check", () => {
    expect(src).toContain("const firstLoad = new Map<number, number | null>();");
    expect(src).toContain("if (first == null || !wanted.has(first)) continue;");
  });
});

describe("a lost parcel is not still coming", () => {
  it("memberFacts leaves out parcels written off as lost", () => {
    expect(src).toContain('notInArray(packages.status, ["cancelled", "returned"]), isNull(packages.lostAt)));');
  });
});
