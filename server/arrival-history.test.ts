import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

const read = (rel: string) =>
  fs.readFileSync(path.resolve(__dirname, "..", rel), "utf8").replace(/\r\n/g, "\n");

/**
 * The owner, 2026-09-26, opening AIR-2026-055 a second time: 0 of 84 checked
 * and 84 missing, for a batch whose boxes went out weeks ago. «ئەوانەی
 * پشکنینی گەیشتنیان بۆ کراوە پێشووتر وەکو داتا هەر بمێنێ نەک سفر ببێتەوە.»
 */
describe("an arrival check is not lost when the tab closes", () => {
  it("is read back from the scans, not from the browser", () => {
    const db = read("server/db/scanning.db.ts");
    const fn = db.slice(db.indexOf("export async function getArrivalChecksForBatches"));
    expect(fn.length).toBeGreaterThan(200);
    // The scan is the record. A status can be set by a box being built or by
    // a hand on another screen; a received_local scan means somebody stood
    // at the bench with that parcel.
    expect(fn).toContain('eq(packageScans.scanType, "received_local")');
    expect(fn).toContain("inArray(packages.batchId, batchIds)");
    // Who did it and when, so the screen can say more than a number.
    expect(fn).toContain("scannedByName: users.name");
    expect(fn).toContain("scannedAt: packageScans.scannedAt");
  });

  it("counts a parcel once, at the first check", () => {
    const db = read("server/db/scanning.db.ts");
    const fn = db.slice(db.indexOf("export async function getArrivalChecksForBatches"));
    expect(fn).toContain("if (!id || first.has(id)) continue;");
    expect(fn).toContain("orderBy(packageScans.scannedAt)");
  });

  it("is asked for by the screen, for the shipments it is showing", () => {
    const router = read("server/routers/scanning.router.ts");
    expect(router).toContain("arrivalChecks: staffProcedure");
    expect(router).toContain("db.getArrivalChecksForBatches(input.batchIds)");
    const page = read("client/src/pages/ArrivalVerificationScanner.tsx");
    expect(page).toContain("trpc.scanning.arrivalChecks.useQuery");
    expect(page).toContain("enabled: selectedBatchIds.length > 0");
  });

  it("never overwrites what the bench just scanned", () => {
    // A parcel scanned at this bench keeps the scan in front of the person:
    // theirs is the newer fact.
    const page = read("client/src/pages/ArrivalVerificationScanner.tsx");
    expect(page).toContain("const known = new Set(current.map((p) => p.id));");
    expect(page).toContain("if (!id || known.has(id)) continue;");
  });
});
