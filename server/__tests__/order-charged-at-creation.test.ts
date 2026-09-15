import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * The owner's rule (Sep 2026): the moment a cost-purchase or full-package
 * order is entered, the customer owes for it — the company's money left when
 * the goods were bought. Until now the goods were billed weeks later, when
 * the batch was marked delivered, so a customer with a dozen live orders read
 * "nothing owed" on their account.
 *
 * The danger the rule brings is billing the same goods twice — once at
 * creation and again on arrival. These guards pin the things that stop it.
 */

const ROOT = path.resolve(__dirname, "../..");
const read = (rel: string) =>
  fs.readFileSync(path.join(ROOT, rel), "utf8").replace(/\r\n/g, "\n");

function slice(src: string, from: string, to: string): string {
  const start = src.indexOf(from);
  expect(start, `marker not found: ${from}`).toBeGreaterThan(-1);
  const end = src.indexOf(to, start + from.length);
  expect(end, `marker not found: ${to}`).toBeGreaterThan(start);
  const out = src.slice(start, end);
  expect(out.length, "slice is empty").toBeGreaterThan(100);
  return out;
}

describe("an order entered is a debt owed", () => {
  const router = read("server/routers/fullPackage.router.ts");
  const dbsrc = read("server/db/fullPackage.db.ts");

  it("every creation path charges", () => {
    // The single create and the bulk create; the legacy commission path
    // already charged and is checked separately below.
    expect(router.split("chargeOrderAtCreation(order, ctx.user.id)").length - 1).toBe(2);
  });

  it("the debt is posted before the advance that pays it down", () => {
    const create = slice(router, "const order = await db.createFullPackageOrder({", "await db.createAuditLog({");
    const chargeAt = create.indexOf("chargeOrderAtCreation");
    const advanceAt = create.indexOf("recordPaymentReceived");
    expect(chargeAt).toBeGreaterThan(-1);
    expect(advanceAt).toBeGreaterThan(-1);
    expect(chargeAt).toBeLessThan(advanceAt);
  });

  it("the amount is the one shared rule, not a second formula", () => {
    const fn = slice(dbsrc, "export async function chargeOrderAtCreation", "async function db_updateOrderChargeStamp");
    expect(fn).toContain("computeOrderChargeAmount(order)");
    expect(fn).not.toContain("commissionGoodsTotal(");
    expect(fn).not.toContain("sellingPriceUsd");
  });
});

describe("the same goods are never billed twice", () => {
  const dbsrc = read("server/db/fullPackage.db.ts");
  const fn = slice(dbsrc, "export async function chargeOrderAtCreation", "async function db_updateOrderChargeStamp");

  it("charging stamps the flag the delivery path reads", () => {
    const stamp = slice(dbsrc, "async function db_updateOrderChargeStamp", "const num =");
    expect(stamp).toContain("isCharged: true");
    expect(stamp).toContain("chargeTransactionId: transactionId");
  });

  it("delivery still refuses to charge an order already charged", () => {
    expect(dbsrc).toContain("const shouldCharge = isBeingDelivered && !existing.isCharged && existing.customerId;");
  });

  it("an already-charged order is not charged again on re-entry", () => {
    expect(fn).toContain("if (order.isCharged || order.chargeTransactionId)");
  });

  it("the legacy commission path stamps the flag too", () => {
    const router = read("server/routers/fullPackage.router.ts");
    const legacy = slice(router, "const commissionChargeResult = await db.applyCharge", "await db.createAuditLog({");
    expect(legacy).toContain("isCharged: true");
  });
});

describe("a quote is not a debt", () => {
  it("a purchase request is left to approveQuote", () => {
    const dbsrc = read("server/db/fullPackage.db.ts");
    const fn = slice(dbsrc, "export async function chargeOrderAtCreation", "async function db_updateOrderChargeStamp");
    expect(fn).toContain("if (order.orderType === 'purchase_request')");
    expect(fn).toContain("'quote'");
  });
});

describe("charging never costs the office the order", () => {
  it("a failed charge is logged, not thrown", () => {
    const dbsrc = read("server/db/fullPackage.db.ts");
    const fn = slice(dbsrc, "export async function chargeOrderAtCreation", "async function db_updateOrderChargeStamp");
    expect(fn).toContain("catch (e)");
    expect(fn).toContain("appLogger.error");
    expect(fn).not.toContain("throw ");
  });
});
