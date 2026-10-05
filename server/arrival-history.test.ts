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

/**
 * The owner, 2026-10-05: «ئەو باچانەی پشکنینیان بۆ کراوە، وردەکاریی هاتوو و
 * نەهاتووەکانی لە شوێنێ بمێنێ، بتوانی دووبارە بچیتەوە سەری». The scans were
 * always kept; the way back to them was not — the screen lists only batches
 * still on the road, so a finished check had no door left.
 */
describe("a finished check can be gone back to", () => {
  it("the server lists every checked batch, whatever its status now", () => {
    const db = read("server/db/scanning.db.ts");
    const start = db.indexOf("export async function getArrivalCheckedBatches");
    expect(start).toBeGreaterThan(-1);
    const fn = db.slice(start);
    // From the scans, with the meaning the per-batch read gives them.
    expect(fn).toContain('eq(packageScans.scanType, "received_local")');
    expect(fn).toContain("COUNT(DISTINCT ${packageScans.packageId})");
    // No status filter: a batch marked as arrived is exactly the one wanted.
    expect(fn).not.toContain("batches.status,");
    expect(fn).not.toMatch(/eq\(batches\.status/);
    // Three grouped reads, never one per batch.
    expect(fn).toContain(".groupBy(packages.batchId)");
    expect(fn).toContain("inArray(batches.id, ids)");
    expect(read("server/routers/scanning.router.ts")).toContain("arrivalCheckedBatches: staffProcedure.query(async () => db.getArrivalCheckedBatches()),");
  });

  it("the screen shows them, and one press opens what arrived and what did not", () => {
    const page = read("client/src/pages/ArrivalVerificationScanner.tsx");
    expect(page).toContain("<ArrivalCheckHistory onContinue={continueCheck} />");
    const history = read("client/src/components/scanner/ArrivalCheckHistory.tsx");
    expect(history).toContain("trpc.scanning.arrivalCheckedBatches.useQuery(");
    // The detail is the manifest set against the scans — nothing new stored.
    expect(history).toContain("trpc.packages.batchManifest.useQuery({ batchId }");
    expect(history).toContain("trpc.scanning.arrivalChecks.useQuery({ batchIds: [batchId] }");
    expect(history).toContain("splitArrival(");
    expect(history).toContain('data-testid="arrival-detail-missing-row"');
    expect(history).toContain('data-testid="arrival-detail-arrived-row"');
    // Who checked it in, and when — with the clock, as every detail has.
    expect(history).toContain("fmtWhen(checkedAt, true)");
  });

  it("every parcel it names can be copied and opened", () => {
    const history = read("client/src/components/scanner/ArrivalCheckHistory.tsx");
    expect(history).toContain("<a href={parcelListHref(tracking)}");
    expect(history).toContain("<CopyButton value={tracking} />");
    expect(history).toContain("missingTrackingList(split.missing)");
  });

  it("a batch opened again can be scanned into, even once it has arrived", () => {
    const page = read("client/src/pages/ArrivalVerificationScanner.tsx");
    const start = page.indexOf("const continueCheck = (batch: CheckedBatch) => {");
    expect(start).toBeGreaterThan(-1);
    const fn = page.slice(start, page.indexOf("const toggleBatchSelection"));
    expect(fn).toContain("setSelectedBatchIds(");
    // A complete one is a look, not a second finish: the announcement would
    // take it straight back out of the selection.
    expect(fn).toContain("if (isFullyArrived(batch)) announcedBatches.current.add(batch.batchId);");
    expect(page).toContain('b.status === "in_transit" || b.status === "preparing" || again.has(b.id)');
  });
});

describe("a batch checked earlier does not come up as missing", () => {
  it("the manifest reads the verified list as it is when the load finishes", () => {
    // Found 2026-10-05, opening a finished check: the earlier scans were
    // back before the manifest, the manifest was marked from the render that
    // had started its load — an empty list — and all three parcels of a
    // batch with two checked in read "missing (3)". Nothing re-marked them.
    const page = read("client/src/pages/ArrivalVerificationScanner.tsx");
    expect(page).toContain("verifiedRef.current = verifiedPackages;");
    const start = page.indexOf("const loadBatchPackages = async () => {");
    expect(start).toBeGreaterThan(-1);
    const load = page.slice(start, page.indexOf("setBatchPackages(newBatchPackages);", start));
    expect(load).toContain("verified: verifiedRef.current.some(v => v.id === pkg.id),");
    expect(load).not.toContain("verified: verifiedPackages.some(");
  });
});
