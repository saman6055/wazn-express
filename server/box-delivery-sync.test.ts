import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Two ways a box gets handed over, and they must agree.
 *
 * Staff scanning the box out goes through `updatePackage`, which carries the
 * delivery onto every order behind the parcels. The customer pressing "I have
 * received it" in the portal does not: that path writes `packages.status` in
 * one statement — deliberately, because forty parcels was forty round trips
 * at a phone — and the single statement skips the sync.
 *
 * So which of the two happened decided what the customer's own order page
 * said afterwards. Goods in their hands, order reading "لە ڕێگادا".
 */

const ROOT = path.join(__dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8").replace(/\r\n/g, "\n");

const boxesDb = read("server/db/deliveryBoxes.db.ts");
const packagesDb = read("server/db/packages.db.ts");

function slice(src: string, start: string, end: string, label: string): string {
  const a = src.indexOf(start);
  expect(a, `${label}: "${start}" not found`).toBeGreaterThan(-1);
  const b = src.indexOf(end, a + start.length);
  expect(b, `${label}: "${end}" not found after start`).toBeGreaterThan(a);
  const body = src.slice(a, b);
  expect(body.length, `${label}: slice is empty`).toBeGreaterThan(50);
  return body;
}

const confirm = () =>
  slice(boxesDb, "export async function confirmBoxReceivedByCustomer", "\n  return { ok: true };", "confirm");

describe("a customer confirming their box moves the orders behind it", () => {
  it("syncs the orders the parcels are linked to", () => {
    expect(confirm(), "the bulk write skips updatePackage and nothing replaces it")
      .toContain("markLinkedOrdersDelivered(packageIds)");
  });

  it("also moves an order attached to the box itself", () => {
    // The staff scan handles these; if this path does not, the two disagree.
    const body = confirm();
    expect(body).toContain("item.fullPackageOrderId");
    expect(body).toContain("status: 'delivered'");
  });

  it("keeps the one-statement parcel write it was made fast for", () => {
    // Going back to a call per parcel would fix the sync by reintroducing
    // forty round trips on a phone, which is not a fix.
    const body = confirm();
    expect(body).toContain("inArray(packages.id, packageIds)");
  });

  it("lets neither sync cost the customer their receipt", () => {
    // The box is already marked by this point. A stuck order can be moved by
    // hand; a failed confirmation cannot be recovered from the counter.
    const body = confirm();
    const after = body.slice(body.indexOf("markLinkedOrdersDelivered"));
    expect(after).toContain("catch");
  });
});

describe("the sync follows both routes and touches no money", () => {
  const helper = () =>
    slice(packagesDb, "export async function markLinkedOrdersDelivered", "\n  return moved;", "helper");

  it("resolves orders the same way updatePackage does", () => {
    // Link table, shared trackings and the legacy FK. Reading one route
    // leaves the orders on the others still in transit.
    expect(helper()).toContain("resolveLinkedOrdersForPackage(pkg)");
  });

  it("writes status, never a shipping cost", () => {
    // The box delivery flow settles freight with its own split. A second
    // write here charges the customer for the same freight twice.
    const body = helper();
    expect(body).toContain("status: 'delivered'");
    expect(body, "freight must not be written from here").not.toContain("shippingCostUsd");
  });

  it("leaves an order that is already finished alone", () => {
    const body = helper();
    expect(body).toContain("order.status === 'delivered'");
    expect(body).toContain("order.status === 'cancelled'");
  });

  it("does not move the same order twice for two parcels of one order", () => {
    expect(helper()).toContain("seen.has(order.id)");
  });
});
