import { describe, it, expect } from "vitest";
import { boxUnpaidAlert, BOX_UNPAID_ALERT_DAYS } from "./boxAlert";

const NOW = new Date("2026-09-09T12:00:00");

const box = (over: Record<string, unknown> = {}) => ({
  status: "open",
  totalValueUsd: "50.71",
  deliveryChargeUsd: "0",
  settledUsd: 0,
  settledDiscountUsd: 0,
  createdAt: "2026-09-09T09:00:00",
  ...over,
});

describe("the forgotten-box flag", () => {
  it("a delivered box with money outstanding flags at any age", () => {
    const a = boxUnpaidAlert(box({ status: "delivered" }), NOW);
    expect(a?.kind).toBe("handed_unpaid");
    expect(a?.outstandingUsd).toBe(50.71);
  });

  it("an open box flags only after the normal cycle has passed", () => {
    expect(boxUnpaidAlert(box({ createdAt: "2026-09-07T09:00:00" }), NOW)).toBeNull();
    const late = boxUnpaidAlert(box({ createdAt: "2026-09-01T09:00:00" }), NOW);
    expect(late?.kind).toBe("aging_unpaid");
    expect(late!.days).toBeGreaterThan(BOX_UNPAID_ALERT_DAYS);
  });

  it("paid, discounted or cancelled boxes never flag", () => {
    expect(boxUnpaidAlert(box({ status: "delivered", settledUsd: 50.71 }), NOW)).toBeNull();
    expect(boxUnpaidAlert(box({ status: "delivered", settledUsd: 40, settledDiscountUsd: 10.71 }), NOW)).toBeNull();
    expect(boxUnpaidAlert(box({ status: "cancelled", createdAt: "2026-01-01" }), NOW)).toBeNull();
  });

  it("the courier's delivery fee is not money owed to us, for now", () => {
    // Owner, 2026-09-10 — see shared/deliveryFee.ts. The day that switch is
    // turned back on, this expects the fee to be owed again.
    const a = boxUnpaidAlert(box({ status: "delivered", totalValueUsd: "0", deliveryChargeUsd: "5.00" }), NOW);
    expect(a).toBeNull();
    const withGoods = boxUnpaidAlert(box({ status: "delivered", deliveryChargeUsd: "3.50" }), NOW);
    expect(withGoods?.outstandingUsd).toBe(50.71);
  });
});
