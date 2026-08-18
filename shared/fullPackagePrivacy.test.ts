import { describe, expect, it } from "vitest";
import { concealsSizeAndCarriage, concealParcelSize, concealOrderSize } from "./fullPackagePrivacy";
import { buildBatchInvoice, type InvoiceOrder } from "./batchInvoice";
import { buildBoxInvoice, type BoxItem } from "./boxInvoice";

/**
 * The owner's rule: a full-package customer sees the agreed price and nothing
 * else — no weight, no volume, no dimensions, no freight figure. Each of those
 * is half of a subtraction whose other half (the agreed price) the customer
 * already holds, and the difference is the margin.
 *
 * Commission is deliberately the opposite: that customer pays carriage by
 * weight and must be able to check their own bill.
 */

describe("concealsSizeAndCarriage", () => {
  it("conceals both agreed-price order types", () => {
    expect(concealsSizeAndCarriage("full_package")).toBe(true);
    expect(concealsSizeAndCarriage("purchase_request")).toBe(true);
  });

  it("never conceals commission — that customer checks their bill by weight", () => {
    expect(concealsSizeAndCarriage("commission")).toBe(false);
  });

  it("does not conceal a parcel with no order at all", () => {
    expect(concealsSizeAndCarriage(null)).toBe(false);
    expect(concealsSizeAndCarriage(undefined)).toBe(false);
    expect(concealsSizeAndCarriage("")).toBe(false);
  });
});

describe("concealParcelSize", () => {
  it("nulls every size and carriage field and flags the row", () => {
    const row = concealParcelSize({
      id: 7,
      weightKg: "12.50",
      volumeCbm: "0.100",
      lengthCm: "40",
      widthCm: "30",
      heightCm: "20",
      calculatedCostUsd: "93.75",
      status: "arrived",
    });
    expect(row.weightKg).toBeNull();
    expect(row.volumeCbm).toBeNull();
    expect(row.lengthCm).toBeNull();
    expect(row.widthCm).toBeNull();
    expect(row.heightCm).toBeNull();
    expect(row.calculatedCostUsd).toBeNull();
    expect(row.sizeConcealed).toBe(true);
    // Everything else survives untouched.
    expect(row.id).toBe(7);
    expect(row.status).toBe("arrived");
  });
});

describe("concealOrderSize", () => {
  it("nulls the order-shaped fields but keeps what the customer is charged", () => {
    const order = concealOrderSize({
      id: 3,
      weightKg: "9.00",
      volumeCbm: "0.050",
      dimensionLength: "50",
      dimensionWidth: "40",
      dimensionHeight: "30",
      shippingCostUsd: "41.00",
      shippingChargedUsd: "10.00",
      sellingPriceUsd: "52.00",
    });
    expect(order.weightKg).toBeNull();
    expect(order.volumeCbm).toBeNull();
    expect(order.dimensionLength).toBeNull();
    expect(order.dimensionWidth).toBeNull();
    expect(order.dimensionHeight).toBeNull();
    // What the freight cost us: gone. What the customer is charged: stays.
    expect(order.shippingCostUsd).toBeNull();
    expect(order.shippingChargedUsd).toBe("10.00");
    expect(order.sellingPriceUsd).toBe("52.00");
    expect(order.sizeConcealed).toBe(true);
  });
});

const resale = (over: Partial<InvoiceOrder> = {}): InvoiceOrder => ({
  id: 1,
  orderCode: "FP-1",
  orderType: "full_package",
  productName: "Chairs",
  sellingPriceUsd: "52.00",
  weightKg: "14.000",
  shippingCostUsd: "35.00",
  ...over,
});

const commission = (over: Partial<InvoiceOrder> = {}): InvoiceOrder => ({
  id: 2,
  orderCode: "CM-1",
  orderType: "commission",
  productName: "Bags",
  itemPriceUsd: "20.00",
  commissionFeeUsd: "5.00",
  weightKg: "6.000",
  shippingCostUsd: "15.00",
  ...over,
});

