import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { doubleChargeReason, falseDebt, planCorrection, twiceCharged, type DoubleChargeLine } from "./boxPaidStillOwed";
import { buildRiskItems, riskPath, type RiskFacts } from "./riskBell";

/**
 * A receipted box is settled (owner, 2026-10-08, after AZ088 was shown owing
 * $762.07 for a box she had paid in full): "the box is the touchstone, the
 * only place money comes back. Whoever had a box receipted must not, in any
 * way, owe for that box and its trackings. A mistake like this is not
 * acceptable."
 *
 * What would undo it: the till writing an order's goods on the account a
 * second time, the check going quiet, a correction that touches a payment or
 * leaves a credit, or anyone but the main admin making it.
 */

const root = (p: string) => fs.readFileSync(path.resolve(__dirname, "..", p), "utf8").replace(/\r\n/g, "\n");

// AZ088 as it stood on 8 October 2026.
const NOOR: DoubleChargeLine[] = [
  {
    trackingNumber: "79019153879390", boxCode: "BOX-20260823-003", boxChargeId: 6229, boxChargeUsd: 734.26, boxChargedAt: "2026-09-10",
    orderCharges: [{ id: 4491, usd: 435.5, description: "goods", orderCode: "CM-MRM1ARS5" }, { id: 4659, usd: 298.76, description: "freight", orderCode: "CM-MRM1ARS5" }],
    orderChargedUsd: 734.26, twiceUsd: 734.26,
  },
  {
    trackingNumber: "79017826959196", boxCode: "BOX-20260823-003", boxChargeId: 6230, boxChargeUsd: 27.81, boxChargedAt: "2026-09-10",
    orderCharges: [{ id: 4301, usd: 20, description: "goods", orderCode: "CM-MRM1D29O" }, { id: 4302, usd: 7.81, description: "freight", orderCode: "CM-MRM1D29O" }],
    orderChargedUsd: 27.81, twiceUsd: 27.81,
  },
  {
    trackingNumber: "79017799893573", boxCode: "BOX-20260823-003", boxChargeId: 6231, boxChargeUsd: 81.14, boxChargedAt: "2026-09-10",
    orderCharges: [{ id: 4101, usd: 74, description: "goods", orderCode: "CM-MRM1F5IR" }, { id: 4102, usd: 7.14, description: "freight", orderCode: "CM-MRM1F5IR" }],
    orderChargedUsd: 81.14, twiceUsd: 81.14,
  },
];

describe("what was written twice", () => {
  it("is the smaller side, and nothing when either side is nothing", () => {
    expect(twiceCharged(734.26, 734.26)).toBe(734.26);
    expect(twiceCharged(50, 30)).toBe(30);
    expect(twiceCharged(50, 0)).toBe(0);
    expect(twiceCharged(0, 50)).toBe(0);
  });

  it("the false debt is never more than what the account actually owes", () => {
    // $843.21 written twice, $81.14 of it already put right by hand: $762.07 is shown and is not owed.
    expect(falseDebt(843.21, 762.07)).toBe(762.07);
    // An account already at nothing owes nothing, and nothing is taken off it.
    expect(falseDebt(50, 0)).toBe(0);
    // An account in credit is never pushed further.
    expect(falseDebt(50, -20)).toBe(0);
  });
});

