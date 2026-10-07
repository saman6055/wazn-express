import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { doubleChargeReason, falseDebt, planCorrection, stillOwed, twiceCharged, type AccountRow, type DoubleChargeLine, type SettledFacts } from "./boxPaidStillOwed";
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

describe("a box made again is the same goods", () => {
  // Owner, 2026-10-08: "sometimes a box is made, deleted, and made again for
  // the very same things — the system must not count them twice."
  const till = root("server/db/boxSettlement.db.ts");

  it("what a receipt paid for a parcel counts wherever that parcel is boxed now", () => {
    expect(till).toContain("const paidElsewhereByPackage = new Map<number, number>();");
    expect(till).toContain("const paidElsewhereByOrder = new Map<number, number>();");
    expect(till).toContain("inArray(boxSettlementLines.packageId, pkgIdsHere)");
  });

  it("only from receipts that still stand, and never this box's own lines twice", () => {
    const from = till.indexOf("const paidElsewhere = ");
    const block = till.slice(from, till.indexOf("const paidElsewhereByPackage"));
    expect(block.length).toBeGreaterThan(400);
    expect(block).toContain('eq(boxSettlements.status, "confirmed")');
    expect(block).toContain("NOT IN (");
  });

  it("an old receipt never becomes a credit on the new box", () => {
    expect(till).toContain("Math.min(elsewhereUsd, Math.max(0, round2(chargedUsd - discountedUsd - settledHereUsd)))");
  });
});

describe("a correction never goes below what is really still owed", () => {
  // Owner, 2026-10-08, on the nine debtors: "Zainab has boxes not receipted
  // yet — check twice." Her double lines came to $11,493 on a balance of
  // $4,471; "never more than the balance" would have wiped two open boxes and
  // the goods on the road with them.
  const row = (id: number, type: string, usd: number, description: string, referenceId: number | null = null, balanceAfterUsd = 1): AccountRow =>
    ({ id, transactionNumber: `T${id}`, transactionType: type, amountUsd: usd, balanceAfterUsd, description, referenceId });
  const facts = (over: Partial<SettledFacts> = {}): SettledFacts => ({
    receiptedBoxCodes: new Set(["BOX-20260901-001"]),
    receiptedPackageIds: new Set([50]),
    receiptedOrderIds: new Set(),
    receiptedTrackings: new Set(["yt100"]),
    orders: [
      { id: 1, chargeTransactionId: 10, trackings: ["YT100"] }, // in the receipted box, typed in capitals on the order
      { id: 2, chargeTransactionId: 12, trackings: ["sf200"] }, // still on the road
    ],
    isOrderText: (d) => d.includes("CM-"),
    ...over,
  });

  it("goods in a receipted box are settled; goods on the road are owed", () => {
    const rows = [
      row(10, "DEBIT_COMMISSION", 100, "CM-AAAAA1", 1),
      row(11, "DEBIT_PACKAGE", 20, "CM-AAAAA1 freight", 1),
      row(12, "DEBIT_COMMISSION", 300, "CM-BBBBB2", 2),
      row(13, "DEBIT_PACKAGE", 120, "BOX-20260901-001 — yt100", 50),
      row(14, "CREDIT_PAYMENT", 120, "BOX-20260901-001"),
    ];
    expect(stillOwed(rows, facts())).toBe(300);
    // $120 was written twice, the balance is $420: exactly $120 comes off, the $300 on the road stays.
    expect(falseDebt(120, 420, 300)).toBe(120);
  });

  it("more written twice than is owed: only the part above what is still owed comes off", () => {
    expect(falseDebt(11493.1, 4471.33, 2178.03)).toBe(2293.3);
    expect(falseDebt(843.21, 762.07, 0)).toBe(762.07);
    expect(falseDebt(500, 300, 300)).toBe(0);
    expect(falseDebt(500, 300, 900)).toBe(0);
  });

  it("an account put to nothing by hand owes nothing for what stood before", () => {
    const rows = [
      row(1, "DEBIT_COMMISSION", 80, "CM-OLDOLD", 9),
      row(2, "ADJUSTMENT_CREDIT", 80, "[ڕێکخستنی دەستی] حیسابی پێشوو", null, 0),
      row(3, "DEBIT_COMMISSION", 300, "CM-BBBBB2", 2),
    ];
    expect(stillOwed(rows, facts())).toBe(300);
  });

  it("a charge already taken back does not count, and a parcel in a receipted box is paid", () => {
    const rows = [
      row(1, "DEBIT_COMMISSION", 300, "CM-BBBBB2", 2),
      row(2, "ADJUSTMENT_CREDIT", 300, "back [REV:T1]"),
      row(3, "DEBIT_PACKAGE", 15, "parcel", 50),
      row(4, "DEBIT_PACKAGE", 9, "parcel", 51),
      row(5, "DEBIT_PACKAGE", 4.5, "نرخی گەیاندنی بۆکس BOX-20260901-001", 0),
    ];
    expect(stillOwed(rows, facts())).toBe(9);
  });

  it("money taken without a box receipt pays the open goods first", () => {
    const rows = [row(1, "DEBIT_COMMISSION", 300, "CM-BBBBB2", 2), row(2, "CREDIT_PAYMENT", 100, "Payment received")];
    expect(stillOwed(rows, facts())).toBe(200);
  });

  it("the finder weighs every customer by it, and matches a tracking whatever its case", () => {
    const db = root("server/db/boxPaidStillOwed.db.ts");
    expect(db).toContain("falseDebt(twiceUsd, balanceUsd, stillOwedUsd)");
    expect(db).toContain("trackingKey(o.tracking) === trackingKey(tracking)");
    expect(db).toContain('eq(boxSettlements.status, "confirmed")');
  });
});
