/**
 * A delivery box nothing was ever put in.
 *
 * Owner, 2026-09-17: an empty box should be flagged, and — since it is empty —
 * deletable right where it is seen. Empty means more than "no parcels" here:
 * not sent, no delivery fee charged and no payment taken either, so deleting
 * it (into the recycle bin, where it can be put back) touches nothing but the
 * box itself.
 *
 * One rule for the list's button, the alert and the bell. The server asks the
 * same question in SQL (emptyBoxSql in server/db/deliveryBoxes.db.ts), and asks
 * it again at the moment of deleting, so a parcel scanned in since the list
 * was drawn saves its box. Pure: no database, no React.
 *
 * Empty also means the box's own record says so. Owner, 2026-09-17, on
 * BOX-20260719-003: the alert called it empty while the list showed 4 parcels.
 * Its record counted 4 and it had no parcel rows: restoring a box from the bin
 * put the box back and not its parcels. A box like that is damaged, not
 * empty, and is never offered for deletion.
 */

/** Statuses a box has before it leaves: still being filled, or sealed. */
export const EMPTY_BOX_STATUSES = ["open", "ready"] as const;

export function isEmptyBox(box: {
  status: string;
  itemCount: number;
  /** What the box's own record counts (deliveryBoxes.totalPackages). */
  recordedPackages?: number | null;
  isCharged?: boolean | null;
  hasPayment?: boolean | null;
}): boolean {
  return (
    (EMPTY_BOX_STATUSES as readonly string[]).includes(box.status) &&
    box.itemCount === 0 &&
    !box.recordedPackages &&
    !box.isCharged &&
    !box.hasPayment
  );
}
