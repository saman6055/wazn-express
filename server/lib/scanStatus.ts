/**
 * What a scan does to the package's status.
 *
 * A scan type and a package status are two different vocabularies: a scan
 * records an event ("received at the local warehouse"), while the package
 * column records a state ("ready_for_delivery"). This is the translation
 * between them.
 *
 * It matters more than it looks. The router used to map scan types to
 * human-readable strings — 'In Local Warehouse', 'In Transit' — and write
 * those straight into `packages.status`, which is an ENUM accepting only the
 * nine values below. Six of the nine scan types therefore wrote a value the
 * column could not hold: MySQL in strict mode rejects the write outright.
 * Only 'registered', 'delivered' and 'returned' happened to match, and only
 * because ENUM lookups ignore case.
 */

/** The scan events the warehouse app can record. */
export type ScanType =
  | "registered"
  | "received_china"
  | "in_batch"
  | "in_transit"
  | "received_local"
  | "out_for_delivery"
  | "delivered"
  | "returned"
  | "customs_hold";

/** Exactly the members of the `packages.status` ENUM. */
export type PackageStatus =
  | "registered"
  | "in_batch"
  | "in_transit"
  | "customs_processing"
  | "ready_for_delivery"
  | "out_for_delivery"
  | "delivered"
  | "returned"
  | "cancelled";

export const PACKAGE_STATUSES: PackageStatus[] = [
  "registered",
  "in_batch",
  "in_transit",
  "customs_processing",
  "ready_for_delivery",
  "out_for_delivery",
  "delivered",
  "returned",
  "cancelled",
];

const SCAN_TO_STATUS: Record<ScanType, PackageStatus> = {
  // A package first known to the system, scanned onto a customer's code.
  registered: "registered",
  // Arriving at the China depot is the same state: it is with us, waiting for
  // a batch. There is no separate ENUM member, and adding one would say
  // nothing new.
  received_china: "registered",
  in_batch: "in_batch",
  in_transit: "in_transit",
  // Held by customs — still in transit as far as the customer is concerned,
  // but distinct enough that staff need to see it.
  customs_hold: "customs_processing",
  // Arrived at the Erbil depot: through customs, waiting to be collected.
  // This rung existed in the ENUM from the start and nothing ever set it.
  received_local: "ready_for_delivery",
  out_for_delivery: "out_for_delivery",
  delivered: "delivered",
  returned: "returned",
};

/** The status a scan of this type should leave the package in. */
export function statusForScan(scanType: string): PackageStatus | null {
  return SCAN_TO_STATUS[scanType as ScanType] ?? null;
}

/** Is this a value the `packages.status` column can actually hold? */
export function isPackageStatus(value: string): value is PackageStatus {
  return (PACKAGE_STATUSES as string[]).includes(value);
}

/**
 * How far along the journey each status sits.
 *
 * `returned` and `cancelled` are endings rather than steps, so they get no
 * rank: nothing should ever quietly move a package out of them.
 */
const RANK: Partial<Record<PackageStatus, number>> = {
  registered: 0,
  in_batch: 1,
  in_transit: 2,
  customs_processing: 3,
  ready_for_delivery: 4,
  out_for_delivery: 5,
  delivered: 6,
};

/**
 * The status a package should end up in, given where it is and what just
 * happened — never moving it backwards.
 *
 * A package can be touched by several things at once: a late arrival scan, an
 * item added to a delivery box, a batch marked delivered. Without this, a scan
 * arriving out of order would drag a delivered package back to "in the Erbil
 * depot" and tell the customer their goods had un-arrived.
 *
 * A package that was returned or cancelled stays put. Those are decisions, and
 * undoing one should take a person, not a barcode.
 */
export function advanceStatus(
  current: string | null | undefined,
  next: PackageStatus,
): PackageStatus | null {
  // Already ended, or holding a value we don't recognise: leave it alone.
  if (current && RANK[current as PackageStatus] === undefined) return null;

  // Returning or cancelling is a deliberate act — a scan that says so is
  // allowed to end the journey from wherever the package had got to.
  if (!isPackageStatus(next)) return null;
  if (RANK[next] === undefined) return next;

  const currentRank = RANK[current as PackageStatus];
  if (currentRank === undefined) return next; // no status yet
  return RANK[next]! > currentRank ? next : null;
}
