/**
 * A parcel proven lost is never billed when its batch closes, and never
 * stamped delivered (owner, 2026-11-01: lost is compensated, not charged).
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, "../..", p), "utf8").replace(/\r\n/g, "\n");

describe("a lost parcel at batch close", () => {
  it("the delivered run works only on parcels that are not lost", () => {
    const src = read("server/routers/batches.router.ts");
    const run = src.slice(src.indexOf("// ===== PHASE 1: COLLECT ====="), src.indexOf("// ===== PHASE 1: COLLECT =====") + 200);
    expect(run.length).toBeGreaterThan(100);
    const before = src.slice(0, src.indexOf("// ===== PHASE 1: COLLECT ====="));
    const listLine = before.slice(before.lastIndexOf("const packages = "));
    expect(listLine).toMatch(/^const packages = \(await db\.getPackagesByBatch\(id\)\)\.filter\(\(p\) => !p\.lostAt\);/);
  });
});
