/**
 * The figures on top of the delivery page, and where each one leads.
 *
 * The four that stood there counted only the twenty boxes on the screen, two
 * of them were nearly always zero, and none could be pressed. The owner,
 * 2026-10-06: «هێشتا داتا هەبێ باشە: کۆی پارەی نەدراو، زۆرترین پارە لە کام بۆکسە …
 * بەڵام کاتێ کلیک ئەکەی بتبات بۆ شوێنی مەبەست». And the next day, of the cold
 * "total value": it should open the boxes whose money was taken, so that one
 * can see what the figure is made of — «لەم هەفتە چەند بۆکس پارەی دراوە، ئەمڕۆ
 * چەند، لایف تایم چەند».
 *
 * So there are two sides, and each figure is the count of a list that a
 * press opens:
 *
 *  - not paid yet: every box on the unpaid list (the «پارە نەدراو» chip's own
 *    list), what the payment screen says each still owes, and the one that
 *    owes the most;
 *  - money taken: the boxes receipted today, this week and ever — a box
 *    counts once however many receipts it has, and a receipt undone does not
 *    count at all.
 *
 * "Today" and "this week" are the office's: Baghdad's clock and a week that
 * begins on Saturday (shared/workingCapital), the same as the money-received
 * card on the working-capital page.
 *
 * Pure: no database. The reads are in server/db/boxOverview.db.ts.
 */

import { boxAgeDays } from "./boxAging";
import { receivedWindows } from "./workingCapital";

export const PAID_WINDOWS = ["today", "week", "all"] as const;
export type PaidWindow = (typeof PAID_WINDOWS)[number];

/** The moment a window opens. "All" opens at the beginning of time. */
export function paidWindowStart(window: PaidWindow, now: Date = new Date()): Date {
  if (window === "all") return new Date(0);
  const windows = receivedWindows(now);
  return window === "today" ? windows.today : windows.week;
}

/** One box on the unpaid list, as the summary needs it. */
export interface UnpaidBoxFact {
  boxId: number;
  boxCode: string;
  customerId: number | null;
  /** What the payment screen says this box still owes. */
  outstandingUsd: number;
  createdAt: Date | string;
}

export interface TopUnpaidBox {
  boxId: number;
  boxCode: string;
  customerId: number | null;
  customerCode: string | null;
  customerName: string | null;
  /** Null when the reader may not see every account's money. */
  usd: number | null;
}

export interface UnpaidSummary {
  /** The length of the unpaid list — the same number as its chip. */
  boxes: number;
  customers: number;
  /** Null when the reader may not see every account's money. */
  usd: number | null;
  /** Days since the oldest of them was opened; null when there are none. */
  oldestDays: number | null;
  /** The box that owes the most; null when none owes anything. */
  top: TopUnpaidBox | null;
}

export interface ReceivedSummary {
  /** Boxes with at least one standing receipt in the window. */
  boxes: number;
  /** Money taken on those receipts. Null when the reader may not see it. */
  usd: number | null;
  /** Forgiven on those receipts. Null when the reader may not see it. */
  discountUsd: number | null;
}

export interface BoxOverview {
  unpaid: UnpaidSummary;
  received: Record<PaidWindow, ReceivedSummary>;
}

const cents = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v ?? 0);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};

/**
 * The unpaid side, from the list itself.
 *
 * Added in whole cents. The box that owes the most is named only when it
 * owes something; between two that owe the same, the one waiting longer.
 */
export function unpaidSummary(
  facts: readonly UnpaidBoxFact[],
  now: Date = new Date(),
): Omit<UnpaidSummary, "top"> & { top: Pick<TopUnpaidBox, "boxId" | "boxCode" | "customerId" | "usd"> | null } {
  let total = 0;
  let oldestDays: number | null = null;
  let top: UnpaidBoxFact | null = null;
  let topCents = 0;
  let topAge = -1;
  const customers = new Set<number>();

  for (const box of facts) {
    const owed = Math.max(0, cents(box.outstandingUsd));
    total += owed;
    if (box.customerId != null) customers.add(box.customerId);
    const created = box.createdAt instanceof Date ? box.createdAt : new Date(box.createdAt);
    const age = Number.isFinite(created.getTime()) ? boxAgeDays(created, now) : 0;
    if (oldestDays === null || age > oldestDays) oldestDays = age;
    if (owed > 0 && (owed > topCents || (owed === topCents && age > topAge))) {
      top = box;
      topCents = owed;
      topAge = age;
    }
  }

  return {
    boxes: facts.length,
    customers: customers.size,
    usd: total / 100,
    oldestDays,
    top: top ? { boxId: top.boxId, boxCode: top.boxCode, customerId: top.customerId, usd: topCents / 100 } : null,
  };
}

/**
 * The same overview without the money, for somebody who takes payments at the
 * counter but does not answer for the books (shared/financeAccess, the
 * owner's 2026-09-11 rule). The counts and the links stay: which boxes are
 * waiting is their work.
 */
export function withoutMoney(overview: BoxOverview): BoxOverview {
  const quiet = (r: ReceivedSummary): ReceivedSummary => ({ boxes: r.boxes, usd: null, discountUsd: null });
  return {
    unpaid: {
      ...overview.unpaid,
      usd: null,
      top: overview.unpaid.top ? { ...overview.unpaid.top, usd: null } : null,
    },
    received: {
      today: quiet(overview.received.today),
      week: quiet(overview.received.week),
      all: quiet(overview.received.all),
    },
  };
}
