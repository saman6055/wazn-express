/**
 * One batch, itemised for the customer who paid for it.
 *
 * A customer receiving four parcels gets one figure and no way to check it.
 * The question they actually ask — "what did each of these cost me, and why
 * that much for shipping?" — has never had an answer on any screen, so it
 * arrives by WhatsApp instead and somebody works it out by hand.
 *
 * This builds that answer: parcel by parcel, goods and carriage separately,
 * with the weight that produced the carriage figure, and a total that is
 * visibly the sum of the lines above it.
 *
 * One rule here is not cosmetic. **A resale order shows the customer the
 * selling price and never what we paid.** On a commission order the customer
 * already knows the item price — they chose it, we bought it, we charge a fee
 * for doing so — and hiding it would look evasive. On a full-package order
 * they know only what they pay us; printing the purchase price beside it puts
 * our margin on their invoice. The two order types are genuinely different
 * and the difference lives here, once, rather than in each screen that draws
 * a line item.
 */

export type OrderType = "full_package" | "purchase_request" | "commission";

/** What the customer is being charged for the goods, and whether it breaks down. */
export type GoodsBasis = "item_plus_commission" | "agreed_price";

export interface InvoiceOrder {
  id: number;
  orderCode: string;
  orderType: string;
  productName: string;
  productImage?: string | null;
  trackingNumber?: string | null;
  weightKg?: string | number | null;
  /** What this order was charged for carriage, if it has already been worked out. */
  shippingCostUsd?: string | number | null;
  /** Commission orders: the price of the goods the customer already knows. */
  itemPriceUsd?: string | number | null;
  commissionFeeUsd?: string | number | null;
  /** Resale orders: the only price the customer has ever been quoted. */
  sellingPriceUsd?: string | number | null;
  advancePaidUsd?: string | number | null;
}

export interface InvoiceLine {
  orderId: number;
  orderCode: string;
  orderType: OrderType;
  productName: string;
  image: string | null;
  trackingNumber: string | null;
  weightKg: number;
  /** The share of the batch's weight this parcel is, as a percentage. */
  weightShare: number;
  goods: number;
  basis: GoodsBasis;
  /** Present only when the basis is item + commission. */
  itemPrice?: number;
  commissionFee?: number;
  shipping: number;
  total: number;
  advancePaid: number;
}

export interface BatchInvoice {
  lines: InvoiceLine[];
  totals: {
    goods: number;
    shipping: number;
    weightKg: number;
    advancePaid: number;
    /** Goods plus carriage, before anything already paid. */
    grand: number;
    /** What is actually left to settle. Never below zero. */
    due: number;
  };
  /** Orders in the batch that carry no price at all — counted, never guessed at. */
  unpriced: number;
}

const cents = (v: string | number | null | undefined): number => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "0"));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};

const grams = (v: string | number | null | undefined): number => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "0"));
  return Number.isFinite(n) ? Math.round(n * 1000) : 0;
};

const money = (c: number): number => c / 100;
const kilos = (g: number): number => Math.round(g) / 1000;

/** Commission is the one type where the customer already knows the item price. */
export function goodsBasis(orderType: string): GoodsBasis {
  return orderType === "commission" ? "item_plus_commission" : "agreed_price";
}

/**
 * Whether this line may show what the goods cost us.
 *
 * Only ever true for commission, and stated as its own function so a screen
 * that wants to render a cost has to ask the question rather than assume.
 * `purchasePriceUsd` is not a field on the invoice at all — the safest way to
 * keep a number off a customer's document is never to put it there.
 */
export function mayShowItemPrice(orderType: string): boolean {
  return goodsBasis(orderType) === "item_plus_commission";
}

