import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8").replace(/\r\n/g, "\n");

/**
 * The last registration, corrected in place (owner, 2026-10-05).
 *
 * «ئەگەر هەڵەت لە کێش یا قیاس یا لە شتێ کرد، ڕیتێرنی دوایین تۆمار هەبێ … بەس
 * دەقیق بێت» — the same parcel, the same code, and on the account only the
 * difference.
 *
 * Proved on a real MySQL through the shipping procedures (register, then
 * correctLastRegistration), at $11/kg:
 *
 *   15 kg typed for 1.5      charged 165.00 → one row of −148.50 → 16.50;
 *                            invoice total, its line and the revenue record
 *                            all read 16.50; the parcel kept its code
 *   corrected again to 2     one row of +5.50 → 22.00 (its own difference)
 *   saved with no change     nothing written
 *   description only         nothing written, the text saved
 *   wrong customer           −22.00 off the first account (back to 0.00),
 *                            22.00 onto the right one; old invoice cancelled
 *   made ownerless           the charge off whole, no price, uncharged
 *   no weight, then 4 kg     charged 44.00 by the batch's own rule
 *   customer already paid    refused whole for staff — the weight did not
 *                            change either; the main admin is asked
 *   an order's carton        price restated, no ledger row of its own, its
 *                            owner cannot be changed
 *   already in a box         refused, naming the box
 *   one invoice, two parcels the total stayed BOTH parcels (11 + 11 = 22),
 *                            the other parcel's line untouched
 *
 * These guards keep the shape that made those figures come out.
 */
