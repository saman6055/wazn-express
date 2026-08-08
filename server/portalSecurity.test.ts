import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { FORBIDDEN_ORDER_FIELDS, toCustomerVisibleOrder, toCustomerVisibleOrders } from "./lib/customerVisibleOrder";

/**
 * The portal is the one surface a stranger can reach. These tests hold the
 * boundary in place: each one is a hole that was open, and each would have
 * shown up as a customer reading somebody else's data or our own numbers.
 */

const ROOT = path.resolve(__dirname);
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");

describe("what an order tells the customer", () => {
  // A join returned the whole row: our purchase price and margin, the
  // supplier's phone and WeChat, and the customer's own passwordHash and
  // ID-document URLs. An allow-list is used rather than a deny-list so a new
  // column is invisible by default instead of published by default.
  const rawOrder = {
    id: 1,
    orderCode: "FP-1",
    orderType: "commission",
    status: "delivered",
    customerId: 7,
    productName: "Jacket",
    sellingPriceUsd: "50.00",
    // The things that must not travel:
    purchasePriceUsd: "20.00",
    purchasePriceCny: "140.00",
    grossProfitUsd: "30.00",
    netProfitUsd: "26.00",
    profitUsd: "26.00",
    supplierId: 4,
    supplierOrderNumber: "S-99",
    supplierTrackingNumber: "SUP-1",
    purchaseInvoiceUrl: "/uploads/invoice.pdf",
    createdAt: new Date(0),
    customer: { id: 7, passwordHash: "$2a$12$hash", passportUrl: "/uploads/p.jpg", nationalIdUrl: "/uploads/n.jpg" },
    supplier: { id: 4, phone: "+86...", wechatId: "wx-1", contactPerson: "Li" },
    batch: { id: 2, batchCode: "B-1", status: "in_transit", shippingType: "air_regular" },
  };

  it("never carries our cost, our margin, or the supplier", () => {
    const visible = toCustomerVisibleOrder(rawOrder as any);
    const json = JSON.stringify(visible);
    for (const field of FORBIDDEN_ORDER_FIELDS) {
      expect(json, `${field} reached the customer`).not.toContain(field);
    }
    // And the values themselves, in case a field is ever renamed.
    expect(json).not.toContain("wx-1");
    expect(json).not.toContain("$2a$12$hash");
    expect(json).not.toContain("/uploads/p.jpg");
  });

  it("keeps what the customer actually needs", () => {
    const visible = toCustomerVisibleOrder(rawOrder as any) as any;
    expect(visible.orderCode).toBe("FP-1");
    expect(visible.sellingPriceUsd).toBe("50.00");
    expect(visible.productName).toBe("Jacket");
    // The batch is how they follow the shipment.
    expect(visible.batch?.batchCode).toBe("B-1");
  });

  it("applies the same rule to the list, which five screens load", () => {
    const json = JSON.stringify(toCustomerVisibleOrders([rawOrder as any]));
    for (const field of FORBIDDEN_ORDER_FIELDS) {
      expect(json, `${field} reached the customer`).not.toContain(field);
    }
  });

  it("does not send the photo gallery with every list row", () => {
    // productImages is a JSON array of base64 data URIs — 200–330 KB per photo
    // — and this list is loaded by five portal screens. Twenty orders with two
    // photos each was 8–13 MB downloaded to draw 48-pixel thumbnails. The card
    // reads productImage; the gallery comes with the detail.
    const withGallery = { ...rawOrder, productImage: "data:image/jpeg;base64,AAA", productImages: ["data:image/jpeg;base64,BBB"] };
    const [listed] = toCustomerVisibleOrders([withGallery as any]) as any[];
    expect(listed.productImages).toBeUndefined();
    expect(listed.productImage, "the thumbnail must survive").toBe("data:image/jpeg;base64,AAA");

    // The detail view is where a customer asked to see them.
    const detail = toCustomerVisibleOrder(withGallery as any) as any;
    expect(detail.productImages).toEqual(["data:image/jpeg;base64,BBB"]);
  });

  it("survives a row with nothing in it", () => {
    expect(() => toCustomerVisibleOrders([])).not.toThrow();
    expect(toCustomerVisibleOrder({ id: 1, createdAt: new Date(0) } as any)).toBeTruthy();
  });
});