/**
 * Carriage for one parcel.
 *
 * The stored figure wins when there is one: it is what the customer was
 * actually charged, and recomputing it would let the invoice disagree with
 * the ledger. Only when nothing was stored is it shared out by weight, which
 * is the rule the office uses anyway.
 *
 * Both are in cents, and the shares are handed out largest-first with the
 * remainder going to the heaviest parcel. Three parcels splitting $10 come to
 * $10.00, not $9.99 — a total that is a cent off its own lines is the fastest
 * way to lose a customer's trust in the whole document.
 */
function shippingShares(orders: readonly InvoiceOrder[], batchShippingCents: number): number[] {
  const stored = orders.map((o) => cents(o.shippingCostUsd));
  if (stored.some((c) => c > 0)) return stored;
  if (batchShippingCents <= 0) return orders.map(() => 0);

  const weights = orders.map((o) => grams(o.weightKg));
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  if (totalWeight <= 0) return orders.map(() => 0);

  const raw = weights.map((w) => (batchShippingCents * w) / totalWeight);
  const shares = raw.map((r) => Math.floor(r));
  let remainder = batchShippingCents - shares.reduce((a, b) => a + b, 0);

  // Hand the leftover cents to the parcels with the largest fractional claim,
  // heaviest first when they tie. Deterministic, so the same batch invoices
  // to the same figures every time it is opened.
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r), weight: weights[i] }))
    .sort((a, b) => b.frac - a.frac || b.weight - a.weight);

  for (const { i } of order) {
    if (remainder <= 0) break;
    shares[i] += 1;
    remainder -= 1;
  }

  return shares;
}

/**
 * The invoice.
 *
 * `batchShippingUsd` is only consulted when the orders carry no stored
 * carriage of their own.
 */
export function buildBatchInvoice(
  orders: readonly InvoiceOrder[],
  batchShippingUsd: string | number | null | undefined = 0,
): BatchInvoice {
  const shipping = shippingShares(orders, cents(batchShippingUsd));
  const totalWeightGrams = orders.reduce((sum, o) => sum + grams(o.weightKg), 0);

  let goodsTotal = 0;
  let shippingTotal = 0;
  let advanceTotal = 0;
  let unpriced = 0;

  const lines: InvoiceLine[] = orders.map((order, index) => {
    const basis = goodsBasis(order.orderType);
    const itemPrice = cents(order.itemPriceUsd);
    const commissionFee = cents(order.commissionFeeUsd);
    const goods = basis === "item_plus_commission" ? itemPrice + commissionFee : cents(order.sellingPriceUsd);

    if (goods === 0) unpriced += 1;

    const weight = grams(order.weightKg);
    const carriage = shipping[index] ?? 0;
    const advance = cents(order.advancePaidUsd);

    goodsTotal += goods;
    shippingTotal += carriage;
    advanceTotal += advance;

    const line: InvoiceLine = {
      orderId: order.id,
      orderCode: order.orderCode,
      orderType: (order.orderType as OrderType) ?? "full_package",
      productName: order.productName,
      image: order.productImage ?? null,
      trackingNumber: order.trackingNumber ?? null,
      weightKg: kilos(weight),
      weightShare: totalWeightGrams > 0 ? Math.round((weight / totalWeightGrams) * 1000) / 10 : 0,
      goods: money(goods),
      basis,
      shipping: money(carriage),
      total: money(goods + carriage),
      advancePaid: money(advance),
    };

    // Only a commission line carries the two halves. A resale line has no
    // second number the customer is entitled to see, so it has none at all.
    if (basis === "item_plus_commission") {
      line.itemPrice = money(itemPrice);
      line.commissionFee = money(commissionFee);
    }

    return line;
  });

  const grand = goodsTotal + shippingTotal;

  return {
    lines,
    totals: {
      goods: money(goodsTotal),
      shipping: money(shippingTotal),
      weightKg: kilos(totalWeightGrams),
      advancePaid: money(advanceTotal),
      grand: money(grand),
      // An advance larger than the invoice leaves credit, which belongs on the
      // account, not as a negative "amount due" on a document.
      due: money(Math.max(0, grand - advanceTotal)),
    },
    unpriced,
  };
}
