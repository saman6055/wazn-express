/**
 * When may a parcel that is already in the warehouse be adopted by an order
 * that was entered afterwards?
 *
 * Background. The normal sequence is order first, parcel second: the tracking
 * is already in the system, so `packages.register` resolves it to the order
 * and writes the link on the spot. The reverse sequence is just as real —
 * goods bought at cost that nobody entered yet, arriving in China with only a
 * customer code on the box. Staff quick-register the parcel, and the purchase
 * order is created later.
 *
 * Nothing used to revisit that parcel, and an unlinked package IS the
 * definition of a self order (see getSelfOrderReport), so the same physical
 * box was counted once as shipping-only revenue and once as order profit,
 * while the order sat at `tracking_added` forever.
 *
 * The rules live here, apart from the database, because they decide who gets
 * charged for what. Getting them wrong is a money mistake, not a display one,
 * so they are written once and tested directly.
 */

export type BacklinkConflictReason =
  /** Different customer. Linking would let one customer be charged for goods another takes home. */
  | 'customer_mismatch'
  /** No owner yet. Linking implies claiming, which assigns ownership — a deliberate staff action. */
  | 'unclaimed'
  /** Already charged or already handed over. Re-attributing a settled parcel moves money after the fact. */
  | 'finance_closed';

export type BacklinkDecision =
  | { action: 'link'; isPrimary: boolean }
  | { action: 'skip' }
  | { action: 'conflict'; reason: BacklinkConflictReason };

/** The only package fields the decision depends on. */
export type BacklinkPackage = {
  customerId: number | null;
  isCharged: boolean;
  status: string;
  /** Legacy single-order FK, mirrored from the primary link. */
  fullPackageOrderId: number | null;
};

export type BacklinkLink = { fullPackageOrderId: number; isPrimary: boolean };

/** Statuses past which the parcel has left our hands or the deal is off. */
const TERMINAL_PACKAGE_STATUS = new Set(['delivered', 'returned', 'cancelled']);

/** Order statuses that must never be reopened by a late-arriving link. */
const TERMINAL_ORDER_STATUS = new Set(['delivered', 'cancelled', 'refunded', 'returned']);

export function isTerminalOrderStatus(status: string): boolean {
  return TERMINAL_ORDER_STATUS.has(status);
}

/**
 * Decide what to do with one package whose tracking number matches one of the
 * order's trackings.
 *
 * Order of the checks matters and is deliberate:
 *   1. Already linked wins over everything — re-running must be a no-op, even
 *      for a parcel that has since been delivered and charged. Otherwise a
 *      second call would report a "conflict" about a link it wrote itself.
 *   2. Ownership before money. A customer mismatch is a data error someone has
 *      to look at; reporting it as `finance_closed` would send staff chasing
 *      the wrong problem.
 */
export function classifyBacklinkCandidate(input: {
  pkg: BacklinkPackage;
  orderId: number;
  orderCustomerId: number;
  existingLinks: BacklinkLink[];
}): BacklinkDecision {
  const { pkg, orderId, orderCustomerId, existingLinks } = input;

  const alreadyLinked =
    existingLinks.some((l) => l.fullPackageOrderId === orderId) ||
    pkg.fullPackageOrderId === orderId;
  if (alreadyLinked) return { action: 'skip' };

  if (pkg.customerId === null) return { action: 'conflict', reason: 'unclaimed' };
  if (pkg.customerId !== orderCustomerId) return { action: 'conflict', reason: 'customer_mismatch' };
  if (pkg.isCharged || TERMINAL_PACKAGE_STATUS.has(pkg.status)) {
    return { action: 'conflict', reason: 'finance_closed' };
  }

  // A package can legitimately carry items for several orders (one carton,
  // several purchases). Only the FIRST order to claim it becomes primary: the
  // legacy FK holds exactly one order id, and overwriting it would silently
  // repoint every code path that still reads only that column.
  const hasPrimary = existingLinks.some((l) => l.isPrimary) || pkg.fullPackageOrderId !== null;
  return { action: 'link', isPrimary: !hasPrimary };
}
