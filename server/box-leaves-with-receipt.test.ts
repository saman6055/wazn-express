/**
 * Owner, 2026-10-24 (AZ018 Kara's clothes box): a box that went out with
 * nothing written left the customer's advance looking unspent. Three guards:
 * a box never leaves without a receipt; the advance names the box it waits
 * on; the bell says when it has waited too long.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { buildRiskItems, RISK_PATH, RISK_GATE } from "@shared/riskBell";

const read = (p: string) => readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const slice = (src: string, start: string, end: string) => {
  const a = src.indexOf(start);
  expect(a, `marker not found: ${start}`).toBeGreaterThan(-1);
  const b = src.indexOf(end, a + start.length);
  expect(b, `end marker not found: ${end}`).toBeGreaterThan(-1);
  return src.slice(a, b);
};

describe("a box never leaves without a receipt", () => {
  const router = read("server/routers/scanning.router.ts");
  for (const [route, write] of [
    ["  markInTransit: staffProcedure", "await db.markBoxInTransit(box.id"],
    ["  markDelivered: staffProcedure", "return db.markBoxDelivered(box.id"],
  ] as const) {
    it(`${route.trim()} asks for one before it moves the box`, () => {
      const body = slice(router, route, write);
      expect(body).toContain("(await db.liveReceiptsOfBox(box.id)).length === 0");
      expect(body).toContain("db.noReceiptRefusal(box.boxCode)");
    });
  }

  it("the refusal says both ways out: the money taken, or 0 as debt", () => {
    const fn = slice(read("server/db/deliveryBoxes.db.ts"), "export function noReceiptRefusal(", "\n}\n");
    expect(fn).toContain("«قەرز لەسەر کڕیار»");
    expect(fn).toContain("withFix(");
  });
});

describe("the advance names its box, and the bell watches it", () => {
  it("the finance card shows the box the advance waits on", () => {
    expect(read("server/db/boxPaidStillOwed.db.ts")).toContain("forBox: explained.advanceUsd > 0.005 ? await oldestUnreceiptedBox(customerId) : null");
    expect(read("client/src/components/customers/CustomerDebtExplained.tsx")).toContain('data-testid="advance-for-box"');
  });

  it("a waiting advance rings, high, and opens the unpaid boxes", () => {
    const items = buildRiskItems({ staleDepotDays: [], volumetric: [], debtOverLimit: 0, ordersWithoutTracking: 0, unclaimed: 0, emptyBoxes: 0, advanceWaiting: 2 });
    expect(items.find((i) => i.id === "advance-waiting")).toMatchObject({ level: "high", count: 2 });
    expect(RISK_PATH["advance-waiting"]).toBe("/customer-delivery-scanner?unpaid=1");
    expect(RISK_GATE["advance-waiting"]).toBe("/customer-delivery-scanner");
    expect(read("server/db/reports.db.ts")).toContain("countAdvanceWaiting()");
  });
});
