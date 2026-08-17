import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { buildBatchInvoice, goodsBasis, mayShowItemPrice, type InvoiceOrder } from "./batchInvoice";

const commission = (over: Partial<InvoiceOrder> = {}): InvoiceOrder => ({
  id: 1,
  orderCode: "CM-0001",
  orderType: "commission",
  productName: "جل و بەرگ",
  itemPriceUsd: "80.00",
  commissionFeeUsd: "12.00",
  weightKg: "5.000",
  ...over,
});

const resale = (over: Partial<InvoiceOrder> = {}): InvoiceOrder => ({
  id: 2,
  orderCode: "FP-0001",
  orderType: "full_package",
  productName: "پێڵاو",
  sellingPriceUsd: "150.00",
  weightKg: "5.000",
  ...over,
});

describe("what the customer is allowed to see", () => {
  it("breaks a commission order into item price and fee", () => {
    // The customer chose the item and knows what it cost. Hiding it would
    // read as evasive on the one order type where we are openly a middleman.
    const { lines } = buildBatchInvoice([commission()]);
    expect(lines[0].basis).toBe("item_plus_commission");
    expect(lines[0].itemPrice).toBe(80);
    expect(lines[0].commissionFee).toBe(12);
    expect(lines[0].goods).toBe(92);
  });

  it("gives a resale order one figure and no breakdown", () => {
    // The only price this customer was ever quoted. A second number beside
    // it would be our margin, printed on their invoice.
    const { lines } = buildBatchInvoice([resale()]);
    expect(lines[0].basis).toBe("agreed_price");
    expect(lines[0].goods).toBe(150);
    expect(lines[0].itemPrice).toBeUndefined();
    expect(lines[0].commissionFee).toBeUndefined();
  });

  it("treats a purchase request like a resale order", () => {
    expect(goodsBasis("purchase_request")).toBe("agreed_price");
    expect(mayShowItemPrice("purchase_request")).toBe(false);
    expect(mayShowItemPrice("commission")).toBe(true);
  });

  it("never reads what we paid, whatever is handed to it", () => {
    // purchasePriceUsd is not a field on InvoiceOrder at all. Even passed in
    // deliberately, it cannot reach a line — the safest place for a number a
    // customer must not see is nowhere near the document.
    const sneaked = { ...resale(), purchasePriceUsd: "40.00" } as InvoiceOrder;
    const { lines } = buildBatchInvoice([sneaked]);
    expect(JSON.stringify(lines[0])).not.toContain("40");
    expect(lines[0].goods).toBe(150);
  });
});

describe("splitting the carriage", () => {
  it("uses what was actually charged when there is a stored figure", () => {
    // Recomputing would let the invoice disagree with the ledger, and the
    // ledger is what the customer's balance was built from.
    const { lines, totals } = buildBatchInvoice(
      [commission({ shippingCostUsd: "12.95" }), resale({ shippingCostUsd: "23.45" })],
      "999.00",
    );
    expect(lines.map((l) => l.shipping)).toEqual([12.95, 23.45]);
    expect(totals.shipping).toBe(36.4);
  });

  it("shares by weight when nothing was stored", () => {
    const { lines } = buildBatchInvoice(
      [commission({ weightKg: "3.000" }), resale({ weightKg: "9.000" })],
      "40.00",
    );
    expect(lines[0].shipping).toBe(10);
    expect(lines[1].shipping).toBe(30);
  });

  it("adds up to the batch's carriage exactly, cent for cent", () => {
    // Three parcels splitting ten dollars is 3.33 + 3.33 + 3.33 = 9.99, and a
    // total a cent short of its own lines is the fastest way to lose a
    // customer's trust in the whole document.
    const { lines, totals } = buildBatchInvoice(
      [
        commission({ id: 1, weightKg: "1.000" }),
        commission({ id: 2, weightKg: "1.000" }),
        commission({ id: 3, weightKg: "1.000" }),
      ],
      "10.00",
    );
    expect(lines.reduce((sum, l) => sum + l.shipping, 0)).toBe(10);
    expect(totals.shipping).toBe(10);
  });

  it("gives the same answer every time it is opened", () => {
    const orders = [
      commission({ id: 1, weightKg: "2.500" }),
      commission({ id: 2, weightKg: "2.500" }),
      commission({ id: 3, weightKg: "5.000" }),
    ];
    const first = buildBatchInvoice(orders, "7.00").lines.map((l) => l.shipping);
    const second = buildBatchInvoice(orders, "7.00").lines.map((l) => l.shipping);
    expect(first).toEqual(second);
  });

  it("shows what share of the weight each parcel is", () => {
    // Without it the carriage figure is a number the customer has to accept.
    const { lines } = buildBatchInvoice([commission({ weightKg: "5.000" }), resale({ weightKg: "15.000" })], "40.00");
    expect(lines[0].weightShare).toBe(25);
    expect(lines[1].weightShare).toBe(75);
  });

  it("charges nothing for carriage when no weight was ever recorded", () => {
    // Better a zero the office can see and correct than a figure invented
    // from a division by nothing.
    const { lines } = buildBatchInvoice([commission({ weightKg: null }), resale({ weightKg: null })], "40.00");
    expect(lines.map((l) => l.shipping)).toEqual([0, 0]);
  });
});

