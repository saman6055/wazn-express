import { and, desc, eq, gt, gte, lte, sql } from "drizzle-orm";
import { getDb } from "./connection";
import { customerAccounts, deliveryBoxes } from "../../drizzle/schema";
import { customers } from "../../drizzle/schema/users.schema";
import { REMIND_AFTER_DAYS, daysSince, gentleReminder, officeShouldLook } from "@shared/boxReminder";
import { withFix } from "@shared/fixAdvice";
import { getBoxSettlementView } from "./boxSettlement.db";
import { createCustomerNotification } from "./portal.db";
import { cacheGetOrSet, cacheInvalidate } from "./cache";

const DAY_MS = 86_400_000;
/** Older hand-overs were settled by hand long ago; asking about them would bury the real ones. */
const LOOK_BACK_DAYS = 90;
const LOOKUP_CAP = 80;

const DUE_COUNT_KEY = "boxes:awaiting-office";

/**
 * How many are the office's turn — for the bell, which asks often. Kept five
 * minutes: each box is asked its balance by the payment screen's own sums,
 * and that is not something to redo on every poll.
 */
export async function countBoxesAwaitingOffice(): Promise<number> {
  return cacheGetOrSet(DUE_COUNT_KEY, 5 * 60_000, async () => (await listBoxesAwaitingPayment()).filter((b) => b.due).length);
}

export interface BoxAwaitingPayment {
  boxId: number;
  boxCode: string;
  customerId: number;
  customerCode: string | null;
  customerName: string | null;
  outstandingUsd: number;
  deliveredAt: Date | null;
  daysHanded: number;
  unpaidConfirmedAt: Date | null;
  reminderCount: number;
  /** True when it is the office's turn to look (shared/boxReminder officeShouldLook). */
  due: boolean;
}

/**
 * Boxes in a customer's hands for three days or more with money still owed.
 *
 * "Owed" is what the box's own payment screen says (getBoxSettlementView),
 * and never more than the customer's account still owes — a debt settled by
 * hand leaves the parcels reading unpaid while the account reads zero, and a
 * reminder for that would be for money already in the till.
 */
export async function listBoxesAwaitingPayment(now: Date = new Date()): Promise<BoxAwaitingPayment[]> {
  const db = await getDb();
  if (!db) return [];
  const handed = sql`COALESCE(${deliveryBoxes.deliveredAt}, ${deliveryBoxes.updatedAt})`;
  const rows = await db
    .select({
      boxId: deliveryBoxes.id,
      boxCode: deliveryBoxes.boxCode,
      customerId: deliveryBoxes.customerId,
      deliveredAt: sql<Date | null>`${handed}`,
      unpaidConfirmedAt: deliveryBoxes.unpaidConfirmedAt,
      reminderCount: deliveryBoxes.paymentReminderCount,
      customerCode: customers.customerCode,
      customerName: customers.fullName,
      balanceUsd: customerAccounts.currentBalanceUsd,
    })
    .from(deliveryBoxes)
    .innerJoin(customerAccounts, eq(customerAccounts.customerId, deliveryBoxes.customerId))
    .leftJoin(customers, eq(customers.id, deliveryBoxes.customerId))
    .where(and(
      eq(deliveryBoxes.status, "delivered"),
      gt(customerAccounts.currentBalanceUsd, "0"),
      lte(handed, new Date(now.getTime() - REMIND_AFTER_DAYS * DAY_MS)),
      gte(handed, new Date(now.getTime() - LOOK_BACK_DAYS * DAY_MS)),
    ))
    .orderBy(desc(handed))
    .limit(LOOKUP_CAP);

  const out: BoxAwaitingPayment[] = [];
  for (const r of rows) {
    const view = await getBoxSettlementView(Number(r.boxId));
    const owedOnBox = view.parcels.reduce((sum, p) => sum + Math.max(0, Number(p.outstandingUsd) || 0), 0);
    const outstandingUsd = Math.round(Math.min(owedOnBox, Number(r.balanceUsd) || 0) * 100) / 100;
    if (outstandingUsd <= 0.005) continue;
    const deliveredAt = r.deliveredAt ? new Date(r.deliveredAt) : null;
    out.push({
      boxId: Number(r.boxId),
      boxCode: r.boxCode,
      customerId: Number(r.customerId),
      customerCode: r.customerCode ?? null,
      customerName: r.customerName ?? null,
      outstandingUsd,
      deliveredAt,
      daysHanded: daysSince(deliveredAt, now) ?? 0,
      unpaidConfirmedAt: r.unpaidConfirmedAt ?? null,
      reminderCount: Number(r.reminderCount) || 0,
      due: officeShouldLook({ deliveredAt, unpaidConfirmedAt: r.unpaidConfirmedAt ?? null, outstandingUsd }, now),
    });
  }
  return out.sort((a, b) => Number(b.due) - Number(a.due) || b.outstandingUsd - a.outstandingUsd);
}

/**
 * An admin says "no, this box has not been paid". Checked again here — the
 * list may be minutes old and the money may have been receipted since — and
 * only then is the customer sent the gentle line and the box stamped.
 */
export async function confirmBoxUnpaid(boxId: number, userId: number): Promise<{ outstandingUsd: number; reminderCount: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const now = new Date();
  const box = (await listBoxesAwaitingPayment(now)).find((b) => b.boxId === boxId);
  if (!box) {
    throw new Error(withFix("ئەم بۆکسە ئیتر پارەی لەسەر نەماوە، یان هێشتا 3 ڕۆژی تێنەپەڕیوە.", ["پەڕەکە نوێ بکەوە", "ئەگەر پارەکەی دراوە هیچ کارێک پێویست نییە"]));
  }
  if (!box.due) {
    throw new Error(withFix(`ئەم کڕیارە پێشتر وەبیر هێنراوەتەوە. هەر ${REMIND_AFTER_DAYS} ڕۆژ جارێک دەکرێت.`, [`${REMIND_AFTER_DAYS} ڕۆژ دوای دوا وەبیرهێنانەوە دووبارە هەوڵ بدە`]));
  }

  const words = gentleReminder(box.customerName ?? box.customerCode ?? "", box.boxCode, box.outstandingUsd);
  await createCustomerNotification({
    customerId: box.customerId,
    type: "payment",
    title: words.title.ku,
    titleKu: words.title.ku,
    titleAr: words.title.ar,
    message: words.message.ku,
    messageKu: words.message.ku,
    messageAr: words.message.ar,
  });
  await db
    .update(deliveryBoxes)
    .set({ unpaidConfirmedAt: now, unpaidConfirmedById: userId, paymentReminderCount: sql`${deliveryBoxes.paymentReminderCount} + 1` })
    .where(eq(deliveryBoxes.id, boxId));
  cacheInvalidate([DUE_COUNT_KEY]);
  return { outstandingUsd: box.outstandingUsd, reminderCount: box.reminderCount + 1 };
}
