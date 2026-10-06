import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8").replace(/\r\n/g, "\n");

/**
 * A registered parcel put right, and its money with it (owner, 2026-10-05).
 *
 * «ئەگەر هەڵەت لە کێش یا قیاس یا لە شتێ کرد، ڕیتێرنی دوایین تۆمار هەبێ … بەس
 * دەقیق بێت» — the same parcel, the same code. The first build wrote the
 * difference on the account as a line of its own. Shown it, he refused it the
 * same day: «تەنها نرخ و کیلۆ ئەپدەیت ببێتەوە … نرخی پێشوو لەگەڵ ئیزافەی نوێ بە
 * جیا بچنە ناو بەشی ژمێریاری، ئەوە قەبوڵ کراو نییە» — and of the parcel list:
 * «ئەوەش بە هەمان شێوە». One parcel, one line, the right figure.
 *
 * Proved on a real MySQL through the shipping procedures (register, then
 * correctLastRegistration or packages.update), at $11/kg - 81 checks:
 *
 *   15 kg typed for 1.5      the one row reads 16.50 where it read 165.00,
 *                            balance 0.00 > 16.50; the invoice total, its
 *                            line and the revenue record read 16.50; the same
 *                            parcel code; one audit record; the main admin's
 *                            bell lists it
 *   corrected again to 2     still one row, 22.00
 *   saved with no change     nothing written, no record
 *   description only         nothing written, the text saved
 *   rows after the charge    165.00, a payment of 10, a charge of 11: after
 *                            the correction the three rows read 0 > 16.50,
 *                            16.50 > 6.50, 6.50 > 17.50, the account 17.50
 *   wrong customer           22.00 and its reversal on the first account
 *                            (0.00), one row of 22.00 on the right one
 *   made ownerless           the charge off whole, no price, uncharged
 *   no weight, then 4 kg     charged 44.00 by the batch's own rule
 *   customer already paid    refused whole for staff - weight, rows and
 *                            records as they were; the main admin is asked,
 *                            and on yes the bell says a credit of 148.50
 *   a charge with a line     one carrying an older correction line is given
 *                            another (110.00, -11.00, -44.00), not rewritten
 *   an order's carton        price restated, no ledger row of its own
 *   already in a box         Quick Register refuses; the parcel list saves
 *                            the weight and leaves the account to the till
 *   paid on a receipt        the same, naming the receipt
 *   moved to another batch   saved, the debt left as the old batch made it
 *   one invoice, two parcels the total stayed BOTH parcels (11 + 11 = 22)
 *   the whole book           every account adds up to its rows, and every
 *                            row's "after" is the next row's "before"
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

  const same = tx.slice(tx.indexOf("if (!newOwner && due.due) {"), tx.indexOf("} else {\n        // Not this owner's any more"));

  it("the same owner: the charge itself reads the right figure, with no line beside it", () => {
    expect(same.length).toBeGreaterThan(50);
    expect(same).toContain(": (await restateCharge(");
    expect(same).toContain("{ reason, actorId: userId, actorRole: opts?.actorRole ?? null, subject: name },");
    expect(same).toContain('money = lined ? "adjusted" : "restated";');
    expect(same).toContain("await invoiceFollows(tx, charge, name, due)");
    expect(same).toContain("await revenueFollows(tx, packageId, due.amount)");
    expect(same).not.toContain("reverseCharge(");
  });

  it("a charge that already carries a correction line is given another, never rewritten", () => {
    expect(same).toContain("const lined = await chargeHasCorrections(tx, charge);");
    expect(same).toContain("? Boolean((await adjustCharge(charge.id, due.amount, reason, userId, tx, opts)).adjustmentTransaction)");
    // And the ledger would refuse the rewrite itself.
    const ledger = read("server/db/finance.db.ts");
    const at = ledger.indexOf("export async function restateCharge(");
    expect(at).toBeGreaterThan(-1);
    expect(ledger.slice(at, at + 3000)).toContain("if (await chargeHasCorrections(tx, original)) {");
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
    for (const money of ["await adjustCharge(", "await restateCharge(", "await reverseCharge("]) {
      expect(tx.indexOf(money), money).toBeGreaterThan(-1);
      expect(tx.indexOf(money), money).toBeLessThan(row);
    }
  });

  it("will not guess at money that is not where it should be", () => {
    expect(tx).toContain("if (standing.length > 1) {");
    expect(tx).toContain("if (standing.length === 0 && row.isCharged && !orderLinked) {");
    // Told apart from every other failure: the parcel list still saves the
    // edit past these two, and says why the debt did not follow.
    expect(tx.split("throw new ParcelAccountError(withFix(").length - 1).toBe(2);
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
  const start = lib.indexOf("export async function correctLastRegistration(");
  const end = lib.indexOf("/** What the parcel list's edit sends", start);
  const fn = lib.slice(start, end);

  it("the markers are there", () => {
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(fn.length).toBeGreaterThan(1000);
  });

  it("the route goes through the one function", () => {
    expect(router).toContain("correctLastRegistration: staffProcedure");
    expect(router).toContain("correctLastRegistration({ id: ctx.user.id, name: ctx.user.name, role: ctx.user.role }, input)");
    expect(router).toContain("lastRegisteredByMe: staffProcedure");
  });

  it("asks whose last registration it is before anything else is decided", () => {
    const gate = fn.indexOf("const last = await db.getLastParcelRegisteredBy(actor.id);");
    expect(gate).toBeGreaterThan(-1);
    expect(fn).toContain("if (!last || last.id !== pkg.id) {");
    const money = fn.indexOf("await moveParcelMoney(actor, pkg, name, after, details, input.approveCredit)");
    const details = fn.indexOf("await db.applyParcelDetails(pkg.id, details)");
    expect(money).toBeGreaterThan(gate);
    expect(details).toBeGreaterThan(gate);
  });

  it("an order's carton keeps its owner, and a charged freight is not moved from here", () => {
    expect(fn).toContain("const orders = await db.ordersBehindParcel(pkg);");
    expect(fn).toContain("ownerChanged(pkg, asked)");
    expect(fn).toContain("orders.filter((o) => o.isShippingCharged)");
  });

  it("a parcel in a box or paid on a receipt is refused here, with the cure", () => {
    const refusal = fn.indexOf("const blocked = await db.parcelCorrectionRefusal(pkg.id, name);");
    expect(refusal).toBeGreaterThan(-1);
    expect(refusal).toBeLessThan(fn.indexOf("await moveParcelMoney("));
  });

  it("reprices only when a fact behind the price moved", () => {
    expect(fn).toContain("const repriced = moneyFactsChanged(pkg, after);");
    expect(fn).toContain(": { moved: await db.applyParcelDetails(pkg.id, details), calculatedCostUsd: pkg.calculatedCostUsd ?? null, chargedUsd: 0 };");
  });
});

describe("the money step is one function for both doors", () => {
  const lib = read("server/lib/correctRegisteredParcel.ts");
  const router = read("server/routers/packages.router.ts");
  const start = lib.indexOf("async function moveParcelMoney(");
  const fn = lib.slice(start, lib.indexOf("export async function correctLastRegistration("));

  it("the markers are there", () => {
    expect(start).toBeGreaterThan(-1);
    expect(fn.length).toBeGreaterThan(800);
  });

  it("is the only caller of the correction", () => {
    expect(lib.split("db.applyParcelCorrection(").length - 1).toBe(1);
    expect(fn).toContain("moved = await db.applyParcelCorrection(pkg.id, actor.id, facts, reason, {");
  });

  it("a lowering that would leave a credit is the main admin's decision", () => {
    expect(fn).toContain("allowCredit: mayApproveCredit(actor.role) && approveCredit === true,");
    expect(fn).toContain("const credit = undoCreditRefusal(err, actor.role);");
    expect(router.split("approveCredit: z.boolean().optional()").length - 1).toBeGreaterThanOrEqual(2);
  });

  it("who is asking is kept with the record of a restated charge", () => {
    expect(fn).toContain("actorRole: actor.role ?? null,");
  });

  it("an uncharged parcel is offered to its batch exactly as a registration is", () => {
    expect(fn).toContain("await db.chargeBatchShippingIfDue(pkg.batchId, actor.id);");
    expect(fn).toContain("if (moved.chargeAfter && pkg.batchId) {");
  });
});

/*
 * Owner, 2026-10-05, told the parcel list changed a charged parcel's weight
 * and left its debt where it was: «ئەوەش بە هەمان شێوە ئەپدەیت ببێتەوە، بەبێ
 * ڕیکۆردی نرخ و کێشی کۆن».
 */