describe("the totals", () => {
  it("are the sum of the lines above them", () => {
    const { lines, totals } = buildBatchInvoice(
      [commission({ shippingCostUsd: "12.95" }), resale({ shippingCostUsd: "23.45" })],
      0,
    );
    expect(totals.goods).toBe(242);
    expect(totals.shipping).toBe(36.4);
    expect(totals.grand).toBe(278.4);
    expect(totals.grand).toBe(lines.reduce((sum, l) => sum + l.total, 0));
  });

  it("takes off what was already paid", () => {
    const { totals } = buildBatchInvoice([commission({ advancePaidUsd: "50.00", shippingCostUsd: "8.00" })], 0);
    expect(totals.advancePaid).toBe(50);
    expect(totals.grand).toBe(100);
    expect(totals.due).toBe(50);
  });

  it("never shows a negative amount due", () => {
    // Overpaid is credit, and credit belongs on the account rather than as a
    // minus sign on a document the customer might read as owing them money.
    const { totals } = buildBatchInvoice([commission({ advancePaidUsd: "500.00" })], 0);
    expect(totals.due).toBe(0);
  });

  it("does not drift on amounts that break binary floats", () => {
    const { totals } = buildBatchInvoice(
      [
        commission({ id: 1, itemPriceUsd: "0.10", commissionFeeUsd: "0", weightKg: "1" }),
        commission({ id: 2, itemPriceUsd: "0.20", commissionFeeUsd: "0", weightKg: "1" }),
      ],
      0,
    );
    expect(totals.goods).toBe(0.3);
  });

  it("counts the orders with no price rather than guessing one", () => {
    const invoice = buildBatchInvoice([resale({ sellingPriceUsd: null }), commission()]);
    expect(invoice.unpriced).toBe(1);
    expect(invoice.totals.goods).toBe(92);
  });

  it("handles a batch with nothing in it", () => {
    const invoice = buildBatchInvoice([], "40.00");
    expect(invoice.lines).toEqual([]);
    expect(invoice.totals.grand).toBe(0);
    expect(invoice.totals.due).toBe(0);
  });
});

describe("the cost we paid stays out of the customer's reach", () => {
  // The rule is only worth anything if the endpoint that feeds the portal
  // also honours it. A screen cannot show what it was never sent.
  const read = (p: string) => fs.readFileSync(path.join(__dirname, "..", p), "utf8").replace(/\r\n/g, "\n");

  it("is never fetched by the query that feeds both invoices", () => {
    // The real gate. getCustomerOrdersInBatch names its columns instead of
    // using select(), because the row it would otherwise return carries
    // purchasePriceUsd and grossProfitUsd — our margin, one hop from a
    // document the customer reads.
    const dbFile = read("server/db/fullPackage.db.ts");
    const start = dbFile.indexOf("export async function getCustomerOrdersInBatch");
    expect(start, "the shared fetch has gone missing").toBeGreaterThan(-1);

    const body = dbFile.slice(start, dbFile.indexOf("export async function", start + 10));
    for (const forbidden of ["purchasePriceUsd", "grossProfitUsd", "netProfitUsd", "purchasePriceCny"]) {
      expect(body, `the invoice fetch reads ${forbidden}`).not.toContain(forbidden);
    }
    // A bare select() would hand over every column including those.
    expect(body, "a bare select() defeats the whole point").not.toMatch(/\.select\(\)/);
  });

  it("is served to the customer through their own session, never an id in the request", () => {
    // A batch holds many customers' parcels. Reading the batch id from the
    // caller is fine; trusting the caller for whose parcels to return is how
    // one customer is handed another's invoice.
    const router = read("server/routers/portal.router.ts");
    const start = router.indexOf("getMyBatchInvoice:");
    expect(start, "the portal batch-invoice endpoint has gone missing").toBeGreaterThan(-1);

    const body = router.slice(start, router.indexOf("// Get unbatched packages", start));
    expect(body).toContain("customerProcedure");
    expect(body).toContain("ctx.customerId");
    expect(body, "the customer id came from the request").not.toMatch(/input\.customerId/);
  });
});