describe("buildBatchInvoice — customer edition (concealAgreedPriceSize)", () => {
  const conceal = { concealAgreedPriceSize: true };

  it("an agreed-price line carries no weight, no share, no carriage — the total IS the goods", () => {
    const { lines } = buildBatchInvoice([resale()], 0, conceal);
    expect(lines[0].sizeConcealed).toBe(true);
    expect(lines[0].weightKg).toBe(0);
    expect(lines[0].weightShare).toBe(0);
    expect(lines[0].shipping).toBe(0);
    // The ledger bills these orders at selling price alone
    // (computeOrderChargeAmount) — the document now matches the bill.
    expect(lines[0].total).toBe(52);
  });

  it("the commission line on the same invoice keeps every figure", () => {
    const { lines } = buildBatchInvoice([resale(), commission()], 0, conceal);
    const cm = lines.find((l) => l.orderCode === "CM-1")!;
    expect(cm.sizeConcealed).toBeUndefined();
    expect(cm.weightKg).toBe(6);
    expect(cm.shipping).toBe(15);
    expect(cm.total).toBe(40);
  });

  it("the weight total counts visible lines only — else the hidden weight is one subtraction away", () => {
    const { totals } = buildBatchInvoice([resale(), commission()], 0, conceal);
    expect(totals.weightKg).toBe(6);
    expect(totals.shipping).toBe(15);
  });

  it("without the option (the staff invoice) nothing is concealed", () => {
    const { lines, totals } = buildBatchInvoice([resale(), commission()], 0);
    const fp = lines.find((l) => l.orderCode === "FP-1")!;
    expect(fp.sizeConcealed).toBeUndefined();
    expect(fp.weightKg).toBe(14);
    expect(fp.shipping).toBe(35);
    expect(totals.weightKg).toBe(20);
  });

  it("purchase_request conceals exactly like full_package", () => {
    const { lines } = buildBatchInvoice([resale({ orderType: "purchase_request" })], 0, conceal);
    expect(lines[0].sizeConcealed).toBe(true);
    expect(lines[0].weightKg).toBe(0);
  });
});

const boxItem = (over: Partial<BoxItem> = {}): BoxItem => ({
  id: 1,
  trackingNumber: "JT1",
  description: "Shoes",
  weightKg: "3.000",
  calculatedCostUsd: "18.00",
  itemType: "regular",
  ...over,
});

describe("buildBoxInvoice — customer edition (concealFullPackageSize)", () => {
  const conceal = { concealFullPackageSize: true };

  it("a full-package carton keeps its agreed price and loses its weight", () => {
    const { lines } = buildBoxInvoice(
      [boxItem({ id: 9, itemType: "full_package", weightKg: "14.000", calculatedCostUsd: "52.00" })],
      0, "—", conceal,
    );
    expect(lines[0].sizeConcealed).toBe(true);
    expect(lines[0].weightKg).toBe(0);
    // The agreed price is exactly what the customer is meant to see.
    expect(lines[0].cost).toBe(52);
  });

  it("regular and commission cartons in the same box keep their weight", () => {
    const { lines, totals } = buildBoxInvoice(
      [
        boxItem({ id: 1, itemType: "full_package", weightKg: "14.000" }),
        boxItem({ id: 2, itemType: "regular", weightKg: "3.000" }),
        boxItem({ id: 3, itemType: "commission", weightKg: "2.000" }),
      ],
      0, "—", conceal,
    );
    expect(lines.find((l) => l.id === 2)!.weightKg).toBe(3);
    expect(lines.find((l) => l.id === 3)!.weightKg).toBe(2);
    // Box total counts the visible rows only.
    expect(totals.weightKg).toBe(5);
  });

  it("without the option (the staff document) the full-package weight shows", () => {
    const { lines, totals } = buildBoxInvoice(
      [boxItem({ id: 9, itemType: "full_package", weightKg: "14.000" })],
      0,
    );
    expect(lines[0].sizeConcealed).toBeUndefined();
    expect(lines[0].weightKg).toBe(14);
    expect(totals.weightKg).toBe(14);
  });
});