describe("putting AZ088 right", () => {
  const plan = planCorrection({ lines: NOOR, falseDebtUsd: 762.07 });

  it("takes off exactly the false debt — her balance ends at nothing, not in credit", () => {
    expect(Math.round(plan.reduce((s, p) => s + p.removeUsd, 0) * 100) / 100).toBe(762.07);
  });

  it("by the order-side rows, the box's own charge and its receipt left alone", () => {
    expect(plan.map((p) => p.chargeId)).toEqual([4491, 4659, 4301, 4302]);
    for (const id of [6229, 6230, 6231]) expect(plan.map((p) => p.chargeId)).not.toContain(id);
    expect(plan.every((p) => p.whole)).toBe(true);
  });

  it("a row is taken in part when only part of it is false debt", () => {
    const part = planCorrection({ lines: [{ ...NOOR[1], orderCharges: [{ id: 1, usd: 50, description: "", orderCode: null }], orderChargedUsd: 50, boxChargeUsd: 50, twiceUsd: 50 }], falseDebtUsd: 20 });
    expect(part).toEqual([{ chargeId: 1, removeUsd: 20, whole: false, trackingNumber: "79017826959196", boxCode: "BOX-20260823-003" }]);
  });

  it("never more from one tracking than was written twice on it", () => {
    const one = planCorrection({ lines: [{ ...NOOR[1], orderCharges: [{ id: 1, usd: 80, description: "", orderCode: null }], orderChargedUsd: 80, boxChargeUsd: 30, twiceUsd: 30 }], falseDebtUsd: 500 });
    expect(one[0].removeUsd).toBe(30);
  });

  it("says why, on the account, with the box and the tracking", () => {
    const why = doubleChargeReason("79019153879390", "BOX-20260823-003");
    expect(why).toContain("BOX-20260823-003");
    expect(why).toContain("79019153879390");
    expect(why).toContain("واسڵ");
  });
});

describe("the correction touches only what it should", () => {
  const db = root("server/db/boxPaidStillOwed.db.ts");
  const fix = db.slice(db.indexOf("export async function correctBoxDoubleCharge"));

  it("uses the ledger's own corrections, so each row is marked and never found twice", () => {
    expect(fix).toContain("reverseCharge(step.chargeId, why, userId)");
    expect(fix).toContain("adjustCharge(step.chargeId");
  });

  it("writes no payment, no manual credit and no new charge", () => {
    for (const forbidden of ["recordPaymentReceived", "adjustCustomerBalance", "paymentRecords", "allowCredit: true", "db.insert("]) {
      expect(db, forbidden).not.toContain(forbidden);
    }
  });

  it("is the main admin's, and is checked again before anything is taken off", () => {
    expect(root("server/routers/finance.router.ts")).toContain("correctBoxDoubleCharge: superAdminProcedure");
    expect(fix.indexOf("findBoxDoubleCharges(customerId)")).toBeLessThan(fix.indexOf("reverseCharge(step.chargeId"));
  });
});

describe("it cannot happen again, and cannot stay hidden", () => {
  it("the till never writes an order's goods at the box: an order carton is not in what it charges", () => {
    const till = root("server/db/boxSettlement.db.ts");
    expect(till).toContain("const toCharge = parcels.filter((p) => p.packageId !== null && !p.fromOrder && p.notChargedYet && settling(p));");
  });

  it("every receipt asks the question again at once", () => {
    const router = root("server/routers/scanning.router.ts");
    const made = router.indexOf("await db.createBoxSettlement(");
    expect(made).toBeGreaterThan(-1);
    const after = router.slice(made, made + 900);
    expect(after).toContain("db.boxReceiptWritten();");
  });

  it("a customer shown owing for a paid box is the bell's most serious kind", () => {
    const NONE: RiskFacts = { staleDepotDays: [], volumetric: [], debtOverLimit: 0, ordersWithoutTracking: 0, unclaimed: 0, emptyBoxes: 0 };
    expect(buildRiskItems({ ...NONE, boxPaidOwed: 3 })).toEqual([{ id: "box-paid-owed", level: "critical", count: 3 }]);
    expect(riskPath("box-paid-owed")).toBe("/finance/box-double-charges");
    expect(root("server/db/reports.db.ts")).toContain("countBoxDoubleCharges()");
  });

  it("the page shows the proof beside each customer before anything is changed", () => {
    const page = root("client/src/pages/BoxDoubleCharges.tsx");
    expect(page).toContain('data-testid="double-charge-proof"');
    expect(page).toContain('data-testid="double-charge-confirm"');
    expect(root("client/src/App.tsx")).toContain('path="/finance/box-double-charges"');
  });
});
