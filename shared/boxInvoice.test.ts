import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { buildBoxInvoice, type BoxItem } from "./boxInvoice";

const item = (over: Partial<BoxItem> = {}): BoxItem => ({
  id: 1,
  description: "Shoes",
  trackingNumber: "JT5502354733671",
  weightKg: "2.400",
  calculatedCostUsd: "6.00",
  ...over,
});

describe("the box, line by line", () => {
  it("adds the parcels up and keeps the delivery charge apart", () => {
    // The delivery charge is for the box, not for any parcel in it. Sharing it
    // out would invent a per-parcel figure the customer was never quoted and
    // could not reconcile against anything.
    const { lines, totals } = buildBoxInvoice(
      [item({ id: 1, calculatedCostUsd: "6.00" }), item({ id: 2, calculatedCostUsd: "8.01" })],
      "5.00",
    );

    expect(lines).toHaveLength(2);
    expect(totals.goods).toBe(14.01);
    expect(totals.delivery).toBe(5);
    expect(totals.grand).toBe(19.01);
  });

  it("adds the weights", () => {
    const { totals } = buildBoxInvoice([item({ id: 1, weightKg: "2.4" }), item({ id: 2, weightKg: "3.1" })], 0);
    expect(totals.weightKg).toBe(5.5);
  });

  it("does not drift on amounts that break binary floats", () => {
    const { totals } = buildBoxInvoice(
      [item({ id: 1, calculatedCostUsd: "0.10" }), item({ id: 2, calculatedCostUsd: "0.20" })],
      0,
    );
    expect(totals.goods).toBe(0.3);
  });

  it("names a line by whatever it has, rather than leaving it blank", () => {
    // A blank line on an invoice is worse than a code: the customer can look
    // a code up, and cannot ask about an empty row.
    expect(buildBoxInvoice([item({ description: null })], 0).lines[0].label).toBe("JT5502354733671");
    expect(
      buildBoxInvoice([item({ description: "   ", trackingNumber: null, packageCode: "WZ-1001" })], 0).lines[0].label,
    ).toBe("WZ-1001");
    expect(
      buildBoxInvoice([item({ description: null, trackingNumber: null, packageCode: null })], 0, "—").lines[0].label,
    ).toBe("—");
  });

  it("counts what has no price rather than guessing", () => {
    const invoice = buildBoxInvoice([item({ calculatedCostUsd: null }), item({ id: 2 })], "3.00");
    expect(invoice.unpriced).toBe(1);
    expect(invoice.totals.goods).toBe(6);
  });

  it("handles an empty box", () => {
    const invoice = buildBoxInvoice([], "4.00");
    expect(invoice.lines).toEqual([]);
    expect(invoice.totals.goods).toBe(0);
    expect(invoice.totals.grand).toBe(4);
  });
});

describe("what the box delivery cost us stays ours", () => {
  const read = (p: string) => fs.readFileSync(path.join(__dirname, "..", p), "utf8").replace(/\r\n/g, "\n");

  it("is not among the columns the customer's queries fetch", () => {
    // deliveryCostUsd is the courier's price to us; deliveryChargeUsd is the
    // customer's. The difference is our margin, and it is kept off this
    // document the same way a batch invoice keeps the purchase price off:
    // by never loading it.
    const dbFile = read("server/db/deliveryBoxes.db.ts");
    const start = dbFile.indexOf("const CUSTOMER_BOX_FIELDS");
    expect(start, "the customer-safe column list has gone missing").toBeGreaterThan(-1);

    const body = dbFile.slice(start, dbFile.indexOf("};", start));
    expect(body, "the customer's box query now fetches what delivery cost us").not.toContain("deliveryCostUsd");
    expect(body, "and the profit on it").not.toContain("deliveryProfitUsd");
  });
});
