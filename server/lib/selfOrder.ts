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

/** The only package fields the rule depends on. */
export type SelfOrderCandidate = {
  /** The legacy FK, mirrored from the primary package↔order link. */
  fullPackageOrderId: number | null;
  customerId: number | null;
  isUnclaimed: boolean;
};

export function isSelfOrder(pkg: SelfOrderCandidate): boolean {
  // No order behind it — the whole point.
  if (pkg.fullPackageOrderId !== null) return false;
  // Nobody to attribute it to. An ownerless box is not anybody's purchase; it
  // belongs to the unclaimed flow until staff or the customer claims it.
  if (pkg.customerId === null) return false;
  if (pkg.isUnclaimed) return false;
  return true;
}
