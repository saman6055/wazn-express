import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { toCustomerVisibleBatch, FORBIDDEN_BATCH_FIELDS, VISIBLE_BATCH_KEYS } from "./lib/customerVisibleBatch";
import { toCustomerVisibleOrder } from "./lib/customerVisibleOrder";
import { concealOrderSize } from "@shared/fullPackagePrivacy";

/**
 * What the portal sends is what a customer can read — rendered or not.
 *
 * Phase-two audit (2026-09-10): the screens were clean and the wire was not.
 * A batch-detail query shipped the whole parcel row; the public price list
 * shipped what services cost us; drafts were readable by id; staff user ids
 * rode along on receipts, messages, yuan orders and prohibited items. Every
 * fix is an allow-list or a stripped field, and each is pinned here.
 */

const ROOT = __dirname;
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8").replace(/\r\n/g, "\n");

/** Slice between two markers, failing loudly if either has moved. */
function between(src: string, start: string, end: string): string {
  const a = src.indexOf(start);
  expect(a, `marker not found: ${start}`).toBeGreaterThan(-1);
  const b = src.indexOf(end, a + start.length);
  expect(b, `end marker not found after ${start}: ${end}`).toBeGreaterThan(-1);
  return src.slice(a, b);
}

describe("a shipment card carries only what the customer may see", () => {
  const row: Record<string, unknown> = Object.fromEntries(VISIBLE_BATCH_KEYS.map((k) => [k, `ok-${k}`]));
  for (const f of FORBIDDEN_BATCH_FIELDS) row[f] = `SECRET-${f}`;

  it("keeps exactly the allow-listed keys", () => {
    const visible = toCustomerVisibleBatch(row as any);
    expect(Object.keys(visible).sort()).toEqual([...VISIBLE_BATCH_KEYS].sort());
  });

  it("drops every internal column, including ones added later", () => {
    const json = JSON.stringify(toCustomerVisibleBatch({ ...row, someFutureColumn: "SECRET-new" } as any));
    expect(json).not.toContain("SECRET-");
  });

  it("is what the portal query uses — no spread of the raw row", () => {
    const fn = between(read("db/portal.db.ts"), "export async function getCustomerBatches(", "\nexport async function");
    expect(fn).toContain("toCustomerVisibleBatch(batch)");
    expect(fn).not.toContain("} = batch;");
  });
});

describe("parcel and claim queries use named columns", () => {
  const portalDb = read("db/portal.db.ts");

  it("the batch-detail parcels use the parcel allow-list", () => {
    const fn = between(portalDb, "export async function getCustomerPackagesInBatch(", "\nexport async function");
    expect(fn).toContain("db.select(CUSTOMER_PACKAGE_FIELDS).from(packages)");
    expect(fn).not.toContain("db.select().from(packages)");
  });

  it("claim requests keep the office's answer and drop the reviewer's id", () => {
    const fn = between(portalDb, "export async function getClaimRequestsByCustomer(", "\n}\n");
    expect(fn).toContain("adminNote: packageClaimRequests.adminNote");
    // Checks the selected keys, not the comment that explains the omission.
    expect(fn).not.toContain("reviewedById: ");
    expect(fn).not.toContain("db.select()\n");
  });
});

