import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { customerBatchStatus } from "./customerBatchStage";

/**
 * The container is shared; the answer the customer wants is not.
 *
 * This is the same fault as the batch that stayed "لە کۆگای چین" after its
 * parcels were checked into Erbil, one stage further along: the portal read a
 * field about the whole container and printed it as a fact about one person's
 * goods.
 */
describe("a batch reports where this customer's goods are", () => {
  const parcels = (...statuses: string[]) => statuses.map((status) => ({ status }));

  it("says delivered once every one of their parcels is handed over", () => {
    // Their box was collected on Tuesday. The container stays at_depot until
    // the last customer comes in, which may be a fortnight.
    expect(customerBatchStatus("at_depot", parcels("delivered", "delivered"))).toBe("delivered");
  });

  it("does not say delivered while one of theirs is still on the shelf", () => {
    expect(customerBatchStatus("at_depot", parcels("delivered", "arrived"))).toBe("at_depot");
  });

  it("refuses to tell them a closed batch means they have their goods", () => {
    // A straggler pulled aside for a damage claim, and the container closed
    // around it. A customer told "گەیشتە دەستت" stops asking after it.
    expect(customerBatchStatus("closed", parcels("delivered", "arrived"))).toBe("at_depot");
    expect(customerBatchStatus("delivered", parcels("arrived"))).toBe("at_depot");
  });

  it("leaves a finished batch finished when they really are done", () => {
    // "closed" is not downgraded to "delivered": both read as delivered to a
    // customer, and moving it would churn the label for no reason.
    expect(customerBatchStatus("closed", parcels("delivered"))).toBe("closed");
  });

  it("passes every earlier stage through untouched", () => {
    // Nothing of theirs is delivered, so the container is the only thing that
    // knows, and it is right.
    for (const s of ["preparing", "in_transit", "arrived", "customs", "at_depot"]) {
      expect(customerBatchStatus(s, parcels("in_transit", "arrived"))).toBe(s);
    }
  });

  it("stands aside when there is nothing of theirs to read", () => {
    expect(customerBatchStatus("in_transit", [])).toBe("in_transit");
  });
});

/**
 * Three skins render this card and they have drifted apart before. The rule
 * is applied once, where the card is built, so none of them can forget.
 */
describe("the rule is applied at the source, not in a screen", () => {
  const ROOT = path.join(__dirname, "..");
  const portalDb = fs
    .readFileSync(path.join(ROOT, "server/db/portal.db.ts"), "utf8")
    .replace(/\r\n/g, "\n");

  it("overwrites the status the card carries", () => {
    // Adding it alongside would leave `batch.status` in place, and every
    // screen that already reads it stays wrong.
    expect(portalDb).toContain("status: customerStatus,");
    expect(portalDb).toContain("const customerStatus = customerBatchStatus(");
  });

  it("judges it on this customer's parcels only", () => {
    const start = portalDb.indexOf("export async function getCustomerBatches");
    expect(start).toBeGreaterThan(-1);
    const body = portalDb.slice(start, portalDb.indexOf("\n}\n", start));
    expect(body).toContain("parcelsByBatch");
    expect(body, "the parcel scan must stay filtered to this customer")
      .toContain("eq(packages.customerId, customerId)");
  });

  it("costs no extra query", () => {
    // The statuses ride along on the select the size totals already run. A
    // portal home screen opening on mobile data cannot afford another.
    const start = portalDb.indexOf("const mine = await db.select({");
    expect(start).toBeGreaterThan(-1);
    const body = portalDb.slice(start, portalDb.indexOf("));", start));
    expect(body).toContain("status: packages.status");
    expect(body).toContain("deliveredAt: packages.deliveredAt");
  });

  it("keeps the container's own status for anything that means the container", () => {
    expect(portalDb).toContain("batchStatus: batch.status,");
  });
});
