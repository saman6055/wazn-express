/**
 * Why the payment window has nothing to take.
 *
 * It said "nothing outstanding on this box" in three different situations:
 * the box could not be loaded, the box had no parcels in it, or every parcel
 * was already covered. Staff could not tell a paid box from a broken screen
 * (BOX-20260719-003 on 2026-09-10: the list said 53 days unpaid, the window
 * said nothing owed). A load failure is now shown as a failure, with its
 * report; the other two each say which one it is.
 */

export type NothingToTakeReason = "no_box" | "no_parcels" | "all_covered";

export interface ParcelLike {
  lineId: number;
  packageCode: string | null;
  trackingNumber: string | null;
  chargedUsd: number;
  discountedUsd: number;
  settledUsd: number;
  outstandingUsd: number;
}

export interface SettlementViewLike {
  box: unknown | null;
  parcels: ReadonlyArray<ParcelLike>;
  settlements: ReadonlyArray<{ status: string }>;
}

export function nothingToTakeReason(view: SettlementViewLike | null | undefined): NothingToTakeReason {
  if (!view || !view.box) return "no_box";
  if (view.parcels.length === 0) return "no_parcels";
  return "all_covered";
}

/** Payments on this box that still stand; reversed ones gave their money back. */
export function confirmedPaymentCount(view: SettlementViewLike | null | undefined): number {
  return (view?.settlements ?? []).filter((s) => s.status === "confirmed").length;
}
