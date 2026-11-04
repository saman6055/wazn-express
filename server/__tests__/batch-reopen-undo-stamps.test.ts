import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Reopening a closed China batch puts its never-arrived cartons back on the
 * road: the close had stamped them «delivered» (audit 2026-11-05).
 */
const lib = readFileSync(resolve(__dirname, "../db/batchReopen.db.ts"), "utf8");
const router = readFileSync(resolve(__dirname, "../routers/batches.router.ts"), "utf8");

describe("reopen undoes the close's delivered stamps on cartons that never came", () => {
  it("only China batches, only unscanned, unboxed, China-registered parcels", () => {
    expect(lib).toContain("if (!batchMadeInChina(batch.createdInCountryId, chinaIds)) return");
    expect(lib).toContain('eq(packageScans.scanType, "received_local")');
    expect(lib).toContain("!scanned.has(Number(p.id)) && !boxed.has(Number(p.id))");
    expect(lib).toContain('batchHasShipmentNumber(batch) ? "in_transit" : "in_batch"');
  });

  it("reopen calls it and logs which went back", () => {
    const start = router.indexOf("    reopen: staffProcedure");
    const body = router.slice(start, router.indexOf("    updateStatus: staffProcedure", start));
    expect(body).toContain("await db.undoCloseStampsOnReopen(batch.id)");
    expect(body).toContain("notArrivedBack: undone.codes");
  });
});
