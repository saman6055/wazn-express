import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { TABLE_DEFINITIONS, REQUIRED_COLUMNS } from "./_core/migrations";

/**
 * The rules that protect money at the box, checked where they are written.
 *
 * The arithmetic itself is tested with numbers in shared/boxSettlement.test.ts.
 * What is guarded here is everything around it: that the money is written in
 * one transaction, that nothing can be given away without a reason, and that
 * a parcel nobody has been charged for cannot be quietly marked paid.
 */

const ROOT = path.join(__dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8").replace(/\r\n/g, "\n");

const settleDb = read("server/db/boxSettlement.db.ts");
const financeDb = read("server/db/finance.db.ts");
const router = read("server/routers/scanning.router.ts");

function slice(src: string, start: string, end: string, label: string): string {
  const a = src.indexOf(start);
  expect(a, `${label}: start marker not found`).toBeGreaterThan(-1);
  const b = src.indexOf(end, a + start.length);
  expect(b, `${label}: end marker not found after start`).toBeGreaterThan(a);
  const body = src.slice(a, b);
  expect(body.length, `${label}: slice is empty`).toBeGreaterThan(50);
  return body;
}

const create = () =>
  slice(settleDb, "export async function createBoxSettlement", "\n/**", "createBoxSettlement");

const view = () =>
  slice(settleDb, "export async function getBoxSettlementView", "export interface SettlementLineInput", "view");

describe("the money is written once, or not at all", () => {
  it("does everything inside one transaction", () => {
    // A payment that committed while the receipt rows failed would leave
    // money on an account with nothing saying what it was for — which is
    // indistinguishable from having taken it twice.
    expect(create()).toContain("db.transaction(async (tx) =>");
  });

  it("hands that transaction to the payment rather than starting a second", () => {
    const body = create();
    const call = body.slice(body.indexOf("recordPaymentReceived("));
    expect(call.slice(0, 400), "the payment must join the caller's transaction").toContain("tx,");
  });

  it("lets a payment accept a transaction it did not open", () => {
    // The additive half of the same change, in the shared function.
    const body = slice(financeDb, "export async function recordPaymentReceived", "\n// Reverse an advance", "recordPaymentReceived");
    expect(body).toContain("existingTx?: DbTx");
    expect(body).toContain("return existingTx ? run(existingTx) : db.transaction(run);");
  });

  it("applies corrections before anything is paid against them", () => {
    // A correction changes what is owed. Settling first would pay against a
    // price already known to be wrong.
    const body = create();
    const correction = body.indexOf("adjustCharge(");
    const payment = body.indexOf("recordPaymentReceived(");
    expect(correction).toBeGreaterThan(-1);
    expect(payment).toBeGreaterThan(-1);
    expect(correction, "corrections must come first").toBeLessThan(payment);
  });
});

describe("nothing is given away without a reason", () => {
  it("refuses a discount with no reason", () => {
    expect(create()).toContain("هۆکاری داشکاندن پێویستە");
  });

  it("refuses a price correction with no reason", () => {
    expect(create()).toContain("هۆکاری ڕاستکردنەوەی نرخ پێویستە");
  });

  it("refuses a shortfall with no reason", () => {
    // Short money is either owed or forgiven, and only a person can say
    // which. Either way somebody has to write down why.
    const body = create();
    expect(body).toContain("difference.reasonRequired");
    expect(body).toContain("هۆکار پێویستە");
  });

  it("refuses a box-level discount with no reason", () => {
    expect(create()).toContain("boxCut > 0 && !input.boxDiscountReason");
  });

  it("refuses a reversal with no reason", () => {
    const body = slice(settleDb, "export async function reverseBoxSettlement", "\nexport interface", "reverse");
    expect(body).toContain("reason.trim().length < 3");
  });
});

/**
 * A parcel the customer's account has never been told about.
 *
 * This began as a refusal — nothing to settle, so settle nothing — and it was
 * wrong. Charges are posted at batch delivery, and a box can be made, sealed
 * and handed over long before that runs. The owner's correction: once there
 * is a box, the goods have gone to the customer, and the money is theirs to
 * collect whenever they decide to. The charge had simply not been written
 * down yet.
 */
describe("settling a parcel that was never charged writes both sides", () => {
  it("posts the charge instead of refusing", () => {
    const body = create();
    expect(body).toContain("const toCharge = parcels.filter(");
    expect(body).toContain("recordPackageChargeWithoutInvoice(");
    expect(body, "the old refusal must be gone")
      .not.toContain("هێشتا پارەیان نەچووەتە سەر کڕیار");
  });

  it("charges before it corrects, because a correction needs a charge", () => {
    const body = create();
    const charge = body.indexOf("recordPackageChargeWithoutInvoice(");
    const correct = body.indexOf("adjustCharge(");
    expect(charge).toBeGreaterThan(-1);
    expect(correct).toBeGreaterThan(-1);
    expect(charge, "the charge must exist before it is adjusted").toBeLessThan(correct);
  });

  it("does it in the same transaction as the payment that clears it", () => {
    // Half of a charge-and-payment pair committing alone is worse than
    // neither: the customer would owe money nobody took.
    const body = create();
    const call = body.slice(body.indexOf("recordPackageChargeWithoutInvoice("));
    expect(call.slice(0, 400)).toContain("tx,");
    expect(financeDb).toContain("existingTx?: DbTx");
  });

  it("marks the parcel charged, so nothing charges it again", () => {
    expect(create()).toContain("set({ isCharged: true })");
  });

  it("makes the batch flow honour that flag", () => {
    // It was being written and read by nobody, so a box settled before its
    // batch was marked delivered was charged twice.
    const batches = read("server/routers/batches.router.ts");
    expect(batches).toContain("if (pkgPrice > 0 && !pkg.isCharged) {");
  });

  it("leaves a parcel that is being set aside alone", () => {
    // Nobody is paying for it, so there is nothing to charge for.
    expect(create()).toContain("?.held,");
  });

  it("falls back to the price the box was built with", () => {
    // The box item carries it. Showing $0.00 beside a customer holding $629
    // of goods is the screen being wrong, not the box being free.
    expect(view()).toContain("Number(r.item.calculatedCostUsd || 0)");
  });

  it("still says which parcels were in that state", () => {
    expect(view()).toContain("notChargedYet: !seenAnyCharge.has(packageId)");
  });
});


describe("the figures come from the ledger, never from a second copy", () => {
  it("reads charges out of ledgerTransactions", () => {
    const body = view();
    expect(body).toContain("from(ledgerTransactions)");
    expect(body).toContain('eq(ledgerTransactions.referenceType, "package")');
  });

  it("counts a downward correction against the price, not as a discount", () => {
    // They look the same at the counter and are different facts: a discount
    // means the price was right and we gave some back.
    const body = slice(settleDb, "const charged = new Map", "// What earlier settlements", "charge fold");
    expect(body).toContain('type === "ADJUSTMENT_CREDIT"');
    expect(body).toContain("charged.set(id, round2((charged.get(id) ?? 0) - amount))");
  });

  it("ignores reversed settlements when adding up what is paid", () => {
    const body = slice(settleDb, "const settledRows", "const parcels", "settled rows");
    expect(body).toContain('eq(boxSettlements.status, "confirmed")');
  });
});

describe("a settlement is never edited, only replaced", () => {
  const reverse = () =>
    slice(settleDb, "export async function reverseBoxSettlement", "\nexport interface", "reverse");

  it("marks the original reversed and keeps its reason", () => {
    const body = reverse();
    expect(body).toContain('status: "reversed"');
    expect(body).toContain("reversalReason");
  });

  it("puts back the discount as well as the payment", () => {
    // Both left the customer owing less. Undoing one and not the other
    // leaves the account quietly wrong.
    expect(reverse()).toContain("Number(settlement.paidUsd || 0) + Number(settlement.discountUsd || 0)");
  });

  it("carries a link from the replacement back to what it corrected", () => {
    expect(settleDb).toContain("replacesSettlementId");
  });

  it("refuses to reverse the same settlement twice", () => {
    expect(reverse()).toContain('settlement.status === "reversed"');
  });
});

describe("the discount report can be cut every way the owner asked for", () => {
  const report = () =>
    slice(settleDb, "export async function getDiscountReport", "\n  } catch (err)", "report");

  it("by reason, by month, by customer and by batch", () => {
    const body = report();
    for (const cut of ["byReason", "byMonth", "byCustomer", "byBatch"]) {
      expect(body, `${cut} is missing`).toContain(cut);
    }
  });

  it("leaves out discounts that were reversed", () => {
    // A discount that was undone was not a discount.
    expect(report()).toContain('eq(boxSettlements.status, "confirmed")');
  });

  it("keeps one ledger row per parcel, so the cuts are possible at all", () => {
    // One row for the whole box would be simpler and would make "how much on
    // this batch" unanswerable.
    const body = slice(settleDb, "async function postDiscountCredits", "\n/**", "discount credits");
    expect(body).toContain("for (const entry of entries)");
    expect(body).toContain('transactionType: "CREDIT_DISCOUNT"');
  });
});

describe("the tables exist wherever the code runs", () => {
  it("declares both settlement tables", () => {
    const names = TABLE_DEFINITIONS.map((t) => t.name);
    expect(names).toContain("boxSettlements");
    expect(names).toContain("boxSettlementLines");
  });

  it("declares the box tables they hang off, which were never declared before", () => {
    // deliveryBoxes had ALTERs in SCHEMA_PATCHES and no CREATE at all, so a
    // fresh database had no delivery boxes to settle.
    const names = TABLE_DEFINITIONS.map((t) => t.name);
    expect(names).toContain("deliveryBoxes");
    expect(names).toContain("deliveryBoxItems");
  });

  it("reconciles the ledger columns a fresh database was missing", () => {
    // Found by running the real migration against an empty MySQL and then
    // trying to charge somebody: the first charge died on
    // Unknown column serviceDebtUsd, and after that on amountUsd.
    expect(Object.keys(REQUIRED_COLUMNS)).toContain("customerAccounts");
    expect(Object.keys(REQUIRED_COLUMNS)).toContain("ledgerTransactions");
    const ledger = REQUIRED_COLUMNS.ledgerTransactions!.map((c) => c.name);
    expect(ledger).toContain("amountUsd");
    expect(ledger).toContain("referenceId");
  });

  it("creates a ledger whose transaction types are the ones the code writes", () => {
    // The CREATE here carried an older design entirely, with types like
    // package_charge. Every insert failed on a data truncation.
    const ledger = TABLE_DEFINITIONS.find((t) => t.name === "ledgerTransactions")!;
    expect(ledger.sql).toContain("'DEBIT_PACKAGE'");
    expect(ledger.sql).toContain("'CREDIT_DISCOUNT'");
    expect(ledger.sql).toContain("'ADJUSTMENT_CREDIT'");
    expect(ledger.sql).toContain("balanceBeforeUsd");
  });
});

describe("the procedures are mounted, and staff-only", () => {
  it("exposes the view, the write, the reversal and the report", () => {
    for (const proc of ["settlementView:", "settle:", "reverseSettlement:", "discountReport:"]) {
      expect(router, `${proc} is not mounted`).toContain(proc);
    }
  });

  it("keeps the reading procedure read-only", () => {
    const view = slice(router, "settlementView: staffProcedure", "settle: staffProcedure", "view proc");
    expect(view).toContain(".query(");
    expect(view).not.toContain(".mutation(");
  });

  it("lets nobody but staff near any of it", () => {
    for (const proc of ["settlementView", "settle", "reverseSettlement", "discountReport"]) {
      expect(router).toContain(`${proc}: staffProcedure`);
    }
  });
});
