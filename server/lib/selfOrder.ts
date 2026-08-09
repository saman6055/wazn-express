/**
 * What makes a parcel a "self order", in one place.
 *
 * A self order is goods the customer bought themselves. We never handled the
 * purchase — the box simply turns up in China with a customer code on it, is
 * quick-registered, and all we do is ship it.
 *
 * The important property is that this is **derived, never stored**. There is
 * no `isSelfOrder` column and there must not be one, because the state is not
 * permanent: the normal sequence is order first, parcel second, but the
 * reverse happens all the time — staff register the parcel, and the admin
 * enters the purchase order days later. The moment that order claims the
 * parcel's tracking number, `orderBacklink` writes the link and
 * `fullPackageOrderId` stops being null. The parcel then simply stops
 * satisfying this predicate, everywhere at once, with nothing to migrate and
 * no second copy of the truth to drift.
 *
 * That is also why every reader must come through here. The self-order report
 * decides revenue and profit; the customer portal decides which tab a parcel
 * appears under. If those two ever disagreed about the same box, one of them
 * would be lying about money. See selfOrder.test.ts, which fails if any
 * reader re-implements the rule instead of importing it.
 */

/**
 * The day self orders start counting.
 *
 * Midnight on 15 July 2026, Baghdad — written as the UTC instant it
 * corresponds to, because the comparison happens in SQL against a timestamp
 * and "midnight" has to mean midnight where the warehouse is. UTC midnight
 * would have put anything registered between 00:00 and 03:00 on the 15th on
 * the wrong side of the line.
 *
 * The reason for a cut-off at all: this feature is new. Everything that
 * arrived before it existed was handled the old way, and treating years of
 * back-catalogue as "goods the customer bought themselves" would put parcels
 * in the portal — and revenue in the self-order report — that were never
 * meant to be there. Those older parcels are not self orders, they are
 * simply from before the question was asked.
 *
 * One constant, read by both the in-memory rule and the SQL one, so the
 * money report and the customer's portal cannot draw the line in different
 * places.
 */
export const SELF_ORDER_FROM = new Date("2026-07-14T21:00:00.000Z");

/** The only package fields the rule depends on. */
export type SelfOrderCandidate = {
  /** The legacy FK, mirrored from the primary package↔order link. */
  fullPackageOrderId: number | null;
  customerId: number | null;
  isUnclaimed: boolean;
  /** When the parcel reached the warehouse and was registered. */
  registeredAt: Date | string | null;
};

export function isSelfOrder(pkg: SelfOrderCandidate): boolean {
  // No order behind it — the whole point.
  if (pkg.fullPackageOrderId !== null) return false;
  // Nobody to attribute it to. An ownerless box is not anybody's purchase; it
  // belongs to the unclaimed flow until staff or the customer claims it.
  if (pkg.customerId === null) return false;
  if (pkg.isUnclaimed) return false;
  // Older than the feature. See SELF_ORDER_FROM.
  if (!registeredOnOrAfterCutoff(pkg.registeredAt)) return false;
  return true;
}

/**
 * A missing or unreadable timestamp counts as too old.
 *
 * Every row has `registeredAt` — the column is NOT NULL with a default — so
 * this only fires on a hand-built object or a broken value, and in that case
 * excluding is the safer direction: it keeps a parcel out of the portal and
 * out of the revenue figure rather than inventing one of each.
 */
function registeredOnOrAfterCutoff(registeredAt: Date | string | null): boolean {
  if (!registeredAt) return false;
  const at = registeredAt instanceof Date ? registeredAt : new Date(registeredAt);
  if (Number.isNaN(at.getTime())) return false;
  return at.getTime() >= SELF_ORDER_FROM.getTime();
}