describe("one parcel's charge is worked out in one place", () => {
  const charging = read("server/db/batchCharging.db.ts");

  it("the batch charge and a correction ask the same line", () => {
    const start = charging.indexOf("export function parcelShippingCharge(");
    expect(start).toBeGreaterThan(-1);
    const body = charging.slice(start, charging.indexOf("\n}\n", start));
    expect(body).toContain("chargeableWeight(pkg, divisor).chargeableKg");
    expect(body).toContain("Math.round(quantity * rate * 100) / 100");

    const engineStart = charging.indexOf("export async function chargeBatchShippingIfDue(");
    expect(engineStart).toBeGreaterThan(-1);
    const engine = charging.slice(engineStart);
    expect(engine).toContain("parcelShippingCharge(pkg, isSea, rate, divisor)");
    // The arithmetic is not written out a second time in the engine.
    expect(engine).not.toContain("quantity * rate * 100");
  });

  it("what is due is asked through the gates the charge itself passes", () => {
    const start = charging.indexOf("export async function shippingChargeDueNow(");
    expect(start).toBeGreaterThan(-1);
    const due = charging.slice(start, charging.indexOf("export async function chargeBatchShippingIfDue("));
    expect(due).toContain("batchChargesOnPricing(batch)");
    expect(due).toContain("isSelfOrder({");
    expect(due).toContain("getBatchRateForCustomer(pkg.batchId, pkg.customerId!, { unit })");
    expect(due).toContain("parcelShippingCharge(pkg, isSea, rate, divisor)");
    // Asked, not given: it writes nothing.
    expect(due).not.toMatch(/\.(insert|update|delete)\(/);
  });

  it("the invoice line is written by one function, for the charge and for its correction", () => {
    expect(charging).toContain("export function parcelInvoiceLine(");
    expect(charging).toContain("parcelInvoiceLine(p.pkg.trackingNumber || p.pkg.packageCode, isSea, rate, p.quantity, p.amount)");
    expect(read("server/db/parcelCorrection.db.ts")).toContain("parcelInvoiceLine(name, due.unit === \"cbm\", due.rate, due.quantity, due.amount)");
  });
});

describe("the correction moves the row and the account together", () => {
  const src = read("server/db/parcelCorrection.db.ts");
  const start = src.indexOf("export async function applyParcelCorrection(");
  const fn = src.slice(start);
  const txStart = fn.indexOf("await db.transaction(async (tx) => {");
  const tx = fn.slice(txStart, fn.indexOf("// The day's running revenue total"));

  it("the markers are there", () => {
    expect(start).toBeGreaterThan(-1);
    expect(txStart).toBeGreaterThan(-1);
    expect(tx.length).toBeGreaterThan(500);
  });

  it("decides no price of its own", () => {
    expect(fn).toContain("const due = await shippingChargeDueNow({");
    // No rate is multiplied in this file: the figure comes from the line
    // that posts charges.
    expect(src).not.toMatch(/\*\s*rate\b/);
    expect(src).not.toContain("chargeableWeight(");
  });

  it("refuses a receipted or boxed parcel before anything moves", () => {
    const refusal = fn.indexOf("const refusal = await parcelCorrectionRefusal(packageId, name);");
    expect(refusal).toBeGreaterThan(-1);
    expect(refusal).toBeLessThan(txStart);
    expect(src).toContain("const receipt = await parcelReceipt(packageId);");
    expect(src).toContain(".from(deliveryBoxItems)");
  });

  it("holds the parcel row for the length of the correction", () => {
    expect(tx).toContain('.where(eq(packages.id, packageId)).for("update")');
  });

  it("the same owner: the difference, through adjustCharge", () => {
    const same = tx.slice(tx.indexOf("if (!newOwner && due.due) {"), tx.indexOf("} else {\n        // Not this owner's any more"));
    expect(same.length).toBeGreaterThan(50);
    expect(same).toContain("await adjustCharge(charge.id, due.amount, reason, userId, tx, opts)");
    expect(same).toContain("await invoiceFollows(tx, charge, name, due)");
    expect(same).toContain("await revenueFollows(tx, packageId, due.amount)");
    expect(same).not.toContain("reverseCharge(");
  });

  it("a different owner, or nothing left to charge: off whole, and marked uncharged", () => {
    const other = tx.slice(tx.indexOf("// Not this owner's any more"));
    expect(other).toContain("await reverseCharge(charge.id, reason, userId, tx, opts)");
    expect(other).toContain("released = true;");
    expect(tx).toContain("if (released) set.isCharged = false;");
  });

  it("the row is written inside the same transaction, after the money", () => {
    const row = tx.indexOf("await tx.update(packages).set(set)");
    expect(row).toBeGreaterThan(-1);
    expect(tx.indexOf("await adjustCharge(")).toBeLessThan(row);
    expect(tx.indexOf("await reverseCharge(")).toBeLessThan(row);
  });

  it("will not guess at money that is not where it should be", () => {
    expect(tx).toContain("if (standing.length > 1) {");
    expect(tx).toContain("if (standing.length === 0 && row.isCharged && !orderLinked) {");
  });

  it("reads the parcel's own charges by the rule deletion reads them with", () => {
    expect(tx).toContain("await parcelOwnCharges(tx, account, packageId)");
    const deletion = read("server/db/parcelDeletion.db.ts");
    expect(deletion).toContain("export async function parcelOwnCharges(");
    expect(deletion).toContain("const charges = await parcelOwnCharges(tx, account, packageId);");
  });

  it("an invoice carrying several parcels keeps all of them in its total", () => {
    const start = src.indexOf("async function invoiceFollows(");
    expect(start).toBeGreaterThan(-1);
    const follows = src.slice(start, src.indexOf("async function revenueFollows("));
    expect(follows).toContain("eq(ledgerTransactions.invoiceId, charge.invoiceId)");
    expect(follows).toContain("await effectiveChargeUsd(tx, debit)");
  });

  it("a photograph or a description alone never reads the account", () => {
    const start = src.indexOf("export async function applyParcelDetails(");
    expect(start).toBeGreaterThan(-1);
    const details = src.slice(start, src.indexOf("export async function applyParcelCorrection("));
    expect(details).not.toContain("ledgerTransactions");
    expect(details).not.toContain("adjustCharge");
    expect(details).not.toContain("calculatedCostUsd");
  });
});

describe("the door: only the caller's own last registration", () => {
  const lib = read("server/lib/correctRegisteredParcel.ts");
  const router = read("server/routers/packages.router.ts");

  it("the route goes through the one function", () => {
    expect(router).toContain("correctLastRegistration: staffProcedure");
    expect(router).toContain("correctLastRegistration({ id: ctx.user.id, name: ctx.user.name, role: ctx.user.role }, input)");
    expect(router).toContain("lastRegisteredByMe: staffProcedure");
  });

  it("asks whose last registration it is before anything else is decided", () => {
    const start = lib.indexOf("export async function correctLastRegistration(");
    expect(start).toBeGreaterThan(-1);
    const fn = lib.slice(start);
    const gate = fn.indexOf("const last = await db.getLastParcelRegisteredBy(actor.id);");
    expect(gate).toBeGreaterThan(-1);
    expect(fn).toContain("if (!last || last.id !== pkg.id) {");
    expect(gate).toBeLessThan(fn.indexOf("db.applyParcelCorrection("));
    expect(gate).toBeLessThan(fn.indexOf("resolveParcelCost("));
  });

  it("an order's carton keeps its owner, and a charged freight is not moved from here", () => {
    expect(lib).toContain("const orders = await db.ordersBehindParcel(pkg);");
    expect(lib).toContain("ownerChanged(pkg, asked)");
    expect(lib).toContain("orders.filter((o) => o.isShippingCharged)");
  });

  it("reprices only when a fact behind the price moved", () => {
    expect(lib).toContain("const repriced = moneyFactsChanged(pkg, after);");
    expect(lib).toContain(": await db.applyParcelDetails(pkg.id, facts);");
  });

  it("a lowering that would leave a credit is the main admin's decision", () => {
    expect(lib).toContain("allowCredit: mayApproveCredit(actor.role) && input.approveCredit === true");
    expect(lib).toContain("const credit = undoCreditRefusal(err, actor.role);");
    expect(router).toContain("approveCredit: z.boolean().optional()");
  });

  it("an uncharged parcel is offered to its batch exactly as a registration is", () => {
    expect(lib).toContain("await db.chargeBatchShippingIfDue(pkg.batchId, actor.id);");
    expect(lib).toContain("if (moved.chargeAfter && pkg.batchId) {");
  });
});

describe("my last order, on the two entry forms", () => {
  it("the server offers only the caller's own, and nothing from the bin", () => {
    const dbFile = read("server/db/fullPackage.db.ts");
    const start = dbFile.indexOf("export async function getLastOrderCreatedBy(");
    expect(start).toBeGreaterThan(-1);
    const fn = dbFile.slice(start, dbFile.indexOf("export async function getFullPackageOrderById("));
    expect(fn).toContain("eq(fullPackageOrders.createdById, userId)");
    expect(fn).toContain("eq(fullPackageOrders.orderType, orderType)");
    expect(fn).toContain("isNull(fullPackageOrders.deletedAt)");
    expect(read("server/routers/fullPackage.router.ts"))
      .toContain("db.getLastOrderCreatedBy(ctx.user.id, input.orderType)");
  });
});
