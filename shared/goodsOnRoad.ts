/**
 * Goods on the road — every order bought and not yet finished, one by one.
 *
 * The working-capital page says "goods on the road: $X, N orders"
 * (shared/workingCapital). This is that figure's list: which goods, whose,
 * since when, and where on the road. Owner, 2026-10-07: "is there anywhere
 * that shows every parcel that has not arrived, by its entry date, and what
 * they are all worth — and lets one be marked arrived when it has?"
 *
 * Closing a row is a money decision, so it asks the one thing only a person
 * knows. The owner again: "if it arrived and the customer has it, that means
 * the money was taken too — especially a parcel a long time has passed over."
 * So an order that is with the customer is closed one of two ways:
 *
 *   paid before  — the goods go on the account and come straight off again
 *                  with a line that says so. The balance does not move, no
 *                  false debt is made, and it is not "money received" today.
 *   not paid     — the goods go on the account and stay: a debt.
 *
 * Not knowing is not an answer the system gives for him: nothing is changed.
 */

export type RoadPaid = "before" | "no";

/** How long an order has been open, in the buckets the page totals by. */
export const ROAD_AGE_BUCKETS = [
  { key: "week", maxDays: 7 },
  { key: "month", maxDays: 30 },
  { key: "quarter", maxDays: 90 },
  { key: "older", maxDays: Infinity },
] as const;

export type RoadAgeKey = (typeof ROAD_AGE_BUCKETS)[number]["key"];

export function roadAgeKey(days: number): RoadAgeKey {
  const d = Math.max(0, Number(days) || 0);
  return (ROAD_AGE_BUCKETS.find((b) => d <= b.maxDays) ?? ROAD_AGE_BUCKETS[ROAD_AGE_BUCKETS.length - 1]).key;
}

export interface RoadRow {
  orderId: number;
  orderCode: string;
  orderType: string;
  status: string;
  createdAt: Date | string | null;
  days: number;
  customerId: number | null;
  customerCode: string | null;
  customerName: string | null;
  productName: string | null;
  quantity: number;
  /** What the company paid for the goods. */
  buyUsd: number;
  /** What the customer owes for them once they are on the account. */
  sellUsd: number;
  /** Already a debt on the customer's account (entered since the 2026-09-15 rule). */
  onAccount: boolean;
  trackingNumber: string | null;
}

export interface RoadTotals {
  count: number;
  buyUsd: number;
  sellUsd: number;
}

const cents = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;

export function roadTotals(rows: readonly RoadRow[]): RoadTotals {
  return {
    count: rows.length,
    buyUsd: cents(rows.reduce((s, r) => s + r.buyUsd, 0)),
    sellUsd: cents(rows.reduce((s, r) => s + r.sellUsd, 0)),
  };
}

export function roadByAge(rows: readonly RoadRow[]): Array<{ key: RoadAgeKey } & RoadTotals> {
  return ROAD_AGE_BUCKETS.map((b) => ({ key: b.key, ...roadTotals(rows.filter((r) => roadAgeKey(r.days) === b.key)) }));
}

/** The line that takes "paid before" goods back off the account — said in full, never silent. */
export function paidBeforeReason(orderCode: string): string {
  return `پێشتر دراوە — کاڵاکە لای کڕیارە و پارەکەی پێشتر وەرگیراوە، بە دەست داخرا (${orderCode})`;
}