describe("portal procedures strip staff identity", () => {
  const router = read("routers/portal.router.ts");

  it("an unclaimed search result is the pool's columns, not the row", () => {
    const body = between(router, "searchTrackingExtra:", "getRatablePackage:");
    expect(body).not.toContain("? pkg : null");
    expect(body).toContain("trackingNumber: pkg.trackingNumber");
  });

  it("a receipt carries the transaction, not who posted it", () => {
    const body = between(router, "getReceiptData:", "getPackageDetails:");
    expect(body).toContain("transactionNumber: transaction.transactionNumber");
    expect(body).not.toMatch(/createdById|approvedById/);
  });

  it("messages drop the sender's user id", () => {
    const body = between(router, "getMyMessages:", "markMessagesAsRead:");
    expect(body.match(/senderId: _senderId/g)?.length).toBe(2);
  });

  it("yuan orders drop the handler's user id", () => {
    const body = between(router, "getMyYuanOrders:", "getGreeting:");
    expect(body.match(/handledById: _handledById/g)?.length).toBe(2);
  });

  it("prohibited items reach the customer through one filter", () => {
    const src = read("routers/prohibited.router.ts");
    expect(src).toContain("function forCustomer");
    expect(between(src, "getMine:", "markViewed:")).toContain("map(forCustomer)");
  });

  it("support chat hides triage and staff ids from customers", () => {
    const src = read("routers/admin.router.ts");
    expect(between(src, "getMessages: protectedProcedure", "markAsRead:")).toContain("messageForCaller(");
    expect(between(src, "getChatById: protectedProcedure", "sendMessage:")).toContain("chatForCaller(");
  });
});

describe("the public price list and blog", () => {
  it("services never publish what they cost us", () => {
    const fn = between(read("db/services.db.ts"), "export async function getPortalServiceTypes(", "\n}\n");
    expect(fn).not.toContain("defaultCost: ");
    expect(fn).not.toContain("db.select().from(serviceTypes)");
    expect(fn).toContain("defaultPrice: serviceTypes.defaultPrice");
  });

  it("shipping rates never publish the office's notes or staff ids", () => {
    const fn = between(read("db/settings.db.ts"), "export async function getPortalShippingRates(", "\n}\n");
    expect(fn).not.toMatch(/notes: |createdById: /);
    expect(fn).not.toContain("db.select().from(pricingRules)");
  });

  it("single-post readers only return what the published lists show", () => {
    const src = read("routers/services.router.ts");
    expect(between(src, "getById: publicProcedure", "getBySlug:")).toContain("blogPostReadable(");
    expect(between(src, "getBySlug: publicProcedure", "}),")).toContain("blogPostReadable(");
    expect(between(src, "function blogPostReadable(", "\n}\n")).toContain('post.status !== "published"');
  });
});

describe("full-package privacy holds everywhere the customer can reach", () => {
  it("a public share link conceals a full-package parcel's weight", () => {
    const fn = between(read("db/shareLinks.db.ts"), "export async function resolveShareLink(", "\n}\n");
    expect(fn).toContain("concealsSizeAndCarriage(orderType)");
  });

  it("an agreed-price order hides what the goods cost", () => {
    const order = concealOrderSize({ sellingPriceUsd: "52.00", itemPriceUsd: "30.00", commissionFeeUsd: "5.00" });
    expect(order.itemPriceUsd).toBeNull();
    expect(order.commissionFeeUsd).toBeNull();
    expect(order.sellingPriceUsd).toBe("52.00");
  });

  it("a commission order still shows both halves of its bill", () => {
    const v = toCustomerVisibleOrder({ id: 1, orderType: "commission", itemPriceUsd: "30.00", commissionFeeUsd: "5.00", createdAt: new Date(0) }) as any;
    expect(v.itemPriceUsd).toBe("30.00");
    expect(v.commissionFeeUsd).toBe("5.00");
  });

  it("a full-package order does not", () => {
    const v = toCustomerVisibleOrder({ id: 1, orderType: "full_package", sellingPriceUsd: "52.00", itemPriceUsd: "30.00", createdAt: new Date(0) }) as any;
    expect(v.itemPriceUsd).toBeNull();
    expect(v.sellingPriceUsd).toBe("52.00");
  });
});

describe("the office's order notes stay in the office", () => {
  it("sends the customer's own note, never the staff note", () => {
    const v = toCustomerVisibleOrder({
      id: 1,
      orderType: "commission",
      notes: "customer owes from last month — pack last",
      customerNotes: "blue one please",
      internalNotes: "do not ship",
      createdAt: new Date(0),
    }) as any;
    const json = JSON.stringify(v);
    expect(json).not.toContain("owes from last month");
    expect(json).not.toContain("do not ship");
    expect(v.notes).toBe("blue one please");
  });
});
