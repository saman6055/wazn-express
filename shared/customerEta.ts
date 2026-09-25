/**
 * The arrival date a customer is told, which is not the one the airline gives.
 *
 * The owner, 2026-09-25: once the waybill is filled in the shipment is
 * definitively on its way, and the system can look the schedule up. But
 * "always say five days later than it is, so the customer does not think the
 * plane lands straight inside the company."
 *
 * He is describing the gap between a flight landing and goods being in
 * somebody's hands, and it is a real one: the plane lands, then customs,
 * then the depot, then a day to sort and box. A customer told the landing
 * date turns up on the landing date, and the office spends three days
 * explaining. A date that is a little late costs nothing; a date that is
 * early costs the same conversation every time.
 *
 * So it is added in one place, on the way out to the customer, and nowhere
 * else — the office plans against the real schedule, and must keep seeing
 * it.
 *
 * Only a promise is padded. Once a shipment has actually arrived, the date
 * it arrived on is a fact, and a fact is never moved.
 */

/** The days between a plane landing and the goods being ready to hand over. */
export const CUSTOMER_ETA_BUFFER_DAYS = 5;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * An estimate, as the customer should read it. Null in, null out: a shipment
 * with no schedule promises nothing, which is better than promising badly.
 */
export function customerEta(
  estimate: Date | string | null | undefined,
  bufferDays: number = CUSTOMER_ETA_BUFFER_DAYS,
): Date | null {
  if (!estimate) return null;
  const at = estimate instanceof Date ? estimate : new Date(estimate);
  const ms = at.getTime();
  if (!Number.isFinite(ms)) return null;
  return new Date(ms + bufferDays * DAY_MS);
}
