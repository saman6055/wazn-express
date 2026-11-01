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

describe("what a delivery box tells the customer", () => {
  const src = read("db/deliveryBoxes.db.ts");

  /**
   * `getCustomerVisibleBoxes` was `select()`. Alongside the price the customer
   * pays, every box in the portal carried what the delivery had cost us and
   * what we had made on it — the company's margin, in a response the customer
   * can open in their browser's network tab.
   */
  it("never sends the company's delivery cost or profit", () => {
    const fields = src.slice(
      src.indexOf("const CUSTOMER_BOX_FIELDS"),
      src.indexOf("export async function getCustomerVisibleBoxes"),
    );
    expect(fields.length, "CUSTOMER_BOX_FIELDS must exist").toBeGreaterThan(0);
    for (const secret of ["deliveryCostUsd", "deliveryProfitUsd", "notes", "createdById", "sealedById", "deliveredById"]) {
      expect(fields, `${secret} is ours, not the customer's`).not.toContain(secret);
    }
    expect(fields, "the price they were charged is theirs to see").toContain("deliveryChargeUsd");
  });

  it("builds the customer's list from the allow-list, with a ceiling", () => {
    const fn = src.slice(
      src.indexOf("export async function getCustomerVisibleBoxes"),
      src.indexOf("export async function getCustomerBoxProof"),
    );
    expect(fn).toContain("db.select(CUSTOMER_BOX_FIELDS)");
    expect(fn, "an account with years of boxes must not return all of them").toContain(".limit(limit)");
  });

  /**
   * The photo and signature are the evidence in a "I never got it" dispute,
   * so the customer should be able to see them — but a box id is a small
   * integer. The ownership check belongs inside the WHERE clause, not in a
   * caller that a later refactor can forget.
   */
  it("scopes the delivery proof to the customer inside the query", () => {
    const fn = src.slice(src.indexOf("export async function getCustomerBoxProof"));
    expect(fn).toContain("eq(deliveryBoxes.customerId, customerId)");
    expect(fn).toContain("eq(deliveryBoxes.id, boxId)");
  });
});

describe("the portal's list queries are bounded", () => {
  const portal = read("db/portal.db.ts");

  /**
   * Every one of these ran without a ceiling. They are the queries whose cost
   * grows with how long someone has been a customer — the accounts we most
   * want to keep are the ones the portal got slowest for.
   */
  for (const fn of ["getCustomerBatches", "getCustomerUnbatchedPackages", "getCustomerVisiblePackages"]) {
    it(`${fn} takes a limit`, () => {
      const body = portal.slice(portal.indexOf(`export async function ${fn}(`));
      expect(body.slice(0, 200), "must accept a bound").toMatch(/limit = \d+/);
      expect(body.slice(0, 2500), "must apply it").toContain(".limit(limit)");
    });
  }

  /**
   * The signature and delivery-photo columns are base64 images. A list screen
   * renders neither, and one of these queries used to send both for every
   * parcel the customer had ever had.
   */
  it("both parcel lists share one allow-list", () => {
    expect(portal).toContain("const CUSTOMER_PACKAGE_FIELDS");
    const uses = portal.match(/db\s*\n?\s*\.?select\(CUSTOMER_PACKAGE_FIELDS\)/g) ?? [];
    expect(uses.length, "both list queries must use it").toBeGreaterThanOrEqual(2);
    const konst = portal.slice(
      portal.indexOf("const CUSTOMER_PACKAGE_FIELDS"),
      portal.indexOf("} as const;", portal.indexOf("const CUSTOMER_PACKAGE_FIELDS")),
    );
    for (const heavy of ["recipientSignature", "deliveryPhoto", "qrCodeData", "qrCodeSignature", "notes"]) {
      expect(konst, `${heavy} does not belong in a customer's list`).not.toContain(heavy);
    }
  });
});

describe("a customer confirming a box does not fan out", () => {
  const src = read("db/deliveryBoxes.db.ts");
  const fn = src.slice(src.indexOf("export async function confirmBoxReceivedByCustomer"));

  // Was one UPDATE per parcel, awaited in sequence, while the customer's
  // phone sat on a spinner — and a dropped connection halfway left half a
  // box delivered.
  it("marks the parcels in one statement", () => {
    expect(fn).toContain("inArray(packages.id, packageIds)");
    expect(fn.slice(0, fn.indexOf("return { ok: true }")))
      .not.toMatch(/for \(const \w+ of items\)/);
  });
});

describe("what a parcel tells the customer", () => {
  const portal = read("db/portal.db.ts");
  const router = read("routers/portal.router.ts");

  /**
   * `getPackageDetails` returned the row whole. Alongside the office's `notes`
   * and the staff user id on every timestamp, that included `qrCodeData` and
   * `qrCodeSignature` — the signed payload a scanner verifies. Publishing it
   * to the browser gives away the shape of a valid label to anyone who opens
   * the network tab on their own parcel.
   */
  it("the detail view never returns the signed QR payload", () => {
    const fn = portal.slice(portal.indexOf("export async function getCustomerPackageDetail"));
    for (const secret of ["qrCodeData", "qrCodeSignature", "notes:", "registeredById", "deliveredById", "claimedById", "appliedPricingRuleId"]) {
      expect(fn.slice(0, 1600), `${secret} is ours, not the customer's`).not.toContain(secret);
    }
    // The delivery proof is theirs; a detail view is the right place for it.
    expect(fn.slice(0, 1600)).toContain("deliveryPhoto");
    expect(fn.slice(0, 1600)).toContain("recipientSignature");
  });

  it("scopes the parcel to its owner inside the query", () => {
    const fn = portal.slice(portal.indexOf("export async function getCustomerPackageDetail"));
    expect(fn.slice(0, 1600)).toContain("eq(packages.customerId, customerId)");
    // And the router must go through it rather than back to the raw getter.
    // Matched on the name alone: which procedure kind guards it is a separate
    // decision, and pinning it here made this fail when the portal moved to
    // customerProcedure without anything about the scoping having changed.
    const proc = router.slice(
      router.indexOf("getPackageDetails:"),
      router.indexOf("getPackageTimeline"),
    );
    expect(proc).toContain("getCustomerPackageDetail");
    expect(proc, "the raw row must not come back").not.toMatch(/db\.getPackageById/);
  });
});