describe("what the portal sends about a parcel", () => {
  const portalDb = fs.readFileSync(path.join(ROOT, "db/portal.db.ts"), "utf8");

  it("never carries the delivery signature, photo or QR signature", () => {
    // getPackagesByCustomer returned select() — every column, including
    // recipientSignature and deliveryPhoto, which are written from uncapped
    // strings at delivery and are almost certainly canvas data URIs, plus the
    // staff notes and the signed QR payload.
    const fn = portalDb.slice(portalDb.indexOf("getCustomerVisiblePackages"));
    const body = fn.slice(0, fn.indexOf("\n}"));
    for (const col of ["recipientSignature", "deliveryPhoto", "qrCodeData", "qrCodeSignature", "notes"]) {
      expect(body, col + " must not reach the portal").not.toContain(col);
    }
    // And it is bounded, so the response stops growing with the account.
    expect(body).toMatch(/\.limit\(/);
  });

  it("the unclaimed pool is browsable without the internal columns", () => {
    const fn = portalDb.slice(portalDb.indexOf("getUnclaimedPackagesWithSearch"));
    const body = fn.slice(0, fn.indexOf("\n}"));
    for (const col of ["recipientSignature", "deliveryPhoto", "qrCodeSignature"]) {
      expect(body, col + " must not reach the portal").not.toContain(col);
    }
  });
});

describe("only staff may touch staff permissions", () => {
  // These sat on bare protectedProcedure, which a portal customer satisfies.
  const src = read("routers/admin.router.ts");

  it("every permission writer is admin-gated and hierarchy-checked", () => {
    for (const name of ["setPermission", "setSubPermission", "bulkUpdate", "deletePermissions"]) {
      const decl = new RegExp(`${name}:\\s*adminProcedure`);
      expect(src, `${name} must be adminProcedure`).toMatch(decl);
    }
    // One rule, called by all four, instead of one inline copy and three gaps.
    const calls = src.match(/assertCanManagePermissions\(/g) ?? [];
    expect(calls.length).toBeGreaterThanOrEqual(5); // definition + 4 call sites
  });

  it("the permission matrix is not readable by customers", () => {
    for (const name of ["getUserPermissions", "checkPermission", "checkSubPermission"]) {
      expect(src, `${name} must not be protectedProcedure`).not.toMatch(
        new RegExp(`${name}:\\s*protectedProcedure`),
      );
    }
  });
});

describe("a customer only ever touches their own rows", () => {
  const portalDb = read("db/portal.db.ts");
  const declaredDb = read("db/declaredPackages.db.ts");
  const router = read("routers/portal.router.ts");

  it("marking a notification read is scoped to the reader", () => {
    // Was keyed on the notification id alone, so one customer could mark every
    // other customer's notifications read — including "your password was
    // changed by support".
    expect(portalDb).toMatch(/markNotificationAsRead\([^)]*customerId/);
  });

  it("unsubscribing a push endpoint is scoped to its owner", () => {
    expect(portalDb).toMatch(/deletePushSubscriptionByEndpoint\([^)]*customerId/);
  });

  it("reading back an edited declaration is scoped to its owner", () => {
    // The UPDATE was guarded and the SELECT after it was not, so passing
    // someone else's id wrote nothing and returned their whole row.
    const fn = declaredDb.slice(declaredDb.indexOf("updateDeclaredPackageForCustomer"));
    const body = fn.slice(0, fn.indexOf("\n}"));
    const selectPart = body.slice(body.indexOf(".select("));
    expect(selectPart).toContain("customerId");
  });

  it("a claim stores the parcel's real tracking number", () => {
    // packageId and trackingNumber were independent inputs, never compared,
    // and both admin screens showed the customer-supplied string — so a claim
    // could look correct while pointing at a different parcel.
    expect(router).toMatch(/trackingNumber:\s*pkg\.trackingNumber/);
    expect(router).not.toMatch(/trackingNumber:\s*input\.trackingNumber,\s*\n\s*customerId/);
  });

  it("a tracking number already claimed by someone else is refused", () => {
    // The match at quick-register takes the NEWEST declaration, so accepting a
    // duplicate would silently hand one customer's parcel to another.
    expect(router).toContain("findConflictingDeclaration");
    expect(router).toMatch(/code:\s*"CONFLICT"/);
  });
});