describe("the parcel list is the second door", () => {
  const lib = read("server/lib/correctRegisteredParcel.ts");
  const router = read("server/routers/packages.router.ts");
  const start = lib.indexOf("export async function correctChargedParcelOnEdit(");
  const fn = lib.slice(start);
  const updateStart = router.indexOf("    update: staffProcedure");
  const update = router.slice(updateStart, router.indexOf("    delete: adminProcedure"));

  it("the markers are there", () => {
    expect(start).toBeGreaterThan(-1);
    expect(fn.length).toBeGreaterThan(800);
    expect(updateStart).toBeGreaterThan(-1);
    expect(update.length).toBeGreaterThan(500);
  });

  it("a parcel with no charge to follow is left to the rule it always had", () => {
    expect(fn).toContain("if (!pkg.isCharged || pkg.isUnclaimed) return null;");
  });

  it("sent is not changed: the dialog sends every field, so the figures are compared with the row", () => {
    expect(fn).toContain("if (!batchMoved && !moneyFactsChanged(pkg, after)) return QUIET;");
    for (const f of ["weightKg", "lengthCm", "widthCm", "heightCm", "volumeCbm"]) {
      expect(fn, f).toContain(`${f}: edit.${f} ?? pkg.${f} ?? null,`);
    }
  });

  it("money that is no longer the parcel's to move is left alone, and the edit says where it is put right", () => {
    const batch = fn.indexOf('if (batchMoved) return held({ kind: "batch" });');
    const order = fn.indexOf('if (orders.length > 0) return held({ kind: "order", orderCodes: orders.map((o) => o.orderCode) });');
    const hold = fn.indexOf("if (hold) return held(hold);");
    const money = fn.indexOf("await moveParcelMoney(");
    for (const at of [batch, order, hold, money]) expect(at).toBeGreaterThan(-1);
    expect(Math.max(batch, order, hold)).toBeLessThan(money);
    expect(fn).toContain("const hold = await db.parcelMoneyHold(pkg.id);");
  });

  it("a credit refusal stops the whole edit; an account that is not right does not", () => {
    expect(fn).toContain("if (err instanceof TRPCError) throw err;");
    expect(fn).toContain('if (err instanceof db.ParcelAccountError) return held({ kind: "account", said: err.message });');
  });

  it("the edit asks the door before it writes anything, and never writes the admin's yes into the row", () => {
    const door = update.indexOf("const onAccount = await correctChargedParcelOnEdit(");
    const row = update.indexOf("await db.updatePackage(id, updateData);");
    expect(door).toBeGreaterThan(-1);
    expect(row).toBeGreaterThan(door);
    expect(update).toContain("if (onAccount) pricing = onAccount;");
    expect(update).toContain("const { id, volumeCbm: inputVolumeCbm, photos, approveCredit, ...data } = input;");
  });

  it("both doors read where the money is from one place", () => {
    const dbFile = read("server/db/parcelCorrection.db.ts");
    expect(dbFile).toContain("export async function parcelMoneyHold(packageId: number): Promise<ParcelMoneyHold | null> {");
    expect(dbFile).toContain("const hold = await parcelMoneyHold(packageId);");
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
