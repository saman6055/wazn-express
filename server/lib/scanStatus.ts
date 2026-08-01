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
