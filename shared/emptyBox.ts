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
 */

/** Statuses a box has before it leaves: still being filled, or sealed. */
export const EMPTY_BOX_STATUSES = ["open", "ready"] as const;

export function isEmptyBox(box: {
  status: string;
  itemCount: number;
  isCharged?: boolean | null;
  hasPayment?: boolean | null;
}): boolean {
  return (
    (EMPTY_BOX_STATUSES as readonly string[]).includes(box.status) &&
    box.itemCount === 0 &&
    !box.isCharged &&
    !box.hasPayment
  );
}
