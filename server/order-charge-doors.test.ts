import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

const read = (rel: string) =>
  fs.readFileSync(path.resolve(__dirname, "..", rel), "utf8").replace(/\r\n/g, "\n");

/**
 * Goods a customer is holding must be on their account.
 *
 * The owner, 2026-09-26, looking at an account that owed him nothing for a
 * box of $211.78 of goods: "I want the invoice to exist when the batch is
 * delivered and when each tracking goes into the box."
 *
 * An order that travels as a parcel — the box item carries packageId, not
 * fullPackageOrderId — used to be billed by nobody. Four doors each declined
 * for a good reason and there was no fifth. These are the two he named, and
 * the rule that keeps them from billing twice.
 */
describe("an order that travelled as a parcel", () => {
  const charging = read("server/db/orderCharging.db.ts");

  it("is billed through the one charge there has ever been", () => {
    // Not a second amount rule: the same function a new order goes through,
    // which re-checks the flags itself.
    expect(charging).toContain('await import("./fullPackage.db")');
    expect(charging).toContain("chargeOrderAtCreation");
    expect(charging).not.toMatch(/insert\(ledgerTransactions\)/);
  });

  it("is never billed twice", () => {
    // Both flags, because either one alone means somebody already charged it.
    expect(charging).toContain("eq(fullPackageOrders.isCharged, false)");
    expect(charging).toContain("isNull(fullPackageOrders.chargeTransactionId)");
    // And a deleted order is not a debt at all.
    expect(charging).toContain("isNull(fullPackageOrders.deletedAt)");
  });

  it("is billed when its tracking goes into a box", () => {
    const boxes = read("server/db/deliveryBoxes.db.ts");
    expect(boxes).toContain("chargeOrdersForBoxQuietly");
    const helper = boxes.slice(boxes.indexOf("async function chargeOrdersForBoxQuietly"));
    expect(helper.length).toBeGreaterThan(20);
    expect(helper.slice(0, 600)).toContain("chargeOrdersInBox");
    // Every door that puts items in a box: one at a time, a box built from a
    // batch, and a box refreshed from one.
    expect(boxes.match(/chargeOrdersForBoxQuietly\(/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
  });

  it("is billed when the batch is delivered", () => {
    const router = read("server/routers/batches.router.ts");
    expect(router).toContain("db.chargeOrdersInBatch(id, ctx.user.id)");
    // Inside the delivered/closed flow, not on every edit of a batch.
    const delivered = router.indexOf('input.status === "delivered" || input.status === "closed"');
    expect(delivered).toBeGreaterThan(-1);
    expect(router.indexOf("db.chargeOrdersInBatch")).toBeGreaterThan(delivered);
  });

  it("never stops the parcel or the delivery when it cannot bill", () => {
    // An order that fails to charge is one the office can still see and fix;
    // a refusal here would be a customer standing at a counter.
    expect(charging).toContain("catch (e)");
    expect(charging).toContain("return { charged: 0, amountUsd: 0 };");
    expect(read("server/db/deliveryBoxes.db.ts")).toMatch(
      /chargeOrdersForBoxQuietly[\s\S]{0,400}catch \(e\)/,
    );
  });
});

describe("the ones that arrived before the doors existed", () => {
  /*
   * The owner, 2026-09-26: "it has to fix the old ones too." The doors only
   * bill what passes through them from now on.
   */
  const charging = read("server/db/orderCharging.db.ts");

  it("are found by what the customer is holding, not by their age", () => {
    const finder = charging.slice(
      charging.indexOf("export async function findUnbilledArrivedOrders"),
      charging.indexOf("export async function billUnbilledOrders"),
    );
    expect(finder.length).toBeGreaterThan(200);
    // In a box, or delivered. Goods still in China are not billed by a
    // repair — charging at entry is the rule going forward.
    expect(finder).toContain('where = "box"');
    expect(finder).toContain('eq(packages.status, "delivered")');
    expect(finder).toContain('ne(fullPackageOrders.orderType, "purchase_request")');
    // It reads. It must not write.
    expect(finder).not.toMatch(/\.insert\(|\.update\(|chargeOrderAtCreation\(/);
  });

  it("are billed only when somebody names them", () => {
    const repair = charging.slice(charging.indexOf("export async function billUnbilledOrders"));
    expect(repair).toContain("inArray(fullPackageOrders.id, ids)");
    expect(repair).toContain("eq(fullPackageOrders.isCharged, false)");
    // What it could not do comes back by order code: a repair that silently
    // half-finished is worse than one that did nothing.
    expect(repair).toContain("skipped.push(");
  });

  it("are behind an admin, and a list that is read first", () => {
    const router = read("server/routers/finance.router.ts");
    expect(router).toContain("unbilledGoods: adminProcedure.query");
    expect(router).toContain("billUnbilledGoods: adminProcedure");
    const screen = read("client/src/components/admin/UnbilledGoodsSection.tsx");
    // The scan runs when asked, not when the tab opens.
    expect(screen).toContain("enabled: false");
    expect(screen).toContain("billUnbilledGoods");
    expect(read("client/src/pages/admin/DataManagement.tsx")).toContain("UnbilledGoodsSection");
  });
});
