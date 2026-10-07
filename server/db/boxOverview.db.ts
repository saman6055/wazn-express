import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { getDb } from "./connection";
import { customers, deliveryBoxes } from "../../drizzle/schema";
import { boxSettlements } from "../../drizzle/schema/finance.schema";
import { getAllDeliveryBoxes, receiptSinceSql } from "./deliveryBoxes.db";
import {
  PAID_WINDOWS, paidWindowStart, unpaidSummary,
  type BoxOverview, type PaidWindow, type ReceivedSummary,
} from "@shared/boxOverview";
import { appLogger } from "../utils/logger";

/**
 * The figures on top of the delivery page (shared/boxOverview says why).
 *
 * Read only. Each figure is the count of a list a press opens, so each is
 * read the way its list is:
 *
 *  - not paid yet: the unpaid list itself — getAllDeliveryBoxes with the
 *    «پارە نەدراو» chip's own filter — and what the payment screen says each
 *    box still owes, which that list now carries on every row. Asking the
 *    list rather than writing its rule out a second time is the point: a
 *    card that says 11 must open a list of 11.
 *  - money taken: boxes with a standing receipt since the window opened, by
 *    the same condition the list filters on (receiptSinceSql), and the money
 *    on those receipts.
 */

/** Far more boxes than are ever waiting at once; the list is asked for all of them. */
const UNPAID_LIST_CAP = 5000;

const NOTHING: ReceivedSummary = { boxes: 0, usd: 0, discountUsd: 0 };

async function receivedSince(start: Date): Promise<ReceivedSummary> {
  const db = await getDb();
  if (!db) return NOTHING;
  const [boxes] = await db
    .select({ n: sql<number>`COUNT(*)` })
    .from(deliveryBoxes)
    .where(receiptSinceSql(start));
  const [money] = await db
    .select({
      paid: sql<string>`COALESCE(SUM(${boxSettlements.paidUsd}), 0)`,
      discount: sql<string>`COALESCE(SUM(${boxSettlements.discountUsd}), 0)`,
    })
    .from(boxSettlements)
    .where(and(eq(boxSettlements.status, "confirmed"), gte(boxSettlements.createdAt, start)));
  return {
    boxes: Number(boxes?.n) || 0,
    usd: Math.round((Number(money?.paid) || 0) * 100) / 100,
    discountUsd: Math.round((Number(money?.discount) || 0) * 100) / 100,
  };
}

export async function getBoxOverview(now: Date = new Date()): Promise<BoxOverview> {
  const empty: BoxOverview = {
    unpaid: { boxes: 0, customers: 0, usd: 0, oldestDays: null, top: null },
    received: { today: NOTHING, week: NOTHING, all: NOTHING },
  };
  const db = await getDb();
  if (!db) return empty;

  try {
    const { boxes } = await getAllDeliveryBoxes({ archive: "exclude", limit: UNPAID_LIST_CAP });
    const summary = unpaidSummary(
      boxes.map((box) => ({
        boxId: box.id,
        boxCode: box.boxCode,
        customerId: box.customerId ?? null,
        outstandingUsd: Number(box.outstandingUsd ?? 0),
        createdAt: box.createdAt,
      })),
      now,
    );

    let top: BoxOverview["unpaid"]["top"] = null;
    if (summary.top) {
      const owners = summary.top.customerId != null
        ? await db
            .select({ code: customers.customerCode, name: customers.fullName })
            .from(customers)
            .where(inArray(customers.id, [summary.top.customerId]))
            .limit(1)
        : [];
      top = { ...summary.top, customerCode: owners[0]?.code ?? null, customerName: owners[0]?.name ?? null };
    }

    const received = {} as Record<PaidWindow, ReceivedSummary>;
    for (const window of PAID_WINDOWS) received[window] = await receivedSince(paidWindowStart(window, now));

    return { unpaid: { ...summary, top }, received };
  } catch (err) {
    appLogger.error("getBoxOverview failed", { error: err instanceof Error ? err.message : String(err) });
    return empty;
  }
}
