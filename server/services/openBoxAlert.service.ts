import { notifyStaffAlert } from "../_core/notifyStaff";
import * as db from "../db";
import { appLogger } from "../utils/logger";

/**
 * Reminds the office about delivery boxes that left but were never closed.
 *
 * A box is closed when the goods reach the customer. If one has been out for
 * days with nothing recorded, either it was delivered and nobody wrote it
 * down, or it genuinely has not arrived — and both are worth knowing.
 *
 * Deliberately narrow, because an alert that is usually wrong gets ignored,
 * and an ignored alert is worse than none:
 *
 *  - only boxes that have actually left (`ready` or `in_transit`). A box still
 *    being packed is not late, it is being packed.
 *  - nothing the customer has already confirmed. Their word is the answer the
 *    reminder was asking for.
 *  - two steps and then silence. Repeating the same line every six hours
 *    trains people to scroll past it.
 */

const FIRST_REMINDER_DAYS = 5;
const SECOND_REMINDER_DAYS = 10;
/** Past this, the box has a bigger problem than a reminder can solve. */
const GIVE_UP_DAYS = 20;

interface StaleBox {
  boxCode: string;
  customerCode: string | null;
  daysOpen: number;
}

/** Whole days between a date and now; negative clamps to 0. */
export function daysSince(date: Date | string | null | undefined, now: Date): number {
  if (!date) return 0;
  const then = new Date(date);
  if (isNaN(then.getTime())) return 0;
  const days = Math.floor((now.getTime() - then.getTime()) / 86_400_000);
  return days > 0 ? days : 0;
}

/**
 * Which boxes deserve a reminder, and at which step.
 *
 * Pure, so the rule can be tested without a database — it is the part that
 * decides whether the office is helped or nagged.
 */
export function selectStaleBoxes<T extends {
  status: string;
  customerConfirmedAt?: Date | string | null;
  inTransitAt?: Date | string | null;
  sealedAt?: Date | string | null;
  createdAt?: Date | string | null;
}>(boxes: T[], now: Date): { box: T; daysOpen: number; step: "first" | "second" }[] {
  const out: { box: T; daysOpen: number; step: "first" | "second" }[] = [];

  for (const box of boxes) {
    // Still being packed, or already closed — nothing to chase.
    if (box.status !== "ready" && box.status !== "in_transit") continue;
    // The customer already answered the question.
    if (box.customerConfirmedAt) continue;

    // Count from when it left, not from when it was created: a box can sit
    // half-packed for a week without anything being late.
    const since = box.inTransitAt || box.sealedAt || box.createdAt;
    const daysOpen = daysSince(since, now);

    if (daysOpen >= GIVE_UP_DAYS) continue;
    if (daysOpen >= SECOND_REMINDER_DAYS) out.push({ box, daysOpen, step: "second" });
    else if (daysOpen >= FIRST_REMINDER_DAYS) out.push({ box, daysOpen, step: "first" });
  }

  return out;
}

/** Build the message. Separated so its wording can be checked in a test. */
export function buildReminderMessage(
  first: StaleBox[],
  second: StaleBox[],
): { title: string; content: string } {
  let content = "";

  if (second.length > 0) {
    content += `🔴 **زیاتر لە ${SECOND_REMINDER_DAYS} ڕۆژ**: ${second.length} بۆکس\n`;
    for (const b of second.slice(0, 5)) {
      content += `  • ${b.boxCode}${b.customerCode ? ` — ${b.customerCode}` : ""} (${b.daysOpen} ڕۆژ)\n`;
    }
    if (second.length > 5) content += `  • … و ${second.length - 5} بۆکسی تر\n`;
    content += "\n";
  }

  if (first.length > 0) {
    content += `🟡 **زیاتر لە ${FIRST_REMINDER_DAYS} ڕۆژ**: ${first.length} بۆکس\n`;
    for (const b of first.slice(0, 5)) {
      content += `  • ${b.boxCode}${b.customerCode ? ` — ${b.customerCode}` : ""} (${b.daysOpen} ڕۆژ)\n`;
    }
    if (first.length > 5) content += `  • … و ${first.length - 5} بۆکسی تر\n`;
    content += "\n";
  }

  content += "تکایە ئەگەر بۆکسەکە گەیشتووەتە دەست کڕیار، لە سیستەم دایبخە.";

  return { title: "بۆکسی داخنەکراو", content };
}

export async function checkAndNotifyOpenBoxes(): Promise<void> {
  try {
    // Returns a page, not a bare array.
    const { boxes } = await db.getAllDeliveryBoxes({});
    if (!boxes || boxes.length === 0) return;

    const stale = selectStaleBoxes(boxes as any[], new Date());
    if (stale.length === 0) {
      appLogger.info("[Open Boxes] No boxes needing a reminder");
      return;
    }

    const toStale = async (entry: { box: any; daysOpen: number }): Promise<StaleBox> => {
      let customerCode: string | null = null;
      try {
        const customer = await db.getCustomerById(entry.box.customerId);
        customerCode = customer?.customerCode ?? null;
      } catch {
        // A missing customer must not stop the rest of the reminder.
      }
      return { boxCode: entry.box.boxCode, customerCode, daysOpen: entry.daysOpen };
    };

    const first = await Promise.all(stale.filter(s => s.step === "first").map(toStale));
    const second = await Promise.all(stale.filter(s => s.step === "second").map(toStale));

    const { title, content } = buildReminderMessage(first, second);
    await notifyStaffAlert({
      action: "open_box_reminder",
      category: "delivery",
      severity: "warning",
      title,
      content,
    });

    appLogger.info("[Open Boxes] Reminder sent", { first: first.length, second: second.length });
  } catch (error) {
    appLogger.error("[Open Boxes] Check failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

let openBoxInterval: NodeJS.Timeout | null = null;

export async function scheduleOpenBoxAlerts(): Promise<void> {
  if (openBoxInterval) {
    clearInterval(openBoxInterval);
    openBoxInterval = null;
  }

  // Once a day. The thresholds are counted in days, so checking more often
  // would only repeat the same message.
  openBoxInterval = setInterval(() => {
    checkAndNotifyOpenBoxes().catch(error =>
      appLogger.error("[Open Boxes] Scheduled check failed", {
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  }, 24 * 60 * 60 * 1000);

  await checkAndNotifyOpenBoxes();
}

export function stopOpenBoxAlerts(): void {
  if (openBoxInterval) {
    clearInterval(openBoxInterval);
    openBoxInterval = null;
  }
}
