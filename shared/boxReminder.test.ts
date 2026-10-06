import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { REMIND_AFTER_DAYS, daysSince, gentleReminder, officeShouldLook } from "./boxReminder";
import { buildRiskItems, riskGroup, riskPath, type RiskFacts } from "./riskBell";

/**
 * A box handed over and unpaid: the office is asked first, the customer only
 * after an admin says "not paid" (owner, 2026-10-06 and 07).
 *
 * What would undo it: a reminder that goes out on the system's own say-so, a
 * reminder for goods still travelling, a reminder for a debt already settled
 * by hand, or wording that presses instead of asking.
 */

const root = (p: string) => fs.readFileSync(path.resolve(__dirname, "..", p), "utf8").replace(/\r\n/g, "\n");
const NOW = new Date("2026-10-07T09:00:00Z");
const ago = (days: number) => new Date(NOW.getTime() - days * 86_400_000);

describe("when the office is asked", () => {
  it("three days after the hand-over, with money still owed", () => {
    expect(REMIND_AFTER_DAYS).toBe(3);
    expect(officeShouldLook({ deliveredAt: ago(3), unpaidConfirmedAt: null, outstandingUsd: 45 }, NOW)).toBe(true);
    expect(officeShouldLook({ deliveredAt: ago(2), unpaidConfirmedAt: null, outstandingUsd: 45 }, NOW)).toBe(false);
  });

  it("never for a box that owes nothing, or was never handed over", () => {
    expect(officeShouldLook({ deliveredAt: ago(30), unpaidConfirmedAt: null, outstandingUsd: 0 }, NOW)).toBe(false);
    expect(officeShouldLook({ deliveredAt: null, unpaidConfirmedAt: null, outstandingUsd: 45 }, NOW)).toBe(false);
  });

  it("again three days after the last confirmation, not before", () => {
    expect(officeShouldLook({ deliveredAt: ago(10), unpaidConfirmedAt: ago(1), outstandingUsd: 45 }, NOW)).toBe(false);
    expect(officeShouldLook({ deliveredAt: ago(10), unpaidConfirmedAt: ago(3), outstandingUsd: 45 }, NOW)).toBe(true);
  });

  it("counts whole days", () => {
    expect(daysSince(ago(3), NOW)).toBe(3);
    expect(daysSince(null, NOW)).toBeNull();
  });
});

describe("what the customer reads", () => {
  const words = gentleReminder("چێوار", "BX-12", 45);

  it("greets by name, says the amount and the box, and thanks", () => {
    expect(words.message.ku.startsWith("سڵاو بەڕێز چێوار")).toBe(true);
    expect(words.message.ku).toContain("$45.00");
    expect(words.message.ku).toContain("BX-12");
    expect(words.message.ku).toContain("سوپاس");
  });

  it("asks, never presses: no debt, no lateness, no limit, no date", () => {
    for (const text of [words.title.ku, words.message.ku, words.title.en, words.message.en]) {
      expect(text).not.toMatch(/قەرز|دواکەوت|سنوور|overdue|late|debt|limit|deadline/i);
    }
  });
});

describe("nothing reaches the customer on the system's own say-so", () => {
  const db = root("server/db/boxReminder.db.ts");
  const list = db.slice(db.indexOf("export async function listBoxesAwaitingPayment"), db.indexOf("export async function confirmBoxUnpaid"));
  const confirm = db.slice(db.indexOf("export async function confirmBoxUnpaid"));

  it("listing and counting send nothing", () => {
    expect(list.length).toBeGreaterThan(800);
    expect(list).not.toContain("createCustomerNotification");
    expect(db.slice(0, db.indexOf("export async function listBoxesAwaitingPayment"))).not.toContain("createCustomerNotification(");
  });

  it("only an admin's confirmation does, after the box is checked again", () => {
    expect(confirm).toContain("createCustomerNotification(");
    expect(confirm.indexOf("listBoxesAwaitingPayment(")).toBeLessThan(confirm.indexOf("createCustomerNotification("));
    expect(confirm).toContain("if (!box.due)");
  });

  it("only boxes in the customer's hands, and never more than the account still owes", () => {
    expect(list).toContain('eq(deliveryBoxes.status, "delivered")');
    expect(list).toContain('gt(customerAccounts.currentBalanceUsd, "0")');
    expect(list).toContain("Math.min(owedOnBox, Number(r.balanceUsd) || 0)");
  });

  it("no job sends reminders by itself", () => {
    const callers = ["server/_core/index.ts", "server/db/reports.db.ts", "server/db/financePulse.db.ts"].map(root).join("\n");
    expect(callers).not.toContain("confirmBoxUnpaid");
  });
});

describe("the office is told", () => {
  const NONE: RiskFacts = { staleDepotDays: [], volumetric: [], debtOverLimit: 0, ordersWithoutTracking: 0, unclaimed: 0, emptyBoxes: 0 };

  it("in the bell, with a click to the list", () => {
    const items = buildRiskItems({ ...NONE, boxesUnpaid: 4 });
    expect(items).toEqual([{ id: "boxes-unpaid", level: "high", count: 4 }]);
    expect(riskGroup("boxes-unpaid")).toBe("incomplete");
    expect(riskPath("boxes-unpaid")).toBe("/customer-delivery-scanner?unpaid=1");
  });

  it("on the boxes page, with both answers on every box", () => {
    const page = root("client/src/pages/CustomerDeliveryScanner.tsx");
    const alert = root("client/src/components/delivery/UnpaidBoxes.tsx");
    expect(page).toContain("<UnpaidBoxesAlert />");
    expect(alert).toContain('get("unpaid") === "1"');
    expect(alert).toContain("/customer-delivery-scanner?box=${r.boxId}");
    expect(alert).toContain("confirm.mutate({ boxId: r.boxId })");
  });
});
