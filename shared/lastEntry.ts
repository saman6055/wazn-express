/**
 * "The last thing I entered", offered back to be put right.
 *
 * The owner, 2026-10-05: «ڕیتێرنی دوایین ئۆردەری تۆمار کراو هەبێ … ڕیتێرن لە
 * کڕین بە تێچوو، لە پاکێجی تەواویش هەبێ، زۆر گرنگە». A slipped key is noticed
 * a second after Save, with the form already emptied for the next entry; the
 * way back used to be a search through a list for the thing typed a moment
 * ago.
 *
 * Three screens offer it — Quick Register, buy-at-cost and full package — so
 * the two rules they share are here once:
 *
 *  - only an entry from this working day is offered. Last week's parcel is
 *    not "the last thing I did", and offering it would be an invitation to
 *    correct the wrong one;
 *  - an order opened this way comes back to the entry form when the edit is
 *    done, not to the list, because the person was in the middle of entering
 *    orders and that is where they carry on.
 */

/** How long an entry stays "the last thing I entered". */
export const LAST_ENTRY_WINDOW_MS = 12 * 60 * 60 * 1000;

/** Entered within the working day — and not dated in the future by more than a clock's drift. */
export function isRecentEntry(at: Date | string | null | undefined, now: number = Date.now()): boolean {
  if (!at) return false;
  const when = at instanceof Date ? at : new Date(at);
  const time = when.getTime();
  if (Number.isNaN(time)) return false;
  return now - time <= LAST_ENTRY_WINDOW_MS;
}

export type EntryOrderType = "commission" | "full_package";

const BASE: Record<EntryOrderType, string> = {
  commission: "/commission",
  full_package: "/full-package",
};

/** The mark an edit carries when it was opened from the entry form. */
const RETURN_PARAM = "then";
const RETURN_TO_ENTRY = "new";

/** The edit form for an order, opened from "my last order". */
export function lastOrderEditHref(orderType: EntryOrderType, orderId: number): string {
  return `${BASE[orderType]}/${orderId}/edit?${RETURN_PARAM}=${RETURN_TO_ENTRY}`;
}

/**
 * Where an order form goes when it is left — saved, cancelled or unchanged.
 *
 * The list, as always; except an edit that was opened from the entry form,
 * which goes back to the entry form. `search` is the address's query string.
 */
export function orderFormExit(orderType: EntryOrderType, isEditMode: boolean, search: string): string {
  if (isEditMode && new URLSearchParams(search).get(RETURN_PARAM) === RETURN_TO_ENTRY) {
    return `${BASE[orderType]}/new`;
  }
  return BASE[orderType];
}
