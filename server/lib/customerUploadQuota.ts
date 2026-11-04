/**
 * How many files a customer may send in a day.
 *
 * Customers send pictures and documents through the portal's messenger, and
 * every one lands in the public uploads folder under the company's address.
 * Without a ceiling one account could fill the disk or use waznexpress.com
 * as free file hosting (security audit, 2026-11-05). Fifty a day is far past
 * any real conversation with the office. Staff are not counted here.
 *
 * Kept in memory: a restart forgets the day's counts, which only ever errs
 * towards letting a customer send.
 */
export const CUSTOMER_UPLOADS_PER_DAY = 50;

const counts = new Map<number, { day: string; n: number }>();

/** Counts one upload; false when today's allowance is already spent. */
export function takeCustomerUpload(customerId: number, now: Date = new Date()): boolean {
  const day = now.toISOString().slice(0, 10);
  const entry = counts.get(customerId);
  const n = entry && entry.day === day ? entry.n : 0;
  if (n >= CUSTOMER_UPLOADS_PER_DAY) return false;
  counts.set(customerId, { day, n: n + 1 });
  if (counts.size > 20_000) {
    counts.forEach((v, k) => {
      if (v.day !== day) counts.delete(k);
    });
  }
  return true;
}

/** Tests only. */
export function resetCustomerUploads(): void {
  counts.clear();
}
