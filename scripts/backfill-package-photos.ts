/**
 * Put the scan photos back onto the parcels they were taken of.
 *
 * Every parcel scanned at the China depot had its picture taken and stored on
 * the scan event — `packageScans.photoUrl`. Nothing outside the scan log reads
 * that column, so the picture never reached the portal card, the parcel page,
 * the delivery box or the rating card, all of which read `packages.photos`.
 *
 * The write path is fixed from now on. This is for everything scanned before
 * that: it walks the scans that have a photo and adds it to its parcel's
 * gallery, skipping any URL already there.
 *
 * Safe to run more than once — nothing is overwritten and duplicates are
 * skipped — and safe to interrupt, since each parcel is its own update.
 *
 *   npx tsx scripts/backfill-package-photos.ts          # report only
 *   npx tsx scripts/backfill-package-photos.ts --write  # actually write
 */

import { getDb } from "../server/db/connection";
import { packages, packageScans } from "../drizzle/schema";
import { eq, isNotNull, ne, and, asc } from "drizzle-orm";

const WRITE = process.argv.includes("--write");

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("No database connection. Check the env this is running with.");
    process.exit(1);
  }

  // Oldest first, so a parcel photographed several times ends up with its
  // pictures in the order they were taken.
  const scans = await db
    .select({
      packageId: packageScans.packageId,
      photoUrl: packageScans.photoUrl,
      scannedAt: packageScans.scannedAt,
    })
    .from(packageScans)
    .where(and(isNotNull(packageScans.photoUrl), ne(packageScans.photoUrl, ""), isNotNull(packageScans.packageId)))
    .orderBy(asc(packageScans.scannedAt));

  console.log(`scans carrying a photo: ${scans.length}`);

  const byPackage = new Map<number, string[]>();
  for (const s of scans) {
    if (!s.packageId || !s.photoUrl) continue;
    const list = byPackage.get(s.packageId) ?? [];
    if (!list.includes(s.photoUrl)) list.push(s.photoUrl);
    byPackage.set(s.packageId, list);
  }

  console.log(`parcels involved: ${byPackage.size}`);

  let updated = 0;
  let added = 0;
  let alreadyFine = 0;

  for (const [packageId, urls] of byPackage) {
    const [row] = await db
      .select({ photos: packages.photos })
      .from(packages)
      .where(eq(packages.id, packageId))
      .limit(1);
    if (!row) continue;

    const existing = Array.isArray(row.photos)
      ? row.photos.filter((p): p is string => typeof p === "string")
      : [];
    const missing = urls.filter((u) => !existing.includes(u));

    if (missing.length === 0) {
      alreadyFine += 1;
      continue;
    }

    updated += 1;
    added += missing.length;

    if (WRITE) {
      await db
        .update(packages)
        .set({ photos: [...existing, ...missing] })
        .where(eq(packages.id, packageId));
    }
  }

  console.log(`\nparcels already carrying their photos: ${alreadyFine}`);
  console.log(`parcels ${WRITE ? "updated" : "that would be updated"}: ${updated}`);
  console.log(`photos ${WRITE ? "added" : "that would be added"}: ${added}`);
  if (!WRITE && updated > 0) {
    console.log("\nNothing was written. Re-run with --write to apply.");
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
