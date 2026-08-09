/**
 * Reunite parcels with the orders that already claim their tracking number.
 *
 * A self order is derived, never stored: a parcel is one when it has no order
 * behind it — `packages.fullPackageOrderId IS NULL`. Nothing needs migrating
 * when an order turns up later, because the link is written and the parcel
 * simply stops satisfying the rule.
 *
 * That only works if the link gets written. It did not, in one case: an order
 * can carry several tracking numbers, and those live in
 * `fullPackageOrderTrackings` rather than on the order's own column.
 * `createPackage` only looked at the order's own column, so a parcel
 * registered against a multi-tracking order never found its order.
 *
 * The result is what you saw: the same tracking number sitting in the admin's
 * full-package screen with a buy price, a sell price and a profit, and in the
 * customer's portal under "goods I bought myself". The customer had bought
 * nothing.
 *
 * The lookup is fixed for new parcels. This is for the ones already wrong.
 * It only ever fills in a null — a parcel already linked to an order is left
 * exactly as it is, including one linked to a different order, which is a
 * conflict for a person to look at rather than for a script to guess at.
 *
 *   npx tsx scripts/relink-self-orders.ts          # report only
 *   npx tsx scripts/relink-self-orders.ts --write  # actually write
 */

import { getDb } from "../server/db/connection";
import { packages, fullPackageOrders, fullPackageOrderTrackings } from "../drizzle/schema";
import { and, eq, isNull, isNotNull } from "drizzle-orm";
import { selfOrderWhere } from "../server/db/selfOrder.filter";

const WRITE = process.argv.includes("--write");

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("No database connection. Check the env this is running with.");
    process.exit(1);
  }

  // Every parcel that currently reads as a self order: no order behind it, but
  // it does have an owner (an ownerless box belongs to the unclaimed flow, not
  // to anybody's purchases).
  const orphans = await db
    .select({
      id: packages.id,
      packageCode: packages.packageCode,
      trackingNumber: packages.trackingNumber,
      customerId: packages.customerId,
    })
    .from(packages)
    // The rule comes from one place; see server/db/selfOrder.filter.ts.
    .where(selfOrderWhere(isNotNull(packages.trackingNumber)));

  console.log(`parcels currently reading as self orders: ${orphans.length}`);

  const fixes: { id: number; code: string; tracking: string; orderId: number; orderCode: string }[] = [];
  const customerMismatch: string[] = [];

  for (const p of orphans) {
    if (!p.trackingNumber) continue;

    // The order's own column first — a single-tracking order is the common case.
    let match = (await db
      .select({ id: fullPackageOrders.id, orderCode: fullPackageOrders.orderCode, customerId: fullPackageOrders.customerId })
      .from(fullPackageOrders)
      .where(eq(fullPackageOrders.trackingNumber, p.trackingNumber))
      .limit(1))[0];

    // Then the multi-tracking table, which is the case that was being missed.
    if (!match) {
      match = (await db
        .select({ id: fullPackageOrders.id, orderCode: fullPackageOrders.orderCode, customerId: fullPackageOrders.customerId })
        .from(fullPackageOrderTrackings)
        .innerJoin(fullPackageOrders, eq(fullPackageOrderTrackings.fullPackageOrderId, fullPackageOrders.id))
        .where(eq(fullPackageOrderTrackings.trackingNumber, p.trackingNumber))
        .limit(1))[0];
    }

    if (!match) continue;

    // A parcel owned by one customer and an order owned by another is not
    // something to reconcile automatically — it is a data problem for a person.
    if (match.customerId && p.customerId && match.customerId !== p.customerId) {
      customerMismatch.push(
        `${p.packageCode} (customer ${p.customerId}) ↔ ${match.orderCode} (customer ${match.customerId})`,
      );
      continue;
    }

    fixes.push({
      id: p.id,
      code: p.packageCode,
      tracking: p.trackingNumber,
      orderId: match.id,
      orderCode: match.orderCode,
    });
  }

  console.log(`\nparcels that belong to an order after all: ${fixes.length}`);
  for (const f of fixes.slice(0, 50)) {
    console.log(`  ${f.code}  ${f.tracking}  →  ${f.orderCode}`);
  }
  if (fixes.length > 50) console.log(`  … and ${fixes.length - 50} more`);

  if (customerMismatch.length) {
    console.log(`\nleft alone — parcel and order name different customers: ${customerMismatch.length}`);
    for (const m of customerMismatch) console.log("  " + m);
    console.log("  These need a person to decide. Nothing was changed for them.");
  }

  if (WRITE) {
    for (const f of fixes) {
      await db.update(packages)
        .set({ fullPackageOrderId: f.orderId })
        .where(and(eq(packages.id, f.id), isNull(packages.fullPackageOrderId)));
    }
    console.log(`\nlinked ${fixes.length} parcels.`);
  } else if (fixes.length > 0) {
    console.log("\nNothing was written. Re-run with --write to apply.");
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
