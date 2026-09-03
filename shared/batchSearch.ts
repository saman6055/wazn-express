/**
 * One definition of what the batches search looks through.
 *
 * A batch can be held in the hand by many different numbers: its own code,
 * the container or air waybill the carrier quotes, the flight it left on,
 * the courier trackings its cartons travelled under, the tracking number of
 * a single parcel inside it, or nothing but the customer who is calling.
 * The search box has to answer to all of them, because whoever is searching
 * has whichever number the phone call gave them, not the one the list is
 * sorted by.
 *
 * Two halves:
 *  - Fields on the batch row itself, listed here and matched both in SQL and
 *    in `batchFieldMatch` (which names the field for the screen).
 *  - Things only reachable through other tables — parcel trackings, order
 *    trackings, customer codes — which the server resolves to batch ids.
 *
 * The field list lives here rather than in the query so the SQL, the match
 * label and the test all read the same definition of "searchable".
 */

/** Below this, a query matches half the warehouse and helps nobody. */
export const MIN_BATCH_SEARCH_LENGTH = 2;

/**
 * The batch's own columns the search covers, in the order a match is
 * reported. Code first: when a query matches both the code and something
 * else, the code is the answer the searcher already understands.
 */
export const BATCH_SEARCH_FIELDS = [
  "batchCode",
  "containerNumber",
  "awbNumber",
  "flightNumber",
  "vesselName",
] as const;

export type SearchableBatchField = (typeof BATCH_SEARCH_FIELDS)[number];

export interface BatchSearchableRow {
  batchCode?: string | null;
  containerNumber?: string | null;
  awbNumber?: string | null;
  flightNumber?: string | null;
  vesselName?: string | null;
  /** The courier trackings the batch's cartons travelled to the depot under. */
  shipmentTrackings?: string[] | null;
}

/**
 * Why a batch is in the search results.
 *
 * Carried with each row so the screen can say what matched — a batch that
 * appears because of a parcel deep inside it would otherwise look like a
 * wrong answer, and a search that seems to return wrong answers stops being
 * trusted.
 */
export type BatchSearchMatch =
  | { kind: "field"; field: SearchableBatchField; value: string }
  | { kind: "shipmentTracking"; value: string }
  | { kind: "parcelTracking"; value: string }
  | { kind: "orderTracking"; value: string }
  | { kind: "customer"; value: string };

/**
 * Escape LIKE wildcards so a literal % or _ typed by the user matches
 * itself instead of matching everything.
 */
export function escapeLikeTerm(term: string): string {
  return term.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/** The `%…%` pattern the SQL side feeds to LIKE. */
export function likePattern(term: string): string {
  return `%${escapeLikeTerm(term.trim())}%`;
}

const contains = (value: string | null | undefined, loweredQuery: string) =>
  typeof value === "string" && value.toLowerCase().includes(loweredQuery);

/**
 * Which part of the batch row itself matched, if any.
 *
 * Mirrors the SQL WHERE in `searchBatches` — the two must cover the same
 * fields. The SQL decides which rows come back; this decides what the row
 * says about why. Case-insensitive to match MySQL's default collation.
 */
export function batchFieldMatch(
  batch: BatchSearchableRow,
  query: string
): BatchSearchMatch | null {
  const q = query.trim().toLowerCase();
  if (q.length < MIN_BATCH_SEARCH_LENGTH) return null;

  for (const field of BATCH_SEARCH_FIELDS) {
    const value = batch[field];
    if (contains(value, q)) return { kind: "field", field, value: value as string };
  }

  const trackings = Array.isArray(batch.shipmentTrackings) ? batch.shipmentTrackings : [];
  const hit = trackings.find((n) => contains(n, q));
  if (hit) return { kind: "shipmentTracking", value: hit };

  return null;
}
