import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, p), "utf8");

/*
 * Fifteen orders carry two identical goods charges from May to July: the box
 * door and the batch's delivery reached the same order at once, each reading
 * "not charged" from its own copy. An order is now claimed by one conditional
 * update before it is charged. Proved on a real MySQL: five doors at the same
 * instant, one charge; a charge that fails gives the claim back.
 */
describe("an order is charged once", () => {
  const orders = read("db/fullPackage.db.ts");
  const router = read("routers/batches.router.ts");

  it("the claim is one conditional update", () => {
    const claim = orders.slice(orders.indexOf("export async function claimOrderForCharge"), orders.indexOf("export async function releaseOrderClaim"));
    expect(claim).toContain("eq(fullPackageOrders.isCharged, false),");
    expect(claim).toContain("isNull(fullPackageOrders.chargeTransactionId),");
    expect(claim).toContain("affectedRows");
  });

  it("every door that charges an order claims it first", () => {
    const create = orders.slice(orders.indexOf("export async function chargeOrderAtCreation"));
    expect(create.indexOf("await claimOrderForCharge(order.id)")).toBeLessThan(create.indexOf("await applyCharge("));
    expect(router.match(/await db\.claimOrderForCharge\(order\.id\)/g)?.length).toBe(2);
    expect(router.match(/await db\.releaseOrderClaim\(order\.id\)/g)?.length).toBe(2);
  });
});
